var app = (function (Color, uuid, scribble, Tone, exif, expr, twgl) {
	'use strict';

	Color = Color && Color.hasOwnProperty('default') ? Color['default'] : Color;
	uuid = uuid && uuid.hasOwnProperty('default') ? uuid['default'] : uuid;
	scribble = scribble && scribble.hasOwnProperty('default') ? scribble['default'] : scribble;
	Tone = Tone && Tone.hasOwnProperty('default') ? Tone['default'] : Tone;
	exif = exif && exif.hasOwnProperty('default') ? exif['default'] : exif;
	expr = expr && expr.hasOwnProperty('default') ? expr['default'] : expr;

	// extend an object, allows currying
	const extend = (proto, assign = false) => assign
		? {
			__proto__: proto,
			...assign
		}
		: (next_assign) => extend(proto, next_assign);

	const map = (obj) => (fn) => Object.fromEntries(
		Object.entries(obj).reduce((result, [key, value]) => {
			const entry = fn([key, value]);

			if (entry) result.push(entry);

			return result
		}, [])
	);

	const each = (obj) => (fn) =>
		Object.entries(obj).forEach(fn);

	const reduce = (obj) => (fn, def) =>
		Object.entries(obj).reduce(fn, def);

	const keys = Object.keys;
	const values = Object.values;
	const assign = (obj) => (...next) => Object.assign(obj, ...next);

	const store_JSON = (store) => reduce(store.get())(
		(result, [key, thing]) => {
			if (key[0] === `&`) return result

			result[key] = thing.toJSON();

			return result
		}
		, {});

	const proto_store = {
		toJSON () {
			switch (typeof this.value) {
			case `undefined`:
			case `number`:
			case `string`:
				return this.value

			case `object`:
				if (Array.isArray(this.value) ||
					this.value === null
				) {
					return this.value
				}
				if (this.value.toJSON) {
					return this.value.toJSON()
				}
			}

			return JSON.parse(
				JSON.stringify(this.value)
			)
		}
	};

	const store = (value) => extend(proto_store, {
		value
	});

	const speed_check = new Set();

	const clear = () => {
		requestAnimationFrame(clear);
		speed_check.clear();
	};

	clear();

	const proto_read = extend(proto_store, {
		get () { return this.value },

		notify () {
			if (!this.subs) return

			if (speed_check.has(this)) {
				return requestAnimationFrame(() => {
					if (speed_check.has(this)) return
					this.notify();
				})
			}

			speed_check.add(this);
			this.subs.forEach((s) => s(this.value));
		},

		subscribe (fn, silent = false) {
			if (!this.subs) this.subs = new Set();

			this.subs.add(fn);
			if (!silent) fn(this.value);

			return () => this.subs.delete(fn)
		},

		listen (fn) { return this.subscribe(fn) }
	});

	const read = (val, handler) => {
		const r = extend(proto_read, store(val));

		if (handler) {
			handler((v) => {
				r.value = v;
				r.notify(v);
			});
		}

		return r
	};

	const proto_write = extend(proto_read, {
		set (value, silent = false) {
			this.value = value === undefined
				? null
				: value;

			if (!silent) this.notify();
		},

		update (fn) {
			this.set(fn(this.value));
		}
	});

	const write = (value) => extend(proto_write, read(value));

	const proto_difference = extend(proto_write, {
		get (key = false) {
			const value = proto_write.get.call(this);
			if (key === false) return value

			return value[key]
		},

		set (value, silent = false) {
			this.value = value;

			const { previous } = this;
			const modify = [];

			if (!silent) {
				this.notify({
					add: keys(value).filter((key) => {
						const is_add = previous[key] === undefined;
						if (!is_add && previous[key] !== value[key]) {
							modify.push(key);
						}
						return is_add
					}),
					remove: keys(previous).filter((key) => value[key] === undefined),
					modify,
					previous
				});
			}

			// keys a copy of the previous state for diffing
			this.previous = {
				__proto__: value.__proto__,
				...value
			};
		},

		subscribe (fn) {
			fn(this.value, {
				add: keys(this.value),
				remove: [],
				modify: [],
				previous: this.value
			});

			return proto_write.subscribe.call(this, fn, true)
		},

		notify (difference) {
			if (!this.subs || !difference) return

			// TODO: this skips the speed limit, good? bad?
			this.subs.forEach((fn) => fn(this.value, difference));
		}
	});

	const difference = (value = {}) => extend(proto_difference, {
		...write(value),
		previous: { ...value }
	});

	const proto_tree = extend(proto_difference, {
		has (name) {
			return this.get(name) !== undefined
		},

		get (name = false) {
			const v = proto_difference.get.call(this);
			if (name === false) return v

			return v[name]
		},

		set (data, silent = false) {
			const do_set = {
				__proto__: data.__proto__,
				...map(data)(
					([key, val]) => [
						key,
						this.convert(val)
					])

			};
			proto_difference.set.call(this, do_set, silent);
		},

		convert (value) {
			return (value && typeof value.subscribe === `function`)
				? value
				: this.fn
					? write(this.fn(value))
					: write(value)
		},

		add (data, shh) {
			this.set(Object.assign(this.get(), data), shh);

			return this
		},

		// no stores only values
		write (data, shh) {
			const adds = {};

			each(data)(([key, value]) => {
				const values = this.get();

				const value_self = values[key];

				if (!value_self) {
					adds[key] = typeof value === `object` && value !== null && value.get ? value : write(value);
					return
				}

				value_self.set(value);
			});

			if (Object.keys(adds).length > 0) {
				this.add(adds, shh);
			}
		},

		// TODO: Allow multiple removes save on set calls
		remove (channel) {
			const $m = this.get();
			delete $m[channel];
			proto_difference.set.call(this, $m);
		},

		toJSON () {
			return store_JSON(this)
		}
	});

	const tree = (init = {}, fn = false) => {
		const m = extend(proto_tree, {
			...difference({}),
			fn
		});

		m.set(init);

		return m
	};

	const proto_transformer = extend(proto_write, {
		set (value) {
			proto_write.set.call(this, this.transform(value));
			return this
		}
	});

	const transformer = (transform) => extend(proto_transformer, {
		...write(),
		transform
	});

	const any = (...stores) => (fn) => {
		const values = stores.map((s) => s.get());
		const cancels = stores.map((store, i) => store.listen(($v, updates) => {
			values[i] = $v;
			fn(...values);
		}));

		return () => cancels.forEach((c) => c())
	};

	const TIME_TICK_RATE = write(100);

	const SPRITES = read(`/sheets/default_2.png`);

	const IS_DEV = read(window.location.host === `localhost:5000`);
	const SOUND_ON = write(true);

	const SVELTE_ANIMATION = write({ delay: 100, duration: 300 });

	const WEAVE_EXPLORE_OPEN = write(true);

	const OMNI_LAST = write(false);

	const INPUT_SCROLL_STRENGTH = write(10);
	const INPUT_ZOOM_STRENGTH = write(0.01);
	const INPUT_ZOOM_MIN = write(0.1);

	const TILE_COUNT = read(1024);
	const TILE_COLUMNS = read(32);

	const THEME_COLOR = write(`rgb(224, 168, 83)`);
	const THEME_BG = write(`#033`);
	const THEME_GLOW = write(`green`);
	const CLEAR_COLOR = write(`#023d55`);

	const CURSOR = write(`/sys`);

	const THEME_BORDER = read(``, (set) =>
		THEME_BG.listen(($THEME_BG) => set(Color($THEME_BG)
			.darkenByRatio(0.5)
			.toCSS()
		))
	);
	const THEME_STYLE = read(``, (set) => {
		let $THEME_BORDER = ``;

		const update = () => set([
			`border: 0.2rem solid ${$THEME_BORDER};`
		].join(``));

		THEME_BORDER.listen(($val) => {
			$THEME_BORDER = $val;
			update();
		});
	});

	var flag = /*#__PURE__*/Object.freeze({
		__proto__: null,
		TIME_TICK_RATE: TIME_TICK_RATE,
		SPRITES: SPRITES,
		IS_DEV: IS_DEV,
		SOUND_ON: SOUND_ON,
		SVELTE_ANIMATION: SVELTE_ANIMATION,
		WEAVE_EXPLORE_OPEN: WEAVE_EXPLORE_OPEN,
		OMNI_LAST: OMNI_LAST,
		INPUT_SCROLL_STRENGTH: INPUT_SCROLL_STRENGTH,
		INPUT_ZOOM_STRENGTH: INPUT_ZOOM_STRENGTH,
		INPUT_ZOOM_MIN: INPUT_ZOOM_MIN,
		TILE_COUNT: TILE_COUNT,
		TILE_COLUMNS: TILE_COLUMNS,
		THEME_COLOR: THEME_COLOR,
		THEME_BG: THEME_BG,
		THEME_GLOW: THEME_GLOW,
		CLEAR_COLOR: CLEAR_COLOR,
		CURSOR: CURSOR,
		THEME_BORDER: THEME_BORDER,
		THEME_STYLE: THEME_STYLE
	});

	const str_color = (str) => {
		if (!str) return `#111`

		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			hash = str.charCodeAt(i) + ((hash << 5) - hash);
		}

		let color = `#`;
		for (let i = 0; i < 3; i++) {
			const value = (hash >> (i * 8)) & 0xFF;
			color += (`00` + value.toString(16)).substr(-2);
		}
		return color
	};

	const color = str_color;

	// whiskers on kittens
	const words = [
		`groovy`, `cat`, `bird`, `dog`, `poop`, `cool`, `not`, `okay`, `great`, `terrible`, `wat`,
		`goblin`, `life`, `ferret`, `gregert`, `robert`, `zilla`, `red`, `shirt`, `pants`, `blue`,
		`luna`, `ember`, `embear`, `lunatic`, `boring`, `killa`, `notice`, `thank`, `tank`,
		`under`, `near`, `near`, `quaint`, `potato`, `egg`, `bacon`, `narwhal`, `lamp`, `stairs`, `king`,
		`tyrant`, `grave`, `dire`, `happy`, `amazing`, `terrific`, `terrible`, `good`, `boring`,
		`rip`, `hello`, `world`, `global`, `universal`, `television`, `computer`
	];

	const tile = (str) => {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			hash = str.charCodeAt(i) + ((hash << 5) - hash);
		}

		return `${Math.abs(hash) % TILE_COUNT.get()}`
	};

	const random = (count) => Array
		.from(new Array(count))
		.map(() => words[Math.floor(Math.random() * words.length)])
		.join(` `);

	const proto_warp = {
		get_space () {
			const id = this.id.get();
			let space_id;

			const finder = (spx) => {
				if (spx.indexOf(`/`) === -1) return

				space_id = spx.split(`/`)[0];
				return true
			};

			this.weave.chain(id).some(finder);
			if (space_id === undefined) {
				this.weave.chain(id, true).some(finder);
			}

			return this.weave.get_id(space_id)
		},

		listen (fn) {
			return this.value.listen(fn)
		},

		get () {
			return this.value.get()
		},

		set (val) {
			return this.value.set(val)
		},

		toJSON () {
			return {
				type: this.type.get(),
				value: this.value.toJSON()
			}
		}
	};

	var flock = extend({
		cancel () {
			const removes = [...this.birds];

			// basically anything that fucks with the weave you want to delay
			requestAnimationFrame(() => {
				this.weave.remove(...removes);
			});
		},

		rez () {
			const { value, space, weave } = this;
			this.birds = [];

			if (!space.get(`count`)) {
				space.write({ count: 1 }, true);
			}
			let last_bird = ``;
			let last_count = 0;

			this.value_cancel = any(value, space.get(`count`))(($value, $count) => {
				if (last_bird === $value && $count === last_count) return
				last_bird = $value;
				last_count = $count;
				this.cancel();
				const update = Object.fromEntries([...Array($count)].map(
					(_, i) => {
						return [`&${uuid()}`, {
							type: `space`,
							value: {
								"!clone": $value,
								"!leader": `~/${space.value.get(`!name`).get()}`,
								"!bird": i
							}
						}]
					}
				));

				// store bird ids for later deletion
				requestAnimationFrame(() => {
					this.birds = Object.values(weave.write_ids(update)).map((item) => item.id.get());
					this.weave.rez(...this.birds);
				});
			});
		},

		derez () {
			this.value_cancel();
			this.cancel();
		}
	});

	// a textual representation of a WEAVE chain

	const warps = {
		stream: (k) => JSON.stringify(k.value.get()),
		math: (k) => k.math.get().trim(),
		mail: (k) => k.whom.get().trim(),
		default: (k) => k.warp.get(),
		space: (k) => `./${k.value.get(`!name`)}`,
		sprite: (k) => `@${k.value.get()}`,
		color: (k) => `#${k.value.get()}`
	};

	const warps_is = {
		color: (data) => data[0] === `#`,
		sprite: (data) => data[0] === `@`,
		mail: (data) => {
			const ms = data.match(Wheel.REG_ID);
			if (!ms || ms.length !== 1) return false
			if (ms[0] !== data) return false
			return true
		},
		stream: (data) => {
			try {
				JSON.parse(data);
				return true
			} catch (ex) {
				return false
			}
		}
	};

	const warps_create = {
		math: (data) => ({
			type: `math`,
			math: data
		}),
		mail: (data) => ({
			type: `mail`,
			whom: data
		}),
		stream: (data) => ({
			type: `stream`,
			value: JSON.parse(data)
		}),
		color: (data) => ({
			type: `color`,
			value: data.slice(1)
		}),
		sprite: (data) => {
			let i = parseInt(data.slice(1));

			if (isNaN(i)) {
				i = 66;
			}

			return {
				type: `sprite`,
				value: i
			}
		}
	};

	const what_is = (data) => {
		const entries = Object.entries(warps_is);
		for (let i = 0; i < entries.length; i++) {
			const [type, fn] = entries[i];
			if (fn(data)) return type
		}

		return `math`
	};

	const warp_create = (data) => {
		const what = what_is(data);

		return warps_create[what](data)
	};

	const chain = (weave, address, right) => {
		if (right) {
			return weave.chain(address, true).slice(1)
		}
		return weave.chain(address).slice(0, -1)
	};

	const decompile = ({
		address,
		weave,
		right = false
	}) => {
		const c = chain(weave, address, right)
			.map((i) => translate(i, weave));

		if (right) {
			return c.reverse().join(` => `)
		}

		return c.join(` => `)
	};

	const translate = (id, weave) => {
		if (id[0] === `{`) return id

		const warp = weave.warps.get()[id];
		if (!warp) return `space`

		const type = warp.type.get();

		return warps[type]
			? warps[type](warp)
			: type
	};

	const compile = ({
		code,
		weave,
		address,
		prefix = ``,
		right = false
	}) => {
		let parts = code
			.replace(/[\r\n]/g, ``)
			.split(`=>`);

		if (!right) parts = parts.reverse();

		const wefts_update = weave.wefts.get();

		// remove old thread
		weave.remove(...chain(weave, address, right));

		const space = weave.get_id(address.split(`/`)[0]);

		let connection = address;

		// lets create these warps
		const ids = parts.map((part) => {
			part = part.trim();

			if (part === ``) return

			const w_data = warp_create(part);
			w_data.id = `${prefix}${uuid()}`;

			const k = weave.add(w_data);
			const id = k.id.get();

			if (right) {
				wefts_update[connection] = id;
			} else {
				wefts_update[id] = connection;
			}

			connection = id;

			return id
		});

		if (space.rezed) weave.rez(...ids);

		weave.wefts.set(
			wefts_update
		);

		return ids
	};

	const format = (txt) => {
		txt = txt.split(`;`);

		txt = txt
			.map((i, k) => {
				i = i.trim();
				if (k !== txt.length - 1) {
					i += `;`;
				}
				if (k === txt.length - 2) {
					i += `\r\n`;
				}
				return i
			})
			.join(`\r\n`);

		txt = txt
			.split(`=>`)
			.join(`\r\n\r\n=>`);

		return txt
	};

	const condense = (link, weave) => {
		const t = translate(link, weave).split(`;`);
		const v = t.pop().trim();

		return t.length > 0
			? `{${t.length}} ${v}`
			: v
	};

	var clone = extend({
		grab_script (other, key, right) {
			const weave_other = other.weave;
			const other_id = `${other.id.get()}/${key}`;
			const c_o = weave_other.chain(other_id, right).slice(0, -1);

			if (c_o.length === 0) return

			const { weave, id, space } = this;

			//  we got a chain to clone!
			const code = decompile({
				address: other_id,
				weave: weave_other
			});

			const address = `${id}/${key}`;
			const $value = weave_other.get_id(other.id.get())
				.value.get(key).get();

			// don't overwrite existing values
			if (!space.value.has(key)) 	{
				space.value.write({ [key]: $value });
			}

			// compile script later
			requestAnimationFrame(() => {
				this.scripts.push(...compile({
					code,
					weave,
					address,
					right,
					prefix: `&`
				}));
			});
		},

		rez () {
			const { space, weave, value, id } = this;
			this.scripts = this.scripts || [];

			this.cancel = value.listen(($value) => {
				this.weave.remove(...this.scripts);
				const other = Wheel.get(weave.resolve($value, id));

				if (!other) {
					console.warn(`Invalid other for clone`);
				}

				// allows to reset existing protos
				const proto = other
					? other.value.get()
					: {};

				keys(proto).forEach((key) => {
					this.grab_script(other, key);
					this.grab_script(other, key, true);
				});

				// set proto
				space.set({
					...space.get(),
					__proto__: proto
				}, true);
			});
		},

		derez () {
			this.cancel();

			// remove proto
			this.space.set({
				...this.space.get()
			}, true);

			// leave the scripts sadly
			this.weave.remove(...this.scripts);
		}

	});

	var leader = extend({
		rez () {
			// console.log(`leader`, this.space.id.get())

			this.cancel = this.value.listen((leader) => {
				const id = this.space.id.get();
				const $leader = Wheel.get(this.weave.resolve(leader, id));

				if (!$leader) {
					console.warn(`leader not found`);
					return
				}

				const vs = $leader.value.get();
				if (!vs[`!birds`]) {
					vs[`!birds`] = write(new Set([id]));
					$leader.value.set(vs);
					return
				}

				let birds = vs[`!birds`].get();
				if (!birds.add && !Array.isArray(birds)) birds = new Set();
				if (Array.isArray(birds)) birds = new Set(birds);

				if (birds.has(id)) return

				birds.add(id);
				vs[`!birds`].set([...birds]);
			});
		},

		derez () {
			const id = this.space.id.get();

			this.cancel();
			const $leader = Wheel.get(this.weave.resolve(this.value.get(), id));
			if (!$leader) {
				console.warn(`no leader`);
				return
			}

			const vs = $leader.value.get();
			if (!vs) {
				console.warn(`no leader value`);
				return
			}
			let birds = vs[`!birds`].get();

			if (!birds.add && !Array.isArray(birds)) birds = new Set();
			if (Array.isArray(birds)) birds = new Set(birds);
			birds.delete(id);

			vs[`!birds`].set([...birds]);
		}
	});

	var name = extend({
		create () {
			this.cancel = this.value.listen(($name) => {
				const $names = this.weave.names.get();
				if (this.name_last) {
					if (this.name_last === $name) return

					delete $names[this.name_last];
				}

				$names[$name] = this.space;
				this.name_last = $name;
				this.weave.names.set($names);
			});
		},

		destroy () {
			this.cancel();

			this.weave.names.update(($ns) => {
				delete $ns[this.name_last];
				return $ns
			});
		}
	});

	var birds = extend({
		create () {
			requestAnimationFrame(() => {
				// always set the value to nothing to start
				this.value.set([]);
			});
		}
	});

	let tick_set;
	const tick = read(0, (set) => {
		tick_set = set;
	});

	let last_tick = Date.now();

	const frame = read([0, 0], (set) => {
		let old;
		const data = [0, 0];
		const frame_t = (ts) => {
			requestAnimationFrame(frame_t);

			if (old === undefined) old = ts;

			data[0] = ts;
			data[1] = Math.round(ts - old);

			old = ts;
			const now = Date.now();
			if (now - last_tick >= TIME_TICK_RATE.get()) {
				last_tick = now;
				tick_set(tick.get() + 1);
			}

			set(data);
		};

		requestAnimationFrame(frame_t);
	});

	var time = /*#__PURE__*/Object.freeze({
		__proto__: null,
		tick: tick,
		frame: frame
	});

	// in charge of communicating/spawning the physics worker

	const physics = new Worker(`/bin/physics.bundle.js`);

	const bodies = write({});

	const ask = () => requestAnimationFrame(() => {
		const msg = map(bodies.get())(([key, body]) => {
			const $body = body.get();
			// this should be the buff data too
			// TODO: Unify this shit
			return [
				key,
				{
					id: key,
					position: def($body.position, [0, 0, 0]),
					"!velocity": ($body[`!velocity`] && Array.isArray($body[`!velocity`].get()))
						? $body[`!velocity`].get().map((i) => i === null ? 0 : i)
						: [0, 0, 0],
					scale: def($body.scale, 1),
					"!real": def($body[`!real`], false),
					"!name": def($body[`!name`], `id-${key}`),
					mass: def($body.mass, 1),
					"!force": def($body[`!force`], undefined)
				}
			]
		});

		physics.postMessage({
			type: `solve`,
			data: msg
		});
	});

	let snap = () => { ask(); };

	physics.onmessage = ({ data }) => {
		snap = () => {
			const $bodies = bodies.get();

			each(data.bodies)(([
				id,
				update
			]) => {
				const body = $bodies[id];
				if (!body) return

				body.write(update);
			});

			ask();
		};
	};

	const add = (...spaces) => {
		const $bodies = bodies.get();
		spaces.forEach((space) => {
			$bodies[space.id.get()] = space.value;
		});

		bodies.set($bodies, true);
	};

	const remove = (...spaces) => {
		const $bodies = bodies.get();
		spaces.forEach((space) => {
			delete $bodies[space.id.get()];
		});

		bodies.set($bodies, true);
	};

	const def = (store, or_this) => store ? store.get() : or_this;

	tick.listen(() => {
		snap();
	});

	var physical = extend({
		// add the physics system
		rez () {
			add(this.space);
		},

		derez () {
			remove(this.space);
		}
	});

	var collide = extend({
		create () {
			this.value.set(undefined, true);
			this.cancel = this.value.listen(() => {
				// don't ever ever save this

			});
		}
	});

	const visible = {
		value: {},
		get () {
			return visible.value
		},

		add: [],
		update: {},
		remove: [],

		hey () {
			const { add, update, remove } = visible;

			visible.add = [];
			visible.update = {};
			visible.remove = [];

			return { add, update, remove }
		}
	};

	const deep_listen = (space) => {
		const cancels = {};

		const id = space.id.get();

		const cancel = space.value.listen(($sv, { add, remove }) => {
			add.forEach((key) => {
				cancels[key] = $sv[key].listen(($value) => {
					if (!visible.update[id]) visible.update[id] = {};
					visible.update[id][key] = $value;
				});
			});

			remove.forEach((key) => {
				// got removed before a hey
				if (visible.update[id] && visible.update[id][key] !== undefined) delete visible.update[id][key];

				cancels[key]();
				delete cancels[key];
			});
		});

		return () => {
			cancel();
			values(cancels).forEach((canceler) => canceler());
		}
	};

	var visible$1 = extend({
		rez () {
			const id = this.space.id.get();
			visible.value[id] = this.space;
			visible.add.push(id);

			this.cancel = deep_listen(this.space);
		},

		derez () {
			this.cancel();
			const id = this.space.id.get();
			delete visible.value[id];
			visible.remove.push(id);
		}
	});

	var sound = extend({
		play () {
			this.clip = scribble.clip({
				synth: `PolySynth`,
				pattern: `[xx][xR]`.repeat(4),
				notes: scribble.arp({
					chords: `Dm BbM Am FM BbM FM CM Gm`,
					count: 8,
					order: 1022
				}),
				accent: `x-xx--xx`
			});

			this.clip.start();
			Tone.Transport.start();
		},

		stop () {
			if (this.clip) this.clip.stop();
		},

		rez () {
			let first = false;
			this.cancel = this.value.listen(($song) => {
				if (!first) {
					first = true;
					return
				}
				// construct $sound from data and then play it
				this.stop();
				this.play();
			});
		},

		derez () {
			this.cancel();
		}
	});

	var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

	function createCommonjsModule(fn, module) {
		return module = { exports: {} }, fn(module, module.exports), module.exports;
	}

	var FileSaver_min = createCommonjsModule(function (module, exports) {
	(function(a,b){b();})(commonjsGlobal,function(){function b(a,b){return "undefined"==typeof b?b={autoBom:!1}:"object"!=typeof b&&(console.warn("Deprecated: Expected third argument to be a object"),b={autoBom:!b}),b.autoBom&&/^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(a.type)?new Blob(["\uFEFF",a],{type:a.type}):a}function c(b,c,d){var e=new XMLHttpRequest;e.open("GET",b),e.responseType="blob",e.onload=function(){a(e.response,c,d);},e.onerror=function(){console.error("could not download file");},e.send();}function d(a){var b=new XMLHttpRequest;b.open("HEAD",a,!1);try{b.send();}catch(a){}return 200<=b.status&&299>=b.status}function e(a){try{a.dispatchEvent(new MouseEvent("click"));}catch(c){var b=document.createEvent("MouseEvents");b.initMouseEvent("click",!0,!0,window,0,0,0,80,20,!1,!1,!1,!1,0,null),a.dispatchEvent(b);}}var f="object"==typeof window&&window.window===window?window:"object"==typeof self&&self.self===self?self:"object"==typeof commonjsGlobal&&commonjsGlobal.global===commonjsGlobal?commonjsGlobal:void 0,a=f.saveAs||("object"!=typeof window||window!==f?function(){}:"download"in HTMLAnchorElement.prototype?function(b,g,h){var i=f.URL||f.webkitURL,j=document.createElement("a");g=g||b.name||"download",j.download=g,j.rel="noopener","string"==typeof b?(j.href=b,j.origin===location.origin?e(j):d(j.href)?c(b,g,h):e(j,j.target="_blank")):(j.href=i.createObjectURL(b),setTimeout(function(){i.revokeObjectURL(j.href);},4E4),setTimeout(function(){e(j);},0));}:"msSaveOrOpenBlob"in navigator?function(f,g,h){if(g=g||f.name||"download","string"!=typeof f)navigator.msSaveOrOpenBlob(b(f,h),g);else if(d(f))c(f,g,h);else{var i=document.createElement("a");i.href=f,i.target="_blank",setTimeout(function(){e(i);});}}:function(a,b,d,e){if(e=e||open("","_blank"),e&&(e.document.title=e.document.body.innerText="downloading..."),"string"==typeof a)return c(a,b,d);var g="application/octet-stream"===a.type,h=/constructor/i.test(f.HTMLElement)||f.safari,i=/CriOS\/[\d]+/.test(navigator.userAgent);if((i||g&&h)&&"object"==typeof FileReader){var j=new FileReader;j.onloadend=function(){var a=j.result;a=i?a:a.replace(/^data:[^;]*;/,"data:attachment/file;"),e?e.location.href=a:location=a,e=null;},j.readAsDataURL(a);}else{var k=f.URL||f.webkitURL,l=k.createObjectURL(a);e?e.location=l:location.href=l,e=null,setTimeout(function(){k.revokeObjectURL(l);},4E4);}});f.saveAs=a.saveAs=a,(module.exports=a);});

	//# sourceMappingURL=FileSaver.min.js.map
	});

	const SIZE = 16;
	const SPACING = 0;
	const COLUMNS = TILE_COLUMNS.get();
	const COUNT = TILE_COUNT.get();

	const ready = new Promise((resolve) => {
		const tiles = new Image();
		tiles.src = `/sheets/default_2.png`;

		tiles.onload = () => {
			const canvas = document.createElement(`canvas`);
			canvas.width = tiles.width;
			canvas.height = tiles.height;

			const ctx = canvas.getContext(`2d`);
			ctx.drawImage(tiles, 0, 0);

			resolve({ ctx, canvas });
		};
	});

	const repo = new Map();

	const num_random = (min, max) =>
		Math.floor(Math.random() * (Math.abs(min) + Math.abs(max)) - Math.abs(min));

	var Tile = async ({
		width,
		height,
		data,
		random = false
	}) => {
		const { canvas } = await ready;

		const key = `${width}:${height}:${data}`;

		if (!random && repo.has(key)) {
			return repo.get(key)
		}

		const data_canvas = document.createElement(`canvas`);
		const data_ctx = data_canvas.getContext(`2d`);

		data_canvas.width = SIZE * width;
		data_canvas.height = SIZE * height;

		if (random) {
			let t_x, t_y;
			let s_x, s_y;

			for (let x = 0; x < width; x++) {
				for (let y = 0; y < height; y++) {
					t_x = x * SIZE;
					t_y = y * SIZE;

					s_x = num_random(0, COLUMNS) * (SIZE + SPACING);
					s_y = num_random(0, COUNT / COLUMNS) * (SIZE + SPACING);

					data_ctx.drawImage(
						canvas,
						s_x, s_y, SIZE, SIZE,
						t_x, t_y, SIZE, SIZE
					);
				}
			}
		} else if (data.length > 0) {
			let x, y;
			data.split(` `).forEach((loc, i) => {
				x = i % width;
				y = Math.floor(i / width);

				const idx = parseInt(loc, 10);
				const o_x = idx % COLUMNS;
				const o_y = Math.floor(idx / COLUMNS);

				const t_x = x * SIZE;
				const t_y = y * SIZE;

				const s_x = o_x * (SIZE + SPACING);
				const s_y = o_y * (SIZE + SPACING);

				data_ctx.drawImage(
					canvas,
					s_x, s_y, SIZE, SIZE,
					t_x, t_y, SIZE, SIZE
				);
			});
		}

		const result = data_canvas.toDataURL(`image/png`);
		if (!random) {
			repo.set(key, result);
		}

		return result
	};

	const load = (img) => {
		try {
			const r = exif.load(img);
			return JSON.parse(r[`0th`][exif.ImageIFD.Make])
		} catch (ex) {
			return false
		}
	};

	const saved = write(false);
	const save = async (weave) => {
		const obj = {
			"0th": {
				[exif.ImageIFD.Make]: JSON.stringify(weave),
				[exif.ImageIFD.Software]: `isekai`
			},
			Exif: {},
			GPS: {}
		};

		FileSaver_min.saveAs(exif.insert(exif.dump(obj), await image(weave.name.get())), `${weave.name.get()}.jpg`);
		saved.set(weave.name);
	};

	const img_load = (data) => new Promise(async (resolve) => {
		const image = new Image();
		image.src = await Tile(data);
		image.onload = () => resolve(image);
	});

	const garden = img_load({
		width: 4,
		height: 4,
		data: [
			`18 19 19 20`,
			`50 0 0 52`,
			`50 0 0 52`,
			`82 83 83 84`
		].join(` `)
	});

	const image = async (name) => {
		const tn = tile(`/${name}`);

		const img_tile = img_load({
			width: 1,
			height: 1,
			data: tn
		});

		const canvas = document.createElement(`canvas`);
		canvas.width = 64;
		canvas.height = 64;

		const ctx = canvas.getContext(`2d`);
		ctx.imageSmoothingEnabled = false;
		ctx.filter = `sepia(1) hue-rotate(90deg)`;

		ctx.drawImage(await garden, 0, 0, 64, 64, 0, 0, 64, 64);
		ctx.drawImage(await img_tile, 0, 0, 16, 16, 16, 16, 32, 32);

		return canvas.toDataURL(`image/jpeg`, 0.95)
	};

	const github = async ($path, {
		autorun = false
	} = false) => {
		const url = `https://raw.githubusercontent.com/${$path[0]}/${$path[1]}/master/${$path[2]}.jpg`;

		const reader = new FileReader();
		const blob = await fetch(url)
			.then((r) => r.blob());

		reader.readAsDataURL(blob);

		return new Promise((resolve, reject) => {
			reader.addEventListener(`load`, () => {
				const data = load(reader.result);
				if (!data) return reject(new Error(404))

				Wheel.spawn({
					[data.name]: data
				});

				const w = Wheel.get(data.name);

				w.write({
					"!info": {
						type: `space`,
						value: {
							from: $path.join(`/`),
							url: `https://github.com/${$path[0]}/${$path[1]}/blob/master/${$path[2]}.jpg`
						}
					}
				});

				if (autorun) {
					Wheel.start(data.name);
				}

				resolve(data.name);
			});
		})
	};

	var need = extend({
		create () {
			// give it a raf for the rest to calm down
			requestAnimationFrame(() => {
				this.cancel = this.value.listen(($value) => {
					$value = Array.isArray($value)
						? $value
						: [$value];

					$value.forEach((item) => {
						if (typeof item !== `string`) return
						const components = item.split(`/`);
						// if the dep is already loaded don't bother
						if (Wheel.get(components[components.length - 1])) return
						github(components);
					});
				});
			});
		},

		destroy () {
			this.cancel && this.cancel();
		}
	});



	var twists = /*#__PURE__*/Object.freeze({
		__proto__: null,
		flock: flock,
		clone: clone,
		leader: leader,
		name: name,
		birds: birds,
		velocity: physical,
		real: physical,
		collide: collide,
		visible: visible$1,
		force: physical,
		sound: sound,
		need: need
	});

	const string_nothing = read(``);

	const type = read(`space`);

	const proto_space = extend(proto_warp, {
		address () {
			return `${this.weave.name.get()}/${this.name().get() || this.id.get()}`
		},

		name () {
			return this.value.get(`!name`) || string_nothing
		},

		create () {
			const id = this.id.get();
			this.twists = {};

			this.cancel = this.value.listen(($value, { add, remove }) => {
				assign(this.twists)(
					add.reduce((result, key) => {
						// ignore !
						const Twist = twists[key.slice(1)];
						if (Twist === undefined) return result

						const twist = Twist({
							weave: this.weave,
							value: $value[key],
							space: this,
							id: this.id.get()
						});

						twist.create && twist.create();

						if (this.rezed && twist.rez) {
							// delay
							requestAnimationFrame(() => twist.rez());
						}

						result[key] = twist;

						return result
					}, {})
				);

				remove.forEach((key) => {
					const twist = this.twists[key];
					this.weave.remove(...this.weave.chain(`${id}/${key}`).slice(0, -1));
					this.weave.remove(...this.weave.chain(`${id}/${key}`, true).slice(0, -1));

					if (!twist) return

					if (this.rezed && twist.derez) twist.derez();
					twist.destroy && twist.destroy();

					delete this.twists[key];
				});
			});
		},

		remove (...keys) {
			const $space = this.value.get();
			keys.forEach((key) => {
				delete $space[key];
			});
			this.value.set($space);
		},

		destroy () {
			this.cancel();

			each(this.twists)(([_, twist]) => {
				if (this.rezed && twist.derez) twist.derez();
				twist.destroy && twist.destroy();
			});

			this.twists = {};
		},

		rez () {
			this.rezed = true;

			each(this.twists)(([_, twist]) => {
				twist.rez && twist.rez();
			});
		},

		derez () {
			this.rezed = false;

			each(this.twists)(([_, twist]) => {
				twist.derez && twist.derez();
			});
		},

		chain () {
			const values = this.value.get();
			const id = this.id.get();

			return keys(values).reduce((result, key) => {
				result.push(
					...this.weave.chain(`${id}/${key}`).slice(0, -1),
					...this.weave.chain(`${id}/${key}`, true).slice(1)
				);
				return result
			}, [])
		},

		get (key) {
			return this.value.get(key)
		},

		gets (...keys) {
			return keys.reduce((result, key) => {
				result[key] = this.get(key);
				return result
			}, {})
		},

		get_value (key) {
			const v = this.value.get(key);

			if (!v) return
			return v.get()
		},

		get_values (...keys) {
			return keys.reduce((result, key) => {
				result[key] = this.get_value(key);
				return result
			}, {})
		},

		write (update, shh) {
			return this.value.write(update, shh)
		}
	});

	var space = ({
		id,
		value = {},
		weave
	}) => extend(proto_space, {
		type,
		value: tree(value),
		id: read(id),
		weave
	});

	const json = (v) => {
		if (typeof v !== `string`) return v

		if (v.indexOf(`.`) === -1 && v.indexOf(`,`) === -1) {
			const n = parseInt(v);
			if (typeof n === `number` && !isNaN(n)) {
				return n
			}
		}

		return JSON.parse(v)
	};

	const type$1 = read(`stream`);

	const proto_stream = extend(proto_write, {
		set (val) {
			try {
				proto_write.set.call(this, json(val));
			} catch (ex) {
				proto_write.set.call(this, val);
			}

			return this
		}
	});

	var stream = ({
		id,
		value = null
	}) => extend(proto_warp, {
		type: type$1,
		value: extend(proto_stream, write()).set(value),
		id: read(id)
	});

	const type$2 = read(`sprite`);

	var sprite = ({
		value = 0,
		id
	}) => extend(proto_warp, {
		type: type$2,
		value: write(value),
		id: read(id)
	});

	const update_color = (val_n) => {
		const c = Color(val_n);
		if (c.red === undefined) return 0xFFFFFF

		return c.red + c.green * 255 + c.blue * 255
	};

	const type$3 = read(`color`);

	var color$1 = ({
		value = `#FFFFFF`,
		id
	}) => extend(proto_warp, {
		type: type$3,
		value: transformer(update_color).set(value),
		id: read(id)
	});

	twgl.v3.setDefaultType(Array);

	const maths = {};

	const parser = new expr.Parser({
		in: true,
		assignment: true
	});

	Object.entries(twgl.v3).forEach(([key, fn]) => {
		parser.functions[`v3_${key}`] = function (...args) {
			return fn(...args)
		};
	});

	Object.entries(twgl.m4).forEach(([key, fn]) => {
		parser.functions[`m4_${key}`] = function (...args) {
			return fn(...args)
		};
	});

	parser.functions.Color = Color;

	const math = (formula) => {
		let p = maths[formula];

		if (!p) {
			p = parser.parse(formula);
			maths[formula] = p;
		}

		return (variables) => {
			try {
				p.evaluate(variables);
			} catch (er) {
				console.warn(`Math script error`, er);
			}
			return variables.return
		}
	};

	const noop = () => {};

	const bad_variable_characters = /[ .~%!&/^]/g;

	// for creating searches
	const regexcape = /[.*+?^${}()|[\]\\]/g;

	const path_space = /\.\//g;
	const path_weave = /~\//g;
	const path_ssh = /\$/g;

	const escape = (str) =>
		str.replace(regexcape, `\\$&`); // $& means the whole matched string

	const type$4 = read(`math`);

	const proto_math = extend(proto_warp, {
		run (expression) {
			const matches = expression.match(Wheel.REG_ID);
			const vs = {};

			const leaf = this.weave.chain(this.id.get(), true).shift();
			let space_addr = this.weave.to_address(leaf);

			// nad address
			if (!space_addr) return

			const space = Wheel.get(space_addr);

			if (space.type.get() !== `space`) {
				const leaf_right = this.weave.chain(this.id.get()).shift();
				space_addr = this.weave.to_address(leaf_right);
			}

			new Set(matches).forEach((item) => {
				const shh = item[0] === `$`;
				const gette = item
					.replace(path_space, `${space_addr}/`)
					.replace(path_weave, `/${this.weave.name.get()}/`)
					.replace(path_ssh, ``)
					.trim();

				const warp = Wheel.get(gette);

				// not an id or invalid
				if (!warp) return

				const name = item
					.replace(path_space, `dot`)
					.replace(path_weave, `weave`)
					.replace(bad_variable_characters, `z`);

				expression = expression.replace(
					new RegExp(escape(item), `g`),
					name
				);

				vs[name] = {
					warp,
					shh
				};
			});

			try {
				this.fn = math(expression);

				this.values.set(vs);
			} catch (ex) {
				// TODO: Alert user of math error here
				// console.warn(`MATH`, ex)
			}
		},

		rez () {
			this.run(this.math.get());
			this.cancels = new Set();

			this.cancel_vs = this.values.listen((vs) => {
				this.cancels.forEach((cancel) => cancel());
				this.cancels.clear();

				Object.entries(vs).forEach(([key, { warp, shh }]) => {
					if (shh) return

					this.cancels.add(warp.listen(() => {
						this.value.set(this.value.last);
					}));
				});
			});	// do latter once setup
		},

		derez () {
			this.cancel_vs();
			this.cancels.forEach((cancel) => cancel());
		},

		toJSON () {
			return {
				type: this.type.get(),
				value: null,
				math: this.math.get()
			}
		}
	});

	const proto_math_value = extend(proto_write, {
		set (expression, silent) {
			proto_write.set.call(this, expression, silent);
			if (!silent) this.warp.run(expression);
		}
	});

	const proto_value = extend(proto_write, {
		set (value, silent) {
			this.last = value;

			const vs = this.warp.values.get();
			value = value === undefined
				? null
				: value;

			// could be faster
			const params = {
				...Object.fromEntries(Object.entries(vs).map(
					([key, { warp }]) => [key, warp.toJSON() === undefined
						? null
						: warp.toJSON()
					]
				)),
				value
			};

			params.null = null;
			params.delay = false;

			const result = this.warp.fn(params);

			Object.entries(vs).forEach(([key, { warp }]) => {
				const original = warp.toJSON();
				const value = params[key];

				if (
					Array.isArray(original) &&
					Array.isArray(value) &&
					original.some((x, i) => x !== value[key]) === false
				) return

				if (original === value) return
				vs[key].warp.value.set(value);
			});

			// null or undefined means do nothing
			if (result === null || result === undefined) return
			if (params.delay) {
				requestAnimationFrame(() => {
					proto_write.set.call(this, result);
				});

				return this
			}

			proto_write.set.call(this, result, silent);

			return this
		}
	});

	var math$1 = ({
		math = `2+2`,
		value,
		weave,
		id
	} = false) => {
		const m = extend(proto_math, {
			type: type$4,
			values: write({}),
			id: read(id),
			weave,
			fn: noop
		});

		m.value = extend(proto_value, {
			...write(value),
			warp: m
		});

		m.math = extend(proto_math_value, {
			...write(math),
			warp: m
		});

		requestAnimationFrame(() => m.math.set(math, true));

		return m
	};

	const type$5 = read(`mail`);

	const proto_mail = extend(proto_warp, {
		fix (address) {
			const space = this.get_space();

			return address
				.replace(`$`, ``)
				.replace(`~`, `/${this.weave.name.get()}`)
				.replace(`.`, `${this.weave.name.get()}/${space ? space.get_value(`!name`) : `not connected`}`)
		},

		clear () {
			this.cancels.forEach((fn) => fn());
			this.cancels.clear();
		},

		derez () {
			this.cancel_whom();
			this.clear();
		},

		rez () {
			this.cancels = new Set();

			this.cancel_whom = this.whom.listen(($whom) => {
				this.clear();
				const fixed = this.fix($whom);
				const thing = Wheel.get(fixed);

				if ($whom[0] === `$`) {
					if (!thing) return this.set(null)

					this.set(thing.get());
					return
				}

				if (!thing) return

				const remote = thing.type
					? thing.value
					: thing;

				this.cancels.add(remote.listen(($remote) => {
					this.set($remote);
				}));
			});
		},

		toJSON () {
			return {
				type: this.type.get(),
				value: this.value.get(),
				whom: this.whom.get()
			}
		},

		set (value) {
			proto_write.set.call(this.value, value);
		}
	});

	const proto_remote = extend(proto_write, {
		set (value, shh) {
			const $whom = this.mail.fix(this.mail.whom.get());

			const v = Wheel.get($whom);

			if (!v || !v.set) {
				return
			}

			v.set(value);
			proto_write.set.call(this, value, shh);
		}
	});

	// instead use the weave messaging channel
	var mail = ({
		whom = `/sys/mouse/position`,
		weave,
		id
	}) => {
		const mail = extend(proto_mail, {
			type: type$5,
			whom: write(whom),
			id: read(id),
			weave
		});

		mail.value = extend(proto_remote, {
			...write(),
			mail
		});

		return mail
	};



	var warps$1 = /*#__PURE__*/Object.freeze({
		__proto__: null,
		space: space,
		stream: stream,
		sprite: sprite,
		color: color$1,
		math: math$1,
		mail: mail
	});

	// the basic warp
	var Warp = ({
		id = uuid(),
		type,
		knot,
		...rest
	} = false) => {
		// TODO: Remove allows for conversion of old warps
		if (!type && knot) type = knot;

		// TODO: Allows conversion from stitch to space
		if (type === `stitch`) {
			type = `space`;
			rest.value = rest.value || {};
			rest.value[`!name`] = rest.name;
		}

		const factory = warps$1[type];

		if (!factory) {
			console.warn(`Invalid warp ${type}`);
			return false
		}

		return warps$1[type]({
			...rest,
			id
		})
	};

	const proto_weave = {
		is_rezed () {
			return Wheel.running.get()[this.name.get()] !== undefined
		},

		add (properties) {
			properties.id = properties.id || uuid();

			const k = this.make(properties);

			if (!k) return

			this.warps.update(($warps) => {
				$warps[k.id.get()] = k;
				return $warps
			});

			// allows other work to be done first
			if (k.create) k.create();

			return k
		},

		remove_unnamed () {
			const warps = this.warps.get();

			const removes = [];
			Object.keys(warps).forEach((id) => {
				if (id[0] !== `&`) return
				removes.push(id);
			});

			this.remove(...removes);

			return removes.length
		},

		remove_name (name) {
			const k = this.get_name(name);
			if (!k) return

			const id = k.id.get();
			return this.remove(id)
		},

		remove (...ids) {
			this.warps.update(($warps) => {
				let dirty;

				const $rezed = this.rezed.get();
				const rz_self = this.is_rezed();
				const $wefts = this.wefts.get();

				let dirty_wefts = false;

				ids.forEach((id) => {
					if ($wefts[id]) {
						dirty_wefts = true;
						delete $wefts[id];
					}

					const k = $warps[id];
					if (!k) return

					if (rz_self && $rezed[id]) {
						dirty = true;
						delete $rezed[id];
						k.derez && k.derez();
					}

					k.destroy && k.destroy();

					delete $warps[id];
				});

				if (dirty) {
					this.rezed.set($rezed, true);
				}

				if (dirty_wefts) {
					this.wefts.set($wefts);
				}

				return $warps
			});
		},

		write_ids (structure) {
			const $warps = this.warps.get();

			return map(structure)(([key, data]) => {
				const k = $warps[key];

				if (!k) {
					data.value = data.value || {};
					data.id = key;
					const warp = this.add(data);
					if (!warp) return [key, false]

					return [key, warp]
				}

				each(data)(([key_sub, data_sub]) => {
					const warp = k[key_sub];
					if (key_sub === `value`) {
						warp.set(Object.assign(warp.get(),
							data_sub
						));

						return
					}

					if (warp.set) warp.set(data_sub);
				});

				return [key, k]
			})
		},

		write (structure) {
			const $names = this.names.get();

			return map(structure)(([key, data]) => {
				const k = $names[key];

				if (!k) {
					data.value = data.value || {};
					data.value[`!name`] = data.value[`!name`] || key;

					const warp = this.add(data);
					if (!warp) return [key, false]

					return [key, warp]
				}

				each(data)(([key_sub, data_sub]) => {
					const warp = k[key_sub];
					if (key_sub === `value`) {
						warp.set(Object.assign(warp.get(),
							data_sub
						));

						return
					}

					if (warp.set) warp.set(data_sub);
				});

				return [key, k]
			})
		},

		exists (address) {
			const [warp, weft] = address.split(`/`);

			const k = this.warps.get()[warp];

			if (!k) return false
			if (weft === undefined) return true

			return k.value.get()[weft] !== undefined
		},

		validate () {
			let dirty = false;

			const wefts = this.wefts.get();
			const warps = this.warps.get();

			const deletes = [];

			each(warps)(([_, k]) => {
				if (k.type.get() === `space`) return

				const chain = this.chain(k.id.get(), true);
				const last = chain[chain.length - 1].split(`/`)[0];
				const first = chain[0].split(`/`)[0];
				const k_last = warps[last];
				const k_first = warps[first];

				if (
					(k_last && k_last.type.get() === `space`) ||
	                    (k_first && k_first.type.get() === `space`)
				) return

				deletes.push(k.id.get());
			});

			if (deletes.length > 0) {
				// console.warn(`Deleted ${deletes.length} orphans on validation.`)
				this.remove(...deletes);
			}

			each(wefts)(([r, w]) => {
				if (this.exists(r) && this.exists(w)) return

				dirty = true;
				delete (wefts[r]);
			});

			if (!dirty) return deletes.length

			this.wefts.set(wefts);

			return deletes.length
		},

		chain (address, right = false) {
			const other = right
				? this.wefts.get()[address]
				: this.wefts_r.get()[address];

			if (!other) return [address]
			return [...this.chain(other, right), address]
		},

		to_address (id_path) {
			const [warp] = id_path.split(`/`);

			const space = this.get_id(warp);
			if (!space) return

			return `/${this.name.get()}/${space.id.get()}`
		},

		get_name (name) {
			const $ns = this.names.get();

			return $ns[name]
		},

		get_id (id) {
			if (!id) return

			const [k_id, chan_name] = id.split(`/`);
			const k = this.warps.get()[k_id];

			if (!chan_name) return k
			if (!k) return

			const v = k.value.get();
			if (!v || !v[chan_name]) return

			// warp style of a channel
			return {
				value: v[chan_name]
			}
		},

		make (properties) {
			return Warp({
				...properties,
				weave: this
			})
		},

		resolve (addr, id) {
			return addr
				.replace(`.`, this.to_address(this.chain(id, true).shift()))
				.replace(`~`, this.name.get())
		},

		derez (...ids) {
			const $rezed = this.rezed.get();
			const $warps = this.warps.get();

			ids.forEach((id) => {
				const warp = $warps[id];
				if (warp && warp.type.get() === `space`) {
					this.derez(...$warps[id].chain());
				}
				delete $rezed[id];
			});

			this.rezed.set($rezed);
		},

		rez (...ids) {
			const $rezed = this.rezed.get();
			const $warps = this.warps.get();

			ids.forEach((id) => {
				const warp = $warps[id];
				// prevent bad rezes
				if (!warp) return

				if (warp.type.get() === `space`) {
					this.rez(...warp.chain());
				}

				$rezed[id] = true;
			});

			this.rezed.set($rezed);
		},

		destroy () {
			this.destroys.forEach((fn) => fn());
		},

		toJSON () {
			return {
				id: this.id.toJSON(),
				name: this.name.toJSON(),
				wefts: this.wefts.toJSON(),
				warps: store_JSON(this.warps),
				rezed: this.rezed.toJSON()
			}
		}
	};

	// Weave of warps connected together with wefts
	var Weave = ({
		name = random(2),
		id = uuid(),
		warps = {},
		wefts = {},
		rezed = {},

		// TODO: remove conversions
		knots,
		threads
	} = false) => {
		if (knots) warps = knots;
		if (threads) wefts = threads;

		const weave = extend(proto_weave, {
			// saved
			id: read(id),
			name: write(name),
			wefts: difference(wefts),
			rezed: difference(rezed),

			// not saved
			names: write({}),
			destroys: []
		});

		const ks = reduce(warps)((res, [warp_id, val]) => {
			if (val.id !== warp_id) {
				val.id = warp_id;
			}

			// wait for them all to be made
			const warp = weave.make(val);
			if (!warp) return res

			res[warp_id] = warp;

			return res
		}, {});

		each(ks)(([_, warp]) => warp.create && warp.create());
		// saved
		weave.warps = write(ks);

		// not saved
		weave.wefts_r = read({}, (set) => {
			const value = {};
			// destroy this on weave destroy
			weave.destroys.push(weave.wefts.listen(($wefts, {
				add,
				remove,
				modify,
				previous
			}) => {
				remove.forEach((key) => {
					delete value[previous[key]];
				});

				add.forEach((key) => {
					value[$wefts[key]] = key;
				});

				// modify doesn't always get triggered
				modify.forEach((key) => {
					value[$wefts[key]] = key;
				});

				set(value);
			}));
		});

		return weave
	};

	const SYSTEM = `sys`;

	// weaves [name]weave
	const weaves = write({
		[SYSTEM]: Weave({
			name: SYSTEM,
			id: SYSTEM
		})
	});

	const highways = new Map();

	let running_set;

	// run the system weave by default (safe idle)
	const running = read({
		[SYSTEM]: true
	}, (set) => { running_set = set; });

	const trash = write();

	const addr = (address) => {
		let path = address.split(`/`);
		if (path[0] === ``) path = path.slice(1);
		return path
	};

	// Delete Weaves
	const del = (keys) => {
		const $running = running.get();
		const $weaves = weaves.get();

		let dirty = false;

		keys.forEach((key) => {
			if (key === SYSTEM) return

			if ($running[key]) {
				stop(key);
			}

			if ($weaves[key]) {
				dirty = true;
				$weaves[key].destroy();
				trash.set(
					$weaves[key]
				);

				delete $weaves[key];
			}
		});

		if (dirty) weaves.set($weaves);
	};

	// name of the current wheel, path watches
	const name$1 = write(``);

	const get = (address) => {
		const [
			weave_name,
			warp_name,
			chan
		] = addr(address);

		const w = weaves.get()[weave_name];

		if (w === undefined) return
		if (warp_name === undefined) return w

		let warp = w.names.get()[warp_name];

		if (warp === undefined) {
			warp = w.warps.get()[warp_name];
			if (!warp) return
		}

		if (chan === undefined) return warp
		const value = warp.value.get();
		if (!value) return

		const c = value[chan];
		if (c === undefined) return

		return c
	};

	const exists = (address) => get(address) !== undefined;

	// create the whole path if you gotta
	const spawn = (pattern = {}) => map(pattern)(([
		weave_id,
		weave_data
	]) => {
		if (weave_id === SYSTEM) {
			console.warn(`tried to spawn ${SYSTEM}`);
			return [weave_id, get(weave_id)]
		}

		const ws = weaves.get();
		const w = Weave({
			...weave_data,
			name: weave_id
		});

		ws[weave_id] = w;

		weaves.set(ws);
		return [weave_id, w]
	});

	const start_wefts = (weave) => {
		const weft_cancels = {};

		const cancel = weave.wefts.listen((wefts, {
			add,
			remove,
			modify
		}) => {
			let dirty;

			[...add, ...modify].forEach((reader) => {
				const writer = wefts[reader];
				const r = weave.get_id(reader);
				const wr = weave.get_id(writer);

				if (!wr || !r) {
					dirty = true;
					delete wefts[reader];
					return
				}

				if (weft_cancels[reader]) weft_cancels[reader]();
				const space = weave.get_id(reader.split(`/`)[0]);

				weft_cancels[reader] = r.value.subscribe(($val) => {
					if (!space.rezed) return
					wr.value.set($val);
				});
			});

			remove.forEach((key) => {
				const r = weft_cancels[key];
				if (!r) return
				r();
				delete weft_cancels[key];
			});

			if (dirty) {
				weave.wefts.set(wefts, true);
			}
		});

		return () => {
			cancel();
			values(weft_cancels).forEach((d) => d());
		}
	};

	const start_rez = (weave) => {
		const cancel = weave.rezed.listen(($rezed, {
			add,
			remove
		}) => {
			const deletes = [];

			const warps = weave.warps.get();
			// non reactive to weft changes
			add.forEach((key) => {
				const warp = warps[key];

				// zombie rez
				if (!warp) {
					delete $rezed[key];
					return deletes.push(key)
				}

				warp.rezed = true;
				warp.rez && warp.rez();

				// TODO: Maybe not?
				// notify to refresh now that a rez has happened
				warp.value.notify();
			});

			remove.forEach((key) => {
				const warp = warps[key];
				if (!warp) {
					delete $rezed[key];
					return deletes.push(key)
				}

				delete warp.rezed;
				warp.derez && warp.derez();
			});

			if (deletes.length > 0) {
				weave.rezed.set($rezed, true);
			}
		});

		return () => {
			cancel();
			values(weave.rezed.get()).forEach(
				(warp) => warp && warp.derez && warp.derez()
			);
		}
	};

	const start = (weave_name) => {
		if (weave_name === SYSTEM) {
			return
		}

		const weave = get(weave_name);
		if (!weave) return false

		const rez_cancel = start_rez(weave);
		const weft_cancel = start_wefts(weave);

		highways.set(weave_name, () => {
			weft_cancel();
			rez_cancel();
		});

		running_set({
			...running.get(),
			[weave_name]: true
		});
	};

	const stop = (weave_name) => {
		if (weave_name === SYSTEM) {
			return
		}

		// Cancel it
		const cancel = highways.get(weave_name);

		if (cancel !== undefined) {
			cancel();
			highways.delete(weave_name);
		}

		// Stop it
		const r = running.get();
		delete r[weave_name];

		running_set(r);
	};

	const stop_all = () => {
		const $weaves = weaves.get();

		keys($weaves).forEach(($name) => stop($name));
	};

	const clear$1 = () => {
		stop_all();
		weaves.set({
			[SYSTEM]: weaves.get()[SYSTEM]
		});
	};

	const restart = (name) => {
		Wheel.stop(name);
		Wheel.start(name);
	};

	const toJSON = () => ({
		name: name$1.get(),
		weaves: store_JSON(weaves),
		running: running.toJSON()
	});

	const REG_ID = /\$?[~.]?\/[a-zA-Z 0-9!%&/]+/g;

	const shared = {};

	var Wheel$1 = /*#__PURE__*/Object.freeze({
		__proto__: null,
		SYSTEM: SYSTEM,
		weaves: weaves,
		running: running,
		trash: trash,
		del: del,
		name: name$1,
		get: get,
		exists: exists,
		spawn: spawn,
		start: start,
		stop: stop,
		stop_all: stop_all,
		clear: clear$1,
		restart: restart,
		toJSON: toJSON,
		REG_ID: REG_ID,
		shared: shared,
		chain: chain,
		decompile: decompile,
		translate: translate,
		compile: compile,
		format: format,
		condense: condense
	});

	window.Wheel = Wheel$1;

	const position = read([0, 0], set => window
		.addEventListener(`mousemove`, ({ clientX, clientY }) => set([clientX, clientY]))
	);

	const mouse_up = read(null, set => window
		.addEventListener(`mouseup`, (e) => set(e))
	);

	const scroll = read([0, 0, 0], set => window
		.addEventListener(`wheel`, (e) => {
			set([-e.deltaX, -e.deltaY, 0]);
		})
	);

	var mouse = /*#__PURE__*/Object.freeze({
		__proto__: null,
		position: position,
		mouse_up: mouse_up,
		scroll: scroll
	});

	var sprite_frag = "#version 300 es\nprecision lowp float;\n#define GLSLIFY 1\n\nuniform sampler2D u_map;\n\nin vec2 v_sprite;\nin vec4 v_color;\n\nout vec4 f_color;\n\nvoid main() {\n\tf_color = texture(u_map, v_sprite);\n\n\t// grayscale to remove any color from the image\n\tfloat gray = dot(f_color.rgb, vec3(0.299, 0.587, 0.114));\n\tf_color = gray * vec4(v_color.rgb, v_color.a);\n\n\t// super important, removes low opacity frags\n\tif(f_color.a < 0.1) discard;\n}\n"; // eslint-disable-line

	var sprite_vert = "#version 300 es\nprecision lowp float;\n#define GLSLIFY 1\n\nuniform mat4 u_view_projection;\nuniform float u_sprite_size;\nuniform float u_sprite_columns;\nuniform float u_time;\nuniform float u_background_color;\n\nin vec3 translate;\nin vec3 translate_last;\n\nin float scale;\nin float scale_last;\n\nin float rotation;\nin float rotation_last;\n\nin float alpha;\nin float alpha_last;\n\nin int color;\nin int color_last;\n\nin float sprite;\n\nin vec2 position;\n\nin int flags;\n\nout vec2 v_sprite;\nout vec4 v_color;\n\nvoid main() {\n\t// mix the last color and the new color\n\tv_color = mix(\n\t\tvec4((color_last>>16) &0x0ff, (color_last>>8) &0x0ff, (color_last) & 0x0ff, alpha_last),\n\t\tvec4((color>>16) &0x0ff, (color>>8) &0x0ff, (color) & 0x0ff, alpha),\n\t\tu_time\n\t);\n\n\t// scale\n\tfloat s = mix(scale_last, scale, u_time);\n\n\t// Grabbing the tile\n\tfloat x = mod(sprite, u_sprite_columns);\n\tfloat y = floor(sprite / u_sprite_columns);\n\n\tvec2 pos_scale = position * s;\n\tvec2 coords = (position + vec2(0.5, 0.5) + vec2(x, y))/u_sprite_columns;\n\n\tif((flags & 0x1) == 1) {\n\t\tcoords[0] = -1.0 * coords[0];\n\t}\n\n\tif((flags & 0x2) == 2) {\n\t\tcoords[1] = 1.0 - coords[1];\n\t}\n\n\tv_sprite = coords;\n\n\t// position\n\tvec3 t = mix(translate_last, translate, u_time);\n\n\tmat4 mv = u_view_projection;\n\tvec3 pos = vec3(pos_scale, 0.0) + t;\n\n\tgl_Position = mv * vec4(\n\t\tpos,\n\t\t1.0\n\t);\n}\n"; // eslint-disable-line

	const sprite$1 = read([
		sprite_vert,
		sprite_frag
	]);

	const validate = (thing) => {
		const set = thing.set.bind(thing);
		return (val) => {
			if (!Array.isArray(val)) {
				if (
					val &&
					typeof val[0] === `number` &&
					typeof val[1] === `number` &&
					typeof val[2] === `number`
				) {
					thing.set(val);
					return
				}

				return
			}
			set(val);
		}
	};

	const camera = write(twgl.m4.identity());
	const position$1 = write([0, 0, 0]);
	const look = write([0, 0, -1]);

	look.set = validate(look);
	position$1.set = validate(position$1);

	var camera$1 = /*#__PURE__*/Object.freeze({
		__proto__: null,
		camera: camera,
		position: position$1,
		look: look
	});

	const defaults = {
		position: [0, 0, 0],
		sprite: [0],
		scale: [1],
		color: [0xFFFFFF],
		rotation: [0],
		alpha: [1],
		flags: [0]
	};

	const verts = twgl.primitives.createXYQuadVertices(1);

	let count = 0;

	const buffer = {
		...map(verts)(
			([key, val]) => {
				val.divisor = 0;
				return [key, val]
			}
		),
		translate_last: {
			divisor: 1,
			data: new Float32Array(3),
			numComponents: 3
		},
		translate: {
			divisor: 1,
			data: new Float32Array(3),
			numComponents: 3
		},
		rotation: {
			numComponents: 1,
			data: new Float32Array(1),
			divisor: 1
		},
		rotation_last: {
			numComponents: 1,
			data: new Float32Array(1),
			divisor: 1
		},
		alpha: {
			numComponents: 1,
			data: new Float32Array(1),
			divisor: 1
		},
		alpha_last: {
			numComponents: 1,
			data: new Float32Array(1),
			divisor: 1
		},
		color: {
			numComponents: 1,
			data: new Int32Array(1),
			divisor: 1
		},
		color_last: {
			numComponents: 1,
			data: new Int32Array(1),
			divisor: 1
		},
		sprite: {
			numComponents: 1,
			data: new Float32Array(1),
			divisor: 1
		},
		flags: {
			numComponents: 1,
			data: new Int32Array(1),
			divisor: 1
		},
		scale: {
			numComponents: 1,
			data: new Float32Array(1),
			divisor: 1
		},
		scale_last: {
			numComponents: 1,
			data: new Float32Array(1),
			divisor: 1
		}
	};

	let last_snap = Date.now();

	const get_time = () => {
		const t = (Date.now() - last_snap) / TIME_TICK_RATE.get();

		return t
	};

	let buffer_info;
	const get_buffer = (gl) => {
		if (buffer_info) {
			each(buffer)(([key, { data, divisor }]) => {
				if (divisor !== 1) return
				twgl.setAttribInfoBufferFromArray(
					gl,
					buffer_info.attribs[key],
					data
				);
			});

			return buffer_info
		}

		buffer_info = twgl.createBufferInfoFromArrays(
			gl,
			buffer
		);

		dirty = true;
		return buffer_info
	};

	let dirty;
	const snapshot = (gl) => {
		const result = {
			count,
			buffer_info: get_buffer(gl),
			time: get_time(),
			dirty
		};

		if (dirty) dirty = false;
		return result
	};

	const keydex = {};

	let buffer_count = 0;

	const available = [];

	const expand = (amount = 100) => {
		buffer_info = false;

		const count_new = buffer_count + amount;

		values(buffer).forEach(({
			divisor,
			data,
			numComponents
		}) => {
			if (divisor !== 1) return
			each(buffer)(([_, buff]) => {
				const { data, numComponents, divisor } = buff;
				if (divisor !== 1) return

				buff.data = new data.__proto__.constructor(numComponents * count_new);

				buff.data.set(data, 0);
			});
		});

		available.push(...[...Array(amount)].map((_, i) => buffer_count + i));
		buffer_count = count_new;
	};

	const to_idx = (key) => {
		if (keydex[key] === undefined) {
			// grab an available key
			if (available.length === 0) {
				expand();
			}

			keydex[key] = available.shift();
		}

		return keydex[key]
	};

	// free the key value and make the idx available
	const free = (key) => {
		const idx = keydex[key];
		// this key is freEEeee already
		if (idx === undefined) return

		available.push(idx);

		each(buffer)(([_, { data, numComponents, divisor }]) => {
			if (divisor !== 1) return

			// zero it out
			data.set([...Array(numComponents)].fill(0), idx * numComponents);
		});
	};

	let last_update;
	// RAF so it happens at end of frame
	tick.listen(() => requestAnimationFrame(() => {
		if (!buffer_info) return

		// grab the shiz
		const { update, remove, add } = visible.hey();

		// add all the defaults for each one
		add.forEach((key) => {
			each(defaults)(([key_d, val]) => {
				if (buffer[`${key_d}_last`]) {
					const idx = to_idx(key);
					const { data, numComponents } = buffer[`${key_d}_last`];

					data.set([...val], idx * numComponents);
				}

				// already set
				if (update[key] && update[key][key_d] !== undefined) return

				update[key][key_d] = visible.value[key][key_d] === undefined
					? visible.value[key].get_value(key_d)
					: [...val];
			});
		});

		each(update)(([key, space]) => {
			const idx = to_idx(key);
			last_update.delete(key);

			each(buffer)(([key_b, { data, divisor, numComponents }]) => {
				if (divisor !== 1 || key_b.indexOf(`_last`) !== -1) return

				const bdx = idx * numComponents;

				// alias positon to translate
				const space_key = key_b === `translate` ? `position` : key_b;
				const twist = space[space_key];

				let update_set;
				// TODO: Maybe store all values in twists as TypeArrays?
				if (typeof twist === `number`) {
					update_set = [...Array(numComponents)].fill(twist);
				} else if (Array.isArray(twist)) {
					// assume under not over
					if (twist.length < numComponents) {
						for (let i = numComponents - twist.length; i < twist.length; i++) {
							twist[i] = defaults[space_key][i];
						}
					}

					update_set = twist.slice(0, numComponents);
				} else {
					// otherwise wtf was that? lets set default
					update_set = [...data.subarray(bdx, bdx + numComponents)];
				}

				// update your last buffer if it exists
				if (buffer[`${key_b}_last`] !== undefined) {
					const { data: data_last } = buffer[`${key_b}_last`];

					data_last.set([...data.subarray(bdx, bdx + numComponents)], bdx);
				}

				return data.set(update_set, bdx)
			});
		});

		remove.forEach((key) => {
			last_update.delete(key);
			free(key);
		});

		last_update && last_update.forEach((key) => {
			const idx = to_idx(key);

			each(buffer)(([key_b, { data, divisor, numComponents }]) => {
				if (divisor !== 1 || key_b.indexOf(`_last`) !== -1) return

				const bdx = idx * numComponents;

				if (buffer[`${key_b}_last`] !== undefined) {
					const { data: data_last } = buffer[`${key_b}_last`];

					data_last.set([...data.subarray(bdx, bdx + numComponents)], bdx);
				}
			});
		});

		count = buffer_count;
		last_snap = Date.now();
		last_update = new Set(keys(update));
	}));

	let clear_color = [0, 0, 0, 1];

	CLEAR_COLOR.listen((txt) => {
		const { red, green, blue } = Color(txt).toRGB();
		clear_color = [red, green, blue, 1];
	});

	const { m4 } = twgl;
	const up = [0, 1, 0];

	var webgl = () => {
		const smooth_position = {
			last: [0, 0, 0],
			next: [0, 0, 0],
			future: [0, 0, 0],

			update () {
				smooth_position.last = [...smooth_position.next];
				smooth_position.next = position$1.get();
			},

			get: (t) => {
				const v = twgl.v3.lerp(
					smooth_position.last,
					smooth_position.next,
					t
				);

				if (1 - t < 0.05) {
					smooth_position.update();
				}

				return v
			}
		};

		const canvas = document.createElement(`canvas`);

		canvas.width = 16 * 100;
		canvas.height = 16 * 100;

		const gl = twgl.getContext(canvas);
		twgl.addExtensionsToContext(gl);

		const textures = twgl.createTextures(gl, {
			map: {
				src: SPRITES.get(),
				mag: gl.NEAREST,
				min: gl.LINEAR
			}
		});

		const program_info = twgl.createProgramInfo(
			gl,
			sprite$1.get()
		);

		canvas.snap = write(snapshot(gl));

		const view = m4.identity();
		const view_projection = m4.identity();

		let vertex_info;
		// lifecycle on warp

		const drawObjects = [{
			programInfo: program_info,
			vertexArrayInfo: vertex_info,
			uniforms: {},
			instanceCount: 0
		}];

		gl.enable(gl.DEPTH_TEST);
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
		gl.useProgram(program_info.program);

		canvas.cancel = frame.listen(([time, t]) => {
			gl.viewport(0, 0, canvas.width, canvas.height);
			gl.clearColor(...clear_color);
			gl.clear(gl.COLOR_BUFFER_BIT | gl.GL_DEPTH_BUFFER_BIT);

			const snap = snapshot(gl);
			if (snap.count < 1) return

			const r = canvas.width / canvas.height;
			const projection = twgl.m4.ortho(-10 * r, 10 * r, 10, -10, -100, 50);
			const c = camera.get();
			const $pos = smooth_position.get(snap.time);

			m4.lookAt($pos, twgl.v3.add($pos, look.get()), up, c);
			m4.inverse(c, view);
			m4.multiply(projection, view, view_projection);

			// if (snap.dirty || !drawObjects[0].vertexArrayInfo) {
			drawObjects[0].vertexArrayInfo = twgl.createVertexArrayInfo(gl, program_info, snap.buffer_info);
			// }

			drawObjects[0].instanceCount = snap.count;
			drawObjects[0].uniforms = {
				u_map: textures.map,
				u_time: snap.time,
				u_sprite_size: 16,
				u_sprite_columns: 32,
				u_view_projection: view_projection,
				u_background_color: Math.round(clear_color[0] * 256 * 256) +
					Math.round(clear_color[1] * 256) +
					clear_color[2]
			};

			twgl.drawObjectList(gl, drawObjects);
		});

		return canvas
	};

	const size = read([window.innerWidth, window.innerHeight], (set) => {
		window.addEventListener(`resize`, () => {
			set([window.innerWidth, window.innerHeight]);
		});
	});

	const scale = write(1);

	size.subscribe(([width, height]) => {
		const target = width > height
			? height
			: width;

		scale.set(target / 100);
		window.document.documentElement.style.fontSize = `${Math.round(scale.get())}px`;
	});

	// main canvas
	const main = read(webgl());

	var screen = /*#__PURE__*/Object.freeze({
		__proto__: null,
		size: size,
		scale: scale,
		main: main
	});

	const key = read(``, (set) => {
		window.addEventListener(`keyup`, (e) => {
			// always allow keyup
			e.preventDefault();

			if (e.code === `ControlRight`) return set(`enter!`)
			set(`${e.key.toLowerCase()}!`);
		});

		window.addEventListener(`keydown`, (e) => {
			if (
				e.target.tagName === `INPUT` || e.target.tagName === `TEXTAREA`
			) {
				return
			}

			e.preventDefault();

			if (e.code === `ControlRight`) return set(`enter`)

			set(e.key.toLowerCase());
		});
	});

	const keys$1 = read({}, (set) => {
		const value = {};

		const clear = () => {
			Object.entries(value).forEach(([key, val]) => {
				if (val && key[key.length - 1] !== `!`) {
					value[key] = false;
				}
			});

			set(value);
		};

		key.listen((char) => {
			value[char] = true;
			if (char.length > 1 && char[char.length - 1] === `!`) {
				value[char.slice(0, -1)] = false;
			} else {
				value[`${char}!`] = false;
			}
			set(value);
		});

		// really try to avoid stuck keys
		window.addEventListener(`blur`, clear);
		document.addEventListener(`focus`, clear);
		document.addEventListener(`visibilitychange`, clear, false);
	});

	var key$1 = /*#__PURE__*/Object.freeze({
		__proto__: null,
		key: key,
		keys: keys$1
	});

	// eventually will want to support local multiplayer with this

	const pads = {};

	window.addEventListener(`gamepadconnected`, ({ gamepad }) => {
		pads[gamepad.id] = gamepad;
	});

	window.addEventListener(`gamepaddisconnected`, ({ gamepad }) => {
		delete pads[gamepad.id];
	});

	let axes_set;
	const axes = read({}, (set) => {
		axes_set = set;
	});

	const xbox = {
		0: `a`,
		1: `b`,
		2: `x`,
		3: `y`,
		4: `leftshoulder`,
		5: `rightshoulder`,
		6: `lefttrigger`,
		7: `righttrigger`,
		8: `select`,
		9: `start`,
		10: `leftstick`,
		11: `rightstick`,
		12: `up`,
		13: `down`,
		14: `left`,
		15: `right`
	};

	const xbox_axis = {
		0: `lefthorizontal`,
		1: `leftvertical`,
		2: `righthorizontal`,
		3: `rightvertical`
	};

	const button = read({}, (set) => {
		const last = {};

		tick.listen(() => {
			const gps = navigator.getGamepads();
			for (let i = 0; i < gps.length; i++) {
				const pad = gps[i];
				if (pad === null) continue

				pad.buttons.forEach(({ pressed }, bdx) => {
					const key = xbox[bdx];
					if (key && last[key] !== pressed) {
						set(
							pressed
								? xbox[bdx]
								: `${xbox[bdx]}!`
						);

						last[key] = pressed;
					}
				});

				const $axes = axes.get();

				pad.axes.forEach((axis, adx) => {
					const key = xbox_axis[axis];
					if (key && $axes[key] !== axis) {
						$axes[key] = axis;
					}
				});

				axes_set($axes);
			}
		});
	});

	const buttons = read({}, (set) => {
		const value = {};

		button.listen(($button) => {
			if ($button[$button.length - 1] === `!`) {
				value[$button.slice(0, -1)] = false;
			} else {
				value[$button] = true;
			}
			set(value);
		});
	});

	var gamepad = /*#__PURE__*/Object.freeze({
		__proto__: null,
		axes: axes,
		button: button,
		buttons: buttons
	});

	/* @license twgl.js 4.14.1 Copyright (c) 2015, Gregg Tavares All Rights Reserved.
	Available via the MIT license.
	see: http://github.com/greggman/twgl.js for details */
	/*
	 * Copyright 2019 Gregg Tavares
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a
	 * copy of this software and associated documentation files (the "Software"),
	 * to deal in the Software without restriction, including without limitation
	 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
	 * and/or sell copies of the Software, and to permit persons to whom the
	 * Software is furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL
	 * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
	 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
	 * DEALINGS IN THE SOFTWARE.
	 */

	/**
	 *
	 * Vec3 math math functions.
	 *
	 * Almost all functions take an optional `dst` argument. If it is not passed in the
	 * functions will create a new Vec3. In other words you can do this
	 *
	 *     var v = v3.cross(v1, v2);  // Creates a new Vec3 with the cross product of v1 x v2.
	 *
	 * or
	 *
	 *     var v = v3.create();
	 *     v3.cross(v1, v2, v);  // Puts the cross product of v1 x v2 in v
	 *
	 * The first style is often easier but depending on where it's used it generates garbage where
	 * as there is almost never allocation with the second style.
	 *
	 * It is always save to pass any vector as the destination. So for example
	 *
	 *     v3.cross(v1, v2, v1);  // Puts the cross product of v1 x v2 in v1
	 *
	 * @module twgl/v3
	 */

	let VecType = Float32Array;

	/**
	 * A JavaScript array with 3 values or a Float32Array with 3 values.
	 * When created by the library will create the default type which is `Float32Array`
	 * but can be set by calling {@link module:twgl/v3.setDefaultType}.
	 * @typedef {(number[]|Float32Array)} Vec3
	 * @memberOf module:twgl/v3
	 */

	/**
	 * Sets the type this library creates for a Vec3
	 * @param {constructor} ctor the constructor for the type. Either `Float32Array` or `Array`
	 * @return {constructor} previous constructor for Vec3
	 * @memberOf module:twgl/v3
	 */
	function setDefaultType(ctor) {
	  const oldType = VecType;
	  VecType = ctor;
	  return oldType;
	}

	/**
	 * Creates a vec3; may be called with x, y, z to set initial values.
	 * @param {number} [x] Initial x value.
	 * @param {number} [y] Initial y value.
	 * @param {number} [z] Initial z value.
	 * @return {module:twgl/v3.Vec3} the created vector
	 * @memberOf module:twgl/v3
	 */
	function create(x, y, z) {
	  const dst = new VecType(3);
	  if (x) {
	    dst[0] = x;
	  }
	  if (y) {
	    dst[1] = y;
	  }
	  if (z) {
	    dst[2] = z;
	  }
	  return dst;
	}

	/**
	 * Adds two vectors; assumes a and b have the same dimension.
	 * @param {module:twgl/v3.Vec3} a Operand vector.
	 * @param {module:twgl/v3.Vec3} b Operand vector.
	 * @param {module:twgl/v3.Vec3} [dst] vector to hold result. If not new one is created.
	 * @return {module:twgl/v3.Vec3} A vector tha tis the sum of a and b.
	 * @memberOf module:twgl/v3
	 */
	function add$1(a, b, dst) {
	  dst = dst || new VecType(3);

	  dst[0] = a[0] + b[0];
	  dst[1] = a[1] + b[1];
	  dst[2] = a[2] + b[2];

	  return dst;
	}

	/**
	 * Subtracts two vectors.
	 * @param {module:twgl/v3.Vec3} a Operand vector.
	 * @param {module:twgl/v3.Vec3} b Operand vector.
	 * @param {module:twgl/v3.Vec3} [dst] vector to hold result. If not new one is created.
	 * @return {module:twgl/v3.Vec3} A vector that is the difference of a and b.
	 * @memberOf module:twgl/v3
	 */
	function subtract(a, b, dst) {
	  dst = dst || new VecType(3);

	  dst[0] = a[0] - b[0];
	  dst[1] = a[1] - b[1];
	  dst[2] = a[2] - b[2];

	  return dst;
	}

	/**
	 * Performs linear interpolation on two vectors.
	 * Given vectors a and b and interpolation coefficient t, returns
	 * a + t * (b - a).
	 * @param {module:twgl/v3.Vec3} a Operand vector.
	 * @param {module:twgl/v3.Vec3} b Operand vector.
	 * @param {number} t Interpolation coefficient.
	 * @param {module:twgl/v3.Vec3} [dst] vector to hold result. If not new one is created.
	 * @return {module:twgl/v3.Vec3} The linear interpolated result.
	 * @memberOf module:twgl/v3
	 */
	function lerp(a, b, t, dst) {
	  dst = dst || new VecType(3);

	  dst[0] = a[0] + t * (b[0] - a[0]);
	  dst[1] = a[1] + t * (b[1] - a[1]);
	  dst[2] = a[2] + t * (b[2] - a[2]);

	  return dst;
	}

	/**
	 * Performs linear interpolation on two vectors.
	 * Given vectors a and b and interpolation coefficient vector t, returns
	 * a + t * (b - a).
	 * @param {module:twgl/v3.Vec3} a Operand vector.
	 * @param {module:twgl/v3.Vec3} b Operand vector.
	 * @param {module:twgl/v3.Vec3} t Interpolation coefficients vector.
	 * @param {module:twgl/v3.Vec3} [dst] vector to hold result. If not new one is created.
	 * @return {module:twgl/v3.Vec3} the linear interpolated result.
	 * @memberOf module:twgl/v3
	 */
	function lerpV(a, b, t, dst) {
	  dst = dst || new VecType(3);

	  dst[0] = a[0] + t[0] * (b[0] - a[0]);
	  dst[1] = a[1] + t[1] * (b[1] - a[1]);
	  dst[2] = a[2] + t[2] * (b[2] - a[2]);

	  return dst;
	}

	/**
	 * Return max values of two vectors.
	 * Given vectors a and b returns
	 * [max(a[0], b[0]), max(a[1], b[1]), max(a[2], b[2])].
	 * @param {module:twgl/v3.Vec3} a Operand vector.
	 * @param {module:twgl/v3.Vec3} b Operand vector.
	 * @param {module:twgl/v3.Vec3} [dst] vector to hold result. If not new one is created.
	 * @return {module:twgl/v3.Vec3} The max components vector.
	 * @memberOf module:twgl/v3
	 */
	function max(a, b, dst) {
	  dst = dst || new VecType(3);

	  dst[0] = Math.max(a[0], b[0]);
	  dst[1] = Math.max(a[1], b[1]);
	  dst[2] = Math.max(a[2], b[2]);

	  return dst;
	}

	/**
	 * Return min values of two vectors.
	 * Given vectors a and b returns
	 * [min(a[0], b[0]), min(a[1], b[1]), min(a[2], b[2])].
	 * @param {module:twgl/v3.Vec3} a Operand vector.
	 * @param {module:twgl/v3.Vec3} b Operand vector.
	 * @param {module:twgl/v3.Vec3} [dst] vector to hold result. If not new one is created.
	 * @return {module:twgl/v3.Vec3} The min components vector.
	 * @memberOf module:twgl/v3
	 */
	function min(a, b, dst) {
	  dst = dst || new VecType(3);

	  dst[0] = Math.min(a[0], b[0]);
	  dst[1] = Math.min(a[1], b[1]);
	  dst[2] = Math.min(a[2], b[2]);

	  return dst;
	}

	/**
	 * Multiplies a vector by a scalar.
	 * @param {module:twgl/v3.Vec3} v The vector.
	 * @param {number} k The scalar.
	 * @param {module:twgl/v3.Vec3} [dst] vector to hold result. If not new one is created.
	 * @return {module:twgl/v3.Vec3} The scaled vector.
	 * @memberOf module:twgl/v3
	 */
	function mulScalar(v, k, dst) {
	  dst = dst || new VecType(3);

	  dst[0] = v[0] * k;
	  dst[1] = v[1] * k;
	  dst[2] = v[2] * k;

	  return dst;
	}

	/**
	 * Divides a vector by a scalar.
	 * @param {module:twgl/v3.Vec3} v The vector.
	 * @param {number} k The scalar.
	 * @param {module:twgl/v3.Vec3} [dst] vector to hold result. If not new one is created.
	 * @return {module:twgl/v3.Vec3} The scaled vector.
	 * @memberOf module:twgl/v3
	 */
	function divScalar(v, k, dst) {
	  dst = dst || new VecType(3);

	  dst[0] = v[0] / k;
	  dst[1] = v[1] / k;
	  dst[2] = v[2] / k;

	  return dst;
	}

	/**
	 * Computes the cross product of two vectors; assumes both vectors have
	 * three entries.
	 * @param {module:twgl/v3.Vec3} a Operand vector.
	 * @param {module:twgl/v3.Vec3} b Operand vector.
	 * @param {module:twgl/v3.Vec3} [dst] vector to hold result. If not new one is created.
	 * @return {module:twgl/v3.Vec3} The vector of a cross b.
	 * @memberOf module:twgl/v3
	 */
	function cross(a, b, dst) {
	  dst = dst || new VecType(3);

	  const t1 = a[2] * b[0] - a[0] * b[2];
	  const t2 = a[0] * b[1] - a[1] * b[0];
	  dst[0] = a[1] * b[2] - a[2] * b[1];
	  dst[1] = t1;
	  dst[2] = t2;

	  return dst;
	}

	/**
	 * Computes the dot product of two vectors; assumes both vectors have
	 * three entries.
	 * @param {module:twgl/v3.Vec3} a Operand vector.
	 * @param {module:twgl/v3.Vec3} b Operand vector.
	 * @return {number} dot product
	 * @memberOf module:twgl/v3
	 */
	function dot(a, b) {
	  return (a[0] * b[0]) + (a[1] * b[1]) + (a[2] * b[2]);
	}

	/**
	 * Computes the length of vector
	 * @param {module:twgl/v3.Vec3} v vector.
	 * @return {number} length of vector.
	 * @memberOf module:twgl/v3
	 */
	function length$1(v) {
	  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
	}

	/**
	 * Computes the square of the length of vector
	 * @param {module:twgl/v3.Vec3} v vector.
	 * @return {number} square of the length of vector.
	 * @memberOf module:twgl/v3
	 */
	function lengthSq(v) {
	  return v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
	}

	/**
	 * Computes the distance between 2 points
	 * @param {module:twgl/v3.Vec3} a vector.
	 * @param {module:twgl/v3.Vec3} b vector.
	 * @return {number} distance between a and b
	 * @memberOf module:twgl/v3
	 */
	function distance(a, b) {
	  const dx = a[0] - b[0];
	  const dy = a[1] - b[1];
	  const dz = a[2] - b[2];
	  return Math.sqrt(dx * dx + dy * dy + dz * dz);
	}

	/**
	 * Computes the square of the distance between 2 points
	 * @param {module:twgl/v3.Vec3} a vector.
	 * @param {module:twgl/v3.Vec3} b vector.
	 * @return {number} square of the distance between a and b
	 * @memberOf module:twgl/v3
	 */
	function distanceSq(a, b) {
	  const dx = a[0] - b[0];
	  const dy = a[1] - b[1];
	  const dz = a[2] - b[2];
	  return dx * dx + dy * dy + dz * dz;
	}

	/**
	 * Divides a vector by its Euclidean length and returns the quotient.
	 * @param {module:twgl/v3.Vec3} a The vector.
	 * @param {module:twgl/v3.Vec3} [dst] vector to hold result. If not new one is created.
	 * @return {module:twgl/v3.Vec3} The normalized vector.
	 * @memberOf module:twgl/v3
	 */
	function normalize(a, dst) {
	  dst = dst || new VecType(3);

	  const lenSq = a[0] * a[0] + a[1] * a[1] + a[2] * a[2];
	  const len = Math.sqrt(lenSq);
	  if (len > 0.00001) {
	    dst[0] = a[0] / len;
	    dst[1] = a[1] / len;
	    dst[2] = a[2] / len;
	  } else {
	    dst[0] = 0;
	    dst[1] = 0;
	    dst[2] = 0;
	  }

	  return dst;
	}

	/**
	 * Negates a vector.
	 * @param {module:twgl/v3.Vec3} v The vector.
	 * @param {module:twgl/v3.Vec3} [dst] vector to hold result. If not new one is created.
	 * @return {module:twgl/v3.Vec3} -v.
	 * @memberOf module:twgl/v3
	 */
	function negate(v, dst) {
	  dst = dst || new VecType(3);

	  dst[0] = -v[0];
	  dst[1] = -v[1];
	  dst[2] = -v[2];

	  return dst;
	}

	/**
	 * Copies a vector.
	 * @param {module:twgl/v3.Vec3} v The vector.
	 * @param {module:twgl/v3.Vec3} [dst] vector to hold result. If not new one is created.
	 * @return {module:twgl/v3.Vec3} A copy of v.
	 * @memberOf module:twgl/v3
	 */
	function copy(v, dst) {
	  dst = dst || new VecType(3);

	  dst[0] = v[0];
	  dst[1] = v[1];
	  dst[2] = v[2];

	  return dst;
	}

	/**
	 * Multiplies a vector by another vector (component-wise); assumes a and
	 * b have the same length.
	 * @param {module:twgl/v3.Vec3} a Operand vector.
	 * @param {module:twgl/v3.Vec3} b Operand vector.
	 * @param {module:twgl/v3.Vec3} [dst] vector to hold result. If not new one is created.
	 * @return {module:twgl/v3.Vec3} The vector of products of entries of a and
	 *     b.
	 * @memberOf module:twgl/v3
	 */
	function multiply(a, b, dst) {
	  dst = dst || new VecType(3);

	  dst[0] = a[0] * b[0];
	  dst[1] = a[1] * b[1];
	  dst[2] = a[2] * b[2];

	  return dst;
	}

	/**
	 * Divides a vector by another vector (component-wise); assumes a and
	 * b have the same length.
	 * @param {module:twgl/v3.Vec3} a Operand vector.
	 * @param {module:twgl/v3.Vec3} b Operand vector.
	 * @param {module:twgl/v3.Vec3} [dst] vector to hold result. If not new one is created.
	 * @return {module:twgl/v3.Vec3} The vector of quotients of entries of a and
	 *     b.
	 * @memberOf module:twgl/v3
	 */
	function divide(a, b, dst) {
	  dst = dst || new VecType(3);

	  dst[0] = a[0] / b[0];
	  dst[1] = a[1] / b[1];
	  dst[2] = a[2] / b[2];

	  return dst;
	}

	var v3 = /*#__PURE__*/Object.freeze({
	  __proto__: null,
	  add: add$1,
	  copy: copy,
	  create: create,
	  cross: cross,
	  distance: distance,
	  distanceSq: distanceSq,
	  divide: divide,
	  divScalar: divScalar,
	  dot: dot,
	  lerp: lerp,
	  lerpV: lerpV,
	  length: length$1,
	  lengthSq: lengthSq,
	  max: max,
	  min: min,
	  mulScalar: mulScalar,
	  multiply: multiply,
	  negate: negate,
	  normalize: normalize,
	  setDefaultType: setDefaultType,
	  subtract: subtract
	});

	// Collection of meta controllers

	const { length, add: add$2, mulScalar: mulScalar$1 } = v3;

	const zoom = write(0.75);

	// raw translate commands
	const translate$1 = read([0, 0, 0], (set) => {
		const b_key = [0, 0, 0];
		// frame stuff has to be fast :/
		frame.listen(() => {
			const { w, a, s, d, q, e } = keys$1.get();

			b_key[0] = 0;
			b_key[1] = 0;
			b_key[2] = 0;

			if (w) b_key[1] -= 1;
			if (s) b_key[1] += 1;
			if (a) b_key[0] -= 1;
			if (d) b_key[0] += 1;
			if (q) b_key[2] += 1;
			if (e) b_key[2] -= 1;

			if (length(b_key) === 0) return

			set(b_key);
		});
	});

	let scroll_velocity = [0, 0, 0];

	const scroll$1 = transformer((data) => data.map((i) => Math.round(i)));

	scroll$1.set([0, 0, 0]);

	tick.listen(() => {
		if (Math.abs(length(scroll_velocity)) < 1) return

		scroll$1.set(add$2(
			scroll$1.get(),
			scroll_velocity
		).map((n) => Math.round(n)));

		scroll_velocity = mulScalar$1(
			scroll_velocity,
			0.25
		);
	});

	scroll.listen((vel) => {
		scroll_velocity = add$2(scroll_velocity, vel);
	});

	const focus = write(``);

	// input to replicate to remotes
	const button_map = {
		home: ({ home }, { start }) => home || start,
		up: ({ arrowup, tab, shift }, { up }) => arrowup || (tab && shift) || up,
		down: ({ arrowdown, tab, shift }, { down }) => arrowdown || (tab && shift) || down,
		pagedown: ({ pagedown }, { righttrigger }) => pagedown || righttrigger,
		pageup: ({ pageup }, { rightshoulder }) => pageup || rightshoulder,
		insert: ({ insert }, { x }) => insert || x,
		delete: ({ delete: del }, { y }) => del || y,
		left: ({ arrowleft }, { left }) => arrowleft || left,
		right: ({ arrowright }, { right }) => arrowright || right,
		confirm: ({ enter }, { a }) => a || enter,
		cancel: ({ end, escape }, { b }) => end || b || escape,
		editor: ({ pause, tilde }, { select }) => tilde || pause || select,
		avatar_up: ({ w }) => w,
		avatar_down: ({ s }) => s,
		avatar_left: ({ a }) => a,
		avatar_right: ({ d }) => d,
		avatar_jump: ({ " ": space }) => space,
		avatar_sprint: ({ shift }) => shift,
		avatar_left_arm: ({ q }) => q,
		avatar_right_arm: ({ e }) => e,
		undo: ({ control, z, backspace }) => (control && z) || backspace,
		redo: ({ shift, control, z, backspace }) => (shift && control && z) || (shift && backspace)
	};

	const buttons$1 = read({}, (set) => {
		const values = {};
		tick.listen(() => {
			const $keys = keys$1.get();
			const $buttons = buttons.get();

			Object.entries(button_map).forEach(([key, fn]) => {
				values[key] = fn($keys, $buttons);
			});

			set(values);
		});
	});

	var input = /*#__PURE__*/Object.freeze({
		__proto__: null,
		zoom: zoom,
		translate: translate$1,
		scroll: scroll$1,
		focus: focus,
		buttons: buttons$1
	});

	const path = transformer((path_new) => {
		if (Array.isArray(path_new)) {
			return path_new
		}

		return path_new.split(`/`)
	});

	window.addEventListener(`popstate`, (e) => {
		e.preventDefault();
		e.stopPropagation();
		update();
	});

	const update = () => {
		const path_str = window.location.search
			? window.location.search.slice(1)
			: window.location.pathname.slice(1);

		path.set(decodeURI(path_str));
	};

	update();

	const VERSION = 2;
	const TIME_AGO = IDBKeyRange.upperBound(Date.now() - 1000 * 60);
	let db;

	const loaded = write(false);
	const data = new Promise((resolve) => {
		const req = window.indexedDB.open(`isekai`, VERSION);

		req.onupgradeneeded = async (e) => {
			db = e.target.result;
			await db.createObjectStore(`wheel`, { keyPath: `name` });
		};

		req.onsuccess = (e) => {
			db = e.target.result;

			resolve(db);
		};
	});

	const query = ({
		store = `wheel`,
		action = `get`,
		args = [],
		foronly = `readwrite`
	} = false) => new Promise((resolve, reject) => {
		data.then(() => {
			const t = db.transaction([store], foronly);
			t.onerror = reject;
			t.objectStore(store)[action](...args).onsuccess = (e) => resolve(e.target.result);
		});
	});

	const save$1 = async () => {
		const wheel = Wheel.toJSON();

		wheel.date = Date.now();

		// update current
		await query({
			action: `put`,
			args: [wheel],
			foronly: `readwrite`
		});
	};

	window.query = query;

	const savewatch = async ($name) => {
		loaded.set(false);

		const result = await query({
			action: `get`,
			args: [$name]
		}).catch((e) => console.warn(`DB`, e.target.error));

		if (result) {
			const { weaves, running } = result;
			// protect system
			delete weaves[Wheel.SYSTEM];

			Wheel.name.set($name);
			Wheel.spawn(weaves);

			Object.keys(running).forEach((id) => {
				if (id === Wheel.SYSTEM) return
				if (!Wheel.get(id)) return
				Wheel.start(id);
			});
		}

		loaded.set(true);

		const cancel = tick.listen((t) => {
			if (
				t % 10 !== 0 ||
	      db === undefined ||
	      !loaded.get()
			) return

			save$1();
		});

		return () => {
			Wheel.clear();
			Wheel.name.set(`loading`);
			cancel();
		}
	};

	// init()

	let watch = false;
	path.listen(async ($path) => {
		// your watch has ended
		if (watch) watch.then((w) => w());

		if ($path.length === 1) {
			Wheel.name.set($path[0]);
			watch = savewatch($path[0]);
		}

		if ($path.length === 3) {
			await loaded;

			Wheel.name.set(`loading`);

			await github($path, { autorun: true });

			Wheel.name.set($path.join(`/`));
			watch = savewatch($path.join(`/`));
		}
	});

	const normalize$1 = (sys) => map(flag)(
		([k, entry]) => [
			k.replace(/_/g, ` `).toLowerCase(),
			entry
		]
	);

	const tie = (items) => reduce(items)(
		(result, [k, value]) => ({
			...result,
			[k]: {
				type: `space`,
				value: {
					...value,
					[`!name`]: k
				}
			}
		}), {});

	const systems = {
		mouse,
		time,
		screen,
		input,
		key: key$1,
		gamepad,
		flag: normalize$1(),
		camera: camera$1
	};

	var system = Weave({
		name: `sys`,
		id: `sys`,
		warps: tie(systems),
		rezed: systems
	});

	function noop$1() { }
	function assign$1(tar, src) {
	    // @ts-ignore
	    for (const k in src)
	        tar[k] = src[k];
	    return tar;
	}
	function is_promise(value) {
	    return value && typeof value === 'object' && typeof value.then === 'function';
	}
	function add_location(element, file, line, column, char) {
	    element.__svelte_meta = {
	        loc: { file, line, column, char }
	    };
	}
	function run(fn) {
	    return fn();
	}
	function blank_object() {
	    return Object.create(null);
	}
	function run_all(fns) {
	    fns.forEach(run);
	}
	function is_function(thing) {
	    return typeof thing === 'function';
	}
	function safe_not_equal(a, b) {
	    return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
	}
	function validate_store(store, name) {
	    if (!store || typeof store.subscribe !== 'function') {
	        throw new Error(`'${name}' is not a store with a 'subscribe' method`);
	    }
	}
	function subscribe(store, callback) {
	    const unsub = store.subscribe(callback);
	    return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
	}
	function component_subscribe(component, store, callback) {
	    component.$$.on_destroy.push(subscribe(store, callback));
	}
	function create_slot(definition, ctx, $$scope, fn) {
	    if (definition) {
	        const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
	        return definition[0](slot_ctx);
	    }
	}
	function get_slot_context(definition, ctx, $$scope, fn) {
	    return definition[1] && fn
	        ? assign$1($$scope.ctx.slice(), definition[1](fn(ctx)))
	        : $$scope.ctx;
	}
	function get_slot_changes(definition, $$scope, dirty, fn) {
	    if (definition[2] && fn) {
	        const lets = definition[2](fn(dirty));
	        if (typeof $$scope.dirty === 'object') {
	            const merged = [];
	            const len = Math.max($$scope.dirty.length, lets.length);
	            for (let i = 0; i < len; i += 1) {
	                merged[i] = $$scope.dirty[i] | lets[i];
	            }
	            return merged;
	        }
	        return $$scope.dirty | lets;
	    }
	    return $$scope.dirty;
	}
	function action_destroyer(action_result) {
	    return action_result && is_function(action_result.destroy) ? action_result.destroy : noop$1;
	}

	function append(target, node) {
	    target.appendChild(node);
	}
	function insert(target, node, anchor) {
	    target.insertBefore(node, anchor || null);
	}
	function detach(node) {
	    node.parentNode.removeChild(node);
	}
	function destroy_each(iterations, detaching) {
	    for (let i = 0; i < iterations.length; i += 1) {
	        if (iterations[i])
	            iterations[i].d(detaching);
	    }
	}
	function element(name) {
	    return document.createElement(name);
	}
	function svg_element(name) {
	    return document.createElementNS('http://www.w3.org/2000/svg', name);
	}
	function text(data) {
	    return document.createTextNode(data);
	}
	function space$1() {
	    return text(' ');
	}
	function empty() {
	    return text('');
	}
	function listen(node, event, handler, options) {
	    node.addEventListener(event, handler, options);
	    return () => node.removeEventListener(event, handler, options);
	}
	function attr(node, attribute, value) {
	    if (value == null)
	        node.removeAttribute(attribute);
	    else if (node.getAttribute(attribute) !== value)
	        node.setAttribute(attribute, value);
	}
	function children(element) {
	    return Array.from(element.childNodes);
	}
	function set_input_value(input, value) {
	    if (value != null || input.value) {
	        input.value = value;
	    }
	}
	function set_style(node, key, value, important) {
	    node.style.setProperty(key, value, important ? 'important' : '');
	}
	function toggle_class(element, name, toggle) {
	    element.classList[toggle ? 'add' : 'remove'](name);
	}
	function custom_event(type, detail) {
	    const e = document.createEvent('CustomEvent');
	    e.initCustomEvent(type, false, false, detail);
	    return e;
	}

	let current_component;
	function set_current_component(component) {
	    current_component = component;
	}
	function get_current_component() {
	    if (!current_component)
	        throw new Error(`Function called outside component initialization`);
	    return current_component;
	}

	const dirty_components = [];
	const binding_callbacks = [];
	const render_callbacks = [];
	const flush_callbacks = [];
	const resolved_promise = Promise.resolve();
	let update_scheduled = false;
	function schedule_update() {
	    if (!update_scheduled) {
	        update_scheduled = true;
	        resolved_promise.then(flush);
	    }
	}
	function add_render_callback(fn) {
	    render_callbacks.push(fn);
	}
	function flush() {
	    const seen_callbacks = new Set();
	    do {
	        // first, call beforeUpdate functions
	        // and update components
	        while (dirty_components.length) {
	            const component = dirty_components.shift();
	            set_current_component(component);
	            update$1(component.$$);
	        }
	        while (binding_callbacks.length)
	            binding_callbacks.pop()();
	        // then, once components are updated, call
	        // afterUpdate functions. This may cause
	        // subsequent updates...
	        for (let i = 0; i < render_callbacks.length; i += 1) {
	            const callback = render_callbacks[i];
	            if (!seen_callbacks.has(callback)) {
	                callback();
	                // ...so guard against infinite loops
	                seen_callbacks.add(callback);
	            }
	        }
	        render_callbacks.length = 0;
	    } while (dirty_components.length);
	    while (flush_callbacks.length) {
	        flush_callbacks.pop()();
	    }
	    update_scheduled = false;
	}
	function update$1($$) {
	    if ($$.fragment !== null) {
	        $$.update();
	        run_all($$.before_update);
	        const dirty = $$.dirty;
	        $$.dirty = [-1];
	        $$.fragment && $$.fragment.p($$.ctx, dirty);
	        $$.after_update.forEach(add_render_callback);
	    }
	}
	const outroing = new Set();
	let outros;
	function group_outros() {
	    outros = {
	        r: 0,
	        c: [],
	        p: outros // parent group
	    };
	}
	function check_outros() {
	    if (!outros.r) {
	        run_all(outros.c);
	    }
	    outros = outros.p;
	}
	function transition_in(block, local) {
	    if (block && block.i) {
	        outroing.delete(block);
	        block.i(local);
	    }
	}
	function transition_out(block, local, detach, callback) {
	    if (block && block.o) {
	        if (outroing.has(block))
	            return;
	        outroing.add(block);
	        outros.c.push(() => {
	            outroing.delete(block);
	            if (callback) {
	                if (detach)
	                    block.d(1);
	                callback();
	            }
	        });
	        block.o(local);
	    }
	}

	function handle_promise(promise, info) {
	    const token = info.token = {};
	    function update(type, index, key, value) {
	        if (info.token !== token)
	            return;
	        info.resolved = value;
	        let child_ctx = info.ctx;
	        if (key !== undefined) {
	            child_ctx = child_ctx.slice();
	            child_ctx[key] = value;
	        }
	        const block = type && (info.current = type)(child_ctx);
	        let needs_flush = false;
	        if (info.block) {
	            if (info.blocks) {
	                info.blocks.forEach((block, i) => {
	                    if (i !== index && block) {
	                        group_outros();
	                        transition_out(block, 1, 1, () => {
	                            info.blocks[i] = null;
	                        });
	                        check_outros();
	                    }
	                });
	            }
	            else {
	                info.block.d(1);
	            }
	            block.c();
	            transition_in(block, 1);
	            block.m(info.mount(), info.anchor);
	            needs_flush = true;
	        }
	        info.block = block;
	        if (info.blocks)
	            info.blocks[index] = block;
	        if (needs_flush) {
	            flush();
	        }
	    }
	    if (is_promise(promise)) {
	        const current_component = get_current_component();
	        promise.then(value => {
	            set_current_component(current_component);
	            update(info.then, 1, info.value, value);
	            set_current_component(null);
	        }, error => {
	            set_current_component(current_component);
	            update(info.catch, 2, info.error, error);
	            set_current_component(null);
	        });
	        // if we previously had a then/catch block, destroy it
	        if (info.current !== info.pending) {
	            update(info.pending, 0);
	            return true;
	        }
	    }
	    else {
	        if (info.current !== info.then) {
	            update(info.then, 1, info.value, promise);
	            return true;
	        }
	        info.resolved = promise;
	    }
	}

	const globals = (typeof window !== 'undefined' ? window : global);
	function outro_and_destroy_block(block, lookup) {
	    transition_out(block, 1, 1, () => {
	        lookup.delete(block.key);
	    });
	}
	function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
	    let o = old_blocks.length;
	    let n = list.length;
	    let i = o;
	    const old_indexes = {};
	    while (i--)
	        old_indexes[old_blocks[i].key] = i;
	    const new_blocks = [];
	    const new_lookup = new Map();
	    const deltas = new Map();
	    i = n;
	    while (i--) {
	        const child_ctx = get_context(ctx, list, i);
	        const key = get_key(child_ctx);
	        let block = lookup.get(key);
	        if (!block) {
	            block = create_each_block(key, child_ctx);
	            block.c();
	        }
	        else if (dynamic) {
	            block.p(child_ctx, dirty);
	        }
	        new_lookup.set(key, new_blocks[i] = block);
	        if (key in old_indexes)
	            deltas.set(key, Math.abs(i - old_indexes[key]));
	    }
	    const will_move = new Set();
	    const did_move = new Set();
	    function insert(block) {
	        transition_in(block, 1);
	        block.m(node, next);
	        lookup.set(block.key, block);
	        next = block.first;
	        n--;
	    }
	    while (o && n) {
	        const new_block = new_blocks[n - 1];
	        const old_block = old_blocks[o - 1];
	        const new_key = new_block.key;
	        const old_key = old_block.key;
	        if (new_block === old_block) {
	            // do nothing
	            next = new_block.first;
	            o--;
	            n--;
	        }
	        else if (!new_lookup.has(old_key)) {
	            // remove old block
	            destroy(old_block, lookup);
	            o--;
	        }
	        else if (!lookup.has(new_key) || will_move.has(new_key)) {
	            insert(new_block);
	        }
	        else if (did_move.has(old_key)) {
	            o--;
	        }
	        else if (deltas.get(new_key) > deltas.get(old_key)) {
	            did_move.add(new_key);
	            insert(new_block);
	        }
	        else {
	            will_move.add(old_key);
	            o--;
	        }
	    }
	    while (o--) {
	        const old_block = old_blocks[o];
	        if (!new_lookup.has(old_block.key))
	            destroy(old_block, lookup);
	    }
	    while (n)
	        insert(new_blocks[n - 1]);
	    return new_blocks;
	}
	function create_component(block) {
	    block && block.c();
	}
	function mount_component(component, target, anchor) {
	    const { fragment, on_mount, on_destroy, after_update } = component.$$;
	    fragment && fragment.m(target, anchor);
	    // onMount happens before the initial afterUpdate
	    add_render_callback(() => {
	        const new_on_destroy = on_mount.map(run).filter(is_function);
	        if (on_destroy) {
	            on_destroy.push(...new_on_destroy);
	        }
	        else {
	            // Edge case - component was destroyed immediately,
	            // most likely as a result of a binding initialising
	            run_all(new_on_destroy);
	        }
	        component.$$.on_mount = [];
	    });
	    after_update.forEach(add_render_callback);
	}
	function destroy_component(component, detaching) {
	    const $$ = component.$$;
	    if ($$.fragment !== null) {
	        run_all($$.on_destroy);
	        $$.fragment && $$.fragment.d(detaching);
	        // TODO null out other refs, including component.$$ (but need to
	        // preserve final state?)
	        $$.on_destroy = $$.fragment = null;
	        $$.ctx = [];
	    }
	}
	function make_dirty(component, i) {
	    if (component.$$.dirty[0] === -1) {
	        dirty_components.push(component);
	        schedule_update();
	        component.$$.dirty.fill(0);
	    }
	    component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
	}
	function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
	    const parent_component = current_component;
	    set_current_component(component);
	    const prop_values = options.props || {};
	    const $$ = component.$$ = {
	        fragment: null,
	        ctx: null,
	        // state
	        props,
	        update: noop$1,
	        not_equal,
	        bound: blank_object(),
	        // lifecycle
	        on_mount: [],
	        on_destroy: [],
	        before_update: [],
	        after_update: [],
	        context: new Map(parent_component ? parent_component.$$.context : []),
	        // everything else
	        callbacks: blank_object(),
	        dirty
	    };
	    let ready = false;
	    $$.ctx = instance
	        ? instance(component, prop_values, (i, ret, value = ret) => {
	            if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
	                if ($$.bound[i])
	                    $$.bound[i](value);
	                if (ready)
	                    make_dirty(component, i);
	            }
	            return ret;
	        })
	        : [];
	    $$.update();
	    ready = true;
	    run_all($$.before_update);
	    // `false` as a special case of no DOM component
	    $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
	    if (options.target) {
	        if (options.hydrate) {
	            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	            $$.fragment && $$.fragment.l(children(options.target));
	        }
	        else {
	            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	            $$.fragment && $$.fragment.c();
	        }
	        if (options.intro)
	            transition_in(component.$$.fragment);
	        mount_component(component, options.target, options.anchor);
	        flush();
	    }
	    set_current_component(parent_component);
	}
	class SvelteComponent {
	    $destroy() {
	        destroy_component(this, 1);
	        this.$destroy = noop$1;
	    }
	    $on(type, callback) {
	        const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
	        callbacks.push(callback);
	        return () => {
	            const index = callbacks.indexOf(callback);
	            if (index !== -1)
	                callbacks.splice(index, 1);
	        };
	    }
	    $set() {
	        // overridden by instance, if it has props
	    }
	}

	function dispatch_dev(type, detail) {
	    document.dispatchEvent(custom_event(type, detail));
	}
	function append_dev(target, node) {
	    dispatch_dev("SvelteDOMInsert", { target, node });
	    append(target, node);
	}
	function insert_dev(target, node, anchor) {
	    dispatch_dev("SvelteDOMInsert", { target, node, anchor });
	    insert(target, node, anchor);
	}
	function detach_dev(node) {
	    dispatch_dev("SvelteDOMRemove", { node });
	    detach(node);
	}
	function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
	    const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
	    if (has_prevent_default)
	        modifiers.push('preventDefault');
	    if (has_stop_propagation)
	        modifiers.push('stopPropagation');
	    dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
	    const dispose = listen(node, event, handler, options);
	    return () => {
	        dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
	        dispose();
	    };
	}
	function attr_dev(node, attribute, value) {
	    attr(node, attribute, value);
	    if (value == null)
	        dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
	    else
	        dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
	}
	function set_data_dev(text, data) {
	    data = '' + data;
	    if (text.data === data)
	        return;
	    dispatch_dev("SvelteDOMSetData", { node: text, data });
	    text.data = data;
	}
	class SvelteComponentDev extends SvelteComponent {
	    constructor(options) {
	        if (!options || (!options.target && !options.$$inline)) {
	            throw new Error(`'target' is a required option`);
	        }
	        super();
	    }
	    $destroy() {
	        super.$destroy();
	        this.$destroy = () => {
	            console.warn(`Component was already destroyed`); // eslint-disable-line no-console
	        };
	    }
	}

	const nav_map = {};
	const goto = (key) => {
		cursor.set(nav_map[key]);
	};
	const cursor = write(false);

	window.addEventListener(`contextmenu`, (e) => {
		e.preventDefault();
		return false
	});

	let last_node;
	let last_button = {};

	let origin_addr;
	const button_defs = {
		home: { repeat: true, fn: () => last_node.home || origin_addr },
		up: { repeat: true },
		down: { repeat: true },
		pagedown: { repeat: true, alias: `page_down` },
		pageup: { repeat: true, alias: `page_up` },
		cancel: {},
		insert: {},
		delete: { alias: `del` },
		left: {},
		right: {},
		confirm: { alias: `click` }
	};

	tick.listen(() => {
		if (!last_node) return

		const $button = buttons$1.get();

		let dest;
		Object.entries(button_defs).forEach(([key, { repeat, fn, alias }]) => {
			alias = alias || key;
			if (!$button[key] || !last_node[alias]) return

			// prevent repeat
			if (!repeat && last_button[key]) return

			if (fn) {
				dest = fn();
				return
			}

			if (typeof last_node[alias] === `function`) {
				dest = last_node[alias]();
				return
			}

			dest = last_node[alias];
		});

		last_button = { ...$button };
		if (!dest) return

		const target = nav_map[dest];
		if (!target) return

		// "instant" other option
		target.scrollIntoView({ block: `center` });
		cursor.set(target);
	});

	const current = ($node) => {
		// if ($node && $node.id !== undefined) window.location.hash = $node.id
		if (last_node) {
			if (last_node.classList) last_node.classList.remove(`nav`);
			last_node = false;
		}

		if (!$node) return

		last_node = $node;
		if ($node.focus) {
			$node.focus();
			$node.classList.add(`nav`);
		}
	};

	cursor.listen(current);

	var nav = (node, opts) => {
		const { id, origin = false } = opts;
		node.id = id;

		const nav = {
			update: ({ up, down, page_up, page_down, insert, del, left, right }) => {
				// TODO: update to use button defs
				node.up = up || node.up;
				node.left = left || node.left;
				node.right = right || node.right;
				node.down = down || node.down;
				node.page_down = page_down || node.page_down;
				node.page_up = page_up || node.page_up;
				node.insert = insert || node.insert;
				node.del = del || node.del;
			},
			destroy: () => {
				node.removeEventListener(`mousedown`, listener);
				delete nav_map[id];
			}
		};

		nav.update(opts);

		nav_map[id] = node;
		if (id === `sys` && cursor.get() === false) cursor.set(node);
		node.style.transition = `all 250ms linear`;

		const listener = (e = false) => {
			cursor.set(node);

			if (e.which === 3) {
				e.preventDefault();
				e.stopPropagation();
				node.insert && node.insert();
				return
			}

			if (e.which === 2) {
				node.del && node.del();
			}
		};

		node.addEventListener(`mousedown`, listener);

		if (origin) {
			origin_addr = id;
			listener();
		}

		return nav
	};

	/* src\_client\explore\Omni.svelte generated by Svelte v3.16.7 */
	const file = "src\\_client\\explore\\Omni.svelte";

	function create_fragment(ctx) {
		let input;
		let dispose;

		const block = {
			c: function create() {
				input = element("input");
				attr_dev(input, "type", "text");
				attr_dev(input, "class", "omni svelte-brjjhm");
				set_style(input, "border", "0.25rem solid " + /*$THEME_BORDER*/ ctx[2]);
				attr_dev(input, "placeholder", /*tru_placeholder*/ ctx[1]);
				add_location(input, file, 64, 0, 1245);

				dispose = [
					listen_dev(input, "input", /*input_input_handler*/ ctx[11]),
					listen_dev(input, "keydown", /*keydown_handler*/ ctx[12], false, false, false),
					listen_dev(input, "blur", /*execute*/ ctx[3], false, false, false)
				];
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				insert_dev(target, input, anchor);
				set_input_value(input, /*omni*/ ctx[0]);
			},
			p: function update(ctx, [dirty]) {
				if (dirty & /*$THEME_BORDER*/ 4) {
					set_style(input, "border", "0.25rem solid " + /*$THEME_BORDER*/ ctx[2]);
				}

				if (dirty & /*tru_placeholder*/ 2) {
					attr_dev(input, "placeholder", /*tru_placeholder*/ ctx[1]);
				}

				if (dirty & /*omni*/ 1 && input.value !== /*omni*/ ctx[0]) {
					set_input_value(input, /*omni*/ ctx[0]);
				}
			},
			i: noop$1,
			o: noop$1,
			d: function destroy(detaching) {
				if (detaching) detach_dev(input);
				run_all(dispose);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function instance($$self, $$props, $$invalidate) {
		let $tick;
		let $THEME_BORDER;
		validate_store(tick, "tick");
		component_subscribe($$self, tick, $$value => $$invalidate(7, $tick = $$value));
		validate_store(THEME_BORDER, "THEME_BORDER");
		component_subscribe($$self, THEME_BORDER, $$value => $$invalidate(2, $THEME_BORDER = $$value));

		let { command = () => {
			
		} } = $$props;

		let { system = false } = $$props;
		let omni = ``;
		const place_default = system ? `!` : `! > + -`;
		let placeholder = place_default;

		const calc_offset = ($t, $p) => {
			if ($p.length < 20) return placeholder;
			const offset = Math.floor($t / 2) % $p.length;
			return $p.slice(-offset) + $p.slice(0, -offset);
		};

		const commands = {
			"!": () => {
				if (system) {
					$$invalidate(6, placeholder = `SYSTEM CAN ONLY FILTER!!! `);
					return;
				}

				$$invalidate(6, placeholder = `[ADD]+Name [MOVE]~Name/Name [DELETE]-Name`);
			},
			undefined: () => {
				$$invalidate(6, placeholder = place_default);
			}
		};

		const execute = () => {
			const data = [omni[0], ...omni.slice(1).split(`/`)];
			$$invalidate(0, omni = ``);

			if (system) {
				return commands[`!`]();
			}

			if (commands[data[0]]) commands[data[0]](data);

			command(data, ph => {
				$$invalidate(6, placeholder = ph);
			});
		};

		const writable_props = ["command", "system"];

		Object.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Omni> was created with unknown prop '${key}'`);
		});

		function input_input_handler() {
			omni = this.value;
			$$invalidate(0, omni);
		}

		const keydown_handler = e => {
			if (e.which !== 13) return;
			execute();
		};

		$$self.$set = $$props => {
			if ("command" in $$props) $$invalidate(4, command = $$props.command);
			if ("system" in $$props) $$invalidate(5, system = $$props.system);
		};

		$$self.$capture_state = () => {
			return {
				command,
				system,
				omni,
				placeholder,
				tru_placeholder,
				$tick,
				$THEME_BORDER
			};
		};

		$$self.$inject_state = $$props => {
			if ("command" in $$props) $$invalidate(4, command = $$props.command);
			if ("system" in $$props) $$invalidate(5, system = $$props.system);
			if ("omni" in $$props) $$invalidate(0, omni = $$props.omni);
			if ("placeholder" in $$props) $$invalidate(6, placeholder = $$props.placeholder);
			if ("tru_placeholder" in $$props) $$invalidate(1, tru_placeholder = $$props.tru_placeholder);
			if ("$tick" in $$props) tick.set($tick = $$props.$tick);
			if ("$THEME_BORDER" in $$props) THEME_BORDER.set($THEME_BORDER = $$props.$THEME_BORDER);
		};

		let tru_placeholder;

		$$self.$$.update = () => {
			if ($$self.$$.dirty & /*$tick, placeholder*/ 192) {
				 $$invalidate(1, tru_placeholder = calc_offset($tick, placeholder));
			}
		};

		return [
			omni,
			tru_placeholder,
			$THEME_BORDER,
			execute,
			command,
			system,
			placeholder,
			$tick,
			place_default,
			calc_offset,
			commands,
			input_input_handler,
			keydown_handler
		];
	}

	class Omni extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance, create_fragment, safe_not_equal, { command: 4, system: 5 });

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "Omni",
				options,
				id: create_fragment.name
			});
		}

		get command() {
			throw new Error("<Omni>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set command(value) {
			throw new Error("<Omni>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get system() {
			throw new Error("<Omni>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set system(value) {
			throw new Error("<Omni>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* src\_client\image\Tile.svelte generated by Svelte v3.16.7 */
	const file$1 = "src\\_client\\image\\Tile.svelte";

	// (1:0) <script>  import { tile }
	function create_catch_block(ctx) {
		const block = { c: noop$1, m: noop$1, p: noop$1, d: noop$1 };

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_catch_block.name,
			type: "catch",
			source: "(1:0) <script>  import { tile }",
			ctx
		});

		return block;
	}

	// (24:28)   <img      class="tileset"      alt="tileset image"      {src}
	function create_then_block(ctx) {
		let img;
		let img_src_value;

		const block = {
			c: function create() {
				img = element("img");
				attr_dev(img, "class", "tileset svelte-1jo87w8");
				attr_dev(img, "alt", "tileset image");
				if (img.src !== (img_src_value = /*src*/ ctx[7])) attr_dev(img, "src", img_src_value);
				add_location(img, file$1, 24, 0, 374);
			},
			m: function mount(target, anchor) {
				insert_dev(target, img, anchor);
			},
			p: function update(ctx, dirty) {
				if (dirty & /*image_src*/ 1 && img.src !== (img_src_value = /*src*/ ctx[7])) {
					attr_dev(img, "src", img_src_value);
				}
			},
			d: function destroy(detaching) {
				if (detaching) detach_dev(img);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_then_block.name,
			type: "then",
			source: "(24:28)   <img      class=\\\"tileset\\\"      alt=\\\"tileset image\\\"      {src}",
			ctx
		});

		return block;
	}

	// (1:0) <script>  import { tile }
	function create_pending_block(ctx) {
		const block = { c: noop$1, m: noop$1, p: noop$1, d: noop$1 };

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_pending_block.name,
			type: "pending",
			source: "(1:0) <script>  import { tile }",
			ctx
		});

		return block;
	}

	function create_fragment$1(ctx) {
		let await_block_anchor;
		let promise;

		let info = {
			ctx,
			current: null,
			token: null,
			pending: create_pending_block,
			then: create_then_block,
			catch: create_catch_block,
			value: 7
		};

		handle_promise(promise = /*image_src*/ ctx[0], info);

		const block = {
			c: function create() {
				await_block_anchor = empty();
				info.block.c();
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				insert_dev(target, await_block_anchor, anchor);
				info.block.m(target, info.anchor = anchor);
				info.mount = () => await_block_anchor.parentNode;
				info.anchor = await_block_anchor;
			},
			p: function update(new_ctx, [dirty]) {
				ctx = new_ctx;
				info.ctx = ctx;

				if (dirty & /*image_src*/ 1 && promise !== (promise = /*image_src*/ ctx[0]) && handle_promise(promise, info)) ; else {
					const child_ctx = ctx.slice();
					child_ctx[7] = info.resolved;
					info.block.p(child_ctx, dirty);
				}
			},
			i: noop$1,
			o: noop$1,
			d: function destroy(detaching) {
				if (detaching) detach_dev(await_block_anchor);
				info.block.d(detaching);
				info.token = null;
				info = null;
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$1.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function instance$1($$self, $$props, $$invalidate) {
		let { data = `` } = $$props;
		let { width = 10 } = $$props;
		let { height = 7 } = $$props;
		let { random = false } = $$props;
		let { text = false } = $$props;
		const writable_props = ["data", "width", "height", "random", "text"];

		Object.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Tile> was created with unknown prop '${key}'`);
		});

		$$self.$set = $$props => {
			if ("data" in $$props) $$invalidate(1, data = $$props.data);
			if ("width" in $$props) $$invalidate(2, width = $$props.width);
			if ("height" in $$props) $$invalidate(3, height = $$props.height);
			if ("random" in $$props) $$invalidate(4, random = $$props.random);
			if ("text" in $$props) $$invalidate(5, text = $$props.text);
		};

		$$self.$capture_state = () => {
			return {
				data,
				width,
				height,
				random,
				text,
				tru_data,
				image_src
			};
		};

		$$self.$inject_state = $$props => {
			if ("data" in $$props) $$invalidate(1, data = $$props.data);
			if ("width" in $$props) $$invalidate(2, width = $$props.width);
			if ("height" in $$props) $$invalidate(3, height = $$props.height);
			if ("random" in $$props) $$invalidate(4, random = $$props.random);
			if ("text" in $$props) $$invalidate(5, text = $$props.text);
			if ("tru_data" in $$props) $$invalidate(6, tru_data = $$props.tru_data);
			if ("image_src" in $$props) $$invalidate(0, image_src = $$props.image_src);
		};

		let tru_data;
		let image_src;

		$$self.$$.update = () => {
			if ($$self.$$.dirty & /*text, data*/ 34) {
				 $$invalidate(6, tru_data = text ? tile(text) : data);
			}

			if ($$self.$$.dirty & /*width, height, tru_data, random*/ 92) {
				 $$invalidate(0, image_src = Tile({ width, height, data: tru_data, random }));
			}
		};

		return [image_src, data, width, height, random, text];
	}

	class Tile_1 extends SvelteComponentDev {
		constructor(options) {
			super(options);

			init(this, options, instance$1, create_fragment$1, safe_not_equal, {
				data: 1,
				width: 2,
				height: 3,
				random: 4,
				text: 5
			});

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "Tile_1",
				options,
				id: create_fragment$1.name
			});
		}

		get data() {
			throw new Error("<Tile>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set data(value) {
			throw new Error("<Tile>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get width() {
			throw new Error("<Tile>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set width(value) {
			throw new Error("<Tile>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get height() {
			throw new Error("<Tile>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set height(value) {
			throw new Error("<Tile>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get random() {
			throw new Error("<Tile>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set random(value) {
			throw new Error("<Tile>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get text() {
			throw new Error("<Tile>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set text(value) {
			throw new Error("<Tile>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* src\_client\weave\Postage.svelte generated by Svelte v3.16.7 */
	const file$2 = "src\\_client\\weave\\Postage.svelte";

	function create_fragment$2(ctx) {
		let div;
		let current;

		const tile = new Tile_1({
				props: {
					width: 1,
					height: 1,
					text: /*address*/ ctx[0]
				},
				$$inline: true
			});

		const block = {
			c: function create() {
				div = element("div");
				create_component(tile.$$.fragment);
				attr_dev(div, "class", "postage svelte-1qad2nn");
				toggle_class(div, "isrunning", /*isrunning*/ ctx[4]);
				toggle_class(div, "isrezed", /*isrezed*/ ctx[6]);
				toggle_class(div, "issystem", /*issystem*/ ctx[5]);
				add_location(div, file$2, 26, 0, 498);
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				insert_dev(target, div, anchor);
				mount_component(tile, div, null);
				current = true;
			},
			p: function update(ctx, [dirty]) {
				const tile_changes = {};
				if (dirty & /*address*/ 1) tile_changes.text = /*address*/ ctx[0];
				tile.$set(tile_changes);

				if (dirty & /*isrunning*/ 16) {
					toggle_class(div, "isrunning", /*isrunning*/ ctx[4]);
				}

				if (dirty & /*isrezed*/ 64) {
					toggle_class(div, "isrezed", /*isrezed*/ ctx[6]);
				}

				if (dirty & /*issystem*/ 32) {
					toggle_class(div, "issystem", /*issystem*/ ctx[5]);
				}
			},
			i: function intro(local) {
				if (current) return;
				transition_in(tile.$$.fragment, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(tile.$$.fragment, local);
				current = false;
			},
			d: function destroy(detaching) {
				if (detaching) detach_dev(div);
				destroy_component(tile);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$2.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function instance$2($$self, $$props, $$invalidate) {
		let $names,
			$$unsubscribe_names = noop$1,
			$$subscribe_names = () => ($$unsubscribe_names(), $$unsubscribe_names = subscribe(names, $$value => $$invalidate(9, $names = $$value)), names);

		let $running,
			$$unsubscribe_running = noop$1,
			$$subscribe_running = () => ($$unsubscribe_running(), $$unsubscribe_running = subscribe(running, $$value => $$invalidate(11, $running = $$value)), running);

		let $rezed,
			$$unsubscribe_rezed = noop$1,
			$$subscribe_rezed = () => ($$unsubscribe_rezed(), $$unsubscribe_rezed = subscribe(rezed, $$value => $$invalidate(12, $rezed = $$value)), rezed);

		$$self.$$.on_destroy.push(() => $$unsubscribe_names());
		$$self.$$.on_destroy.push(() => $$unsubscribe_running());
		$$self.$$.on_destroy.push(() => $$unsubscribe_rezed());
		let { address = `` } = $$props;
		const [,w_id, k_id] = address.split(`/`);
		const writable_props = ["address"];

		Object.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Postage> was created with unknown prop '${key}'`);
		});

		$$self.$set = $$props => {
			if ("address" in $$props) $$invalidate(0, address = $$props.address);
		};

		$$self.$capture_state = () => {
			return {
				address,
				running,
				weave,
				names,
				rezed,
				warp,
				$names,
				id,
				isrunning,
				$running,
				issystem,
				isrezed,
				$rezed
			};
		};

		$$self.$inject_state = $$props => {
			if ("address" in $$props) $$invalidate(0, address = $$props.address);
			if ("running" in $$props) $$subscribe_running($$invalidate(1, running = $$props.running));
			if ("weave" in $$props) $$invalidate(7, weave = $$props.weave);
			if ("names" in $$props) $$subscribe_names($$invalidate(2, names = $$props.names));
			if ("rezed" in $$props) $$subscribe_rezed($$invalidate(3, rezed = $$props.rezed));
			if ("warp" in $$props) $$invalidate(8, warp = $$props.warp);
			if ("$names" in $$props) names.set($names = $$props.$names);
			if ("id" in $$props) $$invalidate(10, id = $$props.id);
			if ("isrunning" in $$props) $$invalidate(4, isrunning = $$props.isrunning);
			if ("$running" in $$props) running.set($running = $$props.$running);
			if ("issystem" in $$props) $$invalidate(5, issystem = $$props.issystem);
			if ("isrezed" in $$props) $$invalidate(6, isrezed = $$props.isrezed);
			if ("$rezed" in $$props) rezed.set($rezed = $$props.$rezed);
		};

		let running;
		let weave;
		let names;
		let rezed;
		let warp;
		let id;
		let isrunning;
		let issystem;
		let isrezed;

		$$self.$$.update = () => {
			if ($$self.$$.dirty & /*weave*/ 128) {
				 $$subscribe_names($$invalidate(2, names = weave.names));
			}

			if ($$self.$$.dirty & /*weave*/ 128) {
				 $$subscribe_rezed($$invalidate(3, rezed = weave.rezed));
			}

			if ($$self.$$.dirty & /*$names*/ 512) {
				 $$invalidate(8, warp = $names[k_id]);
			}

			if ($$self.$$.dirty & /*warp*/ 256) {
				 $$invalidate(10, id = warp ? warp.id.get() : ``);
			}

			if ($$self.$$.dirty & /*$running*/ 2048) {
				 $$invalidate(4, isrunning = $running[w_id] === true);
			}

			if ($$self.$$.dirty & /*$rezed, id*/ 5120) {
				 $$invalidate(6, isrezed = $rezed[id]);
			}
		};

		 $$subscribe_running($$invalidate(1, running = Wheel.running));
		 $$invalidate(7, weave = Wheel.get(w_id) || Wheel.get(Wheel.SYSTEM));
		 $$invalidate(5, issystem = w_id === Wheel.SYSTEM);
		return [address, running, names, rezed, isrunning, issystem, isrezed];
	}

	class Postage extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$2, create_fragment$2, safe_not_equal, { address: 0 });

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "Postage",
				options,
				id: create_fragment$2.name
			});
		}

		get address() {
			throw new Error("<Postage>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set address(value) {
			throw new Error("<Postage>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* src\_client\weave\Controls.svelte generated by Svelte v3.16.7 */
	const file$3 = "src\\_client\\weave\\Controls.svelte";

	// (47:2) {#if $name !== Wheel.SYSTEM}
	function create_if_block(ctx) {
		let div;
		let promise;
		let dispose;

		let info = {
			ctx,
			current: null,
			token: null,
			pending: create_pending_block$1,
			then: create_then_block$1,
			catch: create_catch_block$1,
			value: 13
		};

		handle_promise(promise = image(/*weave*/ ctx[0].name.get()), info);

		const block = {
			c: function create() {
				div = element("div");
				info.block.c();
				attr_dev(div, "class", "save svelte-1gi8jdd");
				add_location(div, file$3, 47, 2, 850);
				dispose = listen_dev(div, "click", /*save_it*/ ctx[2], false, false, false);
			},
			m: function mount(target, anchor) {
				insert_dev(target, div, anchor);
				info.block.m(div, info.anchor = null);
				info.mount = () => div;
				info.anchor = null;
			},
			p: function update(new_ctx, dirty) {
				ctx = new_ctx;
				info.ctx = ctx;

				if (dirty & /*weave*/ 1 && promise !== (promise = image(/*weave*/ ctx[0].name.get())) && handle_promise(promise, info)) ; else {
					const child_ctx = ctx.slice();
					child_ctx[13] = info.resolved;
					info.block.p(child_ctx, dirty);
				}
			},
			d: function destroy(detaching) {
				if (detaching) detach_dev(div);
				info.block.d();
				info.token = null;
				info = null;
				dispose();
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block.name,
			type: "if",
			source: "(47:2) {#if $name !== Wheel.SYSTEM}",
			ctx
		});

		return block;
	}

	// (1:0) <script>  import { save, image }
	function create_catch_block$1(ctx) {
		const block = { c: noop$1, m: noop$1, p: noop$1, d: noop$1 };

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_catch_block$1.name,
			type: "catch",
			source: "(1:0) <script>  import { save, image }",
			ctx
		});

		return block;
	}

	// (52:45)         <img {src}
	function create_then_block$1(ctx) {
		let img;
		let img_src_value;

		const block = {
			c: function create() {
				img = element("img");
				if (img.src !== (img_src_value = /*src*/ ctx[13])) attr_dev(img, "src", img_src_value);
				attr_dev(img, "alt", "save");
				attr_dev(img, "class", "svelte-1gi8jdd");
				add_location(img, file$3, 52, 6, 956);
			},
			m: function mount(target, anchor) {
				insert_dev(target, img, anchor);
			},
			p: function update(ctx, dirty) {
				if (dirty & /*weave*/ 1 && img.src !== (img_src_value = /*src*/ ctx[13])) {
					attr_dev(img, "src", img_src_value);
				}
			},
			d: function destroy(detaching) {
				if (detaching) detach_dev(img);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_then_block$1.name,
			type: "then",
			source: "(52:45)         <img {src}",
			ctx
		});

		return block;
	}

	// (1:0) <script>  import { save, image }
	function create_pending_block$1(ctx) {
		const block = { c: noop$1, m: noop$1, p: noop$1, d: noop$1 };

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_pending_block$1.name,
			type: "pending",
			source: "(1:0) <script>  import { save, image }",
			ctx
		});

		return block;
	}

	function create_fragment$3(ctx) {
		let div1;
		let div0;
		let t0;
		let t1;
		let current;
		let dispose;

		const postage = new Postage({
				props: { address: `/${/*$name*/ ctx[5]}` },
				$$inline: true
			});

		const default_slot_template = /*$$slots*/ ctx[12].default;
		const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[11], null);
		let if_block = /*$name*/ ctx[5] !== Wheel.SYSTEM && create_if_block(ctx);

		const block = {
			c: function create() {
				div1 = element("div");
				div0 = element("div");
				create_component(postage.$$.fragment);
				t0 = space$1();
				if (default_slot) default_slot.c();
				t1 = space$1();
				if (if_block) if_block.c();
				attr_dev(div0, "class", "postage svelte-1gi8jdd");
				add_location(div0, file$3, 40, 1, 703);
				attr_dev(div1, "class", "controls svelte-1gi8jdd");
				add_location(div1, file$3, 37, 0, 673);
				dispose = listen_dev(div0, "click", /*toggle*/ ctx[1], false, false, false);
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				insert_dev(target, div1, anchor);
				append_dev(div1, div0);
				mount_component(postage, div0, null);
				append_dev(div1, t0);

				if (default_slot) {
					default_slot.m(div1, null);
				}

				append_dev(div1, t1);
				if (if_block) if_block.m(div1, null);
				current = true;
			},
			p: function update(ctx, [dirty]) {
				const postage_changes = {};
				if (dirty & /*$name*/ 32) postage_changes.address = `/${/*$name*/ ctx[5]}`;
				postage.$set(postage_changes);

				if (default_slot && default_slot.p && dirty & /*$$scope*/ 2048) {
					default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[11], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[11], dirty, null));
				}

				if (/*$name*/ ctx[5] !== Wheel.SYSTEM) {
					if (if_block) {
						if_block.p(ctx, dirty);
					} else {
						if_block = create_if_block(ctx);
						if_block.c();
						if_block.m(div1, null);
					}
				} else if (if_block) {
					if_block.d(1);
					if_block = null;
				}
			},
			i: function intro(local) {
				if (current) return;
				transition_in(postage.$$.fragment, local);
				transition_in(default_slot, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(postage.$$.fragment, local);
				transition_out(default_slot, local);
				current = false;
			},
			d: function destroy(detaching) {
				if (detaching) detach_dev(div1);
				destroy_component(postage);
				if (default_slot) default_slot.d(detaching);
				if (if_block) if_block.d();
				dispose();
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$3.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function instance$3($$self, $$props, $$invalidate) {
		let $running,
			$$unsubscribe_running = noop$1,
			$$subscribe_running = () => ($$unsubscribe_running(), $$unsubscribe_running = subscribe(running, $$value => $$invalidate(7, $running = $$value)), running);

		let $name,
			$$unsubscribe_name = noop$1,
			$$subscribe_name = () => ($$unsubscribe_name(), $$unsubscribe_name = subscribe(name, $$value => $$invalidate(5, $name = $$value)), name);

		let $THEME_BORDER;
		let $THEME_BG;
		validate_store(THEME_BORDER, "THEME_BORDER");
		component_subscribe($$self, THEME_BORDER, $$value => $$invalidate(9, $THEME_BORDER = $$value));
		validate_store(THEME_BG, "THEME_BG");
		component_subscribe($$self, THEME_BG, $$value => $$invalidate(10, $THEME_BG = $$value));
		$$self.$$.on_destroy.push(() => $$unsubscribe_running());
		$$self.$$.on_destroy.push(() => $$unsubscribe_name());
		let { weave } = $$props;

		const toggle = e => {
			if (e) {
				e.stopPropagation();
				e.preventDefault();
			}

			if (runs) {
				Wheel.stop($name);
			} else {
				Wheel.start($name);
			}

			runs = !runs;
		};

		const save_it = e => {
			if (e) {
				e.preventDefault();
				e.stopPropagation();
			}

			save(weave);
		};

		const writable_props = ["weave"];

		Object.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Controls> was created with unknown prop '${key}'`);
		});

		let { $$slots = {}, $$scope } = $$props;

		$$self.$set = $$props => {
			if ("weave" in $$props) $$invalidate(0, weave = $$props.weave);
			if ("$$scope" in $$props) $$invalidate(11, $$scope = $$props.$$scope);
		};

		$$self.$capture_state = () => {
			return {
				weave,
				name,
				running,
				runs,
				$running,
				$name,
				style,
				$THEME_BORDER,
				$THEME_BG
			};
		};

		$$self.$inject_state = $$props => {
			if ("weave" in $$props) $$invalidate(0, weave = $$props.weave);
			if ("name" in $$props) $$subscribe_name($$invalidate(3, name = $$props.name));
			if ("running" in $$props) $$subscribe_running($$invalidate(4, running = $$props.running));
			if ("runs" in $$props) runs = $$props.runs;
			if ("$running" in $$props) running.set($running = $$props.$running);
			if ("$name" in $$props) name.set($name = $$props.$name);
			if ("style" in $$props) style = $$props.style;
			if ("$THEME_BORDER" in $$props) THEME_BORDER.set($THEME_BORDER = $$props.$THEME_BORDER);
			if ("$THEME_BG" in $$props) THEME_BG.set($THEME_BG = $$props.$THEME_BG);
		};

		let name;
		let running;
		let runs;
		let style;

		$$self.$$.update = () => {
			if ($$self.$$.dirty & /*weave*/ 1) {
				 $$subscribe_name($$invalidate(3, name = weave.name));
			}

			if ($$self.$$.dirty & /*$running, weave*/ 129) {
				 runs = $running[weave.name.get()];
			}

			if ($$self.$$.dirty & /*$THEME_BORDER, $THEME_BG*/ 1536) {
				 style = `border: 0.25rem solid ${$THEME_BORDER}; background-color: ${$THEME_BG};`;
			}
		};

		 $$subscribe_running($$invalidate(4, running = Wheel.running));

		return [
			weave,
			toggle,
			save_it,
			name,
			running,
			$name,
			runs,
			$running,
			style,
			$THEME_BORDER,
			$THEME_BG,
			$$scope,
			$$slots
		];
	}

	class Controls extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$3, create_fragment$3, safe_not_equal, { weave: 0, toggle: 1, save_it: 2 });

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "Controls",
				options,
				id: create_fragment$3.name
			});

			const { ctx } = this.$$;
			const props = options.props || ({});

			if (/*weave*/ ctx[0] === undefined && !("weave" in props)) {
				console.warn("<Controls> was created without expected prop 'weave'");
			}
		}

		get weave() {
			throw new Error("<Controls>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set weave(value) {
			throw new Error("<Controls>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get toggle() {
			return this.$$.ctx[1];
		}

		set toggle(value) {
			throw new Error("<Controls>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get save_it() {
			return this.$$.ctx[2];
		}

		set save_it(value) {
			throw new Error("<Controls>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	var color$2 = (node, txt_init) => {
		const handler = {
			update: (txt) => {
				const bg = Color(THEME_BG.get());
				const col = Color(color(JSON.stringify(txt)))
					.blend(bg, 0.8);

				node.style.backgroundColor = col
					.toCSS();
			}
		};

		handler.update(txt_init);
		return handler
	};

	const dark = (node, txt) => {
		const update = () => {
			node.style.backgroundColor = Color(color(JSON.stringify(txt)))
				.blend(Color(THEME_BG.get()), 0.8)
				.darkenByRatio(0.2);
		};

		update();

		return {
			update
		}
	};

	/* src\_client\explore\Flock.svelte generated by Svelte v3.16.7 */
	const file$4 = "src\\_client\\explore\\Flock.svelte";

	function create_fragment$4(ctx) {
		let div4;
		let div3;
		let div0;
		let color_action;
		let t1;
		let div1;
		let t2_value = `~~${/*$bird_name*/ ctx[5]}~~` + "";
		let t2;
		let t3;
		let t4_value = /*birdex*/ ctx[1] + 1 + "";
		let t4;
		let t5;
		let t6_value = /*$birds*/ ctx[2].length + "";
		let t6;
		let t7;
		let div2;
		let color_action_1;
		let t9;
		let current;
		let dispose;
		const default_slot_template = /*$$slots*/ ctx[11].default;
		const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[10], null);

		const block = {
			c: function create() {
				div4 = element("div");
				div3 = element("div");
				div0 = element("div");
				div0.textContent = "<";
				t1 = space$1();
				div1 = element("div");
				t2 = text(t2_value);
				t3 = text(" : ");
				t4 = text(t4_value);
				t5 = text(" : ");
				t6 = text(t6_value);
				t7 = space$1();
				div2 = element("div");
				div2.textContent = ">";
				t9 = space$1();
				if (default_slot) default_slot.c();
				attr_dev(div0, "class", "button svelte-8194ou");
				add_location(div0, file$4, 38, 2, 724);
				attr_dev(div1, "class", "flex svelte-8194ou");
				add_location(div1, file$4, 50, 2, 984);
				attr_dev(div2, "class", "button svelte-8194ou");
				add_location(div2, file$4, 51, 2, 1067);
				attr_dev(div3, "class", "navigation svelte-8194ou");
				set_style(div3, "background-color", /*$THEME_BORDER*/ ctx[4]);
				add_location(div3, file$4, 36, 1, 651);
				attr_dev(div4, "class", "sub_space svelte-8194ou");
				add_location(div4, file$4, 32, 0, 619);

				dispose = [
					listen_dev(div0, "click", /*click_handler*/ ctx[12], false, false, false),
					action_destroyer(color_action = color$2.call(null, div0, /*$bird_name*/ ctx[5])),
					action_destroyer(color_action_1 = color$2.call(null, div2, /*$bird_name*/ ctx[5])),
					listen_dev(div2, "click", /*click_handler_1*/ ctx[13], false, false, false)
				];
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				insert_dev(target, div4, anchor);
				append_dev(div4, div3);
				append_dev(div3, div0);
				append_dev(div3, t1);
				append_dev(div3, div1);
				append_dev(div1, t2);
				append_dev(div1, t3);
				append_dev(div1, t4);
				append_dev(div1, t5);
				append_dev(div1, t6);
				append_dev(div3, t7);
				append_dev(div3, div2);
				append_dev(div4, t9);

				if (default_slot) {
					default_slot.m(div4, null);
				}

				current = true;
			},
			p: function update(ctx, [dirty]) {
				if (color_action && is_function(color_action.update) && dirty & /*$bird_name*/ 32) color_action.update.call(null, /*$bird_name*/ ctx[5]);
				if ((!current || dirty & /*$bird_name*/ 32) && t2_value !== (t2_value = `~~${/*$bird_name*/ ctx[5]}~~` + "")) set_data_dev(t2, t2_value);
				if ((!current || dirty & /*birdex*/ 2) && t4_value !== (t4_value = /*birdex*/ ctx[1] + 1 + "")) set_data_dev(t4, t4_value);
				if ((!current || dirty & /*$birds*/ 4) && t6_value !== (t6_value = /*$birds*/ ctx[2].length + "")) set_data_dev(t6, t6_value);
				if (color_action_1 && is_function(color_action_1.update) && dirty & /*$bird_name*/ 32) color_action_1.update.call(null, /*$bird_name*/ ctx[5]);

				if (!current || dirty & /*$THEME_BORDER*/ 16) {
					set_style(div3, "background-color", /*$THEME_BORDER*/ ctx[4]);
				}

				if (default_slot && default_slot.p && dirty & /*$$scope*/ 1024) {
					default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[10], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[10], dirty, null));
				}
			},
			i: function intro(local) {
				if (current) return;
				transition_in(default_slot, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(default_slot, local);
				current = false;
			},
			d: function destroy(detaching) {
				if (detaching) detach_dev(div4);
				if (default_slot) default_slot.d(detaching);
				run_all(dispose);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$4.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function instance$4($$self, $$props, $$invalidate) {
		let $birds,
			$$unsubscribe_birds = noop$1,
			$$subscribe_birds = () => ($$unsubscribe_birds(), $$unsubscribe_birds = subscribe(birds, $$value => $$invalidate(2, $birds = $$value)), birds);

		let $THEME_BORDER;

		let $bird_name,
			$$unsubscribe_bird_name = noop$1,
			$$subscribe_bird_name = () => ($$unsubscribe_bird_name(), $$unsubscribe_bird_name = subscribe(bird_name, $$value => $$invalidate(5, $bird_name = $$value)), bird_name);

		validate_store(THEME_BORDER, "THEME_BORDER");
		component_subscribe($$self, THEME_BORDER, $$value => $$invalidate(4, $THEME_BORDER = $$value));
		$$self.$$.on_destroy.push(() => $$unsubscribe_birds());
		$$self.$$.on_destroy.push(() => $$unsubscribe_bird_name());
		let { weave } = $$props;
		let { birds = read([]) } = $$props;
		validate_store(birds, "birds");
		$$subscribe_birds();
		let { set_bird } = $$props;
		let birdex = 0;
		let last_bird = false;
		const writable_props = ["weave", "birds", "set_bird"];

		Object.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Flock> was created with unknown prop '${key}'`);
		});

		let { $$slots = {}, $$scope } = $$props;

		const click_handler = () => {
			let bird_new = birdex - 1;
			if (bird_new < 0) bird_new = $birds.length - 1;
			if ($birds.length === undefined) bird_new = 0;
			$$invalidate(1, birdex = bird_new);
		};

		const click_handler_1 = () => {
			let bird_new = birdex + 1;
			if ($birds.length === undefined) bird_new = 0;
			if (bird_new >= $birds.length) bird_new = 0;
			$$invalidate(1, birdex = bird_new);
		};

		$$self.$set = $$props => {
			if ("weave" in $$props) $$invalidate(6, weave = $$props.weave);
			if ("birds" in $$props) $$subscribe_birds($$invalidate(0, birds = $$props.birds));
			if ("set_bird" in $$props) $$invalidate(7, set_bird = $$props.set_bird);
			if ("$$scope" in $$props) $$invalidate(10, $$scope = $$props.$$scope);
		};

		$$self.$capture_state = () => {
			return {
				weave,
				birds,
				set_bird,
				birdex,
				last_bird,
				bird,
				$birds,
				bird_name,
				$THEME_BORDER,
				$bird_name
			};
		};

		$$self.$inject_state = $$props => {
			if ("weave" in $$props) $$invalidate(6, weave = $$props.weave);
			if ("birds" in $$props) $$subscribe_birds($$invalidate(0, birds = $$props.birds));
			if ("set_bird" in $$props) $$invalidate(7, set_bird = $$props.set_bird);
			if ("birdex" in $$props) $$invalidate(1, birdex = $$props.birdex);
			if ("last_bird" in $$props) $$invalidate(8, last_bird = $$props.last_bird);
			if ("bird" in $$props) $$invalidate(9, bird = $$props.bird);
			if ("$birds" in $$props) birds.set($birds = $$props.$birds);
			if ("bird_name" in $$props) $$subscribe_bird_name($$invalidate(3, bird_name = $$props.bird_name));
			if ("$THEME_BORDER" in $$props) THEME_BORDER.set($THEME_BORDER = $$props.$THEME_BORDER);
			if ("$bird_name" in $$props) bird_name.set($bird_name = $$props.$bird_name);
		};

		let bird;
		let bird_name;

		$$self.$$.update = () => {
			if ($$self.$$.dirty & /*weave, $birds, birdex*/ 70) {
				 $$invalidate(9, bird = weave.get_id($birds[birdex]));
			}

			if ($$self.$$.dirty & /*last_bird, bird, birdex, set_bird, weave, $birds*/ 966) {
				 {
					if (last_bird === false) $$invalidate(8, last_bird = bird);

					if (bird && bird !== last_bird) {
						$$invalidate(9, bird.birdex = birdex, bird);
						set_bird(bird);
						$$invalidate(8, last_bird = bird);
					}

					if (!bird) {
						requestAnimationFrame(() => {
							$$invalidate(9, bird = weave.get_id($birds[birdex]));
						});
					}
				}
			}

			if ($$self.$$.dirty & /*bird*/ 512) {
				 $$subscribe_bird_name($$invalidate(3, bird_name = bird ? bird.name() : read(``)));
			}
		};

		return [
			birds,
			birdex,
			$birds,
			bird_name,
			$THEME_BORDER,
			$bird_name,
			weave,
			set_bird,
			last_bird,
			bird,
			$$scope,
			$$slots,
			click_handler,
			click_handler_1
		];
	}

	class Flock extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$4, create_fragment$4, safe_not_equal, { weave: 6, birds: 0, set_bird: 7 });

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "Flock",
				options,
				id: create_fragment$4.name
			});

			const { ctx } = this.$$;
			const props = options.props || ({});

			if (/*weave*/ ctx[6] === undefined && !("weave" in props)) {
				console.warn("<Flock> was created without expected prop 'weave'");
			}

			if (/*set_bird*/ ctx[7] === undefined && !("set_bird" in props)) {
				console.warn("<Flock> was created without expected prop 'set_bird'");
			}
		}

		get weave() {
			throw new Error("<Flock>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set weave(value) {
			throw new Error("<Flock>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get birds() {
			throw new Error("<Flock>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set birds(value) {
			throw new Error("<Flock>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get set_bird() {
			throw new Error("<Flock>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set set_bird(value) {
			throw new Error("<Flock>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* src\_client\editor\SpriteEditor.svelte generated by Svelte v3.16.7 */
	const file$5 = "src\\_client\\editor\\SpriteEditor.svelte";

	// (87:0) {#if editing}
	function create_if_block_1(ctx) {
		let div1;
		let div0;
		let div1_style_value;
		let arrows_action;
		let dispose;

		const block = {
			c: function create() {
				div1 = element("div");
				div0 = element("div");
				attr_dev(div0, "class", "cursor svelte-prlsd3");
				set_style(div0, "transform", "translate(" + /*x*/ ctx[2] + "px," + /*y*/ ctx[3] + "px)");
				add_location(div0, file$5, 106, 1, 2238);
				attr_dev(div1, "class", "edit svelte-prlsd3");

				attr_dev(div1, "style", div1_style_value = [
					`background-image: url('${/*$SPRITES*/ ctx[6]}');`,
					`background-color: ${/*$THEME_BG*/ ctx[7]};`,
					`border: 1rem solid ${/*$THEME_BORDER*/ ctx[8]};`
				].join(``));

				add_location(div1, file$5, 87, 0, 1913);

				dispose = [
					action_destroyer(arrows_action = /*arrows*/ ctx[12].call(null, div1)),
					listen_dev(div1, "click", /*click_handler*/ ctx[24], false, false, false),
					listen_dev(div1, "mousemove", /*track*/ ctx[9], false, false, false)
				];
			},
			m: function mount(target, anchor) {
				insert_dev(target, div1, anchor);
				append_dev(div1, div0);
				/*div1_binding*/ ctx[23](div1);
			},
			p: function update(ctx, dirty) {
				if (dirty & /*x, y*/ 12) {
					set_style(div0, "transform", "translate(" + /*x*/ ctx[2] + "px," + /*y*/ ctx[3] + "px)");
				}

				if (dirty & /*$SPRITES, $THEME_BG, $THEME_BORDER*/ 448 && div1_style_value !== (div1_style_value = [
					`background-image: url('${/*$SPRITES*/ ctx[6]}');`,
					`background-color: ${/*$THEME_BG*/ ctx[7]};`,
					`border: 1rem solid ${/*$THEME_BORDER*/ ctx[8]};`
				].join(``))) {
					attr_dev(div1, "style", div1_style_value);
				}
			},
			d: function destroy(detaching) {
				if (detaching) detach_dev(div1);
				/*div1_binding*/ ctx[23](null);
				run_all(dispose);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block_1.name,
			type: "if",
			source: "(87:0) {#if editing}",
			ctx
		});

		return block;
	}

	// (123:1) {#if value}
	function create_if_block$1(ctx) {
		let current;

		const tile = new Tile_1({
				props: {
					width: 1,
					height: 1,
					data: JSON.stringify(/*$value*/ ctx[5])
				},
				$$inline: true
			});

		const block = {
			c: function create() {
				create_component(tile.$$.fragment);
			},
			m: function mount(target, anchor) {
				mount_component(tile, target, anchor);
				current = true;
			},
			p: function update(ctx, dirty) {
				const tile_changes = {};
				if (dirty & /*$value*/ 32) tile_changes.data = JSON.stringify(/*$value*/ ctx[5]);
				tile.$set(tile_changes);
			},
			i: function intro(local) {
				if (current) return;
				transition_in(tile.$$.fragment, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(tile.$$.fragment, local);
				current = false;
			},
			d: function destroy(detaching) {
				destroy_component(tile, detaching);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block$1.name,
			type: "if",
			source: "(123:1) {#if value}",
			ctx
		});

		return block;
	}

	function create_fragment$5(ctx) {
		let t;
		let div;
		let current;
		let dispose;
		let if_block0 = /*editing*/ ctx[0] && create_if_block_1(ctx);
		let if_block1 = /*value*/ ctx[1] && create_if_block$1(ctx);

		const block = {
			c: function create() {
				if (if_block0) if_block0.c();
				t = space$1();
				div = element("div");
				if (if_block1) if_block1.c();
				attr_dev(div, "class", "tile svelte-prlsd3");
				add_location(div, file$5, 114, 0, 2365);

				dispose = [
					listen_dev(window, "click", /*blur*/ ctx[11], false, false, false),
					listen_dev(div, "click", /*click_handler_1*/ ctx[25], false, false, false)
				];
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				if (if_block0) if_block0.m(target, anchor);
				insert_dev(target, t, anchor);
				insert_dev(target, div, anchor);
				if (if_block1) if_block1.m(div, null);
				current = true;
			},
			p: function update(ctx, [dirty]) {
				if (/*editing*/ ctx[0]) {
					if (if_block0) {
						if_block0.p(ctx, dirty);
					} else {
						if_block0 = create_if_block_1(ctx);
						if_block0.c();
						if_block0.m(t.parentNode, t);
					}
				} else if (if_block0) {
					if_block0.d(1);
					if_block0 = null;
				}

				if (/*value*/ ctx[1]) {
					if (if_block1) {
						if_block1.p(ctx, dirty);
						transition_in(if_block1, 1);
					} else {
						if_block1 = create_if_block$1(ctx);
						if_block1.c();
						transition_in(if_block1, 1);
						if_block1.m(div, null);
					}
				} else if (if_block1) {
					group_outros();

					transition_out(if_block1, 1, 1, () => {
						if_block1 = null;
					});

					check_outros();
				}
			},
			i: function intro(local) {
				if (current) return;
				transition_in(if_block1);
				current = true;
			},
			o: function outro(local) {
				transition_out(if_block1);
				current = false;
			},
			d: function destroy(detaching) {
				if (if_block0) if_block0.d(detaching);
				if (detaching) detach_dev(t);
				if (detaching) detach_dev(div);
				if (if_block1) if_block1.d();
				run_all(dispose);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$5.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function instance$5($$self, $$props, $$invalidate) {
		let $value,
			$$unsubscribe_value = noop$1,
			$$subscribe_value = () => ($$unsubscribe_value(), $$unsubscribe_value = subscribe(value, $$value => $$invalidate(5, $value = $$value)), value);

		let $TILE_COLUMNS;
		let $buttons;
		let $SPRITES;
		let $THEME_BG;
		let $THEME_BORDER;
		validate_store(TILE_COLUMNS, "TILE_COLUMNS");
		component_subscribe($$self, TILE_COLUMNS, $$value => $$invalidate(18, $TILE_COLUMNS = $$value));
		validate_store(buttons$1, "buttons");
		component_subscribe($$self, buttons$1, $$value => $$invalidate(19, $buttons = $$value));
		validate_store(SPRITES, "SPRITES");
		component_subscribe($$self, SPRITES, $$value => $$invalidate(6, $SPRITES = $$value));
		validate_store(THEME_BG, "THEME_BG");
		component_subscribe($$self, THEME_BG, $$value => $$invalidate(7, $THEME_BG = $$value));
		validate_store(THEME_BORDER, "THEME_BORDER");
		component_subscribe($$self, THEME_BORDER, $$value => $$invalidate(8, $THEME_BORDER = $$value));
		$$self.$$.on_destroy.push(() => $$unsubscribe_value());
		let { back = false } = $$props;
		let { value } = $$props;
		validate_store(value, "value");
		$$subscribe_value();
		let { editing = false } = $$props;

		const click = () => {
			update_selection();
			return back;
		};

		let k_x = $value % $TILE_COLUMNS;
		let k_y = Math.floor($value / $TILE_COLUMNS);
		let x = 0;
		let y = 0;
		let ratio;

		const to_grid = (num, ratio) => {
			const v = Math.round((num - ratio) / ratio);
			return Math.max(0, Math.min(v, $TILE_COLUMNS - 1));
		};

		const fix = e => {
			const [half_w, half_h] = [e.target.clientWidth / 2, e.target.clientHeight / 2];
			return [e.layerX + half_w, e.layerY + half_h];
		};

		const track = e => {
			ratio = selections.clientWidth / $TILE_COLUMNS;
			const [layer_x, layer_y] = fix(e);
			k_x = to_grid(layer_x, ratio);
			$$invalidate(2, x = k_x * ratio);
			k_y = to_grid(layer_y, ratio);
			$$invalidate(3, y = k_y * ratio);
		};

		const select = e => {
			$$invalidate(2, [x, y] = fix(e), x, $$invalidate(3, y));
			update_selection();
		};

		const update_selection = () => {
			value.set(to_grid(x, ratio) + to_grid(y, ratio) * $TILE_COLUMNS);
			$$invalidate(0, editing = false);
		};

		const blur = () => {
			if (editing) {
				$$invalidate(0, editing = false);
			}
		};

		const arrows = () => {
			const cancel = tick.listen(() => {
				if (selections) {
					ratio = selections.clientWidth / $TILE_COLUMNS;

					if (x === 0 && y === 0) {
						$$invalidate(2, x = k_x * ratio);
						$$invalidate(3, y = k_y * ratio);
					}
				}

				if (ratio === undefined) return;
				if ($buttons.left) $$invalidate(2, x = (k_x === 0 ? $TILE_COLUMNS - 1 : k_x--) * ratio);
				if ($buttons.right) $$invalidate(2, x = (k_x === $TILE_COLUMNS - 1 ? 0 : k_x++) * ratio);
				if ($buttons.up) $$invalidate(3, y = (k_y === 0 ? $TILE_COLUMNS - 1 : k_y--) * ratio);
				if ($buttons.down) $$invalidate(3, y = (k_y === $TILE_COLUMNS - 1 ? 0 : k_y++) * ratio);
			});

			return {
				destroy() {
					cancel();
				}
			};
		};

		let selections;
		const writable_props = ["back", "value", "editing"];

		Object.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<SpriteEditor> was created with unknown prop '${key}'`);
		});

		function div1_binding($$value) {
			binding_callbacks[$$value ? "unshift" : "push"](() => {
				$$invalidate(4, selections = $$value);
			});
		}

		const click_handler = e => {
			e.preventDefault();
			e.stopPropagation();
			select(e);
		};

		const click_handler_1 = e => {
			e.preventDefault();
			e.stopPropagation();
			$$invalidate(0, editing = !editing);
		};

		$$self.$set = $$props => {
			if ("back" in $$props) $$invalidate(13, back = $$props.back);
			if ("value" in $$props) $$subscribe_value($$invalidate(1, value = $$props.value));
			if ("editing" in $$props) $$invalidate(0, editing = $$props.editing);
		};

		$$self.$capture_state = () => {
			return {
				back,
				value,
				editing,
				k_x,
				k_y,
				x,
				y,
				ratio,
				selections,
				$value,
				$TILE_COLUMNS,
				$buttons,
				$SPRITES,
				$THEME_BG,
				$THEME_BORDER
			};
		};

		$$self.$inject_state = $$props => {
			if ("back" in $$props) $$invalidate(13, back = $$props.back);
			if ("value" in $$props) $$subscribe_value($$invalidate(1, value = $$props.value));
			if ("editing" in $$props) $$invalidate(0, editing = $$props.editing);
			if ("k_x" in $$props) k_x = $$props.k_x;
			if ("k_y" in $$props) k_y = $$props.k_y;
			if ("x" in $$props) $$invalidate(2, x = $$props.x);
			if ("y" in $$props) $$invalidate(3, y = $$props.y);
			if ("ratio" in $$props) ratio = $$props.ratio;
			if ("selections" in $$props) $$invalidate(4, selections = $$props.selections);
			if ("$value" in $$props) value.set($value = $$props.$value);
			if ("$TILE_COLUMNS" in $$props) TILE_COLUMNS.set($TILE_COLUMNS = $$props.$TILE_COLUMNS);
			if ("$buttons" in $$props) buttons$1.set($buttons = $$props.$buttons);
			if ("$SPRITES" in $$props) SPRITES.set($SPRITES = $$props.$SPRITES);
			if ("$THEME_BG" in $$props) THEME_BG.set($THEME_BG = $$props.$THEME_BG);
			if ("$THEME_BORDER" in $$props) THEME_BORDER.set($THEME_BORDER = $$props.$THEME_BORDER);
		};

		return [
			editing,
			value,
			x,
			y,
			selections,
			$value,
			$SPRITES,
			$THEME_BG,
			$THEME_BORDER,
			track,
			select,
			blur,
			arrows,
			back,
			click,
			k_x,
			k_y,
			ratio,
			$TILE_COLUMNS,
			$buttons,
			to_grid,
			fix,
			update_selection,
			div1_binding,
			click_handler,
			click_handler_1
		];
	}

	class SpriteEditor extends SvelteComponentDev {
		constructor(options) {
			super(options);

			init(this, options, instance$5, create_fragment$5, safe_not_equal, {
				back: 13,
				value: 1,
				editing: 0,
				click: 14
			});

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "SpriteEditor",
				options,
				id: create_fragment$5.name
			});

			const { ctx } = this.$$;
			const props = options.props || ({});

			if (/*value*/ ctx[1] === undefined && !("value" in props)) {
				console.warn("<SpriteEditor> was created without expected prop 'value'");
			}
		}

		get back() {
			throw new Error("<SpriteEditor>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set back(value) {
			throw new Error("<SpriteEditor>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get value() {
			throw new Error("<SpriteEditor>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set value(value) {
			throw new Error("<SpriteEditor>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get editing() {
			throw new Error("<SpriteEditor>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set editing(value) {
			throw new Error("<SpriteEditor>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get click() {
			return this.$$.ctx[14];
		}

		set click(value) {
			throw new Error("<SpriteEditor>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* src\_client\editor\ColorEditor.svelte generated by Svelte v3.16.7 */

	const { console: console_1 } = globals;
	const file$6 = "src\\_client\\editor\\ColorEditor.svelte";

	// (32:0) {#if editing}
	function create_if_block$2(ctx) {
		let div;
		let dispose;

		const block = {
			c: function create() {
				div = element("div");
				attr_dev(div, "class", "dopick svelte-e0axn4");
				set_style(div, "background-color", /*to_css*/ ctx[3](/*$value*/ ctx[2]));
				add_location(div, file$6, 32, 0, 678);

				dispose = [
					listen_dev(div, "click", /*click_handler_1*/ ctx[7], false, false, false),
					listen_dev(div, "mousemove", /*move*/ ctx[5], false, false, false)
				];
			},
			m: function mount(target, anchor) {
				insert_dev(target, div, anchor);
			},
			p: function update(ctx, dirty) {
				if (dirty & /*$value*/ 4) {
					set_style(div, "background-color", /*to_css*/ ctx[3](/*$value*/ ctx[2]));
				}
			},
			d: function destroy(detaching) {
				if (detaching) detach_dev(div);
				run_all(dispose);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block$2.name,
			type: "if",
			source: "(32:0) {#if editing}",
			ctx
		});

		return block;
	}

	function create_fragment$6(ctx) {
		let t;
		let div;
		let dispose;
		let if_block = /*editing*/ ctx[0] && create_if_block$2(ctx);

		const block = {
			c: function create() {
				if (if_block) if_block.c();
				t = space$1();
				div = element("div");
				attr_dev(div, "type", "color");
				set_style(div, "background-color", /*to_css*/ ctx[3](/*$value*/ ctx[2]));
				attr_dev(div, "class", "picker svelte-e0axn4");
				add_location(div, file$6, 46, 0, 881);

				dispose = [
					listen_dev(window, "click", /*click_handler*/ ctx[6], false, false, false),
					listen_dev(div, "click", /*pick*/ ctx[4], false, false, false)
				];
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				if (if_block) if_block.m(target, anchor);
				insert_dev(target, t, anchor);
				insert_dev(target, div, anchor);
			},
			p: function update(ctx, [dirty]) {
				if (/*editing*/ ctx[0]) {
					if (if_block) {
						if_block.p(ctx, dirty);
					} else {
						if_block = create_if_block$2(ctx);
						if_block.c();
						if_block.m(t.parentNode, t);
					}
				} else if (if_block) {
					if_block.d(1);
					if_block = null;
				}

				if (dirty & /*$value*/ 4) {
					set_style(div, "background-color", /*to_css*/ ctx[3](/*$value*/ ctx[2]));
				}
			},
			i: noop$1,
			o: noop$1,
			d: function destroy(detaching) {
				if (if_block) if_block.d(detaching);
				if (detaching) detach_dev(t);
				if (detaching) detach_dev(div);
				run_all(dispose);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$6.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function instance$6($$self, $$props, $$invalidate) {
		let $value,
			$$unsubscribe_value = noop$1,
			$$subscribe_value = () => ($$unsubscribe_value(), $$unsubscribe_value = subscribe(value, $$value => $$invalidate(2, $value = $$value)), value);

		$$self.$$.on_destroy.push(() => $$unsubscribe_value());
		let { value } = $$props;
		validate_store(value, "value");
		$$subscribe_value();

		const to_css = col => {
			return Color([col >> 16 & 255, col >> 8 & 255, col & 255]).toCSS();
		};

		let { editing = false } = $$props;

		const pick = e => {
			e.preventDefault();
			e.stopPropagation();
			$$invalidate(0, editing = true);
		};

		const move = ({ x, y, target }) => {
			const { top, left, width, height } = target.getBoundingClientRect();
			const hue = (x - left) / width;
			const lightness = (y - top) / height;
			const { red, green, blue } = Color({ hue, lightness, saturation: 1 }).toRGB();
			const rgb = [red, green, blue].map(c => Math.round(c * 255));
			console.log(rgb);
		};

		const writable_props = ["value", "editing"];

		Object.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<ColorEditor> was created with unknown prop '${key}'`);
		});

		const click_handler = () => {
			if (editing) $$invalidate(0, editing = false);
		};

		const click_handler_1 = e => {
			e.preventDefault();
			e.stopPropagation();
			$$invalidate(0, editing = false);
		};

		$$self.$set = $$props => {
			if ("value" in $$props) $$subscribe_value($$invalidate(1, value = $$props.value));
			if ("editing" in $$props) $$invalidate(0, editing = $$props.editing);
		};

		$$self.$capture_state = () => {
			return { value, editing, $value };
		};

		$$self.$inject_state = $$props => {
			if ("value" in $$props) $$subscribe_value($$invalidate(1, value = $$props.value));
			if ("editing" in $$props) $$invalidate(0, editing = $$props.editing);
			if ("$value" in $$props) value.set($value = $$props.$value);
		};

		return [editing, value, $value, to_css, pick, move, click_handler, click_handler_1];
	}

	class ColorEditor extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$6, create_fragment$6, safe_not_equal, { value: 1, editing: 0 });

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "ColorEditor",
				options,
				id: create_fragment$6.name
			});

			const { ctx } = this.$$;
			const props = options.props || ({});

			if (/*value*/ ctx[1] === undefined && !("value" in props)) {
				console_1.warn("<ColorEditor> was created without expected prop 'value'");
			}
		}

		get value() {
			throw new Error("<ColorEditor>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set value(value) {
			throw new Error("<ColorEditor>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get editing() {
			throw new Error("<ColorEditor>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set editing(value) {
			throw new Error("<ColorEditor>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* src\_client\editor\ThreadEditor.svelte generated by Svelte v3.16.7 */
	const file$7 = "src\\_client\\editor\\ThreadEditor.svelte";

	function create_fragment$7(ctx) {
		let textarea;
		let textarea_style_value;
		let focus_action;
		let dispose;

		const block = {
			c: function create() {
				textarea = element("textarea");
				attr_dev(textarea, "spellcheck", "false");
				attr_dev(textarea, "class", "edit svelte-18o22ik");
				attr_dev(textarea, "type", "text");
				attr_dev(textarea, "style", textarea_style_value = `background-color: ${/*$THEME_BG*/ ctx[3]}; border:0.5rem solid ${/*$THEME_BORDER*/ ctx[4]};`);
				add_location(textarea, file$7, 26, 0, 484);

				dispose = [
					action_destroyer(focus_action = /*focus*/ ctx[5].call(null, textarea)),
					listen_dev(textarea, "input", /*textarea_input_handler*/ ctx[10]),
					listen_dev(textarea, "click", click_handler, false, false, false),
					listen_dev(textarea, "keydown", /*keydown_handler*/ ctx[11], false, false, false),
					listen_dev(textarea, "blur", /*blur_handler*/ ctx[12], false, false, false)
				];
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				insert_dev(target, textarea, anchor);
				set_input_value(textarea, /*code*/ ctx[0]);
			},
			p: function update(ctx, [dirty]) {
				if (dirty & /*$THEME_BG, $THEME_BORDER*/ 24 && textarea_style_value !== (textarea_style_value = `background-color: ${/*$THEME_BG*/ ctx[3]}; border:0.5rem solid ${/*$THEME_BORDER*/ ctx[4]};`)) {
					attr_dev(textarea, "style", textarea_style_value);
				}

				if (dirty & /*code*/ 1) {
					set_input_value(textarea, /*code*/ ctx[0]);
				}
			},
			i: noop$1,
			o: noop$1,
			d: function destroy(detaching) {
				if (detaching) detach_dev(textarea);
				run_all(dispose);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$7.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	const click_handler = e => e.stopPropagation();

	function instance$7($$self, $$props, $$invalidate) {
		let $THEME_BG;
		let $THEME_BORDER;
		validate_store(THEME_BG, "THEME_BG");
		component_subscribe($$self, THEME_BG, $$value => $$invalidate(3, $THEME_BG = $$value));
		validate_store(THEME_BORDER, "THEME_BORDER");
		component_subscribe($$self, THEME_BORDER, $$value => $$invalidate(4, $THEME_BORDER = $$value));
		let { code } = $$props;
		let { weave } = $$props;
		let { address } = $$props;
		let { right } = $$props;

		let { ondone = () => {
			
		} } = $$props;

		const focus = node => requestAnimationFrame(() => node.focus());
		let editing = true;

		const execute = () => {
			if (!editing) return;
			$$invalidate(2, editing = false);
			compile({ code, weave, address, right });
			ondone();
		};

		const writable_props = ["code", "weave", "address", "right", "ondone"];

		Object.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<ThreadEditor> was created with unknown prop '${key}'`);
		});

		function textarea_input_handler() {
			code = this.value;
			$$invalidate(0, code);
		}

		const keydown_handler = e => {
			if (e.key.toLowerCase() === `end`) {
				e.preventDefault();
				e.stopPropagation();
				$$invalidate(2, editing = false);
				ondone();
				return;
			}

			if (e.ctrlKey && e.which === 13) {
				execute();
				e.preventDefault();
				e.stopPropagation();
			}
		};

		const blur_handler = e => {
			execute();
		};

		$$self.$set = $$props => {
			if ("code" in $$props) $$invalidate(0, code = $$props.code);
			if ("weave" in $$props) $$invalidate(7, weave = $$props.weave);
			if ("address" in $$props) $$invalidate(8, address = $$props.address);
			if ("right" in $$props) $$invalidate(9, right = $$props.right);
			if ("ondone" in $$props) $$invalidate(1, ondone = $$props.ondone);
		};

		$$self.$capture_state = () => {
			return {
				code,
				weave,
				address,
				right,
				ondone,
				editing,
				$THEME_BG,
				$THEME_BORDER
			};
		};

		$$self.$inject_state = $$props => {
			if ("code" in $$props) $$invalidate(0, code = $$props.code);
			if ("weave" in $$props) $$invalidate(7, weave = $$props.weave);
			if ("address" in $$props) $$invalidate(8, address = $$props.address);
			if ("right" in $$props) $$invalidate(9, right = $$props.right);
			if ("ondone" in $$props) $$invalidate(1, ondone = $$props.ondone);
			if ("editing" in $$props) $$invalidate(2, editing = $$props.editing);
			if ("$THEME_BG" in $$props) THEME_BG.set($THEME_BG = $$props.$THEME_BG);
			if ("$THEME_BORDER" in $$props) THEME_BORDER.set($THEME_BORDER = $$props.$THEME_BORDER);
		};

		return [
			code,
			ondone,
			editing,
			$THEME_BG,
			$THEME_BORDER,
			focus,
			execute,
			weave,
			address,
			right,
			textarea_input_handler,
			keydown_handler,
			blur_handler
		];
	}

	class ThreadEditor extends SvelteComponentDev {
		constructor(options) {
			super(options);

			init(this, options, instance$7, create_fragment$7, safe_not_equal, {
				code: 0,
				weave: 7,
				address: 8,
				right: 9,
				ondone: 1
			});

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "ThreadEditor",
				options,
				id: create_fragment$7.name
			});

			const { ctx } = this.$$;
			const props = options.props || ({});

			if (/*code*/ ctx[0] === undefined && !("code" in props)) {
				console.warn("<ThreadEditor> was created without expected prop 'code'");
			}

			if (/*weave*/ ctx[7] === undefined && !("weave" in props)) {
				console.warn("<ThreadEditor> was created without expected prop 'weave'");
			}

			if (/*address*/ ctx[8] === undefined && !("address" in props)) {
				console.warn("<ThreadEditor> was created without expected prop 'address'");
			}

			if (/*right*/ ctx[9] === undefined && !("right" in props)) {
				console.warn("<ThreadEditor> was created without expected prop 'right'");
			}
		}

		get code() {
			throw new Error("<ThreadEditor>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set code(value) {
			throw new Error("<ThreadEditor>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get weave() {
			throw new Error("<ThreadEditor>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set weave(value) {
			throw new Error("<ThreadEditor>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get address() {
			throw new Error("<ThreadEditor>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set address(value) {
			throw new Error("<ThreadEditor>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get right() {
			throw new Error("<ThreadEditor>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set right(value) {
			throw new Error("<ThreadEditor>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get ondone() {
			throw new Error("<ThreadEditor>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set ondone(value) {
			throw new Error("<ThreadEditor>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* src\_client\thread\Warp.svelte generated by Svelte v3.16.7 */
	const file$8 = "src\\_client\\thread\\Warp.svelte";

	// (45:1) {:else}
	function create_else_block(ctx) {
		let div;
		let t;

		const block = {
			c: function create() {
				div = element("div");
				t = text(/*condensed*/ ctx[4]);
				attr_dev(div, "data:type", /*$type*/ ctx[5]);
				attr_dev(div, "class", "pad svelte-1mgajz0");
				add_location(div, file$8, 45, 2, 906);
			},
			m: function mount(target, anchor) {
				insert_dev(target, div, anchor);
				append_dev(div, t);
			},
			p: function update(ctx, dirty) {
				if (dirty & /*condensed*/ 16) set_data_dev(t, /*condensed*/ ctx[4]);

				if (dirty & /*$type*/ 32) {
					attr_dev(div, "data:type", /*$type*/ ctx[5]);
				}
			},
			i: noop$1,
			o: noop$1,
			d: function destroy(detaching) {
				if (detaching) detach_dev(div);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_else_block.name,
			type: "else",
			source: "(45:1) {:else}",
			ctx
		});

		return block;
	}

	// (43:1) {#if warp_view[$type]}
	function create_if_block$3(ctx) {
		let switch_instance_anchor;
		let current;
		var switch_value = /*warp_view*/ ctx[6][/*$type*/ ctx[5]];

		function switch_props(ctx) {
			return {
				props: { value: /*k*/ ctx[1].value },
				$$inline: true
			};
		}

		if (switch_value) {
			var switch_instance = new switch_value(switch_props(ctx));
		}

		const block = {
			c: function create() {
				if (switch_instance) create_component(switch_instance.$$.fragment);
				switch_instance_anchor = empty();
			},
			m: function mount(target, anchor) {
				if (switch_instance) {
					mount_component(switch_instance, target, anchor);
				}

				insert_dev(target, switch_instance_anchor, anchor);
				current = true;
			},
			p: function update(ctx, dirty) {
				const switch_instance_changes = {};
				if (dirty & /*k*/ 2) switch_instance_changes.value = /*k*/ ctx[1].value;

				if (switch_value !== (switch_value = /*warp_view*/ ctx[6][/*$type*/ ctx[5]])) {
					if (switch_instance) {
						group_outros();
						const old_component = switch_instance;

						transition_out(old_component.$$.fragment, 1, 0, () => {
							destroy_component(old_component, 1);
						});

						check_outros();
					}

					if (switch_value) {
						switch_instance = new switch_value(switch_props(ctx));
						create_component(switch_instance.$$.fragment);
						transition_in(switch_instance.$$.fragment, 1);
						mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
					} else {
						switch_instance = null;
					}
				} else if (switch_value) {
					switch_instance.$set(switch_instance_changes);
				}
			},
			i: function intro(local) {
				if (current) return;
				if (switch_instance) transition_in(switch_instance.$$.fragment, local);
				current = true;
			},
			o: function outro(local) {
				if (switch_instance) transition_out(switch_instance.$$.fragment, local);
				current = false;
			},
			d: function destroy(detaching) {
				if (detaching) detach_dev(switch_instance_anchor);
				if (switch_instance) destroy_component(switch_instance, detaching);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block$3.name,
			type: "if",
			source: "(43:1) {#if warp_view[$type]}",
			ctx
		});

		return block;
	}

	function create_fragment$8(ctx) {
		let div;
		let current_block_type_index;
		let if_block;
		let change_action;
		let current;
		let dispose;
		const if_block_creators = [create_if_block$3, create_else_block];
		const if_blocks = [];

		function select_block_type(ctx, dirty) {
			if (/*warp_view*/ ctx[6][/*$type*/ ctx[5]]) return 0;
			return 1;
		}

		current_block_type_index = select_block_type(ctx);
		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

		const block = {
			c: function create() {
				div = element("div");
				if_block.c();
				attr_dev(div, "class", "warp svelte-1mgajz0");
				toggle_class(div, "changed", /*changed*/ ctx[0]);
				add_location(div, file$8, 37, 0, 744);
				dispose = action_destroyer(change_action = /*change*/ ctx[7].call(null, div, /*value*/ ctx[2]));
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				insert_dev(target, div, anchor);
				if_blocks[current_block_type_index].m(div, null);
				current = true;
			},
			p: function update(ctx, [dirty]) {
				let previous_block_index = current_block_type_index;
				current_block_type_index = select_block_type(ctx);

				if (current_block_type_index === previous_block_index) {
					if_blocks[current_block_type_index].p(ctx, dirty);
				} else {
					group_outros();

					transition_out(if_blocks[previous_block_index], 1, 1, () => {
						if_blocks[previous_block_index] = null;
					});

					check_outros();
					if_block = if_blocks[current_block_type_index];

					if (!if_block) {
						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
						if_block.c();
					}

					transition_in(if_block, 1);
					if_block.m(div, null);
				}

				if (change_action && is_function(change_action.update) && dirty & /*value*/ 4) change_action.update.call(null, /*value*/ ctx[2]);

				if (dirty & /*changed*/ 1) {
					toggle_class(div, "changed", /*changed*/ ctx[0]);
				}
			},
			i: function intro(local) {
				if (current) return;
				transition_in(if_block);
				current = true;
			},
			o: function outro(local) {
				transition_out(if_block);
				current = false;
			},
			d: function destroy(detaching) {
				if (detaching) detach_dev(div);
				if_blocks[current_block_type_index].d();
				dispose();
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$8.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function instance$8($$self, $$props, $$invalidate) {
		let $value,
			$$unsubscribe_value = noop$1,
			$$subscribe_value = () => ($$unsubscribe_value(), $$unsubscribe_value = subscribe(value, $$value => $$invalidate(10, $value = $$value)), value);

		let $type,
			$$unsubscribe_type = noop$1,
			$$subscribe_type = () => ($$unsubscribe_type(), $$unsubscribe_type = subscribe(type, $$value => $$invalidate(5, $type = $$value)), type);

		$$self.$$.on_destroy.push(() => $$unsubscribe_value());
		$$self.$$.on_destroy.push(() => $$unsubscribe_type());
		let { id } = $$props;
		let { weave } = $$props;
		const warp_view = { sprite: SpriteEditor, color: ColorEditor };
		let changed = false;

		const change = (node, value) => {

			return {
				destroy: value.listen(() => {
					$$invalidate(0, changed = true);

					setTimeout(
						() => {
							$$invalidate(0, changed = false);
						},
						250
					);
				})
			};
		};

		const writable_props = ["id", "weave"];

		Object.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Warp> was created with unknown prop '${key}'`);
		});

		$$self.$set = $$props => {
			if ("id" in $$props) $$invalidate(8, id = $$props.id);
			if ("weave" in $$props) $$invalidate(9, weave = $$props.weave);
		};

		$$self.$capture_state = () => {
			return {
				id,
				weave,
				changed,
				k,
				value,
				type,
				condensed,
				$value,
				$type
			};
		};

		$$self.$inject_state = $$props => {
			if ("id" in $$props) $$invalidate(8, id = $$props.id);
			if ("weave" in $$props) $$invalidate(9, weave = $$props.weave);
			if ("changed" in $$props) $$invalidate(0, changed = $$props.changed);
			if ("k" in $$props) $$invalidate(1, k = $$props.k);
			if ("value" in $$props) $$subscribe_value($$invalidate(2, value = $$props.value));
			if ("type" in $$props) $$subscribe_type($$invalidate(3, type = $$props.type));
			if ("condensed" in $$props) $$invalidate(4, condensed = $$props.condensed);
			if ("$value" in $$props) value.set($value = $$props.$value);
			if ("$type" in $$props) type.set($type = $$props.$type);
		};

		let k;
		let value;
		let type;
		let condensed;

		$$self.$$.update = () => {
			if ($$self.$$.dirty & /*weave, id*/ 768) {
				 $$invalidate(1, k = weave.get_id(id));
			}

			if ($$self.$$.dirty & /*k*/ 2) {
				 $$subscribe_value($$invalidate(2, value = k && k.value || read(`unknown`)));
			}

			if ($$self.$$.dirty & /*k*/ 2) {
				 $$subscribe_type($$invalidate(3, type = k && k.type || read(`unknown`)));
			}

			if ($$self.$$.dirty & /*id, weave, $value*/ 1792) {
				 $$invalidate(4, condensed = condense(id, weave));
			}
		};

		return [changed, k, value, type, condensed, $type, warp_view, change, id, weave];
	}

	class Warp$1 extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$8, create_fragment$8, safe_not_equal, { id: 8, weave: 9 });

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "Warp",
				options,
				id: create_fragment$8.name
			});

			const { ctx } = this.$$;
			const props = options.props || ({});

			if (/*id*/ ctx[8] === undefined && !("id" in props)) {
				console.warn("<Warp> was created without expected prop 'id'");
			}

			if (/*weave*/ ctx[9] === undefined && !("weave" in props)) {
				console.warn("<Warp> was created without expected prop 'weave'");
			}
		}

		get id() {
			throw new Error("<Warp>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set id(value) {
			throw new Error("<Warp>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get weave() {
			throw new Error("<Warp>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set weave(value) {
			throw new Error("<Warp>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* src\_client\explore\Thread.svelte generated by Svelte v3.16.7 */
	const file$9 = "src\\_client\\explore\\Thread.svelte";

	function get_each_context(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[21] = list[i];
		return child_ctx;
	}

	// (86:0) {#if editing}
	function create_if_block_4(ctx) {
		let current;

		const threadeditor = new ThreadEditor({
				props: {
					code: /*edit*/ ctx[6],
					ondone: /*execute*/ ctx[11],
					weave: /*weave*/ ctx[0],
					address: /*address*/ ctx[7],
					right: /*right*/ ctx[2]
				},
				$$inline: true
			});

		const block = {
			c: function create() {
				create_component(threadeditor.$$.fragment);
			},
			m: function mount(target, anchor) {
				mount_component(threadeditor, target, anchor);
				current = true;
			},
			p: function update(ctx, dirty) {
				const threadeditor_changes = {};
				if (dirty & /*edit*/ 64) threadeditor_changes.code = /*edit*/ ctx[6];
				if (dirty & /*weave*/ 1) threadeditor_changes.weave = /*weave*/ ctx[0];
				if (dirty & /*address*/ 128) threadeditor_changes.address = /*address*/ ctx[7];
				if (dirty & /*right*/ 4) threadeditor_changes.right = /*right*/ ctx[2];
				threadeditor.$set(threadeditor_changes);
			},
			i: function intro(local) {
				if (current) return;
				transition_in(threadeditor.$$.fragment, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(threadeditor.$$.fragment, local);
				current = false;
			},
			d: function destroy(detaching) {
				destroy_component(threadeditor, detaching);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block_4.name,
			type: "if",
			source: "(86:0) {#if editing}",
			ctx
		});

		return block;
	}

	// (101:0) {:else}
	function create_else_block_1(ctx) {
		let t;
		let div;
		let current;
		let dispose;
		let if_block0 = /*chain*/ ctx[5].length > 0 && create_if_block_3(ctx);

		function select_block_type_2(ctx, dirty) {
			if (/*chain*/ ctx[5].length > 0) return create_if_block_2;
			return create_else_block_2;
		}

		let current_block_type = select_block_type_2(ctx);
		let if_block1 = current_block_type(ctx);

		const block = {
			c: function create() {
				if (if_block0) if_block0.c();
				t = space$1();
				div = element("div");
				if_block1.c();
				attr_dev(div, "class", "cap svelte-1j3z045");
				add_location(div, file$9, 126, 1, 2254);
				dispose = listen_dev(div, "click", /*do_edit*/ ctx[3], false, false, false);
			},
			m: function mount(target, anchor) {
				if (if_block0) if_block0.m(target, anchor);
				insert_dev(target, t, anchor);
				insert_dev(target, div, anchor);
				if_block1.m(div, null);
				current = true;
			},
			p: function update(ctx, dirty) {
				if (/*chain*/ ctx[5].length > 0) {
					if (if_block0) {
						if_block0.p(ctx, dirty);
						transition_in(if_block0, 1);
					} else {
						if_block0 = create_if_block_3(ctx);
						if_block0.c();
						transition_in(if_block0, 1);
						if_block0.m(t.parentNode, t);
					}
				} else if (if_block0) {
					group_outros();

					transition_out(if_block0, 1, 1, () => {
						if_block0 = null;
					});

					check_outros();
				}

				if (current_block_type === (current_block_type = select_block_type_2(ctx)) && if_block1) {
					if_block1.p(ctx, dirty);
				} else {
					if_block1.d(1);
					if_block1 = current_block_type(ctx);

					if (if_block1) {
						if_block1.c();
						if_block1.m(div, null);
					}
				}
			},
			i: function intro(local) {
				if (current) return;
				transition_in(if_block0);
				current = true;
			},
			o: function outro(local) {
				transition_out(if_block0);
				current = false;
			},
			d: function destroy(detaching) {
				if (if_block0) if_block0.d(detaching);
				if (detaching) detach_dev(t);
				if (detaching) detach_dev(div);
				if_block1.d();
				dispose();
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_else_block_1.name,
			type: "else",
			source: "(101:0) {:else}",
			ctx
		});

		return block;
	}

	// (90:0) {#if nothread}
	function create_if_block$4(ctx) {
		let div;

		function select_block_type_1(ctx, dirty) {
			if (/*chain*/ ctx[5].length > 0) return create_if_block_1$1;
			return create_else_block$1;
		}

		let current_block_type = select_block_type_1(ctx);
		let if_block = current_block_type(ctx);

		const block = {
			c: function create() {
				div = element("div");
				if_block.c();
				attr_dev(div, "class", "cap svelte-1j3z045");
				toggle_class(div, "nothread", /*nothread*/ ctx[1]);
				add_location(div, file$9, 90, 1, 1730);
			},
			m: function mount(target, anchor) {
				insert_dev(target, div, anchor);
				if_block.m(div, null);
			},
			p: function update(ctx, dirty) {
				if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block) {
					if_block.p(ctx, dirty);
				} else {
					if_block.d(1);
					if_block = current_block_type(ctx);

					if (if_block) {
						if_block.c();
						if_block.m(div, null);
					}
				}

				if (dirty & /*nothread*/ 2) {
					toggle_class(div, "nothread", /*nothread*/ ctx[1]);
				}
			},
			i: noop$1,
			o: noop$1,
			d: function destroy(detaching) {
				if (detaching) detach_dev(div);
				if_block.d();
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block$4.name,
			type: "if",
			source: "(90:0) {#if nothread}",
			ctx
		});

		return block;
	}

	// (102:1) {#if chain.length > 0}
	function create_if_block_3(ctx) {
		let div;
		let current;
		let dispose;
		let each_value = /*chain*/ ctx[5];
		let each_blocks = [];

		for (let i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
		}

		const out = i => transition_out(each_blocks[i], 1, 1, () => {
			each_blocks[i] = null;
		});

		const block = {
			c: function create() {
				div = element("div");

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				attr_dev(div, "class", "spot svelte-1j3z045");
				toggle_class(div, "right", /*right*/ ctx[2]);
				add_location(div, file$9, 102, 2, 1894);
				dispose = listen_dev(div, "click", /*do_edit*/ ctx[3], false, false, false);
			},
			m: function mount(target, anchor) {
				insert_dev(target, div, anchor);

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].m(div, null);
				}

				current = true;
			},
			p: function update(ctx, dirty) {
				if (dirty & /*style, active, condense, chain, weave*/ 1569) {
					each_value = /*chain*/ ctx[5];
					let i;

					for (i = 0; i < each_value.length; i += 1) {
						const child_ctx = get_each_context(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(child_ctx, dirty);
							transition_in(each_blocks[i], 1);
						} else {
							each_blocks[i] = create_each_block(child_ctx);
							each_blocks[i].c();
							transition_in(each_blocks[i], 1);
							each_blocks[i].m(div, null);
						}
					}

					group_outros();

					for (i = each_value.length; i < each_blocks.length; i += 1) {
						out(i);
					}

					check_outros();
				}

				if (dirty & /*right*/ 4) {
					toggle_class(div, "right", /*right*/ ctx[2]);
				}
			},
			i: function intro(local) {
				if (current) return;

				for (let i = 0; i < each_value.length; i += 1) {
					transition_in(each_blocks[i]);
				}

				current = true;
			},
			o: function outro(local) {
				each_blocks = each_blocks.filter(Boolean);

				for (let i = 0; i < each_blocks.length; i += 1) {
					transition_out(each_blocks[i]);
				}

				current = false;
			},
			d: function destroy(detaching) {
				if (detaching) detach_dev(div);
				destroy_each(each_blocks, detaching);
				dispose();
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block_3.name,
			type: "if",
			source: "(102:1) {#if chain.length > 0}",
			ctx
		});

		return block;
	}

	// (108:2) {#each chain as link}
	function create_each_block(ctx) {
		let div0;
		let color_action;
		let t0;
		let div1;
		let t1;
		let current;
		let dispose;

		const warp = new Warp$1({
				props: {
					weave: /*weave*/ ctx[0],
					id: /*link*/ ctx[21]
				},
				$$inline: true
			});

		const block = {
			c: function create() {
				div0 = element("div");
				create_component(warp.$$.fragment);
				t0 = space$1();
				div1 = element("div");
				t1 = text(">\r\n\t\t\t");
				attr_dev(div0, "class", "thread svelte-1j3z045");
				attr_dev(div0, "style", /*style*/ ctx[9]);
				toggle_class(div0, "active", /*active*/ ctx[10]);
				add_location(div0, file$9, 108, 3, 1989);
				attr_dev(div1, "class", "after-thread svelte-1j3z045");
				attr_dev(div1, "style", /*style*/ ctx[9]);
				toggle_class(div1, "active", /*active*/ ctx[10]);
				add_location(div1, file$9, 116, 3, 2137);
				dispose = action_destroyer(color_action = color$2.call(null, div0, condense(/*link*/ ctx[21], /*weave*/ ctx[0])));
			},
			m: function mount(target, anchor) {
				insert_dev(target, div0, anchor);
				mount_component(warp, div0, null);
				insert_dev(target, t0, anchor);
				insert_dev(target, div1, anchor);
				append_dev(div1, t1);
				current = true;
			},
			p: function update(new_ctx, dirty) {
				ctx = new_ctx;
				const warp_changes = {};
				if (dirty & /*weave*/ 1) warp_changes.weave = /*weave*/ ctx[0];
				if (dirty & /*chain*/ 32) warp_changes.id = /*link*/ ctx[21];
				warp.$set(warp_changes);

				if (!current || dirty & /*style*/ 512) {
					attr_dev(div0, "style", /*style*/ ctx[9]);
				}

				if (color_action && is_function(color_action.update) && dirty & /*chain, weave*/ 33) color_action.update.call(null, condense(/*link*/ ctx[21], /*weave*/ ctx[0]));

				if (dirty & /*active*/ 1024) {
					toggle_class(div0, "active", /*active*/ ctx[10]);
				}

				if (!current || dirty & /*style*/ 512) {
					attr_dev(div1, "style", /*style*/ ctx[9]);
				}

				if (dirty & /*active*/ 1024) {
					toggle_class(div1, "active", /*active*/ ctx[10]);
				}
			},
			i: function intro(local) {
				if (current) return;
				transition_in(warp.$$.fragment, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(warp.$$.fragment, local);
				current = false;
			},
			d: function destroy(detaching) {
				if (detaching) detach_dev(div0);
				destroy_component(warp);
				if (detaching) detach_dev(t0);
				if (detaching) detach_dev(div1);
				dispose();
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_each_block.name,
			type: "each",
			source: "(108:2) {#each chain as link}",
			ctx
		});

		return block;
	}

	// (133:2) {:else}
	function create_else_block_2(ctx) {
		let t;

		const block = {
			c: function create() {
				t = text(" ");
			},
			m: function mount(target, anchor) {
				insert_dev(target, t, anchor);
			},
			p: noop$1,
			d: function destroy(detaching) {
				if (detaching) detach_dev(t);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_else_block_2.name,
			type: "else",
			source: "(133:2) {:else}",
			ctx
		});

		return block;
	}

	// (131:2) {#if chain.length > 0}
	function create_if_block_2(ctx) {
		let t_value = /*chain*/ ctx[5].length + "";
		let t;

		const block = {
			c: function create() {
				t = text(t_value);
			},
			m: function mount(target, anchor) {
				insert_dev(target, t, anchor);
			},
			p: function update(ctx, dirty) {
				if (dirty & /*chain*/ 32 && t_value !== (t_value = /*chain*/ ctx[5].length + "")) set_data_dev(t, t_value);
			},
			d: function destroy(detaching) {
				if (detaching) detach_dev(t);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block_2.name,
			type: "if",
			source: "(131:2) {#if chain.length > 0}",
			ctx
		});

		return block;
	}

	// (97:2) {:else}
	function create_else_block$1(ctx) {
		let t;

		const block = {
			c: function create() {
				t = text(" ");
			},
			m: function mount(target, anchor) {
				insert_dev(target, t, anchor);
			},
			p: noop$1,
			d: function destroy(detaching) {
				if (detaching) detach_dev(t);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_else_block$1.name,
			type: "else",
			source: "(97:2) {:else}",
			ctx
		});

		return block;
	}

	// (95:2) {#if chain.length > 0}
	function create_if_block_1$1(ctx) {
		let t_value = /*chain*/ ctx[5].length + "";
		let t;

		const block = {
			c: function create() {
				t = text(t_value);
			},
			m: function mount(target, anchor) {
				insert_dev(target, t, anchor);
			},
			p: function update(ctx, dirty) {
				if (dirty & /*chain*/ 32 && t_value !== (t_value = /*chain*/ ctx[5].length + "")) set_data_dev(t, t_value);
			},
			d: function destroy(detaching) {
				if (detaching) detach_dev(t);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block_1$1.name,
			type: "if",
			source: "(95:2) {#if chain.length > 0}",
			ctx
		});

		return block;
	}

	function create_fragment$9(ctx) {
		let t;
		let current_block_type_index;
		let if_block1;
		let if_block1_anchor;
		let current;
		let if_block0 = /*editing*/ ctx[4] && create_if_block_4(ctx);
		const if_block_creators = [create_if_block$4, create_else_block_1];
		const if_blocks = [];

		function select_block_type(ctx, dirty) {
			if (/*nothread*/ ctx[1]) return 0;
			return 1;
		}

		current_block_type_index = select_block_type(ctx);
		if_block1 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

		const block = {
			c: function create() {
				if (if_block0) if_block0.c();
				t = space$1();
				if_block1.c();
				if_block1_anchor = empty();
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				if (if_block0) if_block0.m(target, anchor);
				insert_dev(target, t, anchor);
				if_blocks[current_block_type_index].m(target, anchor);
				insert_dev(target, if_block1_anchor, anchor);
				current = true;
			},
			p: function update(ctx, [dirty]) {
				if (/*editing*/ ctx[4]) {
					if (if_block0) {
						if_block0.p(ctx, dirty);
						transition_in(if_block0, 1);
					} else {
						if_block0 = create_if_block_4(ctx);
						if_block0.c();
						transition_in(if_block0, 1);
						if_block0.m(t.parentNode, t);
					}
				} else if (if_block0) {
					group_outros();

					transition_out(if_block0, 1, 1, () => {
						if_block0 = null;
					});

					check_outros();
				}

				let previous_block_index = current_block_type_index;
				current_block_type_index = select_block_type(ctx);

				if (current_block_type_index === previous_block_index) {
					if_blocks[current_block_type_index].p(ctx, dirty);
				} else {
					group_outros();

					transition_out(if_blocks[previous_block_index], 1, 1, () => {
						if_blocks[previous_block_index] = null;
					});

					check_outros();
					if_block1 = if_blocks[current_block_type_index];

					if (!if_block1) {
						if_block1 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
						if_block1.c();
					}

					transition_in(if_block1, 1);
					if_block1.m(if_block1_anchor.parentNode, if_block1_anchor);
				}
			},
			i: function intro(local) {
				if (current) return;
				transition_in(if_block0);
				transition_in(if_block1);
				current = true;
			},
			o: function outro(local) {
				transition_out(if_block0);
				transition_out(if_block1);
				current = false;
			},
			d: function destroy(detaching) {
				if (if_block0) if_block0.d(detaching);
				if (detaching) detach_dev(t);
				if_blocks[current_block_type_index].d(detaching);
				if (detaching) detach_dev(if_block1_anchor);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$9.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function instance$9($$self, $$props, $$invalidate) {
		let $value,
			$$unsubscribe_value = noop$1,
			$$subscribe_value = () => ($$unsubscribe_value(), $$unsubscribe_value = subscribe(value, $$value => $$invalidate(14, $value = $$value)), value);

		let $tick;
		let $THEME_BG;
		validate_store(tick, "tick");
		component_subscribe($$self, tick, $$value => $$invalidate(17, $tick = $$value));
		validate_store(THEME_BG, "THEME_BG");
		component_subscribe($$self, THEME_BG, $$value => $$invalidate(18, $THEME_BG = $$value));
		$$self.$$.on_destroy.push(() => $$unsubscribe_value());
		let { channel } = $$props;
		let { space } = $$props;
		let { weave } = $$props;
		let { nothread } = $$props;
		let { right = false } = $$props;
		let editing = false;
		let chain;

		const get_chain = () => right
		? weave.chain(address, right).slice(0, -1)
		: weave.chain(address).slice(0, -1);

		const update_chain = () => {
			$$invalidate(5, chain = get_chain());
		};

		let edit = ``;

		const execute = () => {
			if (!editing) return;
			$$invalidate(4, editing = false);
			update_chain();
		};

		const do_edit = e => {
			if (e) {
				e.preventDefault();
				e.stopPropagation();
			}

			if (weave.name.get() === Wheel.SYSTEM) return;
			if (editing) return;
			$$invalidate(4, editing = true);

			if (right) {
				$$invalidate(6, edit = format(get_chain().map(i => translate(i, weave)).reverse().join(` => `)));
			} else {
				$$invalidate(6, edit = format(get_chain().map(i => translate(i, weave)).join(` => `)));
			}
		};

		const writable_props = ["channel", "space", "weave", "nothread", "right"];

		Object.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Thread> was created with unknown prop '${key}'`);
		});

		$$self.$set = $$props => {
			if ("channel" in $$props) $$invalidate(12, channel = $$props.channel);
			if ("space" in $$props) $$invalidate(13, space = $$props.space);
			if ("weave" in $$props) $$invalidate(0, weave = $$props.weave);
			if ("nothread" in $$props) $$invalidate(1, nothread = $$props.nothread);
			if ("right" in $$props) $$invalidate(2, right = $$props.right);
		};

		$$self.$capture_state = () => {
			return {
				channel,
				space,
				weave,
				nothread,
				right,
				editing,
				chain,
				edit,
				address,
				value,
				$value,
				boxes,
				time_cut,
				$tick,
				style,
				$THEME_BG,
				active
			};
		};

		$$self.$inject_state = $$props => {
			if ("channel" in $$props) $$invalidate(12, channel = $$props.channel);
			if ("space" in $$props) $$invalidate(13, space = $$props.space);
			if ("weave" in $$props) $$invalidate(0, weave = $$props.weave);
			if ("nothread" in $$props) $$invalidate(1, nothread = $$props.nothread);
			if ("right" in $$props) $$invalidate(2, right = $$props.right);
			if ("editing" in $$props) $$invalidate(4, editing = $$props.editing);
			if ("chain" in $$props) $$invalidate(5, chain = $$props.chain);
			if ("edit" in $$props) $$invalidate(6, edit = $$props.edit);
			if ("address" in $$props) $$invalidate(7, address = $$props.address);
			if ("value" in $$props) $$subscribe_value($$invalidate(8, value = $$props.value));
			if ("$value" in $$props) value.set($value = $$props.$value);
			if ("boxes" in $$props) boxes = $$props.boxes;
			if ("time_cut" in $$props) time_cut = $$props.time_cut;
			if ("$tick" in $$props) tick.set($tick = $$props.$tick);
			if ("style" in $$props) $$invalidate(9, style = $$props.style);
			if ("$THEME_BG" in $$props) THEME_BG.set($THEME_BG = $$props.$THEME_BG);
			if ("active" in $$props) $$invalidate(10, active = $$props.active);
		};

		let address;
		let value;
		let boxes;
		let time_cut;
		let style;
		let active;

		$$self.$$.update = () => {
			if ($$self.$$.dirty & /*space, channel*/ 12288) {
				 $$invalidate(7, address = `${space.id.get()}/${channel[0]}`);
			}

			if ($$self.$$.dirty & /*channel*/ 4096) {
				 $$subscribe_value($$invalidate(8, value = channel[1]));
			}

			if ($$self.$$.dirty & /*$value*/ 16384) {
				 {
					update_chain();
				}
			}

			if ($$self.$$.dirty & /*chain, weave*/ 33) {
				 boxes = chain.map(i => translate(i, weave)).join(` => `);
			}

			if ($$self.$$.dirty & /*$tick*/ 131072) {
				 time_cut = $tick && Date.now() - 1000;
			}

			if ($$self.$$.dirty & /*$THEME_BG*/ 262144) {
				 $$invalidate(9, style = [`background-color: ${$THEME_BG};`].join(``));
			}
		};

		 $$invalidate(10, active = false);

		return [
			weave,
			nothread,
			right,
			do_edit,
			editing,
			chain,
			edit,
			address,
			value,
			style,
			active,
			execute,
			channel,
			space
		];
	}

	class Thread extends SvelteComponentDev {
		constructor(options) {
			super(options);

			init(this, options, instance$9, create_fragment$9, safe_not_equal, {
				channel: 12,
				space: 13,
				weave: 0,
				nothread: 1,
				right: 2,
				do_edit: 3
			});

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "Thread",
				options,
				id: create_fragment$9.name
			});

			const { ctx } = this.$$;
			const props = options.props || ({});

			if (/*channel*/ ctx[12] === undefined && !("channel" in props)) {
				console.warn("<Thread> was created without expected prop 'channel'");
			}

			if (/*space*/ ctx[13] === undefined && !("space" in props)) {
				console.warn("<Thread> was created without expected prop 'space'");
			}

			if (/*weave*/ ctx[0] === undefined && !("weave" in props)) {
				console.warn("<Thread> was created without expected prop 'weave'");
			}

			if (/*nothread*/ ctx[1] === undefined && !("nothread" in props)) {
				console.warn("<Thread> was created without expected prop 'nothread'");
			}
		}

		get channel() {
			throw new Error("<Thread>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set channel(value) {
			throw new Error("<Thread>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get space() {
			throw new Error("<Thread>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set space(value) {
			throw new Error("<Thread>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get weave() {
			throw new Error("<Thread>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set weave(value) {
			throw new Error("<Thread>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get nothread() {
			throw new Error("<Thread>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set nothread(value) {
			throw new Error("<Thread>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get right() {
			throw new Error("<Thread>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set right(value) {
			throw new Error("<Thread>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get do_edit() {
			return this.$$.ctx[3];
		}

		set do_edit(value) {
			throw new Error("<Thread>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* src\_client\explore\Channel.svelte generated by Svelte v3.16.7 */
	const file$a = "src\\_client\\explore\\Channel.svelte";

	// (164:0) {:else}
	function create_else_block_1$1(ctx) {
		let input;
		let focusd_action;
		let dispose;

		const block = {
			c: function create() {
				input = element("input");
				attr_dev(input, "class", "edit svelte-ugahxz");
				attr_dev(input, "type", "text");
				attr_dev(input, "placeholder", "JSON PLZ");
				add_location(input, file$a, 164, 1, 2982);

				dispose = [
					action_destroyer(focusd_action = /*focusd*/ ctx[21].call(null, input)),
					listen_dev(input, "input", /*input_input_handler_1*/ ctx[31]),
					listen_dev(input, "keydown", /*keydown_handler_1*/ ctx[32], false, false, false),
					listen_dev(input, "blur", /*blur_handler_1*/ ctx[33], false, false, false)
				];
			},
			m: function mount(target, anchor) {
				insert_dev(target, input, anchor);
				set_input_value(input, /*val*/ ctx[7]);
			},
			p: function update(ctx, dirty) {
				if (dirty[0] & /*val*/ 128 && input.value !== /*val*/ ctx[7]) {
					set_input_value(input, /*val*/ ctx[7]);
				}
			},
			i: noop$1,
			o: noop$1,
			d: function destroy(detaching) {
				if (detaching) detach_dev(input);
				run_all(dispose);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_else_block_1$1.name,
			type: "else",
			source: "(164:0) {:else}",
			ctx
		});

		return block;
	}

	// (139:19) 
	function create_if_block_1$2(ctx) {
		let div1;
		let div0;
		let t0;
		let t1;
		let current_block_type_index;
		let if_block;
		let current;
		const if_block_creators = [create_if_block_2$1, create_if_block_3$1, create_else_block$2];
		const if_blocks = [];

		function select_block_type_1(ctx, dirty) {
			if (/*key*/ ctx[13] === `sprite`) return 0;
			if (/*key*/ ctx[13] === `color`) return 1;
			return 2;
		}

		current_block_type_index = select_block_type_1(ctx);
		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

		const block = {
			c: function create() {
				div1 = element("div");
				div0 = element("div");
				t0 = text(/*key*/ ctx[13]);
				t1 = space$1();
				if_block.c();
				attr_dev(div0, "class", "key svelte-ugahxz");
				add_location(div0, file$a, 140, 1, 2587);
				attr_dev(div1, "class", "dataset svelte-ugahxz");
				add_location(div1, file$a, 139, 0, 2563);
			},
			m: function mount(target, anchor) {
				insert_dev(target, div1, anchor);
				append_dev(div1, div0);
				append_dev(div0, t0);
				append_dev(div1, t1);
				if_blocks[current_block_type_index].m(div1, null);
				current = true;
			},
			p: function update(ctx, dirty) {
				if (!current || dirty[0] & /*key*/ 8192) set_data_dev(t0, /*key*/ ctx[13]);
				let previous_block_index = current_block_type_index;
				current_block_type_index = select_block_type_1(ctx);

				if (current_block_type_index === previous_block_index) {
					if_blocks[current_block_type_index].p(ctx, dirty);
				} else {
					group_outros();

					transition_out(if_blocks[previous_block_index], 1, 1, () => {
						if_blocks[previous_block_index] = null;
					});

					check_outros();
					if_block = if_blocks[current_block_type_index];

					if (!if_block) {
						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
						if_block.c();
					}

					transition_in(if_block, 1);
					if_block.m(div1, null);
				}
			},
			i: function intro(local) {
				if (current) return;
				transition_in(if_block);
				current = true;
			},
			o: function outro(local) {
				transition_out(if_block);
				current = false;
			},
			d: function destroy(detaching) {
				if (detaching) detach_dev(div1);
				if_blocks[current_block_type_index].d();
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block_1$2.name,
			type: "if",
			source: "(139:19) ",
			ctx
		});

		return block;
	}

	// (121:0) {#if key_editing}
	function create_if_block$5(ctx) {
		let input;
		let dispose;

		const block = {
			c: function create() {
				input = element("input");
				attr_dev(input, "type", "text");
				attr_dev(input, "class", "edit svelte-ugahxz");
				input.autofocus = true;
				add_location(input, file$a, 121, 1, 2231);

				dispose = [
					listen_dev(input, "input", /*input_input_handler*/ ctx[27]),
					listen_dev(input, "keydown", /*keydown_handler*/ ctx[28], false, false, false),
					listen_dev(input, "blur", /*blur_handler*/ ctx[29], false, false, false)
				];
			},
			m: function mount(target, anchor) {
				insert_dev(target, input, anchor);
				set_input_value(input, /*key_new*/ ctx[12]);
				input.focus();
			},
			p: function update(ctx, dirty) {
				if (dirty[0] & /*key_new*/ 4096 && input.value !== /*key_new*/ ctx[12]) {
					set_input_value(input, /*key_new*/ ctx[12]);
				}
			},
			i: noop$1,
			o: noop$1,
			d: function destroy(detaching) {
				if (detaching) detach_dev(input);
				run_all(dispose);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block$5.name,
			type: "if",
			source: "(121:0) {#if key_editing}",
			ctx
		});

		return block;
	}

	// (156:1) {:else}
	function create_else_block$2(ctx) {
		let div;
		let t_value = JSON.stringify(/*edit*/ ctx[15]) + "";
		let t;

		const block = {
			c: function create() {
				div = element("div");
				t = text(t_value);
				attr_dev(div, "class", "value svelte-ugahxz");
				add_location(div, file$a, 156, 1, 2892);
			},
			m: function mount(target, anchor) {
				insert_dev(target, div, anchor);
				append_dev(div, t);
			},
			p: function update(ctx, dirty) {
				if (dirty[0] & /*edit*/ 32768 && t_value !== (t_value = JSON.stringify(/*edit*/ ctx[15]) + "")) set_data_dev(t, t_value);
			},
			i: noop$1,
			o: noop$1,
			d: function destroy(detaching) {
				if (detaching) detach_dev(div);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_else_block$2.name,
			type: "else",
			source: "(156:1) {:else}",
			ctx
		});

		return block;
	}

	// (153:27) 
	function create_if_block_3$1(ctx) {
		let t;
		let div;
		let current;

		const coloreditor = new ColorEditor({
				props: {
					value: /*value*/ ctx[14],
					editing: edit_color
				},
				$$inline: true
			});

		const block = {
			c: function create() {
				create_component(coloreditor.$$.fragment);
				t = space$1();
				div = element("div");
				attr_dev(div, "class", "flex svelte-ugahxz");
				add_location(div, file$a, 154, 2, 2860);
			},
			m: function mount(target, anchor) {
				mount_component(coloreditor, target, anchor);
				insert_dev(target, t, anchor);
				insert_dev(target, div, anchor);
				current = true;
			},
			p: function update(ctx, dirty) {
				const coloreditor_changes = {};
				if (dirty[0] & /*value*/ 16384) coloreditor_changes.value = /*value*/ ctx[14];
				coloreditor.$set(coloreditor_changes);
			},
			i: function intro(local) {
				if (current) return;
				transition_in(coloreditor.$$.fragment, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(coloreditor.$$.fragment, local);
				current = false;
			},
			d: function destroy(detaching) {
				destroy_component(coloreditor, detaching);
				if (detaching) detach_dev(t);
				if (detaching) detach_dev(div);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block_3$1.name,
			type: "if",
			source: "(153:27) ",
			ctx
		});

		return block;
	}

	// (145:1) {#if key === `sprite`}
	function create_if_block_2$1(ctx) {
		let t;
		let div;
		let current;

		let spriteeditor_props = {
			value: /*value*/ ctx[14],
			back: /*address*/ ctx[18],
			editing: /*edit_sprite*/ ctx[8]
		};

		const spriteeditor = new SpriteEditor({
				props: spriteeditor_props,
				$$inline: true
			});

		/*spriteeditor_binding*/ ctx[30](spriteeditor);

		const block = {
			c: function create() {
				create_component(spriteeditor.$$.fragment);
				t = space$1();
				div = element("div");
				attr_dev(div, "class", "flex svelte-ugahxz");
				add_location(div, file$a, 151, 2, 2760);
			},
			m: function mount(target, anchor) {
				mount_component(spriteeditor, target, anchor);
				insert_dev(target, t, anchor);
				insert_dev(target, div, anchor);
				current = true;
			},
			p: function update(ctx, dirty) {
				const spriteeditor_changes = {};
				if (dirty[0] & /*value*/ 16384) spriteeditor_changes.value = /*value*/ ctx[14];
				if (dirty[0] & /*address*/ 262144) spriteeditor_changes.back = /*address*/ ctx[18];
				if (dirty[0] & /*edit_sprite*/ 256) spriteeditor_changes.editing = /*edit_sprite*/ ctx[8];
				spriteeditor.$set(spriteeditor_changes);
			},
			i: function intro(local) {
				if (current) return;
				transition_in(spriteeditor.$$.fragment, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(spriteeditor.$$.fragment, local);
				current = false;
			},
			d: function destroy(detaching) {
				/*spriteeditor_binding*/ ctx[30](null);
				destroy_component(spriteeditor, detaching);
				if (detaching) detach_dev(t);
				if (detaching) detach_dev(div);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block_2$1.name,
			type: "if",
			source: "(145:1) {#if key === `sprite`}",
			ctx
		});

		return block;
	}

	function create_fragment$a(ctx) {
		let div;
		let t0;
		let current_block_type_index;
		let if_block;
		let t1;
		let div_class_value;
		let color_action;
		let nav_action;
		let current;
		let dispose;

		let thread0_props = {
			channel: /*channel*/ ctx[3],
			space: /*space*/ ctx[0],
			weave: /*weave*/ ctx[2],
			nothread: /*nothread*/ ctx[1]
		};

		const thread0 = new Thread({ props: thread0_props, $$inline: true });
		/*thread0_binding*/ ctx[26](thread0);
		const if_block_creators = [create_if_block$5, create_if_block_1$2, create_else_block_1$1];
		const if_blocks = [];

		function select_block_type(ctx, dirty) {
			if (/*key_editing*/ ctx[6]) return 0;
			if (!/*editing*/ ctx[17]) return 1;
			return 2;
		}

		current_block_type_index = select_block_type(ctx);
		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

		let thread1_props = {
			channel: /*channel*/ ctx[3],
			space: /*space*/ ctx[0],
			weave: /*weave*/ ctx[2],
			nothread: /*nothread*/ ctx[1],
			right: true
		};

		const thread1 = new Thread({ props: thread1_props, $$inline: true });
		/*thread1_binding*/ ctx[34](thread1);

		const block = {
			c: function create() {
				div = element("div");
				create_component(thread0.$$.fragment);
				t0 = space$1();
				if_block.c();
				t1 = space$1();
				create_component(thread1.$$.fragment);
				attr_dev(div, "class", div_class_value = "channel " + /*side*/ ctx[4] + " svelte-ugahxz");
				add_location(div, file$a, 83, 0, 1526);

				dispose = [
					action_destroyer(color_action = color$2.call(null, div, /*space*/ ctx[0].name().get())),
					action_destroyer(nav_action = nav.call(null, div, {
						.../*navi*/ ctx[5],
						left: /*nav_function*/ ctx[35],
						right: /*nav_function_1*/ ctx[36],
						insert: /*nav_function_2*/ ctx[37],
						del: /*nav_function_3*/ ctx[38]
					})),
					listen_dev(div, "click", /*click_handler*/ ctx[39], false, false, false)
				];
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				insert_dev(target, div, anchor);
				mount_component(thread0, div, null);
				append_dev(div, t0);
				if_blocks[current_block_type_index].m(div, null);
				append_dev(div, t1);
				mount_component(thread1, div, null);
				current = true;
			},
			p: function update(ctx, dirty) {
				const thread0_changes = {};
				if (dirty[0] & /*channel*/ 8) thread0_changes.channel = /*channel*/ ctx[3];
				if (dirty[0] & /*space*/ 1) thread0_changes.space = /*space*/ ctx[0];
				if (dirty[0] & /*weave*/ 4) thread0_changes.weave = /*weave*/ ctx[2];
				if (dirty[0] & /*nothread*/ 2) thread0_changes.nothread = /*nothread*/ ctx[1];
				thread0.$set(thread0_changes);
				let previous_block_index = current_block_type_index;
				current_block_type_index = select_block_type(ctx);

				if (current_block_type_index === previous_block_index) {
					if_blocks[current_block_type_index].p(ctx, dirty);
				} else {
					group_outros();

					transition_out(if_blocks[previous_block_index], 1, 1, () => {
						if_blocks[previous_block_index] = null;
					});

					check_outros();
					if_block = if_blocks[current_block_type_index];

					if (!if_block) {
						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
						if_block.c();
					}

					transition_in(if_block, 1);
					if_block.m(div, t1);
				}

				const thread1_changes = {};
				if (dirty[0] & /*channel*/ 8) thread1_changes.channel = /*channel*/ ctx[3];
				if (dirty[0] & /*space*/ 1) thread1_changes.space = /*space*/ ctx[0];
				if (dirty[0] & /*weave*/ 4) thread1_changes.weave = /*weave*/ ctx[2];
				if (dirty[0] & /*nothread*/ 2) thread1_changes.nothread = /*nothread*/ ctx[1];
				thread1.$set(thread1_changes);

				if (!current || dirty[0] & /*side*/ 16 && div_class_value !== (div_class_value = "channel " + /*side*/ ctx[4] + " svelte-ugahxz")) {
					attr_dev(div, "class", div_class_value);
				}

				if (color_action && is_function(color_action.update) && dirty[0] & /*space*/ 1) color_action.update.call(null, /*space*/ ctx[0].name().get());

				if (nav_action && is_function(nav_action.update) && dirty[0] & /*navi, thread_left, thread_right, key_editing, key, space*/ 9825) nav_action.update.call(null, {
					.../*navi*/ ctx[5],
					left: /*nav_function*/ ctx[35],
					right: /*nav_function_1*/ ctx[36],
					insert: /*nav_function_2*/ ctx[37],
					del: /*nav_function_3*/ ctx[38]
				});
			},
			i: function intro(local) {
				if (current) return;
				transition_in(thread0.$$.fragment, local);
				transition_in(if_block);
				transition_in(thread1.$$.fragment, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(thread0.$$.fragment, local);
				transition_out(if_block);
				transition_out(thread1.$$.fragment, local);
				current = false;
			},
			d: function destroy(detaching) {
				if (detaching) detach_dev(div);
				/*thread0_binding*/ ctx[26](null);
				destroy_component(thread0);
				if_blocks[current_block_type_index].d();
				/*thread1_binding*/ ctx[34](null);
				destroy_component(thread1);
				run_all(dispose);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$a.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	const edit_color = false;

	function instance$a($$self, $$props, $$invalidate) {
		let $value,
			$$unsubscribe_value = noop$1,
			$$subscribe_value = () => ($$unsubscribe_value(), $$unsubscribe_value = subscribe(value, $$value => $$invalidate(16, $value = $$value)), value);

		let $cursor;
		validate_store(cursor, "cursor");
		component_subscribe($$self, cursor, $$value => $$invalidate(25, $cursor = $$value));
		$$self.$$.on_destroy.push(() => $$unsubscribe_value());
		let { space } = $$props;
		let { nothread } = $$props;
		let { weave } = $$props;
		let { channel } = $$props;
		let { side = `in` } = $$props;
		let { focus = false } = $$props;

		let { executed = () => {
			
		} } = $$props;

		let { navi } = $$props;
		let key_editing = false;
		let val = ``;

		const cancel = () => {
			$$invalidate(17, editing = false);
			$$invalidate(7, val = ``);
		};

		const execute = () => {
			$$invalidate(17, editing = false);

			try {
				value.set(json(val));
				const new_address = `${weave.name.get()}/${value.get()}/!name`;

				if (key === `!name` && $cursor.id === address) {
					requestAnimationFrame(() => {
						goto(new_address);
					});
				}
			} catch(ex) {
				
			}

			$$invalidate(7, val = ``);
			executed();
		};

		const focusd = node => {
			requestAnimationFrame(() => node.focus());
		};

		let edit_sprite = false;
		let thread_left;
		let thread_right;
		let value_node;
		let key_new;

		const new_key = () => {
			$$invalidate(6, key_editing = false);
			if (key_new === ``) return;
			space.remove(key);
			space.write({ [key_new]: value.get() });

			requestAnimationFrame(() => {
				goto(`${space.address()}/${key_new}`);
				$$invalidate(12, key_new = ``);
			});
		};

		const writable_props = ["space", "nothread", "weave", "channel", "side", "focus", "executed", "navi"];

		Object.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Channel> was created with unknown prop '${key}'`);
		});

		function thread0_binding($$value) {
			binding_callbacks[$$value ? "unshift" : "push"](() => {
				$$invalidate(9, thread_left = $$value);
			});
		}

		function input_input_handler() {
			key_new = this.value;
			$$invalidate(12, key_new);
		}

		const keydown_handler = ({ which, code }) => {
			if (code === `End`) {
				$$invalidate(6, key_editing = false);
				return;
			}

			if (which !== 13 && code !== `ControlRight`) return;
			new_key();
		};

		const blur_handler = () => {
			$$invalidate(6, key_editing = false);
		};

		function spriteeditor_binding($$value) {
			binding_callbacks[$$value ? "unshift" : "push"](() => {
				$$invalidate(11, value_node = $$value);
			});
		}

		function input_input_handler_1() {
			val = this.value;
			$$invalidate(7, val);
		}

		const keydown_handler_1 = ({ which, code }) => {
			if (code === `End`) return cancel();
			if (which !== 13 && code !== `ControlRight`) return;
			execute();
		};

		const blur_handler_1 = () => {
			execute();
		};

		function thread1_binding($$value) {
			binding_callbacks[$$value ? "unshift" : "push"](() => {
				$$invalidate(10, thread_right = $$value);
			});
		}

		const nav_function = () => {
			thread_left.do_edit();
		};

		const nav_function_1 = () => {
			thread_right.do_edit();
		};

		const nav_function_2 = () => {
			$$invalidate(6, key_editing = true);
		};

		const nav_function_3 = () => {
			if (key === `!name`) return;
			space.remove(key);
			goto(navi.down === `/` ? navi.up : navi.down);
		};

		const click_handler = e => {
			if (key === `sprite`) {
				$$invalidate(8, edit_sprite = true);

				requestAnimationFrame(() => {
					cursor.set(value_node);
				});

				return;
			}

			$$invalidate(17, editing = true);
			$$invalidate(7, val = JSON.stringify($value));
		};

		$$self.$set = $$props => {
			if ("space" in $$props) $$invalidate(0, space = $$props.space);
			if ("nothread" in $$props) $$invalidate(1, nothread = $$props.nothread);
			if ("weave" in $$props) $$invalidate(2, weave = $$props.weave);
			if ("channel" in $$props) $$invalidate(3, channel = $$props.channel);
			if ("side" in $$props) $$invalidate(4, side = $$props.side);
			if ("focus" in $$props) $$invalidate(23, focus = $$props.focus);
			if ("executed" in $$props) $$invalidate(24, executed = $$props.executed);
			if ("navi" in $$props) $$invalidate(5, navi = $$props.navi);
		};

		$$self.$capture_state = () => {
			return {
				space,
				nothread,
				weave,
				channel,
				side,
				focus,
				executed,
				navi,
				key_editing,
				val,
				edit_sprite,
				thread_left,
				thread_right,
				value_node,
				key_new,
				key,
				value,
				edit,
				$value,
				editing,
				address,
				$cursor
			};
		};

		$$self.$inject_state = $$props => {
			if ("space" in $$props) $$invalidate(0, space = $$props.space);
			if ("nothread" in $$props) $$invalidate(1, nothread = $$props.nothread);
			if ("weave" in $$props) $$invalidate(2, weave = $$props.weave);
			if ("channel" in $$props) $$invalidate(3, channel = $$props.channel);
			if ("side" in $$props) $$invalidate(4, side = $$props.side);
			if ("focus" in $$props) $$invalidate(23, focus = $$props.focus);
			if ("executed" in $$props) $$invalidate(24, executed = $$props.executed);
			if ("navi" in $$props) $$invalidate(5, navi = $$props.navi);
			if ("key_editing" in $$props) $$invalidate(6, key_editing = $$props.key_editing);
			if ("val" in $$props) $$invalidate(7, val = $$props.val);
			if ("edit_sprite" in $$props) $$invalidate(8, edit_sprite = $$props.edit_sprite);
			if ("thread_left" in $$props) $$invalidate(9, thread_left = $$props.thread_left);
			if ("thread_right" in $$props) $$invalidate(10, thread_right = $$props.thread_right);
			if ("value_node" in $$props) $$invalidate(11, value_node = $$props.value_node);
			if ("key_new" in $$props) $$invalidate(12, key_new = $$props.key_new);
			if ("key" in $$props) $$invalidate(13, key = $$props.key);
			if ("value" in $$props) $$subscribe_value($$invalidate(14, value = $$props.value));
			if ("edit" in $$props) $$invalidate(15, edit = $$props.edit);
			if ("$value" in $$props) value.set($value = $$props.$value);
			if ("editing" in $$props) $$invalidate(17, editing = $$props.editing);
			if ("address" in $$props) $$invalidate(18, address = $$props.address);
			if ("$cursor" in $$props) cursor.set($cursor = $$props.$cursor);
		};

		let key;
		let value;
		let edit;
		let editing;
		let address;

		$$self.$$.update = () => {
			if ($$self.$$.dirty[0] & /*channel*/ 8) {
				 $$invalidate(13, [key, value] = channel, key, $$subscribe_value($$invalidate(14, value)));
			}

			if ($$self.$$.dirty[0] & /*$value*/ 65536) {
				 $$invalidate(15, edit = $value);
			}

			if ($$self.$$.dirty[0] & /*focus*/ 8388608) {
				 $$invalidate(17, editing = focus);
			}

			if ($$self.$$.dirty[0] & /*space, key*/ 8193) {
				 $$invalidate(18, address = `${space.address()}/${key}`);
			}
		};

		return [
			space,
			nothread,
			weave,
			channel,
			side,
			navi,
			key_editing,
			val,
			edit_sprite,
			thread_left,
			thread_right,
			value_node,
			key_new,
			key,
			value,
			edit,
			$value,
			editing,
			address,
			cancel,
			execute,
			focusd,
			new_key,
			focus,
			executed,
			$cursor,
			thread0_binding,
			input_input_handler,
			keydown_handler,
			blur_handler,
			spriteeditor_binding,
			input_input_handler_1,
			keydown_handler_1,
			blur_handler_1,
			thread1_binding,
			nav_function,
			nav_function_1,
			nav_function_2,
			nav_function_3,
			click_handler
		];
	}

	class Channel extends SvelteComponentDev {
		constructor(options) {
			super(options);

			init(
				this,
				options,
				instance$a,
				create_fragment$a,
				safe_not_equal,
				{
					space: 0,
					nothread: 1,
					weave: 2,
					channel: 3,
					side: 4,
					focus: 23,
					executed: 24,
					navi: 5
				},
				[-1, -1]
			);

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "Channel",
				options,
				id: create_fragment$a.name
			});

			const { ctx } = this.$$;
			const props = options.props || ({});

			if (/*space*/ ctx[0] === undefined && !("space" in props)) {
				console.warn("<Channel> was created without expected prop 'space'");
			}

			if (/*nothread*/ ctx[1] === undefined && !("nothread" in props)) {
				console.warn("<Channel> was created without expected prop 'nothread'");
			}

			if (/*weave*/ ctx[2] === undefined && !("weave" in props)) {
				console.warn("<Channel> was created without expected prop 'weave'");
			}

			if (/*channel*/ ctx[3] === undefined && !("channel" in props)) {
				console.warn("<Channel> was created without expected prop 'channel'");
			}

			if (/*navi*/ ctx[5] === undefined && !("navi" in props)) {
				console.warn("<Channel> was created without expected prop 'navi'");
			}
		}

		get space() {
			throw new Error("<Channel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set space(value) {
			throw new Error("<Channel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get nothread() {
			throw new Error("<Channel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set nothread(value) {
			throw new Error("<Channel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get weave() {
			throw new Error("<Channel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set weave(value) {
			throw new Error("<Channel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get channel() {
			throw new Error("<Channel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set channel(value) {
			throw new Error("<Channel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get side() {
			throw new Error("<Channel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set side(value) {
			throw new Error("<Channel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get focus() {
			throw new Error("<Channel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set focus(value) {
			throw new Error("<Channel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get executed() {
			throw new Error("<Channel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set executed(value) {
			throw new Error("<Channel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get navi() {
			throw new Error("<Channel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set navi(value) {
			throw new Error("<Channel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* src\_client\explore\Space.svelte generated by Svelte v3.16.7 */

	const { Object: Object_1 } = globals;
	const file$b = "src\\_client\\explore\\Space.svelte";

	function get_each_context$1(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[26] = list[i];
		child_ctx[4] = i;
		return child_ctx;
	}

	// (77:0) {#if !is_bird}
	function create_if_block_3$2(ctx) {
		let div2;
		let div0;
		let t0;
		let div1;
		let t1;
		let color_action;
		let nav_action;
		let current;
		let dispose;

		const postage = new Postage({
				props: {
					address: `/${/*$w_name*/ ctx[15]}/${/*$name*/ ctx[14]}`
				},
				$$inline: true
			});

		const block = {
			c: function create() {
				div2 = element("div");
				div0 = element("div");
				create_component(postage.$$.fragment);
				t0 = space$1();
				div1 = element("div");
				t1 = text(/*$name*/ ctx[14]);
				attr_dev(div0, "class", "postage svelte-oq6z61");
				add_location(div0, file$b, 106, 2, 2077);
				attr_dev(div1, "class", "name svelte-oq6z61");
				add_location(div1, file$b, 109, 2, 2178);
				attr_dev(div2, "class", "space svelte-oq6z61");
				toggle_class(div2, "open", open$1);
				toggle_class(div2, "zero", /*i*/ ctx[4] === 0);
				add_location(div2, file$b, 77, 1, 1467);

				dispose = [
					listen_dev(div0, "click", /*toggle*/ ctx[18], false, false, false),
					action_destroyer(color_action = color$2.call(null, div2, /*$name*/ ctx[14])),
					action_destroyer(nav_action = nav.call(null, div2, {
						id: /*space*/ ctx[0].address(),
						up: /*navi*/ ctx[3].up,
						left: /*toggle*/ ctx[18],
						down: /*chans*/ ctx[11].length > 0
						? `${/*space*/ ctx[0].address()}/${/*chans*/ ctx[11][0][0]}`
						: /*navi*/ ctx[3].down,
						page_up: /*navi*/ ctx[3].page_up,
						page_down: /*navi*/ ctx[3].down,
						del: /*nav_function*/ ctx[23],
						insert: /*nav_function_1*/ ctx[24]
					}))
				];
			},
			m: function mount(target, anchor) {
				insert_dev(target, div2, anchor);
				append_dev(div2, div0);
				mount_component(postage, div0, null);
				append_dev(div2, t0);
				append_dev(div2, div1);
				append_dev(div1, t1);
				current = true;
			},
			p: function update(ctx, dirty) {
				const postage_changes = {};
				if (dirty & /*$w_name, $name*/ 49152) postage_changes.address = `/${/*$w_name*/ ctx[15]}/${/*$name*/ ctx[14]}`;
				postage.$set(postage_changes);
				if (!current || dirty & /*$name*/ 16384) set_data_dev(t1, /*$name*/ ctx[14]);
				if (color_action && is_function(color_action.update) && dirty & /*$name*/ 16384) color_action.update.call(null, /*$name*/ ctx[14]);

				if (nav_action && is_function(nav_action.update) && dirty & /*space, navi, chans, weave, $id*/ 10251) nav_action.update.call(null, {
					id: /*space*/ ctx[0].address(),
					up: /*navi*/ ctx[3].up,
					left: /*toggle*/ ctx[18],
					down: /*chans*/ ctx[11].length > 0
					? `${/*space*/ ctx[0].address()}/${/*chans*/ ctx[11][0][0]}`
					: /*navi*/ ctx[3].down,
					page_up: /*navi*/ ctx[3].page_up,
					page_down: /*navi*/ ctx[3].down,
					del: /*nav_function*/ ctx[23],
					insert: /*nav_function_1*/ ctx[24]
				});

				if (dirty & /*open*/ 0) {
					toggle_class(div2, "open", open$1);
				}

				if (dirty & /*i*/ 16) {
					toggle_class(div2, "zero", /*i*/ ctx[4] === 0);
				}
			},
			i: function intro(local) {
				if (current) return;
				transition_in(postage.$$.fragment, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(postage.$$.fragment, local);
				current = false;
			},
			d: function destroy(detaching) {
				if (detaching) detach_dev(div2);
				destroy_component(postage);
				run_all(dispose);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block_3$2.name,
			type: "if",
			source: "(77:0) {#if !is_bird}",
			ctx
		});

		return block;
	}

	// (116:0) {#if open}
	function create_if_block_2$2(ctx) {
		let div;
		let each_blocks = [];
		let each_1_lookup = new Map();
		let current;
		let each_value = /*chans*/ ctx[11];
		const get_key = ctx => /*channel*/ ctx[26][0];

		for (let i = 0; i < each_value.length; i += 1) {
			let child_ctx = get_each_context$1(ctx, each_value, i);
			let key = get_key(child_ctx);
			each_1_lookup.set(key, each_blocks[i] = create_each_block$1(key, child_ctx));
		}

		const block = {
			c: function create() {
				div = element("div");

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				attr_dev(div, "class", "chans svelte-oq6z61");
				add_location(div, file$b, 116, 0, 2250);
			},
			m: function mount(target, anchor) {
				insert_dev(target, div, anchor);

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].m(div, null);
				}

				current = true;
			},
			p: function update(ctx, dirty) {
				const each_value = /*chans*/ ctx[11];
				group_outros();
				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, div, outro_and_destroy_block, create_each_block$1, null, get_each_context$1);
				check_outros();
			},
			i: function intro(local) {
				if (current) return;

				for (let i = 0; i < each_value.length; i += 1) {
					transition_in(each_blocks[i]);
				}

				current = true;
			},
			o: function outro(local) {
				for (let i = 0; i < each_blocks.length; i += 1) {
					transition_out(each_blocks[i]);
				}

				current = false;
			},
			d: function destroy(detaching) {
				if (detaching) detach_dev(div);

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].d();
				}
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block_2$2.name,
			type: "if",
			source: "(116:0) {#if open}",
			ctx
		});

		return block;
	}

	// (118:1) {#each chans as channel, i (channel[0])}
	function create_each_block$1(key_1, ctx) {
		let first;
		let current;

		const channel = new Channel({
				props: {
					channel: /*channel*/ ctx[26],
					space: /*space*/ ctx[0],
					weave: /*weave*/ ctx[1],
					nothread: /*is_bird*/ ctx[2],
					navi: /*get_nav*/ ctx[17](/*i*/ ctx[4])
				},
				$$inline: true
			});

		const block = {
			key: key_1,
			first: null,
			c: function create() {
				first = empty();
				create_component(channel.$$.fragment);
				this.first = first;
			},
			m: function mount(target, anchor) {
				insert_dev(target, first, anchor);
				mount_component(channel, target, anchor);
				current = true;
			},
			p: function update(ctx, dirty) {
				const channel_changes = {};
				if (dirty & /*chans*/ 2048) channel_changes.channel = /*channel*/ ctx[26];
				if (dirty & /*space*/ 1) channel_changes.space = /*space*/ ctx[0];
				if (dirty & /*weave*/ 2) channel_changes.weave = /*weave*/ ctx[1];
				if (dirty & /*is_bird*/ 4) channel_changes.nothread = /*is_bird*/ ctx[2];
				if (dirty & /*chans*/ 2048) channel_changes.navi = /*get_nav*/ ctx[17](/*i*/ ctx[4]);
				channel.$set(channel_changes);
			},
			i: function intro(local) {
				if (current) return;
				transition_in(channel.$$.fragment, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(channel.$$.fragment, local);
				current = false;
			},
			d: function destroy(detaching) {
				if (detaching) detach_dev(first);
				destroy_component(channel, detaching);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_each_block$1.name,
			type: "each",
			source: "(118:1) {#each chans as channel, i (channel[0])}",
			ctx
		});

		return block;
	}

	// (130:0) {#if birds && rezed}
	function create_if_block$6(ctx) {
		let current;

		const flock = new Flock({
				props: {
					birds: /*birds*/ ctx[10],
					weave: /*weave*/ ctx[1],
					set_bird: /*func*/ ctx[25],
					$$slots: { default: [create_default_slot] },
					$$scope: { ctx }
				},
				$$inline: true
			});

		const block = {
			c: function create() {
				create_component(flock.$$.fragment);
			},
			m: function mount(target, anchor) {
				mount_component(flock, target, anchor);
				current = true;
			},
			p: function update(ctx, dirty) {
				const flock_changes = {};
				if (dirty & /*birds*/ 1024) flock_changes.birds = /*birds*/ ctx[10];
				if (dirty & /*weave*/ 2) flock_changes.weave = /*weave*/ ctx[1];

				if (dirty & /*$$scope, $space_bird, weave*/ 268500994) {
					flock_changes.$$scope = { dirty, ctx };
				}

				flock.$set(flock_changes);
			},
			i: function intro(local) {
				if (current) return;
				transition_in(flock.$$.fragment, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(flock.$$.fragment, local);
				current = false;
			},
			d: function destroy(detaching) {
				destroy_component(flock, detaching);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block$6.name,
			type: "if",
			source: "(130:0) {#if birds && rezed}",
			ctx
		});

		return block;
	}

	// (132:2) {#if $space_bird}
	function create_if_block_1$3(ctx) {
		let current;

		const space_1 = new Space({
				props: {
					weave: /*weave*/ ctx[1],
					space: /*$space_bird*/ ctx[16],
					is_bird: true
				},
				$$inline: true
			});

		const block = {
			c: function create() {
				create_component(space_1.$$.fragment);
			},
			m: function mount(target, anchor) {
				mount_component(space_1, target, anchor);
				current = true;
			},
			p: function update(ctx, dirty) {
				const space_1_changes = {};
				if (dirty & /*weave*/ 2) space_1_changes.weave = /*weave*/ ctx[1];
				if (dirty & /*$space_bird*/ 65536) space_1_changes.space = /*$space_bird*/ ctx[16];
				space_1.$set(space_1_changes);
			},
			i: function intro(local) {
				if (current) return;
				transition_in(space_1.$$.fragment, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(space_1.$$.fragment, local);
				current = false;
			},
			d: function destroy(detaching) {
				destroy_component(space_1, detaching);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block_1$3.name,
			type: "if",
			source: "(132:2) {#if $space_bird}",
			ctx
		});

		return block;
	}

	// (131:1) <Flock {birds} {weave} set_bird={(bird) => { space_bird.set(bird) }}>
	function create_default_slot(ctx) {
		let if_block_anchor;
		let current;
		let if_block = /*$space_bird*/ ctx[16] && create_if_block_1$3(ctx);

		const block = {
			c: function create() {
				if (if_block) if_block.c();
				if_block_anchor = empty();
			},
			m: function mount(target, anchor) {
				if (if_block) if_block.m(target, anchor);
				insert_dev(target, if_block_anchor, anchor);
				current = true;
			},
			p: function update(ctx, dirty) {
				if (/*$space_bird*/ ctx[16]) {
					if (if_block) {
						if_block.p(ctx, dirty);
						transition_in(if_block, 1);
					} else {
						if_block = create_if_block_1$3(ctx);
						if_block.c();
						transition_in(if_block, 1);
						if_block.m(if_block_anchor.parentNode, if_block_anchor);
					}
				} else if (if_block) {
					group_outros();

					transition_out(if_block, 1, 1, () => {
						if_block = null;
					});

					check_outros();
				}
			},
			i: function intro(local) {
				if (current) return;
				transition_in(if_block);
				current = true;
			},
			o: function outro(local) {
				transition_out(if_block);
				current = false;
			},
			d: function destroy(detaching) {
				if (if_block) if_block.d(detaching);
				if (detaching) detach_dev(if_block_anchor);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_default_slot.name,
			type: "slot",
			source: "(131:1) <Flock {birds} {weave} set_bird={(bird) => { space_bird.set(bird) }}>",
			ctx
		});

		return block;
	}

	function create_fragment$b(ctx) {
		let t0;
		let t1;
		let if_block2_anchor;
		let current;
		let if_block0 = !/*is_bird*/ ctx[2] && create_if_block_3$2(ctx);
		let if_block1 =  create_if_block_2$2(ctx);
		let if_block2 = /*birds*/ ctx[10] && /*rezed*/ ctx[12] && create_if_block$6(ctx);

		const block = {
			c: function create() {
				if (if_block0) if_block0.c();
				t0 = space$1();
				if (if_block1) if_block1.c();
				t1 = space$1();
				if (if_block2) if_block2.c();
				if_block2_anchor = empty();
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				if (if_block0) if_block0.m(target, anchor);
				insert_dev(target, t0, anchor);
				if (if_block1) if_block1.m(target, anchor);
				insert_dev(target, t1, anchor);
				if (if_block2) if_block2.m(target, anchor);
				insert_dev(target, if_block2_anchor, anchor);
				current = true;
			},
			p: function update(ctx, [dirty]) {
				if (!/*is_bird*/ ctx[2]) {
					if (if_block0) {
						if_block0.p(ctx, dirty);
						transition_in(if_block0, 1);
					} else {
						if_block0 = create_if_block_3$2(ctx);
						if_block0.c();
						transition_in(if_block0, 1);
						if_block0.m(t0.parentNode, t0);
					}
				} else if (if_block0) {
					group_outros();

					transition_out(if_block0, 1, 1, () => {
						if_block0 = null;
					});

					check_outros();
				}

				if_block1.p(ctx, dirty);

				if (/*birds*/ ctx[10] && /*rezed*/ ctx[12]) {
					if (if_block2) {
						if_block2.p(ctx, dirty);
						transition_in(if_block2, 1);
					} else {
						if_block2 = create_if_block$6(ctx);
						if_block2.c();
						transition_in(if_block2, 1);
						if_block2.m(if_block2_anchor.parentNode, if_block2_anchor);
					}
				} else if (if_block2) {
					group_outros();

					transition_out(if_block2, 1, 1, () => {
						if_block2 = null;
					});

					check_outros();
				}
			},
			i: function intro(local) {
				if (current) return;
				transition_in(if_block0);
				transition_in(if_block1);
				transition_in(if_block2);
				current = true;
			},
			o: function outro(local) {
				transition_out(if_block0);
				transition_out(if_block1);
				transition_out(if_block2);
				current = false;
			},
			d: function destroy(detaching) {
				if (if_block0) if_block0.d(detaching);
				if (detaching) detach_dev(t0);
				if (if_block1) if_block1.d(detaching);
				if (detaching) detach_dev(t1);
				if (if_block2) if_block2.d(detaching);
				if (detaching) detach_dev(if_block2_anchor);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$b.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	const open$1 = true;

	function instance$b($$self, $$props, $$invalidate) {
		let $value,
			$$unsubscribe_value = noop$1,
			$$subscribe_value = () => ($$unsubscribe_value(), $$unsubscribe_value = subscribe(value, $$value => $$invalidate(20, $value = $$value)), value);

		let $w_rezed,
			$$unsubscribe_w_rezed = noop$1,
			$$subscribe_w_rezed = () => ($$unsubscribe_w_rezed(), $$unsubscribe_w_rezed = subscribe(w_rezed, $$value => $$invalidate(22, $w_rezed = $$value)), w_rezed);

		let $id,
			$$unsubscribe_id = noop$1,
			$$subscribe_id = () => ($$unsubscribe_id(), $$unsubscribe_id = subscribe(id, $$value => $$invalidate(13, $id = $$value)), id);

		let $name,
			$$unsubscribe_name = noop$1,
			$$subscribe_name = () => ($$unsubscribe_name(), $$unsubscribe_name = subscribe(name, $$value => $$invalidate(14, $name = $$value)), name);

		let $w_name,
			$$unsubscribe_w_name = noop$1,
			$$subscribe_w_name = () => ($$unsubscribe_w_name(), $$unsubscribe_w_name = subscribe(w_name, $$value => $$invalidate(15, $w_name = $$value)), w_name);

		let $space_bird;
		$$self.$$.on_destroy.push(() => $$unsubscribe_value());
		$$self.$$.on_destroy.push(() => $$unsubscribe_w_rezed());
		$$self.$$.on_destroy.push(() => $$unsubscribe_id());
		$$self.$$.on_destroy.push(() => $$unsubscribe_name());
		$$self.$$.on_destroy.push(() => $$unsubscribe_w_name());
		let { space } = $$props;
		let { weave } = $$props;
		let { is_bird = false } = $$props;
		let { navi = {} } = $$props;
		let { i } = $$props;

		const get_nav = idx => {
			const self = chans[idx][0];

			const down = chans[idx + 1]
			? `${space.address()}/${chans[idx + 1][0]}`
			: navi.down;

			const up = chans[idx - 1]
			? `${space.address()}/${chans[idx - 1][0]}`
			: space.address();

			return {
				id: `${space.address()}/${self}`,
				down,
				up,
				page_up: space.address(),
				page_down: navi.down,
				home: space.address()
			};
		};

		const toggle = e => {
			if (e) {
				e.preventDefault();
				e.stopPropagation();
			}

			const id = space.id.get();

			if (rezed) {
				weave.derez(id);
			} else {
				weave.rez(id);
			}
		};

		const space_bird = write(false);
		validate_store(space_bird, "space_bird");
		component_subscribe($$self, space_bird, value => $$invalidate(16, $space_bird = value));
		const writable_props = ["space", "weave", "is_bird", "navi", "i"];

		Object_1.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Space> was created with unknown prop '${key}'`);
		});

		const nav_function = () => {
			weave.remove($id);
			return navi.down === `/` ? navi.up : navi.down;
		};

		const nav_function_1 = () => {
			space.write({ "": `` });

			requestAnimationFrame(() => {
				goto(`${space.address()}/`);
				cursor.get().insert();
			});
		};

		const func = bird => {
			space_bird.set(bird);
		};

		$$self.$set = $$props => {
			if ("space" in $$props) $$invalidate(0, space = $$props.space);
			if ("weave" in $$props) $$invalidate(1, weave = $$props.weave);
			if ("is_bird" in $$props) $$invalidate(2, is_bird = $$props.is_bird);
			if ("navi" in $$props) $$invalidate(3, navi = $$props.navi);
			if ("i" in $$props) $$invalidate(4, i = $$props.i);
		};

		$$self.$capture_state = () => {
			return {
				space,
				weave,
				is_bird,
				navi,
				i,
				w_name,
				w_rezed,
				value,
				name,
				$value,
				id,
				birds,
				bird,
				chans,
				rezed,
				$w_rezed,
				$id,
				$name,
				$w_name,
				$space_bird
			};
		};

		$$self.$inject_state = $$props => {
			if ("space" in $$props) $$invalidate(0, space = $$props.space);
			if ("weave" in $$props) $$invalidate(1, weave = $$props.weave);
			if ("is_bird" in $$props) $$invalidate(2, is_bird = $$props.is_bird);
			if ("navi" in $$props) $$invalidate(3, navi = $$props.navi);
			if ("i" in $$props) $$invalidate(4, i = $$props.i);
			if ("w_name" in $$props) $$subscribe_w_name($$invalidate(5, w_name = $$props.w_name));
			if ("w_rezed" in $$props) $$subscribe_w_rezed($$invalidate(6, w_rezed = $$props.w_rezed));
			if ("value" in $$props) $$subscribe_value($$invalidate(7, value = $$props.value));
			if ("name" in $$props) $$subscribe_name($$invalidate(8, name = $$props.name));
			if ("$value" in $$props) value.set($value = $$props.$value);
			if ("id" in $$props) $$subscribe_id($$invalidate(9, id = $$props.id));
			if ("birds" in $$props) $$invalidate(10, birds = $$props.birds);
			if ("bird" in $$props) bird = $$props.bird;
			if ("chans" in $$props) $$invalidate(11, chans = $$props.chans);
			if ("rezed" in $$props) $$invalidate(12, rezed = $$props.rezed);
			if ("$w_rezed" in $$props) w_rezed.set($w_rezed = $$props.$w_rezed);
			if ("$id" in $$props) id.set($id = $$props.$id);
			if ("$name" in $$props) name.set($name = $$props.$name);
			if ("$w_name" in $$props) w_name.set($w_name = $$props.$w_name);
			if ("$space_bird" in $$props) space_bird.set($space_bird = $$props.$space_bird);
		};

		let w_name;
		let w_rezed;
		let value;
		let name;
		let id;
		let birds;
		let bird;
		let chans;
		let rezed;

		$$self.$$.update = () => {
			if ($$self.$$.dirty & /*weave*/ 2) {
				 $$subscribe_w_name($$invalidate(5, w_name = weave.name));
			}

			if ($$self.$$.dirty & /*weave*/ 2) {
				 $$subscribe_w_rezed($$invalidate(6, w_rezed = weave.rezed));
			}

			if ($$self.$$.dirty & /*space*/ 1) {
				 $$subscribe_value($$invalidate(7, value = space
				? space.value
				: read({ "!name": read(``), "!birds": read([]) })));
			}

			if ($$self.$$.dirty & /*$value*/ 1048576) {
				 $$subscribe_name($$invalidate(8, name = $value[`!name`] || read(``)));
			}

			if ($$self.$$.dirty & /*space*/ 1) {
				 $$subscribe_id($$invalidate(9, id = space.id));
			}

			if ($$self.$$.dirty & /*$value*/ 1048576) {
				 $$invalidate(10, birds = $value[`!birds`]);
			}

			if ($$self.$$.dirty & /*$value*/ 1048576) {
				 bird = $value[`!bird`];
			}

			if ($$self.$$.dirty & /*$value*/ 1048576) {
				 $$invalidate(11, chans = Object.entries($value).sort(([a], [b]) => {
					if (a > b) return 1;
					if (b > a) return -1;
					return 0;
				}));
			}

			if ($$self.$$.dirty & /*$w_rezed, $id*/ 4202496) {
				 $$invalidate(12, rezed = $w_rezed[$id]);
			}
		};

		return [
			space,
			weave,
			is_bird,
			navi,
			i,
			w_name,
			w_rezed,
			value,
			name,
			id,
			birds,
			chans,
			rezed,
			$id,
			$name,
			$w_name,
			$space_bird,
			get_nav,
			toggle,
			space_bird,
			$value,
			bird,
			$w_rezed,
			nav_function,
			nav_function_1,
			func
		];
	}

	class Space extends SvelteComponentDev {
		constructor(options) {
			super(options);

			init(this, options, instance$b, create_fragment$b, safe_not_equal, {
				space: 0,
				weave: 1,
				is_bird: 2,
				navi: 3,
				i: 4
			});

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "Space",
				options,
				id: create_fragment$b.name
			});

			const { ctx } = this.$$;
			const props = options.props || ({});

			if (/*space*/ ctx[0] === undefined && !("space" in props)) {
				console.warn("<Space> was created without expected prop 'space'");
			}

			if (/*weave*/ ctx[1] === undefined && !("weave" in props)) {
				console.warn("<Space> was created without expected prop 'weave'");
			}

			if (/*i*/ ctx[4] === undefined && !("i" in props)) {
				console.warn("<Space> was created without expected prop 'i'");
			}
		}

		get space() {
			throw new Error("<Space>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set space(value) {
			throw new Error("<Space>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get weave() {
			throw new Error("<Space>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set weave(value) {
			throw new Error("<Space>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get is_bird() {
			throw new Error("<Space>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set is_bird(value) {
			throw new Error("<Space>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get navi() {
			throw new Error("<Space>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set navi(value) {
			throw new Error("<Space>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get i() {
			throw new Error("<Space>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set i(value) {
			throw new Error("<Space>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* src\_client\explore\Weave.svelte generated by Svelte v3.16.7 */

	const { Object: Object_1$1 } = globals;
	const file$c = "src\\_client\\explore\\Weave.svelte";

	function get_each_context$2(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[19] = list[i][0];
		child_ctx[20] = list[i][1];
		child_ctx[22] = i;
		return child_ctx;
	}

	// (75:1) <Controls {weave} bind:this={controls}>
	function create_default_slot$1(ctx) {
		let div;
		let t;

		const block = {
			c: function create() {
				div = element("div");
				t = text(/*$name*/ ctx[6]);
				attr_dev(div, "class", "namezor svelte-967sk2");
				add_location(div, file$c, 75, 2, 1619);
			},
			m: function mount(target, anchor) {
				insert_dev(target, div, anchor);
				append_dev(div, t);
			},
			p: function update(ctx, dirty) {
				if (dirty & /*$name*/ 64) set_data_dev(t, /*$name*/ ctx[6]);
			},
			d: function destroy(detaching) {
				if (detaching) detach_dev(div);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_default_slot$1.name,
			type: "slot",
			source: "(75:1) <Controls {weave} bind:this={controls}>",
			ctx
		});

		return block;
	}

	// (84:2) {#each spacees as [s_name,space], i (s_name)}
	function create_each_block$2(key_1, ctx) {
		let first;
		let current;

		const space_1 = new Space({
				props: {
					space: /*space*/ ctx[20],
					weave: /*weave*/ ctx[0],
					i: /*i*/ ctx[22],
					navi: {
						up: /*i*/ ctx[22] === 0
						? /*$name*/ ctx[6]
						: /*get_up*/ ctx[7](/*i*/ ctx[22]),
						page_up: /*i*/ ctx[22] === 0
						? /*$name*/ ctx[6]
						: `${/*$name*/ ctx[6]}/${/*spacees*/ ctx[5][/*i*/ ctx[22] - 1][0]}`,
						down: /*i*/ ctx[22] === /*spacees*/ ctx[5].length - 1
						? /*navi*/ ctx[1].down
						: `${/*$name*/ ctx[6]}/${/*spacees*/ ctx[5][/*i*/ ctx[22] + 1][0]}`
					}
				},
				$$inline: true
			});

		const block = {
			key: key_1,
			first: null,
			c: function create() {
				first = empty();
				create_component(space_1.$$.fragment);
				this.first = first;
			},
			m: function mount(target, anchor) {
				insert_dev(target, first, anchor);
				mount_component(space_1, target, anchor);
				current = true;
			},
			p: function update(ctx, dirty) {
				const space_1_changes = {};
				if (dirty & /*spacees*/ 32) space_1_changes.space = /*space*/ ctx[20];
				if (dirty & /*weave*/ 1) space_1_changes.weave = /*weave*/ ctx[0];
				if (dirty & /*spacees*/ 32) space_1_changes.i = /*i*/ ctx[22];

				if (dirty & /*spacees, $name, navi*/ 98) space_1_changes.navi = {
					up: /*i*/ ctx[22] === 0
					? /*$name*/ ctx[6]
					: /*get_up*/ ctx[7](/*i*/ ctx[22]),
					page_up: /*i*/ ctx[22] === 0
					? /*$name*/ ctx[6]
					: `${/*$name*/ ctx[6]}/${/*spacees*/ ctx[5][/*i*/ ctx[22] - 1][0]}`,
					down: /*i*/ ctx[22] === /*spacees*/ ctx[5].length - 1
					? /*navi*/ ctx[1].down
					: `${/*$name*/ ctx[6]}/${/*spacees*/ ctx[5][/*i*/ ctx[22] + 1][0]}`
				};

				space_1.$set(space_1_changes);
			},
			i: function intro(local) {
				if (current) return;
				transition_in(space_1.$$.fragment, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(space_1.$$.fragment, local);
				current = false;
			},
			d: function destroy(detaching) {
				if (detaching) detach_dev(first);
				destroy_component(space_1, detaching);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_each_block$2.name,
			type: "each",
			source: "(84:2) {#each spacees as [s_name,space], i (s_name)}",
			ctx
		});

		return block;
	}

	function create_fragment$c(ctx) {
		let div0;
		let dark_action;
		let nav_action;
		let t0;
		let div1;
		let each_blocks = [];
		let each_1_lookup = new Map();
		let t1;
		let div2;
		let dark_action_1;
		let current;
		let dispose;

		let controls_1_props = {
			weave: /*weave*/ ctx[0],
			$$slots: { default: [create_default_slot$1] },
			$$scope: { ctx }
		};

		const controls_1 = new Controls({ props: controls_1_props, $$inline: true });
		/*controls_1_binding*/ ctx[10](controls_1);
		let each_value = /*spacees*/ ctx[5];
		const get_key = ctx => /*s_name*/ ctx[19];

		for (let i = 0; i < each_value.length; i += 1) {
			let child_ctx = get_each_context$2(ctx, each_value, i);
			let key = get_key(child_ctx);
			each_1_lookup.set(key, each_blocks[i] = create_each_block$2(key, child_ctx));
		}

		const block = {
			c: function create() {
				div0 = element("div");
				create_component(controls_1.$$.fragment);
				t0 = space$1();
				div1 = element("div");

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				t1 = space$1();
				div2 = element("div");
				attr_dev(div0, "class", "weave svelte-967sk2");
				add_location(div0, file$c, 33, 0, 767);
				attr_dev(div1, "class", "spaces");
				add_location(div1, file$c, 82, 1, 1691);
				attr_dev(div2, "class", "fakespace svelte-967sk2");
				add_location(div2, file$c, 100, 0, 2052);

				dispose = [
					action_destroyer(dark_action = dark.call(null, div0, /*$name*/ ctx[6])),
					action_destroyer(nav_action = nav.call(null, div0, {
						id: /*$name*/ ctx[6],
						up: /*nav_function*/ ctx[11],
						down: /*nav_function_1*/ ctx[12],
						page_down: /*nav_function_2*/ ctx[13],
						page_up: /*nav_function_3*/ ctx[14],
						origin: /*$name*/ ctx[6] === `sys`,
						left: /*nav_function_4*/ ctx[15],
						right: /*nav_function_5*/ ctx[16],
						insert: /*nav_function_6*/ ctx[17],
						del: /*nav_function_7*/ ctx[18]
					})),
					action_destroyer(dark_action_1 = dark.call(null, div2, /*$name*/ ctx[6]))
				];
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				insert_dev(target, div0, anchor);
				mount_component(controls_1, div0, null);
				insert_dev(target, t0, anchor);
				insert_dev(target, div1, anchor);

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].m(div1, null);
				}

				insert_dev(target, t1, anchor);
				insert_dev(target, div2, anchor);
				current = true;
			},
			p: function update(ctx, [dirty]) {
				const controls_1_changes = {};
				if (dirty & /*weave*/ 1) controls_1_changes.weave = /*weave*/ ctx[0];

				if (dirty & /*$$scope, $name*/ 8388672) {
					controls_1_changes.$$scope = { dirty, ctx };
				}

				controls_1.$set(controls_1_changes);
				if (dark_action && is_function(dark_action.update) && dirty & /*$name*/ 64) dark_action.update.call(null, /*$name*/ ctx[6]);

				if (nav_action && is_function(nav_action.update) && dirty & /*$name, navi, spacees, controls, weave*/ 103) nav_action.update.call(null, {
					id: /*$name*/ ctx[6],
					up: /*nav_function*/ ctx[11],
					down: /*nav_function_1*/ ctx[12],
					page_down: /*nav_function_2*/ ctx[13],
					page_up: /*nav_function_3*/ ctx[14],
					origin: /*$name*/ ctx[6] === `sys`,
					left: /*nav_function_4*/ ctx[15],
					right: /*nav_function_5*/ ctx[16],
					insert: /*nav_function_6*/ ctx[17],
					del: /*nav_function_7*/ ctx[18]
				});

				const each_value = /*spacees*/ ctx[5];
				group_outros();
				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, div1, outro_and_destroy_block, create_each_block$2, null, get_each_context$2);
				check_outros();
				if (dark_action_1 && is_function(dark_action_1.update) && dirty & /*$name*/ 64) dark_action_1.update.call(null, /*$name*/ ctx[6]);
			},
			i: function intro(local) {
				if (current) return;
				transition_in(controls_1.$$.fragment, local);

				for (let i = 0; i < each_value.length; i += 1) {
					transition_in(each_blocks[i]);
				}

				current = true;
			},
			o: function outro(local) {
				transition_out(controls_1.$$.fragment, local);

				for (let i = 0; i < each_blocks.length; i += 1) {
					transition_out(each_blocks[i]);
				}

				current = false;
			},
			d: function destroy(detaching) {
				if (detaching) detach_dev(div0);
				/*controls_1_binding*/ ctx[10](null);
				destroy_component(controls_1);
				if (detaching) detach_dev(t0);
				if (detaching) detach_dev(div1);

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].d();
				}

				if (detaching) detach_dev(t1);
				if (detaching) detach_dev(div2);
				run_all(dispose);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$c.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function instance$c($$self, $$props, $$invalidate) {
		let $names,
			$$unsubscribe_names = noop$1,
			$$subscribe_names = () => ($$unsubscribe_names(), $$unsubscribe_names = subscribe(names, $$value => $$invalidate(8, $names = $$value)), names);

		let $name,
			$$unsubscribe_name = noop$1,
			$$subscribe_name = () => ($$unsubscribe_name(), $$unsubscribe_name = subscribe(name, $$value => $$invalidate(6, $name = $$value)), name);

		$$self.$$.on_destroy.push(() => $$unsubscribe_names());
		$$self.$$.on_destroy.push(() => $$unsubscribe_name());
		let { weave } = $$props;
		let { navi = {} } = $$props;

		const get_up = idx => {
			const [name_o, space_o] = spacees[idx - 1];
			const keys = Object.keys(space_o.value.get()).sort();

			return keys.length > 0
			? `${$name}/${name_o}/${keys[keys.length - 1]}`
			: `${$name}/${name_o}`;
		};

		let controls;
		const writable_props = ["weave", "navi"];

		Object_1$1.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Weave> was created with unknown prop '${key}'`);
		});

		function controls_1_binding($$value) {
			binding_callbacks[$$value ? "unshift" : "push"](() => {
				$$invalidate(2, controls = $$value);
			});
		}

		const nav_function = () => navi.up;

		const nav_function_1 = () => spacees.length > 0
		? `${$name}/${spacees[0][0]}`
		: navi.down;

		const nav_function_2 = () => spacees.length > 0
		? `${$name}/${spacees[0][0]}`
		: navi.down;

		const nav_function_3 = () => navi.up;

		const nav_function_4 = () => {
			controls.toggle();
		};

		const nav_function_5 = () => {
			controls.save_it();
		};

		const nav_function_6 = () => {
			const space_name = random(2);

			weave.write({
				[uuid()]: {
					type: `space`,
					value: { "!name": space_name }
				}
			});

			requestAnimationFrame(() => {
				goto(`${$name}/${space_name}/!name`);
				cursor.get().click();
			});
		};

		const nav_function_7 = () => {
			Wheel.del([$name]);
			return navi.down;
		};

		$$self.$set = $$props => {
			if ("weave" in $$props) $$invalidate(0, weave = $$props.weave);
			if ("navi" in $$props) $$invalidate(1, navi = $$props.navi);
		};

		$$self.$capture_state = () => {
			return {
				weave,
				navi,
				controls,
				name,
				names,
				spacees,
				$names,
				warps,
				$name
			};
		};

		$$self.$inject_state = $$props => {
			if ("weave" in $$props) $$invalidate(0, weave = $$props.weave);
			if ("navi" in $$props) $$invalidate(1, navi = $$props.navi);
			if ("controls" in $$props) $$invalidate(2, controls = $$props.controls);
			if ("name" in $$props) $$subscribe_name($$invalidate(3, name = $$props.name));
			if ("names" in $$props) $$subscribe_names($$invalidate(4, names = $$props.names));
			if ("spacees" in $$props) $$invalidate(5, spacees = $$props.spacees);
			if ("$names" in $$props) names.set($names = $$props.$names);
			if ("warps" in $$props) warps = $$props.warps;
			if ("$name" in $$props) name.set($name = $$props.$name);
		};

		let name;
		let names;
		let spacees;
		let warps;

		$$self.$$.update = () => {
			if ($$self.$$.dirty & /*weave*/ 1) {
				 $$subscribe_name($$invalidate(3, name = weave.name));
			}

			if ($$self.$$.dirty & /*weave*/ 1) {
				 $$subscribe_names($$invalidate(4, names = weave.names));
			}

			if ($$self.$$.dirty & /*$names*/ 256) {
				 $$invalidate(5, spacees = Object.entries($names).sort(([a], [b]) => {
					if (a > b) return 1;
					if (b > a) return -1;
					return 0;
				}));
			}

			if ($$self.$$.dirty & /*weave*/ 1) {
				 warps = weave.warps;
			}
		};

		return [
			weave,
			navi,
			controls,
			name,
			names,
			spacees,
			$name,
			get_up,
			$names,
			warps,
			controls_1_binding,
			nav_function,
			nav_function_1,
			nav_function_2,
			nav_function_3,
			nav_function_4,
			nav_function_5,
			nav_function_6,
			nav_function_7
		];
	}

	class Weave$1 extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$c, create_fragment$c, safe_not_equal, { weave: 0, navi: 1 });

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "Weave",
				options,
				id: create_fragment$c.name
			});

			const { ctx } = this.$$;
			const props = options.props || ({});

			if (/*weave*/ ctx[0] === undefined && !("weave" in props)) {
				console.warn("<Weave> was created without expected prop 'weave'");
			}
		}

		get weave() {
			throw new Error("<Weave>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set weave(value) {
			throw new Error("<Weave>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get navi() {
			throw new Error("<Weave>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set navi(value) {
			throw new Error("<Weave>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* src\_client\weave\Github.svelte generated by Svelte v3.16.7 */

	const file$d = "src\\_client\\weave\\Github.svelte";

	function create_fragment$d(ctx) {
		let svg;
		let path0;
		let path1;
		let path2;

		const block = {
			c: function create() {
				svg = svg_element("svg");
				path0 = svg_element("path");
				path1 = svg_element("path");
				path2 = svg_element("path");
				attr_dev(path0, "class", "bg svelte-op8pzp");
				attr_dev(path0, "d", "M0 0l115 115h15l12 27 108 108V0z");
				attr_dev(path0, "fill", "#fff");
				add_location(path0, file$d, 1, 2, 161);
				attr_dev(path1, "class", "octo-arm svelte-op8pzp");
				attr_dev(path1, "d", "M128 109c-15-9-9-19-9-19 3-7 2-11 2-11-1-7 3-2 3-2 4 5 2 11 2 11-3 10 5 15 9 16");
				set_style(path1, "-webkit-transform-origin", "130px 106px");
				set_style(path1, "transform-origin", "130px 106px");
				add_location(path1, file$d, 2, 2, 233);
				attr_dev(path2, "class", "octo-body svelte-op8pzp");
				attr_dev(path2, "d", "M115 115s4 2 5 0l14-14c3-2 6-3 8-3-8-11-15-24 2-41 5-5 10-7 16-7 1-2 3-7 12-11 0 0 5 3 7 16 4 2 8 5 12 9s7 8 9 12c14 3 17 7 17 7-4 8-9 11-11 11 0 6-2 11-7 16-16 16-30 10-41 2 0 3-1 7-5 11l-12 11c-1 1 1 5 1 5z");
				add_location(path2, file$d, 3, 2, 422);
				attr_dev(svg, "id", "github");
				attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
				attr_dev(svg, "width", "80");
				attr_dev(svg, "height", "80");
				attr_dev(svg, "viewBox", "0 0 250 250");
				attr_dev(svg, "fill", "#151513");
				set_style(svg, "position", "absolute");
				set_style(svg, "top", "0");
				set_style(svg, "right", "0");
				attr_dev(svg, "class", "svelte-op8pzp");
				add_location(svg, file$d, 0, 0, 0);
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				insert_dev(target, svg, anchor);
				append_dev(svg, path0);
				append_dev(svg, path1);
				append_dev(svg, path2);
			},
			p: noop$1,
			i: noop$1,
			o: noop$1,
			d: function destroy(detaching) {
				if (detaching) detach_dev(svg);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$d.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	class Github extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, null, create_fragment$d, safe_not_equal, {});

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "Github",
				options,
				id: create_fragment$d.name
			});
		}
	}

	/* src\_client\weave\Picker.svelte generated by Svelte v3.16.7 */

	const { Object: Object_1$2, console: console_1$1 } = globals;
	const file$e = "src\\_client\\weave\\Picker.svelte";

	// (79:0) {#if nameit}
	function create_if_block$7(ctx) {
		let div4;
		let h2;
		let t1;
		let div0;
		let promise;
		let t2;
		let input;
		let t3;
		let div3;
		let div1;
		let t5;
		let div2;
		let color_action;
		let dispose;

		let info = {
			ctx,
			current: null,
			token: null,
			pending: create_pending_block$2,
			then: create_then_block$2,
			catch: create_catch_block$2,
			value: 19
		};

		handle_promise(promise = image(/*name*/ ctx[2]), info);

		const block = {
			c: function create() {
				div4 = element("div");
				h2 = element("h2");
				h2.textContent = "Name It!";
				t1 = space$1();
				div0 = element("div");
				info.block.c();
				t2 = space$1();
				input = element("input");
				t3 = space$1();
				div3 = element("div");
				div1 = element("div");
				div1.textContent = "Cancel";
				t5 = space$1();
				div2 = element("div");
				div2.textContent = "Plant";
				add_location(h2, file$e, 83, 1, 1428);
				attr_dev(div0, "class", "spirit svelte-vktjrt");
				add_location(div0, file$e, 85, 1, 1450);
				attr_dev(input, "class", "nameit svelte-vktjrt");
				input.autofocus = true;
				attr_dev(input, "type", "text");
				attr_dev(input, "placeholder", "Name it");
				add_location(input, file$e, 91, 1, 1572);
				attr_dev(div1, "class", "false svelte-vktjrt");
				add_location(div1, file$e, 107, 2, 1858);
				attr_dev(div2, "class", "true svelte-vktjrt");
				add_location(div2, file$e, 108, 2, 1929);
				attr_dev(div3, "class", "controls svelte-vktjrt");
				add_location(div3, file$e, 106, 1, 1832);
				attr_dev(div4, "class", "nameprompt svelte-vktjrt");
				add_location(div4, file$e, 79, 0, 1372);

				dispose = [
					listen_dev(input, "keydown", /*keydown_handler*/ ctx[14], false, false, false),
					listen_dev(input, "input", /*input_input_handler*/ ctx[15]),
					listen_dev(div1, "click", /*click_handler*/ ctx[16], false, false, false),
					listen_dev(div2, "click", /*play_it*/ ctx[5], false, false, false),
					action_destroyer(color_action = color$2.call(null, div4, `/${/*name*/ ctx[2]}`))
				];
			},
			m: function mount(target, anchor) {
				insert_dev(target, div4, anchor);
				append_dev(div4, h2);
				append_dev(div4, t1);
				append_dev(div4, div0);
				info.block.m(div0, info.anchor = null);
				info.mount = () => div0;
				info.anchor = null;
				append_dev(div4, t2);
				append_dev(div4, input);
				set_input_value(input, /*name*/ ctx[2]);
				append_dev(div4, t3);
				append_dev(div4, div3);
				append_dev(div3, div1);
				append_dev(div3, t5);
				append_dev(div3, div2);
				input.focus();
			},
			p: function update(new_ctx, dirty) {
				ctx = new_ctx;
				info.ctx = ctx;

				if (dirty & /*name*/ 4 && promise !== (promise = image(/*name*/ ctx[2])) && handle_promise(promise, info)) ; else {
					const child_ctx = ctx.slice();
					child_ctx[19] = info.resolved;
					info.block.p(child_ctx, dirty);
				}

				if (dirty & /*name*/ 4 && input.value !== /*name*/ ctx[2]) {
					set_input_value(input, /*name*/ ctx[2]);
				}

				if (color_action && is_function(color_action.update) && dirty & /*name*/ 4) color_action.update.call(null, `/${/*name*/ ctx[2]}`);
			},
			d: function destroy(detaching) {
				if (detaching) detach_dev(div4);
				info.block.d();
				info.token = null;
				info = null;
				run_all(dispose);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block$7.name,
			type: "if",
			source: "(79:0) {#if nameit}",
			ctx
		});

		return block;
	}

	// (1:0) <script>  import { load, image }
	function create_catch_block$2(ctx) {
		const block = { c: noop$1, m: noop$1, p: noop$1, d: noop$1 };

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_catch_block$2.name,
			type: "catch",
			source: "(1:0) <script>  import { load, image }",
			ctx
		});

		return block;
	}

	// (87:30)     <img  class="flex" {src}
	function create_then_block$2(ctx) {
		let img;
		let img_src_value;

		const block = {
			c: function create() {
				img = element("img");
				attr_dev(img, "class", "flex svelte-vktjrt");
				if (img.src !== (img_src_value = /*src*/ ctx[19])) attr_dev(img, "src", img_src_value);
				attr_dev(img, "alt", "fileicon");
				add_location(img, file$e, 87, 2, 1506);
			},
			m: function mount(target, anchor) {
				insert_dev(target, img, anchor);
			},
			p: function update(ctx, dirty) {
				if (dirty & /*name*/ 4 && img.src !== (img_src_value = /*src*/ ctx[19])) {
					attr_dev(img, "src", img_src_value);
				}
			},
			d: function destroy(detaching) {
				if (detaching) detach_dev(img);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_then_block$2.name,
			type: "then",
			source: "(87:30)     <img  class=\\\"flex\\\" {src}",
			ctx
		});

		return block;
	}

	// (1:0) <script>  import { load, image }
	function create_pending_block$2(ctx) {
		const block = { c: noop$1, m: noop$1, p: noop$1, d: noop$1 };

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_pending_block$2.name,
			type: "pending",
			source: "(1:0) <script>  import { load, image }",
			ctx
		});

		return block;
	}

	function create_fragment$e(ctx) {
		let t0;
		let div;
		let t1;
		let input;
		let current;
		let dispose;
		let if_block = /*nameit*/ ctx[0] && create_if_block$7(ctx);
		const default_slot_template = /*$$slots*/ ctx[13].default;
		const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[12], null);

		const block = {
			c: function create() {
				if (if_block) if_block.c();
				t0 = space$1();
				div = element("div");
				if (default_slot) default_slot.c();
				t1 = space$1();
				input = element("input");
				attr_dev(div, "class", "picker svelte-vktjrt");
				add_location(div, file$e, 113, 0, 2005);
				attr_dev(input, "type", "file");
				attr_dev(input, "class", "file svelte-vktjrt");
				input.multiple = "multiple";
				add_location(input, file$e, 121, 0, 2125);

				dispose = [
					listen_dev(div, "drop", /*drop*/ ctx[3], false, false, false),
					listen_dev(div, "dragover", /*over*/ ctx[4](true), false, false, false),
					listen_dev(div, "dragleave", /*over*/ ctx[4](false), false, false, false),
					listen_dev(input, "change", /*change_handler*/ ctx[18], false, false, false)
				];
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				if (if_block) if_block.m(target, anchor);
				insert_dev(target, t0, anchor);
				insert_dev(target, div, anchor);

				if (default_slot) {
					default_slot.m(div, null);
				}

				insert_dev(target, t1, anchor);
				insert_dev(target, input, anchor);
				/*input_binding*/ ctx[17](input);
				current = true;
			},
			p: function update(ctx, [dirty]) {
				if (/*nameit*/ ctx[0]) {
					if (if_block) {
						if_block.p(ctx, dirty);
					} else {
						if_block = create_if_block$7(ctx);
						if_block.c();
						if_block.m(t0.parentNode, t0);
					}
				} else if (if_block) {
					if_block.d(1);
					if_block = null;
				}

				if (default_slot && default_slot.p && dirty & /*$$scope*/ 4096) {
					default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[12], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[12], dirty, null));
				}
			},
			i: function intro(local) {
				if (current) return;
				transition_in(default_slot, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(default_slot, local);
				current = false;
			},
			d: function destroy(detaching) {
				if (if_block) if_block.d(detaching);
				if (detaching) detach_dev(t0);
				if (detaching) detach_dev(div);
				if (default_slot) default_slot.d(detaching);
				if (detaching) detach_dev(t1);
				if (detaching) detach_dev(input);
				/*input_binding*/ ctx[17](null);
				run_all(dispose);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$e.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function instance$d($$self, $$props, $$invalidate) {
		let $cursor;
		validate_store(cursor, "cursor");
		component_subscribe($$self, cursor, $$value => $$invalidate(11, $cursor = $$value));
		let last = {};
		let files;
		let { nameit = false } = $$props;
		const id = `/picker`;

		const drop = e => {
			e.preventDefault();
			e.stopPropagation();
			const files = e.dataTransfer.files;

			for (let i = 0; i < files.length; i++) {
				const reader = new FileReader();

				reader.onloadend = e => {
					last = files[i];
					$$invalidate(0, nameit = load(e.target.result));
					if (!nameit) return;
					$$invalidate(2, name = `${nameit.name}`);
				};

				reader.readAsDataURL(files[i]);
			}
		};

		const over = whether => e => {
			e.dataTransfer.dropEffect = `copy`;
			e.preventDefault();
			e.stopPropagation();
		};

		const cancel = () => {
			$$invalidate(0, nameit = false);
		};

		const click = () => {
			play_it();
		};

		const play_it = () => {
			delete nameit.id;
			Wheel.spawn({ [name]: nameit });
			const weave = Wheel.get(name);

			weave.write({
				"!info": {
					type: `space`,
					value: {
						from: last.name,
						"save last": last.lastModified,
						size: last.size
					}
				}
			});

			$$invalidate(0, nameit = false);
		};

		let name;
		const writable_props = ["nameit"];

		Object_1$2.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1$1.warn(`<Picker> was created with unknown prop '${key}'`);
		});

		let { $$slots = {}, $$scope } = $$props;

		const keydown_handler = e => {
			if (e.key.toLowerCase() === `end`) {
				$$invalidate(0, nameit = false);
				return;
			}

			if (e.which !== 13) return;
			play_it();
		};

		function input_input_handler() {
			name = this.value;
			$$invalidate(2, name);
		}

		const click_handler = () => {
			$$invalidate(0, nameit = false);
		};

		function input_binding($$value) {
			binding_callbacks[$$value ? "unshift" : "push"](() => {
				$$invalidate(1, files = $$value);
			});
		}

		const change_handler = e => {
			console.log(e.dataTransfer, e.target);
		};

		$$self.$set = $$props => {
			if ("nameit" in $$props) $$invalidate(0, nameit = $$props.nameit);
			if ("$$scope" in $$props) $$invalidate(12, $$scope = $$props.$$scope);
		};

		$$self.$capture_state = () => {
			return {
				last,
				files,
				nameit,
				name,
				arr_warps,
				$cursor
			};
		};

		$$self.$inject_state = $$props => {
			if ("last" in $$props) last = $$props.last;
			if ("files" in $$props) $$invalidate(1, files = $$props.files);
			if ("nameit" in $$props) $$invalidate(0, nameit = $$props.nameit);
			if ("name" in $$props) $$invalidate(2, name = $$props.name);
			if ("arr_warps" in $$props) arr_warps = $$props.arr_warps;
			if ("$cursor" in $$props) cursor.set($cursor = $$props.$cursor);
		};

		let arr_warps;

		$$self.$$.update = () => {
			if ($$self.$$.dirty & /*nameit, $cursor*/ 2049) {
				 {
					if (nameit === false && $cursor && $cursor.id === `/picker`) {
						goto(`/`);
					}
				}
			}
		};

		 arr_warps = Object.entries(warps$1);

		return [
			nameit,
			files,
			name,
			drop,
			over,
			play_it,
			id,
			cancel,
			click,
			last,
			arr_warps,
			$cursor,
			$$scope,
			$$slots,
			keydown_handler,
			input_input_handler,
			click_handler,
			input_binding,
			change_handler
		];
	}

	class Picker extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$d, create_fragment$e, safe_not_equal, { nameit: 0, id: 6, cancel: 7, click: 8 });

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "Picker",
				options,
				id: create_fragment$e.name
			});
		}

		get nameit() {
			throw new Error("<Picker>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set nameit(value) {
			throw new Error("<Picker>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get id() {
			return this.$$.ctx[6];
		}

		set id(value) {
			throw new Error("<Picker>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get cancel() {
			return this.$$.ctx[7];
		}

		set cancel(value) {
			throw new Error("<Picker>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get click() {
			return this.$$.ctx[8];
		}

		set click(value) {
			throw new Error("<Picker>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* src\_client\weave\MainScreen.svelte generated by Svelte v3.16.7 */
	const file$f = "src\\_client\\weave\\MainScreen.svelte";

	function create_fragment$f(ctx) {
		let div;
		let insert_action;
		let sizer_action;
		let dispose;

		const block = {
			c: function create() {
				div = element("div");
				attr_dev(div, "class", "main svelte-jdwyal");
				toggle_class(div, "full", /*full*/ ctx[0]);
				toggle_class(div, "hidden", !/*hidden*/ ctx[1]);
				add_location(div, file$f, 37, 0, 564);

				dispose = [
					action_destroyer(insert_action = /*insert*/ ctx[3].call(null, div)),
					action_destroyer(sizer_action = /*sizer*/ ctx[4].call(null, div)),
					listen_dev(div, "click", /*toggle*/ ctx[2], false, false, false)
				];
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				insert_dev(target, div, anchor);
			},
			p: function update(ctx, [dirty]) {
				if (dirty & /*full*/ 1) {
					toggle_class(div, "full", /*full*/ ctx[0]);
				}

				if (dirty & /*hidden*/ 2) {
					toggle_class(div, "hidden", !/*hidden*/ ctx[1]);
				}
			},
			i: noop$1,
			o: noop$1,
			d: function destroy(detaching) {
				if (detaching) detach_dev(div);
				run_all(dispose);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$f.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function instance$e($$self, $$props, $$invalidate) {
		let { full = false } = $$props;
		let { hidden } = $$props;

		const toggle = () => {
			$$invalidate(0, full = !full);
		};

		let c;

		const insert = node => ({
			destroy: main.subscribe(canvas => {
				if (!canvas || !canvas.style) return;
				c = canvas;

				while (node.firstChild) {
					node.removeChild(node.firstChild);
				}

				node.appendChild(canvas);
			})
		});

		const sizer = node => ({
			destroy: size.listen(([w, h]) => {

				if (c) {
					c.width = w;
					c.height = h;
				}
			})
		});

		const writable_props = ["full", "hidden"];

		Object.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<MainScreen> was created with unknown prop '${key}'`);
		});

		$$self.$set = $$props => {
			if ("full" in $$props) $$invalidate(0, full = $$props.full);
			if ("hidden" in $$props) $$invalidate(1, hidden = $$props.hidden);
		};

		$$self.$capture_state = () => {
			return { full, hidden, c };
		};

		$$self.$inject_state = $$props => {
			if ("full" in $$props) $$invalidate(0, full = $$props.full);
			if ("hidden" in $$props) $$invalidate(1, hidden = $$props.hidden);
			if ("c" in $$props) c = $$props.c;
		};

		return [full, hidden, toggle, insert, sizer];
	}

	class MainScreen extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$e, create_fragment$f, safe_not_equal, { full: 0, hidden: 1 });

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "MainScreen",
				options,
				id: create_fragment$f.name
			});

			const { ctx } = this.$$;
			const props = options.props || ({});

			if (/*hidden*/ ctx[1] === undefined && !("hidden" in props)) {
				console.warn("<MainScreen> was created without expected prop 'hidden'");
			}
		}

		get full() {
			throw new Error("<MainScreen>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set full(value) {
			throw new Error("<MainScreen>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get hidden() {
			throw new Error("<MainScreen>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set hidden(value) {
			throw new Error("<MainScreen>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* src\_client\weave\Explore.svelte generated by Svelte v3.16.7 */

	const { Object: Object_1$3 } = globals;
	const file$g = "src\\_client\\weave\\Explore.svelte";

	function get_each_context$3(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[12] = list[i];
		child_ctx[14] = i;
		return child_ctx;
	}

	// (82:0) {#if !hidden}
	function create_if_block$8(ctx) {
		let div0;
		let a0;
		let t0;
		let div4;
		let div3;
		let a1;
		let t1;
		let nav_action;
		let t2;
		let div1;
		let t3;
		let div2;
		let each_blocks = [];
		let each_1_lookup = new Map();
		let current;
		let dispose;
		const github_1 = new Github({ $$inline: true });

		const omni = new Omni({
				props: { command: /*command*/ ctx[7] },
				$$inline: true
			});

		let each_value = /*ws*/ ctx[4];
		const get_key = ctx => /*weave*/ ctx[12].id.get();

		for (let i = 0; i < each_value.length; i += 1) {
			let child_ctx = get_each_context$3(ctx, each_value, i);
			let key = get_key(child_ctx);
			each_1_lookup.set(key, each_blocks[i] = create_each_block$3(key, child_ctx));
		}

		const block = {
			c: function create() {
				div0 = element("div");
				a0 = element("a");
				create_component(github_1.$$.fragment);
				t0 = space$1();
				div4 = element("div");
				div3 = element("div");
				a1 = element("a");
				t1 = text("[ I S E K A I ]");
				t2 = space$1();
				div1 = element("div");
				create_component(omni.$$.fragment);
				t3 = space$1();
				div2 = element("div");

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				attr_dev(a0, "href", "https://github.com/agoblinking/earthrock");
				attr_dev(a0, "target", "_new");
				add_location(a0, file$g, 82, 22, 1966);
				attr_dev(div0, "class", "github svelte-14p6qu8");
				add_location(div0, file$g, 82, 1, 1945);
				attr_dev(a1, "class", "logo svelte-14p6qu8");
				attr_dev(a1, "style", /*$THEME_STYLE*/ ctx[6]);
				attr_dev(a1, "href", "https://www.patreon.com/earthrock");
				attr_dev(a1, "target", "_new");
				add_location(a1, file$g, 86, 2, 2141);
				attr_dev(div1, "class", "events svelte-14p6qu8");
				add_location(div1, file$g, 106, 2, 2528);
				attr_dev(div2, "class", "weaves svelte-14p6qu8");
				add_location(div2, file$g, 110, 2, 2587);
				attr_dev(div3, "class", "partial svelte-14p6qu8");
				add_location(div3, file$g, 84, 2, 2114);
				attr_dev(div4, "class", "explore svelte-14p6qu8");
				set_style(div4, "color", /*$THEME_COLOR*/ ctx[5]);
				add_location(div4, file$g, 83, 1, 2057);

				dispose = action_destroyer(nav_action = nav.call(null, a1, {
					id: `/`,
					up: /*top_space*/ ctx[8],
					down: `sys`,
					page_up: /*ws*/ ctx[4][/*ws*/ ctx[4].length - 1].name.get(),
					page_down: `sys`,
					insert: /*nav_function*/ ctx[10]
				}));
			},
			m: function mount(target, anchor) {
				insert_dev(target, div0, anchor);
				append_dev(div0, a0);
				mount_component(github_1, a0, null);
				insert_dev(target, t0, anchor);
				insert_dev(target, div4, anchor);
				append_dev(div4, div3);
				append_dev(div3, a1);
				append_dev(a1, t1);
				append_dev(div3, t2);
				append_dev(div3, div1);
				mount_component(omni, div1, null);
				append_dev(div3, t3);
				append_dev(div3, div2);

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].m(div2, null);
				}

				current = true;
			},
			p: function update(ctx, dirty) {
				if (!current || dirty & /*$THEME_STYLE*/ 64) {
					attr_dev(a1, "style", /*$THEME_STYLE*/ ctx[6]);
				}

				if (nav_action && is_function(nav_action.update) && dirty & /*ws, nameit, picker*/ 22) nav_action.update.call(null, {
					id: `/`,
					up: /*top_space*/ ctx[8],
					down: `sys`,
					page_up: /*ws*/ ctx[4][/*ws*/ ctx[4].length - 1].name.get(),
					page_down: `sys`,
					insert: /*nav_function*/ ctx[10]
				});

				const each_value = /*ws*/ ctx[4];
				group_outros();
				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, div2, outro_and_destroy_block, create_each_block$3, null, get_each_context$3);
				check_outros();

				if (!current || dirty & /*$THEME_COLOR*/ 32) {
					set_style(div4, "color", /*$THEME_COLOR*/ ctx[5]);
				}
			},
			i: function intro(local) {
				if (current) return;
				transition_in(github_1.$$.fragment, local);
				transition_in(omni.$$.fragment, local);

				for (let i = 0; i < each_value.length; i += 1) {
					transition_in(each_blocks[i]);
				}

				current = true;
			},
			o: function outro(local) {
				transition_out(github_1.$$.fragment, local);
				transition_out(omni.$$.fragment, local);

				for (let i = 0; i < each_blocks.length; i += 1) {
					transition_out(each_blocks[i]);
				}

				current = false;
			},
			d: function destroy(detaching) {
				if (detaching) detach_dev(div0);
				destroy_component(github_1);
				if (detaching) detach_dev(t0);
				if (detaching) detach_dev(div4);
				destroy_component(omni);

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].d();
				}

				dispose();
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_if_block$8.name,
			type: "if",
			source: "(82:0) {#if !hidden}",
			ctx
		});

		return block;
	}

	// (112:3) {#each ws as weave, i (weave.id.get())}
	function create_each_block$3(key_2, ctx) {
		let first;
		let current;

		const weave = new Weave$1({
				props: {
					weave: /*weave*/ ctx[12],
					navi: {
						up: /*ws*/ ctx[4][/*i*/ ctx[14] - 1]
						? /*ws*/ ctx[4][/*i*/ ctx[14] - 1].name.get()
						: `/`,
						down: /*ws*/ ctx[4][/*i*/ ctx[14] + 1]
						? /*ws*/ ctx[4][/*i*/ ctx[14] + 1].name.get()
						: `/`
					}
				},
				$$inline: true
			});

		const block = {
			key: key_2,
			first: null,
			c: function create() {
				first = empty();
				create_component(weave.$$.fragment);
				this.first = first;
			},
			m: function mount(target, anchor) {
				insert_dev(target, first, anchor);
				mount_component(weave, target, anchor);
				current = true;
			},
			p: function update(ctx, dirty) {
				const weave_changes = {};
				if (dirty & /*ws*/ 16) weave_changes.weave = /*weave*/ ctx[12];

				if (dirty & /*ws*/ 16) weave_changes.navi = {
					up: /*ws*/ ctx[4][/*i*/ ctx[14] - 1]
					? /*ws*/ ctx[4][/*i*/ ctx[14] - 1].name.get()
					: `/`,
					down: /*ws*/ ctx[4][/*i*/ ctx[14] + 1]
					? /*ws*/ ctx[4][/*i*/ ctx[14] + 1].name.get()
					: `/`
				};

				weave.$set(weave_changes);
			},
			i: function intro(local) {
				if (current) return;
				transition_in(weave.$$.fragment, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(weave.$$.fragment, local);
				current = false;
			},
			d: function destroy(detaching) {
				if (detaching) detach_dev(first);
				destroy_component(weave, detaching);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_each_block$3.name,
			type: "each",
			source: "(112:3) {#each ws as weave, i (weave.id.get())}",
			ctx
		});

		return block;
	}

	// (81:0) <Picker {nameit} bind:this={picker}>
	function create_default_slot$2(ctx) {
		let if_block_anchor;
		let current;
		let if_block = !/*hidden*/ ctx[0] && create_if_block$8(ctx);

		const block = {
			c: function create() {
				if (if_block) if_block.c();
				if_block_anchor = empty();
			},
			m: function mount(target, anchor) {
				if (if_block) if_block.m(target, anchor);
				insert_dev(target, if_block_anchor, anchor);
				current = true;
			},
			p: function update(ctx, dirty) {
				if (!/*hidden*/ ctx[0]) {
					if (if_block) {
						if_block.p(ctx, dirty);
						transition_in(if_block, 1);
					} else {
						if_block = create_if_block$8(ctx);
						if_block.c();
						transition_in(if_block, 1);
						if_block.m(if_block_anchor.parentNode, if_block_anchor);
					}
				} else if (if_block) {
					group_outros();

					transition_out(if_block, 1, 1, () => {
						if_block = null;
					});

					check_outros();
				}
			},
			i: function intro(local) {
				if (current) return;
				transition_in(if_block);
				current = true;
			},
			o: function outro(local) {
				transition_out(if_block);
				current = false;
			},
			d: function destroy(detaching) {
				if (if_block) if_block.d(detaching);
				if (detaching) detach_dev(if_block_anchor);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_default_slot$2.name,
			type: "slot",
			source: "(81:0) <Picker {nameit} bind:this={picker}>",
			ctx
		});

		return block;
	}

	function create_fragment$g(ctx) {
		let t;
		let current;

		const mainscreen = new MainScreen({
				props: { hidden: /*hidden*/ ctx[0] },
				$$inline: true
			});

		let picker_1_props = {
			nameit: /*nameit*/ ctx[1],
			$$slots: { default: [create_default_slot$2] },
			$$scope: { ctx }
		};

		const picker_1 = new Picker({ props: picker_1_props, $$inline: true });
		/*picker_1_binding*/ ctx[11](picker_1);

		const block = {
			c: function create() {
				create_component(mainscreen.$$.fragment);
				t = space$1();
				create_component(picker_1.$$.fragment);
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				mount_component(mainscreen, target, anchor);
				insert_dev(target, t, anchor);
				mount_component(picker_1, target, anchor);
				current = true;
			},
			p: function update(ctx, [dirty]) {
				const mainscreen_changes = {};
				if (dirty & /*hidden*/ 1) mainscreen_changes.hidden = /*hidden*/ ctx[0];
				mainscreen.$set(mainscreen_changes);
				const picker_1_changes = {};
				if (dirty & /*nameit*/ 2) picker_1_changes.nameit = /*nameit*/ ctx[1];

				if (dirty & /*$$scope, hidden, $THEME_COLOR, ws, $THEME_STYLE, nameit, picker*/ 32887) {
					picker_1_changes.$$scope = { dirty, ctx };
				}

				picker_1.$set(picker_1_changes);
			},
			i: function intro(local) {
				if (current) return;
				transition_in(mainscreen.$$.fragment, local);
				transition_in(picker_1.$$.fragment, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(mainscreen.$$.fragment, local);
				transition_out(picker_1.$$.fragment, local);
				current = false;
			},
			d: function destroy(detaching) {
				destroy_component(mainscreen, detaching);
				if (detaching) detach_dev(t);
				/*picker_1_binding*/ ctx[11](null);
				destroy_component(picker_1, detaching);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$g.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	function instance$f($$self, $$props, $$invalidate) {
		let $weaves,
			$$unsubscribe_weaves = noop$1,
			$$subscribe_weaves = () => ($$unsubscribe_weaves(), $$unsubscribe_weaves = subscribe(weaves, $$value => $$invalidate(9, $weaves = $$value)), weaves);

		let $THEME_COLOR;
		let $THEME_STYLE;
		validate_store(THEME_COLOR, "THEME_COLOR");
		component_subscribe($$self, THEME_COLOR, $$value => $$invalidate(5, $THEME_COLOR = $$value));
		validate_store(THEME_STYLE, "THEME_STYLE");
		component_subscribe($$self, THEME_STYLE, $$value => $$invalidate(6, $THEME_STYLE = $$value));
		$$self.$$.on_destroy.push(() => $$unsubscribe_weaves());

		key.listen(char => {
			if (char !== `\``) return;
			$$invalidate(0, hidden = !hidden);
		});

		button.listen(button => {
			if (button !== `select`) return;
			$$invalidate(0, hidden = !hidden);
		});

		let { hidden = window.location.hash.indexOf(`dev`) === -1 } = $$props;
		let nameit = false;

		const command = ([action, ...details], msg) => {
			switch (action) {
				case `-`:
					Wheel.del({ [details[0]]: true });
					return;
				case `+`:
					if (details.length === 1) {
						Wheel.spawn({ [details[0]]: {} });
					}
					if (details.length === 3) {
						github(details).then(name => {
							msg(`Added ${name} from Github. `);
						}).catch(ex => {
							msg(`Couldn't add ${details.join(`/`)}. `);
						});
					}
			}
		};

		let picker;

		const top_space = () => {
			const weave = ws[ws.length - 1];
			if (!weave) return;
			const spaces = weave.names.get();
			const space_keys = Object.keys(spaces);
			if (space_keys.length < 1) return weave.name.get();
			const space_key = space_keys[space_keys.length - 1];
			const twists = Object.keys(spaces[space_key].value.get()).sort();
			if (twists.length < 1) return `${weave.name.get()}/${space_key}`;
			return `${weave.name.get()}/${space_key}/${twists[twists.length - 1]}`;
		};

		const writable_props = ["hidden"];

		Object_1$3.keys($$props).forEach(key => {
			if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Explore> was created with unknown prop '${key}'`);
		});

		const nav_function = () => {
			$$invalidate(1, nameit = {});
			cursor.set(picker);
		};

		function picker_1_binding($$value) {
			binding_callbacks[$$value ? "unshift" : "push"](() => {
				$$invalidate(2, picker = $$value);
			});
		}

		$$self.$set = $$props => {
			if ("hidden" in $$props) $$invalidate(0, hidden = $$props.hidden);
		};

		$$self.$capture_state = () => {
			return {
				hidden,
				nameit,
				picker,
				weaves,
				ws,
				$weaves,
				$THEME_COLOR,
				$THEME_STYLE
			};
		};

		$$self.$inject_state = $$props => {
			if ("hidden" in $$props) $$invalidate(0, hidden = $$props.hidden);
			if ("nameit" in $$props) $$invalidate(1, nameit = $$props.nameit);
			if ("picker" in $$props) $$invalidate(2, picker = $$props.picker);
			if ("weaves" in $$props) $$subscribe_weaves($$invalidate(3, weaves = $$props.weaves));
			if ("ws" in $$props) $$invalidate(4, ws = $$props.ws);
			if ("$weaves" in $$props) weaves.set($weaves = $$props.$weaves);
			if ("$THEME_COLOR" in $$props) THEME_COLOR.set($THEME_COLOR = $$props.$THEME_COLOR);
			if ("$THEME_STYLE" in $$props) THEME_STYLE.set($THEME_STYLE = $$props.$THEME_STYLE);
		};

		let weaves;
		let ws;

		$$self.$$.update = () => {
			if ($$self.$$.dirty & /*$weaves*/ 512) {
				 $$invalidate(4, ws = Object.values($weaves).sort(({ name: a }, { name: b }) => {
					const $a = a.get();
					const $b = b.get();
					if ($a > $b) return 1;
					if ($b > $a) return -1;
					return 0;
				}));
			}
		};

		 $$subscribe_weaves($$invalidate(3, weaves = Wheel.weaves));

		return [
			hidden,
			nameit,
			picker,
			weaves,
			ws,
			$THEME_COLOR,
			$THEME_STYLE,
			command,
			top_space,
			$weaves,
			nav_function,
			picker_1_binding
		];
	}

	class Explore extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$f, create_fragment$g, safe_not_equal, { hidden: 0 });

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "Explore",
				options,
				id: create_fragment$g.name
			});
		}

		get hidden() {
			throw new Error("<Explore>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set hidden(value) {
			throw new Error("<Explore>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* src\_client\app\app.svelte generated by Svelte v3.16.7 */

	function create_fragment$h(ctx) {
		let current;
		const explore = new Explore({ $$inline: true });

		const block = {
			c: function create() {
				create_component(explore.$$.fragment);
			},
			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},
			m: function mount(target, anchor) {
				mount_component(explore, target, anchor);
				current = true;
			},
			p: noop$1,
			i: function intro(local) {
				if (current) return;
				transition_in(explore.$$.fragment, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(explore.$$.fragment, local);
				current = false;
			},
			d: function destroy(detaching) {
				destroy_component(explore, detaching);
			}
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$h.name,
			type: "component",
			source: "",
			ctx
		});

		return block;
	}

	class App extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, null, create_fragment$h, safe_not_equal, {});

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "App",
				options,
				id: create_fragment$h.name
			});
		}
	}

	const ws = Wheel.weaves.get();
	ws[Wheel.SYSTEM] = system;

	const app = new App({
		target: document.body
	});

	return app;

}(Color, cuid, scribble, Tone, EXT.piexifjs, exprEval, twgl));
//# sourceMappingURL=client.bundle.js.map
