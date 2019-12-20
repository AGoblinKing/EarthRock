<script>
import Tile from "/ui/image/Tile.svelte"
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

const track = (e) => {
  const ratio = e.target.clientWidth / $TILE_COLUMNS

  x = to_grid(e.layerX, ratio) * ratio
  y = to_grid(e.layerY, ratio) * ratio
}

const select = (e) => {
  const ratio = e.target.clientWidth / $TILE_COLUMNS
  value.set(to_grid(e.layerX, ratio) + to_grid(e.layerY, ratio) * $TILE_COLUMNS)
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
  height: 1.75rem;
  width: 1.75rem;
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
  position: absolute;
  right: 0;
  z-index: 5;
  bottom: 0;
  width: 64rem;
  margin: 1rem;
  height: 64rem;
  background-size: 100%;
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