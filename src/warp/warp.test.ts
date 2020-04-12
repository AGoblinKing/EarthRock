import test from 'ava'

import { Weave, IWeave } from 'src/weave'

test('warp/', (t) => {
	const weave = new Weave({
		name: 'test',
		value: {
			hello: {
				VISIBLE: {
					sprite: [5],
				},
			},
		},
		thread: {},
		rezed: [],
	})

	t.snapshot(weave.toJSON())
	weave.destroy()
})
