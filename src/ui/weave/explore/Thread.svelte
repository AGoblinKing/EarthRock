<script>
import { tick } from "/sys/time.js"
import { THEME_BG, THEME_BORDER } from "/sys/flag.js"
export let channel
export let stitch
export let weave

$: feed = Wheel.feed

// math 2+2 => /sys/foo => tile 55 => {} "" 10 [] =>
export let super_open = false
let editing = false
$: address = `${stitch.id.get()}/${channel[0]}`
$: threads = weave.threads

const knots = {
  stream: (k) => JSON.stringify(k.value.get()),
  math: (k) => k.math.get().trim(),
  mail: (k) => k.whom.get(),
  default: (k) => k.knot.get(),
  stitch: (k) => `./${k.name.get()}`
}

const knots_create = {
  math: (data) => ({
    knot: `math`,
    math: data
  })
}

const translate = (k) => {
  const knot = weave.knots.get()[k]
  if (!knot) return `stitch`

  const type = knot.knot.get()

  return knots[type]
    ? knots[type](knot)
    : type
}

$: chain = $threads && weave.chain(address).slice(0, -1)

$: boxes = chain
  .map(translate)
  .join(` => `)
$: time_cut = $tick && Date.now() - 1000

$: tru_thread = !super_open
  ? boxes || `#0`
  : `#${chain.length}`
let edit = ``

const focus = (node) => node.focus()

const execute = () => {
  if (!editing) return
  editing = false

  const parts = edit.split(`=>`).reverse()
  const threads_update = weave.threads.get()
  const knots = weave.knots.get()

  weave.chain(address).forEach((id) => {
    delete knots[id]
    delete threads_update[id]
  })
  weave.knots.set(knots)

  let connection = address

  // lets make a bunch of math knots
  parts.forEach((part) => {
    part = part.trim()

    if (part === ``) return

    const w_data = knots_create.math(part)

    const k = weave.add(w_data)

    threads_update[k.id.get()] = connection
    connection = k.id.get()
  })

  weave.threads.set(
    threads_update
  )

  const n = weave.name.get()
  if (Wheel.running.get()[n]) {
    Wheel.restart(n)
  }
}

$:style = `background-color: ${$THEME_BG}; border:0.25rem solid ${$THEME_BORDER};`
</script>

<div 
  class="spot" 
  
  on:click={() => {
    editing = true
    edit = boxes
  }}
  on:keydown={({ which }) => {
    if (which !== 13) return

    execute()
  }}
  on:blur={execute}
>
  {#if !editing}
    {#each chain as link}
      <div 
        class="thread" 
        {style}
        class:active={$feed[`${weave.name.get()}/${link}`] > time_cut}
      >
        {translate(link)}
      </div>
      <div 
        class="root" 
        style={style + `color: ${$THEME_BORDER}`}>
      =>
      </div>
    {:else}
      <div 
        class="cap" 
        style={style + `color: ${$THEME_BORDER}`}>
      =>
      </div>
    {/each}

  {:else}
    <input 
      class="edit"
      type="text"
      {style}
      use:focus
      bind:value={edit}
      on:blur={execute}
      size={Math.max(edit.length, 5)}
    />
  {/if}
</div>

<style>
.spot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  position: absolute;
  right: 100%;
  margin-right: -2.00rem;
  width: auto;
  font-size: 0.75rem;
  margin-top: 0;
}

.root {
  border-left: none !important;
  border-right: none !important;
  padding: 0.10rem;
  margin-left: -0.3rem;
  margin-right: -0.3rem;
  font-size: 0.5rem;
  position: relative;
  z-index: 2;
}

.thread {
  padding: 0.25rem;
  white-space: nowrap;
  transition: all 100ms linear;
}

.thread.active {
  box-shadow: -0.5rem -0.5rem 0 rgba(65, 221, 3, 0.349), 0.5rem 0.5rem rgba(65, 221, 3, 0.349);
}
.edit {
  font-size: 0.75rem;
  margin: 0;
  margin-right: -0.20rem;
  padding: 0.4rem;
}

.thread:hover {
  color: white;
}
.cap {
  border-right: none !important;
  padding: 0.10rem;
  margin-left: -0.3rem;
  margin-right: -0.3rem;
  position: relative;
  z-index: 2;
}
.cap:hover {
  color: white !important;
}
</style>

