import { get, readable } from "svelte/store"

export const position = readable([0, 0], set => window
  .addEventListener(`mousemove`, ({ clientX, clientY }) => set([clientX, clientY]))
)

export const mouse_up = readable(null, set => window
  .addEventListener(`mouseup`, (e) => set(e))
)

export const scroll = readable(0, set => window
  .addEventListener(`mousewheel`, (e) => set(get(scroll) + e.deltaY))
)
