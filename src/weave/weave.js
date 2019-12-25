import { write, read, derived } from "/util/store.js"

import { random } from "/util/text.js"

import Knot from "./knot.js"
import uuid from "cuid"

// Weave of holes connected with threads
export default ({
	name = random(2),
	id = uuid(),
	knots = {},
	threads = {},
	rezed = {}
} = false) => {
	const exists = (id) => {
		const [knot, channel] = id.split(`/`)

		const k = w.knots.get()[knot]
		if (!k) return false
		if (channel === undefined) return true

		return Object.keys(k.value.get()).indexOf(channel) !== -1
	}

	const w = {
		id: read(id),
		name: write(name),
		threads: write(threads),
		lives: write({}),
		rezed: write(rezed),

		validate: () => {
			let dirty = false
			let deletes = 0
			const t = w.threads.get()
			const ks = w.knots.get()

			Object.values(ks).forEach((k) => {
				if (k.knot.get() === `stitch`) return

				const chain = w.chain(k.id.get(), true)
				const last = chain[chain.length - 1].split(`/`)[0]
				const first = chain[0].split(`/`)[0]
				const k_last = ks[last]
				const k_first = ks[first]

				if (
					(k_last && k_last.knot.get() === `stitch`) ||
                    (k_first && k_first.knot.get() === `stitch`)
				) return

				delete ks[k.id.get()]
				deletes += 1
			})

			if (deletes > 0) {
				console.warn(`Deleted ${deletes} orphans on validation.`)
				w.knots.set(ks)
			}

			Object.entries(t).forEach(([r, w]) => {
				if (exists(r) && exists(w)) return

				dirty = true
				delete (t[r])
			})

			if (!dirty) return

			w.threads.set(t)
		},

		chain: (address, right = false) => {
			const other = right
				? w.threads.get()[address]
				: w.threads_r.get()[address]

			if (!other) return [address]
			return [...w.chain(other, right), address]
		},

		toJSON: () => {
			const {
				id,
				knot,
				name,
				threads,
				knots,
				rezed
			} = w

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

	const life_set = w.lives.set

	w.lives.set = undefined
	const life_add = (id) => (life) => {
		const ls = w.lives.get()
		ls[id] = life

		life_set(ls)
	}

	w.threads_r = read({}, (set) => {
		w.threads.listen(($threads) => {
			set(Object.fromEntries(Object.entries($threads).map(
				(item) => item.reverse()
			)))
		})
	})

	w.get_id = (id) => {
		const [k_id, chan_name] = id.split(`/`)
		const k = w.knots.get()[k_id]

		if (!chan_name) return k

		const v = k.value.get()
		if (!v || !v[chan_name]) return

		// knot style of a channel
		return {
			value: v[chan_name]
		}
	}

	w.get_name = (name) => {
		const k = w.names.get()[name]
		if (!k) return

		return k
	}

	w.to_address = (id_path) => {
		const [knot] = id_path.split(`/`)

		const k = w.get_id(knot)
		if (!k || !k.name) return `/sys/void`

		return `/${w.name.get()}/${k.name.get()}`
	}

	w.remove_name = (name) => {
		const k = w.get_name(name)
		if (!k) return

		const id = k.id.get()
		return w.remove(id)
	}

	w.remove = (...ids) => {
		// don't  derez/dethread
		// they'll get picked up
		// next loop
		ids = ids.filter((id) => {
			const k = w.knots.get()[id]
			if (!k) return false
			return true
		})

		w.knots.update(($knots) => {
			ids.forEach((id) => {
				delete $knots[id]
			})

			return $knots
		})
	}

	w.add = (properties) => {
		properties.id = properties.id || uuid()

		const k = Knot({
			...properties,
			weave: w,
			life: life_add(properties.id)
		})

		w.knots.update(($knots) => {
			$knots[k.id.get()] = k
			return $knots
		})

		return k
	}

	w.knots = write(Object
		.entries(knots)
		.reduce((res, [knot_id, val]) => {
			if (val.id !== knot_id) {
				val.id = knot_id
			}

			res[knot_id] = Knot({
				...val,
				weave: w,
				life: life_add(knot_id)
			})

			return res
		}, {})
	)

	// index by name, uniqueness not guaranteed
	// Stitches only right now
	w.names = derived(w.knots, ([$knots]) => {
		const counts = {}

		return Object.fromEntries(
			Object.values($knots)
				.filter(({ knot }) => knot.get() === `stitch`)
				.map((knot) => {
					let n = knot.name.get()
					// name collision
					if (counts[n] !== undefined) {
						n += `_${Math.floor(Math.random() * 100)}`

						knot.name.set(n)
					}
					return [
						n,
						knot
					]
				})
		)
	})

	w.update = (structure) => {
		const $names = w.names.get()

		return Object.fromEntries(Object.entries(structure).map(([key, data]) => {
			const k = $names[key]

			if (!k) {
				data.name = key
				return [key, w.add(data)]
			}

			const type = k.knot.get()

			Object.entries(data).forEach(([key_sub, data_sub]) => {
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
	}

	w.resolve = (addr, id) => addr
		.replace(`.`, w.to_address(w.chain(id, true).shift()))
		.replace(`~`, w.name.get())

	w.derez = (...ids) => {
		const $rezed = w.rezed.get()
		ids.forEach((id) => {
			delete $rezed[id]
		})
		w.rezed.set($rezed)
	}

	w.rez = (...ids) => {
		const $rezed = w.rezed.get()
		ids.forEach((id) => {
			$rezed[id] = true
		})
		w.rezed.set($rezed)
	}

	return w
}
