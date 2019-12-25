import { m4 } from "twgl"
import { write } from "/util/store.js"

const validate = ({ set }) => (val) => {
	if (!Array.isArray(val)) {
		if (
			val &&
      typeof val[0] === `number` &&
      typeof val[1] === `number` &&
      typeof val[2] === `number`
		) {
			set(val)
			return
		}

		return
	}
	set(val)
}

export const camera = write(m4.identity())
export const position = write([0, 0, 0])
export const look = write([0, 0, -1])

look.set = validate(look)
position.set = validate(position)
