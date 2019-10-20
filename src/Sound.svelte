<script>
const audio = new Audio("/music/earthrock-final-theme.mp3")
audio.loop = true

let playing = false

const toggle = () => {
    if(playing) {
        audio.pause()
    } else {
        audio.play()
    }

    playing = !playing
}
</script>

<div class="sound" on:click={toggle}>
    {playing ? '🕪' : '🕨'}
</div>

<style>
.sound {
    position: absolute;
    top: 0;
    right: 0;
    z-index: 110;
    cursor: pointer;
    font-size: 5rem;
    width: 10rem;
    text-align: center;
}
.sound:hover {
    color: #222;
}
.sound:active {
    color: #111;
}
</style>