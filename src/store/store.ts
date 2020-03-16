import raf from "raf"

export type IListen<T> = (value: T) => void
export type IUpdate<T> = (value: T) => any
export type ICancel = () => void
export type ICancelMap = {[name: string]: ICancel}

export interface IStore<T> {
    get (): T
	set (value: any, silent?: Boolean): void
	notify (): void
	listen (listener: IListen<T>): ICancel
	toJSON (): any
}

// Stores are observables
export class Store <T> implements IStore <T> {
	protected listeners: Set<IListen<T>>
	protected value: any

	constructor(value: T) {
		this.value = value
	}

	notify () {
		if (!this.listeners) return
		this.listeners.forEach((listener) => listener(this.value))
	}

	subscribe (listener: IListen<T>): ICancel {
		return this.listen(listener)
	}

	listen (listener: IListen<T>, no_initial = false) : ICancel { 
		if (!this.listeners) this.listeners = new Set()

		this.listeners.add(listener)
		
		if (!no_initial) listener(this.get())

		return () => this.listeners.delete(listener)
	}

	get () : T { return this.value }
	
	set (value: any, silent = false) {
		this.value = value
		if(silent) return
		
		this.notify()
	}

	update (updator: IUpdate<T>) {
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
