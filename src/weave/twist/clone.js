export default ({
	weave,
	stitch,
	value,
	id
}) => {
	const destroys = new Set()

	const clean = () => destroys.forEach((d) => d())
	let stop_other

	const stop_value = value.listen(($value) => {
		clean()
		if (stop_other) stop_other()
		stop_other = false

		const other = Wheel.get(weave.resolve($value, id))
		if (!other) return

		stop_other = other.value.listen((vs_o) => {
			clean()

			Object.entries(vs_o).forEach(([key, value_o]) =>
				destroys.add(value_o.listen((v_o) => {
					stitch.value.update({
						[key]: v_o
					})
				}))
			)
		})
	})

	return () => {
		clean()
		stop_other()
		stop_value()
	}
}
