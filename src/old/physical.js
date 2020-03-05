import { extend } from "/object.js"
import { add, remove } from "/sys/physics.js"

export default extend({
	// add the physics system
	rez () {
		add(this.space)
	},

	derez () {
		remove(this.space)
	}
})
