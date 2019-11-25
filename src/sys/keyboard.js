import { read } from "/util/store.js"

export const down = read({}, (set) => {
  window.addEventListener(`keydown`, (e) => {
    if (
      e.target.tagName === `INPUT` ||
      e.target.tagName === `TEXTAREA`
    ) {
      return
    }

    e.preventDefault()

    set({
      ...down.get(),
      [e.key.toLowerCase()]: true
    })
  })

  window.addEventListener(`keyup`, (e) => {
    if (
      e.target.tagName === `INPUT` ||
      e.target.tagName === `TEXTAREA`
    ) {
      return
    }

    e.preventDefault()

    set({
      ...down.get(),
      [e.key.toLowerCase()]: false
    })
  })
})
