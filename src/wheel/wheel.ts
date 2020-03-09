import { Store, Read, Tree, ProxyTree} from "src/store"
import { Weave, IWeaveJSON } from "src/weave"

export interface IWheelJSON {
    value: {[name: string]: IWeaveJSON}
    runnning: {[name: string]: boolean}
}

export class Wheel extends ProxyTree<Weave> {
    protected value = new Tree({
        sys: new Weave({
            name: `sys`,
            wefts: {},
            warps: {},
            rezed: []
        })
    })

    protected nerves = new Map<string, () => void>()
    protected running = new Tree<boolean>()

    constructor(wheel_JSON: IWeaveJSON) {
        super()
        const write = {}

        for(let name of Object.keys(wheel_JSON)) {
            if(name === "sys") continue

            write[name] = new Weave(wheel_JSON[name])
        }

        this.value.write(write)
    }

    start (name: string) {
        this.running.write({
            [name]: true
        })        
    }

    stop (name: string) {
        this.running.remove(name)
    }

    stop_all () {
        this.running.reset({})
    }

    clear () {
        this.stop_all()

    }

    restart (name: string) {

    }

    toJSON() {

    }

}