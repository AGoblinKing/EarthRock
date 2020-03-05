// in charge of communicating/spawning the physics worker
import { write } from "/store.js"
import { tick } from "/sys/time.js"
import { each, map } from "/object.js"

const physics = new Worker(`/bin/physics.bundle.js`)

export const bodies = write({})

const ask = () => requestAnimationFrame(() => {
	const msg = map(bodies.get())(([key, body]) => {
		const $body = body.get()
		// this should be the buff data too
		// TODO: Unify this shit
		return [
			key,
			{
				id: key,
				position: def($body.position, [0, 0, 0]),
				"!velocity": ($body[`!velocity`] && Array.isArray($body[`!velocity`].get()))
					? $body[`!velocity`].get().map((i) => i === null ? 0 : i)
					: [0, 0, 0],
				scale: def($body.scale, 1),
				"!real": def($body[`!real`], false),
				"!name": def($body[`!name`], `id-${key}`),
				mass: def($body.mass, 1),
				"!force": def($body[`!force`], undefined)
			}
		]
	})

	physics.postMessage({
		type: `solve`,
		data: msg
	})
})

let snap = () => { ask() }

physics.onmessage = ({ data }) => {
	snap = () => {
		const $bodies = bodies.get()

		each(data.bodies)(([
			id,
			update
		]) => {
			const body = $bodies[id]
			if (!body) return

			body.write(update)
		})

		ask()
	}
}

export const add = (...spaces) => {
	const $bodies = bodies.get()
	spaces.forEach((space) => {
		$bodies[space.id.get()] = space.value
	})

	bodies.set($bodies, true)
}

export const remove = (...spaces) => {
	const $bodies = bodies.get()
	spaces.forEach((space) => {
		delete $bodies[space.id.get()]
	})

	bodies.set($bodies, true)
}

const def = (store, or_this) => store ? store.get() : or_this

tick.listen(() => {
	snap()
})
