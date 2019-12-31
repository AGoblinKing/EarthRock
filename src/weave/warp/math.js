import { math as math_js } from "/util/math.js"
import { write, read, proto_write } from "/store.js"
import { extend } from "/util/object.js"

import { proto_warp } from "./warp.js"

const noop = () => {}

const bad_variable_characters = /[ .~%!&/^]/g
const regexcape = /[.*+?^${}()|[\]\\]/g

const path_space = /\.\//g
const path_weave = /~\//g
const path_ssh = /\$/g

const escape = (str) =>
	str.replace(regexcape, `\\$&`) // $& means the whole matched string

const type = read(`math`)

const proto_math = extend(proto_warp, {
	run (expression) {
		const matches = expression.match(Wheel.REG_ID)
		const vs = {}
		const leaf = this.weave.chain(this.id.get(), true).shift()
		const s = this.weave.to_address(leaf)

		new Set(matches).forEach((item) => {
			const shh = item[0] === `$`
			const gette = item
				.replace(path_space, `${s}/`)
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
			this.fn = math_js(expression)
			this.values.set(vs)
		} catch (ex) {
			return console.warn(`MATH`, ex)
		}
	},

	rez () {
		this.run(this.math.get())
		this.cancels = new Set()

		this.cancel_vs = this._values.listen((vs) => {
			this.cancels.forEach((cancel) => cancel())
			this.cancels.clear()

			Object.entries(vs).forEach(([key, { k, shh }]) => {
				if (shh) return

				this.cancels.add(k.listen(() => this.value.poke()))
			})
		})

		this.value.set(null)
	},

	derez () {
		this.cancel_vs()
		this.cancels.forEach((cancel) => cancel())
	},

	toJSON () {
		return {
			type: this.type.get(),
			value: this.value.get(),
			math: this.math.get()
		}
	}
})

const proto_math_value = extend(proto_write, {
	set (expression) {
		this.warp.run(expression)
		return expression
	}
})

const proto_value = extend(proto_write, {
	set (val) {
		const vs = this.warp.values.get()
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
			const result = this.warp.fn(params)
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
	weave,
	id
} = false) => {
	const m = extend(proto_math, {
		type,
		values: write({}),
		id: read(id),
		weave,
		fn: noop
	})

	m.value = extend(proto_value, {
		...write(value),
		warp: m
	})

	m.math = extend(proto_math_value, {
		...write(math),
		warp: m
	})

	// do latter once setup
	requestAnimationFrame(() => {
		m.math.set(math)
	})

	return m
}