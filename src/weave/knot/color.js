import { read, transformer } from "/util/store.js"
import Color from "color"

const update_color = (val_n) => {
	const c = Color(val_n)
	if (c.red === undefined) return 0xFFFFFF

	return c.red + c.green * 255 + c.blue * 255
}

const knot = read(`color`)

export default ({
	value = `#FFFFFF`
}) => ({
	knot,
	value: transformer(update_color).set(value)
})
