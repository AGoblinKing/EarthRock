import { tick } from "/sys/time.js"

export default (node, canvas) => ({
  destroy: tick.listen(() => {
    // push to the end of the subscribe
    requestAnimationFrame(() => {
      node.src = canvas.toDataURL(`image/jpeg`)
    })
  })
})
