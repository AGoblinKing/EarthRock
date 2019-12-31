import Weave from "./weave.js"
import { write, read, any } from "/store.js"
import { values, keys } from "/util/object.js"

export const SYSTEM = `sys`

// weaves [name]weave
export const weaves = write({
	[SYSTEM]: Weave({
		name: SYSTEM,
		id: SYSTEM
	})
})

const highways = new Map()

let running_set

// run the system weave by default (safe idle)
export const running = read({
	[SYSTEM]: true
}, (set) => { running_set = set })

export const trash = write()

const addr = (address) => {
	let path = address.split(`/`)
	if (path[0] === ``) path = path.slice(1)
	return path
}

// Delete Weaves
export const del = (keys) => {
	const $running = running.get()
	const $weaves = weaves.get()

	let dirty = false

	Object.keys(keys).forEach((key) => {
		if (key === SYSTEM) return

		if ($running[key]) {
			stop(key)
		}

		if ($weaves[key]) {
			dirty = true
			$weaves[key].destroy()
			trash.set(
				$weaves[key]
			)

			delete $weaves[key]
		}
	})

	if (dirty) weaves.set($weaves)
}

// name of the current wheel, path watches
export const name = write(``)

export const get = (address) => {
	const [
		weave_name,
		warp_name,
		chan
	] = addr(address)

	const w = weaves.get()[weave_name]

	if (w === undefined) return
	if (warp_name === undefined) return w

	const k = w.names.get()[warp_name]

	if (k === undefined) return
	if (chan === undefined) return k

	const c = k.value.get()[chan]
	if (c === undefined) return

	return c
}

export const exists = (address) => get(address) !== undefined

// create the whole path if you gotta
export const spawn = (pattern = {}) => Object.fromEntries(
	Object.entries(pattern).map(([
		weave_id,
		weave_data
	]) => {
		if (weave_id === SYSTEM) {
			console.warn(`tried to spawn ${SYSTEM}`)
			return [weave_id, get(weave_id)]
		}

		const ws = weaves.get()
		const w = Weave({
			...weave_data,
			name: weave_id
		})

		ws[weave_id] = w

		weaves.set(ws)
		return [weave_id, w]
	})
)

const start_wefts = (weave) => {
	let weft_cancel = []

	const cancel = weave.wefts.listen((wefts) => {
		let dirty = false

		// TODO: partial updates like lives
		// tear down existing highways
		if (weft_cancel) weft_cancel.forEach((d) => d())

		weft_cancel = Object.entries(wefts)
			.map(([
				reader,
				writer
			]) => {
				const r = weave.get_id(reader)
				const wr = weave.get_id(writer)

				if (!wr || !r) {
					dirty = true
					delete wefts[reader]
					return
				}

				return r.value.subscribe(($val) => {
					if (!r.rezed) return
					wr.value.set($val)
				})
			}).filter((d) => d)

		// silent write, to prevent flap
		if (dirty) weave.wefts.set(wefts, true)
	})

	return () => {
		cancel()
		weft_cancel.forEach((d) => d())
	}
}

const start_rez = (weave) => {
	const cancel = weave.rezed.listen((_, {
		add,
		remove
	}) => {
		const warps = weave.warps.get()
		// non reactive to weft changes
		add.forEach((key) => {
			const warp = warps[key]
			warp && warp.rez && warp.rez()
			warp.rezed = true
			// notify
			warp.value.notify()
		})

		remove.forEach((key) => {
			const warp = warps[key]
			warp && warp.derez && warp.derez()
			delete warp.rezed
		})
	})

	return () => {
		cancel()
		values(weave.rezed.get()).forEach(
			(warp) => warp && warp.derez && warp.derez()
		)
	}
}

export const start = (weave_name) => {
	if (weave_name === SYSTEM) {
		return
	}

	const weave = get(weave_name)
	if (!weave) return false

	const weft_cancel = start_wefts(weave)
	const rez_cancel = start_rez(weave)

	highways.set(weave_name, () => {
		weft_cancel()
		rez_cancel()
	})

	running_set({
		...running.get(),
		[weave_name]: true
	})
}

export const stop = (weave_name) => {
	if (weave_name === SYSTEM) {
		return
	}

	// Cancel it
	const cancel = highways.get(weave_name)

	if (cancel !== undefined) {
		cancel()
		highways.delete(weave_name)
	}

	// Stop it
	const r = running.get()
	delete r[weave_name]

	running_set(r)
}

export const stop_all = () => {
	const $weaves = weaves.get()

	keys($weaves).forEach(($name) => stop($name))
}

export const clear = () => {
	stop_all()
	weaves.set({
		[SYSTEM]: weaves.get()[SYSTEM]
	})
}

export const restart = (name) => {
	Wheel.stop(name)
	Wheel.start(name)
}

const bump = (what) => JSON.parse(JSON.stringify(what))

export const toJSON = () => ({
	name: name.get(),
	weaves: bump(weaves),
	running: bump(running)
})

export const REG_ID = /\$?[~.]?\/[a-zA-Z !%&/]+/g
