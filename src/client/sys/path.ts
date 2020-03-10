import { Store } from "src/store"

class Path extends Store<Array<string>> {
	constructor(start: string[]) {
		super(start)

		window.addEventListener(`popstate`, (e) => {
			e.preventDefault()
			e.stopPropagation()
			this.path_update()
		})
		
		this.path_update()
	}

	protected path_update () {
		const path_str = window.location.search
				? window.location.search.slice(1)
				: window.location.pathname.slice(1)
		
		path.set(decodeURI(path_str).replace(/ /g, `_`))
	}

	set (path_new: string | Array<string>) {
		if (Array.isArray(path_new)) {
			return path_new
		}
	
		return path_new.split(`/`)
	}
}

export const path = new Path([])
