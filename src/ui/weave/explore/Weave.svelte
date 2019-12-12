<script>
import color from "/ui/action/color.js"
import { WEAVE_EXPLORE_OPEN, THEME_BG, THEME_BORDER } from "/sys/flag.js"
import { keys } from "/sys/key.js"

import Omni from "./Omni.svelte"
import Stitch from "./Stitch.svelte"
import Controls from "/ui/weave/Controls.svelte"

export let weave
$: name = weave.name
$: names = weave.names

export let filter = []
export let open = $WEAVE_EXPLORE_OPEN

open = open && weave.name.get() !== Wheel.SYSTEM

$: stitches = Object.entries($names).sort(([a], [b]) => {
  if (a > b) return 1
  if (b > a) return -1
  return 0
})

$: knots = weave.knots

let super_open = open
let super_duper_open = false
const command = ([
  command,
  detail,
  detail2
]) => {
  switch (command) {
    case `~`:
      const k = $names[detail]

      if (!k) return
      k.name.set(detail2)

      break
    case `+`:
      weave.add({
        knot: `stitch`,
        name: detail
      })
      break
    case `-`:
      weave.remove_name(detail)
  }
}
</script>

<div 
  class="weave"
  class:open
  use:color={$name}
  style="background-color: {$THEME_BG}; border: 0.25rem solid {$THEME_BORDER};"
  on:click={() => {
    if ($keys.shift) {
      open = true
      if (super_open === false) {
        super_open = true
        return
      }
      if (super_duper_open === false) {
        super_duper_open = true
        return
      }
      super_open = false
      super_duper_open = false
      return
    }

    open = !open
  }}
>
  <Controls {weave} />
  {$name}
</div>

{#if open}
  <div class="stitches">
    
    <Omni {command} system={$name === Wheel.SYSTEM}/>
    
    {#each stitches as [s_name,stitch]}
      {#if 
        filter.length === 0 ||
        s_name.indexOf(filter[0]) !== -1
      }
        <Stitch 
          {stitch} 
          filter={filter.slice(1)} 
          open={super_open} 
          super_open={super_duper_open}
          {weave}
        />
      {/if}
    {/each}
  </div>
{/if}

<style>

.weave {
  align-items:center;
  display: flex;
  padding: 1rem;
  margin-top: -0.25rem;
  border-right: none;
}
.weave:hover {
  color: white;
}

</style>
