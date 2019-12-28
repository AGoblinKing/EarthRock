export default ({
	stitch,
	weave,
	value,
	id
}) => {
	const $value = value.get()
	const other = Wheel.get(weave.resolve($value, id))

	if (!other || other.knot.get() !== `stitch`) return

	const vs = stitch.value.get()
	const count = vs[`!flock count`]
		? vs[`!flock count`].get()
		: 1

	const w_update = {}

	const birds = new Promise((resolve) => {
		// rez the birds next chance
		requestAnimationFrame(() => {
		// spawn a flock
			for (let i = 0; i < count; i++) {
				const key = `&${stitch.name.get()} ${i + 1}`
				w_update[key] = {
					knot: `stitch`,
					value: {
						"!clone": $value,
						"!leader": `${stitch.name.get()}`,
						"!bird": i
					}
				}
			}

			const birds = Object.values(weave.update(w_update)).map((bird) => bird.id.get())

			weave.rez(...birds)

			resolve(birds)
		})
	})

	return async () => {
		weave.remove(...await birds)
	}
}
