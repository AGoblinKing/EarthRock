import { write } from "/util/store.js"

export const IS_DEV = window.location.host === `localhost:5000`
export const SOUND_ON = false

export const animation = { delay: 100, duration: 300 }
export const TIME_TICK_RATE = write(100)

export const WEAVE_EXPLORE_OPEN = write(true)
export const INPUT_SCROLL_STRENGTH = write(20)
