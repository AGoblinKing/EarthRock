import { extend } from "/object.js"
import Tone from "tone"

export default extend({
	play () {

	},

	stop () {

	},

	rez () {
		let first = false
		this.cancel = this.value.listen(($sound) => {
			if (!first) {
				first = true
				return
			}
			// construct $sound from data and then play it
			this.stop()
			this.play()
		})
	},

	derez () {
		this.cancel()
	}
})
