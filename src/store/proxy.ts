import { IStore, Listener } from "./store"
import { ITree, TreeValue } from "./tree"

export abstract class Proxy<T> implements IStore<T> {
    protected value: IStore<T>

    get() { return this.value.get() }
    listen(listen: Listener<T>) { return this.value.listen(listen) }
    set(value: T, silent = false) { this.value.set(value, silent) }
    toJSON() { return this.value.toJSON() }
}

export abstract class ProxyTree<T> extends Proxy<TreeValue<T>> implements ITree<T> {
    protected value: ITree<T>
    
    get_name (name: string) {
        return this.value.get_name(name)
    }

    reset (target?: TreeValue<T>, silent?: boolean)  {
        return this.value.reset(target, silent)
    }

    write (tree_write: object, silent?: boolean) {
        return this.value.write(tree_write, silent)
    }
}