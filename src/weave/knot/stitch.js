import { map, read, transformer } from "/util/store.js"
import { random } from "/util/text.js"
import * as twists from "/weave/twists.js"

export default ({
	value = {},
	name = random(2),
	weave,
	id,
	life
}) => {
	const stitch = {
		knot: read(`stitch`),

		value: map(value),

		name: transformer((name_new) => {
			// tell weave it update its knots
			// probably should be on a channel instead
			weave && weave.knots && weave.knots.poke()
			return name_new
		}).set(name)
	}

	life(() => {
		// don't execute commands if not rezed
		if (!weave.rezed.get()[id]) return () => {}

		const values = stitch.value.get()

		const destroys = Object.entries(twists)
			.map(([key, command]) => {
				const v = values[`!${key}`]
				if (v === undefined) return

				return command({
					weave,
					value: v,
					stitch,
					id
				})
			})
			.filter((d) => d)

		return () => {
			destroys.forEach((destroy) => destroy())
		}
	})

	return stitch
}
