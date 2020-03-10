import { IStore, Listener } from "./store"
import { ITree, TreeValue } from "./tree"

export abstract class Proxy<T> implements IStore<T> {
    protected value: IStore<T>

    get() { return this.value.get() }
    listen(listen: Listener<T>) { return this.value.listen(listen) }
    set(value: T, silent = false) { this.value.set(value, silent) }
    toJSON() { return this.value.toJSON() }
    notify() { this.value.notify() }
}

export abstract class ProxyTree<T> extends Proxy<TreeValue<T>> implements ITree<T> {
    protected value: ITree<T>
    
    item (name: string) {
        return this.value.item(name)
    }

    reset (target?: TreeValue<T>, silent?: boolean)  {
        return this.value.reset(target, silent)
    }

    add (tree_write: object, silent?: boolean) {
        return this.value.add(tree_write, silent)
    }

    remove (name: string, silent?: boolean) {
        this.value.remove(name, silent)
    }

    query (...steps: string[]) : any {
        return this.value.query(...steps)
    }
}