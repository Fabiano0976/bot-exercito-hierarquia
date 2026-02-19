require("dotenv").config();
const fs = require("fs");
const path = require("path");

const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
} = require("discord.js");

const cfg = require("./config");

// ================== FIXOS ==================
const ROLE_APROVADO_ID = "1327341545661267980"; // 【🔰】Exército Marcone

// TAGS pro nickname
const TAGS = {
  RECRUTA: "[REC]",
  SOLDADO: "[SD]",
  CABO: "[CB]",
  "3SGT": "[3°SGT]",
  "2SGT": "[2°SGT]",
  "1SGT": "[1°SGT]",
  SUBTEN: "[SUB-TEN]",
  ASP: "[ASP]",
  "2TEN": "[2°TEN]",
  "1TEN": "[1°TEN]",
  CAP: "[CAP]",
  MAJ: "[MAJ]",
  TCEL: "[TEN-CEL]",
  CEL: "[CEL]",
  GBRIG: "[GEN-BRI]",
  GDIV: "[GEN-DIV]",
  GEX: "[GEN-EX]",
  MAR: "[MAR]",
};

function tagByValue(value) {
  return TAGS[value] ?? "[EB]";
}
function makeNick({ value, nome, id }) {
  return `${tagByValue(value)} ${nome} | ${id}`;
}

function patenteLabelByValue(value) {
  return cfg.PATENTES.find((p) => p.value === value)?.label ?? value;
}
function patenteRoleIdByValue(value) {
  return cfg.PATENTES.find((p) => p.value === value)?.roleId ?? null;
}
const RANK_ROLE_IDS = new Set((cfg.PATENTES || []).map((p) => p.roleId).filter(Boolean));

function isStaff(member) {
  if (Array.isArray(cfg.STAFF_ROLE_IDS) && cfg.STAFF_ROLE_IDS.length > 0) {
    return cfg.STAFF_ROLE_IDS.some((rid) => member.roles.cache.has(rid));
  }
  return member.permissions.has(PermissionsBitField.Flags.Administrator);
}

// ================== STATE FILES ==================
const PANEL_STATE_PATH = path.join(__dirname, "panel_state.json");
function loadJsonSafe(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}
function saveJsonSafe(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ================== CLIENT ==================
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  partials: [Partials.GuildMember],
});

// ================== PAINEL FIXO ==================
async function ensurePainelFixo() {
  const canalPainelId = process.env.CANAL_PAINEL_ID;
  if (!canalPainelId) throw new Error("Faltou CANAL_PAINEL_ID no .env/variables");

  const channel = await client.channels.fetch(canalPainelId);

  const embed = new EmbedBuilder()
    .setTitle("📋 Solicitação de Acesso")
    .setDescription("Clique no botão abaixo para iniciar sua solicitação.")
    .setFooter({ text: "Recursos Humanos – Exército" });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("btn_solicitar").setLabel("SOLICITAR").setStyle(ButtonStyle.Success)
  );

  const state = loadJsonSafe(PANEL_STATE_PATH, {});
  if (state.panelMessageId) {
    try {
      const msg = await channel.messages.fetch(state.panelMessageId);
      await msg.edit({ embeds: [embed], components: [row] });
      return;
    } catch {}
  }

  const msg = await channel.send({ embeds: [embed], components: [row] });
  state.panelMessageId = msg.id;
  saveJsonSafe(PANEL_STATE_PATH, state);
}

// ================== HIERARQUIA (SYNC POR ROLES) ==================
const HIER_GROUPS = [
  { title: "ＯＦＩＣＩＡＩＳ ＧＥＮＥＲＡＩＳ", ranks: ["MAR", "GEX", "GDIV", "GBRIG"] },
  { title: "ＯＦＩＣＩＡＩＳ ＳＵＰＥＲＩＯＲＥＳ", ranks: ["CEL", "TCEL", "MAJ"] },
  { title: "ＯＦＩＣＩＡＩＳ ＩＮＴＥＲＭＥＤＩＡＲＩＯＳ", ranks: ["CAP"] },
  { title: "ＯＦＩＣＩＡＩＳ ＳＵＢＡＬＴＥＲＮＯＳ", ranks: ["1TEN", "2TEN", "ASP"] },
  { title: "ＧＲＡＤＵＡＤＯＳ", ranks: ["SUBTEN", "1SGT", "2SGT", "3SGT", "CABO", "SOLDADO", "RECRUTA"] },
];

function rankTitle(value) {
  const map = {
    MAR: "MARECHAL",
    GEX: "GENERAL DE EXÉRCITO",
    GDIV: "GENERAL DE DIVISÃO",
    GBRIG: "GENERAL DE BRIGADA",
    CEL: "CORONEL",
    TCEL: "TENENTE CORONEL",
    MAJ: "MAJOR",
    CAP: "CAPITÃO",
    "1TEN": "1° TENENTE",
    "2TEN": "2° TENENTE",
    ASP: "ASPIRANTE",
    SUBTEN: "SUB TENENTE",
    "1SGT": "1° SARGENTO",
    "2SGT": "2° SARGENTO",
    "3SGT": "3° SARGENTO",
    CABO: "CABO",
    SOLDADO: "SOLDADO",
    RECRUTA: "RECRUTA",
  };
  return map[value] ?? value;
}

let lastFullFetch = 0;

async function ensureHierarquiaFixa(guild, forceFetch = false) {
  const canalHierId = process.env.CANAL_HIERARQUIA_ID;
  if (!canalHierId) return;

  const channel = await client.channels.fetch(canalHierId);

  const now = Date.now();
  if (forceFetch || now - lastFullFetch > 5 * 60 * 1000) {
    await guild.members.fetch();
    lastFullFetch = now;
  }

  let text = `**Hierarquia do Exército**\n\n`;

  for (const g of HIER_GROUPS) {
    text += `**${g.title}**\n\n`;

    for (const v of g.ranks) {
      const title = rankTitle(v);
      const roleId = patenteRoleIdByValue(v);

      text += `**${title}**\n`;

      if (!roleId) {
        text += `—\n\n`;
        continue;
      }

      const mentions = guild.members.cache
        .filter((m) => m.roles.cache.has(roleId))
        .map((m) => `<@${m.id}>`);

      text += mentions.length ? mentions.join("\n") + "\n\n" : "—\n\n";
    }

    text += "\n";
  }

  // edita a última mensagem do bot no canal (ou cria)
  const msgs = await channel.messages.fetch({ limit: 20 });
  const botMsg = msgs.find((m) => m.author.id === client.user.id);

  if (botMsg) await botMsg.edit({ content: text });
  else await channel.send({ content: text });
}

// ================== REQUESTS ==================
const requests = new Map(); // requestId -> { userId, nome, id, patenteInf, patenteSelecionada }

// ================== SLASH COMMANDS ==================
async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

  const cmds = [
    new SlashCommandBuilder()
      .setName("reset-hierarquia")
      .setDescription("Força a reconstrução da hierarquia (sync com roles)"),
  ].map((c) => c.toJSON());

  // Se tiver GUILD_ID, registra no servidor (instantâneo)
  if (process.env.GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID), { body: cmds });
    console.log("✅ Slash commands registrados (GUILD)");
  } else {
    await rest.put(Routes.applicationCommands(client.user.id), { body: cmds });
    console.log("✅ Slash commands registrados (GLOBAL)");
  }
}

// ================== READY ==================
client.once("ready", async () => {
  console.log(`✅ Logado como ${client.user.tag}`);

  await registerCommands();
  await ensurePainelFixo();

  // força sync hierarquia na inicialização
  const hierId = process.env.CANAL_HIERARQUIA_ID;
  if (hierId) {
    const ch = await client.channels.fetch(hierId);
    if (ch?.guild) await ensureHierarquiaFixa(ch.guild, true);
  }

  // mantém painel “vivo”
  setInterval(() => ensurePainelFixo().catch(console.error), 5 * 60 * 1000);
});

// Atualiza hierarquia quando roles mudam
client.on("guildMemberUpdate", async (oldMember, newMember) => {
  try {
    const oldIds = new Set(oldMember.roles.cache.map((r) => r.id));
    const newIds = new Set(newMember.roles.cache.map((r) => r.id));

    let changed = false;
    for (const id of oldIds) if (!newIds.has(id)) { changed = true; break; }
    if (!changed) for (const id of newIds) if (!oldIds.has(id)) { changed = true; break; }
    if (!changed) return;

    const affectedOld = [...oldIds].some((id) => RANK_ROLE_IDS.has(id));
    const affectedNew = [...newIds].some((id) => RANK_ROLE_IDS.has(id));
    if (!affectedOld && !affectedNew) return;

    await ensureHierarquiaFixa(newMember.guild);
  } catch (e) {
    console.log("Erro guildMemberUpdate:", e?.message || e);
  }
});

// ================== INTERACTIONS ==================
client.on("interactionCreate", async (interaction) => {
  try {
    // ===== SLASH: reset-hierarquia =====
    if (interaction.isChatInputCommand() && interaction.commandName === "reset-hierarquia") {
      if (!isStaff(interaction.member)) {
        return interaction.reply({ content: "⛔ Sem permissão.", ephemeral: true });
      }
      await interaction.reply({ content: "🔄 Resetando hierarquia...", ephemeral: true });
      await ensureHierarquiaFixa(interaction.guild, true);
      return interaction.editReply("✅ Hierarquia resetada e sincronizada com as roles.");
    }

    // ===== BOTÃO: solicitar =====
    if (interaction.isButton() && interaction.customId === "btn_solicitar") {
      const modal = new ModalBuilder()
        .setCustomId("modal_solicitacao")
        .setTitle("Solicitação de Acesso - Exército");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("nome").setLabel("Nome").setStyle(TextInputStyle.Short).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("id").setLabel("ID").setStyle(TextInputStyle.Short).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("patente_informada")
            .setLabel("Patente informada (opcional)")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
        )
      );

      return interaction.showModal(modal);
    }

    // ===== MODAL SUBMIT =====
    if (interaction.isModalSubmit() && interaction.customId === "modal_solicitacao") {
      const nome = interaction.fields.getTextInputValue("nome").trim();
      const id = interaction.fields.getTextInputValue("id").trim();
      const patenteInf = interaction.fields.getTextInputValue("patente_informada").trim();

      const requestId = `${interaction.user.id}:${Date.now()}`;

      requests.set(requestId, {
        userId: interaction.user.id,
        nome,
        id,
        patenteInf,
        patenteSelecionada: null,
      });

      const embed = new EmbedBuilder()
        .setTitle("🪖 Nova Solicitação")
        .setDescription(`<@${interaction.user.id}>`)
        .addFields(
          { name: "Nome", value: nome || "—", inline: true },
          { name: "ID", value: id || "—", inline: true },
          { name: "Patente informada", value: patenteInf || "—", inline: false }
        )
        .setFooter({ text: `REQ: ${requestId}` });

      const select = new StringSelectMenuBuilder()
        .setCustomId(`sel_patente|${requestId}`)
        .setPlaceholder("Patente Militar (Exército)")
        .addOptions(cfg.PATENTES.map((p) => ({ label: p.label, value: p.value })));

      const approveBtn = new ButtonBuilder()
        .setCustomId(`btn_aprovar|${requestId}`)
        .setLabel("Aprovar")
        .setStyle(ButtonStyle.Success);

      const rhId = process.env.CANAL_RH_ID;
      if (!rhId) throw new Error("Faltou CANAL_RH_ID no .env/variables");

      const rh = await client.channels.fetch(rhId);
      await rh.send({
        embeds: [embed],
        components: [
          new ActionRowBuilder().addComponents(select),
          new ActionRowBuilder().addComponents(approveBtn),
        ],
      });

      return interaction.reply({ content: "✅ Solicitação enviada! Aguarde aprovação.", ephemeral: true });
    }

    // ===== SELECT PATENTE =====
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("sel_patente|")) {
      if (!isStaff(interaction.member)) {
        return interaction.reply({ content: "⛔ Sem permissão.", ephemeral: true });
      }

      const requestId = interaction.customId.split("|")[1];
      const req = requests.get(requestId);

      if (!req) {
        return interaction.reply({ content: "⚠️ Solicitação não encontrada/expirada.", ephemeral: true });
      }

      req.patenteSelecionada = interaction.values[0];
      requests.set(requestId, req);

      return interaction.reply({
        content: `✅ Patente selecionada: **${patenteLabelByValue(req.patenteSelecionada)}**`,
        ephemeral: true,
      });
    }

    // ===== APROVAR =====
    if (interaction.isButton() && interaction.customId.startsWith("btn_aprovar|")) {
      if (!isStaff(interaction.member)) {
        return interaction.reply({ content: "⛔ Sem permissão.", ephemeral: true });
      }

      const requestId = interaction.customId.split("|")[1];
      const req = requests.get(requestId);

      if (!req) return interaction.reply({ content: "⚠️ Solicitação não encontrada/expirada.", ephemeral: true });
      if (!req.patenteSelecionada) {
        return interaction.reply({ content: "⚠️ Selecione uma patente antes de aprovar.", ephemeral: true });
      }

      const guild = interaction.guild;
      const me = guild.members.me;

      if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        return interaction.reply({ content: "❌ Bot sem permissão: Manage Roles", ephemeral: true });
      }

      const member = await guild.members.fetch(req.userId);

      // 1) Role base
      if (!member.roles.cache.has(ROLE_APROVADO_ID)) {
        await member.roles.add(ROLE_APROVADO_ID, "Aprovado no Exército - acesso ao discord");
      }

      // 2) Patente role
      const targetRoleId = patenteRoleIdByValue(req.patenteSelecionada);
      if (!targetRoleId) {
        return interaction.reply({ content: "⚠️ Role da patente não configurada no config.js.", ephemeral: true });
      }

      const toRemove = member.roles.cache
        .filter((r) => RANK_ROLE_IDS.has(r.id) && r.id !== targetRoleId)
        .map((r) => r.id);

      if (toRemove.length) await member.roles.remove(toRemove, "Exército: removendo patentes antigas");
      if (!member.roles.cache.has(targetRoleId)) await member.roles.add(targetRoleId, "Exército: aprovação RH");

      // 3) Nick (se puder)
      if (me.permissions.has(PermissionsBitField.Flags.ManageNicknames)) {
        const newNick = makeNick({ value: req.patenteSelecionada, nome: req.nome, id: req.id });
        try {
          await member.setNickname(newNick, "Exército: padronização de nickname");
        } catch (e) {
          console.log("Falha setNickname:", e?.message || e);
        }
      }

      // 4) Atualiza hierarquia (sincroniza com roles)
      await ensureHierarquiaFixa(guild);

      // 5) Fecha o RH card
      const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor(0x2ecc71)
        .addFields({ name: "Status", value: `✅ Aprovado por <@${interaction.user.id}>`, inline: false });

      await interaction.message.edit({ embeds: [updatedEmbed], components: [] });

      requests.delete(requestId);

      return interaction.reply({ content: "✅ Aprovado! Patente + nick + hierarquia atualizados.", ephemeral: true });
    }
  } catch (err) {
    console.error("INTERACTION ERROR:", err);

    if (interaction.replied || interaction.deferred) {
      return interaction.followUp({ content: "❌ Erro interno. Veja o console.", ephemeral: true }).catch(() => {});
    }
    return interaction.reply({ content: "❌ Erro interno. Veja o console.", ephemeral: true }).catch(() => {});
  }
});

// ================== LOGIN ==================
client.login(process.env.DISCORD_TOKEN);
