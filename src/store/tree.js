import { extend, each, map, store_JSON } from "/object.js"
import { write } from "./write.js"
import { proto_difference, difference } from "./difference.js"

export const proto_tree = extend(proto_difference, {
	has (name) {
		return this.get(name) !== undefined
	},

	get (name = false) {
		const v = proto_difference.get.call(this)
		if (name === false) return v

		return v[name]
	},

	set (data, silent = false) {
		const do_set = {
			__proto__: data.__proto__,
			...map(data)(
				([key, val]) => [
					key,
					this.convert(val)
				])

		}
		proto_difference.set.call(this, do_set, silent)
	},

	convert (value) {
		return (value && typeof value.subscribe === `function`)
			? value
			: this.fn
				? write(this.fn(value))
				: write(value)
	},

	add (data, shh) {
		this.set(Object.assign(this.get(), data), shh)

		return this
	},

	// no stores only values
	write (data, shh) {
		const adds = {}

		each(data)(([key, value]) => {
			const values = this.get()

			const value_self = values[key]

			if (!value_self) {
				adds[key] = typeof value === `object` && value !== null && value.get ? value : write(value)
				return
			}

			value_self.set(value)
		})

		if (Object.keys(adds).length > 0) {
			this.add(adds, shh)
		}
	},

	// TODO: Allow multiple removes save on set calls
	remove (channel) {
		const $m = this.get()
		delete $m[channel]
		proto_difference.set.call(this, $m)
	},

	toJSON () {
		return store_JSON(this)
	}
})

export const tree = (init = {}, fn = false) => {
	const m = extend(proto_tree, {
		...difference({}),
		fn
	})

	m.set(init)

	return m
}
