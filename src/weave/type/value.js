import { writable, derived } from "svelte/store"
import Node from "./node.js"
import { random } from "/util/text.js"

export default ({
  value = {
    [random(2)]: `"${random(2)}"`
  },
  type = ``,
  ...junk
} = false) => {
  const write = writable(value)

  return Node({
    ...junk,
    type: `${type} value`,
    write,
    read: derived(write, ($write) => {
      try {
        return JSON.parse($write)
      } catch (ex) {
        return $write
      }
    })
  })
}
