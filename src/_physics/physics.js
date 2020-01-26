import { each } from "/object.js"
import Velocity from "./_velocity.js"

const handlers = {
	// solve for the next 100ms
	solve (bodies) {
		const updates = {}

		each(bodies)(([id, body]) => {
			// fix defaults
			body.position = body.position || [0, 0, 0]
			body[`!velocity`] = body[`!velocity`] ? body[`!velocity`] : [0, 0, 0]

			body.scale = body.scale || 1

			// default to light mover
			body.mass = typeof body.mass === `number`
				? body.mass
				: 1

			const dirty = Velocity(body, bodies)
			if (!dirty) return

			dirty.forEach((id) => {
				updates[id] = {
					position: bodies[id].position,
					"!velocity": bodies[id][`!velocity`],
					"!collide": bodies[id][`!collide`]
				}
			})
		})

		postMessage({
			type: `solve`,
			bodies: updates
		})
	}
}

onmessage = ({
	data: {
		type,
		data = false
	}
}) => {
	if (!handlers[type]) return

	handlers[type](data)
}
