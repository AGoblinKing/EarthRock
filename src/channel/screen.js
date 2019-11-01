import { readable } from "svelte/store"

export const size = readable([window.innerWidth, window.innerHeight], (set) => {
  window.addEventListener(`resize`, () => {
    set([window.innerWidth, window.innerHeight])
  })
})
