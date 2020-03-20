import { Read, Setter } from './read'
import { Store, IStore, ICancel } from './store'

export enum EGrok {
	ADD,
	REMOVE,
	UPDATE
}

export type IGrok = (action: EGrok, key: string, value?: any) => void

export type NAME = string

export interface TreeValue<T> {
	[name: string]: T
}

export interface ITree<T> extends IStore<TreeValue<T>> {
	item(name: string): T
	reset(target?: TreeValue<T>, silent?: boolean)
	add(tree_write: object, silent?: boolean)
	query(...steps: string[]): any
	has(name: string): boolean
	remove(name: string, silent?: boolean)
}

export class Tree<T> extends Read<TreeValue<T>> implements ITree<T> {
	protected value: TreeValue<T>

	constructor(tree: TreeValue<T> = {}, setter?: Setter<TreeValue<T>>) {
		super(tree, setter)
	}

	item(name: string) {
		return super.get()[name]
	}

	has(name: string) {
		return this.item(name) !== undefined
	}

	reset(target?: TreeValue<T>, silent = false) {
		const $tree = {}
		if (target) {
			Object.assign($tree, target)
		}

		this.p_set($tree, silent)
	}

	add(tree_json: object, silent = false) {
		const $tree = this.get()

		Object.assign($tree, tree_json)

		this.p_set($tree, silent)

		return tree_json
	}

	remove(name: string, silent = false) {
		delete this.value[name]
		if (!silent) this.notify()
	}

	query(...steps: string[]): any {
		const cursor = this.value[steps.shift()] as any

		if (steps.length === 0 || !cursor) return cursor
		return cursor.query(...steps)
	}

	count() {
		return Object.keys(this.get()).length
	}

	groker(action: EGrok, path: string, value?: any) {
		const split = path.split('/')
		const item: Tree<any> =
			split.length === 1 ? this : this.query(...split.slice(0, -1))

		const key = split[split.length - 1]

		const is_obj =
			Array.isArray(value) ||
			(['string', 'number', 'boolean'].indexOf(typeof value) !== -1) ==
				false

		switch (action) {
			case EGrok.ADD:
				item.add({
					[key]: is_obj ? new Tree() : new Store(value)
				})
				break
			case EGrok.REMOVE:
				item.remove(key)
				break
			case EGrok.UPDATE:
				if (split.length === 1) {
					item.set(value)
				} else {
					item.item(key).set(value)
				}
		}
	}

	grok(groker: IGrok): ICancel {
		const cancels: { [key: string]: ICancel } = {}

		let last = []

		cancels[''] = this.listen($value => {
			// value changed
			for (let key of last) {
				if ($value[key] === undefined) {
					groker(EGrok.REMOVE, key)
					cancels[key] && cancels[key]
				}
			}

			last = Object.keys($value)

			for (let [key, child] of Object.entries($value)) {
				const cx = child as any
				if (cancels[key]) return
				groker(EGrok.ADD, key, cx.toJSON ? cx.toJSON() : cx)

				// tree
				if (cx.grok) {
					cancels[key] = cx.grok((action, k, v) =>
						groker(action, `${key}/${k}`, v)
					)
					continue
				}

				// store (updates)
				if (cx.listen) {
					cancels[key] = cx.listen(v => groker(EGrok.UPDATE, key, v))
					continue
				}
			}
		})

		return () => {
			for (let cancel of Object.values(cancels)) {
				cancel()
			}
		}
	}
}
