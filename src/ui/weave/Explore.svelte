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

$: parts = filter[0] === `-` || filter[0] === `+`
  ? [``, ``]
  : filter.split(`/`)

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

<div class="explore">
  <input 
    type="text" 
    class="filter" 
    placeholder="Filter and +/-name"
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
  overflow: auto;
}
.filter, .adder {
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