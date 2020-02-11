import { tree, read } from "/store.js"
import { extend, keys, each, assign } from "/object.js"

import { proto_warp } from "./warp.js"

import * as twists from "/weave/twists.js"

const string_nothing = read(``)

const type = read(`space`)

const proto_space = extend(proto_warp, {
	address () {
		return `${this.weave.name.get()}/${this.name().get() || this.id.get()}`
	},

	name () {
		return this.value.get(`!name`) || string_nothing
	},

	create () {
		const id = this.id.get()
		this.twists = {}

		this.cancel = this.value.listen(($value, { add, remove }) => {
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
				this.weave.remove(...this.weave.chain(`${id}/${key}`).slice(0, -1))
				this.weave.remove(...this.weave.chain(`${id}/${key}`, true).slice(0, -1))

				if (!twist) return

				if (this.rezed && twist.derez) twist.derez()
				twist.destroy && twist.destroy()

				delete this.twists[key]
			})
		})
	},

	remove (...keys) {
		const $space = this.value.get()
		keys.forEach((key) => {
			delete $space[key]
		})
		this.value.set($space)
	},

	destroy () {
		this.cancel()

		each(this.twists)(([_, twist]) => {
			if (this.rezed && twist.derez) twist.derez()
			twist.destroy && twist.destroy()
		})

		this.twists = {}
	},

	rez () {
		this.rezed = true

		each(this.twists)(([_, twist]) => {
			twist.rez && twist.rez()
		})
	},

	derez () {
		this.rezed = false

		each(this.twists)(([_, twist]) => {
			twist.derez && twist.derez()
		})
	},

	chain () {
		const values = this.value.get()
		const id = this.id.get()

		return keys(values).reduce((result, key) => {
			result.push(
				...this.weave.chain(`${id}/${key}`).slice(0, -1),
				...this.weave.chain(`${id}/${key}`, true).slice(1)
			)
			return result
		}, [])
	},

	get (key) {
		return this.value.get(key)
	},

	gets (...keys) {
		return keys.reduce((result, key) => {
			result[key] = this.get(key)
			return result
		}, {})
	},

	get_value (key) {
		const v = this.value.get(key)

		if (!v) return
		return v.get()
	},

	get_values (...keys) {
		return keys.reduce((result, key) => {
			result[key] = this.get_value(key)
			return result
		}, {})
	},

	write (update, shh) {
		return this.value.write(update, shh)
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
