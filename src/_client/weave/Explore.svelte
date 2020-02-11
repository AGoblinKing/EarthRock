<script>
import { github } from "/sys/file.js"
import { key } from "/sys/key.js"
import { button } from "/sys/gamepad.js"

import { THEME_STYLE, THEME_COLOR } from "/sys/flag.js"

import nav, { cursor } from "/_client/action/nav.js"
import Omni from "/_client/explore/Omni.svelte"
import Weave from "/_client/explore/Weave.svelte"
import Github from "./Github.svelte"
import Picker from "./Picker.svelte"
import MainScreen from "./MainScreen.svelte"

key.listen(char => {
	if (char !== `\``) return
	hidden = !hidden
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
const command = ([action, ...details], msg) => {
	switch (action) {
	case `-`:
		Wheel.del({
			[details[0]]: true
		})
		return
	case `+`:
		if (details.length === 1) {
			Wheel.spawn({
				[details[0]]: {}
			})
		}
		if (details.length === 3) {
			github(details)
				.then(name => {
					msg(`Added ${name} from Github. `)
				})
				.catch(ex => {
					msg(`Couldn't add ${details.join(`/`)}. `)
				})
		}
	}
}
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
</script>

<MainScreen {hidden} />

<Picker {nameit} bind:this={picker}>
{#if !hidden}
	<div class="github"> <a href="https://github.com/agoblinking/earthrock" target="_new"> <Github /> </a> </div>
	<div class="explore" style="color: {$THEME_COLOR};" >
		<div class="partial">

		<a
			class="logo"
			style={$THEME_STYLE}
			href="https://www.patreon.com/earthrock"
			target="_new"
			use:nav={{
				id: `/`,
				up: top_space,
				down: `sys`,
				page_up: ws[ws.length - 1].name.get(),
				page_down: `sys`,
				insert: () => {
					// pop up picker with a blank
					nameit = {}
					cursor.set(picker)
				}
			}}
		>[ I S E K A I ]</a>


		<div class="events">
			<Omni {command} />
		</div>

		<div class="weaves">
			{#each ws as weave, i (weave.id.get())}
				<Weave {weave} navi={{
					up: ws[i - 1] ? ws[i - 1].name.get() : `/`,
					down: ws[i + 1] ? ws[i + 1].name.get() : `/`
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
	box-shadow:
		inset 0 2rem 0 rgba(224, 168, 83,0.5),
		inset 0 -2rem 0 rgba(224, 168, 83,0.5),
		inset 1.60rem 0 0 rgba(224, 168, 83,1),
		inset -1.60rem 0 0 rgba(224, 168, 83,1) !important;
}
:global(.nav.beat) {
	box-shadow:
		inset 0 5rem 0 rgba(224, 168, 83,0.25),
		inset 0 -5rem 0 rgba(224, 168, 83,0.25),
		inset 1.00rem 0 0 rgba(224, 168, 83,0.5),
		inset -1.00rem 0 0 rgba(224, 168, 83,0.5);
}

.logo {
	color: white;
	padding: 0.5rem;
	text-align: center;
	color: rgb(224, 168, 83);
	transition: all 250ms cubic-bezier(0.165, 0.84, 0.44, 1);
}

.logo:hover {
	color: rgba(60, 255, 0, 0.8);
}

.partial {
	width: 25rem;
	display: flex;
	flex-direction: column;
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
	transition: all 50ms linear;
}

.weaves {
	display: flex;
	pointer-events: all;
	flex-direction: column;
}
.events {
	pointer-events: all;
	display: flex;
}

.github {
	position: fixed;
	z-index: 100;
	top: 0;
	right: 0;
}
</style>
