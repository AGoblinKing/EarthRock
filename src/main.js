import "/weave/init.js"
import system from "/weave/system.js"
import App from '/ui/app/app.svelte'

const ws = Wheel.weaves.get()
ws[Wheel.SYSTEM] = system

const app = new App({
	target: document.body,
	props: {
		name: `stage`
	}
})

export default app
