import { NextResponse } from "next/server"
import fs from "node:fs/promises"
import path from "node:path"

export const dynamic = "force-dynamic"

const DEFAULT_LOGOS_DIR = path.join(process.cwd(), "Logos Equipos Basket")
const ALLOWED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg"])
const MAX_DEPTH = 3

const getLogosDir = () => process.env.LOCAL_LOGOS_DIR || DEFAULT_LOGOS_DIR

const walk = async (root: string, current: string, depth: number, results: string[]) => {
  if (depth > MAX_DEPTH) return
  const entries = await fs.readdir(current, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue
    const fullPath = path.join(current, entry.name)
    if (entry.isDirectory()) {
      await walk(root, fullPath, depth + 1, results)
      continue
    }
    if (!entry.isFile()) continue
    const ext = path.extname(entry.name).toLowerCase()
    if (!ALLOWED_EXTENSIONS.has(ext)) continue
    const relativePath = path.relative(root, fullPath)
    results.push(relativePath)
  }
}

export async function GET() {
  const logosDir = getLogosDir()

  try {
    const results: string[] = []
    await walk(logosDir, logosDir, 0, results)

    const logos = results.map((relativePath) => {
      const fileName = path.basename(relativePath)
      return {
        relativePath,
        fileName,
        baseName: path.basename(fileName, path.extname(fileName)),
      }
    })

    return NextResponse.json({ logos })
  } catch (error) {
    return NextResponse.json(
      { error: `No se pudo leer la carpeta de logos: ${logosDir}` },
      { status: 500 },
    )
  }
}
