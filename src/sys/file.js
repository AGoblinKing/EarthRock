import exif from "piexifjs"
import fs from "file-saver"
import { tile } from "/util/text.js"
import Tile from "/image/tile.js"

export const load = (img) => {
  try {
    const r = exif.load(img)
    return JSON.parse(r[`0th`][exif.ImageIFD.Make])
  } catch (ex) {
    return false
  }
}

export const save = async (weave) => {
  const obj = {
    "0th": {
      [exif.ImageIFD.Make]: JSON.stringify(weave),
      [exif.ImageIFD.Software]: `isekai`
    },
    Exif: {},
    GPS: {}
  }

  fs.saveAs(exif.insert(exif.dump(obj), await image(weave)), `${weave.name.get()}.seed.jpg`)
}

export const image = async (weave) => {
  const tn = tile(`/${weave.name.get()}`)
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
