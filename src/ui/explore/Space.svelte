<script>
import color from "/ui/action/color.js"
import { THEME_BORDER } from "/sys/flag.js"
import { read, write } from "/store.js"

import Flock from "./Flock.svelte"
import Channel from "./Channel.svelte"
import Postage from "/ui/weave/Postage.svelte"

export let space
export let weave
export let prefix = ``
export let postfix = ``

const open = true

$: w_name = weave.name
$: w_rezed = weave.rezed

$: value = space ? space.value : read({
	"!name": read(``),
	"!birds": read([])
})

$: name = $value[`!name`] || read(``)
$: id = space.id
$: birds = $value[`!birds`]
$: bird = $value[`!bird`]

$: chans = Object.entries($value).sort(([a], [b]) => {
	if (a > b) return 1
	if (b > a) return -1
	return 0
})

$: rezed = $w_rezed[$id]

const toggle = (e) => {
	e.preventDefault()
	e.stopPropagation()
	const id = space.id.get()

	if (rezed) {
		weave.derez(id, ...space.chain())
	} else {
		weave.rez(id, ...space.chain())
	}
}

const space_bird = write(false)
</script>

<div
  class="space"
  class:open
  use:color={$name}
  style="border: 0.25rem solid {$THEME_BORDER};"
>
  <div class="name">
  	{prefix}{$name}{postfix}
  </div>

 {#if prefix === ``}
  <div class="postage" on:click={toggle}>
	<Postage address={`/${$w_name}/${$name}`}/>
  </div>
{/if}
</div>

{#if open}
  <div class="chans">
  {#each chans as channel (channel[0])}
	  <Channel
		{channel}
		{space}
		{weave}
		nothread={prefix !== ``}
	  />
  {/each}
  </div>
{/if}

{#if birds && rezed}
	<Flock {birds} {weave} set_bird={(bird) => { space_bird.set(bird) }}>

		{#if $space_bird}
			<svelte:self
				{weave}
				space={$space_bird}
				prefix={`${prefix}${$name}${postfix}::`}
				postfix={space_bird ? `::${$space_bird.birdex + 1}` : ``}
			/>

		{/if}

	</Flock>
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