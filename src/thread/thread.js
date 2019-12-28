// a textual representation of a WEAVE chain

const knots = {
	stream: (k) => JSON.stringify(k.value.get()),
	math: (k) => k.math.get().trim(),
	mail: (k) => k.whom.get().trim(),
	default: (k) => k.knot.get(),
	stitch: (k) => `./${k.name.get()}`,
	sprite: (k) => `@${k.value.get()}`,
	color: (k) => `#${k.value.get()}`
}

const knots_is = {
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

const knots_create = {
	math: (data) => ({
		knot: `math`,
		math: data
	}),
	mail: (data) => ({
		knot: `mail`,
		whom: data
	}),
	stream: (data) => ({
		knot: `stream`,
		value: JSON.parse(data)
	}),
	color: (data) => ({
		knot: `color`,
		value: data.slice(1)
	}),
	sprite: (data) => {
		let i = parseInt(data.slice(1))

		if (isNaN(i)) {
			i = 66
		}

		return {
			knot: `sprite`,
			value: i
		}
	}
}

const what_is = (data) => {
	const entries = Object.entries(knots_is)
	for (let i = 0; i < entries.length; i++) {
		const [type, fn] = entries[i]
		if (fn(data)) return type
	}

	return `math`
}

const knot_create = (data) => {
	const what = what_is(data)
	return knots_create[what](data)
}

export const decompile = (address, weave) =>
	weave.chain(address).slice(0, -1)
		.map((i) => translate(i, weave))
		.join(` => `)

export const translate = (id, weave) => {
	if (id[0] === `{`) return id

	const knot = weave.knots.get()[id]
	if (!knot) return `stitch`

	const type = knot.knot.get()

	return knots[type]
		? knots[type](knot)
		: type
}

export const compile = (code, weave, address) => {
	const parts = code
		.replace(/[\r\n]/g, ``)
		.split(`=>`)
		.reverse()

	const threads_update = weave.threads.get()
	const knots = weave.knots.get()

	weave.chain(address).forEach((id) => {
		delete knots[id]
		delete threads_update[id]
	})

	weave.knots.set(knots)

	let connection = address

	// lets create these knots
	parts.forEach((part) => {
		part = part.trim()

		if (part === ``) return

		const w_data = knot_create(part)

		const k = weave.add(w_data)

		threads_update[k.id.get()] = connection
		connection = k.id.get()
	})

	weave.threads.set(
		threads_update
	)

	weave.validate()
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
