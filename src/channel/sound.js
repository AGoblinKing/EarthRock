import Tone from "tone"
import { SOUND_ON } from "./flags.js"

export * from "./sound/ui.js"

if (!SOUND_ON) {
  Tone.Master.mute = true
}

Tone.Master.volume.value = -10
