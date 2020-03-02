interface ClientMessage extends MessageEvent {
	action: string;
}

onmessage = function ({ action, data }: ClientMessage): void {
	switch (action) {
	case `wheel`:
		postMessage({ data }, `*`)
	}
}
