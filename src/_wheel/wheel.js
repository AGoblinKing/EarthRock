import Weave from "/weave/weave.js"
import { write, read } from "/store.js"
import { values, keys, map, store_JSON } from "/object.js"

export * from "/weave/thread.js"

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

	let warp = w.names.get()[warp_name]

	if (warp === undefined) {
		warp = w.warps.get()[warp_name]
		if (!warp) return
	}

	if (chan === undefined) return warp
	const value = warp.value.get()
	if (!value) return

	const c = value[chan]
	if (c === undefined) return

	return c
}

export const exists = (address) => get(address) !== undefined

// create the whole path if you gotta
export const spawn = (pattern = {}) => map(pattern)(([
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

const start_wefts = (weave) => {
	const weft_cancels = {}

	const cancel = weave.wefts.listen((wefts, {
		add,
		remove,
		modify
	}) => {
		let dirty

		[...add, ...modify].forEach((reader) => {
			const writer = wefts[reader]
			const r = weave.get_id(reader)
			const wr = weave.get_id(writer)

			if (!wr || !r) {
				dirty = true
				delete wefts[reader]
				return
			}

			if (weft_cancels[reader]) weft_cancels[reader]()

			weft_cancels[reader] = r.value.subscribe(($val) => {
				if (!r.rezed) return
				wr.value.set($val)
			})
		})

		remove.forEach((key) => {
			const r = weft_cancels[key]
			if (!r) return
			r()
			delete weft_cancels[key]
		})

		if (dirty) {
			weave.wefts.set(wefts, true)
		}
	})

	return () => {
		cancel()
		values(weft_cancels).forEach((d) => d())
	}
}

const start_rez = (weave) => {
	const cancel = weave.rezed.listen(($rezed, {
		add,
		remove
	}) => {
		const deletes = []

		const warps = weave.warps.get()
		// non reactive to weft changes
		add.forEach((key) => {
			const warp = warps[key]

			// zombie rez
			if (!warp) {
				delete $rezed[key]
				return deletes.push(key)
			}

			warp.rez && warp.rez()
			warp.rezed = true

			// TODO: Maybe not?
			// notify to refresh now that a rez has happened
			warp.value.notify()
		})

		remove.forEach((key) => {
			const warp = warps[key]
			if (!warp) {
				delete $rezed[key]
				return deletes.push(key)
			}

			warp.derez && warp.derez()
			delete warp.rezed
		})

		if (deletes.length > 0) {
			weave.rezed.set($rezed, true)
		}
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

export const toJSON = () => ({
	name: name.get(),
	weaves: store_JSON(weaves),
	running: running.toJSON()
})

export const REG_ID = /\$?[~.]?\/[a-zA-Z 0-9!%&/]+/g

export const shared = {}
