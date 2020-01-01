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
</script>

<div
  type="color"
  style="background-color: {to_css($value)};"
  class="picker"
>

</div>

<style>
.picker {
  border: 0.2rem solid rgba(0,0,0,0.5);
  height: 1.75rem;
  width: 1.75rem;
  margin: 0.25rem;
}
</style>