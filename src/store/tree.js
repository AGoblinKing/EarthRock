import { extend, each, map } from "/util/object.js"
import { write } from "./write.js"
import { proto_difference, difference } from "./difference.js"

export const proto_tree = extend(proto_difference, {
	get (name = false) {
		const v = proto_difference.get.call(this)
		if (name === false) return v

		return v[name]
	},

	set (data) {
		proto_difference.set.call(this, map(data)(
			([key, val]) => [
				key,
				this.convert(val)
			])
		)
	},

	convert (value) {
		return (value && typeof value.subscribe === `function`)
			? value
			: this.fn
				? write(this.fn(value))
				: write(value)
	},

	add (data) {
		this.set({
			...this.get(),
			...data
		})

		return this
	},

	// no stores only values
	update (data) {
		const adds = {}

		each(data)(([key, value]) => {
			const v = this.get()

			const vs = v[key]

			if (!vs) {
				adds.key = v
				return
			}

			vs.set(value)
		})

		if (Object.length(adds) > 0) {
			this.add(adds)
		}
	},

	// TODO: Allow multiple removes save on set calls
	remove (channel) {
		const $m = this.get()
		delete $m[channel]
		proto_difference.set.call(this, $m)
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
