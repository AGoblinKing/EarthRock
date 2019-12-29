import { map, read, proto_write } from "/util/store.js"
import { extend } from "/util/object.js"

import * as twists from "/weave/twists.js"

const knot = read(`stitch`)

const proto_stitch = {
	destroy () {
		twist.destroy && twist.destroy()
	},

	rez () {
		const $id = this.id.get()

		// already rezed
		if (!this.weave.rezed.get()[$id]) return

		const values = this.value.get()

		this.twists = Object.entries(twists)
			.map(([key, twist]) => {
				const v = values[`!${key}`]
				if (v === undefined) return

				return twists({
					weave: this.weave,
					value: v,
					stitch: this,
					id: this.id.get()
				})
			})
	},

	derez () {
		this.twists.forEach((twist) => {
			twist.derez && twist.derez()
		})
	},

	toJSON () {
		return {
			id: this.id.get(),
			knot: this.knot.get(),
			value: this.value.get()
		}
	}
}

export default ({
	value = {},
	weave
}) => extend(proto_stitch, {
	knot,
	value: map(value),
	weave
})
