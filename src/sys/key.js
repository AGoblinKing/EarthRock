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

    set(e.key.toLowerCase())
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

    set(e.key.toLowerCase())
  })
)

export const keys = read({}, (set) => {
  const value = {}

  down.listen((char) => {
    value[char] = true
    set(value)
  })

  up.listen((char) => {
    delete value[char]
    set(value)
  })
})
