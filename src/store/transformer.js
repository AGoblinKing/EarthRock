import { extend } from "/object.js"

import { proto_write, write } from "./write.js"

export const proto_transformer = extend(proto_write, {
	set (value) {
		proto_write.set.call(this, this.transform(value))
		return this
	}
})

export const transformer = (transform) => extend(proto_transformer, {
	...write(),
	transform
})
