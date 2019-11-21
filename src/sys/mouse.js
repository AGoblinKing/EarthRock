import { read } from "/util/store.js"

export const position = read([0, 0], set => window
  .addEventListener(`mousemove`, ({ clientX, clientY }) => set([clientX, clientY]))
)

export const mouse_up = read(null, set => window
  .addEventListener(`mouseup`, (e) => set(e))
)

export const scroll = read([0, 0, 0], set => window
  .addEventListener(`wheel`, (e) => {
    e.preventDefault()
    set([-e.deltaX, -e.deltaY, 0])
  })
)
