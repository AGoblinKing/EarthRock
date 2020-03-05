import cuid from "cuid"

import { Store, Read, Cancel, Tree, TreeValue, IStore} from "src/store"
import { ID, EWarp, WeaveJSON, WarpJSON, WarpsJSON, Wefts} from "src/weave/types"

import { Space, Warp } from "src/warp"

export interface Warps {
    [key: string]: Warp<any>;
}

export class Weave {
    readonly name: Store<string>;
    readonly wefts: Tree<ID>;
    readonly warps: Tree<Warp<any>>;
    readonly rezed: Store<Set<ID>>;

    // caches
    readonly wefts_reverse: Read<Wefts>;
    readonly spaces: Read<Warps>;

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

    constructor(data: WeaveJSON) {
        this.name = new Store(data.name)
        this.wefts = new Tree(data.wefts)
        this.warps = new Tree({})
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
            warp.id = warp.id === "cuid" ? cuid() : id

            warps[id] = this.create_warp(warp)
        }

        this.warps.set(Object.assign(this.warps.get(), warps), silent)
        return warps
    }

    delete(...ids: ID[]) {
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

    toJSON() : WeaveJSON {
        return {
            name: this.name.get(),
            wefts: this.wefts.get(),
            warps: this.warps.toJSON(),
            rezed: this.rezed.toJSON()
        }
    }
}
