import { tree, read } from "/store.js"
import { extend, keys, each, assign } from "/util/object.js"

import { proto_warp } from "./warp.js"

import * as twists from "/weave/twists.js"

const string_nothing = read(``)

const type = read(`space`)

const proto_space = extend(proto_warp, {
	name () {
		return this.value.get(`!name`) || string_nothing
	},

	create () {
		this.twists = {}

		this.listen_value = this.value.listen(
			($value, { add, remove }) => {
				assign(this.twists)(
					add.reduce((result, key) => {
						// ignore !
						const Twist = twists[key.slice(1)]
						if (Twist === undefined) return result

						const twist = Twist({
							weave: this.weave,
							value: $value[key],
							space: this,
							id: this.id.get()
						})

						twist.create && twist.create()

						if (this.rezed && twist.rez) {
							// delay
							requestAnimationFrame(() => twist.rez())
						}

						result[key] = twist

						return result
					}, {})
				)

				remove.forEach((key) => {
					const twist = this.twists[key]
					if (!twist) return

					if (this.rezed && twist.derez) twist.derez()
					twist.destroy && twist.destroy()

					delete this.twists[key]
				})
			})
	},

	destroy () {
		this.listen_value()

		each(this.twists)(([_, twist]) => {
			if (this.rezed && twist.derez) twist.derez()
			twist.destroy && twist.destroy()
		})

		this.twists = {}
	},

	rez () {
		this.rezed = true
		this.weave.spaces.update(($spaces) => {
			$spaces.set(this.id.get(), this)

			return $spaces
		})

		each(this.twists)(([_, twist]) => {
			twist.rez && twist.rez()
		})
	},

	derez () {
		this.rezed = false
		this.weave.spaces.update(($spaces) => {
			$spaces.delete(this.id.get())

			return $spaces
		})

		each(this.twists)(([_, twist]) => {
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
