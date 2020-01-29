<script>
import { github } from "/sys/file.js"
import { key } from "/sys/key.js"
import { THEME_STYLE, THEME_COLOR } from "/sys/flag.js"

import nav from "/_client/action/nav.js"
import color from "/_client/action/color.js"
import Omni from "/_client/explore/Omni.svelte"
import Weave from "/_client/explore/Weave.svelte"
import Github from "./Github.svelte"
import Picker from "./Picker.svelte"
import MainScreen from "./MainScreen.svelte"

key.listen(char => {
	if (char !== `\``) return
	hidden = !hidden
})

$: weaves = Wheel.weaves
$: ws = Object.values($weaves)

export let hidden = window.location.hash.indexOf(`dev`) === -1

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
</script>

<MainScreen {hidden} />

<Picker>
{#if !hidden}
	<div class="github"> <a href="https://github.com/agoblinking/earthrock" target="_new"> <Github /> </a> </div>
	<div class="explore" style="color: {$THEME_COLOR};" >
		<div class="partial">
		<div class="logo" style={$THEME_STYLE} use:color={`I S E K A I`} >[ I S E K A I ]</div>

		<div class="events">
			<Omni {command} />
		</div>

		<div class="weaves">
			{#each ws as weave, i (weave.id.get())}
			<Weave {weave} navi={{
				up: ws[i - 1] ? ws[i - 1].name.get() : undefined,
				down: ws[i + 1] ? ws[i + 1].name.get() : undefined
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
		inset -1.60rem 0 0 rgba(224, 168, 83,1);
}
:global(.nav.beat) {
	box-shadow:
		inset 0 5rem 0 rgba(224, 168, 83,0.25),
		inset 0 -5rem 0 rgba(224, 168, 83,0.25),
		inset 1.00rem 0 0 rgba(224, 168, 83,0.5),
		inset -1.00rem 0 0 rgba(224, 168, 83,0.5);
}

.logo {
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
