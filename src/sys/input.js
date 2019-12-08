// Collection of meta controllers
import * as Mouse from "/sys/mouse.js"
import * as Key from "/sys/key.js"
import * as Time from "/sys/time.js"

import {
  INPUT_SCROLL_STRENGTH,
  INPUT_ZOOM_STRENGTH,
  INPUT_ZOOM_MIN
} from "/sys/flag.js"

import { read, write, transformer } from "/util/store.js"
import { add, length, multiply_scalar } from "/util/vector.js"

export const zoom = write(0.75)

// raw translate commands
export const translate = read([0, 0, 0], (set) => {
  const b_key = [0, 0, 0]
  // frame stuff has to be fast :/
  Time.frame.listen(() => {
    const { w, a, s, d } = Key.keys.get()

    b_key[0] = 0
    b_key[1] = 0

    if (w) b_key[1] -= 1
    if (s) b_key[1] += 1
    if (a) b_key[0] -= 1
    if (d) b_key[0] += 1

    if (length(b_key) === 0) return

    set(b_key)
  })

  // Mouse.scroll.listen((value_new) => {
  //   buffer = add(buffer, value_new)
  // })
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

  scroll_velocity = multiply_scalar(
    scroll_velocity,
    0.25
  )
})

translate.listen((t) => {
  scroll_velocity = add(
    scroll_velocity,
    multiply_scalar(
      t,
      INPUT_SCROLL_STRENGTH.get()
    )
  )
})

let zoom_velocity = 0

Mouse.scroll.listen(([, t]) => {
  zoom_velocity += t
})

Time.tick.listen(() => {
  if (Math.abs(zoom_velocity) < 0.01) return
  zoom.set(
    Math.max(
      Math.round(
        (zoom.get() + zoom_velocity * INPUT_ZOOM_STRENGTH.get()) * 100
      ) / 100
      , INPUT_ZOOM_MIN.get())
  )
  zoom_velocity *= 0.5
})

export const focus = write(``)
