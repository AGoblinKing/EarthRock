import { get } from "/weave/wheel.js"
import { transformer } from "/util/store.js"

// try to keep mail safe
export const send = transformer(({
	whom,
	value
}) => {
	let s = get(whom)

	// stitch special case
	if (s.knot && s.knot.get() === `stitch`) {
		// forward stitch mail to a mail channel
		s = get(`${whom}/mail`)
	}

	s.set(value)

	return {
		whom,
		value
	}
})
