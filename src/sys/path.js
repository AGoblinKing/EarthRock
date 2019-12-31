import { transformer } from "/store.js"

let use_search = ``

export const path = transformer((path_new) => {
	window.history.pushState({ page: 1 }, ``, `${use_search}${path_new}`)
	if (Array.isArray(path_new)) {
		return path_new
	}

	const path_split = path_new.split(`/`)
	if (window.location.pathname === path_new) {
		return path_split
	}

	return path_split
})

window.addEventListener(`popstate`, (e) => {
	e.preventDefault()
	e.stopPropagation()
	update()
})

const update = () => {
	if (window.location.search) {
		use_search = `?`
		path.set(decodeURI(window.location.search.slice(1)))
	} else {
		path.set(decodeURI(window.location.pathname.slice(1)))
	}
}

update()
