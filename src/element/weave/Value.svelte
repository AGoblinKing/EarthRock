<script>
import Port from "./Port.svelte"
import color from "../action/color.js"

export let node

$: write = $node.write
$: read = $node.read
$: error = $read === undefined
</script>

<div class="container">
  <div class="ports">
    <Port writable address={`${$node.id}|write`}/>
  </div>
  <div class="name">
    <input type="text" class="edit" bind:value={$node.name} placeholder="Name!"/>
  </div>
  <div class="middle">
      <input type="text" class="edit" bind:value={$write} placeholder="JSON plz"/>
      <div class="value">
          <div use:color={`${$read}`} class:error class="pad">{JSON.stringify($read)}</div>
      </div>
  </div>
  <div class="ports">
      <Port address={`${$node.id}|read`}/>
  </div>
</div>
<style>
.pad {
  padding: 0.5rem;
  border-top: solid 0.25rem #111;
  margin: 0;
}

.container {
  display: flex;
}

.edit {
  margin: 0;
  padding: 0.5rem;
  flex: 1;
  text-align: center
}

.edit:hover {
  background-color: green;
  
}

.middle {
  display: flex;
  flex-direction: column;
}

.sep {
  font-size: 0.5;
}

.value div {
  color: white;
  text-align: center;

}

.ports {
  padding: 0 1rem;
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  align-items:center;
  background-color: #333;
  border-right: solid 0.25rem #111;
  border-left: solid 0.25rem #111;
}


.error {
  background-color: red !important;
}

</style>