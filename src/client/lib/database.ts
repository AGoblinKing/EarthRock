import { Store } from "src/store"
import { IWheelJSON } from "src/wheel"

const VERSION = 2
const TIME_AGO = IDBKeyRange.upperBound(Date.now() - 1000 * 60)
let db

const store_name = `wheel`

export const loaded = new Store(false)
export const data = new Promise((resolve) => {
	const req = window.indexedDB.open(`earthrock`, VERSION)

	req.onupgradeneeded = async (e: any) => {
		db = e.target.result
		await db.createObjectStore(store_name, { keyPath: `name` })
	}

	req.onsuccess = (e: any) => {
		db = e.target.result

		resolve(db)
	}
})

export const query = ({
	store = store_name,
	action = `get`,
	args = [],
	foronly = `readnew Store`
} = {}) => new Promise((resolve, reject) => {
	data.then(() => {
		const t = db.transaction([store], foronly)
		t.onerror = reject
		t.objectStore(store)[action](...args).onsuccess = (e) => resolve(e.target.result)
	})
})

export const save = async (wheel: IWheelJSON ) => {
	wheel.date = Date.now()

	// update current
	await query({
		action: `put`,
		args: [wheel],
		foronly: `readnew Store`
	})
}

export const clean = () => query({
	action: `clear`,
	args: [TIME_AGO]
})

