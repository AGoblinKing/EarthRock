import test from 'ava'
import { Weave } from 'src/weave'
import { Visible } from './visible'

import { Buffer } from '../store'
import { Space } from '../warp'

test('twist/visible', (t) => {
	Visible.data = new Buffer(Visible.defaults, 3)
	const weave = new Weave({
		name: 'test',
		thread: {},
		rezed: [],
		value: {
			test: {
				VISIBLE: {
					sprite: [2],
				},
			},
		},
	})

	t.snapshot(weave.toJSON())
	t.snapshot(Visible.data.toJSON())
})

test('twist/data', (t) => {
	const weave = new Weave({
		name: 'test',
		thread: {},
		rezed: [],
		value: {
			test: {
				DATA: {
					arbitrary: 'hello',
				},
			},
		},
	})

	t.snapshot(weave.toJSON())

	const space = weave.value.query('test') as Space
	const data = space.query('DATA')

	t.snapshot(data.toJSON())

	data.add({
		foo: '5',
	})

	t.snapshot(data.toJSON())
})

test('twist/physical', (t) => {
	const weave = new Weave({
		name: 'test',
		thread: {},
		rezed: [],
		value: {
			test: {
				PHYSICAL: {
					position: [0, 0, 0],
				},
			},
		},
	})

	t.snapshot(weave.toJSON(), `should have defaults`)
})
