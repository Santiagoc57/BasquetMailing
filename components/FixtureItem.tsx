"use client"

import React, { useCallback, useRef } from "react"
import type { Match } from "@/types"
import { useAppContext } from "@/context/AppContext"
import { formatDate } from "@/utils/fixtures"

interface FixtureItemProps {
  fixture: Match
  showDate: boolean
}

const FixtureItem: React.FC<FixtureItemProps> = ({ fixture, showDate }) => {
  const {
    showTimeLabels,
    showDividers,
    showTeamNames,
    timeBlockOffset,
    countryLabelOffset,
    teamNamesOffset,
    teamNamesFontSize,
    timesFontSize,
    dividerHeight,
    horizontalTimeOffset, // Usar el nuevo offset horizontal
    timeZones,
    exportHorario,
    exportMode,
    fixtureMarginTop,
    fixtureMarginBottom,
    updateFixture,
    removeFixture,
    teams,
    leagues,
    dateVerticalOffset,
    blockStyle,
    compactTimeBlockOffset,
    compactTeamNamesOffset,
  } = useAppContext()

  const homeLogoInputRef = useRef<HTMLInputElement | null>(null)
  const awayLogoInputRef = useRef<HTMLInputElement | null>(null)

  const handleLogoUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>, teamKey: "homeTeam" | "awayTeam") => {
      const file = event.target.files?.[0]
      if (!file) {
        return
      }

      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result
        if (typeof result === "string") {
          const updatedTeam =
            teamKey === "homeTeam"
              ? { ...fixture.homeTeam, logo: result }
              : { ...fixture.awayTeam, logo: result }
          updateFixture(fixture.id, teamKey, updatedTeam)
        }
      }
      reader.readAsDataURL(file)

      // Permitir volver a cargar el mismo archivo si se desea
      event.target.value = ""
    },
    [fixture, updateFixture],
  )

  const triggerLogoUpload = useCallback(
    (inputRef: React.RefObject<HTMLInputElement | null>) => {
      if (exportMode) {
        return
      }
      inputRef.current?.click()
    },
    [exportMode],
  )

  return (
    <div
      className="fixture-item mb-4"
      style={{
        marginTop: `${fixtureMarginTop}px`,
        marginBottom: `${fixtureMarginBottom}px`,
        padding: "5px",
        border: "1px solid transparent",
        fontFamily: "Poppins, sans-serif",
      }}
    >
      {/* Fecha en la parte superior */}
      <div
        className={`text-center py-2 font-bold text-lg text-white fixture-date ${!showDate && exportMode ? "hidden" : ""}`}
        style={{
          fontSize: "150%",
          fontFamily: "Poppins, sans-serif",
          marginBottom: `${dateVerticalOffset}px`,
        }}
      >
        {formatDate(fixture.date)}
      </div>

      <div className="flex items-center justify-center fixture-row">
{/* Logo equipo local */}
        <div
          className="flex items-center justify-center bg-white"
          style={{
            width: blockStyle === "compact" ? "96px" : "144px",
            height: blockStyle === "compact" ? "96px" : "128px",
            borderRadius: "0",
          }}
          role={exportMode ? undefined : "button"}
          tabIndex={exportMode ? -1 : 0}
          onClick={() => triggerLogoUpload(homeLogoInputRef)}
          onKeyDown={(event) => {
            if (exportMode) {
              return
            }
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              triggerLogoUpload(homeLogoInputRef)
            }
          }}
          title={exportMode ? undefined : "Haz clic para subir un logo"}
          aria-label={exportMode ? undefined : `Subir logo para ${fixture.homeTeam.name}`}
        >
          <img
            src={fixture.homeTeam.logo || "/placeholder.svg?height=100&width=100"}
            alt={fixture.homeTeam.name}
            className="object-contain"
            style={{
              maxWidth: "90%",
              maxHeight: "90%",
            }}
            crossOrigin="anonymous"
          />
          <input
            ref={homeLogoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => handleLogoUpload(event, "homeTeam")}
          />
        </div>

        {/* Franja central con horarios */}
        <div
          className="flex items-center justify-between text-white relative"
          style={{
            ...((() => {
              const league = leagues.find((l) => l.name === fixture.league)
              if (league?.gradient?.enabled) {
                return {
                  background: `linear-gradient(${league.gradient.direction}, ${league.gradient.startColor}, ${league.gradient.endColor})`,
                }
              }
              return {
                backgroundColor: fixture.leagueColor || league?.color || "#000000",
              }
            })()),
            width: blockStyle === "compact" ? "420px" : "474px",
            height: blockStyle === "compact" ? "88px" : "108px",
            borderRadius: "0",
            position: "relative",
            color: fixture.textColor || "white",
            fontFamily: "Poppins, sans-serif",
          }}
        >
          {/* Contenido de la franja */}
          {timeZones.map((tz, i) => (
            <React.Fragment key={`${fixture.id}-${tz.name}`}>
              <div className="flex-1 flex flex-col items-center justify-center h-full">
                {showTeamNames ? (
                  // Show team names instead of time zones
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
                      color: fixture.textColor || "white",
                    }}
                  >
                    {i === 0
                      ? fixture.homeTeam.name
                      : i === timeZones.length - 1
                        ? fixture.awayTeam.name
                        : ""}
                  </div>
                ) : (
                  // Show time zone labels
                  showTimeLabels && (
                    <div
                      className="text-center mb-1 text-sm"
                      style={{
                        position: "relative",
                        top: `${countryLabelOffset}px`,
                        color: fixture.textColor || "white",
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
                    left: `${horizontalTimeOffset}px`, // Aplicar offset horizontal aquí
                    fontSize: `${blockStyle === "compact" ? Math.max(10, timesFontSize - 6) : timesFontSize}px`,
                    color: fixture.textColor || "white",
                    fontFamily: "Poppins, sans-serif",
                  }}
                >
                  {showTeamNames && i === 1
                    ? fixture.times[exportHorario as keyof typeof fixture.times]
                    : !showTeamNames
                      ? fixture.times[tz.name as keyof typeof fixture.times]
                      : ""}
                </div>
              </div>
              {i < timeZones.length - 1 && showDividers && (
                <div
                  className="w-px bg-white"
                  style={{
                    height: `${dividerHeight}%`,
                    backgroundColor: fixture.textColor || "white",
                  }}
                ></div>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Logo equipo visitante */}
        <div
          className="flex items-center justify-center bg-white"
          style={{
            width: blockStyle === "compact" ? "96px" : "144px",
            height: blockStyle === "compact" ? "96px" : "128px",
            borderRadius: "0",
          }}
          role={exportMode ? undefined : "button"}
          tabIndex={exportMode ? -1 : 0}
          onClick={() => triggerLogoUpload(awayLogoInputRef)}
          onKeyDown={(event) => {
            if (exportMode) {
              return
            }
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              triggerLogoUpload(awayLogoInputRef)
            }
          }}
          title={exportMode ? undefined : "Haz clic para subir un logo"}
          aria-label={exportMode ? undefined : `Subir logo para ${fixture.awayTeam.name}`}
        >
          <img
            src={fixture.awayTeam.logo || "/placeholder.svg?height=100&width=100"}
            alt={fixture.awayTeam.name}
            className="object-contain"
            style={{
              maxWidth: "90%",
              maxHeight: "90%",
            }}
          />
          <input
            ref={awayLogoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => handleLogoUpload(event, "awayTeam")}
          />
        </div>
      </div>

      {/* Barra de control del fixture - solo visible cuando no está en modo exportación */}
      {!exportMode && (
        <div className="bg-gray-100 p-2 flex justify-between items-center mt-2 overflow-x-auto fixture-control-bar">
          <div className="flex items-center space-x-2">
            <label htmlFor={`date-${fixture.id}`} className="text-sm">
              Fecha
            </label>
            <input
              type="text"
              id={`date-${fixture.id}`}
              value={fixture.date}
              onChange={(e) => updateFixture(fixture.id, "date", e.target.value)}
              className="w-20 text-sm border rounded px-2 py-1"
            />

            <label htmlFor={`time-${fixture.id}`} className="text-sm">
              Hora
            </label>
            <input
              type="text"
              id={`time-${fixture.id}`}
              value={fixture.time}
              onChange={(e) => updateFixture(fixture.id, "time", e.target.value)}
              className="w-16 text-sm border rounded px-2 py-1"
            />

            <label htmlFor={`homeTeam-${fixture.id}`} className="text-sm">
              Local
            </label>
            <div className="flex items-center">
              <select
                id={`homeTeam-${fixture.id}`}
                value={fixture.homeTeam.id}
                onChange={(e) => {
                  const selectedTeam = teams.find((t) => t.id === e.target.value)
                  if (selectedTeam) {
                    updateFixture(fixture.id, "homeTeam", selectedTeam)
                  }
                }}
                className="w-24 text-sm border rounded px-2 py-1"
              >
                {[...teams]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((team) => (
                    <option key={`home-${fixture.id}-${team.id}`} value={team.id}>
                      {team.name}
                    </option>
                  ))}
              </select>
              <input
                type="text"
                value={fixture.homeTeam.name}
                onChange={(e) => {
                  const updatedTeam = { ...fixture.homeTeam, name: e.target.value }
                  updateFixture(fixture.id, "homeTeam", updatedTeam)
                }}
                className="w-24 text-sm ml-1 border rounded px-2 py-1"
                placeholder="Editar nombre"
              />
            </div>

            <label htmlFor={`awayTeam-${fixture.id}`} className="text-sm">
              Visitante
            </label>
            <div className="flex items-center">
              <select
                id={`awayTeam-${fixture.id}`}
                value={fixture.awayTeam.id}
                onChange={(e) => {
                  const selectedTeam = teams.find((t) => t.id === e.target.value)
                  if (selectedTeam) {
                    updateFixture(fixture.id, "awayTeam", selectedTeam)
                  }
                }}
                className="w-24 text-sm border rounded px-2 py-1"
              >
                {[...teams]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((team) => (
                    <option key={`away-${fixture.id}-${team.id}`} value={team.id}>
                      {team.name}
                    </option>
                  ))}
              </select>
              <input
                type="text"
                value={fixture.awayTeam.name}
                onChange={(e) => {
                  const updatedTeam = { ...fixture.awayTeam, name: e.target.value }
                  updateFixture(fixture.id, "awayTeam", updatedTeam)
                }}
                className="w-24 text-sm ml-1 border rounded px-2 py-1"
                placeholder="Editar nombre"
              />
            </div>

            <label htmlFor={`league-${fixture.id}`} className="text-sm">
              Liga
            </label>
            <select
              id={`league-${fixture.id}`}
              value={fixture.league}
              onChange={(e) => updateFixture(fixture.id, "league", e.target.value)}
              className="w-24 text-sm border rounded px-2 py-1"
            >
              {leagues.map((league) => (
                <option key={`league-${fixture.id}-${league.name}`} value={league.name}>
                  {league.name}
                </option>
              ))}
            </select>

            <label htmlFor={`text-color-${fixture.id}`} className="text-sm">
              Texto
            </label>
            <select
              id={`text-color-${fixture.id}`}
              value={fixture.textColor || "white"}
              onChange={(e) => updateFixture(fixture.id, "textColor", e.target.value)}
              className="w-16 text-sm border rounded px-2 py-1"
            >
              <option value="white">Blanco</option>
              <option value="black">Negro</option>
            </select>
          </div>
          <button
            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
            onClick={() => removeFixture(fixture.id)}
          >
            Eliminar
          </button>
        </div>
      )}
    </div>
  )
}

export default React.memo(FixtureItem)
