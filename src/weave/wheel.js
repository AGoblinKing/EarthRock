import Weave from "./weave.js"

// weaves [id]weave
const weaves = new Map()

// maybe create a bunch of locked stitches per channel
// .instead?
weaves.set(`root`, Weave({
  id: `root`,
  name: `root`,

  // have a bunch of locked stitches
  knots: {

  }
}))

export default ({
  weaves
})
