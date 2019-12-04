import { read } from "/util/store.js"

export const up = read(``, (set) =>
  window.addEventListener(`keyup`, (e) => {
    if (
      e.target.tagName === `INPUT` ||
      e.target.tagName === `TEXTAREA`
    ) {
      return
    }

    e.preventDefault()
    set(``)
    set(e.key)
  })
)

export const down = read(``, (set) =>
  window.addEventListener(`keydown`, (e) => {
    if (
      e.target.tagName === `INPUT` ||
      e.target.tagName === `TEXTAREA`
    ) {
      return
    }

    e.preventDefault()
    set(``)
    set(e.key)
  })
)

export const keys = read({}, (set) => {
  down.listen((char) =>
    set({
      ...keys.get(),
      [char]: true
    })
  )
  up.listen((char) => set({
    ...keys.get(),
    [char]: false
  }))
})
