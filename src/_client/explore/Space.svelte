<script>
import color from "/_client/action/color.js"
import { THEME_BORDER } from "/sys/flag.js"
import { read, write } from "/store.js"

import Flock from "./Flock.svelte"
import Channel from "./Channel.svelte"
import Postage from "/_client/weave/Postage.svelte"

export let space
export let weave
export let is_bird = false

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
		weave.derez(id)
	} else {
		weave.rez(id)
	}
}

const space_bird = write(false)
</script>

{#if !is_bird}
	<div
		class="space"
		class:open
		use:color={$name}
		style="border: 0.25rem solid {$THEME_BORDER};"
	>
	<div class="postage" on:click={toggle}>
			<Postage address={`/${$w_name}/${$name}`}/>
		</div>
		<div class="name">
			{$name}
		</div>


	</div>
{/if}

{#if open}
  <div class="chans">
  {#each chans as channel (channel[0])}
	  <Channel
		{channel}
		{space}
		{weave}
		nothread={is_bird}
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
				is_bird={true}
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
  margin: 0.5rem 1rem;
}

.space {
  display: flex;
  align-items: center;
  padding: 0.5rem;
	margin: 0 1rem;
  border-right: none;
  padding-right: 1rem;
}

.name {
  flex: 1;
	font-size: 2rem;
}

.space:hover {
  color: white;
}

.is_bird {
	display: none;
}
</style>