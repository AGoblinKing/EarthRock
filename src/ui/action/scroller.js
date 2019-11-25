
import { frame } from "/sys/time.js"
import { scroll } from "/sys/mouse.js"

export default (node, {
  rate = 100
} = false) => {
  let clutch = false
  let offset = 0
  const update = (amount = 0) => {
    if (Number.isNaN(amount)) return
    if (
      Math.abs(offset + amount) > node.offsetHeight ||
      offset + amount > 0
    ) return

    offset += amount
    node.style.transform = `translate(0, ${offset}px)`
  }

  const cancels = [
    frame.subscribe(() => {
      if (clutch) return
      update(-1)
    }),

    scroll.subscribe(([, deltaY]) => {
      update(deltaY / 2)
      if (clutch) clearTimeout(clutch)

      clutch = setTimeout(() => {
        clutch = false
      }, 1000)
    })
  ]

  return {
    destroy: () => cancels.forEach(fn => fn())
  }
}
