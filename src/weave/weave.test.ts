import test from 'ava'
import { Weave, IWeave } from './index'
import { EWarp } from 'src/warp'

test('weave/', (t) => {
	const data: IWeave = {
		name: 'test',
		value: {
			foo: {},
			test: {},
		},
		thread: {
			foo: 'test',
		},
		rezed: ['foo'],
	}

	const weave = new Weave(data)

	t.deepEqual(data, weave.serialize(), 'weave should serialize')

	weave.removes('foo', 'test')

	t.snapshot(weave.toJSON())

	weave.add({
		foo: {},
		bar: {},
	})

	t.snapshot(weave.toJSON())

	weave.add({
		foo: {},
	})

	t.snapshot(weave.toJSON())

	weave.destroy()
	t.snapshot(weave.toJSON())
})
