import { Warp, IWarp } from "./warp"
import { Tree, Store } from "src/store"
import { Weave } from "src/weave/weave"
import { Twist, ITwist, ETwist, Data, Visible, Physical, IPhysical, IVisible } from "src/twist"

export class Space extends Warp<Twist<any>> {
    protected value = new Tree<Twist<any>>()

    constructor (warp_data: IWarp<ITwist>, weave: Weave) {
        super(warp_data, weave)

        this.add(warp_data.value || {})
    }

    add (data: ITwist) {
        const adds = {}

        for(let type of Object.keys(data)) {
            adds[type] = this.create_twist(type, data[type])
        }

        super.add(adds)
    }

    protected create_twist (type: string, twist_data: object = {}): Twist<any> | Store<any> {
        switch(type) {
            case ETwist.DATA:
                return new Data(this.weave, this, twist_data)
            case ETwist.VISIBLE: 
                return new Visible(this.weave, this, twist_data as IVisible)
            case ETwist.PHYSICAL:
                return new Physical(this.weave, this, twist_data as IPhysical)
        }

        return new Store(twist_data)
    }   

    create () {
        super.create()
        this.weave.spaces.add({ [this.name]: this })
    }

    destroy () {
        super.destroy()
        this.weave.spaces.remove(this.name)
    }
}
