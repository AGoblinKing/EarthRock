export default ({
	value,
	weave,
	space
}) => {
	let name_last
	const update = ($name) => ($ns) => {
		$ns[$name] = space

		if (name_last) {
			delete $ns[name_last]
		}

		name_last = $name

		return $ns
	}

	const cancel = value.listen(($name) =>
		weave.names.update(update($name))
	)

	return {
		destroy: () => {
			cancel()

			weave.names.update(($ns) => {
				delete $ns[name_last]
				return $ns
			})
		}
	}
}
