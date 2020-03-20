import { IWheelJSON } from 'src/wheel'
import { Goblin } from 'src/goblin'
import { IStore, Tree, Living, TreeValue, Store } from 'src/store'

// Starts up in the main thread
export class Isekai extends Living<Goblin> {
	protected goblins = new Tree<Goblin>()
	protected value = this.goblins

	readonly sys = new Tree<Tree<IStore<any>>>()
	readonly local = new Store(false)

	constructor(sys: TreeValue<TreeValue<any>>, local = false) {
		super()
		this.local.set(local)

		const write = {}
		for (let [name, value] of Object.entries(sys)) {
			write[name] = new Tree(value)
		}

		this.sys.add(write)

		// Check Path
		// Check Database
		this.create()
		this.rez()
	}

	add(wheels: TreeValue<IWheelJSON>) {
		const write = {}

		for (let [name, wheel_json] of Object.entries(wheels)) {
			const worker = (write[name] = new Goblin(
				this.sys,
				this.local.get()
			))

			worker.create()
			worker.add(wheel_json)
		}

		super.add(write)
	}
}
