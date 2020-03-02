<script>
import { main, size } from "/sys/screen.js"

export let full = false
export let hidden

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
  class:hidden={!hidden}

  use:insert
  use:sizer
  on:click={toggle}
>

</div>

<style>

.hidden {
	right: 30%;
}

.main {
  z-index: 1;
  position: absolute;
  width: auto;
  height: auto;
  left: 0;
  right: 0;
  bottom: 0;
  user-select: none;
  top: 0;
  align-items: center;
  justify-content: center;
  display: flex;
}
</style>