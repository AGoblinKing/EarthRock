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
import { weaves } from "/sys/wheel.js"
import Weave from "./explore/Weave.svelte"

export let weave

$: ws = Object.values($weaves) 

</script>

<div class="explore">
  <input 
    type="text" 
    class="filter" 
    placeholder
  />

  <div class="weaves">
  {#each ws as weave}
    <Weave {weave} />
  {/each}
  </div>

  <input 
    type="text"
    placeholder={`-${ws[ws.length - 1].name.get()} to delete`}
  />
</div>

<style>
.explore {
  color: white;
  font-size: 1rem;
  position: absolute;
  left: 0;
  top: 0;
  width: 20%;
  height: 100%;
  border-right: 0.25rem solid black;
  background-color: #222;
  display: flex;
  flex-direction: column;
  z-index: 1001;
}

.weaves {
  flex: 1;
  display: flex;
  flex-direction: column;
}
</style>