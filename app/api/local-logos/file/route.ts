import fs from "node:fs/promises"
import path from "node:path"

export const dynamic = "force-dynamic"

const DEFAULT_LOGOS_DIR = "/Users/santiagocordoba/GITHUBS/[03] Generador de FIXTURE 4/Logos Equipos Basket"
const ALLOWED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg"])

const getLogosDir = () => process.env.LOCAL_LOGOS_DIR || DEFAULT_LOGOS_DIR

const getMimeType = (ext: string) => {
  switch (ext) {
    case ".png":
      return "image/png"
    case ".jpg":
    case ".jpeg":
      return "image/jpeg"
    case ".webp":
      return "image/webp"
    case ".svg":
      return "image/svg+xml"
    default:
      return "application/octet-stream"
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const fileParam = searchParams.get("name")
  const pathParam = searchParams.get("path")
  const rawParam = pathParam || fileParam
  if (!rawParam) {
    return new Response("Missing name", { status: 400 })
  }

  const safeRelative = path.normalize(rawParam).replace(/^(\.\.(\/|\\|$))+/, "")
  const ext = path.extname(safeRelative).toLowerCase()
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return new Response("Formato no permitido", { status: 400 })
  }

  const logosDir = getLogosDir()
  const filePath = path.resolve(logosDir, safeRelative)
  if (!filePath.startsWith(path.resolve(logosDir))) {
    return new Response("Ruta inválida", { status: 400 })
  }

  try {
    const data = await fs.readFile(filePath)
    return new Response(data, {
      headers: {
        "Content-Type": getMimeType(ext),
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    return new Response("Archivo no encontrado", { status: 404 })
  }
}
