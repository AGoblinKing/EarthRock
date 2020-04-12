import { Warp } from './warp'
import { Tree, Store, TreeValue } from 'src/store'
import { Weave } from 'src/weave/weave'
import {
	Twist,
	ITwist,
	ETwist,
	Data,
	Visible,
	Physical,
	IPhysical,
	IVisible,
} from 'src/twist'

export class Space extends Warp<Twist<any>> {
	constructor(warp_data: TreeValue<ITwist>, weave: Weave, name: string) {
		super(weave, name)
		this.value = new Tree()

		if (warp_data !== undefined) this.add(warp_data)
	}

	add(data: ITwist) {
		const adds = {}

		for (let [type, value] of Object.entries(data)) {
			adds[type] = this.create_twist(type, value)
		}

		super.add(adds)
	}

	protected create_twist(
		type: string,
		twist_data: object = {}
	): Twist<any> | Store<any> {
		switch (type) {
			case ETwist.DATA:
				return new Data(this.weave, this, twist_data)
			case ETwist.VISIBLE:
				return new Visible(this.weave, this, twist_data as IVisible)
			case ETwist.PHYSICAL:
				return new Physical(this.weave, this, twist_data as IPhysical)
		}

		return new Store(twist_data)
	}

	create() {
		super.create()
		this.weave.spaces.add({ [this.name]: this })
	}

	destroy() {
		super.destroy()
		this.weave.spaces.remove(this.name)
	}
}
