import { tick } from "/sys/time.js"
import { path } from "/sys/path.js"
import { github } from "/sys/file.js"
import { write } from "/store.js"

const VERSION = 2
const TIME_AGO = IDBKeyRange.upperBound(Date.now() - 1000 * 60)
let db

export const loaded = write(false)
export const data = new Promise((resolve) => {
	const req = window.indexedDB.open(`isekai`, VERSION)

	req.onupgradeneeded = async (e) => {
		db = e.target.result
		await db.createObjectStore(`wheel`, { keyPath: `name` })
	}

	req.onsuccess = (e) => {
		db = e.target.result

		resolve(db)
	}
})

export const query = ({
	store = `wheel`,
	action = `get`,
	args = [],
	foronly = `readwrite`
} = false) => new Promise((resolve, reject) => {
	data.then(() => {
		const t = db.transaction([store], foronly)
		t.onerror = reject
		t.objectStore(store)[action](...args).onsuccess = (e) => resolve(e.target.result)
	})
})

export const save = async () => {
	const wheel = Wheel.toJSON()

	wheel.date = Date.now()

	// update current
	await query({
		action: `put`,
		args: [wheel],
		foronly: `readwrite`
	})
}

export const clean = () => query({
	action: `clear`,
	args: [TIME_AGO]
})

window.query = query

const savewatch = async ($name) => {
	loaded.set(false)

	const result = await query({
		action: `get`,
		args: [$name]
	}).catch((e) => console.warn(`DB`, e.target.error))

	if (result) {
		const { weaves, running } = result
		// protect system
		delete weaves[Wheel.SYSTEM]

		Wheel.name.set($name)
		Wheel.spawn(weaves)

		Object.keys(running).forEach((id) => {
			if (id === Wheel.SYSTEM) return
			if (!Wheel.get(id)) return
			Wheel.start(id)
		})
	}

	loaded.set(true)

	const cancel = tick.listen((t) => {
		if (
			t % 10 !== 0 ||
      db === undefined ||
      !loaded.get()
		) return

		save()
	})

	return () => {
		Wheel.clear()
		Wheel.name.set(`loading`)
		cancel()
	}
}

// init()

let watch = false
path.listen(async ($path) => {
	// your watch has ended
	if (watch) watch.then((w) => w())

	if ($path.length === 1) {
		Wheel.name.set($path[0])
		watch = savewatch($path[0])
	}

	if ($path.length === 3) {
		await loaded

		Wheel.name.set(`loading`)

		await github($path, true)

		Wheel.name.set($path.join(`/`))
		watch = savewatch($path.join(`/`))
	}
})
