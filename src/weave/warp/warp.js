export const proto_warp = {
	listen (fn) {
		return this.value.listen(fn)
	},

	get () {
		return this.value.get()
	},

	set (val) {
		return this.value.set(val)
	},

	toJSON () {
		return {
			type: this.type.get(),
			value: this.value.toJSON()
		}
	}
}
