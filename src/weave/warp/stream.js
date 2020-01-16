import { write, read, proto_write } from "/store.js"
import { json } from "/util/parse.js"
import { extend } from "/object.js"

import { proto_warp } from "./warp.js"

const type = read(`stream`)

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
	id,
	value = null
}) => extend(proto_warp, {
	type,
	value: extend(proto_stream, write()).set(value),
	id: read(id)
})
