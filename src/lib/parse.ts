const is_character = /[a-zA-Z]/

export const json = (value: any) => {
	if (typeof value !== `string`) return value

	if (value.indexOf(`.`) === -1 && value.indexOf(`,`) === -1) {
		const n = parseInt(value)
		if (typeof n === `number` && !isNaN(n)) {
			return n
		}
	}

	// is character
	if(value[0] !== undefined && is_character.test(value[0])) return value

	try {
		return JSON.parse(value) 
	} catch (ex) {
		return value
	}
}
