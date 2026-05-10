export async function generateIcon(size) {
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")
  ctx.fillStyle = "#1D9E75"
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = "#ffffff"
  ctx.font = `bold ${size * 0.35}px Arial`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("SB", size / 2, size / 2)
  return canvas.toDataURL("image/png")
}
