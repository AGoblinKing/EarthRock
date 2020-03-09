import { Warp } from "./warp"
import { Tree,  TreeValue,  ITree} from "src/store"
import { WarpJSON } from "src/weave/types"
import { Weave } from "src/weave/weave"
import { Twist, TwistMap, ETwist, Data, Visible, Physical, IPhysical, IVisible } from "src/twist"

export type SpaceValue = TreeValue<Twist<any>>

export class Space extends Warp<SpaceValue> implements ITree<Twist<any>> {
    protected value: Tree<Twist<any>>;

    constructor(warp_data: WarpJSON<TwistMap>, weave: Weave) {
        super(warp_data, weave)

        const data = warp_data.value

        const twists = {}
        for(let type of Object.keys(data)) {
            twists[type] = this.add_twist(type, weave, data[type])
        }

        this.value = new Tree(twists)
    }

    item (name: string) {
        return this.value.item(name)
    }

    reset (target?: TreeValue<Twist<any>>, silent?: boolean)  {
        return this.value.reset(target, silent)
    }

    write (tree_write: object, silent?: boolean) {
        return this.value.write(tree_write, silent)
    }

    remove (name: string, silent?: boolean) {
        this.value.remove(name, silent)
    }

    query (...steps: string[]) : any {
        return this.value.query(...steps)
    }

    add_twist (type: string, weave: Weave, twist_data: object = {}): Twist<any> {
        switch(type) {
            case ETwist.DATA:
                return new Data(weave, this, twist_data)
            case ETwist.VISIBLE: 
                return new Visible(weave, this, twist_data as IVisible)
            case ETwist.PHYSICAL:
                return new Physical(weave, this, twist_data as IPhysical)
        }

        throw new Error(`unknown twist ${type}`)
    }

    create() {
        this.weave.spaces.write({ [this.name]: this })
    }

    destroy() {
        this.weave.spaces.remove(this.name)
    }

}
