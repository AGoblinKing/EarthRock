<script>
import Postage from "/ui/weave/Postage.svelte"
import Port from "/ui/weave/Port.svelte"

export let knot

$: whom = knot.whom
$: id = knot.id
</script>

<div class="mail">
  <div class="postage">
    <Postage address={$whom.split(`/`).slice(0, 3).join(`/`)} />
  </div>
  <div class="stamp">
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
.stamp {
  align-self: flex-end;
  position: absolute;
  width: 5rem;
  display: flex;
  height: 5rem;
}
.postage {
  position: absolute;
  width: 15rem;
  display: flex;
  height: 15rem;
  opacity: 0.1;
  pointer-events: none;
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

  display: flex;
  margin: 0.25rem;

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