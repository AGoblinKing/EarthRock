import { extend } from "/object.js"
import cuid from "cuid"

export default extend({
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

		this.value_cancel = value.listen(($value) => {
			const split = $value.split(` `)
			let count = 1
			if (split.length > 1) {
				count = parseInt(split[0])
				$value = split.slice(1).join(` `)
			}

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
				this.weave.rez(...this.birds)
			})
		})
	},

	derez () {
		this.value_cancel()
		this.cancel()
	}
})
