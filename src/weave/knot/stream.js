import { write, read, proto_write } from "/util/store.js"
import { json } from "/util/parse.js"
import { extend } from "/util/object.js"

const knot = read(`stream`)

const proto_stream = extend(proto_write, {
	set (val) {
		try {
			proto_write.set.call(this, json(val))
		} catch (ex) {
			proto_write.set.call(this, val)
		}

		return this
	}
})

export default ({
	value = null
}) => ({
	knot,
	value: extend(proto_stream, write()).set(value)
})
