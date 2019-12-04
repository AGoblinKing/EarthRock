import { read } from "/util/store.js"
import { TIME_TICK_RATE } from "./flag.js"

export const tick = read(0, (set) => {
  let intv = false

  TIME_TICK_RATE.listen(($rate) => {
    if (intv) clearInterval(intv)
    intv = setInterval(() => {
      set(tick.get() + 1)
    }, $rate)
  })
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
