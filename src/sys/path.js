import { write } from "/util/store.js"

export const path = write(window.location.pathname.slice(1))

path.subscribe((new_path) => {
  if (window.location.pathname === new_path) {
    return
  }

  window.history.pushState({ page: 1 }, ``, `/${new_path}`)
})
