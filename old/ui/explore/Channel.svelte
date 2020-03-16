<script>
import raf from "raf"

import SpriteEditor from "../editor/SpriteEditor.svelte"
import ColorEditor from "../editor/ColorEditor.svelte"
import color from "../action/color"
import nav, { cursor, goto } from "../action/nav"


import Thread from "./Thread.svelte"

import { json } from "src/lib/parse"

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
$: editing = focus
$: address = `${space.address()}/${key}`

const do_focus = ({ target }) => {
	target.click()
	target.click()
	target.select()
	target.focus()
}
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
	} catch (ex) {
		value.set(`${val.trim()}`)
		if (!val) debugger
	}

	if (key === `!name` && $cursor.id === address) {
		const new_address = `${weave.name.get()}/${value.get()}/!name`
		raf(() => {
			goto(new_address)
		})
	}

	val = ``
	executed()
}

const focusd = (node) => {
	raf(() => node.focus())
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

	raf(() => {
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
    	keyboard: true,
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
			// exhaust up+wards then try downwards
			goto(up === `${space.address()}/!name` && down.indexOf(space.address()) !== -1 ? down : up)
		}
	}}

	on:click={(e) => {
    if (e && e.isTrusted) {
      cursor.set(chan_node)
      return
    }

    if (key === `sprite`) {
      edit_sprite = true
      raf(() => {
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
		<input type="text" class="edit" 
			bind:value={key_new}
			on:focus={do_focus}
			autocapitalize="none"
			on:keydown={(e) => {
				const { which, code, key } = e

				if (code === `End`) {
					key_editing = false
					return
				}

				if (key === ` `) {
					e.preventDefault()
					raf(() => {
						key_new = key_new === undefined ? `_` : `${key_new}_`
						e.target.value = key_new
					})
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
			JSON.stringify($value)
			}
		</div>
		{/if}
	</div>
	{:else}
		<input
			spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off"
			class="edit"
			use:focusd
			type="text"
			bind:value={val}
			placeholder="JSON PLZ"
			on:focus={do_focus}
			on:keydown={(e) => {
				const { key, which, code } = e

				if (key === ` `) {
					e.preventDefault()
					raf(() => {
						val = val === undefined ? `_` : `${val}_`
						e.target.value = val
					})
					return
				}

				if (code === `End`) return cancel()
				if (which !== 13 && code !== `ControlRight`) return
				execute()
			}}

			on:blur={() => {
				if (editing) {
					execute()
				}
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
	padding: 0.25rem;
	overflow: hidden;
	word-break: break-all;
	text-align: left;
	align-items: center;
	opacity: 0.75;
}

.channel:hover {
	color: white;
	box-shadow:
	inset 0 2rem  0 rgba(81, 200, 51, 0.5),
	inset 0 -2rem  0 rgba(81, 200, 51, 0.5);
}



</style>