import { transformer } from "/util/store.js"

export const path = transformer((path_new) => {
  if (Array.isArray(path_new)) {
    return path_new
  }

  const path_split = path_new.split(`/`)
  if (window.location.pathname === path_new) {
    return path_split
  }

  // window.history.pushState({ page: 1 }, ``, `/${path_new}`)

  return path_split
})

if (window.location.search) {
  path.set(decodeURI(window.location.search.slice(1)))
} else {
  path.set(decodeURI(window.location.pathname.slice(1)))
}
