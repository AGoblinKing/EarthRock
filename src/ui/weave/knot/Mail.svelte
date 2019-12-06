<script>
import Postage from "/ui/weave/Postage.svelte"
import Port from "/ui/weave/Port.svelte"
import color from "/ui/action/color.js"

export let knot

$: whom = knot.whom
$: id = knot.id
</script>

<div class="mail" use:color={$whom || `/???/`}>
  <div class="postage">
    <Postage address={$whom.split(`/`).slice(0, 3).join(`/`)} />
  </div>
  <div class="center">
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
.postage {
  position: absolute;
  align-self: flex-end;
  width: 4rem;
  display: flex;
  height: 4rem;
}
.mail {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.center {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
}

.port {
  border: 0.25rem solid black;
  display: flex;
  margin: 0.25rem;
  background-color: #333;
}

.address {
  text-transform: uppercase;
  flex: 1;
  display: flex;
  flex-direction: column;
  text-align: center;
  font-size: 1rem;
  color: rgb(224, 168, 83);

}
.address input {
  font-size: 1rem;
  height: 15rem;
}

</style>