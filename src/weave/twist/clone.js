import { decompile, compile } from "/thread/thread.js"

import { extend, keys } from "/util/object.js"

const proto_clone = {
	grab_script (other, key) {
		const weave_other = other.weave
		const other_id = `${other.id.get()}/${key}`
		const c_o = weave_other.chain(other_id).slice(0, -1)
		if (c_o.length === 0) return

		const { weave, id, space } = this

		//  we got a chain to clone!
		const code = decompile(other_id, weave_other)
		const addr = `${id}/${key}`

		const $value = weave_other.get_id(other.id.get())
			.value.get(key).get()

		// don't overwrite existing values
		if (!space.value.has(key)) {
			space.value.write({ [key]: $value })
		}

		// compile script later
		requestAnimationFrame(() =>
			compile(code, weave, addr)
		)
	},

	rez () {
		const { space, weave, value, id } = this

		this.cancel = value.listen(($value) => {
			const other = Wheel.get(weave.resolve($value, id))

			if (!other) {
				console.warn(`Invalid other for clone`)
			}

			const proto = other
				? other.value.get()
				: {}

			keys(proto).forEach((key) => {
				this.grab_script(other, key)
			})

			// set proto
			space.set({
				...space.get(),
				__proto__: proto
			}, true)
		})
	},

	derez () {
		this.cancel()

		// remove proto
		this.space.set({
			...this.space.get()
		}, true)

		// leave the scripts sadly
	}

}

export default extend(proto_clone)
