import { v3 } from "twgl.js"
import { each } from "/object.js"

// rate of decay
const DECAY = 0.9
const MIN = 0.01

const intersect = (a, b) => {
	if (
		// can't collide yoself
		a.id === b.id ||
		!b[`!real`] ||
		!a[`!real`]
	) return false

	const [a_half, b_half] = [a.scale / 2 * 0.9, b.scale / 2 * 0.9]

	return (
		a.position[0] - a_half <= b.position[0] + b_half && a.position[0] + a_half >= b.position[0] - b_half
	) && (
		a.position[1] - a_half <= b.position[1] + b_half && a.position[1] + a_half >= b.position[1] - b_half
	) && (
		a.position[2] - a_half <= b.position[2] + b_half && a.position[2] + a_half >= b.position[2] - b_half
	)
}

export default (body, bodies) => {
	// for things like gravity
	if (body.mass > 0 && body[`!force`] && Array.isArray(body[`!force`])) {
		v3.add(body[`!velocity`], body[`!force`], body[`!velocity`])
	}

	if (
		// bad velocity
		Array.isArray(body[`!velocity`]) === false ||
		// 0 mass things don't move ever
		body.mass === 0 ||
		// too slow to bother
		v3.length(body[`!velocity`]) < MIN
	) {
		return
	}

	let decay = DECAY
	decay = body.mass >= 0 ? decay * body.mass : decay / Math.abs(body.mass)

	v3.add(body.position, body[`!velocity`], body.position)
	v3.mulScalar(body[`!velocity`], decay, body[`!velocity`])

	// ghost~~~
	if (!body[`!real`]) {
		return
	}

	// check for collision now that we moved
	// naive check all colliders
	// absorb some of the impact and bounce them

	each(bodies)(([_, body_other]) => {
		if	(intersect(body, body_other)) {
			body[`!collide`] = body_other.id

			// absorb/reflect some velocity
			if (body_other.mass > 0) {
				// bounce other
				v3.add(
					body_other[`!velocity`],
					v3.mulScalar(body[`!velocity`], 0.5),
					body_other[`!velocity`]
				)
			}

			const diff = v3.subtract(body.position, body_other.position)

			// undo last move
			v3.subtract(body.position, body[`!velocity`], body.position)

			if (Math.abs(diff[0]) > Math.abs(diff[1])) {
				body[`!velocity`][0] = -body[`!velocity`][0]
			} else {
				body[`!velocity`][1] = -body[`!velocity`][1]
			}
		}
	})
}
