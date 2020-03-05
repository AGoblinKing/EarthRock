import { extend } from "/object.js"

export default extend({
	create () {
		this.cancel = this.value.listen(($name) => {
			const $names = this.weave.names.get()
			if (this.name_last) {
				if (this.name_last === $name) return

				delete $names[this.name_last]
			}

			$names[$name] = this.space
			this.name_last = $name
			this.weave.names.set($names)
		})
	},

	destroy () {
		this.cancel()

		this.weave.names.update(($ns) => {
			delete $ns[this.name_last]
			return $ns
		})
	}
})
