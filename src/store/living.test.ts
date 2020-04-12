import test from 'ava'
import { Living } from './living'
import { Tree } from './tree'
import { Store } from './store'

class Test extends Living<Test> {
	constructor(count: number) {
		super()

		const $value = {}
		for (let i = 0; i < count; i++) {
			$value[`${i}`] = new Test(0)
		}

		this.value = new Tree($value)
		this.rezed = new Store(new Set(['1']))
	}

	add(adds: object, silent = false) {
		const new_add = {}
		for (let [key, value] of Object.entries(adds)) {
			new_add[key] = new Test(value)
		}

		return super.add(new_add, false)
	}
}

test('store/living', (t) => {
	const tester = new Test(5)

	t.snapshot(tester)

	tester.create()

	t.snapshot(tester)

	tester.add({
		6: {
			value: 1,
		},
	})

	t.snapshot(tester.toJSON(), 'added 6')

	tester.remove('2')
	t.snapshot(tester)

	tester.start('6')

	t.snapshot(tester)

	tester.query('6').start('0')
	tester.rez()

	t.snapshot(tester)

	tester.derez()
	t.snapshot(tester)

	tester.start('0')
	tester.stop('6')

	tester.rez()

	t.snapshot(tester)

	tester.remove('0')
	t.snapshot(tester)

	tester.destroy()

	t.snapshot(tester)

	tester.create()
	tester.rez()

	t.snapshot(tester)
	t.snapshot(tester.query('6', '0'), 'deep query')
})

test('store/living/grok', (t) => {
	const tester = new Test(6)
	const test_remote = new Test(1)

	t.snapshot(tester.toJSON())

	const cancel = tester.grok((action, key, value) => {
		t.snapshot({ action, key, value }, 'grok')
		test_remote.groker(action, key, value)
	})

	tester.start('3')
	t.snapshot(tester, 'local')
	t.snapshot(test_remote, 'remote')

	t.deepEqual(test_remote.toJSON(), tester.toJSON())
	cancel()
})
