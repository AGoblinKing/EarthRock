var app = (function (exports, Color, uuid, scribble, Tone, exif, expr, twgl) {
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

	// whiskers on kittens
	const words = [
		`groovy`, `cat`, `bird`, `dog`, `poop`, `cool`, `not`, `okay`, `great`, `terrible`, `wat`,
		`goblin`, `life`, `ferret`, `gregert`, `robert`, `zilla`, `red`, `shirt`, `pants`, `blue`,
		`luna`, `ember`, `embear`, `lunatic`, `boring`, `killa`, `notice`, `thank`, `tank`,
		`under`, `near`, `near`, `quaint`, `potato`, `egg`, `bacon`, `narwhal`, `lamp`, `stairs`, `king`,
		`tyrant`, `grave`, `dire`, `happy`, `amazing`, `terrific`, `terrible`, `good`, `boring`,
		`rip`, `hello`, `world`, `global`, `universal`, `television`, `computer`
	];

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

	var color = ({
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
		color: color,
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

	exports.REG_ID = REG_ID;
	exports.SYSTEM = SYSTEM;
	exports.chain = chain;
	exports.clear = clear$1;
	exports.compile = compile;
	exports.condense = condense;
	exports.decompile = decompile;
	exports.del = del;
	exports.exists = exists;
	exports.format = format;
	exports.get = get;
	exports.name = name$1;
	exports.restart = restart;
	exports.running = running;
	exports.shared = shared;
	exports.spawn = spawn;
	exports.start = start;
	exports.stop = stop;
	exports.stop_all = stop_all;
	exports.toJSON = toJSON;
	exports.translate = translate;
	exports.trash = trash;
	exports.weaves = weaves;

	return exports;

}({}, Color, cuid, scribble, Tone, EXT.piexifjs, exprEval, twgl));
//# sourceMappingURL=wheel.bundle.js.map
