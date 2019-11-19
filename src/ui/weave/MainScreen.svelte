<script>
import { main } from "/sys/screen.js"
import Spatial from "/ui/Spatial.svelte"

const insert = (node) => ({
  destroy: main.subscribe((canvas) => {
    while (node.firstChild) {
      node.removeChild(node.firstChild)
    }
    node.appendChild(canvas)
  })
})
</script>

<Spatial
  anchor = {[95, 95]}
  zIndex = {1000}
>
  <div use:insert class="main">

  </div>
</Spatial>

<style>
.main {
  width: 10rem;
  height: 10rem;
  display: flex;
  border: 0.25rem solid black;
  filter: drop-shadow(1rem 1rem 0 rgba(0, 0, 0, 0.5));
}

.main canvas {
  flex: 1;
}
</style>