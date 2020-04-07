import test from 'ava'
import { Goblin } from './goblin'
import { Tree, Store } from 'src/store'
import * as time from 'src/sys/time'

import { simple } from '../wheel/test.data'

time.TIME_TICK_RATE.set(10)

test('goblin/', async t => {
	const worker = new Goblin(
		new Tree({
			test: new Tree({
				1: new Store(5)
			}),
			time: new Tree(time)
		}),
		true
	)

	worker.create()
	worker.rez()

	t.snapshot(worker.sys.toJSON(), 'sys available')
	t.snapshot(worker.toJSON(), 'local worker')

	worker.add(simple)

	// forces a dump
	t.snapshot(await worker.remote_toJSON(), 'remote worker')

	let count = 0
	const cancel_grok = worker.remote_grok()

	await new Promise(resolve => {
		const cancel = worker.buffer.listen($buffer => {
			t.snapshot($buffer.VISIBLE.toJSON(), 'visible')

			if (count++ < 4) return
			cancel()
			resolve()
		})
	})

	cancel_grok()

	t.snapshot(worker.value.toJSON(), 'local remote json post grok')
})
