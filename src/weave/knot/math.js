import { math as math_js } from "/util/math.js"
import { write, read, transformer } from "/util/store.js"

const re_id = /\.?\/[a-zA-Z \/]+/g
const whitespace = /[ .]./g

const escape = (str) =>
  str.replace(/[.*+?^${}()|[\]\\]/g, `\\$&`) // $& means the whole matched string

const re_var = /\//g

export default ({
  math = `2+2`,
  value,
  weave,
  life
} = false) => {
  let math_fn = () => {}

  const values = write({})

  const math_run = (expression) => {
    const matches = expression.match(re_id)
    const vs = {}

    new Set(matches).forEach((item) => {
      const gette = item
        .replace(`.`, `/${weave.name.get()}`)
        .trim()

      const k = Wheel.get(gette)
      if (!k) return

      const name = gette.replace(whitespace, ``).replace(re_var, ``)

      expression = expression.replace(
        new RegExp(escape(item), `g`),
        name
      )

      vs[name] = k
    })

    // also wtf dont recompile expression each time
    try {
      math_fn = math_js(expression)
      values.set(vs)
    } catch (ex) {
      return console.warn(`MATH`, ex)
    }
  }

  const m = ({
    knot: read(`math`),
    math: transformer((expression) => {
      math_run(expression, value)
      return expression
    }).set(math),
    value: write(value)
  })

  const set = m.value.set
  math_run(math, value)

  m.value.set = (val) => {
    const vs = values.get()
    val = val === undefined
      ? null
      : val

    const result = math_fn({
      ...Object.fromEntries(Object.entries(vs).map(
        ([key, k]) => [key, k.toJSON()]
      )),
      v: val
    })
    set(result)
    return m.value
  }

  life(() => {
    const cancels = new Set()
    //
    const cancel_vs = values.listen((vs) => {
      cancels.forEach((cancel) => cancel())
      cancels.clear()

      Object.entries(vs).forEach(([key, k]) => {
        cancels.add(k.listen(m.value.poke))
      })
    })

    m.value.poke()
    return () => {
      cancel_vs()
      cancels.forEach((cancel) => cancel())
    }
  })
  return m
}
