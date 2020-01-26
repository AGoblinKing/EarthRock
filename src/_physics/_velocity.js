import { v3 } from "twgl.js"
import { values } from "/object.js"

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

const tick_velocity = (body) => v3.add(body.position, body[`!velocity`], body.position)

const flip_vel = (body, body_other) => {
	const diff = v3.subtract(body.position, body_other.position)
	if (Math.abs(diff[0]) > Math.abs(diff[1])) {
		body[`!velocity`][0] = -body[`!velocity`][0]
	} else {
		body[`!velocity`][1] = -body[`!velocity`][1]
	}
}
export default (body, bodies) => {
	// for things like gravity
	if (body.mass > 0 && body[`!force`] && Array.isArray(body[`!force`])) {
		// v3.add(body[`!velocity`], body[`!force`], body[`!velocity`])
	}

	const length = 	v3.length(body[`!velocity`])

	if (
		// bad velocity
		Array.isArray(body[`!velocity`]) === false ||
		// 0 mass things don't move ever
		body.mass === 0 ||
		// too slow to bother
		length < MIN ||
		length === Infinity
	) {
		return
	}

	let decay = DECAY
	decay = body.mass >= 0 ? decay * body.mass : decay / Math.abs(body.mass)

	tick_velocity(body)

	v3.mulScalar(body[`!velocity`], decay, body[`!velocity`])

	const dirty = [body.id]

	// ghost~~~
	if (!body[`!real`]) {
		return dirty
	}

	const interactions = new Set()

	const later = []

	// check for collision now that we moved
	// naive check all colliders
	// absorb some of the impact and bounce them
	values(bodies).forEach((body_other) => {
		if	(
			// prevent double interactions
			interactions.has(`${body_other.id}_${body.id}`) ||
			!intersect(body, body_other)
		) return

		body[`!collide`] = body_other.id
		interactions.add(`${body.id}_${body_other.id}`)

		// absorb/reflect some velocity
		if (body_other.mass === 0) return
		const transfer = v3.mulScalar(v3.subtract(body[`!velocity`], body_other[`!velocity`]), 0.5)

		later.push(() => {
		// bounce other
			v3.add(
				body_other[`!velocity`],
				transfer,
				body_other[`!velocity`]
			)

			// conserve energy
			v3.add(
				body[`!velocity`],
				v3.negate(transfer),
				body[`!velocity`]
			)

			tick_velocity(body_other)
		})

		dirty.push(body_other.id)

		flip_vel(body, body_other)
	})

	later.forEach((fn) => fn())
	return dirty
}
