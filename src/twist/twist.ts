import { IStore, Store, Tree, ProxyTree } from "src/store"
import { Weave } from "src/weave/weave"

export enum ETwist {
    VISIBLE = "VISIBLE",
    PHYSICAL = "PHYSICAL",
    DATA = "DATA"
}

export interface TwistMap {
    [key: string]: object
}

export abstract class Twist extends ProxyTree<IStore<any>> {
    protected value: Tree<IStore<any>>
    protected weave: Weave

    static map_to_stores (twist_data: object) {
        const stores = {}

        for(let key of Object.keys(twist_data)) {
            stores[key] = new Store(twist_data[key])
        }

        return stores
    }

    constructor (weave: Weave, twist_data: object) {
        super()

        this.weave = weave
        this.value = new Tree(Twist.map_to_stores(twist_data))
    }
}
