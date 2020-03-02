// export * from "./tree"
export * from "./store"

import { Store } from "./store"

export type Listeners = (value: Array<any>) => void

export const listens = (stores: Array<Store>, listener: Listeners) => {
	const call = () =>
		listener(stores.map((store) => store.get()))

	const cancels = stores.map((store) => store.listen(call))
	return () => cancels.forEach(cancel => cancel())
}

export const any = (...stores: Array<Store>) => (listener) => {
	const values = stores.map((store) => store.get())
	const cancels = stores.map((store, i) => store.listen(($value) => {
		values[i] = $value
		listener(...values)
	}))

	return () => cancels.forEach((cancel) => cancel())
}
