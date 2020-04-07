import raf from 'raf'

import { IMessage, IMessageEvent } from './message'
import { ELivingAction, EGrok, ICancel } from '../store'

import { Wheel, IWheelJSON } from '../wheel/wheel'
import { Visible } from '../twist'

export interface IMessenger {
	onmessage(event: IMessageEvent): void
}

export abstract class Messenger implements IMessenger {
	protected remote: IMessenger

	onmessage(event: IMessageEvent): void {
		const msg = event.data
		const fn = `msg_${msg.name}`
		if (this[fn]) this[fn](msg.data)
	}

	postMessage(message: IMessage) {
		this.remote.onmessage({ data: message })
	}
}

export class RemoteGoblin extends Messenger {
	private wheel = new Wheel({
		rezed: [],
		value: {}
	})
	private cancel_grok: ICancel
	private timeout
	constructor(remote: IMessenger) {
		super()
		this.remote = remote

		raf(() => {
			this.postMessage({
				name: 'ready'
			})
		})
	}

	private tick() {
		raf(() => {
			this.postMessage({
				name: 'buffer',
				data: {
					VISIBLE: Visible.data.toJSON()
				}
			})
		})
	}

	protected msg_toJSON() {
		this.postMessage({
			name: 'toJSON',
			data: this.wheel.toJSON()
		})
	}

	protected msg_add(data: IWheelJSON) {
		if (data.value) this.wheel.add(data.value)

		if (data.rezed === undefined) return

		for (const name of data.rezed) {
			this.wheel.start(name)
		}
	}

	protected msg_status(data: ELivingAction) {
		this.wheel[data]()
		if (data !== ELivingAction.DESTROY) return

		this.postMessage({
			name: 'destroy'
		})
	}

	protected msg_start(data: string) {
		this.wheel.start(data)
	}

	protected msg_stop(data: string) {
		this.wheel.stop(data)
	}

	protected msg_update(data: { path: string[]; value: any }) {
		this.wheel.ensure(data.path[0], ...data.path.slice(1)).set(data.value)
	}

	protected msg_relay() {
		if (this.timeout) this.timeout()
		this.timeout = this.wheel
			.query('sys', 'time', 'tick')
			.listen(this.tick.bind(this))
	}

	protected msg_grok() {
		if (this.cancel_grok) return
		this.cancel_grok = this.wheel.grok(
			(action: EGrok, key: string, value?: any) => {
				this.postMessage({
					name: 'groker',
					data: {
						action,
						key,
						value
					}
				})
			}
		)
	}

	protected msg_grok_stop() {
		if (!this.cancel_grok) return
		this.cancel_grok()
	}
}
