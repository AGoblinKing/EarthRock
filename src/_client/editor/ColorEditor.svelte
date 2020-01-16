<script>
import Color from "color"

export let value

const to_css = (col) => {
	return Color([
		(col >> 16) & 0x0ff,
		(col >> 8) & 0x0ff,
		(col) & 0x0ff
	]).toCSS()
}

let picking = false
const pick = (e) => {
	e.preventDefault()
	e.stopPropagation()
	picking = true
}

const move = ({ x, y, target }) => {
	const { top, left, width, height } = target.getBoundingClientRect()
	const hue = (x - left) / width
	const lightness = (y - top) / height

	const { red, green, blue } = Color({ hue, lightness, saturation: 1 }).toRGB()
	const rgb = [red, green, blue].map((c) => Math.round(c * 255))
	console.log(rgb)
}
</script>

{#if picking}
<div
	class="dopick"
	style="background-color: {to_css($value)};"
	on:click={(e) => {
		e.preventDefault()
		e.stopPropagation()
		picking = false
	}}
	on:mousemove={move}
>

</div>
{/if}

<div
  type="color"
  style="background-color: {to_css($value)};"
  class="picker"
  on:click={pick}
>

</div>

<svelte:window on:click={() => {
	if (picking) picking = false
}}/>

<style>
.dopick {
	z-index: 100;
	position: fixed;
	left: 50%;
	top: 50%;
	width: 20%;
	height: 20%;
	border: 1rem solid black;
	transform: translate(-50%, -50%);
}

.picker {
  border: 0.2rem solid rgba(0,0,0,0.5);
  height: 1.75rem;
  width: 1.75rem;
  margin: 0.25rem;
}
</style>