import { math as math_js } from "/util/math.js"
import { write, read, transformer } from "/util/store.js"

const re_id = /\$?\.?\/[a-zA-Z \/]+/g
const whitespace = /[ .]/g

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

  const math_run = (expression) => requestAnimationFrame(() => {
    const matches = expression.match(re_id)
    const vs = {}

    new Set(matches).forEach((item) => {
      const shh = item[0] === `$`
      const gette = item
        .replace(`.`, `/${weave.name.get()}`)
        .replace(`$`, ``)
        .trim()

      const k = Wheel.get(gette)
      const name = gette.replace(whitespace, ``).replace(re_var, ``)

      if (!k) {
        vs[name] = {
          k: {
            toJSON: () => null
          },
          shh: true
        }
        return
      }

      expression = expression.replace(
        new RegExp(escape(item), `g`),
        name
      )
      vs[name] = {
        k,
        shh
      }
    })

    // also wtf dont recompile expression each time
    try {
      math_fn = math_js(expression)
      values.set(vs)
    } catch (ex) {
      return console.warn(`MATH`, ex)
    }
  })

  const m = ({
    knot: read(`math`),
    math: transformer((expression) => {
      math_run(expression)
      return expression
    }),
    value: write(value)
  })

  const set = m.value.set
  m.value.set = (val) => {
    const vs = values.get()
    val = val === undefined
      ? null
      : val

    const result = math_fn({
      ...Object.fromEntries(Object.entries(vs).map(
        ([key, { k }]) => [key, k.toJSON() === undefined
          ? null
          : k.toJSON()
        ]
      )),
      v: val
    })
    set(result)
    return m.value
  }
  m.math.set(math)
  life(() => {
    math_run(m.math.get())
    const cancels = new Set()
    //
    const cancel_vs = values.listen((vs) => {
      cancels.forEach((cancel) => cancel())
      cancels.clear()

      Object.entries(vs).forEach(([key, { k, shh }]) => {
        if (shh) return

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
