import { read } from "/store.js"
import { TIME_TICK_RATE } from "/sys/flag.js"

let tick_set
export const tick = read(0, (set) => {
	tick_set = set
})

let last_tick = Date.now()

export const frame = read([0, 0], (set) => {
	let old
	const data = [0, 0]
	const frame_t = (ts) => {
		requestAnimationFrame(frame_t)

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

	requestAnimationFrame(frame_t)
})
