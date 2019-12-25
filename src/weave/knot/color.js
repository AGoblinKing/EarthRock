import { read, transformer } from "/util/store.js"
import Color from "color"

export default ({
	value = `#FFFFFF`
}) => ({
	knot: read(`color`),
	value: transformer((val_n) => {
		const c = Color(val_n)
		if (c.red === undefined) return 0xFFFFFF

		return c.red + c.green * 255 + c.blue * 255
	}).set(value)
})
