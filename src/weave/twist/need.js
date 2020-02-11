import { extend } from "/object.js"
import { github } from "/sys/file.js"

export default extend({
	create () {
		// give it a raf for the rest to calm down
		requestAnimationFrame(() => {
			this.cancel = this.value.listen(($value) => {
				$value = Array.isArray($value)
					? $value
					: [$value]

				$value.forEach((item) => {
					if (typeof item !== `string`) return
					const components = item.split(`/`)
					// if the dep is already loaded don't bother
					if (Wheel.get(components[components.length - 1])) return
					github(components)
				})
			})
		})
	},

	destroy () {
		this.cancel && this.cancel()
	}
})
