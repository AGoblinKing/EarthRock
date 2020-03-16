<script>
import raf from "raf"

import color from "../action/color"
import { Read, Store } from "src/store"
import { random } from "src/lib/text"

import nav, { goto, cursor } from "../action/nav"
import Flock from "./Flock.svelte"
import Channel from "./Channel.svelte"
import Postage from "../Postage.svelte"

export let space
export let weave
export let is_bird = false
export let navi = {}
export let i

const open = true

$: w_name = weave.name
$: w_rezed = weave.rezed

$: value = space ? space.value : new Read({
	"!name": new Read(``),
	"!birds": new Read([])
})

$: name = $value[`!name`] || new Read(``)
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
	const down = () => chans[idx + 1]
		? `${space.address()}/${chans[idx + 1][0]}`
		: navi.down()

	const up = () => chans[idx - 1]
		? `${space.address()}/${chans[idx - 1][0]}`
		: space.address()

	return {
		id: `${space.address()}/${self}`,
		down,
		up,
		page_up: () => space.address(),
		page_down: () => navi.down(),
		home: () => space.address()
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

const space_bird = new Store(false)
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
			right: toggle,
			down: () => chans.length > 0 ? `${space.address()}/${chans[0][0]}` : navi.down(),
			page_up: navi.page_up,
			page_down: navi.down,
			del: () => {
				weave.remove($id)
				return navi.down === Wheel.DENOTE ? navi.up : navi.down
			},

			insert: () => {
				const idx = random(2)
				// TODO: I fucked up insert

				// now put that node in edit mode
				raf(() => {
					goto(`${space.address()}/${idx}`)
					cursor.get().insert()
				})
			}
		}}
>
		<div class="name">
			{$name}
		</div>

		<div class="postage" on:click={toggle}>
			<Postage address={`${$w_name}/${$name}`}/>
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
		nothnew Read={is_bird}
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
  display: flex;
	width: 2rem;
	height: 2rem;
	margin: 0.5rem 1rem;
}

.space {
	box-shadow: inset 0rem 5rem 0 rgba(0,0,0,0.1),
		inset 0rem -5rem 0 rgba(0,0,0,0.1),
		inset 13rem 0 0 rgba(0,0,0,0.1),
		inset -13rem 0 0 rgba(0,0,0,0.1);
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
:global(.nav).space {
	box-shadow:
		inset 0 1rem 0 rgba(224, 168, 83,0.5),
		inset 0 -1rem 0 rgba(224, 168, 83,0.5),
		inset 13rem 0 0 rgba(224, 168, 83,1),
		inset -13rem 0 0 rgba(224, 168, 83,1) !important;
}
</style>