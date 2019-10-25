<script>
import Spatial from "./Spatial.svelte"

// Is spatially placed
export let position = [0, 0]
export let anchor = [50, 50]
export let rotate = 0
export let area = [5, 5]

export let vertex_fn = (item, i) => ([i % 3 * 10, Math.floor(i/3) * 10])
export let items = []

</script>

<Spatial {anchor} {position} {rotate} {area}>
{#each items as item, i (item)}
    <Spatial {...item} position={vertex_fn(item, i)}>
        <slot {item} {i} />
    </Spatial>
{/each}
</Spatial>

<style>

</style>