import { write, read } from "/util/store.js"
import { extend } from "/util/object.js"
import { random } from "/util/text.js"

import Knot from "./knot.js"
import uuid from "cuid"

const proto = {
	add (properties) {
		properties.id = properties.id || uuid()

		const k = this.make(properties)

		this.knots.update(($knots) => {
			$knots[k.id.get()] = k
			return $knots
		})

		return k
	},

	remove_name (name) {
		const k = this.get_name(name)
		if (!k) return

		const id = k.id.get()
		return this.remove(id)
	},

	remove (...ids) {
		const $threads = this.threads.get()
		const $rezed = this.rezed.get()
		const $destroys = this.destroys.get()

		this.knots.update(($knots) => {
			ids.forEach((id) => {
				if ($destroys[id]) $destroys[id]()

				delete $knots[id]
				delete $threads[id]
				delete $rezed[id]
			})

			this.rezed.set($rezed)
			this.threads.set($threads)

			return $knots
		})
	},

	write (structure) {
		const $names = this.names.get()

		return Object.fromEntries(Object.entries(structure).map(([key, data]) => {
			const k = $names[key]

			if (!k) {
				data.name = key
				return [key, this.add(data)]
			}

			const type = k.knot.get()

			Object.entries(data).forEach(([key_sub, data_sub]) => {
				if (key_sub === `knot`) return

				if (key_sub === `value` && type === `stitch`) {
					k[key_sub].set({
						...k[key_sub].get(),
						...data_sub
					})
					return
				}

				k[key_sub].set(data_sub)
			})

			return [key, k]
		}))
	},

	exists (id) {
		const [knot, channel] = id.split(`/`)

		const k = this.knots.get()[knot]

		if (!k) return false
		if (channel === undefined) return true

		return Object.keys(k.value.get()).indexOf(channel) !== -1
	},

	validate () {
		let dirty = false

		const t = this.threads.get()
		const ks = this.knots.get()

		const deletes = []

		Object.values(ks).forEach((k) => {
			if (k.knot.get() === `stitch`) return

			const chain = this.chain(k.id.get(), true)
			const last = chain[chain.length - 1].split(`/`)[0]
			const first = chain[0].split(`/`)[0]
			const k_last = ks[last]
			const k_first = ks[first]

			if (
				(k_last && k_last.knot.get() === `stitch`) ||
                    (k_first && k_first.knot.get() === `stitch`)
			) return

			deletes.push(k.id.get())
		})

		if (deletes.length > 0) {
			console.warn(`Deleted ${deletes.length} orphans on validation.`)
			this.remove(...deletes)
		}

		Object.entries(t).forEach(([r, w]) => {
			if (this.exists(r) && this.exists(w)) return

			dirty = true
			delete (t[r])
		})

		if (!dirty) return

		this.threads.set(t)
	},

	chain (address, right = false) {
		const other = right
			? this.threads.get()[address]
			: this.threads_r.get()[address]

		if (!other) return [address]
		return [...this.chain(other, right), address]
	},

	to_address (id_path) {
		const [knot] = id_path.split(`/`)

		const k = this.get_id(knot)
		if (!k || !k.name) return `/sys/void`

		return `/${this.name.get()}/${k.name.get()}`
	},

	get_name (name) {
		const $ns = this.names.get()

		return $ns[name]
	},

	get_id (id) {
		const [k_id, chan_name] = id.split(`/`)
		const k = this.knots.get()[k_id]

		if (!chan_name) return k

		const v = k.value.get()
		if (!v || !v[chan_name]) return

		// knot style of a channel
		return {
			value: v[chan_name]
		}
	},

	make (properties) {
		return Knot({
			...properties,
			weave: this,
			life: this.rezer(properties.id),
			destroy: this.destroyer(properties.id)
		})
	},

	destroyer (id) {
		return (destroy) => this.destroys.update(($destroys) => {
			$destroys[id] = destroy
			return $destroys
		})
	},

	rezer (id) {
		return (life) => this.lives.update(($lives) => {
			$lives[id] = life
			return $lives
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
		ids.forEach((id) => {
			$rezed[id] = true
		})
		this.rezed.set($rezed)
	},

	toJSON () {
		const {
			id,
			knot,
			name,
			threads,
			knots,
			rezed
		} = this

		return JSON.parse(JSON.stringify({
			id,
			knot,
			name,
			threads,
			knots,
			rezed
		}))
	}
}

// Weave of knots connected together with threads
export default ({
	name = random(2),
	id = uuid(),
	knots = {},
	threads = {},
	rezed = {}
} = false) => {
	const weave = extend(proto, {
		// saved
		id: read(id),
		name: write(name),
		threads: write(threads),
		rezed: write(rezed),

		// not saved
		lives: write({}),
		names: write({}),
		destroys: write({})
	})

	const ks = Object.entries(knots)
		.reduce((res, [knot_id, val]) => {
			if (val.id !== knot_id) {
				val.id = knot_id
			}

			res[knot_id] = weave.make(val)

			return res
		}, {})

	// saved
	weave.knots = write(ks)

	// not saved
	weave.threads_r = read({}, (set) => {
		// destroy this on weave destroy
		weave.threads.listen(($threads) => {
			set(Object.fromEntries(Object.entries($threads).map(
				(item) => item.reverse()
			)))
		})
	})

	return weave
}
