export type Listener = (value: any) => void
export type Processor = (value: any) => any
export type Cancel = () => void

// may only write once a frame to a store
const frame_writes = new Set()
const clear = () => {
	requestAnimationFrame(clear)
	frame_writes.clear()
}
clear()

// Stores are observables
export class Store {
	protected preprocess: Processor;
	protected listeners: Set<Listener>
	protected value: any;

	constructor(value, processor = undefined) {
		this.preprocess = processor
		this.set(value)
	}

	set_preprocess (processor: Processor) {
		this.preprocess = processor
	}

	notify () {
		if (!this.listeners) return

		if (frame_writes.has(this)) {
			return requestAnimationFrame(() => {
				if (frame_writes.has(this)) return
				this.notify()
			})
		}

		frame_writes.add(this)
		this.listeners.forEach((listener) => listener(this.value))
	}

	subscribe(listener: Listener): Cancel {
		return this.listen(listener)
	}

	listen (listener:Listener, initial = false) : Cancel { 
		if (!this.listeners) this.listeners = new Set()

		this.listeners.add(listener)
		
		if (!initial) listener(this.get())

		return () => this.listeners.delete(listener)
	}

	get () { return this.value }
	
	set (value) {
		this.value = this.preprocess ? this.preprocess(value) : value
		this.notify()
	}

	update (updator: Processor) {
		this.set(updator(this.value))
	}

	toJSON () {
		switch (typeof this.value) {
		case `undefined`:
		case `number`:
		case `string`:
			return this.value

		case `object`:
			if (
				Array.isArray(this.value) ||
				this.value === null
			) {
				return this.value
			}

			if (this.value.toJSON) {
				return this.value.toJSON()
			}
		}

		return JSON.parse(
			JSON.stringify(this.value)
		)
	}
}
