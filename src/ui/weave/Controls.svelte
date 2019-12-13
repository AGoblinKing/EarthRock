<script>
import exif from "piexifjs"

import Postage from "/ui/weave/Postage.svelte"
import { THEME_BG, THEME_BORDER } from "/sys/flag.js"

import fs from "file-saver"
import { tile } from "/util/text.js"
import Tile from "/image/tile.js"

export let weave

$: name = weave.name
$: running = Wheel.running

$: runs = $running[weave.name.get()]

const toggle = (e) => {
  e.stopPropagation()
  e.preventDefault()

  if (runs) {
    Wheel.stop($name)
  } else {
    Wheel.start($name)
  }

  runs = !runs
}

const seed_image = async () => {
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

  return new Promise((resolve) => {
    const image = new Image()
    image.src = t

    image.onload = () => {
      const canvas = document.createElement(`canvas`)
      canvas.width = 64
      canvas.height = 64

      const ctx = canvas.getContext(`2d`)
      ctx.imageSmoothingEnabled = false
      ctx.filter = `sepia(1) hue-rotate(90deg)`
      ctx.drawImage(image, 0, 0, 64, 64, 0, 0, 64, 64)
      ctx.lineWidth = 4
      ctx.lineCap = `round`
      // ctx.rect(0, 0, 64, 64)
      // ctx.rect(4, 4, 56, 56)
      ctx.stroke()
      resolve(canvas.toDataURL(`image/jpeg`, 0.95))
    }
  })
}
const save = async (e) => {
  e.preventDefault()
  e.stopPropagation()

  const obj = {
    "0th": {
      [exif.ImageIFD.Make]: JSON.stringify(weave),
      [exif.ImageIFD.Software]: `isekai`
    },
    Exif: {},
    GPS: {}
  }

  fs.saveAs(exif.insert(exif.dump(obj), await seed_image()), `${$name}.seed.jpg`)
}

$: style = `border: 0.25rem solid ${$THEME_BORDER}; background-color: ${$THEME_BG};`
</script>

<div 
  class="controls"
>
 <div class="postage" on:click={toggle}>
    <Postage 
      address={`/${$name}`} 
    />
  </div>

  <div 
    class="save"
    on:click={save}
    style="border: 0.5rem solid {$THEME_BORDER};"
  > 
    {#await seed_image($name) then src}
      <img {src} alt="save" />
    {/await}
  </div>

</div>

<style>
.postage {
  width: 3rem;
  height: 3rem;
  display: flex;
}

.controls {
  display: flex;
  align-items: center;
  margin-right: 0.5rem;
}

.save {
  width: 2rem;
  height: 2rem;
  display: flex;
}

.save:hover {
  filter: sepia(1);
}
.save:active {
  filter: sepia(1) hue-rotate(300deg);
}
.save img {
  flex: 1;
  width: 2rem;
  height: 2rem;
}

</style>
