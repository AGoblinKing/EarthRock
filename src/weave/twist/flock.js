export default ({
	space,
	weave,
	value,
	id
}) => {
	// no flocking right now
	return {}

	const $value = value.get()
	const other = Wheel.get(weave.resolve($value, id))

	if (!other || other.type.get() !== `space`) return

	const vs = space.value.get()
	const count = vs[`!flock count`]
		? vs[`!flock count`].get()
		: 1

	const w_update = {}

	const birds = new Promise((resolve) => {
		// rez the birds next chance
		requestAnimationFrame(() => {
		// spawn a flock
			for (let i = 0; i < count; i++) {
				const key = `&${space.name.get()} ${i + 1}`
				w_update[key] = {
					type: `space`,
					value: {
						"!clone": $value,
						"!leader": `${space.name.get()}`,
						"!bird": i
					}
				}
			}

			const birds = Object.values(weave.write(w_update)).map((bird) => bird.id.get())

			weave.rez(...birds)

			resolve(birds)
		})
	})

	return {
		destroy: async () => {
			weave.remove(...await birds)
		}
	}
}
