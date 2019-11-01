// give a human readable name to a thing
// like a hat
// weave maintains the alias
// but these nodes are used to keep track of them
import Node from "./node.js"
import { random } from "../../util/text.js"
import { writable } from "svelte/store"

export default ({
  name = random(2),
  whom,
  type = ``,
  ...junk
} = false) => Node({
  ...junk,
  type: `${type} name`,
  name: writable(name),
  whom: writable(whom)
})
