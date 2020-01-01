import { write, proto_write } from "./write.js"
import { extend, keys } from "/util/object.js"

export const proto_difference = extend(proto_write, {
	get (key = false) {
		const value = proto_write.get.call(this)
		if (key === false) return value

		return value[key]
	},

	set (value) {
		this.value = value

		const { previous } = this
		const modify = []

		this.notify({
			add: keys(value).filter((key) => {
				const is_add = previous[key] === undefined
				if (!is_add && previous[key] !== value[key]) {
					modify.push(key)
				}
				return is_add
			}),
			remove: keys(previous).filter((key) => value[key] === undefined),
			modify,
			previous
		})

		// keys a copy of the previous state for diffing
		this.previous = { ...value }
	},

	subscribe (fn) {
		fn(this.value, {
			add: keys(this.value),
			remove: [],
			modify: [],
			previous: this.value
		})

		return proto_write.subscribe.call(this, fn, true)
	},

	notify (difference) {
		if (!this.subs) return

		// TODO: this skips the speed limit, good? bad?
		this.subs.forEach((fn) => fn(this.value, difference))
	}
})

export const difference = (value = {}) => extend(proto_difference, {
	...write(value),
	previous: { ...value }
})
