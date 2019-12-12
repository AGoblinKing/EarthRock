<script>
import { main } from "/sys/screen.js"

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
</script>

<div 
  use:insert 
  class="main" 
  class:full 
  on:click={toggle}
/>

<style>
.main {
  z-index: 1;
  position: absolute;
  width: auto;
  height: auto;
  left: 0;
  right: 0;
  bottom: 0;
  top: 0;
  display: flex;
}

.main canvas {
  flex: 1;
}
</style>