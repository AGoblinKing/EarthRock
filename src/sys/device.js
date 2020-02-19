import { write } from "/store.js"

const screen_ui_regex = /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i

export const agent = write((navigator.userAgent || navigator.vendor || window.opera).toLowerCase())

export const keyboard = write(
	!screen_ui_regex.test(agent.get())
)

export const sound = write(true)
