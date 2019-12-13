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

  <div 
    class="save"
    on:click={save_it}
    style="border: 0.5rem solid {$THEME_BORDER};"
  > 
    {#await image(weave) then src}
      <img {src} alt="save" />
    {/await}
  </div>

</div>

<style>
.postage {
  width: 3rem;
  height: 3rem;
  display: flex;
}

.controls {
  display: flex;
  align-items: center;
  margin-right: 0.5rem;
}

.save {
  width: 2rem;
  height: 2rem;
  display: flex;
}

.save:hover {
  filter: sepia(1);
}
.save:active {
  filter: sepia(1) hue-rotate(300deg);
}
.save img {
  flex: 1;
  width: 2rem;
  height: 2rem;
}

</style>
