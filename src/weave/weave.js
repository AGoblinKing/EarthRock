import { write, read, difference } from "/store.js"
import { extend, map, each, reduce } from "/util/object.js"
import { random } from "/util/text.js"

import Warp from "./warp_factory.js"
import uuid from "cuid"

const proto_weave = {
	add (properties) {
		properties.id = properties.id || uuid()

		const k = this.make(properties)

		if (!k) return

		this.warps.update(($warps) => {
			$warps[k.id.get()] = k
			return $warps
		})

		// allows other work to be done first
		if (k.create) requestAnimationFrame(() => k.create())

		return k
	},

	remove_name (name) {
		const k = this.get_name(name)
		if (!k) return

		const id = k.id.get()
		return this.remove(id)
	},

	remove (...ids) {
		const $wefts = this.wefts.get()
		const $rezed = this.rezed.get()

		this.warps.update(($warps) => {
			ids.forEach((id) => {
				delete $wefts[id]
				delete $rezed[id]
			})

			this.rezed.set($rezed)
			this.wefts.set($wefts)

			ids.forEach((id) => {
				const k = $warps[id]

				k && k.destroy && k.destroy()

				delete $warps[id]
			})
			return $warps
		})
	},

	write (structure) {
		const $names = this.names.get()

		return map(structure)(([key, data]) => {
			const k = $names[key]

			if (!k) {
				data.value = data.value || {}
				data.value[`!name`] = key

				const warp = this.add(data)
				if (!warp) return [key, false]

				return [key, warp]
			}

			each(data)(([key_sub, data_sub]) => {
				const warp = k[key_sub]
				if (key_sub === `value`) {
					warp.set({
						...warp.get(),
						...data_sub
					})

					return
				}

				if (warp.set) warp.set(data_sub)
			})

			return [key, k]
		})
	},

	exists (address) {
		const [warp, weft] = address.split(`/`)

		const k = this.warps.get()[warp]

		if (!k) return false
		if (weft === undefined) return true

		return k.value.get()[weft] !== undefined
	},

	validate () {
		let dirty = false

		const wefts = this.wefts.get()
		const warps = this.warps.get()

		const deletes = []

		each(warps)(([_, k]) => {
			if (k.type.get() === `space`) return

			const chain = this.chain(k.id.get(), true)
			const last = chain[chain.length - 1].split(`/`)[0]
			const first = chain[0].split(`/`)[0]
			const k_last = warps[last]
			const k_first = warps[first]

			if (
				(k_last && k_last.type.get() === `space`) ||
                    (k_first && k_first.type.get() === `space`)
			) return

			deletes.push(k.id.get())
		})

		if (deletes.length > 0) {
			console.warn(`Deleted ${deletes.length} orphans on validation.`)
			this.remove(...deletes)
		}

		each(wefts)(([r, w]) => {
			if (this.exists(r) && this.exists(w)) return

			dirty = true
			delete (wefts[r])
		})

		if (!dirty) return

		this.wefts.set(wefts)
	},

	chain (address, right = false) {
		const other = right
			? this.wefts.get()[address]
			: this.wefts_r.get()[address]

		if (!other) return [address]
		return [...this.chain(other, right), address]
	},

	to_address (id_path) {
		const [warp] = id_path.split(`/`)

		const space = this.get_id(warp)
		if (!space || !space.name) return `/sys/void`

		return `/${this.name.get()}/${space.name().get()}`
	},

	get_name (name) {
		const $ns = this.names.get()

		return $ns[name]
	},

	get_id (id) {
		const [k_id, chan_name] = id.split(`/`)
		const k = this.warps.get()[k_id]

		if (!chan_name) return k

		const v = k.value.get()
		if (!v || !v[chan_name]) return

		// warp style of a channel
		return {
			value: v[chan_name]
		}
	},

	make (properties) {
		return Warp({
			...properties,
			weave: this
		})
	},

	resolve (addr, id) {
		return addr
			.replace(`.`, this.to_address(this.chain(id, true).shift()))
			.replace(`~`, this.name.get())
	},

	derez (...ids) {
		const $rezed = this.rezed.get()

		ids.forEach((id) => {
			delete $rezed[id]
		})

		this.rezed.set($rezed)
	},

	rez (...ids) {
		const $rezed = this.rezed.get()
		const $warps = this.warps.get()

		ids.forEach((id) => {
			const k = $warps[id]
			// prevent bad rezes
			if (!k) return

			$rezed[id] = true
		})

		this.rezed.set($rezed)
	},

	destroy () {
		this.destroys.forEach((fn) => fn())
	},

	toJSON () {
		return {
			id: this.id.toJSON(),
			name: this.name.toJSON(),
			wefts: this.wefts.toJSON(),
			warps: map(this.warps.get())(([id, warp]) => [
				id,
				warp.toJSON()
			]),
			rezed: this.rezed.toJSON()
		}
	}
}

// Weave of warps connected together with wefts
export default ({
	name = random(2),
	id = uuid(),
	warps = {},
	wefts = {},
	rezed = {},

	// TODO: remove conversions
	knots,
	threads
} = false) => {
	if (knots) warps = knots
	if (threads) wefts = threads

	const weave = extend(proto_weave, {
		// saved
		id: read(id),
		name: write(name),
		wefts: difference(wefts),
		rezed: difference(rezed),

		// not saved
		names: write({}),
		destroys: []
	})

	const ks = reduce(warps)((res, [warp_id, val]) => {
		if (val.id !== warp_id) {
			val.id = warp_id
		}

		// wait for them all to be made
		const warp = weave.make(val)
		if (!warp) return res

		res[warp_id] = warp

		return res
	}, {})

	each(ks)(([_, warp]) => warp.create && warp.create())
	// saved
	weave.warps = write(ks)

	// not saved
	weave.wefts_r = read({}, (set) =>
		// destroy this on weave destroy
		weave.destroys.push(weave.wefts.listen(($wefts) =>
			set(map($wefts)((item) => item.reverse()))
		))
	)

	return weave
}
