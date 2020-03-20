import { Isekai } from 'src/isekai'

import * as ClientSYS from './sys'
import * as CoreSYS from 'src/sys'

const is = ((window as any).is = new Isekai({
	...ClientSYS,
	...CoreSYS
}))

export default is
