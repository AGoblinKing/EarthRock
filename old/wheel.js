import { extend } from "/object.js"

export default extend({
	rez () {
		this.cancel = this.value.listen((wheels) => {
			if (typeof wheels === `string`) wheels = [wheels]
			if (!Array.isArray(wheels)) return wheels
			wheels = new Set(wheels)

			this.wheels = {}

			wheels.forEach((wheel) => {
				if (this.wheels[wheel]) return

				const worker = this.wheels[wheel] = new Worker(`/bin/wheel.bundle.js`)

				worker.postMessage({
					action: `wheel`,
					data: wheel
				})

				// add all display info
				worker.onmessage = ({ data }): void => {
					console.log(data)
				}
			})

			Object.keys(this.wheels).forEach((key) => {

			})
		})
	},

	derez () {
		this.cancel()

		Object.values(this.wheels).forEach((wheel) => {
			wheel.terminate()
		})
	}
})
