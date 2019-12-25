import * as twgl from "twgl"
import { TIME_TICK_RATE } from "/sys/flag.js"
import { tick } from "/sys/time.js"

const blank = () => ({
	sprite: [],

	position: [],
	position_last: [],

	scale: [],
	scale_last: [],

	color: [],
	color_last: [],

	alpha: [],
	alpha_last: [],

	rotation: [],
	rotation_last: []
})

const defaults = Object.entries({
	position: [0, 0, 0],
	sprite: [0],
	scale: [1],
	color: [0xFFFFFF],
	rotation: [0],
	alpha: [1]
})

const verts = twgl.primitives.createXYQuadVertices(1)

let count = 0

const buffer = {
	...Object.fromEntries(Object.entries(verts).map(
		([key, val]) => {
			val.divisor = 0
			return [key, val]
		}
	)),
	translate_last: {
		divisor: 1,
		data: [],
		numComponents: 3
	},
	translate: {
		divisor: 1,
		data: [],
		numComponents: 3
	},
	rotation: {
		numComponents: 1,
		data: [],
		divisor: 1
	},
	rotation_last: {
		numComponents: 1,
		data: [],
		divisor: 1
	},
	alpha: {
		numComponents: 1,
		data: [],
		divisor: 1
	},
	alpha_last: {
		numComponents: 1,
		data: [],
		divisor: 1
	},
	color: {
		numComponents: 1,
		data: [],
		divisor: 1
	},
	color_last: {
		numComponents: 1,
		data: [],
		divisor: 1
	},
	sprite: {
		numComponents: 1,
		data: [],
		divisor: 1
	},
	scale: {
		numComponents: 1,
		data: [],
		divisor: 1
	},
	scale_last: {
		numComponents: 1,
		data: [],
		divisor: 1
	}
}

const last = {
	position: {},
	scale: {},
	alpha: {},
	color: {},
	rotation: {}
}

let last_snap = Date.now()

export const snapshot = () => ({
	count,
	buffer,
	time: (Date.now() - last_snap) / TIME_TICK_RATE.get()
})

// RAF so it happens at end of frame
tick.listen(() => requestAnimationFrame(() => {
	const buffs = blank()
	const running = Wheel.running.get()

	const set_last = (key, id, count = 1) => {
		const key_last = last[key][id] || buffs[key].slice(-count)
		last[key][id] = buffs[key].slice(-count)
		buffs[`${key}_last`].push(...key_last)
	}

	Object.values(Wheel.weaves.get()).forEach((weave) => {
		// not running
		if (!running[weave.name.get()]) return

		const rezed = weave.rezed.get()
		let dirty = false
		Object.keys(rezed).forEach((id) => {
			const knot = weave.get_id(id)

			if (!knot || knot.knot.get() !== `stitch`) {
				dirty = true
				delete rezed[id]
				return
			}

			const vs = knot.value.get()

			defaults.forEach(([key, def]) => {
				if (!vs[key]) {
					return buffs[key].push(...def)
				}

				let value = vs[key].get()

				if (typeof value === `number`) {
					value = [value]
				}

				if (!Array.isArray(value)) {
					return buffs[key].push(...def)
				}

				const result = []
				for (let i = 0; i < def.length; i++) {
					if (typeof value[i] !== `number` || i >= value.length) {
						result.push(def[i])
						return
					}
					result.push(value[i])
				}

				buffs[key].push(...result)
			})

			set_last(`position`, id, 3)
			set_last(`scale`, id)
			set_last(`alpha`, id)
			set_last(`rotation`, id)
			set_last(`color`, id)
		})

		// clean up bad rezes
		if (dirty) weave.rezed.set(rezed)
	})

	Object.entries(buffs).forEach(([key, buff]) => {
		if (key === `position`) {
			buffer.translate.data = buff
			return
		}
		if (key === `position_last`) {
			buffer.translate_last.data = buff
			return
		}

		buffer[key].data = buff
	})

	count = buffer.sprite.data.length
	last_snap = Date.now()
}))
