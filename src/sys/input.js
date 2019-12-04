// Collection of meta controllers
import * as Mouse from "/sys/mouse.js"
import * as Key from "/sys/key.js"
import * as Time from "/sys/time.js"
import {
  INPUT_SCROLL_STRENGTH
} from "/sys/flag.js"

import { read, write } from "/util/store.js"
import { add, length, multiply_scalar } from "/util/vector.js"

export const translate = read([0, 0, 0], (set) => {
  let buffer = [0, 0, 0]

  Time.frame.listen(() => {
    const { w, a, s, d } = Key.keys.get()

    let b_key = [0, 0, 0]
    if (w) b_key = add(b_key, [0, -1, 0])
    if (s) b_key = add(b_key, [0, 1, 0])
    if (a) b_key = add(b_key, [-1, 0, 0])
    if (d) b_key = add(b_key, [1, 0, 0])

    buffer = add(b_key, buffer)
    if (length(buffer) === 0) return

    set([...buffer])
    buffer = [0, 0, 0]
  })

  // Mouse.scroll.listen((value_new) => {
  //   buffer = add(buffer, value_new)
  // })
})

export const scroll_set = write([0, 0, 0])

let scroll_velocity = [0, 0, 0]

export const scroll = read([0, 0, 0], (set) => {
  scroll_set.listen((v) => set(v))

  Time.tick.listen(() => {
    if (Math.abs(length(scroll_velocity)) < 1) return

    set(add(
      scroll.get(),
      scroll_velocity
    ))

    scroll_velocity = multiply_scalar(
      scroll_velocity,
      0.5
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
})
