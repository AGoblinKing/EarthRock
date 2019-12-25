<script>
import { main, size } from "/sys/screen.js"

export let full = false

const toggle = () => {
	full = !full
}

let c
const insert = (node) => ({
	destroy: main.subscribe((canvas) => {
		if (!canvas || !canvas.style) return
		c = canvas
		while (node.firstChild) {
			node.removeChild(node.firstChild)
		}

		node.appendChild(canvas)
	})
})

const sizer = (node) => ({
	destroy: size.listen(([w, h]) => {
		const s = w < h
			? w
			: h

		if (c) {
			c.width = w
			c.height = h
		}
	})
})
</script>

<div
  class="main"
  class:full
  use:insert
  use:sizer
  on:click={toggle}
>

</div>

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
  align-items: center;
  justify-content: center;
  display: flex;
}
</style>