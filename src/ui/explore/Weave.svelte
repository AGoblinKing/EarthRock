<script>
import { dark } from "/ui/action/color.js"
import { WEAVE_EXPLORE_OPEN, THEME_STYLE } from "/sys/flag.js"

import Omni from "./Omni.svelte"
import Stitch from "./Stitch.svelte"
import Controls from "/ui/weave/Controls.svelte"

export let weave
$: name = weave.name
$: names = weave.names

export let filter = []
export let open = $WEAVE_EXPLORE_OPEN

$: stitches = Object.entries($names).sort(([a], [b]) => {
  if (a > b) return 1
  if (b > a) return -1
  return 0
})

$: knots = weave.knots

const command = ([
  command,
  detail,
  detail2
], msg) => {
  switch (command) {
    case `>`:
      const knot = $names[detail]
      if (!knot) return msg(`Couldn't find ${detail}`)
      if ($names[detail2]) return msg(`${detail2} already exists`)
      knot.knot.name.set(detail2)
      return
    case `~`:
      const k = $names[detail]

      if (!k) return
      k.name.set(detail2)

      break
    case `+`:
      if (detail2) {
        return weave.update({
          [detail]: {
            knot: `stitch`,
            value: {
              [detail2]: ``
            }
          }
        })
      }

      weave.add({
        knot: `stitch`,
        name: detail
      })

      break
    case `-`:
      if (detail2) {
        const s = weave.get_name(detail)
        if (!s) return

        s.value.remove(detail2)
        return
      }

      weave.remove_name(detail)
  }
}
</script>

<div
  class="weave"
  class:open
  use:dark={$name}
  style={$THEME_STYLE}
  on:click={() => {
    open = !open
  }}
>
  <Controls {weave} />
  <div class="namezor">
    {$name}
  </div>
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
          {weave}
        />
      {/if}
    {/each}
  </div>
{/if}

<style>

.weave {
  align-items:center;
  text-align: left;
  flex-direction: row-reverse;
  display: flex;
  padding: 1rem;
  margin-top: -0.25rem;
  border-right: none;
  font-size: 2rem;
  border-radius: 0.25rem;
}

.out {
   flex-direction: row-reverse;
}
.weave:hover {
  color: white;
}

.namezor {
  flex: 1;
}
</style>
