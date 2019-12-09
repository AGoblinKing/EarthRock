<script>
import exif from "piexifjs"

import fs from "file-saver"
import { tile } from "/util/text.js"
import Tile from "/image/tile.js"
import { down } from "/sys/key.js"

export let weave

$: name = weave.name
$: running = Wheel.running

$: runs = $running[weave.name.get()]

const toggle = () => {
  if (runs) {
    Wheel.stop($name)
  } else {
    Wheel.start($name)
  }

  runs = !runs
}

$: {
  if ($down === ` `) toggle()
}
const save = async () => {
  const obj = {
    "0th": {
      [exif.ImageIFD.Make]: JSON.stringify(weave),
      [exif.ImageIFD.Software]: `isekai`
    },
    Exif: {},
    GPS: {}
  }

  const tn = tile(`/${$name}`)
  const t = await Tile({
    width: 4,
    height: 4,
    data: [
      `18 19 19 20`,
      `50 ${tn} 0 52`,
      `50 0 ${tn} 52`,
      `82 83 83 84`
    ].join(` `)
  })

  const image = new Image()
  image.src = t

  image.onload = () => {
    const canvas = document.createElement(`canvas`)
    canvas.width = 64
    canvas.height = 64

    const ctx = canvas.getContext(`2d`)
    ctx.imageSmoothingEnabled = false
    ctx.imageSmoothingQuality = 1
    ctx.filter = `sepia(1) hue-rotate(90deg)`
    ctx.drawImage(image, 0, 0, 64, 64, 0, 0, 64, 64)
    ctx.lineWidth = 4
    ctx.lineCap = `round`
    // ctx.rect(0, 0, 64, 64)
    // ctx.rect(4, 4, 56, 56)
    ctx.stroke()
    fs.saveAs(exif.insert(exif.dump(obj), canvas.toDataURL(`image/jpeg`, 0.95)), `${$name}.seed.jpg`)
  }
}
</script>

<div class="bar"></div>


<div class="controls">
  <div 
    class="save"
    on:click={save}
  >
    \/
  </div>
  {#if $name !== Wheel.SYSTEM}
  <div class="play" class:runs on:click={toggle}>
    {#if runs}
      ||
    {:else}
      |>
    {/if}
  </div>
  {/if}
</div>

<style>
.controls {
  z-index: 7;
  position: absolute;
  display: flex;
  align-items: center;

  bottom: 0;
  pointer-events: none;
  width: 100%;
}
.bar {
  position: absolute;
  bottom: 0;
  height: 3rem;
  width: 100%;
  border-top: 0.25rem solid rgb(3, 17, 3);
  background-color: rgb(6, 48, 4);
  pointer-events: none;
}

.play, .save {
  margin: 0 1rem;
  font-size: 2rem;
  color: white;
  pointer-events: all;
  background-color: #222;
  transition: all 100ms linear;
  border: 0.25rem solid black;
  padding: 1rem;
}

.save:hover, .play:hover {
  background-color: #228;
  font-size: 3rem;
}
.controls > div:active {
  background-color: red;
}
.runs {
  color: #282;
  border: 0.25rem solid  black;
  background-color: #111;
}

</style>
