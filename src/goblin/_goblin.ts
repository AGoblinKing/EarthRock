import { RemoteGoblin } from "./remote"
import { IMessageEvent } from "./message"

const worker = new RemoteGoblin({
	onmessage(event: IMessageEvent) {
		postMessage(event.data)
	}
})

onmessage = worker.onmessage.bind(worker)
