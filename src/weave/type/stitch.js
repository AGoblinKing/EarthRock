import Hole from "./hole.js"
import { writable } from "svelte/store"
import { random } from "/util/text.js"

export default ({
  value = {
    [random(2)]: `"${random(2)}"`
  },
  type = ``,
  ...junk
} = false) => Hole({
  ...junk,
  type: `${type} stitch`,
  value: Object
    .entries(value)
    .reduce((res, [name, val]) => {
      res[name] = writable(val)
      return res
    }, {})
})
