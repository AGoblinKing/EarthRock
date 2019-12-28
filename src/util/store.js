const speed_check = new Set()

// clear the speed check every frame
const enforcer = () => {
	requestAnimationFrame(enforcer)
	speed_check.clear()
}

enforcer()

let i = 0

const writable = (val) => {
	const subs = new Set()

	const w = {
		i: i++,
		// not stored
		type: `JSON`,
		get: () => val,
		poke: () => {
			w.set(w.get())
			return w
		},
		set: (val_new, silent = false) => {
			val = val_new === undefined
				? null
				: val_new

			if (!silent) {
				// delay if already set this frame
				if (speed_check.has(w.i)) {
					requestAnimationFrame(() =>
						subs.forEach((fn) => fn(val))
					)
				} else {
					speed_check.add(w.i)
					subs.forEach((fn) => fn(val))
				}
			}
			return w
		},
		update: (fn) => {
			w.set(fn(val))
			return w
		},
		subscribe: (fn) => {
			subs.add(fn)
			fn(val)
			return () => subs.delete(fn)
		}
	}

	w.toJSON = w.get
	w.listen = w.subscribe

	return w
}

const readable = (val, handler) => {
	const w = writable(val)
	const { set } = w
	w.set = () => console.warn(`tried to write to readable`)
	w.readonly = true
	if (handler) handler(set)
	return w
}

export const write = (thing) => writable(thing)
export const read = (thing, handler) => readable(thing, handler)

export const set = (store, value) => {
	store.set(value)

	return store
}

export const transformer = (transform) => {
	const store = write()

	const set = store.set
	store.set = (update) => {
		set(transform(update))
		return store
	}

	return store
}

export const listen = (subs, fn) => {
	const call = () =>
		fn(subs.map((s) => s.get()))

	const cancels = subs.map((store) => store.subscribe(call))
	return () => cancels.forEach(fn => fn())
}

export const map = (init = {}, fn = false) => {
	const m = write()
	const set_m = m.set

	m.set = (data) => set_m(Object.fromEntries(
		Object.entries(data)
			.map(([key, val]) => [
				key,
				(val && typeof val.subscribe === `function`)
					? val
					: fn
						? write(fn(val))
						: write(val)
			])
	))

	m.add = (channels) => {
		m.set({
			...m.get(),
			...channels
		})
	}

	// no stores only values
	m.update = (data) =>
		Object.entries(data).forEach(([key, value]) => {
			const v = m.get()
			const vs = v[key]
			if (!vs) {
				v[key] = write(value)
				m.set(v)
				return
			}
			vs.set(value)
		})

	m.remove = (channel) => {
		const $m = m.get()
		delete $m[channel]
		set_m($m)
	}

	m.set(init)

	return m
}

// TODO: delete
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
