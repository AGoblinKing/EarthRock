import { Weave } from 'src/weave/weave'
import { Living, NAME, Store, Tree, Read } from 'src/store'

export enum EWarp {
	SPACE = 'SPACE',
	MATH = 'MATH',
	VALUE = 'VALUE',
	MAIL = 'MAIL',
}

export abstract class Warp<T> extends Living<T> {
	protected weave: Weave
	protected value: Tree<T>

	readonly name: string
	readonly type: string

	constructor(weave: Weave, name: string) {
		super()

		this.name = name
		this.weave = weave
	}
}
