<script>
import { dark } from "/ui/action/color.js"
import { WEAVE_EXPLORE_OPEN, THEME_STYLE } from "/sys/flag.js"

import Omni from "./Omni.svelte"
import Space from "./Space.svelte"
import Controls from "/ui/weave/Controls.svelte"

import Command from "/omni/omni_weave.js"

export let weave

$: name = weave.name
$: names = weave.names

let open = weave.name.get() !== Wheel.SYSTEM

$: command = Command(weave)
$: spacees = Object.entries($names).sort(([a], [b]) => {
	if (a > b) return 1
	if (b > a) return -1
	return 0
})

$: warps = weave.warps
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
  <div class="spacees">

	<Omni {command} system={$name === Wheel.SYSTEM}/>

	{#each spacees as [s_name,space] (s_name)}

		<Space
		  {space}
		  {weave}
		/>

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
