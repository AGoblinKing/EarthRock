import Hole from "./hole.js"

import { writable } from "svelte/store"

export default ({
  type = ``,
  ...junk
} = false) => {
  const value = writable()
  const set = value.set

  value.set = (val) => {
    try {
      set(JSON.parse(val))
    } catch (ex) {
      set(`! ErRoR ! - BAD JSON`)
    }
  }

  value.set(`null`)

  return Hole({
    ...junk,
    type: `${type} json`,
    value,
    // these value overwrites feel wrong
    value_overwrite: true
  })
}
