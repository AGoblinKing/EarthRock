import { proto_warp } from "./warp.js"
import { extend } from "/object.js"

import { read, transformer } from "/store.js"
import Color from "color"

const update_color = (val_n) => {
	const c = Color(val_n)
	if (c.red === undefined) return 0xFFFFFF

	return c.red + c.green * 255 + c.blue * 255
}

const type = read(`color`)

export default ({
	value = `#FFFFFF`,
	id
}) => extend(proto_warp, {
	type,
	value: transformer(update_color).set(value),
	id: read(id)
})
