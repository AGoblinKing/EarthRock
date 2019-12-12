<script>
import Picker from "./Picker.svelte"
import MainScreen from "./MainScreen.svelte"
import Weave from "./explore/Weave.svelte"
import { down } from "/sys/key.js"

down.listen((key) => {
  if (key !== `\``) return
  hidden = !hidden
})

$: weaves = Wheel.weaves
$: ws = Object.values($weaves)
let filter = ``

$: parts = filter[0] === `-` || filter[0] === `+`
  ? [``, ``]
  : filter.split(`/`)

export let hidden = false

const do_add = () => {
  switch (filter[0]) {
    case `-`:
      Wheel.del({
        [filter.slice(1)]: true
      })
      filter = ``
      return
    case `+`:
      Wheel.spawn({
        [filter.slice(1)]: {

        }
      })
      filter = ``
  }
}
</script>

<MainScreen />
<Picker />

<div 
  class="explore"
  class:hidden
>
  <input 
    type="text" 
    class="filter" 
    placeholder="!/~/+/-"
    bind:value={filter}
    on:keydown={({ which }) => which === 13 && do_add()}
  />

  <div class="weaves">
  {#each ws as weave}
    {#if 
      filter === `` ||
      weave.name.get().indexOf(parts[0]) !== -1
    }
      <Weave {weave} filter={parts.slice(1)} />
    {/if}
  {/each}
  </div>
</div>

<style>


.explore {
  pointer-events: none;
  color: rgb(224, 168, 83);
  font-size: 1rem;
  position: absolute;
  right: 0;
  top: 0;
  width: 20%;
  height: 100%;
  border-right: 0.25rem solid black;
  display: flex;
  flex-direction: column;
  z-index: 1001;
  opacity: 1;
  transition: all 50ms linear;
}

.hidden {
  right: -20%;
  opacity: 0;
  pointer-events: none;
}

.filter {
  pointer-events: all;
  background-color: #111;
  border: 0.25rem solid #333;
  padding: 1rem;
}

.weaves {
  display: flex;
  pointer-events: all;
  flex-direction: column;
}
</style>