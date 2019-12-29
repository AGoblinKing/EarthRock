import { extend } from "/util/object.js"

const speed_check = new Set()

// clear the speed check every frame
const enforcer = () => {
	requestAnimationFrame(enforcer)
	speed_check.clear()
}

enforcer()

let i = 0

export const proto_write = {
	set (value_new, silent = false) {
		this._value = value_new === undefined
			? null
			: value_new

		if (!silent) {
			// delay if already set this frame
			if (speed_check.has(this._i)) {
				requestAnimationFrame(() =>
					this._subs.forEach((fn) => fn(this._value))
				)
			} else {
				speed_check.add(this._i)
				this._subs.forEach((fn) => fn(this._value))
			}
		}

		return this
	},

	update (fn) { this.set(fn(this._value)) },

	poke () { return this.set(this.get()) },

	get () { return this._value },
	toJSON () { return this._value },

	subscribe (fn) {
		this._subs.add(fn)
		fn(this._value)

		return () => this._subs.delete(fn)
	},

	listen (fn) { return this.subscribe(fn) }
}

const writable = (val) => extend(proto_write, {
	_i: i++,
	_subs: new Set(),
	_value: val
})

export const proto_read = extend(proto_write, {
	set () {
		throw new Error(`tried to write to readable`)
	},
	readonly: true
})

const readable = (val, handler) => {
	const w = extend(proto_read, writable(val))
	const set = proto_write.set.bind(w)
	if (handler) handler(set)

	return w
}

export const write = writable

export const read = (thing, handler) => readable(thing, handler)

export const proto_transformer = extend(proto_write, {
	set (value) {
		proto_write.set.call(this, this._transform(value))
		return this
	}
})

export const transformer = (transform) => extend(proto_transformer, {
	...write(),
	_transform: transform
})

export const listen = (subs, fn) => {
	const call = () =>
		fn(subs.map((s) => s.get()))

	const cancels = subs.map((store) => store.subscribe(call))
	return () => cancels.forEach(fn => fn())
}

export const proto_map = Object.assign(
	Object.create(proto_write),
	{
		set (data) {
			proto_write.set.call(this, Object.fromEntries(
				Object.entries(data)
					.map(([key, val]) => [
						key,
						(val && typeof val.subscribe === `function`)
							? val
							: this._fn
								? write(this._fn(val))
								: write(val)
					])
			))
		},

		add (channels) {
			this.set({
				...this.get(),
				...channels
			})

			return this
		},

		// no stores only values
		update (data) {
			Object.entries(data).forEach(([key, value]) => {
				const v = this.get()

				const vs = v[key]

				if (!vs) {
					v[key] = this._fn
						? write(this._fn(value))
						: write(value)

					proto_write.set.call(this, v)
					return
				}

				vs.set(value)
			})
		},

		remove (channel) {
			const $m = this.get()
			delete $m[channel]
			proto_write.set.call(this, $m)
		}
	}
)

export const map = (init = {}, fn = false) => {
	const m = Object.assign(
		Object.create(proto_map),
		{
			...writable({}),
			_fn: fn
		}
	)

	m.set(init)

	return m
}

// TODO: Maybe don't need derived?
export const derived = (stores, fn) => readable(undefined, (set) => {
	stores = Array.isArray(stores)
		? stores
		: [stores]

	const cancels = stores.map(
		(store) =>
			store.listen(() =>
				set(fn(stores.map((s) => s.get())))
			)
	)

	return cancels
})

export const any = (...stores) => (fn) => {
	const values = stores.map((s) => s.get())

	const cancels = stores.map((store, i) => store.listen(($v) => {
		values[i] = $v
		fn(...values)
	}))

	return () => cancels.forEach((c) => c())
}
