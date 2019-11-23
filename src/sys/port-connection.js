import { writable, get } from "svelte/store"
import { mouse_up } from "./mouse.js"

// TODO: This needs refactored

// editor specific
// like a real time query
export const first = writable(false)
export const second = writable(false)
export const match = writable(false)
export const del = writable(false)

second.subscribe((value) => {
  const $first = get(first)
  const $second = get(second)

  if (!$first || !$second) return

  match.set([
    $first, $second
  ])
})

// clean up
mouse_up.subscribe(() => {
  requestAnimationFrame(() => {
    const $first = get(first)
    const $second = get(second)

    if ($first && !$second) del.set($first)
    if ($first) first.set(false)
    if ($second) second.set(false)
  })
})
