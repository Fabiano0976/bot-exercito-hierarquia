require("dotenv").config();

const fs = require("fs");
const path = require("path");

const {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  PermissionsBitField,
} = require("discord.js");

const cfg = require("./config");

// ================== FIXOS ==================
const ROLE_APROVADO_ID = "1327341545661267980"; // 【🔰】Exército Marcone

// TAGS pro nickname (conforme você mandou)
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

// ================== CLIENT ==================
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  partials: [Partials.GuildMember],
});

// ================== HELPERS ==================
function isStaff(member) {
  if (Array.isArray(cfg.STAFF_ROLE_IDS) && cfg.STAFF_ROLE_IDS.length > 0) {
    return cfg.STAFF_ROLE_IDS.some((rid) => member.roles.cache.has(rid));
  }
  return member.permissions.has(PermissionsBitField.Flags.Administrator);
}

function patenteLabelByValue(value) {
  return cfg.PATENTES.find((p) => p.value === value)?.label ?? value;
}
function patenteRoleIdByValue(value) {
  return cfg.PATENTES.find((p) => p.value === value)?.roleId ?? null;
}

const RANK_ROLE_IDS = new Set((cfg.PATENTES || []).map((p) => p.roleId).filter(Boolean));

// ================== STATE FILES ==================
const PANEL_STATE_PATH = path.join(__dirname, "panel_state.json");
const HIER_STATE_PATH = path.join(__dirname, "hierarquia_state.json");

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

// ================== PAINEL FIXO (SOLICITAR) ==================
async function ensurePainelFixo() {
  const canalPainelId = process.env.CANAL_PAINEL_ID;
  if (!canalPainelId) throw new Error("Faltou CANAL_PAINEL_ID no .env");

  const channel = await client.channels.fetch(canalPainelId);

  const embed = new EmbedBuilder()
    .setTitle("📋 Solicitação de Acesso")
    .setDescription("Clique no botão abaixo para iniciar sua solicitação.")
    .setFooter({ text: "Recursos Humanos - Exército" });

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

// ================== HIERARQUIA FIXA (LISTA TODOS POR PATENTE) ==================
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

function chunkMessage(content, limit = 1900) {
  const parts = [];
  let cur = "";

  for (const line of content.split("\n")) {
    if ((cur + line + "\n").length > limit) {
      parts.push(cur);
      cur = "";
    }
    cur += line + "\n";
  }
  if (cur.trim().length) parts.push(cur);
  return parts;
}

async function buildHierarquiaTextFromGuild(guild) {
  let out = `**Hierarquia do Exército**\n\n`;

  for (const g of HIER_GROUPS) {
    out += `**${g.title}**\n\n`;

    for (const v of g.ranks) {
      const title = rankTitle(v);

      const roleId = patenteRoleIdByValue(v);
      const role = roleId ? guild.roles.cache.get(roleId) : null;

      let ids = [];
      if (role) {
        // ✅ pega direto dos membros da role (não depende de cache do guild)
        ids = [...role.members.values()].map((m) => m.user.id);
      }

      out += `**${title}**\n`;
      if (!ids.length) out += `—\n\n`;
      else out += ids.map((id) => `<@${id}>`).join("\n") + "\n\n";
    }

    out += `\n`;
  }

  return out;
}

async function ensureHierarquiaFixa(guild) {
  const canalHierId = process.env.CANAL_HIERARQUIA_ID;
  if (!canalHierId) return;

  const channel = await client.channels.fetch(canalHierId);

  const state = loadJsonSafe(HIER_STATE_PATH, { messageIds: [] });
  const msgIds = Array.isArray(state.messageIds) ? state.messageIds : [];

  const content = await buildHierarquiaTextFromGuild(guild);
  const pages = chunkMessage(content);

  const newIds = [];
  for (let i = 0; i < pages.length; i++) {
    const pageContent = pages[i].trimEnd();
    if (msgIds[i]) {
      try {
        const msg = await channel.messages.fetch(msgIds[i]);
        await msg.edit({ content: pageContent });
        newIds.push(msg.id);
        continue;
      } catch {}
    }
    const msg = await channel.send({ content: pageContent });
    newIds.push(msg.id);
  }

  // apaga mensagens antigas extras (opcional)
  for (let i = pages.length; i < msgIds.length; i++) {
    try {
      const oldMsg = await channel.messages.fetch(msgIds[i]);
      await oldMsg.delete().catch(() => {});
    } catch {}
  }

  state.messageIds = newIds;
  saveJsonSafe(HIER_STATE_PATH, state);
}

// ================== REQUESTS (MEMÓRIA) ==================
const requests = new Map();

// ================== READY ==================
client.once("ready", async () => {
  console.log(`✅ Logado como ${client.user.tag}`);

  await ensurePainelFixo();

  const hierId = process.env.CANAL_HIERARQUIA_ID;
  if (hierId) {
    const ch = await client.channels.fetch(hierId);
    if (ch?.guild) await ensureHierarquiaFixa(ch.guild);
  }

  setInterval(() => ensurePainelFixo().catch(console.error), 5 * 60 * 1000);
  setInterval(async () => {
    try {
      const id = process.env.CANAL_HIERARQUIA_ID;
      if (!id) return;
      const ch = await client.channels.fetch(id);
      if (ch?.guild) await ensureHierarquiaFixa(ch.guild);
    } catch (e) {
      console.error("Erro timer hierarquia:", e);
    }
  }, 2 * 60 * 1000);
});

client.on("guildMemberUpdate", async (oldMember, newMember) => {
  try {
    // só reage se mudou alguma role
    const oldIds = new Set(oldMember.roles.cache.map(r => r.id));
    const newIds = new Set(newMember.roles.cache.map(r => r.id));

    let changed = false;
    for (const id of oldIds) if (!newIds.has(id)) { changed = true; break; }
    if (!changed) for (const id of newIds) if (!oldIds.has(id)) { changed = true; break; }
    if (!changed) return;

    // se a mudança envolve alguma patente, atualiza hierarquia
    const affectedOld = [...oldIds].some(id => RANK_ROLE_IDS.has(id));
    const affectedNew = [...newIds].some(id => RANK_ROLE_IDS.has(id));
    if (!affectedOld && !affectedNew) return;

    await ensureHierarquiaFixa(newMember.guild);
  } catch (e) {
    console.log("Erro guildMemberUpdate:", e?.message || e);
  }
});

// ================== INTERACTIONS ==================
client.on("interactionCreate", async (interaction) => {
  try {
    // ===== BOTÃO SOLICITAR =====
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
      if (!rhId) throw new Error("Faltou CANAL_RH_ID no .env");

      const rh = await client.channels.fetch(rhId);
      await rh.send({
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(select), new ActionRowBuilder().addComponents(approveBtn)],
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

      if (!req) return interaction.reply({ content: "⚠️ Solicitação não encontrada/expirada.", ephemeral: true });

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

      // 1) Role base (só quando aprovado)
      if (!member.roles.cache.has(ROLE_APROVADO_ID)) {
        await member.roles.add(ROLE_APROVADO_ID, "Aprovado no Exército - acesso ao discord");
      }

      // 2) Patente (role)
      const targetRoleId = patenteRoleIdByValue(req.patenteSelecionada);
      if (!targetRoleId) {
        return interaction.reply({ content: "⚠️ Role da patente não configurada no config.js.", ephemeral: true });
      }

      // remove patentes antigas
      const toRemove = member.roles.cache
        .filter((r) => RANK_ROLE_IDS.has(r.id) && r.id !== targetRoleId)
        .map((r) => r.id);

      if (toRemove.length) await member.roles.remove(toRemove, "Exército: removendo patentes antigas");
      if (!member.roles.cache.has(targetRoleId)) await member.roles.add(targetRoleId, "Exército: aprovação RH");

      // 3) Nick com TAG (se falhar, não trava)
      const newNick = makeNick({ value: req.patenteSelecionada, nome: req.nome, id: req.id });
      try {
        await member.setNickname(newNick, "Exército: padronização de nickname");
      } catch (e) {
        console.log("Falha setNickname:", e?.message || e);
      }

      // 4) Atualiza hierarquia (se falhar, não trava)
      try {
        await ensureHierarquiaFixa(guild);
      } catch (e) {
        console.log("Falha hierarquia:", e?.message || e);
      }

      // 5) Finaliza a mensagem do RH
      const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor(0x2ecc71)
        .addFields({ name: "Status", value: `✅ Aprovado por <@${interaction.user.id}>`, inline: false });

      await interaction.message.edit({ embeds: [updatedEmbed], components: [] });

      requests.delete(requestId);

      return interaction.reply({ content: "✅ Aprovado! Patente + nick + hierarquia atualizados.", ephemeral: true });
    }
  } catch (err) {
    console.error("INTERACTION ERROR:", err);

    const msg = (err?.rawError?.message || err?.message || String(err)).slice(0, 180);
    const code = err?.code ? ` (code: ${err.code})` : "";

    if (interaction.replied || interaction.deferred) {
      return interaction.followUp({ content: `❌ Erro: ${msg}${code}`, ephemeral: true }).catch(() => {});
    }
    return interaction.reply({ content: `❌ Erro: ${msg}${code}`, ephemeral: true }).catch(() => {});
  }
});

// ================== LOGIN ==================
client.login(process.env.DISCORD_TOKEN);