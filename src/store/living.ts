import { ProxyTree } from './proxy'
import { Store } from './store'
import { TreeValue } from './tree'

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

	start_all(...all: string[]) {
		all = all.length === 0 ? Object.keys(this.get()) : all
		for (let name of all) {
			this.start(name)
		}
	}

	start(name: string) {
		const $rezed = this.rezed && this.rezed.get()
		const item = this.item(name)

		if (!item) return

		// can only rez if I am
		if (this.status.get() === ELivingStatus.REZED) {
			;(item as any).rez && (item as any).rez()
		}

		if ($rezed) {
			$rezed.add(name)
			this.rezed.notify()
		}
	}

	stop(...names: string[]) {
		const $rezed = this.rezed && this.rezed.get()
		for (let name of names) {
			const item = this.item(name)
			if (!item) continue // can derez whenever though

			;(item as any).derez && (item as any).derez()

			if (!$rezed) continue

			$rezed.delete(name)
		}

		this.rezed.notify()
	}

	restart(name: string) {
		this.stop(name)
		this.start(name)
	}

	toJSON(): any {
		return {
			value: this.value.toJSON(),
			rezed: this.rezed ? this.rezed.toJSON() : undefined
		}
	}

	ensure(first: string, ...path: string[]) {
		let $item = this.item(first)

		if ($item === undefined) {
			this.add({
				[first]: {}
			})

			$item = this.item(first)
		}

		if (path.length === 0) return $item

		if ($item instanceof Living) {
			return $item.ensure(path[0], ...path.slice(1))
		}

		throw new Error('tried to ensure non living item')
	}
}
