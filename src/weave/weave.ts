import cuid from "cuid"

import { Store, Read, Cancel, Tree, TreeValue, IStore, ProxyTree} from "src/store"
import { NAME, EWarp, IWeaveJSON, WarpJSON, WarpsJSON, Wefts} from "src/weave/types"

import { Space, Warp } from "src/warp"

export interface Warps {
    [key: string]: Warp<any>;
}

export class Weave extends ProxyTree<Warp<any>>{
    readonly name: Store<string>;
    readonly wefts: Tree<NAME>;
    readonly warps: Tree<Warp<any>>;
    readonly rezed: Store<Set<NAME>>;

    // caches
    readonly wefts_reverse: Read<Wefts>;
    readonly spaces: Tree<Warp<any>>;

    // clean up
    protected readonly cancels: Set<Cancel>;

    create_warp($warp: WarpJSON<any>) {
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

    constructor(data: IWeaveJSON) {
        super()

        this.name = new Store(data.name)
        this.wefts = new Tree(data.wefts)
        this.value = this.warps = new Tree({})
        this.rezed = new Store(new Set(data.rezed))
        
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

        this.write(data.warps)
    }

    write(warp_data: WarpsJSON, silent = false) : Warps {
        const warps: Warps = {}

        for(let id of Object.keys(warp_data)) {
            const warp = warp_data[id]  
            warp.name = warp.name === "cuid" ? cuid() : id

            warps[id] = this.create_warp(warp)
        }

        this.warps.set(Object.assign(this.warps.get(), warps), silent)
        return warps
    }

    delete(...ids: NAME[]) {
        const $warps = this.warps.get()
        const $wefts = this.wefts.get()
        const $wefts_r = this.wefts_reverse.get()
        const $rezed = this.rezed.get()

        for(let id of ids) {
            delete $warps[id]
            delete $wefts[id]
            $rezed.delete(id)

            const r = $wefts_r[id]
            if(r) {
                delete $wefts[r]
            }
        }
        // TODO: Notify destruction if rezed

        this.warps.set($warps)
        this.wefts.set($wefts)
        this.rezed.set($rezed)
    }

    destroy() {
        this.delete(...Object.keys(this.warps.get()))
        for(let cancel of Array.from(this.cancels)) {
            cancel()
        }
        this.cancels.clear()
    }

    toJSON() : IWeaveJSON {
        return {
            name: this.name.get(),
            wefts: this.wefts.get(),
            warps: this.warps.toJSON(),
            rezed: this.rezed.toJSON()
        }
    }
}
