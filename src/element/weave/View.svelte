<script>
import color from '/action/color.js'
import Port from "./Port.svelte"

export let hole

$: value = hole.value
$: error = $value === undefined
</script>

<pre class="JSON" class:error use:color={JSON.stringify($value)}>
{$value}
</pre>
<div class="box">
    <Port writable address={`${hole.id}|write`} />
    <Port address={`${hole.id}|read`} />
  </div>
<style>
.JSON {
  width: 10rem;
  height: 10rem;
  padding: 2rem;
  color: white;
}  


</style>