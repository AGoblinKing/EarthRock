import { write } from "/util/store.js"

export const IS_DEV = window.location.host === `localhost:5000`
export const SOUND_ON = false

export const animation = { delay: 100, duration: 300 }
export const tick_rate = 100

export const explore_open = write(true)
