import { math as math_js } from "/util/math.js"
import { write, get, read, derived } from "/util/store.js"

const math_run = (expression, arg) => {
  try {
    return math_js(expression, arg)
  } catch (ex) {
    return null
  }
}

export default ({
  math = `2+2`,
  value
} = false) => {
  const m = ({
    knot: read(`math`),
    math: write(math),
    value: write(value)
  })

  const set = m.value.set
  let val_in = value

  set(math_run(math, val_in))

  m.value.set = (val) => {
    val_in = val
    set(math_run(math, val))
  }

  m.math.subscribe((expression) => {
    console.log(expression)
    set(math_run(expression, val_in))
  })

  return m
}
