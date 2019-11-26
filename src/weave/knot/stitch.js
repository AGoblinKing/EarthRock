import { map, read, transformer } from "/util/store.js"
import { random } from "/util/text.js"

export default ({
  value = {},
  name = random(2),
  weave
}) => ({
  knot: read(`stitch`),

  value: map(value),

  name: transformer((name_new) => {
    // tell weave it update its knots
    // probably should be on a channel instead
    weave && weave.knots && weave.knots.poke()
    return name_new
  }).set(name)
})
