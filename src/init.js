import * as Wheel from "/weave/wheel.js"

window.Wheel = Wheel

const worker = new Worker(`/worker.js`)
