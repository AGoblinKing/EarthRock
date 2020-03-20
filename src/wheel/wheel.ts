import { Tree, Living, Store, TreeValue } from 'src/store'
import { Weave, IWeave } from 'src/weave'

export interface IWheelJSON {
	value: { [name: string]: IWeave }
	rezed: string[]
}

export class Wheel extends Living<Weave> {
	protected value = new Tree({
		sys: new Weave({
			name: `sys`,
			thread: {},
			value: {},
			rezed: []
		})
	})

	constructor(wheel_data: IWheelJSON) {
		super()

		this.rezed = new Store(new Set(wheel_data.rezed))

		this.add(wheel_data.value)
	}

	add(weaves: TreeValue<IWeave>, silent = false) {
		const write = {}

		for (let [name, value] of Object.entries(weaves)) {
			if (value instanceof Weave) {
				write[name] = value
				continue
			}

			value.name = name
			write[name] = new Weave(value)
		}

		super.add(write, silent)
	}
}
