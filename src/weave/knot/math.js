import { math as math_js } from "/util/math.js"
import { write, read, proto_write } from "/util/store.js"
import { extend } from "/util/object.js"

const noop = () => {}

const bad_variable_characters = /[ .~%!&/^]/g
const regexcape = /[.*+?^${}()|[\]\\]/g

const path_stitch = /\.\//g
const path_weave = /~\//g
const path_ssh = /\$/g

const escape = (str) =>
	str.replace(regexcape, `\\$&`) // $& means the whole matched string

const knot = read(`math`)

const proto_math = {
	_math_run (expression) {
		const matches = expression.match(Wheel.REG_ID)
		const vs = {}
		const leaf = this.weave.chain(this.id.get(), true).shift()
		const s = this.weave.to_address(leaf)

		new Set(matches).forEach((item) => {
			const shh = item[0] === `$`
			const gette = item
				.replace(path_stitch, `${s}/`)
				.replace(path_weave, `/${this.weave.name.get()}/`)
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
			this._math_fn = math_js(expression)
			this._values.set(vs)
		} catch (ex) {
			return console.warn(`MATH`, ex)
		}
	},

	rez () {
		this._math_run(this.math.get())
		this._cancels = new Set()

		this._cancel_vs = this._values.listen((vs) => {
			this._cancels.forEach((cancel) => cancel())
			this._cancels.clear()

			Object.entries(vs).forEach(([key, { k, shh }]) => {
				if (shh) return

				this._cancels.add(k.listen(() => this.value.poke()))
			})
		})

		this.value.set(null)
	},

	derez () {
		this._cancel_vs()
		this._cancels.forEach((cancel) => cancel())
	},

	toJSON () {
		return {
			id: this.id.get(),
			knot: this.knot.get(),
			value: this.value.get(),

			math: this.math.get()
		}
	}
}

const proto_math_parse = extend(proto_write, {
	set (expression) {
		this.math._math_run(expression)
		return expression
	}
})

const proto_value_math = extend(proto_write, {
	set (val) {
		const vs = this._math.values.get()
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
			const result = this._math.math_fn(params)
			proto_write.set.call(this, result)
		} catch (ex) {
			console.warn(`math error`, ex)
		}

		return this
	}
})

export default ({
	math = `2+2`,
	value,
	weave
} = false) => {
	const m = extend(proto_math, {
		knot,
		weave,
		_math_fn: noop,
		_values: write({})
	})

	m.value = extend(proto_value_math, {
		...write({}),
		math: m
	}).set(value)

	m.math = extend(proto_math_parse, {
		...write(``),
		math: m
	}).set(math)

	return m
}
