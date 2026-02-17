require("dotenv").config();
const fs = require("fs");
const path = require("path");

const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  SlashCommandBuilder,
  REST,
  Routes,
} = require("discord.js");

const cfg = require("./config");

/* ================== CONFIG FIXA ================== */
const ROLE_APROVADO_ID = "1327341545661267980"; // 【🔰】Exército Marcone

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

function patenteRoleIdByValue(v) {
  return cfg.PATENTES.find(p => p.value === v)?.roleId ?? null;
}

function isStaff(member) {
  if (cfg.STAFF_ROLE_IDS?.length) {
    return cfg.STAFF_ROLE_IDS.some(id => member.roles.cache.has(id));
  }
  return member.permissions.has(PermissionsBitField.Flags.Administrator);
}

/* ================== CLIENT ================== */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // 🔥 OBRIGATÓRIO
  ],
  partials: [Partials.GuildMember],
});

/* ================== HIERARQUIA ================== */
let lastFetch = 0;

async function ensureHierarquiaFixa(guild, force = false) {
  const canalId = process.env.CANAL_HIERARQUIA_ID;
  if (!canalId) return;

  const channel = await client.channels.fetch(canalId);

  const now = Date.now();
  if (force || now - lastFetch > 5 * 60 * 1000) {
    await guild.members.fetch(); // 🔥 resolve o bug dos @ faltando
    lastFetch = now;
  }

  let text = `**Hierarquia do Exército**\n\n`;

  for (const g of HIER_GROUPS) {
    text += `**${g.title}**\n\n`;

    for (const r of g.ranks) {
      const roleId = patenteRoleIdByValue(r);
      text += `**${rankTitle(r)}**\n`;

      if (!roleId) {
        text += `—\n\n`;
        continue;
      }

      const ids = guild.members.cache
        .filter(m => m.roles.cache.has(roleId))
        .map(m => `<@${m.id}>`);

      text += ids.length ? ids.join("\n") + "\n\n" : "—\n\n";
    }
    text += "\n";
  }

  const msgs = await channel.messages.fetch({ limit: 10 });
  const botMsg = msgs.find(m => m.author.id === client.user.id);

  if (botMsg) await botMsg.edit({ content: text });
  else await channel.send({ content: text });
}

/* ================== SLASH COMMAND ================== */
const commands = [
  new SlashCommandBuilder()
    .setName("reset-hierarquia")
    .setDescription("Força o reset e sincronização da hierarquia"),
].map(c => c.toJSON());

client.once("ready", async () => {
  console.log(`✅ Logado como ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );

  const ch = await client.channels.fetch(process.env.CANAL_HIERARQUIA_ID);
  if (ch?.guild) await ensureHierarquiaFixa(ch.guild, true);
});

/* ================== INTERACTIONS ================== */
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "reset-hierarquia") {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: "⛔ Sem permissão.", ephemeral: true });
    }

    await interaction.reply({ content: "🔄 Sincronizando hierarquia...", ephemeral: true });
    await ensureHierarquiaFixa(interaction.guild, true);
    await interaction.editReply("✅ Hierarquia resetada e sincronizada!");
  }
});

/* ================== AUTO SYNC ================== */
client.on("guildMemberUpdate", async (o, n) => {
  try {
    await ensureHierarquiaFixa(n.guild);
  } catch {}
});

/* ================== LOGIN ================== */
client.login(process.env.DISCORD_TOKEN);
