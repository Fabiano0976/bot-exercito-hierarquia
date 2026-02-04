module.exports = {
  // Quem pode aprovar (coloque aqui o ID do cargo do RH/Comando)
  STAFF_ROLE_IDS: ["1327341545648554065"],

  PATENTES: [
    { label: "Recruta", value: "RECRUTA", roleId: "1327341545661267982" },
    { label: "Soldado", value: "SOLDADO", roleId: "1327341545661267983" },
    { label: "Cabo", value: "CABO", roleId: "1327341545661267984" }, // ✅ corrigido

    { label: "3º Sargento", value: "3SGT", roleId: "1327341545669660804" },
    { label: "2º Sargento", value: "2SGT", roleId: "1327341545669660805" },
    { label: "1º Sargento", value: "1SGT", roleId: "1327341545669660806" },
    { label: "Subtenente", value: "SUBTEN", roleId: "1327341545669660807" },

    { label: "Aspirante", value: "ASP", roleId: "1327341545669660808" },
    { label: "2º Tenente", value: "2TEN", roleId: "1327341545669660809" },
    { label: "1º Tenente", value: "1TEN", roleId: "1327341545669660810" },
    { label: "Capitão", value: "CAP", roleId: "1327341545669660811" },
    { label: "Major", value: "MAJ", roleId: "1327341545669660813" },

    { label: "Tenente-Coronel", value: "TCEL", roleId: "1327341545682108436" },
    { label: "Coronel", value: "CEL", roleId: "1327341545682108437" },

    { label: "General de Brigada", value: "GBRIG", roleId: "1327341545682108438" },
    { label: "General de Divisão", value: "GDIV", roleId: "1327341545682108439" },
    { label: "General de Exército", value: "GEX", roleId: "1327341545682108440" },
    { label: "Marechal", value: "MAR", roleId: "1327341545682108441" },
  ],

  // Formato do nick (muda se quiser)
  NICK_FORMAT: "{PATENTE} | {NOME} | {ID}",
}