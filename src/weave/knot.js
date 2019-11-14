import uuid from "cuid"
import { read, transformer } from "/util/store.js"
import { random } from "/util/text.js"
import { powerToJSON } from "/util/vector.js"

import * as knots from "./knots.js"

// the basic knot
export default ({
  id = uuid(),
  knot,
  name = random(2),
  weave,

  ...rest
} = false) => powerToJSON({
  ...(knots[knot]
    ? knots[knot](rest)
    : { knot: read(knot) }
  ),

  id: read(id),

  name: transformer((name_new) => {
    // tell weave it update its knots
    // probably should be on a channel instead
    weave && weave.knots && weave.knots.poke()
    return name_new
  }).set(name)
})
