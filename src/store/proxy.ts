import { IStore, IListen } from './store'
import { ITree, TreeValue, IGrok, EGrok } from './tree'

export abstract class Proxy<T> implements IStore<T> {
	protected value: IStore<T>

	get() {
		return this.value.get()
	}
	listen(listen: IListen<T>) {
		return this.value.listen(listen)
	}
	set(value: T, silent = false) {
		this.value.set(value, silent)
	}
	toJSON() {
		return this.value.toJSON()
	}
	notify() {
		this.value.notify()
	}

	subscribe(listen: IListen<T>) {
		return this.listen(listen)
	}
}

export abstract class ProxyTree<T> extends Proxy<TreeValue<T>>
	implements ITree<T> {
	protected value: ITree<T>

	add(tree_write: object, silent?: boolean) {
		return this.value.add(tree_write, silent)
	}

	remove(name: string, silent?: boolean) {
		this.value.remove(name, silent)
	}

	query(...steps: string[]): any {
		return this.value.query(...steps)
	}

	has(name: string) {
		return this.query(name) !== undefined
	}

	grok(groker: IGrok) {
		return this.value.grok(groker)
	}

	groker(action: EGrok, key: string, value?: any) {
		return this.value.groker(action, key, value)
	}

	groke(action: EGrok, key: string, value?: any) {
		return this.value.groke(action, key, value)
	}
}
