import { Store, Read } from 'src/store'

class BrowserPath extends Store<Array<string>> {
	constructor(start: string[]) {
		super(start)

		window.addEventListener(`popstate`, e => {
			e.preventDefault()
			e.stopPropagation()
			this.path_update()
		})

		this.path_update()
	}

	protected path_update() {
		const path_str = window.location.search
			? window.location.search.slice(1)
			: window.location.pathname.slice(1)

		this.set(decodeURI(path_str).replace(/ /g, `_`))
	}

	set(path_new: string | Array<string>) {
		if (Array.isArray(path_new)) {
			return super.set(path_new)
		}

		super.set(path_new.split(`/`))
	}
}

export const path = new BrowserPath([])

export const flag = new Read('', set => {
	set(window.location.hash)
})
