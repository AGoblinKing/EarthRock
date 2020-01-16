import { read } from "/store.js"
import { TIME_TICK_RATE } from "/sys/flag.js"

export const tick = read(0, (set) => {
	let intv = false

	TIME_TICK_RATE.listen(($rate) => {
		if (intv) clearInterval(intv)
		intv = setInterval(() => {
			set(tick.get() + 1)
		}, $rate)
	})
})

export const frame = read([0, 0], (set) => {
	let old
	const data = [0, 0]
	const frame_t = (ts) => {
		requestAnimationFrame(frame_t)

		if (old === undefined) old = ts

		data[0] = ts
		data[1] = Math.round(ts - old)

		old = ts
		set(data)
	}

	requestAnimationFrame(frame_t)
})
