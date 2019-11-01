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

  padding: 2rem;
  color: white;
  margin: 0;
  height: 10rem;
  border-bottom: 0.25rem dashed #222;
}  
.box {
  display: flex;
  align-items: center;
  justify-content: center;
}


</style>