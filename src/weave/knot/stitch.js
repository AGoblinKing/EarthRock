import { write, read, transformer } from "/util/store.js"
import { random } from "/util/text.js"

const report = (key, store) => {
  if (store._reporter) return store

  const sub = store.subscribe

  store._reporter = true
  store.subscribe = (fn) => {
    return sub((val) => {
      fn(val, key)
    })
  }

  return store
}

export default ({
  value = {},
  name = random(2),
  weave
}) => ({
  knot: read(`stitch`),

  value: write(Object
    .entries(value)
    .reduce((res, [key, val]) => {
      res[key] = (val && typeof val.subscribe === `function`)
        ? report(key, val)
        : report(key, write(val))
      return res
    }, {})),

  name: transformer((name_new) => {
    // tell weave it update its knots
    // probably should be on a channel instead
    weave && weave.knots && weave.knots.poke()
    return name_new
  }).set(name)
})
