import raf from "raf"

export type Listener<T> = (value: T) => void
export type Updater<T> = (value: T) => any
export type Cancel = () => void

export interface IStore<T> {
    get(): T;
	set(value: T, silent: Boolean): void;
	notify(): void;
	listen(listener: Listener<T>): Cancel;
	toJSON(): any;
}

// Stores are observables
export class Store <T> implements IStore <T> {
	protected listeners: Set<Listener<T>>;
	protected value: any;

	constructor(value: T) {
		this.value = value
	}

	notify () {
		if (!this.listeners) return
		this.listeners.forEach((listener) => listener(this.value))
	}

	subscribe(listener: Listener<T>): Cancel {
		return this.listen(listener)
	}

	listen (listener: Listener<T>, no_initial = false) : Cancel { 
		if (!this.listeners) this.listeners = new Set()

		this.listeners.add(listener)
		
		if (!no_initial) listener(this.get())

		return () => this.listeners.delete(listener)
	}

	get () : T { return this.value }
	
	set (value: T, silent = false) {
		this.value = value
		if(silent) return
		
		this.notify()
	}

	update (updator: Updater<T>) {
		this.set(updator(this.value))
	}

	toJSON () : any {
		switch (typeof this.value) {
		case `undefined`:
		case `number`:
		case `string`:
			return this.value as any

		case `object`:
			if(Set.prototype.isPrototypeOf(this.value)) {
				return Array.from(this.value)
			}

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
