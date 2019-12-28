import { decompile, compile } from "/thread/thread.js"

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

		const addr_o = weave.resolve($value, id)
		const split = addr_o.split(`/`)

		const other = Wheel.get(addr_o)
		if (!other) return

		const weave_other = Wheel.get(split[0])

		stop_other = other.value.listen((vs_o) => {
			clean()

			Object.entries(vs_o).forEach(([key, value_o]) =>
				destroys.add(value_o.listen((v_o) => {
					stitch.value.update({
						[key]: v_o
					})
				}))
			)

			// going to cause flap
			requestAnimationFrame(() => {
				// basic values added, we can now attach scripts
				Object.keys(vs_o).forEach((key) => {
					const other_id = `${other.id.get()}/${key}`
					const c_o = weave_other.chain(other_id).slice(0, -1)
					if (c_o.length === 0) return

					//  we got a chain to clone!
					const code = decompile(other_id, weave_other)
					compile(code, weave, `${id}/${key}`)
				})
			})
		})
	})

	return () => {
		clean()
		stop_other()
		stop_value()
	}
}
