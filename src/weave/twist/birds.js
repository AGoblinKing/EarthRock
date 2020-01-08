import { extend } from "/util/object.js"

const proto_birds = {
	create () {
		requestAnimationFrame(() => {
			// always set the value to nothing to start
			this.value.set([])
		})
	}
}
export default extend(proto_birds)
