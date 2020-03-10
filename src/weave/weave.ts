import cuid from "cuid"

import { Store, Read, Cancel, Tree, Living, NAME} from "src/store"
import { Space, Warp, IWarp, EWarp } from "src/warp"

export interface Wefts {
    [key: string]: NAME;
}

export interface IWeave {
    name?: string;
    wefts: Wefts;
    value: IWarpTree;
    rezed: Array<NAME>;
}

export interface IWarpTree {
    [key: string]: IWarp<any>;
}

export interface Warps {
    [key: string]: Warp<any>;
}

export class Weave extends Living<Warp<any>> {
    readonly name: Store<string>
    readonly wefts: Tree<NAME>
    readonly value: Tree<Warp<any>>

    // caches
    readonly wefts_reverse: Read<Wefts>
    readonly spaces: Tree<Warp<any>>

    // clean up
    protected readonly cancels: Set<Cancel>

    create_warp($warp: IWarp<any>) {
        switch($warp.type) {
            case undefined:
                $warp.type = EWarp.SPACE
            case EWarp.SPACE:
                 return new Space($warp, this)
            case EWarp.MAIL:
            case EWarp.VALUE:
            case EWarp.MATH:
        }

        throw new Error(`warp/unknown ${$warp}`)
    }

    constructor(data: IWeave) {
        super()

        this.name = new Store(data.name)
        this.wefts = new Tree(data.wefts)
        this.value = new Tree({})
        this.rezed = new Store(new Set(data.rezed))
        this.spaces = new Tree({})

        this.cancels = new Set()

        this.wefts_reverse = new Tree({}, set => {
            this.cancels.add(this.wefts.listen(($wefts) => {
                const w_r = {}
                for(let key of Object.keys($wefts)) {
                    w_r[$wefts[key]] = key   
                }

                set(w_r)
            }))
        })

        this.add(data.value)
    }

    add(warp_data: IWarpTree, silent = false) : Warps {
        if(!warp_data) return
        const warps: Warps = {}

        for(let name of Object.keys(warp_data)) {
            const warp = warp_data[name]  
            warp.name = warp.name === "cuid" ? cuid() : name

            warps[name] = this.create_warp(warp)
        }

        super.add(warps, silent)

        return warps
    }

    removes(...names: NAME[]) {
        const $warps = this.value.get()
        const $wefts = this.wefts.get()
        const $wefts_r = this.wefts_reverse.get()
        const $rezed = this.rezed.get()

        for(let name of names) {
            const warp = $warps[name]
            if(warp) warp.destroy()

            delete $warps[name]
            delete $wefts[name]
            $rezed.delete(name)

            const r = $wefts_r[name]
            if(r) {
                delete $wefts[r]
            }
        }

        this.value.set($warps)
        this.wefts.set($wefts)
        this.rezed.set($rezed)
    }

    remove (name: string) {
        this.removes(name)
    }

    destroy() {
        super.destroy()

        for(let cancel of Array.from(this.cancels)) {
            cancel()
        }

        this.cancels.clear()
    }

    toJSON() {
        return {
            name: this.name.get(),
            wefts: this.wefts.get(),

            value: this.value.toJSON(),
            rezed: this.rezed.toJSON()
        }
    }
}
