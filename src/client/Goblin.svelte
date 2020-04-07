<script>
import Weave from "./Weave.svelte"
import is from "src/client/is"
import { onDestroy } from "svelte"

export let name = ""
const goblin = is.query(name)

// TODO: lifecycle
const cancel = goblin.remote_grok()
const { groked } = goblin

onDestroy(cancel)
</script>

<div class="wheel">
    <div class="title">
        {goblin}
    </div>
    
    {JSON.stringify($groked) }
    
    {#each Object.entries($groked) as [name, weave]}
        <Weave {weave} {goblin} />
    {/each}
</div>

<style>

.title {
   
}

.wheel {
    position: absolute;
    left: 0;
    right: 0;
    text-align: center;
    top: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    color: rgb(224, 168, 83);
}
</style>
