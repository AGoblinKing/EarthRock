import { write, read } from "/util/store.js"

export default () => {
  const value = write()
  const set = value.set

  value.set = (val) => {
    try {
      set(JSON.parse(val))
    } catch (ex) {
      set(val)
    }
  }

  value.set(`null`)

  return ({
    knot: read(`stream`),
    value
  })
}
