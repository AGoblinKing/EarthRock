<script>
import color from "/ui/action/color.js"
import { WEAVE_EXPLORE_OPEN, THEME_BORDER } from "/sys/flag.js"

import Channel from "./Channel.svelte"
import Postage from "/ui/weave/Postage.svelte"

export let filter = []
export let space

export let open = $WEAVE_EXPLORE_OPEN
export let weave

$: w_name = weave.name

$: value = space.value
$: name = $value[`!name`]

$: chans = Object.entries($value).sort(([a], [b]) => {
	if (a > b) return 1
	if (b > a) return -1
	return 0
})

const toggle = (e) => {
	e.preventDefault()
	e.stopPropagation()
	const id = space.id.get()
	if (space.rezed) {
		weave.derez(id, ...space.chain())
	} else {
		weave.rez(id, ...space.chain())
	}
}
</script>

<div
  class="space"
  class:open
  use:color={$name}
  style="border: 0.25rem solid {$THEME_BORDER};"
>
  <div class="name">
  {$name}
  </div>

  <div class="postage" on:click={toggle}>
	<Postage address={`/${$w_name}/${$name}`}/>
  </div>

</div>

{#if open}
  <div class="chans">
  {#each chans as channel (channel[0])}
	{#if filter.length === 0 || channel.name.indexOf(filter[0]) !== -1}
	  <Channel
		{channel}
		{space}
		{weave}
	  />
	{/if}
  {/each}
  </div>
{/if}

<style>

.chans {
  margin-left: 1rem;
}

.postage {
  width: 2rem;
  height: 2rem;
  display: flex;
  margin: 0 1rem;
}

.space {
  display: flex;
  align-items: center;
  padding: 0.5rem;
  margin-left: 1rem;
  border-right: none;
  border-radius: 0.25rem;
  padding-right: 1rem;
  margin-top:-0.25rem;
}

.name {
  flex: 1;
}

.space:hover {
  color: white;
}
</style>