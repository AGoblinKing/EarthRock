<script>
import Port from "../Port.svelte"
import mirror from "/ui/action/mirror.js"

export let knot

$: id = knot.id

$: vertex = knot.vertex
$: fragment = knot.fragment
$: value = knot.value
</script>

<div class="main">
  <div class="port">
    <Port writable address={`${$id}|write`} />
  </div>

  <img use:mirror={value.get()} class="view" alt="mirror"/>

  <div class="port">
    <Port address={`${$id}|read`} />
  </div>
</div>

<style>
.view {
  flex: 1;
  display: flex;
  width: 200px;
  height: 200px;
  border-left: 0.5rem solid  #333;
  border-right: 0.5rem solid  #333;
}

.main {
  display: flex;
}

.port {
  display: flex;
  align-items: center;
  background-color: #333;
} 
</style>