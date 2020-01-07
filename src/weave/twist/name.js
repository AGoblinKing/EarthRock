import { extend } from "/util/object.js"

const proto_name = {
	update ($name) {
		return ($ns) => {
			$ns[$name] = this.space

			if (this.name_last) {
				delete $ns[this.name_last]
			}

			this.name_last = $name

			return $ns
		}
	},

	create () {
		this.cancel = this.value.listen(($name) =>
			this.weave.names.update(this.update($name))
		)
	},

	destroy () {
		this.cancel()

		this.weave.names.update(($ns) => {
			delete $ns[this.name_last]
			return $ns
		})
	}
}

export default extend(proto_name)
