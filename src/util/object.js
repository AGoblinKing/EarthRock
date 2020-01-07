// extend an object, allows currying
export const extend = (proto, assign = false) => assign
	? {
		__proto__: proto,
		...assign
	}
	: (next_assign) => extend(proto, next_assign)

export const map = (obj) => (fn) => Object.fromEntries(
	Object.entries(obj).reduce((result, [key, value]) => {
		const entry = fn([key, value])

		if (entry) result.push(entry)

		return result
	}, [])
)

export const each = (obj) => (fn) =>
	Object.entries(obj).forEach(fn)

export const reduce = (obj) => (fn, def) =>
	Object.entries(obj).reduce(fn, def)

export const keys = Object.keys
export const entries = Object.entries
export const values = Object.values
export const assign = (obj) => (...next) => Object.assign(obj, ...next)

export const store_JSON = (store) => reduce(store.get())(
	(result, [key, thing]) => {
		if (key[0] === `&`) return result

		result[key] = thing.toJSON()

		return result
	}
	, {})
