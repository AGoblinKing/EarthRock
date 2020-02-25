import { write } from "/store.js"

export const cursor = write(false)
const { set } = cursor

cursor.set = (e) => {
	if (e === null) return

	return set.call(cursor, e)
}
