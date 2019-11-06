<script>
import Tile from "../image/Tile.svelte"
import Port from "./Port.svelte"

export let hole

$: whom = hole.whom
</script>

<div class="mail">
  <div class="postage">
    <Tile width={1} height={1} random />
  </div>
  <div class="port left">
    <Port writable address={`${hole.id}_write`} />
  </div>
  <div class="address">
    <input type="text" bind:value={$whom} />
  </div>
  <div class="port right">
    <Port address={`${hole.id}_read`} />
  </div>
</div>

<style>
.mail {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 5rem;
  height: 2rem;
}

.port {
  display: flex;
  background-color: #333;
}

.address {
  text-decoration: underline;
  flex: 1;
}

.left {
  border-right: 0.25rem dashed #222;
}

</style>