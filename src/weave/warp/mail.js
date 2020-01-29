import { write, read, proto_write } from "/store.js"
import { extend } from "/object.js"

import { proto_warp } from "./warp.js"

const type = read(`mail`)

const proto_mail = extend(proto_warp, {
	fix (address) {
		const space = this.get_space()

		return address
			.replace(`$`, ``)
			.replace(`~`, `/${this.weave.name.get()}`)
			.replace(`.`, `${this.weave.name.get()}/${space ? space.get_value(`!name`) : `not connected`}`)
	},

	clear () {
		this.cancels.forEach((fn) => fn())
		this.cancels.clear()
	},

	derez () {
		this.cancel_whom()
		this.clear()
	},

	rez () {
		this.cancels = new Set()

		this.cancel_whom = this.whom.listen(($whom) => {
			this.clear()
			const fixed = this.fix($whom)
			const thing = Wheel.get(fixed)

			if ($whom[0] === `$`) {
				if (!thing) return this.set(null)

				this.set(thing.get())
				return
			}

			if (!thing) return

			const remote = thing.type
				? thing.value
				: thing

			this.cancels.add(remote.listen(($remote) => {
				this.set($remote)
			}))
		})
	},

	toJSON () {
		return {
			type: this.type.get(),
			value: this.value.get(),
			whom: this.whom.get()
		}
	},

	set (value) {
		proto_write.set.call(this.value, value)
	}
})

const proto_remote = extend(proto_write, {
	set (value, shh) {
		const $whom = this.mail.fix(this.mail.whom.get())

		const v = Wheel.get($whom)

		if (!v || !v.set) {
			return
		}

		v.set(value)
		proto_write.set.call(this, value, shh)
	}
})

// instead use the weave messaging channel
export default ({
	whom = `/sys/mouse/position`,
	weave,
	id
}) => {
	const mail = extend(proto_mail, {
		type,
		whom: write(whom),
		id: read(id),
		weave
	})

	mail.value = extend(proto_remote, {
		...write(),
		mail
	})

	return mail
}
