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

// TAGS DE NICK
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

function tagByValue(v) {
  return TAGS[v] ?? "[EB]";
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

function patenteLabelByValue(v) {
  return cfg.PATENTES.find((p) => p.value === v)?.label ?? v;
}
function patenteRoleIdByValue(v) {
  return cfg.PATENTES.find((p) => p.value === v)?.roleId ?? null;
}

const RANK_ROLE_IDS = new Set(
  (cfg.PATENTES || []).map((p) => p.roleId).filter(Boolean)
);

// ================== PAINEL FIXO ==================
async function ensurePainelFixo() {
  const canalId = process.env.CANAL_PAINEL_ID;
  if (!canalId) return;

  const channel = await client.channels.fetch(canalId);

  const embed = new EmbedBuilder()
    .setTitle("📋 Solicitação de Acesso")
    .setDescription("Clique no botão abaixo para iniciar sua solicitação.")
    .setFooter({ text: "Recursos Humanos - Exército" });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("btn_solicitar")
      .setLabel("SOLICITAR")
      .setStyle(ButtonStyle.Success)
  );

  const msgs = await channel.messages.fetch({ limit: 5 });
  const old = msgs.find((m) => m.author.id === client.user.id);

  if (old) {
    await old.edit({ embeds: [embed], components: [row] });
  } else {
    await channel.send({ embeds: [embed], components: [row] });
  }
}

// ================== HIERARQUIA ==================
const HIER_GROUPS = [
  { title: "ＯＦＩＣＩＡＩＳ ＧＥＮＥＲＡＩＳ", ranks: ["MAR", "GEX", "GDIV", "GBRIG"] },
  { title: "ＯＦＩＣＩＡＩＳ ＳＵＰＥＲＩＯＲＥＳ", ranks: ["CEL", "TCEL", "MAJ"] },
  { title: "ＯＦＩＣＩＡＩＳ ＩＮＴＥＲＭＥＤＩＡＲＩＯＳ", ranks: ["CAP"] },
  { title: "ＯＦＩＣＩＡＩＳ ＳＵＢＡＬＴＥＲＮＯＳ", ranks: ["1TEN", "2TEN", "ASP"] },
  { title: "ＧＲＡＤＵＡＤＯＳ", ranks: ["SUBTEN", "1SGT", "2SGT", "3SGT", "CABO", "SOLDADO", "RECRUTA"] },
];

function rankTitle(v) {
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
  return map[v] ?? v;
}

async function ensureHierarquiaFixa(guild) {
  const canalId = process.env.CANAL_HIERARQUIA_ID;
  if (!canalId) return;

  const channel = await client.channels.fetch(canalId);

  let text = `**Hierarquia do Exército**\n\n`;

  for (const g of HIER_GROUPS) {
    text += `**${g.title}**\n\n`;

    for (const r of g.ranks) {
      const roleId = patenteRoleIdByValue(r);
      const role = roleId ? guild.roles.cache.get(roleId) : null;

      text += `**${rankTitle(r)}**\n`;

      if (!role || role.members.size === 0) {
        text += `—\n\n`;
      } else {
        text += [...role.members.values()].map(m => `<@${m.id}>`).join("\n") + "\n\n";
      }
    }
    text += "\n";
  }

  const msgs = await channel.messages.fetch({ limit: 5 });
  const old = msgs.find((m) => m.author.id === client.user.id);

  if (old) await old.edit({ content: text });
  else await channel.send({ content: text });
}

// ================== READY ==================
client.once("ready", async () => {
  console.log(`✅ Logado como ${client.user.tag}`);

  await ensurePainelFixo();
  await ensureHierarquiaFixa(client.guilds.cache.first());

  // registra comando
  await client.application.commands.set([
    {
      name: "reset-hierarquia",
      description: "Força a reconstrução da hierarquia do Exército",
    },
  ]);

  setInterval(() => ensurePainelFixo().catch(() => {}), 5 * 60 * 1000);
});

// ================== AUTO UPDATE AO MUDAR ROLE ==================
client.on("guildMemberUpdate", async (oldM, newM) => {
  const oldIds = new Set(oldM.roles.cache.map(r => r.id));
  const newIds = new Set(newM.roles.cache.map(r => r.id));

  const changed =
    [...oldIds].some(id => !newIds.has(id)) ||
    [...newIds].some(id => !oldIds.has(id));

  if (!changed) return;

  const affected =
    [...oldIds, ...newIds].some(id => RANK_ROLE_IDS.has(id));

  if (affected) {
    await ensureHierarquiaFixa(newM.guild);
  }
});

// ================== INTERACTIONS ==================
client.on("interactionCreate", async (interaction) => {
  try {

    // ===== RESET HIERARQUIA =====
    if (interaction.isChatInputCommand() && interaction.commandName === "reset-hierarquia") {
      if (!isStaff(interaction.member)) {
        return interaction.reply({ content: "⛔ Sem permissão.", ephemeral: true });
      }
      await interaction.reply({ content: "🔄 Resetando hierarquia...", ephemeral: true });
      await ensureHierarquiaFixa(interaction.guild);
      return interaction.editReply("✅ Hierarquia resetada.");
    }

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
        )
      );

      return interaction.showModal(modal);
    }

  } catch (e) {
    console.error(e);
  }
});

// ================== LOGIN ==================
client.login(process.env.DISCORD_TOKEN);
