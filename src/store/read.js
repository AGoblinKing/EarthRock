import { extend } from "/object.js"
import { proto_store, store } from "./base.js"

const speed_check = new Set()

const clear = () => {
	requestAnimationFrame(clear)
	speed_check.clear()
}

clear()

export const proto_read = extend(proto_store, {
	get () { return this.value },

	notify () {
		if (!this.subs) return

		if (speed_check.has(this)) {
			return requestAnimationFrame(() => {
				if (speed_check.has(this)) return
				this.notify()
			})
		}

		speed_check.add(this)
		this.subs.forEach((s) => s(this.value))
	},

	subscribe (fn, silent = false) {
		if (!this.subs) this.subs = new Set()

		this.subs.add(fn)
		if (!silent) fn(this.value)

		return () => this.subs.delete(fn)
	},

	listen (fn) { return this.subscribe(fn) }
})

export const read = (val, handler) => {
	const r = extend(proto_read, store(val))

	if (handler) {
		handler((v) => {
			r.value = v
			r.notify(v)
		})
	}

	return r
}
