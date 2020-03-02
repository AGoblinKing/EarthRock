import expr from "expr-eval"
import { v3, m4 } from "twgl.js"
import Color from "color-js"

v3.setDefaultType(Array)

const maths = {}
const fns = {}
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
		p = parser.parse(formula)
		maths[formula] = p
	}

	let keys
	return (variables) => {
		if (
			!keys ||
			variables.length !== keys.length ||
			!fns[formula]
		) {
			keys = variables.map(([k]) => k)
			try {
				fns[formula] = p.toJSFunction(keys.join(`,`))
			} catch (ex) {
				console.warn(`math compile error`, ex)
				return
			}
		}

		let result = null
		try {
			result = fns[formula](...variables.map(([_, v]) => v))
		} catch (er) {
			console.warn(`Math script error`, er)
			console.log(variables)
		}

		return result
	}
}
