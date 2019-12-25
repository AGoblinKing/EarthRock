<script>
import { save, image } from "/sys/file.js"

import Postage from "/ui/weave/Postage.svelte"
import { THEME_BG, THEME_BORDER } from "/sys/flag.js"

export let weave

$: name = weave.name
$: running = Wheel.running

$: runs = $running[weave.name.get()]

const toggle = (e) => {
	e.stopPropagation()
	e.preventDefault()

	if (runs) {
		Wheel.stop($name)
	} else {
		Wheel.start($name)
	}

	runs = !runs
}
const save_it = (e) => {
	e.preventDefault()
	e.stopPropagation()
	save(weave)
}
$: style = `border: 0.25rem solid ${$THEME_BORDER}; background-color: ${$THEME_BG};`
</script>

<div
  class="controls"
>
 <div class="postage" on:click={toggle}>
    <Postage
      address={`/${$name}`}
    />
  </div>
  {#if $name !== Wheel.SYSTEM}
  <div
    class="save"
    on:click={save_it}
  >
    {#await image(weave.name.get()) then src}
      <img {src} alt="save" />
    {/await}
  </div>
  {/if}

</div>

<style>
.postage {
  width: 2rem;
  height: 2rem;
  display: flex;
}

.controls {
  display: flex;
  align-items: center;
  margin: 0 0.5rem;
}

.postage, .save {
  margin: 0 0.5rem;
}

.save:hover {
  filter: sepia(1);
}
.save:active {
  filter: sepia(1) hue-rotate(300deg);
}
.save img {
  flex: 1;
  margin-top: 0.25rem;
  width: 2rem;
  border: 0.25rem solid rgba(0,0,0,0.5);
  height: 2rem;
}

</style>
