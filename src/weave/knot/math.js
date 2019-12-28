import { math as math_js } from "/util/math.js"
import { write, read, transformer } from "/util/store.js"

const bad_variable_characters = /[ .~%!&/^]/g
const regexcape = /[.*+?^${}()|[\]\\]/g

const path_stitch = /\.\//g
const path_weave = /~\//g
const path_ssh = /\$/g

const escape = (str) =>
	str.replace(regexcape, `\\$&`) // $& means the whole matched string

export default ({
	math = `2+2`,
	value,
	weave,
	life,
	id
} = false) => {
	let math_fn = () => {}

	const values = write({})

	const math_run = (expression) => requestAnimationFrame(() => {
		const matches = expression.match(Wheel.REG_ID)
		const vs = {}
		const leaf = weave.chain(id, true).shift()
		const s = weave.to_address(leaf)

		new Set(matches).forEach((item) => {
			const shh = item[0] === `$`
			const gette = item
				.replace(path_stitch, `${s}/`)
				.replace(path_weave, `/${weave.name.get()}/`)
				.replace(path_ssh, ``)
				.trim()

			const k = Wheel.get(gette)
			const name = gette.replace(bad_variable_characters, `z`)

			expression = expression.replace(
				new RegExp(escape(item), `g`),
				name
			)

			if (!k) {
				vs[name] = {
					k: {
						toJSON: () => null
					},
					shh: true
				}
				return
			}

			vs[name] = {
				k,
				shh
			}
		})

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

		const params = {
			...Object.fromEntries(Object.entries(vs).map(
				([key, { k }]) => [key, k.toJSON() === undefined
					? null
					: k.toJSON()
				]
			)),
			value: val,
			flock: 0

		}

		try {
			const result = math_fn(params)
			set(result)
			return m.value
		} catch (ex) {
			console.warn(`math error`, ex)
		}
	}
	m.math.set(math)

	life(() => {
		math_run(m.math.get())
		const cancels = new Set()

		const cancel_vs = values.listen((vs) => {
			cancels.forEach((cancel) => cancel())
			cancels.clear()

			Object.entries(vs).forEach(([key, { k, shh }]) => {
				if (shh) return

				cancels.add(k.listen(m.value.poke))
			})
		})

		m.value.set(null)

		return () => {
			cancel_vs()
			cancels.forEach((cancel) => cancel())
		}
	})

	return m
}
