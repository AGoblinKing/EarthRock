import { tree, read } from "/store.js"
import { extend } from "/util/object.js"

import { proto_warp } from "./warp.js"

import * as twists from "/weave/twists.js"

const type = read(`space`)

const proto_space = extend(proto_warp, {
	name () {
		return this.value.get(`!name`)
	},

	create () {
		const values = this.value.get()

		this.twists = Object.entries(twists)
			.map(([key, twist]) => {
				const v = values[`!${key}`]
				if (v === undefined) return

				const t = twist({
					weave: this.weave,
					value: v,
					space: this,
					id: this.id.get()
				})

				t.create && t.create()

				return t
			})
			.filter((i) => i)
	},

	destroy () {
		this.twists.forEach((twist) => twist.destroy && twist.destroy())
	},

	rez () {
		this.twists.forEach((twist) => {
			twist.rez && twist.rez()
		})
	},

	derez () {
		this.twists.forEach((twist) => {
			twist.derez && twist.derez()
		})
	}
})

export default ({
	id,
	value = {},
	weave
}) => extend(proto_space, {
	type,
	value: tree(value),
	id: read(id),
	weave
})
