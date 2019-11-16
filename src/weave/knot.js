import uuid from "cuid"
import { read } from "/util/store.js"
import { powerToJSON } from "/util/vector.js"

import * as knots from "./knots.js"

// the basic knot
export default ({
  id = uuid(),
  knot,

  ...rest
} = false) => powerToJSON({
  ...(knots[knot]
    ? knots[knot]({
      ...rest,
      id
    })
    : { knot: read(knot) }
  ),

  id: read(id)
})
