<script>
import Tile from "/_client/image/Tile.svelte"
import { SPRITES, THEME_BG, THEME_BORDER, TILE_COLUMNS } from "/sys/flag.js"

export let value
export let editing = false

// edit node
let x = 0
let y = 0

const to_grid = (num, ratio) => {
	const v = Math.round((num - ratio) / ratio)
	return Math.max(0, Math.min(v, $TILE_COLUMNS - 1))
}

const fix = (e) => {
	const [half_w, half_h] = [e.target.clientWidth / 2, e.target.clientHeight / 2]
	return [e.layerX + half_w, e.layerY + half_h]
}

const track = (e) => {
	const ratio = e.target.clientWidth / $TILE_COLUMNS

	const [layer_x, layer_y] = fix(e)

	x = to_grid(layer_x, ratio) * ratio
	y = to_grid(layer_y, ratio) * ratio
}

const select = (e) => {
	const ratio = e.target.clientWidth / $TILE_COLUMNS

	const [layer_x, layer_y] = fix(e)
	value.set(to_grid(layer_x, ratio) + to_grid(layer_y, ratio) * $TILE_COLUMNS)
	editing = false
}

const blur = () => {
	if (editing) {
		editing = false
	}
}
</script>

{#if editing}
  <div
    class="edit"
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