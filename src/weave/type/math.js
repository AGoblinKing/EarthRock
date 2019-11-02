import Hole from "./Hole.js"
import { math as math_run } from "/util/math.js"
import { writable, get } from "svelte/store"

export default ({
  math = `2+2`,
  value = {},
  ...junk
}) => {
  const m = ({
    ...junk,
    math: writable(math),
    value: writable(value),
    value_overwrite: true
  })

  const set = m.value.set

  set(math_run(math, value))

  m.value.set = (val) => {
    set(math_run(math, val))
  }

  m.math.subscribe((expression) => {
    set(math_run(expression, get(m.value)))
  })

  return Hole(m)
}
