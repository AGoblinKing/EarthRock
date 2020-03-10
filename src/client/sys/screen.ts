import { Read, Store } from "src/store"

export const size = new Read([window.innerWidth, window.innerHeight], (set) => {
	window.addEventListener(`resize`, () => {
		set([window.innerWidth, window.innerHeight])
	})
})

export const scale = new Store(1)

size.listen(([width, height]) => {
	const target = width > height
		? height
		: width

	scale.set(target / 80)
	window.document.documentElement.style.fontSize = `${Math.round(scale.get())}px`
})

export const clear_color = new Store([0, 0, 0, 1])