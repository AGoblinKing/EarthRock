export * from "/store/derived.js"
export * from "/store/tree.js"
export * from "/store/read.js"
export * from "/store/write.js"
export * from "/store/transformer.js"
export * from "/store/difference.js"

export const listen = (subs, fn) => {
	const call = () =>
		fn(subs.map((s) => s.get()))

	const cancels = subs.map((store) => store.subscribe(call))
	return () => cancels.forEach(fn => fn())
}

export const any = (...stores) => (fn) => {
	const values = stores.map((s) => s.get())
	const cancels = stores.map((store, i) => store.listen(($v, updates) => {
		values[i] = $v
		fn(...values)
	}))

	return () => cancels.forEach((c) => c())
}
