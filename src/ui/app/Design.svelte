<script>
import Spatial from "../Spatial.svelte"
import { fade } from 'svelte/transition'
// Deck Create/Delete/Edit
// Deck Editing
/*
    - Tilemap editor
    - Deck drag and drop cards?
    - like a grid of cards
    [] [] [] [][] [][][][]
    [][ ][][][][][][][][][][
    - Card Editing
        - Name
        - Abilities
        - Picture
    - Card Back
    - Avatar Editing

*/
</script>


<Spatial 
    bias={[50, 50]} 
    anchor={[50, 50]}
    area={[-1000, 50]}
> 
    <div out:fade={{ duration: 100 }} class="design">
        Still Ruff
    </div>
</Spatial>

<style>
.design {
    flex: 1;
    font-size: 5rem;
    text-align: center;
}

</style>