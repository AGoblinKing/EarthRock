import { TILE_COUNT, TILE_COLUMNS } from "/sys/flag.js"

const SIZE = 16
const SPACING = 0
const COLUMNS = TILE_COLUMNS.get()
const COUNT = TILE_COUNT.get()

const ready = new Promise((resolve) => {
  const tiles = new Image()
  tiles.src = `/sheets/default_2.png`

  tiles.onload = () => {
    const canvas = document.createElement(`canvas`)
    canvas.width = tiles.width
    canvas.height = tiles.height

    const ctx = canvas.getContext(`2d`)
    ctx.drawImage(tiles, 0, 0)

    resolve({ ctx, canvas })
  }
})

const repo = new Map()

const num_random = (min, max) =>
  Math.floor(Math.random() * (Math.abs(min) + Math.abs(max)) - Math.abs(min))

export default async ({
  width,
  height,
  data,
  random = false
}) => {
  const { canvas } = await ready

  const key = `${width}:${height}:${data}`

  if (!random && repo.has(key)) {
    return repo.get(key)
  }

  const data_canvas = document.createElement(`canvas`)
  const data_ctx = data_canvas.getContext(`2d`)

  data_canvas.width = SIZE * width
  data_canvas.height = SIZE * height

  if (random) {
    let t_x, t_y
    let s_x, s_y

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        t_x = x * SIZE
        t_y = y * SIZE

        s_x = num_random(0, COLUMNS) * (SIZE + SPACING)
        s_y = num_random(0, COUNT / COLUMNS) * (SIZE + SPACING)

        data_ctx.drawImage(
          canvas,
          s_x, s_y, SIZE, SIZE,
          t_x, t_y, SIZE, SIZE
        )
      }
    }
  } else if (data.length > 0) {
    let x, y
    data.split(` `).forEach((loc, i) => {
      x = i % width
      y = Math.floor(i / width)

      const idx = parseInt(loc, 10)
      const o_x = idx % COLUMNS
      const o_y = Math.floor(idx / COLUMNS)

      const t_x = x * SIZE
      const t_y = y * SIZE

      const s_x = o_x * (SIZE + SPACING)
      const s_y = o_y * (SIZE + SPACING)

      data_ctx.drawImage(
        canvas,
        s_x, s_y, SIZE, SIZE,
        t_x, t_y, SIZE, SIZE
      )
    })
  }

  const result = data_canvas.toDataURL(`image/png`)
  if (!random) {
    repo.set(key, result)
  }

  return result
}
