<script>
import Tile from "/_client/image/Tile.svelte"
import { SPRITES, THEME_BG, THEME_BORDER, TILE_COLUMNS } from "/sys/flag.js"
import { buttons } from "/sys/input.js"
import { tick } from "/sys/time.js"

export let back = false
export let value
export let editing = false

export const click = () => {
	update_selection()
	return back
}

let k_x = $value % $TILE_COLUMNS
let k_y = Math.floor($value / $TILE_COLUMNS)
// edit node
let x = 0
let y = 0
let ratio

const to_grid = (num, ratio) => {
	const v = Math.round((num - ratio) / ratio)
	return Math.max(0, Math.min(v, $TILE_COLUMNS - 1))
}

const fix = (e) => {
	const [half_w, half_h] = [e.target.clientWidth / 2, e.target.clientHeight / 2]
	return [e.layerX + half_w, e.layerY + half_h]
}

const track = (e) => {
	ratio = selections.clientWidth / $TILE_COLUMNS

	const [layer_x, layer_y] = fix(e)

	k_x = to_grid(layer_x, ratio)
	x = k_x * ratio
	k_y = to_grid(layer_y, ratio)
	y = k_y * ratio
}

const select = (e) => {
	[x, y] = fix(e)

	update_selection()
}

const update_selection = () => {
	value.set(to_grid(x, ratio) + to_grid(y, ratio) * $TILE_COLUMNS)
	editing = false
}

const blur = () => {
	if (editing) {
		editing = false
	}
}

const arrows = () => {
	const cancel = tick.listen(() => {
		if (selections) {
			ratio = selections.clientWidth / $TILE_COLUMNS
			if (x === 0 && y === 0) {
				x = k_x * ratio
				y = k_y * ratio
			}
		}
		if (ratio === undefined) return

		if ($buttons.left) x = (k_x === 0 ? $TILE_COLUMNS - 1 : k_x--) * ratio
		if ($buttons.right) x = (k_x === $TILE_COLUMNS - 1 ? 0 : k_x++) * ratio
		if ($buttons.up) y = (k_y === 0 ? $TILE_COLUMNS - 1 : k_y--) * ratio
		if ($buttons.down) y = (k_y === $TILE_COLUMNS - 1 ? 0 : k_y++) * ratio
	})

	return {
		destroy () {
			cancel()
		}
	}
}
let selections
</script>

{#if editing}
<div
	class="edit"
	use:arrows

	bind:this={selections}
	on:click={(e) => {
		e.preventDefault()
		e.stopPropagation()
		select(e)
	}}

	on:mousemove={track}

	style={[
		`background-image: url('${$SPRITES}');`,
		`background-color: ${$THEME_BG};`,
		`border: 1rem solid ${$THEME_BORDER};`
	].join(``)}
>
	<div
		class="cursor"
		style="transform: translate({x}px,{y}px);"
	/>
</div>
{/if}

<svelte:window on:click={blur} />
<div
	class="tile"
	on:click={(e) => {
		e.preventDefault()
		e.stopPropagation()
		editing = !editing
	}}
>
	{#if value}
		<Tile width={1} height={1} data={JSON.stringify($value)}/>
	{/if}
</div>

<style>
.tile {
	height: 1.5rem;
	width: 1.5rem;
	display: flex;
	justify-self: center;
	margin: 0.25rem;
	align-self: center;
	border: 0.25rem solid rgba(0,0,0,0.5);
	background-color: rgba(0,0,0,0.25);
	transition: border 100ms linear;
}

.tile:hover {
	border: 0.25rem solid rgba(255,255, 255,0.25);
}

.edit {
	position: fixed;

	left: 50%;
	top: 50%;

	z-index: 5;

	width: 64rem;
	height: 64rem;

	margin: 1rem;
	background-size: 100%;
	transform: translate(-50%, -50%);
}

.cursor {
	width: 2rem;
	height: 2rem;
	pointer-events: none;
	margin-left: -0.5rem;
	margin-top: -0.5rem;
	border: 0.5rem solid rgba(255, 231, 18, 0.75);
}
</style>