import { write } from "/store.js"
import { extend } from "/util/object.js"

export default extend({
	rez () {
		this.cancel = this.value.listen((leader) => {
			const l = this.weave.get_name(leader)
			if (!l) return

			const vs = l.value.get()
			if (!vs[`!birds`]) {
				vs[`!birds`] = write([this.id])
				l.value.set(vs)
				return
			}

			let v = vs[`!birds`].get()
			if (!Array.isArray(v)) v = []
			if (v.indexOf(this.id) !== -1) return

			v.push(this.id)
			vs[`!birds`].set(v)
		})
	},

	derez () {
		this.cancel()
		const l = this.weave.get_name(this.value.get())
		if (!l) return

		const vs = l.value.get()
		if (!vs) return

		const bs = vs[`!birds`].get()
		bs.splice(bs.indexOf(this.id), 1)

		vs[`!birds`].set(bs)
	}
})
