import React, { useRef } from "react";
import type { Match, Team } from "@/types";

interface FixtureListExportProps {
  fixtures: Match[];
  teams: Team[];
  date: string;
  width?: number;
  height?: number;
  spacing?: number; // Espaciado entre filas
  dateFontSize?: number; // Tamaño de fuente de la fecha
}

const ROW_HEIGHT = 160;
const PADDING = 364;
const TEAM_LOGO_SIZE = 96;
const FONT_FAMILY = 'Arial, Helvetica, sans-serif';

export const FixtureListExport: React.FC<FixtureListExportProps> = ({ fixtures, teams, date, width = 1200, height, spacing = 1000, dateFontSize = 108 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Altura dinámica: suma el spacing solo entre filas (no antes de la primera ni después de la última)
  const canvasHeight = height || (fixtures.length * ROW_HEIGHT + (fixtures.length - 1) * spacing + PADDING * 2 + 160);

  // Renderiza la lista de partidos en el canvas
  const renderCanvas = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, canvasHeight);
    ctx.font = `bold ${dateFontSize}px ${FONT_FAMILY}`;
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.fillText(date, width / 2, PADDING + 24);
    fixtures.forEach((fixture, i) => {
      // El offset vertical incluye spacing solo a partir de la segunda fila
      const y = PADDING + 364 + i * ROW_HEIGHT + i * spacing;
      const home = fixture.homeTeam;
      const away = fixture.awayTeam;
      if (!home || !away) return;
      // Fondo naranja fila
      ctx.fillStyle = "#F15A29";
      ctx.fillRect(PADDING + TEAM_LOGO_SIZE + 24, y, width - (PADDING * 2 + TEAM_LOGO_SIZE * 2 + 48), ROW_HEIGHT - 24);
      // Logos
      const homeLogo = new window.Image();
      homeLogo.src = home.logo;
      const awayLogo = new window.Image();
      awayLogo.src = away.logo;
      homeLogo.onload = () => {
        ctx.drawImage(homeLogo, PADDING, y + 16, TEAM_LOGO_SIZE, TEAM_LOGO_SIZE);
      };
      awayLogo.onload = () => {
        ctx.drawImage(awayLogo, width - PADDING - TEAM_LOGO_SIZE, y + 16, TEAM_LOGO_SIZE, TEAM_LOGO_SIZE);
      };
      if (homeLogo.complete) ctx.drawImage(homeLogo, PADDING, y + 16, TEAM_LOGO_SIZE, TEAM_LOGO_SIZE);
      if (awayLogo.complete) ctx.drawImage(awayLogo, width - PADDING - TEAM_LOGO_SIZE, y + 16, TEAM_LOGO_SIZE, TEAM_LOGO_SIZE);
      // Nombres equipos y hora
      ctx.font = `bold 32px ${FONT_FAMILY}`;
      ctx.fillStyle = "#fff";
      ctx.textAlign = "left";
      ctx.fillText(home.name, PADDING + TEAM_LOGO_SIZE + 40, y + 60);
      ctx.textAlign = "center";
      ctx.font = `bold px ${FONT_FAMILY}`;
      ctx.fillText(fixture.time, width / 2, y + 70);
      ctx.textAlign = "right";
      ctx.font = `bold 32px ${FONT_FAMILY}`;
      ctx.fillText(away.name, width - PADDING - TEAM_LOGO_SIZE - 40, y + 60);
    });
  };

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderCanvas(ctx);
  }, [fixtures, teams, date, width, canvasHeight]);

  return (
    <canvas ref={canvasRef} width={width} height={canvasHeight} style={{ display: 'none' }} />
  );
};

export default FixtureListExport;
