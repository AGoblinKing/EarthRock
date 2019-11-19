import { writable, get } from "svelte/store"
import { mouse_up } from "./mouse.js"

// editor specific
// like a real time query
export const first = writable(false)
export const second = writable(false)
export const match = writable(false)

second.subscribe((value) => {
  const $first = get(first)
  const $second = get(second)

  if ($first && $second) {
    match.set([
      $first, $second
    ])
  }
})

// clean up
mouse_up.subscribe(() => {
  requestAnimationFrame(() => {
    const $first = get(first)
    const $second = get(second)

    if ($first !== false) first.set(false)
    if ($second !== false) second.set(false)
  })
})
