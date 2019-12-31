import { extend } from "/util/object.js"

export const proto_store = {
	toJSON () {
		return this.value
	}
}

export const store = (value) => extend(proto_store, {
	value
})
