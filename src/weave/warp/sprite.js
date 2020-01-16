import { read, write } from "/store.js"
import { proto_warp } from "./warp.js"
import { extend } from "/object.js"

const type = read(`sprite`)

export default ({
	value = 0,
	id
}) => extend(proto_warp, {
	type,
	value: write(value),
	id: read(id)
})
