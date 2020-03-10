export const json = (value: any) => {
	if (typeof value !== `string`) return value

	if (value.indexOf(`.`) === -1 && value.indexOf(`,`) === -1) {
		const n = parseInt(value)
		if (typeof n === `number` && !isNaN(n)) {
			return n
		}
	}

	try {
		return JSON.parse(value)
	} catch (ex) {
		return value
	}
}
