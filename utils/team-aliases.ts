const normalizeTeamAliasKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase()

const normalizeTeamDisplayName = (value: string) => value.trim().normalize("NFC").replace(/\s+/g, " ")

const GLOBAL_TEAM_ALIASES: Record<string, string> = {
  hlalicante: "Alicante",
  cdespanoltalca: "Español de Talca",
  espanoltalca: "Español de Talca",
  espanoldetalca: "Español de Talca",
  cdunivcatolica: "Universidad Católica",
  cduniversidadcatolica: "Universidad Católica",
  universidadcatolica: "Universidad Católica",
  cdudec: "Universidad Concepción",
  udec: "Universidad Concepción",
  universidadconcepcion: "Universidad Concepción",
  cdvaldivia: "Club Deportivo Valdivia",
  clubdeportivovaldivia: "Club Deportivo Valdivia",
  cdcastro: "Deportes Castro",
  deportescastro: "Deportes Castro",
  gimnastico: "Gimnástico",
  quilicurabasquet: "Quilicura Básquet",
  quilicurabasquetbol: "Quilicura Básquet",
  depberazategui: "Deportivo Berazategui",
  berazategui: "Deportivo Berazategui",
  deportivoberazategui: "Deportivo Berazategui",
  luismattelarrain: "Deportes Luis Matte",
  deportesluismatte: "Deportes Luis Matte",
  alemanptovaras: "Deportivo Alemán",
  deportivoaleman: "Deportivo Alemán",
}

const LEAGUE_TEAM_ALIASES: Record<string, Record<string, string>> = {
  ligaargentina: {
    launion: "La Unión de Colón",
    launionc: "La Unión de Colón",
    launioncolon: "La Unión de Colón",
    launiondecolon: "La Unión de Colón",
  },
  ligachery: {
    cdespanoltalca: "Español de Talca",
    espanoltalca: "Español de Talca",
    espanoldetalca: "Español de Talca",
    cdunivcatolica: "Universidad Católica",
    cduniversidadcatolica: "Universidad Católica",
    universidadcatolica: "Universidad Católica",
    cdudec: "Universidad Concepción",
    udec: "Universidad Concepción",
    universidadconcepcion: "Universidad Concepción",
    cdvaldivia: "Club Deportivo Valdivia",
    clubdeportivovaldivia: "Club Deportivo Valdivia",
    cdcastro: "Deportes Castro",
    deportescastro: "Deportes Castro",
    gimnastico: "Gimnástico",
    quilicurabasquet: "Quilicura Básquet",
    quilicurabasquetbol: "Quilicura Básquet",
  },
  ligafemenina: {
    depberazategui: "Deportivo Berazategui",
    berazategui: "Deportivo Berazategui",
    deportivoberazategui: "Deportivo Berazategui",
  },
  ligados: {
    luismattelarrain: "Deportes Luis Matte",
    deportesluismatte: "Deportes Luis Matte",
    alemanptovaras: "Deportivo Alemán",
    deportivoaleman: "Deportivo Alemán",
  },
  primerafeb: {
    hlalicante: "Alicante",
  },
}

const LEAGUE_PATH_HINTS: Array<[RegExp, string]> = [
  [/ligachery/, "Liga Chery"],
  [/ligaargentina/, "Liga Argentina"],
  [/primerafeb/, "Primera FEB"],
  [/ligafemenina/, "Liga Femenina"],
  [/ligados/, "Liga Dos"],
  [/liganacionalfemeninachile/, "Liga Nacional Femenina Chile"],
  [/liganacional/, "Liga Nacional"],
  [/ligaecuadorfem/, "Ecuador Femenino"],
  [/ligaecuador/, "Liga Ecuador"],
  [/nbb/, "NBB"],
  [/ligauruguayascenso/, "Liga Uruguay Ascenso"],
]

export const inferLeagueNameFromPath = (relativePath?: string) => {
  if (!relativePath) {
    return undefined
  }

  const normalizedPath = normalizeTeamAliasKey(relativePath)
  const match = LEAGUE_PATH_HINTS.find(([pattern]) => pattern.test(normalizedPath))
  return match?.[1]
}

export const resolveTeamNameAlias = (teamName: string, leagueName?: string) => {
  const normalizedKey = normalizeTeamAliasKey(teamName)
  const normalizedLeague = leagueName ? normalizeTeamAliasKey(leagueName) : ""

  const leagueAlias = normalizedLeague ? LEAGUE_TEAM_ALIASES[normalizedLeague]?.[normalizedKey] : undefined
  const globalAlias = GLOBAL_TEAM_ALIASES[normalizedKey]

  return normalizeTeamDisplayName(leagueAlias || globalAlias || teamName)
}
