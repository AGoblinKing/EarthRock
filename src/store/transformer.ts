import { Store } from "./store"

export class Transformer<T, I> extends Store<T> {
    transformer: (I) => T

    constructor(initial: I, transformer: (I) => T) {
        super(transformer(initial))
        this.transformer = transformer
    }
    
    set (value: any) {
        super.set(this.transformer(value))
    }
}