<script>
import { size } from "/channel/screen.js"
import Tick from "/channel/tick.js"
import { first } from "/channel/port-connection.js"
import { position } from "/channel/mouse.js"

export let weave

const get_pos = (id) => document.getElementById(id).getBoundingClientRect()

const get_color = (id) => {
  const loc = document.getElementById(id).getBoundingClientRect()
  return id.split(`|`).length === 1
    ? `gray`
    : id.slice(-1) !== `e`
      ? `url(#${loc.x < $position[0] ? `linear-other` : `linear`})`
      : `url(#${loc.x < $position[0] ? `linear` : `linear-other`})`
}

$: threads = $Tick ? weave.threads : weave.threads
$: rects = Object.entries($threads)
  .filter(([x, y]) => 
    document.getElementById(`${x}|read`) && 
    document.getElementById(`${y}|write`)
  )
  .map(
    ([x, y]) => [
      document.getElementById(`${x}|read`).getBoundingClientRect(),
      document.getElementById(`${y}|write`).getBoundingClientRect(),
      x,
      y
    ]
  )

$: first_rec = $first ? get_pos($first) : [0, 0]
</script>

<svg width={$size[0]} height={$size[1]} class="threads">
    <defs>
      <linearGradient id="linear" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="30%"   stop-color="#F00"/>
        <stop offset="70%" stop-color="#00F"/>
      </linearGradient>
      <linearGradient id="linear-other" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="30%"   stop-color="#00F"/>
          <stop offset="70%" stop-color="#F00"/>
        </linearGradient>
    </defs>

  {#if $first} 
    <line 
      stroke={get_color($first, $position)} 
      x1={first_rec.x + first_rec.width / 2} 
      y1={first_rec.y + first_rec.height / 2} 
      x2={$position[0]} 
      y2={$position[1]} 
      class="line"> 
    </line> 
  {/if}

  {#each rects as [x, y, x_id, y_id]}
      <line 
        stroke="url(#{x.x > y.x ? 'linear' : 'linear-other'})" 
        x1={x.x + x.width / 2} 
        y1={x.y + x.height / 2} 
        x2={y.x + y.width / 2} 
        y2={y.y + y.height / 2} 
        class="line"> </line> 
  {/each}
</svg>

<style>
.line {
  stroke-width: 4;

  transition: all 250ms linear;
  stroke-dasharray: 0.1rem;
}

.threads {
  pointer-events: none;
  z-index: 200;
  width: 100%;
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
}
</style>