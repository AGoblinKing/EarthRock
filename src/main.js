import App from '/ui/app/app.svelte'
import * as Wheel from "/weave/wheel.js"

window.Wheel = Wheel

const app = new App({
  target: document.body,
  props: {
    name: `stage`
  }
})

export default app
