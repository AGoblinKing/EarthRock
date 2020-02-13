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

const lookup = {}

const proto_math = extend(proto_warp, {
	run (expression) {
		const matches = expression.match(Wheel.REG_ID)
		const vs = {}

		const leaf = this.weave.chain(this.id.get(), true)
			.filter((k) => k.indexOf(Wheel.DENOTE) !== -1).pop()

		let space_addr
		if (leaf) space_addr = this.weave.to_address(leaf)

		// nad address
		if (!space_addr) return

		const space = Wheel.get(space_addr)

		if (space.type.get() !== `space`) {
			const leaf_right = this.weave.chain(this.id.get())
				.filter((k) => k.indexOf(Wheel.DENOTE) !== -1).pop()
			space_addr = this.weave.to_address(leaf_right)
		}

		let fail
		new Set(matches).forEach((item) => {
			const shh = item[0] === `$`
			const gette = item
				.replace(path_space, `${space_addr}${Wheel.DENOTE}`)
				.replace(path_weave, `${Wheel.DENOTE}${this.weave.name.get()}${Wheel.DENOTE}`)
				.replace(path_ssh, ``)
				.trim()

			const warp = Wheel.get(gette)
			if (!warp) {
				fail = true
				return
			}

			const name = item
				.replace(path_space, `dot`)
				.replace(path_weave, `weave`)
				.replace(bad_variable_characters, `z`)

			lookup[name] = item

			expression = expression.replace(
				new RegExp(escape(item), `g`),
				name
			)

			vs[name] = {
				warp,
				shh
			}
		})

		if (fail) return

		try {
			this.fn = math_js(expression)

			this.values.set(vs)
		} catch (ex) {
			// TODO: Alert user of math error here
			console.warn(`Math parse error`, ex)
		}
	},

	rez () {
		requestAnimationFrame(() => {
			this.run(this.math.get())
		})

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
			this.value.set(this.value.last)
		})	// do latter once setup
	},

	derez () {
		this.cancel_vs()
		this.cancels.forEach((cancel) => cancel())
	},

	toJSON () {
		return {
			type: this.type.get(),
			value: null,
			math: this.math.get()
		}
	}
})

const proto_math_value = extend(proto_write, {
	set (expression, silent) {
		proto_write.set.call(this, expression, silent)
		if (!silent) this.warp.run(expression)
	}
})

const proto_value = extend(proto_write, {
	set (value, silent) {
		this.last = value

		const vs = this.warp.values.get()
		value = value === undefined
			? null
			: value

		const params = Object.entries(vs).map(
			([key, { warp }]) =>
				[
					key,
					warp.toJSON() === undefined
						? null
						: warp.toJSON()
				]
		)

		params.push([`value`, value])
		const result = this.warp.fn(params)

		// null or undefined means do nothing
		if (result === null || result === undefined) return

		requestAnimationFrame(() => {
			proto_write.set.call(this, result)
		})
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

	requestAnimationFrame(() => m.math.set(math, true))

	return m
}
