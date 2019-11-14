import expr from "expr-eval"

const parser = new expr.Parser()

export const math = (formula, variables) => {
  return parser.parse(formula).evaluate(variables)
}
