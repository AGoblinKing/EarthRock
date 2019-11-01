import { derived } from "svelte/store"
import { scroll } from "./mouse.js"

export const zoom = derived(
  scroll,
  ($scroll) => Math.min(3, Math.max(-0.5, $scroll * 0.01))
)
