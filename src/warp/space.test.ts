import test from 'ava'

import { Weave, IWeave } from 'src/weave'
import { Store } from 'src/store'
import { Space } from './space'

test('warp/space', (t) => {
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

	const hello = weave.query('hello') as Space

	hello.add({ DATA: { foo: 5 } })
	t.snapshot(hello.toJSON())

	const vis = hello.query('VISIBLE')
	t.snapshot(vis.toJSON())
	vis.add({
		foo: new Store(5),
	})

	t.snapshot(vis.get())
	vis.create()
	t.snapshot(vis.get())

	t.snapshot(weave.spaces.toJSON())
	weave.remove('hello')
	t.snapshot(weave.spaces.toJSON())
})
