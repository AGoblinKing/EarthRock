import App from '/ui/app/app.svelte'

const app = new App({
  target: document.body,
  props: {
    name: `stage`
  }
})

export default app
