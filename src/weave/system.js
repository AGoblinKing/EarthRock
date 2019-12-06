import Weave from "./weave.js"

// lets grab all the systems here
import * as mouse from "/sys/mouse.js"
import * as time from "/sys/time.js"
import * as screen from "/sys/screen.js"
import * as input from "/sys/input.js"
import * as key from "/sys/key.js"
import * as flag from "/sys/flag.js"

// private sytems
import "/sys/data.js"
import "/sys/weave.js"
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
  name: `sys`,
  id: `sys`,
  knots: tie({
    mouse,
    time,
    screen,
    input,
    key,
    flag
  })
})
