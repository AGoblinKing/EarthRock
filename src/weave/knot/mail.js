import { transformer, write, get, read } from "/util/store.js"

// instead use the weave messaging channel
export default ({
  whom = ``
}) => {
  // Subscribe to remote
  const m = ({
    knot: read(`mail`),
    whom: write(whom),
    remote: write(),
    value: transformer((value) => {
      // Got a write onto value
      m.remote(value)

      // Send off to remote and rely results
      return get(m.remote)
    })
  })

  return m
}
