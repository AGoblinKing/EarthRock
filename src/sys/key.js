import { read } from "/store.js"

export const key = read(``, (set) => {
	window.addEventListener(`keyup`, (e) => {
		// always allow keyup
		e.preventDefault()

		if (e.code === `ControlRight`) return set(`enter!`)
		set(`${e.key.toLowerCase()}!`)
	})

	window.addEventListener(`keydown`, (e) => {
		if (
			e.target.tagName === `INPUT` || e.target.tagName === `TEXTAREA`
		) {
			return
		}

		e.preventDefault()

		if (e.code === `ControlRight`) return set(`enter`)

		set(e.key.toLowerCase())
	})
})

export const keys = read({}, (set) => {
	const value = {}

	const clear = () => {
		Object.entries(value).forEach(([key, val]) => {
			if (val && key[key.length - 1] !== `!`) {
				value[key] = false
			}
		})

		set(value)
	}

	key.listen((char) => {
		value[char] = true
		if (char.length > 1 && char[char.length - 1] === `!`) {
			value[char.slice(0, -1)] = false
		} else {
			value[`${char}!`] = false
		}
		set(value)
	})

	// really try to avoid stuck keys
	window.addEventListener(`blur`, clear)
	document.addEventListener(`focus`, clear)
	document.addEventListener(`visibilitychange`, clear, false)
})
