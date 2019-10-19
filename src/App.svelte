<script>
import Intro from "./Intro.svelte"
import Hand from "./Hand.svelte"

const cards = [{id: 1}, {id:2}, {id:3}, {id:4}, {id:5}]
</script>

<Intro></Intro>

<Hand {cards} scale={0.25} position={[0, 40]} />
<Hand {cards} scale={0.25} position={[0, -40]} invert />
