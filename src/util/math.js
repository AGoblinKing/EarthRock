import expr from "expr-eval"
import { v3, m4 } from "twgl"
import Color from "color"

v3.setDefaultType(Array)

const maths = {}

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

parser.functions.Color = Color

export const math = (formula) => {
	let p = maths[formula]

	if (!p) {
		p = parser.parse(formula)
		maths[formula] = p
	}

	return (variables) => p.evaluate(variables)
}
