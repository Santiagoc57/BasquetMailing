"use client"

import type React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload } from "lucide-react"
import { useAppContext } from "@/context/AppContext"

export const ImportTab: React.FC = () => {
  const {
    bulkImportText,
    setBulkImportText,
    importFixturesFromText,
    importSuccess,
    storageError,
    uploadedLogos,
    handleBulkLogoUpload,
    updateLogoTeamName,
    confirmLogo,
    confirmAllLogos,
    removeLogo,
  } = useAppContext()

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Importar Fixtures desde Texto</CardTitle>
          <CardDescription>
            Ingresa los partidos agrupados por ligas en el formato:
            <br />
            Nombre de Liga
            <br />
            DD/MM HH:MM EquipoLocal-EquipoVisitante
            <br />
            o DD/MM HH:MM EquipoLocal  EquipoVisitante
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <textarea
              className="w-full h-64 p-3 border rounded-md resize-none"
              value={bulkImportText}
              onChange={(e) => setBulkImportText(e.target.value)}
              placeholder="Euroliga
23/5 12:00 Fenerbahce-Panathinaikos
23/5 15:00 Olympiacos-Monaco

Italia
15/03 16:00 Virtus Olidata Bologna  EA7 Emporio Armani Milano

Endesa
25/5 8:00 Tenerife-Valencia
25/5 17:00 Barcelona-Girona"
              style={{ fontFamily: "Poppins, sans-serif" }}
            />
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setBulkImportText("")}>
                Limpiar
              </Button>
              <Button onClick={() => importFixturesFromText(bulkImportText)}>Importar Fixtures</Button>
            </div>
            {importSuccess && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                ¡Fixtures importados exitosamente!
              </div>
            )}
            {storageError && (
              <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
                {storageError}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Importar Logos Masivamente</CardTitle>
          <CardDescription>Sube múltiples logos a la vez y edita sus nombres antes de confirmar</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <div className="mt-4">
                <Label htmlFor="bulk-logo-upload" className="cursor-pointer">
                  <span className="mt-2 block text-sm font-medium text-gray-900">
                    Haz clic para seleccionar archivos o arrastra y suelta aquí
                  </span>
                  <span className="mt-1 block text-xs text-gray-500">
                    Puedes editar los nombres de los equipos antes de confirmar
                  </span>
                </Label>
                <input
                  id="bulk-logo-upload"
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleBulkLogoUpload}
                  className="hidden"
                />
              </div>
            </div>

            {uploadedLogos.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Logos subidos - Edita los nombres antes de confirmar</h3>
                  <Button onClick={confirmAllLogos} variant="default">
                    Confirmar todos los logos ({uploadedLogos.length})
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {uploadedLogos.map((logo) => (
                    <div key={logo.id} className="border rounded p-4 flex items-center space-x-4">
                      <img src={logo.url || "/placeholder.svg"} alt={logo.name} className="h-16 w-16 object-contain" />
                      <div className="flex-1">
                        <Input
                          value={logo.teamName}
                          onChange={(e) => updateLogoTeamName(logo.id, e.target.value)}
                          placeholder="Nombre del equipo"
                          className="mb-2"
                        />
                        <div className="flex space-x-2">
                          <Button size="sm" onClick={() => confirmLogo(logo.id)}>
                            Confirmar
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => removeLogo(logo.id)}>
                            Eliminar
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Consejos para subir logos de equipos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p>
              <strong>Método 1 (Recomendado):</strong> Usa la función "Importar Logos Masivamente" en esta pestaña.
              Puedes seleccionar múltiples archivos de imagen a la vez y editar los nombres de los equipos antes de
              confirmarlos.
            </p>
            <p>
              <strong>Método 2:</strong> En la pestaña "Equipos", agrega equipos manualmente con URLs de imágenes.
              Puedes usar servicios como Imgur o ImgBB para subir tus imágenes y obtener URLs.
            </p>
            <p>
              <strong>Consejos para mejores resultados:</strong>
            </p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Usa imágenes con fondo transparente (PNG) para mejor apariencia</li>
              <li>Imágenes cuadradas funcionan mejor (misma altura y anchura)</li>
              <li>Tamaño recomendado: 200x200 píxeles o mayor</li>
              <li>Nombra tus archivos con el nombre del equipo para facilitar la importación masiva</li>
              <li>
                Si tienes problemas con la exportación, intenta usar logos con URLs públicas en lugar de archivos
                locales
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
