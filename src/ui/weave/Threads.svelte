<script>
import { size } from "/sys/screen.js"
import { frame, tick } from "/sys/time.js"
import { first } from "/sys/port-connection.js"
import { position } from "/sys/mouse.js"
import { read } from "/util/store.js"

export let weave

const val = new Set()
// filter for just this weave
const recent = read(val, (set) => {
  let t = 0

  const deletes = {}

  tick.subscribe(() => {
    t += 100
    const dels = Object.entries(deletes)
    if (dels.length === 0) return

    const r = val

    let change = false
    dels.forEach(([key, del_t]) => {
      if (del_t < t) {
        r.delete(key)
        delete deletes[key]
        change = true
      }
    })

    if (change) set(r)
  })

  Wheel.feed.subscribe(({ writer, reader }) => {
    if (!writer || !reader) return

    const [weave_write, ...local_write] = writer.split(`/`)
    const [weave_read, ...local_read] = reader.split(`/`)
    const weave_id = weave.name.get()

    // takes place in this weave!
    if (weave_id !== weave_write && weave_id !== weave_read) return
    const id = `${local_read.join(`/`)}-${local_write.join(`/`)}`

    const s_recent = val
    if (!s_recent.has(id)) {
      s_recent.add(id)
      set(s_recent)
    }

    deletes[id] = t + 1000
  })
})

const get_pos = (id) => document.getElementById(id).getBoundingClientRect()

const get_color = (id) => {
  const loc = document.getElementById(id).getBoundingClientRect()
  return id.split(`|`).length === 1
    ? `gray`
    : id.slice(-1) !== `e`
      ? `url(#${loc.x < $position[0] ? `linear-other` : `linear`})`
      : `url(#${loc.x < $position[0] ? `linear` : `linear-other`})`
}

// tick to recculate position
$: threads = $frame
  ? weave.threads
  : weave.threads

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

$: first_rec = $first
  ? get_pos($first)
  : [0, 0]
</script>

<svg width={$size[0]} height={$size[1]} class="threads">
    <defs>
      <linearGradient id="linear" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="30%" stop-color="#F00"/>
        <stop offset="70%" stop-color="#00F"/>
      </linearGradient>
      <linearGradient id="linear-other" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="30%" stop-color="#00F"/>
          <stop offset="70%" stop-color="#F00"/>
        </linearGradient>
        <linearGradient id="linear-dark" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="5%" stop-color="#F00"/>
  
        <stop offset="95%" stop-color="#00F"/>
      </linearGradient>
      <linearGradient id="linear-other-dark" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="5%" stop-color="#00F"/>
  
          <stop offset="95%" stop-color="#F00"/>
        </linearGradient>
    </defs>

  {#if $first} 
    <line 
      stroke={get_color($first, $position)} 
      x1={first_rec.x + first_rec.width / 2} 
      y1={first_rec.y + first_rec.height / 2} 
      x2={$position[0]} 
      y2={$position[1]} 
      class="line"
    > 
    </line> 
  {/if}

  {#each rects as [x, y, x_id, y_id]}
      <line 
        stroke="url(#{x.x > y.x ? 'linear-dark' : 'linear-other-dark'})" 
        x1={x.x + x.width / 2} 
        y1={x.y + x.height / 2} 
        x2={y.x + y.width / 2} 
        y2={y.y + y.height / 2} 
        class="line"
      >
      </line> 
      {#if $recent.has(`${x_id}-${y_id}`)}
      <line 
        stroke="url(#{x.x > y.x ? 'linear' : 'linear-other'})" 
        x1={x.x + x.width / 2} 
        y1={x.y + x.height / 2} 
        x2={y.x + y.width / 2} 
        y2={y.y + y.height / 2} 
        class="active"
      >
      </line> 
      {/if}
  {/each}
</svg>

<style>
.active {
  stroke-width:1rem;
}

.line {
  stroke-width: 0.25rem;
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