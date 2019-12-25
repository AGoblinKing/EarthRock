export default (weave) => (
	[command, ...details],
	msg
) => {
	const [detail, detail2] = details
	const names = weave.names.get()
	const knot = names[detail]

	switch (command) {
	case `>`:
		if (!knot) return msg(`Couldn't find ${detail}`)
		if (names[detail2]) return msg(`${detail2} already exists`)
		knot.knot.name.set(detail2)
		return

	case `~`:
		if (!knot) return
		knot.name.set(detail2)

		return

	case `+`:
		if (detail2) {
			return weave.update({
				[detail]: {
					knot: `stitch`,
					value: {
						[detail2]: ``
					}
				}
			})
		}

		weave.update({
			[detail]: {
				knot: `stitch`
			}
		})

		return
	case `-`:
		if (detail2) {
			const s = weave.get_name(detail)
			if (!s) return

			s.value.remove(detail2)
			return
		}

		weave.remove_name(detail)
	}
}
