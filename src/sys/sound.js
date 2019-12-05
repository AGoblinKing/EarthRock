import Tone from "tone"
import { SOUND_ON } from "./flag.js"

import * as sound_import from "./sound/ui.js"

if (!SOUND_ON.get()) {
  Tone.Master.mute = true
}

Tone.Master.volume.value = -10

export const sounds = sound_import
