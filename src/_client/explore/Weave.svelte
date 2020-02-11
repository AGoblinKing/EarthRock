<script>
import nav, { cursor, goto } from "/_client/action/nav.js"
import Controls from "/_client/weave/Controls.svelte"
import cuid from "cuid"
import { random } from "/text.js"

import { dark } from "/_client/action/color.js"

import Space from "./Space.svelte"

export let weave
export let navi = {}

$: name = weave.name
$: names = weave.names

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
	use:dark={$name}
	use:nav={{
		id: $name,
		up: () => navi.up,
		down: () => spacees.length > 0 ? `${$name}/${spacees[0][0]}` : navi.down,
		page_down: () => spacees.length > 0 ? `${$name}/${spacees[0][0]}` : navi.down,
		page_up: () => navi.up,
		origin: $name === `sys`,
		left: () => {
			controls.toggle()
		},
		right: () => {
			controls.save_it()
		},
		insert: () => {
			const space_name = random(2)
			// prompt for weave ala picker
			weave.write({
				[cuid()]: {
					type: `space`,
					value: {
						"!name": space_name
					}
				}
			})

			requestAnimationFrame(() => {
				goto(`${$name}/${space_name}/!name`)
				// edit
				cursor.get().click()
			})
		},
		del: () => {
			Wheel.del([$name])

			return navi.down
		}
	}}
>
	<Controls {weave} bind:this={controls}>
		<div class="namezor">
			{$name}
		</div>
	</Controls>
</div>


	<div class="spaces">
		{#each spacees as [s_name,space], i (s_name)}
			<Space
				{space}
				{weave}
				{i}
				navi={{
					up: i === 0 ? $name : get_up(i),
					page_up: i === 0 ? $name : `${$name}/${spacees[i - 1][0]}`,
					down: i === spacees.length - 1 ? navi.down : `${$name}/${spacees[i + 1][0]}`
				}}
			/>

		{/each}

	</div>


<div class="fakespace" use:dark={$name}></div>

<style>

.fakespace {
	box-shadow: inset 10rem 10rem 0 rgba(0,0,0,0.25),
		inset -10rem -10rem 0 rgba(0,0,0,0.25);
	padding: 0.5rem;
	padding-right: 1rem;
	border-radius: 0.5rem;
	margin: 0 1rem;
}

.weave {
	align-items: center;
	text-align: left;
	flex-direction: row-reverse;
	display: flex;
	padding: 1rem;
	font-size: 2rem;
	box-shadow: inset 0rem 5rem 0 rgba(255,255,255,0.05),
		inset 0rem -5rem 0 rgba(255,255,255,0.05),
		inset 5rem 0 0 rgba(255,255,255,0.05),
		inset -5rem 0 0 rgba(255,255,255,0.05);

	border-radius: 0.5rem;
}

.weave:hover {
	color: white;
}

.namezor {
	margin: 0 1rem;
	flex: 1;
}

:global(.nav).weave {
	box-shadow:
		inset 0 0.5rem 0 rgba(224, 168, 83,0.5),
		inset 0 -0.5rem 0 rgba(224, 168, 83,0.5),
		inset 5rem 0 0 rgba(224, 168, 83,1),
		inset -5rem 0 0 rgba(224, 168, 83,1) !important;
}
</style>
