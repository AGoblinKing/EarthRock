import { extend } from "/object.js"
import { tick } from "/sys/time.js"
import { v3 } from "twgl.js"

// rate of decay
const DECAY = 0.9
const MIN = 0.01

export default extend({
	rez () {
		let first = true
		// delay this shit
		this.cancel = tick.listen(() => requestAnimationFrame(() => {
			if (first) {
				first = false
				return
			}

			const $velocity = this.value.get()

			if (Array.isArray($velocity) === false) return

			const body = this.space.get_value(`body`) || 1

			// impossible to move 0 body items
			if (
				body === 0 ||
				v3.length($velocity) < MIN
			) return

			let position = this.space.get(`position`)
			if (!position || position.get().some((i) => i === null)) {
				this.space.write({
					position: [0, 0, 0]
				}, true)
				position = this.space.get(`position`)
			}

			const $position = position.get()
			let decay = this.space.get_value(`!decay`) || DECAY

			decay = body > 0 ? decay * body : decay / Math.abs(body)

			v3.add($position, $velocity, $position)
			v3.mulScalar($velocity, decay, $velocity)

			position.set($position)
			this.value.set($velocity)
		}))
	},

	derez () {
		this.cancel()
	}
})
