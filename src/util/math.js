import expr from "expr-eval"
import { v3, m4 } from "twgl"

v3.setDefaultType(Array)

export const parser = new expr.Parser({
  in: true,
  assignment: true
})

parser.functions.stop = function () {
  throw new Error(`math stop`)
}

Object.entries(v3).forEach(([key, fn]) => {
  parser.functions[`v3_${key}`] = function (...args) {
    return fn(...args)
  }
})

Object.entries(m4).forEach(([key, fn]) => {
  parser.functions[`m4_${key}`] = function (...args) {
    return fn(...args)
  }
})

export const math = (formula) => {
  const p = parser.parse(formula)

  return (variables) => p.evaluate(variables)
}
