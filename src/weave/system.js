import Weave from "./weave.js"

// lets grab all the channels here
import * as mouse from "/channel/mouse.js"

export default Weave({
  knots: {
    mouse: {
      name: `mouse`,
      knot: `stitch`,
      value: mouse
    }
  }
})
