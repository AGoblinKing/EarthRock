<script>
import { load, image } from "/sys/file.js"

import * as warps from "/weave/warps.js"

import color from "/_client/action/color.js"
import { cursor, goto } from "/_client/action/nav.js"

$: arr_warps = Object.entries(warps)

let last = {}
let files
export let nameit = false
export const id = `/picker`

const drop = (e) => {
	e.preventDefault()
	e.stopPropagation()
	const files = e.dataTransfer.files
	for (let i = 0; i < files.length; i++) {
		const reader = new FileReader()

		reader.onloadend = (e) => {
			last = files[i]
			nameit = load(e.target.result)
			if (!nameit) return
			name = `${nameit.name}`
		}
		reader.readAsDataURL(files[i])
	}
}

// prevent a dead zone
$: {
	if (nameit === false && $cursor && $cursor.id === `/picker`) {
		goto(`/`)
	}
}

const over = (whether) => (e) => {
	e.dataTransfer.dropEffect = `copy`
	e.preventDefault()
	e.stopPropagation()
}

export const cancel = () => {
	nameit = false
}

export const click = () => {
	play_it()
}

const play_it = () => {
	delete nameit.id

	Wheel.spawn({
		[name]: nameit
	})

	const weave = Wheel.get(name)

	weave.write({
		"!info": {
			type: `space`,
			value: {
				from: last.name,
				"save last": last.lastModified,
				size: last.size
			}
		}
	})

	Wheel.start(name)
	nameit = false
}
let name
</script>

{#if nameit}
<div
	class="nameprompt"
	use:color={`/${name}`}
>
	<h2>Name It!</h2>

	<div class="spirit">
	{#await image(name) then src}
		<img  class="flex" {src} alt="fileicon"/>
	{/await}
	</div>

	<input
		class="nameit"
		on:keydown={(e) => {
			if (e.key.toLowerCase() === `end`) {
				nameit = false
				return
			}
			if (e.which !== 13) return
			play_it()
		}}
		autofocus
		type="text"
		bind:value={name}
		placeholder="Name it"
	/>
	<div class="controls">
		<div class="false" on:click={() => { nameit = false }}>Cancel</div>
		<div class="true" on:click={play_it}>Plant</div>
	</div>
</div>
{/if}

<div
  class="picker"

  on:drop={drop}
  on:dragover={over(true)}
  on:dragleave={over(false)}
><slot/></div>

<input
  type="file"
  class="file"
  bind:this={files}
  multiple="multiple"
  on:change={(e) => {
    console.log(e.dataTransfer, e.target)
  }}
/>

<style>
.spirit {
  margin: 1rem;
  height: 10rem;
  display: flex;
  width: 10rem;
  border: 0.2rem solid black;
}
.nameit {
  background-color: #111;
  border: 0.25rem solid #333;
}
.file {
  display: none;
}
.flex {
  flex: 1;
}
.picker {
  position: absolute;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	z-index: 4;
	color: #0c4213;
}

.controls {
  display: flex;
  justify-content: flex-end;
}
.false:hover, .true:hover {
  background-color: blue;
}
.false, .true {
  padding: 1rem;
  border: 0.25rem solid #333;
  margin: 0.25rem;
}
.false {
  background-color: red;
}
.true {
  background-color: green;
}
.nameprompt {
  flex-direction: column;
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  top: 50%;
  padding: 5rem;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: #111;
  z-index: 10011;
  border: 1rem solid black;
}

</style>