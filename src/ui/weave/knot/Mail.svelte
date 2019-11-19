<script>
import Tile from "/ui/image/Tile.svelte"
import Port from "/ui/weave/Port.svelte"
import color from "/ui/action/color.js"

export let knot

$: whom = knot.whom
$: id = knot.id

</script>

<div class="mail" use:color={$whom || "/???/"}>
  <div class="postage">
    <Tile width={1} height={1} random />
  </div>
  <div class="center"  >
    <div class="port left">
      <Port writable address={`${$id}|write`} />
    </div>
    <div class="address">
      <input type="text" bind:value={$whom} placeholder="AdDrEsS hErE"/>
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
.postage {
  margin-bottom: 1rem;
  align-self: flex-end;
  width: 2rem;
  height: 2rem;
  margin-top: -1.5rem;
  margin-right: -0.20rem;
  display: flex;
  background-color: #111;
  border-radius: 0.25rem;
  filter: sepia(1) hue-rotate(90deg) drop-shadow(-0.25rem 0.25rem 0 black);
  padding: 0.25rem;
  border: 0.25rem dashed #333;
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

}
.address input {
  font-size: 1rem;
  background-color: #333;
  flex: 1;
}
.left {
  border-right: 0.25rem dashed #222;
}
.right {
  border-left: 0.25rem dashed #222;
}

</style>