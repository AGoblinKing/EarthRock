import { Store, Read } from "src/store"
import raf from "raf"

let tick_set
export const tick = new Read(0, (set) => {
	tick_set = set
})

let last_tick = Date.now()
export const TIME_TICK_RATE = new Store(100)

const frame = new Read([0, 0], (set) => {
	let old
	
	const data = [0, 0]
	const frame_t = (ts) => {
		raf(frame_t)

		if (old === undefined) old = ts

		data[0] = ts
		data[1] = Math.round(ts - old)

		old = ts
		const now = Date.now()
		if (now - last_tick >= TIME_TICK_RATE.get()) {
			last_tick = now
			tick_set(tick.get() + 1)
		}

		set(data)
	}

	raf(frame_t)
})
