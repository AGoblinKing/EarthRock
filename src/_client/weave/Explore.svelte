<script>
import { github } from "/sys/file.js"

import Omni from "/_client/explore/Omni.svelte"
import Picker from "./Picker.svelte"
import MainScreen from "./MainScreen.svelte"
import Weave from "/_client/explore/Weave.svelte"
import { THEME_STYLE, THEME_COLOR } from "/sys/flag.js"
import { key } from "/sys/key.js"

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

<style>
.logo {
	display: none;
	padding: 0.5rem;
	text-align: center;
	color: rgba(60, 255, 0, 0.123);
	transition: all 250ms cubic-bezier(0.165, 0.84, 0.44, 1);
}

.logo:hover {
	color: rgba(60, 255, 0, 0.8);
}
.partial {
	width: 20%;
	display: flex;
	flex-direction: column;
}

.explore {
	opacity: 0.95;
	position: absolute;
	align-items: flex-end;
	font-size: 1.5rem;
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
</style>

<MainScreen {hidden} />

<Picker>
{#if !hidden}
	<div class="explore" style="color: {$THEME_COLOR};" >
		<div class="partial">
		<div class="logo" style={$THEME_STYLE}>[ I S E K A I ]</div>

		<div class="events">
			<Omni {command} />
		</div>

		<div class="weaves">
			{#each ws as weave (weave.id.get())}
			<Weave {weave} />
			{/each}
		</div>
		</div>
	</div>
{/if}
</Picker>
