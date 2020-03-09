<script>
	import Tile from "/_client/image/Tile.svelte"
	import { load } from "/sys/file.js"

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
				value: last.name ? {
					from: last.name,
					"save last": last.lastModified,
					size: last.size
				} : {}
			}
		})

		Wheel.start(name)
		nameit = false
	}
</script>

{#if nameit}
<div
	class="nameprompt"
	on:mouseover={(e) => {
		e.preventDefault()
		e.preventPropogation()
	}}
>
	<div class="spirit" use:color={`${Wheel.DENOTE}${name}`}>
		<Tile width={1} height={1} text={name} />
	</div>

	<input
  		use:color={`${Wheel.DENOTE}${name}`}
		class="nameit"
		on:keydown={(e) => {
			if (e.key.toLowerCase() === `end`) {
				nameit = false
				return
			}
			if (e.key === ` `) {
				e.preventDefault()
				requestAnimationFrame(() => {
					name += `_`
					e.target.value = name
				})
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
	padding: 5rem;
    height: 15rem;
    display: flex;
    width: 15rem;
	border-radius: 2rem;
	background-color: #0c4213;
	box-shadow:inset 0 0 2rem #0c4213;
  }

  .nameit {
	position: absolute;
	margin-top: 9rem;
	padding: 0.2rem;
	padding: 0rem;
	border-radius: none !important;
  }

  .file {
    display: none;
  }

  .picker {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 4;
    color: #0c4213;
	box-shadow: inset 0 5vh 5rem rgba(255, 255, 255, 0.01),
	    inset 0 -5vh 5rem rgba(255, 255, 255, 0.01),
	    inset 90vw 0 5rem rgba(255, 255, 255, 0.01),
	    inset -90vw 0 5rem rgba(255, 255, 255, 0.01) !important;
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
