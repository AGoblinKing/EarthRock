import { each } from "/object.js"
import Velocity from "./_velocity.js"

const handlers = {
	// solve for the next 100ms
	solve (bodies) {
		const updates = {}

		const collisions = {}

		each(bodies)(([id, body]) => {
			// fix defaults
			body.position = body.position || [0, 0, 0]
			body[`!velocity`] = body[`!velocity`] ? body[`!velocity`] : [0, 0, 0]

			body.scale = body.scale || 1

			// default to light mover
			body.mass = typeof body.mass === `number`
				? body.mass
				: 1

			const [dirty, collides] = Velocity(body, bodies)
			if (!dirty) return

			if (!collisions[id]) collisions[id] = []
			collisions[id].push(...collides)

			collides.forEach((id_o) => {
				if (collisions[id_o]) {
					collisions[id_o].push(id)
				} else {
					collisions[id_o] = [id]
				}
			})

			dirty.forEach((id) => {
				updates[id] = {
					position: bodies[id].position,
					"!velocity": bodies[id][`!velocity`]
				}
			})
		})

		Object.entries(collisions).forEach(([id, collides]) => {
			if (collides.length === 0) return
			if (!updates[id]) updates[id] = {}

			updates[id][`!collide`] = [...new Set(collides)]
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
