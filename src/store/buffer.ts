import { IStore, Store} from "./store"
import { Tree, TreeValue } from "./tree"

export interface BufferJSON {
    [key: string]: Array<number>
}

export class BufferValue extends Store<Float32Array> {
    set (value: number[], silent = false) {
        this.get().set(value)
        if(silent === false) this.notify()
    }
}

export class Buffer extends Tree<Float32Array> {
    protected count: number
    protected defaults: BufferJSON
    protected value: TreeValue<Float32Array>
    protected available: Set<number>

    protected create_data (size) {
        const data = {}
        
        for(let key of Object.keys(this.defaults)) {
            data[key] = new Float32Array(this.defaults[key].length * size)

            // copy existing data
            if(this.value && Object.keys(this.value).length > 0) {
                data[key].set(this.value[key])
            }
        }
        
        if(this.available) {
            const additions = Array.from(Array(size - this.count).keys()).map(i => i + this.count)
            this.available = new Set([...Array.from(this.available), ...additions])
        } else {
            this.available = new Set(Array(size).keys())
        }

        this.value = data
        this.count = size
    }

    constructor (defaults: BufferJSON, initial_size = 100) {
        super()

        this.defaults = defaults
        this.create_data(initial_size)
    }
    
    allocates (...data: object[]) : Array<[TreeValue<IStore<Float32Array>>, number]> {
        const results = []
        for(let datum of data) {
            results.push(this.allocate(datum))
        }

        return results
    }

    allocate (datum: object) : [TreeValue<IStore<Float32Array>>, number] {
        const buffer_view = {}
        let cursor = this.available.values().next().value
        if(cursor === undefined) {
            this.resize()
            cursor = this.available.values().next().value
        }

        this.available.delete(cursor)

        for(let key of Object.keys(this.defaults)) {
            const len = this.defaults[key].length
            const idx = cursor * len 
            const view = this.value[key].subarray(idx, idx + len)

            view.set(datum[key] ? datum[key] : this.defaults[key])

            buffer_view[key] = new BufferValue(view)
        }

        return [buffer_view, cursor]
    }

    free (idx: number) {
        this.available.add(idx)

        for(let key of Object.keys(this.defaults)) {    
            const len = this.defaults[key].length
            this.value[key].set(Array(len).fill(0), len * idx)
        }
    }

    resize (size?: number) {
        if(size === undefined) size = this.count * 2
        if(size < this.count) throw new Error("cannot reduce the size of a buffer")

        this.create_data(size)
        this.notify()
    }

    hydrate (data: {[name: string]: number[] | Float32Array}) {
        for(let key of Object.keys(this.value)) {
            this.value[key].set(data[key])
        }

        this.notify()
    }

    toJSON () : BufferJSON {
        const json = {}
        for(let key of Object.keys(this.value)) {
            json[key] = this.value[key]
        }

        return json
    }
}
