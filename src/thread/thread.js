// a textual representation of a WEAVE chain
import cuid from "cuid"

const warps = {
	stream: (k) => JSON.stringify(k.value.get()),
	math: (k) => k.math.get().trim(),
	mail: (k) => k.whom.get().trim(),
	default: (k) => k.warp.get(),
	space: (k) => `./${k.value.get(`!name`)}`,
	sprite: (k) => `@${k.value.get()}`,
	color: (k) => `#${k.value.get()}`
}

const warps_is = {
	color: (data) => data[0] === `#`,
	sprite: (data) => data[0] === `@`,
	mail: (data) => {
		const ms = data.match(Wheel.REG_ID)
		if (!ms || ms.length !== 1) return false
		if (ms[0] !== data) return false
		return true
	},
	stream: (data) => {
		try {
			JSON.parse(data)
			return true
		} catch (ex) {
			return false
		}
	}
}

const warps_create = {
	math: (data) => ({
		type: `math`,
		math: data
	}),
	mail: (data) => ({
		type: `mail`,
		whom: data
	}),
	stream: (data) => ({
		type: `stream`,
		value: JSON.parse(data)
	}),
	color: (data) => ({
		type: `color`,
		value: data.slice(1)
	}),
	sprite: (data) => {
		let i = parseInt(data.slice(1))

		if (isNaN(i)) {
			i = 66
		}

		return {
			type: `sprite`,
			value: i
		}
	}
}

const what_is = (data) => {
	const entries = Object.entries(warps_is)
	for (let i = 0; i < entries.length; i++) {
		const [type, fn] = entries[i]
		if (fn(data)) return type
	}

	return `math`
}

const warp_create = (data) => {
	const what = what_is(data)
	return warps_create[what](data)
}

export const decompile = (address, weave) =>
	weave.chain(address).slice(0, -1)
		.map((i) => translate(i, weave))
		.join(` => `)

export const translate = (id, weave) => {
	if (id[0] === `{`) return id

	const warp = weave.warps.get()[id]
	if (!warp) return `space`

	const type = warp.type.get()

	return warps[type]
		? warps[type](warp)
		: type
}

export const compile = ({
	code,
	weave,
	address,
	prefix = ``
}) => {
	const parts = code
		.replace(/[\r\n]/g, ``)
		.split(`=>`)
		.reverse()

	const wefts_update = weave.wefts.get()

	weave.remove(...weave.chain(address).slice(0, -1))

	const space = weave.get_id(address.split(`/`)[0])

	let connection = address
	// lets create these warps
	const ids = parts.map((part) => {
		part = part.trim()

		if (part === ``) return

		const w_data = warp_create(part)
		w_data.id = `${prefix}${cuid()}`

		const k = weave.add(w_data)
		const id = k.id.get()

		wefts_update[id] = connection
		connection = id

		return id
	})

	if (space.rezed) weave.rez(...ids)

	weave.wefts.set(
		wefts_update
	)

	return ids
}

export const format = (txt) => {
	txt = txt.split(`;`)

	txt = txt
		.map((i, k) => {
			i = i.trim()
			if (k !== txt.length - 1) {
				i += `;`
			}
			if (k === txt.length - 2) {
				i += `\r\n`
			}
			return i
		})
		.join(`\r\n`)

	txt = txt
		.split(`=>`)
		.join(`\r\n\r\n=>`)

	return txt
}

export const condense = (link, weave) => {
	const t = translate(link, weave).split(`;`)
	const v = t.pop().trim()

	return t.length > 0
		? `{${t.length}} ${v}`
		: v
}
