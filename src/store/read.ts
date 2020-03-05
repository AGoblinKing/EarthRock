import { Store } from "./store"

export type Setter<T> = (set:(value: T ) => void) => void
export class Read<T> extends Store<T> {
    constructor(value: T, setter?: Setter<T>) {
        super(value)

        if(setter) setter(Store.prototype.set.bind(this))
    }

    protected p_set(value: T, silent = false) {
        super.set(value, silent)
    }

    set(value: T, silent = false) {
        return
    }
}