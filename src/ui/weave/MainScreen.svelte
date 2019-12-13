<script>
import { main, size } from "/sys/screen.js"

export let full = false

const toggle = () => {
  full = !full
}

const insert = (node) => ({
  destroy: main.subscribe((canvas) => {
    if (!canvas || !canvas.style) return
    canvas.style.flex = 1

    while (node.firstChild) {
      node.removeChild(node.firstChild)
    }

    node.appendChild(canvas)
  })
})
const sizer = (node) => ({
  destroy: size.listen(([w, h]) => {
    const s = w > h
      ? h
      : w

    node.style.width = node.style.height = `${s}px`
  })
})
</script>

<div 
  class="main" 
  class:full 
  use:insert
  on:click={toggle}
> 

</div>

<style>
.resize {
  display: flex;
}

.main {
  z-index: 1;
  position: absolute;
  width: auto;
  height: auto;
  left: 0;
  right: 0;
  bottom: 0;
  top: 0;
  align-items: center;
  justify-content: center;
  display: flex;
}

.main canvas {
  flex: 1;
}
</style>