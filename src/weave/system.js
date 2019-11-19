import Weave from "./weave.js"

// lets grab all the channels here
import * as mouse from "/sys/mouse.js"
import * as time from "/sys/time.js"
import * as screen from "/sys/screen.js"

const tie = (items) =>
  Object.entries(items)
    .reduce((result, [key, value]) => ({
      ...result,
      [key]: {
        name: key,
        knot: `stitch`,
        value
      }
    }), {})

export default Weave({
  knots: tie({
    mouse,
    time,
    screen
  })
})
