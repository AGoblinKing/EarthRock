import Weave from "./weave.js"
import { write, read, any } from "/util/store.js"

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

// put into trash bin
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
		knot_name,
		chan
	] = addr(address)

	const w = weaves.get()[weave_name]
	if (w === undefined) return
	if (knot_name === undefined) return w

	const k = w.names.get()[knot_name]
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

const start_threads = (weave) => {
	let threads = []
	const cancel = any(weave.threads, weave.rezed)((ts, rezed) => {
		let dirty = false
		const connected = new Set()

		// tear down existing highways
		if (threads) threads.forEach((d) => d())

		threads = Object.entries(ts)
			// don't turn on derezed chains
			.filter(([reader, writer]) => {
				if (connected.has(writer)) return true
				const c = weave.chain(writer, true)
				const [base_id] = c[0].split(`/`)
				const other = weave.get_id(base_id)

				if (!other) {
					delete ts[reader]
					dirty = true
					return false
				}

				const ready = other.knot.get() === `stitch` &&
					rezed[base_id]

				if (ready) {
					c.forEach((id) => connected.add(id))
				}

				return ready
			})
			.map(([
				reader,
				writer
			]) => {
				const r = weave.get_id(reader)
				const wr = weave.get_id(writer)

				if (!wr || !r) {
					dirty = true
					delete ts[reader]
					return
				}

				return r.value.subscribe(($val) => {
					wr.value.set($val)
				})
			}).filter((d) => d)

		// silent write, to prevent flap
		if (dirty) weave.threads.set(ts, true)
	})

	return () => {
		cancel()
		threads.forEach((d) => d())
	}
}

const start_lives = (weave) => {
	const $lives = weave.lives.get()
	const $rezed = weave.rezed.get()
	const on = {
		...$rezed
	}

	// initial rez
	const lives = Object.fromEntries(
		Object.keys($lives)
			.filter((id) => {
				if (on[id]) return true

				// chain to right
				const c = weave.chain(id, true)
				const last = weave.get_id(c[0])

				// no knot means channel
				if (!last || (last.knot && last.knot.get() !== `stitch`)) {
					// no channel
					return false
				}

				// inform on about our success
				c.forEach((c_id) => {
					on[c_id] = true
				})

				return true
			})
			.map((id) => [id, $lives[id]()])
	)
	const len = (o) => Object.keys(o).length
	console.log(len(lives), len($lives))

	return () => Object.values(lives).forEach((d) => d())
}

export const start = (weave_name) => {
	if (weave_name === SYSTEM) {
		return
	}

	const weave = get(weave_name)
	if (!weave) return false

	const life_cancel = start_lives(weave)
	const thread_cancel = start_threads(weave)

	highways.set(weave_name, () => {
		life_cancel()
		thread_cancel()
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

	Object.keys($weaves).forEach(($name) => stop($name))
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

export const REG_ID = /\$?[~\.]?\/[a-zA-Z \/]+/g
