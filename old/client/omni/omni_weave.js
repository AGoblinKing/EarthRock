import { each } from "/object.js"
import { write } from "/store.js"

export default (weave) => (
	[command, ...details],
	msg
) => {
	const [detail, detail2] = details
	const names = weave.names.get()
	const warp = names[detail]

	switch (command) {
	case `>`:
		if (!warp) return msg(`Couldn't find ${detail}`)
		if (names[detail2]) return msg(`${detail2} already exists`)

		// TODO: rename/move
		return

	case `~`:
		if (!warp) return
		// TODO: Rename
		return

	case `+`:
		if (detail2) {
			return weave.write({
				[detail]: {
					type: `space`,
					value: {
						[detail2]: write(1)
					}
				}
			})
		}

		weave.write({
			[detail]: {
				type: `space`
			}
		})

		return
	case `-`:
		if (detail.indexOf(`*`) !== -1) {
			const reg = detail.replace(`*`, ``)
			const ns = weave.names.get()

			const removes = []

			each(ns)(([name, warp]) => {
				if (name.slice(0, reg.length) === reg) {
					removes.push(warp.id.get())
				}
			})

			weave.remove(...removes)
		}

		if (detail2) {
			const s = weave.get_name(detail)
			if (!s) return

			s.value.remove(detail2)
			return
		}

		weave.remove_name(detail)
	}
}
