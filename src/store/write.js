import { extend } from "/object.js"
import { read, proto_read } from "./read.js"

export const proto_write = extend(proto_read, {
	set (value, silent = false) {
		this.value = value === undefined
			? null
			: value

		if (!silent) this.notify()
	},

	update (fn) {
		this.set(fn(this.value))
	}
})

export const write = (value) => extend(proto_write, read(value))
