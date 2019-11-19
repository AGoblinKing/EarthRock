import { frame } from "/sys/time.js"

export default (node, canvas) => ({
  destroy: frame.subscribe(() => {
    requestAnimationFrame(() => {
      node.src = canvas.toDataURL(`image/jpeg`)
    })
  })
})
