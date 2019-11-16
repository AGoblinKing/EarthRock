import { write, read, transformer } from "/util/store.js"
import { random } from "/util/text.js"

export default ({
  value = {},
  name = random(2),
  weave
}) => ({
  knot: read(`stitch`),

  value: write(Object
    .entries(value)
    .reduce((res, [key, val]) => {
      res[key] = (val && typeof val.subscribe === `function`)
        ? val
        : write(val)
      return res
    }, {})),

  name: transformer((name_new) => {
    // tell weave it update its knots
    // probably should be on a channel instead
    weave && weave.knots && weave.knots.poke()
    return name_new
  }).set(name)
})
