import { write, read, proto_write } from "/util/store.js"
import { extend } from "/util/object.js"

const knot = read(`mail`)

const proto_mail = {
	_fix (address) {
		return address
			.replace(`$`, ``)
			.replace(`~`, `/${this.weave.name.get()}`)
			.replace(`.`, this.weave.to_address(this.weave.chain(this.id.get(), true).shift()))
	},

	_clear () {
		this.cancels.forEach((fn) => fn())
		this.cancels.clear()
	},

	derez () {
		this.cancel_value()
		this.cancel_whom()
		this._clear()
	},

	rez () {
		this.cancels = new Set()

		this.cancel_whom = this.whom.listen(($whom) => {
			this._clear()

			$whom = this.weave.resolve($whom, this.id)

			if ($whom[0] === `$`) {
				$whom = $whom.replace(`$`, ``)
				const thing = Wheel.get($whom)
				if (!thing) return this.set(null)

				this.set(thing.get())
				return
			}

			let thing = Wheel.get($whom)
			if (!thing) return this.set(null)
			thing = thing.value
				? thing.value
				: thing

			this.cancels.add(thing.listen(($thing) => {
				this.set($thing)
			}))
		})
	},
	toJSON () {
		return {
			id: this.id.get(),
			knot: this.knot.get(),
			value: this.value.get(),

			whom: this.whom.get()
		}
	}
}

const proto_remote = extend(proto_write, {
	set (value) {
		const $whom = this.mail._fix(this.mail.whom.get())

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
	weave
}) => {
	const mail = extend(proto_mail, {
		knot,
		whom: write(whom),
		weave
	})

	mail.value = extend(proto_remote, {
		...write(),
		mail
	})

	return mail
}
