<script>
const audio = new Audio(`/music/earthrock-final-theme.mp3`)
audio.loop = true
audio.volume = 0.5

let audo_playing = false

const toggle = () => {
  if (audo_playing) {
    audio.pause()
  } else {
    audio.play()
  }

  audo_playing = !audo_playing
}
</script>

<div class="tools">
    <div on:click={toggle}>
        {audo_playing ? `>` : `!>`}
    </div>
</div>

<style>
.tools {
    display: flex;
    position: absolute; 
    left: 0;
    z-index: 1100;
    filter: drop-shadow(0.25rem 0.25rem 0.25rem black);
}

.tools > * {
    display: flex;
    justify-content: center;
    align-content: center;
    cursor: pointer;
    font-size: 5rem;
    margin: 2rem;
    line-height: 5rem;
    text-align: center;
}
.tools > *:hover {
    color: rgb(245, 222, 13);
}
.tools > *:active {
    color: rgb(255, 255, 255);
}
</style>