import { decompile, compile } from "/weave/thread.js"
import { extend, keys } from "/object.js"

export default extend({
	grab_script (other, key, right) {
		const weave_other = other.weave
		const other_id = `${other.id.get()}/${key}`
		const c_o = weave_other.chain(other_id, right).slice(0, -1)

		if (c_o.length === 0) return

		const { weave, id, space } = this

		//  we got a chain to clone!
		const code = decompile({
			address: other_id,
			weave: weave_other
		})

		const address = `${id}/${key}`
		const $value = weave_other.get_id(other.id.get())
			.value.get(key).get()

		// don't overwrite existing values
		if (!space.value.has(key)) 	{
			space.value.write({ [key]: $value })
		}

		// compile script later
		requestAnimationFrame(() => {
			this.scripts.push(...compile({
				code,
				weave,
				address,
				right,
				prefix: `&`
			}))
		})
	},

	rez () {
		const { space, weave, value, id } = this
		this.scripts = this.scripts || []

		this.cancel = value.listen(($value) => {
			this.weave.remove(...this.scripts)
			const other = Wheel.get(weave.resolve($value, id))

			if (!other) {
				console.warn(`Invalid other for clone`)
			}

			// allows to reset existing protos
			const proto = other
				? other.value.get()
				: {}

			keys(proto).forEach((key) => {
				this.grab_script(other, key)
				this.grab_script(other, key, true)
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
		this.weave.remove(...this.scripts)
	}

})
