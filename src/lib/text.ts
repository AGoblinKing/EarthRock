const TILE_COUNT = 1024

const str_color = (str: string) => {
	if (!str) return `#111`

	let hash = 0
	for (let i = 0; i < str.length; i++) {
		hash = str.charCodeAt(i) + ((hash << 5) - hash)
	}

	let color = `#`
	for (let i = 0; i < 3; i++) {
		const value = (hash >> (i * 8)) & 0xff
		color += (`00` + value.toString(16)).substr(-2)
	}

	return color
}

export const color = str_color

// whiskers on kittens
const words = [
	`groovy`,
	`cat`,
	`bird`,
	`dog`,
	`cool`,
	`okay`,
	`great`,
	`wat`,
	`goblin`,
	`life`,
	`ferret`,
	`gregert`,
	`robert`,
	`zilla`,
	`red`,
	`shirt`,
	`pants`,
	`blue`,
	`luna`,
	`ember`,
	`embear`,
	`notice`,
	`thank`,
	`happy`,
	`pungent`,
	`rich`,
	`bank`,
	`under`,
	`over`,
	`near`,
	`quaint`,
	`potato`,
	`egg`,
	`bacon`,
	`narwhal`,
	`lamp`,
	`stairs`,
	`king`,
	`amazing`,
	`terrific`,
	`good`,
	`exciting`,
	`hello`,
	`world`,
	`global`,
	`universal`,
	`television`,
	`computer`,
	`phone`,
	`bus`,
	`car`,
	`mouse`
]

export const tile = (str: string) => {
	let hash = 0
	for (let i = 0; i < str.length; i++) {
		hash = str.charCodeAt(i) + ((hash << 5) - hash)
	}

	return `${Math.abs(hash) % TILE_COUNT}`
}

export const random = (count: number) =>
	Array.from(new Array(count))
		.map(() => words[Math.floor(Math.random() * words.length)])
		.join(`_`)
