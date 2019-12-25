<script>
import { github } from "/sys/file.js"

import Omni from "/ui/explore/Omni.svelte"
import Picker from "./Picker.svelte"
import MainScreen from "./MainScreen.svelte"
import Weave from "/ui/explore/Weave.svelte"
import { THEME_STYLE, THEME_COLOR } from "/sys/flag.js"
import { key } from "/sys/key.js"

let do_hide
key.listen((char) => {
	if (char !== `\``) return
	hidden = !hidden
	do_hide && clearTimeout(do_hide)

	do_hide = setTimeout(() => {
		hide = hidden
		do_hide = false
	})
})

let hide = false

$: weaves = Wheel.weaves
$: ws = Object.values($weaves)
let filter = ``

$: parts = filter[0] === `-` || filter[0] === `+`
	? [``, ``]
	: filter.split(`/`)

export let hidden = false

const command = ([action, ...details], msg) => {
	switch (action) {
	case `-`:
		Wheel.del({
			[details[0]]: true
		})
		filter = ``
		return
	case `+`:
		if (details.length === 1) {
			Wheel.spawn({
				[details[0]]: {}
			})
		}
		if (details.length === 3) {
			github(details).then((name) => {
				msg(`Added ${name} from Github. `)
			}).catch((ex) => {
				msg(`Couldn't add ${details.join(`/`)}. `)
			})
		}
		filter = ``
	}
}
</script>

<MainScreen />
<Picker>

{#if !hide}
<div
  class="explore"
  style="color: {$THEME_COLOR};"
  class:hidden
>
  <div class="partial">
  <div
    class="logo"
    style={$THEME_STYLE}
  >[ I S E K A I ]</div>

  <div class="events">
    <Omni {command} />
  </div>

  <div class="weaves">
  {#each ws as weave (weave.id.get())}
    {#if
      filter === `` ||
      weave.name.get().indexOf(parts[0]) !== -1
    }
      <Weave {weave} filter={parts.slice(1)} open={weave.name.get() !== Wheel.SYSTEM} />
    {/if}
  {/each}
  </div>
  </div>
</div>
{/if}
</Picker>
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

.hidden {
  right: -20%;
  opacity: 0;
  pointer-events: none;
}

.weaves {
  display: flex;
  pointer-events: all;
  flex-direction: column;
}
.events {
  pointer-events:all;
  display:flex;
}
</style>