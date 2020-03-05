import { extend } from "/object.js"
import { any } from "/store.js"

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

		if (!space.get(`count`)) {
			space.write({ count: 1 }, true)
		}
		let last_bird = ``
		let last_count = 0

		this.value_cancel = any(value, space.get(`count`))(($value, $count) => {
			if (last_bird === $value && $count === last_count) return
			last_bird = $value
			last_count = $count
			this.cancel()
			const update = Object.fromEntries([...Array($count)].map(
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
