<script>
import { dark } from "/ui/action/color.js"
import { WEAVE_EXPLORE_OPEN, THEME_STYLE } from "/sys/flag.js"

import Omni from "./Omni.svelte"
import Stitch from "./Stitch.svelte"
import Controls from "/ui/weave/Controls.svelte"

import Command from "/omni/omni_weave.js"

export let weave
$: name = weave.name
$: names = weave.names

export let filter = []
export let open = $WEAVE_EXPLORE_OPEN

$: command = Command(weave)
$: stitches = Object.entries($names).sort(([a], [b]) => {
	if (a > b) return 1
	if (b > a) return -1
	return 0
})

$: knots = weave.knots
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

	{#each stitches as [s_name,stitch] (s_name)}
	  {#if
		(filter.length === 0 ||
		s_name.indexOf(filter[0]) !== -1) &&
		s_name[0] !== `&`
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
