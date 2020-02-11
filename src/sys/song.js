import Tone from "tone"
import { SOUND_ON } from "./flag.js"

SOUND_ON.listen(($on) => {
	Tone.Master.mute = !$on
})

Tone.Master.volume = 0
