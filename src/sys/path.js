import { transformer } from "/store.js"

export const path = transformer((path_new) => {
	if (Array.isArray(path_new)) {
		return path_new
	}

	return path_new.split(`/`)
})

window.addEventListener(`popstate`, (e) => {
	e.preventDefault()
	e.stopPropagation()
	update()
})

const update = () => {
	const path_str = window.location.search
		? window.location.search.slice(1)
		: window.location.pathname.slice(1)

	path.set(decodeURI(path_str))
}

update()
