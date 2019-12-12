import expr from "expr-eval"

export const parser = new expr.Parser({
  in: true,
  assignment: true
})

export const math = (formula) => {
  const p = parser.parse(formula)

  return (variables) => p.evaluate(variables)
}

// math m = /sys/mouse/position; i = ./something/position; i[0] + m[0]
