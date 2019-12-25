<script>
import color from "/ui/action/color.js"
import { WEAVE_EXPLORE_OPEN, THEME_BORDER } from "/sys/flag.js"

import Channel from "./Channel.svelte"
import Postage from "/ui/weave/Postage.svelte"

export let filter = []
export let stitch

export let open = $WEAVE_EXPLORE_OPEN
export let weave

$: w_name = weave.name
$: name = stitch.name
$: rezed = weave.rezed
$: value = stitch.value

$: chans = Object.entries($value).sort(([a], [b]) => {
	if (a > b) return 1
	if (b > a) return -1
	return 0
})

const toggle = (e) => {
	e.preventDefault()
	e.stopPropagation()
	const r = $rezed
	if (r[stitch.id.get()]) {
		delete r[stitch.id.get()]
	} else {
		r[stitch.id.get()] = true
	}
	rezed.set(r)
}
</script>

<div
  class="stitch"
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
		{stitch}
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

.stitch {
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

.stitch:hover {
  color: white;
}
</style>