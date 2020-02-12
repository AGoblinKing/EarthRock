import expr from "expr-eval"
import { v3, m4 } from "twgl"
import Color from "color"

v3.setDefaultType(Array)

const maths = {}

export const parser = new expr.Parser({
	in: true,
	assignment: true
})

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

parser.functions.Color = Color

export const math = (formula) => {
	let p = maths[formula]

	if (!p) {
		maths[formula] = p = parser.parse(formula)
	}

	let fn
	let fn_vars

	return (variables) => {
		if (
			!fn ||
      Object.keys(variables).length !== fn_vars.length
		) {
			fn_vars = Object.keys(variables)
			fn = p.toJSFunction(fn_vars.join(`,`))
		}

		try {
			fn(...fn_vars.map((key) => variables[key]))
		} catch (er) {
			console.wa`rn(`Math script error`, er)
			console.log(variables)
		}

		return variables.return
	}
}
