import { read } from "/util/store.js"
import { tick_rate } from "./flag.js"

export const tick = read(0, (set) => {
  setInterval(() => {
    set(tick.get() + 1)
  }, tick_rate)
})

export const frame = read([0, 0], (set) => {
  let old
  const frame_t = (ts) => {
    requestAnimationFrame(frame_t)

    if (old === undefined) old = ts
    const dt = ts - old

    set([dt, ts])
  }

  requestAnimationFrame(frame_t)
})
