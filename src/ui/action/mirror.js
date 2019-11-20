import { frame } from "/sys/time.js"

export default (node, canvas) => ({
  destroy: frame.subscribe(() => {
    // push to the end of the subscribe
    requestAnimationFrame(() => {
      node.src = canvas.toDataURL(`image/jpeg`)
    })
  })
})
