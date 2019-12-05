<script>
import { SVELTE_ANIMATION } from "/sys/flag.js"
import color from '/ui/action/color.js'
import Port from "/ui/weave/Port.svelte"
import { fly } from 'svelte/transition'

export let knot

$: value = knot.value
$: id = knot.id
</script>

<div class="box">
  <Port writable address={`${$id}|write`} />
  <div class="JSON" use:color={$value}>
    <div class="value_add">
      <pre class="flex">{JSON.stringify($value, null, 2)}</pre>
      {#if $value === null} 
        <div class="doit" in:fly={$SVELTE_ANIMATION }>\/\/</div>
        <div class="doit" in:fly={$SVELTE_ANIMATION }>
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
  text-align: left;
}

.JSON {
  display: flex;
  padding: 2rem;
  color: rgb(224, 168, 83);
  margin: 0;
  height: 10rem;
  text-align:center;
  border: 0.25rem solid  #222;
  border-top: none;
  justify-content: center;
  border-bottom: none;
  flex: 1;
  width: 20rem;
  flex-wrap: wrap;
  display: flex;
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