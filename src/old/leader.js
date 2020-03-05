import { write } from "/store.js"
import { extend } from "/object.js"

export default extend({
	rez () {
		// console.log(`leader`, this.space.id.get())

		this.cancel = this.value.listen((leader) => {
			const id = this.space.id.get()
			const $leader = Wheel.get(this.weave.resolve(leader, id))

			if (!$leader) {
				console.warn(`leader not found`)
				return
			}

			const vs = $leader.value.get()
			if (!vs[`!birds`]) {
				vs[`!birds`] = write(new Set([id]))
				$leader.value.set(vs)
				return
			}

			let birds = vs[`!birds`].get()
			if (!birds.add && !Array.isArray(birds)) birds = new Set()
			if (Array.isArray(birds)) birds = new Set(birds)

			if (birds.has(id)) return

			birds.add(id)
			vs[`!birds`].set([...birds])
		})
	},

	derez () {
		const id = this.space.id.get()

		this.cancel()
		const $leader = Wheel.get(this.weave.resolve(this.value.get(), id))
		if (!$leader) {
			console.warn(`no leader`)
			return
		}

		const vs = $leader.value.get()
		if (!vs) {
			console.warn(`no leader value`)
			return
		}
		let birds = vs[`!birds`].get()

		if (!birds.add && !Array.isArray(birds)) birds = new Set()
		if (Array.isArray(birds)) birds = new Set(birds)
		birds.delete(id)

		vs[`!birds`].set([...birds])
	}
})
