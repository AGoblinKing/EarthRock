<script>
import { THEME_BORDER } from "/sys/flag.js"
import { tick } from "/sys/time.js"
export let command = () => {}
let omni = ``

export let system = false

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
  omni = ``

  if (system) {
    return commands[`!`]()
  }

  if (commands[data[0]]) commands[data[0]](data)
  command(data, (ph) => {
    placeholder = ph
  })
}
</script>

<input type="text"
  class="omni"
  style="border: 0.25rem solid {$THEME_BORDER};"
  bind:value={omni}
  on:keydown={(e) => {
    if (e.which !== 13) return
    execute()
  }}

  on:blur={execute}
  placeholder={tru_placeholder}
/>

<style>
.omni {
  width: 100%;
  padding: 0.5rem;
  overflow: hidden;
  margin-top: -0.25rem;
  background-color: #111;
  display: block;
  border-radius: 0.25rem;
}
.omni:hover {
  background-color: #222;
}
</style>