import { extend } from "/object.js"

export default extend({
	create () {
		requestAnimationFrame(() => {
			// always set the value to nothing to start
			this.value.set([])
		})
	}
})
