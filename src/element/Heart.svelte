<script>
import Tiles from "./Tiles.svelte"

export let empty = false
export let i = 0

$: is_first = i % 9 !== 0 
$: bright_default = empty ? 0 : 0.9
$: hue = `230deg`
</script>

<div class="heart" class:empty style="{`filter:sepia(1) hue-rotate(${hue}) brightness(${bright_default + Math.sin(i) * 0.168});`}">
    <Tiles data="88" width={1} height={1}/>
</div>

<style>
.heart {
    border-radius: 3rem;
    display: flex;
    width: 3rem;
    height: 3rem;
    overflow:hidden;
    transition: all 1s cubic-bezier(0.075, 0.82, 0.165, 1)
}

.heart.empty {
    opacity: 0;
}

.heart:hover  {
    filter: hue-rotate(0deg) !important;
}
</style>