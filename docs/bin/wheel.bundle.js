var app = (function (exports, Color, uuid, expr, twgl) {
	'use strict';

	Color = Color && Color.hasOwnProperty('default') ? Color['default'] : Color;
	uuid = uuid && uuid.hasOwnProperty('default') ? uuid['default'] : uuid;
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

		add (data) {
			this.set(Object.assign(this.get(), data));

			return this
		},

		// no stores only values
		write (data) {
			const adds = {};

			each(data)(([key, value]) => {
				const values = this.get();

				const value_self = values[key];

				if (!value_self) {
					adds[key] = value;
					return
				}

				value_self.set(value);
			});

			if (Object.keys(adds).length > 0) {
				this.add(adds);
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

	const TIME_TICK_RATE = write(100);

	const SPRITES = read(`/sheets/default_2.png`);

	const IS_DEV = read(window.location.host === `localhost:5000`);
	const SOUND_ON = write(false);

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

			this.value_cancel = value.listen(($value) => {
				const split = $value.split(` `);
				let count = 1;
				if (split.length > 1) {
					count = parseInt(split[0]);
					$value = split.slice(1).join(` `);
				}

				this.cancel();
				const update = Object.fromEntries([...Array(count)].map(
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

	const decompile = (address, weave) =>
		weave.chain(address).slice(0, -1)
			.map((i) => translate(i, weave))
			.join(` => `);

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
		prefix = ``
	}) => {
		const parts = code
			.replace(/[\r\n]/g, ``)
			.split(`=>`)
			.reverse();

		const wefts_update = weave.wefts.get();

		weave.remove(...weave.chain(address).slice(0, -1));

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

			wefts_update[id] = connection;
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
		grab_script (other, key) {
			const weave_other = other.weave;
			const other_id = `${other.id.get()}/${key}`;
			const c_o = weave_other.chain(other_id).slice(0, -1);
			if (c_o.length === 0) return

			const { weave, id, space } = this;

			//  we got a chain to clone!
			const code = decompile(other_id, weave_other);
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
					console.warn(`Invid other for clone`);
				}

				const proto = other
					? other.value.get()
					: {};

				keys(proto).forEach((key) => {
					this.grab_script(other, key);
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

	const tick = read(0, (set) => {
		let intv = false;

		TIME_TICK_RATE.listen(($rate) => {
			if (intv) clearInterval(intv);
			intv = setInterval(() => {
				set(tick.get() + 1);
			}, $rate);
		});
	});

	const frame = read([0, 0], (set) => {
		let old;
		const data = [0, 0];
		const frame_t = (ts) => {
			requestAnimationFrame(frame_t);

			if (old === undefined) old = ts;

			data[0] = ts;
			data[1] = Math.round(ts - old);

			old = ts;
			set(data);
		};

		requestAnimationFrame(frame_t);
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
	function add(a, b, dst) {
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
	  add: add,
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

	// rate of decay
	const DECAY = 0.9;
	const MIN = 0.01;

	var velocity = extend({
		rez () {
			let first = true;
			// delay this shit
			this.cancel = tick.listen(() => requestAnimationFrame(() => {
				if (first) {
					first = false;
					return
				}

				const $velocity = this.value.get();

				if (Array.isArray($velocity) === false) return

				const body = this.space.get_value(`body`) || 1;

				// impossible to move 0 body items
				if (
					body === 0 ||
					v3.length($velocity) < MIN
				) return

				let position = this.space.get(`position`);
				if (!position || position.get().some((i) => i === null)) {
					this.space.write({
						position: [0, 0, 0]
					}, true);
					position = this.space.get(`position`);
				}

				const $position = position.get();
				let decay = this.space.get_value(`!decay`) || DECAY;

				decay = body > 0 ? decay * body : decay / Math.abs(body);

				v3.add($position, $velocity, $position);
				v3.mulScalar($velocity, decay, $velocity);

				position.set($position);
				this.value.set($velocity);
			}));
		},

		derez () {
			this.cancel();
		}
	});



	var twists = /*#__PURE__*/Object.freeze({
		__proto__: null,
		flock: flock,
		clone: clone,
		leader: leader,
		name: name,
		birds: birds,
		velocity: velocity
	});

	const string_nothing = read(``);

	const type = read(`space`);

	const proto_space = extend(proto_warp, {
		address () {
			return `/${this.weave.name.get()}/${this.name().get() || this.id.get()}`
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
					if (!twist) return

					if (this.rezed && twist.derez) twist.derez();
					twist.destroy && twist.destroy();

					delete this.twists[key];
				});
			});
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
			this.weave.spaces.update(($spaces) => {
				$spaces.set(this.id.get(), this);

				return $spaces
			});

			each(this.twists)(([_, twist]) => {
				twist.rez && twist.rez();
			});
		},

		derez () {
			this.rezed = false;
			this.weave.spaces.update(($spaces) => {
				$spaces.delete(this.id.get());

				return $spaces
			});

			each(this.twists)(([_, twist]) => {
				twist.derez && twist.derez();
			});
		},

		chain () {
			const values = this.value.get();
			const id = this.id.get();

			return keys(values).reduce((result, key) => {
				result.push(...this.weave.chain(`${id}/${key}`).slice(0, -1));
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

		write (update) {
			return this.value.write(update)
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
		if (v.indexOf(`.`) === -1) {
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

	parser.functions.stop = function () {
		throw new Error(`stop`)
	};

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

		return (variables) => p.evaluate(variables)
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
			const s = this.weave.to_address(leaf);

			new Set(matches).forEach((item) => {
				const shh = item[0] === `$`;
				const gette = item
					.replace(path_space, `${s}/`)
					.replace(path_weave, `/${this.weave.name.get()}/`)
					.replace(path_ssh, ``)
					.trim();

				const warp = Wheel.get(gette);

				// not an id or invalid
				if (!warp) return

				const name = gette.replace(bad_variable_characters, `z`);

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
			});
		},

		derez () {
			this.cancel_vs();
			this.cancels.forEach((cancel) => cancel());
		},

		toJSON () {
			return {
				type: this.type.get(),
				value: this.value.get(),
				math: this.math.get()
			}
		}
	});

	const proto_math_value = extend(proto_write, {
		set (expression) {
			this.warp.run(expression);
			return expression
		}
	});

	const proto_value = extend(proto_write, {
		set (value) {
			this.last = value;

			const vs = this.warp.values.get();
			value = value === undefined
				? null
				: value;

			const params = {
				...Object.fromEntries(Object.entries(vs).map(
					([key, { warp }]) => [key, warp.toJSON() === undefined
						? null
						: warp.toJSON()
					]
				)),
				value
			};

			try {
				const result = this.warp.fn(params);
				proto_write.set.call(this, result);
			} catch (ex) {
				if (ex.message !== `stop`) console.warn(`math error`, ex);
			}

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

		// do latter once setup
		requestAnimationFrame(() => {
			m.math.set(math);
		});

		return m
	};

	const type$5 = read(`mail`);

	const proto_mail = extend(proto_warp, {
		fix (address) {
			return address
				.replace(`$`, ``)
				.replace(`~`, `/${this.weave.name.get()}`)
				.replace(`.`, this.weave.to_address(this.weave.chain(this.id.get(), true).shift()))
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

				$whom = this.weave.resolve($whom, this.id.get());

				if ($whom[0] === `$`) {
					$whom = $whom.replace(`$`, ``);
					const thing = Wheel.get($whom);
					if (!thing) return this.set(null)

					this.set(thing.get());
					return
				}

				let thing = Wheel.get($whom);
				if (!thing) return

				thing = thing.type
					? thing.value
					: thing;

				this.cancels.add(thing.listen(($thing) => {
					this.set($thing);
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
		set (value) {
			const $whom = this.mail.fix(this.mail.whom.get());

			const v = Wheel.get($whom);

			if (!v || !v.set) {
				return
			}

			v.set(value);
			proto_write.set.call(this, value);
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
					data.value[`!name`] = key;

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
			spaces: write(new Map()),
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

		Object.keys(keys).forEach((key) => {
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

				weft_cancels[reader] = r.value.subscribe(($val) => {
					if (!r.rezed) return
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

				warp.rez && warp.rez();
				warp.rezed = true;

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

				warp.derez && warp.derez();
				delete warp.rezed;
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

		const weft_cancel = start_wefts(weave);
		const rez_cancel = start_rez(weave);

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

}({}, Color, cuid, exprEval, twgl));
//# sourceMappingURL=wheel.bundle.js.map
