import { read, write } from "/util/store.js"

export default ({
  value = 66
}) => ({
  knot: read(`sprite`),
  value: write(value)
})
