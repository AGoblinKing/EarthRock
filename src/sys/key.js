import { read } from "/store.js"

export const key = read(``, (set) => {
	window.addEventListener(`keyup`, (e) => {
		if (
			e.target.tagName === `INPUT` ||
      e.target.tagName === `TEXTAREA`
		) {
			return
		}

		e.preventDefault()

		set(`${e.key.toLowerCase()}!`)
	})

	window.addEventListener(`keydown`, (e) => {
		if (
			e.target.tagName === `INPUT` ||
      e.target.tagName === `TEXTAREA`
		) {
			return
		}

		e.preventDefault()

		set(e.key.toLowerCase())
	})
})

export const keys = read({}, (set) => {
	const value = {}

	key.listen((char) => {
		value[char] = true
		if (char.length > 1 && char[char.length - 1] === `!`) {
			value[char.slice(0, -1)] = false
		} else {
			value[`${char}!`] = false
		}
		set(value)
	})
})
