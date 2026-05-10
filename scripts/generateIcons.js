import { createCanvas } from "canvas"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const sizes = [72, 96, 128, 192, 512]
const outputDir = path.join(__dirname, "../public/icons")
const publicDir = path.join(__dirname, "../public")

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true })

function renderIcon(size) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext("2d")
  ctx.fillStyle = "#1D9E75"
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = "#ffffff"
  ctx.font = `bold ${Math.floor(size * 0.35)}px Arial`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("SB", size / 2, size / 2)
  return canvas.toBuffer("image/png")
}

sizes.forEach((size) => {
  const buffer = renderIcon(size)
  fs.writeFileSync(path.join(outputDir, `icon-${size}x${size}.png`), buffer)
  console.log(`Generated icon-${size}x${size}.png`)
})

fs.writeFileSync(path.join(publicDir, "logo.png"), renderIcon(192))
fs.writeFileSync(path.join(publicDir, "favicon.ico"), renderIcon(72))
