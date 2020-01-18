import { extend } from "/object.js"

export const visible = {}

export default extend({
	rez () {
		visible[this.space.id.get()] = this.space
	},
	derez () {
		delete visible[this.space.id.get()]
	}
})
