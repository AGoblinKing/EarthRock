import { write, proto_write } from "./write.js"
import { extend, keys } from "/util/object.js"

export const proto_difference = extend(proto_write, {
	set (value) {
		const prev = this.value
		this.value = value

		this.notify({
			add: keys(value).filter((k) => !prev[k]),
			remove: keys(prev).filter((k) => !value[k]),
			previous: prev
		})
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

export const difference = (value = {}) => extend(proto_difference, write(value))
