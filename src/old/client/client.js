import "./init.js"
import system from "./client-system.js"
import App from './app/app.svelte'

const ws = Wheel.weaves.get()
ws[Wheel.SYSTEM] = system

const app = new App({
	target: document.body
})

export default app
