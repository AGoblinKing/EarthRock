import App from '/element/app/App.svelte'

const app = new App({
  target: document.body,
  props: {
    name: `stage`
  }
})

export default app
