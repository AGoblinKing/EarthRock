import { Read, Setter } from "./read"
import { Store, IStore  } from "./store"

export interface TreeValue<T> {
	[name: string]: T;
}

export interface ITree<T> extends IStore<TreeValue<T>>{
	get_name (name: string): T
	reset (target?: TreeValue<T>, silent?: boolean)
	write (tree_write: object, silent?: boolean)
}

export class Tree<T> extends Read<TreeValue<T>> implements ITree<T> {
	protected value: TreeValue<T>

	constructor(tree: TreeValue<T>, setter?: Setter<TreeValue<T>>) {
		super(tree, setter)
	}

	get_name (name: string) {
		return super.get()[name]
	}

	reset (target?: TreeValue<T>, silent = false) {
		const $tree = {}
		if(target) {
			Object.assign($tree, target)
		}

		this.p_set($tree, silent)
	}

	write (tree_write: object, silent = false) {
		const $tree = this.get()
		Object.assign($tree, tree_write)

		this.p_set($tree, silent)
	}
}
