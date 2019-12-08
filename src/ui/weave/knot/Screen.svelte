<script>
import border from "/ui/action/border.js"
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

  <img use:mirror={value.get()} use:border class="view" alt="mirror"/>

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
  border-top: none !important;
  border-bottom: none !important;
}

.main {
  display: flex;
}

.port {
  display: flex;
  align-items: center;
} 
</style>