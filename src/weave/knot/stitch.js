import { write, read } from "/util/store.js"
import { random } from "/util/text.js"

export default ({
  value = {
    [random(2)]: `"${random(2)}"`
  }
}) => ({
  knot: read(`stitch`),

  value: write(Object
    .entries(value)
    .reduce((res, [key, val]) => {
      res[key] = write(val)
      return res
    }, {}))
})
