import { Store, Read, ICancel, Tree, Living, NAME, TreeValue } from 'src/store'
import { Space, Warp, EWarp } from 'src/warp'

export interface Threads {
	[key: string]: NAME
}

export interface IWeave {
	name?: string
	thread?: Threads
	value?: TreeValue<any>
	rezed?: Array<NAME>
}

export interface Warps {
	[key: string]: Warp<any>
}

export class Weave extends Living<Warp<any>> {
	readonly name: string
	readonly threads: Tree<NAME>
	readonly value: Tree<Warp<any>> = new Tree({})

	// caches
	readonly threads_reverse: Read<Threads>
	readonly spaces: Tree<Warp<any>> = new Tree({})

	// clean up
	protected readonly cancels: Set<ICancel> = new Set()
	private thread_cancel: ICancel
	private nerves: { [name: string]: ICancel } = {}

	create_warp($warp: any, name: string) {
		const [type] = name.split('_')

		switch (type) {
			case EWarp.SPACE:
				return new Space($warp, this, name)
			case EWarp.MAIL:
			case EWarp.VALUE:
			case EWarp.MATH:
				throw new Error('unsupported')
				break
			default:
				return new Space($warp, this, name)
		}
	}

	constructor(data: IWeave) {
		super()

		if (data.name === undefined) {
			throw new Error('Undefined name for weave')
		}

		this.name = data.name
		this.threads = new Tree(data.thread || {})
		this.rezed = new Store(new Set(data.rezed || []))

		this.threads_reverse = new Tree({}, (set) => {
			this.cancels.add(
				this.threads.listen(($threads) => {
					const w_r = {}
					for (let key of Object.keys($threads)) {
						w_r[$threads[key]] = key
					}

					set(w_r)
				})
			)
		})

		this.add(data.value || {})
	}

	add(warp_data: TreeValue<any>, silent = false): Warps {
		if (!warp_data) return
		const warps: Warps = {}

		for (let [name, warp] of Object.entries(warp_data)) {
			if (warp instanceof Warp) {
				warps[name] = warp
				continue
			}

			warps[name] = this.create_warp(warp, name)
		}

		super.add(warps, silent)

		return warps
	}

	rez() {
		super.rez()

		// connect threads to form nerves
		this.thread_cancel = this.threads.listen(this.thread_update.bind(this))
	}

	thread_update($threads: TreeValue<string>) {
		for (let [name, cancel] of Object.entries(this.nerves)) {
			if ($threads[name]) {
				delete $threads[name]
				continue
			}

			cancel()
			delete this.nerves[name]
		}

		for (let [from, to] of Object.entries($threads)) {
			const f = this.query(...from.split('/'))
			const t = this.query(...to.split('/'))
			if (!f || !t) continue
			this.nerves[from] = f.listen(t.set.bind(t))
		}
	}

	derez() {
		super.derez()

		for (let cancel of Object.values(this.nerves)) {
			cancel()
		}

		this.thread_cancel()
	}

	removes(...names: NAME[]) {
		const $warps = this.value.get()
		const $wefts = this.threads.get()
		const $wefts_r = this.threads_reverse.get()
		const $rezed = this.rezed.get()

		for (let name of names) {
			const warp = $warps[name]
			if (warp) warp.destroy()

			delete $warps[name]
			delete $wefts[name]
			$rezed.delete(name)

			const r = $wefts_r[name]
			if (r) {
				delete $wefts[r]
			}
		}

		this.value.set($warps)
		this.threads.set($wefts)
		this.rezed.set($rezed)
	}

	remove(name: string) {
		this.removes(name)
	}

	destroy() {
		super.destroy()

		for (let cancel of Array.from(this.cancels)) {
			cancel()
		}

		this.cancels.clear()
	}

	serialize(): IWeave {
		return {
			name: this.name,
			thread: this.threads.toJSON(),

			value: this.value.toJSON(),
			rezed: this.rezed.toJSON(),
		}
	}

	// TODO: custom grok/groker that provides thread updates
}
