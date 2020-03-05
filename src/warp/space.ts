import { Warp } from "./warp"
import { Tree,  TreeValue,  ITree} from "src/store"
import { WarpJSON } from "src/weave/types"
import { Weave } from "src/weave/weave"
import { Twist, TwistMap, ETwist, Data, Visible, Physical, IPhysical, IVisible } from "src/twist"

export type SpaceValue = TreeValue<Twist>

export class Space extends Warp<SpaceValue> implements ITree<Twist> {
    protected value: Tree<Twist>;

    static create (type: string, weave: Weave, twist_data: object): Twist {
        switch(type) {
            case ETwist.DATA:
                return new Data(weave, twist_data)
            case ETwist.VISIBLE: 
                return new Visible(weave, twist_data as IVisible)
            case ETwist.PHYSICAL:
                return new Physical(weave, twist_data as IPhysical)
        }

        throw new Error(`unknown twist ${type}`)
    }


    constructor(warp_data: WarpJSON<TwistMap>, weave: Weave) {
        super(warp_data, weave)

        const data = warp_data.value

        const twists = {}
        for(let type of Object.keys(data)) {
            twists[type] = Space.create(type, weave, data[type])
        }

        this.value = new Tree(twists)
    }

    get_name (name: string) {
        return this.value.get_name(name)
    }

    reset (target?: TreeValue<Twist>, silent?: boolean)  {
        return this.value.reset(target, silent)
    }

    write (tree_write: object, silent?: boolean) {
        return this.value.write(tree_write, silent)
    }
}
