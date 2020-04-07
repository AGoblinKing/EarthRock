import { Read, Setter } from './read'
import { Store, IStore, ICancel } from './store'

const void_fn = () => {}

export enum EGrok {
	ADD,
	REMOVE,
	UPDATE,
	// living
	START,
	STOP,
	// weave
	THREAD,
	UNTHREAD
}

export type IGrok = (action: EGrok, key: string, value?: any) => void

export type NAME = string

export interface TreeValue<T> {
	[name: string]: T
}

export interface ITree<T> extends IStore<TreeValue<T>> {
	add(tree_write: object, silent?: boolean)
	query(...steps: string[]): any
	has(name: string): boolean
	remove(name: string, silent?: boolean)
	grok(groker: IGrok)
	groker(action: EGrok, key: string, value?: any)
	groke(action: EGrok, path: string, value?: any)
}

export class Tree<T> extends Read<TreeValue<T>> implements ITree<T> {
	protected value: TreeValue<T>
	protected grokers: Set<IGrok>
	protected groke_cancels: { [key: string]: ICancel }

	constructor(tree: TreeValue<T> = {}, setter?: Setter<TreeValue<T>>) {
		super({}, setter)

		this.add(tree)
	}

	groke(action: EGrok, path: string, value?: any) {
		if (!this.grokers) return

		for (let grok of Array.from(this.grokers)) {
			grok(action, path, value)
		}

		switch (action) {
			case EGrok.ADD:
				const val = this.query(...path.split('/'))
				this.groke_cancels[path] = val.grok
					? val.grok((s_action, s_path, s_value) => {
							for (let grok of Array.from(this.grokers)) {
								grok(s_action, `${path}/${s_path}`, s_value)
							}
					  })
					: val.listen
					? val.listen($val => {
							this.groke(EGrok.UPDATE, path, $val)
					  })
					: this.groke(EGrok.UPDATE, path, val)

				break
			case EGrok.REMOVE:
				this.groke_cancels[path]()
				delete this.groke_cancels[path]
				break
		}

		return void_fn
	}

	has(name: string) {
		return this.query(name) !== undefined
	}

	add(tree_json: object, silent = false) {
		const $tree = this.get()

		for (let [key, value] of Object.entries(tree_json)) {
			const is_store = value && value.get !== undefined
			const is_obj =
				(Array.isArray(value) ||
					['string', 'number', 'boolean'].indexOf(typeof value) !==
						-1) === false

			const new_val: Store<any> = ($tree[key] = is_store
				? value
				: is_obj
				? new Tree()
				: new Store(value))

			this.groke(EGrok.ADD, key, {
				value: new_val.toJSON()
			})
		}

		this.p_set($tree, silent)

		return tree_json
	}

	remove(name: string, silent = false) {
		delete this.value[name]
		if (!silent) this.notify()

		this.groke(EGrok.REMOVE, name)
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

		switch (action) {
			case EGrok.ADD:
				item.add({
					[key]: value
				})
				break
			case EGrok.REMOVE:
				item.remove(key)
				break
			case EGrok.UPDATE:
				if (split.length === 1) {
					item.set(value)
				} else {
					item.query(key).set(value)
				}
		}
	}

	grok(groker: IGrok): ICancel {
		if (this.grokers === undefined) {
			this.grokers = new Set([groker])
			this.groke_cancels = {}

			for (let [key, value] of Object.entries(this.get())) {
				const $v = value as any
				this.groke(EGrok.ADD, key, $v.toJSON ? $v.toJSON() : value)
			}
		} else {
			this.grokers.add(groker)
			for (let [key, value] of Object.entries(this.get())) {
				const $v = value as any
				groker(EGrok.ADD, key, value)
			}
		}

		return () => {
			this.grokers.delete(groker)
			if (this.grokers.size !== 0) return

			delete this.grokers
			for (let cancel of Object.values(this.groke_cancels)) {
				cancel()
			}

			delete this.groke_cancels
		}
	}
}
