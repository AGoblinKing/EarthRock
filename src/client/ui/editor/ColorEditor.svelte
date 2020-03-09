<script>
import Color from "color-js"

export let value

const to_css = (col) => {
	if (Array.isArray(col) === false) return ``

	return Color(col.map((x, i) => {
		if (i === 3) return x

		return x * 255
	})).toCSS()
}
</script>

<div class="color">
{$value}
</div>
<div
 	style="background-color: {to_css($value)};"
	class="block"
>
</div>

<style>

.color {
	margin-left: 1rem;
}

.block {
	width: 1.25rem;
	height: 1.25rem;
	margin: 0 1rem;
}
</style>