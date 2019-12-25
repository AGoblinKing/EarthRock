import exif from "piexifjs"
import fs from "file-saver"
import { tile } from "/util/text.js"
import Tile from "/image/tile.js"
import { write } from "/util/store.js"

export const load = (img) => {
	try {
		const r = exif.load(img)
		return JSON.parse(r[`0th`][exif.ImageIFD.Make])
	} catch (ex) {
		return false
	}
}

const saved = write(false)
export const save = async (weave) => {
	const obj = {
		"0th": {
			[exif.ImageIFD.Make]: JSON.stringify(weave),
			[exif.ImageIFD.Software]: `isekai`
		},
		Exif: {},
		GPS: {}
	}

	fs.saveAs(exif.insert(exif.dump(obj), await image(weave.name.get())), `${weave.name.get()}.jpg`)
	saved.set(weave.name)
}

const img_load = (data) => new Promise(async (resolve) => {
	const image = new Image()
	image.src = await Tile(data)
	image.onload = () => resolve(image)
})

const garden = img_load({
	width: 4,
	height: 4,
	data: [
		`18 19 19 20`,
		`50 0 0 52`,
		`50 0 0 52`,
		`82 83 83 84`
	].join(` `)
})

export const image = async (name) => {
	const tn = tile(`/${name}`)

	const img_tile = img_load({
		width: 1,
		height: 1,
		data: tn
	})

	const canvas = document.createElement(`canvas`)
	canvas.width = 64
	canvas.height = 64

	const ctx = canvas.getContext(`2d`)
	ctx.imageSmoothingEnabled = false
	ctx.filter = `sepia(1) hue-rotate(90deg)`

	ctx.drawImage(await garden, 0, 0, 64, 64, 0, 0, 64, 64)
	ctx.drawImage(await img_tile, 0, 0, 16, 16, 16, 16, 32, 32)

	return canvas.toDataURL(`image/jpeg`, 0.95)
}

export const github = async ($path, autorun = false) => {
	const url = `https://raw.githubusercontent.com/${$path[0]}/${$path[1]}/master/${$path[2]}.jpg`

	const reader = new FileReader()
	const blob = await fetch(url)
		.then((r) => r.blob())

	reader.readAsDataURL(blob)

	return new Promise((resolve, reject) => {
		reader.addEventListener(`load`, () => {
			const data = load(reader.result)
			if (!data) return reject(new Error(404))

			Wheel.spawn({
				[data.name]: data
			})

			const w = Wheel.get(data.name)

			w.update({
				"!info": {
					knot: `stitch`,
					value: {
						from: $path.join(`/`),
						url: `https://github.com/${$path[0]}/${$path[1]}/blob/master/${$path[2]}.jpg`
					}
				}
			})

			if (autorun) {
				Wheel.start(data.name)
			}

			resolve(data.name)
		})
	})
}
