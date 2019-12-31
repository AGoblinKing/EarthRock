import { get } from "/weave/wheel.js"
import { transformer } from "/store.js"

// try to keep mail safe
export const send = transformer(({
	whom,
	value
}) => {
	let s = get(whom)

	// space special case
	if (s.warp && s.warp.get() === `space`) {
		// forward space mail to a mail channel
		s = get(`${whom}/mail`)
	}

	s.set(value)

	return {
		whom,
		value
	}
})
