"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { PlusCircle, Trash2, Download, FileText, Palette, Import } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { HexColorPicker } from "react-colorful"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface Team {
  id: string
  name: string
  logo: string
}

interface Match {
  id: string
  date: string
  time: string
  homeTeam: Team
  awayTeam: Team
  times: {
    ARG: string // Argentina (hora base)
    BOL: string // Bolivia (1 hora menos)
    ECU: string // Ecuador (2 horas menos)
  }
  leagueColor?: string // Color personalizado para la liga
}

export default function FixtureCreator() {
  // Equipos con sus logos
  const predefinedTeams: Team[] = [
    {
      id: "barcelona",
      name: "Barcelona",
      logo: "https://upload.wikimedia.org/wikipedia/en/thumb/4/47/FC_Barcelona_%28crest%29.svg/1200px-FC_Barcelona_%28crest%29.svg.png"
    }
  ]

  // Función para calcular los horarios en diferentes zonas horarias
  const calculateTimes = (baseTime: string) => {
    // Parsear la hora base (formato: "HH:MM")
    const [hours, minutes] = baseTime.split(":").map(Number)

    // Calcular horarios para cada país
    const argTime = `${hours}:${minutes.toString().padStart(2, "0")}`

    // Bolivia: 1 hora menos
    const bolHours = hours - 1 < 0 ? hours + 23 : hours - 1
    const bolTime = `${bolHours}:${minutes.toString().padStart(2, "0")}`

    // Ecuador: 2 horas menos
    const ecuHours = hours - 2 < 0 ? hours + 22 : hours - 2
    const ecuTime = `${ecuHours}:${minutes.toString().padStart(2, "0")}`

    return {
      ARG: argTime,
      BOL: bolTime,
      ECU: ecuTime,
    }
  }

  const [fixtures, setFixtures] = useState<Match[]>([])
  const [teams, setTeams] = useState<Team[]>(predefinedTeams)
  const [newTeam, setNewTeam] = useState({ name: "", logo: "" })
  const [autoGenerate, setAutoGenerate] = useState(false)
  const [bulkImportText, setBulkImportText] = useState(
    "2/4 14:45 Fenerbahce-Barcelona\n3/4 15:05 Maccabi-Bayern\n4/4 15:00 Berlin-Olympiacos",
  )
  const [showTimeLabels, setShowTimeLabels] = useState(true)
  const [backgroundColor, setBackgroundColor] = useState("#FF4500") // Naranja brillante como en la imagen
  const [defaultLeagueColor, setDefaultLeagueColor] = useState("#1e1a4a") // Color azul oscuro por defecto
  const [showDividers, setShowDividers] = useState(true)
  const [exportMode, setExportMode] = useState(false)
  const [importSuccess, setImportSuccess] = useState(false)

  // Agrupar fixtures por fecha
  const fixturesByDate = fixtures.reduce(
    (groups, fixture) => {
      if (!groups[fixture.date]) {
        groups[fixture.date] = []
      }
      groups[fixture.date].push(fixture)
      return groups
    },
    {} as Record<string, Match[]>,
  )

  const addFixture = () => {
    const defaultTime = "20:05"
    const newFixture: Match = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" }).replace("/", "-"),
      time: defaultTime,
      homeTeam: teams[0],
      awayTeam: teams[1],
      times: calculateTimes(defaultTime),
      leagueColor: defaultLeagueColor,
    }
    setFixtures([...fixtures, newFixture])
  }

  const removeFixture = (id: string) => {
    setFixtures(fixtures.filter((fixture) => fixture.id !== id))
  }

  const addTeam = () => {
    if (newTeam.name) {
      const team: Team = {
        id: Date.now().toString(),
        name: newTeam.name,
        logo: newTeam.logo || "/placeholder.svg?height=100&width=100",
      }
      setTeams([...teams, team])
      setNewTeam({ name: "", logo: "" })
    }
  }

  const generateFixtures = () => {
    if (teams.length < 2) return

    const newFixtures: Match[] = []

    // Simple round-robin algorithm
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const date = new Date()
        date.setDate(date.getDate() + Math.floor(newFixtures.length / 3)) // Agrupar 3 partidos por día
        const time = "20:05" // Hora fija para todos

        newFixtures.push({
          id: Date.now().toString() + i + j,
          date: date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" }).replace("/", "-"),
          time: time,
          homeTeam: teams[i],
          awayTeam: teams[j],
          times: calculateTimes(time),
          leagueColor: defaultLeagueColor,
        })
      }
    }

    setFixtures(newFixtures)
  }

  const updateFixture = (id: string, field: string, value: any) => {
    setFixtures(
      fixtures.map((fixture) => {
        if (fixture.id === id) {
          if (field === "time") {
            return {
              ...fixture,
              time: value,
              times: calculateTimes(value),
            }
          }
          return { ...fixture, [field]: value }
        }
        return fixture
      }),
    )
  }

  const updateFixtureColor = (id: string, color: string) => {
    setFixtures(
      fixtures.map((fixture) => {
        if (fixture.id === id) {
          return { ...fixture, leagueColor: color }
        }
        return fixture
      }),
    )
  }

  const findOrCreateTeam = (teamName: string): Team => {
    // Primero buscar por nombre exacto
    let team = teams.find((t) => t.name.toLowerCase() === teamName.trim().toLowerCase())

    // Si no se encuentra, buscar por coincidencia parcial
    if (!team) {
      team = teams.find(
        (t) =>
          t.name.toLowerCase().includes(teamName.trim().toLowerCase()) ||
          teamName.trim().toLowerCase().includes(t.name.toLowerCase()),
      )
    }

    // Si aún no se encuentra, crear un nuevo equipo
    if (!team) {
      team = {
        id: `new-${Date.now()}-${teamName}`,
        name: teamName.trim(),
        logo: "/placeholder.svg?height=100&width=100",
      }
      setTeams((prev) => [...prev, team!])
    }

    return team
  }

  const importFixturesFromText = () => {
    if (!bulkImportText.trim()) return

    const lines = bulkImportText.split("\n").filter((line) => line.trim())
    const newFixtures: Match[] = []

    lines.forEach((line) => {
      // Formato esperado: DD/MM HH:MM EquipoLocal-EquipoVisitante
      const match = line.match(/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}:\d{2})\s+([^-]+)-(.+)/)

      if (match) {
        const [_, day, month, time, homeTeamName, awayTeamName] = match

        // Buscar o crear equipos
        const homeTeam = findOrCreateTeam(homeTeamName)
        const awayTeam = findOrCreateTeam(awayTeamName)

        newFixtures.push({
          id: Date.now().toString() + newFixtures.length,
          date: `${day.padStart(2, "0")}-${month.padStart(2, "0")}`,
          time: time,
          homeTeam: homeTeam,
          awayTeam: awayTeam,
          times: calculateTimes(time),
          leagueColor: defaultLeagueColor,
        })
      }
    })

    if (newFixtures.length > 0) {
      setFixtures((prev) => [...prev, ...newFixtures])
      setImportSuccess(true)

      // Ocultar el mensaje de éxito después de 3 segundos
      setTimeout(() => {
        setImportSuccess(false)
      }, 3000)
    }
  }

  const exportFixtures = () => {
    setExportMode(true)

    // Dar tiempo para que el DOM se actualice
    setTimeout(() => {
      const fixtureContainer = document.getElementById("fixture-export-container")
      if (fixtureContainer) {
        // Aquí se podría implementar la exportación a imagen
        // Por ahora, simplemente mostramos el modo de exportación
        console.log("Exportando fixtures...")
      }
    }, 100)
  }

  // Importar fixtures de ejemplo al cargar
  useEffect(() => {
    if (fixtures.length === 0) {
      importFixturesFromText()
    }
  }, [])

  return (
    <div className="space-y-6">
      <Tabs defaultValue="import">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="import">Importar</TabsTrigger>
          <TabsTrigger value="fixtures">Fixtures</TabsTrigger>
          
<TabsTrigger value="teams">Equipos</TabsTrigger>

<div className="mt-6 border rounded p-4 bg-gray-100">
  <h2 className="text-lg font-semibold mb-4">Carga Masiva de Logos (.png)</h2>
  <input
    type="file"
    accept="image/png"
    multiple
    onChange={(e) => {
      const files = Array.from(e.target.files || []);
      const newTeams = files.map((file) => {
        const id = file.name.replace(/\.png$/i, "").toLowerCase().replace(/\s+/g, "");
        const name = id.charAt(0).toUpperCase() + id.slice(1);
        const url = URL.createObjectURL(file);
        return {
          id,
          name,
          logo: url,
          league: ""
        };
      });
      setTeams(prev => {
        const merged = [...prev, ...newTeams.filter(nt => !prev.some(pt => pt.id === nt.id))];
        localStorage.setItem("teams", JSON.stringify(merged));
        return merged;
      });
    }}
    className="mb-4"
  />
</div>

{teams.length > 0 && (
  <div className="mt-6">
    <h3 className="text-md font-medium mb-2">Equipos Cargados</h3>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {teams.map((team, index) => (
        <div key={team.id} className="border p-3 rounded bg-white shadow">
          <img src={team.logo} alt={team.name} className="w-16 h-16 object-contain mx-auto mb-2" />
          <input
            type="text"
            value={team.name}
            onChange={(e) => {
              const updated = [...teams];
              updated[index].name = e.target.value;
              setTeams(updated);
              localStorage.setItem("teams", JSON.stringify(updated));
            }}
            className="w-full mb-2 p-1 border rounded"
          />
          <button
            onClick={() => {
              const updated = teams.filter((_, i) => i !== index);
              setTeams(updated);
              localStorage.setItem("teams", JSON.stringify(updated));
            }}
            className="w-full bg-red-500 text-white rounded px-2 py-1 text-sm hover:bg-red-600"
          >
            Eliminar
          </button>
        </div>
      ))}
    </div>
  </div>
)}

          <TabsTrigger value="settings">Configuración</TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Importar Fixtures desde Texto</CardTitle>
              <CardDescription>
                Ingresa los partidos en el formato: DD/MM HH:MM EquipoLocal-EquipoVisitante
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Textarea
                  placeholder="2/4 14:45 Fenerbahce-Barcelona
3/4 15:05 Maccabi-Bayern
4/4 15:00 Berlin-Olympiacos"
                  value={bulkImportText}
                  onChange={(e) => setBulkImportText(e.target.value)}
                  className="min-h-[200px]"
                />

                {importSuccess && (
                  <Alert className="bg-green-50 border-green-200">
                    <AlertTitle>¡Importación exitosa!</AlertTitle>
                    <AlertDescription>
                      Los fixtures han sido importados correctamente. Puedes verlos en la pestaña "Fixtures".
                    </AlertDescription>
                  </Alert>
                )}

                <div className="bg-gray-50 p-4 rounded-md border">
                  <h4 className="font-medium mb-2">Ejemplo de formato:</h4>
                  <pre className="text-sm bg-gray-100 p-2 rounded">
                    2/4 14:45 Fenerbahce-Barcelona
                    <br />
                    3/4 15:05 Maccabi-Bayern
                    <br />
                    4/4 15:00 Berlin-Olympiacos
                  </pre>
                  <p className="text-sm text-gray-600 mt-2">
                    La aplicación intentará encontrar los equipos por nombre. Si no los encuentra, creará nuevos
                    equipos.
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => setBulkImportText("")}>
                Limpiar
              </Button>
              <Button onClick={importFixturesFromText}>
                <Import className="mr-2 h-4 w-4" />
                Importar Fixtures
              </Button>
            </CardFooter>
          </Card>

          <div className="flex justify-end">
            <Button
              onClick={() => document.querySelector('[data-value="fixtures"]')?.dispatchEvent(new MouseEvent("click"))}
            >
              Ver Fixtures Importados
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="fixtures" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Fixtures</h2>
            <div className="flex gap-2">
              <Button
                onClick={() => document.querySelector('[data-value="import"]')?.dispatchEvent(new MouseEvent("click"))}
                variant="outline"
                size="sm"
              >
                <FileText className="mr-2 h-4 w-4" />
                Importar Texto
              </Button>

              <Button onClick={addFixture} size="sm">
                <PlusCircle className="mr-2 h-4 w-4" />
                Agregar Fixture
              </Button>

              {autoGenerate && (
                <Button onClick={generateFixtures} variant="outline" size="sm">
                  Generar Automáticamente
                </Button>
              )}

              <Button onClick={exportFixtures} size="sm">
                <Download className="mr-2 h-4 w-4" />
                Exportar
              </Button>
            </div>
          </div>

          {fixtures.length === 0 ? (
            <div className="text-center py-12 border rounded-md">
              <h3 className="text-lg font-medium mb-2">No hay fixtures</h3>
              <p className="text-gray-500 mb-4">Importa fixtures desde texto o agrega manualmente.</p>
              <Button
                onClick={() => document.querySelector('[data-value="import"]')?.dispatchEvent(new MouseEvent("click"))}
              >
                Ir a Importar
              </Button>
            </div>
          ) : (
            <div id="fixture-export-container" className="space-y-4">
              {Object.entries(fixturesByDate).map(([date, dateFixtures]) => (
                <div
                  key={date}
                  className={`border rounded-md overflow-hidden ${exportMode ? "print:shadow-none" : ""}`}
                  style={{ backgroundColor: backgroundColor }}
                >
                  <div className="bg-white text-black text-center py-2 font-bold text-xl">{date}</div>

                  {dateFixtures.map((fixture, index) => (
                    <div key={fixture.id} className="mb-0">
                      <div className="flex items-center">
                        <div className="w-[140px] h-[140px] flex items-center justify-center bg-white">
                          <img
                            src={fixture.homeTeam.logo || "/placeholder.svg?height=100&width=100"}
                            alt={fixture.homeTeam.name}
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>

                        <div
                          className="flex-1 text-white flex items-center justify-between h-[140px]"
                          style={{ backgroundColor: fixture.leagueColor || defaultLeagueColor }}
                        >
                          <div className="flex-1 flex flex-col items-center justify-center h-full">
                            {showTimeLabels && <div className="text-center mb-2">ECU</div>}
                            <div className="text-center text-4xl font-bold">{fixture.times.ECU}</div>
                          </div>

                          {showDividers && <div className="w-px h-full bg-white"></div>}

                          <div className="flex-1 flex flex-col items-center justify-center h-full">
                            {showTimeLabels && <div className="text-center mb-2">ARG/BRA/URU/CHI</div>}
                            <div className="text-center text-4xl font-bold">{fixture.times.ARG}</div>
                          </div>

                          {showDividers && <div className="w-px h-full bg-white"></div>}

                          <div className="flex-1 flex flex-col items-center justify-center h-full">
                            {showTimeLabels && <div className="text-center mb-2">BOL</div>}
                            <div className="text-center text-4xl font-bold">{fixture.times.BOL}</div>
                          </div>
                        </div>

                        <div className="w-[140px] h-[140px] flex items-center justify-center bg-white">
                          <img
                            src={fixture.awayTeam.logo || "/placeholder.svg?height=100&width=100"}
                            alt={fixture.awayTeam.name}
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                      </div>

                      {!exportMode && (
                        <div className="bg-gray-100 p-2 flex justify-between items-center">
                          <div className="flex gap-2">
                            <Select
                              value={fixture.homeTeam.id}
                              onValueChange={(value) => {
                                const team = teams.find((t) => t.id === value)
                                if (team) {
                                  updateFixture(fixture.id, "homeTeam", team)
                                }
                              }}
                            >
                              <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Equipo Local" />
                              </SelectTrigger>
                              <SelectContent>
                                {teams.map((team) => (
                                  <SelectItem key={team.id} value={team.id}>
                                    {team.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <Select
                              value={fixture.awayTeam.id}
                              onValueChange={(value) => {
                                const team = teams.find((t) => t.id === value)
                                if (team) {
                                  updateFixture(fixture.id, "awayTeam", team)
                                }
                              }}
                            >
                              <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Equipo Visitante" />
                              </SelectTrigger>
                              <SelectContent>
                                {teams.map((team) => (
                                  <SelectItem key={team.id} value={team.id}>
                                    {team.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <div className="flex gap-2">
                              <Input
                                type="time"
                                value={fixture.time}
                                onChange={(e) => updateFixture(fixture.id, "time", e.target.value)}
                                className="w-[100px]"
                              />
                              <Input
                                type="date"
                                onChange={(e) => {
                                  const date = new Date(e.target.value)
                                  const formattedDate = date
                                    .toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" })
                                    .replace("/", "-")
                                  updateFixture(fixture.id, "date", formattedDate)
                                }}
                                className="w-[140px]"
                              />
                            </div>

                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="icon" className="h-10 w-10">
                                  <Palette className="h-4 w-4" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-4">
                                <div className="space-y-2">
                                  <h4 className="font-medium">Color de Liga</h4>
                                  <HexColorPicker
                                    color={fixture.leagueColor || defaultLeagueColor}
                                    onChange={(color) => updateFixtureColor(fixture.id, color)}
                                  />
                                  <div className="flex items-center justify-between mt-2">
                                    <Label htmlFor={`color-input-${fixture.id}`}>Hex</Label>
                                    <Input
                                      id={`color-input-${fixture.id}`}
                                      value={fixture.leagueColor || defaultLeagueColor}
                                      onChange={(e) => updateFixtureColor(fixture.id, e.target.value)}
                                      className="w-24 h-8"
                                    />
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>

                          <Button variant="destructive" size="sm" onClick={() => removeFixture(fixture.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="teams" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Equipos</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {teams.map((team) => (
              <div key={team.id} className="border rounded-md p-4 flex items-center gap-4">
                <div className="w-16 h-16 flex items-center justify-center">
                  <img
                    src={team.logo || "/placeholder.svg?height=100&width=100"}
                    alt={team.name}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">{team.name}</h3>
                </div>
              </div>
            ))}
          </div>

          <div className="border rounded-md p-4 space-y-4">
            <h3 className="font-semibold">Agregar Equipo</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="team-name">Nombre del Equipo</Label>
                <Input
                  id="team-name"
                  value={newTeam.name}
                  onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                  placeholder="Nombre del equipo"
                />
              </div>
              <div>
                <Label htmlFor="team-logo">URL del Logo</Label>
                <Input
                  id="team-logo"
                  value={newTeam.logo}
                  onChange={(e) => setNewTeam({ ...newTeam, logo: e.target.value })}
                  placeholder="https://ejemplo.com/logo.png"
                />
              </div>
            </div>
            <Button onClick={addTeam}>Agregar Equipo</Button>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <div className="border rounded-md p-4 space-y-4">
            <h3 className="font-semibold">Colores</h3>

            <div className="space-y-4">
              <div>
                <Label className="mb-2 block">Color de Fondo</Label>
                <div className="space-y-2">
                  <HexColorPicker color={backgroundColor} onChange={setBackgroundColor} />
                  <div className="flex items-center gap-2 mt-2">
                    <Label htmlFor="bg-color-input">Hex</Label>
                    <Input
                      id="bg-color-input"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      className="w-24 h-8"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Color de Liga Predeterminado</Label>
                <div className="space-y-2">
                  <HexColorPicker color={defaultLeagueColor} onChange={setDefaultLeagueColor} />
                  <div className="flex items-center gap-2 mt-2">
                    <Label htmlFor="league-color-input">Hex</Label>
                    <Input
                      id="league-color-input"
                      value={defaultLeagueColor}
                      onChange={(e) => setDefaultLeagueColor(e.target.value)}
                      className="w-24 h-8"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border rounded-md p-4 space-y-4">
            <h3 className="font-semibold">Opciones de Visualización</h3>

            <div className="flex items-center space-x-2">
              <Switch id="show-labels" checked={showTimeLabels} onCheckedChange={setShowTimeLabels} />
              <Label htmlFor="show-labels">Mostrar etiquetas de países</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch id="show-dividers" checked={showDividers} onCheckedChange={setShowDividers} />
              <Label htmlFor="show-dividers">Mostrar líneas divisorias</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch id="auto-generate" checked={autoGenerate} onCheckedChange={setAutoGenerate} />
              <Label htmlFor="auto-generate">Habilitar generación automática de fixtures</Label>
            </div>
          </div>

          <div className="border rounded-md p-4 space-y-4">
            <h3 className="font-semibold">Información de Zonas Horarias</h3>

            <div className="text-sm space-y-2">
              <p>
                <strong>Argentina/Brasil/Uruguay/Chile:</strong> Hora base (la que ingresas)
              </p>
              <p>
                <strong>Bolivia:</strong> 1 hora menos que Argentina
              </p>
              <p>
                <strong>Ecuador:</strong> 2 horas menos que Argentina
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
