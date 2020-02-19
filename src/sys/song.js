import Tone from "tone"
import { sound } from "./device.js"

sound.listen(($on) => {
	Tone.Master.mute = !$on
})

Tone.Master.volume = 0
