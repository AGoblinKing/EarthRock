import test from 'ava'
import { Isekai } from 'src/isekai'
import { Store } from '../store'
import { simple } from 'src/wheel/test.data'
import * as time from 'src/sys/time'

test('isekai/', t => {
	const isekai = new Isekai(
		{
			test: {
				there: new Store(1)
			},
			time
		},
		true
	)

	t.snapshot(isekai.toJSON(), 'base snapshot')
	t.snapshot(isekai.sys.query('test', 'there').get(), 'system is available')

	isekai.add({ simple })

	t.snapshot(isekai.toJSON(), 'added simple')

	isekai.add({
		blank: {
			rezed: [],
			value: {}
		}
	})

	t.snapshot(isekai.toJSON(), 'added blank')
})
