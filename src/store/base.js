import { extend } from "/object.js"

export const proto_store = {
	toJSON () {
		switch (typeof this.value) {
		case `undefined`:
		case `number`:
		case `string`:
			return this.value

		case `object`:
			if (Array.isArray(this.value) ||
				this.value === null
			) {
				return this.value
			}
			if (this.value.toJSON) {
				return this.value.toJSON()
			}
		}

		return JSON.parse(
			JSON.stringify(this.value)
		)
	}
}

export const store = (value) => extend(proto_store, {
	value
})
