import { tree, read } from "/store.js"
import { extend, keys } from "/util/object.js"

import { proto_warp } from "./warp.js"

import * as twists from "/weave/twists.js"

const type = read(`space`)

const proto_space = extend(proto_warp, {
	name () {
		return this.value.get(`!name`)
	},

	create () {
		const values = this.value.get()

		// TODO: should react to twists added/removed as well
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
	},

	chain () {
		const values = this.value.get()
		const id = this.id.get()

		return keys(values).reduce((result, key) => {
			result.push(...this.weave.chain(`${id}/${key}`).slice(0, -1))
			return result
		}, [])
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
