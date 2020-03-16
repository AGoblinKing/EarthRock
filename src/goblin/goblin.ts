import { Tree, IStore, Living, ICancelMap, ICancel, Store, ELivingAction, TreeValue, ITree, Buffer } from "../store"
import { IMessage, IMessageEvent } from "./message"
import { IWheelJSON } from "../wheel/wheel"
import { Messenger, RemoteGoblin } from "./remote"
import { Visible } from "src/twist"

interface IWorker {
    onmessage: ((ev: IMessageEvent) => any) | null
    onerror: ((ev: any) => any) | null
    terminate(): void
    postMessage(message: IMessage): void
}

class LocalWorker extends Messenger implements IWorker {
    protected remote = new RemoteGoblin(this)

    terminate() {
        // okay
    }

    onerror (ev:  any) {
        // okay
    }
}  

export class Goblin extends Living<Buffer> {
    // this could use sharedmemory but not everyone supports it
    buffer = new Tree<Buffer>({
        VISIBLE: Visible.data
    })

    protected sys: Tree<Tree<IStore<any>>>
    protected value = this.buffer
    protected worker: IWorker
    protected sys_cancels: ICancelMap = {}
    protected sys_cancel: ICancel
    protected local: boolean

    private json_resolvers: Array<(data: any)=>void> = []

    constructor (sys: Tree<Tree<IStore<any>>>, local = false) {
        super()

        this.sys = sys
        this.local = local
    }

    create () {
        super.create()

        this.worker = this.local ? new LocalWorker() : new Worker(`/bin/wheel.bundle.js`)

        this.worker.onmessage = this.onmessage.bind(this)
        this.worker.onerror = this.onerror.bind(this)

        this.worker.postMessage({
            name: "status",
            data: ELivingAction.CREATE
        })
    }

    rez () {
        super.rez()

        this.sys_cancel = this.sys.listen(this.sys_update.bind(this))

        this.worker.postMessage({
            name: "status",
            data: ELivingAction.REZ
        })
    }

    derez () {
        super.derez()

        for(let cancel of Object.values(this.sys_cancels)) {
            cancel()
        }

        this.sys_cancel()

        this.worker.postMessage({
            name: "status",
            data: ELivingAction.DEREZ
        })
    }

    destroy () {
        super.destroy()

        this.worker.postMessage({
            name: "status",
            data: ELivingAction.DESTROY
        })
    }

    // replicate system changes into the worker
    protected sys_update ($sys: TreeValue<Tree<IStore<any>>>) {
        // this should happen very rarely
        for(let cancel of Object.values(this.sys_cancels)) {
            cancel()
        }
        
        this.sys_cancels = {}

        for(let [name, category] of Object.entries($sys)) {
            this.sys_cancels[name] = category.listen(($category) => {
                for(let [key, store] of Object.entries($category)) {
                    this.sys_cancels[`${name}/${key}`] = store.listen($store => {
                        this.worker.postMessage({
                            name: "update",
                            data: {
                                path: [`sys`, name, key],
                                value: $store
                            }
                        })
                    })
                }
            })
        }
    }

    protected msg_destroy () {
        this.worker.terminate()
    }

    protected msg_toJSON (json: IWheelJSON) {
        for(let resolve of this.json_resolvers) {
            resolve(json)
        }
    }

    protected msg_buffer (data: TreeValue<{[name: string]: number[]}>) {
        for(let [name, buffer] of Object.entries(data)) {
            const buff = this.buffer.item(name)

            if(buff === undefined) return
            buff.hydrate(buffer)
        }

        this.notify()
    }

    protected msg_ready () {
        this.worker.postMessage({
            name: "relay"
        })
    }

    protected onmessage = Messenger.prototype.onmessage

    protected onerror (event) {
        console.error(`Worker Error`, event)
    }

    async remote_toJSON () {
        return new Promise((resolve) => {
            this.json_resolvers.push(resolve)

            if(this.json_resolvers.length !== 1) return

            this.worker.postMessage({
                name: "toJSON"
            })
        })
    }

    remote_add (data: IWheelJSON) {
        this.worker.postMessage({
            name: "add",
            data
        })
    }

    remote_start (data: string) {
        this.worker.postMessage({
            name: "start",
            data
        })
    }

    remote_stop (data: string) {
        this.worker.postMessage({
            name: "stop",
            data
        })
    }
} 