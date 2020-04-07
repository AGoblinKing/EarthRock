import test from 'ava'

import { Tree, EGrok } from './tree'
import { Store } from './store'

test('store/tree', t => {
	const tree = new Tree({
		foo: 1,
		bar: '2',
		store: new Store(5),
		stores: new Store(new Store('string'))
	})

	t.snapshot(tree.get())

	t.snapshot(tree.count())
})

test('store/tree/names', t => {
	const tree = new Tree({
		foo: 1,
		bar: '2',
		store: new Store(5),
		stores: new Store(new Store('string'))
	})

	tree.add({ foo: 2 })
	t.snapshot(tree.get())
	t.snapshot(tree.query('foo'))

	tree.add({
		foo: 5,
		store: 1,
		new_thing: 'new'
	})

	t.snapshot(tree.get())
	t.snapshot(tree.toJSON())

	tree.remove('store')

	t.snapshot(tree.get())
})

test('store/tree/query', t => {
	const tree = new Tree({
		foo: 1,
		nest: new Tree({
			deeper: new Tree({
				final: 3
			}),
			mid: 2
		})
	})

	t.snapshot(tree.query('foo'))
	t.snapshot(tree.query('nest'))
	t.snapshot(tree.query('nest', 'mid'))
	t.snapshot(tree.query('nest', 'deeper'))
	t.snapshot(tree.query('nest', 'deeper', 'final'))
})

test('store/tree/grok', t => {
	const tree = new Tree({
		trend: 1,
		den: new Store('fen'),
		hello: new Tree({
			men: 2,
			there: new Tree({
				friend: new Store(0),
				tem: 1
			})
		})
	})

	const tree_2 = new Tree({})

	const cancel_2 = tree.grok(tree_2.groker.bind(tree_2))

	t.snapshot(tree.toJSON(), 'tree 1')

	const cancel = tree.grok((action, key, value) => {
		t.snapshot({ action, key, value }, 'groks')
	})

	tree.remove('trend')

	t.snapshot(tree_2.toJSON(), 'tree2 no hello')
	t.snapshot(tree.toJSON(), 'tree 1 no hello')
	cancel()

	t.snapshot(tree_2.toJSON(), 'tree 2')

	t.deepEqual(tree.toJSON(), tree_2.toJSON())

	tree.query('hello', 'there').add({
		again: new Store(5)
	})

	tree.query('hello', 'there', 'again').set(10)

	t.snapshot(tree_2.toJSON(), 'tree 2 with again')
	t.deepEqual(tree.toJSON(), tree_2.toJSON())

	cancel_2()
})
