import { Read, Setter } from "./read"
import { Store, IStore  } from "./store"

export interface TreeValue<T> {
	[name: string]: T;
}

export interface ITree<T> extends IStore<TreeValue<T>>{
	item (name: string): T
	reset (target?: TreeValue<T>, silent?: boolean)
	write (tree_write: object, silent?: boolean)
	query (...steps: string[]) : any 
	remove (name: string, silent?: boolean)
}

export class Tree<T> extends Read<TreeValue<T>> implements ITree<T> {
	protected value: TreeValue<T>

	constructor(tree: TreeValue<T> = {}, setter?: Setter<TreeValue<T>>) {
		super(tree, setter)
	}

	item (name: string) {
		return super.get()[name]
	}

	reset (target?: TreeValue<T>, silent = false) {
		const $tree = {}
		if(target) {
			Object.assign($tree, target)
		}

		this.p_set($tree, silent)
	}

	write (tree_json: object, silent = false) {
		const $tree = this.get()
		Object.assign($tree, tree_json)

		this.p_set($tree, silent)
	}

	remove (name: string, silent = false) {
		delete this.value[name]
		if(!silent) this.notify()
	}
	
	query (...steps: string[]) : any {
		
		const cursor = this.value[steps.shift()] as any

		if(steps.length === 0 || !cursor) return cursor 	
		return cursor.query(...steps)
    }
}
