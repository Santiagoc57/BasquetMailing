"use client"

import React, { memo } from "react"
import type { Match } from "@/types"
import FixtureItem from "./FixtureItem"
import { Button } from "@/components/ui/button"
import { useAppContext } from "@/context/AppContext"

interface LeagueFixturesProps {
  leagueName: string
  dateFixtures: Record<string, Match[]>
}

const LeagueFixtures: React.FC<LeagueFixturesProps> = memo(({ leagueName, dateFixtures }) => {
  const { leagues, exportMode, fixtures, setFixtures } = useAppContext()

  const handleDeleteLeague = () => {
    const leagueFixtures = fixtures.filter((f) => f.league === leagueName)
    const fixtureIds = leagueFixtures.map((f) => f.id)
    setFixtures(fixtures.filter((f) => !fixtureIds.includes(f.id)))
  }

  return (
    <div id={`league-container-${leagueName.replace(/\s+/g, "-").toLowerCase()}`} className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold flex items-center">
          <span
            className="mr-2 h-5 w-5 rounded-full"
            style={{
              backgroundColor: leagues.find((l) => l.name === leagueName)?.color || "#000000",
            }}
          ></span>
          {leagueName}
        </h3>
        {!exportMode && (
          <Button variant="outline" size="sm" onClick={handleDeleteLeague}>
            Eliminar liga
          </Button>
        )}
      </div>

      {/* Renderizar cada fixture Con HORARIOSmente con su fecha en la parte superior */}
      {Object.keys(dateFixtures)
        .sort((a, b) => {
          const [da, ma] = a.split(/[\/-]/).map((n) => parseInt(n, 10))
          const [db, mb] = b.split(/[\/-]/).map((n) => parseInt(n, 10))
          const ya = new Date().getFullYear()
          const yb = ya
          const d1 = new Date(ya, (ma || 0) - 1, da || 0).getTime()
          const d2 = new Date(yb, (mb || 0) - 1, db || 0).getTime()
          return d1 - d2
        })
        .map((date) => {
          const fixturesForDate = [...dateFixtures[date]].sort((f1, f2) => {
            const [h1, m1] = (f1.time || "00:00").split(":").map((n) => parseInt(n, 10))
            const [h2, m2] = (f2.time || "00:00").split(":").map((n) => parseInt(n, 10))
            return h1 !== h2 ? h1 - h2 : m1 - m2
          })

          // Mostrar la fecha solo para el primer fixture de cada fecha
          let lastDate = ""

          return (
            <React.Fragment key={`${leagueName}-${date}`}>
              {fixturesForDate.map((fixture) => {
                const showDate = fixture.date !== lastDate
                lastDate = fixture.date
                return <FixtureItem key={fixture.id} fixture={fixture} showDate={showDate} />
              })}
            </React.Fragment>
          )
        })}
    </div>
  )
})

LeagueFixtures.displayName = "LeagueFixtures"

export default LeagueFixtures
