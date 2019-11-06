import Hole from "./hole.js"
import { writable } from "svelte/store"

export default ({
  type = ``,
  whom = ``
}) => Hole({
  type: `${type} mail`,
  whom: writable(whom)
})
