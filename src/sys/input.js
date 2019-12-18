// Collection of meta controllers
import * as Mouse from "/sys/mouse.js"
import * as Key from "/sys/key.js"
import * as Time from "/sys/time.js"

import { v3 } from "twgl.js"

const { length, add, mulScalar } = v3

import { read, write, transformer } from "/util/store.js"

export const zoom = write(0.75)

// raw translate commands
export const translate = read([0, 0, 0], (set) => {
  const b_key = [0, 0, 0]
  // frame stuff has to be fast :/
  Time.frame.listen(() => {
    const { w, a, s, d, q, e } = Key.keys.get()

    b_key[0] = 0
    b_key[1] = 0
    b_key[2] = 0

    if (w) b_key[1] -= 1
    if (s) b_key[1] += 1
    if (a) b_key[0] -= 1
    if (d) b_key[0] += 1
    if (q) b_key[2] += 1
    if (e) b_key[2] -= 1

    if (length(b_key) === 0) return

    set(b_key)
  })
})

let scroll_velocity = [0, 0, 0]

export const scroll = transformer((data) => data.map((i) => Math.round(i)))

scroll.set([0, 0, 0])

Time.tick.listen(() => {
  if (Math.abs(length(scroll_velocity)) < 1) return

  scroll.set(add(
    scroll.get(),
    scroll_velocity
  ).map((n) => Math.round(n)))

  scroll_velocity = mulScalar(
    scroll_velocity,
    0.25
  )
})

Mouse.scroll.listen((vel) => {
  scroll_velocity = add(scroll_velocity, vel)
})

export const focus = write(``)
