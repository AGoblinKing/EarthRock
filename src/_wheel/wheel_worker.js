import Color from "color-js"
import * as Wheel from "./wheel.js"
import { github } from "/sys/file.js"

self.Color = Color

onmessage = ({ action, data }) => {
	switch (action) {
	case `wheel`:

		postMessage({ data })
	}
}
