import { writable, get, readable } from "svelte/store"

import Stitch from "../type/stitch.js"
import Node from "../type/node.js"
import { random } from "/util/text.js"

export default ({
  // just some default nodes for start
  nodes = {
    // guarantees the key and id will be the same
    example: Stitch({
      id: `example`,
      chan: {
        [random(1)]: false,
        [random(1)]: false
      }
    })
  },
  type = ``,
  threads = {},
  ...junk
} = false) => {
  let threads_set
  const w = Node({
    ...junk,
    nodes: writable(nodes),
    type: `${type} weave`,
    threads: readable(threads, set => {
      threads_set = set
    }),
    // okay this important so you can clean up bad wires
    give_thread: writable(),
    take_thread: writable()
  })

  const weave = get(w)

  weave.give_thread.subscribe((match) => {
    if (!match) return

    const [x, y] = match

    const [x_name, y_name] = [x.split(`|`).length === 1, y.split(`|`).length === 1]

    const is_name = x_name || y_name

    // red to blue not samies
    if (!is_name && x.slice(-1) === y.slice(-1)) return
    if (is_name && x[0] === `/` && y[0] === `/`) return
    const threads = get(weave.threads)

    // clean up
    if (threads[x]) {
      delete threads[threads[x]]
    }

    if (threads[y]) {
      delete threads[threads[y]]
    }

    threads[x] = y
    threads[y] = x

    threads_set(threads)
  })

  return w
}
