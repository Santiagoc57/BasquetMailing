"use client"

import type React from "react"
import { useCallback, useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Download, Plus, Trash2, AlertTriangle } from "lucide-react"
import { useAppContext } from "@/context/AppContext"
import { groupFixturesByLeague } from "@/utils/fixtures"
import LeagueFixtures from "./LeagueFixtures"
import FixtureListExport from "./FixtureListExport"
import html2canvas from "html2canvas"
import JSZip from "jszip"
import { preloadImage } from "@/utils/fixtures"
import { createRoot } from "react-dom/client"

export const FixturesTab: React.FC = () => {
  const {
    fixtures,
    teams,
    setFixtures,
    exportHorario,
    setExportHorario,
    addFixture,
    exportMode,
    setExportMode,
    exportSpacing,
    exportDateFontSize,
  } = useAppContext()

  // Usar useMemo para evitar recálculos innecesarios
  const fixturesByLeague = useMemo(() => groupFixturesByLeague(fixtures), [fixtures])
  const leagueCount = useMemo(() => Object.keys(fixturesByLeague).length, [fixturesByLeague])
  const fixtureCount = useMemo(() => fixtures.length, [fixtures])

  // Estado para el modal de confirmación
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  // Estado para mostrar el indicador de exportación
  const [isExporting, setIsExporting] = useState(false)
  // Estado para mensajes de error
  const [exportError, setExportError] = useState<string | null>(null)

  // Implementación real de la función de exportación con mejor manejo de errores y feedback
  const exportFixtures = useCallback(
    async (leagueName?: string) => {
      setIsExporting(true)
      setExportError(null)
      setExportMode(true)

      // Dar tiempo para que el DOM se actualice
      setTimeout(async () => {
        try {
          if (leagueName) {
            // Exportar una liga específica como imagen TV/canvas
            // Filtrar los fixtures de la liga
            const leagueFixtures = fixtures.filter((f) => f.league === leagueName)
            // Orden cronológico por fecha (DD/MM o DD-MM) y hora
            const sortedLeagueFixtures = [...leagueFixtures].sort((a, b) => {
              const [da, ma] = (a.date || "01-01").split(/[\/-]/).map((n) => parseInt(n, 10))
              const [db, mb] = (b.date || "01-01").split(/[\/-]/).map((n) => parseInt(n, 10))
              const y = new Date().getFullYear()
              const ta = new Date(y, (ma || 1) - 1, da || 1).getTime()
              const tb = new Date(y, (mb || 1) - 1, db || 1).getTime()
              if (ta !== tb) return ta - tb
              const [h1, m1] = (a.time || "00:00").split(":").map((n) => parseInt(n, 10))
              const [h2, m2] = (b.time || "00:00").split(":").map((n) => parseInt(n, 10))
              return h1 !== h2 ? h1 - h2 : m1 - m2
            })
            // Obtener equipos únicos involucrados
            const teamIds = new Set(sortedLeagueFixtures.flatMap((f) => [f.homeTeam.id, f.awayTeam.id]))
            const leagueTeams = teams.filter(t => teamIds.has(t.id));
            // Obtener la fecha (si todos los partidos son de la misma fecha, úsala, si no, pon "Fixtures")
            const uniqueDates = [...new Set(sortedLeagueFixtures.map((f) => f.date))]
            const dateLabel = uniqueDates.length === 1 ? uniqueDates[0] : "Fixtures";

            // Crear un contenedor temporal
            const tempDiv = document.createElement('div');
            tempDiv.style.position = 'fixed';
            tempDiv.style.left = '-99999px';
            document.body.appendChild(tempDiv);

            // Renderizar el canvas oculto usando React 19 (createRoot)
            const exportWidth = 1200
            const exportHeight = sortedLeagueFixtures.length * 160 + 32 * 2 + 80
            const root = createRoot(tempDiv)
            root.render(
              <FixtureListExport
                fixtures={sortedLeagueFixtures}
                teams={leagueTeams}
                date={dateLabel}
                width={exportWidth}
                height={exportHeight}
                spacing={exportSpacing}
                dateFontSize={exportDateFontSize}
              />,
            )
            setTimeout(() => {
              const canvas = tempDiv.querySelector("canvas")
              if (canvas) {
                const link = document.createElement("a")
                link.download = `${leagueName}.png`
                link.href = canvas.toDataURL()
                link.click()
              }
              root.unmount()
              document.body.removeChild(tempDiv)
              setIsExporting(false)
              setExportMode(false)
            }, 800) // Espera a que se dibujen los logos
            return
          } else {
            // Exportar todo en un ZIP
            const zip = new JSZip()
            const currentHorario = exportHorario || "ARG"
            let horarioLabel = ""
            switch (currentHorario) {
              case "ARG":
                horarioLabel = "Arg-Bra-Uru"
                break
              case "BOL":
                horarioLabel = "Bol-Chi"
                break
              case "ECU":
                horarioLabel = "Ecu"
                break
              default:
                horarioLabel = currentHorario
            }

            // Procesar cada liga
            for (const leagueName of Object.keys(fixturesByLeague)) {
              const leagueContainerId = `league-container-${leagueName.replace(/\s+/g, "-").toLowerCase()}`
              let container = document.getElementById(leagueContainerId)

              if (!container) {
                const leagueContainers = document.querySelectorAll(".fixtures-container > div")
                for (const div of leagueContainers) {
                  const heading = div.querySelector("h3")
                  if (heading && heading.textContent?.includes(leagueName)) {
                    container = div as HTMLElement
                    break
                  }
                }
              }

              if (container) {
                // Ocultar controles
                const controlButtons = container.querySelectorAll("button")
                const leagueTitle = container.querySelector("h3")
                const controlBars = container.querySelectorAll(".fixture-control-bar")

                controlButtons.forEach((btn) => ((btn as HTMLElement).style.display = "none"))
                if (leagueTitle) (leagueTitle as HTMLElement).style.display = "none"
                controlBars.forEach((bar) => ((bar as HTMLElement).style.display = "none"))

                try {
                  // Precargar imágenes
                  const imageElements = container.querySelectorAll("img")
                  await Promise.allSettled(
                    Array.from(imageElements).map((img) => {
                      const imgElement = img as HTMLImageElement
                      if (imgElement.src && !imgElement.src.includes("undefined")) {
                        return preloadImage(imgElement.src)
                      }
                      return Promise.resolve()
                    }),
                  )

                  // Crear canvas
                  const canvas = await html2canvas(container as HTMLElement, {
                    backgroundColor: null,
                    scale: 2,
                    useCORS: true,
                    allowTaint: true,
                    logging: false,
                  })

                  // Añadir al ZIP
                  const imgData = canvas.toDataURL("image/png").replace(/^data:image\/(png|jpg);base64,/, "")
                  const fileName = `${leagueName}-${horarioLabel}.png`
                  zip.file(fileName, imgData, { base64: true })
                } catch (error) {
                  console.error(`Error al procesar liga ${leagueName}:`, error)
                  throw new Error(`Error al procesar liga ${leagueName}`)
                } finally {
                  // Restaurar visibilidad
                  controlButtons.forEach((btn) => ((btn as HTMLElement).style.display = ""))
                  if (leagueTitle) (leagueTitle as HTMLElement).style.display = ""
                  controlBars.forEach((bar) => ((bar as HTMLElement).style.display = "none"))
                }
              }
            }

            // Generar y descargar ZIP
            const content = await zip.generateAsync({ type: "blob" })
            const link = document.createElement("a")
            link.href = URL.createObjectURL(content)
            link.download = `fixtures-todas-las-ligas-${horarioLabel}.zip`
            link.click()
            URL.revokeObjectURL(link.href)
          }
        } catch (error) {
          console.error("Error al exportar:", error)
          setExportError(
            error instanceof Error ? error.message : "Hubo un error al exportar. Por favor, intenta de nuevo.",
          )
        } finally {
          setExportMode(false)
          setIsExporting(false)
        }
      }, 500)
    },
    [fixturesByLeague, exportHorario, setExportMode],
  )

  return (
    <Card className="shadow-md">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardTitle className="flex items-center text-xl">
          <span className="mr-2">Administrar Fixtures</span>
          {fixtureCount > 0 && (
            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
              {fixtureCount} fixture{fixtureCount !== 1 ? "s" : ""}
            </span>
          )}
        </CardTitle>
        <CardDescription>
          Aquí puedes ver y administrar los fixtures. Puedes agregar nuevos fixtures manualmente o importarlos desde
          texto.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-6">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <Button
              onClick={addFixture}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md"
            >
              <Plus className="mr-2 h-4 w-4" />
              Agregar Fixture
            </Button>
            <div className="flex flex-wrap gap-2">
              {fixtureCount > 0 && (
                <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)} className="flex items-center">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar todos
                </Button>
              )}
            </div>
          </div>

          {/* Selector de horario para exportación con mejor UI */}
          <div className="bg-blue-50 p-4 rounded-md border border-blue-100 shadow-sm">
            <Label htmlFor="export-horario-fixtures" className="text-sm font-medium flex items-center mb-2">
              <span className="mr-2">Horario para exportación:</span>
              <div className="relative inline-block">
                <select
                  id="export-horario-fixtures"
                  className="appearance-none bg-white border border-blue-200 rounded-md px-4 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={exportHorario}
                  onChange={(e) => setExportHorario(e.target.value)}
                  style={{ fontFamily: "Poppins, sans-serif" }}
                >
                  <option value="BOL">BOL</option>
                  <option value="ARG">ARG / URU / CHI</option>
                  <option value="ECU">ECU</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                  </svg>
                </div>
              </div>
            </Label>
            <p className="text-xs text-blue-600">
              Este horario se utilizará para la exportación de imágenes. Selecciona el que deseas mostrar en tus
              fixtures.
            </p>
          </div>

          {fixtures.length > 0 ? (
            <>
              {/* Sección de exportación por ligas con mejor UI */}
              <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 shadow-sm">
                <h3 className="text-lg font-semibold mb-3 flex items-center">
                  <Download className="mr-2 h-5 w-5 text-indigo-600" />
                  Exportar por Liga
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {Object.keys(fixturesByLeague).map((leagueName) => (
                    <Button
                      key={leagueName}
                      variant="outline"
                      onClick={() => exportFixtures(leagueName)}
                      className="flex items-center justify-center bg-white hover:bg-gray-50 border-gray-200 text-gray-800 hover:text-indigo-700 hover:border-indigo-300 transition-colors"
                      disabled={isExporting}
                    >
                      <Download className="mr-2 h-4 w-4 text-indigo-500" />
                      {leagueName}
                    </Button>
                  ))}
                  <Button
                    variant="default"
                    onClick={() => exportFixtures()}
                    className="flex items-center justify-center bg-indigo-600 hover:bg-indigo-700"
                    disabled={isExporting}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Exportar Todo
                  </Button>
                </div>

                {isExporting && (
                  <div className="mt-3 p-3 bg-blue-50 text-blue-700 rounded-md flex items-center">
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-700"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Exportando... Por favor espera.
                  </div>
                )}

                {exportError && (
                  <div className="mt-3 p-3 bg-red-50 text-red-700 rounded-md flex items-center">
                    <AlertTriangle className="mr-2 h-5 w-5" />
                    {exportError}
                  </div>
                )}
              </div>

              {/* Contenedor de fixtures */}
              <div className="fixtures-container space-y-8">
                {Object.entries(fixturesByLeague).map(([leagueName, dateFixtures]) => (
                  <LeagueFixtures key={leagueName} leagueName={leagueName} dateFixtures={dateFixtures} />
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
              <div className="flex flex-col items-center justify-center space-y-3">
                <div className="bg-blue-100 p-3 rounded-full">
                  <Plus className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-medium">No hay fixtures</h3>
                <p className="text-gray-500 max-w-md">
                  Importa fixtures desde texto en la pestaña "Importar" o agrega manualmente haciendo clic en el botón
                  "Agregar Fixture".
                </p>
                <Button onClick={addFixture} className="mt-2">
                  Agregar Primer Fixture
                </Button>
              </div>
            </div>
          )}

          {showDeleteConfirm && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
              <div className="relative p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
                <div className="mt-3 text-center">
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                    <Trash2 className="h-6 w-6 text-red-600" />
                  </div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mt-2">Eliminar todos los fixtures</h3>
                  <div className="mt-2 px-7 py-3">
                    <p className="text-sm text-gray-500">
                      ¿Estás seguro de que quieres eliminar todos los fixtures? Esta acción no se puede deshacer.
                    </p>
                  </div>
                  <div className="items-center px-4 py-3 space-y-2">
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setShowDeleteConfirm(false)
                        setFixtures([]) // Use setFixtures from AppContext
                      }}
                      className="w-full"
                    >
                      Eliminar todos
                    </Button>
                    <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} className="w-full">
                      Cancelar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
