<script>
import SpriteEditor from "/_client/editor/SpriteEditor.svelte"
import ColorEditor from "/_client/editor/ColorEditor.svelte"
import color from "/_client/action/color.js"
import nav, { cursor, goto } from "/_client/action/nav.js"

import Thread from "./Thread.svelte"

import { json } from "/util/parse.js"

export let space
export let nothread
export let weave
export let channel
export let side = `in`
export let focus = false
export let executed = () => {}
export let navi

let key_editing = false

$: [key, value] = channel

$: edit = $value
$: editing = focus

$: address = `${space.address()}/${key}`

let val = ``

const cancel = () => {
	editing = false
	val = ``
}

const execute = () => {
	editing = false

	// renaming ourselves

	try {
		value.set(json(val.trim()))

		const new_address = `${weave.name.get()}/${value.get()}/!name`

		if (key === `!name` && $cursor.id === address) {
			requestAnimationFrame(() => {
				goto(new_address)
			})
		}
	} catch (ex) {
		// no boggie
	}
	val = ``
	executed()
}

const focusd = (node) => {
	requestAnimationFrame(() => node.focus())
}
let edit_sprite = false
let thread_left
let thread_right
let value_node
let key_new

const new_key = () => {
	key_editing = false
	const id = space.id.get()
	if (key_new === ``) return

	const old_addr = `${id}/${key}`
	const new_addr = `${id}/${key_new}`

	// grab scripts
	const $wefts = weave.wefts.get()
	const left = weave.chain(old_addr).slice(0, -1).pop()
	const right = weave.chain(old_addr, true).slice(1).pop()

	if (left) {
		$wefts[left] = new_addr
	}

	if (right) {
		delete $wefts[old_addr]
		$wefts[new_addr] = right
	}

	if (left || right) {
		weave.wefts.set($wefts, true)
	}

	// rename
	space.remove(key)
	space.write({
		[key_new]: value.get()
	})

	requestAnimationFrame(() => {
		goto(`${space.address()}/${key_new}`)
		key_new = ``
	})
}
let chan_node
</script>

<div
	class="channel {side}"
  	bind:this={chan_node}
	use:color={space.name().get()}
	use:nav={{
		...navi,
		left: () => {
			thread_left.do_edit()
		},
		right: () => {
			thread_right.do_edit()
		},
		insert: () => {
      		if (key === `!name`) return

 			key_editing = true
      		key_new = key
		},
		del: () => {
			// don't delete !name
			if (key === `!name`) return

			space.remove(key)
			const up = navi.up()
			const down = navi.down()
			// exhaust upwards then try downwards
			goto(up === `${space.address()}/!name` && down.indexOf(space.address()) !== -1 ? down : up)
		}
	}}

	on:click={(e) => {
		if (e) {
			console.log(e)
			cursor.set(chan_node)
			return
		}

			if (key === `sprite`) {
				edit_sprite = true
				requestAnimationFrame(() => {
					cursor.set(value_node)
				})
				return
			}

			editing = true
			val = JSON.stringify($value)
		}}
>

<Thread {channel} {space} {weave} {nothread} bind:this={thread_left}/>
{#if key_editing}
	<input type="text" class="edit" autofocus````
		bind:value={key_new}
		on:keydown={({ which, code }) => {
			if (code === `End`) {
				key_editing = false
				return
			}

			if (which !== 13 && code !== `ControlRight`) return

			new_key()
		}}

		on:blur={() => {
			key_editing = false
		}}
	/>
{:else if !editing}
<div class="dataset">
	<div class="key">
		{key}
	</div>

	{#if key === `sprite`}
		<SpriteEditor
			{value}
			back={address}
			editing={edit_sprite}
			bind:this={value_node}
		/>
		<div class="flex"/>
	{:else if key === `color`}
		<ColorEditor {value} />
		<div class="flex"/>
	{:else}
	<div class="value">
		{
		JSON.stringify(edit)
		}
	</div>
	{/if}
</div>
{:else}
	<input
		class="edit"
		use:focusd
		type="text"
		bind:value={val}
		placeholder="JSON PLZ"
		on:keydown={({ which, code }) => {
			if (code === `End`) return cancel()
			if (which !== 13 && code !== `ControlRight`) return
			execute()
		}}
		on:blur={() => {
			execute()
		}}
	/>
{/if}

<Thread {channel} {space} {weave} {nothread} right={true} bind:this={thread_right} />

</div>
<style>

.dataset {
	display: flex;
	border-top: 0.1rem solid rgba(0,0, 0,0.2);
	flex: 1;
	justify-content: center;
	align-items: center;
}


.edit {
	padding: 0.5rem;
	width: 100%;
}

.channel {
  user-select: none;
	display: flex;
	overflow: hidden;
	margin-left: 1rem;
	margin-right: 2rem;
	transition: all 250ms ease-in-out;
}

.channel.out {
	margin-left: 0;
	margin-right: 1rem;
	flex-direction: row-reverse;
}

.key {
	border-right: 0.1rem solid rgba(0,0, 0,0.2);
	padding: 0.5rem;
}

.flex { flex: 1; }

.out .key {
	border-right: none;
	border-right: 0.1rem solid rgba(0,0, 0,0.2);
}

.value {
	display: flex;
	flex: 1;
	max-height: 1rem;
	user-select: all;
	padding: 0.5rem;
	overflow: hidden;
	word-break: break-all;
	text-align: left;
	opacity: 0.75;
}

.channel:hover {
	color: white;
	box-shadow:
	inset 0 2rem  0 rgba(224, 168, 83,0.5),
	inset 0 -2rem  0 rgba(224, 168, 83,0.5);
}



</style>