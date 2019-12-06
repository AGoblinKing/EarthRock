<!--
  Explorer of weaves.
  [ Filter ]
  [Weave]
    - [Stitch]
      - [Key]: [Value]
    - [Stitch]
  
  [New]
-->
<script>
import Weave from "./explore/Weave.svelte"

$: weaves = Wheel.weaves
$: ws = Object.values($weaves)
let filter = ``

$: parts = filter.split(`/`)

let adder = ``
const do_add = () => {
  if (adder[0] === `-`) {
    Wheel.del({
      [adder.slice(1)]: true
    })
    adder = ``

    return
  }

  Wheel.spawn({
    [adder]: {

    }
  })

  adder = ``
}
</script>

<div class="explore">
  <input 
    type="text" 
    class="filter" 
    placeholder="Filter eg: sys/"
    bind:value={filter}
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

  <input 
    type="text"
    class="adder"
    bind:value={adder}
    on:keydown={({ which }) => which === 13 && do_add()}
    placeholder={`-${ws[ws.length - 1].name.get()} to delete`}
  />
</div>

<style>
.adder {
  border-top: 0.25rem solid #333;
  padding: 1rem;
}
.explore {
  color: rgb(224, 168, 83);
  font-size: 1rem;
  position: absolute;
  left: 0;
  top: 0;
  width: 20%;
  height: 100%;
  border-right: 0.25rem solid black;
  background-color: #111;
  display: flex;
  flex-direction: column;
  z-index: 1001;
  overflow: auto;
}
.filter {
  border-bottom: 0.25rem solid #333;
  padding: 1rem;
}

.weaves {
  flex: 1;
  display: flex;
  flex-direction: column;
}
</style>