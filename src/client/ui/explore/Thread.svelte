<script>
import color from "/_client/action/color.js"
import ThreadEditor from "/_client/editor/ThreadEditor.svelte"
import Warp from "/_client/thread/Warp.svelte"

import { tick } from "/sys/time.js"
import { THEME_BG } from "/sys/flag.js"

import { translate, format, condense } from "/weave/thread.js"

export let channel
export let space
export let weave
export let nothread
export let right = false

let editing = false
$: address = `${space.id.get()}/${channel[0]}`
$: value = channel[1]

let chain

const get_chain = () => right
	? weave.chain(address, right).slice(0, -1)
	: weave.chain(address).slice(0, -1)

const update_chain = () => {
	chain = get_chain()
}

$: {
	update_chain($value)
}

$: boxes = chain
	.map((i) => translate(i, weave))
	.join(` => `)

$: time_cut = $tick && Date.now() - 1000

let edit = ``

const execute = () => {
	if (!editing) return
	editing = false

	update_chain()
}

$:style = [
	`background-color: ${$THEME_BG};`
].join(``)

export const do_edit = (e) => {
	if (e) {
		e.preventDefault()
		e.stopPropagation()
	}

	if (weave.name.get() === Wheel.SYSTEM) return
	if (editing) return
	editing = true

	if (right) {
		edit = format(
			get_chain()
				.map((i) => translate(i, weave))
				.reverse()
				.join(` => `)
		)
	} else {
		edit = format(
			get_chain()
				.map((i) => translate(i, weave))
				.join(` => `)
		)
	}
}

// TODO: light up on value changes
// can light up based on value changes instead!
// $feed[`${weave.name.get()}/${link}`] > time_cut}
$:active = false
</script>

{#if editing}
	<ThreadEditor code={edit} ondone={execute} {weave} {address} {right}/>
{/if}

{#if nothread}
	<div
		class="cap"
		class:nothread
	>
		{#if chain.length > 0}
			{chain.length}
		{:else}
			&nbsp;
		{/if}
	</div>
{:else}
	{#if chain.length > 0}
		<div
			class="spot"
			class:right
			on:click={do_edit}
		>
		{#each chain as link}
			<div
				class="thread"
				{style}
				use:color={condense(link, weave)}
				class:active
			>
				<Warp {weave} id={link} />
			</div>
			<div
				class="after-thread"
				{style}
				class:active
			>
				>
			</div>
		{/each}
		</div>
	{/if}
	<div
		class="cap"
		on:click={do_edit}
	>
	 {#if chain.length > 0}
			{chain.length}
		{:else}
			&nbsp;
		{/if}
	</div>
{/if}

<style>
.spot {
	display: flex;
	align-items: center;
	justify-content: flex-start;
	position: absolute;
	right: 50%;
	margin-right: 10.5rem;
	margin-top: -0.2rem;
}

.spot.right {
	left:50%;
	margin-left: 10.5rem;
	flex-direction: row-reverse;
	right: auto;
}

.thread {
	white-space: nowrap;
	transition: all 250ms ease-in-out;
	border: 0.1rem solid rgba(0,0, 0,0.2);
	border-radius: 0.25rem;
	box-shadow: 0.25rem 0.25rem 0 rgba(0, 217, 255, 0),
	-0.25rem -0.25rem 0 rgba(0, 217, 255, 0);
}


.thread.active {
	box-shadow: 0.25rem 0.25rem 0 rgba(255, 115, 0, 0.25),
	-0.25rem -0.25rem 0 rgba(255, 115, 0, 0.25);
}

.thread:hover {
	color: white;
}

.after-thread {
	margin-top: 0.5rem;
	opacity: 0.5;
	border: 0.1rem solid rgba(0,0, 0,0.2);
	padding: 0.5 0.5rem;
	color: rgba(255, 255, 255, 0.5);
}


.cap.nothread:hover {
	background-color: rgba(0,0,0,0.5);
}

.cap {
	display: flex;
	justify-content: center;
	background-color: rgba(0,0,0,0.5);
	border-right: 0.25rem solid rgba(255,255,255,0.0.5);
	padding: 0.5rem;
	z-index: 2;
	color: rgba(255, 255, 255, 0.25);
	user-select: none;
	transition: all 250ms ease-in-out;
}

.cap:hover {
	box-shadow:
	inset 0.85rem 0 0 rgba(224, 168, 83,0.5),
	inset -0.85rem 0 0 rgba(224, 168, 83,0.5);
}

</style>

