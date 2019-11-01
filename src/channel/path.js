import { writable } from "svelte/store"

const path = writable(window.location.pathname.slice(1))

path.subscribe((new_path) => {
  if (window.location.pathname === new_path) {
    return
  }

  window.history.pushState({ page: 1 }, ``, `/${new_path}`)
})

export default path
