import Hole from "./hole.js"
import { random } from "/util/text.js"
import { writable } from "svelte/store"

export default ({
  view = `JSON`,
  type = ``,
  ...junk
} = false) => {
  const value = writable(random(2))
  const set = value.set

  value.set = (val) => {
    try {
      set(JSON.parse(val))
    } catch (ex) {
      set(`! ErRoR !`)
    }
  }

  return Hole({
    ...junk,
    type: `${type} view`,
    value,
    value_overwrite: true
  })
}
