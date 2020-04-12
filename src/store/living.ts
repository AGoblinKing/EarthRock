import { ProxyTree } from './proxy'
import { Store } from './store'
import { TreeValue, IGrok, EGrok } from './tree'

export enum ELivingAction {
	CREATE = 'create',
	REZ = 'rez',
	DEREZ = 'derez',
	DESTROY = 'destroy'
}

export enum ELivingStatus {
	VOID = 'VOID',
	CREATED = 'CREATED',
	REZED = 'REZED'
}

export abstract class Living<T> extends ProxyTree<T> {
	protected rezed: Store<Set<string>> | undefined
	readonly status = new Store(ELivingStatus.VOID)
	
	add(living_data: TreeValue<any>, silent = false) {
		// when adding check to see if they have rezed/value
		// if they do its a living
		super.add(living_data, silent)
		const $status = this.status.get()
		const items = Object.entries(living_data)

		switch ($status) {
			case ELivingStatus.CREATED:
				for (let [_, item] of items) {
					item.create && item.create()
				}

			case ELivingStatus.REZED:
				const $rezed = this.rezed && this.rezed.get()

				// create doesn't auto rez
				// so you can batch creates together then rez
				for (let [name, item] of items) {
					if ($rezed && !$rezed[name]) continue
					item.rez && item.rez()
				}
		}
	}

	remove(name: string, silent = false) {
		const $value = this.get() as any

		if ($value[name] && $value[name].destroy) {
			$value[name].destroy()
		}

		const $rezed = this.rezed && this.rezed.get()
		if ($rezed) {
			$rezed.delete(name)
		}

		super.remove(name, silent)
	}

	removes(...names: string[]) {
		for (let name of names) {
			this.remove(name, true)
		}

		this.notify()
	}

	create() {
		if (this.status.get() !== ELivingStatus.VOID) {
			throw new Error('Tried to create a nonvoid living class')
		}

		// run through my tree to guarantee its destroyed
		let sub: any
		for (sub of Object.values(this.get())) {
			sub.create && sub.create()
		}

		this.status.set(ELivingStatus.CREATED)
	}

	destroy() {
		if (this.status.get() === ELivingStatus.REZED) {
			this.derez()
		}

		let sub: any
		for (sub of Object.values(this.get())) {
			sub.destroy && sub.destroy()
		}

		this.status.set(ELivingStatus.VOID)
	}

	rez() {
		if (this.status.get() === ELivingStatus.VOID) {
			this.create()
		}

		const rezed = this.rezed && this.rezed.get()

		for (let [name, sub] of Object.entries(this.get())) {
			if (rezed && !rezed.has(name)) continue
			;(sub as any).rez && (sub as any).rez()
		}

		this.status.set(ELivingStatus.REZED)
	}

	derez() {
		if (this.status.get() !== ELivingStatus.REZED) {
			return
		}

		const $rezed = this.rezed && this.rezed.get()

		for (let [name, sub] of Object.entries(this.get())) {
			if ($rezed && !$rezed.has(name)) continue
			;(sub as any).derez && (sub as any).derez()
		}

		this.status.set(ELivingStatus.CREATED)
	}

	start(...names: string[]) {
		const $rezed = this.rezed && this.rezed.get()

		for (let name of names) {
			const item = this.query(name)

			if (!item) continue

			// can only rez if I am
			if (this.status.get() === ELivingStatus.REZED) {
				; (item as any).rez && (item as any).rez()
			}

			if ($rezed) {
				$rezed.add(name)
				this.rezed.notify()
			}

			this.groke(EGrok.START, name)
		}
	}

	stop(...names: string[]) {
		const $rezed = this.rezed && this.rezed.get()
		for (let name of names) {
			const item = this.query(name)
			if (!item) continue // can derez whenever though

			;(item as any).derez && (item as any).derez()

			if (!$rezed) continue

			$rezed.delete(name)
			this.groke(EGrok.STOP, name)
		}

		this.rezed.notify()
	}

	restart(name: string) {
		this.stop(name)
		this.start(name)
	}

	serialize(): any {
		return {
			value: this.toJSON(),
			rezed: this.rezed ? this.rezed.toJSON() : undefined
		}
	}

	ensure(first: string, ...path: string[]) {
		let $item = this.query(first)

		if ($item === undefined) {
			this.add({
				[first]: {}
			})

			$item = this.query(first)
		}

		if (path.length === 0) return $item

		if ($item instanceof Living) {
			return $item.ensure(path[0], ...path.slice(1))
		}

		throw new Error('tried to ensure non living item')
	}
	
	groker(action: EGrok, path: string, value?: any) {
		const parts = path.split("/")
		const target = parts.length === 1 
			? this
			: this.query(...parts.slice(0, -1))
		
		const key = path[path.length - 1]

		// path can be tiered, split it out and start based on parent
		switch (action) {
			case EGrok.START:
				target.start && target.start(key)
				break
			case EGrok.STOP:
				target.stop && target.stop(key)
				break
			default:
				super.groker(action, key, value)
		}
	}
	
	grok(groker: IGrok) {
		const cancel = super.grok(groker)
		if (this.rezed !== undefined) {
			for (let key of Array.from(this.rezed.get())) {
				groker(EGrok.START, key)
			}
		}
		return cancel
	}
}
