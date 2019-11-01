import node from "./node.js"

export default ({
  view = `JSON`,
  ...junk
}) => node({
  ...junk,
  view
})
