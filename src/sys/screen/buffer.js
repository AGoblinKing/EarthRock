import * as twgl from "twgl"
import { TIME_TICK_RATE } from "/sys/flag.js"
import { tick } from "/sys/time.js"
import { visible } from "/weave/twist/visible.js"
import { map, values, each, keys } from "/object.js"

const defaults = {
	position: [0, 0, 0],
	sprite: [0],
	scale: [1],
	color: [0xFFFFFF],
	rotation: [0],
	alpha: [1],
	flags: [0]
}

const verts = twgl.primitives.createXYQuadVertices(1)

let count = 0

const buffer = {
	...map(verts)(
		([key, val]) => {
			val.divisor = 0
			return [key, val]
		}
	),
	translate_last: {
		divisor: 1,
		data: new Float32Array(3),
		numComponents: 3
	},
	translate: {
		divisor: 1,
		data: new Float32Array(3),
		numComponents: 3
	},
	rotation: {
		numComponents: 1,
		data: new Float32Array(1),
		divisor: 1
	},
	rotation_last: {
		numComponents: 1,
		data: new Float32Array(1),
		divisor: 1
	},
	alpha: {
		numComponents: 1,
		data: new Float32Array(1),
		divisor: 1
	},
	alpha_last: {
		numComponents: 1,
		data: new Float32Array(1),
		divisor: 1
	},
	color: {
		numComponents: 1,
		data: new Int32Array(1),
		divisor: 1
	},
	color_last: {
		numComponents: 1,
		data: new Int32Array(1),
		divisor: 1
	},
	sprite: {
		numComponents: 1,
		data: new Float32Array(1),
		divisor: 1
	},
	flags: {
		numComponents: 1,
		data: new Int32Array(1),
		divisor: 1
	},
	scale: {
		numComponents: 1,
		data: new Float32Array(1),
		divisor: 1
	},
	scale_last: {
		numComponents: 1,
		data: new Float32Array(1),
		divisor: 1
	}
}

let last_snap = Date.now()

const get_time = () => {
	const t = (Date.now() - last_snap) / TIME_TICK_RATE.get()

	return t
}

let buffer_info
const get_buffer = (gl) => {
	if (buffer_info) {
		each(buffer)(([key, { data, divisor }]) => {
			if (divisor !== 1) return
			twgl.setAttribInfoBufferFromArray(
				gl,
				buffer_info.attribs[key],
				data
			)
		})

		return buffer_info
	}

	buffer_info = twgl.createBufferInfoFromArrays(
		gl,
		buffer
	)

	dirty = true
	return buffer_info
}

let dirty
export const snapshot = (gl) => {
	const result = {
		count,
		buffer_info: get_buffer(gl),
		time: get_time(),
		dirty
	}

	if (dirty) dirty = false
	return result
}

const keydex = {}

let buffer_count = 0

const available = []

const expand = (amount = 100) => {
	buffer_info = false

	const count_new = buffer_count + amount

	values(buffer).forEach(({
		divisor,
		data,
		numComponents
	}) => {
		if (divisor !== 1) return
		each(buffer)(([_, buff]) => {
			const { data, numComponents, divisor } = buff
			if (divisor !== 1) return

			buff.data = new data.__proto__.constructor(numComponents * count_new)

			buff.data.set(data, 0)
		})
	})

	available.push(...[...Array(amount)].map((_, i) => buffer_count + i))
	buffer_count = count_new
}

const to_idx = (key) => {
	if (keydex[key] === undefined) {
		// grab an available key
		if (available.length === 0) {
			expand()
		}

		keydex[key] = available.shift()
	}

	return keydex[key]
}

// free the key value and make the idx available
const free = (key) => {
	const idx = keydex[key]
	// this key is freEEeee already
	if (idx === undefined) return

	available.push(idx)

	each(buffer)(([_, { data, numComponents, divisor }]) => {
		if (divisor !== 1) return

		// zero it out
		data.set([...Array(numComponents)].fill(0), idx * numComponents)
	})
}

let last_update
// RAF so it happens at end of frame
tick.listen(() => requestAnimationFrame(() => {
	if (!buffer_info) return

	// grab the shiz
	const { update, remove, add } = visible.hey()

	// add all the defaults for each one
	add.forEach((key) => {
		each(defaults)(([key_d, val]) => {
			if (buffer[`${key_d}_last`]) {
				const idx = to_idx(key)
				const { data, numComponents } = buffer[`${key_d}_last`]

				data.set([...val], idx * numComponents)
			}

			// already set
			if (update[key] && update[key][key_d] !== undefined) return

			update[key][key_d] = visible.value[key][key_d] === undefined
				? visible.value[key].get_value(key_d)
				: [...val]
		})
	})

	each(update)(([key, space]) => {
		const idx = to_idx(key)
		last_update.delete(key)

		each(buffer)(([key_b, { data, divisor, numComponents }]) => {
			if (divisor !== 1 || key_b.indexOf(`_last`) !== -1) return

			const bdx = idx * numComponents

			// alias positon to translate
			const space_key = key_b === `translate` ? `position` : key_b
			const twist = space[space_key]

			let update_set
			// TODO: Maybe store all values in twists as TypeArrays?
			if (typeof twist === `number`) {
				update_set = [...Array(numComponents)].fill(twist)
			} else if (Array.isArray(twist)) {
				// assume under not over
				if (twist.length < numComponents) {
					for (let i = numComponents - twist.length; i < twist.length; i++) {
						twist[i] = defaults[space_key][i]
					}
				}

				update_set = twist.slice(0, numComponents)
			} else {
				// otherwise wtf was that? lets set default
				update_set = [...data.subarray(bdx, bdx + numComponents)]
			}

			// update your last buffer if it exists
			if (buffer[`${key_b}_last`] !== undefined) {
				const { data: data_last } = buffer[`${key_b}_last`]

				data_last.set([...data.subarray(bdx, bdx + numComponents)], bdx)
			}

			return data.set(update_set, bdx)
		})
	})

	remove.forEach((key) => {
		last_update.delete(key)
		free(key)
	})

	last_update && last_update.forEach((key) => {
		const idx = to_idx(key)

		each(buffer)(([key_b, { data, divisor, numComponents }]) => {
			if (divisor !== 1 || key_b.indexOf(`_last`) !== -1) return

			const bdx = idx * numComponents

			if (buffer[`${key_b}_last`] !== undefined) {
				const { data: data_last } = buffer[`${key_b}_last`]

				data_last.set([...data.subarray(bdx, bdx + numComponents)], bdx)
			}
		})
	})

	count = buffer_count
	last_snap = Date.now()
	last_update = new Set(keys(update))
}))
