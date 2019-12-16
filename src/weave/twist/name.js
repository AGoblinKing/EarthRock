import { write } from "/util/store.js"

const re_name = /^[ a-zA-Z0-9]+$/

// TODO regex for name + components! (twists!)
// Wow!
export default ({
  name
}) => {
  re_name
  const n = write()

  const { set } = n

  n.set = (value) => {
    value = value.trim()
    if (!value.test(re_name)) {

    }
  }

  return n
}
