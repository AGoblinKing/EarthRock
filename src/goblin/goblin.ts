import {
	Tree,
	IStore,
	Living,
	ICancelMap,
	ICancel,
	ELivingAction,
	TreeValue,
	Buffer,
	ELivingStatus
} from '../store'
import { IMessage, IMessageEvent } from './message'
import { IWheelJSON, Wheel } from '../wheel/wheel'
import { Messenger, RemoteGoblin } from './remote'
import { Visible } from 'src/twist'
import { Weave } from 'src/weave'

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

	onerror(ev: any) {
		// okay
	}
}

export class Goblin extends Living<Weave> {
	// this could use sharedmemory but not everyone supports it
	buffer = new Tree<Buffer>({
		VISIBLE: Visible.data
	})

	protected sys: Tree<Tree<IStore<any>>>
	protected value: Wheel
	protected worker: IWorker
	protected sys_cancels: ICancelMap = {}
	protected sys_cancel: ICancel
	protected local: boolean

	private json_resolvers: Array<(data: any) => void> = []

	constructor(sys: Tree<Tree<IStore<any>>>, local = false) {
		super()

		// doesn't guarantee syncing
		this.value = new Wheel({
			value: {},
			rezed: []
		})

		this.sys = sys
		this.local = local
	}

	create() {
		this.worker = this.local
			? new LocalWorker()
			: new Worker(`/bin/goblin.bundle.js`)

		this.worker.onmessage = this.onmessage.bind(this)
		this.worker.onerror = this.onerror.bind(this)

		this.worker.postMessage({
			name: 'status',
			data: ELivingAction.CREATE
		})
	}

	rez() {
		this.sys_cancel = this.sys.listen(this.sys_update.bind(this))

		this.worker.postMessage({
			name: 'status',
			data: ELivingAction.REZ
		})
	}

	derez() {
		for (let cancel of Object.values(this.sys_cancels)) {
			cancel()
		}

		this.sys_cancel()

		this.worker.postMessage({
			name: 'status',
			data: ELivingAction.DEREZ
		})
	}

	destroy() {
		this.worker.postMessage({
			name: 'status',
			data: ELivingAction.DESTROY
		})
	}

	// replicate system changes into the worker
	protected sys_update($sys: TreeValue<Tree<IStore<any>>>) {
		// this should happen very rarely
		for (let cancel of Object.values(this.sys_cancels)) {
			cancel()
		}

		this.sys_cancels = {}

		for (let [name, category] of Object.entries($sys)) {
			this.sys_cancels[name] = category.listen($category => {
				for (let [key, store] of Object.entries($category)) {
					this.sys_cancels[`${name}/${key}`] = store.listen(
						$store => {
							this.worker.postMessage({
								name: 'update',
								data: {
									path: [`sys`, name, key],
									value: $store
								}
							})
						}
					)
				}
			})
		}
	}

	protected msg_destroy() {
		this.worker.terminate()
	}

	protected msg_toJSON(json: IWheelJSON) {
		// hydrate self
		this.value.add(json.value)

		for (let resolve of this.json_resolvers) {
			resolve(json)
		}
	}

	protected msg_buffer(data: TreeValue<{ [name: string]: number[] }>) {
		for (let [name, buffer] of Object.entries(data)) {
			const buff = this.buffer.item(name)

			if (buff === undefined) return
			buff.hydrate(buffer)
		}

		this.buffer.notify()
	}

	protected msg_ready() {
		this.worker.postMessage({
			name: 'relay'
		})
	}

	protected onmessage = Messenger.prototype.onmessage

	protected onerror(event) {
		console.error(`Worker Error`, event)
	}

	async remote_toJSON() {
		return new Promise(resolve => {
			this.json_resolvers.push(resolve)

			if (this.json_resolvers.length !== 1) return

			this.worker.postMessage({
				name: 'toJSON'
			})
		})
	}

	add(data: IWheelJSON) {
		this.remote_add(data)
	}

	remote_add(data: IWheelJSON) {
		this.worker.postMessage({
			name: 'add',
			data
		})
	}

	remote_start(data: string) {
		this.worker.postMessage({
			name: 'start',
			data
		})
	}

	remote_stop(data: string) {
		this.worker.postMessage({
			name: 'stop',
			data
		})
	}
}
