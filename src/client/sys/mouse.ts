import { Read } from "src/store"

export const position = new Read([0, 0], set => window
	.addEventListener(`mousemove`, ({ clientX, clientY }) => set([clientX, clientY]))
)

export const scroll = new Read([0, 0, 0], set => window
	.addEventListener(`wheel`, (e) => {
		set([-e.deltaX, -e.deltaY, 0])
	})
)
