import { extend } from "/util/object.js"
import cuid from "cuid"

const proto_flock = {
	cancel () {
		const removes = [...this.birds]

		// basically anything that fucks with the weave you want to delay
		requestAnimationFrame(() => {
			this.weave.remove(...removes)
		})
	},

	rez () {
		const { value, space, weave } = this
		this.birds = []

		const fc = space.value.get(`!flock count`)
		const count = fc
			? fc.get()
			: 1

		this.value_cancel = value.listen(($value) => {
			this.cancel()
			const update = Object.fromEntries([...Array(count)].map(
				(_, i) => {
					return [`&${cuid()}`, {
						type: `space`,
						value: {
							"!clone": $value,
							"!leader": `~/${space.value.get(`!name`).get()}`,
							"!bird": i
						}
					}]
				}
			))

			// store bird ids for later deletion
			requestAnimationFrame(() => {
				this.birds = Object.values(weave.write_ids(update)).map((item) => item.id.get())

				requestAnimationFrame(() => {
					this.weave.rez(...this.birds)
				})
			})
		})
	},

	derez () {
		this.value_cancel()
		this.cancel()
	}
}

export default extend(proto_flock)
