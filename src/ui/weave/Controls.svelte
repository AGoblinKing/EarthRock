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

  const t = await Tile({
    width: 2,
    height: 2,
    data: `${tile(`/${$name}`)} `.repeat(4)
  })

  fs.saveAs(exif.insert(exif.dump(obj), t), `${$name}.weave.jpg`)
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
  justify-content: center;
  bottom: 0;
  width: 100%;
}
.bar {
  position: absolute;
  bottom: 0;
  height: 3rem;
  width: 100%;
  border-top: 0.25rem solid black;
  background-color: #333;
}

.play, .save {
  margin: 0 1rem;
  font-size: 2rem;
  color: white;
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
