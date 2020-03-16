import { m4 } from "twgl.js"
import { Store } from "src/store"

const validate = (thing) => {
	const set = thing.set.bind(thing)
	return (val) => {
		if (!Array.isArray(val)) {
			if (
				val &&
				typeof val[0] === `number` &&
				typeof val[1] === `number` &&
				typeof val[2] === `number`
			) {
				thing.set(val)
				return
			}

			return
		}
		set(val)
	}
}

export const camera = new Store(m4.identity())
export const position = new Store([0, 0, 0])
export const look = new Store([0, 0, -1])

look.set = validate(look)
position.set = validate(position)
