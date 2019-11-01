<script>
import Port from "./Port.svelte"

export let node

$: name = $node.name
</script>

<div class="name">
  <input type="text" class="edit" bind:value={$name} placeholder="Name It!"/>
  <Port address={$name} name/>
</div>

<style>
.name {
 display: flex;
 flex-direction: column;
 align-items: center;
 padding-bottom: 0.5rem;
}

.edit {
  text-align: center;
}

.edit:hover {
  background-color: green;
}
</style>