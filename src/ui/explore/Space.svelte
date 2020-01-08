<script>
import color from "/ui/action/color.js"
import { THEME_BORDER } from "/sys/flag.js"
import { read } from "/store.js"

import Flock from "./Flock.svelte"
import Channel from "./Channel.svelte"
import Postage from "/ui/weave/Postage.svelte"

export let space

export let weave

const open = true

$: w_name = weave.name

$: value = space ? space.value : read({
	"!name": read(``),
	"!birds": read([])
})

$: name = $value[`!name`]
$: birds = $value[`!birds`]
$: bird = $value[`!bird`]

$: chans = Object.entries($value).sort(([a], [b]) => {
	if (a > b) return 1
	if (b > a) return -1
	return 0
})

const toggle = (e) => {
	e.preventDefault()
	e.stopPropagation()
	const id = space.id.get()
	const rezed = weave.rezed.get()

	if (rezed[id]) {
		weave.derez(id, ...space.chain())
	} else {
		weave.rez(id, ...space.chain())
	}
}
let space_bird
</script>

{#if space}
<div
  class="space"
  class:open
  use:color={$name}
  style="border: 0.25rem solid {$THEME_BORDER};"
>
  <div class="name">
  {bird ? `${bird.get()}::` : ``}{$name}
  </div>

  <div class="postage" on:click={toggle}>
	<Postage address={`/${$w_name}/${$name}`}/>
  </div>

</div>

{#if open}
  <div class="chans">
  {#each chans as channel (channel[0])}
	  <Channel
		{channel}
		{space}
		{weave}
	  />
  {/each}
  </div>
{/if}

{#if birds}
	<Flock {birds} {weave} set_bird={(bird) => { space_bird = bird }}>
		<svelte:self {weave} space={space_bird} />
	</Flock>
{/if}

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

  border-right: none;
  padding-right: 1rem;
}

.name {
  flex: 1;
}

.space:hover {
  color: white;
}
</style>