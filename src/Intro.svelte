<script>
import Popup from "./Popup.svelte"
import Tiles from "./Tiles.svelte"

const clicked = () => {
    alert("Woah there speedy aint got nothing more yet")
}
</script>

<style>
.notice {
    position: absolute;
    bottom: 0;
    border-top: 0.5rem solid black;
    background-color: #333;
    color: white;
    width: 100%;
    padding: 0.5rem;
    text-align: center;
    line-height: 1.5rem;
}


.title {
    text-align: center;
    font-size: 10rem;
}

.background {
    display: flex;
    z-index: 0;
    width: 100%;
    height: 100%;
    position: absolute;
    filter: sepia(1) hue-rotate(-90deg);
    opacity: 0.05
}
.desc {
    text-align: center;
    font-size: 2rem;
}

@media (max-width: 40rem) {
    .title {
        font-size: 4rem;
    }
    .desc {
        font-size: 1rem;
    }
}

button {
    position: absolute;
    border: 0.5rem solid #333;

    border-radius: 1rem;
    background-color: #666;
    color: white;
    text-align: center;
    margin: 0 25%;
    width: 50%;
    top: 61.8%; 
    font-size: 2rem;
    padding: 1rem;
    cursor: pointer;
}

button:hover {
    background-color: #333;
}
</style>

<div class="background">
    <Tiles />
</div>

<h1 class="title">EarthRock</h1>
<h2 class="desc">The Uncollectable Card Game</h2>

<button on:click="{clicked}">START</button>

<div class="notice">We don't use cookies or store anything about you server side.</div>
