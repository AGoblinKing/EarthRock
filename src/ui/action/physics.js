import { bodies } from "/sys/weave.js"
import { tick } from "/sys/time.js"

export default (node, id) => {
  const update = () =>
    bodies.update(($b) => ({
      ...$b,
      [id]: [
        node.offsetWidth,
        node.offsetHeight
      ]
    }))

  update()

  // const cancel = tick.listen(() => {
  //   const [w, h] = bodies.get()[id]

  //   if (
  //     w === node.offsetWidth &&
  //     h === node.offsetHeight
  //   ) {
  //     return
  //   }

  //   update()
  // })

  return {
    destroy: () => {
      // cancel()

      bodies.update(($b) => {
        delete $b[id]

        return $b
      })
    }
  }
}
