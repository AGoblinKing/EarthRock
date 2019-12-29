// extend an object, allows currying
export const extend = (proto, assign = false) => assign
	? Object.assign(
		Object.create(proto),
		assign
	)
	: (next_assign) => extend(proto, next_assign)
