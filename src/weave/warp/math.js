import { math as math_js } from "/util/math.js"
import { write, read, proto_write } from "/store.js"
import { extend } from "/object.js"

import { proto_warp } from "./warp.js"

const noop = () => {}

const bad_variable_characters = /[ .~%!&/^]/g

// for creating searches
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

			const warp = Wheel.get(gette)

			// not an id or invalid
			if (!warp) return

			const name = item
				.replace(path_space, `dot`)
				.replace(path_weave, `weave`)
				.replace(bad_variable_characters, `z`)

			expression = expression.replace(
				new RegExp(escape(item), `g`),
				name
			)

			vs[name] = {
				warp,
				shh
			}
		})

		try {
			this.fn = math_js(expression)
			this.values.set(vs)
		} catch (ex) {
			// TODO: Alert user of math error here
			// console.warn(`MATH`, ex)
		}
	},

	rez () {
		this.run(this.math.get())
		this.cancels = new Set()

		this.cancel_vs = this.values.listen((vs) => {
			this.cancels.forEach((cancel) => cancel())
			this.cancels.clear()

			Object.entries(vs).forEach(([key, { warp, shh }]) => {
				if (shh) return

				this.cancels.add(warp.listen(() => {
					this.value.set(this.value.last)
				}))
			})
		})
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
	set (value) {
		this.last = value

		const vs = this.warp.values.get()
		value = value === undefined
			? null
			: value

		const params = {
			...Object.fromEntries(Object.entries(vs).map(
				([key, { warp }]) => [key, warp.toJSON() === undefined
					? null
					: warp.toJSON()
				]
			)),
			value
		}

		try {
			const result = this.warp.fn(params)
			proto_write.set.call(this, result)
		} catch (ex) {
			if (ex.message !== `stop`) console.warn(`math error`, ex)
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
