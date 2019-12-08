<script>
import border from "/ui/action/border.js"
import Port from "/ui/weave/Port.svelte"
import color from "/ui/action/color.js"

export let knot

$: math = knot.math
$: value = knot.value
$: id = knot.id
</script>

<div class="mail">
  <div 
    class="center" 
  >
    <div class="port">
      <Port writable address={`${$id}|write`} />
    </div>
    <div class="address">
      <textarea 
        use:color={JSON.stringify($value)}
        class="text" 
        type="text" 
        use:border
        bind:value={$math} 
        placeholder="2 + 2 = ChAiR"
      />
      {$value}
    </div>
    <div class="port" >
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
}

.center {
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
  flex: 1;
  padding-bottom: 0.25rem;
}

.text {
  padding: 1rem;
  margin-bottom: 0.25rem;
  width: 12rem;
  margin-top: 1rem;
  font-size: 0.75rem;
  vertical-align: middle;
  display: table-cell;
  height: 10rem;
}

</style>