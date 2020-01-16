import { extend } from "/object.js"
import { tick } from "/sys/time.js"
import { v3 } from "twgl.js"

export default extend({
	rez () {
		this.cancel = tick.listen(() => {
			const $value = this.value.get()
			const $velocity = this.space.get_value(`!velocity`) || [0, 0, 0]

			v3.add($value, $velocity, $velocity)

			this.space.write({
				"!velocity": $velocity
			})
		})
	},

	derez () {
		this.cancel()
	}
})
