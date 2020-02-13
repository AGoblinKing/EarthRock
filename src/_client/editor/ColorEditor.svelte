<script>
import Color from "color"

export let value

const to_css = (col) => {
	return Color(col).toCSS()
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