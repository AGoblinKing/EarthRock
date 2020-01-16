import { write, read, proto_write } from "/store.js"
import { extend } from "/object.js"

import { proto_warp } from "./warp.js"

const type = read(`mail`)

const proto_mail = extend(proto_warp, {
	fix (address) {
		return address
			.replace(`$`, ``)
			.replace(`~`, `/${this.weave.name.get()}`)
			.replace(`.`, this.weave.to_address(this.weave.chain(this.id.get(), true).shift()))
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

			$whom = this.weave.resolve($whom, this.id.get())

			if ($whom[0] === `$`) {
				$whom = $whom.replace(`$`, ``)
				const thing = Wheel.get($whom)
				if (!thing) return this.set(null)

				this.set(thing.get())
				return
			}

			let thing = Wheel.get($whom)
			if (!thing) return

			thing = thing.type
				? thing.value
				: thing

			this.cancels.add(thing.listen(($thing) => {
				this.set($thing)
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
	set (value) {
		const $whom = this.mail.fix(this.mail.whom.get())

		const v = Wheel.get($whom)

		if (!v || !v.set) {
			return
		}

		v.set(value)
		proto_write.set.call(this, value)
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
