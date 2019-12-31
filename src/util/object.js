// extend an object, allows currying
export const extend = (proto, assign = false) => assign
	? Object.assign(
		Object.create(proto),
		assign
	)
	: (next_assign) => extend(proto, next_assign)

export const map = (obj) => (fn) => Object.fromEntries(
	Object.entries(obj).map(fn)
)

export const each = (obj) => (fn) =>
	Object.entries(obj).forEach(fn)

export const reduce = (obj) => (fn, def) =>
	Object.entries(obj).reduce(fn, def)

export const keys = Object.keys
export const entries = Object.entries
export const values = Object.values
