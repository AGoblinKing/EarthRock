import uuid from "cuid"
import { read } from "/util/store.js"
import * as knots from "./knots.js"

// the basic knot
export default ({
  id = uuid(),
  knot,

  ...rest
} = false) => {
  const k = {
    ...(knots[knot]
      ? knots[knot]({
        ...rest,
        id
      })
      : { knot: read(knot) }
    ),

    id: read(id),
    toJSON: () => k
  }
  return k
}
