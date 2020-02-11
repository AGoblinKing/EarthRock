<script>
import color from "/_client/action/color.js"
import { read, write } from "/store.js"

import nav, { goto, cursor } from "/_client/action/nav.js"
import Flock from "./Flock.svelte"
import Channel from "./Channel.svelte"
import Postage from "/_client/weave/Postage.svelte"

export let space
export let weave
export let is_bird = false
export let navi = {}
export let i

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

const get_nav = (idx) => {
	const self = chans[idx][0]
	const down = chans[idx + 1]
		? `${space.address()}/${chans[idx + 1][0]}`
		: navi.down

	const up = chans[idx - 1]
		? `${space.address()}/${chans[idx - 1][0]}`
		: space.address()

	return {
		id: `${space.address()}/${self}`,
		down,
		up,
		page_up: space.address(),
		page_down: navi.down,
		home: space.address()
	}
}

const toggle = (e) => {
	if (e) {
		e.preventDefault()
		e.stopPropagation()
	}

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
		class:zero={i === 0}
		use:color={$name}
		use:nav={{
			id: space.address(),
			up: navi.up,
			left: toggle,
			down: chans.length > 0 ? `${space.address()}/${chans[0][0]}` : navi.down,
			page_up: navi.page_up,
			page_down: navi.down,
			del: () => {
				weave.remove($id)
				return navi.down === `/` ? navi.up : navi.down
			},
			insert: () => {
				space.write({
					"": ``
				})

				// now put that node in edit mode
				requestAnimationFrame(() => {
					goto(`${space.address()}/`)
					cursor.get().insert()
				})
			}
		}}
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
	{#each chans as channel, i (channel[0])}
	<Channel
		{channel}
		{space}
		{weave}
		nothread={is_bird}
		navi={get_nav(i)}
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
	box-shadow: inset 10rem 10rem 0 rgba(0,0,0,0.25),
		inset -10rem -10rem 0 rgba(0,0,0,0.25);
	display: flex;
	align-items: center;
	padding: 0.5rem;
	padding-right: 1rem;
	border-radius: 0.5rem;
	margin: 0 1rem;
}

.name {
	flex: 1;
	font-size: 2rem;
}

.space:hover {
	color: white;
}

.zero {
	border-top-left-radius: 0;
	border-top-right-radius: 0;
}
</style>