import { write, proto_write } from "./write.js"
import { extend, keys } from "/util/object.js"

export const proto_difference = extend(proto_write, {
	get (key = false) {
		const value = proto_write.get.call(this)
		if (key === false) return value

		return value[key]
	},

	set (value) {
		const prev = this.prev

		this.value = value

		this.notify({
			add: keys(value).filter((k) => prev[k] === undefined),
			remove: keys(prev).filter((k) => value[k] === undefined),
			previous: prev
		})

		// keys a copy of the previous state for diffing
		this.prev = { ...value }
	},

	subscribe (fn) {
		fn(this.value, {
			add: keys(this.value),
			remove: [],
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
	prev: { ...value }
})
