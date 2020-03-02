export type TreeValue = Map<string, any>

export class Tree extends Store {
	protected last: TreeValue
	protected value: TreeValue

	constructor(value: TreeValue) {
		super(value)
	}

	set (value: any, silent = false ) {
		
	}

	get (name?: string) {
		const $value = super.get()
		if (name === undefined) return $value

		return $value[name]
	}

	has (name: string) : boolean {
		return this.get(name) !== undefined
	}


}

export const proto_tree = extend(proto_difference, {
	set (data, silent = false) {
		const do_set = {
			__proto__: data.__proto__,
			...map(data)(
				([key, val]) => [
					key,
					this.convert(val)
				])

		}
		proto_difference.set.call(this, do_set, silent)
	},

	convert (value) {
		return (value && typeof value.subscribe === `function`)
			? value
			: this.fn
				? write(this.fn(value))
				: write(value)
	},

	add (data, shh) {
		this.set(Object.assign(this.get(), data), shh)

		return this
	},

	// no stores only values
	write (data, shh) {
		const adds = {}

		each(data)(([key, value]) => {
			const values = this.get()

			const value_self = values[key]

			if (!value_self) {
				adds[key] = typeof value === `object` && value !== null && value.get ? value : write(value)
				return
			}

			value_self.set(value)
		})

		if (Object.keys(adds).length > 0) {
			this.add(adds, shh)
		}
	},

	// TODO: Allow multiple removes save on set calls
	remove (channel) {
		const $m = this.get()
		delete $m[channel]
		proto_difference.set.call(this, $m)
	},

	toJSON () {
		return store_JSON(this)
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

import { write, proto_write } from "./write.js"
import { extend, keys } from "/object.js"
import { Store } from "./store.js"

export const proto_difference = extend(proto_write, {
	get (key = false) {
		const value = proto_write.get.call(this)
		if (key === false) return value

		return value[key]
	},

	set (value, silent = false) {
		this.value = value

		const { previous } = this
		const modify = []

		if (!silent) {
			this.notify({
				add: keys(value).filter((key) => {
					const is_add = previous[key] === undefined
					if (!is_add && previous[key] !== value[key]) {
						modify.push(key)
					}
					return is_add
				}),
				remove: keys(previous).filter((key) => value[key] === undefined),
				modify,
				previous
			})
		}

		// keys a copy of the previous state for diffing
		this.previous = {
			__proto__: value.__proto__,
			...value
		}
	},

	subscribe (fn) {
		fn(this.value, {
			add: keys(this.value),
			remove: [],
			modify: [],
			previous: this.value
		})

		return proto_write.subscribe.call(this, fn, true)
	},

	notify (difference) {
		if (!this.subs || !difference) return

		// TODO: this skips the speed limit, good? bad?
		this.subs.forEach((fn) => fn(this.value, difference))
	}
})

export const difference = (value = {}) => extend(proto_difference, {
	...write(value),
	previous: { ...value }
})
