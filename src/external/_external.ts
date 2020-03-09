import piexifjs from "piexifjs"
import Color from "color-js"
import Cuid from "cuid"
import * as TWGL from "twgl.js"
import Tone from "tone"
import Tune from "./scribbletune"
import ExprEval from "expr-eval"

Object.assign(window, {
	piexifjs,
	Tone,
	Tune,
	ExprEval,
	TWGL,
	Color,
	Cuid
});
