import { writable, get, readable } from "svelte/store"

export const mouse_pos = writable([0, 0])
const mouse_raw = [0, 0]

window.addEventListener(`mousemove`, (e) => {
  mouse_raw[0] = e.clientX
  mouse_raw[1] = e.clientY

  if (mouse_raw[0] !== get(mouse_pos)[0] || mouse_raw[1] !== get(mouse_pos)[1]) {
    mouse_pos.set([...mouse_raw])
  }
})

export const position = mouse_pos
export const mouse_up = readable(null, set => {
  window.addEventListener(`mouseup`, (e) => {
    set(e)
  })
})

export const scroll = readable(0, (set) => {
  window.addEventListener(`mousewheel`, (e) => {
    set(get(scroll) + e.deltaY)
  })
})
