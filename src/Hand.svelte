<script>
import Card from "./Card.svelte"

export let cards = []

</script>

{#each cards as card, index (card.id)}
    <Card ...card></Card>
{/each}
