<script>
import Field from "./Field.svelte"
import Character from "./Character.svelte"
import Power from "./Power.svelte"
import Crystals from "./Crystals.svelte"
import Cards from "./Cards.svelte"

export let opponent = false
</script>

<style>
.side {
    border: 1rem inset black;
    height: 50%;
}
</style>

<div class="side">
    <Field></Field>
    <Character></Character>
    <Power></Power>
    <Crystals></Crystals>
    <Cards></Cards>
</div>
