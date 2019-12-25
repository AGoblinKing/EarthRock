import { write, read } from "/util/store.js"
import { json } from "/util/parse.js"

export default ({
	value = null
}) => {
	const v = write()
	const set = v.set

	v.set = (val) => {
		try {
			set(json(val))
		} catch (ex) {
			set(val)
		}
	}

	v.set(value)
	return ({
		knot: read(`stream`),
		value: v
	})
}
