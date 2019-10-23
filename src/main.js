import App from './element/App.svelte';

const app = new App({
	target: document.body,
	props: {
		name: 'stage'
	}
});

export default app;