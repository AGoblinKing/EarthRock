<script>
import { THEME_STYLE } from "/sys/flag.js"

import Controls from "/_client/weave/Controls.svelte"
import Command from "/_client/omni/omni_weave.js"
import { dark } from "/_client/action/color.js"

import Omni from "./Omni.svelte"
import Space from "./Space.svelte"

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
	<div class="spaces">
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

.weave:hover {
  color: white;
}

.namezor {
  flex: 1;
}
</style>
