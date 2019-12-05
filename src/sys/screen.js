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

  scale.set(target / 100)
  window.document.documentElement.style.fontSize = `${Math.round(scale.get())}px`
})

// main canvas
export const main = write((() => {
  const canvas = document.createElement(`canvas`)
  canvas.width = canvas.height = 100
  return canvas
})())
