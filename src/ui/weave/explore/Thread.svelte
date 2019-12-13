<script>
import color from "/ui/action/color.js"
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
  mail: (k) => k.whom.get().trim(),
  default: (k) => k.knot.get(),
  stitch: (k) => `./${k.name.get()}`
}

const knots_is = {
  mail: (data) => {
    const ms = data.match(Wheel.REG_ID)
    if (!ms || ms.length !== 1) return false
    if (ms[0] !== data) return false
    return true
  },
  stream: (data) => {
    try {
      JSON.parse(data)
      return true
    } catch (ex) {
      return false
    }
  }
}

const knots_create = {
  math: (data) => ({
    knot: `math`,
    math: data
  }),
  mail: (data) => ({
    knot: `mail`,
    whom: data
  }),
  stream: (data) => ({
    knot: `stream`,
    value: JSON.parse(data)
  })
}

const what_is = (data) => {
  const entries = Object.entries(knots_is)
  for (let i = 0; i < entries.length; i++) {
    const [type, fn] = entries[i]
    if (fn(data)) return type
  }
  return `math`
}
const knot_create = (data) =>
  knots_create[what_is(data)](data)

const translate = (k) => {
  if (k[0] === `#`) return k

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
  ? chain
  : [`#${chain.length}`]
let edit = ``

const focus = (node) => node.focus()

const execute = () => {
  if (!editing) return
  editing = false

  const parts = edit
    .replace(/[\r\n]/g, ``)
    .split(`=>`)
    .reverse()

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

    const w_data = knot_create(part)

    const k = weave.add(w_data)

    threads_update[k.id.get()] = connection
    connection = k.id.get()
  })

  weave.threads.set(
    threads_update
  )

  weave.validate()
  const n = weave.name.get()
  if (Wheel.running.get()[n]) {
    Wheel.restart(n)
  }
}

const format = (txt) => {
  txt = txt.split(`;`)

  txt = txt
    .map((i, k) => {
      i = i.trim()
      if (k !== txt.length - 1) {
        i += `;`
      }
      if (k === txt.length - 2) {
        i += `\r\n`
      }
      return i
    })
    .join(`\r\n`)

  txt = txt
    .split(`=>`)
    .join(`\r\n\r\n=>`)

  return txt
}

const condense = (link) => {
  const t = translate(link).split(`;`)
  const v = t.pop().trim()
  return t.length > 0
    ? `#${t.length} ${v}`
    : v
}
$:style = `background-color: ${$THEME_BG}; border:0.25rem solid ${$THEME_BORDER};`
</script>

<div 
  class="spot" 
  data:super={super_open}
  on:click={() => {
    if (editing) return
    editing = true
    edit = format(boxes)
  }}
>
  {#if !editing}
    {#each tru_thread as link}
      {#if link[0] === `#`}
<div 
          class="thread" 
          {style}
          class:active={chain.some((item) => $feed[`${weave.name.get()}/${item}`] > time_cut)}
        >
          {link}
        </div>
      {:else}
        <div 
          class="thread" 
          {style}
          use:color={condense(link)}
          class:active={$feed[`${weave.name.get()}/${link}`] > time_cut}
        >
          {condense(link)}
        </div>
      {/if}

    {:else}
      <div 
        class="cap" 
        style="border: 0.25rem solid {$THEME_BORDER}"
      >
      +
      </div>
    {/each}

  {:else}
    <textarea
      class="edit"
      type="text"
      style={`background-color: ${$THEME_BG}; border:0.5rem solid ${$THEME_BORDER};`}
      use:focus
      bind:value={edit}
      on:blur={(e) => {
        execute()
      }}
      on:keydown={({ which, shiftKey }) => {
        if (
          which !== 13 ||
          !shiftKey
        ) return
        execute()
      }}
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
  margin-top: -0.125rem;
}

.thread {
  padding: 0.5rem;
  white-space: nowrap;
  transition: all 100ms linear;
  margin-right: -0.25rem;
}

.thread.active {
  text-decoration: underline;
}
.edit {
  position: relative;
  width: 60rem;
  height: 60rem;
  z-index: 3;
  font-size: 1rem;
  margin: 0;
  padding: 1rem;
  color: rgb(224, 168, 83);
}

.thread:hover {
  color: white;
}

.cap {
  padding: 0.5rem;
  margin-right: -0.25rem;
  position: relative;
  z-index: 2;
  background-color: rgba(0,0,0, 0.25);
}
.cap:hover {
  color: white !important;
}
</style>

