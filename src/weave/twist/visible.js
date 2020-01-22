import { extend, values } from "/object.js"

export const visible = {
	value: {},
	get () {
		return visible.value
	},

	add: [],
	update: {},
	remove: [],

	hey () {
		const { add, update, remove } = visible

		visible.add = []
		visible.update = {}
		visible.remove = []

		return { add, update, remove }
	}
}

const deep_listen = (space) => {
	const cancels = {}

	const id = space.id.get()

	const cancel = space.value.listen(($sv, { add, remove }) => {
		add.forEach((key) => {
			cancels[key] = $sv[key].listen(($value) => {
				if (!visible.update[id]) visible.update[id] = {}
				visible.update[id][key] = $value
			})
		})

		remove.forEach((key) => {
			// got removed before a hey
			if (visible.update[id] && visible.update[id][key] !== undefined) delete visible.update[id][key]

			cancels[key]()
			delete cancels[key]
		})
	})

	return () => {
		cancel()
		values(cancels).forEach((canceler) => canceler())
	}
}

export default extend({
	rez () {
		const id = this.space.id.get()
		visible.value[id] = this.space
		visible.add.push(id)

		this.cancel = deep_listen(this.space)
	},

	derez () {
		this.cancel()
		const id = this.space.id.get()
		delete visible.value[id]
		visible.remove.push(id)
	}
})
