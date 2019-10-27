import {get, writable} from "svelte/store"

const TICK_RATE = 100

const tick = writable(1)

setInterval(() => {
    tick.set(get(tick) + 1)
}, TICK_RATE)

export default tick