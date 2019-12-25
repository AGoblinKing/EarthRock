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

	// spawn a flock
	for (let i = 0; i < count; i++) {
		const key = `&${stitch.name.get()} ${i + 1}`
		w_update[key] = {
			knot: `stitch`,
			value: {
				"!clone": $value,
				"!leader": `~/${stitch.name.get()}`
			}
		}
	}

	const birds = Object.values(weave.update(w_update))

	// rez the birds next chance
	requestAnimationFrame(() => {
		birds.forEach((bird) => {
			weave.rez(bird.id.get())
		})
	})

	return () => {
		console.log(`bird removal`, birds)
		birds.forEach((bird) => {
			weave.remove(bird.id.get())
		})
	}
}
