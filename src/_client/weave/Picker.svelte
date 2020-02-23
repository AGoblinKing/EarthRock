<script>
	import Tile from "/_client/image/Tile.svelte"
	import { load, image } from "/sys/file.js"

	import * as warps from "/weave/warps.js"

	import color from "/_client/action/color.js"
	import { cursor, goto } from "/_client/action/nav.js"

	$: arr_warps = Object.entries(warps)

	let last = {}
	let files
	export let nameit = false
	let name
$: {
		if (nameit.name) {
			name = nameit.name.replace(/ /g, `_`)
			nameit.name = false
		}
}
	export const id = `${Wheel.DENOTE}picker`

	const drop = e => {
		e.preventDefault()
		e.stopPropagation()
		const files = e.dataTransfer.files
		for (let i = 0; i < files.length; i++) {
			const reader = new FileReader()

			reader.onloadend = e => {
				last = files[i]
				nameit = load(e.target.result)
			}
			reader.readAsDataURL(files[i])
		}
}

	// prevent a dead zone
	$: {
		if (nameit === false && $cursor && $cursor.id === `${Wheel.DENOTE}picker`) {
			goto(Wheel.DENOTE)
		}
	}

	const over = whether => e => {
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

		name = name
			.trim()
			.toLowerCase()
			.replace(/ /g, `_`)
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
</script>

{#if nameit}
<div
	class="nameprompt"

>
	<div class="spirit" 	use:color={`${Wheel.DENOTE}${name}`}>
	{#await image(name) then src}
		<img  class="flex" {src} alt="fileicon"/>
	{/await}
	</div>

	<input
  	use:color={`${Wheel.DENOTE}${name}`}
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
    autocapitalize="none"
    on:focus={(e) => {
      e.target.click()
      e.target.select()
    }}
		bind:value={name}
		placeholder="Name it"
	/>
	<div class="controls" 	use:color={`${Wheel.DENOTE}${name}`}>
		<div class="false" on:click={() => { nameit = false }}>
      <Tile width={1} height={1} data="856" />
    </div>
		<div class="true" on:click={play_it}>
      <Tile width={1} height={1} data="855" />
    </div>
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
    border: 5rem solid rgba(0,0,0,0.5);
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
  .false:hover,
  .true:hover {
    background-color: blue;
  }
  .false,
  .true {
    display: flex;
    padding: 0.25rem;
    margin: 0.25rem;
    height: 3rem;
    width: 3rem;
    border-radius: 2rem;
    background-color: rgba(224, 168, 83,0.1);
  }

  .nameprompt {
    flex-direction: column;
    display: flex;
    align-items: center;
    justify-content: center;
    position: absolute;
    top: 50%;

    left: 50%;
    transform: translate(-50%, -50%);

    z-index: 10011;

  }
</style>
