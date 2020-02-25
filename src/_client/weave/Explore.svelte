<script>
	import { blur } from "svelte/transition"
	import { key } from "/sys/key.js"
	import { button } from "/sys/gamepad.js"
	import { random } from "/text.js"

	import { THEME_COLOR } from "/sys/flag.js"
	import nav, { cursor, goto } from "/_client/action/nav.js"

	import Control from "/_client/control/Control.svelte"
	import Weave from "/_client/explore/Weave.svelte"
	import Github from "./Github.svelte"
	import Picker from "./Picker.svelte"
	import MainScreen from "./MainScreen.svelte"

	// explore ele
	let explore

	let last_cursor
	key.listen(char => {
		if (char !== `\`` && char !== `pause`) return
		hidden = !hidden
		if (hidden) {
			last_cursor = cursor.get().id
			cursor.set({
				id: `$game`
			})
		} else {
			requestAnimationFrame(() => {
				goto(last_cursor)
				const ele = cursor.get()
				if (!ele) return
				const br = ele.getBoundingClientRect()
				if (!br) return
				explore.scrollTo({ top: br.top })
			})
		}
	})

	button.listen(button => {
		if (button !== `select`) return
		hidden = !hidden
	})

	$: weaves = Wheel.weaves
	$: ws = Object.values($weaves).sort(({ name: a }, { name: b }) => {
		const $a = a.get()
		const $b = b.get()
		if ($a > $b) return 1
		if ($b > $a) return -1
		return 0
	})

	export let hidden = window.location.hash.indexOf(`dev`) === -1

	let nameit = false
	let picker

	const top_space = () => {
		const weave = ws[ws.length - 1]
		if (!weave) return

		const spaces = weave.names.get()
		const space_keys = Object.keys(spaces)
		if (space_keys.length < 1) return weave.name.get()
		const space_key = space_keys[space_keys.length - 1]
		const twists = Object.keys(spaces[space_key].value.get()).sort()

		if (twists.length < 1) return `${weave.name.get()}/${space_key}`

		return `${weave.name.get()}/${space_key}/${twists[twists.length - 1]}`
	}

	const expand = name => {
		const weave = Wheel.get(name)
		if (!weave) return name

		const $names = weave.names.get()
		const name_keys = Object.keys($names).sort()
		if (name_keys.length === 0) return name

		const name_key = name_keys[name_keys.length - 1]
		const named = $names[name_key]
		name = `${name}${Wheel.DENOTE}${name_key}`

		const v = named.value.get()
		const v_keys = Object.keys(v).sort()
		if (v_keys.length === 0) return name

		return `${name}${Wheel.DENOTE}${v_keys[v_keys.length - 1]}`
	}

	let last
	let patreon
	$: {
		if ($cursor !== last) {
			patreon = 0
		}
		last = $cursor
	}

	let boxed = false
	let attempting = false
	$: {
		if (!hidden && !boxed && !attempting) {
			attempting = true
			requestAnimationFrame(() => {
				boxed = !boxed
			})
		}

		if (hidden && attempting) {
			boxed = false
			attempting = false
		}
	}
</script>

<MainScreen {hidden} />
<Control />
<Picker {nameit} bind:this={picker}>
{#if !hidden}
	<a class="github" href="https://github.com/agoblinking/earthrock" target="_new">
		<Github />
	</a>

	<div
		class="explore"
		class:boxed
		style="color: {$THEME_COLOR};"
		transition:blur={{ duration: 250, amount: 2 }}
		bind:this={explore}
	>
		<div class="partial">

		<a
			class="logo"
			href="https://www.patreon.com/earthrock"
			target="_new"
			on:click={(e) => {
				if (patreon !== 0) return
				patreon++
				e.preventDefault()
			}}

			use:nav={{
				id: Wheel.DENOTE,
				up: () => top_space,
        		origin: true,
				down: () => ws[0].name.get(),
				page_up: () => ws[ws.length - 1].name.get(),
				page_down: () => ws[0].name.get(),
				insert: () => {
					// pop up picker with a blank
					nameit = { name: random(2) }

					requestAnimationFrame(() => {
						cursor.set(picker)
					})
				}
			}}
		><i>E</i>ARTHROC<i>K</i><b>make believe with friends</b></a>

		<div class="weaves">
			{#each ws as weave, i (weave.id.get())}
				<Weave {weave} navi={{
					up: () => ws[i - 1] ? expand(ws[i - 1].name.get()) : Wheel.DENOTE,
					down: () => ws[i + 1] ? ws[i + 1].name.get() : Wheel.DENOTE
				}}/>
			{/each}
		</div>
		</div>
	</div>
{/if}
</Picker>

<style>
	:global(.nav) {
	  z-index: 2;
	  color: white;
	  box-shadow: inset 0 2rem 0 rgba(224, 168, 83, 0.5),
	    inset 0 -2rem 0 rgba(224, 168, 83, 0.5),
	    inset 1.6rem 0 0 rgba(224, 168, 83, 1),
	    inset -1.6rem 0 0 rgba(224, 168, 83, 1) !important;
	}

	:global(.nav.beat) {
	  box-shadow: inset 0 5rem 0 rgba(224, 168, 83, 0.25),
	    inset 0 -5rem 0 rgba(224, 168, 83, 0.25),
	    inset 1rem 0 0 rgba(224, 168, 83, 0.5),
	    inset -1rem 0 0 rgba(224, 168, 83, 0.5);
	}

	.logo i {
		display: inline-block;
		text-decoration: none;
		font-style: normal;
		font-size: 3rem;
		vertical-align: text-top;
		margin-top: -0.25rem;
	}

	.logo b {
		margin-top: -1.25rem;
		display: block;
		margin-left: -0.4rem;
		font-size: 0.6rem;
		letter-spacing: 0.075rem;
	}

	.logo {
	  color: white !important;
	  padding: 2rem 0.25rem;
	  font-size: 2rem;
	  font-weight: bold;
	  text-decoration: none;
	  outline: none;

	  text-align: center;
	  letter-spacing: 0.5rem;
	  color: rgb(224, 168, 83);
	  margin: 0 2rem;
	}

	:global(.nav).logo {
		 box-shadow: inset 0 5rem 0 rgba(224, 168, 83, 0.5),
	    inset 0 -5rem 0 rgba(224, 168, 83, 0.5),
	    inset 1.6rem 0 0 rgba(224, 168, 83, 1),
	    inset -1.6rem 0 0 rgba(224, 168, 83, 1) !important;
	}

	.logo:hover {
	  color: rgba(60, 255, 0, 0.8);
	}

	.partial {
	  width: 25rem;
	  display: flex;
	  flex-direction: column;
	  box-shadow: 0 0 5rem rgba(38, 0, 255, 0.1),
	    inset 0 0 5rem rgba(38, 0, 255, 0.1);
	}

	.boxed {
	  box-shadow: inset 0 5vh 5rem rgba(38, 0, 255, 0.2),
	    inset 0 -5vh 5rem rgba(38, 0, 255, 0.2),
	    inset 40vw 0 5rem rgba(38, 0, 255, 0.2),
	    inset -40vw 0 5rem rgba(38, 0, 255, 0.2) !important;
	}

	.explore {
	  opacity: 0.95;
	  position: absolute;
	  align-items: center;
	  font-size: 1.25rem;
	  scrollbar-color: #333;
	  scrollbar-width: 1rem;
	  scroll-behavior: smooth;
	  overflow-y: auto;
	  left: 0;
	  right: 0;
	  top: 0;
	  bottom: 0;
	  display: flex;
	  flex-direction: column;
	  z-index: 5;
	}

	.weaves {
	  display: flex;
	  pointer-events: all;
	  flex-direction: column;
	}

	.github {
	  position: fixed;
	  z-index: 100;
	  top: 0;
	  right: 0;
	}
</style>
