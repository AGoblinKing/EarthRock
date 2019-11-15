<script>
import { animation } from "/channel/flag.js"
import color from '/ui/action/color.js'
import Port from "/ui/weave/Port.svelte"
import { fly } from 'svelte/transition'

export let knot

$: value = knot.value
$: error = $value === undefined
$: id = knot.id
</script>

<div class="box">
  <Port writable address={`${$id}|write`} />
  <div class="JSON" class:error use:color={`${$error}`}>
    <div class="value_add">
      <div class="flex">{$value}</div>
      {#if $value === null} 
        <div class="doit" in:fly={animation}>\/\/</div>
        <div class="doit" in:fly={animation}>
JSON IT!
        </div>
      {/if}
  
    </div>
  </div>
  <Port address={`${$id}|read`} />
</div>



<style>
.flex { 
  flex: 1;
}

.JSON {
  display: flex;
  padding: 2rem;
  color: white;
  margin: 0;
  height: 10rem;
  text-align:center;
  border: 0.25rem dashed #222;
  border-top: none;
  justify-content: center;
  border-bottom: none;
  flex: 1;
}  

.box {
  display: flex;
  align-items: center;
  justify-content: center;
}

.value_add {
  display: flex;
  flex-direction: column;
}

.doit {
  text-align: center;
  font-size: 2rem;
}
</style>