import { get, writable } from "svelte/store"
import { tick_rate } from "./flag.js"

const tick = writable(1)

setInterval(() => {
  tick.set(get(tick) + 1)
}, tick_rate)

export default tick
