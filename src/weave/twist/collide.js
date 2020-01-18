import { extend } from "/object.js"

export default extend({
	create () {
		this.value.set(undefined, true)
		this.cancel = this.value.listen(() => {
			// don't ever ever save this

		})
	}
})
