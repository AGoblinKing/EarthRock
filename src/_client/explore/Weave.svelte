<script>
import nav from "/_client/action/nav.js"
import Controls from "/_client/weave/Controls.svelte"

import { dark } from "/_client/action/color.js"

import Space from "./Space.svelte"

export let weave
export let navi = {}

$: name = weave.name
$: names = weave.names

let open = weave.name.get() !== Wheel.SYSTEM

$: spacees = Object.entries($names).sort(([a], [b]) => {
	if (a > b) return 1
	if (b > a) return -1
	return 0
})

$: warps = weave.warps

const get_up = (idx) => {
	const [name_o, space_o] = spacees[idx - 1]
	const keys = Object.keys(space_o.value.get()).sort()

	return keys.length > 0 ? `${$name}/${name_o}/${keys[keys.length - 1]}` : `${$name}/${name_o}`
}
let controls
</script>

<div
	class="weave"
	class:open
	use:dark={$name}
	use:nav={{
		id: $name,
		up: navi.up,
		down: open && spacees.length > 0 ? `${$name}/${spacees[0][0]}` : navi.down,
		page_down: open && spacees.length > 0 ? `${$name}/${spacees[0][0]}` : navi.down,
		page_up: navi.up,
		origin: $name === `sys`,
		left: () => {
			controls.toggle()
		},
		right: () => {
			controls.save_it()
		},
		insert: () => {
			// prompt for weave ala picker

		},
		del: () => {
			Wheel.del([$name])
		}
	}}

	on:click={() => {
		open = !open
	}}
>
	<Controls {weave} bind:this={controls}>
		<div class="namezor">
			{$name}
		</div>
	</Controls>
</div>

{#if open}
	<div class="spaces">
		{#each spacees as [s_name,space], i (s_name)}
			<Space
				{space}
				{weave}
				navi={{
					up: i === 0 ? $name : get_up(i),
					page_up: i === 0 ? $name : `${$name}/${spacees[i - 1][0]}`,
					down: i === spacees.length - 1 ? navi.down : `${$name}/${spacees[i + 1][0]}`
				}}
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
	border: 0.1rem solid rgba(0,0, 0,0.2);
	border-bottom: none;
	margin-top: -0.25rem;
	border-right: none;
	font-size: 2rem;
	border-radius: 0.5rem;
}

.weave:hover {
	color: white;
}

.namezor {
	flex: 1;
}
</style>
