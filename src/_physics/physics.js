import { map } from "/object.js"
import Velocity from "./_velocity.js"

const handlers = {
	// solve for the next 100ms
	solve (bodies) {
		postMessage({
			type: `solve`,
			bodies: map(bodies)(([id, body]) => {
				// fix defaults
				body.position = body.position || [0, 0, 0]
				body[`!velocity`] = body[`!velocity`] || [0, 0, 0]
				body.scale = body.scale || 1

				// default to light mover
				body.mass = typeof body.mass === `number`
					? body.mass
					: 1

				Velocity(body, bodies)

				const update = {
					position: body.position,
					"!velocity": body[`!velocity`]
				}

				if (body[`!collide`]) update[`!collide`] = body[`!collide`]

				return [id, update]
			})
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
