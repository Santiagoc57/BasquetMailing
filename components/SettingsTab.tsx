"use client"

// Añadir el control de posición horizontal para los horarios en la pestaña de configuración
import React, { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { useAppContext } from "@/context/AppContext"
import type { Match, Team } from "@/types"

export const SettingsTab: React.FC = () => {
  const {
    // Preset de posiciones
    preset,
    setPreset,
    showTimeLabels,
    setShowTimeLabels,
    showDividers,
    setShowDividers,
    showTeamNames,
    setShowTeamNames,
    exportTextColorBlack,
    setExportTextColorBlack,
    exportHorario,
    setExportHorario,

    // Offsets y tamaños
    timeBlockOffset,
    setTimeBlockOffset,
    timeBlockOffsetInput,
    setTimeBlockOffsetInput,
    countryLabelOffset,
    setCountryLabelOffset,
    countryLabelOffsetInput,
    setCountryLabelOffsetInput,
    // Forzamos el valor -15 fijo para los nombres de equipos
    teamNamesOffset = -15,
    setTeamNamesOffset,
    teamNamesOffsetInput = -15,
    setTeamNamesOffsetInput,
    teamNamesFontSize,
    setTeamNamesFontSize,
    teamNamesFontSizeInput,
    setTeamNamesFontSizeInput,
    timesFontSize,
    setTimesFontSize,
    timesFontSizeInput,
    setTimesFontSizeInput,
    dividerHeight,
    setDividerHeight,
    dividerHeightInput,
    setDividerHeightInput,
    horizontalTimeOffset,
    setHorizontalTimeOffset,
    horizontalTimeOffsetInput,
    setHorizontalTimeOffsetInput,

    // Offsets por modo (compacto)
    compactTimeBlockOffset,
    setCompactTimeBlockOffset,
    compactTimeBlockOffsetInput,
    setCompactTimeBlockOffsetInput,
    compactTeamNamesOffset,
    setCompactTeamNamesOffset,
    compactTeamNamesOffsetInput,
    setCompactTeamNamesOffsetInput,

    // Fecha (vista web)
    dateVerticalOffset,
    setDateVerticalOffset,
    dateVerticalOffsetInput,
    setDateVerticalOffsetInput,

    // Espaciados de exportación
    exportSpacing,
    setExportSpacing,
    exportSpacingInput,
    setExportSpacingInput,
    exportDateSpacing,
    setExportDateSpacing,
    exportDateSpacingInput,
    setExportDateSpacingInput,
    exportDateFontSize,
    setExportDateFontSize,
    exportDateFontSizeInput,
    setExportDateFontSizeInput,

    // Funciones de importación/exportación
    importAllData,
    exportAllData,
    clearAllSavedData,

    // Estilo de bloque
    blockStyle,
    setBlockStyle,

    // Ligas y zonas horarias
    leagues,
    setLeagues,
    timeZones,
  } = useAppContext()

  // Estado local para controles de gradiente
  const [gradientEnabled, setGradientEnabled] = useState(false)
  const [gradientStart, setGradientStart] = useState("#EB5B27")
  const [gradientEnd, setGradientEnd] = useState("#FF8C00")
  const [gradientDirection, setGradientDirection] = useState<"to right" | "to left" | "to bottom" | "to top">("to right")
  const visibleTimeZones = timeZones.filter((tz) => tz.enabled !== false)

  // Fixture dummy para preview
  const dummyHomeTeam: Team = {
    id: "dummy-home",
    name: "Equipo A",
    logo: "/placeholder.svg?height=100&width=100",
    league: "Euroliga",
  }

  const dummyAwayTeam: Team = {
    id: "dummy-away",
    name: "Equipo B",
    logo: "/placeholder.svg?height=100&width=100",
    league: "Euroliga",
  }

  const dummyFixture: Match = {
    id: "dummy-fixture",
    date: "15-3",
    time: "20:00",
    homeTeam: dummyHomeTeam,
    awayTeam: dummyAwayTeam,
    times: {
      ARG: "20:00",
      BOL: "19:00",
      ECU: "18:00",
      CHI: "19:00",
    },
    league: "Euroliga",
    leagueColor: gradientEnabled
      ? undefined
      : leagues.find((l) => l.name === "Euroliga")?.color || "#EB5B27",
    textColor: exportTextColorBlack ? "black" : "white",
  }

  const getBackgroundStyle = () => {
    if (gradientEnabled) {
      return {
        background: `linear-gradient(${gradientDirection}, ${gradientStart}, ${gradientEnd})`,
      }
    }
    return {
      backgroundColor: dummyFixture.leagueColor || "#EB5B27",
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuración General</CardTitle>
        <CardDescription>Aquí puedes ajustar la configuración general de la aplicación.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="show-time-labels">Mostrar etiquetas de tiempo</Label>
          <Switch
            id="show-time-labels"
            checked={showTimeLabels}
            onCheckedChange={(checked) => setShowTimeLabels(checked)}
          />
        </div>

        <div className="mt-4">
          <Label htmlFor="date-vertical-offset" className="flex items-center">
            Espacio entre fecha y bloque (web)
            <span className="ml-2 cursor-help" title="Suma al margen inferior de la fecha (px) para separarla del bloque">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-help-circle"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
            </span>
          </Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              id="date-vertical-offset"
              value={dateVerticalOffsetInput}
              onChange={(e) => setDateVerticalOffsetInput(Number(e.target.value))}
            />
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={() => setDateVerticalOffset(dateVerticalOffsetInput)}>
                Aplicar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDateVerticalOffset(0)
                  setDateVerticalOffsetInput(0)
                }}
              >
                Restaurar
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <Label className="flex items-center mb-2">Estilo de bloque</Label>
          <div className="flex gap-2">
            <Button
              variant={blockStyle === "normal" ? "default" : "outline"}
              onClick={() => setBlockStyle("normal")}
            >
              Normal
            </Button>
            <Button
              variant={blockStyle === "compact" ? "default" : "outline"}
              onClick={() => {
                setBlockStyle("compact")
                setCountryLabelOffset(-30)
                setCountryLabelOffsetInput(-30)
              }}
            >
              Compacto
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="show-dividers">Mostrar divisores</Label>
          <Switch id="show-dividers" checked={showDividers} onCheckedChange={(checked) => setShowDividers(checked)} />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="show-team-names">Mostrar nombres de equipos</Label>
          <Switch
            id="show-team-names"
            checked={showTeamNames}
            onCheckedChange={(checked) => setShowTeamNames(checked)}
          />
        </div>

        <div className="mt-4">
          <Label htmlFor="text-color" className="flex items-center">
            Color del Texto
            <span className="ml-2 cursor-help" title="Selecciona el color del texto para los fixtures">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-help-circle"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <path d="M12 17h.01" />
              </svg>
            </span>
          </Label>
          <div className="flex items-center gap-2">
            <select
              id="text-color"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={exportTextColorBlack ? "black" : "white"}
              onChange={(e) => setExportTextColorBlack(e.target.value === "black")}
              style={{ fontFamily: "Poppins, sans-serif" }}
            >
              <option value="white">Blanco</option>
              <option value="black">Negro</option>
            </select>
          </div>
        </div>

        <div className="mt-4">
          <Label className="flex items-center mb-2">
            Preset de Posiciones
            <span className="ml-2 cursor-help" title="Selecciona un preset para ajustar automáticamente los valores de posición">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-help-circle">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <path d="M12 17h.01" />
              </svg>
            </span>
          </Label>
          <div className="flex gap-2 mb-4">
            <Button 
              variant={preset === "Con HORARIOS" ? "default" : "outline"}
              onClick={() => {
                setPreset("Con HORARIOS");
                const timeOffset = blockStyle === "compact" ? -30 : -35;
                const labelOffset = blockStyle === "compact" ? -30 : -35;
                setTimeBlockOffset(timeOffset);
                setTimeBlockOffsetInput(timeOffset);
                setCountryLabelOffset(labelOffset);
                setCountryLabelOffsetInput(labelOffset);
                setTeamNamesOffset(-45);
                setTeamNamesOffsetInput(-45);
                setTeamNamesFontSize(14);
                setTeamNamesFontSizeInput(14);
                setTimesFontSize(14);
                setTimesFontSizeInput(14);
                setDividerHeight(80);
                setDividerHeightInput(80);
                setHorizontalTimeOffset(0);
                setHorizontalTimeOffsetInput(0);
              }}
            >
              Con HORARIOS
            </Button>
            <Button 
              variant={preset === "Con NOMBRES" ? "default" : "outline"}
              onClick={() => {
                setPreset("Con NOMBRES");
                setTimeBlockOffset(0);
                setTimeBlockOffsetInput(0);
                setCountryLabelOffset(0);
                setCountryLabelOffsetInput(0);
                setTeamNamesOffset(0);
                setTeamNamesOffsetInput(0);
                setTeamNamesFontSize(18);
                setTeamNamesFontSizeInput(20);
                setTimesFontSize(32);
                setTimesFontSizeInput(32);
                setDividerHeight(80);
                setDividerHeightInput(80);
                setHorizontalTimeOffset(0);
                setHorizontalTimeOffsetInput(0);
              }}
            >
              Con NOMBRES
            </Button>
          </div>
        </div>

        <div>
          <Label htmlFor="export-horario">Horario para exportación</Label>
          <select
            id="export-horario"
            className="w-full border rounded px-3 py-2"
            value={exportHorario}
            onChange={(e) => setExportHorario(e.target.value)}
            style={{ fontFamily: "Poppins, sans-serif" }}
          >
            <option value="BOL">BOL / CHI</option>
            <option value="ARG">ARG / BRA / URU</option>
            <option value="ECU">ECU</option>
          </select>
        </div>

        <div className="mt-4">
  <Label htmlFor="export-spacing" className="flex items-center">
    Espaciado vertical entre fixtures (imagen exportada)
    <span
      className="ml-2 cursor-help"
      title="Controla el espacio vertical entre cada fixture en la imagen exportada. Puedes usar el slider o el campo numérico."
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="lucide lucide-help-circle"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <path d="M12 17h.01" />
      </svg>
    </span>
    <span className="ml-3 text-sm text-muted-foreground">{exportSpacingInput} px</span>
  </Label>
  <div className="flex flex-col md:flex-row md:items-center gap-2 mt-2">
    <input
      type="range"
      min={0}
      max={120}
      step={1}
      value={exportSpacingInput}
      onChange={e => setExportSpacingInput(Number(e.target.value))}
      className="w-full md:w-56 accent-orange-600"
      id="export-spacing-slider"
      aria-label="Espaciado vertical entre fixtures"
    />
    <Input
      type="number"
      id="export-spacing"
      min={0}
      max={120}
      value={exportSpacingInput}
      onChange={e => {
        let val = Number(e.target.value);
        if (val < 0) val = 0;
        if (val > 120) val = 120;
        setExportSpacingInput(val);
      }}
      className="w-20"
    />
    <div className="flex gap-1">
      <Button variant="default" size="sm" onClick={() => setExportSpacing(exportSpacingInput)}>
        Aplicar
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setExportSpacing(20);
          setExportSpacingInput(20);
        }}
      >
        Restaurar
      </Button>
    </div>
  </div>
</div>

        <div className="mt-4">
          <Label htmlFor="export-date-spacing" className="flex items-center">
            Espacio entre fecha y fixture (px, imagen)
            <span
              className="ml-2 cursor-help"
              title="Controla el espacio vertical entre la fecha y el fixture en la imagen exportada"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-help-circle"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <path d="M12 17h.01" />
              </svg>
            </span>
          </Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              id="export-date-spacing"
              value={exportDateSpacingInput}
              onChange={(e) => setExportDateSpacingInput(Number(e.target.value))}
            />
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={() => setExportDateSpacing(exportDateSpacingInput)}>
                Aplicar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setExportDateSpacing(2)
                  setExportDateSpacingInput(2)
                }}
              >
                Restaurar
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-4">
  <Label htmlFor="export-date-font-size" className="flex items-center">
    Tamaño de fuente de la fecha (imagen exportada)
    <span
      className="ml-2 cursor-help"
      title="Controla el tamaño de la fuente de la fecha en la imagen exportada. Puedes usar el slider o el campo numérico."
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="lucide lucide-help-circle"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <path d="M12 17h.01" />
      </svg>
    </span>
    <span className="ml-3 text-sm text-muted-foreground">{exportDateFontSizeInput} px</span>
  </Label>
  <div className="flex flex-col md:flex-row md:items-center gap-2 mt-2">
    <input
      type="range"
      min={12}
      max={96}
      step={1}
      value={exportDateFontSizeInput}
      onChange={e => setExportDateFontSizeInput(Number(e.target.value))}
      className="w-full md:w-56 accent-blue-600"
      id="export-date-font-size-slider"
      aria-label="Tamaño de fuente de la fecha"
      style={{ accentColor: '#2563eb' }}
    />
    <Input
      type="number"
      id="export-date-font-size"
      min={12}
      max={96}
      value={exportDateFontSizeInput}
      onChange={e => {
        let val = Number(e.target.value);
        if (val < 12) val = 12;
        if (val > 96) val = 96;
        setExportDateFontSizeInput(val);
      }}
      className="w-20"
    />
    <div className="flex gap-1">
      <Button variant="default" size="sm" onClick={() => setExportDateFontSize(exportDateFontSizeInput)}>
        Aplicar
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setExportDateFontSize(48);
          setExportDateFontSizeInput(48);
        }}
      >
        Restaurar
      </Button>
    </div>
  </div>
</div>



        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-4">Ajustes de Posición</h3>

          <div className="space-y-4">
            <div>
              <Label htmlFor="time-block-offset" className="flex items-center">
                Posición Vertical de Horarios
                <span
                  className="ml-2 cursor-help"
                  title="Ajusta la posición vertical de los horarios dentro del fixture"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="lucide lucide-help-circle"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                    <path d="M12 17h.01" />
                  </svg>
                </span>
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  id="time-block-offset"
                  value={blockStyle === "compact" ? compactTimeBlockOffsetInput : timeBlockOffsetInput}
                  onChange={(e) =>
                    blockStyle === "compact"
                      ? setCompactTimeBlockOffsetInput(Number(e.target.value))
                      : setTimeBlockOffsetInput(Number(e.target.value))
                  }
                />
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      blockStyle === "compact"
                        ? setCompactTimeBlockOffset(compactTimeBlockOffsetInput)
                        : setTimeBlockOffset(timeBlockOffsetInput)
                    }
                  >
                    Aplicar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (blockStyle === "compact") {
                        setCompactTimeBlockOffset(0)
                        setCompactTimeBlockOffsetInput(0)
                      } else {
                        setTimeBlockOffset(0)
                        setTimeBlockOffsetInput(0)
                      }
                    }}
                  >
                    Restaurar
                  </Button>
                </div>
              </div>
            </div>

            {/* Nuevo control para posición horizontal de horarios */}
            <div>
              <Label htmlFor="horizontal-time-offset" className="flex items-center">
                Posición Horizontal de Horarios
                <span
                  className="ml-2 cursor-help"
                  title="Ajusta la posición horizontal de los horarios dentro del fixture"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="lucide lucide-help-circle"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                    <path d="M12 17h.01" />
                  </svg>
                </span>
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  id="horizontal-time-offset"
                  value={horizontalTimeOffsetInput}
                  onChange={(e) => setHorizontalTimeOffsetInput(Number(e.target.value))}
                />
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setHorizontalTimeOffset(horizontalTimeOffsetInput)}
                  >
                    Aplicar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setHorizontalTimeOffset(0)
                      setHorizontalTimeOffsetInput(0)
                    }}
                  >
                    Restaurar
                  </Button>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="country-label-offset" className="flex items-center">
                Posición de Etiquetas de Países
                <span
                  className="ml-2 cursor-help"
                  title="Ajusta la posición vertical de las etiquetas de países dentro del fixture"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="lucide lucide-help-circle"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                    <path d="M12 17h.01" />
                  </svg>
                </span>
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  id="country-label-offset"
                  value={countryLabelOffsetInput}
                  onChange={(e) => setCountryLabelOffsetInput(Number(e.target.value))}
                />
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => setCountryLabelOffset(countryLabelOffsetInput)}>
                    Aplicar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCountryLabelOffset(0)
                      setCountryLabelOffsetInput(0)
                    }}
                  >
                    Restaurar
                  </Button>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="team-names-offset" className="flex items-center">
                Posición de Nombres de Equipos
                <span
                  className="ml-2 cursor-help"
                  title="Ajusta la posición vertical de los nombres de equipos dentro del fixture"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="lucide lucide-help-circle"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                    <path d="M12 17h.01" />
                  </svg>
                </span>
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  id="team-names-offset"
                  value={blockStyle === "compact" ? compactTeamNamesOffsetInput : teamNamesOffsetInput}
                  onChange={(e) =>
                    blockStyle === "compact"
                      ? setCompactTeamNamesOffsetInput(Number(e.target.value))
                      : setTeamNamesOffsetInput(Number(e.target.value))
                  }
                />
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      blockStyle === "compact"
                        ? setCompactTeamNamesOffset(compactTeamNamesOffsetInput)
                        : setTeamNamesOffset(teamNamesOffsetInput)
                    }
                  >
                    Aplicar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (blockStyle === "compact") {
                        setCompactTeamNamesOffset(0)
                        setCompactTeamNamesOffsetInput(0)
                      } else {
                        setTeamNamesOffset(0)
                        setTeamNamesOffsetInput(0)
                      }
                    }}
                  >
                    Restaurar
                  </Button>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="team-names-font-size" className="flex items-center">
                Tamaño de Fuente de Equipos
                <span className="ml-2 cursor-help" title="Controla el tamaño de la fuente de los nombres de equipos">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="lucide lucide-help-circle"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                    <path d="M12 17h.01" />
                  </svg>
                </span>
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  id="team-names-font-size"
                  value={teamNamesFontSizeInput}
                  onChange={(e) => setTeamNamesFontSizeInput(Number(e.target.value))}
                />
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => setTeamNamesFontSize(teamNamesFontSizeInput)}>
                    Aplicar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setTeamNamesFontSize(20)
                      setTeamNamesFontSizeInput(20)
                    }}
                  >
                    Restaurar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <Label htmlFor="times-font-size" className="flex items-center">
            Tamaño de los Horarios
            <span className="ml-2 cursor-help" title="Controla el tamaño de la fuente de los horarios en el fixture">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-help-circle"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <path d="M12 17h.01" />
              </svg>
            </span>
          </Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              id="times-font-size"
              value={timesFontSizeInput}
              onChange={(e) => setTimesFontSizeInput(Number(e.target.value))}
            />
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={() => setTimesFontSize(timesFontSizeInput)}>
                Aplicar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTimesFontSize(32)
                  setTimesFontSizeInput(32)
                }}
              >
                Restaurar
              </Button>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="divider-height" className="flex items-center">
              Altura de los divisores (%)
              <span
                className="ml-2 cursor-help"
                title="Controla la altura de las líneas divisorias entre los bloques de horarios"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-help-circle"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <path d="M12 17h.01" />
                </svg>
              </span>
            </Label>
            <span className="w-12 text-right">{dividerHeight}%</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              id="divider-height"
              min="0"
              max="100"
              value={dividerHeightInput}
              onChange={(e) => setDividerHeightInput(Number(e.target.value))}
              onMouseUp={() => setDividerHeight(dividerHeightInput)}
              onTouchEnd={() => setDividerHeight(dividerHeightInput)}
              className="w-full"
            />
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDividerHeight(dividerHeightInput)
                }}
              >
                Aplicar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDividerHeight(80)
                  setDividerHeightInput(80)
                }}
              >
                Restaurar
              </Button>
            </div>
          </div>
        </div>

        {/* Controles de gradiente */}
        <div className="mt-6 border-t pt-4">
          <h3 className="text-lg font-semibold mb-4">Gradientes de Franja</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="gradient-enabled">Habilitar gradiente</Label>
              <Switch
                id="gradient-enabled"
                checked={gradientEnabled}
                onCheckedChange={setGradientEnabled}
              />
            </div>
            {gradientEnabled && (
              <>
                <div>
                  <Label htmlFor="gradient-start">Color inicial</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="color"
                      id="gradient-start"
                      value={gradientStart}
                      onChange={(e) => setGradientStart(e.target.value)}
                      className="w-16 h-10"
                    />
                    <Input
                      type="text"
                      value={gradientStart}
                      onChange={(e) => setGradientStart(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="gradient-end">Color final</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="color"
                      id="gradient-end"
                      value={gradientEnd}
                      onChange={(e) => setGradientEnd(e.target.value)}
                      className="w-16 h-10"
                    />
                    <Input
                      type="text"
                      value={gradientEnd}
                      onChange={(e) => setGradientEnd(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="gradient-direction">Dirección</Label>
                  <select
                    id="gradient-direction"
                    className="w-full border rounded px-3 py-2 mt-1"
                    value={gradientDirection}
                    onChange={(e) => setGradientDirection(e.target.value as any)}
                  >
                    <option value="to right">Izquierda → Derecha</option>
                    <option value="to left">Derecha → Izquierda</option>
                    <option value="to bottom">Arriba → Abajo</option>
                    <option value="to top">Abajo → Arriba</option>
                  </select>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Vista previa interactiva */}
        <div className="mt-6 border-t pt-4">
          <h3 className="text-lg font-semibold mb-4">Vista Previa</h3>
          <div className="bg-gray-100 p-4 rounded-lg">
            <div className="flex items-center justify-center">
              {/* Logo equipo local */}
              <div
                className="relative flex items-center justify-center bg-white"
                style={{
                  width: blockStyle === "compact" ? "96px" : "144px",
                  height: blockStyle === "compact" ? "96px" : "128px",
                  borderRadius: "0",
                }}
              >
                <img
                  src={dummyFixture.homeTeam.logo}
                  alt={dummyFixture.homeTeam.name}
                  className="object-contain"
                  style={{
                    maxWidth: "90%",
                    maxHeight: "90%",
                  }}
                />
              </div>

              {/* Franja central con horarios */}
              <div
                className="flex items-center justify-between text-white relative"
                style={{
                  ...getBackgroundStyle(),
                  width: blockStyle === "compact" ? "500px" : "474px",
                  height: blockStyle === "compact" ? "75px" : "108px",
                  borderRadius: "0",
                  position: "relative",
                  color: dummyFixture.textColor || "white",
                  fontFamily: "Poppins, sans-serif",
                }}
              >
                {visibleTimeZones.map((tz, i) => (
                  <React.Fragment key={`preview-${tz.name}`}>
                    <div className="flex-1 flex flex-col items-center justify-center h-full">
                      {showTeamNames ? (
                        <div
                          className="text-center mb-1"
                          style={{
                            position: "relative",
                            top: `${(blockStyle === "compact" ? compactTeamNamesOffset : teamNamesOffset)}px`,
                            fontSize: `${teamNamesFontSize}px`,
                            fontFamily: "Poppins, sans-serif",
                            lineHeight: "1.2",
                            maxWidth: "100%",
                            padding: "0 5px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            minHeight: "2.4em",
                            color: dummyFixture.textColor || "white",
                          }}
                        >
                          {tz.name === "ECU"
                            ? dummyFixture.homeTeam.name
                            : tz.name === "BOL"
                              ? dummyFixture.awayTeam.name
                              : ""}
                        </div>
                      ) : (
                        showTimeLabels && (
                          <div
                            className="text-center mb-1 text-sm"
                            style={{
                              position: "relative",
                              top: `${countryLabelOffset}px`,
                              color: dummyFixture.textColor || "white",
                              fontFamily: "Poppins, sans-serif",
                            }}
                          >
                            {tz.label}
                          </div>
                        )
                      )}
                      <div
                        className="text-center font-bold"
                        style={{
                          marginTop: `${(blockStyle === "compact" ? compactTimeBlockOffset : timeBlockOffset)}px`,
                          position: "relative",
                          top: "-5px",
                          fontSize: `${timesFontSize}px`,
                          color: dummyFixture.textColor || "white",
                          fontFamily: "Poppins, sans-serif",
                        }}
                      >
                        {showTeamNames && i === 1
                          ? dummyFixture.times[exportHorario as keyof typeof dummyFixture.times]
                          : !showTeamNames
                            ? dummyFixture.times[tz.name as keyof typeof dummyFixture.times]
                            : ""}
                      </div>
                    </div>
                    {i < visibleTimeZones.length - 1 && showDividers && (
                      <div
                        className="w-px bg-white"
                        style={{
                          height: `${dividerHeight}%`,
                          backgroundColor: dummyFixture.textColor || "white",
                        }}
                      ></div>
                    )}
                  </React.Fragment>
                ))}
              </div>

              {/* Logo equipo visitante */}
              <div
                className="relative flex items-center justify-center bg-white"
                style={{
                  width: blockStyle === "compact" ? "96px" : "144px",
                  height: blockStyle === "compact" ? "96px" : "128px",
                  borderRadius: "0",
                }}
              >
                <img
                  src={dummyFixture.awayTeam.logo}
                  alt={dummyFixture.awayTeam.name}
                  className="object-contain"
                  style={{
                    maxWidth: "90%",
                    maxHeight: "90%",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
