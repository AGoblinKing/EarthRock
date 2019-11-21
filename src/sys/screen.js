import { read, write, derived } from "/util/store.js"
import { scroll } from "/sys/mouse.js"

export const size = read([window.innerWidth, window.innerHeight], (set) => {
  window.addEventListener(`resize`, () => {
    set([window.innerWidth, window.innerHeight])
  })
})

export const scale = write(1)

size.subscribe(([width, height]) => {
  const target = width > height
    ? height
    : width

  scale.set(target / 1618)
})

export const zoom = derived(
  scroll,
  ({ deltaY }) => Math.min(3, Math.max(-0.5, deltaY * 0.01))
)

// main canvas
export const main = write((() => {
  const canvas = document.createElement(`canvas`)
  canvas.width = canvas.height = 100
  return canvas
})())
