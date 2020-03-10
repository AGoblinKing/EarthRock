import { Tree, Living, Store, ELivingStatus} from "src/store"
import { Weave, IWeave } from "src/weave"

export interface IWheelJSON {
    value: {[name: string]: IWeave}
    rezed: {[name: string]: boolean}
}

export class Wheel extends Living<Weave> {
    protected value = new Tree({
        sys: new Weave({
            name: `sys`,
            wefts: {},
            warps: {},
            rezed: []
        })
    })

    protected nerves = new Map<string, () => void>()

    constructor(wheel_JSON: IWeave) {
        super()
        this.status.set(ELivingStatus.REZED)
        this.rezed = new Store(new Set(["sys"]))
        
        const write = {}

        for(let name of Object.keys(wheel_JSON)) {
            if(name === "sys") continue

            write[name] = new Weave(wheel_JSON[name])
        }

        this.value.add(write)
    }
}