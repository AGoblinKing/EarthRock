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
  z-index: 2000;
  position: absolute;
  left: 5vw;
  bottom: 5vw;
  width: 10rem;
  height: 10rem;
  display: flex;
  border: 0.25rem solid black;
  background-color: rgba(0, 0, 0, 0.5);
  filter: drop-shadow(1rem 1rem 0 rgba(0, 0, 0, 0.5));
}

.main.full {
  width: auto;
  height: auto;
  left: 0;
  right: 0;
  bottom: 0;
  top: 0;
  filter: none;
}

.main.full:hover {
  filter: none;
}

.main:hover {
  filter: drop-shadow(1rem 1rem 1rem rgba(0, 255, 0, 0.5)) drop-shadow(1rem 1rem 0 rgba(0, 0, 0, 0.5));
}

.main canvas {
  flex: 1;
}
</style>