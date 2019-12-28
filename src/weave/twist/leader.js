import { write } from "/util/store.js"

// Who to follow
export default ({
	value,
	weave,
	id
}) => {
	const cancel = value.listen((leader) => {
		const l = weave.get_name(leader)
		if (!l) return

		const vs = l.value.get()
		if (!vs[`!birds`]) {
			vs[`!birds`] = write([id])
			l.value.set(vs)
			return
		}

		let v = vs[`!birds`].get()
		if (!Array.isArray(v)) v = []
		if (v.indexOf(id) !== -1) return

		v.push(id)
		vs[`!birds`].set(v)
	})

	return () => {
		cancel()
		const l = weave.get_name(value.get())
		if (!l) return

		const vs = l.value.get()
		if (!vs) return

		const bs = vs[`!birds`].get()
		bs.splice(bs.indexOf(id), 1)

		vs[`!birds`].set(bs)
	}
}
