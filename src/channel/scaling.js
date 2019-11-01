import { writable } from "svelte/store"
import { size } from "./screen.js"

const scaling = writable(1)

size.subscribe(([width, height]) => {
  const target = width > height ? height : width
  // try to peg 10 cards always\
  // ^ well that is a lie. magic numbers below
  scaling.set(target / (500 * 2))
})

export default scaling
