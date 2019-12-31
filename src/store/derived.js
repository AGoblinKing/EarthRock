import { read } from "./read.js"

// TODO: Maybe don't need derived?
export const derived = (stores, fn) => read(undefined, (set) => {
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
