<script>
import Tile from "/ui/image/Tile.svelte"
import Port from "/ui/weave/Port.svelte"
import color from "/ui/action/color.js"

export let knot

$: math = knot.math
$: value = knot.value
$: id = knot.id
</script>

<div class="mail" use:color={$value}>
  <div class="center" >
    <div class="port left">
      <Port writable address={`${$id}|write`} />
    </div>
    <div class="address">
      <input type="text" bind:value={$math} placeholder="2 + 2 = ChAiR"/>
      {$value}
    </div>
    <div class="port right">
      <Port address={`${$id}|read`} />
  </div>
  </div>
</div>

<style>

.mail {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 15rem;
  height: 10rem;
  transition: all 250ms linear;
}

.center {
  background-color: #333;
  border-radius: 1rem;
  border: 0.5rem solid black;
  display: flex;
  justify-content: center;
  align-items: center;
}
.port {
  display: flex;
  margin: 0.25rem;
  border-radius: 0.25rem;
  background-color: #333;
}

.address {
  text-transform: uppercase;
  flex: 1;
  display: flex;
  flex-direction: column;
  text-align: center;
  font-size: 1rem;
  color: white;
  flex: 1;
  padding-bottom: 0.25rem;
}

.address input {
  border-bottom: 0.25rem dashed #222;
  margin-bottom: 0.25rem;
  font-size: 1rem;
  background-color: #333;
  text-align: center;
  flex: 1;
}
.left {
  border-right: 0.25rem dashed #222;
}
.right {
  border-left: 0.25rem dashed #222;
}

</style>