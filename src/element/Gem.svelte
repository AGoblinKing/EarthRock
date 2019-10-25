<script>
import Tiles from "./Tiles.svelte"
</script>

<div class="gem">
    <Tiles data="11" />
</div>

<style>
.gem {
    filter: sepia(0.5) hue-rotate(90deg);
}
</style>