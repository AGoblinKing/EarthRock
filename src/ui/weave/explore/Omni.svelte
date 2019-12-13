<script>
import { THEME_BORDER } from "/sys/flag.js"
import { tick } from "/sys/time.js"
export let command = () => {}
let omni = ``

export let system = false
export let focus = false
const place_default = system
  ? `!`
  : `! > + -`

let placeholder = place_default

const calc_offset = ($t, $p) => {
  if ($p.length < 20) return placeholder
  const offset = Math.floor($t / 2) % $p.length
  return $p.slice(-offset) + $p.slice(0, -offset)
}

$: tru_placeholder = calc_offset($tick, placeholder)

const focusd = (node, init) => {
  if (init) node.focus()
  return {
    update: (val) => {
      if (val) node.focus()
    }
  }
}

const commands = {
  "!": () => {
    if (system) {
      placeholder = `SYSTEM CAN ONLY FILTER!!! `
      return
    }
    placeholder = `[ADD]+Name [MOVE]~Name/Name [DELETE]-Name`
  },
  undefined: () => {
    placeholder = place_default
  }
}
const execute = () => {
  const data = [
    omni[0],
    ...omni.slice(1).split(`/`)
  ]
  if (commands[data[0]]) commands[data[0]](data)
  command(data)
  omni = ``
}
</script>

<input type="text"
  class="omni"
  style="border: 0.25rem solid {$THEME_BORDER}"
  bind:value={omni}
  on:keydown={(e) => {
    if (e.which !== 13) return
    execute()
  }}
  use:focusd={focus}
  on:blur={execute}
  placeholder={tru_placeholder}
/>

<style>
.omni {
  width: 100%;
  padding: 0.5rem;
  border: 0.25rem solid #333;
  margin-top: -0.25rem;
  background-color: #111;
}
.omni:hover {
  background-color: #222;
}
</style>