import { extend } from "/object.js"

export default extend({
	create () {
		this.cancel = this.value.listen(() => {
			// don't ever ever save this
			this.value.set(undefined, true)
		})
	}
})
