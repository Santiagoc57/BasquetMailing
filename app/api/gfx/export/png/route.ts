import sharp from "sharp"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const svg = await request.text()
    if (!svg.trim()) {
      return new Response("Missing SVG payload", { status: 400 })
    }

    const url = new URL(request.url)
    const width = Number(url.searchParams.get("width") ?? "")
    const height = Number(url.searchParams.get("height") ?? "")

    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return new Response("Invalid dimensions", { status: 400 })
    }

    const pngBuffer = await sharp(Buffer.from(svg), { density: 96 })
      .resize({
        width,
        height,
        fit: "fill",
        withoutEnlargement: false,
      })
      .png()
      .toBuffer()

    return new Response(new Uint8Array(pngBuffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("PNG export route failed", error)
    return new Response("PNG export failed", { status: 500 })
  }
}
