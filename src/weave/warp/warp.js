export const proto_warp = {
	get_space () {
		const id = this.id.get()
		let space_id

		const finder = (spx) => {
			if (spx.indexOf(`/`) === -1) return

			space_id = spx.split(`/`)[0]
			return true
		}

		this.weave.chain(id).some(finder)
		if (space_id === undefined) {
			this.weave.chain(id, true).some(finder)
		}

		return this.weave.get_id(space_id)
	},

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
