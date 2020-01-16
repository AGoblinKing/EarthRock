import { extend } from "/object.js"

// [tag]: Set [id]
const tags = Wheel.shared.tags = {
	// players: [id, id2]
}

export default extend({
	cleanup () {
		const id = this.space.id.get()

		this.last.forEach((tag) => {
			tags[tag].delete(id)
		})
	},

	// add to tags
	rez () {
		const id = this.space.id.get()

		this.cancel = this.value.listen(($value) => {
			if (!Array.isArray($value)) $value = [$value]
			if (this.last) this.cleanup()
			this.last = $value

			$value.forEach((tag) => {
				if (!tags[tag]) tags[tag] = new Set()
				tags[tag].add(id)
			})
		})
	},

	derez () {
		this.cancel()
		if (this.last) this.cleanup()
	}
})
