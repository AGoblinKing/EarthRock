(function (os, crypto$1, fs) {
	'use strict';

	os = os && os.hasOwnProperty('default') ? os['default'] : os;
	crypto$1 = crypto$1 && crypto$1.hasOwnProperty('default') ? crypto$1['default'] : crypto$1;
	fs = fs && fs.hasOwnProperty('default') ? fs['default'] : fs;

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

	var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

	function unwrapExports (x) {
		return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
	}

	function createCommonjsModule(fn, module) {
		return module = { exports: {} }, fn(module, module.exports), module.exports;
	}

	var color = createCommonjsModule(function (module) {
	// Copyright (c) 2008-2013, Andrew Brehaut, Tim Baumann, Matt Wilson, 
	//                          Simon Heimler, Michel Vielmetter 
	//
	// All rights reserved.
	//
	// Redistribution and use in source and binary forms, with or without
	// modification, are permitted provided that the following conditions are met:
	//
	// * Redistributions of source code must retain the above copyright notice,
	//   this list of conditions and the following disclaimer.
	// * Redistributions in binary form must reproduce the above copyright notice,
	//   this list of conditions and the following disclaimer in the documentation
	//   and/or other materials provided with the distribution.
	//
	// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
	// AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
	// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
	// ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
	// LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
	// CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
	// SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
	// INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
	// CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
	// ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
	// POSSIBILITY OF SUCH DAMAGE.

	// color.js - version 1.0.1
	//
	// HSV <-> RGB code based on code from http://www.cs.rit.edu/~ncs/color/t_convert.html
	// object function created by Douglas Crockford.
	// Color scheme degrees taken from the colorjack.com colorpicker
	//
	// HSL support kindly provided by Tim Baumann - http://github.com/timjb

	// create namespaces
	/*global net */
	if ("undefined" == typeof net) {
	    var net = {};
	}
	if (!net.brehaut) {
	    net.brehaut = {};
	}

	// this module function is called with net.brehaut as 'this'
	(function() {
	    // Constants

	    // css_colors maps color names onto their hex values
	    // these names are defined by W3C
	    
	    var css_colors = {aliceblue:'#F0F8FF',antiquewhite:'#FAEBD7',aqua:'#00FFFF',aquamarine:'#7FFFD4',azure:'#F0FFFF',beige:'#F5F5DC',bisque:'#FFE4C4',black:'#000000',blanchedalmond:'#FFEBCD',blue:'#0000FF',blueviolet:'#8A2BE2',brown:'#A52A2A',burlywood:'#DEB887',cadetblue:'#5F9EA0',chartreuse:'#7FFF00',chocolate:'#D2691E',coral:'#FF7F50',cornflowerblue:'#6495ED',cornsilk:'#FFF8DC',crimson:'#DC143C',cyan:'#00FFFF',darkblue:'#00008B',darkcyan:'#008B8B',darkgoldenrod:'#B8860B',darkgray:'#A9A9A9',darkgrey:'#A9A9A9',darkgreen:'#006400',darkkhaki:'#BDB76B',darkmagenta:'#8B008B',darkolivegreen:'#556B2F',darkorange:'#FF8C00',darkorchid:'#9932CC',darkred:'#8B0000',darksalmon:'#E9967A',darkseagreen:'#8FBC8F',darkslateblue:'#483D8B',darkslategray:'#2F4F4F',darkslategrey:'#2F4F4F',darkturquoise:'#00CED1',darkviolet:'#9400D3',deeppink:'#FF1493',deepskyblue:'#00BFFF',dimgray:'#696969',dimgrey:'#696969',dodgerblue:'#1E90FF',firebrick:'#B22222',floralwhite:'#FFFAF0',forestgreen:'#228B22',fuchsia:'#FF00FF',gainsboro:'#DCDCDC',ghostwhite:'#F8F8FF',gold:'#FFD700',goldenrod:'#DAA520',gray:'#808080',grey:'#808080',green:'#008000',greenyellow:'#ADFF2F',honeydew:'#F0FFF0',hotpink:'#FF69B4',indianred:'#CD5C5C',indigo:'#4B0082',ivory:'#FFFFF0',khaki:'#F0E68C',lavender:'#E6E6FA',lavenderblush:'#FFF0F5',lawngreen:'#7CFC00',lemonchiffon:'#FFFACD',lightblue:'#ADD8E6',lightcoral:'#F08080',lightcyan:'#E0FFFF',lightgoldenrodyellow:'#FAFAD2',lightgray:'#D3D3D3',lightgrey:'#D3D3D3',lightgreen:'#90EE90',lightpink:'#FFB6C1',lightsalmon:'#FFA07A',lightseagreen:'#20B2AA',lightskyblue:'#87CEFA',lightslategray:'#778899',lightslategrey:'#778899',lightsteelblue:'#B0C4DE',lightyellow:'#FFFFE0',lime:'#00FF00',limegreen:'#32CD32',linen:'#FAF0E6',magenta:'#FF00FF',maroon:'#800000',mediumaquamarine:'#66CDAA',mediumblue:'#0000CD',mediumorchid:'#BA55D3',mediumpurple:'#9370D8',mediumseagreen:'#3CB371',mediumslateblue:'#7B68EE',mediumspringgreen:'#00FA9A',mediumturquoise:'#48D1CC',mediumvioletred:'#C71585',midnightblue:'#191970',mintcream:'#F5FFFA',mistyrose:'#FFE4E1',moccasin:'#FFE4B5',navajowhite:'#FFDEAD',navy:'#000080',oldlace:'#FDF5E6',olive:'#808000',olivedrab:'#6B8E23',orange:'#FFA500',orangered:'#FF4500',orchid:'#DA70D6',palegoldenrod:'#EEE8AA',palegreen:'#98FB98',paleturquoise:'#AFEEEE',palevioletred:'#D87093',papayawhip:'#FFEFD5',peachpuff:'#FFDAB9',peru:'#CD853F',pink:'#FFC0CB',plum:'#DDA0DD',powderblue:'#B0E0E6',purple:'#800080',rebeccapurple:'#663399',red:'#FF0000',rosybrown:'#BC8F8F',royalblue:'#4169E1',saddlebrown:'#8B4513',salmon:'#FA8072',sandybrown:'#F4A460',seagreen:'#2E8B57',seashell:'#FFF5EE',sienna:'#A0522D',silver:'#C0C0C0',skyblue:'#87CEEB',slateblue:'#6A5ACD',slategray:'#708090',slategrey:'#708090',snow:'#FFFAFA',springgreen:'#00FF7F',steelblue:'#4682B4',tan:'#D2B48C',teal:'#008080',thistle:'#D8BFD8',tomato:'#FF6347',turquoise:'#40E0D0',violet:'#EE82EE',wheat:'#F5DEB3',white:'#FFFFFF',whitesmoke:'#F5F5F5',yellow:'#FFFF00',yellowgreen:'#9ACD32'};


	    // CSS value regexes, according to http://www.w3.org/TR/css3-values/
	    var css_integer = '(?:\\+|-)?\\d+';
	    var css_float = '(?:\\+|-)?\\d*\\.\\d+';
	    var css_number = '(?:' + css_integer + ')|(?:' + css_float + ')';
	    css_integer = '(' + css_integer + ')';
	    css_float = '(' + css_float + ')';
	    css_number = '(' + css_number + ')';
	    var css_percentage = css_number + '%';
	    var css_whitespace = '\\s*?';

	    // http://www.w3.org/TR/2003/CR-css3-color-20030514/
	    var hsl_hsla_regex = new RegExp([
	        '^hsl(a?)\\(', css_number, ',', css_percentage, ',', css_percentage, '(,(', css_number, '))?\\)$'
	    ].join(css_whitespace));
	    var rgb_rgba_integer_regex = new RegExp([
	        '^rgb(a?)\\(', css_integer, ',', css_integer, ',', css_integer, '(,(', css_number, '))?\\)$'
	    ].join(css_whitespace));
	    var rgb_rgba_percentage_regex = new RegExp([
	        '^rgb(a?)\\(', css_percentage, ',', css_percentage, ',', css_percentage, '(,(', css_number, '))?\\)$'
	    ].join(css_whitespace));

	    // Package wide variables

	    // becomes the top level prototype object
	    var color;

	    /* registered_models contains the template objects for all the
	     * models that have been registered for the color class.
	     */
	    var registered_models = [];


	    /* factories contains methods to create new instance of
	     * different color models that have been registered.
	     */
	    var factories = {};

	    // Utility functions

	    /* object is Douglas Crockfords object function for prototypal
	     * inheritance.
	     */
	    if (!this.object) {
	        this.object = function(o) {
	            function F() {}
	            F.prototype = o;
	            return new F();
	        };
	    }
	    var object = this.object;

	    /* takes a value, converts to string if need be, then pads it
	     * to a minimum length.
	     */
	    function pad(val, len) {
	        val = val.toString();
	        var padded = [];

	        for (var i = 0, j = Math.max(len - val.length, 0); i < j; i++) {
	            padded.push('0');
	        }

	        padded.push(val);
	        return padded.join('');
	    }


	    /* takes a string and returns a new string with the first letter
	     * capitalised
	     */
	    function capitalise(s) {
	        return s.slice(0, 1).toUpperCase() + s.slice(1);
	    }

	    /* removes leading and trailing whitespace
	     */
	    function trim(str) {
	        return str.replace(/^\s+|\s+$/g, '');
	    }

	    /* used to apply a method to object non-destructively by
	     * cloning the object and then apply the method to that
	     * new object
	     */
	    function cloneOnApply(meth) {
	        return function() {
	            var cloned = this.clone();
	            meth.apply(cloned, arguments);
	            return cloned;
	        };
	    }


	    /* registerModel is used to add additional representations
	     * to the color code, and extend the color API with the new
	     * operation that model provides. see before for examples
	     */
	    function registerModel(name, model) {
	        var proto = object(color);
	        var fields = []; // used for cloning and generating accessors

	        var to_meth = 'to' + capitalise(name);

	        function convertAndApply(meth) {
	            return function() {
	                return meth.apply(this[to_meth](), arguments);
	            };
	        }

	        for (var key in model)
	            if (model.hasOwnProperty(key)) {
	                proto[key] = model[key];
	                var prop = proto[key];

	                if (key.slice(0, 1) == '_') {
	                    continue;
	                }
	                if (!(key in color) && "function" == typeof prop) {
	                    // the method found on this object is a) public and b) not
	                    // currently supported by the color object. Create an impl that
	                    // calls the toModel function and passes that new object
	                    // onto the correct method with the args.
	                    color[key] = convertAndApply(prop);
	                } else if ("function" != typeof prop) {
	                    // we have found a public property. create accessor methods
	                    // and bind them up correctly
	                    fields.push(key);
	                    var getter = 'get' + capitalise(key);
	                    var setter = 'set' + capitalise(key);

	                    color[getter] = convertAndApply(
	                        proto[getter] = (function(key) {
	                            return function() {
	                                return this[key];
	                            };
	                        })(key)
	                    );

	                    color[setter] = convertAndApply(
	                        proto[setter] = (function(key) {
	                            return function(val) {
	                                var cloned = this.clone();
	                                cloned[key] = val;
	                                return cloned;
	                            };
	                        })(key)
	                    );
	                }
	            } // end of for over model

	            // a method to create a new object - largely so prototype chains dont
	            // get insane. This uses an unrolled 'object' so that F is cached
	            // for later use. this is approx a 25% speed improvement

	        function F() {}
	        F.prototype = proto;

	        function factory() {
	            return new F();
	        }
	        factories[name] = factory;

	        proto.clone = function() {
	            var cloned = factory();
	            for (var i = 0, j = fields.length; i < j; i++) {
	                var key = fields[i];
	                cloned[key] = this[key];
	            }
	            return cloned;
	        };

	        color[to_meth] = function() {
	            return factory();
	        };

	        registered_models.push(proto);

	        return proto;
	    } // end of registerModel

	    // Template Objects

	    /* color is the root object in the color hierarchy. It starts
	     * life as a very simple object, but as color models are
	     * registered it has methods programmatically added to manage
	     * conversions as needed.
	     */
	    color = {
	        /* fromObject takes an argument and delegates to the internal
	         * color models to try to create a new instance.
	         */
	        fromObject: function(o) {
	            if (!o) {
	                return object(color);
	            }

	            for (var i = 0, j = registered_models.length; i < j; i++) {
	                var nu = registered_models[i].fromObject(o);
	                if (nu) {
	                    return nu;
	                }
	            }

	            return object(color);
	        },

	        toString: function() {
	            return this.toCSS();
	        }
	    };

	    var transparent = null; // defined with an RGB later.

	    /* RGB is the red green blue model. This definition is converted
	     * to a template object by registerModel.
	     */
	    registerModel('RGB', {
	        red: 0,
	        green: 0,
	        blue: 0,
	        alpha: 0,

	        /* getLuminance returns a value between 0 and 1, this is the
	         * luminance calcuated according to
	         * http://www.poynton.com/notes/colour_and_gamma/ColorFAQ.html#RTFToC9
	         */
	        getLuminance: function() {
	            return (this.red * 0.2126) + (this.green * 0.7152) + (this.blue * 0.0722);
	        },

	        /* does an alpha based blend of color onto this. alpha is the
	         * amount of 'color' to use. (0 to 1)
	         */
	        blend: function(color, alpha) {
	            color = color.toRGB();
	            alpha = Math.min(Math.max(alpha, 0), 1);
	            var rgb = this.clone();

	            rgb.red = (rgb.red * (1 - alpha)) + (color.red * alpha);
	            rgb.green = (rgb.green * (1 - alpha)) + (color.green * alpha);
	            rgb.blue = (rgb.blue * (1 - alpha)) + (color.blue * alpha);
	            rgb.alpha = (rgb.alpha * (1 - alpha)) + (color.alpha * alpha);

	            return rgb;
	        },

	        /* fromObject attempts to convert an object o to and RGB
	         * instance. This accepts an object with red, green and blue
	         * members or a string. If the string is a known CSS color name
	         * or a hexdecimal string it will accept it.
	         */
	        fromObject: function(o) {
	            if (o instanceof Array) {
	                return this._fromRGBArray(o);
	            }
	            if ("string" == typeof o) {
	                return this._fromCSS(trim(o));
	            }
	            if (o.hasOwnProperty('red') &&
	                o.hasOwnProperty('green') &&
	                o.hasOwnProperty('blue')) {
	                return this._fromRGB(o);
	            }
	            // nothing matchs, not an RGB object
	        },

	        _stringParsers: [
	            // CSS RGB(A) literal:
	            function(css) {
	                css = trim(css);

	                var withInteger = match(rgb_rgba_integer_regex, 255);
	                if (withInteger) {
	                    return withInteger;
	                }
	                return match(rgb_rgba_percentage_regex, 100);

	                function match(regex, max_value) {
	                    var colorGroups = css.match(regex);

	                    // If there is an "a" after "rgb", there must be a fourth parameter and the other way round
	                    if (!colorGroups || (!!colorGroups[1] + !!colorGroups[5] === 1)) {
	                        return null;
	                    }

	                    var rgb = factories.RGB();
	                    rgb.red = Math.min(1, Math.max(0, colorGroups[2] / max_value));
	                    rgb.green = Math.min(1, Math.max(0, colorGroups[3] / max_value));
	                    rgb.blue = Math.min(1, Math.max(0, colorGroups[4] / max_value));
	                    rgb.alpha = !!colorGroups[5] ? Math.min(Math.max(parseFloat(colorGroups[6]), 0), 1) : 1;

	                    return rgb;
	                }
	            },

	            function(css) {
	                var lower = css.toLowerCase();
	                if (lower in css_colors) {
	                    css = css_colors[lower];
	                }

	                if (!css.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)) {
	                    return;
	                }

	                css = css.replace(/^#/, '');

	                var bytes = css.length / 3;

	                var max = Math.pow(16, bytes) - 1;

	                var rgb = factories.RGB();
	                rgb.red = parseInt(css.slice(0, bytes), 16) / max;
	                rgb.green = parseInt(css.slice(bytes * 1, bytes * 2), 16) / max;
	                rgb.blue = parseInt(css.slice(bytes * 2), 16) / max;
	                rgb.alpha = 1;
	                return rgb;
	            },

	            function(css) {
	                if (css.toLowerCase() !== 'transparent') return;

	                return transparent;
	            }
	        ],

	        _fromCSS: function(css) {
	            var color = null;
	            for (var i = 0, j = this._stringParsers.length; i < j; i++) {
	                color = this._stringParsers[i](css);
	                if (color) return color;
	            }
	        },

	        _fromRGB: function(RGB) {
	            var newRGB = factories.RGB();

	            newRGB.red = RGB.red;
	            newRGB.green = RGB.green;
	            newRGB.blue = RGB.blue;
	            newRGB.alpha = RGB.hasOwnProperty('alpha') ? RGB.alpha : 1;

	            return newRGB;
	        },

	        _fromRGBArray: function(RGB) {
	            var newRGB = factories.RGB();

	            newRGB.red = Math.max(0, Math.min(1, RGB[0] / 255));
	            newRGB.green = Math.max(0, Math.min(1, RGB[1] / 255));
	            newRGB.blue = Math.max(0, Math.min(1, RGB[2] / 255));
	            newRGB.alpha = RGB[3] !== undefined ? Math.max(0, Math.min(1, RGB[3])) : 1;

	            return newRGB;
	        },

	        // convert to a CSS string. defaults to two bytes a value
	        toCSSHex: function(bytes) {
	            bytes = bytes || 2;

	            var max = Math.pow(16, bytes) - 1;
	            var css = [
	                "#",
	                pad(Math.round(this.red * max).toString(16).toUpperCase(), bytes),
	                pad(Math.round(this.green * max).toString(16).toUpperCase(), bytes),
	                pad(Math.round(this.blue * max).toString(16).toUpperCase(), bytes)
	            ];

	            return css.join('');
	        },

	        toCSS: function(bytes) {
	            if (this.alpha === 1) return this.toCSSHex(bytes);

	            var max = 255;

	            var components = [
	                'rgba(',
	                Math.max(0, Math.min(max, Math.round(this.red * max))), ',',
	                Math.max(0, Math.min(max, Math.round(this.green * max))), ',',
	                Math.max(0, Math.min(max, Math.round(this.blue * max))), ',',
	                Math.max(0, Math.min(1, this.alpha)),
	                ')'
	            ];

	            return components.join('');
	        },

	        toHSV: function() {
	            var hsv = factories.HSV();
	            var min, max, delta;

	            min = Math.min(this.red, this.green, this.blue);
	            max = Math.max(this.red, this.green, this.blue);
	            hsv.value = max; // v

	            delta = max - min;

	            if (delta == 0) { // white, grey, black
	                hsv.hue = hsv.saturation = 0;
	            } else { // chroma
	                hsv.saturation = delta / max;

	                if (this.red == max) {
	                    hsv.hue = (this.green - this.blue) / delta; // between yellow & magenta
	                } else if (this.green == max) {
	                    hsv.hue = 2 + (this.blue - this.red) / delta; // between cyan & yellow
	                } else {
	                    hsv.hue = 4 + (this.red - this.green) / delta; // between magenta & cyan
	                }

	                hsv.hue = ((hsv.hue * 60) + 360) % 360; // degrees
	            }

	            hsv.alpha = this.alpha;

	            return hsv;
	        },
	        toHSL: function() {
	            return this.toHSV().toHSL();
	        },

	        toRGB: function() {
	            return this.clone();
	        }
	    });

	    transparent = color.fromObject({
	        red: 0,
	        blue: 0,
	        green: 0,
	        alpha: 0
	    });


	    /* Like RGB above, this object describes what will become the HSV
	     * template object. This model handles hue, saturation and value.
	     * hue is the number of degrees around the color wheel, saturation
	     * describes how much color their is and value is the brightness.
	     */
	    registerModel('HSV', {
	        hue: 0,
	        saturation: 0,
	        value: 1,
	        alpha: 1,

	        shiftHue: cloneOnApply(function(degrees) {
	            var hue = (this.hue + degrees) % 360;
	            if (hue < 0) {
	                hue = (360 + hue) % 360;
	            }

	            this.hue = hue;
	        }),

	        devalueByAmount: cloneOnApply(function(val) {
	            this.value = Math.min(1, Math.max(this.value - val, 0));
	        }),

	        devalueByRatio: cloneOnApply(function(val) {
	            this.value = Math.min(1, Math.max(this.value * (1 - val), 0));
	        }),

	        valueByAmount: cloneOnApply(function(val) {
	            this.value = Math.min(1, Math.max(this.value + val, 0));
	        }),

	        valueByRatio: cloneOnApply(function(val) {
	            this.value = Math.min(1, Math.max(this.value * (1 + val), 0));
	        }),

	        desaturateByAmount: cloneOnApply(function(val) {
	            this.saturation = Math.min(1, Math.max(this.saturation - val, 0));
	        }),

	        desaturateByRatio: cloneOnApply(function(val) {
	            this.saturation = Math.min(1, Math.max(this.saturation * (1 - val), 0));
	        }),

	        saturateByAmount: cloneOnApply(function(val) {
	            this.saturation = Math.min(1, Math.max(this.saturation + val, 0));
	        }),

	        saturateByRatio: cloneOnApply(function(val) {
	            this.saturation = Math.min(1, Math.max(this.saturation * (1 + val), 0));
	        }),

	        schemeFromDegrees: function(degrees) {
	            var newColors = [];
	            for (var i = 0, j = degrees.length; i < j; i++) {
	                var col = this.clone();
	                col.hue = (this.hue + degrees[i]) % 360;
	                newColors.push(col);
	            }
	            return newColors;
	        },

	        complementaryScheme: function() {
	            return this.schemeFromDegrees([0, 180]);
	        },

	        splitComplementaryScheme: function() {
	            return this.schemeFromDegrees([0, 150, 320]);
	        },

	        splitComplementaryCWScheme: function() {
	            return this.schemeFromDegrees([0, 150, 300]);
	        },

	        splitComplementaryCCWScheme: function() {
	            return this.schemeFromDegrees([0, 60, 210]);
	        },

	        triadicScheme: function() {
	            return this.schemeFromDegrees([0, 120, 240]);
	        },

	        clashScheme: function() {
	            return this.schemeFromDegrees([0, 90, 270]);
	        },

	        tetradicScheme: function() {
	            return this.schemeFromDegrees([0, 90, 180, 270]);
	        },

	        fourToneCWScheme: function() {
	            return this.schemeFromDegrees([0, 60, 180, 240]);
	        },

	        fourToneCCWScheme: function() {
	            return this.schemeFromDegrees([0, 120, 180, 300]);
	        },

	        fiveToneAScheme: function() {
	            return this.schemeFromDegrees([0, 115, 155, 205, 245]);
	        },

	        fiveToneBScheme: function() {
	            return this.schemeFromDegrees([0, 40, 90, 130, 245]);
	        },

	        fiveToneCScheme: function() {
	            return this.schemeFromDegrees([0, 50, 90, 205, 320]);
	        },

	        fiveToneDScheme: function() {
	            return this.schemeFromDegrees([0, 40, 155, 270, 310]);
	        },

	        fiveToneEScheme: function() {
	            return this.schemeFromDegrees([0, 115, 230, 270, 320]);
	        },

	        sixToneCWScheme: function() {
	            return this.schemeFromDegrees([0, 30, 120, 150, 240, 270]);
	        },

	        sixToneCCWScheme: function() {
	            return this.schemeFromDegrees([0, 90, 120, 210, 240, 330]);
	        },

	        neutralScheme: function() {
	            return this.schemeFromDegrees([0, 15, 30, 45, 60, 75]);
	        },

	        analogousScheme: function() {
	            return this.schemeFromDegrees([0, 30, 60, 90, 120, 150]);
	        },

	        fromObject: function(o) {
	            if (o.hasOwnProperty('hue') &&
	                o.hasOwnProperty('saturation') &&
	                o.hasOwnProperty('value')) {
	                var hsv = factories.HSV();

	                hsv.hue = o.hue;
	                hsv.saturation = o.saturation;
	                hsv.value = o.value;
	                hsv.alpha = o.hasOwnProperty('alpha') ? o.alpha : 1;

	                return hsv;
	            }
	            // nothing matches, not an HSV object
	            return null;
	        },

	        _normalise: function() {
	            this.hue %= 360;
	            this.saturation = Math.min(Math.max(0, this.saturation), 1);
	            this.value = Math.min(Math.max(0, this.value));
	            this.alpha = Math.min(1, Math.max(0, this.alpha));
	        },

	        toRGB: function() {
	            this._normalise();

	            var rgb = factories.RGB();
	            var i;
	            var f, p, q, t;

	            if (this.saturation === 0) {
	                // achromatic (grey)
	                rgb.red = this.value;
	                rgb.green = this.value;
	                rgb.blue = this.value;
	                rgb.alpha = this.alpha;
	                return rgb;
	            }

	            var h = this.hue / 60; // sector 0 to 5
	            i = Math.floor(h);
	            f = h - i; // factorial part of h
	            p = this.value * (1 - this.saturation);
	            q = this.value * (1 - this.saturation * f);
	            t = this.value * (1 - this.saturation * (1 - f));

	            switch (i) {
	                case 0:
	                    rgb.red = this.value;
	                    rgb.green = t;
	                    rgb.blue = p;
	                    break;
	                case 1:
	                    rgb.red = q;
	                    rgb.green = this.value;
	                    rgb.blue = p;
	                    break;
	                case 2:
	                    rgb.red = p;
	                    rgb.green = this.value;
	                    rgb.blue = t;
	                    break;
	                case 3:
	                    rgb.red = p;
	                    rgb.green = q;
	                    rgb.blue = this.value;
	                    break;
	                case 4:
	                    rgb.red = t;
	                    rgb.green = p;
	                    rgb.blue = this.value;
	                    break;
	                default: // case 5:
	                    rgb.red = this.value;
	                    rgb.green = p;
	                    rgb.blue = q;
	                    break;
	            }

	            rgb.alpha = this.alpha;

	            return rgb;
	        },
	        toHSL: function() {
	            this._normalise();

	            var hsl = factories.HSL();

	            hsl.hue = this.hue;
	            var l = (2 - this.saturation) * this.value,
	                s = this.saturation * this.value;
	            if (l && 2 - l) {
	                s /= (l <= 1) ? l : 2 - l;
	            }
	            l /= 2;
	            hsl.saturation = s;
	            hsl.lightness = l;
	            hsl.alpha = this.alpha;

	            return hsl;
	        },

	        toHSV: function() {
	            return this.clone();
	        }
	    });

	    registerModel('HSL', {
	        hue: 0,
	        saturation: 0,
	        lightness: 0,
	        alpha: 1,

	        darkenByAmount: cloneOnApply(function(val) {
	            this.lightness = Math.min(1, Math.max(this.lightness - val, 0));
	        }),

	        darkenByRatio: cloneOnApply(function(val) {
	            this.lightness = Math.min(1, Math.max(this.lightness * (1 - val), 0));
	        }),

	        lightenByAmount: cloneOnApply(function(val) {
	            this.lightness = Math.min(1, Math.max(this.lightness + val, 0));
	        }),

	        lightenByRatio: cloneOnApply(function(val) {
	            this.lightness = Math.min(1, Math.max(this.lightness * (1 + val), 0));
	        }),

	        fromObject: function(o) {
	            if ("string" == typeof o) {
	                return this._fromCSS(o);
	            }
	            if (o.hasOwnProperty('hue') &&
	                o.hasOwnProperty('saturation') &&
	                o.hasOwnProperty('lightness')) {
	                return this._fromHSL(o);
	            }
	            // nothing matchs, not an RGB object
	        },

	        _fromCSS: function(css) {
	            var colorGroups = trim(css).match(hsl_hsla_regex);

	            // if there is an "a" after "hsl", there must be a fourth parameter and the other way round
	            if (!colorGroups || (!!colorGroups[1] + !!colorGroups[5] === 1)) {
	                return null;
	            }

	            var hsl = factories.HSL();
	            hsl.hue = (colorGroups[2] % 360 + 360) % 360;
	            hsl.saturation = Math.max(0, Math.min(parseInt(colorGroups[3], 10) / 100, 1));
	            hsl.lightness = Math.max(0, Math.min(parseInt(colorGroups[4], 10) / 100, 1));
	            hsl.alpha = !!colorGroups[5] ? Math.max(0, Math.min(1, parseFloat(colorGroups[6]))) : 1;

	            return hsl;
	        },

	        _fromHSL: function(HSL) {
	            var newHSL = factories.HSL();

	            newHSL.hue = HSL.hue;
	            newHSL.saturation = HSL.saturation;
	            newHSL.lightness = HSL.lightness;

	            newHSL.alpha = HSL.hasOwnProperty('alpha') ? HSL.alpha : 1;

	            return newHSL;
	        },

	        _normalise: function() {
	            this.hue = (this.hue % 360 + 360) % 360;
	            this.saturation = Math.min(Math.max(0, this.saturation), 1);
	            this.lightness = Math.min(Math.max(0, this.lightness));
	            this.alpha = Math.min(1, Math.max(0, this.alpha));
	        },

	        toHSL: function() {
	            return this.clone();
	        },
	        toHSV: function() {
	            this._normalise();

	            var hsv = factories.HSV();

	            // http://ariya.blogspot.com/2008/07/converting-between-hsl-and-hsv.html
	            hsv.hue = this.hue; // H
	            var l = 2 * this.lightness,
	                s = this.saturation * ((l <= 1) ? l : 2 - l);
	            hsv.value = (l + s) / 2; // V
	            hsv.saturation = ((2 * s) / (l + s)) || 0; // S
	            hsv.alpha = this.alpha;

	            return hsv;
	        },
	        toRGB: function() {
	            return this.toHSV().toRGB();
	        }
	    });

	    // Package specific exports

	    /* the Color function is a factory for new color objects.
	     */
	    function Color(o) {
	        return color.fromObject(o);
	    }
	    Color.isValid = function(str) {
	        var key, c = Color(str);

	        var length = 0;
	        for (key in c) {
	            if (c.hasOwnProperty(key)) {
	                length++;
	            }
	        }

	        return length > 0;
	    };
	    net.brehaut.Color = Color;
	}).call(net.brehaut);

	/* Export to CommonJS
	 */
	{
	    module.exports = net.brehaut.Color;
	}
	});

	const TIME_TICK_RATE = write(100);

	const SPRITES = read(`/sheets/default_2.png`);
	const SPRITES_COLOR = read(`/sheets/default_2_color.png`);
	const IS_DEV = read(window.location.host === `localhost:5000`);

	const SVELTE_ANIMATION = write({ delay: 100, duration: 300 });

	const TILE_COUNT = read(1024);
	const TILE_COLUMNS = read(32);

	const THEME_COLOR = write(`rgb(224, 168, 83)`);
	const THEME_BG = write(`#033`);
	const THEME_GLOW = write(`green`);

	const CURSOR = write(`/`);

	const THEME_BORDER = read(``, (set) =>
		THEME_BG.listen(($THEME_BG) => set(color($THEME_BG)
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
		.join(`_`);

	var pad = function pad (num, size) {
	  var s = '000000000' + num;
	  return s.substr(s.length - size);
	};

	var padding = 2,
	    pid = pad(process.pid.toString(36), padding),
	    hostname = os.hostname(),
	    length = hostname.length,
	    hostId = pad(hostname
	      .split('')
	      .reduce(function (prev, char) {
	        return +prev + char.charCodeAt(0);
	      }, +length + 36)
	      .toString(36),
	    padding);

	var env = typeof window === 'object' ? window : self;
	var globalCount = Object.keys(env).length;
	var mimeTypesLength = navigator.mimeTypes ? navigator.mimeTypes.length : 0;
	var clientId = pad((mimeTypesLength +
	  navigator.userAgent.length).toString(36) +
	  globalCount.toString(36), 4);

	var fingerprint_browser = function fingerprint () {
	  return clientId;
	};

	var getRandomValue;

	var crypto = typeof window !== 'undefined' &&
	  (window.crypto || window.msCrypto) ||
	  typeof self !== 'undefined' &&
	  self.crypto;

	if (crypto) {
	    var lim = Math.pow(2, 32) - 1;
	    getRandomValue = function () {
	        return Math.abs(crypto.getRandomValues(new Uint32Array(1))[0] / lim);
	    };
	} else {
	    getRandomValue = Math.random;
	}

	var getRandomValue_browser = getRandomValue;

	/**
	 * cuid.js
	 * Collision-resistant UID generator for browsers and node.
	 * Sequential for fast db lookups and recency sorting.
	 * Safe for element IDs and server-side lookups.
	 *
	 * Extracted from CLCTR
	 *
	 * Copyright (c) Eric Elliott 2012
	 * MIT License
	 */





	var c = 0,
	  blockSize = 4,
	  base = 36,
	  discreteValues = Math.pow(base, blockSize);

	function randomBlock () {
	  return pad((getRandomValue_browser() *
	    discreteValues << 0)
	    .toString(base), blockSize);
	}

	function safeCounter () {
	  c = c < discreteValues ? c : 0;
	  c++; // this is not subliminal
	  return c - 1;
	}

	function cuid () {
	  // Starting with a lowercase letter makes
	  // it HTML element ID friendly.
	  var letter = 'c', // hard-coded allows for sequential access

	    // timestamp
	    // warning: this exposes the exact date and time
	    // that the uid was created.
	    timestamp = (new Date().getTime()).toString(base),

	    // Prevent same-machine collisions.
	    counter = pad(safeCounter().toString(base), blockSize),

	    // A few chars to generate distinct ids for different
	    // clients (so different computers are far less
	    // likely to generate the same id)
	    print = fingerprint_browser(),

	    // Grab some more chars from Math.random()
	    random = randomBlock() + randomBlock();

	  return letter + timestamp + counter + print + random;
	}

	cuid.slug = function slug () {
	  var date = new Date().getTime().toString(36),
	    counter = safeCounter().toString(36).slice(-4),
	    print = fingerprint_browser().slice(0, 1) +
	      fingerprint_browser().slice(-1),
	    random = randomBlock().slice(-2);

	  return date.slice(-2) +
	    counter + print + random;
	};

	cuid.isCuid = function isCuid (stringToCheck) {
	  if (typeof stringToCheck !== 'string') return false;
	  if (stringToCheck.startsWith('c')) return true;
	  return false;
	};

	cuid.isSlug = function isSlug (stringToCheck) {
	  if (typeof stringToCheck !== 'string') return false;
	  var stringLength = stringToCheck.length;
	  if (stringLength >= 7 && stringLength <= 10) return true;
	  return false;
	};

	cuid.fingerprint = fingerprint_browser;

	var cuid_1 = cuid;

	const proto_warp = {
		get_space () {
			const id = this.id.get();
			let space_id;

			const finder = (spx) => {
				if (spx.indexOf(Wheel.DENOTE) === -1) return

				space_id = spx.split(Wheel.DENOTE)[0];
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
						return [`&${cuid_1()}`, {
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
			return weave.chain(address, true).slice(0, -1)
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
			.split(`=>`)
			.filter((i) => i !== ``);

		if (!right) parts = parts.reverse();

		const wefts_update = weave.wefts.get();

		// remove old thread
		weave.remove(...chain(weave, address, right));

		if (parts.length === 0) {
			return
		}

		const space = weave.get_id(address.split(Wheel.DENOTE)[0]);

		let connection = address;

		// lets create these warps
		const ids = parts.map((part) => {
			part = part.trim();

			const w_data = warp_create(part);
			w_data.id = `${prefix}${cuid_1()}`;

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
				weave: weave_other,
				right
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

	var scribbletune = createCommonjsModule(function (module, exports) {
	!function(n,t){for(var r in t)n[r]=t[r];}(exports,function(n){var t={};function r(e){if(t[e])return t[e].exports;var i=t[e]={i:e,l:!1,exports:{}};return n[e].call(i.exports,i,i.exports,r),i.l=!0,i.exports}return r.m=n,r.c=t,r.d=function(n,t,e){r.o(n,t)||Object.defineProperty(n,t,{enumerable:!0,get:e});},r.r=function(n){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(n,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(n,"__esModule",{value:!0});},r.t=function(n,t){if(1&t&&(n=r(n)),8&t)return n;if(4&t&&"object"==typeof n&&n&&n.__esModule)return n;var e=Object.create(null);if(r.r(e),Object.defineProperty(e,"default",{enumerable:!0,value:n}),2&t&&"string"!=typeof n)for(var i in n)r.d(e,i,function(t){return n[t]}.bind(null,i));return e},r.n=function(n){var t=n&&n.__esModule?function(){return n.default}:function(){return n};return r.d(t,"a",t),t},r.o=function(n,t){return Object.prototype.hasOwnProperty.call(n,t)},r.p="",r(r.s=7)}([function(n,t,r){Object.defineProperty(t,"__esModule",{value:!0}),t.isNote=function(n){return /^[a-gA-G](?:#|b)?\d$/.test(n)},t.expandStr=function(n){return n=(n=(n=(n=JSON.stringify(n.split(""))).replace(/,"\[",/g,", [")).replace(/"\[",/g,"[")).replace(/,"\]"/g,"]"),JSON.parse(n)},t.shuffle=function(n){var t=n.length-1;return n.forEach((function(r,e){var i=Math.round(Math.random()*t);n[e]=n[i],n[i]=r;})),n},t.sizzleMap=function(n){void 0===n&&(n=127);var t=Math.PI,r=[t/6,t/4,t/3,t/2,2*t/3,3*t/4,5*t/6,t],e=[0,t/6,t/4,t/3,t/2,2*t/3,3*t/4,5*t/6];return e.reverse(),r.concat(e).map((function(t){return Math.round(Math.sin(t)*n)}))},t.pickOne=function(n){return n.length>1?n[Math.round(Math.random())]:n[0]},t.dice=function(){return !!Math.round(Math.random())};},function(n,t,r){Object.defineProperty(t,"__esModule",{value:!0});var e=r(4),i=e.Chord.names(),o=r(0);t.getChord=function(n){if(o.isNote(n))throw new Error(n+" is not a chord!");var t=n.split("-"),r=e.Chord.tokenize(t[0]),i=r[0],u=r[1];"4"!==i[1]&&"5"!==i[1]||(u=i[1],i=i.replace(/\d/,""));var a={"4th":"4","5th":"5","7th":"7","9th":"9","11th":"11","13th":"13"};if(a[u]&&(u=a[u]),!e.Chord.exists(u))throw new TypeError("Invalid chord name: "+u);return (e.chord(u)||[]).map((function(n){var r=e.transpose.bind(null,i+(t[1]||4))(n);return e.Note.simplify(r)}))},t.chords=function(){var n={4:"4th",5:"5th",7:"7th",9:"9th",11:"11th",13:"13th"};return i.map((function(t){return /^\d+$/.test(t)&&n[t]?n[t]:t}))};},function(n,t,r){var e=this&&this.__importStar||function(n){if(n&&n.__esModule)return n;var t={};if(null!=n)for(var r in n)Object.hasOwnProperty.call(n,r)&&(t[r]=n[r]);return t.default=n,t};Object.defineProperty(t,"__esModule",{value:!0});var i=e(r(4));t.getScale=function(n){n=(n=(n=n&&n.toLowerCase()).replace("#5p","#5P")).replace("#7m","#7M");var t=i.Scale.tokenize(n)[1];if(!i.Scale.exists(t))throw new Error(n+" does not exist!");return i.Scale.notes(n).map(i.Note.simplify)},t.scales=function(){return i.Scale.names()};},function(n,t,r){var e=this&&this.__assign||function(){return (e=Object.assign||function(n){for(var t,r=1,e=arguments.length;r<e;r++)for(var i in t=arguments[r])Object.prototype.hasOwnProperty.call(t,i)&&(n[i]=t[i]);return n}).apply(this,arguments)};Object.defineProperty(t,"__esModule",{value:!0});var i=r(0),o=r(1),u="undefined"!=typeof window&&r(8),a={"1m":2048,"2m":4096,"3m":6144,"4m":8192,"1n":512,"2n":256,"4n":128,"8n":64,"16n":32};t.clip=function(n){if("string"==typeof(n=e(e({},{notes:["C4"],pattern:"x",shuffle:!1,sizzle:!1,sizzleReps:1,arpegiate:!1,subdiv:"4n",amp:100,accentLow:70,randomNotes:null}),n||{})).notes&&(n.notes=n.notes.replace(/\s{2,}/g," "),n.notes=n.notes.split(" ")),n.notes=n.notes.map((function(n){return i.isNote(n)?[n]:Array.isArray(n)?(n.forEach((function(n){if(!i.isNote(n))throw new TypeError("array must comprise valid notes")})),n):!Array.isArray(n)&&o.getChord(n)?n=o.getChord(n):void 0})),/[^x\-_\[\]R]/.test(n.pattern))throw new TypeError("pattern can only comprise x - _ [ ], found "+n.pattern);if(n.shuffle&&(n.notes=i.shuffle(n.notes)),n.randomNotes&&"string"==typeof n.randomNotes&&(n.randomNotes=n.randomNotes.replace(/\s{2,}/g," "),n.randomNotes=n.randomNotes.split(/\s/)),n.randomNotes&&(n.randomNotes=n.randomNotes.map((function(n){return [n]}))),n.synth||n.instrument||n.sample||n.buffer||n.player||n.samples||n.sampler)return u(n);var t=[],r=0,s=function(e,i){e.forEach((function(e){if("string"==typeof e){var o=null;"x"===e&&(o=n.notes[r],r++),"R"===e&&(Math.round(Math.random())||n.randomNotes)&&(o=n.randomNotes?n.randomNotes[Math.round(Math.random()*(n.randomNotes.length-1))]:n.notes[r],r++),"x"!==e&&"-"!==e&&"R"!==e||t.push({note:o,length:i,level:"R"!==e||n.randomNotes?n.amp:n.accentLow}),"_"===e&&t.length&&(t[t.length-1].length+=i),r===n.notes.length&&(r=0);}Array.isArray(e)&&s(e,i/e.length);}));};if(s(i.expandStr(n.pattern),a[n.subdiv]||a["4n"]),n.sizzle){var c=[],m=!0===n.sizzle?"sin":n.sizzle,l=t.length,f=n.amp,d=n.sizzleReps,p=f/(l/d);if("sin"===m||"cos"===m)for(var P=0;P<l;P++){var h=Math[m](P*Math.PI/(l/d))*f;c.push(Math.round(Math.abs(h)));}if("rampUp"===m)for(h=0,P=0;P<l;P++)P%(l/d)==0?h=0:h+=p,c.push(Math.round(Math.abs(h)));if("rampDown"===m)for(h=f,P=0;P<l;P++)P%(l/d)==0?h=f:h-=p,c.push(Math.round(Math.abs(h)));for(P=0;P<c.length;P++)t[P].level=c[P]?c[P]:1;}if(n.accent){if(/[^x\-]/.test(n.accent))throw new TypeError("Accent can only have x and - characters");for(var M=0,v=0,y=t;v<y.length;v++){var b=y[v];h="x"===n.accent[M]?n.amp:n.accentLow;n.sizzle&&(h=(b.level+h)/2),b.level=Math.round(h),(M+=1)===n.accent.length&&(M=0);}}return t};},function(n,t,r){r.r(t);var e={};r.r(e),r.d(e,"names",(function(){return f})),r.d(e,"tokenize",(function(){return h})),r.d(e,"props",(function(){return y})),r.d(e,"name",(function(){return b})),r.d(e,"pc",(function(){return g})),r.d(e,"midi",(function(){return A})),r.d(e,"midiToFreq",(function(){return _})),r.d(e,"freq",(function(){return O})),r.d(e,"freqToMidi",(function(){return w})),r.d(e,"chroma",(function(){return E})),r.d(e,"oct",(function(){return C})),r.d(e,"stepToLetter",(function(){return I})),r.d(e,"altToAcc",(function(){return x})),r.d(e,"from",(function(){return S})),r.d(e,"build",(function(){return k})),r.d(e,"fromMidi",(function(){return R})),r.d(e,"simplify",(function(){return D})),r.d(e,"enharmonic",(function(){return z}));var i={};r.r(i),r.d(i,"range",(function(){return F})),r.d(i,"rotate",(function(){return q})),r.d(i,"compact",(function(){return B})),r.d(i,"sort",(function(){return V})),r.d(i,"unique",(function(){return L})),r.d(i,"shuffle",(function(){return U})),r.d(i,"permutations",(function(){return G}));var o={};r.r(o),r.d(o,"names",(function(){return Q})),r.d(o,"tokenize",(function(){return W})),r.d(o,"qToAlt",(function(){return nn})),r.d(o,"altToQ",(function(){return tn})),r.d(o,"props",(function(){return un})),r.d(o,"num",(function(){return an})),r.d(o,"name",(function(){return sn})),r.d(o,"semitones",(function(){return cn})),r.d(o,"chroma",(function(){return mn})),r.d(o,"ic",(function(){return ln})),r.d(o,"build",(function(){return fn})),r.d(o,"simplify",(function(){return dn})),r.d(o,"invert",(function(){return pn})),r.d(o,"fromSemitones",(function(){return Mn}));var u={};r.r(u),r.d(u,"transpose",(function(){return Tn})),r.d(u,"trFifths",(function(){return jn})),r.d(u,"fifths",(function(){return wn})),r.d(u,"transposeBy",(function(){return En})),r.d(u,"addIntervals",(function(){return In})),r.d(u,"add",(function(){return Nn})),r.d(u,"subtract",(function(){return xn})),r.d(u,"interval",(function(){return Sn})),r.d(u,"semitones",(function(){return kn}));var a={};r.r(a),r.d(a,"chroma",(function(){return Bn})),r.d(a,"chromas",(function(){return Vn})),r.d(a,"modes",(function(){return Ln})),r.d(a,"isChroma",(function(){return Gn})),r.d(a,"intervals",(function(){return $n})),r.d(a,"isEqual",(function(){return Kn})),r.d(a,"isSubsetOf",(function(){return Jn})),r.d(a,"isSupersetOf",(function(){return Qn})),r.d(a,"includes",(function(){return Wn})),r.d(a,"filter",(function(){return Xn}));var s={};r.r(s),r.d(s,"dictionary",(function(){return Zn})),r.d(s,"combine",(function(){return nt})),r.d(s,"scale",(function(){return tt})),r.d(s,"chord",(function(){return rt})),r.d(s,"pcset",(function(){return et}));var c={};r.r(c),r.d(c,"props",(function(){return ot})),r.d(c,"names",(function(){return ut})),r.d(c,"intervals",(function(){return at})),r.d(c,"notes",(function(){return st})),r.d(c,"exists",(function(){return ct})),r.d(c,"tokenize",(function(){return mt})),r.d(c,"modeNames",(function(){return lt})),r.d(c,"chords",(function(){return ft})),r.d(c,"toScale",(function(){return dt})),r.d(c,"supersets",(function(){return pt})),r.d(c,"subsets",(function(){return Pt}));var m={};r.r(m),r.d(m,"names",(function(){return ht})),r.d(m,"props",(function(){return vt})),r.d(m,"intervals",(function(){return yt})),r.d(m,"notes",(function(){return bt})),r.d(m,"exists",(function(){return gt})),r.d(m,"supersets",(function(){return At})),r.d(m,"subsets",(function(){return _t})),r.d(m,"tokenize",(function(){return Tt}));var l="C C# Db D D# Eb E F F# Gb G G# Ab A A# Bb B".split(" "),f=function(n){return "string"!=typeof n?l.slice():l.filter((function(t){var r=t[1]||" ";return -1!==n.indexOf(r)}))},d=f(" #"),p=f(" b"),P=/^([a-gA-G]?)(#{1,}|b{1,}|x{1,}|)(-?\d*)\s*(.*)$/;function h(n){"string"!=typeof n&&(n="");var t=P.exec(n);return [t[1].toUpperCase(),t[2].replace(/x/g,"##"),t[3],t[4]]}var M=Object.freeze({pc:null,name:null,step:null,alt:null,oct:null,octStr:null,chroma:null,midi:null,freq:null}),v=[0,2,4,5,7,9,11],y=function(n,t){return void 0===t&&(t={}),function(r){return t[r]||(t[r]=n(r))}}((function(n){var t=h(n);if(""===t[0]||""!==t[3])return M;var r=t[0],e=t[1],i=t[2],o={letter:r,acc:e,octStr:i,pc:r+e,name:r+e+i,step:(r.charCodeAt(0)+3)%7,alt:"b"===e[0]?-e.length:e.length,oct:i.length?+i:null,chroma:0,midi:null,freq:null};return o.chroma=(v[o.step]+o.alt+120)%12,o.midi=null!==o.oct?v[o.step]+o.alt+12*(o.oct+1):null,o.freq=_(o.midi),Object.freeze(o)})),b=function(n){return y(n).name},g=function(n){return y(n).pc},A=function(n){if("number"!=typeof n&&"string"!=typeof n)return null;var t,r=y(n).midi,e=r||0===r?r:+n;return (t=e)>=0&&t<=127?e:null},_=function(n,t){return void 0===t&&(t=440),"number"==typeof n?Math.pow(2,(n-69)/12)*t:null},O=function(n){return y(n).freq||_(n)},T=Math.log(2),j=Math.log(440),w=function(n){var t=12*(Math.log(n)-j)/T+69;return Math.round(100*t)/100},E=function(n){return y(n).chroma},C=function(n){return y(n).oct},I=function(n){return "CDEFGAB"[n]},N=function(n,t){return Array(t+1).join(n)},x=function(n){return function(n,t){return "number"!=typeof n?"":t(n)}(n,(function(n){return n<0?N("b",-n):N("#",n)}))},S=function(n,t){void 0===n&&(n={}),void 0===t&&(t=null);var r=t?Object.assign({},y(t),n):n,e=r.step,i=r.alt,o=r.oct;if("number"!=typeof e)return null;var u=I(e);if(!u)return null;var a=u+x(i);return o||0===o?a+o:a},k=S;function R(n,t){return void 0===t&&(t=!1),n=Math.round(n),(!0===t?d:p)[n%12]+(Math.floor(n/12)-1)}var D=function(n,t){void 0===t&&(t=!0);var r=y(n),e=r.alt,i=r.chroma,o=r.midi;if(null===i)return null;var u=!1===t?e<0:e>0;return null===o?g(R(i,u)):R(o,u)},z=function(n){return D(n,!1)};function F(n,t){return null===n||null===t?[]:n<t?function(n,t){for(var r=[];t--;r[t]=t+n);return r}(n,t-n+1):function(n,t){for(var r=[];t--;r[t]=n-t);return r}(n,n-t+1)}function q(n,t){var r=t.length,e=(n%r+r)%r;return t.slice(e,r).concat(t.slice(0,e))}var B=function(n){return n.filter((function(n){return 0===n||n}))},H=function(n){var t=y(n).midi;return null!==t?t:y(n+"-100").midi};function V(n){return B(n.map(b)).sort((function(n,t){return H(n)>H(t)}))}function L(n){return V(n).filter((function(n,t,r){return 0===t||n!==r[t-1]}))}var U=function(n,t){var r,e;void 0===t&&(t=Math.random);for(var i=n.length;i;)r=t()*i--|0,e=n[i],n[i]=n[r],n[r]=e;return n},G=function(n){return 0===n.length?[[]]:G(n.slice(1)).reduce((function(t,r){return t.concat(n.map((function(t,e){var i=r.slice();return i.splice(e,0,n[0]),i})))}),[])},Y=new RegExp("^([-+]?\\d+)(d{1,4}|m|M|P|A{1,4})|(AA|A|P|M|m|d|dd)([-+]?\\d+)$"),$=[0,2,4,5,7,9,11],K=[0,1,2,3,4,5,6,5,4,3,2,1],J="1P 2m 2M 3m 3M 4P 5P 6m 6M 7m 7M 8P".split(" "),Q=function(n){return "string"!=typeof n?J.slice():J.filter((function(t){return -1!==n.indexOf(t[1])}))},W=function(n){var t=Y.exec(""+n);return null===t?null:t[1]?[t[1],t[2]]:[t[4],t[3]]},X=Object.freeze({name:null,num:null,q:null,step:null,alt:null,dir:null,type:null,simple:null,semitones:null,chroma:null,oct:null}),Z=function(n,t){return Array(Math.abs(t)+1).join(n)},nn=function(n,t){return "M"===t&&"M"===n?0:"P"===t&&"P"===n?0:"m"===t&&"M"===n?-1:/^A+$/.test(t)?t.length:/^d+$/.test(t)?"P"===n?-t.length:-t.length-1:null},tn=function(n,t){return 0===t?"M"===n?"M":"P":-1===t&&"M"===n?"m":t>0?Z("A",t):t<0?Z("d","P"===n?t:t+1):null},rn=function(n){return (Math.abs(n)-1)%7},en=function(n){var t=W(n);if(null===t)return X;var r={num:0,q:"d",name:"",type:"M",step:0,dir:-1,simple:1,alt:0,oct:0,semitones:0,chroma:0,ic:0};return r.num=+t[0],r.q=t[1],r.step=rn(r.num),r.type="PMMPPMM"[r.step],"M"===r.type&&"P"===r.q?X:(r.name=""+r.num+r.q,r.dir=r.num<0?-1:1,r.simple=8===r.num||-8===r.num?r.num:r.dir*(r.step+1),r.alt=nn(r.type,r.q),r.oct=Math.floor((Math.abs(r.num)-1)/7),r.semitones=r.dir*($[r.step]+r.alt+12*r.oct),r.chroma=(r.dir*($[r.step]+r.alt)%12+12)%12,Object.freeze(r))},on={};function un(n){return "string"!=typeof n?X:on[n]||(on[n]=en(n))}var an=function(n){return un(n).num},sn=function(n){return un(n).name},cn=function(n){return un(n).semitones},mn=function(n){return un(n).chroma},ln=function(n){return "string"==typeof n&&(n=un(n).chroma),"number"==typeof n?K[n%12]:null},fn=function(n){var t=void 0===n?{}:n,r=t.num,e=t.step,i=t.alt,o=t.oct,u=void 0===o?1:o,a=t.dir;if(void 0!==e&&(r=e+1+7*u),void 0===r)return null;if("number"!=typeof i)return null;var s="number"!=typeof a?"":a<0?"-":"",c="PMMPPMM"[rn(r)];return s+r+tn(c,i)},dn=function(n){var t=un(n);if(t===X)return null;var r=t;return r.simple+r.q},pn=function(n){var t=un(n);if(t===X)return null;var r=t,e=(7-r.step)%7,i="P"===r.type?-r.alt:-(r.alt+1);return fn({step:e,alt:i,oct:r.oct,dir:r.dir})},Pn=[1,2,2,3,3,4,5,5,6,6,7,7],hn="P m M m M P d P m M m M".split(" "),Mn=function(n){var t=n<0?-1:1,r=Math.abs(n),e=r%12,i=Math.floor(r/12);return t*(Pn[e]+7*i)+hn[e]},vn=[0,2,4,-1,1,3,5],yn=vn.map((function(n){return Math.floor(7*n/12)})),bn=[3,0,4,1,5,2,6];var gn=function(n,t,r){var e=bn[function(n){var t=(n+1)%7;return t<0?7+t:t}(n)],i=Math.floor((n+1)/7);return void 0===t?{step:e,alt:i,dir:r}:{step:e,alt:i,oct:t+4*i+yn[e],dir:r}},An=function(n){return function(n,t){return void 0===t&&(t={}),function(r){return t[r]||(t[r]=n(r))}}((function(t){var r=n(t);return null===r.name?null:function(n){var t=n.step,r=n.alt,e=n.oct,i=n.dir;void 0===i&&(i=1);var o=vn[t]+7*r;return null===e?[i*o]:[i*o,i*(e-yn[t]-4*r)]}(r)}))},_n=An(y),On=An(un);function Tn(n,t){if(1===arguments.length)return function(t){return Tn(n,t)};var r=_n(n),e=On(t);if(null===r||null===e)return null;var i=1===r.length?[r[0]+e[0]]:[r[0]+e[0],r[1]+e[1]];return k(gn(i[0],i[1]))}function jn(n,t){if(1===arguments.length)return function(t){return jn(n,t)};var r=_n(n);return null===r?null:k(gn(r[0]+t))}function wn(n,t){if(1===arguments.length)return function(t){return wn(n,t)};var r=_n(n),e=_n(t);return null===e||null===r?null:e[0]-r[0]}function En(n,t){return 1===arguments.length?function(t){return Tn(t,n)}:Tn(t,n)}var Cn=function(n){return 7*(t=n)[0]+12*t[1]<0?gn(-n[0],-n[1],-1):gn(n[0],n[1],1);var t;};function In(n,t,r){var e=On(n),i=On(t);if(null===e||null===i)return null;var o=[e[0]+r*i[0],e[1]+r*i[1]];return fn(Cn(o))}function Nn(n,t){return 1===arguments.length?function(t){return Nn(n,t)}:In(n,t,1)}function xn(n,t){return 1===arguments.length?function(t){return Nn(n,t)}:In(n,t,-1)}function Sn(n,t){if(1===arguments.length)return function(t){return Sn(n,t)};var r=_n(n),e=_n(t);if(null===r||null===e||r.length!==e.length)return null;var i=1===r.length?[e[0]-r[0],-Math.floor(7*(e[0]-r[0])/12)]:[e[0]-r[0],e[1]-r[1]];return fn(Cn(i))}function kn(n,t){if(1===arguments.length)return function(t){return kn(n,t)};var r=y(n),e=y(t);return null!==r.midi&&null!==e.midi?e.midi-r.midi:null!==r.chroma&&null!==e.chroma?(e.chroma-r.chroma+12)%12:null}var Rn=r(5),Dn=r(6),zn=function(n){return E(n)||mn(n)||0},Fn=function(n){return parseInt(Bn(n),2)},qn=function(n){return n.replace(/0/g,"").length};function Bn(n){if(Gn(n))return n;if(!Array.isArray(n))return "";var t=[0,0,0,0,0,0,0,0,0,0,0,0];return n.map(zn).forEach((function(n){t[n]=1;})),t.join("")}var Hn=null;function Vn(n){return Hn=Hn||F(2048,4095).map((function(n){return n.toString(2)})),"number"==typeof n?Hn.filter((function(t){return qn(t)===n})):Hn.slice()}function Ln(n,t){t=!1!==t;var r=Bn(n).split("");return B(r.map((function(n,e){var i=q(e,r);return t&&"0"===i[0]?null:i.join("")})))}var Un=/^[01]{12}$/;function Gn(n){return Un.test(n)}var Yn="1P 2m 2M 3m 3M 4P 5d 5P 6m 6M 7m 7M".split(" ");function $n(n){return Gn(n)?B(n.split("").map((function(n,t){return "1"===n?Yn[t]:null}))):[]}function Kn(n,t){return 1===arguments.length?function(t){return Kn(n,t)}:Bn(n)===Bn(t)}function Jn(n,t){return arguments.length>1?Jn(n)(t):(n=Fn(n),function(t){return (t=Fn(t))!==n&&(t&n)===t})}function Qn(n,t){return arguments.length>1?Qn(n)(t):(n=Fn(n),function(t){return (t=Fn(t))!==n&&(t|n)===t})}function Wn(n,t){return arguments.length>1?Wn(n)(t):(n=Bn(n),function(t){return "1"===n[zn(t)]})}function Xn(n,t){return 1===arguments.length?function(t){return Xn(n,t)}:t.filter(Wn(n))}var Zn=function(n){var t=Object.keys(n).sort(),r=[],e=[],i=function(n,t,i){r[n]=t,e[i]=e[i]||[],e[i].push(n);};t.forEach((function(t){var r=n[t][0].split(" "),e=n[t][1],o=Bn(r);i(t,r,o),e&&e.forEach((function(n){return i(n,r,o)}));}));var o=Object.keys(r).sort(),u=function(n){return r[n]};return u.names=function(n){return "string"==typeof n?(e[n]||[]).slice():(!0===n?o:t).slice()},u},nt=function(n,t){var r=function(r){return n(r)||t(r)};return r.names=function(r){return n.names(r).concat(t.names(r))},r},tt=Zn(Rn),rt=Zn(Dn),et=nt(tt,rt),it=Object.freeze({name:null,intervals:[],names:[],chroma:null,setnum:null}),ot=function(n,t){return function(r){return t[r]||(t[r]=n(r))}}((function(n){var t=tt(n);if(!t)return it;var r={intervals:t,name:n};return r.chroma=Bn(t),r.setnum=parseInt(r.chroma,2),r.names=tt.names(r.chroma),Object.freeze(r)}),{}),ut=tt.names,at=function(n){var t=mt(n);return ot(t[1]).intervals};function st(n,t){var r=mt(n);return t=t||r[1],at(t).map(Tn(r[0]))}function ct(n){var t=mt(n);return void 0!==tt(t[1])}function mt(n){if("string"!=typeof n)return ["",""];var t=n.indexOf(" "),r=b(n.substring(0,t))||b(n)||"",e=""!==r?n.substring(r.length+1):n;return [r,e.length?e:""]}var lt=function(n){var t=at(n),r=st(n);return Ln(t).map((function(n,e){var i=tt.names(n)[0];if(i)return [r[e]||t[e],i]})).filter((function(n){return n}))},ft=function(n){var t=Jn(at(n));return rt.names().filter((function(n){return t(rt(n))}))},dt=function(n){var t=B(n.map(g));if(!t.length)return t;var r=t[0],e=L(t);return q(e.indexOf(r),e)},pt=function(n){if(!at(n).length)return [];var t=Qn(at(n));return tt.names().filter((function(n){return t(tt(n))}))},Pt=function(n){var t=Jn(at(n));return tt.names().filter((function(n){return t(tt(n))}))},ht=rt.names,Mt=Object.freeze({name:null,names:[],intervals:[],chroma:null,setnum:null}),vt=function(n,t){return void 0===t&&(t={}),function(r){return t[r]||(t[r]=n(r))}}((function(n){var t=rt(n);if(!t)return Mt;var r={intervals:t,name:n};return r.chroma=Bn(t),r.setnum=parseInt(r.chroma,2),r.names=rt.names(r.chroma),r})),yt=function(n){return vt(Tt(n)[1]).intervals};function bt(n,t){if(t)return vt(t).intervals.map(Tn(n));var r=Tt(n),e=r[0],i=r[1];return vt(i).intervals.map(Tn(e))}var gt=function(n){return void 0!==rt(Tt(n)[1])},At=function(n){if(!yt(n).length)return [];var t=Qn(yt(n));return rt.names().filter((function(n){return t(rt(n))}))},_t=function(n){var t=Jn(yt(n));return rt.names().filter((function(n){return t(rt(n))}))},Ot=/^(6|64|7|9|11|13)$/;function Tt(n){var t=h(n);return ""===t[0]?["",n]:"A"===t[0]&&"ug"===t[3]?["","aug"]:Ot.test(t[2])?[t[0]+t[1],t[2]+t[3]]:[t[0]+t[1]+t[2],t[3]]}r.d(t,"transpose",(function(){return jt})),r.d(t,"interval",(function(){return wt})),r.d(t,"note",(function(){return Et})),r.d(t,"midi",(function(){return Ct})),r.d(t,"freq",(function(){return It})),r.d(t,"chord",(function(){return Nt})),r.d(t,"scale",(function(){return xt})),r.d(t,"Array",(function(){return i})),r.d(t,"Note",(function(){return e})),r.d(t,"Interval",(function(){return o})),r.d(t,"Distance",(function(){return u})),r.d(t,"Scale",(function(){return c})),r.d(t,"Chord",(function(){return m})),r.d(t,"PcSet",(function(){return a})),r.d(t,"Dictionary",(function(){return s}));const jt=Tn,wt=Sn,Et=y,Ct=A,It=O,Nt=rt,xt=tt;},function(n){n.exports=JSON.parse('{"chromatic":["1P 2m 2M 3m 3M 4P 4A 5P 6m 6M 7m 7M"],"lydian":["1P 2M 3M 4A 5P 6M 7M"],"major":["1P 2M 3M 4P 5P 6M 7M",["ionian"]],"mixolydian":["1P 2M 3M 4P 5P 6M 7m",["dominant"]],"dorian":["1P 2M 3m 4P 5P 6M 7m"],"aeolian":["1P 2M 3m 4P 5P 6m 7m",["minor"]],"phrygian":["1P 2m 3m 4P 5P 6m 7m"],"locrian":["1P 2m 3m 4P 5d 6m 7m"],"melodic minor":["1P 2M 3m 4P 5P 6M 7M"],"melodic minor second mode":["1P 2m 3m 4P 5P 6M 7m"],"lydian augmented":["1P 2M 3M 4A 5A 6M 7M"],"lydian dominant":["1P 2M 3M 4A 5P 6M 7m",["lydian b7"]],"melodic minor fifth mode":["1P 2M 3M 4P 5P 6m 7m",["hindu","mixolydian b6M"]],"locrian #2":["1P 2M 3m 4P 5d 6m 7m",["half-diminished"]],"altered":["1P 2m 3m 3M 5d 6m 7m",["super locrian","diminished whole tone","pomeroy"]],"harmonic minor":["1P 2M 3m 4P 5P 6m 7M"],"phrygian dominant":["1P 2m 3M 4P 5P 6m 7m",["spanish","phrygian major"]],"half-whole diminished":["1P 2m 3m 3M 4A 5P 6M 7m",["dominant diminished"]],"diminished":["1P 2M 3m 4P 5d 6m 6M 7M",["whole-half diminished"]],"major pentatonic":["1P 2M 3M 5P 6M",["pentatonic"]],"lydian pentatonic":["1P 3M 4A 5P 7M",["chinese"]],"mixolydian pentatonic":["1P 3M 4P 5P 7m",["indian"]],"locrian pentatonic":["1P 3m 4P 5d 7m",["minor seven flat five pentatonic"]],"minor pentatonic":["1P 3m 4P 5P 7m"],"minor six pentatonic":["1P 3m 4P 5P 6M"],"minor hexatonic":["1P 2M 3m 4P 5P 7M"],"flat three pentatonic":["1P 2M 3m 5P 6M",["kumoi"]],"flat six pentatonic":["1P 2M 3M 5P 6m"],"major flat two pentatonic":["1P 2m 3M 5P 6M"],"whole tone pentatonic":["1P 3M 5d 6m 7m"],"ionian pentatonic":["1P 3M 4P 5P 7M"],"lydian #5P pentatonic":["1P 3M 4A 5A 7M"],"lydian dominant pentatonic":["1P 3M 4A 5P 7m"],"minor #7M pentatonic":["1P 3m 4P 5P 7M"],"super locrian pentatonic":["1P 3m 4d 5d 7m"],"in-sen":["1P 2m 4P 5P 7m"],"iwato":["1P 2m 4P 5d 7m"],"hirajoshi":["1P 2M 3m 5P 6m"],"kumoijoshi":["1P 2m 4P 5P 6m"],"pelog":["1P 2m 3m 5P 6m"],"vietnamese 1":["1P 3m 4P 5P 6m"],"vietnamese 2":["1P 3m 4P 5P 7m"],"prometheus":["1P 2M 3M 4A 6M 7m"],"prometheus neopolitan":["1P 2m 3M 4A 6M 7m"],"ritusen":["1P 2M 4P 5P 6M"],"scriabin":["1P 2m 3M 5P 6M"],"piongio":["1P 2M 4P 5P 6M 7m"],"major blues":["1P 2M 3m 3M 5P 6M"],"minor blues":["1P 3m 4P 5d 5P 7m",["blues"]],"composite blues":["1P 2M 3m 3M 4P 5d 5P 6M 7m"],"augmented":["1P 2A 3M 5P 5A 7M"],"augmented heptatonic":["1P 2A 3M 4P 5P 5A 7M"],"dorian #4":["1P 2M 3m 4A 5P 6M 7m"],"lydian diminished":["1P 2M 3m 4A 5P 6M 7M"],"whole tone":["1P 2M 3M 4A 5A 7m"],"leading whole tone":["1P 2M 3M 4A 5A 7m 7M"],"lydian minor":["1P 2M 3M 4A 5P 6m 7m"],"locrian major":["1P 2M 3M 4P 5d 6m 7m",["arabian"]],"neopolitan":["1P 2m 3m 4P 5P 6m 7M"],"neopolitan minor":["1P 2m 3m 4P 5P 6m 7M"],"neopolitan major":["1P 2m 3m 4P 5P 6M 7M",["dorian b2"]],"neopolitan major pentatonic":["1P 3M 4P 5d 7m"],"romanian minor":["1P 2M 3m 5d 5P 6M 7m"],"double harmonic lydian":["1P 2m 3M 4A 5P 6m 7M"],"harmonic major":["1P 2M 3M 4P 5P 6m 7M"],"double harmonic major":["1P 2m 3M 4P 5P 6m 7M",["gypsy"]],"egyptian":["1P 2M 4P 5P 7m"],"hungarian minor":["1P 2M 3m 4A 5P 6m 7M"],"hungarian major":["1P 2A 3M 4A 5P 6M 7m"],"oriental":["1P 2m 3M 4P 5d 6M 7m"],"spanish heptatonic":["1P 2m 3m 3M 4P 5P 6m 7m"],"flamenco":["1P 2m 3m 3M 4A 5P 7m"],"balinese":["1P 2m 3m 4P 5P 6m 7M"],"todi raga":["1P 2m 3m 4A 5P 6m 7M"],"malkos raga":["1P 3m 4P 6m 7m"],"kafi raga":["1P 3m 3M 4P 5P 6M 7m 7M"],"purvi raga":["1P 2m 3M 4P 4A 5P 6m 7M"],"persian":["1P 2m 3M 4P 5d 6m 7M"],"bebop":["1P 2M 3M 4P 5P 6M 7m 7M"],"bebop dominant":["1P 2M 3M 4P 5P 6M 7m 7M"],"bebop minor":["1P 2M 3m 3M 4P 5P 6M 7m"],"bebop major":["1P 2M 3M 4P 5P 5A 6M 7M"],"bebop locrian":["1P 2m 3m 4P 5d 5P 6m 7m"],"minor bebop":["1P 2M 3m 4P 5P 6m 7m 7M"],"mystery #1":["1P 2m 3M 5d 6m 7m"],"enigmatic":["1P 2m 3M 5d 6m 7m 7M"],"minor six diminished":["1P 2M 3m 4P 5P 6m 6M 7M"],"ionian augmented":["1P 2M 3M 4P 5A 6M 7M"],"lydian #9":["1P 2m 3M 4A 5P 6M 7M"],"ichikosucho":["1P 2M 3M 4P 5d 5P 6M 7M"],"six tone symmetric":["1P 2m 3M 4P 5A 6M"]}');},function(n){n.exports=JSON.parse('{"4":["1P 4P 7m 10m",["quartal"]],"5":["1P 5P"],"7":["1P 3M 5P 7m",["Dominant","Dom"]],"9":["1P 3M 5P 7m 9M",["79"]],"11":["1P 5P 7m 9M 11P"],"13":["1P 3M 5P 7m 9M 13M",["13_"]],"64":["5P 8P 10M"],"M":["1P 3M 5P",["Major",""]],"M#5":["1P 3M 5A",["augmented","maj#5","Maj#5","+","aug"]],"M#5add9":["1P 3M 5A 9M",["+add9"]],"M13":["1P 3M 5P 7M 9M 13M",["maj13","Maj13"]],"M13#11":["1P 3M 5P 7M 9M 11A 13M",["maj13#11","Maj13#11","M13+4","M13#4"]],"M6":["1P 3M 5P 13M",["6"]],"M6#11":["1P 3M 5P 6M 11A",["M6b5","6#11","6b5"]],"M69":["1P 3M 5P 6M 9M",["69"]],"M69#11":["1P 3M 5P 6M 9M 11A"],"M7#11":["1P 3M 5P 7M 11A",["maj7#11","Maj7#11","M7+4","M7#4"]],"M7#5":["1P 3M 5A 7M",["maj7#5","Maj7#5","maj9#5","M7+"]],"M7#5sus4":["1P 4P 5A 7M"],"M7#9#11":["1P 3M 5P 7M 9A 11A"],"M7add13":["1P 3M 5P 6M 7M 9M"],"M7b5":["1P 3M 5d 7M"],"M7b6":["1P 3M 6m 7M"],"M7b9":["1P 3M 5P 7M 9m"],"M7sus4":["1P 4P 5P 7M"],"M9":["1P 3M 5P 7M 9M",["maj9","Maj9"]],"M9#11":["1P 3M 5P 7M 9M 11A",["maj9#11","Maj9#11","M9+4","M9#4"]],"M9#5":["1P 3M 5A 7M 9M",["Maj9#5"]],"M9#5sus4":["1P 4P 5A 7M 9M"],"M9b5":["1P 3M 5d 7M 9M"],"M9sus4":["1P 4P 5P 7M 9M"],"Madd9":["1P 3M 5P 9M",["2","add9","add2"]],"Maj7":["1P 3M 5P 7M",["maj7","M7"]],"Mb5":["1P 3M 5d"],"Mb6":["1P 3M 13m"],"Msus2":["1P 2M 5P",["add9no3","sus2"]],"Msus4":["1P 4P 5P",["sus","sus4"]],"Maddb9":["1P 3M 5P 9m"],"11b9":["1P 5P 7m 9m 11P"],"13#11":["1P 3M 5P 7m 9M 11A 13M",["13+4","13#4"]],"13#9":["1P 3M 5P 7m 9A 13M",["13#9_"]],"13#9#11":["1P 3M 5P 7m 9A 11A 13M"],"13b5":["1P 3M 5d 6M 7m 9M"],"13b9":["1P 3M 5P 7m 9m 13M"],"13b9#11":["1P 3M 5P 7m 9m 11A 13M"],"13no5":["1P 3M 7m 9M 13M"],"13sus4":["1P 4P 5P 7m 9M 13M",["13sus"]],"69#11":["1P 3M 5P 6M 9M 11A"],"7#11":["1P 3M 5P 7m 11A",["7+4","7#4","7#11_","7#4_"]],"7#11b13":["1P 3M 5P 7m 11A 13m",["7b5b13"]],"7#5":["1P 3M 5A 7m",["+7","7aug","aug7"]],"7#5#9":["1P 3M 5A 7m 9A",["7alt","7#5#9_","7#9b13_"]],"7#5b9":["1P 3M 5A 7m 9m"],"7#5b9#11":["1P 3M 5A 7m 9m 11A"],"7#5sus4":["1P 4P 5A 7m"],"7#9":["1P 3M 5P 7m 9A",["7#9_"]],"7#9#11":["1P 3M 5P 7m 9A 11A",["7b5#9"]],"7#9#11b13":["1P 3M 5P 7m 9A 11A 13m"],"7#9b13":["1P 3M 5P 7m 9A 13m"],"7add6":["1P 3M 5P 7m 13M",["67","7add13"]],"7b13":["1P 3M 7m 13m"],"7b5":["1P 3M 5d 7m"],"7b6":["1P 3M 5P 6m 7m"],"7b9":["1P 3M 5P 7m 9m"],"7b9#11":["1P 3M 5P 7m 9m 11A",["7b5b9"]],"7b9#9":["1P 3M 5P 7m 9m 9A"],"7b9b13":["1P 3M 5P 7m 9m 13m"],"7b9b13#11":["1P 3M 5P 7m 9m 11A 13m",["7b9#11b13","7b5b9b13"]],"7no5":["1P 3M 7m"],"7sus4":["1P 4P 5P 7m",["7sus"]],"7sus4b9":["1P 4P 5P 7m 9m",["susb9","7susb9","7b9sus","7b9sus4","phryg"]],"7sus4b9b13":["1P 4P 5P 7m 9m 13m",["7b9b13sus4"]],"9#11":["1P 3M 5P 7m 9M 11A",["9+4","9#4","9#11_","9#4_"]],"9#11b13":["1P 3M 5P 7m 9M 11A 13m",["9b5b13"]],"9#5":["1P 3M 5A 7m 9M",["9+"]],"9#5#11":["1P 3M 5A 7m 9M 11A"],"9b13":["1P 3M 7m 9M 13m"],"9b5":["1P 3M 5d 7m 9M"],"9no5":["1P 3M 7m 9M"],"9sus4":["1P 4P 5P 7m 9M",["9sus"]],"m":["1P 3m 5P"],"m#5":["1P 3m 5A",["m+","mb6"]],"m11":["1P 3m 5P 7m 9M 11P",["_11"]],"m11A 5":["1P 3m 6m 7m 9M 11P"],"m11b5":["1P 3m 7m 12d 2M 4P",["h11","_11b5"]],"m13":["1P 3m 5P 7m 9M 11P 13M",["_13"]],"m6":["1P 3m 4P 5P 13M",["_6"]],"m69":["1P 3m 5P 6M 9M",["_69"]],"m7":["1P 3m 5P 7m",["minor7","_","_7"]],"m7#5":["1P 3m 6m 7m"],"m7add11":["1P 3m 5P 7m 11P",["m7add4"]],"m7b5":["1P 3m 5d 7m",["half-diminished","h7","_7b5"]],"m9":["1P 3m 5P 7m 9M",["_9"]],"m9#5":["1P 3m 6m 7m 9M"],"m9b5":["1P 3m 7m 12d 2M",["h9","-9b5"]],"mMaj7":["1P 3m 5P 7M",["mM7","_M7"]],"mMaj7b6":["1P 3m 5P 6m 7M",["mM7b6"]],"mM9":["1P 3m 5P 7M 9M",["mMaj9","-M9"]],"mM9b6":["1P 3m 5P 6m 7M 9M",["mMaj9b6"]],"mb6M7":["1P 3m 6m 7M"],"mb6b9":["1P 3m 6m 9m"],"o":["1P 3m 5d",["mb5","dim"]],"o7":["1P 3m 5d 13M",["diminished","m6b5","dim7"]],"o7M7":["1P 3m 5d 6M 7M"],"oM7":["1P 3m 5d 7M"],"sus24":["1P 2M 4P 5P",["sus4add9"]],"+add#9":["1P 3M 5A 9A"],"madd4":["1P 3m 4P 5P"],"madd9":["1P 3m 5P 9M"]}');},function(n,t,r){Object.defineProperty(t,"__esModule",{value:!0});var e=r(2);t.scale=e.getScale,t.mode=e.getScale,t.scales=e.scales,t.modes=e.scales;var i=r(1);t.chord=i.getChord,t.chords=i.chords;var o=r(3);t.clip=o.clip;var u=r(9);t.getChordDegrees=u.getChordDegrees,t.getChordsByProgression=u.getChordsByProgression,t.progression=u.progression;var a=r(10);t.arp=a.arp;var s=r(11);t.midi=s.midi;var c=r(15);t.Session=c.Session;},function(n,t,r){var e=this&&this.__spreadArrays||function(){for(var n=0,t=0,r=arguments.length;t<r;t++)n+=arguments[t].length;var e=Array(n),i=0;for(t=0;t<r;t++)for(var o=arguments[t],u=0,a=o.length;u<a;u++,i++)e[i]=o[u];return e};Object.defineProperty(t,"__esModule",{value:!0});var i=r(0),o=function(n){return void 0===n&&(n=1),Math.round(Math.random()*n)};n.exports=function(n){var t,r,u;if(!n.pattern)throw new Error("No pattern provided!");if(!(n.player||n.instrument||n.sample||n.buffer||n.synth||n.sampler||n.samples))throw new Error("No player or instrument provided!");var a,s=[];return n.effects&&(s=n.effects.map((function(n){return new Tone[n]}))),(n.sample||n.buffer)&&(n.player=new Tone.Player(n.sample||n.buffer)),n.samples&&(n.sampler=new Tone.Sampler(n.samples)),n.synth&&(n.instrument=new Tone[n.synth]),n.player?(n.volume&&(n.player.volume.value=n.volume),(t=n.player).chain.apply(t,e(s,[Tone.Master])),new Tone.Sequence((a=n.player,function(n,t){("x"===t||"R"===t&&o())&&a.start(n);}),i.expandStr(n.pattern),n.subdiv||"4n")):n.sampler?(n.volume&&(n.sampler.volume.value=n.volume),(r=n.sampler).chain.apply(r,e(s,[Tone.Master])),new Tone.Sequence(function(n){var t=0;return function(r,e){("x"===e&&n.notes[t]||"R"===e&&!n.randomNotes&&o()||"R"===e&&n.randomNotes)&&(n.sampler.triggerAttackRelease("R"===e&&n.randomNotes?n.randomNotes[o(n.randomNotes.length-1)]:n.notes[t],n.dur||n.subdiv||"8n",r),++t===n.notes.length&&(t=0));}}(n),i.expandStr(n.pattern),n.subdiv||"4n")):n.instrument?(n.volume&&(n.instrument.volume.value=n.volume),(u=n.instrument).chain.apply(u,e(s,[Tone.Master])),new Tone.Sequence(n.instrument.voices?function(n){var t=0;return function(r,e){("x"===e&&n.notes[t]||"R"===e&&!n.randomNotes&&o()||"R"===e&&n.randomNotes)&&(n.instrument.triggerAttackRelease("R"===e&&n.randomNotes?n.randomNotes[o(n.randomNotes.length-1)]:n.notes[t],n.dur||n.subdiv||"8n",r),++t===n.notes.length&&(t=0));}}(n):function(n){var t=0;return function(r,e){("x"===e&&n.notes[t]||"R"===e&&!n.randomNotes&&o()||"R"===e&&n.randomNotes)&&(n.instrument.triggerAttackRelease("R"===e&&n.randomNotes?n.randomNotes[o(n.randomNotes.length-1)]:n.notes[t][0],n.dur||n.subdiv||"8n",r),++t===n.notes.length&&(t=0));}}(n),i.expandStr(n.pattern),n.subdiv||"4n")):void 0};},function(n,t,r){Object.defineProperty(t,"__esModule",{value:!0});var e=r(2),i=r(0);t.getChordDegrees=function(n){var t={ionian:["I","ii","iii","IV","V","vi","vii°"],dorian:["i","ii","III","IV","v","vi°","VII"],phrygian:["i","II","III","iv","v°","VI","vii"],lydian:["I","II","iii","iv°","V","vi","vii"],mixolydian:["I","ii","iii°","IV","v","vi","VII"],aeolian:["i","ii°","III","iv","v","VI","VII"],locrian:["i°","II","iii","iv","V","VI","vii"],"melodic minor":["i","ii","III+","IV","V","vi°","vii°"],"harmonic minor":["i","ii°","III+","iv","V","VI","vii°"]};return t.major=t.ionian,t.minor=t.aeolian,t[n]||[]};var o={i:0,ii:1,iii:2,iv:3,v:4,vi:5,vii:6};t.getChordsByProgression=function(n,t){var r=n.split(" ");r[0].match(/\d/)||(r[0]+="4",n=r.join(" "));var i=e.getScale(n);return t.replace(/\s*,+\s*/g," ").split(" ").map((function(n,t){var r=function(n){var t=n.replace(/\W/g,""),r="M";return t.toLowerCase()===t&&(r="m"),n.includes("°")?r+"7b5":n.includes("+")?r+"#5":n.includes("7")?"M"===r?"Maj7":"m7":r}(n),e=o[n.replace(/\W|\d/g,"").toLowerCase()],u=i[e],a=u.replace(/\D+/,"");return u.replace(/\d/,"")+r+"-"+a})).toString().replace(/,/g," ")};var u=function(n){var t=n.T,r=n.P,e=n.D;return function(n){void 0===n&&(n=4);var o=[];o.push(i.pickOne(t));var u=1;for(u<n-1&&(o.push(i.pickOne(r)),u++),u<n-1&&i.dice()&&(o.push(i.pickOne(r)),u++),u<n-1&&(o.push(i.pickOne(e)),u++),u<n-1&&(o.push(i.pickOne(r)),u++),u<n-1&&(o.push(i.pickOne(e)),u++),u<n-1&&i.dice()&&(o.push(i.pickOne(r)),u++);u<n;)o.push(i.pickOne(e)),u++;return o}},a=u({T:["I","vi"],P:["ii","IV"],D:["V"]}),s=u({T:["i","VI"],P:["ii","iv"],D:["V"]});t.progression=function(n,t){return void 0===t&&(t=4),"major"===n||"M"===n?a(t):"minor"===n||"m"===n?s(t):void 0};},function(n,t,r){var e=this&&this.__spreadArrays||function(){for(var n=0,t=0,r=arguments.length;t<r;t++)n+=arguments[t].length;var e=Array(n),i=0;for(t=0;t<r;t++)for(var o=arguments[t],u=0,a=o.length;u<a;u++,i++)e[i]=o[u];return e};Object.defineProperty(t,"__esModule",{value:!0});var i=r(1);t.arp=function(n){var t=[],r={count:4,order:"0123",chords:""};if("string"==typeof n)r.chords=n;else{if(n.order&&n.order.match(/\D/g))throw new TypeError("Invalid value for order");if(n.count>8||n.count<2)throw new TypeError("Invalid value for count");n.count&&!n.order&&(r.order=Array.from(Array(n.count).keys()).join("")),Object.assign(r,n);}for(var o=function(n){var o,u,a,s,c,m=(o=i.getChord(n),u=r.count,a=function(n){return n.replace(/\d/,"")+(+n.replace(/\D/g,"")+1)},s=o.map(a),c=s.map(a),e(o,s,c).slice(0,u)),l=r.order.split("").map((function(n){return m[n]}));t=e(t,l);},u=0,a=r.chords.split(" ");u<a.length;u++){o(a[u]);}return t};},function(n,t,r){var e=this&&this.__importDefault||function(n){return n&&n.__esModule?n:{default:n}},i=this&&this.__importStar||function(n){if(n&&n.__esModule)return n;var t={};if(null!=n)for(var r in n)Object.hasOwnProperty.call(n,r)&&(t[r]=n[r]);return t.default=n,t};Object.defineProperty(t,"__esModule",{value:!0});var o=e(r(12)),u=i(r(13));t.midi=function(n,t){void 0===t&&(t="music.mid");var r=function(n){var t=new u.File,r=new u.Track;t.addTrack(r);for(var e=0,i=n;e<i.length;e++){var o=i[e],a=o.level||127;o.note?"string"==typeof o.note?(r.noteOn(0,o.note,o.length,a),r.noteOff(0,o.note,o.length,a)):r.addChord(0,o.note,o.length,a):r.noteOff(0,"",o.length);}return t}(n).toBytes();if(null===t)return r;t.endsWith(".mid")||(t+=".mid"),o.default.writeFileSync(t,r,"binary"),console.log("MIDI file generated: "+t+".");};},function(n,t){n.exports=fs;},function(n,t,r){(function(n){var r={};!function(n){var t=n.DEFAULT_VOLUME=90,r=(n.DEFAULT_DURATION=128,n.DEFAULT_CHANNEL=0,{midi_letter_pitches:{a:21,b:23,c:12,d:14,e:16,f:17,g:19},midiPitchFromNote:function(n){var t=/([a-g])(#+|b+)?([0-9]+)$/i.exec(n),e=t[1].toLowerCase(),i=t[2]||"";return 12*parseInt(t[3],10)+r.midi_letter_pitches[e]+("#"==i.substr(0,1)?1:-1)*i.length},ensureMidiPitch:function(n){return "number"!=typeof n&&/[^0-9]/.test(n)?r.midiPitchFromNote(n):parseInt(n,10)},midi_pitches_letter:{12:"c",13:"c#",14:"d",15:"d#",16:"e",17:"f",18:"f#",19:"g",20:"g#",21:"a",22:"a#",23:"b"},midi_flattened_notes:{"a#":"bb","c#":"db","d#":"eb","f#":"gb","g#":"ab"},noteFromMidiPitch:function(n,t){var e,i=0,o=n;t=t||!1;return n>23&&(o=n-12*(i=Math.floor(n/12)-1)),e=r.midi_pitches_letter[o],t&&e.indexOf("#")>0&&(e=r.midi_flattened_notes[e]),e+i},mpqnFromBpm:function(n){var t=Math.floor(6e7/n),r=[];do{r.unshift(255&t),t>>=8;}while(t);for(;r.length<3;)r.push(0);return r},bpmFromMpqn:function(n){if(void 0!==n[0]){for(var t=0,r=n.length-1;r>=0;++t,--r)n[t]<<r;}return Math.floor(6e7/n)},codes2Str:function(n){return String.fromCharCode.apply(null,n)},str2Bytes:function(n,t){if(t)for(;n.length/2<t;)n="0"+n;for(var r=[],e=n.length-1;e>=0;e-=2){var i=0===e?n[e]:n[e-1]+n[e];r.unshift(parseInt(i,16));}return r},translateTickTime:function(n){for(var t=127&n;n>>=7;)t<<=8,t|=127&n|128;for(var r=[];r.push(255&t),128&t;)t>>=8;return r}}),e=function(n){if(!this)return new e(n);!n||null===n.type&&void 0===n.type||null===n.channel&&void 0===n.channel||null===n.param1&&void 0===n.param1||(this.setTime(n.time),this.setType(n.type),this.setChannel(n.channel),this.setParam1(n.param1),this.setParam2(n.param2));};e.NOTE_OFF=128,e.NOTE_ON=144,e.AFTER_TOUCH=160,e.CONTROLLER=176,e.PROGRAM_CHANGE=192,e.CHANNEL_AFTERTOUCH=208,e.PITCH_BEND=224,e.prototype.setTime=function(n){this.time=r.translateTickTime(n||0);},e.prototype.setType=function(n){if(n<e.NOTE_OFF||n>e.PITCH_BEND)throw new Error("Trying to set an unknown event: "+n);this.type=n;},e.prototype.setChannel=function(n){if(n<0||n>15)throw new Error("Channel is out of bounds.");this.channel=n;},e.prototype.setParam1=function(n){this.param1=n;},e.prototype.setParam2=function(n){this.param2=n;},e.prototype.toBytes=function(){var n=[],t=this.type|15&this.channel;return n.push.apply(n,this.time),n.push(t),n.push(this.param1),void 0!==this.param2&&null!==this.param2&&n.push(this.param2),n};var i=function(n){if(!this)return new i(n);this.setTime(n.time),this.setType(n.type),this.setData(n.data);};i.SEQUENCE=0,i.TEXT=1,i.COPYRIGHT=2,i.TRACK_NAME=3,i.INSTRUMENT=4,i.LYRIC=5,i.MARKER=6,i.CUE_POINT=7,i.CHANNEL_PREFIX=32,i.END_OF_TRACK=47,i.TEMPO=81,i.SMPTE=84,i.TIME_SIG=88,i.KEY_SIG=89,i.SEQ_EVENT=127,i.prototype.setTime=function(n){this.time=r.translateTickTime(n||0);},i.prototype.setType=function(n){this.type=n;},i.prototype.setData=function(n){this.data=n;},i.prototype.toBytes=function(){if(!this.type)throw new Error("Type for meta-event not specified.");var n=[];if(n.push.apply(n,this.time),n.push(255,this.type),Array.isArray(this.data))n.push(this.data.length),n.push.apply(n,this.data);else if("number"==typeof this.data)n.push(1,this.data);else if(null!==this.data&&void 0!==this.data){n.push(this.data.length);var t=this.data.split("").map((function(n){return n.charCodeAt(0)}));n.push.apply(n,t);}else n.push(0);return n};var o=function(n){if(!this)return new o(n);var t=n||{};this.events=t.events||[];};o.START_BYTES=[77,84,114,107],o.END_BYTES=[0,255,47,0],o.prototype.addEvent=function(n){return this.events.push(n),this},o.prototype.addNoteOn=o.prototype.noteOn=function(n,i,o,u){return this.events.push(new e({type:e.NOTE_ON,channel:n,param1:r.ensureMidiPitch(i),param2:u||t,time:o||0})),this},o.prototype.addNoteOff=o.prototype.noteOff=function(n,i,o,u){return this.events.push(new e({type:e.NOTE_OFF,channel:n,param1:r.ensureMidiPitch(i),param2:u||t,time:o||0})),this},o.prototype.addNote=o.prototype.note=function(n,t,r,e,i){return this.noteOn(n,t,e,i),r&&this.noteOff(n,t,r,i),this},o.prototype.addChord=o.prototype.chord=function(n,t,r,e){if(!Array.isArray(t)&&!t.length)throw new Error("Chord must be an array of pitches");return t.forEach((function(t){this.noteOn(n,t,0,e);}),this),t.forEach((function(t,e){0===e?this.noteOff(n,t,r):this.noteOff(n,t);}),this),this},o.prototype.setInstrument=o.prototype.instrument=function(n,t,r){return this.events.push(new e({type:e.PROGRAM_CHANGE,channel:n,param1:t,time:r||0})),this},o.prototype.setTempo=o.prototype.tempo=function(n,t){return this.events.push(new i({type:i.TEMPO,data:r.mpqnFromBpm(n),time:t||0})),this},o.prototype.toBytes=function(){var n=0,t=[],e=o.START_BYTES,i=o.END_BYTES;this.events.forEach((function(r){var e=r.toBytes();n+=e.length,t.push.apply(t,e);})),n+=i.length;var u=r.str2Bytes(n.toString(16),4);return e.concat(u,t,i)};var u=function(n){if(!this)return new u(n);var t=n||{};if(t.ticks){if("number"!=typeof t.ticks)throw new Error("Ticks per beat must be a number!");if(t.ticks<=0||t.ticks>=32768||t.ticks%1!=0)throw new Error("Ticks per beat must be an integer between 1 and 32767!")}this.ticks=t.ticks||128,this.tracks=t.tracks||[];};u.HDR_CHUNKID="MThd",u.HDR_CHUNK_SIZE="\0\0\0",u.HDR_TYPE0="\0\0",u.HDR_TYPE1="\0",u.prototype.addTrack=function(n){return n?(this.tracks.push(n),this):(n=new o,this.tracks.push(n),n)},u.prototype.toBytes=function(){var n=this.tracks.length.toString(16),t=u.HDR_CHUNKID+u.HDR_CHUNK_SIZE;return parseInt(n,16)>1?t+=u.HDR_TYPE1:t+=u.HDR_TYPE0,t+=r.codes2Str(r.str2Bytes(n,2)),t+=String.fromCharCode(this.ticks/256,this.ticks%256),this.tracks.forEach((function(n){t+=r.codes2Str(n.toBytes());})),t},n.Util=r,n.File=u,n.Track=o,n.Event=e,n.MetaEvent=i;}(r),null!==n?n.exports=r:null!==t?t=r:this.Midi=r;}).call(this,r(14)(n));},function(n,t){n.exports=function(n){return n.webpackPolyfill||(n.deprecate=function(){},n.paths=[],n.children||(n.children=[]),Object.defineProperty(n,"loaded",{enumerable:!0,get:function(){return n.l}}),Object.defineProperty(n,"id",{enumerable:!0,get:function(){return n.i}}),n.webpackPolyfill=1),n};},function(n,t,r){Object.defineProperty(t,"__esModule",{value:!0});var e=r(16),i=function(){function n(n){n=n||[],this.sessionChannels=n.map((function(n,t){return n.idx=n.idx||t,new e.Channel(n)}));}return n.prototype.createChannel=function(n){n.idx=n.idx||this.sessionChannels.length,this.sessionChannels.push(new e.Channel(n));},Object.defineProperty(n.prototype,"channels",{get:function(){return this.sessionChannels},enumerable:!0,configurable:!0}),n.prototype.startRow=function(n){this.sessionChannels.forEach((function(t){t.startClip(n);}));},n}();t.Session=i;},function(n,t,r){var e=this&&this.__assign||function(){return (e=Object.assign||function(n){for(var t,r=1,e=arguments.length;r<e;r++)for(var i in t=arguments[r])Object.prototype.hasOwnProperty.call(t,i)&&(n[i]=t[i]);return n}).apply(this,arguments)},i=this&&this.__rest||function(n,t){var r={};for(var e in n)Object.prototype.hasOwnProperty.call(n,e)&&t.indexOf(e)<0&&(r[e]=n[e]);if(null!=n&&"function"==typeof Object.getOwnPropertySymbols){var i=0;for(e=Object.getOwnPropertySymbols(n);i<e.length;i++)t.indexOf(e[i])<0&&Object.prototype.propertyIsEnumerable.call(n,e[i])&&(r[e[i]]=n[e[i]]);}return r};Object.defineProperty(t,"__esModule",{value:!0});var o=r(3),u=function(){var n=Tone.Transport.position.split(":");return "0"===n[0]&&"0"===n[1]?0:+n[0]+1+":0:0"},a=function(){function n(n){var t=this;this.idx=n.idx,this.activePatternIdx=-1,this.channelClips=[],n.sample&&(this.player=new Tone.Player(n.sample)),n.synth&&(this.instrument=new Tone[n.synth]),n.samples&&(this.sampler=new Tone.Sampler(n.samples));n.clips,n.samples,n.sample,n.synth;var r=i(n,["clips","samples","sample","synth"]);n.clips.forEach((function(n){t.addClip(e(e({},n),r));}),this);}return Object.defineProperty(n.prototype,"clips",{get:function(){return this.channelClips},enumerable:!0,configurable:!0}),n.prototype.startClip=function(n){this.activePatternIdx>-1&&this.activePatternIdx!==n&&this.stopClip(this.activePatternIdx),this.channelClips[n]&&"started"!==this.channelClips[n].state&&(this.activePatternIdx=n,this.channelClips[n].start(u()));},n.prototype.stopClip=function(n){this.channelClips[n].stop(u());},n.prototype.addClip=function(n,t){t=t||this.channelClips.length,n.pattern?this.channelClips[t]=o.clip(e({player:this.player,instrument:this.instrument,sampler:this.sampler},n)):this.channelClips[t]=null;},Object.defineProperty(n.prototype,"activeClipIdx",{get:function(){return this.activePatternIdx},enumerable:!0,configurable:!0}),n}();t.Channel=a;}]));
	});

	var scribble = unwrapExports(scribbletune);

	var Tone$1 = createCommonjsModule(function (module, exports) {
	!function(t,e){module.exports=e();}("undefined"!=typeof self?self:commonjsGlobal,function(){return function(t){var e={};function i(s){if(e[s])return e[s].exports;var n=e[s]={i:s,l:!1,exports:{}};return t[s].call(n.exports,n,n.exports,i),n.l=!0,n.exports}return i.m=t,i.c=e,i.d=function(t,e,s){i.o(t,e)||Object.defineProperty(t,e,{configurable:!1,enumerable:!0,get:s});},i.r=function(t){Object.defineProperty(t,"__esModule",{value:!0});},i.n=function(t){var e=t&&t.__esModule?function(){return t.default}:function(){return t};return i.d(e,"a",e),e},i.o=function(t,e){return Object.prototype.hasOwnProperty.call(t,e)},i.p="",i(i.s=148)}([function(t,e,i){i.r(e),function(t){var s=i(93),n=function(){if(!(this instanceof n))throw new Error("constructor needs to be called with the 'new' keyword")};
	/**
	 *  Tone.js
	 *  @author Yotam Mann
	 *  @license http://opensource.org/licenses/MIT MIT License
	 *  @copyright 2014-2019 Yotam Mann
	 */n.prototype.toString=function(){for(var t in n){var e=t[0].match(/^[A-Z]$/),i=n[t]===this.constructor;if(n.isFunction(n[t])&&e&&i)return t}return "Tone"},n.prototype.dispose=function(){return this},n.prototype.set=function(t,e){if(n.isString(t)){var i={};i[t]=e,t=i;}t:for(var s in t){e=t[s];var o=this;if(-1!==s.indexOf(".")){for(var a=s.split("."),r=0;r<a.length-1;r++)if((o=o[a[r]])instanceof n){a.splice(0,r+1);var l=a.join(".");o.set(l,e);continue t}s=a[a.length-1];}var u=o[s];n.isUndef(u)||(n.Signal&&u instanceof n.Signal||n.Param&&u instanceof n.Param?u.value!==e&&(u.value=e):u instanceof AudioParam?u.value!==e&&(u.value=e):n.TimeBase&&u instanceof n.TimeBase?o[s]=e:u instanceof n?u.set(e):u!==e&&(o[s]=e));}return this},n.prototype.get=function(t){n.isUndef(t)?t=this._collectDefaults(this.constructor):n.isString(t)&&(t=[t]);for(var e={},i=0;i<t.length;i++){var s=t[i],o=this,a=e;if(-1!==s.indexOf(".")){for(var r=s.split("."),l=0;l<r.length-1;l++){var u=r[l];a[u]=a[u]||{},a=a[u],o=o[u];}s=r[r.length-1];}var d=o[s];n.isObject(t[s])?a[s]=d.get():n.Signal&&d instanceof n.Signal?a[s]=d.value:n.Param&&d instanceof n.Param?a[s]=d.value:d instanceof AudioParam?a[s]=d.value:d instanceof n?a[s]=d.get():!n.isFunction(d)&&n.isDefined(d)&&(a[s]=d);}return e},n.prototype._collectDefaults=function(t){var e=[];if(n.isDefined(t.defaults)&&(e=Object.keys(t.defaults)),n.isDefined(t._super))for(var i=this._collectDefaults(t._super),s=0;s<i.length;s++)-1===e.indexOf(i[s])&&e.push(i[s]);return e},n.defaults=function(t,e,i){var s={};if(1===t.length&&n.isObject(t[0]))s=t[0];else for(var o=0;o<e.length;o++)s[e[o]]=t[o];return n.isDefined(i.defaults)?n.defaultArg(s,i.defaults):n.isObject(i)?n.defaultArg(s,i):s},n.defaultArg=function(t,e){if(n.isObject(t)&&n.isObject(e)){var i={};for(var s in t)i[s]=n.defaultArg(e[s],t[s]);for(var o in e)i[o]=n.defaultArg(t[o],e[o]);return i}return n.isUndef(t)?e:t},n.prototype.log=function(){if(this.debug||this.toString()===n.global.TONE_DEBUG_CLASS){var t=Array.from(arguments);t.unshift(this.toString()+":"),console.log.apply(void 0,t);}},n.prototype.assert=function(t,e){if(!t)throw new Error(e)},n.connectSeries=function(){for(var t=arguments[0],e=1;e<arguments.length;e++){var i=arguments[e];n.connect(t,i),t=i;}return n},n.connect=function(t,e,i,s){for(;n.isDefined(e.input);)n.isArray(e.input)?(s=n.defaultArg(s,0),e=e.input[s],s=0):e.input&&(e=e.input);return e instanceof AudioParam?t.connect(e,i):e instanceof AudioNode&&t.connect(e,i,s),n},n.disconnect=function(t,e,i,s){if(e){for(var o=!1;!o;)n.isArray(e.input)?(n.isDefined(s)?n.disconnect(t,e.input[s],i):e.input.forEach(function(e){try{n.disconnect(t,e,i);}catch(t){}}),o=!0):e.input?e=e.input:o=!0;e instanceof AudioParam?t.disconnect(e,i):e instanceof AudioNode&&t.disconnect(e,i,s);}else t.disconnect();return n},n.isUndef=function(t){return void 0===t},n.isDefined=function(t){return !n.isUndef(t)},n.isFunction=function(t){return "function"==typeof t},n.isNumber=function(t){return "number"==typeof t},n.isObject=function(t){return "[object Object]"===Object.prototype.toString.call(t)&&t.constructor===Object},n.isBoolean=function(t){return "boolean"==typeof t},n.isArray=function(t){return Array.isArray(t)},n.isString=function(t){return "string"==typeof t},n.isNote=function(t){return n.isString(t)&&/^([a-g]{1}(?:b|#|x|bb)?)(-?[0-9]+)/i.test(t)},n.noOp=function(){},n.prototype._readOnly=function(t){if(Array.isArray(t))for(var e=0;e<t.length;e++)this._readOnly(t[e]);else Object.defineProperty(this,t,{writable:!1,enumerable:!0});},n.prototype._writable=function(t){if(Array.isArray(t))for(var e=0;e<t.length;e++)this._writable(t[e]);else Object.defineProperty(this,t,{writable:!0});},n.State={Started:"started",Stopped:"stopped",Paused:"paused"},n.global=n.isUndef(t)?window:t,n.equalPowerScale=function(t){var e=.5*Math.PI;return Math.sin(t*e)},n.dbToGain=function(t){return Math.pow(10,t/20)},n.gainToDb=function(t){return Math.log(t)/Math.LN10*20},n.intervalToFrequencyRatio=function(t){return Math.pow(2,t/12)},n.prototype.now=function(){return n.context.now()},n.now=function(){return n.context.now()},n.prototype.immediate=function(){return n.context.currentTime},n.immediate=function(){return n.context.currentTime},n.extend=function(t,e){function i(){}n.isUndef(e)&&(e=n),i.prototype=e.prototype,t.prototype=new i,t.prototype.constructor=t,t._super=e;},n._audioContext=null,n.start=function(){return n.context.resume()},Object.defineProperty(n,"context",{get:function(){return n._audioContext},set:function(t){t.isContext?n._audioContext=t:n._audioContext=new n.Context(t),n.Context.emit("init",n._audioContext);}}),Object.defineProperty(n.prototype,"context",{get:function(){return n.context}}),n.setContext=function(t){n.context=t;},Object.defineProperty(n.prototype,"blockTime",{get:function(){return 128/this.context.sampleRate}}),Object.defineProperty(n.prototype,"sampleTime",{get:function(){return 1/this.context.sampleRate}}),Object.defineProperty(n,"supported",{get:function(){var t=n.global.hasOwnProperty("AudioContext")||n.global.hasOwnProperty("webkitAudioContext"),e=n.global.hasOwnProperty("Promise");return t&&e}}),Object.defineProperty(n,"initialized",{get:function(){return Boolean(n.context)}}),n.getContext=function(t){if(n.initialized)t(n.context);else{var e=function(){t(n.context),n.Context.off("init",e);};n.Context.on("init",e);}return n},n.version=s.a,e.default=n;}.call(this,i(147));},function(t,e,i){i.r(e);var s=i(0);i(20);if(s.default.supported){var n=new OfflineAudioContext(2,1,44100),o=n.createGain(),a=n.createGain();if(o.connect(a)!==a){var r=AudioNode.prototype.connect;AudioNode.prototype.connect=function(){return r.apply(this,arguments),arguments[0]};}}s.default.AudioNode=function(){s.default.call(this);var t=s.default.defaults(arguments,["context"],{context:s.default.context});this._context=t.context;},s.default.extend(s.default.AudioNode),Object.defineProperty(s.default.AudioNode.prototype,"context",{get:function(){return this._context}}),s.default.AudioNode.prototype.createInsOuts=function(t,e){1===t?this.input=this.context.createGain():t>1&&(this.input=new Array(t)),1===e?this.output=this.context.createGain():e>1&&(this.output=new Array(e));},Object.defineProperty(s.default.AudioNode.prototype,"channelCount",{get:function(){return this.output.channelCount},set:function(t){return this.output.channelCount=t}}),Object.defineProperty(s.default.AudioNode.prototype,"channelCountMode",{get:function(){return this.output.channelCountMode},set:function(t){return this.output.channelCountMode=t}}),Object.defineProperty(s.default.AudioNode.prototype,"channelInterpretation",{get:function(){return this.output.channelInterpretation},set:function(t){return this.output.channelInterpretation=t}}),Object.defineProperty(s.default.AudioNode.prototype,"numberOfInputs",{get:function(){return this.input?s.default.isArray(this.input)?this.input.length:1:0}}),Object.defineProperty(s.default.AudioNode.prototype,"numberOfOutputs",{get:function(){return this.output?s.default.isArray(this.output)?this.output.length:1:0}}),s.default.AudioNode.prototype.connect=function(t,e,i){return s.default.isArray(this.output)?(e=s.default.defaultArg(e,0),this.output[e].connect(t,0,i)):s.default.connect(this.output,t,e,i),this},s.default.AudioNode.prototype.disconnect=function(t,e,i){return s.default.isArray(this.output)?(e=s.default.defaultArg(e,0),this.output[e].disconnect(t,0,i)):s.default.disconnect(this.output,t,e,i),this},s.default.AudioNode.prototype.chain=function(){var t=Array.from(arguments);return t.unshift(this),s.default.connectSeries.apply(void 0,t),this},s.default.AudioNode.prototype.fan=function(){for(var t=0;t<arguments.length;t++)this.connect(arguments[t]);return this},s.default.AudioNode.prototype.dispose=function(){return s.default.isDefined(this.input)&&(this.input instanceof AudioNode&&this.input.disconnect(),this.input=null),s.default.isDefined(this.output)&&(this.output instanceof AudioNode&&this.output.disconnect(),this.output=null),this._context=null,this};e.default=s.default.AudioNode;},function(t,e,i){i.r(e);var s=i(0);i(4),i(14),i(30),i(44),i(20),i(3);if(s.default.supported&&!s.default.global.AudioContext.prototype.createConstantSource){var n=function(t){this.context=t;for(var e=t.createBuffer(1,128,t.sampleRate),i=e.getChannelData(0),s=0;s<i.length;s++)i[s]=1;this._bufferSource=t.createBufferSource(),this._bufferSource.channelCount=1,this._bufferSource.channelCountMode="explicit",this._bufferSource.buffer=e,this._bufferSource.loop=!0;var n=this._output=t.createGain();this.offset=n.gain,this._bufferSource.connect(n);};n.prototype.start=function(t){return this._bufferSource.start(t),this},n.prototype.stop=function(t){return this._bufferSource.stop(t),this},n.prototype.connect=function(){return this._output.connect.apply(this._output,arguments),this},n.prototype.disconnect=function(){return this._output.disconnect.apply(this._output,arguments),this},AudioContext.prototype.createConstantSource=function(){return new n(this)},s.default.Context.prototype.createConstantSource=function(){return new n(this)};}s.default.Signal=function(){var t=s.default.defaults(arguments,["value","units"],s.default.Signal);s.default.Param.call(this,t),this._constantSource=this.context.createConstantSource(),this._constantSource.start(0),this._param=this._constantSource.offset,this.value=t.value,this.output=this._constantSource,this.input=this._param=this.output.offset;},s.default.extend(s.default.Signal,s.default.Param),s.default.Signal.defaults={value:0,units:s.default.Type.Default,convert:!0},s.default.Signal.prototype.connect=s.default.SignalBase.prototype.connect,s.default.Signal.prototype.disconnect=s.default.SignalBase.prototype.disconnect,s.default.Signal.prototype.getValueAtTime=function(t){return this._param.getValueAtTime?this._param.getValueAtTime(t):s.default.Param.prototype.getValueAtTime.call(this,t)},s.default.Signal.prototype.dispose=function(){return s.default.Param.prototype.dispose.call(this),this._constantSource.stop(),this._constantSource.disconnect(),this._constantSource=null,this};e.default=s.default.Signal;},function(t,e,i){i.r(e);var s=i(0);i(14),i(4),i(1);s.default.Gain=function(){var t=s.default.defaults(arguments,["gain","units"],s.default.Gain);s.default.AudioNode.call(this,t),this.input=this.output=this._gainNode=this.context.createGain(),this.gain=new s.default.Param({param:this._gainNode.gain,units:t.units,value:t.gain,convert:t.convert}),this._readOnly("gain");},s.default.extend(s.default.Gain,s.default.AudioNode),s.default.Gain.defaults={gain:1,convert:!0},s.default.Gain.prototype.dispose=function(){s.default.AudioNode.prototype.dispose.call(this),this._gainNode.disconnect(),this._gainNode=null,this._writable("gain"),this.gain.dispose(),this.gain=null;},e.default=s.default.Gain;},function(t,e,i){i.r(e);var s=i(0);i(63),i(46),i(45),i(20);s.default.Type={Default:"number",Time:"time",Frequency:"frequency",TransportTime:"transportTime",Ticks:"ticks",NormalRange:"normalRange",AudioRange:"audioRange",Decibels:"db",Interval:"interval",BPM:"bpm",Positive:"positive",Gain:"gain",Cents:"cents",Degrees:"degrees",MIDI:"midi",BarsBeatsSixteenths:"barsBeatsSixteenths",Samples:"samples",Hertz:"hertz",Note:"note",Milliseconds:"milliseconds",Seconds:"seconds",Notation:"notation"},s.default.prototype.toSeconds=function(t){return s.default.isNumber(t)?t:s.default.isUndef(t)?this.now():s.default.isString(t)||s.default.isObject(t)?new s.default.Time(t).toSeconds():t instanceof s.default.TimeBase?t.toSeconds():void 0},s.default.prototype.toFrequency=function(t){return s.default.isNumber(t)?t:s.default.isString(t)||s.default.isUndef(t)||s.default.isObject(t)?new s.default.Frequency(t).valueOf():t instanceof s.default.TimeBase?t.toFrequency():void 0},s.default.prototype.toTicks=function(t){return s.default.isNumber(t)||s.default.isString(t)||s.default.isObject(t)?new s.default.TransportTime(t).toTicks():s.default.isUndef(t)?s.default.Transport.ticks:t instanceof s.default.TimeBase?t.toTicks():void 0},e.default=s.default;},function(t,e,i){i.r(e);var s=i(0);i(14),i(3),i(30);s.default.Multiply=function(t){s.default.Signal.call(this),this.createInsOuts(2,0),this._mult=this.input[0]=this.output=new s.default.Gain,this._param=this.input[1]=this.output.gain,this.value=s.default.defaultArg(t,0);},s.default.extend(s.default.Multiply,s.default.Signal),s.default.Multiply.prototype.dispose=function(){return s.default.Signal.prototype.dispose.call(this),this._mult.dispose(),this._mult=null,this._param=null,this},e.default=s.default.Multiply;},function(t,e,i){i.r(e);var s=i(0);i(16),i(27),i(40),i(4),i(34),i(2),i(1);s.default.Source=function(t){t=s.default.defaultArg(t,s.default.Source.defaults),s.default.AudioNode.call(this),this._volume=this.output=new s.default.Volume(t.volume),this.volume=this._volume.volume,this._readOnly("volume"),this._state=new s.default.TimelineState(s.default.State.Stopped),this._state.memory=100,this._synced=!1,this._scheduled=[],this._volume.output.output.channelCount=2,this._volume.output.output.channelCountMode="explicit",this.mute=t.mute;},s.default.extend(s.default.Source,s.default.AudioNode),s.default.Source.defaults={volume:0,mute:!1},Object.defineProperty(s.default.Source.prototype,"state",{get:function(){return this._synced?s.default.Transport.state===s.default.State.Started?this._state.getValueAtTime(s.default.Transport.seconds):s.default.State.Stopped:this._state.getValueAtTime(this.now())}}),Object.defineProperty(s.default.Source.prototype,"mute",{get:function(){return this._volume.mute},set:function(t){this._volume.mute=t;}}),s.default.Source.prototype._start=s.default.noOp,s.default.Source.prototype.restart=s.default.noOp,s.default.Source.prototype._stop=s.default.noOp,s.default.Source.prototype.start=function(t,e,i){if(s.default.isUndef(t)&&this._synced?t=s.default.Transport.seconds:(t=this.toSeconds(t),t=Math.max(t,this.context.currentTime)),this._state.getValueAtTime(t)===s.default.State.Started)this._state.cancel(t),this._state.setStateAtTime(s.default.State.Started,t),this.restart(t,e,i);else if(this._state.setStateAtTime(s.default.State.Started,t),this._synced){var n=this._state.get(t);n.offset=s.default.defaultArg(e,0),n.duration=i;var o=s.default.Transport.schedule(function(t){this._start(t,e,i);}.bind(this),t);this._scheduled.push(o),s.default.Transport.state===s.default.State.Started&&this._syncedStart(this.now(),s.default.Transport.seconds);}else this._start.apply(this,arguments);return this},s.default.Source.prototype.stop=function(t){if(s.default.isUndef(t)&&this._synced?t=s.default.Transport.seconds:(t=this.toSeconds(t),t=Math.max(t,this.context.currentTime)),this._synced){var e=s.default.Transport.schedule(this._stop.bind(this),t);this._scheduled.push(e);}else this._stop.apply(this,arguments);return this._state.cancel(t),this._state.setStateAtTime(s.default.State.Stopped,t),this},s.default.Source.prototype.sync=function(){return this._synced=!0,this._syncedStart=function(t,e){if(e>0){var i=this._state.get(e);if(i&&i.state===s.default.State.Started&&i.time!==e){var n,o=e-this.toSeconds(i.time);i.duration&&(n=this.toSeconds(i.duration)-o),this._start(t,this.toSeconds(i.offset)+o,n);}}}.bind(this),this._syncedStop=function(t){var e=s.default.Transport.getSecondsAtTime(Math.max(t-this.sampleTime,0));this._state.getValueAtTime(e)===s.default.State.Started&&this._stop(t);}.bind(this),s.default.Transport.on("start loopStart",this._syncedStart),s.default.Transport.on("stop pause loopEnd",this._syncedStop),this},s.default.Source.prototype.unsync=function(){this._synced&&(s.default.Transport.off("stop pause loopEnd",this._syncedStop),s.default.Transport.off("start loopStart",this._syncedStart)),this._synced=!1;for(var t=0;t<this._scheduled.length;t++){var e=this._scheduled[t];s.default.Transport.clear(e);}return this._scheduled=[],this._state.cancel(0),this},s.default.Source.prototype.dispose=function(){s.default.AudioNode.prototype.dispose.call(this),this.unsync(),this._scheduled=null,this._writable("volume"),this._volume.dispose(),this._volume=null,this.volume=null,this._state.dispose(),this._state=null;},e.default=s.default.Source;},function(t,e,i){i.r(e);var s=i(0);i(30),i(44);if(s.default.supported&&!s.default.global.AudioContext.prototype._native_createWaveShaper){var n=navigator.userAgent.toLowerCase();if(n.includes("safari")&&!n.includes("chrome")){var o=function(t){for(var e in this._internalNode=this.input=this.output=t._native_createWaveShaper(),this._curve=null,this._internalNode)this._defineProperty(this._internalNode,e);};Object.defineProperty(o.prototype,"curve",{get:function(){return this._curve},set:function(t){this._curve=t;var e=new Float32Array(t.length+1);e.set(t,1),e[0]=t[0],this._internalNode.curve=e;}}),o.prototype._defineProperty=function(t,e){s.default.isUndef(this[e])&&Object.defineProperty(this,e,{get:function(){return "function"==typeof t[e]?t[e].bind(t):t[e]},set:function(i){t[e]=i;}});},s.default.global.AudioContext.prototype._native_createWaveShaper=s.default.global.AudioContext.prototype.createWaveShaper,s.default.global.AudioContext.prototype.createWaveShaper=function(){return new o(this)};}}s.default.WaveShaper=function(t,e){s.default.SignalBase.call(this),this._shaper=this.input=this.output=this.context.createWaveShaper(),this._curve=null,Array.isArray(t)?this.curve=t:isFinite(t)||s.default.isUndef(t)?this._curve=new Float32Array(s.default.defaultArg(t,1024)):s.default.isFunction(t)&&(this._curve=new Float32Array(s.default.defaultArg(e,1024)),this.setMap(t));},s.default.extend(s.default.WaveShaper,s.default.SignalBase),s.default.WaveShaper.prototype.setMap=function(t){for(var e=new Array(this._curve.length),i=0,s=this._curve.length;i<s;i++){var n=i/(s-1)*2-1;e[i]=t(n,i);}return this.curve=e,this},Object.defineProperty(s.default.WaveShaper.prototype,"curve",{get:function(){return this._shaper.curve},set:function(t){this._curve=new Float32Array(t),this._shaper.curve=this._curve;}}),Object.defineProperty(s.default.WaveShaper.prototype,"oversample",{get:function(){return this._shaper.oversample},set:function(t){if(!["none","2x","4x"].includes(t))throw new RangeError("Tone.WaveShaper: oversampling must be either 'none', '2x', or '4x'");this._shaper.oversample=t;}}),s.default.WaveShaper.prototype.dispose=function(){return s.default.SignalBase.prototype.dispose.call(this),this._shaper.disconnect(),this._shaper=null,this._curve=null,this};e.default=s.default.WaveShaper;},function(t,e,i){i.r(e);var s=i(0);i(23),i(1);s.default.Effect=function(){var t=s.default.defaults(arguments,["wet"],s.default.Effect);s.default.AudioNode.call(this),this.createInsOuts(1,1),this._dryWet=new s.default.CrossFade(t.wet),this.wet=this._dryWet.fade,this.effectSend=new s.default.Gain,this.effectReturn=new s.default.Gain,s.default.connect(this.input,this._dryWet.a),s.default.connect(this.input,this.effectSend),this.effectReturn.connect(this._dryWet.b),this._dryWet.connect(this.output),this._readOnly(["wet"]);},s.default.extend(s.default.Effect,s.default.AudioNode),s.default.Effect.defaults={wet:1},s.default.Effect.prototype.connectEffect=function(t){return this.effectSend.chain(t,this.effectReturn),this},s.default.Effect.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._dryWet.dispose(),this._dryWet=null,this.effectSend.dispose(),this.effectSend=null,this.effectReturn.dispose(),this.effectReturn=null,this._writable(["wet"]),this.wet=null,this},e.default=s.default.Effect;},function(t,e,i){i.r(e);var s=i(0);i(2),i(1);s.default.Filter=function(){var t=s.default.defaults(arguments,["frequency","type","rolloff"],s.default.Filter);s.default.AudioNode.call(this),this.createInsOuts(1,1),this._filters=[],this.frequency=new s.default.Signal(t.frequency,s.default.Type.Frequency),this.detune=new s.default.Signal(0,s.default.Type.Cents),this.gain=new s.default.Signal({value:t.gain,convert:!0,type:s.default.Type.Decibels}),this.Q=new s.default.Signal(t.Q),this._type=t.type,this._rolloff=t.rolloff,this.rolloff=t.rolloff,this._readOnly(["detune","frequency","gain","Q"]);},s.default.extend(s.default.Filter,s.default.AudioNode),s.default.Filter.defaults={type:"lowpass",frequency:350,rolloff:-12,Q:1,gain:0},Object.defineProperty(s.default.Filter.prototype,"type",{get:function(){return this._type},set:function(t){if(-1===["lowpass","highpass","bandpass","lowshelf","highshelf","notch","allpass","peaking"].indexOf(t))throw new TypeError("Tone.Filter: invalid type "+t);this._type=t;for(var e=0;e<this._filters.length;e++)this._filters[e].type=t;}}),Object.defineProperty(s.default.Filter.prototype,"rolloff",{get:function(){return this._rolloff},set:function(t){t=parseInt(t,10);var e=[-12,-24,-48,-96].indexOf(t);if(-1===e)throw new RangeError("Tone.Filter: rolloff can only be -12, -24, -48 or -96");e+=1,this._rolloff=t,this.input.disconnect();for(var i=0;i<this._filters.length;i++)this._filters[i].disconnect(),this._filters[i]=null;this._filters=new Array(e);for(var n=0;n<e;n++){var o=this.context.createBiquadFilter();o.type=this._type,this.frequency.connect(o.frequency),this.detune.connect(o.detune),this.Q.connect(o.Q),this.gain.connect(o.gain),this._filters[n]=o;}var a=[this.input].concat(this._filters).concat([this.output]);s.default.connectSeries.apply(s.default,a);}}),s.default.Filter.prototype.getFrequencyResponse=function(t){t=s.default.defaultArg(t,128);for(var e=new Float32Array(t).map(function(){return 1}),i=new Float32Array(t),n=0;n<t;n++){var o=19980*Math.pow(n/t,2)+20;i[n]=o;}var a=new Float32Array(t),r=new Float32Array(t);return this._filters.forEach(function(){var t=this.context.createBiquadFilter();t.type=this._type,t.Q.value=this.Q.value,t.frequency.value=this.frequency.value,t.gain.value=this.gain.value,t.getFrequencyResponse(i,a,r),a.forEach(function(t,i){e[i]*=t;});}.bind(this)),e},s.default.Filter.prototype.dispose=function(){s.default.AudioNode.prototype.dispose.call(this);for(var t=0;t<this._filters.length;t++)this._filters[t].disconnect(),this._filters[t]=null;return this._filters=null,this._writable(["detune","frequency","gain","Q"]),this.frequency.dispose(),this.Q.dispose(),this.frequency=null,this.Q=null,this.detune.dispose(),this.detune=null,this.gain.dispose(),this.gain=null,this},e.default=s.default.Filter;},function(t,e,i){i.r(e);var s=i(0);i(1);s.default.Merge=function(t){t=s.default.defaultArg(t,2),s.default.AudioNode.call(this),this.createInsOuts(t,0),this._merger=this.output=this.context.createChannelMerger(t);for(var e=0;e<t;e++)this.input[e]=new s.default.Gain,this.input[e].connect(this._merger,0,e),this.input[e].channelCount=1,this.input[e].channelCountMode="explicit";this.left=this.input[0],this.right=this.input[1];},s.default.extend(s.default.Merge,s.default.AudioNode),s.default.Merge.prototype.dispose=function(){return this.input.forEach(function(t){t.dispose();}),s.default.AudioNode.prototype.dispose.call(this),this.left=null,this.right=null,this._merger.disconnect(),this._merger=null,this},e.default=s.default.Merge;},function(t,e,i){i.r(e);var s=i(0);i(35),i(4);s.default.supported&&(AudioBuffer.prototype.copyToChannel||(AudioBuffer.prototype.copyToChannel=function(t,e,i){var s=this.getChannelData(e);i=i||0;for(var n=0;n<s.length;n++)s[n+i]=t[n];},AudioBuffer.prototype.copyFromChannel=function(t,e,i){var s=this.getChannelData(e);i=i||0;for(var n=0;n<t.length;n++)t[n]=s[n+i];})),s.default.Buffer=function(){var t=s.default.defaults(arguments,["url","onload","onerror"],s.default.Buffer);s.default.call(this),this._buffer=null,this._reversed=t.reverse,this._xhr=null,this.onload=s.default.noOp,t.url instanceof AudioBuffer||t.url instanceof s.default.Buffer?(this.set(t.url),this.loaded||(this.onload=t.onload)):s.default.isString(t.url)&&this.load(t.url).then(t.onload).catch(t.onerror);},s.default.extend(s.default.Buffer),s.default.Buffer.defaults={url:void 0,reverse:!1,onload:s.default.noOp,onerror:s.default.noOp},s.default.Buffer.prototype.set=function(t){return t instanceof s.default.Buffer?t.loaded?this._buffer=t.get():t.onload=function(){this.set(t),this.onload(this);}.bind(this):this._buffer=t,this._reversed&&this._reverse(),this},s.default.Buffer.prototype.get=function(){return this._buffer},s.default.Buffer.prototype.load=function(t,e,i){return new Promise(function(n,o){this._xhr=s.default.Buffer.load(t,function(t){this._xhr=null,this.set(t),n(this),this.onload(this),e&&e(this);}.bind(this),function(t){this._xhr=null,o(t),i&&i(t);}.bind(this));}.bind(this))},s.default.Buffer.prototype.dispose=function(){return s.default.prototype.dispose.call(this),this._buffer=null,this._xhr&&(s.default.Buffer._removeFromDownloadQueue(this._xhr),this._xhr.abort(),this._xhr=null),this},Object.defineProperty(s.default.Buffer.prototype,"loaded",{get:function(){return this.length>0}}),Object.defineProperty(s.default.Buffer.prototype,"duration",{get:function(){return this._buffer?this._buffer.duration:0}}),Object.defineProperty(s.default.Buffer.prototype,"length",{get:function(){return this._buffer?this._buffer.length:0}}),Object.defineProperty(s.default.Buffer.prototype,"numberOfChannels",{get:function(){return this._buffer?this._buffer.numberOfChannels:0}}),s.default.Buffer.prototype.fromArray=function(t){var e=t[0].length>0,i=e?t.length:1,s=e?t[0].length:t.length,n=this.context.createBuffer(i,s,this.context.sampleRate);e||1!==i||(t=[t]);for(var o=0;o<i;o++)n.copyToChannel(t[o],o);return this._buffer=n,this},s.default.Buffer.prototype.toMono=function(t){if(s.default.isNumber(t))this.fromArray(this.toArray(t));else{for(var e=new Float32Array(this.length),i=this.numberOfChannels,n=0;n<i;n++)for(var o=this.toArray(n),a=0;a<o.length;a++)e[a]+=o[a];e=e.map(function(t){return t/i}),this.fromArray(e);}return this},s.default.Buffer.prototype.toArray=function(t){if(s.default.isNumber(t))return this.getChannelData(t);if(1===this.numberOfChannels)return this.toArray(0);for(var e=[],i=0;i<this.numberOfChannels;i++)e[i]=this.getChannelData(i);return e},s.default.Buffer.prototype.getChannelData=function(t){return this._buffer.getChannelData(t)},s.default.Buffer.prototype.slice=function(t,e){e=s.default.defaultArg(e,this.duration);for(var i=Math.floor(this.context.sampleRate*this.toSeconds(t)),n=Math.floor(this.context.sampleRate*this.toSeconds(e)),o=[],a=0;a<this.numberOfChannels;a++)o[a]=this.toArray(a).slice(i,n);return (new s.default.Buffer).fromArray(o)},s.default.Buffer.prototype._reverse=function(){if(this.loaded)for(var t=0;t<this.numberOfChannels;t++)Array.prototype.reverse.call(this.getChannelData(t));return this},Object.defineProperty(s.default.Buffer.prototype,"reverse",{get:function(){return this._reversed},set:function(t){this._reversed!==t&&(this._reversed=t,this._reverse());}}),s.default.Emitter.mixin(s.default.Buffer),s.default.Buffer._downloadQueue=[],s.default.Buffer.baseUrl="",s.default.Buffer.fromArray=function(t){return (new s.default.Buffer).fromArray(t)},s.default.Buffer.fromUrl=function(t){var e=new s.default.Buffer;return e.load(t).then(function(){return e})},s.default.Buffer._removeFromDownloadQueue=function(t){var e=s.default.Buffer._downloadQueue.indexOf(t);-1!==e&&s.default.Buffer._downloadQueue.splice(e,1);},s.default.Buffer.load=function(t,e,i){e=s.default.defaultArg(e,s.default.noOp);var n=t.match(/\[(.+\|?)+\]$/);if(n){for(var o=n[1].split("|"),a=o[0],r=0;r<o.length;r++)if(s.default.Buffer.supportsType(o[r])){a=o[r];break}t=t.replace(n[0],a);}function l(t){if(s.default.Buffer._removeFromDownloadQueue(d),s.default.Buffer.emit("error",t),!i)throw t;i(t);}function u(){for(var t=0,e=0;e<s.default.Buffer._downloadQueue.length;e++)t+=s.default.Buffer._downloadQueue[e].progress;s.default.Buffer.emit("progress",t/s.default.Buffer._downloadQueue.length);}var d=new XMLHttpRequest;return d.open("GET",s.default.Buffer.baseUrl+t,!0),d.responseType="arraybuffer",d.progress=0,s.default.Buffer._downloadQueue.push(d),d.addEventListener("load",function(){200===d.status?s.default.context.decodeAudioData(d.response).then(function(t){d.progress=1,u(),e(t),s.default.Buffer._removeFromDownloadQueue(d),0===s.default.Buffer._downloadQueue.length&&s.default.Buffer.emit("load");}).catch(function(){s.default.Buffer._removeFromDownloadQueue(d),l("Tone.Buffer: could not decode audio data: "+t);}):l("Tone.Buffer: could not locate file: "+t);}),d.addEventListener("error",l),d.addEventListener("progress",function(t){t.lengthComputable&&(d.progress=t.loaded/t.total*.95,u());}),d.send(),d},s.default.Buffer.cancelDownloads=function(){return s.default.Buffer._downloadQueue.slice().forEach(function(t){s.default.Buffer._removeFromDownloadQueue(t),t.abort();}),s.default.Buffer},s.default.Buffer.supportsType=function(t){var e=t.split(".");return e=e[e.length-1],""!==document.createElement("audio").canPlayType("audio/"+e)},s.default.loaded=function(){var t,e;function i(){s.default.Buffer.off("load",t),s.default.Buffer.off("error",e);}return new Promise(function(i,n){t=function(){i();},e=function(){n();},s.default.Buffer.on("load",t),s.default.Buffer.on("error",e);}).then(i).catch(function(t){throw i(),new Error(t)})};e.default=s.default.Buffer;},function(t,e,i){i.r(e);var s=i(0);i(17),i(26),i(1),i(2),i(22),i(4),i(28);s.default.LFO=function(){var t=s.default.defaults(arguments,["frequency","min","max"],s.default.LFO);s.default.AudioNode.call(this),this._oscillator=new s.default.Oscillator({frequency:t.frequency,type:t.type}),this.frequency=this._oscillator.frequency,this.amplitude=this._oscillator.volume,this.amplitude.units=s.default.Type.NormalRange,this.amplitude.value=t.amplitude,this._stoppedSignal=new s.default.Signal(0,s.default.Type.AudioRange),this._zeros=new s.default.Zero,this._stoppedValue=0,this._a2g=new s.default.AudioToGain,this._scaler=this.output=new s.default.Scale(t.min,t.max),this._units=s.default.Type.Default,this.units=t.units,this._oscillator.chain(this._a2g,this._scaler),this._zeros.connect(this._a2g),this._stoppedSignal.connect(this._a2g),this._readOnly(["amplitude","frequency"]),this.phase=t.phase;},s.default.extend(s.default.LFO,s.default.AudioNode),s.default.LFO.defaults={type:"sine",min:0,max:1,phase:0,frequency:"4n",amplitude:1,units:s.default.Type.Default},s.default.LFO.prototype.start=function(t){return t=this.toSeconds(t),this._stoppedSignal.setValueAtTime(0,t),this._oscillator.start(t),this},s.default.LFO.prototype.stop=function(t){return t=this.toSeconds(t),this._stoppedSignal.setValueAtTime(this._stoppedValue,t),this._oscillator.stop(t),this},s.default.LFO.prototype.sync=function(){return this._oscillator.sync(),this._oscillator.syncFrequency(),this},s.default.LFO.prototype.unsync=function(){return this._oscillator.unsync(),this._oscillator.unsyncFrequency(),this},Object.defineProperty(s.default.LFO.prototype,"min",{get:function(){return this._toUnits(this._scaler.min)},set:function(t){t=this._fromUnits(t),this._scaler.min=t;}}),Object.defineProperty(s.default.LFO.prototype,"max",{get:function(){return this._toUnits(this._scaler.max)},set:function(t){t=this._fromUnits(t),this._scaler.max=t;}}),Object.defineProperty(s.default.LFO.prototype,"type",{get:function(){return this._oscillator.type},set:function(t){this._oscillator.type=t,this._stoppedValue=this._oscillator._getInitialValue(),this._stoppedSignal.value=this._stoppedValue;}}),Object.defineProperty(s.default.LFO.prototype,"phase",{get:function(){return this._oscillator.phase},set:function(t){this._oscillator.phase=t,this._stoppedValue=this._oscillator._getInitialValue(),this._stoppedSignal.value=this._stoppedValue;}}),Object.defineProperty(s.default.LFO.prototype,"units",{get:function(){return this._units},set:function(t){var e=this.min,i=this.max;this._units=t,this.min=e,this.max=i;}}),Object.defineProperty(s.default.LFO.prototype,"state",{get:function(){return this._oscillator.state}}),s.default.LFO.prototype.connect=function(t){return t.constructor!==s.default.Signal&&t.constructor!==s.default.Param||(this.convert=t.convert,this.units=t.units),s.default.SignalBase.prototype.connect.apply(this,arguments),this},s.default.LFO.prototype._fromUnits=s.default.Param.prototype._fromUnits,s.default.LFO.prototype._toUnits=s.default.Param.prototype._toUnits,s.default.LFO.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._writable(["amplitude","frequency"]),this._oscillator.dispose(),this._oscillator=null,this._stoppedSignal.dispose(),this._stoppedSignal=null,this._zeros.dispose(),this._zeros=null,this._scaler.dispose(),this._scaler=null,this._a2g.dispose(),this._a2g=null,this.frequency=null,this.amplitude=null,this},e.default=s.default.LFO;},function(t,e,i){i.r(e);var s=i(0);i(29),i(90),i(2),i(3);s.default.Subtract=function(t){s.default.Signal.call(this),this.createInsOuts(2,0),this._sum=this.input[0]=this.output=new s.default.Gain,this._neg=new s.default.Negate,this._param=this.input[1]=new s.default.Signal(t),this._param.chain(this._neg,this._sum);},s.default.extend(s.default.Subtract,s.default.Signal),s.default.Subtract.prototype.dispose=function(){return s.default.Signal.prototype.dispose.call(this),this._neg.dispose(),this._neg=null,this._sum.disconnect(),this._sum=null,this},e.default=s.default.Subtract;},function(t,e,i){i.r(e);var s=i(0);i(4),i(1),i(24);s.default.Param=function(){var t=s.default.defaults(arguments,["param","units","convert"],s.default.Param);s.default.AudioNode.call(this,t),this._param=this.input=t.param,this.units=t.units,this.convert=t.convert,this.overridden=!1,this._events=new s.default.Timeline(1e3),s.default.isDefined(t.value)&&this._param&&this.setValueAtTime(t.value,0);},s.default.extend(s.default.Param,s.default.AudioNode),s.default.Param.defaults={units:s.default.Type.Default,convert:!0,param:void 0},Object.defineProperty(s.default.Param.prototype,"value",{get:function(){var t=this.now();return this._toUnits(this.getValueAtTime(t))},set:function(t){this._initialValue=this._fromUnits(t),this.cancelScheduledValues(this.now()),this.setValueAtTime(t,this.now());}}),Object.defineProperty(s.default.Param.prototype,"minValue",{get:function(){return this.units===s.default.Type.Time||this.units===s.default.Type.Frequency||this.units===s.default.Type.NormalRange||this.units===s.default.Type.Positive||this.units===s.default.Type.BPM?0:this.units===s.default.Type.AudioRange?-1:this.units===s.default.Type.Decibels?-1/0:this._param.minValue}}),Object.defineProperty(s.default.Param.prototype,"maxValue",{get:function(){return this.units===s.default.Type.NormalRange||this.units===s.default.Type.AudioRange?1:this._param.maxValue}}),s.default.Param.prototype._fromUnits=function(t){if(!this.convert&&!s.default.isUndef(this.convert)||this.overridden)return t;switch(this.units){case s.default.Type.Time:return this.toSeconds(t);case s.default.Type.Frequency:return this.toFrequency(t);case s.default.Type.Decibels:return s.default.dbToGain(t);case s.default.Type.NormalRange:return Math.min(Math.max(t,0),1);case s.default.Type.AudioRange:return Math.min(Math.max(t,-1),1);case s.default.Type.Positive:return Math.max(t,0);default:return t}},s.default.Param.prototype._toUnits=function(t){if(!this.convert&&!s.default.isUndef(this.convert))return t;switch(this.units){case s.default.Type.Decibels:return s.default.gainToDb(t);default:return t}},s.default.Param.prototype._minOutput=1e-5,s.default.Param.AutomationType={Linear:"linearRampToValueAtTime",Exponential:"exponentialRampToValueAtTime",Target:"setTargetAtTime",SetValue:"setValueAtTime",Cancel:"cancelScheduledValues"},s.default.Param.prototype.setValueAtTime=function(t,e){return e=this.toSeconds(e),t=this._fromUnits(t),this._events.add({type:s.default.Param.AutomationType.SetValue,value:t,time:e}),this.log(s.default.Param.AutomationType.SetValue,t,e),this._param.setValueAtTime(t,e),this},s.default.Param.prototype.getValueAtTime=function(t){t=this.toSeconds(t);var e=this._events.getAfter(t),i=this._events.get(t),n=s.default.defaultArg(this._initialValue,this._param.defaultValue),o=n;if(null===i)o=n;else if(i.type===s.default.Param.AutomationType.Target){var a,r=this._events.getBefore(i.time);a=null===r?n:r.value,o=this._exponentialApproach(i.time,a,i.value,i.constant,t);}else o=null===e?i.value:e.type===s.default.Param.AutomationType.Linear?this._linearInterpolate(i.time,i.value,e.time,e.value,t):e.type===s.default.Param.AutomationType.Exponential?this._exponentialInterpolate(i.time,i.value,e.time,e.value,t):i.value;return o},s.default.Param.prototype.setRampPoint=function(t){t=this.toSeconds(t);var e=this.getValueAtTime(t);return this.cancelAndHoldAtTime(t),0===e&&(e=this._minOutput),this.setValueAtTime(this._toUnits(e),t),this},s.default.Param.prototype.linearRampToValueAtTime=function(t,e){return t=this._fromUnits(t),e=this.toSeconds(e),this._events.add({type:s.default.Param.AutomationType.Linear,value:t,time:e}),this.log(s.default.Param.AutomationType.Linear,t,e),this._param.linearRampToValueAtTime(t,e),this},s.default.Param.prototype.exponentialRampToValueAtTime=function(t,e){return t=this._fromUnits(t),t=Math.max(this._minOutput,t),e=this.toSeconds(e),this._events.add({type:s.default.Param.AutomationType.Exponential,time:e,value:t}),this.log(s.default.Param.AutomationType.Exponential,t,e),this._param.exponentialRampToValueAtTime(t,e),this},s.default.Param.prototype.exponentialRampTo=function(t,e,i){return i=this.toSeconds(i),this.setRampPoint(i),this.exponentialRampToValueAtTime(t,i+this.toSeconds(e)),this},s.default.Param.prototype.linearRampTo=function(t,e,i){return i=this.toSeconds(i),this.setRampPoint(i),this.linearRampToValueAtTime(t,i+this.toSeconds(e)),this},s.default.Param.prototype.targetRampTo=function(t,e,i){return i=this.toSeconds(i),this.setRampPoint(i),this.exponentialApproachValueAtTime(t,i,e),this},s.default.Param.prototype.exponentialApproachValueAtTime=function(t,e,i){var s=Math.log(this.toSeconds(i)+1)/Math.log(200);return e=this.toSeconds(e),this.setTargetAtTime(t,e,s),this.cancelAndHoldAtTime(e+.9*i),this.linearRampToValueAtTime(t,e+i),this},s.default.Param.prototype.setTargetAtTime=function(t,e,i){if(t=this._fromUnits(t),i<=0)throw new Error("timeConstant must be greater than 0");return e=this.toSeconds(e),this._events.add({type:s.default.Param.AutomationType.Target,value:t,time:e,constant:i}),this.log(s.default.Param.AutomationType.Target,t,e,i),this._param.setTargetAtTime(t,e,i),this},s.default.Param.prototype.setValueCurveAtTime=function(t,e,i,n){n=s.default.defaultArg(n,1),i=this.toSeconds(i),e=this.toSeconds(e),this.setValueAtTime(t[0]*n,e);for(var o=i/(t.length-1),a=1;a<t.length;a++)this.linearRampToValueAtTime(t[a]*n,e+a*o);return this},s.default.Param.prototype.cancelScheduledValues=function(t){return t=this.toSeconds(t),this._events.cancel(t),this._param.cancelScheduledValues(t),this.log(s.default.Param.AutomationType.Cancel,t),this},s.default.Param.prototype.cancelAndHoldAtTime=function(t){t=this.toSeconds(t);var e=this.getValueAtTime(t);this.log("cancelAndHoldAtTime",t,"value="+e),this._param.cancelScheduledValues(t);var i=this._events.get(t),n=this._events.getAfter(t);return i&&i.time===t?n?this._events.cancel(n.time):this._events.cancel(t+this.sampleTime):n&&(this._events.cancel(n.time),n.type===s.default.Param.AutomationType.Linear?this.linearRampToValueAtTime(e,t):n.type===s.default.Param.AutomationType.Exponential&&this.exponentialRampToValueAtTime(e,t)),this._events.add({type:s.default.Param.AutomationType.SetValue,value:e,time:t}),this._param.setValueAtTime(e,t),this},s.default.Param.prototype.rampTo=function(t,e,i){return e=s.default.defaultArg(e,.1),this.units===s.default.Type.Frequency||this.units===s.default.Type.BPM||this.units===s.default.Type.Decibels?this.exponentialRampTo(t,e,i):this.linearRampTo(t,e,i),this},s.default.Param.prototype._exponentialApproach=function(t,e,i,s,n){return i+(e-i)*Math.exp(-(n-t)/s)},s.default.Param.prototype._linearInterpolate=function(t,e,i,s,n){return e+(n-t)/(i-t)*(s-e)},s.default.Param.prototype._exponentialInterpolate=function(t,e,i,s,n){return e*Math.pow(s/e,(n-t)/(i-t))},s.default.Param.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._param=null,this._events=null,this},e.default=s.default.Param;},function(t,e,i){i.r(e);var s=i(0);i(8),i(19),i(10),i(23);s.default.StereoEffect=function(){s.default.AudioNode.call(this);var t=s.default.defaults(arguments,["wet"],s.default.Effect);this.createInsOuts(1,1),this._dryWet=new s.default.CrossFade(t.wet),this.wet=this._dryWet.fade,this._split=new s.default.Split,this.effectSendL=this._split.left,this.effectSendR=this._split.right,this._merge=new s.default.Merge,this.effectReturnL=this._merge.left,this.effectReturnR=this._merge.right,s.default.connect(this.input,this._split),s.default.connect(this.input,this._dryWet,0,0),this._merge.connect(this._dryWet,0,1),this._dryWet.connect(this.output),this._readOnly(["wet"]);},s.default.extend(s.default.StereoEffect,s.default.Effect),s.default.StereoEffect.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._dryWet.dispose(),this._dryWet=null,this._split.dispose(),this._split=null,this._merge.dispose(),this._merge=null,this.effectSendL=null,this.effectSendR=null,this.effectReturnL=null,this.effectReturnR=null,this._writable(["wet"]),this.wet=null,this},e.default=s.default.StereoEffect;},function(t,e,i){i.r(e);var s=i(0);i(83),i(4),i(24),i(35),i(3),i(81),i(80),i(56);s.default.Transport=function(){s.default.Emitter.call(this),s.default.getContext(function(){this.loop=!1,this._loopStart=0,this._loopEnd=0,this._ppq=n.defaults.PPQ,this._clock=new s.default.Clock({callback:this._processTick.bind(this),frequency:0}),this._bindClockEvents(),this.bpm=this._clock.frequency,this.bpm._toUnits=this._toUnits.bind(this),this.bpm._fromUnits=this._fromUnits.bind(this),this.bpm.units=s.default.Type.BPM,this.bpm.value=n.defaults.bpm,this._readOnly("bpm"),this._timeSignature=n.defaults.timeSignature,this._scheduledEvents={},this._timeline=new s.default.Timeline,this._repeatedEvents=new s.default.IntervalTimeline,this._syncedSignals=[],this._swingTicks=n.defaults.PPQ/2,this._swingAmount=0,this.context.transport=this;}.bind(this));},s.default.extend(s.default.Transport,s.default.Emitter),s.default.Transport.defaults={bpm:120,swing:0,swingSubdivision:"8n",timeSignature:4,loopStart:0,loopEnd:"4m",PPQ:192},s.default.Transport.prototype.isTransport=!0,s.default.Transport.prototype._processTick=function(t,e){if(this._swingAmount>0&&e%this._ppq!=0&&e%(2*this._swingTicks)!=0){var i=e%(2*this._swingTicks)/(2*this._swingTicks),n=Math.sin(i*Math.PI)*this._swingAmount;t+=s.default.Ticks(2*this._swingTicks/3).toSeconds()*n;}this.loop&&e>=this._loopEnd&&(this.emit("loopEnd",t),this._clock.setTicksAtTime(this._loopStart,t),e=this._loopStart,this.emit("loopStart",t,this._clock.getSecondsAtTime(t)),this.emit("loop",t)),this._timeline.forEachAtTime(e,function(e){e.invoke(t);});},s.default.Transport.prototype.schedule=function(t,e){var i=new s.default.TransportEvent(this,{time:s.default.TransportTime(e),callback:t});return this._addEvent(i,this._timeline)},s.default.Transport.prototype.scheduleRepeat=function(t,e,i,n){var o=new s.default.TransportRepeatEvent(this,{callback:t,interval:s.default.Time(e),time:s.default.TransportTime(i),duration:s.default.Time(s.default.defaultArg(n,1/0))});return this._addEvent(o,this._repeatedEvents)},s.default.Transport.prototype.scheduleOnce=function(t,e){var i=new s.default.TransportEvent(this,{time:s.default.TransportTime(e),callback:t,once:!0});return this._addEvent(i,this._timeline)},s.default.Transport.prototype.clear=function(t){if(this._scheduledEvents.hasOwnProperty(t)){var e=this._scheduledEvents[t.toString()];e.timeline.remove(e.event),e.event.dispose(),delete this._scheduledEvents[t.toString()];}return this},s.default.Transport.prototype._addEvent=function(t,e){return this._scheduledEvents[t.id.toString()]={event:t,timeline:e},e.add(t),t.id},s.default.Transport.prototype.cancel=function(t){return t=s.default.defaultArg(t,0),t=this.toTicks(t),this._timeline.forEachFrom(t,function(t){this.clear(t.id);}.bind(this)),this._repeatedEvents.forEachFrom(t,function(t){this.clear(t.id);}.bind(this)),this},s.default.Transport.prototype._bindClockEvents=function(){this._clock.on("start",function(t,e){e=s.default.Ticks(e).toSeconds(),this.emit("start",t,e);}.bind(this)),this._clock.on("stop",function(t){this.emit("stop",t);}.bind(this)),this._clock.on("pause",function(t){this.emit("pause",t);}.bind(this));},Object.defineProperty(s.default.Transport.prototype,"state",{get:function(){return this._clock.getStateAtTime(this.now())}}),s.default.Transport.prototype.start=function(t,e){return s.default.isDefined(e)&&(e=this.toTicks(e)),this._clock.start(t,e),this},s.default.Transport.prototype.stop=function(t){return this._clock.stop(t),this},s.default.Transport.prototype.pause=function(t){return this._clock.pause(t),this},s.default.Transport.prototype.toggle=function(t){return t=this.toSeconds(t),this._clock.getStateAtTime(t)!==s.default.State.Started?this.start(t):this.stop(t),this},Object.defineProperty(s.default.Transport.prototype,"timeSignature",{get:function(){return this._timeSignature},set:function(t){s.default.isArray(t)&&(t=t[0]/t[1]*4),this._timeSignature=t;}}),Object.defineProperty(s.default.Transport.prototype,"loopStart",{get:function(){return s.default.Ticks(this._loopStart).toSeconds()},set:function(t){this._loopStart=this.toTicks(t);}}),Object.defineProperty(s.default.Transport.prototype,"loopEnd",{get:function(){return s.default.Ticks(this._loopEnd).toSeconds()},set:function(t){this._loopEnd=this.toTicks(t);}}),s.default.Transport.prototype.setLoopPoints=function(t,e){return this.loopStart=t,this.loopEnd=e,this},Object.defineProperty(s.default.Transport.prototype,"swing",{get:function(){return this._swingAmount},set:function(t){this._swingAmount=t;}}),Object.defineProperty(s.default.Transport.prototype,"swingSubdivision",{get:function(){return s.default.Ticks(this._swingTicks).toNotation()},set:function(t){this._swingTicks=this.toTicks(t);}}),Object.defineProperty(s.default.Transport.prototype,"position",{get:function(){var t=this.now(),e=this._clock.getTicksAtTime(t);return s.default.Ticks(e).toBarsBeatsSixteenths()},set:function(t){var e=this.toTicks(t);this.ticks=e;}}),Object.defineProperty(s.default.Transport.prototype,"seconds",{get:function(){return this._clock.seconds},set:function(t){var e=this.now(),i=this.bpm.timeToTicks(t,e);this.ticks=i;}}),Object.defineProperty(s.default.Transport.prototype,"progress",{get:function(){if(this.loop){var t=this.now();return (this._clock.getTicksAtTime(t)-this._loopStart)/(this._loopEnd-this._loopStart)}return 0}}),Object.defineProperty(s.default.Transport.prototype,"ticks",{get:function(){return this._clock.ticks},set:function(t){if(this._clock.ticks!==t){var e=this.now();this.state===s.default.State.Started?(this.emit("stop",e),this._clock.setTicksAtTime(t,e),this.emit("start",e,this.seconds)):this._clock.setTicksAtTime(t,e);}}}),s.default.Transport.prototype.getTicksAtTime=function(t){return Math.round(this._clock.getTicksAtTime(t))},s.default.Transport.prototype.getSecondsAtTime=function(t){return this._clock.getSecondsAtTime(t)},Object.defineProperty(s.default.Transport.prototype,"PPQ",{get:function(){return this._ppq},set:function(t){var e=this.bpm.value;this._ppq=t,this.bpm.value=e;}}),s.default.Transport.prototype._fromUnits=function(t){return 1/(60/t/this.PPQ)},s.default.Transport.prototype._toUnits=function(t){return t/this.PPQ*60},s.default.Transport.prototype.nextSubdivision=function(t){if(t=this.toTicks(t),this.state!==s.default.State.Started)return 0;var e=this.now(),i=t-this.getTicksAtTime(e)%t;return this._clock.nextTickTime(i,e)},s.default.Transport.prototype.syncSignal=function(t,e){if(!e){var i=this.now();e=0!==t.getValueAtTime(i)?t.getValueAtTime(i)/this.bpm.getValueAtTime(i):0;}var n=new s.default.Gain(e);return this.bpm.chain(n,t._param),this._syncedSignals.push({ratio:n,signal:t,initial:t.value}),t.value=0,this},s.default.Transport.prototype.unsyncSignal=function(t){for(var e=this._syncedSignals.length-1;e>=0;e--){var i=this._syncedSignals[e];i.signal===t&&(i.ratio.dispose(),i.signal.value=i.initial,this._syncedSignals.splice(e,1));}return this},s.default.Transport.prototype.dispose=function(){return s.default.Emitter.prototype.dispose.call(this),this._clock.dispose(),this._clock=null,this._writable("bpm"),this.bpm=null,this._timeline.dispose(),this._timeline=null,this._repeatedEvents.dispose(),this._repeatedEvents=null,this};var n=s.default.Transport;s.default.Transport=new n,s.default.Context.on("init",function(t){t.transport&&t.transport.isTransport?s.default.Transport=t.transport:s.default.Transport=new n;}),s.default.Context.on("close",function(t){t.transport&&t.transport.isTransport&&t.transport.dispose();}),e.default=s.default.Transport;},function(t,e,i){i.r(e);var s=i(0);i(2),i(6),i(16),i(64);s.default.Oscillator=function(){var t=s.default.defaults(arguments,["frequency","type"],s.default.Oscillator);s.default.Source.call(this,t),this._oscillator=null,this.frequency=new s.default.Signal(t.frequency,s.default.Type.Frequency),this.detune=new s.default.Signal(t.detune,s.default.Type.Cents),this._wave=null,this._partials=t.partials,this._partialCount=t.partialCount,this._phase=t.phase,this._type=t.type,t.partialCount&&t.type!==s.default.Oscillator.Type.Custom&&(this._type=this.baseType+t.partialCount.toString()),this.phase=this._phase,this._readOnly(["frequency","detune"]);},s.default.extend(s.default.Oscillator,s.default.Source),s.default.Oscillator.defaults={type:"sine",frequency:440,detune:0,phase:0,partials:[],partialCount:0},s.default.Oscillator.Type={Sine:"sine",Triangle:"triangle",Sawtooth:"sawtooth",Square:"square",Custom:"custom"},s.default.Oscillator.prototype._start=function(t){this.log("start",t);var e=new s.default.OscillatorNode;this._oscillator=e,this._wave?this._oscillator.setPeriodicWave(this._wave):this._oscillator.type=this._type,this._oscillator.connect(this.output),this.frequency.connect(this._oscillator.frequency),this.detune.connect(this._oscillator.detune),t=this.toSeconds(t),this._oscillator.start(t);},s.default.Oscillator.prototype._stop=function(t){return this.log("stop",t),this._oscillator&&(t=this.toSeconds(t),this._oscillator.stop(t)),this},s.default.Oscillator.prototype.restart=function(t){return this._oscillator&&this._oscillator.cancelStop(),this._state.cancel(this.toSeconds(t)),this},s.default.Oscillator.prototype.syncFrequency=function(){return s.default.Transport.syncSignal(this.frequency),this},s.default.Oscillator.prototype.unsyncFrequency=function(){return s.default.Transport.unsyncSignal(this.frequency),this},Object.defineProperty(s.default.Oscillator.prototype,"type",{get:function(){return this._type},set:function(t){var e=[s.default.Oscillator.Type.Sine,s.default.Oscillator.Type.Square,s.default.Oscillator.Type.Triangle,s.default.Oscillator.Type.Sawtooth].includes(t);if(0===this._phase&&e)this._wave=null,this._partialCount=0,null!==this._oscillator&&(this._oscillator.type=t);else{var i=this._getRealImaginary(t,this._phase),n=this.context.createPeriodicWave(i[0],i[1]);this._wave=n,null!==this._oscillator&&this._oscillator.setPeriodicWave(this._wave);}this._type=t;}}),Object.defineProperty(s.default.Oscillator.prototype,"baseType",{get:function(){return this._type.replace(this.partialCount,"")},set:function(t){this.partialCount&&this._type!==s.default.Oscillator.Type.Custom&&t!==s.default.Oscillator.Type.Custom?this.type=t+this.partialCount:this.type=t;}}),Object.defineProperty(s.default.Oscillator.prototype,"partialCount",{get:function(){return this._partialCount},set:function(t){var e=this._type,i=/^(sine|triangle|square|sawtooth)(\d+)$/.exec(this._type);i&&(e=i[1]),this._type!==s.default.Oscillator.Type.Custom&&(this.type=0===t?e:e+t.toString());}}),s.default.Oscillator.prototype.get=function(){var t=s.default.prototype.get.apply(this,arguments);return t.type!==s.default.Oscillator.Type.Custom&&delete t.partials,t},s.default.Oscillator.prototype._getRealImaginary=function(t,e){var i=2048,n=new Float32Array(i),o=new Float32Array(i),a=1;if(t===s.default.Oscillator.Type.Custom)a=this._partials.length+1,this._partialCount=this._partials.length,i=a;else{var r=/^(sine|triangle|square|sawtooth)(\d+)$/.exec(t);r?(a=parseInt(r[2])+1,this._partialCount=parseInt(r[2]),t=r[1],i=a=Math.max(a,2)):this._partialCount=0,this._partials=[];}for(var l=1;l<i;++l){var u,d=2/(l*Math.PI);switch(t){case s.default.Oscillator.Type.Sine:u=l<=a?1:0,this._partials[l-1]=u;break;case s.default.Oscillator.Type.Square:u=1&l?2*d:0,this._partials[l-1]=u;break;case s.default.Oscillator.Type.Sawtooth:u=d*(1&l?1:-1),this._partials[l-1]=u;break;case s.default.Oscillator.Type.Triangle:u=1&l?d*d*2*(l-1>>1&1?-1:1):0,this._partials[l-1]=u;break;case s.default.Oscillator.Type.Custom:u=this._partials[l-1];break;default:throw new TypeError("Tone.Oscillator: invalid type: "+t)}0!==u?(n[l]=-u*Math.sin(e*l),o[l]=u*Math.cos(e*l)):(n[l]=0,o[l]=0);}return [n,o]},s.default.Oscillator.prototype._inverseFFT=function(t,e,i){for(var s=0,n=t.length,o=0;o<n;o++)s+=t[o]*Math.cos(o*i)+e[o]*Math.sin(o*i);return s},s.default.Oscillator.prototype._getInitialValue=function(){for(var t=this._getRealImaginary(this._type,0),e=t[0],i=t[1],s=0,n=2*Math.PI,o=0;o<8;o++)s=Math.max(this._inverseFFT(e,i,o/8*n),s);return -this._inverseFFT(e,i,this._phase)/s},Object.defineProperty(s.default.Oscillator.prototype,"partials",{get:function(){return this._partials},set:function(t){this._partials=t,this.type=s.default.Oscillator.Type.Custom;}}),Object.defineProperty(s.default.Oscillator.prototype,"phase",{get:function(){return this._phase*(180/Math.PI)},set:function(t){this._phase=t*Math.PI/180,this.type=this._type;}}),s.default.Oscillator.prototype.dispose=function(){return s.default.Source.prototype.dispose.call(this),null!==this._oscillator&&(this._oscillator.dispose(),this._oscillator=null),this._wave=null,this._writable(["frequency","detune"]),this.frequency.dispose(),this.frequency=null,this.detune.dispose(),this.detune=null,this._partials=null,this},e.default=s.default.Oscillator;},function(t,e,i){i.r(e);var s=i(0);i(14),i(1);s.default.Delay=function(){var t=s.default.defaults(arguments,["delayTime","maxDelay"],s.default.Delay);s.default.AudioNode.call(this,t),this._maxDelay=Math.max(this.toSeconds(t.maxDelay),this.toSeconds(t.delayTime)),this._delayNode=this.input=this.output=this.context.createDelay(this._maxDelay),this.delayTime=new s.default.Param({param:this._delayNode.delayTime,units:s.default.Type.Time,value:t.delayTime}),this._readOnly("delayTime");},s.default.extend(s.default.Delay,s.default.AudioNode),s.default.Delay.defaults={maxDelay:1,delayTime:0},Object.defineProperty(s.default.Delay.prototype,"maxDelay",{get:function(){return this._maxDelay}}),s.default.Delay.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._delayNode.disconnect(),this._delayNode=null,this._writable("delayTime"),this.delayTime=null,this},e.default=s.default.Delay;},function(t,e,i){i.r(e);var s=i(0);i(3),i(1);s.default.Split=function(t){t=s.default.defaultArg(t,2),s.default.AudioNode.call(this),this.createInsOuts(0,t),this._splitter=this.input=this.context.createChannelSplitter(t);for(var e=0;e<t;e++)this.output[e]=new s.default.Gain,s.default.connect(this._splitter,this.output[e],e,0),this.output[e].channelCount=1,this.output[e].channelCountMode="explicit";this.left=this.output[0],this.right=this.output[1];},s.default.extend(s.default.Split,s.default.AudioNode),s.default.Split.prototype.dispose=function(){return this.output.forEach(function(t){t.dispose();}),s.default.AudioNode.prototype.dispose.call(this),this._splitter.disconnect(),this.left=null,this.right=null,this._splitter=null,this},e.default=s.default.Split;},function(t,e,i){i.r(e);var s=i(0),n=(i(35),i(24),i(44),["baseLatency","destination","currentTime","sampleRate","listener","state"]),o=["suspend","close","resume","getOutputTimestamp","createMediaElementSource","createMediaStreamSource","createMediaStreamDestination","createBuffer","decodeAudioData","createBufferSource","createConstantSource","createGain","createDelay","createBiquadFilter","createIIRFilter","createWaveShaper","createPanner","createConvolver","createDynamicsCompressor","createAnalyser","createScriptProcessor","createStereoPanner","createOscillator","createPeriodicWave","createChannelSplitter","createChannelMerger","audioWorklet"];s.default.Context=function(){s.default.Emitter.call(this);var t=s.default.defaults(arguments,["context"],s.default.Context);if(!t.context&&(t.context=new s.default.global.AudioContext,!t.context))throw new Error("could not create AudioContext. Possibly too many AudioContexts running already.");for(this._context=t.context;this._context.rawContext;)this._context=this._context.rawContext;n.forEach(function(t){this._defineProperty(this._context,t);}.bind(this)),o.forEach(function(t){this._defineMethod(this._context,t);}.bind(this)),this._latencyHint=t.latencyHint,this._constants={},this.lookAhead=t.lookAhead,this._computedUpdateInterval=0,this._ticker=new a(this.emit.bind(this,"tick"),t.clockSource,t.updateInterval),this._timeouts=new s.default.Timeline,this._timeoutIds=0,this.on("tick",this._timeoutLoop.bind(this)),this._context.onstatechange=function(t){this.emit("statechange",t);}.bind(this);},s.default.extend(s.default.Context,s.default.Emitter),s.default.Emitter.mixin(s.default.Context),s.default.Context.defaults={clockSource:"worker",latencyHint:"interactive",lookAhead:.1,updateInterval:.03},s.default.Context.prototype.isContext=!0,s.default.Context.prototype._defineProperty=function(t,e){s.default.isUndef(this[e])&&Object.defineProperty(this,e,{get:function(){return t[e]},set:function(i){t[e]=i;}});},s.default.Context.prototype._defineMethod=function(t,e){s.default.isUndef(this[e])&&Object.defineProperty(this,e,{get:function(){return t[e].bind(t)}});},s.default.Context.prototype.now=function(){return this._context.currentTime+this.lookAhead},Object.defineProperty(s.default.Context.prototype,"destination",{get:function(){return this.master?this.master:this._context.destination}}),s.default.Context.prototype.resume=function(){return "suspended"===this._context.state&&this._context instanceof AudioContext?this._context.resume():Promise.resolve()},s.default.Context.prototype.close=function(){var t=Promise.resolve();return this!==s.default.global.TONE_AUDIO_CONTEXT&&(t=this.rawContext.close()),t.then(function(){s.default.Context.emit("close",this);}.bind(this))},s.default.Context.prototype.getConstant=function(t){if(this._constants[t])return this._constants[t];for(var e=this._context.createBuffer(1,128,this._context.sampleRate),i=e.getChannelData(0),s=0;s<i.length;s++)i[s]=t;var n=this._context.createBufferSource();return n.channelCount=1,n.channelCountMode="explicit",n.buffer=e,n.loop=!0,n.start(0),this._constants[t]=n,n},s.default.Context.prototype._timeoutLoop=function(){for(var t=this.now();this._timeouts&&this._timeouts.length&&this._timeouts.peek().time<=t;)this._timeouts.shift().callback();},s.default.Context.prototype.setTimeout=function(t,e){this._timeoutIds++;var i=this.now();return this._timeouts.add({callback:t,time:i+e,id:this._timeoutIds}),this._timeoutIds},s.default.Context.prototype.clearTimeout=function(t){return this._timeouts.forEach(function(e){e.id===t&&this.remove(e);}),this},Object.defineProperty(s.default.Context.prototype,"updateInterval",{get:function(){return this._ticker.updateInterval},set:function(t){this._ticker.updateInterval=t;}}),Object.defineProperty(s.default.Context.prototype,"rawContext",{get:function(){return this._context}}),Object.defineProperty(s.default.Context.prototype,"clockSource",{get:function(){return this._ticker.type},set:function(t){this._ticker.type=t;}}),Object.defineProperty(s.default.Context.prototype,"latencyHint",{get:function(){return this._latencyHint},set:function(t){var e=t;if(this._latencyHint=t,s.default.isString(t))switch(t){case"interactive":e=.1,this._context.latencyHint=t;break;case"playback":e=.8,this._context.latencyHint=t;break;case"balanced":e=.25,this._context.latencyHint=t;break;case"fastest":this._context.latencyHint="interactive",e=.01;}this.lookAhead=e,this.updateInterval=e/3;}}),s.default.Context.prototype.dispose=function(){return this.close().then(function(){for(var t in s.default.Emitter.prototype.dispose.call(this),this._ticker.dispose(),this._ticker=null,this._timeouts.dispose(),this._timeouts=null,this._constants)this._constants[t].disconnect();this._constants=null;}.bind(this))};var a=function(t,e,i){this._type=e,this._updateInterval=i,this._callback=s.default.defaultArg(t,s.default.noOp),this._createClock();};if(a.Type={Worker:"worker",Timeout:"timeout",Offline:"offline"},a.prototype._createWorker=function(){s.default.global.URL=s.default.global.URL||s.default.global.webkitURL;var t=new Blob(["var timeoutTime = "+(1e3*this._updateInterval).toFixed(1)+";self.onmessage = function(msg){\ttimeoutTime = parseInt(msg.data);};function tick(){\tsetTimeout(tick, timeoutTime);\tself.postMessage('tick');}tick();"]),e=URL.createObjectURL(t),i=new Worker(e);i.onmessage=this._callback.bind(this),this._worker=i;},a.prototype._createTimeout=function(){this._timeout=setTimeout(function(){this._createTimeout(),this._callback();}.bind(this),1e3*this._updateInterval);},a.prototype._createClock=function(){if(this._type===a.Type.Worker)try{this._createWorker();}catch(t){this._type=a.Type.Timeout,this._createClock();}else this._type===a.Type.Timeout&&this._createTimeout();},Object.defineProperty(a.prototype,"updateInterval",{get:function(){return this._updateInterval},set:function(t){this._updateInterval=Math.max(t,128/44100),this._type===a.Type.Worker&&this._worker.postMessage(Math.max(1e3*t,1));}}),Object.defineProperty(a.prototype,"type",{get:function(){return this._type},set:function(t){this._disposeClock(),this._type=t,this._createClock();}}),a.prototype._disposeClock=function(){this._timeout&&(clearTimeout(this._timeout),this._timeout=null),this._worker&&(this._worker.terminate(),this._worker.onmessage=null,this._worker=null);},a.prototype.dispose=function(){this._disposeClock(),this._callback=null;},s.default.supported&&!s.default.initialized){if(s.default.global.TONE_AUDIO_CONTEXT||(s.default.global.TONE_AUDIO_CONTEXT=new s.default.Context),s.default.context=s.default.global.TONE_AUDIO_CONTEXT,!s.default.global.TONE_SILENCE_LOGGING){var r="v";"dev"===s.default.version&&(r="");var l=" * Tone.js "+r+s.default.version+" * ";console.log("%c"+l,"background: #000; color: #fff");}}else s.default.supported||s.default.global.TONE_SILENCE_LOGGING||console.warn("This browser does not support Tone.js");e.default=s.default.Context;},function(t,e,i){i.r(e);var s=i(0);i(4),i(40);s.default.Instrument=function(t){t=s.default.defaultArg(t,s.default.Instrument.defaults),s.default.AudioNode.call(this),this._volume=this.output=new s.default.Volume(t.volume),this.volume=this._volume.volume,this._readOnly("volume"),this._scheduledEvents=[];},s.default.extend(s.default.Instrument,s.default.AudioNode),s.default.Instrument.defaults={volume:0},s.default.Instrument.prototype.triggerAttack=s.default.noOp,s.default.Instrument.prototype.triggerRelease=s.default.noOp,s.default.Instrument.prototype.sync=function(){return this._syncMethod("triggerAttack",1),this._syncMethod("triggerRelease",0),this},s.default.Instrument.prototype._syncMethod=function(t,e){var i=this["_original_"+t]=this[t];this[t]=function(){var t=Array.prototype.slice.call(arguments),n=t[e],o=s.default.Transport.schedule(function(s){t[e]=s,i.apply(this,t);}.bind(this),n);this._scheduledEvents.push(o);}.bind(this);},s.default.Instrument.prototype.unsync=function(){return this._scheduledEvents.forEach(function(t){s.default.Transport.clear(t);}),this._scheduledEvents=[],this._original_triggerAttack&&(this.triggerAttack=this._original_triggerAttack,this.triggerRelease=this._original_triggerRelease),this},s.default.Instrument.prototype.triggerAttackRelease=function(t,e,i,s){return i=this.toSeconds(i),e=this.toSeconds(e),this.triggerAttack(t,i,s),this.triggerRelease(i+e),this},s.default.Instrument.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._volume.dispose(),this._volume=null,this._writable(["volume"]),this.volume=null,this.unsync(),this._scheduledEvents=null,this},e.default=s.default.Instrument;},function(t,e,i){i.r(e);var s=i(0);i(7),i(2);s.default.AudioToGain=function(){s.default.SignalBase.call(this),this._norm=this.input=this.output=new s.default.WaveShaper(function(t){return (t+1)/2});},s.default.extend(s.default.AudioToGain,s.default.SignalBase),s.default.AudioToGain.prototype.dispose=function(){return s.default.SignalBase.prototype.dispose.call(this),this._norm.dispose(),this._norm=null,this},e.default=s.default.AudioToGain;},function(t,e,i){i.r(e);var s=i(0);i(2),i(13),i(89),i(3),i(1);s.default.CrossFade=function(t){s.default.AudioNode.call(this),this.createInsOuts(2,1),this.a=this.input[0]=new s.default.Gain,this.b=this.input[1]=new s.default.Gain,this.fade=new s.default.Signal(s.default.defaultArg(t,.5),s.default.Type.NormalRange),this._equalPowerA=new s.default.EqualPowerGain,this._equalPowerB=new s.default.EqualPowerGain,this._one=this.context.getConstant(1),this._invert=new s.default.Subtract,this.a.connect(this.output),this.b.connect(this.output),this.fade.chain(this._equalPowerB,this.b.gain),s.default.connect(this._one,this._invert,0,0),this.fade.connect(this._invert,0,1),this._invert.chain(this._equalPowerA,this.a.gain),this._readOnly("fade");},s.default.extend(s.default.CrossFade,s.default.AudioNode),s.default.CrossFade.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._writable("fade"),this._equalPowerA.dispose(),this._equalPowerA=null,this._equalPowerB.dispose(),this._equalPowerB=null,this.fade.dispose(),this.fade=null,this._invert.dispose(),this._invert=null,this._one=null,this.a.dispose(),this.a=null,this.b.dispose(),this.b=null,this},e.default=s.default.CrossFade;},function(t,e,i){i.r(e);var s=i(0);s.default.Timeline=function(){var t=s.default.defaults(arguments,["memory"],s.default.Timeline);s.default.call(this),this._timeline=[],this.memory=t.memory;},s.default.extend(s.default.Timeline),s.default.Timeline.defaults={memory:1/0},Object.defineProperty(s.default.Timeline.prototype,"length",{get:function(){return this._timeline.length}}),s.default.Timeline.prototype.add=function(t){if(s.default.isUndef(t.time))throw new Error("Tone.Timeline: events must have a time attribute");t.time=t.time.valueOf();var e=this._search(t.time);if(this._timeline.splice(e+1,0,t),this.length>this.memory){var i=this.length-this.memory;this._timeline.splice(0,i);}return this},s.default.Timeline.prototype.remove=function(t){var e=this._timeline.indexOf(t);return -1!==e&&this._timeline.splice(e,1),this},s.default.Timeline.prototype.get=function(t,e){e=s.default.defaultArg(e,"time");var i=this._search(t,e);return -1!==i?this._timeline[i]:null},s.default.Timeline.prototype.peek=function(){return this._timeline[0]},s.default.Timeline.prototype.shift=function(){return this._timeline.shift()},s.default.Timeline.prototype.getAfter=function(t,e){e=s.default.defaultArg(e,"time");var i=this._search(t,e);return i+1<this._timeline.length?this._timeline[i+1]:null},s.default.Timeline.prototype.getBefore=function(t,e){e=s.default.defaultArg(e,"time");var i=this._timeline.length;if(i>0&&this._timeline[i-1][e]<t)return this._timeline[i-1];var n=this._search(t,e);return n-1>=0?this._timeline[n-1]:null},s.default.Timeline.prototype.cancel=function(t){if(this._timeline.length>1){var e=this._search(t);if(e>=0)if(this._timeline[e].time===t){for(var i=e;i>=0&&this._timeline[i].time===t;i--)e=i;this._timeline=this._timeline.slice(0,e);}else this._timeline=this._timeline.slice(0,e+1);else this._timeline=[];}else 1===this._timeline.length&&this._timeline[0].time>=t&&(this._timeline=[]);return this},s.default.Timeline.prototype.cancelBefore=function(t){var e=this._search(t);return e>=0&&(this._timeline=this._timeline.slice(e+1)),this},s.default.Timeline.prototype.previousEvent=function(t){var e=this._timeline.indexOf(t);return e>0?this._timeline[e-1]:null},s.default.Timeline.prototype._search=function(t,e){if(0===this._timeline.length)return -1;e=s.default.defaultArg(e,"time");var i=0,n=this._timeline.length,o=n;if(n>0&&this._timeline[n-1][e]<=t)return n-1;for(;i<o;){var a=Math.floor(i+(o-i)/2),r=this._timeline[a],l=this._timeline[a+1];if(r[e]===t){for(var u=a;u<this._timeline.length;u++){this._timeline[u][e]===t&&(a=u);}return a}if(r[e]<t&&l[e]>t)return a;r[e]>t?o=a:i=a+1;}return -1},s.default.Timeline.prototype._iterate=function(t,e,i){e=s.default.defaultArg(e,0),i=s.default.defaultArg(i,this._timeline.length-1),this._timeline.slice(e,i+1).forEach(function(e){t.call(this,e);}.bind(this));},s.default.Timeline.prototype.forEach=function(t){return this._iterate(t),this},s.default.Timeline.prototype.forEachBefore=function(t,e){var i=this._search(t);return -1!==i&&this._iterate(e,0,i),this},s.default.Timeline.prototype.forEachAfter=function(t,e){var i=this._search(t);return this._iterate(e,i+1),this},s.default.Timeline.prototype.forEachBetween=function(t,e,i){var s=this._search(t),n=this._search(e);return -1!==s&&-1!==n?(this._timeline[s].time!==t&&(s+=1),this._timeline[n].time===e&&(n-=1),this._iterate(i,s,n)):-1===s&&this._iterate(i,0,n),this},s.default.Timeline.prototype.forEachFrom=function(t,e){for(var i=this._search(t);i>=0&&this._timeline[i].time>=t;)i--;return this._iterate(e,i+1),this},s.default.Timeline.prototype.forEachAtTime=function(t,e){var i=this._search(t);return -1!==i&&this._iterate(function(i){i.time===t&&e.call(this,i);},0,i),this},s.default.Timeline.prototype.dispose=function(){return s.default.prototype.dispose.call(this),this._timeline=null,this},e.default=s.default.Timeline;},function(t,e,i){i.r(e);var s=i(0);i(21),i(2);s.default.Monophonic=function(t){t=s.default.defaultArg(t,s.default.Monophonic.defaults),s.default.Instrument.call(this,t),this.portamento=t.portamento;},s.default.extend(s.default.Monophonic,s.default.Instrument),s.default.Monophonic.defaults={portamento:0},s.default.Monophonic.prototype.triggerAttack=function(t,e,i){return this.log("triggerAttack",t,e,i),e=this.toSeconds(e),this._triggerEnvelopeAttack(e,i),this.setNote(t,e),this},s.default.Monophonic.prototype.triggerRelease=function(t){return this.log("triggerRelease",t),t=this.toSeconds(t),this._triggerEnvelopeRelease(t),this},s.default.Monophonic.prototype._triggerEnvelopeAttack=function(){},s.default.Monophonic.prototype._triggerEnvelopeRelease=function(){},s.default.Monophonic.prototype.getLevelAtTime=function(t){return t=this.toSeconds(t),this.envelope.getValueAtTime(t)},s.default.Monophonic.prototype.setNote=function(t,e){if(e=this.toSeconds(e),this.portamento>0&&this.getLevelAtTime(e)>.05){var i=this.toSeconds(this.portamento);this.frequency.exponentialRampTo(t,i,e);}else this.frequency.setValueAtTime(t,e);return this},e.default=s.default.Monophonic;},function(t,e,i){i.r(e);var s=i(0);i(29),i(5),i(2);s.default.Scale=function(t,e){s.default.SignalBase.call(this),this._outputMin=s.default.defaultArg(t,0),this._outputMax=s.default.defaultArg(e,1),this._scale=this.input=new s.default.Multiply(1),this._add=this.output=new s.default.Add(0),this._scale.connect(this._add),this._setRange();},s.default.extend(s.default.Scale,s.default.SignalBase),Object.defineProperty(s.default.Scale.prototype,"min",{get:function(){return this._outputMin},set:function(t){this._outputMin=t,this._setRange();}}),Object.defineProperty(s.default.Scale.prototype,"max",{get:function(){return this._outputMax},set:function(t){this._outputMax=t,this._setRange();}}),s.default.Scale.prototype._setRange=function(){this._add.value=this._outputMin,this._scale.value=this._outputMax-this._outputMin;},s.default.Scale.prototype.dispose=function(){return s.default.SignalBase.prototype.dispose.call(this),this._add.dispose(),this._add=null,this._scale.dispose(),this._scale=null,this},e.default=s.default.Scale;},function(t,e,i){i.r(e);var s=i(0);i(2),i(3),i(1);s.default.Volume=function(){var t=s.default.defaults(arguments,["volume"],s.default.Volume);s.default.AudioNode.call(this,t),this.output=this.input=new s.default.Gain(t.volume,s.default.Type.Decibels),this._unmutedVolume=t.volume,this.volume=this.output.gain,this._readOnly("volume"),this.mute=t.mute;},s.default.extend(s.default.Volume,s.default.AudioNode),s.default.Volume.defaults={volume:0,mute:!1},Object.defineProperty(s.default.Volume.prototype,"mute",{get:function(){return this.volume.value===-1/0},set:function(t){!this.mute&&t?(this._unmutedVolume=this.volume.value,this.volume.value=-1/0):this.mute&&!t&&(this.volume.value=this._unmutedVolume);}}),s.default.Volume.prototype.dispose=function(){return this.input.dispose(),s.default.AudioNode.prototype.dispose.call(this),this._writable("volume"),this.volume.dispose(),this.volume=null,this},e.default=s.default.Volume;},function(t,e,i){i.r(e);var s=i(0);i(3),i(30);s.default.Zero=function(){s.default.SignalBase.call(this),this._gain=this.input=this.output=new s.default.Gain,s.default.connect(this.context.getConstant(0),this._gain);},s.default.extend(s.default.Zero,s.default.SignalBase),s.default.Zero.prototype.dispose=function(){return s.default.SignalBase.prototype.dispose.call(this),this._gain.dispose(),this._gain=null,this},e.default=s.default.Zero;},function(t,e,i){i.r(e);var s=i(0);i(2),i(3);s.default.Add=function(t){s.default.Signal.call(this),this.createInsOuts(2,0),this._sum=this.input[0]=this.input[1]=this.output=new s.default.Gain,this._param=this.input[1]=new s.default.Signal(t),this._param.connect(this._sum);},s.default.extend(s.default.Add,s.default.Signal),s.default.Add.prototype.dispose=function(){return s.default.Signal.prototype.dispose.call(this),this._sum.dispose(),this._sum=null,this},e.default=s.default.Add;},function(t,e,i){i.r(e);var s=i(0);i(1);s.default.SignalBase=function(){s.default.AudioNode.call(this);},s.default.extend(s.default.SignalBase,s.default.AudioNode),s.default.SignalBase.prototype.connect=function(t,e,i){return s.default.Signal&&s.default.Signal===t.constructor||s.default.Param&&s.default.Param===t.constructor?(t._param.cancelScheduledValues(0),t._param.setValueAtTime(0,0),t.overridden=!0):t instanceof AudioParam&&(t.cancelScheduledValues(0),t.setValueAtTime(0,0)),s.default.AudioNode.prototype.connect.call(this,t,e,i),this},e.default=s.default.SignalBase;},function(t,e,i){i.r(e);var s=i(0);i(47),i(3);s.default.AmplitudeEnvelope=function(){s.default.Envelope.apply(this,arguments),this.input=this.output=new s.default.Gain,this._sig.connect(this.output.gain);},s.default.extend(s.default.AmplitudeEnvelope,s.default.Envelope),s.default.AmplitudeEnvelope.prototype.dispose=function(){return s.default.Envelope.prototype.dispose.call(this),this},e.default=s.default.AmplitudeEnvelope;},function(t,e,i){i.r(e);var s=i(0);i(11),i(6),i(3),i(1);s.default.BufferSource=function(){var t=s.default.defaults(arguments,["buffer","onload"],s.default.BufferSource);s.default.AudioNode.call(this,t),this.onended=t.onended,this._startTime=-1,this._sourceStarted=!1,this._sourceStopped=!1,this._stopTime=-1,this._gainNode=this.output=new s.default.Gain(0),this._source=this.context.createBufferSource(),s.default.connect(this._source,this._gainNode),this._source.onended=this._onended.bind(this),this._buffer=new s.default.Buffer(t.buffer,t.onload),this.playbackRate=new s.default.Param({param:this._source.playbackRate,units:s.default.Type.Positive,value:t.playbackRate}),this.fadeIn=t.fadeIn,this.fadeOut=t.fadeOut,this.curve=t.curve,this._onendedTimeout=-1,this.loop=t.loop,this.loopStart=t.loopStart,this.loopEnd=t.loopEnd;},s.default.extend(s.default.BufferSource,s.default.AudioNode),s.default.BufferSource.defaults={onended:s.default.noOp,onload:s.default.noOp,loop:!1,loopStart:0,loopEnd:0,fadeIn:0,fadeOut:0,curve:"linear",playbackRate:1},Object.defineProperty(s.default.BufferSource.prototype,"state",{get:function(){return this.getStateAtTime(this.now())}}),s.default.BufferSource.prototype.getStateAtTime=function(t){return t=this.toSeconds(t),-1!==this._startTime&&this._startTime<=t&&(-1===this._stopTime||t<this._stopTime)&&!this._sourceStopped?s.default.State.Started:s.default.State.Stopped},s.default.BufferSource.prototype.start=function(t,e,i,n){this.log("start",t,e,i,n),this.assert(-1===this._startTime,"can only be started once"),this.assert(this.buffer.loaded,"buffer is either not set or not loaded"),this.assert(!this._sourceStopped,"source is already stopped"),t=this.toSeconds(t),e=this.loop?s.default.defaultArg(e,this.loopStart):s.default.defaultArg(e,0),e=this.toSeconds(e),e=Math.max(e,0),n=s.default.defaultArg(n,1);var o=this.toSeconds(this.fadeIn);if(o>0?(this._gainNode.gain.setValueAtTime(0,t),"linear"===this.curve?this._gainNode.gain.linearRampToValueAtTime(n,t+o):this._gainNode.gain.exponentialApproachValueAtTime(n,t,o)):this._gainNode.gain.setValueAtTime(n,t),this._startTime=t,s.default.isDefined(i)){var a=this.toSeconds(i);a=Math.max(a,0),this.stop(t+a);}if(this.loop){var r=this.loopEnd||this.buffer.duration,l=this.loopStart;e>=r&&(e=(e-l)%(r-l)+l);}return this._source.buffer=this.buffer.get(),this._source.loopEnd=this.loopEnd||this.buffer.duration,e<this.buffer.duration&&(this._sourceStarted=!0,this._source.start(t,e)),this},s.default.BufferSource.prototype.stop=function(t){this.log("stop",t),this.assert(this.buffer.loaded,"buffer is either not set or not loaded"),this.assert(!this._sourceStopped,"source is already stopped"),t=this.toSeconds(t),-1!==this._stopTime&&this.cancelStop();var e=this.toSeconds(this.fadeOut);return this._stopTime=t+e,e>0?"linear"===this.curve?this._gainNode.gain.linearRampTo(0,e,t):this._gainNode.gain.targetRampTo(0,e,t):(this._gainNode.gain.cancelAndHoldAtTime(t),this._gainNode.gain.setValueAtTime(0,t)),s.default.context.clearTimeout(this._onendedTimeout),this._onendedTimeout=s.default.context.setTimeout(this._onended.bind(this),this._stopTime-this.now()),this},s.default.BufferSource.prototype.cancelStop=function(){if(-1!==this._startTime&&!this._sourceStopped){var t=this.toSeconds(this.fadeIn);this._gainNode.gain.cancelScheduledValues(this._startTime+t+this.sampleTime),this.context.clearTimeout(this._onendedTimeout),this._stopTime=-1;}return this},s.default.BufferSource.prototype._onended=function(){if(!this._sourceStopped){this._sourceStopped=!0;var t="exponential"===this.curve?2*this.fadeOut:0;this._sourceStarted&&-1!==this._stopTime&&this._source.stop(this._stopTime+t),this.onended(this),setTimeout(function(){this._source&&(this._source.disconnect(),this._gainNode.disconnect());}.bind(this),1e3*t+100);}},Object.defineProperty(s.default.BufferSource.prototype,"loopStart",{get:function(){return this._source.loopStart},set:function(t){this._source.loopStart=this.toSeconds(t);}}),Object.defineProperty(s.default.BufferSource.prototype,"loopEnd",{get:function(){return this._source.loopEnd},set:function(t){this._source.loopEnd=this.toSeconds(t);}}),Object.defineProperty(s.default.BufferSource.prototype,"buffer",{get:function(){return this._buffer},set:function(t){this._buffer.set(t);}}),Object.defineProperty(s.default.BufferSource.prototype,"loop",{get:function(){return this._source.loop},set:function(t){this._source.loop=t,this.cancelStop();}}),s.default.BufferSource.prototype.dispose=function(){return this._wasDisposed||(this._wasDisposed=!0,s.default.AudioNode.prototype.dispose.call(this),this.onended=null,this._source.onended=null,this._source.disconnect(),this._source=null,this._gainNode.dispose(),this._gainNode=null,this._buffer.dispose(),this._buffer=null,this._startTime=-1,this.playbackRate=null,s.default.context.clearTimeout(this._onendedTimeout)),this},e.default=s.default.BufferSource;},function(t,e,i){i.r(e);var s=i(0);i(8),i(2),i(5),i(3);s.default.FeedbackEffect=function(){var t=s.default.defaults(arguments,["feedback"],s.default.FeedbackEffect);s.default.Effect.call(this,t),this._feedbackGain=new s.default.Gain(t.feedback,s.default.Type.NormalRange),this.feedback=this._feedbackGain.gain,this.effectReturn.chain(this._feedbackGain,this.effectSend),this._readOnly(["feedback"]);},s.default.extend(s.default.FeedbackEffect,s.default.Effect),s.default.FeedbackEffect.defaults={feedback:.125},s.default.FeedbackEffect.prototype.dispose=function(){return s.default.Effect.prototype.dispose.call(this),this._writable(["feedback"]),this._feedbackGain.dispose(),this._feedbackGain=null,this.feedback=null,this},e.default=s.default.FeedbackEffect;},function(t,e,i){i.r(e);var s=i(0);i(24),i(4);s.default.TimelineState=function(t){s.default.Timeline.call(this),this._initial=t;},s.default.extend(s.default.TimelineState,s.default.Timeline),s.default.TimelineState.prototype.getValueAtTime=function(t){var e=this.get(t);return null!==e?e.state:this._initial},s.default.TimelineState.prototype.setStateAtTime=function(t,e){return this.add({state:t,time:e}),this},s.default.TimelineState.prototype.getLastState=function(t,e){e=this.toSeconds(e);for(var i=this._search(e);i>=0;i--){var s=this._timeline[i];if(s.state===t)return s}},s.default.TimelineState.prototype.getNextState=function(t,e){e=this.toSeconds(e);var i=this._search(e);if(-1!==i)for(var s=i;s<this._timeline.length;s++){var n=this._timeline[s];if(n.state===t)return n}},e.default=s.default.TimelineState;},function(t,e,i){i.r(e);var s=i(0);s.default.Emitter=function(){s.default.call(this),this._events={};},s.default.extend(s.default.Emitter),s.default.Emitter.prototype.on=function(t,e){for(var i=t.split(/\W+/),s=0;s<i.length;s++){var n=i[s];this._events.hasOwnProperty(n)||(this._events[n]=[]),this._events[n].push(e);}return this},s.default.Emitter.prototype.once=function(t,e){var i=function(){e.apply(this,arguments),this.off(t,i);}.bind(this);return this.on(t,i),this},s.default.Emitter.prototype.off=function(t,e){for(var i=t.split(/\W+/),n=0;n<i.length;n++)if(t=i[n],this._events.hasOwnProperty(t))if(s.default.isUndef(e))this._events[t]=[];else for(var o=this._events[t],a=0;a<o.length;a++)o[a]===e&&o.splice(a,1);return this},s.default.Emitter.prototype.emit=function(t){if(this._events){var e=Array.apply(null,arguments).slice(1);if(this._events.hasOwnProperty(t))for(var i=this._events[t].slice(0),s=0,n=i.length;s<n;s++)i[s].apply(this,e);}return this},s.default.Emitter.mixin=function(t){var e=["on","once","off","emit"];t._events={};for(var i=0;i<e.length;i++){var n=e[i],o=s.default.Emitter.prototype[n];t[n]=o;}return s.default.Emitter},s.default.Emitter.prototype.dispose=function(){return s.default.prototype.dispose.call(this),this._events=null,this},e.default=s.default.Emitter;},function(t,e,i){i.r(e);var s=i(0);i(1),i(44);s.default.supported&&(AnalyserNode.prototype.getFloatTimeDomainData||(AnalyserNode.prototype.getFloatTimeDomainData=function(t){var e=new Uint8Array(t.length);this.getByteTimeDomainData(e);for(var i=0;i<e.length;i++)t[i]=(e[i]-128)/128;})),s.default.Analyser=function(){var t=s.default.defaults(arguments,["type","size"],s.default.Analyser);s.default.AudioNode.call(this),this._analyser=this.input=this.output=this.context.createAnalyser(),this._type=t.type,this._buffer=null,this.size=t.size,this.type=t.type;},s.default.extend(s.default.Analyser,s.default.AudioNode),s.default.Analyser.defaults={size:1024,type:"fft",smoothing:.8},s.default.Analyser.Type={Waveform:"waveform",FFT:"fft"},s.default.Analyser.prototype.getValue=function(){return this._type===s.default.Analyser.Type.FFT?this._analyser.getFloatFrequencyData(this._buffer):this._type===s.default.Analyser.Type.Waveform&&this._analyser.getFloatTimeDomainData(this._buffer),this._buffer},Object.defineProperty(s.default.Analyser.prototype,"size",{get:function(){return this._analyser.frequencyBinCount},set:function(t){this._analyser.fftSize=2*t,this._buffer=new Float32Array(t);}}),Object.defineProperty(s.default.Analyser.prototype,"type",{get:function(){return this._type},set:function(t){if(t!==s.default.Analyser.Type.Waveform&&t!==s.default.Analyser.Type.FFT)throw new TypeError("Tone.Analyser: invalid type: "+t);this._type=t;}}),Object.defineProperty(s.default.Analyser.prototype,"smoothing",{get:function(){return this._analyser.smoothingTimeConstant},set:function(t){this._analyser.smoothingTimeConstant=t;}}),s.default.Analyser.prototype.dispose=function(){s.default.AudioNode.prototype.dispose.call(this),this._analyser.disconnect(),this._analyser=null,this._buffer=null;};e.default=s.default.Analyser;},function(t,e,i){i.r(e);var s=i(0);i(6),i(17),i(50),i(69),i(49),i(68),i(67);s.default.OmniOscillator=function(){var t=s.default.defaults(arguments,["frequency","type"],s.default.OmniOscillator);s.default.Source.call(this,t),this.frequency=new s.default.Signal(t.frequency,s.default.Type.Frequency),this.detune=new s.default.Signal(t.detune,s.default.Type.Cents),this._sourceType=void 0,this._oscillator=null,this.type=t.type,this._readOnly(["frequency","detune"]),this.set(t);},s.default.extend(s.default.OmniOscillator,s.default.Source),s.default.OmniOscillator.defaults={frequency:440,detune:0,type:"sine",phase:0};var n="PulseOscillator",o="PWMOscillator",a="Oscillator",r="FMOscillator",l="AMOscillator",u="FatOscillator";s.default.OmniOscillator.prototype._start=function(t){this._oscillator.start(t);},s.default.OmniOscillator.prototype._stop=function(t){this._oscillator.stop(t);},s.default.OmniOscillator.prototype.restart=function(t){this._oscillator.restart(t);},Object.defineProperty(s.default.OmniOscillator.prototype,"type",{get:function(){var t="";return this._sourceType===r?t="fm":this._sourceType===l?t="am":this._sourceType===u&&(t="fat"),t+this._oscillator.type},set:function(t){"fm"===t.substr(0,2)?(this._createNewOscillator(r),this._oscillator.type=t.substr(2)):"am"===t.substr(0,2)?(this._createNewOscillator(l),this._oscillator.type=t.substr(2)):"fat"===t.substr(0,3)?(this._createNewOscillator(u),this._oscillator.type=t.substr(3)):"pwm"===t?this._createNewOscillator(o):"pulse"===t?this._createNewOscillator(n):(this._createNewOscillator(a),this._oscillator.type=t);}}),Object.defineProperty(s.default.OmniOscillator.prototype,"partials",{get:function(){return this._oscillator.partials},set:function(t){this._oscillator.partials=t;}}),Object.defineProperty(s.default.OmniOscillator.prototype,"partialCount",{get:function(){return this._oscillator.partialCount},set:function(t){this._oscillator.partialCount=t;}}),s.default.OmniOscillator.prototype.set=function(t,e){return "type"===t?this.type=e:s.default.isObject(t)&&t.hasOwnProperty("type")&&(this.type=t.type),s.default.prototype.set.apply(this,arguments),this},s.default.OmniOscillator.prototype.get=function(t){var e=this._oscillator.get(t);return e.type=this.type,e},s.default.OmniOscillator.prototype._createNewOscillator=function(t){if(t!==this._sourceType){this._sourceType=t;var e=s.default[t],i=this.now();if(null!==this._oscillator){var n=this._oscillator;n.stop(i),this.context.setTimeout(function(){n.dispose(),n=null;},this.blockTime);}this._oscillator=new e,this.frequency.connect(this._oscillator.frequency),this.detune.connect(this._oscillator.detune),this._oscillator.connect(this.output),this.state===s.default.State.Started&&this._oscillator.start(i);}},Object.defineProperty(s.default.OmniOscillator.prototype,"phase",{get:function(){return this._oscillator.phase},set:function(t){this._oscillator.phase=t;}});var d={PulseOscillator:"pulse",PWMOscillator:"pwm",Oscillator:"oscillator",FMOscillator:"fm",AMOscillator:"am",FatOscillator:"fat"};Object.defineProperty(s.default.OmniOscillator.prototype,"sourceType",{get:function(){return d[this._sourceType]},set:function(t){var e="sine";"pwm"!==this._oscillator.type&&"pulse"!==this._oscillator.type&&(e=this._oscillator.type),t===d.FMOscillator?this.type="fm"+e:t===d.AMOscillator?this.type="am"+e:t===d.FatOscillator?this.type="fat"+e:t===d.Oscillator?this.type=e:t===d.PulseOscillator?this.type="pulse":t===d.PWMOscillator&&(this.type="pwm");}}),Object.defineProperty(s.default.OmniOscillator.prototype,"baseType",{get:function(){return this._oscillator.baseType},set:function(t){this.sourceType!==d.PulseOscillator&&this.sourceType!==d.PWMOscillator&&(this._oscillator.baseType=t);}}),Object.defineProperty(s.default.OmniOscillator.prototype,"width",{get:function(){return this._sourceType===n?this._oscillator.width:void 0}}),Object.defineProperty(s.default.OmniOscillator.prototype,"count",{get:function(){return this._sourceType===u?this._oscillator.count:void 0},set:function(t){this._sourceType===u&&(this._oscillator.count=t);}}),Object.defineProperty(s.default.OmniOscillator.prototype,"spread",{get:function(){return this._sourceType===u?this._oscillator.spread:void 0},set:function(t){this._sourceType===u&&(this._oscillator.spread=t);}}),Object.defineProperty(s.default.OmniOscillator.prototype,"modulationType",{get:function(){return this._sourceType===r||this._sourceType===l?this._oscillator.modulationType:void 0},set:function(t){this._sourceType!==r&&this._sourceType!==l||(this._oscillator.modulationType=t);}}),Object.defineProperty(s.default.OmniOscillator.prototype,"modulationIndex",{get:function(){return this._sourceType===r?this._oscillator.modulationIndex:void 0}}),Object.defineProperty(s.default.OmniOscillator.prototype,"harmonicity",{get:function(){return this._sourceType===r||this._sourceType===l?this._oscillator.harmonicity:void 0}}),Object.defineProperty(s.default.OmniOscillator.prototype,"modulationFrequency",{get:function(){return this._sourceType===o?this._oscillator.modulationFrequency:void 0}}),s.default.OmniOscillator.prototype.dispose=function(){return s.default.Source.prototype.dispose.call(this),this._writable(["frequency","detune"]),this.detune.dispose(),this.detune=null,this.frequency.dispose(),this.frequency=null,this._oscillator.dispose(),this._oscillator=null,this._sourceType=null,this},e.default=s.default.OmniOscillator;},function(t,e,i){i.r(e);var s=i(0);i(31),i(37),i(25);s.default.Synth=function(t){t=s.default.defaultArg(t,s.default.Synth.defaults),s.default.Monophonic.call(this,t),this.oscillator=new s.default.OmniOscillator(t.oscillator),this.frequency=this.oscillator.frequency,this.detune=this.oscillator.detune,this.envelope=new s.default.AmplitudeEnvelope(t.envelope),this.oscillator.chain(this.envelope,this.output),this._readOnly(["oscillator","frequency","detune","envelope"]);},s.default.extend(s.default.Synth,s.default.Monophonic),s.default.Synth.defaults={oscillator:{type:"triangle"},envelope:{attack:.005,decay:.1,sustain:.3,release:1}},s.default.Synth.prototype._triggerEnvelopeAttack=function(t,e){return this.envelope.triggerAttack(t,e),this.oscillator.start(t),0===this.envelope.sustain&&this.oscillator.stop(t+this.toSeconds(this.envelope.attack)+this.toSeconds(this.envelope.decay)),this},s.default.Synth.prototype._triggerEnvelopeRelease=function(t){return t=this.toSeconds(t),this.envelope.triggerRelease(t),this.oscillator.stop(t+this.toSeconds(this.envelope.release)),this},s.default.Synth.prototype.dispose=function(){return s.default.Monophonic.prototype.dispose.call(this),this._writable(["oscillator","frequency","detune","envelope"]),this.oscillator.dispose(),this.oscillator=null,this.envelope.dispose(),this.envelope=null,this.frequency=null,this.detune=null,this},e.default=s.default.Synth;},function(t,e,i){i.r(e);var s=i(0);i(6),i(11),i(32);s.default.Noise=function(){var t=s.default.defaults(arguments,["type"],s.default.Noise);s.default.Source.call(this,t),this._source=null,this._type=t.type,this._playbackRate=t.playbackRate;},s.default.extend(s.default.Noise,s.default.Source),s.default.Noise.defaults={type:"white",playbackRate:1},Object.defineProperty(s.default.Noise.prototype,"type",{get:function(){return this._type},set:function(t){if(this._type!==t){if(!(t in n))throw new TypeError("Tone.Noise: invalid type: "+t);if(this._type=t,this.state===s.default.State.Started){var e=this.now();this._stop(e),this._start(e);}}}}),Object.defineProperty(s.default.Noise.prototype,"playbackRate",{get:function(){return this._playbackRate},set:function(t){this._playbackRate=t,this._source&&(this._source.playbackRate.value=t);}}),s.default.Noise.prototype._start=function(t){var e=n[this._type];this._source=new s.default.BufferSource(e).connect(this.output),this._source.loop=!0,this._source.playbackRate.value=this._playbackRate,this._source.start(this.toSeconds(t),Math.random()*(e.duration-.001));},s.default.Noise.prototype._stop=function(t){this._source&&(this._source.stop(this.toSeconds(t)),this._source=null);},s.default.Noise.prototype.restart=function(t){return this._stop(t),this._start(t),this},s.default.Noise.prototype.dispose=function(){return s.default.Source.prototype.dispose.call(this),null!==this._source&&(this._source.disconnect(),this._source=null),this._buffer=null,this};var n={},o={};Object.defineProperty(n,"pink",{get:function(){if(!o.pink){for(var t=[],e=0;e<2;e++){var i,n,a,r,l,u,d,f=new Float32Array(220500);t[e]=f,i=n=a=r=l=u=d=0;for(var h=0;h<220500;h++){var c=2*Math.random()-1;i=.99886*i+.0555179*c,n=.99332*n+.0750759*c,a=.969*a+.153852*c,r=.8665*r+.3104856*c,l=.55*l+.5329522*c,u=-.7616*u-.016898*c,f[h]=i+n+a+r+l+u+d+.5362*c,f[h]*=.11,d=.115926*c;}}o.pink=(new s.default.Buffer).fromArray(t);}return o.pink}}),Object.defineProperty(n,"brown",{get:function(){if(!o.brown){for(var t=[],e=0;e<2;e++){var i=new Float32Array(220500);t[e]=i;for(var n=0,a=0;a<220500;a++){var r=2*Math.random()-1;i[a]=(n+.02*r)/1.02,n=i[a],i[a]*=3.5;}}o.brown=(new s.default.Buffer).fromArray(t);}return o.brown}}),Object.defineProperty(n,"white",{get:function(){if(!o.white){for(var t=[],e=0;e<2;e++){var i=new Float32Array(220500);t[e]=i;for(var n=0;n<220500;n++)i[n]=2*Math.random()-1;}o.white=(new s.default.Buffer).fromArray(t);}return o.white}}),e.default=s.default.Noise;},function(t,e,i){i.r(e);var s=i(0);i(27),i(20),i(1);s.default.Master=function(){s.default.AudioNode.call(this),s.default.getContext(function(){this.createInsOuts(1,0),this._volume=this.output=new s.default.Volume,this.volume=this._volume.volume,this._readOnly("volume"),s.default.connectSeries(this.input,this.output,this.context.destination),this.context.master=this;}.bind(this));},s.default.extend(s.default.Master,s.default.AudioNode),s.default.Master.defaults={volume:0,mute:!1},s.default.Master.prototype.isMaster=!0,Object.defineProperty(s.default.Master.prototype,"mute",{get:function(){return this._volume.mute},set:function(t){this._volume.mute=t;}}),s.default.Master.prototype.chain=function(){this.input.disconnect();var t=Array.from(arguments);t.unshift(this.input),t.push(this.output),s.default.connectSeries.apply(void 0,t);},s.default.Master.prototype.dispose=function(){s.default.AudioNode.prototype.dispose.call(this),this._writable("volume"),this._volume.dispose(),this._volume=null,this.volume=null;},s.default.AudioNode.prototype.toMaster=function(){return this.connect(this.context.master),this};var n=s.default.Master;s.default.Master=new n,s.default.Context.on("init",function(t){t.master&&t.master.isMaster?s.default.Master=t.master:s.default.Master=new n;}),s.default.Context.on("close",function(t){t.master&&t.master.isMaster&&t.master.dispose();}),e.default=s.default.Master;},function(t,e,i){i.r(e);var s=i(0);i(86),i(47);s.default.FrequencyEnvelope=function(){var t=s.default.defaults(arguments,["attack","decay","sustain","release"],s.default.Envelope);t=s.default.defaultArg(t,s.default.FrequencyEnvelope.defaults),s.default.ScaledEnvelope.call(this,t),this._octaves=t.octaves,this.baseFrequency=t.baseFrequency,this.octaves=t.octaves,this.exponent=t.exponent;},s.default.extend(s.default.FrequencyEnvelope,s.default.Envelope),s.default.FrequencyEnvelope.defaults={baseFrequency:200,octaves:4,exponent:1},Object.defineProperty(s.default.FrequencyEnvelope.prototype,"baseFrequency",{get:function(){return this._scale.min},set:function(t){this._scale.min=this.toFrequency(t),this.octaves=this._octaves;}}),Object.defineProperty(s.default.FrequencyEnvelope.prototype,"octaves",{get:function(){return this._octaves},set:function(t){this._octaves=t,this._scale.max=this.baseFrequency*Math.pow(2,t);}}),Object.defineProperty(s.default.FrequencyEnvelope.prototype,"exponent",{get:function(){return this._exp.value},set:function(t){this._exp.value=t;}}),s.default.FrequencyEnvelope.prototype.dispose=function(){return s.default.ScaledEnvelope.prototype.dispose.call(this),this},e.default=s.default.FrequencyEnvelope;},function(t,e,i){i.r(e);var s=i(0);i(26),i(61);s.default.ScaleExp=function(t,e,i){s.default.SignalBase.call(this),this._scale=this.output=new s.default.Scale(t,e),this._exp=this.input=new s.default.Pow(s.default.defaultArg(i,2)),this._exp.connect(this._scale);},s.default.extend(s.default.ScaleExp,s.default.SignalBase),Object.defineProperty(s.default.ScaleExp.prototype,"exponent",{get:function(){return this._exp.value},set:function(t){this._exp.value=t;}}),Object.defineProperty(s.default.ScaleExp.prototype,"min",{get:function(){return this._scale.min},set:function(t){this._scale.min=t;}}),Object.defineProperty(s.default.ScaleExp.prototype,"max",{get:function(){return this._scale.max},set:function(t){this._scale.max=t;}}),s.default.ScaleExp.prototype.dispose=function(){return s.default.SignalBase.prototype.dispose.call(this),this._scale.dispose(),this._scale=null,this._exp.dispose(),this._exp=null,this},e.default=s.default.ScaleExp;},function(t,e,i){i.r(e);var s=i(0);i(14),i(1);s.default.Compressor=function(){var t=s.default.defaults(arguments,["threshold","ratio"],s.default.Compressor);s.default.AudioNode.call(this),this._compressor=this.input=this.output=this.context.createDynamicsCompressor(),this.threshold=new s.default.Param({param:this._compressor.threshold,units:s.default.Type.Decibels,convert:!1}),this.attack=new s.default.Param(this._compressor.attack,s.default.Type.Time),this.release=new s.default.Param(this._compressor.release,s.default.Type.Time),this.knee=new s.default.Param({param:this._compressor.knee,units:s.default.Type.Decibels,convert:!1}),this.ratio=new s.default.Param({param:this._compressor.ratio,convert:!1}),this._readOnly(["knee","release","attack","ratio","threshold"]),this.set(t);},s.default.extend(s.default.Compressor,s.default.AudioNode),s.default.Compressor.defaults={ratio:12,threshold:-24,release:.25,attack:.003,knee:30},s.default.Compressor.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._writable(["knee","release","attack","ratio","threshold"]),this._compressor.disconnect(),this._compressor=null,this.attack.dispose(),this.attack=null,this.release.dispose(),this.release=null,this.threshold.dispose(),this.threshold=null,this.ratio.dispose(),this.ratio=null,this.knee.dispose(),this.knee=null,this},e.default=s.default.Compressor;},function(t,e,i){var s=i(0);i(92);if(s.default.supported){!s.default.global.hasOwnProperty("AudioContext")&&s.default.global.hasOwnProperty("webkitAudioContext")&&(s.default.global.AudioContext=s.default.global.webkitAudioContext),AudioContext.prototype.close||(AudioContext.prototype.close=function(){return s.default.isFunction(this.suspend)&&this.suspend(),Promise.resolve()}),AudioContext.prototype.resume||(AudioContext.prototype.resume=function(){var t=this.createBuffer(1,1,this.sampleRate),e=this.createBufferSource();return e.buffer=t,e.connect(this.destination),e.start(0),Promise.resolve()}),!AudioContext.prototype.createGain&&AudioContext.prototype.createGainNode&&(AudioContext.prototype.createGain=AudioContext.prototype.createGainNode),!AudioContext.prototype.createDelay&&AudioContext.prototype.createDelayNode&&(AudioContext.prototype.createDelay=AudioContext.prototype.createDelayNode);var n=!1,o=new OfflineAudioContext(1,1,44100),a=new Uint32Array([1179011410,48,1163280727,544501094,16,131073,44100,176400,1048580,1635017060,8,0,0,0,0]).buffer;try{var r=o.decodeAudioData(a);r&&s.default.isFunction(r.then)&&(n=!0);}catch(t){n=!1;}n||(AudioContext.prototype._native_decodeAudioData=AudioContext.prototype.decodeAudioData,AudioContext.prototype.decodeAudioData=function(t){return new Promise(function(e,i){this._native_decodeAudioData(t,e,i);}.bind(this))});}},function(t,e,i){i.r(e);var s=i(0);i(63);s.default.TransportTime=function(t,e){if(!(this instanceof s.default.TransportTime))return new s.default.TransportTime(t,e);s.default.Time.call(this,t,e);},s.default.extend(s.default.TransportTime,s.default.Time),s.default.TransportTime.prototype._now=function(){return s.default.Transport.seconds},e.default=s.default.TransportTime;},function(t,e,i){i.r(e);var s=i(0);i(62);s.default.Frequency=function(t,e){if(!(this instanceof s.default.Frequency))return new s.default.Frequency(t,e);s.default.TimeBase.call(this,t,e);},s.default.extend(s.default.Frequency,s.default.TimeBase),s.default.Frequency.prototype._expressions=Object.assign({},s.default.TimeBase.prototype._expressions,{midi:{regexp:/^(\d+(?:\.\d+)?midi)/,method:function(t){return "midi"===this._defaultUnits?t:s.default.Frequency.mtof(t)}},note:{regexp:/^([a-g]{1}(?:b|#|x|bb)?)(-?[0-9]+)/i,method:function(t,e){var i=n[t.toLowerCase()]+12*(parseInt(e)+1);return "midi"===this._defaultUnits?i:s.default.Frequency.mtof(i)}},tr:{regexp:/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?):?(\d+(?:\.\d+)?)?/,method:function(t,e,i){var s=1;return t&&"0"!==t&&(s*=this._beatsToUnits(this._getTimeSignature()*parseFloat(t))),e&&"0"!==e&&(s*=this._beatsToUnits(parseFloat(e))),i&&"0"!==i&&(s*=this._beatsToUnits(parseFloat(i)/4)),s}}}),s.default.Frequency.prototype.transpose=function(t){return new this.constructor(this.valueOf()*s.default.intervalToFrequencyRatio(t))},s.default.Frequency.prototype.harmonize=function(t){return t.map(function(t){return this.transpose(t)}.bind(this))},s.default.Frequency.prototype.toMidi=function(){return s.default.Frequency.ftom(this.valueOf())},s.default.Frequency.prototype.toNote=function(){var t=this.toFrequency(),e=Math.log2(t/s.default.Frequency.A4),i=Math.round(12*e)+57,n=Math.floor(i/12);return n<0&&(i+=-12*n),o[i%12]+n.toString()},s.default.Frequency.prototype.toSeconds=function(){return 1/s.default.TimeBase.prototype.toSeconds.call(this)},s.default.Frequency.prototype.toFrequency=function(){return s.default.TimeBase.prototype.toFrequency.call(this)},s.default.Frequency.prototype.toTicks=function(){var t=this._beatsToUnits(1),e=this.valueOf()/t;return Math.floor(e*s.default.Transport.PPQ)},s.default.Frequency.prototype._noArg=function(){return 0},s.default.Frequency.prototype._frequencyToUnits=function(t){return t},s.default.Frequency.prototype._ticksToUnits=function(t){return 1/(60*t/(s.default.Transport.bpm.value*s.default.Transport.PPQ))},s.default.Frequency.prototype._beatsToUnits=function(t){return 1/s.default.TimeBase.prototype._beatsToUnits.call(this,t)},s.default.Frequency.prototype._secondsToUnits=function(t){return 1/t},s.default.Frequency.prototype._defaultUnits="hz";var n={cbb:-2,cb:-1,c:0,"c#":1,cx:2,dbb:0,db:1,d:2,"d#":3,dx:4,ebb:2,eb:3,e:4,"e#":5,ex:6,fbb:3,fb:4,f:5,"f#":6,fx:7,gbb:5,gb:6,g:7,"g#":8,gx:9,abb:7,ab:8,a:9,"a#":10,ax:11,bbb:9,bb:10,b:11,"b#":12,bx:13},o=["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];s.default.Frequency.A4=440,s.default.Frequency.mtof=function(t){return s.default.Frequency.A4*Math.pow(2,(t-69)/12)},s.default.Frequency.ftom=function(t){return 69+Math.round(12*Math.log2(t/s.default.Frequency.A4))},e.default=s.default.Frequency;},function(t,e,i){i.r(e);var s=i(0);i(2),i(61),i(4),i(1);s.default.Envelope=function(){var t=s.default.defaults(arguments,["attack","decay","sustain","release"],s.default.Envelope);s.default.AudioNode.call(this),this.attack=t.attack,this.decay=t.decay,this.sustain=t.sustain,this.release=t.release,this._attackCurve="linear",this._releaseCurve="exponential",this._sig=this.output=new s.default.Signal(0),this.attackCurve=t.attackCurve,this.releaseCurve=t.releaseCurve,this.decayCurve=t.decayCurve;},s.default.extend(s.default.Envelope,s.default.AudioNode),s.default.Envelope.defaults={attack:.01,decay:.1,sustain:.5,release:1,attackCurve:"linear",decayCurve:"exponential",releaseCurve:"exponential"},Object.defineProperty(s.default.Envelope.prototype,"value",{get:function(){return this.getValueAtTime(this.now())}}),s.default.Envelope.prototype._getCurve=function(t,e){if(s.default.isString(t))return t;if(s.default.isArray(t))for(var i in s.default.Envelope.Type)if(s.default.Envelope.Type[i][e]===t)return i},s.default.Envelope.prototype._setCurve=function(t,e,i){if(s.default.Envelope.Type.hasOwnProperty(i)){var n=s.default.Envelope.Type[i];s.default.isObject(n)?this[t]=n[e]:this[t]=n;}else{if(!s.default.isArray(i))throw new Error("Tone.Envelope: invalid curve: "+i);this[t]=i;}},Object.defineProperty(s.default.Envelope.prototype,"attackCurve",{get:function(){return this._getCurve(this._attackCurve,"In")},set:function(t){this._setCurve("_attackCurve","In",t);}}),Object.defineProperty(s.default.Envelope.prototype,"releaseCurve",{get:function(){return this._getCurve(this._releaseCurve,"Out")},set:function(t){this._setCurve("_releaseCurve","Out",t);}}),Object.defineProperty(s.default.Envelope.prototype,"decayCurve",{get:function(){return this._decayCurve},set:function(t){if(!["linear","exponential"].includes(t))throw new Error("Tone.Envelope: invalid curve: "+t);this._decayCurve=t;}}),s.default.Envelope.prototype.triggerAttack=function(t,e){this.log("triggerAttack",t,e),t=this.toSeconds(t);var i=this.toSeconds(this.attack),n=this.toSeconds(this.decay);e=s.default.defaultArg(e,1);var o=this.getValueAtTime(t);o>0&&(i=(1-o)/(1/i));if(0===i)this._sig.setValueAtTime(e,t);else if("linear"===this._attackCurve)this._sig.linearRampTo(e,i,t);else if("exponential"===this._attackCurve)this._sig.targetRampTo(e,i,t);else if(i>0){this._sig.cancelAndHoldAtTime(t);for(var a=this._attackCurve,r=1;r<a.length;r++)if(a[r-1]<=o&&o<=a[r]){(a=this._attackCurve.slice(r))[0]=o;break}this._sig.setValueCurveAtTime(a,t,i,e);}if(n){var l=e*this.sustain,u=t+i;this.log("decay",u),"linear"===this._decayCurve?this._sig.linearRampTo(l,n,u+this.sampleTime):"exponential"===this._decayCurve&&this._sig.exponentialApproachValueAtTime(l,u,n);}return this},s.default.Envelope.prototype.triggerRelease=function(t){this.log("triggerRelease",t),t=this.toSeconds(t);var e=this.getValueAtTime(t);if(e>0){var i=this.toSeconds(this.release);if("linear"===this._releaseCurve)this._sig.linearRampTo(0,i,t);else if("exponential"===this._releaseCurve)this._sig.targetRampTo(0,i,t);else{var n=this._releaseCurve;s.default.isArray(n)&&(this._sig.cancelAndHoldAtTime(t),this._sig.setValueCurveAtTime(n,t,i,e));}}return this},s.default.Envelope.prototype.getValueAtTime=function(t){return this._sig.getValueAtTime(t)},s.default.Envelope.prototype.triggerAttackRelease=function(t,e,i){return e=this.toSeconds(e),this.triggerAttack(e,i),this.triggerRelease(e+this.toSeconds(t)),this},s.default.Envelope.prototype.cancel=function(t){return this._sig.cancelScheduledValues(t),this},s.default.Envelope.prototype.connect=s.default.SignalBase.prototype.connect,function(){var t,e,i=[];for(t=0;t<128;t++)i[t]=Math.sin(t/127*(Math.PI/2));var n=[];for(t=0;t<127;t++){e=t/127;var o=Math.sin(e*(2*Math.PI)*6.4-Math.PI/2)+1;n[t]=o/10+.83*e;}n[127]=1;var a=[];for(t=0;t<128;t++)a[t]=Math.ceil(t/127*5)/5;var r=[];for(t=0;t<128;t++)e=t/127,r[t]=.5*(1-Math.cos(Math.PI*e));var l,u=[];for(t=0;t<128;t++){e=t/127;var d=4*Math.pow(e,3)+.2,f=Math.cos(d*Math.PI*2*e);u[t]=Math.abs(f*(1-e));}function h(t){for(var e=new Array(t.length),i=0;i<t.length;i++)e[i]=1-t[i];return e}s.default.Envelope.Type={linear:"linear",exponential:"exponential",bounce:{In:h(u),Out:u},cosine:{In:i,Out:(l=i,l.slice(0).reverse())},step:{In:a,Out:h(a)},ripple:{In:n,Out:h(n)},sine:{In:r,Out:h(r)}};}(),s.default.Envelope.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._sig.dispose(),this._sig=null,this._attackCurve=null,this._releaseCurve=null,this},e.default=s.default.Envelope;},function(t,e,i){i.r(e);var s=i(0);i(23),i(10),i(19),i(7),i(28),i(3),i(2),i(20);if(s.default.supported&&!s.default.global.AudioContext.prototype.createStereoPanner){var n=function(t){this.context=t,this.pan=new s.default.Signal(0,s.default.Type.AudioRange);var e=new s.default.WaveShaper(function(t){return s.default.equalPowerScale((t+1)/2)},4096),i=new s.default.WaveShaper(function(t){return s.default.equalPowerScale(1-(t+1)/2)},4096),n=new s.default.Gain,o=new s.default.Gain,a=this.input=new s.default.Split;a._splitter.channelCountMode="explicit",(new s.default.Zero).fan(e,i);var r=this.output=new s.default.Merge;a.left.chain(n,r.left),a.right.chain(o,r.right),this.pan.chain(i,n.gain),this.pan.chain(e,o.gain);};n.prototype.disconnect=function(){this.output.disconnect.apply(this.output,arguments);},n.prototype.connect=function(){this.output.connect.apply(this.output,arguments);},AudioContext.prototype.createStereoPanner=function(){return new n(this)},s.default.Context.prototype.createStereoPanner=function(){return new n(this)};}i(22),i(1);s.default.Panner=function(){var t=s.default.defaults(arguments,["pan"],s.default.Panner);s.default.AudioNode.call(this),this._panner=this.input=this.output=this.context.createStereoPanner(),this.pan=this._panner.pan,this.pan.value=t.pan,this._readOnly("pan");},s.default.extend(s.default.Panner,s.default.AudioNode),s.default.Panner.defaults={pan:0},s.default.Panner.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._writable("pan"),this._panner.disconnect(),this._panner=null,this.pan=null,this};e.default=s.default.Panner;},function(t,e,i){i.r(e);var s=i(0);i(6),i(17),i(5),i(3);s.default.FMOscillator=function(){var t=s.default.defaults(arguments,["frequency","type","modulationType"],s.default.FMOscillator);s.default.Source.call(this,t),this._carrier=new s.default.Oscillator(t.frequency,t.type),this.frequency=new s.default.Signal(t.frequency,s.default.Type.Frequency),this.detune=this._carrier.detune,this.detune.value=t.detune,this.modulationIndex=new s.default.Multiply(t.modulationIndex),this.modulationIndex.units=s.default.Type.Positive,this._modulator=new s.default.Oscillator(t.frequency,t.modulationType),this.harmonicity=new s.default.Multiply(t.harmonicity),this.harmonicity.units=s.default.Type.Positive,this._modulationNode=new s.default.Gain(0),this.frequency.connect(this._carrier.frequency),this.frequency.chain(this.harmonicity,this._modulator.frequency),this.frequency.chain(this.modulationIndex,this._modulationNode),this._modulator.connect(this._modulationNode.gain),this._modulationNode.connect(this._carrier.frequency),this._carrier.connect(this.output),this.detune.connect(this._modulator.detune),this.phase=t.phase,this._readOnly(["modulationIndex","frequency","detune","harmonicity"]);},s.default.extend(s.default.FMOscillator,s.default.Source),s.default.FMOscillator.defaults={frequency:440,detune:0,phase:0,type:"sine",modulationIndex:2,modulationType:"square",harmonicity:1},s.default.FMOscillator.prototype._start=function(t){this._modulator.start(t),this._carrier.start(t);},s.default.FMOscillator.prototype._stop=function(t){this._modulator.stop(t),this._carrier.stop(t);},s.default.FMOscillator.prototype.restart=function(t){this._modulator.restart(t),this._carrier.restart(t);},Object.defineProperty(s.default.FMOscillator.prototype,"type",{get:function(){return this._carrier.type},set:function(t){this._carrier.type=t;}}),Object.defineProperty(s.default.FMOscillator.prototype,"baseType",{get:function(){return this._carrier.baseType},set:function(t){this._carrier.baseType=t;}}),Object.defineProperty(s.default.FMOscillator.prototype,"partialCount",{get:function(){return this._carrier.partialCount},set:function(t){this._carrier.partialCount=t;}}),Object.defineProperty(s.default.FMOscillator.prototype,"modulationType",{get:function(){return this._modulator.type},set:function(t){this._modulator.type=t;}}),Object.defineProperty(s.default.FMOscillator.prototype,"phase",{get:function(){return this._carrier.phase},set:function(t){this._carrier.phase=t,this._modulator.phase=t;}}),Object.defineProperty(s.default.FMOscillator.prototype,"partials",{get:function(){return this._carrier.partials},set:function(t){this._carrier.partials=t;}}),s.default.FMOscillator.prototype.dispose=function(){return s.default.Source.prototype.dispose.call(this),this._writable(["modulationIndex","frequency","detune","harmonicity"]),this.frequency.dispose(),this.frequency=null,this.detune=null,this.harmonicity.dispose(),this.harmonicity=null,this._carrier.dispose(),this._carrier=null,this._modulator.dispose(),this._modulator=null,this._modulationNode.dispose(),this._modulationNode=null,this.modulationIndex.dispose(),this.modulationIndex=null,this},e.default=s.default.FMOscillator;},function(t,e,i){i.r(e);var s=i(0);i(6),i(17),i(2),i(7),i(3);s.default.PulseOscillator=function(){var t=s.default.defaults(arguments,["frequency","width"],s.default.Oscillator);s.default.Source.call(this,t),this.width=new s.default.Signal(t.width,s.default.Type.NormalRange),this._widthGate=new s.default.Gain(0),this._sawtooth=new s.default.Oscillator({frequency:t.frequency,detune:t.detune,type:"sawtooth",phase:t.phase}),this.frequency=this._sawtooth.frequency,this.detune=this._sawtooth.detune,this._thresh=new s.default.WaveShaper(function(t){return t<0?-1:1}),this._sawtooth.chain(this._thresh,this.output),this.width.chain(this._widthGate,this._thresh),this._readOnly(["width","frequency","detune"]);},s.default.extend(s.default.PulseOscillator,s.default.Source),s.default.PulseOscillator.defaults={frequency:440,detune:0,phase:0,width:.2},s.default.PulseOscillator.prototype._start=function(t){t=this.toSeconds(t),this._sawtooth.start(t),this._widthGate.gain.setValueAtTime(1,t);},s.default.PulseOscillator.prototype._stop=function(t){t=this.toSeconds(t),this._sawtooth.stop(t),this._widthGate.gain.setValueAtTime(0,t);},s.default.PulseOscillator.prototype.restart=function(t){this._sawtooth.restart(t),this._widthGate.gain.cancelScheduledValues(t),this._widthGate.gain.setValueAtTime(1,t);},Object.defineProperty(s.default.PulseOscillator.prototype,"phase",{get:function(){return this._sawtooth.phase},set:function(t){this._sawtooth.phase=t;}}),Object.defineProperty(s.default.PulseOscillator.prototype,"type",{get:function(){return "pulse"}}),Object.defineProperty(s.default.PulseOscillator.prototype,"baseType",{get:function(){return "pulse"}}),Object.defineProperty(s.default.PulseOscillator.prototype,"partials",{get:function(){return []}}),s.default.PulseOscillator.prototype.dispose=function(){return s.default.Source.prototype.dispose.call(this),this._sawtooth.dispose(),this._sawtooth=null,this._writable(["width","frequency","detune"]),this.width.dispose(),this.width=null,this._widthGate.dispose(),this._widthGate=null,this._thresh.dispose(),this._thresh=null,this.frequency=null,this.detune=null,this},e.default=s.default.PulseOscillator;},function(t,e,i){i.r(e);var s=i(0);i(16),i(4),i(34);s.default.Event=function(){var t=s.default.defaults(arguments,["callback","value"],s.default.Event);s.default.call(this),this._loop=t.loop,this.callback=t.callback,this.value=t.value,this._loopStart=this.toTicks(t.loopStart),this._loopEnd=this.toTicks(t.loopEnd),this._state=new s.default.TimelineState(s.default.State.Stopped),this._playbackRate=1,this._startOffset=0,this._probability=t.probability,this._humanize=t.humanize,this.mute=t.mute,this.playbackRate=t.playbackRate;},s.default.extend(s.default.Event),s.default.Event.defaults={callback:s.default.noOp,loop:!1,loopEnd:"1m",loopStart:0,playbackRate:1,value:null,probability:1,mute:!1,humanize:!1},s.default.Event.prototype._rescheduleEvents=function(t){return t=s.default.defaultArg(t,-1),this._state.forEachFrom(t,function(t){var e;if(t.state===s.default.State.Started){s.default.isDefined(t.id)&&s.default.Transport.clear(t.id);var i=t.time+Math.round(this.startOffset/this._playbackRate);if(!0===this._loop||s.default.isNumber(this._loop)&&this._loop>1){e=1/0,s.default.isNumber(this._loop)&&(e=this._loop*this._getLoopDuration());var n=this._state.getAfter(i);null!==n&&(e=Math.min(e,n.time-i)),e!==1/0&&(this._state.setStateAtTime(s.default.State.Stopped,i+e+1),e=s.default.Ticks(e));var o=s.default.Ticks(this._getLoopDuration());t.id=s.default.Transport.scheduleRepeat(this._tick.bind(this),o,s.default.Ticks(i),e);}else t.id=s.default.Transport.schedule(this._tick.bind(this),s.default.Ticks(i));}}.bind(this)),this},Object.defineProperty(s.default.Event.prototype,"state",{get:function(){return this._state.getValueAtTime(s.default.Transport.ticks)}}),Object.defineProperty(s.default.Event.prototype,"startOffset",{get:function(){return this._startOffset},set:function(t){this._startOffset=t;}}),Object.defineProperty(s.default.Event.prototype,"probability",{get:function(){return this._probability},set:function(t){this._probability=t;}}),Object.defineProperty(s.default.Event.prototype,"humanize",{get:function(){return this._humanize},set:function(t){this._humanize=t;}}),s.default.Event.prototype.start=function(t){return t=this.toTicks(t),this._state.getValueAtTime(t)===s.default.State.Stopped&&(this._state.add({state:s.default.State.Started,time:t,id:void 0}),this._rescheduleEvents(t)),this},s.default.Event.prototype.stop=function(t){if(this.cancel(t),t=this.toTicks(t),this._state.getValueAtTime(t)===s.default.State.Started){this._state.setStateAtTime(s.default.State.Stopped,t);var e=this._state.getBefore(t),i=t;null!==e&&(i=e.time),this._rescheduleEvents(i);}return this},s.default.Event.prototype.cancel=function(t){return t=s.default.defaultArg(t,-1/0),t=this.toTicks(t),this._state.forEachFrom(t,function(t){s.default.Transport.clear(t.id);}),this._state.cancel(t),this},s.default.Event.prototype._tick=function(t){var e=s.default.Transport.getTicksAtTime(t);if(!this.mute&&this._state.getValueAtTime(e)===s.default.State.Started){if(this.probability<1&&Math.random()>this.probability)return;if(this.humanize){var i=.02;s.default.isBoolean(this.humanize)||(i=this.toSeconds(this.humanize)),t+=(2*Math.random()-1)*i;}this.callback(t,this.value);}},s.default.Event.prototype._getLoopDuration=function(){return Math.round((this._loopEnd-this._loopStart)/this._playbackRate)},Object.defineProperty(s.default.Event.prototype,"loop",{get:function(){return this._loop},set:function(t){this._loop=t,this._rescheduleEvents();}}),Object.defineProperty(s.default.Event.prototype,"playbackRate",{get:function(){return this._playbackRate},set:function(t){this._playbackRate=t,this._rescheduleEvents();}}),Object.defineProperty(s.default.Event.prototype,"loopEnd",{get:function(){return s.default.Ticks(this._loopEnd).toSeconds()},set:function(t){this._loopEnd=this.toTicks(t),this._loop&&this._rescheduleEvents();}}),Object.defineProperty(s.default.Event.prototype,"loopStart",{get:function(){return s.default.Ticks(this._loopStart).toSeconds()},set:function(t){this._loopStart=this.toTicks(t),this._loop&&this._rescheduleEvents();}}),Object.defineProperty(s.default.Event.prototype,"progress",{get:function(){if(this._loop){var t=s.default.Transport.ticks,e=this._state.get(t);if(null!==e&&e.state===s.default.State.Started){var i=this._getLoopDuration();return (t-e.time)%i/i}return 0}return 0}}),s.default.Event.prototype.dispose=function(){this.cancel(),this._state.dispose(),this._state=null,this.callback=null,this.value=null;},e.default=s.default.Event;},function(t,e,i){i.r(e);var s=i(0);i(2),i(13),i(29),i(10),i(3),i(1);s.default.MidSideMerge=function(){s.default.AudioNode.call(this),this.createInsOuts(2,0),this.mid=this.input[0]=new s.default.Gain,this._left=new s.default.Add,this._timesTwoLeft=new s.default.Multiply(Math.SQRT1_2),this.side=this.input[1]=new s.default.Gain,this._right=new s.default.Subtract,this._timesTwoRight=new s.default.Multiply(Math.SQRT1_2),this._merge=this.output=new s.default.Merge,this.mid.connect(this._left,0,0),this.side.connect(this._left,0,1),this.mid.connect(this._right,0,0),this.side.connect(this._right,0,1),this._left.connect(this._timesTwoLeft),this._right.connect(this._timesTwoRight),this._timesTwoLeft.connect(this._merge,0,0),this._timesTwoRight.connect(this._merge,0,1);},s.default.extend(s.default.MidSideMerge,s.default.AudioNode),s.default.MidSideMerge.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this.mid.dispose(),this.mid=null,this.side.dispose(),this.side=null,this._left.dispose(),this._left=null,this._timesTwoLeft.dispose(),this._timesTwoLeft=null,this._right.dispose(),this._right=null,this._timesTwoRight.dispose(),this._timesTwoRight=null,this._merge.dispose(),this._merge=null,this},e.default=s.default.MidSideMerge;},function(t,e,i){i.r(e);var s=i(0);i(29),i(13),i(2),i(19),i(1);s.default.MidSideSplit=function(){s.default.AudioNode.call(this),this.createInsOuts(0,2),this._split=this.input=new s.default.Split,this._midAdd=new s.default.Add,this.mid=this.output[0]=new s.default.Multiply(Math.SQRT1_2),this._sideSubtract=new s.default.Subtract,this.side=this.output[1]=new s.default.Multiply(Math.SQRT1_2),this._split.connect(this._midAdd,0,0),this._split.connect(this._midAdd,1,1),this._split.connect(this._sideSubtract,0,0),this._split.connect(this._sideSubtract,1,1),this._midAdd.connect(this.mid),this._sideSubtract.connect(this.side);},s.default.extend(s.default.MidSideSplit,s.default.AudioNode),s.default.MidSideSplit.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this.mid.dispose(),this.mid=null,this.side.dispose(),this.side=null,this._midAdd.dispose(),this._midAdd=null,this._sideSubtract.dispose(),this._sideSubtract=null,this._split.dispose(),this._split=null,this},e.default=s.default.MidSideSplit;},function(t,e,i){i.r(e);var s=i(0);i(2),i(9),i(1),i(59);s.default.LowpassCombFilter=function(){var t=s.default.defaults(arguments,["delayTime","resonance","dampening"],s.default.LowpassCombFilter);s.default.AudioNode.call(this),this._combFilter=this.output=new s.default.FeedbackCombFilter(t.delayTime,t.resonance),this.delayTime=this._combFilter.delayTime,this._lowpass=this.input=new s.default.Filter({frequency:t.dampening,type:"lowpass",Q:0,rolloff:-12}),this.dampening=this._lowpass.frequency,this.resonance=this._combFilter.resonance,this._lowpass.connect(this._combFilter),this._readOnly(["dampening","resonance","delayTime"]);},s.default.extend(s.default.LowpassCombFilter,s.default.AudioNode),s.default.LowpassCombFilter.defaults={delayTime:.1,resonance:.5,dampening:3e3},s.default.LowpassCombFilter.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._writable(["dampening","resonance","delayTime"]),this._combFilter.dispose(),this._combFilter=null,this.resonance=null,this.delayTime=null,this._lowpass.dispose(),this._lowpass=null,this.dampening=null,this},e.default=s.default.LowpassCombFilter;},function(t,e,i){i.r(e);var s=i(0);i(45);s.default.Ticks=function(t,e){if(!(this instanceof s.default.Ticks))return new s.default.Ticks(t,e);s.default.TransportTime.call(this,t,e);},s.default.extend(s.default.Ticks,s.default.TransportTime),s.default.Ticks.prototype._defaultUnits="i",s.default.Ticks.prototype._now=function(){return s.default.Transport.ticks},s.default.Ticks.prototype._beatsToUnits=function(t){return this._getPPQ()*t},s.default.Ticks.prototype._secondsToUnits=function(t){return Math.floor(t/(60/this._getBpm())*this._getPPQ())},s.default.Ticks.prototype._ticksToUnits=function(t){return t},s.default.Ticks.prototype.toTicks=function(){return this.valueOf()},s.default.Ticks.prototype.toSeconds=function(){return this.valueOf()/this._getPPQ()*(60/this._getBpm())},e.default=s.default.Ticks;},function(t,e,i){i.r(e);var s=i(0);i(55);s.default.TransportEvent=function(t,e){e=s.default.defaultArg(e,s.default.TransportEvent.defaults),s.default.call(this),this.Transport=t,this.id=s.default.TransportEvent._eventId++,this.time=s.default.Ticks(e.time),this.callback=e.callback,this._once=e.once;},s.default.extend(s.default.TransportEvent),s.default.TransportEvent.defaults={once:!1,callback:s.default.noOp},s.default.TransportEvent._eventId=0,s.default.TransportEvent.prototype.invoke=function(t){this.callback&&(this.callback(t),this._once&&this.Transport&&this.Transport.clear(this.id));},s.default.TransportEvent.prototype.dispose=function(){return s.default.prototype.dispose.call(this),this.Transport=null,this.callback=null,this.time=null,this},e.default=s.default.TransportEvent;},function(t,e,i){i.r(e);var s=i(0);i(82),i(34),i(24),i(14);s.default.TickSource=function(){var t=s.default.defaults(arguments,["frequency"],s.default.TickSource);this.frequency=new s.default.TickSignal(t.frequency),this._readOnly("frequency"),this._state=new s.default.TimelineState(s.default.State.Stopped),this._state.setStateAtTime(s.default.State.Stopped,0),this._tickOffset=new s.default.Timeline,this.setTicksAtTime(0,0);},s.default.extend(s.default.TickSource),s.default.TickSource.defaults={frequency:1},Object.defineProperty(s.default.TickSource.prototype,"state",{get:function(){return this._state.getValueAtTime(this.now())}}),s.default.TickSource.prototype.start=function(t,e){return t=this.toSeconds(t),this._state.getValueAtTime(t)!==s.default.State.Started&&(this._state.setStateAtTime(s.default.State.Started,t),s.default.isDefined(e)&&this.setTicksAtTime(e,t)),this},s.default.TickSource.prototype.stop=function(t){if(t=this.toSeconds(t),this._state.getValueAtTime(t)===s.default.State.Stopped){var e=this._state.get(t);e.time>0&&(this._tickOffset.cancel(e.time),this._state.cancel(e.time));}return this._state.cancel(t),this._state.setStateAtTime(s.default.State.Stopped,t),this.setTicksAtTime(0,t),this},s.default.TickSource.prototype.pause=function(t){return t=this.toSeconds(t),this._state.getValueAtTime(t)===s.default.State.Started&&this._state.setStateAtTime(s.default.State.Paused,t),this},s.default.TickSource.prototype.cancel=function(t){return t=this.toSeconds(t),this._state.cancel(t),this._tickOffset.cancel(t),this},s.default.TickSource.prototype.getTicksAtTime=function(t){t=this.toSeconds(t);var e=this._state.getLastState(s.default.State.Stopped,t),i={state:s.default.State.Paused,time:t};this._state.add(i);var n=e,o=0;return this._state.forEachBetween(e.time,t+this.sampleTime,function(t){var e=n.time,i=this._tickOffset.get(t.time);i.time>=n.time&&(o=i.ticks,e=i.time),n.state===s.default.State.Started&&t.state!==s.default.State.Started&&(o+=this.frequency.getTicksAtTime(t.time)-this.frequency.getTicksAtTime(e)),n=t;}.bind(this)),this._state.remove(i),o},Object.defineProperty(s.default.TickSource.prototype,"ticks",{get:function(){return this.getTicksAtTime(this.now())},set:function(t){this.setTicksAtTime(t,this.now());}}),Object.defineProperty(s.default.TickSource.prototype,"seconds",{get:function(){return this.getSecondsAtTime(this.now())},set:function(t){var e=this.now(),i=this.frequency.timeToTicks(t,e);this.setTicksAtTime(i,e);}}),s.default.TickSource.prototype.getSecondsAtTime=function(t){t=this.toSeconds(t);var e=this._state.getLastState(s.default.State.Stopped,t),i={state:s.default.State.Paused,time:t};this._state.add(i);var n=e,o=0;return this._state.forEachBetween(e.time,t+this.sampleTime,function(t){var e=n.time,i=this._tickOffset.get(t.time);i.time>=n.time&&(o=i.seconds,e=i.time),n.state===s.default.State.Started&&t.state!==s.default.State.Started&&(o+=t.time-e),n=t;}.bind(this)),this._state.remove(i),o},s.default.TickSource.prototype.setTicksAtTime=function(t,e){return e=this.toSeconds(e),this._tickOffset.cancel(e),this._tickOffset.add({time:e,ticks:t,seconds:this.frequency.getDurationOfTicks(t,e)}),this},s.default.TickSource.prototype.getStateAtTime=function(t){return t=this.toSeconds(t),this._state.getValueAtTime(t)},s.default.TickSource.prototype.getTimeOfTick=function(t,e){e=s.default.defaultArg(e,this.now());var i=this._tickOffset.get(e),n=this._state.get(e),o=Math.max(i.time,n.time),a=this.frequency.getTicksAtTime(o)+t-i.ticks;return this.frequency.getTimeOfTick(a)},s.default.TickSource.prototype.forEachTickBetween=function(t,e,i){var n=this._state.get(t);if(this._state.forEachBetween(t,e,function(e){n.state===s.default.State.Started&&e.state!==s.default.State.Started&&this.forEachTickBetween(Math.max(n.time,t),e.time-this.sampleTime,i),n=e;}.bind(this)),t=Math.max(n.time,t),n.state===s.default.State.Started&&this._state){var o=this.frequency.getTicksAtTime(t),a=(o-this.frequency.getTicksAtTime(n.time))%1;0!==a&&(a=1-a);for(var r=this.frequency.getTimeOfTick(o+a),l=null;r<e&&this._state;){try{i(r,Math.round(this.getTicksAtTime(r)));}catch(t){l=t;break}this._state&&(r+=this.frequency.getDurationOfTicks(1,r));}}if(l)throw l;return this},s.default.TickSource.prototype.dispose=function(){return s.default.Param.prototype.dispose.call(this),this._state.dispose(),this._state=null,this._tickOffset.dispose(),this._tickOffset=null,this._writable("frequency"),this.frequency.dispose(),this.frequency=null,this},e.default=s.default.TickSource;},function(t,e,i){i.r(e);var s=i(0);i(87),i(13),i(2),i(4),i(18),i(1);s.default.Follower=function(){var t=s.default.defaults(arguments,["smoothing"],s.default.Follower);s.default.AudioNode.call(this),this.createInsOuts(1,1),this._abs=new s.default.Abs,this._filter=this.context.createBiquadFilter(),this._filter.type="lowpass",this._filter.frequency.value=0,this._filter.Q.value=0,this._sub=new s.default.Subtract,this._delay=new s.default.Delay(this.blockTime),this._smoothing=t.smoothing,s.default.connect(this.input,this._delay),s.default.connect(this.input,this._sub,0,1),this._sub.chain(this._abs,this._filter,this.output),this.smoothing=t.smoothing;},s.default.extend(s.default.Follower,s.default.AudioNode),s.default.Follower.defaults={smoothing:.05},Object.defineProperty(s.default.Follower.prototype,"smoothing",{get:function(){return this._smoothing},set:function(t){this._smoothing=t,this._filter.frequency.value=.5*s.default.Time(t).toFrequency();}}),s.default.Follower.prototype.connect=s.default.SignalBase.prototype.connect,s.default.Follower.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._filter.disconnect(),this._filter=null,this._delay.dispose(),this._delay=null,this._sub.disconnect(),this._sub=null,this._abs.dispose(),this._abs=null,this},e.default=s.default.Follower;},function(t,e,i){i.r(e);var s=i(0);i(42),i(2),i(14),i(18),i(3),i(1);s.default.FeedbackCombFilter=function(){var t=s.default.defaults(arguments,["delayTime","resonance"],s.default.FeedbackCombFilter);s.default.AudioNode.call(this),this._delay=this.input=this.output=new s.default.Delay(t.delayTime),this.delayTime=this._delay.delayTime,this._feedback=new s.default.Gain(t.resonance,s.default.Type.NormalRange),this.resonance=this._feedback.gain,this._delay.chain(this._feedback,this._delay),this._readOnly(["resonance","delayTime"]);},s.default.extend(s.default.FeedbackCombFilter,s.default.AudioNode),s.default.FeedbackCombFilter.defaults={delayTime:.1,resonance:.5},s.default.FeedbackCombFilter.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._writable(["resonance","delayTime"]),this._delay.dispose(),this._delay=null,this.delayTime=null,this._feedback.dispose(),this._feedback=null,this.resonance=null,this},e.default=s.default.FeedbackCombFilter;},function(t,e,i){i.r(e);var s=i(0);i(9),i(2),i(3),i(1);s.default.MultibandSplit=function(){var t=s.default.defaults(arguments,["lowFrequency","highFrequency"],s.default.MultibandSplit);s.default.AudioNode.call(this),this.input=new s.default.Gain,this.output=new Array(3),this.low=this.output[0]=new s.default.Filter(0,"lowpass"),this._lowMidFilter=new s.default.Filter(0,"highpass"),this.mid=this.output[1]=new s.default.Filter(0,"lowpass"),this.high=this.output[2]=new s.default.Filter(0,"highpass"),this.lowFrequency=new s.default.Signal(t.lowFrequency,s.default.Type.Frequency),this.highFrequency=new s.default.Signal(t.highFrequency,s.default.Type.Frequency),this.Q=new s.default.Signal(t.Q),this.input.fan(this.low,this.high),this.input.chain(this._lowMidFilter,this.mid),this.lowFrequency.connect(this.low.frequency),this.lowFrequency.connect(this._lowMidFilter.frequency),this.highFrequency.connect(this.mid.frequency),this.highFrequency.connect(this.high.frequency),this.Q.connect(this.low.Q),this.Q.connect(this._lowMidFilter.Q),this.Q.connect(this.mid.Q),this.Q.connect(this.high.Q),this._readOnly(["high","mid","low","highFrequency","lowFrequency"]);},s.default.extend(s.default.MultibandSplit,s.default.AudioNode),s.default.MultibandSplit.defaults={lowFrequency:400,highFrequency:2500,Q:1},s.default.MultibandSplit.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._writable(["high","mid","low","highFrequency","lowFrequency"]),this.low.dispose(),this.low=null,this._lowMidFilter.dispose(),this._lowMidFilter=null,this.mid.dispose(),this.mid=null,this.high.dispose(),this.high=null,this.lowFrequency.dispose(),this.lowFrequency=null,this.highFrequency.dispose(),this.highFrequency=null,this.Q.dispose(),this.Q=null,this},e.default=s.default.MultibandSplit;},function(t,e,i){i.r(e);var s=i(0);i(7);s.default.Pow=function(t){s.default.SignalBase.call(this),this._exp=s.default.defaultArg(t,1),this._expScaler=this.input=this.output=new s.default.WaveShaper(this._expFunc(this._exp),8192);},s.default.extend(s.default.Pow,s.default.SignalBase),Object.defineProperty(s.default.Pow.prototype,"value",{get:function(){return this._exp},set:function(t){this._exp=t,this._expScaler.setMap(this._expFunc(this._exp));}}),s.default.Pow.prototype._expFunc=function(t){return function(e){return Math.pow(Math.abs(e),t)}},s.default.Pow.prototype.dispose=function(){return s.default.SignalBase.prototype.dispose.call(this),this._expScaler.dispose(),this._expScaler=null,this},e.default=s.default.Pow;},function(t,e,i){i.r(e);var s=i(0);s.default.TimeBase=function(t,e){if(!(this instanceof s.default.TimeBase))return new s.default.TimeBase(t,e);if(this._val=t,this._units=e,s.default.isUndef(this._units)&&s.default.isString(this._val)&&parseFloat(this._val)==this._val&&"+"!==this._val.charAt(0))this._val=parseFloat(this._val),this._units=this._defaultUnits;else if(t&&t.constructor===this.constructor)this._val=t._val,this._units=t._units;else if(t instanceof s.default.TimeBase)switch(this._defaultUnits){case"s":this._val=t.toSeconds();break;case"i":this._val=t.toTicks();break;case"hz":this._val=t.toFrequency();break;case"midi":this._val=t.toMidi();break;default:throw new Error("Unrecognized default units "+this._defaultUnits)}},s.default.extend(s.default.TimeBase),s.default.TimeBase.prototype._expressions={n:{regexp:/^(\d+)n(\.?)$/i,method:function(t,e){t=parseInt(t);var i="."===e?1.5:1;return 1===t?this._beatsToUnits(this._getTimeSignature())*i:this._beatsToUnits(4/t)*i}},t:{regexp:/^(\d+)t$/i,method:function(t){return t=parseInt(t),this._beatsToUnits(8/(3*parseInt(t)))}},m:{regexp:/^(\d+)m$/i,method:function(t){return this._beatsToUnits(parseInt(t)*this._getTimeSignature())}},i:{regexp:/^(\d+)i$/i,method:function(t){return this._ticksToUnits(parseInt(t))}},hz:{regexp:/^(\d+(?:\.\d+)?)hz$/i,method:function(t){return this._frequencyToUnits(parseFloat(t))}},tr:{regexp:/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?):?(\d+(?:\.\d+)?)?$/,method:function(t,e,i){var s=0;return t&&"0"!==t&&(s+=this._beatsToUnits(this._getTimeSignature()*parseFloat(t))),e&&"0"!==e&&(s+=this._beatsToUnits(parseFloat(e))),i&&"0"!==i&&(s+=this._beatsToUnits(parseFloat(i)/4)),s}},s:{regexp:/^(\d+(?:\.\d+)?)s$/,method:function(t){return this._secondsToUnits(parseFloat(t))}},samples:{regexp:/^(\d+)samples$/,method:function(t){return parseInt(t)/this.context.sampleRate}},default:{regexp:/^(\d+(?:\.\d+)?)$/,method:function(t){return this._expressions[this._defaultUnits].method.call(this,t)}}},s.default.TimeBase.prototype._defaultUnits="s",s.default.TimeBase.prototype._getBpm=function(){return s.default.Transport?s.default.Transport.bpm.value:120},s.default.TimeBase.prototype._getTimeSignature=function(){return s.default.Transport?s.default.Transport.timeSignature:4},s.default.TimeBase.prototype._getPPQ=function(){return s.default.Transport?s.default.Transport.PPQ:192},s.default.TimeBase.prototype._now=function(){return this.now()},s.default.TimeBase.prototype._frequencyToUnits=function(t){return 1/t},s.default.TimeBase.prototype._beatsToUnits=function(t){return 60/this._getBpm()*t},s.default.TimeBase.prototype._secondsToUnits=function(t){return t},s.default.TimeBase.prototype._ticksToUnits=function(t){return t*(this._beatsToUnits(1)/this._getPPQ())},s.default.TimeBase.prototype._noArg=function(){return this._now()},s.default.TimeBase.prototype.valueOf=function(){if(s.default.isUndef(this._val))return this._noArg();if(s.default.isString(this._val)&&s.default.isUndef(this._units)){for(var t in this._expressions)if(this._expressions[t].regexp.test(this._val.trim())){this._units=t;break}}else if(s.default.isObject(this._val)){var e=0;for(var i in this._val){var n=this._val[i];e+=new this.constructor(i).valueOf()*n;}return e}if(s.default.isDefined(this._units)){var o=this._expressions[this._units],a=this._val.toString().trim().match(o.regexp);return a?o.method.apply(this,a.slice(1)):o.method.call(this,parseFloat(this._val))}return this._val},s.default.TimeBase.prototype.toSeconds=function(){return this.valueOf()},s.default.TimeBase.prototype.toFrequency=function(){return 1/this.toSeconds()},s.default.TimeBase.prototype.toSamples=function(){return this.toSeconds()*this.context.sampleRate},s.default.TimeBase.prototype.toMilliseconds=function(){return 1e3*this.toSeconds()},s.default.TimeBase.prototype.dispose=function(){this._val=null,this._units=null;},e.default=s.default.TimeBase;},function(t,e,i){i.r(e);var s=i(0);i(62),i(46);s.default.Time=function(t,e){if(!(this instanceof s.default.Time))return new s.default.Time(t,e);s.default.TimeBase.call(this,t,e);},s.default.extend(s.default.Time,s.default.TimeBase),s.default.Time.prototype._expressions=Object.assign({},s.default.TimeBase.prototype._expressions,{quantize:{regexp:/^@(.+)/,method:function(t){if(s.default.Transport){var e=new this.constructor(t);return this._secondsToUnits(s.default.Transport.nextSubdivision(e))}return 0}},now:{regexp:/^\+(.+)/,method:function(t){return this._now()+new this.constructor(t)}}}),s.default.Time.prototype.quantize=function(t,e){e=s.default.defaultArg(e,1);var i=new this.constructor(t),n=this.valueOf();return n+(Math.round(n/i)*i-n)*e},s.default.Time.prototype.toNotation=function(){for(var t=this.toSeconds(),e=["1m"],i=1;i<8;i++){var n=Math.pow(2,i);e.push(n+"n."),e.push(n+"n"),e.push(n+"t");}e.push("0");var o=e[0],a=s.default.Time(e[0]).toSeconds();return e.forEach(function(e){var i=s.default.Time(e).toSeconds();Math.abs(i-t)<Math.abs(a-t)&&(o=e,a=i);}),o},s.default.Time.prototype.toBarsBeatsSixteenths=function(){var t=this._beatsToUnits(1),e=this.valueOf()/t;e=parseFloat(e.toFixed(4));var i=Math.floor(e/this._getTimeSignature()),s=e%1*4;return e=Math.floor(e)%this._getTimeSignature(),(s=s.toString()).length>3&&(s=parseFloat(parseFloat(s).toFixed(3))),[i,e,s].join(":")},s.default.Time.prototype.toTicks=function(){var t=this._beatsToUnits(1),e=this.valueOf()/t;return Math.round(e*this._getPPQ())},s.default.Time.prototype.toSeconds=function(){return this.valueOf()},s.default.Time.prototype.toMidi=function(){return s.default.Frequency.ftom(this.toFrequency())},e.default=s.default.Time;},function(t,e,i){i.r(e);var s=i(0);i(11),i(6),i(3),i(1);s.default.supported&&(OscillatorNode.prototype.setPeriodicWave||(OscillatorNode.prototype.setPeriodicWave=OscillatorNode.prototype.setWaveTable),AudioContext.prototype.createPeriodicWave||(AudioContext.prototype.createPeriodicWave=AudioContext.prototype.createWaveTable)),s.default.OscillatorNode=function(){var t=s.default.defaults(arguments,["frequency","type"],s.default.OscillatorNode);s.default.AudioNode.call(this,t),this.onended=t.onended,this._startTime=-1,this._stopTime=-1,this._gainNode=this.output=new s.default.Gain(0),this._oscillator=this.context.createOscillator(),s.default.connect(this._oscillator,this._gainNode),this.type=t.type,this.frequency=new s.default.Param({param:this._oscillator.frequency,units:s.default.Type.Frequency,value:t.frequency}),this.detune=new s.default.Param({param:this._oscillator.detune,units:s.default.Type.Cents,value:t.detune}),this._gain=1;},s.default.extend(s.default.OscillatorNode,s.default.AudioNode),s.default.OscillatorNode.defaults={frequency:440,detune:0,type:"sine",onended:s.default.noOp},Object.defineProperty(s.default.OscillatorNode.prototype,"state",{get:function(){return this.getStateAtTime(this.now())}}),s.default.OscillatorNode.prototype.getStateAtTime=function(t){return t=this.toSeconds(t),-1!==this._startTime&&t>=this._startTime&&(-1===this._stopTime||t<=this._stopTime)?s.default.State.Started:s.default.State.Stopped},s.default.OscillatorNode.prototype.start=function(t){if(this.log("start",t),-1!==this._startTime)throw new Error("cannot call OscillatorNode.start more than once");return this._startTime=this.toSeconds(t),this._startTime=Math.max(this._startTime,this.context.currentTime),this._oscillator.start(this._startTime),this._gainNode.gain.setValueAtTime(1,this._startTime),this},s.default.OscillatorNode.prototype.setPeriodicWave=function(t){return this._oscillator.setPeriodicWave(t),this},s.default.OscillatorNode.prototype.stop=function(t){return this.log("stop",t),this.assert(-1!==this._startTime,"'start' must be called before 'stop'"),this.cancelStop(),this._stopTime=this.toSeconds(t),this._stopTime=Math.max(this._stopTime,this.context.currentTime),this._stopTime>this._startTime?(this._gainNode.gain.setValueAtTime(0,this._stopTime),this.context.clearTimeout(this._timeout),this._timeout=this.context.setTimeout(function(){this._oscillator.stop(this.now()),this.onended(),setTimeout(function(){this._oscillator&&(this._oscillator.disconnect(),this._gainNode.disconnect());}.bind(this),100);}.bind(this),this._stopTime-this.context.currentTime)):this._gainNode.gain.cancelScheduledValues(this._startTime),this},s.default.OscillatorNode.prototype.cancelStop=function(){return -1!==this._startTime&&(this._gainNode.gain.cancelScheduledValues(this._startTime+this.sampleTime),this.context.clearTimeout(this._timeout),this._stopTime=-1),this},Object.defineProperty(s.default.OscillatorNode.prototype,"type",{get:function(){return this._oscillator.type},set:function(t){this._oscillator.type=t;}}),s.default.OscillatorNode.prototype.dispose=function(){return this._wasDisposed||(this._wasDisposed=!0,this.context.clearTimeout(this._timeout),s.default.AudioNode.prototype.dispose.call(this),this.onended=null,this._oscillator.disconnect(),this._oscillator=null,this._gainNode.dispose(),this._gainNode=null,this.frequency.dispose(),this.frequency=null,this.detune.dispose(),this.detune=null),this};e.default=s.default.OscillatorNode;},function(t,e,i){i.r(e);var s=i(0);i(11),i(6),i(57),i(32);s.default.Player=function(t){var e;t instanceof s.default.Buffer&&t.loaded?(t=t.get(),e=s.default.Player.defaults):e=s.default.defaults(arguments,["url","onload"],s.default.Player),s.default.Source.call(this,e),this.autostart=e.autostart,this._buffer=new s.default.Buffer({url:e.url,onload:this._onload.bind(this,e.onload),reverse:e.reverse}),t instanceof AudioBuffer&&this._buffer.set(t),this._loop=e.loop,this._loopStart=e.loopStart,this._loopEnd=e.loopEnd,this._playbackRate=e.playbackRate,this._activeSources=[],this.fadeIn=e.fadeIn,this.fadeOut=e.fadeOut;},s.default.extend(s.default.Player,s.default.Source),s.default.Player.defaults={onload:s.default.noOp,playbackRate:1,loop:!1,autostart:!1,loopStart:0,loopEnd:0,reverse:!1,fadeIn:0,fadeOut:0},s.default.Player.prototype.load=function(t,e){return this._buffer.load(t,this._onload.bind(this,e))},s.default.Player.prototype._onload=function(t){(t=s.default.defaultArg(t,s.default.noOp))(this),this.autostart&&this.start();},s.default.Player.prototype._onSourceEnd=function(t){var e=this._activeSources.indexOf(t);this._activeSources.splice(e,1),0!==this._activeSources.length||this._synced||this._state.setStateAtTime(s.default.State.Stopped,s.default.now());},s.default.Player.prototype._start=function(t,e,i){e=this._loop?s.default.defaultArg(e,this._loopStart):s.default.defaultArg(e,0),e=this.toSeconds(e),this._synced&&(e*=this._playbackRate);var n=s.default.defaultArg(i,Math.max(this._buffer.duration-e,0));n=this.toSeconds(n),n/=this._playbackRate,t=this.toSeconds(t);var o=new s.default.BufferSource({buffer:this._buffer,loop:this._loop,loopStart:this._loopStart,loopEnd:this._loopEnd,onended:this._onSourceEnd.bind(this),playbackRate:this._playbackRate,fadeIn:this.fadeIn,fadeOut:this.fadeOut}).connect(this.output);return this._loop||this._synced||this._state.setStateAtTime(s.default.State.Stopped,t+n),this._activeSources.push(o),this._loop&&s.default.isUndef(i)?o.start(t,e):o.start(t,e,n-this.toSeconds(this.fadeOut)),this},s.default.Player.prototype._stop=function(t){return t=this.toSeconds(t),this._activeSources.forEach(function(e){e.stop(t);}),this},s.default.Player.prototype.restart=function(t,e,i){return this._stop(t),this._start(t,e,i),this},s.default.Player.prototype.seek=function(t,e){return e=this.toSeconds(e),this._state.getValueAtTime(e)===s.default.State.Started&&(t=this.toSeconds(t),this._stop(e),this._start(e,t)),this},s.default.Player.prototype.setLoopPoints=function(t,e){return this.loopStart=t,this.loopEnd=e,this},Object.defineProperty(s.default.Player.prototype,"loopStart",{get:function(){return this._loopStart},set:function(t){this._loopStart=t,this._activeSources.forEach(function(e){e.loopStart=t;});}}),Object.defineProperty(s.default.Player.prototype,"loopEnd",{get:function(){return this._loopEnd},set:function(t){this._loopEnd=t,this._activeSources.forEach(function(e){e.loopEnd=t;});}}),Object.defineProperty(s.default.Player.prototype,"buffer",{get:function(){return this._buffer},set:function(t){this._buffer.set(t);}}),Object.defineProperty(s.default.Player.prototype,"loop",{get:function(){return this._loop},set:function(t){if(this._loop!==t&&(this._loop=t,this._activeSources.forEach(function(e){e.loop=t;}),t)){var e=this._state.getNextState(s.default.State.Stopped,this.now());e&&this._state.cancel(e.time);}}}),Object.defineProperty(s.default.Player.prototype,"playbackRate",{get:function(){return this._playbackRate},set:function(t){this._playbackRate=t;var e=this.now(),i=this._state.getNextState(s.default.State.Stopped,e);i&&this._state.cancel(i.time),this._activeSources.forEach(function(i){i.cancelStop(),i.playbackRate.setValueAtTime(t,e);});}}),Object.defineProperty(s.default.Player.prototype,"reverse",{get:function(){return this._buffer.reverse},set:function(t){this._buffer.reverse=t;}}),Object.defineProperty(s.default.Player.prototype,"loaded",{get:function(){return this._buffer.loaded}}),s.default.Player.prototype.dispose=function(){return this._activeSources.forEach(function(t){t.dispose();}),this._activeSources=null,s.default.Source.prototype.dispose.call(this),this._buffer.dispose(),this._buffer=null,this},e.default=s.default.Player;},function(t,e,i){i.r(e);var s=i(0);i(31),i(41),i(37),i(2),i(9),i(25);s.default.MonoSynth=function(t){t=s.default.defaultArg(t,s.default.MonoSynth.defaults),s.default.Monophonic.call(this,t),this.oscillator=new s.default.OmniOscillator(t.oscillator),this.frequency=this.oscillator.frequency,this.detune=this.oscillator.detune,this.filter=new s.default.Filter(t.filter),this.filter.frequency.value=5e3,this.filterEnvelope=new s.default.FrequencyEnvelope(t.filterEnvelope),this.envelope=new s.default.AmplitudeEnvelope(t.envelope),this.oscillator.chain(this.filter,this.envelope,this.output),this.filterEnvelope.connect(this.filter.frequency),this._readOnly(["oscillator","frequency","detune","filter","filterEnvelope","envelope"]);},s.default.extend(s.default.MonoSynth,s.default.Monophonic),s.default.MonoSynth.defaults={frequency:"C4",detune:0,oscillator:{type:"square"},filter:{Q:6,type:"lowpass",rolloff:-24},envelope:{attack:.005,decay:.1,sustain:.9,release:1},filterEnvelope:{attack:.06,decay:.2,sustain:.5,release:2,baseFrequency:200,octaves:7,exponent:2}},s.default.MonoSynth.prototype._triggerEnvelopeAttack=function(t,e){return t=this.toSeconds(t),this.envelope.triggerAttack(t,e),this.filterEnvelope.triggerAttack(t),this.oscillator.start(t),0===this.envelope.sustain&&this.oscillator.stop(t+this.envelope.attack+this.envelope.decay),this},s.default.MonoSynth.prototype._triggerEnvelopeRelease=function(t){return this.envelope.triggerRelease(t),this.filterEnvelope.triggerRelease(t),this.oscillator.stop(t+this.envelope.release),this},s.default.MonoSynth.prototype.dispose=function(){return s.default.Monophonic.prototype.dispose.call(this),this._writable(["oscillator","frequency","detune","filter","filterEnvelope","envelope"]),this.oscillator.dispose(),this.oscillator=null,this.envelope.dispose(),this.envelope=null,this.filterEnvelope.dispose(),this.filterEnvelope=null,this.filter.dispose(),this.filter=null,this.frequency=null,this.detune=null,this},e.default=s.default.MonoSynth;},function(t,e,i){i.r(e);var s=i(0);i(6),i(17),i(5),i(3);s.default.FatOscillator=function(){var t=s.default.defaults(arguments,["frequency","type","spread"],s.default.FatOscillator);s.default.Source.call(this,t),this.frequency=new s.default.Signal(t.frequency,s.default.Type.Frequency),this.detune=new s.default.Signal(t.detune,s.default.Type.Cents),this._oscillators=[],this._spread=t.spread,this._type=t.type,this._phase=t.phase,this._partials=t.partials,this._partialCount=t.partialCount,this.count=t.count,this._readOnly(["frequency","detune"]);},s.default.extend(s.default.FatOscillator,s.default.Source),s.default.FatOscillator.defaults={frequency:440,detune:0,phase:0,spread:20,count:3,type:"sawtooth",partials:[],partialCount:0},s.default.FatOscillator.prototype._start=function(t){t=this.toSeconds(t),this._forEach(function(e){e.start(t);});},s.default.FatOscillator.prototype._stop=function(t){t=this.toSeconds(t),this._forEach(function(e){e.stop(t);});},s.default.FatOscillator.prototype.restart=function(t){t=this.toSeconds(t),this._forEach(function(e){e.restart(t);});},s.default.FatOscillator.prototype._forEach=function(t){for(var e=0;e<this._oscillators.length;e++)t.call(this,this._oscillators[e],e);},Object.defineProperty(s.default.FatOscillator.prototype,"type",{get:function(){return this._type},set:function(t){this._type=t,this._forEach(function(e){e.type=t;});}}),Object.defineProperty(s.default.FatOscillator.prototype,"spread",{get:function(){return this._spread},set:function(t){if(this._spread=t,this._oscillators.length>1){var e=-t/2,i=t/(this._oscillators.length-1);this._forEach(function(t,s){t.detune.value=e+i*s;});}}}),Object.defineProperty(s.default.FatOscillator.prototype,"count",{get:function(){return this._oscillators.length},set:function(t){if(t=Math.max(t,1),this._oscillators.length!==t){this._forEach(function(t){t.dispose();}),this._oscillators=[];for(var e=0;e<t;e++){var i=new s.default.Oscillator;this.type===s.default.Oscillator.Type.Custom?i.partials=this._partials:i.type=this._type,i.partialCount=this._partialCount,i.phase=this._phase+e/t*360,i.volume.value=-6-1.1*t,this.frequency.connect(i.frequency),this.detune.connect(i.detune),i.connect(this.output),this._oscillators[e]=i;}this.spread=this._spread,this.state===s.default.State.Started&&this._forEach(function(t){t.start();});}}}),Object.defineProperty(s.default.FatOscillator.prototype,"phase",{get:function(){return this._phase},set:function(t){this._phase=t,this._forEach(function(e){e.phase=t;});}}),Object.defineProperty(s.default.FatOscillator.prototype,"baseType",{get:function(){return this._oscillators[0].baseType},set:function(t){this._forEach(function(e){e.baseType=t;}),this._type=this._oscillators[0].type;}}),Object.defineProperty(s.default.FatOscillator.prototype,"partials",{get:function(){return this._oscillators[0].partials},set:function(t){this._partials=t,this._type=s.default.Oscillator.Type.Custom,this._forEach(function(e){e.partials=t;});}}),Object.defineProperty(s.default.FatOscillator.prototype,"partialCount",{get:function(){return this._oscillators[0].partialCount},set:function(t){this._partialCount=t,this._forEach(function(e){e.partialCount=t;}),this._type=this._oscillators[0].type;}}),s.default.FatOscillator.prototype.dispose=function(){return s.default.Source.prototype.dispose.call(this),this._writable(["frequency","detune"]),this.frequency.dispose(),this.frequency=null,this.detune.dispose(),this.detune=null,this._forEach(function(t){t.dispose();}),this._oscillators=null,this._partials=null,this},e.default=s.default.FatOscillator;},function(t,e,i){i.r(e);var s=i(0);i(6),i(17),i(5),i(3),i(22);s.default.AMOscillator=function(){var t=s.default.defaults(arguments,["frequency","type","modulationType"],s.default.AMOscillator);s.default.Source.call(this,t),this._carrier=new s.default.Oscillator(t.frequency,t.type),this.frequency=this._carrier.frequency,this.detune=this._carrier.detune,this.detune.value=t.detune,this._modulator=new s.default.Oscillator(t.frequency,t.modulationType),this._modulationScale=new s.default.AudioToGain,this.harmonicity=new s.default.Multiply(t.harmonicity),this.harmonicity.units=s.default.Type.Positive,this._modulationNode=new s.default.Gain(0),this.frequency.chain(this.harmonicity,this._modulator.frequency),this.detune.connect(this._modulator.detune),this._modulator.chain(this._modulationScale,this._modulationNode.gain),this._carrier.chain(this._modulationNode,this.output),this.phase=t.phase,this._readOnly(["frequency","detune","harmonicity"]);},s.default.extend(s.default.AMOscillator,s.default.Oscillator),s.default.AMOscillator.defaults={frequency:440,detune:0,phase:0,type:"sine",modulationType:"square",harmonicity:1},s.default.AMOscillator.prototype._start=function(t){this._modulator.start(t),this._carrier.start(t);},s.default.AMOscillator.prototype._stop=function(t){this._modulator.stop(t),this._carrier.stop(t);},s.default.AMOscillator.prototype.restart=function(t){this._modulator.restart(t),this._carrier.restart(t);},Object.defineProperty(s.default.AMOscillator.prototype,"type",{get:function(){return this._carrier.type},set:function(t){this._carrier.type=t;}}),Object.defineProperty(s.default.AMOscillator.prototype,"baseType",{get:function(){return this._carrier.baseType},set:function(t){this._carrier.baseType=t;}}),Object.defineProperty(s.default.AMOscillator.prototype,"partialCount",{get:function(){return this._carrier.partialCount},set:function(t){this._carrier.partialCount=t;}}),Object.defineProperty(s.default.AMOscillator.prototype,"modulationType",{get:function(){return this._modulator.type},set:function(t){this._modulator.type=t;}}),Object.defineProperty(s.default.AMOscillator.prototype,"phase",{get:function(){return this._carrier.phase},set:function(t){this._carrier.phase=t,this._modulator.phase=t;}}),Object.defineProperty(s.default.AMOscillator.prototype,"partials",{get:function(){return this._carrier.partials},set:function(t){this._carrier.partials=t;}}),s.default.AMOscillator.prototype.dispose=function(){return s.default.Source.prototype.dispose.call(this),this._writable(["frequency","detune","harmonicity"]),this.frequency=null,this.detune=null,this.harmonicity.dispose(),this.harmonicity=null,this._carrier.dispose(),this._carrier=null,this._modulator.dispose(),this._modulator=null,this._modulationNode.dispose(),this._modulationNode=null,this._modulationScale.dispose(),this._modulationScale=null,this},e.default=s.default.AMOscillator;},function(t,e,i){i.r(e);var s=i(0);i(6),i(50),i(17),i(5);s.default.PWMOscillator=function(){var t=s.default.defaults(arguments,["frequency","modulationFrequency"],s.default.PWMOscillator);s.default.Source.call(this,t),this._pulse=new s.default.PulseOscillator(t.modulationFrequency),this._pulse._sawtooth.type="sine",this._modulator=new s.default.Oscillator({frequency:t.frequency,detune:t.detune,phase:t.phase}),this._scale=new s.default.Multiply(2),this.frequency=this._modulator.frequency,this.detune=this._modulator.detune,this.modulationFrequency=this._pulse.frequency,this._modulator.chain(this._scale,this._pulse.width),this._pulse.connect(this.output),this._readOnly(["modulationFrequency","frequency","detune"]);},s.default.extend(s.default.PWMOscillator,s.default.Source),s.default.PWMOscillator.defaults={frequency:440,detune:0,phase:0,modulationFrequency:.4},s.default.PWMOscillator.prototype._start=function(t){t=this.toSeconds(t),this._modulator.start(t),this._pulse.start(t);},s.default.PWMOscillator.prototype._stop=function(t){t=this.toSeconds(t),this._modulator.stop(t),this._pulse.stop(t);},s.default.PWMOscillator.prototype.restart=function(t){this._modulator.restart(t),this._pulse.restart(t);},Object.defineProperty(s.default.PWMOscillator.prototype,"type",{get:function(){return "pwm"}}),Object.defineProperty(s.default.PWMOscillator.prototype,"baseType",{get:function(){return "pwm"}}),Object.defineProperty(s.default.PWMOscillator.prototype,"partials",{get:function(){return []}}),Object.defineProperty(s.default.PWMOscillator.prototype,"phase",{get:function(){return this._modulator.phase},set:function(t){this._modulator.phase=t;}}),s.default.PWMOscillator.prototype.dispose=function(){return s.default.Source.prototype.dispose.call(this),this._pulse.dispose(),this._pulse=null,this._scale.dispose(),this._scale=null,this._modulator.dispose(),this._modulator=null,this._writable(["modulationFrequency","frequency","detune"]),this.frequency=null,this.detune=null,this.modulationFrequency=null,this},e.default=s.default.PWMOscillator;},function(t,e,i){i.r(e);var s=i(0);i(51),i(4),i(16);s.default.Part=function(){var t=s.default.defaults(arguments,["callback","events"],s.default.Part);s.default.Event.call(this,t),this._events=[];for(var e=0;e<t.events.length;e++)Array.isArray(t.events[e])?this.add(t.events[e][0],t.events[e][1]):this.add(t.events[e]);},s.default.extend(s.default.Part,s.default.Event),s.default.Part.defaults={callback:s.default.noOp,loop:!1,loopEnd:"1m",loopStart:0,playbackRate:1,probability:1,humanize:!1,mute:!1,events:[]},s.default.Part.prototype.start=function(t,e){var i=this.toTicks(t);return this._state.getValueAtTime(i)!==s.default.State.Started&&(e=this._loop?s.default.defaultArg(e,this._loopStart):s.default.defaultArg(e,0),e=this.toTicks(e),this._state.add({state:s.default.State.Started,time:i,offset:e}),this._forEach(function(t){this._startNote(t,i,e);})),this},s.default.Part.prototype._startNote=function(t,e,i){e-=i,this._loop?t.startOffset>=this._loopStart&&t.startOffset<this._loopEnd?(t.startOffset<i&&(e+=this._getLoopDuration()),t.start(s.default.Ticks(e))):t.startOffset<this._loopStart&&t.startOffset>=i&&(t.loop=!1,t.start(s.default.Ticks(e))):t.startOffset>=i&&t.start(s.default.Ticks(e));},Object.defineProperty(s.default.Part.prototype,"startOffset",{get:function(){return this._startOffset},set:function(t){this._startOffset=t,this._forEach(function(t){t.startOffset+=this._startOffset;});}}),s.default.Part.prototype.stop=function(t){var e=this.toTicks(t);return this._state.cancel(e),this._state.setStateAtTime(s.default.State.Stopped,e),this._forEach(function(e){e.stop(t);}),this},s.default.Part.prototype.at=function(t,e){t=s.default.TransportTime(t);for(var i=s.default.Ticks(1).toSeconds(),n=0;n<this._events.length;n++){var o=this._events[n];if(Math.abs(t.toTicks()-o.startOffset)<i)return s.default.isDefined(e)&&(o.value=e),o}return s.default.isDefined(e)?(this.add(t,e),this._events[this._events.length-1]):null},s.default.Part.prototype.add=function(t,e){var i;return t.hasOwnProperty("time")&&(t=(e=t).time),t=this.toTicks(t),e instanceof s.default.Event?(i=e).callback=this._tick.bind(this):i=new s.default.Event({callback:this._tick.bind(this),value:e}),i.startOffset=t,i.set({loopEnd:this.loopEnd,loopStart:this.loopStart,loop:this.loop,humanize:this.humanize,playbackRate:this.playbackRate,probability:this.probability}),this._events.push(i),this._restartEvent(i),this},s.default.Part.prototype._restartEvent=function(t){this._state.forEach(function(e){e.state===s.default.State.Started?this._startNote(t,e.time,e.offset):t.stop(s.default.Ticks(e.time));}.bind(this));},s.default.Part.prototype.remove=function(t,e){t.hasOwnProperty("time")&&(t=(e=t).time),t=this.toTicks(t);for(var i=this._events.length-1;i>=0;i--){var n=this._events[i];n.startOffset===t&&(s.default.isUndef(e)||s.default.isDefined(e)&&n.value===e)&&(this._events.splice(i,1),n.dispose());}return this},s.default.Part.prototype.removeAll=function(){return this._forEach(function(t){t.dispose();}),this._events=[],this},s.default.Part.prototype.cancel=function(t){return this._forEach(function(e){e.cancel(t);}),this._state.cancel(this.toTicks(t)),this},s.default.Part.prototype._forEach=function(t,e){if(this._events){e=s.default.defaultArg(e,this);for(var i=this._events.length-1;i>=0;i--){var n=this._events[i];n instanceof s.default.Part?n._forEach(t,e):t.call(e,n);}}return this},s.default.Part.prototype._setAll=function(t,e){this._forEach(function(i){i[t]=e;});},s.default.Part.prototype._tick=function(t,e){this.mute||this.callback(t,e);},s.default.Part.prototype._testLoopBoundries=function(t){this._loop&&(t.startOffset<this._loopStart||t.startOffset>=this._loopEnd)?t.cancel(0):t.state===s.default.State.Stopped&&this._restartEvent(t);},Object.defineProperty(s.default.Part.prototype,"probability",{get:function(){return this._probability},set:function(t){this._probability=t,this._setAll("probability",t);}}),Object.defineProperty(s.default.Part.prototype,"humanize",{get:function(){return this._humanize},set:function(t){this._humanize=t,this._setAll("humanize",t);}}),Object.defineProperty(s.default.Part.prototype,"loop",{get:function(){return this._loop},set:function(t){this._loop=t,this._forEach(function(e){e._loopStart=this._loopStart,e._loopEnd=this._loopEnd,e.loop=t,this._testLoopBoundries(e);});}}),Object.defineProperty(s.default.Part.prototype,"loopEnd",{get:function(){return s.default.Ticks(this._loopEnd).toSeconds()},set:function(t){this._loopEnd=this.toTicks(t),this._loop&&this._forEach(function(e){e.loopEnd=t,this._testLoopBoundries(e);});}}),Object.defineProperty(s.default.Part.prototype,"loopStart",{get:function(){return s.default.Ticks(this._loopStart).toSeconds()},set:function(t){this._loopStart=this.toTicks(t),this._loop&&this._forEach(function(t){t.loopStart=this.loopStart,this._testLoopBoundries(t);});}}),Object.defineProperty(s.default.Part.prototype,"playbackRate",{get:function(){return this._playbackRate},set:function(t){this._playbackRate=t,this._setAll("playbackRate",t);}}),Object.defineProperty(s.default.Part.prototype,"length",{get:function(){return this._events.length}}),s.default.Part.prototype.dispose=function(){return s.default.Event.prototype.dispose.call(this),this.removeAll(),this.callback=null,this._events=null,this},e.default=s.default.Part;},function(t,e,i){i.r(e);var s=i(0);i(51);s.default.Loop=function(){var t=s.default.defaults(arguments,["callback","interval"],s.default.Loop);s.default.call(this),this._event=new s.default.Event({callback:this._tick.bind(this),loop:!0,loopEnd:t.interval,playbackRate:t.playbackRate,probability:t.probability}),this.callback=t.callback,this.iterations=t.iterations;},s.default.extend(s.default.Loop),s.default.Loop.defaults={interval:"4n",callback:s.default.noOp,playbackRate:1,iterations:1/0,probability:!0,mute:!1},s.default.Loop.prototype.start=function(t){return this._event.start(t),this},s.default.Loop.prototype.stop=function(t){return this._event.stop(t),this},s.default.Loop.prototype.cancel=function(t){return this._event.cancel(t),this},s.default.Loop.prototype._tick=function(t){this.callback(t);},Object.defineProperty(s.default.Loop.prototype,"state",{get:function(){return this._event.state}}),Object.defineProperty(s.default.Loop.prototype,"progress",{get:function(){return this._event.progress}}),Object.defineProperty(s.default.Loop.prototype,"interval",{get:function(){return this._event.loopEnd},set:function(t){this._event.loopEnd=t;}}),Object.defineProperty(s.default.Loop.prototype,"playbackRate",{get:function(){return this._event.playbackRate},set:function(t){this._event.playbackRate=t;}}),Object.defineProperty(s.default.Loop.prototype,"humanize",{get:function(){return this._event.humanize},set:function(t){this._event.humanize=t;}}),Object.defineProperty(s.default.Loop.prototype,"probability",{get:function(){return this._event.probability},set:function(t){this._event.probability=t;}}),Object.defineProperty(s.default.Loop.prototype,"mute",{get:function(){return this._event.mute},set:function(t){this._event.mute=t;}}),Object.defineProperty(s.default.Loop.prototype,"iterations",{get:function(){return !0===this._event.loop?1/0:this._event.loop},set:function(t){this._event.loop=t===1/0||t;}}),s.default.Loop.prototype.dispose=function(){this._event.dispose(),this._event=null,this.callback=null;},e.default=s.default.Loop;},function(t,e,i){i.r(e);var s=i(0);i(15),i(33);s.default.StereoXFeedbackEffect=function(){var t=s.default.defaults(arguments,["feedback"],s.default.FeedbackEffect);s.default.StereoEffect.call(this,t),this.feedback=new s.default.Signal(t.feedback,s.default.Type.NormalRange),this._feedbackLR=new s.default.Gain,this._feedbackRL=new s.default.Gain,this.effectReturnL.chain(this._feedbackLR,this.effectSendR),this.effectReturnR.chain(this._feedbackRL,this.effectSendL),this.feedback.fan(this._feedbackLR.gain,this._feedbackRL.gain),this._readOnly(["feedback"]);},s.default.extend(s.default.StereoXFeedbackEffect,s.default.StereoEffect),s.default.StereoXFeedbackEffect.prototype.dispose=function(){return s.default.StereoEffect.prototype.dispose.call(this),this._writable(["feedback"]),this.feedback.dispose(),this.feedback=null,this._feedbackLR.dispose(),this._feedbackLR=null,this._feedbackRL.dispose(),this._feedbackRL=null,this},e.default=s.default.StereoXFeedbackEffect;},function(t,e,i){i.r(e);var s=i(0);i(8),i(53),i(52);s.default.MidSideEffect=function(){s.default.Effect.apply(this,arguments),this._midSideSplit=new s.default.MidSideSplit,this._midSideMerge=new s.default.MidSideMerge,this.midSend=this._midSideSplit.mid,this.sideSend=this._midSideSplit.side,this.midReturn=this._midSideMerge.mid,this.sideReturn=this._midSideMerge.side,this.effectSend.connect(this._midSideSplit),this._midSideMerge.connect(this.effectReturn);},s.default.extend(s.default.MidSideEffect,s.default.Effect),s.default.MidSideEffect.prototype.dispose=function(){return s.default.Effect.prototype.dispose.call(this),this._midSideSplit.dispose(),this._midSideSplit=null,this._midSideMerge.dispose(),this._midSideMerge=null,this.midSend=null,this.sideSend=null,this.midReturn=null,this.sideReturn=null,this},e.default=s.default.MidSideEffect;},function(t,e,i){i.r(e);var s=i(0);i(11),i(8);s.default.Convolver=function(){var t=s.default.defaults(arguments,["url","onload"],s.default.Convolver);s.default.Effect.call(this,t),this._convolver=this.context.createConvolver(),this._buffer=new s.default.Buffer(t.url,function(e){this.buffer=e.get(),t.onload();}.bind(this)),this._buffer.loaded&&(this.buffer=this._buffer),this.normalize=t.normalize,this.connectEffect(this._convolver);},s.default.extend(s.default.Convolver,s.default.Effect),s.default.Convolver.defaults={onload:s.default.noOp,normalize:!0},Object.defineProperty(s.default.Convolver.prototype,"buffer",{get:function(){return this._buffer.length?this._buffer:null},set:function(t){this._buffer.set(t),this._convolver.buffer&&(this.effectSend.disconnect(),this._convolver.disconnect(),this._convolver=this.context.createConvolver(),this.connectEffect(this._convolver)),this._convolver.buffer=this._buffer.get();}}),Object.defineProperty(s.default.Convolver.prototype,"normalize",{get:function(){return this._convolver.normalize},set:function(t){this._convolver.normalize=t;}}),s.default.Convolver.prototype.load=function(t,e){return this._buffer.load(t,function(t){this.buffer=t,e&&e();}.bind(this))},s.default.Convolver.prototype.dispose=function(){return s.default.Effect.prototype.dispose.call(this),this._buffer.dispose(),this._buffer=null,this._convolver.disconnect(),this._convolver=null,this},e.default=s.default.Convolver;},function(t,e,i){i.r(e);var s=i(0);i(7),i(5),i(13);s.default.Modulo=function(t){s.default.SignalBase.call(this),this.createInsOuts(1,0),this._shaper=new s.default.WaveShaper(Math.pow(2,16)),this._multiply=new s.default.Multiply,this._subtract=this.output=new s.default.Subtract,this._modSignal=new s.default.Signal(t),s.default.connect(this.input,this._shaper),s.default.connect(this.input,this._subtract),this._modSignal.connect(this._multiply,0,0),this._shaper.connect(this._multiply,0,1),this._multiply.connect(this._subtract,0,1),this._setWaveShaper(t);},s.default.extend(s.default.Modulo,s.default.SignalBase),s.default.Modulo.prototype._setWaveShaper=function(t){this._shaper.setMap(function(e){return Math.floor((e+1e-4)/t)});},Object.defineProperty(s.default.Modulo.prototype,"value",{get:function(){return this._modSignal.value},set:function(t){this._modSignal.value=t,this._setWaveShaper(t);}}),s.default.Modulo.prototype.dispose=function(){return s.default.SignalBase.prototype.dispose.call(this),this._shaper.dispose(),this._shaper=null,this._multiply.dispose(),this._multiply=null,this._subtract.dispose(),this._subtract=null,this._modSignal.dispose(),this._modSignal=null,this},e.default=s.default.Modulo;},function(t,e,i){i.r(e);var s=i(0);i(20),i(92);s.default.OfflineContext=function(t,e,i){var n=new OfflineAudioContext(t,e*i,i);s.default.Context.call(this,{context:n,clockSource:"offline",lookAhead:0,updateInterval:128/i}),this._duration=e,this._currentTime=0;},s.default.extend(s.default.OfflineContext,s.default.Context),s.default.OfflineContext.prototype.now=function(){return this._currentTime},s.default.OfflineContext.prototype.resume=function(){return Promise.resolve()},s.default.OfflineContext.prototype.render=function(){for(;this._duration-this._currentTime>=0;)this.emit("tick"),this._currentTime+=.005;return this._context.startRendering()},s.default.OfflineContext.prototype.close=function(){return this._context=null,Promise.resolve()},e.default=s.default.OfflineContext;},function(t,e,i){i.r(e);var s=i(0);i(16),i(11),i(76),i(40);s.default.Offline=function(t,e){var i=s.default.context.sampleRate,n=s.default.context,o=new s.default.OfflineContext(2,e,i);s.default.context=o;var a=t(s.default.Transport),r=null;return r=a&&s.default.isFunction(a.then)?a.then(function(){return o.render()}):o.render(),s.default.context=n,r.then(function(t){return new s.default.Buffer(t)})},e.default=s.default.Offline;},function(t,e,i){i.r(e);var s=i(0);i(11);s.default.Buffers=function(t){var e=Array.prototype.slice.call(arguments);e.shift();var i=s.default.defaults(e,["onload","baseUrl"],s.default.Buffers);for(var n in s.default.call(this),this._buffers={},this.baseUrl=i.baseUrl,this._loadingCount=0,t)this._loadingCount++,this.add(n,t[n],this._bufferLoaded.bind(this,i.onload));},s.default.extend(s.default.Buffers),s.default.Buffers.defaults={onload:s.default.noOp,baseUrl:""},s.default.Buffers.prototype.has=function(t){return this._buffers.hasOwnProperty(t)},s.default.Buffers.prototype.get=function(t){if(this.has(t))return this._buffers[t];throw new Error("Tone.Buffers: no buffer named "+t)},s.default.Buffers.prototype._bufferLoaded=function(t){this._loadingCount--,0===this._loadingCount&&t&&t(this);},Object.defineProperty(s.default.Buffers.prototype,"loaded",{get:function(){var t=!0;for(var e in this._buffers){var i=this.get(e);t=t&&i.loaded;}return t}}),s.default.Buffers.prototype.add=function(t,e,i){return i=s.default.defaultArg(i,s.default.noOp),e instanceof s.default.Buffer?(this._buffers[t]=e,i(this)):e instanceof AudioBuffer?(this._buffers[t]=new s.default.Buffer(e),i(this)):s.default.isString(e)&&(this._buffers[t]=new s.default.Buffer(this.baseUrl+e,i)),this},s.default.Buffers.prototype.dispose=function(){for(var t in s.default.prototype.dispose.call(this),this._buffers)this._buffers[t].dispose();return this._buffers=null,this},e.default=s.default.Buffers;},function(t,e,i){i.r(e);var s=i(0);s.default.CtrlPattern=function(){var t=s.default.defaults(arguments,["values","type"],s.default.CtrlPattern);s.default.call(this),this.values=t.values,this.index=0,this._type=null,this._shuffled=null,this._direction=null,this.type=t.type;},s.default.extend(s.default.CtrlPattern),s.default.CtrlPattern.Type={Up:"up",Down:"down",UpDown:"upDown",DownUp:"downUp",AlternateUp:"alternateUp",AlternateDown:"alternateDown",Random:"random",RandomWalk:"randomWalk",RandomOnce:"randomOnce"},s.default.CtrlPattern.defaults={type:s.default.CtrlPattern.Type.Up,values:[]},Object.defineProperty(s.default.CtrlPattern.prototype,"value",{get:function(){if(0!==this.values.length){if(1===this.values.length)return this.values[0];this.index=Math.min(this.index,this.values.length-1);var t=this.values[this.index];return this.type===s.default.CtrlPattern.Type.RandomOnce&&(this.values.length!==this._shuffled.length&&this._shuffleValues(),t=this.values[this._shuffled[this.index]]),t}}}),Object.defineProperty(s.default.CtrlPattern.prototype,"type",{get:function(){return this._type},set:function(t){this._type=t,this._shuffled=null,this._type===s.default.CtrlPattern.Type.Up||this._type===s.default.CtrlPattern.Type.UpDown||this._type===s.default.CtrlPattern.Type.RandomOnce||this._type===s.default.CtrlPattern.Type.AlternateUp?this.index=0:this._type!==s.default.CtrlPattern.Type.Down&&this._type!==s.default.CtrlPattern.Type.DownUp&&this._type!==s.default.CtrlPattern.Type.AlternateDown||(this.index=this.values.length-1),this._type===s.default.CtrlPattern.Type.UpDown||this._type===s.default.CtrlPattern.Type.AlternateUp?this._direction=s.default.CtrlPattern.Type.Up:this._type!==s.default.CtrlPattern.Type.DownUp&&this._type!==s.default.CtrlPattern.Type.AlternateDown||(this._direction=s.default.CtrlPattern.Type.Down),this._type===s.default.CtrlPattern.Type.RandomOnce?this._shuffleValues():this._type===s.default.CtrlPattern.Type.Random&&(this.index=Math.floor(Math.random()*this.values.length));}}),s.default.CtrlPattern.prototype.next=function(){var t=this.type;return t===s.default.CtrlPattern.Type.Up?(this.index++,this.index>=this.values.length&&(this.index=0)):t===s.default.CtrlPattern.Type.Down?(this.index--,this.index<0&&(this.index=this.values.length-1)):t===s.default.CtrlPattern.Type.UpDown||t===s.default.CtrlPattern.Type.DownUp?(this._direction===s.default.CtrlPattern.Type.Up?this.index++:this.index--,this.index<0?(this.index=1,this._direction=s.default.CtrlPattern.Type.Up):this.index>=this.values.length&&(this.index=this.values.length-2,this._direction=s.default.CtrlPattern.Type.Down)):t===s.default.CtrlPattern.Type.Random?this.index=Math.floor(Math.random()*this.values.length):t===s.default.CtrlPattern.Type.RandomWalk?Math.random()<.5?(this.index--,this.index=Math.max(this.index,0)):(this.index++,this.index=Math.min(this.index,this.values.length-1)):t===s.default.CtrlPattern.Type.RandomOnce?(this.index++,this.index>=this.values.length&&(this.index=0,this._shuffleValues())):t===s.default.CtrlPattern.Type.AlternateUp?(this._direction===s.default.CtrlPattern.Type.Up?(this.index+=2,this._direction=s.default.CtrlPattern.Type.Down):(this.index-=1,this._direction=s.default.CtrlPattern.Type.Up),this.index>=this.values.length&&(this.index=0,this._direction=s.default.CtrlPattern.Type.Up)):t===s.default.CtrlPattern.Type.AlternateDown&&(this._direction===s.default.CtrlPattern.Type.Up?(this.index+=1,this._direction=s.default.CtrlPattern.Type.Down):(this.index-=2,this._direction=s.default.CtrlPattern.Type.Up),this.index<0&&(this.index=this.values.length-1,this._direction=s.default.CtrlPattern.Type.Down)),this.value},s.default.CtrlPattern.prototype._shuffleValues=function(){var t=[];this._shuffled=[];for(var e=0;e<this.values.length;e++)t[e]=e;for(;t.length>0;){var i=t.splice(Math.floor(t.length*Math.random()),1);this._shuffled.push(i[0]);}},s.default.CtrlPattern.prototype.dispose=function(){this._shuffled=null,this.values=null;},e.default=s.default.CtrlPattern;},function(t,e,i){i.r(e);var s=i(0);i(56),i(55);s.default.TransportRepeatEvent=function(t,e){s.default.TransportEvent.call(this,t,e),e=s.default.defaultArg(e,s.default.TransportRepeatEvent.defaults),this.duration=s.default.Ticks(e.duration),this._interval=s.default.Ticks(e.interval),this._currentId=-1,this._nextId=-1,this._nextTick=this.time,this._boundRestart=this._restart.bind(this),this.Transport.on("start loopStart",this._boundRestart),this._restart();},s.default.extend(s.default.TransportRepeatEvent,s.default.TransportEvent),s.default.TransportRepeatEvent.defaults={duration:1/0,interval:1},s.default.TransportRepeatEvent.prototype.invoke=function(t){this._createEvents(t),s.default.TransportEvent.prototype.invoke.call(this,t);},s.default.TransportRepeatEvent.prototype._createEvents=function(t){var e=this.Transport.getTicksAtTime(t);e>=this.time&&e>=this._nextTick&&this._nextTick+this._interval<this.time+this.duration&&(this._nextTick+=this._interval,this._currentId=this._nextId,this._nextId=this.Transport.scheduleOnce(this.invoke.bind(this),s.default.Ticks(this._nextTick)));},s.default.TransportRepeatEvent.prototype._restart=function(t){this.Transport.clear(this._currentId),this.Transport.clear(this._nextId),this._nextTick=this.time;var e=this.Transport.getTicksAtTime(t);e>this.time&&(this._nextTick=this.time+Math.ceil((e-this.time)/this._interval)*this._interval),this._currentId=this.Transport.scheduleOnce(this.invoke.bind(this),s.default.Ticks(this._nextTick)),this._nextTick+=this._interval,this._nextId=this.Transport.scheduleOnce(this.invoke.bind(this),s.default.Ticks(this._nextTick));},s.default.TransportRepeatEvent.prototype.dispose=function(){return this.Transport.clear(this._currentId),this.Transport.clear(this._nextId),this.Transport.off("start loopStart",this._boundRestart),this._boundCreateEvents=null,s.default.TransportEvent.prototype.dispose.call(this),this.duration=null,this._interval=null,this},e.default=s.default.TransportRepeatEvent;},function(t,e,i){i.r(e);var s=i(0);i(4);s.default.IntervalTimeline=function(){s.default.call(this),this._root=null,this._length=0;},s.default.extend(s.default.IntervalTimeline),s.default.IntervalTimeline.prototype.add=function(t){if(s.default.isUndef(t.time)||s.default.isUndef(t.duration))throw new Error("Tone.IntervalTimeline: events must have time and duration parameters");t.time=t.time.valueOf();var e=new n(t.time,t.time+t.duration,t);for(null===this._root?this._root=e:this._root.insert(e),this._length++;null!==e;)e.updateHeight(),e.updateMax(),this._rebalance(e),e=e.parent;return this},s.default.IntervalTimeline.prototype.remove=function(t){if(null!==this._root){var e=[];this._root.search(t.time,e);for(var i=0;i<e.length;i++){var s=e[i];if(s.event===t){this._removeNode(s),this._length--;break}}}return this},Object.defineProperty(s.default.IntervalTimeline.prototype,"length",{get:function(){return this._length}}),s.default.IntervalTimeline.prototype.cancel=function(t){return this.forEachFrom(t,function(t){this.remove(t);}.bind(this)),this},s.default.IntervalTimeline.prototype._setRoot=function(t){this._root=t,null!==this._root&&(this._root.parent=null);},s.default.IntervalTimeline.prototype._replaceNodeInParent=function(t,e){null!==t.parent?(t.isLeftChild()?t.parent.left=e:t.parent.right=e,this._rebalance(t.parent)):this._setRoot(e);},s.default.IntervalTimeline.prototype._removeNode=function(t){if(null===t.left&&null===t.right)this._replaceNodeInParent(t,null);else if(null===t.right)this._replaceNodeInParent(t,t.left);else if(null===t.left)this._replaceNodeInParent(t,t.right);else{var e,i;if(t.getBalance()>0)if(null===t.left.right)(e=t.left).right=t.right,i=e;else{for(e=t.left.right;null!==e.right;)e=e.right;e.parent.right=e.left,i=e.parent,e.left=t.left,e.right=t.right;}else if(null===t.right.left)(e=t.right).left=t.left,i=e;else{for(e=t.right.left;null!==e.left;)e=e.left;e.parent.left=e.right,i=e.parent,e.left=t.left,e.right=t.right;}null!==t.parent?t.isLeftChild()?t.parent.left=e:t.parent.right=e:this._setRoot(e),this._rebalance(i);}t.dispose();},s.default.IntervalTimeline.prototype._rotateLeft=function(t){var e=t.parent,i=t.isLeftChild(),s=t.right;t.right=s.left,s.left=t,null!==e?i?e.left=s:e.right=s:this._setRoot(s);},s.default.IntervalTimeline.prototype._rotateRight=function(t){var e=t.parent,i=t.isLeftChild(),s=t.left;t.left=s.right,s.right=t,null!==e?i?e.left=s:e.right=s:this._setRoot(s);},s.default.IntervalTimeline.prototype._rebalance=function(t){var e=t.getBalance();e>1?t.left.getBalance()<0?this._rotateLeft(t.left):this._rotateRight(t):e<-1&&(t.right.getBalance()>0?this._rotateRight(t.right):this._rotateLeft(t));},s.default.IntervalTimeline.prototype.get=function(t){if(null!==this._root){var e=[];if(this._root.search(t,e),e.length>0){for(var i=e[0],s=1;s<e.length;s++)e[s].low>i.low&&(i=e[s]);return i.event}}return null},s.default.IntervalTimeline.prototype.forEach=function(t){if(null!==this._root){var e=[];this._root.traverse(function(t){e.push(t);});for(var i=0;i<e.length;i++){var s=e[i].event;s&&t(s);}}return this},s.default.IntervalTimeline.prototype.forEachAtTime=function(t,e){if(null!==this._root){var i=[];this._root.search(t,i);for(var s=i.length-1;s>=0;s--){var n=i[s].event;n&&e(n);}}return this},s.default.IntervalTimeline.prototype.forEachFrom=function(t,e){if(null!==this._root){var i=[];this._root.searchAfter(t,i);for(var s=i.length-1;s>=0;s--){e(i[s].event);}}return this},s.default.IntervalTimeline.prototype.dispose=function(){var t=[];null!==this._root&&this._root.traverse(function(e){t.push(e);});for(var e=0;e<t.length;e++)t[e].dispose();return t=null,this._root=null,this};var n=function(t,e,i){this.event=i,this.low=t,this.high=e,this.max=this.high,this._left=null,this._right=null,this.parent=null,this.height=0;};n.prototype.insert=function(t){t.low<=this.low?null===this.left?this.left=t:this.left.insert(t):null===this.right?this.right=t:this.right.insert(t);},n.prototype.search=function(t,e){t>this.max||(null!==this.left&&this.left.search(t,e),this.low<=t&&this.high>t&&e.push(this),this.low>t||null!==this.right&&this.right.search(t,e));},n.prototype.searchAfter=function(t,e){this.low>=t&&(e.push(this),null!==this.left&&this.left.searchAfter(t,e)),null!==this.right&&this.right.searchAfter(t,e);},n.prototype.traverse=function(t){t(this),null!==this.left&&this.left.traverse(t),null!==this.right&&this.right.traverse(t);},n.prototype.updateHeight=function(){null!==this.left&&null!==this.right?this.height=Math.max(this.left.height,this.right.height)+1:null!==this.right?this.height=this.right.height+1:null!==this.left?this.height=this.left.height+1:this.height=0;},n.prototype.updateMax=function(){this.max=this.high,null!==this.left&&(this.max=Math.max(this.max,this.left.max)),null!==this.right&&(this.max=Math.max(this.max,this.right.max));},n.prototype.getBalance=function(){var t=0;return null!==this.left&&null!==this.right?t=this.left.height-this.right.height:null!==this.left?t=this.left.height+1:null!==this.right&&(t=-(this.right.height+1)),t},n.prototype.isLeftChild=function(){return null!==this.parent&&this.parent.left===this},Object.defineProperty(n.prototype,"left",{get:function(){return this._left},set:function(t){this._left=t,null!==t&&(t.parent=this),this.updateHeight(),this.updateMax();}}),Object.defineProperty(n.prototype,"right",{get:function(){return this._right},set:function(t){this._right=t,null!==t&&(t.parent=this),this.updateHeight(),this.updateMax();}}),n.prototype.dispose=function(){this.parent=null,this._left=null,this._right=null,this.event=null;},e.default=s.default.IntervalTimeline;},function(t,e,i){i.r(e);var s=i(0);i(2);function n(t){return function(e,i){i=this.toSeconds(i),t.apply(this,arguments);var s=this._events.get(i),n=this._events.previousEvent(s),o=this._getTicksUntilEvent(n,i);return s.ticks=Math.max(o,0),this}}s.default.TickSignal=function(t){t=s.default.defaultArg(t,1),s.default.Signal.call(this,{units:s.default.Type.Ticks,value:t}),this._events.memory=1/0,this.cancelScheduledValues(0),this._events.add({type:s.default.Param.AutomationType.SetValue,time:0,value:t});},s.default.extend(s.default.TickSignal,s.default.Signal),s.default.TickSignal.prototype.setValueAtTime=n(s.default.Signal.prototype.setValueAtTime),s.default.TickSignal.prototype.linearRampToValueAtTime=n(s.default.Signal.prototype.linearRampToValueAtTime),s.default.TickSignal.prototype.setTargetAtTime=function(t,e,i){e=this.toSeconds(e),this.setRampPoint(e),t=this._fromUnits(t);for(var s=this._events.get(e),n=Math.round(Math.max(1/i,1)),o=0;o<=n;o++){var a=i*o+e,r=this._exponentialApproach(s.time,s.value,t,i,a);this.linearRampToValueAtTime(this._toUnits(r),a);}return this},s.default.TickSignal.prototype.exponentialRampToValueAtTime=function(t,e){e=this.toSeconds(e),t=this._fromUnits(t);for(var i=this._events.get(e),s=Math.round(Math.max(10*(e-i.time),1)),n=(e-i.time)/s,o=0;o<=s;o++){var a=n*o+i.time,r=this._exponentialInterpolate(i.time,i.value,e,t,a);this.linearRampToValueAtTime(this._toUnits(r),a);}return this},s.default.TickSignal.prototype._getTicksUntilEvent=function(t,e){if(null===t)t={ticks:0,time:0};else if(s.default.isUndef(t.ticks)){var i=this._events.previousEvent(t);t.ticks=this._getTicksUntilEvent(i,t.time);}var n=this.getValueAtTime(t.time),o=this.getValueAtTime(e);return this._events.get(e).time===e&&this._events.get(e).type===s.default.Param.AutomationType.SetValue&&(o=this.getValueAtTime(e-this.sampleTime)),.5*(e-t.time)*(n+o)+t.ticks},s.default.TickSignal.prototype.getTicksAtTime=function(t){t=this.toSeconds(t);var e=this._events.get(t);return Math.max(this._getTicksUntilEvent(e,t),0)},s.default.TickSignal.prototype.getDurationOfTicks=function(t,e){e=this.toSeconds(e);var i=this.getTicksAtTime(e);return this.getTimeOfTick(i+t)-e},s.default.TickSignal.prototype.getTimeOfTick=function(t){var e=this._events.get(t,"ticks"),i=this._events.getAfter(t,"ticks");if(e&&e.ticks===t)return e.time;if(e&&i&&i.type===s.default.Param.AutomationType.Linear&&e.value!==i.value){var n=this.getValueAtTime(e.time),o=(this.getValueAtTime(i.time)-n)/(i.time-e.time),a=Math.sqrt(Math.pow(n,2)-2*o*(e.ticks-t)),r=(-n+a)/o;return (r>0?r:(-n-a)/o)+e.time}return e?0===e.value?1/0:e.time+(t-e.ticks)/e.value:t/this._initialValue},s.default.TickSignal.prototype.ticksToTime=function(t,e){return e=this.toSeconds(e),new s.default.Time(this.getDurationOfTicks(t,e))},s.default.TickSignal.prototype.timeToTicks=function(t,e){e=this.toSeconds(e),t=this.toSeconds(t);var i=this.getTicksAtTime(e),n=this.getTicksAtTime(e+t);return new s.default.Ticks(n-i)},e.default=s.default.TickSignal;},function(t,e,i){i.r(e);var s=i(0);i(57),i(34),i(35),i(20);s.default.Clock=function(){var t=s.default.defaults(arguments,["callback","frequency"],s.default.Clock);s.default.Emitter.call(this),this.callback=t.callback,this._nextTick=0,this._tickSource=new s.default.TickSource(t.frequency),this._lastUpdate=0,this.frequency=this._tickSource.frequency,this._readOnly("frequency"),this._state=new s.default.TimelineState(s.default.State.Stopped),this._state.setStateAtTime(s.default.State.Stopped,0),this._boundLoop=this._loop.bind(this),this.context.on("tick",this._boundLoop);},s.default.extend(s.default.Clock,s.default.Emitter),s.default.Clock.defaults={callback:s.default.noOp,frequency:1},Object.defineProperty(s.default.Clock.prototype,"state",{get:function(){return this._state.getValueAtTime(this.now())}}),s.default.Clock.prototype.start=function(t,e){return this.context.resume(),t=this.toSeconds(t),this._state.getValueAtTime(t)!==s.default.State.Started&&(this._state.setStateAtTime(s.default.State.Started,t),this._tickSource.start(t,e),t<this._lastUpdate&&this.emit("start",t,e)),this},s.default.Clock.prototype.stop=function(t){return t=this.toSeconds(t),this._state.cancel(t),this._state.setStateAtTime(s.default.State.Stopped,t),this._tickSource.stop(t),t<this._lastUpdate&&this.emit("stop",t),this},s.default.Clock.prototype.pause=function(t){return t=this.toSeconds(t),this._state.getValueAtTime(t)===s.default.State.Started&&(this._state.setStateAtTime(s.default.State.Paused,t),this._tickSource.pause(t),t<this._lastUpdate&&this.emit("pause",t)),this},Object.defineProperty(s.default.Clock.prototype,"ticks",{get:function(){return Math.ceil(this.getTicksAtTime(this.now()))},set:function(t){this._tickSource.ticks=t;}}),Object.defineProperty(s.default.Clock.prototype,"seconds",{get:function(){return this._tickSource.seconds},set:function(t){this._tickSource.seconds=t;}}),s.default.Clock.prototype.getSecondsAtTime=function(t){return this._tickSource.getSecondsAtTime(t)},s.default.Clock.prototype.setTicksAtTime=function(t,e){return this._tickSource.setTicksAtTime(t,e),this},s.default.Clock.prototype.getTicksAtTime=function(t){return this._tickSource.getTicksAtTime(t)},s.default.Clock.prototype.nextTickTime=function(t,e){e=this.toSeconds(e);var i=this.getTicksAtTime(e);return this._tickSource.getTimeOfTick(i+t,e)},s.default.Clock.prototype._loop=function(){var t=this._lastUpdate,e=this.now();this._lastUpdate=e,t!==e&&(this._state.forEachBetween(t,e,function(t){switch(t.state){case s.default.State.Started:var e=this._tickSource.getTicksAtTime(t.time);this.emit("start",t.time,e);break;case s.default.State.Stopped:0!==t.time&&this.emit("stop",t.time);break;case s.default.State.Paused:this.emit("pause",t.time);}}.bind(this)),this._tickSource.forEachTickBetween(t,e,function(t,e){this.callback(t,e);}.bind(this)));},s.default.Clock.prototype.getStateAtTime=function(t){return t=this.toSeconds(t),this._state.getValueAtTime(t)},s.default.Clock.prototype.dispose=function(){s.default.Emitter.prototype.dispose.call(this),this.context.off("tick",this._boundLoop),this._writable("frequency"),this._tickSource.dispose(),this._tickSource=null,this.frequency=null,this._boundLoop=null,this._nextTick=1/0,this.callback=null,this._state.dispose(),this._state=null;},e.default=s.default.Clock;},function(t,e,i){i.r(e);var s=i(0);i(2),i(5),i(7);s.default.GreaterThanZero=function(){s.default.SignalBase.call(this),this._thresh=this.output=new s.default.WaveShaper(function(t){return t<=0?0:1},127),this._scale=this.input=new s.default.Multiply(1e4),this._scale.connect(this._thresh);},s.default.extend(s.default.GreaterThanZero,s.default.SignalBase),s.default.GreaterThanZero.prototype.dispose=function(){return s.default.SignalBase.prototype.dispose.call(this),this._scale.dispose(),this._scale=null,this._thresh.dispose(),this._thresh=null,this},e.default=s.default.GreaterThanZero;},function(t,e,i){i.r(e);var s=i(0);i(84),i(13),i(2);s.default.GreaterThan=function(t){s.default.Signal.call(this),this.createInsOuts(2,0),this._param=this.input[0]=new s.default.Subtract(t),this.input[1]=this._param.input[1],this._gtz=this.output=new s.default.GreaterThanZero,this._param.connect(this._gtz);},s.default.extend(s.default.GreaterThan,s.default.Signal),s.default.GreaterThan.prototype.dispose=function(){return s.default.Signal.prototype.dispose.call(this),this._gtz.dispose(),this._gtz=null,this},e.default=s.default.GreaterThan;},function(t,e,i){i.r(e);var s=i(0);i(47),i(26);s.default.ScaledEnvelope=function(){var t=s.default.defaults(arguments,["attack","decay","sustain","release"],s.default.Envelope);s.default.Envelope.call(this,t),t=s.default.defaultArg(t,s.default.ScaledEnvelope.defaults),this._exp=this.output=new s.default.Pow(t.exponent),this._scale=this.output=new s.default.Scale(t.min,t.max),this._sig.chain(this._exp,this._scale);},s.default.extend(s.default.ScaledEnvelope,s.default.Envelope),s.default.ScaledEnvelope.defaults={min:0,max:1,exponent:1},Object.defineProperty(s.default.ScaledEnvelope.prototype,"min",{get:function(){return this._scale.min},set:function(t){this._scale.min=t;}}),Object.defineProperty(s.default.ScaledEnvelope.prototype,"max",{get:function(){return this._scale.max},set:function(t){this._scale.max=t;}}),Object.defineProperty(s.default.ScaledEnvelope.prototype,"exponent",{get:function(){return this._exp.value},set:function(t){this._exp.value=t;}}),s.default.ScaledEnvelope.prototype.dispose=function(){return s.default.Envelope.prototype.dispose.call(this),this._scale.dispose(),this._scale=null,this._exp.dispose(),this._exp=null,this},e.default=s.default.ScaledEnvelope;},function(t,e,i){i.r(e);var s=i(0);i(7),i(30);s.default.Abs=function(){s.default.SignalBase.call(this),this._abs=this.input=this.output=new s.default.WaveShaper(function(t){return Math.abs(t)<.001?0:Math.abs(t)},1024);},s.default.extend(s.default.Abs,s.default.SignalBase),s.default.Abs.prototype.dispose=function(){return s.default.SignalBase.prototype.dispose.call(this),this._abs.dispose(),this._abs=null,this},e.default=s.default.Abs;},function(t,e,i){i.r(e);var s=i(0);i(3),i(1);s.default.Solo=function(){var t=s.default.defaults(arguments,["solo"],s.default.Solo);s.default.AudioNode.call(this),this.input=this.output=new s.default.Gain,this._soloBind=this._soloed.bind(this),this.context.on("solo",this._soloBind),this.solo=t.solo;},s.default.extend(s.default.Solo,s.default.AudioNode),s.default.Solo.defaults={solo:!1},Object.defineProperty(s.default.Solo.prototype,"solo",{get:function(){return this._isSoloed()},set:function(t){t?this._addSolo():this._removeSolo(),this.context.emit("solo",this);}}),Object.defineProperty(s.default.Solo.prototype,"muted",{get:function(){return 0===this.input.gain.value}}),s.default.Solo.prototype._addSolo=function(){s.default.isArray(this.context._currentSolo)||(this.context._currentSolo=[]),this._isSoloed()||this.context._currentSolo.push(this);},s.default.Solo.prototype._removeSolo=function(){if(this._isSoloed()){var t=this.context._currentSolo.indexOf(this);this.context._currentSolo.splice(t,1);}},s.default.Solo.prototype._isSoloed=function(){return !!s.default.isArray(this.context._currentSolo)&&(0!==this.context._currentSolo.length&&-1!==this.context._currentSolo.indexOf(this))},s.default.Solo.prototype._noSolos=function(){return !s.default.isArray(this.context._currentSolo)||0===this.context._currentSolo.length},s.default.Solo.prototype._soloed=function(){this._isSoloed()?this.input.gain.value=1:this._noSolos()?this.input.gain.value=1:this.input.gain.value=0;},s.default.Solo.prototype.dispose=function(){return this.context.off("solo",this._soloBind),this._removeSolo(),this._soloBind=null,s.default.AudioNode.prototype.dispose.call(this),this},e.default=s.default.Solo;},function(t,e,i){i.r(e);var s=i(0);i(7);s.default.EqualPowerGain=function(){s.default.SignalBase.call(this),this._eqPower=this.input=this.output=new s.default.WaveShaper(function(t){return Math.abs(t)<.001?0:s.default.equalPowerScale(t)}.bind(this),4096);},s.default.extend(s.default.EqualPowerGain,s.default.SignalBase),s.default.EqualPowerGain.prototype.dispose=function(){return s.default.SignalBase.prototype.dispose.call(this),this._eqPower.dispose(),this._eqPower=null,this},e.default=s.default.EqualPowerGain;},function(t,e,i){i.r(e);var s=i(0);i(5),i(2);s.default.Negate=function(){s.default.SignalBase.call(this),this._multiply=this.input=this.output=new s.default.Multiply(-1);},s.default.extend(s.default.Negate,s.default.SignalBase),s.default.Negate.prototype.dispose=function(){return s.default.SignalBase.prototype.dispose.call(this),this._multiply.dispose(),this._multiply=null,this},e.default=s.default.Negate;},function(t,e,i){i.r(e);var s=i(0);i(48),i(27),i(1);s.default.PanVol=function(){var t=s.default.defaults(arguments,["pan","volume"],s.default.PanVol);s.default.AudioNode.call(this),this._panner=this.input=new s.default.Panner(t.pan),this.pan=this._panner.pan,this._volume=this.output=new s.default.Volume(t.volume),this.volume=this._volume.volume,this._panner.connect(this._volume),this.mute=t.mute,this._readOnly(["pan","volume"]);},s.default.extend(s.default.PanVol,s.default.AudioNode),s.default.PanVol.defaults={pan:0,volume:0,mute:!1},Object.defineProperty(s.default.PanVol.prototype,"mute",{get:function(){return this._volume.mute},set:function(t){this._volume.mute=t;}}),s.default.PanVol.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._writable(["pan","volume"]),this._panner.dispose(),this._panner=null,this.pan=null,this._volume.dispose(),this._volume=null,this.volume=null,this},e.default=s.default.PanVol;},function(t,e,i){var s=i(0);if(s.default.supported){!s.default.global.hasOwnProperty("OfflineAudioContext")&&s.default.global.hasOwnProperty("webkitOfflineAudioContext")&&(s.default.global.OfflineAudioContext=s.default.global.webkitOfflineAudioContext);var n=new OfflineAudioContext(1,1,44100).startRendering();n&&s.default.isFunction(n.then)||(OfflineAudioContext.prototype._native_startRendering=OfflineAudioContext.prototype.startRendering,OfflineAudioContext.prototype.startRendering=function(){return new Promise(function(t){this.oncomplete=function(e){t(e.renderedBuffer);},this._native_startRendering();}.bind(this))});}},function(t,e,i){e.a="13.8.25";},function(t,e,i){i.r(e);var s=i(0);i(46);s.default.Midi=function(t,e){if(!(this instanceof s.default.Midi))return new s.default.Midi(t,e);s.default.Frequency.call(this,t,e);},s.default.extend(s.default.Midi,s.default.Frequency),s.default.Midi.prototype._defaultUnits="midi",s.default.Midi.prototype._frequencyToUnits=function(t){return s.default.Frequency.ftom(s.default.Frequency.prototype._frequencyToUnits.call(this,t))},s.default.Midi.prototype._ticksToUnits=function(t){return s.default.Frequency.ftom(s.default.Frequency.prototype._ticksToUnits.call(this,t))},s.default.Midi.prototype._beatsToUnits=function(t){return s.default.Frequency.ftom(s.default.Frequency.prototype._beatsToUnits.call(this,t))},s.default.Midi.prototype._secondsToUnits=function(t){return s.default.Frequency.ftom(s.default.Frequency.prototype._secondsToUnits.call(this,t))},s.default.Midi.prototype.toMidi=function(){return this.valueOf()},s.default.Midi.prototype.toFrequency=function(){return s.default.Frequency.mtof(this.toMidi())},s.default.Midi.prototype.transpose=function(t){return new this.constructor(this.toMidi()+t)},e.default=s.default.Midi;},function(t,e,i){i.r(e);var s=i(0);i(27),i(1);s.default.UserMedia=function(){var t=s.default.defaults(arguments,["volume"],s.default.UserMedia);s.default.AudioNode.call(this),this._mediaStream=null,this._stream=null,this._device=null,this._volume=this.output=new s.default.Volume(t.volume),this.volume=this._volume.volume,this._readOnly("volume"),this.mute=t.mute;},s.default.extend(s.default.UserMedia,s.default.AudioNode),s.default.UserMedia.defaults={volume:0,mute:!1},s.default.UserMedia.prototype.open=function(t){return this.state===s.default.State.Started&&this.close(),s.default.UserMedia.enumerateDevices().then(function(e){var i;if(s.default.isNumber(t))i=e[t];else if(!(i=e.find(function(e){return e.label===t||e.deviceId===t}))&&e.length>0)i=e[0];else if(!i&&s.default.isDefined(t))throw new Error("Tone.UserMedia: no matching device: "+t);this._device=i;var n={audio:{echoCancellation:!1,sampleRate:this.context.sampleRate,noiseSuppression:!1,mozNoiseSuppression:!1}};return i&&(n.audio.deviceId=i.deviceId),navigator.mediaDevices.getUserMedia(n).then(function(t){return this._stream||(this._stream=t,this._mediaStream=this.context.createMediaStreamSource(t),s.default.connect(this._mediaStream,this.output)),this}.bind(this))}.bind(this))},s.default.UserMedia.prototype.close=function(){return this._stream&&(this._stream.getAudioTracks().forEach(function(t){t.stop();}),this._stream=null,this._mediaStream.disconnect(),this._mediaStream=null),this._device=null,this},s.default.UserMedia.enumerateDevices=function(){return navigator.mediaDevices.enumerateDevices().then(function(t){return t.filter(function(t){return "audioinput"===t.kind})})},Object.defineProperty(s.default.UserMedia.prototype,"state",{get:function(){return this._stream&&this._stream.active?s.default.State.Started:s.default.State.Stopped}}),Object.defineProperty(s.default.UserMedia.prototype,"deviceId",{get:function(){return this._device?this._device.deviceId:null}}),Object.defineProperty(s.default.UserMedia.prototype,"groupId",{get:function(){return this._device?this._device.groupId:null}}),Object.defineProperty(s.default.UserMedia.prototype,"label",{get:function(){return this._device?this._device.label:null}}),Object.defineProperty(s.default.UserMedia.prototype,"mute",{get:function(){return this._volume.mute},set:function(t){this._volume.mute=t;}}),s.default.UserMedia.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this.close(),this._writable("volume"),this._volume.dispose(),this._volume=null,this.volume=null,this},Object.defineProperty(s.default.UserMedia,"supported",{get:function(){return s.default.isDefined(navigator.mediaDevices)&&s.default.isFunction(navigator.mediaDevices.getUserMedia)}}),e.default=s.default.UserMedia;},function(t,e,i){i.r(e);var s=i(0);i(65),i(27),i(1);s.default.Players=function(t){var e=Array.prototype.slice.call(arguments);e.shift();var i=s.default.defaults(e,["onload"],s.default.Players);for(var n in s.default.AudioNode.call(this,i),this._volume=this.output=new s.default.Volume(i.volume),this.volume=this._volume.volume,this._readOnly("volume"),this._volume.output.output.channelCount=2,this._volume.output.output.channelCountMode="explicit",this.mute=i.mute,this._players={},this._loadingCount=0,this._fadeIn=i.fadeIn,this._fadeOut=i.fadeOut,t)this._loadingCount++,this.add(n,t[n],this._bufferLoaded.bind(this,i.onload));},s.default.extend(s.default.Players,s.default.AudioNode),s.default.Players.defaults={volume:0,mute:!1,onload:s.default.noOp,fadeIn:0,fadeOut:0},s.default.Players.prototype._bufferLoaded=function(t){this._loadingCount--,0===this._loadingCount&&t&&t(this);},Object.defineProperty(s.default.Players.prototype,"mute",{get:function(){return this._volume.mute},set:function(t){this._volume.mute=t;}}),Object.defineProperty(s.default.Players.prototype,"fadeIn",{get:function(){return this._fadeIn},set:function(t){this._fadeIn=t,this._forEach(function(e){e.fadeIn=t;});}}),Object.defineProperty(s.default.Players.prototype,"fadeOut",{get:function(){return this._fadeOut},set:function(t){this._fadeOut=t,this._forEach(function(e){e.fadeOut=t;});}}),Object.defineProperty(s.default.Players.prototype,"state",{get:function(){var t=!1;return this._forEach(function(e){t=t||e.state===s.default.State.Started;}),t?s.default.State.Started:s.default.State.Stopped}}),s.default.Players.prototype.has=function(t){return this._players.hasOwnProperty(t)},s.default.Players.prototype.get=function(t){if(this.has(t))return this._players[t];throw new Error("Tone.Players: no player named "+t)},s.default.Players.prototype._forEach=function(t){for(var e in this._players)t(this._players[e],e);return this},Object.defineProperty(s.default.Players.prototype,"loaded",{get:function(){var t=!0;return this._forEach(function(e){t=t&&e.loaded;}),t}}),s.default.Players.prototype.add=function(t,e,i){return this._players[t]=new s.default.Player(e,i).connect(this.output),this._players[t].fadeIn=this._fadeIn,this._players[t].fadeOut=this._fadeOut,this},s.default.Players.prototype.stopAll=function(t){this._forEach(function(e){e.stop(t);});},s.default.Players.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._volume.dispose(),this._volume=null,this._writable("volume"),this.volume=null,this.output=null,this._forEach(function(t){t.dispose();}),this._players=null,this},e.default=s.default.Players;},function(t,e,i){i.r(e);var s=i(0);i(6),i(11),i(32);s.default.GrainPlayer=function(){var t=s.default.defaults(arguments,["url","onload"],s.default.GrainPlayer);s.default.Source.call(this,t),this.buffer=new s.default.Buffer(t.url,t.onload.bind(void 0,this)),this._clock=new s.default.Clock(this._tick.bind(this),t.grainSize),this._loopStart=0,this._loopEnd=0,this._activeSources=[],this._playbackRate=t.playbackRate,this._grainSize=t.grainSize,this._overlap=t.overlap,this.detune=t.detune,this.overlap=t.overlap,this.loop=t.loop,this.playbackRate=t.playbackRate,this.grainSize=t.grainSize,this.loopStart=t.loopStart,this.loopEnd=t.loopEnd,this.reverse=t.reverse,this._clock.on("stop",this._onstop.bind(this));},s.default.extend(s.default.GrainPlayer,s.default.Source),s.default.GrainPlayer.defaults={onload:s.default.noOp,overlap:.1,grainSize:.2,playbackRate:1,detune:0,loop:!1,loopStart:0,loopEnd:0,reverse:!1},s.default.GrainPlayer.prototype._start=function(t,e,i){e=s.default.defaultArg(e,0),e=this.toSeconds(e),t=this.toSeconds(t),this._offset=e,this._clock.start(t),i&&this.stop(t+this.toSeconds(i));},s.default.GrainPlayer.prototype._stop=function(t){this._clock.stop(t);},s.default.GrainPlayer.prototype._onstop=function(t){this._activeSources.forEach(function(e){e.fadeOut=0,e.stop(t);});},s.default.GrainPlayer.prototype._tick=function(t){if(!this.loop&&this._offset>this.buffer.duration)this.stop(t);else{var e=this._offset<this._overlap?0:this._overlap,i=new s.default.BufferSource({buffer:this.buffer,fadeIn:e,fadeOut:this._overlap,loop:this.loop,loopStart:this._loopStart,loopEnd:this._loopEnd,playbackRate:s.default.intervalToFrequencyRatio(this.detune/100)}).connect(this.output);i.start(t,this._offset),this._offset+=this.grainSize,i.stop(t+this.grainSize/this.playbackRate),this._activeSources.push(i),i.onended=function(){var t=this._activeSources.indexOf(i);-1!==t&&this._activeSources.splice(t,1);}.bind(this);}},Object.defineProperty(s.default.GrainPlayer.prototype,"playbackRate",{get:function(){return this._playbackRate},set:function(t){this._playbackRate=t,this.grainSize=this._grainSize;}}),Object.defineProperty(s.default.GrainPlayer.prototype,"loopStart",{get:function(){return this._loopStart},set:function(t){this._loopStart=this.toSeconds(t);}}),Object.defineProperty(s.default.GrainPlayer.prototype,"loopEnd",{get:function(){return this._loopEnd},set:function(t){this._loopEnd=this.toSeconds(t);}}),Object.defineProperty(s.default.GrainPlayer.prototype,"reverse",{get:function(){return this.buffer.reverse},set:function(t){this.buffer.reverse=t;}}),Object.defineProperty(s.default.GrainPlayer.prototype,"grainSize",{get:function(){return this._grainSize},set:function(t){this._grainSize=this.toSeconds(t),this._clock.frequency.value=this._playbackRate/this._grainSize;}}),Object.defineProperty(s.default.GrainPlayer.prototype,"overlap",{get:function(){return this._overlap},set:function(t){this._overlap=this.toSeconds(t);}}),Object.defineProperty(s.default.GrainPlayer.prototype,"loaded",{get:function(){return this.buffer.loaded}}),s.default.GrainPlayer.prototype.dispose=function(){return s.default.Source.prototype.dispose.call(this),this.buffer.dispose(),this.buffer=null,this._clock.dispose(),this._clock=null,this._activeSources.forEach(function(t){t.dispose();}),this._activeSources=null,this},e.default=s.default.GrainPlayer;},function(t,e,i){i.r(e);var s=i(0);i(16),i(2),i(45);s.default.TransportTimelineSignal=function(){s.default.Signal.apply(this,arguments),this.output=this._outputSig=new s.default.Signal(this._initialValue),this._lastVal=this.value,this._synced=s.default.Transport.scheduleRepeat(this._onTick.bind(this),"1i"),this._bindAnchorValue=this._anchorValue.bind(this),s.default.Transport.on("start stop pause",this._bindAnchorValue),this._events.memory=1/0;},s.default.extend(s.default.TransportTimelineSignal,s.default.Signal),s.default.TransportTimelineSignal.prototype._onTick=function(t){var e=this.getValueAtTime(s.default.Transport.seconds);this._lastVal!==e&&(this._lastVal=e,this._outputSig.linearRampToValueAtTime(e,t));},s.default.TransportTimelineSignal.prototype._anchorValue=function(t){var e=this.getValueAtTime(s.default.Transport.seconds);return this._lastVal=e,this._outputSig.cancelScheduledValues(t),this._outputSig.setValueAtTime(e,t),this},s.default.TransportTimelineSignal.prototype.getValueAtTime=function(t){return t=s.default.TransportTime(t),s.default.Signal.prototype.getValueAtTime.call(this,t)},s.default.TransportTimelineSignal.prototype.setValueAtTime=function(t,e){return e=s.default.TransportTime(e),s.default.Signal.prototype.setValueAtTime.call(this,t,e),this},s.default.TransportTimelineSignal.prototype.linearRampToValueAtTime=function(t,e){return e=s.default.TransportTime(e),s.default.Signal.prototype.linearRampToValueAtTime.call(this,t,e),this},s.default.TransportTimelineSignal.prototype.exponentialRampToValueAtTime=function(t,e){return e=s.default.TransportTime(e),s.default.Signal.prototype.exponentialRampToValueAtTime.call(this,t,e),this},s.default.TransportTimelineSignal.prototype.setTargetAtTime=function(t,e,i){return e=s.default.TransportTime(e),s.default.Signal.prototype.setTargetAtTime.call(this,t,e,i),this},s.default.TransportTimelineSignal.prototype.cancelScheduledValues=function(t){return t=s.default.TransportTime(t),s.default.Signal.prototype.cancelScheduledValues.call(this,t),this},s.default.TransportTimelineSignal.prototype.setValueCurveAtTime=function(t,e,i,n){return e=s.default.TransportTime(e),i=s.default.TransportTime(i),s.default.Signal.prototype.setValueCurveAtTime.call(this,t,e,i,n),this},s.default.TransportTimelineSignal.prototype.cancelAndHoldAtTime=function(t){return s.default.Signal.prototype.cancelAndHoldAtTime.call(this,s.default.TransportTime(t))},s.default.TransportTimelineSignal.prototype.dispose=function(){s.default.Transport.clear(this._synced),s.default.Transport.off("start stop pause",this._syncedCallback),this._events.cancel(0),s.default.Signal.prototype.dispose.call(this),this._outputSig.dispose(),this._outputSig=null;},e.default=s.default.TransportTimelineSignal;},function(t,e,i){i.r(e);var s=i(0);i(29),i(5);s.default.Normalize=function(t,e){s.default.SignalBase.call(this),this._inputMin=s.default.defaultArg(t,0),this._inputMax=s.default.defaultArg(e,1),this._sub=this.input=new s.default.Add(0),this._div=this.output=new s.default.Multiply(1),this._sub.connect(this._div),this._setRange();},s.default.extend(s.default.Normalize,s.default.SignalBase),Object.defineProperty(s.default.Normalize.prototype,"min",{get:function(){return this._inputMin},set:function(t){this._inputMin=t,this._setRange();}}),Object.defineProperty(s.default.Normalize.prototype,"max",{get:function(){return this._inputMax},set:function(t){this._inputMax=t,this._setRange();}}),s.default.Normalize.prototype._setRange=function(){this._sub.value=-this._inputMin,this._div.value=1/(this._inputMax-this._inputMin);},s.default.Normalize.prototype.dispose=function(){return s.default.SignalBase.prototype.dispose.call(this),this._sub.dispose(),this._sub=null,this._div.dispose(),this._div=null,this},e.default=s.default.Normalize;},function(t,e,i){i.r(e);var s=i(0);i(7),i(2);s.default.GainToAudio=function(){s.default.SignalBase.call(this),this._norm=this.input=this.output=new s.default.WaveShaper(function(t){return 2*Math.abs(t)-1});},s.default.extend(s.default.GainToAudio,s.default.SignalBase),s.default.GainToAudio.prototype.dispose=function(){return s.default.SignalBase.prototype.dispose.call(this),this._norm.dispose(),this._norm=null,this},e.default=s.default.GainToAudio;},function(t,e,i){i.r(e);var s=i(0);i(21),i(78),i(32);s.default.Sampler=function(t){var e=Array.prototype.slice.call(arguments);e.shift();var i=s.default.defaults(e,["onload","baseUrl"],s.default.Sampler);s.default.Instrument.call(this,i);var n={};for(var o in t)if(s.default.isNote(o)){n[s.default.Frequency(o).toMidi()]=t[o];}else{if(isNaN(parseFloat(o)))throw new Error("Tone.Sampler: url keys must be the note's pitch");n[o]=t[o];}this._buffers=new s.default.Buffers(n,i.onload,i.baseUrl),this._activeSources={},this.attack=i.attack,this.release=i.release,this.curve=i.curve;},s.default.extend(s.default.Sampler,s.default.Instrument),s.default.Sampler.defaults={attack:0,release:.1,onload:s.default.noOp,baseUrl:"",curve:"exponential"},s.default.Sampler.prototype._findClosest=function(t){for(var e=0;e<96;){if(this._buffers.has(t+e))return -e;if(this._buffers.has(t-e))return e;e++;}throw new Error("No available buffers for note: "+t)},s.default.Sampler.prototype.triggerAttack=function(t,e,i){this.log("triggerAttack",t,e,i),Array.isArray(t)||(t=[t]);for(var n=0;n<t.length;n++){var o=s.default.Frequency(t[n]).toMidi(),a=this._findClosest(o),r=o-a,l=this._buffers.get(r),u=s.default.intervalToFrequencyRatio(a),d=new s.default.BufferSource({buffer:l,playbackRate:u,fadeIn:this.attack,fadeOut:this.release,curve:this.curve}).connect(this.output);d.start(e,0,l.duration/u,i),s.default.isArray(this._activeSources[o])||(this._activeSources[o]=[]),this._activeSources[o].push(d),d.onended=function(){if(this._activeSources&&this._activeSources[o]){var t=this._activeSources[o].indexOf(d);-1!==t&&this._activeSources[o].splice(t,1);}}.bind(this);}return this},s.default.Sampler.prototype.triggerRelease=function(t,e){this.log("triggerRelease",t,e),Array.isArray(t)||(t=[t]);for(var i=0;i<t.length;i++){var n=s.default.Frequency(t[i]).toMidi();this._activeSources[n]&&this._activeSources[n].length&&(e=this.toSeconds(e),this._activeSources[n].forEach(function(t){t.stop(e);}),this._activeSources[n]=[]);}return this},s.default.Sampler.prototype.releaseAll=function(t){for(var e in t=this.toSeconds(t),this._activeSources)for(var i=this._activeSources[e];i.length;){i.shift().stop(t);}return this},s.default.Sampler.prototype.sync=function(){return this._syncMethod("triggerAttack",1),this._syncMethod("triggerRelease",1),this},s.default.Sampler.prototype.triggerAttackRelease=function(t,e,i,n){if(i=this.toSeconds(i),this.triggerAttack(t,i,n),s.default.isArray(e)&&s.default.isArray(t))for(var o=0;o<t.length;o++){var a=e[Math.min(o,e.length-1)];this.triggerRelease(t[o],i+this.toSeconds(a));}else this.triggerRelease(t,i+this.toSeconds(e));return this},s.default.Sampler.prototype.add=function(t,e,i){if(s.default.isNote(t)){var n=s.default.Frequency(t).toMidi();this._buffers.add(n,e,i);}else{if(isNaN(parseFloat(t)))throw new Error("Tone.Sampler: note must be the note's pitch. Instead got "+t);this._buffers.add(t,e,i);}},Object.defineProperty(s.default.Sampler.prototype,"loaded",{get:function(){return this._buffers.loaded}}),s.default.Sampler.prototype.dispose=function(){for(var t in s.default.Instrument.prototype.dispose.call(this),this._buffers.dispose(),this._buffers=null,this._activeSources)this._activeSources[t].forEach(function(t){t.dispose();});return this._activeSources=null,this},e.default=s.default.Sampler;},function(t,e,i){i.r(e);var s=i(0);i(38),i(6);s.default.PolySynth=function(){var t=s.default.defaults(arguments,["polyphony","voice"],s.default.PolySynth);s.default.Instrument.call(this,t),(t=s.default.defaultArg(t,s.default.Instrument.defaults)).polyphony=Math.min(s.default.PolySynth.MAX_POLYPHONY,t.polyphony),this.voices=new Array(t.polyphony),this.assert(t.polyphony>0,"polyphony must be greater than 0"),this.detune=new s.default.Signal(t.detune,s.default.Type.Cents),this._readOnly("detune");for(var e=0;e<t.polyphony;e++){var i=new t.voice(arguments[2],arguments[3]);if(!(i instanceof s.default.Monophonic))throw new Error("Synth constructor must be instance of Tone.Monophonic");this.voices[e]=i,i.index=e,i.connect(this.output),i.hasOwnProperty("detune")&&this.detune.connect(i.detune);}},s.default.extend(s.default.PolySynth,s.default.Instrument),s.default.PolySynth.defaults={polyphony:4,volume:0,detune:0,voice:s.default.Synth},s.default.PolySynth.prototype._getClosestVoice=function(t,e){var i=this.voices.find(function(i){if(Math.abs(i.frequency.getValueAtTime(t)-s.default.Frequency(e))<1e-4&&i.getLevelAtTime(t)>1e-5)return i});return i||this.voices.slice().sort(function(e,i){var s=e.getLevelAtTime(t+this.blockTime),n=i.getLevelAtTime(t+this.blockTime);return s<1e-5&&(s=0),n<1e-5&&(n=0),s-n}.bind(this))[0]},s.default.PolySynth.prototype.triggerAttack=function(t,e,i){return Array.isArray(t)||(t=[t]),e=this.toSeconds(e),t.forEach(function(t){var s=this._getClosestVoice(e,t);s.triggerAttack(t,e,i),this.log("triggerAttack",s.index,t);}.bind(this)),this},s.default.PolySynth.prototype.triggerRelease=function(t,e){return Array.isArray(t)||(t=[t]),e=this.toSeconds(e),t.forEach(function(t){var i=this._getClosestVoice(e,t);this.log("triggerRelease",i.index,t),i.triggerRelease(e);}.bind(this)),this},s.default.PolySynth.prototype.triggerAttackRelease=function(t,e,i,n){if(i=this.toSeconds(i),this.triggerAttack(t,i,n),s.default.isArray(e)&&s.default.isArray(t))for(var o=0;o<t.length;o++){var a=e[Math.min(o,e.length-1)];this.triggerRelease(t[o],i+this.toSeconds(a));}else this.triggerRelease(t,i+this.toSeconds(e));return this},s.default.PolySynth.prototype.sync=function(){return this._syncMethod("triggerAttack",1),this._syncMethod("triggerRelease",1),this},s.default.PolySynth.prototype.set=function(t,e,i){for(var s=0;s<this.voices.length;s++)this.voices[s].set(t,e,i);return this},s.default.PolySynth.prototype.get=function(t){return this.voices[0].get(t)},s.default.PolySynth.prototype.releaseAll=function(t){return t=this.toSeconds(t),this.voices.forEach(function(e){e.triggerRelease(t);}),this},s.default.PolySynth.prototype.dispose=function(){return s.default.Instrument.prototype.dispose.call(this),this.voices.forEach(function(t){t.dispose();}),this._writable("detune"),this.detune.dispose(),this.detune=null,this.voices=null,this},s.default.PolySynth.MAX_POLYPHONY=20,e.default=s.default.PolySynth;},function(t,e,i){i.r(e);var s=i(0);i(21),i(39),i(54);s.default.PluckSynth=function(t){t=s.default.defaultArg(t,s.default.PluckSynth.defaults),s.default.Instrument.call(this,t),this._noise=new s.default.Noise("pink"),this.attackNoise=t.attackNoise,this._lfcf=new s.default.LowpassCombFilter({resonance:t.resonance,dampening:t.dampening}),this.resonance=this._lfcf.resonance,this.dampening=this._lfcf.dampening,this._noise.connect(this._lfcf),this._lfcf.connect(this.output),this._readOnly(["resonance","dampening"]);},s.default.extend(s.default.PluckSynth,s.default.Instrument),s.default.PluckSynth.defaults={attackNoise:1,dampening:4e3,resonance:.7},s.default.PluckSynth.prototype.triggerAttack=function(t,e){t=this.toFrequency(t),e=this.toSeconds(e);var i=1/t;return this._lfcf.delayTime.setValueAtTime(i,e),this._noise.start(e),this._noise.stop(e+i*this.attackNoise),this},s.default.PluckSynth.prototype.dispose=function(){return s.default.Instrument.prototype.dispose.call(this),this._noise.dispose(),this._lfcf.dispose(),this._noise=null,this._lfcf=null,this._writable(["resonance","dampening"]),this.dampening=null,this.resonance=null,this},e.default=s.default.PluckSynth;},function(t,e,i){i.r(e);var s=i(0);i(31),i(41),i(39),i(2),i(9),i(21);s.default.NoiseSynth=function(t){t=s.default.defaultArg(t,s.default.NoiseSynth.defaults),s.default.Instrument.call(this,t),this.noise=new s.default.Noise(t.noise),this.envelope=new s.default.AmplitudeEnvelope(t.envelope),this.noise.chain(this.envelope,this.output),this._readOnly(["noise","envelope"]);},s.default.extend(s.default.NoiseSynth,s.default.Instrument),s.default.NoiseSynth.defaults={noise:{type:"white"},envelope:{attack:.005,decay:.1,sustain:0}},s.default.NoiseSynth.prototype.triggerAttack=function(t,e){return t=this.toSeconds(t),this.envelope.triggerAttack(t,e),this.noise.start(t),0===this.envelope.sustain&&this.noise.stop(t+this.envelope.attack+this.envelope.decay),this},s.default.NoiseSynth.prototype.triggerRelease=function(t){return t=this.toSeconds(t),this.envelope.triggerRelease(t),this.noise.stop(t+this.envelope.release),this},s.default.NoiseSynth.prototype.sync=function(){return this._syncMethod("triggerAttack",0),this._syncMethod("triggerRelease",0),this},s.default.NoiseSynth.prototype.triggerAttackRelease=function(t,e,i){return e=this.toSeconds(e),t=this.toSeconds(t),this.triggerAttack(e,i),this.triggerRelease(e+t),this},s.default.NoiseSynth.prototype.dispose=function(){return s.default.Instrument.prototype.dispose.call(this),this._writable(["noise","envelope"]),this.noise.dispose(),this.noise=null,this.envelope.dispose(),this.envelope=null,this},e.default=s.default.NoiseSynth;},function(t,e,i){i.r(e);var s=i(0),n=(i(21),i(49),i(9),i(41),i(31),i(3),i(26),i(5),[1,1.483,1.932,2.546,2.63,3.897]);s.default.MetalSynth=function(t){t=s.default.defaultArg(t,s.default.MetalSynth.defaults),s.default.Instrument.call(this,t),this.frequency=new s.default.Signal(t.frequency,s.default.Type.Frequency),this._oscillators=[],this._freqMultipliers=[],this._amplitue=new s.default.Gain(0).connect(this.output),this._highpass=new s.default.Filter({type:"highpass",Q:-3.0102999566398125}).connect(this._amplitue),this._octaves=t.octaves,this._filterFreqScaler=new s.default.Scale(t.resonance,7e3),this.envelope=new s.default.Envelope({attack:t.envelope.attack,attackCurve:"linear",decay:t.envelope.decay,sustain:0,release:t.envelope.release}).chain(this._filterFreqScaler,this._highpass.frequency),this.envelope.connect(this._amplitue.gain);for(var e=0;e<n.length;e++){var i=new s.default.FMOscillator({type:"square",modulationType:"square",harmonicity:t.harmonicity,modulationIndex:t.modulationIndex});i.connect(this._highpass),this._oscillators[e]=i;var o=new s.default.Multiply(n[e]);this._freqMultipliers[e]=o,this.frequency.chain(o,i.frequency);}this.octaves=t.octaves;},s.default.extend(s.default.MetalSynth,s.default.Instrument),s.default.MetalSynth.defaults={frequency:200,envelope:{attack:.001,decay:1.4,release:.2},harmonicity:5.1,modulationIndex:32,resonance:4e3,octaves:1.5},s.default.MetalSynth.prototype.triggerAttack=function(t,e){return t=this.toSeconds(t),e=s.default.defaultArg(e,1),this.envelope.triggerAttack(t,e),this._oscillators.forEach(function(e){e.start(t);}),0===this.envelope.sustain&&this._oscillators.forEach(function(e){e.stop(t+this.envelope.attack+this.envelope.decay);}.bind(this)),this},s.default.MetalSynth.prototype.triggerRelease=function(t){return t=this.toSeconds(t),this.envelope.triggerRelease(t),this._oscillators.forEach(function(e){e.stop(t+this.envelope.release);}.bind(this)),this},s.default.MetalSynth.prototype.sync=function(){return this._syncMethod("triggerAttack",0),this._syncMethod("triggerRelease",0),this},s.default.MetalSynth.prototype.triggerAttackRelease=function(t,e,i){return e=this.toSeconds(e),t=this.toSeconds(t),this.triggerAttack(e,i),this.triggerRelease(e+t),this},Object.defineProperty(s.default.MetalSynth.prototype,"modulationIndex",{get:function(){return this._oscillators[0].modulationIndex.value},set:function(t){for(var e=0;e<this._oscillators.length;e++)this._oscillators[e].modulationIndex.value=t;}}),Object.defineProperty(s.default.MetalSynth.prototype,"harmonicity",{get:function(){return this._oscillators[0].harmonicity.value},set:function(t){for(var e=0;e<this._oscillators.length;e++)this._oscillators[e].harmonicity.value=t;}}),Object.defineProperty(s.default.MetalSynth.prototype,"resonance",{get:function(){return this._filterFreqScaler.min},set:function(t){this._filterFreqScaler.min=t,this.octaves=this._octaves;}}),Object.defineProperty(s.default.MetalSynth.prototype,"octaves",{get:function(){return this._octaves},set:function(t){this._octaves=t,this._filterFreqScaler.max=this._filterFreqScaler.min*Math.pow(2,t);}}),s.default.MetalSynth.prototype.dispose=function(){s.default.Instrument.prototype.dispose.call(this);for(var t=0;t<this._oscillators.length;t++)this._oscillators[t].dispose(),this._freqMultipliers[t].dispose();this._oscillators=null,this._freqMultipliers=null,this.frequency.dispose(),this.frequency=null,this._filterFreqScaler.dispose(),this._filterFreqScaler=null,this._amplitue.dispose(),this._amplitue=null,this.envelope.dispose(),this.envelope=null,this._highpass.dispose(),this._highpass=null;},e.default=s.default.MetalSynth;},function(t,e,i){i.r(e);var s=i(0);i(37),i(21),i(31);s.default.MembraneSynth=function(t){t=s.default.defaultArg(t,s.default.MembraneSynth.defaults),s.default.Instrument.call(this,t),this.oscillator=new s.default.OmniOscillator(t.oscillator),this.envelope=new s.default.AmplitudeEnvelope(t.envelope),this.octaves=t.octaves,this.pitchDecay=t.pitchDecay,this.oscillator.chain(this.envelope,this.output),this._readOnly(["oscillator","envelope"]);},s.default.extend(s.default.MembraneSynth,s.default.Instrument),s.default.MembraneSynth.defaults={pitchDecay:.05,octaves:10,oscillator:{type:"sine"},envelope:{attack:.001,decay:.4,sustain:.01,release:1.4,attackCurve:"exponential"}},s.default.MembraneSynth.prototype.triggerAttack=function(t,e,i){e=this.toSeconds(e);var s=(t=this.toFrequency(t))*this.octaves;return this.oscillator.frequency.setValueAtTime(s,e),this.oscillator.frequency.exponentialRampToValueAtTime(t,e+this.toSeconds(this.pitchDecay)),this.envelope.triggerAttack(e,i),this.oscillator.start(e),0===this.envelope.sustain&&this.oscillator.stop(e+this.envelope.attack+this.envelope.decay),this},s.default.MembraneSynth.prototype.triggerRelease=function(t){return t=this.toSeconds(t),this.envelope.triggerRelease(t),this.oscillator.stop(t+this.envelope.release),this},s.default.MembraneSynth.prototype.dispose=function(){return s.default.Instrument.prototype.dispose.call(this),this._writable(["oscillator","envelope"]),this.oscillator.dispose(),this.oscillator=null,this.envelope.dispose(),this.envelope=null,this},e.default=s.default.MembraneSynth;},function(t,e,i){i.r(e);var s=i(0);i(38),i(2),i(5),i(25);s.default.FMSynth=function(t){t=s.default.defaultArg(t,s.default.FMSynth.defaults),s.default.Monophonic.call(this,t),this._carrier=new s.default.Synth(t.carrier),this._carrier.volume.value=-10,this.oscillator=this._carrier.oscillator,this.envelope=this._carrier.envelope.set(t.envelope),this._modulator=new s.default.Synth(t.modulator),this._modulator.volume.value=-10,this.modulation=this._modulator.oscillator.set(t.modulation),this.modulationEnvelope=this._modulator.envelope.set(t.modulationEnvelope),this.frequency=new s.default.Signal(440,s.default.Type.Frequency),this.detune=new s.default.Signal(t.detune,s.default.Type.Cents),this.harmonicity=new s.default.Multiply(t.harmonicity),this.harmonicity.units=s.default.Type.Positive,this.modulationIndex=new s.default.Multiply(t.modulationIndex),this.modulationIndex.units=s.default.Type.Positive,this._modulationNode=new s.default.Gain(0),this.frequency.connect(this._carrier.frequency),this.frequency.chain(this.harmonicity,this._modulator.frequency),this.frequency.chain(this.modulationIndex,this._modulationNode),this.detune.fan(this._carrier.detune,this._modulator.detune),this._modulator.connect(this._modulationNode.gain),this._modulationNode.connect(this._carrier.frequency),this._carrier.connect(this.output),this._readOnly(["frequency","harmonicity","modulationIndex","oscillator","envelope","modulation","modulationEnvelope","detune"]);},s.default.extend(s.default.FMSynth,s.default.Monophonic),s.default.FMSynth.defaults={harmonicity:3,modulationIndex:10,detune:0,oscillator:{type:"sine"},envelope:{attack:.01,decay:.01,sustain:1,release:.5},modulation:{type:"square"},modulationEnvelope:{attack:.5,decay:0,sustain:1,release:.5}},s.default.FMSynth.prototype._triggerEnvelopeAttack=function(t,e){return t=this.toSeconds(t),this._carrier._triggerEnvelopeAttack(t,e),this._modulator._triggerEnvelopeAttack(t),this},s.default.FMSynth.prototype._triggerEnvelopeRelease=function(t){return t=this.toSeconds(t),this._carrier._triggerEnvelopeRelease(t),this._modulator._triggerEnvelopeRelease(t),this},s.default.FMSynth.prototype.dispose=function(){return s.default.Monophonic.prototype.dispose.call(this),this._writable(["frequency","harmonicity","modulationIndex","oscillator","envelope","modulation","modulationEnvelope","detune"]),this._carrier.dispose(),this._carrier=null,this._modulator.dispose(),this._modulator=null,this.frequency.dispose(),this.frequency=null,this.detune.dispose(),this.detune=null,this.modulationIndex.dispose(),this.modulationIndex=null,this.harmonicity.dispose(),this.harmonicity=null,this._modulationNode.dispose(),this._modulationNode=null,this.oscillator=null,this.envelope=null,this.modulationEnvelope=null,this.modulation=null,this},e.default=s.default.FMSynth;},function(t,e,i){i.r(e);var s=i(0);i(66),i(12),i(2),i(5),i(25),i(14);s.default.DuoSynth=function(t){t=s.default.defaultArg(t,s.default.DuoSynth.defaults),s.default.Monophonic.call(this,t),this.voice0=new s.default.MonoSynth(t.voice0),this.voice0.volume.value=-10,this.voice1=new s.default.MonoSynth(t.voice1),this.voice1.volume.value=-10,this._vibrato=new s.default.LFO(t.vibratoRate,-50,50),this._vibrato.start(),this.vibratoRate=this._vibrato.frequency,this._vibratoGain=new s.default.Gain(t.vibratoAmount,s.default.Type.Positive),this.vibratoAmount=this._vibratoGain.gain,this.frequency=new s.default.Signal(440,s.default.Type.Frequency),this.harmonicity=new s.default.Multiply(t.harmonicity),this.harmonicity.units=s.default.Type.Positive,this.frequency.connect(this.voice0.frequency),this.frequency.chain(this.harmonicity,this.voice1.frequency),this._vibrato.connect(this._vibratoGain),this._vibratoGain.fan(this.voice0.detune,this.voice1.detune),this.voice0.connect(this.output),this.voice1.connect(this.output),this._readOnly(["voice0","voice1","frequency","vibratoAmount","vibratoRate"]);},s.default.extend(s.default.DuoSynth,s.default.Monophonic),s.default.DuoSynth.defaults={vibratoAmount:.5,vibratoRate:5,harmonicity:1.5,voice0:{volume:-10,portamento:0,oscillator:{type:"sine"},filterEnvelope:{attack:.01,decay:0,sustain:1,release:.5},envelope:{attack:.01,decay:0,sustain:1,release:.5}},voice1:{volume:-10,portamento:0,oscillator:{type:"sine"},filterEnvelope:{attack:.01,decay:0,sustain:1,release:.5},envelope:{attack:.01,decay:0,sustain:1,release:.5}}},s.default.DuoSynth.prototype._triggerEnvelopeAttack=function(t,e){return t=this.toSeconds(t),this.voice0._triggerEnvelopeAttack(t,e),this.voice1._triggerEnvelopeAttack(t,e),this},s.default.DuoSynth.prototype._triggerEnvelopeRelease=function(t){return this.voice0._triggerEnvelopeRelease(t),this.voice1._triggerEnvelopeRelease(t),this},s.default.DuoSynth.prototype.getLevelAtTime=function(t){return (this.voice0.getLevelAtTime(t)+this.voice1.getLevelAtTime(t))/2},s.default.DuoSynth.prototype.dispose=function(){return s.default.Monophonic.prototype.dispose.call(this),this._writable(["voice0","voice1","frequency","vibratoAmount","vibratoRate"]),this.voice0.dispose(),this.voice0=null,this.voice1.dispose(),this.voice1=null,this.frequency.dispose(),this.frequency=null,this._vibratoGain.dispose(),this._vibratoGain=null,this._vibrato=null,this.harmonicity.dispose(),this.harmonicity=null,this.vibratoAmount.dispose(),this.vibratoAmount=null,this.vibratoRate=null,this},e.default=s.default.DuoSynth;},function(t,e,i){i.r(e);var s=i(0);i(38),i(2),i(5),i(25),i(22),i(3);s.default.AMSynth=function(t){t=s.default.defaultArg(t,s.default.AMSynth.defaults),s.default.Monophonic.call(this,t),this._carrier=new s.default.Synth,this._carrier.volume.value=-10,this.oscillator=this._carrier.oscillator.set(t.oscillator),this.envelope=this._carrier.envelope.set(t.envelope),this._modulator=new s.default.Synth,this._modulator.volume.value=-10,this.modulation=this._modulator.oscillator.set(t.modulation),this.modulationEnvelope=this._modulator.envelope.set(t.modulationEnvelope),this.frequency=new s.default.Signal(440,s.default.Type.Frequency),this.detune=new s.default.Signal(t.detune,s.default.Type.Cents),this.harmonicity=new s.default.Multiply(t.harmonicity),this.harmonicity.units=s.default.Type.Positive,this._modulationScale=new s.default.AudioToGain,this._modulationNode=new s.default.Gain,this.frequency.connect(this._carrier.frequency),this.frequency.chain(this.harmonicity,this._modulator.frequency),this.detune.fan(this._carrier.detune,this._modulator.detune),this._modulator.chain(this._modulationScale,this._modulationNode.gain),this._carrier.chain(this._modulationNode,this.output),this._readOnly(["frequency","harmonicity","oscillator","envelope","modulation","modulationEnvelope","detune"]);},s.default.extend(s.default.AMSynth,s.default.Monophonic),s.default.AMSynth.defaults={harmonicity:3,detune:0,oscillator:{type:"sine"},envelope:{attack:.01,decay:.01,sustain:1,release:.5},modulation:{type:"square"},modulationEnvelope:{attack:.5,decay:0,sustain:1,release:.5}},s.default.AMSynth.prototype._triggerEnvelopeAttack=function(t,e){return t=this.toSeconds(t),this._carrier._triggerEnvelopeAttack(t,e),this._modulator._triggerEnvelopeAttack(t),this},s.default.AMSynth.prototype._triggerEnvelopeRelease=function(t){return this._carrier._triggerEnvelopeRelease(t),this._modulator._triggerEnvelopeRelease(t),this},s.default.AMSynth.prototype.dispose=function(){return s.default.Monophonic.prototype.dispose.call(this),this._writable(["frequency","harmonicity","oscillator","envelope","modulation","modulationEnvelope","detune"]),this._carrier.dispose(),this._carrier=null,this._modulator.dispose(),this._modulator=null,this.frequency.dispose(),this.frequency=null,this.detune.dispose(),this.detune=null,this.harmonicity.dispose(),this.harmonicity=null,this._modulationScale.dispose(),this._modulationScale=null,this._modulationNode.dispose(),this._modulationNode=null,this.oscillator=null,this.envelope=null,this.modulationEnvelope=null,this.modulation=null,this},e.default=s.default.AMSynth;},function(t,e,i){i.r(e);var s=i(0);i(70),i(16);s.default.Sequence=function(){var t=s.default.defaults(arguments,["callback","events","subdivision"],s.default.Sequence),e=t.events;if(delete t.events,s.default.Part.call(this,t),this._subdivision=this.toTicks(t.subdivision),s.default.isUndef(t.loopEnd)&&s.default.isDefined(e)&&(this._loopEnd=e.length*this._subdivision),this._loop=!0,s.default.isDefined(e))for(var i=0;i<e.length;i++)this.add(i,e[i]);},s.default.extend(s.default.Sequence,s.default.Part),s.default.Sequence.defaults={subdivision:"4n"},Object.defineProperty(s.default.Sequence.prototype,"subdivision",{get:function(){return s.default.Ticks(this._subdivision).toSeconds()}}),s.default.Sequence.prototype.at=function(t,e){return s.default.isArray(e)&&this.remove(t),s.default.Part.prototype.at.call(this,this._indexTime(t),e)},s.default.Sequence.prototype.add=function(t,e){if(null===e)return this;if(s.default.isArray(e)){var i=Math.round(this._subdivision/e.length);e=new s.default.Sequence(this._tick.bind(this),e,s.default.Ticks(i));}return s.default.Part.prototype.add.call(this,this._indexTime(t),e),this},s.default.Sequence.prototype.remove=function(t,e){return s.default.Part.prototype.remove.call(this,this._indexTime(t),e),this},s.default.Sequence.prototype._indexTime=function(t){return t instanceof s.default.TransportTime?t:s.default.Ticks(t*this._subdivision+this.startOffset).toSeconds()},s.default.Sequence.prototype.dispose=function(){return s.default.Part.prototype.dispose.call(this),this},e.default=s.default.Sequence;},function(t,e,i){i.r(e);var s=i(0);i(71),i(79);s.default.Pattern=function(){var t=s.default.defaults(arguments,["callback","values","pattern"],s.default.Pattern);s.default.Loop.call(this,t),this._pattern=new s.default.CtrlPattern({values:t.values,type:t.pattern,index:t.index});},s.default.extend(s.default.Pattern,s.default.Loop),s.default.Pattern.defaults={pattern:s.default.CtrlPattern.Type.Up,callback:s.default.noOp,values:[]},s.default.Pattern.prototype._tick=function(t){this.callback(t,this._pattern.value),this._pattern.next();},Object.defineProperty(s.default.Pattern.prototype,"index",{get:function(){return this._pattern.index},set:function(t){this._pattern.index=t;}}),Object.defineProperty(s.default.Pattern.prototype,"values",{get:function(){return this._pattern.values},set:function(t){this._pattern.values=t;}}),Object.defineProperty(s.default.Pattern.prototype,"value",{get:function(){return this._pattern.value}}),Object.defineProperty(s.default.Pattern.prototype,"pattern",{get:function(){return this._pattern.type},set:function(t){this._pattern.type=t;}}),s.default.Pattern.prototype.dispose=function(){s.default.Loop.prototype.dispose.call(this),this._pattern.dispose(),this._pattern=null;},e.default=s.default.Pattern;},function(t,e,i){i.r(e);var s=i(0);i(8),i(18),i(12);s.default.Vibrato=function(){var t=s.default.defaults(arguments,["frequency","depth"],s.default.Vibrato);s.default.Effect.call(this,t),this._delayNode=new s.default.Delay(0,t.maxDelay),this._lfo=new s.default.LFO({type:t.type,min:0,max:t.maxDelay,frequency:t.frequency,phase:-90}).start().connect(this._delayNode.delayTime),this.frequency=this._lfo.frequency,this.depth=this._lfo.amplitude,this.depth.value=t.depth,this._readOnly(["frequency","depth"]),this.effectSend.chain(this._delayNode,this.effectReturn);},s.default.extend(s.default.Vibrato,s.default.Effect),s.default.Vibrato.defaults={maxDelay:.005,frequency:5,depth:.1,type:"sine"},Object.defineProperty(s.default.Vibrato.prototype,"type",{get:function(){return this._lfo.type},set:function(t){this._lfo.type=t;}}),s.default.Vibrato.prototype.dispose=function(){s.default.Effect.prototype.dispose.call(this),this._delayNode.dispose(),this._delayNode=null,this._lfo.dispose(),this._lfo=null,this._writable(["frequency","depth"]),this.frequency=null,this.depth=null;},e.default=s.default.Vibrato;},function(t,e,i){i.r(e);var s=i(0);i(12),i(15);s.default.Tremolo=function(){var t=s.default.defaults(arguments,["frequency","depth"],s.default.Tremolo);s.default.StereoEffect.call(this,t),this._lfoL=new s.default.LFO({phase:t.spread,min:1,max:0}),this._lfoR=new s.default.LFO({phase:t.spread,min:1,max:0}),this._amplitudeL=new s.default.Gain,this._amplitudeR=new s.default.Gain,this.frequency=new s.default.Signal(t.frequency,s.default.Type.Frequency),this.depth=new s.default.Signal(t.depth,s.default.Type.NormalRange),this._readOnly(["frequency","depth"]),this.effectSendL.chain(this._amplitudeL,this.effectReturnL),this.effectSendR.chain(this._amplitudeR,this.effectReturnR),this._lfoL.connect(this._amplitudeL.gain),this._lfoR.connect(this._amplitudeR.gain),this.frequency.fan(this._lfoL.frequency,this._lfoR.frequency),this.depth.fan(this._lfoR.amplitude,this._lfoL.amplitude),this.type=t.type,this.spread=t.spread;},s.default.extend(s.default.Tremolo,s.default.StereoEffect),s.default.Tremolo.defaults={frequency:10,type:"sine",depth:.5,spread:180},s.default.Tremolo.prototype.start=function(t){return this._lfoL.start(t),this._lfoR.start(t),this},s.default.Tremolo.prototype.stop=function(t){return this._lfoL.stop(t),this._lfoR.stop(t),this},s.default.Tremolo.prototype.sync=function(t){return this._lfoL.sync(t),this._lfoR.sync(t),s.default.Transport.syncSignal(this.frequency),this},s.default.Tremolo.prototype.unsync=function(){return this._lfoL.unsync(),this._lfoR.unsync(),s.default.Transport.unsyncSignal(this.frequency),this},Object.defineProperty(s.default.Tremolo.prototype,"type",{get:function(){return this._lfoL.type},set:function(t){this._lfoL.type=t,this._lfoR.type=t;}}),Object.defineProperty(s.default.Tremolo.prototype,"spread",{get:function(){return this._lfoR.phase-this._lfoL.phase},set:function(t){this._lfoL.phase=90-t/2,this._lfoR.phase=t/2+90;}}),s.default.Tremolo.prototype.dispose=function(){return s.default.StereoEffect.prototype.dispose.call(this),this._writable(["frequency","depth"]),this._lfoL.dispose(),this._lfoL=null,this._lfoR.dispose(),this._lfoR=null,this._amplitudeL.dispose(),this._amplitudeL=null,this._amplitudeR.dispose(),this._amplitudeR=null,this.frequency=null,this.depth=null,this},e.default=s.default.Tremolo;},function(t,e,i){i.r(e);var s=i(0);i(73),i(2),i(5),i(13);s.default.StereoWidener=function(){var t=s.default.defaults(arguments,["width"],s.default.StereoWidener);s.default.MidSideEffect.call(this,t),this.width=new s.default.Signal(t.width,s.default.Type.NormalRange),this._readOnly(["width"]),this._twoTimesWidthMid=new s.default.Multiply(2),this._twoTimesWidthSide=new s.default.Multiply(2),this._midMult=new s.default.Multiply,this._twoTimesWidthMid.connect(this._midMult,0,1),this.midSend.chain(this._midMult,this.midReturn),this._oneMinusWidth=new s.default.Subtract,this._oneMinusWidth.connect(this._twoTimesWidthMid),s.default.connect(this.context.getConstant(1),this._oneMinusWidth,0,0),this.width.connect(this._oneMinusWidth,0,1),this._sideMult=new s.default.Multiply,this.width.connect(this._twoTimesWidthSide),this._twoTimesWidthSide.connect(this._sideMult,0,1),this.sideSend.chain(this._sideMult,this.sideReturn);},s.default.extend(s.default.StereoWidener,s.default.MidSideEffect),s.default.StereoWidener.defaults={width:.5},s.default.StereoWidener.prototype.dispose=function(){return s.default.MidSideEffect.prototype.dispose.call(this),this._writable(["width"]),this.width.dispose(),this.width=null,this._midMult.dispose(),this._midMult=null,this._sideMult.dispose(),this._sideMult=null,this._twoTimesWidthMid.dispose(),this._twoTimesWidthMid=null,this._twoTimesWidthSide.dispose(),this._twoTimesWidthSide=null,this._oneMinusWidth.dispose(),this._oneMinusWidth=null,this},e.default=s.default.StereoWidener;},function(t,e,i){i.r(e);var s=i(0);i(15),i(33),i(3);s.default.StereoFeedbackEffect=function(){var t=s.default.defaults(arguments,["feedback"],s.default.FeedbackEffect);s.default.StereoEffect.call(this,t),this.feedback=new s.default.Signal(t.feedback,s.default.Type.NormalRange),this._feedbackL=new s.default.Gain,this._feedbackR=new s.default.Gain,this.effectReturnL.chain(this._feedbackL,this.effectSendL),this.effectReturnR.chain(this._feedbackR,this.effectSendR),this.feedback.fan(this._feedbackL.gain,this._feedbackR.gain),this._readOnly(["feedback"]);},s.default.extend(s.default.StereoFeedbackEffect,s.default.StereoEffect),s.default.StereoFeedbackEffect.prototype.dispose=function(){return s.default.StereoEffect.prototype.dispose.call(this),this._writable(["feedback"]),this.feedback.dispose(),this.feedback=null,this._feedbackL.dispose(),this._feedbackL=null,this._feedbackR.dispose(),this._feedbackR=null,this},e.default=s.default.StereoFeedbackEffect;},function(t,e,i){i.r(e);var s=i(0);i(77),i(9),i(10),i(39),i(3),i(74);s.default.Reverb=function(){var t=s.default.defaults(arguments,["decay"],s.default.Reverb);s.default.Effect.call(this,t),this._convolver=this.context.createConvolver(),this.decay=t.decay,this.preDelay=t.preDelay,this.connectEffect(this._convolver);},s.default.extend(s.default.Reverb,s.default.Effect),s.default.Reverb.defaults={decay:1.5,preDelay:.01},s.default.Reverb.prototype.generate=function(){return s.default.Offline(function(){var t=new s.default.Noise,e=new s.default.Noise,i=new s.default.Merge;t.connect(i.left),e.connect(i.right);var n=(new s.default.Gain).toMaster();i.connect(n),t.start(0),e.start(0),n.gain.setValueAtTime(0,0),n.gain.setValueAtTime(1,this.preDelay),n.gain.exponentialApproachValueAtTime(0,this.preDelay,this.decay+this.preDelay);}.bind(this),this.decay+this.preDelay).then(function(t){return this._convolver.buffer=t.get(),this}.bind(this))},s.default.Reverb.prototype.dispose=function(){return s.default.Effect.prototype.dispose.call(this),this._convolver.disconnect(),this._convolver=null,this},e.default=s.default.Reverb;},function(t,e,i){i.r(e);var s=i(0);i(12),i(23),i(2),i(33),i(18);s.default.PitchShift=function(){var t=s.default.defaults(arguments,["pitch"],s.default.PitchShift);s.default.FeedbackEffect.call(this,t),this._frequency=new s.default.Signal(0),this._delayA=new s.default.Delay(0,1),this._lfoA=new s.default.LFO({min:0,max:.1,type:"sawtooth"}).connect(this._delayA.delayTime),this._delayB=new s.default.Delay(0,1),this._lfoB=new s.default.LFO({min:0,max:.1,type:"sawtooth",phase:180}).connect(this._delayB.delayTime),this._crossFade=new s.default.CrossFade,this._crossFadeLFO=new s.default.LFO({min:0,max:1,type:"triangle",phase:90}).connect(this._crossFade.fade),this._feedbackDelay=new s.default.Delay(t.delayTime),this.delayTime=this._feedbackDelay.delayTime,this._readOnly("delayTime"),this._pitch=t.pitch,this._windowSize=t.windowSize,this._delayA.connect(this._crossFade.a),this._delayB.connect(this._crossFade.b),this._frequency.fan(this._lfoA.frequency,this._lfoB.frequency,this._crossFadeLFO.frequency),this.effectSend.fan(this._delayA,this._delayB),this._crossFade.chain(this._feedbackDelay,this.effectReturn);var e=this.now();this._lfoA.start(e),this._lfoB.start(e),this._crossFadeLFO.start(e),this.windowSize=this._windowSize;},s.default.extend(s.default.PitchShift,s.default.FeedbackEffect),s.default.PitchShift.defaults={pitch:0,windowSize:.1,delayTime:0,feedback:0},Object.defineProperty(s.default.PitchShift.prototype,"pitch",{get:function(){return this._pitch},set:function(t){this._pitch=t;var e=0;t<0?(this._lfoA.min=0,this._lfoA.max=this._windowSize,this._lfoB.min=0,this._lfoB.max=this._windowSize,e=s.default.intervalToFrequencyRatio(t-1)+1):(this._lfoA.min=this._windowSize,this._lfoA.max=0,this._lfoB.min=this._windowSize,this._lfoB.max=0,e=s.default.intervalToFrequencyRatio(t)-1),this._frequency.value=e*(1.2/this._windowSize);}}),Object.defineProperty(s.default.PitchShift.prototype,"windowSize",{get:function(){return this._windowSize},set:function(t){this._windowSize=this.toSeconds(t),this.pitch=this._pitch;}}),s.default.PitchShift.prototype.dispose=function(){return s.default.FeedbackEffect.prototype.dispose.call(this),this._frequency.dispose(),this._frequency=null,this._delayA.disconnect(),this._delayA=null,this._delayB.disconnect(),this._delayB=null,this._lfoA.dispose(),this._lfoA=null,this._lfoB.dispose(),this._lfoB=null,this._crossFade.dispose(),this._crossFade=null,this._crossFadeLFO.dispose(),this._crossFadeLFO=null,this._writable("delayTime"),this._feedbackDelay.dispose(),this._feedbackDelay=null,this.delayTime=null,this},e.default=s.default.PitchShift;},function(t,e,i){i.r(e);var s=i(0);i(72),i(2),i(18);s.default.PingPongDelay=function(){var t=s.default.defaults(arguments,["delayTime","feedback"],s.default.PingPongDelay);s.default.StereoXFeedbackEffect.call(this,t),this._leftDelay=new s.default.Delay(0,t.maxDelayTime),this._rightDelay=new s.default.Delay(0,t.maxDelayTime),this._rightPreDelay=new s.default.Delay(0,t.maxDelayTime),this.delayTime=new s.default.Signal(t.delayTime,s.default.Type.Time),this.effectSendL.chain(this._leftDelay,this.effectReturnL),this.effectSendR.chain(this._rightPreDelay,this._rightDelay,this.effectReturnR),this.delayTime.fan(this._leftDelay.delayTime,this._rightDelay.delayTime,this._rightPreDelay.delayTime),this._feedbackLR.disconnect(),this._feedbackLR.connect(this._rightDelay),this._readOnly(["delayTime"]);},s.default.extend(s.default.PingPongDelay,s.default.StereoXFeedbackEffect),s.default.PingPongDelay.defaults={delayTime:.25,maxDelayTime:1},s.default.PingPongDelay.prototype.dispose=function(){return s.default.StereoXFeedbackEffect.prototype.dispose.call(this),this._leftDelay.dispose(),this._leftDelay=null,this._rightDelay.dispose(),this._rightDelay=null,this._rightPreDelay.dispose(),this._rightPreDelay=null,this._writable(["delayTime"]),this.delayTime.dispose(),this.delayTime=null,this},e.default=s.default.PingPongDelay;},function(t,e,i){i.r(e);var s=i(0);i(12),i(9),i(15);s.default.Phaser=function(){var t=s.default.defaults(arguments,["frequency","octaves","baseFrequency"],s.default.Phaser);s.default.StereoEffect.call(this,t),this._lfoL=new s.default.LFO(t.frequency,0,1),this._lfoR=new s.default.LFO(t.frequency,0,1),this._lfoR.phase=180,this._baseFrequency=t.baseFrequency,this._octaves=t.octaves,this.Q=new s.default.Signal(t.Q,s.default.Type.Positive),this._filtersL=this._makeFilters(t.stages,this._lfoL,this.Q),this._filtersR=this._makeFilters(t.stages,this._lfoR,this.Q),this.frequency=this._lfoL.frequency,this.frequency.value=t.frequency,this.effectSendL.connect(this._filtersL[0]),this.effectSendR.connect(this._filtersR[0]),s.default.connect(this._filtersL[t.stages-1],this.effectReturnL),s.default.connect(this._filtersR[t.stages-1],this.effectReturnR),this._lfoL.frequency.connect(this._lfoR.frequency),this.baseFrequency=t.baseFrequency,this.octaves=t.octaves,this._lfoL.start(),this._lfoR.start(),this._readOnly(["frequency","Q"]);},s.default.extend(s.default.Phaser,s.default.StereoEffect),s.default.Phaser.defaults={frequency:.5,octaves:3,stages:10,Q:10,baseFrequency:350},s.default.Phaser.prototype._makeFilters=function(t,e,i){for(var n=new Array(t),o=0;o<t;o++){var a=this.context.createBiquadFilter();a.type="allpass",i.connect(a.Q),e.connect(a.frequency),n[o]=a;}return s.default.connectSeries.apply(s.default,n),n},Object.defineProperty(s.default.Phaser.prototype,"octaves",{get:function(){return this._octaves},set:function(t){this._octaves=t;var e=this._baseFrequency*Math.pow(2,t);this._lfoL.max=e,this._lfoR.max=e;}}),Object.defineProperty(s.default.Phaser.prototype,"baseFrequency",{get:function(){return this._baseFrequency},set:function(t){this._baseFrequency=t,this._lfoL.min=t,this._lfoR.min=t,this.octaves=this._octaves;}}),s.default.Phaser.prototype.dispose=function(){s.default.StereoEffect.prototype.dispose.call(this),this._writable(["frequency","Q"]),this.Q.dispose(),this.Q=null,this._lfoL.dispose(),this._lfoL=null,this._lfoR.dispose(),this._lfoR=null;for(var t=0;t<this._filtersL.length;t++)this._filtersL[t].disconnect(),this._filtersL[t]=null;this._filtersL=null;for(var e=0;e<this._filtersR.length;e++)this._filtersR[e].disconnect(),this._filtersR[e]=null;return this._filtersR=null,this.frequency=null,this},e.default=s.default.Phaser;},function(t,e,i){i.r(e);var s=i(0),n=(i(59),i(15),i(26),[.06748,.06404,.08212,.09004]),o=[.773,.802,.753,.733],a=[347,113,37];s.default.JCReverb=function(){var t=s.default.defaults(arguments,["roomSize"],s.default.JCReverb);s.default.StereoEffect.call(this,t),this.roomSize=new s.default.Signal(t.roomSize,s.default.Type.NormalRange),this._scaleRoomSize=new s.default.Scale(-.733,.197),this._allpassFilters=[],this._feedbackCombFilters=[];for(var e=0;e<a.length;e++){var i=this.context.createBiquadFilter();i.type="allpass",i.frequency.value=a[e],this._allpassFilters.push(i);}for(var r=0;r<n.length;r++){var l=new s.default.FeedbackCombFilter(n[r],.1);this._scaleRoomSize.connect(l.resonance),l.resonance.value=o[r],s.default.connect(this._allpassFilters[this._allpassFilters.length-1],l),r<n.length/2?l.connect(this.effectReturnL):l.connect(this.effectReturnR),this._feedbackCombFilters.push(l);}this.roomSize.connect(this._scaleRoomSize),s.default.connectSeries.apply(s.default,this._allpassFilters),this.effectSendL.connect(this._allpassFilters[0]),this.effectSendR.connect(this._allpassFilters[0]),this._readOnly(["roomSize"]);},s.default.extend(s.default.JCReverb,s.default.StereoEffect),s.default.JCReverb.defaults={roomSize:.5},s.default.JCReverb.prototype.dispose=function(){s.default.StereoEffect.prototype.dispose.call(this);for(var t=0;t<this._allpassFilters.length;t++)this._allpassFilters[t].disconnect(),this._allpassFilters[t]=null;this._allpassFilters=null;for(var e=0;e<this._feedbackCombFilters.length;e++)this._feedbackCombFilters[e].dispose(),this._feedbackCombFilters[e]=null;return this._feedbackCombFilters=null,this._writable(["roomSize"]),this.roomSize.dispose(),this.roomSize=null,this._scaleRoomSize.dispose(),this._scaleRoomSize=null,this},e.default=s.default.JCReverb;},function(t,e,i){i.r(e);var s=i(0),n=(i(54),i(15),i(2),i(19),i(10),i(42),[1557/44100,1617/44100,1491/44100,1422/44100,1277/44100,1356/44100,1188/44100,1116/44100]),o=[225,556,441,341];s.default.Freeverb=function(){var t=s.default.defaults(arguments,["roomSize","dampening"],s.default.Freeverb);s.default.StereoEffect.call(this,t),this.roomSize=new s.default.Signal(t.roomSize,s.default.Type.NormalRange),this.dampening=new s.default.Signal(t.dampening,s.default.Type.Frequency),this._combFilters=[],this._allpassFiltersL=[],this._allpassFiltersR=[];for(var e=0;e<o.length;e++){var i=this.context.createBiquadFilter();i.type="allpass",i.frequency.value=o[e],this._allpassFiltersL.push(i);}for(var a=0;a<o.length;a++){var r=this.context.createBiquadFilter();r.type="allpass",r.frequency.value=o[a],this._allpassFiltersR.push(r);}for(var l=0;l<n.length;l++){var u=new s.default.LowpassCombFilter(n[l]);l<n.length/2?this.effectSendL.chain(u,this._allpassFiltersL[0]):this.effectSendR.chain(u,this._allpassFiltersR[0]),this.roomSize.connect(u.resonance),this.dampening.connect(u.dampening),this._combFilters.push(u);}s.default.connectSeries.apply(s.default,this._allpassFiltersL),s.default.connectSeries.apply(s.default,this._allpassFiltersR),s.default.connect(this._allpassFiltersL[this._allpassFiltersL.length-1],this.effectReturnL),s.default.connect(this._allpassFiltersR[this._allpassFiltersR.length-1],this.effectReturnR),this._readOnly(["roomSize","dampening"]);},s.default.extend(s.default.Freeverb,s.default.StereoEffect),s.default.Freeverb.defaults={roomSize:.7,dampening:3e3},s.default.Freeverb.prototype.dispose=function(){s.default.StereoEffect.prototype.dispose.call(this);for(var t=0;t<this._allpassFiltersL.length;t++)this._allpassFiltersL[t].disconnect(),this._allpassFiltersL[t]=null;this._allpassFiltersL=null;for(var e=0;e<this._allpassFiltersR.length;e++)this._allpassFiltersR[e].disconnect(),this._allpassFiltersR[e]=null;this._allpassFiltersR=null;for(var i=0;i<this._combFilters.length;i++)this._combFilters[i].dispose(),this._combFilters[i]=null;return this._combFilters=null,this._writable(["roomSize","dampening"]),this.roomSize.dispose(),this.roomSize=null,this.dampening.dispose(),this.dampening=null,this},e.default=s.default.Freeverb;},function(t,e,i){i.r(e);var s=i(0);i(33),i(2),i(18);s.default.FeedbackDelay=function(){var t=s.default.defaults(arguments,["delayTime","feedback"],s.default.FeedbackDelay);s.default.FeedbackEffect.call(this,t),this._delayNode=new s.default.Delay(t.delayTime,t.maxDelay),this.delayTime=this._delayNode.delayTime,this.connectEffect(this._delayNode),this._readOnly(["delayTime"]);},s.default.extend(s.default.FeedbackDelay,s.default.FeedbackEffect),s.default.FeedbackDelay.defaults={delayTime:.25,maxDelay:1},s.default.FeedbackDelay.prototype.dispose=function(){return s.default.FeedbackEffect.prototype.dispose.call(this),this._delayNode.dispose(),this._delayNode=null,this._writable(["delayTime"]),this.delayTime=null,this},e.default=s.default.FeedbackDelay;},function(t,e,i){i.r(e);var s=i(0);i(8),i(7);s.default.Distortion=function(){var t=s.default.defaults(arguments,["distortion"],s.default.Distortion);s.default.Effect.call(this,t),this._shaper=new s.default.WaveShaper(4096),this._distortion=t.distortion,this.connectEffect(this._shaper),this.distortion=t.distortion,this.oversample=t.oversample;},s.default.extend(s.default.Distortion,s.default.Effect),s.default.Distortion.defaults={distortion:.4,oversample:"none"},Object.defineProperty(s.default.Distortion.prototype,"distortion",{get:function(){return this._distortion},set:function(t){this._distortion=t;var e=100*t,i=Math.PI/180;this._shaper.setMap(function(t){return Math.abs(t)<.001?0:(3+e)*t*20*i/(Math.PI+e*Math.abs(t))});}}),Object.defineProperty(s.default.Distortion.prototype,"oversample",{get:function(){return this._shaper.oversample},set:function(t){this._shaper.oversample=t;}}),s.default.Distortion.prototype.dispose=function(){return s.default.Effect.prototype.dispose.call(this),this._shaper.dispose(),this._shaper=null,this},e.default=s.default.Distortion;},function(t,e,i){i.r(e);var s=i(0);i(12),i(15),i(18);s.default.Chorus=function(){var t=s.default.defaults(arguments,["frequency","delayTime","depth"],s.default.Chorus);s.default.StereoEffect.call(this,t),this._depth=t.depth,this._delayTime=t.delayTime/1e3,this._lfoL=new s.default.LFO({frequency:t.frequency,min:0,max:1}),this._lfoR=new s.default.LFO({frequency:t.frequency,min:0,max:1,phase:180}),this._delayNodeL=new s.default.Delay,this._delayNodeR=new s.default.Delay,this.frequency=this._lfoL.frequency,this.effectSendL.chain(this._delayNodeL,this.effectReturnL),this.effectSendR.chain(this._delayNodeR,this.effectReturnR),this.effectSendL.connect(this.effectReturnL),this.effectSendR.connect(this.effectReturnR),this._lfoL.connect(this._delayNodeL.delayTime),this._lfoR.connect(this._delayNodeR.delayTime),this._lfoL.start(),this._lfoR.start(),this._lfoL.frequency.connect(this._lfoR.frequency),this.depth=this._depth,this.frequency.value=t.frequency,this.type=t.type,this._readOnly(["frequency"]),this.spread=t.spread;},s.default.extend(s.default.Chorus,s.default.StereoEffect),s.default.Chorus.defaults={frequency:1.5,delayTime:3.5,depth:.7,type:"sine",spread:180},Object.defineProperty(s.default.Chorus.prototype,"depth",{get:function(){return this._depth},set:function(t){this._depth=t;var e=this._delayTime*t;this._lfoL.min=Math.max(this._delayTime-e,0),this._lfoL.max=this._delayTime+e,this._lfoR.min=Math.max(this._delayTime-e,0),this._lfoR.max=this._delayTime+e;}}),Object.defineProperty(s.default.Chorus.prototype,"delayTime",{get:function(){return 1e3*this._delayTime},set:function(t){this._delayTime=t/1e3,this.depth=this._depth;}}),Object.defineProperty(s.default.Chorus.prototype,"type",{get:function(){return this._lfoL.type},set:function(t){this._lfoL.type=t,this._lfoR.type=t;}}),Object.defineProperty(s.default.Chorus.prototype,"spread",{get:function(){return this._lfoR.phase-this._lfoL.phase},set:function(t){this._lfoL.phase=90-t/2,this._lfoR.phase=t/2+90;}}),s.default.Chorus.prototype.dispose=function(){return s.default.StereoEffect.prototype.dispose.call(this),this._lfoL.dispose(),this._lfoL=null,this._lfoR.dispose(),this._lfoR=null,this._delayNodeL.dispose(),this._delayNodeL=null,this._delayNodeR.dispose(),this._delayNodeR=null,this._writable("frequency"),this.frequency=null,this},e.default=s.default.Chorus;},function(t,e,i){i.r(e);var s=i(0);i(8),i(7);s.default.Chebyshev=function(){var t=s.default.defaults(arguments,["order"],s.default.Chebyshev);s.default.Effect.call(this,t),this._shaper=new s.default.WaveShaper(4096),this._order=t.order,this.connectEffect(this._shaper),this.order=t.order,this.oversample=t.oversample;},s.default.extend(s.default.Chebyshev,s.default.Effect),s.default.Chebyshev.defaults={order:1,oversample:"none"},s.default.Chebyshev.prototype._getCoefficient=function(t,e,i){return i.hasOwnProperty(e)?i[e]:(i[e]=0===e?0:1===e?t:2*t*this._getCoefficient(t,e-1,i)-this._getCoefficient(t,e-2,i),i[e])},Object.defineProperty(s.default.Chebyshev.prototype,"order",{get:function(){return this._order},set:function(t){this._order=t;for(var e=new Array(4096),i=e.length,s=0;s<i;++s){var n=2*s/i-1;e[s]=0===n?0:this._getCoefficient(n,t,{});}this._shaper.curve=e;}}),Object.defineProperty(s.default.Chebyshev.prototype,"oversample",{get:function(){return this._shaper.oversample},set:function(t){this._shaper.oversample=t;}}),s.default.Chebyshev.prototype.dispose=function(){return s.default.Effect.prototype.dispose.call(this),this._shaper.dispose(),this._shaper=null,this},e.default=s.default.Chebyshev;},function(t,e,i){i.r(e);var s=i(0);i(8),i(13),i(75);s.default.BitCrusher=function(){var t=s.default.defaults(arguments,["bits"],s.default.BitCrusher);s.default.Effect.call(this,t);var e=1/Math.pow(2,t.bits-1);this._subtract=new s.default.Subtract,this._modulo=new s.default.Modulo(e),this._bits=t.bits,this.effectSend.fan(this._subtract,this._modulo),this._modulo.connect(this._subtract,0,1),this._subtract.connect(this.effectReturn);},s.default.extend(s.default.BitCrusher,s.default.Effect),s.default.BitCrusher.defaults={bits:4},Object.defineProperty(s.default.BitCrusher.prototype,"bits",{get:function(){return this._bits},set:function(t){this._bits=t;var e=1/Math.pow(2,t-1);this._modulo.value=e;}}),s.default.BitCrusher.prototype.dispose=function(){return s.default.Effect.prototype.dispose.call(this),this._subtract.dispose(),this._subtract=null,this._modulo.dispose(),this._modulo=null,this},e.default=s.default.BitCrusher;},function(t,e,i){i.r(e);var s=i(0);i(58),i(42),i(8),i(9);s.default.AutoWah=function(){var t=s.default.defaults(arguments,["baseFrequency","octaves","sensitivity"],s.default.AutoWah);s.default.Effect.call(this,t),this.follower=new s.default.Follower(t.follower),this._sweepRange=new s.default.ScaleExp(0,1,.5),this._baseFrequency=t.baseFrequency,this._octaves=t.octaves,this._inputBoost=new s.default.Gain,this._bandpass=new s.default.Filter({rolloff:-48,frequency:0,Q:t.Q}),this._peaking=new s.default.Filter(0,"peaking"),this._peaking.gain.value=t.gain,this.gain=this._peaking.gain,this.Q=this._bandpass.Q,this.effectSend.chain(this._inputBoost,this.follower,this._sweepRange),this._sweepRange.connect(this._bandpass.frequency),this._sweepRange.connect(this._peaking.frequency),this.effectSend.chain(this._bandpass,this._peaking,this.effectReturn),this._setSweepRange(),this.sensitivity=t.sensitivity,this._readOnly(["gain","Q"]);},s.default.extend(s.default.AutoWah,s.default.Effect),s.default.AutoWah.defaults={baseFrequency:100,octaves:6,sensitivity:0,Q:2,gain:2,follower:{attack:.3,release:.5}},Object.defineProperty(s.default.AutoWah.prototype,"octaves",{get:function(){return this._octaves},set:function(t){this._octaves=t,this._setSweepRange();}}),Object.defineProperty(s.default.AutoWah.prototype,"baseFrequency",{get:function(){return this._baseFrequency},set:function(t){this._baseFrequency=t,this._setSweepRange();}}),Object.defineProperty(s.default.AutoWah.prototype,"sensitivity",{get:function(){return s.default.gainToDb(1/this._inputBoost.gain.value)},set:function(t){this._inputBoost.gain.value=1/s.default.dbToGain(t);}}),s.default.AutoWah.prototype._setSweepRange=function(){this._sweepRange.min=this._baseFrequency,this._sweepRange.max=Math.min(this._baseFrequency*Math.pow(2,this._octaves),this.context.sampleRate/2);},s.default.AutoWah.prototype.dispose=function(){return s.default.Effect.prototype.dispose.call(this),this.follower.dispose(),this.follower=null,this._sweepRange.dispose(),this._sweepRange=null,this._bandpass.dispose(),this._bandpass=null,this._peaking.dispose(),this._peaking=null,this._inputBoost.dispose(),this._inputBoost=null,this._writable(["gain","Q"]),this.gain=null,this.Q=null,this},e.default=s.default.AutoWah;},function(t,e,i){i.r(e);var s=i(0);i(8),i(12),i(48);s.default.AutoPanner=function(){var t=s.default.defaults(arguments,["frequency"],s.default.AutoPanner);s.default.Effect.call(this,t),this._lfo=new s.default.LFO({frequency:t.frequency,amplitude:t.depth,min:-1,max:1}),this.depth=this._lfo.amplitude,this._panner=new s.default.Panner,this.frequency=this._lfo.frequency,this.connectEffect(this._panner),this._lfo.connect(this._panner.pan),this.type=t.type,this._readOnly(["depth","frequency"]);},s.default.extend(s.default.AutoPanner,s.default.Effect),s.default.AutoPanner.defaults={frequency:1,type:"sine",depth:1},s.default.AutoPanner.prototype.start=function(t){return this._lfo.start(t),this},s.default.AutoPanner.prototype.stop=function(t){return this._lfo.stop(t),this},s.default.AutoPanner.prototype.sync=function(t){return this._lfo.sync(t),this},s.default.AutoPanner.prototype.unsync=function(){return this._lfo.unsync(),this},Object.defineProperty(s.default.AutoPanner.prototype,"type",{get:function(){return this._lfo.type},set:function(t){this._lfo.type=t;}}),s.default.AutoPanner.prototype.dispose=function(){return s.default.Effect.prototype.dispose.call(this),this._lfo.dispose(),this._lfo=null,this._panner.dispose(),this._panner=null,this._writable(["depth","frequency"]),this.frequency=null,this.depth=null,this},e.default=s.default.AutoPanner;},function(t,e,i){i.r(e);var s=i(0);i(8),i(12),i(9);s.default.AutoFilter=function(){var t=s.default.defaults(arguments,["frequency","baseFrequency","octaves"],s.default.AutoFilter);s.default.Effect.call(this,t),this._lfo=new s.default.LFO({frequency:t.frequency,amplitude:t.depth}),this.depth=this._lfo.amplitude,this.frequency=this._lfo.frequency,this.filter=new s.default.Filter(t.filter),this._octaves=0,this.connectEffect(this.filter),this._lfo.connect(this.filter.frequency),this.type=t.type,this._readOnly(["frequency","depth"]),this.octaves=t.octaves,this.baseFrequency=t.baseFrequency;},s.default.extend(s.default.AutoFilter,s.default.Effect),s.default.AutoFilter.defaults={frequency:1,type:"sine",depth:1,baseFrequency:200,octaves:2.6,filter:{type:"lowpass",rolloff:-12,Q:1}},s.default.AutoFilter.prototype.start=function(t){return this._lfo.start(t),this},s.default.AutoFilter.prototype.stop=function(t){return this._lfo.stop(t),this},s.default.AutoFilter.prototype.sync=function(t){return this._lfo.sync(t),this},s.default.AutoFilter.prototype.unsync=function(){return this._lfo.unsync(),this},Object.defineProperty(s.default.AutoFilter.prototype,"type",{get:function(){return this._lfo.type},set:function(t){this._lfo.type=t;}}),Object.defineProperty(s.default.AutoFilter.prototype,"baseFrequency",{get:function(){return this._lfo.min},set:function(t){this._lfo.min=this.toFrequency(t),this.octaves=this._octaves;}}),Object.defineProperty(s.default.AutoFilter.prototype,"octaves",{get:function(){return this._octaves},set:function(t){this._octaves=t,this._lfo.max=this.baseFrequency*Math.pow(2,t);}}),s.default.AutoFilter.prototype.dispose=function(){return s.default.Effect.prototype.dispose.call(this),this._lfo.dispose(),this._lfo=null,this.filter.dispose(),this.filter=null,this._writable(["frequency","depth"]),this.frequency=null,this.depth=null,this},e.default=s.default.AutoFilter;},function(t,e,i){i.r(e);var s=i(0);i(23),i(10),i(19),i(2),i(22),i(28);s.default.Listener=function(){s.default.call(this),this._orientation=[0,0,0,0,0,0],this._position=[0,0,0],s.default.getContext(function(){this.set(n.defaults);}.bind(this));},s.default.extend(s.default.Listener),s.default.Listener.defaults={positionX:0,positionY:0,positionZ:0,forwardX:0,forwardY:0,forwardZ:1,upX:0,upY:1,upZ:0},s.default.Listener.prototype.isListener=!0,s.default.Listener.prototype._rampTimeConstant=.01,s.default.Listener.prototype.setPosition=function(t,e,i){if(this.context.rawContext.listener.positionX){var s=this.now();this.context.rawContext.listener.positionX.setTargetAtTime(t,s,this._rampTimeConstant),this.context.rawContext.listener.positionY.setTargetAtTime(e,s,this._rampTimeConstant),this.context.rawContext.listener.positionZ.setTargetAtTime(i,s,this._rampTimeConstant);}else this.context.rawContext.listener.setPosition(t,e,i);return this._position=Array.prototype.slice.call(arguments),this},s.default.Listener.prototype.setOrientation=function(t,e,i,s,n,o){if(this.context.rawContext.listener.forwardX){var a=this.now();this.context.rawContext.listener.forwardX.setTargetAtTime(t,a,this._rampTimeConstant),this.context.rawContext.listener.forwardY.setTargetAtTime(e,a,this._rampTimeConstant),this.context.rawContext.listener.forwardZ.setTargetAtTime(i,a,this._rampTimeConstant),this.context.rawContext.listener.upX.setTargetAtTime(s,a,this._rampTimeConstant),this.context.rawContext.listener.upY.setTargetAtTime(n,a,this._rampTimeConstant),this.context.rawContext.listener.upZ.setTargetAtTime(o,a,this._rampTimeConstant);}else this.context.rawContext.listener.setOrientation(t,e,i,s,n,o);return this._orientation=Array.prototype.slice.call(arguments),this},Object.defineProperty(s.default.Listener.prototype,"positionX",{set:function(t){this._position[0]=t,this.setPosition.apply(this,this._position);},get:function(){return this._position[0]}}),Object.defineProperty(s.default.Listener.prototype,"positionY",{set:function(t){this._position[1]=t,this.setPosition.apply(this,this._position);},get:function(){return this._position[1]}}),Object.defineProperty(s.default.Listener.prototype,"positionZ",{set:function(t){this._position[2]=t,this.setPosition.apply(this,this._position);},get:function(){return this._position[2]}}),Object.defineProperty(s.default.Listener.prototype,"forwardX",{set:function(t){this._orientation[0]=t,this.setOrientation.apply(this,this._orientation);},get:function(){return this._orientation[0]}}),Object.defineProperty(s.default.Listener.prototype,"forwardY",{set:function(t){this._orientation[1]=t,this.setOrientation.apply(this,this._orientation);},get:function(){return this._orientation[1]}}),Object.defineProperty(s.default.Listener.prototype,"forwardZ",{set:function(t){this._orientation[2]=t,this.setOrientation.apply(this,this._orientation);},get:function(){return this._orientation[2]}}),Object.defineProperty(s.default.Listener.prototype,"upX",{set:function(t){this._orientation[3]=t,this.setOrientation.apply(this,this._orientation);},get:function(){return this._orientation[3]}}),Object.defineProperty(s.default.Listener.prototype,"upY",{set:function(t){this._orientation[4]=t,this.setOrientation.apply(this,this._orientation);},get:function(){return this._orientation[4]}}),Object.defineProperty(s.default.Listener.prototype,"upZ",{set:function(t){this._orientation[5]=t,this.setOrientation.apply(this,this._orientation);},get:function(){return this._orientation[5]}}),s.default.Listener.prototype.dispose=function(){return this._orientation=null,this._position=null,this};var n=s.default.Listener;s.default.Listener=new n,s.default.Context.on("init",function(t){t.listener&&t.listener.isListener?s.default.Listener=t.listener:s.default.Listener=new n;}),e.default=s.default.Listener;},function(t,e,i){i.r(e);var s=i(0);i(24);s.default.Draw=function(){s.default.call(this),this._events=new s.default.Timeline,this.expiration=.25,this.anticipation=.008,this._boundDrawLoop=this._drawLoop.bind(this);},s.default.extend(s.default.Draw),s.default.Draw.prototype.schedule=function(t,e){return this._events.add({callback:t,time:this.toSeconds(e)}),1===this._events.length&&requestAnimationFrame(this._boundDrawLoop),this},s.default.Draw.prototype.cancel=function(t){return this._events.cancel(this.toSeconds(t)),this},s.default.Draw.prototype._drawLoop=function(){for(var t=s.default.context.currentTime;this._events.length&&this._events.peek().time-this.anticipation<=t;){var e=this._events.shift();t-e.time<=this.expiration&&e.callback();}this._events.length>0&&requestAnimationFrame(this._boundDrawLoop);},s.default.Draw=new s.default.Draw,e.default=s.default.Draw;},function(t,e,i){i.r(e);var s=i(0),n=(i(3),{});s.default.prototype.send=function(t,e){n.hasOwnProperty(t)||(n[t]=this.context.createGain()),e=s.default.defaultArg(e,0);var i=new s.default.Gain(e,s.default.Type.Decibels);return this.connect(i),i.connect(n[t]),i},s.default.prototype.receive=function(t,e){return n.hasOwnProperty(t)||(n[t]=this.context.createGain()),s.default.connect(n[t],this,0,e),this},s.default.Context.on("init",function(t){t.buses?n=t.buses:(n={},t.buses=n);}),e.default=s.default;},function(t,e,i){i.r(e);var s=i(0);i(4);s.default.CtrlRandom=function(){var t=s.default.defaults(arguments,["min","max"],s.default.CtrlRandom);s.default.call(this),this.min=t.min,this.max=t.max,this.integer=t.integer;},s.default.extend(s.default.CtrlRandom),s.default.CtrlRandom.defaults={min:0,max:1,integer:!1},Object.defineProperty(s.default.CtrlRandom.prototype,"value",{get:function(){var t=this.toSeconds(this.min),e=this.toSeconds(this.max),i=Math.random(),s=i*t+(1-i)*e;return this.integer&&(s=Math.floor(s)),s}}),e.default=s.default.CtrlRandom;},function(t,e,i){i.r(e);var s=i(0);s.default.CtrlMarkov=function(t,e){s.default.call(this),this.values=s.default.defaultArg(t,{}),this.value=s.default.defaultArg(e,Object.keys(this.values)[0]);},s.default.extend(s.default.CtrlMarkov),s.default.CtrlMarkov.prototype.next=function(){if(this.values.hasOwnProperty(this.value)){var t=this.values[this.value];if(s.default.isArray(t))for(var e=this._getProbDistribution(t),i=Math.random(),n=0,o=0;o<e.length;o++){var a=e[o];if(i>n&&i<n+a){var r=t[o];s.default.isObject(r)?this.value=r.value:this.value=r;}n+=a;}else this.value=t;}return this.value},s.default.CtrlMarkov.prototype._getProbDistribution=function(t){for(var e=[],i=0,n=!1,o=0;o<t.length;o++){var a=t[o];s.default.isObject(a)?(n=!0,e[o]=a.probability):e[o]=1/t.length,i+=e[o];}if(n)for(var r=0;r<e.length;r++)e[r]=e[r]/i;return e},s.default.CtrlMarkov.prototype.dispose=function(){this.values=null;},e.default=s.default.CtrlMarkov;},function(t,e,i){i.r(e);var s=i(0);i(4);s.default.CtrlInterpolate=function(){var t=s.default.defaults(arguments,["values","index"],s.default.CtrlInterpolate);s.default.call(this),this.values=t.values,this.index=t.index;},s.default.extend(s.default.CtrlInterpolate),s.default.CtrlInterpolate.defaults={index:0,values:[]},Object.defineProperty(s.default.CtrlInterpolate.prototype,"value",{get:function(){var t=this.index;t=Math.min(t,this.values.length-1);var e=Math.floor(t),i=this.values[e],s=this.values[Math.ceil(t)];return this._interpolate(t-e,i,s)}}),s.default.CtrlInterpolate.prototype._interpolate=function(t,e,i){if(s.default.isArray(e)){for(var n=[],o=0;o<e.length;o++)n[o]=this._interpolate(t,e[o],i[o]);return n}if(s.default.isObject(e)){var a={};for(var r in e)a[r]=this._interpolate(t,e[r],i[r]);return a}return (1-t)*(e=this._toNumber(e))+t*(i=this._toNumber(i))},s.default.CtrlInterpolate.prototype._toNumber=function(t){return s.default.isNumber(t)?t:this.toSeconds(t)},s.default.CtrlInterpolate.prototype.dispose=function(){this.values=null;},e.default=s.default.CtrlInterpolate;},function(t,e,i){i.r(e);var s=i(0);i(36),i(1);s.default.Waveform=function(){var t=s.default.defaults(arguments,["size"],s.default.Waveform);t.type=s.default.Analyser.Type.Waveform,s.default.AudioNode.call(this),this._analyser=this.input=this.output=new s.default.Analyser(t);},s.default.extend(s.default.Waveform,s.default.AudioNode),s.default.Waveform.defaults={size:1024},s.default.Waveform.prototype.getValue=function(){return this._analyser.getValue()},Object.defineProperty(s.default.Waveform.prototype,"size",{get:function(){return this._analyser.size},set:function(t){this._analyser.size=t;}}),s.default.Waveform.prototype.dispose=function(){s.default.AudioNode.prototype.dispose.call(this),this._analyser.dispose(),this._analyser=null;},e.default=s.default.Waveform;},function(t,e,i){i.r(e);var s=i(0);i(23),i(10),i(19),i(2),i(22),i(28),i(1);s.default.Panner3D=function(){var t=s.default.defaults(arguments,["positionX","positionY","positionZ"],s.default.Panner3D);s.default.AudioNode.call(this),this._panner=this.input=this.output=this.context.createPanner(),this._panner.panningModel=t.panningModel,this._panner.maxDistance=t.maxDistance,this._panner.distanceModel=t.distanceModel,this._panner.coneOuterGain=t.coneOuterGain,this._panner.coneOuterAngle=t.coneOuterAngle,this._panner.coneInnerAngle=t.coneInnerAngle,this._panner.refDistance=t.refDistance,this._panner.rolloffFactor=t.rolloffFactor,this._orientation=[t.orientationX,t.orientationY,t.orientationZ],this._position=[t.positionX,t.positionY,t.positionZ],this.orientationX=t.orientationX,this.orientationY=t.orientationY,this.orientationZ=t.orientationZ,this.positionX=t.positionX,this.positionY=t.positionY,this.positionZ=t.positionZ;},s.default.extend(s.default.Panner3D,s.default.AudioNode),s.default.Panner3D.defaults={positionX:0,positionY:0,positionZ:0,orientationX:0,orientationY:0,orientationZ:0,panningModel:"equalpower",maxDistance:1e4,distanceModel:"inverse",coneOuterGain:0,coneOuterAngle:360,coneInnerAngle:360,refDistance:1,rolloffFactor:1},s.default.Panner3D.prototype._rampTimeConstant=.01,s.default.Panner3D.prototype.setPosition=function(t,e,i){if(this._panner.positionX){var s=this.now();this._panner.positionX.setTargetAtTime(t,s,this._rampTimeConstant),this._panner.positionY.setTargetAtTime(e,s,this._rampTimeConstant),this._panner.positionZ.setTargetAtTime(i,s,this._rampTimeConstant);}else this._panner.setPosition(t,e,i);return this._position=Array.prototype.slice.call(arguments),this},s.default.Panner3D.prototype.setOrientation=function(t,e,i){if(this._panner.orientationX){var s=this.now();this._panner.orientationX.setTargetAtTime(t,s,this._rampTimeConstant),this._panner.orientationY.setTargetAtTime(e,s,this._rampTimeConstant),this._panner.orientationZ.setTargetAtTime(i,s,this._rampTimeConstant);}else this._panner.setOrientation(t,e,i);return this._orientation=Array.prototype.slice.call(arguments),this},Object.defineProperty(s.default.Panner3D.prototype,"positionX",{set:function(t){this._position[0]=t,this.setPosition.apply(this,this._position);},get:function(){return this._position[0]}}),Object.defineProperty(s.default.Panner3D.prototype,"positionY",{set:function(t){this._position[1]=t,this.setPosition.apply(this,this._position);},get:function(){return this._position[1]}}),Object.defineProperty(s.default.Panner3D.prototype,"positionZ",{set:function(t){this._position[2]=t,this.setPosition.apply(this,this._position);},get:function(){return this._position[2]}}),Object.defineProperty(s.default.Panner3D.prototype,"orientationX",{set:function(t){this._orientation[0]=t,this.setOrientation.apply(this,this._orientation);},get:function(){return this._orientation[0]}}),Object.defineProperty(s.default.Panner3D.prototype,"orientationY",{set:function(t){this._orientation[1]=t,this.setOrientation.apply(this,this._orientation);},get:function(){return this._orientation[1]}}),Object.defineProperty(s.default.Panner3D.prototype,"orientationZ",{set:function(t){this._orientation[2]=t,this.setOrientation.apply(this,this._orientation);},get:function(){return this._orientation[2]}}),s.default.Panner3D._aliasProperty=function(t){Object.defineProperty(s.default.Panner3D.prototype,t,{set:function(e){this._panner[t]=e;},get:function(){return this._panner[t]}});},s.default.Panner3D._aliasProperty("panningModel"),s.default.Panner3D._aliasProperty("refDistance"),s.default.Panner3D._aliasProperty("rolloffFactor"),s.default.Panner3D._aliasProperty("distanceModel"),s.default.Panner3D._aliasProperty("coneInnerAngle"),s.default.Panner3D._aliasProperty("coneOuterAngle"),s.default.Panner3D._aliasProperty("coneOuterGain"),s.default.Panner3D._aliasProperty("maxDistance"),s.default.Panner3D.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._panner.disconnect(),this._panner=null,this._orientation=null,this._position=null,this},e.default=s.default.Panner3D;},function(t,e,i){i.r(e);var s=i(0);i(60),i(43),i(1);s.default.MultibandCompressor=function(t){s.default.AudioNode.call(this),t=s.default.defaultArg(arguments,s.default.MultibandCompressor.defaults),this._splitter=this.input=new s.default.MultibandSplit({lowFrequency:t.lowFrequency,highFrequency:t.highFrequency}),this.lowFrequency=this._splitter.lowFrequency,this.highFrequency=this._splitter.highFrequency,this.output=new s.default.Gain,this.low=new s.default.Compressor(t.low),this.mid=new s.default.Compressor(t.mid),this.high=new s.default.Compressor(t.high),this._splitter.low.chain(this.low,this.output),this._splitter.mid.chain(this.mid,this.output),this._splitter.high.chain(this.high,this.output),this._readOnly(["high","mid","low","highFrequency","lowFrequency"]);},s.default.extend(s.default.MultibandCompressor,s.default.AudioNode),s.default.MultibandCompressor.defaults={low:s.default.Compressor.defaults,mid:s.default.Compressor.defaults,high:s.default.Compressor.defaults,lowFrequency:250,highFrequency:2e3},s.default.MultibandCompressor.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._splitter.dispose(),this._writable(["high","mid","low","highFrequency","lowFrequency"]),this.low.dispose(),this.mid.dispose(),this.high.dispose(),this._splitter=null,this.low=null,this.mid=null,this.high=null,this.lowFrequency=null,this.highFrequency=null,this},e.default=s.default.MultibandCompressor;},function(t,e,i){i.r(e);var s=i(0);i(10),i(1);s.default.Mono=function(){s.default.AudioNode.call(this),this.createInsOuts(1,0),this._merge=this.output=new s.default.Merge,s.default.connect(this.input,this._merge,0,0),s.default.connect(this.input,this._merge,0,1);},s.default.extend(s.default.Mono,s.default.AudioNode),s.default.Mono.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._merge.dispose(),this._merge=null,this},e.default=s.default.Mono;},function(t,e,i){i.r(e);var s=i(0);i(53),i(52),i(43),i(1);s.default.MidSideCompressor=function(t){s.default.AudioNode.call(this),t=s.default.defaultArg(t,s.default.MidSideCompressor.defaults),this._midSideSplit=this.input=new s.default.MidSideSplit,this._midSideMerge=this.output=new s.default.MidSideMerge,this.mid=new s.default.Compressor(t.mid),this.side=new s.default.Compressor(t.side),this._midSideSplit.mid.chain(this.mid,this._midSideMerge.mid),this._midSideSplit.side.chain(this.side,this._midSideMerge.side),this._readOnly(["mid","side"]);},s.default.extend(s.default.MidSideCompressor,s.default.AudioNode),s.default.MidSideCompressor.defaults={mid:{ratio:3,threshold:-24,release:.03,attack:.02,knee:16},side:{ratio:6,threshold:-30,release:.25,attack:.03,knee:10}},s.default.MidSideCompressor.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._writable(["mid","side"]),this.mid.dispose(),this.mid=null,this.side.dispose(),this.side=null,this._midSideSplit.dispose(),this._midSideSplit=null,this._midSideMerge.dispose(),this._midSideMerge=null,this},e.default=s.default.MidSideCompressor;},function(t,e,i){i.r(e);var s=i(0);i(36),i(1);s.default.Meter=function(){var t=s.default.defaults(arguments,["smoothing"],s.default.Meter);s.default.AudioNode.call(this),this.smoothing=t.smoothing,this._rms=0,this.input=this.output=this._analyser=new s.default.Analyser("waveform",256);},s.default.extend(s.default.Meter,s.default.AudioNode),s.default.Meter.defaults={smoothing:.8},s.default.Meter.prototype.getLevel=function(){for(var t=this._analyser.getValue(),e=0,i=0;i<t.length;i++){var n=t[i];e+=n*n;}var o=Math.sqrt(e/t.length);return this._rms=Math.max(o,this._rms*this.smoothing),s.default.gainToDb(this._rms)},s.default.Meter.prototype.getValue=function(){return this._analyser.getValue()[0]},s.default.Meter.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._analyser.dispose(),this._analyser=null,this},e.default=s.default.Meter;},function(t,e,i){i.r(e);var s=i(0);i(43),i(1);s.default.Limiter=function(){var t=s.default.defaults(arguments,["threshold"],s.default.Limiter);s.default.AudioNode.call(this),this._compressor=this.input=this.output=new s.default.Compressor({attack:.001,decay:.001,threshold:t.threshold}),this.threshold=this._compressor.threshold,this._readOnly("threshold");},s.default.extend(s.default.Limiter,s.default.AudioNode),s.default.Limiter.defaults={threshold:-12},s.default.Limiter.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._compressor.dispose(),this._compressor=null,this._writable("threshold"),this.threshold=null,this},e.default=s.default.Limiter;},function(t,e,i){i.r(e);var s=i(0);i(58),i(85),i(1);s.default.Gate=function(){var t=s.default.defaults(arguments,["threshold","smoothing"],s.default.Gate);s.default.AudioNode.call(this),this.createInsOuts(1,1),this._follower=new s.default.Follower(t.smoothing),this._gt=new s.default.GreaterThan(s.default.dbToGain(t.threshold)),s.default.connect(this.input,this.output),s.default.connectSeries(this.input,this._follower,this._gt,this.output.gain);},s.default.extend(s.default.Gate,s.default.AudioNode),s.default.Gate.defaults={smoothing:.1,threshold:-40},Object.defineProperty(s.default.Gate.prototype,"threshold",{get:function(){return s.default.gainToDb(this._gt.value)},set:function(t){this._gt.value=s.default.dbToGain(t);}}),Object.defineProperty(s.default.Gate.prototype,"smoothing",{get:function(){return this._follower.smoothing},set:function(t){this._follower.smoothing=t;}}),s.default.Gate.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._follower.dispose(),this._gt.dispose(),this._follower=null,this._gt=null,this},e.default=s.default.Gate;},function(t,e,i){i.r(e);var s=i(0);i(36),i(1);s.default.FFT=function(){var t=s.default.defaults(arguments,["size"],s.default.FFT);t.type=s.default.Analyser.Type.FFT,s.default.AudioNode.call(this),this._analyser=this.input=this.output=new s.default.Analyser(t);},s.default.extend(s.default.FFT,s.default.AudioNode),s.default.FFT.defaults={size:1024},s.default.FFT.prototype.getValue=function(){return this._analyser.getValue()},Object.defineProperty(s.default.FFT.prototype,"size",{get:function(){return this._analyser.size},set:function(t){this._analyser.size=t;}}),s.default.FFT.prototype.dispose=function(){s.default.AudioNode.prototype.dispose.call(this),this._analyser.dispose(),this._analyser=null;},e.default=s.default.FFT;},function(t,e,i){i.r(e);var s=i(0);i(60),i(3),i(1);s.default.EQ3=function(){var t=s.default.defaults(arguments,["low","mid","high"],s.default.EQ3);s.default.AudioNode.call(this),this.output=new s.default.Gain,this._multibandSplit=this.input=new s.default.MultibandSplit({lowFrequency:t.lowFrequency,highFrequency:t.highFrequency}),this._lowGain=new s.default.Gain(t.low,s.default.Type.Decibels),this._midGain=new s.default.Gain(t.mid,s.default.Type.Decibels),this._highGain=new s.default.Gain(t.high,s.default.Type.Decibels),this.low=this._lowGain.gain,this.mid=this._midGain.gain,this.high=this._highGain.gain,this.Q=this._multibandSplit.Q,this.lowFrequency=this._multibandSplit.lowFrequency,this.highFrequency=this._multibandSplit.highFrequency,this._multibandSplit.low.chain(this._lowGain,this.output),this._multibandSplit.mid.chain(this._midGain,this.output),this._multibandSplit.high.chain(this._highGain,this.output),this._readOnly(["low","mid","high","lowFrequency","highFrequency"]);},s.default.extend(s.default.EQ3,s.default.AudioNode),s.default.EQ3.defaults={low:0,mid:0,high:0,lowFrequency:400,highFrequency:2500},s.default.EQ3.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._writable(["low","mid","high","lowFrequency","highFrequency"]),this._multibandSplit.dispose(),this._multibandSplit=null,this.lowFrequency=null,this.highFrequency=null,this._lowGain.dispose(),this._lowGain=null,this._midGain.dispose(),this._midGain=null,this._highGain.dispose(),this._highGain=null,this.low=null,this.mid=null,this.high=null,this.Q=null,this},e.default=s.default.EQ3;},function(t,e,i){i.r(e);var s=i(0);i(91),i(88),i(1);s.default.Channel=function(){var t=s.default.defaults(arguments,["volume","pan"],s.default.PanVol);s.default.AudioNode.call(this,t),this._solo=this.input=new s.default.Solo(t.solo),this._panVol=this.output=new s.default.PanVol({pan:t.pan,volume:t.volume,mute:t.mute}),this.pan=this._panVol.pan,this.volume=this._panVol.volume,this._solo.connect(this._panVol),this._readOnly(["pan","volume"]);},s.default.extend(s.default.Channel,s.default.AudioNode),s.default.Channel.defaults={pan:0,volume:0,mute:!1,solo:!1},Object.defineProperty(s.default.Channel.prototype,"solo",{get:function(){return this._solo.solo},set:function(t){this._solo.solo=t;}}),Object.defineProperty(s.default.Channel.prototype,"muted",{get:function(){return this._solo.muted||this.mute}}),Object.defineProperty(s.default.Channel.prototype,"mute",{get:function(){return this._panVol.mute},set:function(t){this._panVol.mute=t;}}),s.default.Channel.prototype.dispose=function(){return s.default.AudioNode.prototype.dispose.call(this),this._writable(["pan","volume"]),this._panVol.dispose(),this._panVol=null,this.pan=null,this.volume=null,this._solo.dispose(),this._solo=null,this},e.default=s.default.Channel;},function(t,e){var i;i=function(){return this}();try{i=i||Function("return this")()||(0,eval)("this");}catch(t){"object"==typeof window&&(i=window);}t.exports=i;},function(t,e,i){i(31),i(36),i(146),i(43),i(23),i(47),i(145),i(59),i(144),i(9),i(58),i(41),i(143),i(12),i(142),i(54),i(10),i(141),i(140),i(52),i(53),i(139),i(138),i(60),i(48),i(137),i(91),i(86),i(88),i(19),i(27),i(136),i(135),i(134),i(79),i(133),i(1),i(11),i(78),i(132),i(83),i(20),i(18),i(131),i(35),i(3),i(81),i(130),i(40),i(77),i(76),i(14),i(24),i(34),i(16),i(56),i(80),i(129),i(128),i(127),i(126),i(125),i(124),i(74),i(123),i(8),i(122),i(33),i(121),i(120),i(73),i(119),i(118),i(117),i(116),i(15),i(115),i(114),i(72),i(113),i(112),i(51),i(71),i(70),i(111),i(110),i(109),i(108),i(107),i(21),i(106),i(105),i(25),i(66),i(104),i(103),i(102),i(101),i(38),i(87),i(29),i(22),i(89),i(100),i(85),i(84),i(75),i(5),i(90),i(99),i(61),i(26),i(42),i(2),i(30),i(13),i(82),i(98),i(7),i(28),i(68),i(32),i(67),i(49),i(97),i(39),i(37),i(17),i(64),i(65),i(96),i(50),i(69),i(6),i(57),i(95),i(46),i(94),i(55),i(63),i(62),i(45),i(4),t.exports=i(0).default;}])});
	//# sourceMappingURL=Tone.js.map
	});

	var Tone$2 = unwrapExports(Tone$1);
	var Tone_1 = Tone$1.Tone;

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
			Tone$2.Transport.start();
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

	var piexif = createCommonjsModule(function (module, exports) {
	/* piexifjs

	The MIT License (MIT)

	Copyright (c) 2014, 2015 hMatoba(https://github.com/hMatoba)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
	*/

	(function () {
	    var that = {};
	    that.version = "1.0.4";

	    that.remove = function (jpeg) {
	        var b64 = false;
	        if (jpeg.slice(0, 2) == "\xff\xd8") ; else if (jpeg.slice(0, 23) == "data:image/jpeg;base64," || jpeg.slice(0, 22) == "data:image/jpg;base64,") {
	            jpeg = atob(jpeg.split(",")[1]);
	            b64 = true;
	        } else {
	            throw new Error("Given data is not jpeg.");
	        }
	        
	        var segments = splitIntoSegments(jpeg);
	        var newSegments = segments.filter(function(seg){
	          return  !(seg.slice(0, 2) == "\xff\xe1" &&
	                   seg.slice(4, 10) == "Exif\x00\x00"); 
	        });
	        
	        var new_data = newSegments.join("");
	        if (b64) {
	            new_data = "data:image/jpeg;base64," + btoa(new_data);
	        }

	        return new_data;
	    };


	    that.insert = function (exif, jpeg) {
	        var b64 = false;
	        if (exif.slice(0, 6) != "\x45\x78\x69\x66\x00\x00") {
	            throw new Error("Given data is not exif.");
	        }
	        if (jpeg.slice(0, 2) == "\xff\xd8") ; else if (jpeg.slice(0, 23) == "data:image/jpeg;base64," || jpeg.slice(0, 22) == "data:image/jpg;base64,") {
	            jpeg = atob(jpeg.split(",")[1]);
	            b64 = true;
	        } else {
	            throw new Error("Given data is not jpeg.");
	        }

	        var exifStr = "\xff\xe1" + pack(">H", [exif.length + 2]) + exif;
	        var segments = splitIntoSegments(jpeg);
	        var new_data = mergeSegments(segments, exifStr);
	        if (b64) {
	            new_data = "data:image/jpeg;base64," + btoa(new_data);
	        }

	        return new_data;
	    };


	    that.load = function (data) {
	        var input_data;
	        if (typeof (data) == "string") {
	            if (data.slice(0, 2) == "\xff\xd8") {
	                input_data = data;
	            } else if (data.slice(0, 23) == "data:image/jpeg;base64," || data.slice(0, 22) == "data:image/jpg;base64,") {
	                input_data = atob(data.split(",")[1]);
	            } else if (data.slice(0, 4) == "Exif") {
	                input_data = data.slice(6);
	            } else {
	                throw new Error("'load' gots invalid file data.");
	            }
	        } else {
	            throw new Error("'load' gots invalid type argument.");
	        }
	        var exif_dict = {
	            "0th": {},
	            "Exif": {},
	            "GPS": {},
	            "Interop": {},
	            "1st": {},
	            "thumbnail": null
	        };
	        var exifReader = new ExifReader(input_data);
	        if (exifReader.tiftag === null) {
	            return exif_dict;
	        }

	        if (exifReader.tiftag.slice(0, 2) == "\x49\x49") {
	            exifReader.endian_mark = "<";
	        } else {
	            exifReader.endian_mark = ">";
	        }

	        var pointer = unpack(exifReader.endian_mark + "L",
	            exifReader.tiftag.slice(4, 8))[0];
	        exif_dict["0th"] = exifReader.get_ifd(pointer, "0th");

	        var first_ifd_pointer = exif_dict["0th"]["first_ifd_pointer"];
	        delete exif_dict["0th"]["first_ifd_pointer"];

	        if (34665 in exif_dict["0th"]) {
	            pointer = exif_dict["0th"][34665];
	            exif_dict["Exif"] = exifReader.get_ifd(pointer, "Exif");
	        }
	        if (34853 in exif_dict["0th"]) {
	            pointer = exif_dict["0th"][34853];
	            exif_dict["GPS"] = exifReader.get_ifd(pointer, "GPS");
	        }
	        if (40965 in exif_dict["Exif"]) {
	            pointer = exif_dict["Exif"][40965];
	            exif_dict["Interop"] = exifReader.get_ifd(pointer, "Interop");
	        }
	        if (first_ifd_pointer != "\x00\x00\x00\x00") {
	            pointer = unpack(exifReader.endian_mark + "L",
	                first_ifd_pointer)[0];
	            exif_dict["1st"] = exifReader.get_ifd(pointer, "1st");
	            if ((513 in exif_dict["1st"]) && (514 in exif_dict["1st"])) {
	                var end = exif_dict["1st"][513] + exif_dict["1st"][514];
	                var thumb = exifReader.tiftag.slice(exif_dict["1st"][513], end);
	                exif_dict["thumbnail"] = thumb;
	            }
	        }

	        return exif_dict;
	    };


	    that.dump = function (exif_dict_original) {
	        var TIFF_HEADER_LENGTH = 8;

	        var exif_dict = copy(exif_dict_original);
	        var header = "Exif\x00\x00\x4d\x4d\x00\x2a\x00\x00\x00\x08";
	        var exif_is = false;
	        var gps_is = false;
	        var interop_is = false;
	        var first_is = false;

	        var zeroth_ifd,
	            exif_ifd,
	            interop_ifd,
	            gps_ifd,
	            first_ifd;
	        
	        if ("0th" in exif_dict) {
	            zeroth_ifd = exif_dict["0th"];
	        } else {
	            zeroth_ifd = {};
	        }
	        
	        if ((("Exif" in exif_dict) && (Object.keys(exif_dict["Exif"]).length)) ||
	            (("Interop" in exif_dict) && (Object.keys(exif_dict["Interop"]).length))) {
	            zeroth_ifd[34665] = 1;
	            exif_is = true;
	            exif_ifd = exif_dict["Exif"];
	            if (("Interop" in exif_dict) && Object.keys(exif_dict["Interop"]).length) {
	                exif_ifd[40965] = 1;
	                interop_is = true;
	                interop_ifd = exif_dict["Interop"];
	            } else if (Object.keys(exif_ifd).indexOf(that.ExifIFD.InteroperabilityTag.toString()) > -1) {
	                delete exif_ifd[40965];
	            }
	        } else if (Object.keys(zeroth_ifd).indexOf(that.ImageIFD.ExifTag.toString()) > -1) {
	            delete zeroth_ifd[34665];
	        }

	        if (("GPS" in exif_dict) && (Object.keys(exif_dict["GPS"]).length)) {
	            zeroth_ifd[that.ImageIFD.GPSTag] = 1;
	            gps_is = true;
	            gps_ifd = exif_dict["GPS"];
	        } else if (Object.keys(zeroth_ifd).indexOf(that.ImageIFD.GPSTag.toString()) > -1) {
	            delete zeroth_ifd[that.ImageIFD.GPSTag];
	        }
	        
	        if (("1st" in exif_dict) &&
	            ("thumbnail" in exif_dict) &&
	            (exif_dict["thumbnail"] != null)) {
	            first_is = true;
	            exif_dict["1st"][513] = 1;
	            exif_dict["1st"][514] = 1;
	            first_ifd = exif_dict["1st"];
	        }
	        
	        var zeroth_set = _dict_to_bytes(zeroth_ifd, "0th", 0);
	        var zeroth_length = (zeroth_set[0].length + exif_is * 12 + gps_is * 12 + 4 +
	            zeroth_set[1].length);

	        var exif_set,
	            exif_bytes = "",
	            exif_length = 0,
	            gps_set,
	            gps_bytes = "",
	            gps_length = 0,
	            interop_set,
	            interop_bytes = "",
	            interop_length = 0,
	            first_set,
	            first_bytes = "",
	            thumbnail;
	        if (exif_is) {
	            exif_set = _dict_to_bytes(exif_ifd, "Exif", zeroth_length);
	            exif_length = exif_set[0].length + interop_is * 12 + exif_set[1].length;
	        }
	        if (gps_is) {
	            gps_set = _dict_to_bytes(gps_ifd, "GPS", zeroth_length + exif_length);
	            gps_bytes = gps_set.join("");
	            gps_length = gps_bytes.length;
	        }
	        if (interop_is) {
	            var offset = zeroth_length + exif_length + gps_length;
	            interop_set = _dict_to_bytes(interop_ifd, "Interop", offset);
	            interop_bytes = interop_set.join("");
	            interop_length = interop_bytes.length;
	        }
	        if (first_is) {
	            var offset = zeroth_length + exif_length + gps_length + interop_length;
	            first_set = _dict_to_bytes(first_ifd, "1st", offset);
	            thumbnail = _get_thumbnail(exif_dict["thumbnail"]);
	            if (thumbnail.length > 64000) {
	                throw new Error("Given thumbnail is too large. max 64kB");
	            }
	        }

	        var exif_pointer = "",
	            gps_pointer = "",
	            interop_pointer = "",
	            first_ifd_pointer = "\x00\x00\x00\x00";
	        if (exif_is) {
	            var pointer_value = TIFF_HEADER_LENGTH + zeroth_length;
	            var pointer_str = pack(">L", [pointer_value]);
	            var key = 34665;
	            var key_str = pack(">H", [key]);
	            var type_str = pack(">H", [TYPES["Long"]]);
	            var length_str = pack(">L", [1]);
	            exif_pointer = key_str + type_str + length_str + pointer_str;
	        }
	        if (gps_is) {
	            var pointer_value = TIFF_HEADER_LENGTH + zeroth_length + exif_length;
	            var pointer_str = pack(">L", [pointer_value]);
	            var key = 34853;
	            var key_str = pack(">H", [key]);
	            var type_str = pack(">H", [TYPES["Long"]]);
	            var length_str = pack(">L", [1]);
	            gps_pointer = key_str + type_str + length_str + pointer_str;
	        }
	        if (interop_is) {
	            var pointer_value = (TIFF_HEADER_LENGTH +
	                zeroth_length + exif_length + gps_length);
	            var pointer_str = pack(">L", [pointer_value]);
	            var key = 40965;
	            var key_str = pack(">H", [key]);
	            var type_str = pack(">H", [TYPES["Long"]]);
	            var length_str = pack(">L", [1]);
	            interop_pointer = key_str + type_str + length_str + pointer_str;
	        }
	        if (first_is) {
	            var pointer_value = (TIFF_HEADER_LENGTH + zeroth_length +
	                exif_length + gps_length + interop_length);
	            first_ifd_pointer = pack(">L", [pointer_value]);
	            var thumbnail_pointer = (pointer_value + first_set[0].length + 24 +
	                4 + first_set[1].length);
	            var thumbnail_p_bytes = ("\x02\x01\x00\x04\x00\x00\x00\x01" +
	                pack(">L", [thumbnail_pointer]));
	            var thumbnail_length_bytes = ("\x02\x02\x00\x04\x00\x00\x00\x01" +
	                pack(">L", [thumbnail.length]));
	            first_bytes = (first_set[0] + thumbnail_p_bytes +
	                thumbnail_length_bytes + "\x00\x00\x00\x00" +
	                first_set[1] + thumbnail);
	        }

	        var zeroth_bytes = (zeroth_set[0] + exif_pointer + gps_pointer +
	            first_ifd_pointer + zeroth_set[1]);
	        if (exif_is) {
	            exif_bytes = exif_set[0] + interop_pointer + exif_set[1];
	        }

	        return (header + zeroth_bytes + exif_bytes + gps_bytes +
	            interop_bytes + first_bytes);
	    };


	    function copy(obj) {
	        return JSON.parse(JSON.stringify(obj));
	    }


	    function _get_thumbnail(jpeg) {
	        var segments = splitIntoSegments(jpeg);
	        while (("\xff\xe0" <= segments[1].slice(0, 2)) && (segments[1].slice(0, 2) <= "\xff\xef")) {
	            segments = [segments[0]].concat(segments.slice(2));
	        }
	        return segments.join("");
	    }


	    function _pack_byte(array) {
	        return pack(">" + nStr("B", array.length), array);
	    }


	    function _pack_short(array) {
	        return pack(">" + nStr("H", array.length), array);
	    }


	    function _pack_long(array) {
	        return pack(">" + nStr("L", array.length), array);
	    }


	    function _value_to_bytes(raw_value, value_type, offset) {
	        var four_bytes_over = "";
	        var value_str = "";
	        var length,
	            new_value,
	            num,
	            den;

	        if (value_type == "Byte") {
	            length = raw_value.length;
	            if (length <= 4) {
	                value_str = (_pack_byte(raw_value) +
	                    nStr("\x00", 4 - length));
	            } else {
	                value_str = pack(">L", [offset]);
	                four_bytes_over = _pack_byte(raw_value);
	            }
	        } else if (value_type == "Short") {
	            length = raw_value.length;
	            if (length <= 2) {
	                value_str = (_pack_short(raw_value) +
	                    nStr("\x00\x00", 2 - length));
	            } else {
	                value_str = pack(">L", [offset]);
	                four_bytes_over = _pack_short(raw_value);
	            }
	        } else if (value_type == "Long") {
	            length = raw_value.length;
	            if (length <= 1) {
	                value_str = _pack_long(raw_value);
	            } else {
	                value_str = pack(">L", [offset]);
	                four_bytes_over = _pack_long(raw_value);
	            }
	        } else if (value_type == "Ascii") {
	            new_value = raw_value + "\x00";
	            length = new_value.length;
	            if (length > 4) {
	                value_str = pack(">L", [offset]);
	                four_bytes_over = new_value;
	            } else {
	                value_str = new_value + nStr("\x00", 4 - length);
	            }
	        } else if (value_type == "Rational") {
	            if (typeof (raw_value[0]) == "number") {
	                length = 1;
	                num = raw_value[0];
	                den = raw_value[1];
	                new_value = pack(">L", [num]) + pack(">L", [den]);
	            } else {
	                length = raw_value.length;
	                new_value = "";
	                for (var n = 0; n < length; n++) {
	                    num = raw_value[n][0];
	                    den = raw_value[n][1];
	                    new_value += (pack(">L", [num]) +
	                        pack(">L", [den]));
	                }
	            }
	            value_str = pack(">L", [offset]);
	            four_bytes_over = new_value;
	        } else if (value_type == "SRational") {
	            if (typeof (raw_value[0]) == "number") {
	                length = 1;
	                num = raw_value[0];
	                den = raw_value[1];
	                new_value = pack(">l", [num]) + pack(">l", [den]);
	            } else {
	                length = raw_value.length;
	                new_value = "";
	                for (var n = 0; n < length; n++) {
	                    num = raw_value[n][0];
	                    den = raw_value[n][1];
	                    new_value += (pack(">l", [num]) +
	                        pack(">l", [den]));
	                }
	            }
	            value_str = pack(">L", [offset]);
	            four_bytes_over = new_value;
	        } else if (value_type == "Undefined") {
	            length = raw_value.length;
	            if (length > 4) {
	                value_str = pack(">L", [offset]);
	                four_bytes_over = raw_value;
	            } else {
	                value_str = raw_value + nStr("\x00", 4 - length);
	            }
	        }

	        var length_str = pack(">L", [length]);

	        return [length_str, value_str, four_bytes_over];
	    }

	    function _dict_to_bytes(ifd_dict, ifd, ifd_offset) {
	        var TIFF_HEADER_LENGTH = 8;
	        var tag_count = Object.keys(ifd_dict).length;
	        var entry_header = pack(">H", [tag_count]);
	        var entries_length;
	        if (["0th", "1st"].indexOf(ifd) > -1) {
	            entries_length = 2 + tag_count * 12 + 4;
	        } else {
	            entries_length = 2 + tag_count * 12;
	        }
	        var entries = "";
	        var values = "";
	        var key;

	        for (var key in ifd_dict) {
	            if (typeof (key) == "string") {
	                key = parseInt(key);
	            }
	            if ((ifd == "0th") && ([34665, 34853].indexOf(key) > -1)) {
	                continue;
	            } else if ((ifd == "Exif") && (key == 40965)) {
	                continue;
	            } else if ((ifd == "1st") && ([513, 514].indexOf(key) > -1)) {
	                continue;
	            }

	            var raw_value = ifd_dict[key];
	            var key_str = pack(">H", [key]);
	            var value_type = TAGS[ifd][key]["type"];
	            var type_str = pack(">H", [TYPES[value_type]]);

	            if (typeof (raw_value) == "number") {
	                raw_value = [raw_value];
	            }
	            var offset = TIFF_HEADER_LENGTH + entries_length + ifd_offset + values.length;
	            var b = _value_to_bytes(raw_value, value_type, offset);
	            var length_str = b[0];
	            var value_str = b[1];
	            var four_bytes_over = b[2];

	            entries += key_str + type_str + length_str + value_str;
	            values += four_bytes_over;
	        }

	        return [entry_header + entries, values];
	    }



	    function ExifReader(data) {
	        var segments,
	            app1;
	        if (data.slice(0, 2) == "\xff\xd8") { // JPEG
	            segments = splitIntoSegments(data);
	            app1 = getExifSeg(segments);
	            if (app1) {
	                this.tiftag = app1.slice(10);
	            } else {
	                this.tiftag = null;
	            }
	        } else if (["\x49\x49", "\x4d\x4d"].indexOf(data.slice(0, 2)) > -1) { // TIFF
	            this.tiftag = data;
	        } else if (data.slice(0, 4) == "Exif") { // Exif
	            this.tiftag = data.slice(6);
	        } else {
	            throw new Error("Given file is neither JPEG nor TIFF.");
	        }
	    }

	    ExifReader.prototype = {
	        get_ifd: function (pointer, ifd_name) {
	            var ifd_dict = {};
	            var tag_count = unpack(this.endian_mark + "H",
	                this.tiftag.slice(pointer, pointer + 2))[0];
	            var offset = pointer + 2;
	            var t;
	            if (["0th", "1st"].indexOf(ifd_name) > -1) {
	                t = "Image";
	            } else {
	                t = ifd_name;
	            }

	            for (var x = 0; x < tag_count; x++) {
	                pointer = offset + 12 * x;
	                var tag = unpack(this.endian_mark + "H",
	                    this.tiftag.slice(pointer, pointer + 2))[0];
	                var value_type = unpack(this.endian_mark + "H",
	                    this.tiftag.slice(pointer + 2, pointer + 4))[0];
	                var value_num = unpack(this.endian_mark + "L",
	                    this.tiftag.slice(pointer + 4, pointer + 8))[0];
	                var value = this.tiftag.slice(pointer + 8, pointer + 12);

	                var v_set = [value_type, value_num, value];
	                if (tag in TAGS[t]) {
	                    ifd_dict[tag] = this.convert_value(v_set);
	                }
	            }

	            if (ifd_name == "0th") {
	                pointer = offset + 12 * tag_count;
	                ifd_dict["first_ifd_pointer"] = this.tiftag.slice(pointer, pointer + 4);
	            }

	            return ifd_dict;
	        },

	        convert_value: function (val) {
	            var data = null;
	            var t = val[0];
	            var length = val[1];
	            var value = val[2];
	            var pointer;

	            if (t == 1) { // BYTE
	                if (length > 4) {
	                    pointer = unpack(this.endian_mark + "L", value)[0];
	                    data = unpack(this.endian_mark + nStr("B", length),
	                        this.tiftag.slice(pointer, pointer + length));
	                } else {
	                    data = unpack(this.endian_mark + nStr("B", length), value.slice(0, length));
	                }
	            } else if (t == 2) { // ASCII
	                if (length > 4) {
	                    pointer = unpack(this.endian_mark + "L", value)[0];
	                    data = this.tiftag.slice(pointer, pointer + length - 1);
	                } else {
	                    data = value.slice(0, length - 1);
	                }
	            } else if (t == 3) { // SHORT
	                if (length > 2) {
	                    pointer = unpack(this.endian_mark + "L", value)[0];
	                    data = unpack(this.endian_mark + nStr("H", length),
	                        this.tiftag.slice(pointer, pointer + length * 2));
	                } else {
	                    data = unpack(this.endian_mark + nStr("H", length),
	                        value.slice(0, length * 2));
	                }
	            } else if (t == 4) { // LONG
	                if (length > 1) {
	                    pointer = unpack(this.endian_mark + "L", value)[0];
	                    data = unpack(this.endian_mark + nStr("L", length),
	                        this.tiftag.slice(pointer, pointer + length * 4));
	                } else {
	                    data = unpack(this.endian_mark + nStr("L", length),
	                        value);
	                }
	            } else if (t == 5) { // RATIONAL
	                pointer = unpack(this.endian_mark + "L", value)[0];
	                if (length > 1) {
	                    data = [];
	                    for (var x = 0; x < length; x++) {
	                        data.push([unpack(this.endian_mark + "L",
	                                this.tiftag.slice(pointer + x * 8, pointer + 4 + x * 8))[0],
	                                   unpack(this.endian_mark + "L",
	                                this.tiftag.slice(pointer + 4 + x * 8, pointer + 8 + x * 8))[0]
	                                   ]);
	                    }
	                } else {
	                    data = [unpack(this.endian_mark + "L",
	                            this.tiftag.slice(pointer, pointer + 4))[0],
	                            unpack(this.endian_mark + "L",
	                            this.tiftag.slice(pointer + 4, pointer + 8))[0]
	                            ];
	                }
	            } else if (t == 7) { // UNDEFINED BYTES
	                if (length > 4) {
	                    pointer = unpack(this.endian_mark + "L", value)[0];
	                    data = this.tiftag.slice(pointer, pointer + length);
	                } else {
	                    data = value.slice(0, length);
	                }
	            } else if (t == 9) { // SLONG
	                if (length > 1) {
	                    pointer = unpack(this.endian_mark + "L", value)[0];
	                    data = unpack(this.endian_mark + nStr("l", length),
	                        this.tiftag.slice(pointer, pointer + length * 4));
	                } else {
	                    data = unpack(this.endian_mark + nStr("l", length),
	                        value);
	                }
	            } else if (t == 10) { // SRATIONAL
	                pointer = unpack(this.endian_mark + "L", value)[0];
	                if (length > 1) {
	                    data = [];
	                    for (var x = 0; x < length; x++) {
	                        data.push([unpack(this.endian_mark + "l",
	                                this.tiftag.slice(pointer + x * 8, pointer + 4 + x * 8))[0],
	                                   unpack(this.endian_mark + "l",
	                                this.tiftag.slice(pointer + 4 + x * 8, pointer + 8 + x * 8))[0]
	                                  ]);
	                    }
	                } else {
	                    data = [unpack(this.endian_mark + "l",
	                            this.tiftag.slice(pointer, pointer + 4))[0],
	                            unpack(this.endian_mark + "l",
	                            this.tiftag.slice(pointer + 4, pointer + 8))[0]
	                           ];
	                }
	            } else {
	                throw new Error("Exif might be wrong. Got incorrect value " +
	                    "type to decode. type:" + t);
	            }

	            if ((data instanceof Array) && (data.length == 1)) {
	                return data[0];
	            } else {
	                return data;
	            }
	        },
	    };


	    if (typeof window !== "undefined" && typeof window.btoa === "function") {
	        var btoa = window.btoa;
	    }
	    if (typeof btoa === "undefined") {
	        var btoa = function (input) {        var output = "";
	            var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
	            var i = 0;
	            var keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

	            while (i < input.length) {

	                chr1 = input.charCodeAt(i++);
	                chr2 = input.charCodeAt(i++);
	                chr3 = input.charCodeAt(i++);

	                enc1 = chr1 >> 2;
	                enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
	                enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
	                enc4 = chr3 & 63;

	                if (isNaN(chr2)) {
	                    enc3 = enc4 = 64;
	                } else if (isNaN(chr3)) {
	                    enc4 = 64;
	                }

	                output = output +
	                keyStr.charAt(enc1) + keyStr.charAt(enc2) +
	                keyStr.charAt(enc3) + keyStr.charAt(enc4);

	            }

	            return output;
	        };
	    }
	    
	    
	    if (typeof window !== "undefined" && typeof window.atob === "function") {
	        var atob = window.atob;
	    }
	    if (typeof atob === "undefined") {
	        var atob = function (input) {
	            var output = "";
	            var chr1, chr2, chr3;
	            var enc1, enc2, enc3, enc4;
	            var i = 0;
	            var keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

	            input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

	            while (i < input.length) {

	                enc1 = keyStr.indexOf(input.charAt(i++));
	                enc2 = keyStr.indexOf(input.charAt(i++));
	                enc3 = keyStr.indexOf(input.charAt(i++));
	                enc4 = keyStr.indexOf(input.charAt(i++));

	                chr1 = (enc1 << 2) | (enc2 >> 4);
	                chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
	                chr3 = ((enc3 & 3) << 6) | enc4;

	                output = output + String.fromCharCode(chr1);

	                if (enc3 != 64) {
	                    output = output + String.fromCharCode(chr2);
	                }
	                if (enc4 != 64) {
	                    output = output + String.fromCharCode(chr3);
	                }

	            }

	            return output;
	        };
	    }


	    function pack(mark, array) {
	        if (!(array instanceof Array)) {
	            throw new Error("'pack' error. Got invalid type argument.");
	        }
	        if ((mark.length - 1) != array.length) {
	            throw new Error("'pack' error. " + (mark.length - 1) + " marks, " + array.length + " elements.");
	        }

	        var littleEndian;
	        if (mark[0] == "<") {
	            littleEndian = true;
	        } else if (mark[0] == ">") {
	            littleEndian = false;
	        } else {
	            throw new Error("");
	        }
	        var packed = "";
	        var p = 1;
	        var val = null;
	        var c = null;
	        var valStr = null;

	        while (c = mark[p]) {
	            if (c.toLowerCase() == "b") {
	                val = array[p - 1];
	                if ((c == "b") && (val < 0)) {
	                    val += 0x100;
	                }
	                if ((val > 0xff) || (val < 0)) {
	                    throw new Error("'pack' error.");
	                } else {
	                    valStr = String.fromCharCode(val);
	                }
	            } else if (c == "H") {
	                val = array[p - 1];
	                if ((val > 0xffff) || (val < 0)) {
	                    throw new Error("'pack' error.");
	                } else {
	                    valStr = String.fromCharCode(Math.floor((val % 0x10000) / 0x100)) +
	                        String.fromCharCode(val % 0x100);
	                    if (littleEndian) {
	                        valStr = valStr.split("").reverse().join("");
	                    }
	                }
	            } else if (c.toLowerCase() == "l") {
	                val = array[p - 1];
	                if ((c == "l") && (val < 0)) {
	                    val += 0x100000000;
	                }
	                if ((val > 0xffffffff) || (val < 0)) {
	                    throw new Error("'pack' error.");
	                } else {
	                    valStr = String.fromCharCode(Math.floor(val / 0x1000000)) +
	                        String.fromCharCode(Math.floor((val % 0x1000000) / 0x10000)) +
	                        String.fromCharCode(Math.floor((val % 0x10000) / 0x100)) +
	                        String.fromCharCode(val % 0x100);
	                    if (littleEndian) {
	                        valStr = valStr.split("").reverse().join("");
	                    }
	                }
	            } else {
	                throw new Error("'pack' error.");
	            }

	            packed += valStr;
	            p += 1;
	        }

	        return packed;
	    }

	    function unpack(mark, str) {
	        if (typeof (str) != "string") {
	            throw new Error("'unpack' error. Got invalid type argument.");
	        }
	        var l = 0;
	        for (var markPointer = 1; markPointer < mark.length; markPointer++) {
	            if (mark[markPointer].toLowerCase() == "b") {
	                l += 1;
	            } else if (mark[markPointer].toLowerCase() == "h") {
	                l += 2;
	            } else if (mark[markPointer].toLowerCase() == "l") {
	                l += 4;
	            } else {
	                throw new Error("'unpack' error. Got invalid mark.");
	            }
	        }

	        if (l != str.length) {
	            throw new Error("'unpack' error. Mismatch between symbol and string length. " + l + ":" + str.length);
	        }

	        var littleEndian;
	        if (mark[0] == "<") {
	            littleEndian = true;
	        } else if (mark[0] == ">") {
	            littleEndian = false;
	        } else {
	            throw new Error("'unpack' error.");
	        }
	        var unpacked = [];
	        var strPointer = 0;
	        var p = 1;
	        var val = null;
	        var c = null;
	        var length = null;
	        var sliced = "";

	        while (c = mark[p]) {
	            if (c.toLowerCase() == "b") {
	                length = 1;
	                sliced = str.slice(strPointer, strPointer + length);
	                val = sliced.charCodeAt(0);
	                if ((c == "b") && (val >= 0x80)) {
	                    val -= 0x100;
	                }
	            } else if (c == "H") {
	                length = 2;
	                sliced = str.slice(strPointer, strPointer + length);
	                if (littleEndian) {
	                    sliced = sliced.split("").reverse().join("");
	                }
	                val = sliced.charCodeAt(0) * 0x100 +
	                    sliced.charCodeAt(1);
	            } else if (c.toLowerCase() == "l") {
	                length = 4;
	                sliced = str.slice(strPointer, strPointer + length);
	                if (littleEndian) {
	                    sliced = sliced.split("").reverse().join("");
	                }
	                val = sliced.charCodeAt(0) * 0x1000000 +
	                    sliced.charCodeAt(1) * 0x10000 +
	                    sliced.charCodeAt(2) * 0x100 +
	                    sliced.charCodeAt(3);
	                if ((c == "l") && (val >= 0x80000000)) {
	                    val -= 0x100000000;
	                }
	            } else {
	                throw new Error("'unpack' error. " + c);
	            }

	            unpacked.push(val);
	            strPointer += length;
	            p += 1;
	        }

	        return unpacked;
	    }

	    function nStr(ch, num) {
	        var str = "";
	        for (var i = 0; i < num; i++) {
	            str += ch;
	        }
	        return str;
	    }

	    function splitIntoSegments(data) {
	        if (data.slice(0, 2) != "\xff\xd8") {
	            throw new Error("Given data isn't JPEG.");
	        }

	        var head = 2;
	        var segments = ["\xff\xd8"];
	        while (true) {
	            if (data.slice(head, head + 2) == "\xff\xda") {
	                segments.push(data.slice(head));
	                break;
	            } else {
	                var length = unpack(">H", data.slice(head + 2, head + 4))[0];
	                var endPoint = head + length + 2;
	                segments.push(data.slice(head, endPoint));
	                head = endPoint;
	            }

	            if (head >= data.length) {
	                throw new Error("Wrong JPEG data.");
	            }
	        }
	        return segments;
	    }


	    function getExifSeg(segments) {
	        var seg;
	        for (var i = 0; i < segments.length; i++) {
	            seg = segments[i];
	            if (seg.slice(0, 2) == "\xff\xe1" &&
	                   seg.slice(4, 10) == "Exif\x00\x00") {
	                return seg;
	            }
	        }
	        return null;
	    }


	    function mergeSegments(segments, exif) {
	        var hasExifSegment = false;
	        var additionalAPP1ExifSegments = [];

	        segments.forEach(function(segment, i) {
	            // Replace first occurence of APP1:Exif segment
	            if (segment.slice(0, 2) == "\xff\xe1" &&
	                segment.slice(4, 10) == "Exif\x00\x00"
	            ) {
	                if (!hasExifSegment) {
	                    segments[i] = exif;
	                    hasExifSegment = true;
	                } else {
	                    additionalAPP1ExifSegments.unshift(i);
	                }
	            }
	        });

	        // Remove additional occurences of APP1:Exif segment
	        additionalAPP1ExifSegments.forEach(function(segmentIndex) {
	            segments.splice(segmentIndex, 1);
	        });

	        if (!hasExifSegment && exif) {
	            segments = [segments[0], exif].concat(segments.slice(1));
	        }

	        return segments.join("");
	    }


	    var TYPES = {
	        "Byte": 1,
	        "Ascii": 2,
	        "Short": 3,
	        "Long": 4,
	        "Rational": 5,
	        "Undefined": 7,
	        "SLong": 9,
	        "SRational": 10
	    };


	    var TAGS = {
	        'Image': {
	            11: {
	                'name': 'ProcessingSoftware',
	                'type': 'Ascii'
	            },
	            254: {
	                'name': 'NewSubfileType',
	                'type': 'Long'
	            },
	            255: {
	                'name': 'SubfileType',
	                'type': 'Short'
	            },
	            256: {
	                'name': 'ImageWidth',
	                'type': 'Long'
	            },
	            257: {
	                'name': 'ImageLength',
	                'type': 'Long'
	            },
	            258: {
	                'name': 'BitsPerSample',
	                'type': 'Short'
	            },
	            259: {
	                'name': 'Compression',
	                'type': 'Short'
	            },
	            262: {
	                'name': 'PhotometricInterpretation',
	                'type': 'Short'
	            },
	            263: {
	                'name': 'Threshholding',
	                'type': 'Short'
	            },
	            264: {
	                'name': 'CellWidth',
	                'type': 'Short'
	            },
	            265: {
	                'name': 'CellLength',
	                'type': 'Short'
	            },
	            266: {
	                'name': 'FillOrder',
	                'type': 'Short'
	            },
	            269: {
	                'name': 'DocumentName',
	                'type': 'Ascii'
	            },
	            270: {
	                'name': 'ImageDescription',
	                'type': 'Ascii'
	            },
	            271: {
	                'name': 'Make',
	                'type': 'Ascii'
	            },
	            272: {
	                'name': 'Model',
	                'type': 'Ascii'
	            },
	            273: {
	                'name': 'StripOffsets',
	                'type': 'Long'
	            },
	            274: {
	                'name': 'Orientation',
	                'type': 'Short'
	            },
	            277: {
	                'name': 'SamplesPerPixel',
	                'type': 'Short'
	            },
	            278: {
	                'name': 'RowsPerStrip',
	                'type': 'Long'
	            },
	            279: {
	                'name': 'StripByteCounts',
	                'type': 'Long'
	            },
	            282: {
	                'name': 'XResolution',
	                'type': 'Rational'
	            },
	            283: {
	                'name': 'YResolution',
	                'type': 'Rational'
	            },
	            284: {
	                'name': 'PlanarConfiguration',
	                'type': 'Short'
	            },
	            290: {
	                'name': 'GrayResponseUnit',
	                'type': 'Short'
	            },
	            291: {
	                'name': 'GrayResponseCurve',
	                'type': 'Short'
	            },
	            292: {
	                'name': 'T4Options',
	                'type': 'Long'
	            },
	            293: {
	                'name': 'T6Options',
	                'type': 'Long'
	            },
	            296: {
	                'name': 'ResolutionUnit',
	                'type': 'Short'
	            },
	            301: {
	                'name': 'TransferFunction',
	                'type': 'Short'
	            },
	            305: {
	                'name': 'Software',
	                'type': 'Ascii'
	            },
	            306: {
	                'name': 'DateTime',
	                'type': 'Ascii'
	            },
	            315: {
	                'name': 'Artist',
	                'type': 'Ascii'
	            },
	            316: {
	                'name': 'HostComputer',
	                'type': 'Ascii'
	            },
	            317: {
	                'name': 'Predictor',
	                'type': 'Short'
	            },
	            318: {
	                'name': 'WhitePoint',
	                'type': 'Rational'
	            },
	            319: {
	                'name': 'PrimaryChromaticities',
	                'type': 'Rational'
	            },
	            320: {
	                'name': 'ColorMap',
	                'type': 'Short'
	            },
	            321: {
	                'name': 'HalftoneHints',
	                'type': 'Short'
	            },
	            322: {
	                'name': 'TileWidth',
	                'type': 'Short'
	            },
	            323: {
	                'name': 'TileLength',
	                'type': 'Short'
	            },
	            324: {
	                'name': 'TileOffsets',
	                'type': 'Short'
	            },
	            325: {
	                'name': 'TileByteCounts',
	                'type': 'Short'
	            },
	            330: {
	                'name': 'SubIFDs',
	                'type': 'Long'
	            },
	            332: {
	                'name': 'InkSet',
	                'type': 'Short'
	            },
	            333: {
	                'name': 'InkNames',
	                'type': 'Ascii'
	            },
	            334: {
	                'name': 'NumberOfInks',
	                'type': 'Short'
	            },
	            336: {
	                'name': 'DotRange',
	                'type': 'Byte'
	            },
	            337: {
	                'name': 'TargetPrinter',
	                'type': 'Ascii'
	            },
	            338: {
	                'name': 'ExtraSamples',
	                'type': 'Short'
	            },
	            339: {
	                'name': 'SampleFormat',
	                'type': 'Short'
	            },
	            340: {
	                'name': 'SMinSampleValue',
	                'type': 'Short'
	            },
	            341: {
	                'name': 'SMaxSampleValue',
	                'type': 'Short'
	            },
	            342: {
	                'name': 'TransferRange',
	                'type': 'Short'
	            },
	            343: {
	                'name': 'ClipPath',
	                'type': 'Byte'
	            },
	            344: {
	                'name': 'XClipPathUnits',
	                'type': 'Long'
	            },
	            345: {
	                'name': 'YClipPathUnits',
	                'type': 'Long'
	            },
	            346: {
	                'name': 'Indexed',
	                'type': 'Short'
	            },
	            347: {
	                'name': 'JPEGTables',
	                'type': 'Undefined'
	            },
	            351: {
	                'name': 'OPIProxy',
	                'type': 'Short'
	            },
	            512: {
	                'name': 'JPEGProc',
	                'type': 'Long'
	            },
	            513: {
	                'name': 'JPEGInterchangeFormat',
	                'type': 'Long'
	            },
	            514: {
	                'name': 'JPEGInterchangeFormatLength',
	                'type': 'Long'
	            },
	            515: {
	                'name': 'JPEGRestartInterval',
	                'type': 'Short'
	            },
	            517: {
	                'name': 'JPEGLosslessPredictors',
	                'type': 'Short'
	            },
	            518: {
	                'name': 'JPEGPointTransforms',
	                'type': 'Short'
	            },
	            519: {
	                'name': 'JPEGQTables',
	                'type': 'Long'
	            },
	            520: {
	                'name': 'JPEGDCTables',
	                'type': 'Long'
	            },
	            521: {
	                'name': 'JPEGACTables',
	                'type': 'Long'
	            },
	            529: {
	                'name': 'YCbCrCoefficients',
	                'type': 'Rational'
	            },
	            530: {
	                'name': 'YCbCrSubSampling',
	                'type': 'Short'
	            },
	            531: {
	                'name': 'YCbCrPositioning',
	                'type': 'Short'
	            },
	            532: {
	                'name': 'ReferenceBlackWhite',
	                'type': 'Rational'
	            },
	            700: {
	                'name': 'XMLPacket',
	                'type': 'Byte'
	            },
	            18246: {
	                'name': 'Rating',
	                'type': 'Short'
	            },
	            18249: {
	                'name': 'RatingPercent',
	                'type': 'Short'
	            },
	            32781: {
	                'name': 'ImageID',
	                'type': 'Ascii'
	            },
	            33421: {
	                'name': 'CFARepeatPatternDim',
	                'type': 'Short'
	            },
	            33422: {
	                'name': 'CFAPattern',
	                'type': 'Byte'
	            },
	            33423: {
	                'name': 'BatteryLevel',
	                'type': 'Rational'
	            },
	            33432: {
	                'name': 'Copyright',
	                'type': 'Ascii'
	            },
	            33434: {
	                'name': 'ExposureTime',
	                'type': 'Rational'
	            },
	            34377: {
	                'name': 'ImageResources',
	                'type': 'Byte'
	            },
	            34665: {
	                'name': 'ExifTag',
	                'type': 'Long'
	            },
	            34675: {
	                'name': 'InterColorProfile',
	                'type': 'Undefined'
	            },
	            34853: {
	                'name': 'GPSTag',
	                'type': 'Long'
	            },
	            34857: {
	                'name': 'Interlace',
	                'type': 'Short'
	            },
	            34858: {
	                'name': 'TimeZoneOffset',
	                'type': 'Long'
	            },
	            34859: {
	                'name': 'SelfTimerMode',
	                'type': 'Short'
	            },
	            37387: {
	                'name': 'FlashEnergy',
	                'type': 'Rational'
	            },
	            37388: {
	                'name': 'SpatialFrequencyResponse',
	                'type': 'Undefined'
	            },
	            37389: {
	                'name': 'Noise',
	                'type': 'Undefined'
	            },
	            37390: {
	                'name': 'FocalPlaneXResolution',
	                'type': 'Rational'
	            },
	            37391: {
	                'name': 'FocalPlaneYResolution',
	                'type': 'Rational'
	            },
	            37392: {
	                'name': 'FocalPlaneResolutionUnit',
	                'type': 'Short'
	            },
	            37393: {
	                'name': 'ImageNumber',
	                'type': 'Long'
	            },
	            37394: {
	                'name': 'SecurityClassification',
	                'type': 'Ascii'
	            },
	            37395: {
	                'name': 'ImageHistory',
	                'type': 'Ascii'
	            },
	            37397: {
	                'name': 'ExposureIndex',
	                'type': 'Rational'
	            },
	            37398: {
	                'name': 'TIFFEPStandardID',
	                'type': 'Byte'
	            },
	            37399: {
	                'name': 'SensingMethod',
	                'type': 'Short'
	            },
	            40091: {
	                'name': 'XPTitle',
	                'type': 'Byte'
	            },
	            40092: {
	                'name': 'XPComment',
	                'type': 'Byte'
	            },
	            40093: {
	                'name': 'XPAuthor',
	                'type': 'Byte'
	            },
	            40094: {
	                'name': 'XPKeywords',
	                'type': 'Byte'
	            },
	            40095: {
	                'name': 'XPSubject',
	                'type': 'Byte'
	            },
	            50341: {
	                'name': 'PrintImageMatching',
	                'type': 'Undefined'
	            },
	            50706: {
	                'name': 'DNGVersion',
	                'type': 'Byte'
	            },
	            50707: {
	                'name': 'DNGBackwardVersion',
	                'type': 'Byte'
	            },
	            50708: {
	                'name': 'UniqueCameraModel',
	                'type': 'Ascii'
	            },
	            50709: {
	                'name': 'LocalizedCameraModel',
	                'type': 'Byte'
	            },
	            50710: {
	                'name': 'CFAPlaneColor',
	                'type': 'Byte'
	            },
	            50711: {
	                'name': 'CFALayout',
	                'type': 'Short'
	            },
	            50712: {
	                'name': 'LinearizationTable',
	                'type': 'Short'
	            },
	            50713: {
	                'name': 'BlackLevelRepeatDim',
	                'type': 'Short'
	            },
	            50714: {
	                'name': 'BlackLevel',
	                'type': 'Rational'
	            },
	            50715: {
	                'name': 'BlackLevelDeltaH',
	                'type': 'SRational'
	            },
	            50716: {
	                'name': 'BlackLevelDeltaV',
	                'type': 'SRational'
	            },
	            50717: {
	                'name': 'WhiteLevel',
	                'type': 'Short'
	            },
	            50718: {
	                'name': 'DefaultScale',
	                'type': 'Rational'
	            },
	            50719: {
	                'name': 'DefaultCropOrigin',
	                'type': 'Short'
	            },
	            50720: {
	                'name': 'DefaultCropSize',
	                'type': 'Short'
	            },
	            50721: {
	                'name': 'ColorMatrix1',
	                'type': 'SRational'
	            },
	            50722: {
	                'name': 'ColorMatrix2',
	                'type': 'SRational'
	            },
	            50723: {
	                'name': 'CameraCalibration1',
	                'type': 'SRational'
	            },
	            50724: {
	                'name': 'CameraCalibration2',
	                'type': 'SRational'
	            },
	            50725: {
	                'name': 'ReductionMatrix1',
	                'type': 'SRational'
	            },
	            50726: {
	                'name': 'ReductionMatrix2',
	                'type': 'SRational'
	            },
	            50727: {
	                'name': 'AnalogBalance',
	                'type': 'Rational'
	            },
	            50728: {
	                'name': 'AsShotNeutral',
	                'type': 'Short'
	            },
	            50729: {
	                'name': 'AsShotWhiteXY',
	                'type': 'Rational'
	            },
	            50730: {
	                'name': 'BaselineExposure',
	                'type': 'SRational'
	            },
	            50731: {
	                'name': 'BaselineNoise',
	                'type': 'Rational'
	            },
	            50732: {
	                'name': 'BaselineSharpness',
	                'type': 'Rational'
	            },
	            50733: {
	                'name': 'BayerGreenSplit',
	                'type': 'Long'
	            },
	            50734: {
	                'name': 'LinearResponseLimit',
	                'type': 'Rational'
	            },
	            50735: {
	                'name': 'CameraSerialNumber',
	                'type': 'Ascii'
	            },
	            50736: {
	                'name': 'LensInfo',
	                'type': 'Rational'
	            },
	            50737: {
	                'name': 'ChromaBlurRadius',
	                'type': 'Rational'
	            },
	            50738: {
	                'name': 'AntiAliasStrength',
	                'type': 'Rational'
	            },
	            50739: {
	                'name': 'ShadowScale',
	                'type': 'SRational'
	            },
	            50740: {
	                'name': 'DNGPrivateData',
	                'type': 'Byte'
	            },
	            50741: {
	                'name': 'MakerNoteSafety',
	                'type': 'Short'
	            },
	            50778: {
	                'name': 'CalibrationIlluminant1',
	                'type': 'Short'
	            },
	            50779: {
	                'name': 'CalibrationIlluminant2',
	                'type': 'Short'
	            },
	            50780: {
	                'name': 'BestQualityScale',
	                'type': 'Rational'
	            },
	            50781: {
	                'name': 'RawDataUniqueID',
	                'type': 'Byte'
	            },
	            50827: {
	                'name': 'OriginalRawFileName',
	                'type': 'Byte'
	            },
	            50828: {
	                'name': 'OriginalRawFileData',
	                'type': 'Undefined'
	            },
	            50829: {
	                'name': 'ActiveArea',
	                'type': 'Short'
	            },
	            50830: {
	                'name': 'MaskedAreas',
	                'type': 'Short'
	            },
	            50831: {
	                'name': 'AsShotICCProfile',
	                'type': 'Undefined'
	            },
	            50832: {
	                'name': 'AsShotPreProfileMatrix',
	                'type': 'SRational'
	            },
	            50833: {
	                'name': 'CurrentICCProfile',
	                'type': 'Undefined'
	            },
	            50834: {
	                'name': 'CurrentPreProfileMatrix',
	                'type': 'SRational'
	            },
	            50879: {
	                'name': 'ColorimetricReference',
	                'type': 'Short'
	            },
	            50931: {
	                'name': 'CameraCalibrationSignature',
	                'type': 'Byte'
	            },
	            50932: {
	                'name': 'ProfileCalibrationSignature',
	                'type': 'Byte'
	            },
	            50934: {
	                'name': 'AsShotProfileName',
	                'type': 'Byte'
	            },
	            50935: {
	                'name': 'NoiseReductionApplied',
	                'type': 'Rational'
	            },
	            50936: {
	                'name': 'ProfileName',
	                'type': 'Byte'
	            },
	            50937: {
	                'name': 'ProfileHueSatMapDims',
	                'type': 'Long'
	            },
	            50938: {
	                'name': 'ProfileHueSatMapData1',
	                'type': 'Float'
	            },
	            50939: {
	                'name': 'ProfileHueSatMapData2',
	                'type': 'Float'
	            },
	            50940: {
	                'name': 'ProfileToneCurve',
	                'type': 'Float'
	            },
	            50941: {
	                'name': 'ProfileEmbedPolicy',
	                'type': 'Long'
	            },
	            50942: {
	                'name': 'ProfileCopyright',
	                'type': 'Byte'
	            },
	            50964: {
	                'name': 'ForwardMatrix1',
	                'type': 'SRational'
	            },
	            50965: {
	                'name': 'ForwardMatrix2',
	                'type': 'SRational'
	            },
	            50966: {
	                'name': 'PreviewApplicationName',
	                'type': 'Byte'
	            },
	            50967: {
	                'name': 'PreviewApplicationVersion',
	                'type': 'Byte'
	            },
	            50968: {
	                'name': 'PreviewSettingsName',
	                'type': 'Byte'
	            },
	            50969: {
	                'name': 'PreviewSettingsDigest',
	                'type': 'Byte'
	            },
	            50970: {
	                'name': 'PreviewColorSpace',
	                'type': 'Long'
	            },
	            50971: {
	                'name': 'PreviewDateTime',
	                'type': 'Ascii'
	            },
	            50972: {
	                'name': 'RawImageDigest',
	                'type': 'Undefined'
	            },
	            50973: {
	                'name': 'OriginalRawFileDigest',
	                'type': 'Undefined'
	            },
	            50974: {
	                'name': 'SubTileBlockSize',
	                'type': 'Long'
	            },
	            50975: {
	                'name': 'RowInterleaveFactor',
	                'type': 'Long'
	            },
	            50981: {
	                'name': 'ProfileLookTableDims',
	                'type': 'Long'
	            },
	            50982: {
	                'name': 'ProfileLookTableData',
	                'type': 'Float'
	            },
	            51008: {
	                'name': 'OpcodeList1',
	                'type': 'Undefined'
	            },
	            51009: {
	                'name': 'OpcodeList2',
	                'type': 'Undefined'
	            },
	            51022: {
	                'name': 'OpcodeList3',
	                'type': 'Undefined'
	            }
	        },
	        'Exif': {
	            33434: {
	                'name': 'ExposureTime',
	                'type': 'Rational'
	            },
	            33437: {
	                'name': 'FNumber',
	                'type': 'Rational'
	            },
	            34850: {
	                'name': 'ExposureProgram',
	                'type': 'Short'
	            },
	            34852: {
	                'name': 'SpectralSensitivity',
	                'type': 'Ascii'
	            },
	            34855: {
	                'name': 'ISOSpeedRatings',
	                'type': 'Short'
	            },
	            34856: {
	                'name': 'OECF',
	                'type': 'Undefined'
	            },
	            34864: {
	                'name': 'SensitivityType',
	                'type': 'Short'
	            },
	            34865: {
	                'name': 'StandardOutputSensitivity',
	                'type': 'Long'
	            },
	            34866: {
	                'name': 'RecommendedExposureIndex',
	                'type': 'Long'
	            },
	            34867: {
	                'name': 'ISOSpeed',
	                'type': 'Long'
	            },
	            34868: {
	                'name': 'ISOSpeedLatitudeyyy',
	                'type': 'Long'
	            },
	            34869: {
	                'name': 'ISOSpeedLatitudezzz',
	                'type': 'Long'
	            },
	            36864: {
	                'name': 'ExifVersion',
	                'type': 'Undefined'
	            },
	            36867: {
	                'name': 'DateTimeOriginal',
	                'type': 'Ascii'
	            },
	            36868: {
	                'name': 'DateTimeDigitized',
	                'type': 'Ascii'
	            },
	            37121: {
	                'name': 'ComponentsConfiguration',
	                'type': 'Undefined'
	            },
	            37122: {
	                'name': 'CompressedBitsPerPixel',
	                'type': 'Rational'
	            },
	            37377: {
	                'name': 'ShutterSpeedValue',
	                'type': 'SRational'
	            },
	            37378: {
	                'name': 'ApertureValue',
	                'type': 'Rational'
	            },
	            37379: {
	                'name': 'BrightnessValue',
	                'type': 'SRational'
	            },
	            37380: {
	                'name': 'ExposureBiasValue',
	                'type': 'SRational'
	            },
	            37381: {
	                'name': 'MaxApertureValue',
	                'type': 'Rational'
	            },
	            37382: {
	                'name': 'SubjectDistance',
	                'type': 'Rational'
	            },
	            37383: {
	                'name': 'MeteringMode',
	                'type': 'Short'
	            },
	            37384: {
	                'name': 'LightSource',
	                'type': 'Short'
	            },
	            37385: {
	                'name': 'Flash',
	                'type': 'Short'
	            },
	            37386: {
	                'name': 'FocalLength',
	                'type': 'Rational'
	            },
	            37396: {
	                'name': 'SubjectArea',
	                'type': 'Short'
	            },
	            37500: {
	                'name': 'MakerNote',
	                'type': 'Undefined'
	            },
	            37510: {
	                'name': 'UserComment',
	                'type': 'Ascii'
	            },
	            37520: {
	                'name': 'SubSecTime',
	                'type': 'Ascii'
	            },
	            37521: {
	                'name': 'SubSecTimeOriginal',
	                'type': 'Ascii'
	            },
	            37522: {
	                'name': 'SubSecTimeDigitized',
	                'type': 'Ascii'
	            },
	            40960: {
	                'name': 'FlashpixVersion',
	                'type': 'Undefined'
	            },
	            40961: {
	                'name': 'ColorSpace',
	                'type': 'Short'
	            },
	            40962: {
	                'name': 'PixelXDimension',
	                'type': 'Long'
	            },
	            40963: {
	                'name': 'PixelYDimension',
	                'type': 'Long'
	            },
	            40964: {
	                'name': 'RelatedSoundFile',
	                'type': 'Ascii'
	            },
	            40965: {
	                'name': 'InteroperabilityTag',
	                'type': 'Long'
	            },
	            41483: {
	                'name': 'FlashEnergy',
	                'type': 'Rational'
	            },
	            41484: {
	                'name': 'SpatialFrequencyResponse',
	                'type': 'Undefined'
	            },
	            41486: {
	                'name': 'FocalPlaneXResolution',
	                'type': 'Rational'
	            },
	            41487: {
	                'name': 'FocalPlaneYResolution',
	                'type': 'Rational'
	            },
	            41488: {
	                'name': 'FocalPlaneResolutionUnit',
	                'type': 'Short'
	            },
	            41492: {
	                'name': 'SubjectLocation',
	                'type': 'Short'
	            },
	            41493: {
	                'name': 'ExposureIndex',
	                'type': 'Rational'
	            },
	            41495: {
	                'name': 'SensingMethod',
	                'type': 'Short'
	            },
	            41728: {
	                'name': 'FileSource',
	                'type': 'Undefined'
	            },
	            41729: {
	                'name': 'SceneType',
	                'type': 'Undefined'
	            },
	            41730: {
	                'name': 'CFAPattern',
	                'type': 'Undefined'
	            },
	            41985: {
	                'name': 'CustomRendered',
	                'type': 'Short'
	            },
	            41986: {
	                'name': 'ExposureMode',
	                'type': 'Short'
	            },
	            41987: {
	                'name': 'WhiteBalance',
	                'type': 'Short'
	            },
	            41988: {
	                'name': 'DigitalZoomRatio',
	                'type': 'Rational'
	            },
	            41989: {
	                'name': 'FocalLengthIn35mmFilm',
	                'type': 'Short'
	            },
	            41990: {
	                'name': 'SceneCaptureType',
	                'type': 'Short'
	            },
	            41991: {
	                'name': 'GainControl',
	                'type': 'Short'
	            },
	            41992: {
	                'name': 'Contrast',
	                'type': 'Short'
	            },
	            41993: {
	                'name': 'Saturation',
	                'type': 'Short'
	            },
	            41994: {
	                'name': 'Sharpness',
	                'type': 'Short'
	            },
	            41995: {
	                'name': 'DeviceSettingDescription',
	                'type': 'Undefined'
	            },
	            41996: {
	                'name': 'SubjectDistanceRange',
	                'type': 'Short'
	            },
	            42016: {
	                'name': 'ImageUniqueID',
	                'type': 'Ascii'
	            },
	            42032: {
	                'name': 'CameraOwnerName',
	                'type': 'Ascii'
	            },
	            42033: {
	                'name': 'BodySerialNumber',
	                'type': 'Ascii'
	            },
	            42034: {
	                'name': 'LensSpecification',
	                'type': 'Rational'
	            },
	            42035: {
	                'name': 'LensMake',
	                'type': 'Ascii'
	            },
	            42036: {
	                'name': 'LensModel',
	                'type': 'Ascii'
	            },
	            42037: {
	                'name': 'LensSerialNumber',
	                'type': 'Ascii'
	            },
	            42240: {
	                'name': 'Gamma',
	                'type': 'Rational'
	            }
	        },
	        'GPS': {
	            0: {
	                'name': 'GPSVersionID',
	                'type': 'Byte'
	            },
	            1: {
	                'name': 'GPSLatitudeRef',
	                'type': 'Ascii'
	            },
	            2: {
	                'name': 'GPSLatitude',
	                'type': 'Rational'
	            },
	            3: {
	                'name': 'GPSLongitudeRef',
	                'type': 'Ascii'
	            },
	            4: {
	                'name': 'GPSLongitude',
	                'type': 'Rational'
	            },
	            5: {
	                'name': 'GPSAltitudeRef',
	                'type': 'Byte'
	            },
	            6: {
	                'name': 'GPSAltitude',
	                'type': 'Rational'
	            },
	            7: {
	                'name': 'GPSTimeStamp',
	                'type': 'Rational'
	            },
	            8: {
	                'name': 'GPSSatellites',
	                'type': 'Ascii'
	            },
	            9: {
	                'name': 'GPSStatus',
	                'type': 'Ascii'
	            },
	            10: {
	                'name': 'GPSMeasureMode',
	                'type': 'Ascii'
	            },
	            11: {
	                'name': 'GPSDOP',
	                'type': 'Rational'
	            },
	            12: {
	                'name': 'GPSSpeedRef',
	                'type': 'Ascii'
	            },
	            13: {
	                'name': 'GPSSpeed',
	                'type': 'Rational'
	            },
	            14: {
	                'name': 'GPSTrackRef',
	                'type': 'Ascii'
	            },
	            15: {
	                'name': 'GPSTrack',
	                'type': 'Rational'
	            },
	            16: {
	                'name': 'GPSImgDirectionRef',
	                'type': 'Ascii'
	            },
	            17: {
	                'name': 'GPSImgDirection',
	                'type': 'Rational'
	            },
	            18: {
	                'name': 'GPSMapDatum',
	                'type': 'Ascii'
	            },
	            19: {
	                'name': 'GPSDestLatitudeRef',
	                'type': 'Ascii'
	            },
	            20: {
	                'name': 'GPSDestLatitude',
	                'type': 'Rational'
	            },
	            21: {
	                'name': 'GPSDestLongitudeRef',
	                'type': 'Ascii'
	            },
	            22: {
	                'name': 'GPSDestLongitude',
	                'type': 'Rational'
	            },
	            23: {
	                'name': 'GPSDestBearingRef',
	                'type': 'Ascii'
	            },
	            24: {
	                'name': 'GPSDestBearing',
	                'type': 'Rational'
	            },
	            25: {
	                'name': 'GPSDestDistanceRef',
	                'type': 'Ascii'
	            },
	            26: {
	                'name': 'GPSDestDistance',
	                'type': 'Rational'
	            },
	            27: {
	                'name': 'GPSProcessingMethod',
	                'type': 'Undefined'
	            },
	            28: {
	                'name': 'GPSAreaInformation',
	                'type': 'Undefined'
	            },
	            29: {
	                'name': 'GPSDateStamp',
	                'type': 'Ascii'
	            },
	            30: {
	                'name': 'GPSDifferential',
	                'type': 'Short'
	            },
	            31: {
	                'name': 'GPSHPositioningError',
	                'type': 'Rational'
	            }
	        },
	        'Interop': {
	            1: {
	                'name': 'InteroperabilityIndex',
	                'type': 'Ascii'
	            }
	        },
	    };
	    TAGS["0th"] = TAGS["Image"];
	    TAGS["1st"] = TAGS["Image"];
	    that.TAGS = TAGS;

	    
	    that.ImageIFD = {
	        ProcessingSoftware:11,
	        NewSubfileType:254,
	        SubfileType:255,
	        ImageWidth:256,
	        ImageLength:257,
	        BitsPerSample:258,
	        Compression:259,
	        PhotometricInterpretation:262,
	        Threshholding:263,
	        CellWidth:264,
	        CellLength:265,
	        FillOrder:266,
	        DocumentName:269,
	        ImageDescription:270,
	        Make:271,
	        Model:272,
	        StripOffsets:273,
	        Orientation:274,
	        SamplesPerPixel:277,
	        RowsPerStrip:278,
	        StripByteCounts:279,
	        XResolution:282,
	        YResolution:283,
	        PlanarConfiguration:284,
	        GrayResponseUnit:290,
	        GrayResponseCurve:291,
	        T4Options:292,
	        T6Options:293,
	        ResolutionUnit:296,
	        TransferFunction:301,
	        Software:305,
	        DateTime:306,
	        Artist:315,
	        HostComputer:316,
	        Predictor:317,
	        WhitePoint:318,
	        PrimaryChromaticities:319,
	        ColorMap:320,
	        HalftoneHints:321,
	        TileWidth:322,
	        TileLength:323,
	        TileOffsets:324,
	        TileByteCounts:325,
	        SubIFDs:330,
	        InkSet:332,
	        InkNames:333,
	        NumberOfInks:334,
	        DotRange:336,
	        TargetPrinter:337,
	        ExtraSamples:338,
	        SampleFormat:339,
	        SMinSampleValue:340,
	        SMaxSampleValue:341,
	        TransferRange:342,
	        ClipPath:343,
	        XClipPathUnits:344,
	        YClipPathUnits:345,
	        Indexed:346,
	        JPEGTables:347,
	        OPIProxy:351,
	        JPEGProc:512,
	        JPEGInterchangeFormat:513,
	        JPEGInterchangeFormatLength:514,
	        JPEGRestartInterval:515,
	        JPEGLosslessPredictors:517,
	        JPEGPointTransforms:518,
	        JPEGQTables:519,
	        JPEGDCTables:520,
	        JPEGACTables:521,
	        YCbCrCoefficients:529,
	        YCbCrSubSampling:530,
	        YCbCrPositioning:531,
	        ReferenceBlackWhite:532,
	        XMLPacket:700,
	        Rating:18246,
	        RatingPercent:18249,
	        ImageID:32781,
	        CFARepeatPatternDim:33421,
	        CFAPattern:33422,
	        BatteryLevel:33423,
	        Copyright:33432,
	        ExposureTime:33434,
	        ImageResources:34377,
	        ExifTag:34665,
	        InterColorProfile:34675,
	        GPSTag:34853,
	        Interlace:34857,
	        TimeZoneOffset:34858,
	        SelfTimerMode:34859,
	        FlashEnergy:37387,
	        SpatialFrequencyResponse:37388,
	        Noise:37389,
	        FocalPlaneXResolution:37390,
	        FocalPlaneYResolution:37391,
	        FocalPlaneResolutionUnit:37392,
	        ImageNumber:37393,
	        SecurityClassification:37394,
	        ImageHistory:37395,
	        ExposureIndex:37397,
	        TIFFEPStandardID:37398,
	        SensingMethod:37399,
	        XPTitle:40091,
	        XPComment:40092,
	        XPAuthor:40093,
	        XPKeywords:40094,
	        XPSubject:40095,
	        PrintImageMatching:50341,
	        DNGVersion:50706,
	        DNGBackwardVersion:50707,
	        UniqueCameraModel:50708,
	        LocalizedCameraModel:50709,
	        CFAPlaneColor:50710,
	        CFALayout:50711,
	        LinearizationTable:50712,
	        BlackLevelRepeatDim:50713,
	        BlackLevel:50714,
	        BlackLevelDeltaH:50715,
	        BlackLevelDeltaV:50716,
	        WhiteLevel:50717,
	        DefaultScale:50718,
	        DefaultCropOrigin:50719,
	        DefaultCropSize:50720,
	        ColorMatrix1:50721,
	        ColorMatrix2:50722,
	        CameraCalibration1:50723,
	        CameraCalibration2:50724,
	        ReductionMatrix1:50725,
	        ReductionMatrix2:50726,
	        AnalogBalance:50727,
	        AsShotNeutral:50728,
	        AsShotWhiteXY:50729,
	        BaselineExposure:50730,
	        BaselineNoise:50731,
	        BaselineSharpness:50732,
	        BayerGreenSplit:50733,
	        LinearResponseLimit:50734,
	        CameraSerialNumber:50735,
	        LensInfo:50736,
	        ChromaBlurRadius:50737,
	        AntiAliasStrength:50738,
	        ShadowScale:50739,
	        DNGPrivateData:50740,
	        MakerNoteSafety:50741,
	        CalibrationIlluminant1:50778,
	        CalibrationIlluminant2:50779,
	        BestQualityScale:50780,
	        RawDataUniqueID:50781,
	        OriginalRawFileName:50827,
	        OriginalRawFileData:50828,
	        ActiveArea:50829,
	        MaskedAreas:50830,
	        AsShotICCProfile:50831,
	        AsShotPreProfileMatrix:50832,
	        CurrentICCProfile:50833,
	        CurrentPreProfileMatrix:50834,
	        ColorimetricReference:50879,
	        CameraCalibrationSignature:50931,
	        ProfileCalibrationSignature:50932,
	        AsShotProfileName:50934,
	        NoiseReductionApplied:50935,
	        ProfileName:50936,
	        ProfileHueSatMapDims:50937,
	        ProfileHueSatMapData1:50938,
	        ProfileHueSatMapData2:50939,
	        ProfileToneCurve:50940,
	        ProfileEmbedPolicy:50941,
	        ProfileCopyright:50942,
	        ForwardMatrix1:50964,
	        ForwardMatrix2:50965,
	        PreviewApplicationName:50966,
	        PreviewApplicationVersion:50967,
	        PreviewSettingsName:50968,
	        PreviewSettingsDigest:50969,
	        PreviewColorSpace:50970,
	        PreviewDateTime:50971,
	        RawImageDigest:50972,
	        OriginalRawFileDigest:50973,
	        SubTileBlockSize:50974,
	        RowInterleaveFactor:50975,
	        ProfileLookTableDims:50981,
	        ProfileLookTableData:50982,
	        OpcodeList1:51008,
	        OpcodeList2:51009,
	        OpcodeList3:51022,
	        NoiseProfile:51041,
	    };

	    
	    that.ExifIFD = {
	        ExposureTime:33434,
	        FNumber:33437,
	        ExposureProgram:34850,
	        SpectralSensitivity:34852,
	        ISOSpeedRatings:34855,
	        OECF:34856,
	        SensitivityType:34864,
	        StandardOutputSensitivity:34865,
	        RecommendedExposureIndex:34866,
	        ISOSpeed:34867,
	        ISOSpeedLatitudeyyy:34868,
	        ISOSpeedLatitudezzz:34869,
	        ExifVersion:36864,
	        DateTimeOriginal:36867,
	        DateTimeDigitized:36868,
	        ComponentsConfiguration:37121,
	        CompressedBitsPerPixel:37122,
	        ShutterSpeedValue:37377,
	        ApertureValue:37378,
	        BrightnessValue:37379,
	        ExposureBiasValue:37380,
	        MaxApertureValue:37381,
	        SubjectDistance:37382,
	        MeteringMode:37383,
	        LightSource:37384,
	        Flash:37385,
	        FocalLength:37386,
	        SubjectArea:37396,
	        MakerNote:37500,
	        UserComment:37510,
	        SubSecTime:37520,
	        SubSecTimeOriginal:37521,
	        SubSecTimeDigitized:37522,
	        FlashpixVersion:40960,
	        ColorSpace:40961,
	        PixelXDimension:40962,
	        PixelYDimension:40963,
	        RelatedSoundFile:40964,
	        InteroperabilityTag:40965,
	        FlashEnergy:41483,
	        SpatialFrequencyResponse:41484,
	        FocalPlaneXResolution:41486,
	        FocalPlaneYResolution:41487,
	        FocalPlaneResolutionUnit:41488,
	        SubjectLocation:41492,
	        ExposureIndex:41493,
	        SensingMethod:41495,
	        FileSource:41728,
	        SceneType:41729,
	        CFAPattern:41730,
	        CustomRendered:41985,
	        ExposureMode:41986,
	        WhiteBalance:41987,
	        DigitalZoomRatio:41988,
	        FocalLengthIn35mmFilm:41989,
	        SceneCaptureType:41990,
	        GainControl:41991,
	        Contrast:41992,
	        Saturation:41993,
	        Sharpness:41994,
	        DeviceSettingDescription:41995,
	        SubjectDistanceRange:41996,
	        ImageUniqueID:42016,
	        CameraOwnerName:42032,
	        BodySerialNumber:42033,
	        LensSpecification:42034,
	        LensMake:42035,
	        LensModel:42036,
	        LensSerialNumber:42037,
	        Gamma:42240,
	    };


	    that.GPSIFD = {
	        GPSVersionID:0,
	        GPSLatitudeRef:1,
	        GPSLatitude:2,
	        GPSLongitudeRef:3,
	        GPSLongitude:4,
	        GPSAltitudeRef:5,
	        GPSAltitude:6,
	        GPSTimeStamp:7,
	        GPSSatellites:8,
	        GPSStatus:9,
	        GPSMeasureMode:10,
	        GPSDOP:11,
	        GPSSpeedRef:12,
	        GPSSpeed:13,
	        GPSTrackRef:14,
	        GPSTrack:15,
	        GPSImgDirectionRef:16,
	        GPSImgDirection:17,
	        GPSMapDatum:18,
	        GPSDestLatitudeRef:19,
	        GPSDestLatitude:20,
	        GPSDestLongitudeRef:21,
	        GPSDestLongitude:22,
	        GPSDestBearingRef:23,
	        GPSDestBearing:24,
	        GPSDestDistanceRef:25,
	        GPSDestDistance:26,
	        GPSProcessingMethod:27,
	        GPSAreaInformation:28,
	        GPSDateStamp:29,
	        GPSDifferential:30,
	        GPSHPositioningError:31,
	    };


	    that.InteropIFD = {
	        InteroperabilityIndex:1,
	    };

	    that.GPSHelper = {
	        degToDmsRational:function (degFloat) {
	            var degAbs = Math.abs(degFloat);
	            var minFloat = degAbs % 1 * 60;
	            var secFloat = minFloat % 1 * 60;
	            var deg = Math.floor(degAbs);
	            var min = Math.floor(minFloat);
	            var sec = Math.round(secFloat * 100);

	            return [[deg, 1], [min, 1], [sec, 100]];
	        },

	        dmsRationalToDeg:function (dmsArray, ref) {
	            var sign = (ref === 'S' || ref === 'W') ? -1.0 : 1.0;
	            var deg = dmsArray[0][0] / dmsArray[0][1] +
	                      dmsArray[1][0] / dmsArray[1][1] / 60.0 +
	                      dmsArray[2][0] / dmsArray[2][1] / 3600.0;

	            return deg * sign;
	        }
	    };
	    
	    
	    {
	        if ( module.exports) {
	            exports = module.exports = that;
	        }
	        exports.piexif = that;
	    }

	})();
	});
	var piexif_1 = piexif.piexif;

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
		tiles.src = `/sheets/default_2_color.png`;

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
			const r = piexif.load(img);
			return JSON.parse(r[`0th`][piexif.ImageIFD.Make])
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
							from: $path.join(Wheel.DENOTE),
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
						const components = item.split(Wheel.DENOTE);
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

	var wheel = extend({
		rez () {
			this.cancel = this.value.listen((wheels) => {
				if (typeof wheels === `string`) wheels = [wheels];
				if (!Array.isArray(wheels)) return wheels
				wheels = new Set(wheels);

				this.wheels = {};

				wheels.forEach((wheel) => {
					if (this.wheels[wheel]) return

					const worker = this.wheels[wheel] = new Worker(`/bin/wheel.bundle.js`);

					worker.postMessage({
						action: `wheel`,
						data: wheel
					});

					// add all display info
					worker.onmessage = ({ data }) => {
						console.log(data);
					};
				});

				Object.keys(this.wheels).forEach((key) => {

				});
			});
		},

		derez () {
			this.cancel();

			Object.values(this.wheels).forEach((wheel) => {
				wheel.terminate();
			});
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
		need: need,
		wheel: wheel
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
				this.weave.remove(
					this.scripts(key)
				);
			});

			this.value.set($space);
		},

		scripts (key) {
			const id = this.id.get();
			return 	[
				...this.weave.chain(`${id}/${key}`).slice(0, -1),
				...this.weave.chain(`${id}/${key}`, true).slice(1)
			]
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
		const c = color(val_n);
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

	var INUMBER = 'INUMBER';
	var IOP1 = 'IOP1';
	var IOP2 = 'IOP2';
	var IOP3 = 'IOP3';
	var IVAR = 'IVAR';
	var IVARNAME = 'IVARNAME';
	var IFUNCALL = 'IFUNCALL';
	var IFUNDEF = 'IFUNDEF';
	var IEXPR = 'IEXPR';
	var IEXPREVAL = 'IEXPREVAL';
	var IMEMBER = 'IMEMBER';
	var IENDSTATEMENT = 'IENDSTATEMENT';
	var IARRAY = 'IARRAY';

	function Instruction(type, value) {
	  this.type = type;
	  this.value = (value !== undefined && value !== null) ? value : 0;
	}

	Instruction.prototype.toString = function () {
	  switch (this.type) {
	    case INUMBER:
	    case IOP1:
	    case IOP2:
	    case IOP3:
	    case IVAR:
	    case IVARNAME:
	    case IENDSTATEMENT:
	      return this.value;
	    case IFUNCALL:
	      return 'CALL ' + this.value;
	    case IFUNDEF:
	      return 'DEF ' + this.value;
	    case IARRAY:
	      return 'ARRAY ' + this.value;
	    case IMEMBER:
	      return '.' + this.value;
	    default:
	      return 'Invalid Instruction';
	  }
	};

	function unaryInstruction(value) {
	  return new Instruction(IOP1, value);
	}

	function binaryInstruction(value) {
	  return new Instruction(IOP2, value);
	}

	function ternaryInstruction(value) {
	  return new Instruction(IOP3, value);
	}

	function simplify(tokens, unaryOps, binaryOps, ternaryOps, values) {
	  var nstack = [];
	  var newexpression = [];
	  var n1, n2, n3;
	  var f;
	  for (var i = 0; i < tokens.length; i++) {
	    var item = tokens[i];
	    var type = item.type;
	    if (type === INUMBER || type === IVARNAME) {
	      if (Array.isArray(item.value)) {
	        nstack.push.apply(nstack, simplify(item.value.map(function (x) {
	          return new Instruction(INUMBER, x);
	        }).concat(new Instruction(IARRAY, item.value.length)), unaryOps, binaryOps, ternaryOps, values));
	      } else {
	        nstack.push(item);
	      }
	    } else if (type === IVAR && values.hasOwnProperty(item.value)) {
	      item = new Instruction(INUMBER, values[item.value]);
	      nstack.push(item);
	    } else if (type === IOP2 && nstack.length > 1) {
	      n2 = nstack.pop();
	      n1 = nstack.pop();
	      f = binaryOps[item.value];
	      item = new Instruction(INUMBER, f(n1.value, n2.value));
	      nstack.push(item);
	    } else if (type === IOP3 && nstack.length > 2) {
	      n3 = nstack.pop();
	      n2 = nstack.pop();
	      n1 = nstack.pop();
	      if (item.value === '?') {
	        nstack.push(n1.value ? n2.value : n3.value);
	      } else {
	        f = ternaryOps[item.value];
	        item = new Instruction(INUMBER, f(n1.value, n2.value, n3.value));
	        nstack.push(item);
	      }
	    } else if (type === IOP1 && nstack.length > 0) {
	      n1 = nstack.pop();
	      f = unaryOps[item.value];
	      item = new Instruction(INUMBER, f(n1.value));
	      nstack.push(item);
	    } else if (type === IEXPR) {
	      while (nstack.length > 0) {
	        newexpression.push(nstack.shift());
	      }
	      newexpression.push(new Instruction(IEXPR, simplify(item.value, unaryOps, binaryOps, ternaryOps, values)));
	    } else if (type === IMEMBER && nstack.length > 0) {
	      n1 = nstack.pop();
	      nstack.push(new Instruction(INUMBER, n1.value[item.value]));
	    } /* else if (type === IARRAY && nstack.length >= item.value) {
	      var length = item.value;
	      while (length-- > 0) {
	        newexpression.push(nstack.pop());
	      }
	      newexpression.push(new Instruction(IARRAY, item.value));
	    } */ else {
	      while (nstack.length > 0) {
	        newexpression.push(nstack.shift());
	      }
	      newexpression.push(item);
	    }
	  }
	  while (nstack.length > 0) {
	    newexpression.push(nstack.shift());
	  }
	  return newexpression;
	}

	function substitute(tokens, variable, expr) {
	  var newexpression = [];
	  for (var i = 0; i < tokens.length; i++) {
	    var item = tokens[i];
	    var type = item.type;
	    if (type === IVAR && item.value === variable) {
	      for (var j = 0; j < expr.tokens.length; j++) {
	        var expritem = expr.tokens[j];
	        var replitem;
	        if (expritem.type === IOP1) {
	          replitem = unaryInstruction(expritem.value);
	        } else if (expritem.type === IOP2) {
	          replitem = binaryInstruction(expritem.value);
	        } else if (expritem.type === IOP3) {
	          replitem = ternaryInstruction(expritem.value);
	        } else {
	          replitem = new Instruction(expritem.type, expritem.value);
	        }
	        newexpression.push(replitem);
	      }
	    } else if (type === IEXPR) {
	      newexpression.push(new Instruction(IEXPR, substitute(item.value, variable, expr)));
	    } else {
	      newexpression.push(item);
	    }
	  }
	  return newexpression;
	}

	function evaluate(tokens, expr, values) {
	  var nstack = [];
	  var n1, n2, n3;
	  var f, args, argCount;

	  if (isExpressionEvaluator(tokens)) {
	    return resolveExpression(tokens, values);
	  }

	  var numTokens = tokens.length;

	  for (var i = 0; i < numTokens; i++) {
	    var item = tokens[i];
	    var type = item.type;
	    if (type === INUMBER || type === IVARNAME) {
	      nstack.push(item.value);
	    } else if (type === IOP2) {
	      n2 = nstack.pop();
	      n1 = nstack.pop();
	      if (item.value === 'and') {
	        nstack.push(n1 ? !!evaluate(n2, expr, values) : false);
	      } else if (item.value === 'or') {
	        nstack.push(n1 ? true : !!evaluate(n2, expr, values));
	      } else if (item.value === '=') {
	        f = expr.binaryOps[item.value];
	        nstack.push(f(n1, evaluate(n2, expr, values), values));
	      } else {
	        f = expr.binaryOps[item.value];
	        nstack.push(f(resolveExpression(n1, values), resolveExpression(n2, values)));
	      }
	    } else if (type === IOP3) {
	      n3 = nstack.pop();
	      n2 = nstack.pop();
	      n1 = nstack.pop();
	      if (item.value === '?') {
	        nstack.push(evaluate(n1 ? n2 : n3, expr, values));
	      } else {
	        f = expr.ternaryOps[item.value];
	        nstack.push(f(resolveExpression(n1, values), resolveExpression(n2, values), resolveExpression(n3, values)));
	      }
	    } else if (type === IVAR) {
	      if (item.value in expr.functions) {
	        nstack.push(expr.functions[item.value]);
	      } else if (item.value in expr.unaryOps && expr.parser.isOperatorEnabled(item.value)) {
	        nstack.push(expr.unaryOps[item.value]);
	      } else {
	        var v = values[item.value];
	        if (v !== undefined) {
	          nstack.push(v);
	        } else {
	          throw new Error('undefined variable: ' + item.value);
	        }
	      }
	    } else if (type === IOP1) {
	      n1 = nstack.pop();
	      f = expr.unaryOps[item.value];
	      nstack.push(f(resolveExpression(n1, values)));
	    } else if (type === IFUNCALL) {
	      argCount = item.value;
	      args = [];
	      while (argCount-- > 0) {
	        args.unshift(resolveExpression(nstack.pop(), values));
	      }
	      f = nstack.pop();
	      if (f.apply && f.call) {
	        nstack.push(f.apply(undefined, args));
	      } else {
	        throw new Error(f + ' is not a function');
	      }
	    } else if (type === IFUNDEF) {
	      // Create closure to keep references to arguments and expression
	      nstack.push((function () {
	        var n2 = nstack.pop();
	        var args = [];
	        var argCount = item.value;
	        while (argCount-- > 0) {
	          args.unshift(nstack.pop());
	        }
	        var n1 = nstack.pop();
	        var f = function () {
	          var scope = Object.assign({}, values);
	          for (var i = 0, len = args.length; i < len; i++) {
	            scope[args[i]] = arguments[i];
	          }
	          return evaluate(n2, expr, scope);
	        };
	        // f.name = n1
	        Object.defineProperty(f, 'name', {
	          value: n1,
	          writable: false
	        });
	        values[n1] = f;
	        return f;
	      })());
	    } else if (type === IEXPR) {
	      nstack.push(createExpressionEvaluator(item, expr));
	    } else if (type === IEXPREVAL) {
	      nstack.push(item);
	    } else if (type === IMEMBER) {
	      n1 = nstack.pop();
	      nstack.push(n1[item.value]);
	    } else if (type === IENDSTATEMENT) {
	      nstack.pop();
	    } else if (type === IARRAY) {
	      argCount = item.value;
	      args = [];
	      while (argCount-- > 0) {
	        args.unshift(nstack.pop());
	      }
	      nstack.push(args);
	    } else {
	      throw new Error('invalid Expression');
	    }
	  }
	  if (nstack.length > 1) {
	    throw new Error('invalid Expression (parity)');
	  }
	  // Explicitly return zero to avoid test issues caused by -0
	  return nstack[0] === 0 ? 0 : resolveExpression(nstack[0], values);
	}

	function createExpressionEvaluator(token, expr, values) {
	  if (isExpressionEvaluator(token)) return token;
	  return {
	    type: IEXPREVAL,
	    value: function (scope) {
	      return evaluate(token.value, expr, scope);
	    }
	  };
	}

	function isExpressionEvaluator(n) {
	  return n && n.type === IEXPREVAL;
	}

	function resolveExpression(n, values) {
	  return isExpressionEvaluator(n) ? n.value(values) : n;
	}

	function expressionToString(tokens, toJS) {
	  var nstack = [];
	  var n1, n2, n3;
	  var f, args, argCount;
	  for (var i = 0; i < tokens.length; i++) {
	    var item = tokens[i];
	    var type = item.type;
	    if (type === INUMBER) {
	      if (typeof item.value === 'number' && item.value < 0) {
	        nstack.push('(' + item.value + ')');
	      } else if (Array.isArray(item.value)) {
	        nstack.push('[' + item.value.map(escapeValue).join(', ') + ']');
	      } else {
	        nstack.push(escapeValue(item.value));
	      }
	    } else if (type === IOP2) {
	      n2 = nstack.pop();
	      n1 = nstack.pop();
	      f = item.value;
	      if (toJS) {
	        if (f === '^') {
	          nstack.push('Math.pow(' + n1 + ', ' + n2 + ')');
	        } else if (f === 'and') {
	          nstack.push('(!!' + n1 + ' && !!' + n2 + ')');
	        } else if (f === 'or') {
	          nstack.push('(!!' + n1 + ' || !!' + n2 + ')');
	        } else if (f === '||') {
	          nstack.push('(function(a,b){ return Array.isArray(a) && Array.isArray(b) ? a.concat(b) : String(a) + String(b); }((' + n1 + '),(' + n2 + ')))');
	        } else if (f === '==') {
	          nstack.push('(' + n1 + ' === ' + n2 + ')');
	        } else if (f === '!=') {
	          nstack.push('(' + n1 + ' !== ' + n2 + ')');
	        } else if (f === '[') {
	          nstack.push(n1 + '[(' + n2 + ') | 0]');
	        } else {
	          nstack.push('(' + n1 + ' ' + f + ' ' + n2 + ')');
	        }
	      } else {
	        if (f === '[') {
	          nstack.push(n1 + '[' + n2 + ']');
	        } else {
	          nstack.push('(' + n1 + ' ' + f + ' ' + n2 + ')');
	        }
	      }
	    } else if (type === IOP3) {
	      n3 = nstack.pop();
	      n2 = nstack.pop();
	      n1 = nstack.pop();
	      f = item.value;
	      if (f === '?') {
	        nstack.push('(' + n1 + ' ? ' + n2 + ' : ' + n3 + ')');
	      } else {
	        throw new Error('invalid Expression');
	      }
	    } else if (type === IVAR || type === IVARNAME) {
	      nstack.push(item.value);
	    } else if (type === IOP1) {
	      n1 = nstack.pop();
	      f = item.value;
	      if (f === '-' || f === '+') {
	        nstack.push('(' + f + n1 + ')');
	      } else if (toJS) {
	        if (f === 'not') {
	          nstack.push('(' + '!' + n1 + ')');
	        } else if (f === '!') {
	          nstack.push('fac(' + n1 + ')');
	        } else {
	          nstack.push(f + '(' + n1 + ')');
	        }
	      } else if (f === '!') {
	        nstack.push('(' + n1 + '!)');
	      } else {
	        nstack.push('(' + f + ' ' + n1 + ')');
	      }
	    } else if (type === IFUNCALL) {
	      argCount = item.value;
	      args = [];
	      while (argCount-- > 0) {
	        args.unshift(nstack.pop());
	      }
	      f = nstack.pop();
	      nstack.push(f + '(' + args.join(', ') + ')');
	    } else if (type === IFUNDEF) {
	      n2 = nstack.pop();
	      argCount = item.value;
	      args = [];
	      while (argCount-- > 0) {
	        args.unshift(nstack.pop());
	      }
	      n1 = nstack.pop();
	      if (toJS) {
	        nstack.push('(' + n1 + ' = function(' + args.join(', ') + ') { return ' + n2 + ' })');
	      } else {
	        nstack.push('(' + n1 + '(' + args.join(', ') + ') = ' + n2 + ')');
	      }
	    } else if (type === IMEMBER) {
	      n1 = nstack.pop();
	      nstack.push(n1 + '.' + item.value);
	    } else if (type === IARRAY) {
	      argCount = item.value;
	      args = [];
	      while (argCount-- > 0) {
	        args.unshift(nstack.pop());
	      }
	      nstack.push('[' + args.join(', ') + ']');
	    } else if (type === IEXPR) {
	      nstack.push('(' + expressionToString(item.value, toJS) + ')');
	    } else if (type === IENDSTATEMENT) ; else {
	      throw new Error('invalid Expression');
	    }
	  }
	  if (nstack.length > 1) {
	    if (toJS) {
	      nstack = [ nstack.join(',') ];
	    } else {
	      nstack = [ nstack.join(';') ];
	    }
	  }
	  return String(nstack[0]);
	}

	function escapeValue(v) {
	  if (typeof v === 'string') {
	    return JSON.stringify(v).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
	  }
	  return v;
	}

	function contains(array, obj) {
	  for (var i = 0; i < array.length; i++) {
	    if (array[i] === obj) {
	      return true;
	    }
	  }
	  return false;
	}

	function getSymbols(tokens, symbols, options) {
	  options = options || {};
	  var withMembers = !!options.withMembers;
	  var prevVar = null;

	  for (var i = 0; i < tokens.length; i++) {
	    var item = tokens[i];
	    if (item.type === IVAR || item.type === IVARNAME) {
	      if (!withMembers && !contains(symbols, item.value)) {
	        symbols.push(item.value);
	      } else if (prevVar !== null) {
	        if (!contains(symbols, prevVar)) {
	          symbols.push(prevVar);
	        }
	        prevVar = item.value;
	      } else {
	        prevVar = item.value;
	      }
	    } else if (item.type === IMEMBER && withMembers && prevVar !== null) {
	      prevVar += '.' + item.value;
	    } else if (item.type === IEXPR) {
	      getSymbols(item.value, symbols, options);
	    } else if (prevVar !== null) {
	      if (!contains(symbols, prevVar)) {
	        symbols.push(prevVar);
	      }
	      prevVar = null;
	    }
	  }

	  if (prevVar !== null && !contains(symbols, prevVar)) {
	    symbols.push(prevVar);
	  }
	}

	function Expression(tokens, parser) {
	  this.tokens = tokens;
	  this.parser = parser;
	  this.unaryOps = parser.unaryOps;
	  this.binaryOps = parser.binaryOps;
	  this.ternaryOps = parser.ternaryOps;
	  this.functions = parser.functions;
	}

	Expression.prototype.simplify = function (values) {
	  values = values || {};
	  return new Expression(simplify(this.tokens, this.unaryOps, this.binaryOps, this.ternaryOps, values), this.parser);
	};

	Expression.prototype.substitute = function (variable, expr) {
	  if (!(expr instanceof Expression)) {
	    expr = this.parser.parse(String(expr));
	  }

	  return new Expression(substitute(this.tokens, variable, expr), this.parser);
	};

	Expression.prototype.evaluate = function (values) {
	  values = values || {};
	  return evaluate(this.tokens, this, values);
	};

	Expression.prototype.toString = function () {
	  return expressionToString(this.tokens, false);
	};

	Expression.prototype.symbols = function (options) {
	  options = options || {};
	  var vars = [];
	  getSymbols(this.tokens, vars, options);
	  return vars;
	};

	Expression.prototype.variables = function (options) {
	  options = options || {};
	  var vars = [];
	  getSymbols(this.tokens, vars, options);
	  var functions = this.functions;
	  return vars.filter(function (name) {
	    return !(name in functions);
	  });
	};

	Expression.prototype.toJSFunction = function (param, variables) {
	  var expr = this;
	  var f = new Function(param, 'with(this.functions) with (this.ternaryOps) with (this.binaryOps) with (this.unaryOps) { return ' + expressionToString(this.simplify(variables).tokens, true) + '; }'); // eslint-disable-line no-new-func
	  return function () {
	    return f.apply(expr, arguments);
	  };
	};

	var TEOF = 'TEOF';
	var TOP = 'TOP';
	var TNUMBER = 'TNUMBER';
	var TSTRING = 'TSTRING';
	var TPAREN = 'TPAREN';
	var TBRACKET = 'TBRACKET';
	var TCOMMA = 'TCOMMA';
	var TNAME = 'TNAME';
	var TSEMICOLON = 'TSEMICOLON';

	function Token(type, value, index) {
	  this.type = type;
	  this.value = value;
	  this.index = index;
	}

	Token.prototype.toString = function () {
	  return this.type + ': ' + this.value;
	};

	function TokenStream(parser, expression) {
	  this.pos = 0;
	  this.current = null;
	  this.unaryOps = parser.unaryOps;
	  this.binaryOps = parser.binaryOps;
	  this.ternaryOps = parser.ternaryOps;
	  this.consts = parser.consts;
	  this.expression = expression;
	  this.savedPosition = 0;
	  this.savedCurrent = null;
	  this.options = parser.options;
	  this.parser = parser;
	}

	TokenStream.prototype.newToken = function (type, value, pos) {
	  return new Token(type, value, pos != null ? pos : this.pos);
	};

	TokenStream.prototype.save = function () {
	  this.savedPosition = this.pos;
	  this.savedCurrent = this.current;
	};

	TokenStream.prototype.restore = function () {
	  this.pos = this.savedPosition;
	  this.current = this.savedCurrent;
	};

	TokenStream.prototype.next = function () {
	  if (this.pos >= this.expression.length) {
	    return this.newToken(TEOF, 'EOF');
	  }

	  if (this.isWhitespace() || this.isComment()) {
	    return this.next();
	  } else if (this.isRadixInteger() ||
	      this.isNumber() ||
	      this.isOperator() ||
	      this.isString() ||
	      this.isParen() ||
	      this.isBracket() ||
	      this.isComma() ||
	      this.isSemicolon() ||
	      this.isNamedOp() ||
	      this.isConst() ||
	      this.isName()) {
	    return this.current;
	  } else {
	    this.parseError('Unknown character "' + this.expression.charAt(this.pos) + '"');
	  }
	};

	TokenStream.prototype.isString = function () {
	  var r = false;
	  var startPos = this.pos;
	  var quote = this.expression.charAt(startPos);

	  if (quote === '\'' || quote === '"') {
	    var index = this.expression.indexOf(quote, startPos + 1);
	    while (index >= 0 && this.pos < this.expression.length) {
	      this.pos = index + 1;
	      if (this.expression.charAt(index - 1) !== '\\') {
	        var rawString = this.expression.substring(startPos + 1, index);
	        this.current = this.newToken(TSTRING, this.unescape(rawString), startPos);
	        r = true;
	        break;
	      }
	      index = this.expression.indexOf(quote, index + 1);
	    }
	  }
	  return r;
	};

	TokenStream.prototype.isParen = function () {
	  var c = this.expression.charAt(this.pos);
	  if (c === '(' || c === ')') {
	    this.current = this.newToken(TPAREN, c);
	    this.pos++;
	    return true;
	  }
	  return false;
	};

	TokenStream.prototype.isBracket = function () {
	  var c = this.expression.charAt(this.pos);
	  if ((c === '[' || c === ']') && this.isOperatorEnabled('[')) {
	    this.current = this.newToken(TBRACKET, c);
	    this.pos++;
	    return true;
	  }
	  return false;
	};

	TokenStream.prototype.isComma = function () {
	  var c = this.expression.charAt(this.pos);
	  if (c === ',') {
	    this.current = this.newToken(TCOMMA, ',');
	    this.pos++;
	    return true;
	  }
	  return false;
	};

	TokenStream.prototype.isSemicolon = function () {
	  var c = this.expression.charAt(this.pos);
	  if (c === ';') {
	    this.current = this.newToken(TSEMICOLON, ';');
	    this.pos++;
	    return true;
	  }
	  return false;
	};

	TokenStream.prototype.isConst = function () {
	  var startPos = this.pos;
	  var i = startPos;
	  for (; i < this.expression.length; i++) {
	    var c = this.expression.charAt(i);
	    if (c.toUpperCase() === c.toLowerCase()) {
	      if (i === this.pos || (c !== '_' && c !== '.' && (c < '0' || c > '9'))) {
	        break;
	      }
	    }
	  }
	  if (i > startPos) {
	    var str = this.expression.substring(startPos, i);
	    if (str in this.consts) {
	      this.current = this.newToken(TNUMBER, this.consts[str]);
	      this.pos += str.length;
	      return true;
	    }
	  }
	  return false;
	};

	TokenStream.prototype.isNamedOp = function () {
	  var startPos = this.pos;
	  var i = startPos;
	  for (; i < this.expression.length; i++) {
	    var c = this.expression.charAt(i);
	    if (c.toUpperCase() === c.toLowerCase()) {
	      if (i === this.pos || (c !== '_' && (c < '0' || c > '9'))) {
	        break;
	      }
	    }
	  }
	  if (i > startPos) {
	    var str = this.expression.substring(startPos, i);
	    if (this.isOperatorEnabled(str) && (str in this.binaryOps || str in this.unaryOps || str in this.ternaryOps)) {
	      this.current = this.newToken(TOP, str);
	      this.pos += str.length;
	      return true;
	    }
	  }
	  return false;
	};

	TokenStream.prototype.isName = function () {
	  var startPos = this.pos;
	  var i = startPos;
	  var hasLetter = false;
	  for (; i < this.expression.length; i++) {
	    var c = this.expression.charAt(i);
	    if (c.toUpperCase() === c.toLowerCase()) {
	      if (i === this.pos && (c === '$' || c === '_')) {
	        if (c === '_') {
	          hasLetter = true;
	        }
	        continue;
	      } else if (i === this.pos || !hasLetter || (c !== '_' && (c < '0' || c > '9'))) {
	        break;
	      }
	    } else {
	      hasLetter = true;
	    }
	  }
	  if (hasLetter) {
	    var str = this.expression.substring(startPos, i);
	    this.current = this.newToken(TNAME, str);
	    this.pos += str.length;
	    return true;
	  }
	  return false;
	};

	TokenStream.prototype.isWhitespace = function () {
	  var r = false;
	  var c = this.expression.charAt(this.pos);
	  while (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
	    r = true;
	    this.pos++;
	    if (this.pos >= this.expression.length) {
	      break;
	    }
	    c = this.expression.charAt(this.pos);
	  }
	  return r;
	};

	var codePointPattern = /^[0-9a-f]{4}$/i;

	TokenStream.prototype.unescape = function (v) {
	  var index = v.indexOf('\\');
	  if (index < 0) {
	    return v;
	  }

	  var buffer = v.substring(0, index);
	  while (index >= 0) {
	    var c = v.charAt(++index);
	    switch (c) {
	      case '\'':
	        buffer += '\'';
	        break;
	      case '"':
	        buffer += '"';
	        break;
	      case '\\':
	        buffer += '\\';
	        break;
	      case '/':
	        buffer += '/';
	        break;
	      case 'b':
	        buffer += '\b';
	        break;
	      case 'f':
	        buffer += '\f';
	        break;
	      case 'n':
	        buffer += '\n';
	        break;
	      case 'r':
	        buffer += '\r';
	        break;
	      case 't':
	        buffer += '\t';
	        break;
	      case 'u':
	        // interpret the following 4 characters as the hex of the unicode code point
	        var codePoint = v.substring(index + 1, index + 5);
	        if (!codePointPattern.test(codePoint)) {
	          this.parseError('Illegal escape sequence: \\u' + codePoint);
	        }
	        buffer += String.fromCharCode(parseInt(codePoint, 16));
	        index += 4;
	        break;
	      default:
	        throw this.parseError('Illegal escape sequence: "\\' + c + '"');
	    }
	    ++index;
	    var backslash = v.indexOf('\\', index);
	    buffer += v.substring(index, backslash < 0 ? v.length : backslash);
	    index = backslash;
	  }

	  return buffer;
	};

	TokenStream.prototype.isComment = function () {
	  var c = this.expression.charAt(this.pos);
	  if (c === '/' && this.expression.charAt(this.pos + 1) === '*') {
	    this.pos = this.expression.indexOf('*/', this.pos) + 2;
	    if (this.pos === 1) {
	      this.pos = this.expression.length;
	    }
	    return true;
	  }
	  return false;
	};

	TokenStream.prototype.isRadixInteger = function () {
	  var pos = this.pos;

	  if (pos >= this.expression.length - 2 || this.expression.charAt(pos) !== '0') {
	    return false;
	  }
	  ++pos;

	  var radix;
	  var validDigit;
	  if (this.expression.charAt(pos) === 'x') {
	    radix = 16;
	    validDigit = /^[0-9a-f]$/i;
	    ++pos;
	  } else if (this.expression.charAt(pos) === 'b') {
	    radix = 2;
	    validDigit = /^[01]$/i;
	    ++pos;
	  } else {
	    return false;
	  }

	  var valid = false;
	  var startPos = pos;

	  while (pos < this.expression.length) {
	    var c = this.expression.charAt(pos);
	    if (validDigit.test(c)) {
	      pos++;
	      valid = true;
	    } else {
	      break;
	    }
	  }

	  if (valid) {
	    this.current = this.newToken(TNUMBER, parseInt(this.expression.substring(startPos, pos), radix));
	    this.pos = pos;
	  }
	  return valid;
	};

	TokenStream.prototype.isNumber = function () {
	  var valid = false;
	  var pos = this.pos;
	  var startPos = pos;
	  var resetPos = pos;
	  var foundDot = false;
	  var foundDigits = false;
	  var c;

	  while (pos < this.expression.length) {
	    c = this.expression.charAt(pos);
	    if ((c >= '0' && c <= '9') || (!foundDot && c === '.')) {
	      if (c === '.') {
	        foundDot = true;
	      } else {
	        foundDigits = true;
	      }
	      pos++;
	      valid = foundDigits;
	    } else {
	      break;
	    }
	  }

	  if (valid) {
	    resetPos = pos;
	  }

	  if (c === 'e' || c === 'E') {
	    pos++;
	    var acceptSign = true;
	    var validExponent = false;
	    while (pos < this.expression.length) {
	      c = this.expression.charAt(pos);
	      if (acceptSign && (c === '+' || c === '-')) {
	        acceptSign = false;
	      } else if (c >= '0' && c <= '9') {
	        validExponent = true;
	        acceptSign = false;
	      } else {
	        break;
	      }
	      pos++;
	    }

	    if (!validExponent) {
	      pos = resetPos;
	    }
	  }

	  if (valid) {
	    this.current = this.newToken(TNUMBER, parseFloat(this.expression.substring(startPos, pos)));
	    this.pos = pos;
	  } else {
	    this.pos = resetPos;
	  }
	  return valid;
	};

	TokenStream.prototype.isOperator = function () {
	  var startPos = this.pos;
	  var c = this.expression.charAt(this.pos);

	  if (c === '+' || c === '-' || c === '*' || c === '/' || c === '%' || c === '^' || c === '?' || c === ':' || c === '.') {
	    this.current = this.newToken(TOP, c);
	  } else if (c === '∙' || c === '•') {
	    this.current = this.newToken(TOP, '*');
	  } else if (c === '>') {
	    if (this.expression.charAt(this.pos + 1) === '=') {
	      this.current = this.newToken(TOP, '>=');
	      this.pos++;
	    } else {
	      this.current = this.newToken(TOP, '>');
	    }
	  } else if (c === '<') {
	    if (this.expression.charAt(this.pos + 1) === '=') {
	      this.current = this.newToken(TOP, '<=');
	      this.pos++;
	    } else {
	      this.current = this.newToken(TOP, '<');
	    }
	  } else if (c === '|') {
	    if (this.expression.charAt(this.pos + 1) === '|') {
	      this.current = this.newToken(TOP, '||');
	      this.pos++;
	    } else {
	      return false;
	    }
	  } else if (c === '=') {
	    if (this.expression.charAt(this.pos + 1) === '=') {
	      this.current = this.newToken(TOP, '==');
	      this.pos++;
	    } else {
	      this.current = this.newToken(TOP, c);
	    }
	  } else if (c === '!') {
	    if (this.expression.charAt(this.pos + 1) === '=') {
	      this.current = this.newToken(TOP, '!=');
	      this.pos++;
	    } else {
	      this.current = this.newToken(TOP, c);
	    }
	  } else {
	    return false;
	  }
	  this.pos++;

	  if (this.isOperatorEnabled(this.current.value)) {
	    return true;
	  } else {
	    this.pos = startPos;
	    return false;
	  }
	};

	TokenStream.prototype.isOperatorEnabled = function (op) {
	  return this.parser.isOperatorEnabled(op);
	};

	TokenStream.prototype.getCoordinates = function () {
	  var line = 0;
	  var column;
	  var newline = -1;
	  do {
	    line++;
	    column = this.pos - newline;
	    newline = this.expression.indexOf('\n', newline + 1);
	  } while (newline >= 0 && newline < this.pos);

	  return {
	    line: line,
	    column: column
	  };
	};

	TokenStream.prototype.parseError = function (msg) {
	  var coords = this.getCoordinates();
	  throw new Error('parse error [' + coords.line + ':' + coords.column + ']: ' + msg);
	};

	function ParserState(parser, tokenStream, options) {
	  this.parser = parser;
	  this.tokens = tokenStream;
	  this.current = null;
	  this.nextToken = null;
	  this.next();
	  this.savedCurrent = null;
	  this.savedNextToken = null;
	  this.allowMemberAccess = options.allowMemberAccess !== false;
	}

	ParserState.prototype.next = function () {
	  this.current = this.nextToken;
	  return (this.nextToken = this.tokens.next());
	};

	ParserState.prototype.tokenMatches = function (token, value) {
	  if (typeof value === 'undefined') {
	    return true;
	  } else if (Array.isArray(value)) {
	    return contains(value, token.value);
	  } else if (typeof value === 'function') {
	    return value(token);
	  } else {
	    return token.value === value;
	  }
	};

	ParserState.prototype.save = function () {
	  this.savedCurrent = this.current;
	  this.savedNextToken = this.nextToken;
	  this.tokens.save();
	};

	ParserState.prototype.restore = function () {
	  this.tokens.restore();
	  this.current = this.savedCurrent;
	  this.nextToken = this.savedNextToken;
	};

	ParserState.prototype.accept = function (type, value) {
	  if (this.nextToken.type === type && this.tokenMatches(this.nextToken, value)) {
	    this.next();
	    return true;
	  }
	  return false;
	};

	ParserState.prototype.expect = function (type, value) {
	  if (!this.accept(type, value)) {
	    var coords = this.tokens.getCoordinates();
	    throw new Error('parse error [' + coords.line + ':' + coords.column + ']: Expected ' + (value || type));
	  }
	};

	ParserState.prototype.parseAtom = function (instr) {
	  var unaryOps = this.tokens.unaryOps;
	  function isPrefixOperator(token) {
	    return token.value in unaryOps;
	  }

	  if (this.accept(TNAME) || this.accept(TOP, isPrefixOperator)) {
	    instr.push(new Instruction(IVAR, this.current.value));
	  } else if (this.accept(TNUMBER)) {
	    instr.push(new Instruction(INUMBER, this.current.value));
	  } else if (this.accept(TSTRING)) {
	    instr.push(new Instruction(INUMBER, this.current.value));
	  } else if (this.accept(TPAREN, '(')) {
	    this.parseExpression(instr);
	    this.expect(TPAREN, ')');
	  } else if (this.accept(TBRACKET, '[')) {
	    if (this.accept(TBRACKET, ']')) {
	      instr.push(new Instruction(IARRAY, 0));
	    } else {
	      var argCount = this.parseArrayList(instr);
	      instr.push(new Instruction(IARRAY, argCount));
	    }
	  } else {
	    throw new Error('unexpected ' + this.nextToken);
	  }
	};

	ParserState.prototype.parseExpression = function (instr) {
	  var exprInstr = [];
	  if (this.parseUntilEndStatement(instr, exprInstr)) {
	    return;
	  }
	  this.parseVariableAssignmentExpression(exprInstr);
	  if (this.parseUntilEndStatement(instr, exprInstr)) {
	    return;
	  }
	  this.pushExpression(instr, exprInstr);
	};

	ParserState.prototype.pushExpression = function (instr, exprInstr) {
	  for (var i = 0, len = exprInstr.length; i < len; i++) {
	    instr.push(exprInstr[i]);
	  }
	};

	ParserState.prototype.parseUntilEndStatement = function (instr, exprInstr) {
	  if (!this.accept(TSEMICOLON)) return false;
	  if (this.nextToken && this.nextToken.type !== TEOF && !(this.nextToken.type === TPAREN && this.nextToken.value === ')')) {
	    exprInstr.push(new Instruction(IENDSTATEMENT));
	  }
	  if (this.nextToken.type !== TEOF) {
	    this.parseExpression(exprInstr);
	  }
	  instr.push(new Instruction(IEXPR, exprInstr));
	  return true;
	};

	ParserState.prototype.parseArrayList = function (instr) {
	  var argCount = 0;

	  while (!this.accept(TBRACKET, ']')) {
	    this.parseExpression(instr);
	    ++argCount;
	    while (this.accept(TCOMMA)) {
	      this.parseExpression(instr);
	      ++argCount;
	    }
	  }

	  return argCount;
	};

	ParserState.prototype.parseVariableAssignmentExpression = function (instr) {
	  this.parseConditionalExpression(instr);
	  while (this.accept(TOP, '=')) {
	    var varName = instr.pop();
	    var varValue = [];
	    var lastInstrIndex = instr.length - 1;
	    if (varName.type === IFUNCALL) {
	      if (!this.tokens.isOperatorEnabled('()=')) {
	        throw new Error('function definition is not permitted');
	      }
	      for (var i = 0, len = varName.value + 1; i < len; i++) {
	        var index = lastInstrIndex - i;
	        if (instr[index].type === IVAR) {
	          instr[index] = new Instruction(IVARNAME, instr[index].value);
	        }
	      }
	      this.parseVariableAssignmentExpression(varValue);
	      instr.push(new Instruction(IEXPR, varValue));
	      instr.push(new Instruction(IFUNDEF, varName.value));
	      continue;
	    }
	    if (varName.type !== IVAR && varName.type !== IMEMBER) {
	      throw new Error('expected variable for assignment');
	    }
	    this.parseVariableAssignmentExpression(varValue);
	    instr.push(new Instruction(IVARNAME, varName.value));
	    instr.push(new Instruction(IEXPR, varValue));
	    instr.push(binaryInstruction('='));
	  }
	};

	ParserState.prototype.parseConditionalExpression = function (instr) {
	  this.parseOrExpression(instr);
	  while (this.accept(TOP, '?')) {
	    var trueBranch = [];
	    var falseBranch = [];
	    this.parseConditionalExpression(trueBranch);
	    this.expect(TOP, ':');
	    this.parseConditionalExpression(falseBranch);
	    instr.push(new Instruction(IEXPR, trueBranch));
	    instr.push(new Instruction(IEXPR, falseBranch));
	    instr.push(ternaryInstruction('?'));
	  }
	};

	ParserState.prototype.parseOrExpression = function (instr) {
	  this.parseAndExpression(instr);
	  while (this.accept(TOP, 'or')) {
	    var falseBranch = [];
	    this.parseAndExpression(falseBranch);
	    instr.push(new Instruction(IEXPR, falseBranch));
	    instr.push(binaryInstruction('or'));
	  }
	};

	ParserState.prototype.parseAndExpression = function (instr) {
	  this.parseComparison(instr);
	  while (this.accept(TOP, 'and')) {
	    var trueBranch = [];
	    this.parseComparison(trueBranch);
	    instr.push(new Instruction(IEXPR, trueBranch));
	    instr.push(binaryInstruction('and'));
	  }
	};

	var COMPARISON_OPERATORS = ['==', '!=', '<', '<=', '>=', '>', 'in'];

	ParserState.prototype.parseComparison = function (instr) {
	  this.parseAddSub(instr);
	  while (this.accept(TOP, COMPARISON_OPERATORS)) {
	    var op = this.current;
	    this.parseAddSub(instr);
	    instr.push(binaryInstruction(op.value));
	  }
	};

	var ADD_SUB_OPERATORS = ['+', '-', '||'];

	ParserState.prototype.parseAddSub = function (instr) {
	  this.parseTerm(instr);
	  while (this.accept(TOP, ADD_SUB_OPERATORS)) {
	    var op = this.current;
	    this.parseTerm(instr);
	    instr.push(binaryInstruction(op.value));
	  }
	};

	var TERM_OPERATORS = ['*', '/', '%'];

	ParserState.prototype.parseTerm = function (instr) {
	  this.parseFactor(instr);
	  while (this.accept(TOP, TERM_OPERATORS)) {
	    var op = this.current;
	    this.parseFactor(instr);
	    instr.push(binaryInstruction(op.value));
	  }
	};

	ParserState.prototype.parseFactor = function (instr) {
	  var unaryOps = this.tokens.unaryOps;
	  function isPrefixOperator(token) {
	    return token.value in unaryOps;
	  }

	  this.save();
	  if (this.accept(TOP, isPrefixOperator)) {
	    if (this.current.value !== '-' && this.current.value !== '+') {
	      if (this.nextToken.type === TPAREN && this.nextToken.value === '(') {
	        this.restore();
	        this.parseExponential(instr);
	        return;
	      } else if (this.nextToken.type === TSEMICOLON || this.nextToken.type === TCOMMA || this.nextToken.type === TEOF || (this.nextToken.type === TPAREN && this.nextToken.value === ')')) {
	        this.restore();
	        this.parseAtom(instr);
	        return;
	      }
	    }

	    var op = this.current;
	    this.parseFactor(instr);
	    instr.push(unaryInstruction(op.value));
	  } else {
	    this.parseExponential(instr);
	  }
	};

	ParserState.prototype.parseExponential = function (instr) {
	  this.parsePostfixExpression(instr);
	  while (this.accept(TOP, '^')) {
	    this.parseFactor(instr);
	    instr.push(binaryInstruction('^'));
	  }
	};

	ParserState.prototype.parsePostfixExpression = function (instr) {
	  this.parseFunctionCall(instr);
	  while (this.accept(TOP, '!')) {
	    instr.push(unaryInstruction('!'));
	  }
	};

	ParserState.prototype.parseFunctionCall = function (instr) {
	  var unaryOps = this.tokens.unaryOps;
	  function isPrefixOperator(token) {
	    return token.value in unaryOps;
	  }

	  if (this.accept(TOP, isPrefixOperator)) {
	    var op = this.current;
	    this.parseAtom(instr);
	    instr.push(unaryInstruction(op.value));
	  } else {
	    this.parseMemberExpression(instr);
	    while (this.accept(TPAREN, '(')) {
	      if (this.accept(TPAREN, ')')) {
	        instr.push(new Instruction(IFUNCALL, 0));
	      } else {
	        var argCount = this.parseArgumentList(instr);
	        instr.push(new Instruction(IFUNCALL, argCount));
	      }
	    }
	  }
	};

	ParserState.prototype.parseArgumentList = function (instr) {
	  var argCount = 0;

	  while (!this.accept(TPAREN, ')')) {
	    this.parseExpression(instr);
	    ++argCount;
	    while (this.accept(TCOMMA)) {
	      this.parseExpression(instr);
	      ++argCount;
	    }
	  }

	  return argCount;
	};

	ParserState.prototype.parseMemberExpression = function (instr) {
	  this.parseAtom(instr);
	  while (this.accept(TOP, '.') || this.accept(TBRACKET, '[')) {
	    var op = this.current;

	    if (op.value === '.') {
	      if (!this.allowMemberAccess) {
	        throw new Error('unexpected ".", member access is not permitted');
	      }

	      this.expect(TNAME);
	      instr.push(new Instruction(IMEMBER, this.current.value));
	    } else if (op.value === '[') {
	      if (!this.tokens.isOperatorEnabled('[')) {
	        throw new Error('unexpected "[]", arrays are disabled');
	      }

	      this.parseExpression(instr);
	      this.expect(TBRACKET, ']');
	      instr.push(binaryInstruction('['));
	    } else {
	      throw new Error('unexpected symbol: ' + op.value);
	    }
	  }
	};

	function add$1(a, b) {
	  return Number(a) + Number(b);
	}

	function sub(a, b) {
	  return a - b;
	}

	function mul(a, b) {
	  return a * b;
	}

	function div(a, b) {
	  return a / b;
	}

	function mod(a, b) {
	  return a % b;
	}

	function concat(a, b) {
	  if (Array.isArray(a) && Array.isArray(b)) {
	    return a.concat(b);
	  }
	  return '' + a + b;
	}

	function equal(a, b) {
	  return a === b;
	}

	function notEqual(a, b) {
	  return a !== b;
	}

	function greaterThan(a, b) {
	  return a > b;
	}

	function lessThan(a, b) {
	  return a < b;
	}

	function greaterThanEqual(a, b) {
	  return a >= b;
	}

	function lessThanEqual(a, b) {
	  return a <= b;
	}

	function andOperator(a, b) {
	  return Boolean(a && b);
	}

	function orOperator(a, b) {
	  return Boolean(a || b);
	}

	function inOperator(a, b) {
	  return contains(b, a);
	}

	function sinh(a) {
	  return ((Math.exp(a) - Math.exp(-a)) / 2);
	}

	function cosh(a) {
	  return ((Math.exp(a) + Math.exp(-a)) / 2);
	}

	function tanh(a) {
	  if (a === Infinity) return 1;
	  if (a === -Infinity) return -1;
	  return (Math.exp(a) - Math.exp(-a)) / (Math.exp(a) + Math.exp(-a));
	}

	function asinh(a) {
	  if (a === -Infinity) return a;
	  return Math.log(a + Math.sqrt((a * a) + 1));
	}

	function acosh(a) {
	  return Math.log(a + Math.sqrt((a * a) - 1));
	}

	function atanh(a) {
	  return (Math.log((1 + a) / (1 - a)) / 2);
	}

	function log10(a) {
	  return Math.log(a) * Math.LOG10E;
	}

	function neg(a) {
	  return -a;
	}

	function not(a) {
	  return !a;
	}

	function trunc(a) {
	  return a < 0 ? Math.ceil(a) : Math.floor(a);
	}

	function random$1(a) {
	  return Math.random() * (a || 1);
	}

	function factorial(a) { // a!
	  return gamma(a + 1);
	}

	function isInteger(value) {
	  return isFinite(value) && (value === Math.round(value));
	}

	var GAMMA_G = 4.7421875;
	var GAMMA_P = [
	  0.99999999999999709182,
	  57.156235665862923517, -59.597960355475491248,
	  14.136097974741747174, -0.49191381609762019978,
	  0.33994649984811888699e-4,
	  0.46523628927048575665e-4, -0.98374475304879564677e-4,
	  0.15808870322491248884e-3, -0.21026444172410488319e-3,
	  0.21743961811521264320e-3, -0.16431810653676389022e-3,
	  0.84418223983852743293e-4, -0.26190838401581408670e-4,
	  0.36899182659531622704e-5
	];

	// Gamma function from math.js
	function gamma(n) {
	  var t, x;

	  if (isInteger(n)) {
	    if (n <= 0) {
	      return isFinite(n) ? Infinity : NaN;
	    }

	    if (n > 171) {
	      return Infinity; // Will overflow
	    }

	    var value = n - 2;
	    var res = n - 1;
	    while (value > 1) {
	      res *= value;
	      value--;
	    }

	    if (res === 0) {
	      res = 1; // 0! is per definition 1
	    }

	    return res;
	  }

	  if (n < 0.5) {
	    return Math.PI / (Math.sin(Math.PI * n) * gamma(1 - n));
	  }

	  if (n >= 171.35) {
	    return Infinity; // will overflow
	  }

	  if (n > 85.0) { // Extended Stirling Approx
	    var twoN = n * n;
	    var threeN = twoN * n;
	    var fourN = threeN * n;
	    var fiveN = fourN * n;
	    return Math.sqrt(2 * Math.PI / n) * Math.pow((n / Math.E), n) *
	      (1 + (1 / (12 * n)) + (1 / (288 * twoN)) - (139 / (51840 * threeN)) -
	      (571 / (2488320 * fourN)) + (163879 / (209018880 * fiveN)) +
	      (5246819 / (75246796800 * fiveN * n)));
	  }

	  --n;
	  x = GAMMA_P[0];
	  for (var i = 1; i < GAMMA_P.length; ++i) {
	    x += GAMMA_P[i] / (n + i);
	  }

	  t = n + GAMMA_G + 0.5;
	  return Math.sqrt(2 * Math.PI) * Math.pow(t, n + 0.5) * Math.exp(-t) * x;
	}

	function stringOrArrayLength(s) {
	  if (Array.isArray(s)) {
	    return s.length;
	  }
	  return String(s).length;
	}

	function hypot() {
	  var sum = 0;
	  var larg = 0;
	  for (var i = 0; i < arguments.length; i++) {
	    var arg = Math.abs(arguments[i]);
	    var div;
	    if (larg < arg) {
	      div = larg / arg;
	      sum = (sum * div * div) + 1;
	      larg = arg;
	    } else if (arg > 0) {
	      div = arg / larg;
	      sum += div * div;
	    } else {
	      sum += arg;
	    }
	  }
	  return larg === Infinity ? Infinity : larg * Math.sqrt(sum);
	}

	function condition(cond, yep, nope) {
	  return cond ? yep : nope;
	}

	/**
	* Decimal adjustment of a number.
	* From @escopecz.
	*
	* @param {Number} value The number.
	* @param {Integer} exp  The exponent (the 10 logarithm of the adjustment base).
	* @return {Number} The adjusted value.
	*/
	function roundTo(value, exp) {
	  // If the exp is undefined or zero...
	  if (typeof exp === 'undefined' || +exp === 0) {
	    return Math.round(value);
	  }
	  value = +value;
	  exp = -(+exp);
	  // If the value is not a number or the exp is not an integer...
	  if (isNaN(value) || !(typeof exp === 'number' && exp % 1 === 0)) {
	    return NaN;
	  }
	  // Shift
	  value = value.toString().split('e');
	  value = Math.round(+(value[0] + 'e' + (value[1] ? (+value[1] - exp) : -exp)));
	  // Shift back
	  value = value.toString().split('e');
	  return +(value[0] + 'e' + (value[1] ? (+value[1] + exp) : exp));
	}

	function setVar(name, value, variables) {
	  if (variables) variables[name] = value;
	  return value;
	}

	function arrayIndex(array, index) {
	  return array[index | 0];
	}

	function max(array) {
	  if (arguments.length === 1 && Array.isArray(array)) {
	    return Math.max.apply(Math, array);
	  } else {
	    return Math.max.apply(Math, arguments);
	  }
	}

	function min(array) {
	  if (arguments.length === 1 && Array.isArray(array)) {
	    return Math.min.apply(Math, array);
	  } else {
	    return Math.min.apply(Math, arguments);
	  }
	}

	function arrayMap(f, a) {
	  if (typeof f !== 'function') {
	    throw new Error('First argument to map is not a function');
	  }
	  if (!Array.isArray(a)) {
	    throw new Error('Second argument to map is not an array');
	  }
	  return a.map(function (x, i) {
	    return f(x, i);
	  });
	}

	function arrayFold(f, init, a) {
	  if (typeof f !== 'function') {
	    throw new Error('First argument to fold is not a function');
	  }
	  if (!Array.isArray(a)) {
	    throw new Error('Second argument to fold is not an array');
	  }
	  return a.reduce(function (acc, x, i) {
	    return f(acc, x, i);
	  }, init);
	}

	function arrayFilter(f, a) {
	  if (typeof f !== 'function') {
	    throw new Error('First argument to filter is not a function');
	  }
	  if (!Array.isArray(a)) {
	    throw new Error('Second argument to filter is not an array');
	  }
	  return a.filter(function (x, i) {
	    return f(x, i);
	  });
	}

	function stringOrArrayIndexOf(target, s) {
	  if (!(Array.isArray(s) || typeof s === 'string')) {
	    throw new Error('Second argument to indexOf is not a string or array');
	  }

	  return s.indexOf(target);
	}

	function arrayJoin(sep, a) {
	  if (!Array.isArray(a)) {
	    throw new Error('Second argument to join is not an array');
	  }

	  return a.join(sep);
	}

	function sign(x) {
	  return ((x > 0) - (x < 0)) || +x;
	}

	var ONE_THIRD = 1/3;
	function cbrt(x) {
	  return x < 0 ? -Math.pow(-x, ONE_THIRD) : Math.pow(x, ONE_THIRD);
	}

	function expm1(x) {
	  return Math.exp(x) - 1;
	}

	function log1p(x) {
	  return Math.log(1 + x);
	}

	function log2(x) {
	  return Math.log(x) / Math.LN2;
	}

	function Parser(options) {
	  this.options = options || {};
	  this.unaryOps = {
	    sin: Math.sin,
	    cos: Math.cos,
	    tan: Math.tan,
	    asin: Math.asin,
	    acos: Math.acos,
	    atan: Math.atan,
	    sinh: Math.sinh || sinh,
	    cosh: Math.cosh || cosh,
	    tanh: Math.tanh || tanh,
	    asinh: Math.asinh || asinh,
	    acosh: Math.acosh || acosh,
	    atanh: Math.atanh || atanh,
	    sqrt: Math.sqrt,
	    cbrt: Math.cbrt || cbrt,
	    log: Math.log,
	    log2: Math.log2 || log2,
	    ln: Math.log,
	    lg: Math.log10 || log10,
	    log10: Math.log10 || log10,
	    expm1: Math.expm1 || expm1,
	    log1p: Math.log1p || log1p,
	    abs: Math.abs,
	    ceil: Math.ceil,
	    floor: Math.floor,
	    round: Math.round,
	    trunc: Math.trunc || trunc,
	    '-': neg,
	    '+': Number,
	    exp: Math.exp,
	    not: not,
	    length: stringOrArrayLength,
	    '!': factorial,
	    sign: Math.sign || sign
	  };

	  this.binaryOps = {
	    '+': add$1,
	    '-': sub,
	    '*': mul,
	    '/': div,
	    '%': mod,
	    '^': Math.pow,
	    '||': concat,
	    '==': equal,
	    '!=': notEqual,
	    '>': greaterThan,
	    '<': lessThan,
	    '>=': greaterThanEqual,
	    '<=': lessThanEqual,
	    and: andOperator,
	    or: orOperator,
	    'in': inOperator,
	    '=': setVar,
	    '[': arrayIndex
	  };

	  this.ternaryOps = {
	    '?': condition
	  };

	  this.functions = {
	    random: random$1,
	    fac: factorial,
	    min: min,
	    max: max,
	    hypot: Math.hypot || hypot,
	    pyt: Math.hypot || hypot, // backward compat
	    pow: Math.pow,
	    atan2: Math.atan2,
	    'if': condition,
	    gamma: gamma,
	    roundTo: roundTo,
	    map: arrayMap,
	    fold: arrayFold,
	    filter: arrayFilter,
	    indexOf: stringOrArrayIndexOf,
	    join: arrayJoin
	  };

	  this.consts = {
	    E: Math.E,
	    PI: Math.PI,
	    'true': true,
	    'false': false
	  };
	}

	Parser.prototype.parse = function (expr) {
	  var instr = [];
	  var parserState = new ParserState(
	    this,
	    new TokenStream(this, expr),
	    { allowMemberAccess: this.options.allowMemberAccess }
	  );

	  parserState.parseExpression(instr);
	  parserState.expect(TEOF, 'EOF');

	  return new Expression(instr, this);
	};

	Parser.prototype.evaluate = function (expr, variables) {
	  return this.parse(expr).evaluate(variables);
	};

	var sharedParser = new Parser();

	Parser.parse = function (expr) {
	  return sharedParser.parse(expr);
	};

	Parser.evaluate = function (expr, variables) {
	  return sharedParser.parse(expr).evaluate(variables);
	};

	var optionNameMap = {
	  '+': 'add',
	  '-': 'subtract',
	  '*': 'multiply',
	  '/': 'divide',
	  '%': 'remainder',
	  '^': 'power',
	  '!': 'factorial',
	  '<': 'comparison',
	  '>': 'comparison',
	  '<=': 'comparison',
	  '>=': 'comparison',
	  '==': 'comparison',
	  '!=': 'comparison',
	  '||': 'concatenate',
	  'and': 'logical',
	  'or': 'logical',
	  'not': 'logical',
	  '?': 'conditional',
	  ':': 'conditional',
	  '=': 'assignment',
	  '[': 'array',
	  '()=': 'fndef'
	};

	function getOptionName(op) {
	  return optionNameMap.hasOwnProperty(op) ? optionNameMap[op] : op;
	}

	Parser.prototype.isOperatorEnabled = function (op) {
	  var optionName = getOptionName(op);
	  var operators = this.options.operators || {};

	  return !(optionName in operators) || !!operators[optionName];
	};

	/*!
	 Based on ndef.parser, by Raphael Graf(r@undefined.ch)
	 http://www.undefined.ch/mparser/index.html

	 Ported to JavaScript and modified by Matthew Crumley (email@matthewcrumley.com, http://silentmatt.com/)

	 You are free to use and modify this code in anyway you find useful. Please leave this comment in the code
	 to acknowledge its original source. If you feel like it, I enjoy hearing about projects that use my code,
	 but don't feel like you have to let me know or ask permission.
	*/

	// Backwards compatibility
	var index = {
	  Parser: Parser,
	  Expression: Expression
	};

	/* @license twgl.js 4.14.2 Copyright (c) 2015, Gregg Tavares All Rights Reserved.
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
	function add$2(a, b, dst) {
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
	function max$1(a, b, dst) {
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
	function min$1(a, b, dst) {
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
	  add: add$2,
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
	  max: max$1,
	  min: min$1,
	  mulScalar: mulScalar,
	  multiply: multiply,
	  negate: negate,
	  normalize: normalize,
	  setDefaultType: setDefaultType,
	  subtract: subtract
	});

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
	 * 4x4 Matrix math math functions.
	 *
	 * Almost all functions take an optional `dst` argument. If it is not passed in the
	 * functions will create a new matrix. In other words you can do this
	 *
	 *     const mat = m4.translation([1, 2, 3]);  // Creates a new translation matrix
	 *
	 * or
	 *
	 *     const mat = m4.create();
	 *     m4.translation([1, 2, 3], mat);  // Puts translation matrix in mat.
	 *
	 * The first style is often easier but depending on where it's used it generates garbage where
	 * as there is almost never allocation with the second style.
	 *
	 * It is always save to pass any matrix as the destination. So for example
	 *
	 *     const mat = m4.identity();
	 *     const trans = m4.translation([1, 2, 3]);
	 *     m4.multiply(mat, trans, mat);  // Multiplies mat * trans and puts result in mat.
	 *
	 * @module twgl/m4
	 */
	let MatType = Float32Array;

	/**
	 * A JavaScript array with 16 values or a Float32Array with 16 values.
	 * When created by the library will create the default type which is `Float32Array`
	 * but can be set by calling {@link module:twgl/m4.setDefaultType}.
	 * @typedef {(number[]|Float32Array)} Mat4
	 * @memberOf module:twgl/m4
	 */

	/**
	 * Sets the type this library creates for a Mat4
	 * @param {constructor} ctor the constructor for the type. Either `Float32Array` or `Array`
	 * @return {constructor} previous constructor for Mat4
	 * @memberOf module:twgl/m4
	 */
	function setDefaultType$1(ctor) {
	  const oldType = MatType;
	  MatType = ctor;
	  return oldType;
	}

	/**
	 * Negates a matrix.
	 * @param {module:twgl/m4.Mat4} m The matrix.
	 * @param {module:twgl/m4.Mat4} [dst] matrix to hold result. If not passed a new one is created.
	 * @return {module:twgl/m4.Mat4} -m.
	 * @memberOf module:twgl/m4
	 */
	function negate$1(m, dst) {
	  dst = dst || new MatType(16);

	  dst[ 0] = -m[ 0];
	  dst[ 1] = -m[ 1];
	  dst[ 2] = -m[ 2];
	  dst[ 3] = -m[ 3];
	  dst[ 4] = -m[ 4];
	  dst[ 5] = -m[ 5];
	  dst[ 6] = -m[ 6];
	  dst[ 7] = -m[ 7];
	  dst[ 8] = -m[ 8];
	  dst[ 9] = -m[ 9];
	  dst[10] = -m[10];
	  dst[11] = -m[11];
	  dst[12] = -m[12];
	  dst[13] = -m[13];
	  dst[14] = -m[14];
	  dst[15] = -m[15];

	  return dst;
	}

	/**
	 * Copies a matrix.
	 * @param {module:twgl/m4.Mat4} m The matrix.
	 * @param {module:twgl/m4.Mat4} [dst] The matrix. If not passed a new one is created.
	 * @return {module:twgl/m4.Mat4} A copy of m.
	 * @memberOf module:twgl/m4
	 */
	function copy$1(m, dst) {
	  dst = dst || new MatType(16);

	  dst[ 0] = m[ 0];
	  dst[ 1] = m[ 1];
	  dst[ 2] = m[ 2];
	  dst[ 3] = m[ 3];
	  dst[ 4] = m[ 4];
	  dst[ 5] = m[ 5];
	  dst[ 6] = m[ 6];
	  dst[ 7] = m[ 7];
	  dst[ 8] = m[ 8];
	  dst[ 9] = m[ 9];
	  dst[10] = m[10];
	  dst[11] = m[11];
	  dst[12] = m[12];
	  dst[13] = m[13];
	  dst[14] = m[14];
	  dst[15] = m[15];

	  return dst;
	}

	/**
	 * Creates an n-by-n identity matrix.
	 *
	 * @param {module:twgl/m4.Mat4} [dst] matrix to hold result. If not passed a new one is created.
	 * @return {module:twgl/m4.Mat4} An n-by-n identity matrix.
	 * @memberOf module:twgl/m4
	 */
	function identity(dst) {
	  dst = dst || new MatType(16);

	  dst[ 0] = 1;
	  dst[ 1] = 0;
	  dst[ 2] = 0;
	  dst[ 3] = 0;
	  dst[ 4] = 0;
	  dst[ 5] = 1;
	  dst[ 6] = 0;
	  dst[ 7] = 0;
	  dst[ 8] = 0;
	  dst[ 9] = 0;
	  dst[10] = 1;
	  dst[11] = 0;
	  dst[12] = 0;
	  dst[13] = 0;
	  dst[14] = 0;
	  dst[15] = 1;

	  return dst;
	}

	/**
	 * Takes the transpose of a matrix.
	 * @param {module:twgl/m4.Mat4} m The matrix.
	 * @param {module:twgl/m4.Mat4} [dst] matrix to hold result. If not passed a new one is created.
	 * @return {module:twgl/m4.Mat4} The transpose of m.
	 * @memberOf module:twgl/m4
	 */
	 function transpose(m, dst) {
	  dst = dst || new MatType(16);
	  if (dst === m) {
	    let t;

	    t = m[1];
	    m[1] = m[4];
	    m[4] = t;

	    t = m[2];
	    m[2] = m[8];
	    m[8] = t;

	    t = m[3];
	    m[3] = m[12];
	    m[12] = t;

	    t = m[6];
	    m[6] = m[9];
	    m[9] = t;

	    t = m[7];
	    m[7] = m[13];
	    m[13] = t;

	    t = m[11];
	    m[11] = m[14];
	    m[14] = t;
	    return dst;
	  }

	  const m00 = m[0 * 4 + 0];
	  const m01 = m[0 * 4 + 1];
	  const m02 = m[0 * 4 + 2];
	  const m03 = m[0 * 4 + 3];
	  const m10 = m[1 * 4 + 0];
	  const m11 = m[1 * 4 + 1];
	  const m12 = m[1 * 4 + 2];
	  const m13 = m[1 * 4 + 3];
	  const m20 = m[2 * 4 + 0];
	  const m21 = m[2 * 4 + 1];
	  const m22 = m[2 * 4 + 2];
	  const m23 = m[2 * 4 + 3];
	  const m30 = m[3 * 4 + 0];
	  const m31 = m[3 * 4 + 1];
	  const m32 = m[3 * 4 + 2];
	  const m33 = m[3 * 4 + 3];

	  dst[ 0] = m00;
	  dst[ 1] = m10;
	  dst[ 2] = m20;
	  dst[ 3] = m30;
	  dst[ 4] = m01;
	  dst[ 5] = m11;
	  dst[ 6] = m21;
	  dst[ 7] = m31;
	  dst[ 8] = m02;
	  dst[ 9] = m12;
	  dst[10] = m22;
	  dst[11] = m32;
	  dst[12] = m03;
	  dst[13] = m13;
	  dst[14] = m23;
	  dst[15] = m33;

	  return dst;
	}

	/**
	 * Computes the inverse of a 4-by-4 matrix.
	 * @param {module:twgl/m4.Mat4} m The matrix.
	 * @param {module:twgl/m4.Mat4} [dst] matrix to hold result. If not passed a new one is created.
	 * @return {module:twgl/m4.Mat4} The inverse of m.
	 * @memberOf module:twgl/m4
	 */
	function inverse(m, dst) {
	  dst = dst || new MatType(16);

	  const m00 = m[0 * 4 + 0];
	  const m01 = m[0 * 4 + 1];
	  const m02 = m[0 * 4 + 2];
	  const m03 = m[0 * 4 + 3];
	  const m10 = m[1 * 4 + 0];
	  const m11 = m[1 * 4 + 1];
	  const m12 = m[1 * 4 + 2];
	  const m13 = m[1 * 4 + 3];
	  const m20 = m[2 * 4 + 0];
	  const m21 = m[2 * 4 + 1];
	  const m22 = m[2 * 4 + 2];
	  const m23 = m[2 * 4 + 3];
	  const m30 = m[3 * 4 + 0];
	  const m31 = m[3 * 4 + 1];
	  const m32 = m[3 * 4 + 2];
	  const m33 = m[3 * 4 + 3];
	  const tmp_0  = m22 * m33;
	  const tmp_1  = m32 * m23;
	  const tmp_2  = m12 * m33;
	  const tmp_3  = m32 * m13;
	  const tmp_4  = m12 * m23;
	  const tmp_5  = m22 * m13;
	  const tmp_6  = m02 * m33;
	  const tmp_7  = m32 * m03;
	  const tmp_8  = m02 * m23;
	  const tmp_9  = m22 * m03;
	  const tmp_10 = m02 * m13;
	  const tmp_11 = m12 * m03;
	  const tmp_12 = m20 * m31;
	  const tmp_13 = m30 * m21;
	  const tmp_14 = m10 * m31;
	  const tmp_15 = m30 * m11;
	  const tmp_16 = m10 * m21;
	  const tmp_17 = m20 * m11;
	  const tmp_18 = m00 * m31;
	  const tmp_19 = m30 * m01;
	  const tmp_20 = m00 * m21;
	  const tmp_21 = m20 * m01;
	  const tmp_22 = m00 * m11;
	  const tmp_23 = m10 * m01;

	  const t0 = (tmp_0 * m11 + tmp_3 * m21 + tmp_4 * m31) -
	      (tmp_1 * m11 + tmp_2 * m21 + tmp_5 * m31);
	  const t1 = (tmp_1 * m01 + tmp_6 * m21 + tmp_9 * m31) -
	      (tmp_0 * m01 + tmp_7 * m21 + tmp_8 * m31);
	  const t2 = (tmp_2 * m01 + tmp_7 * m11 + tmp_10 * m31) -
	      (tmp_3 * m01 + tmp_6 * m11 + tmp_11 * m31);
	  const t3 = (tmp_5 * m01 + tmp_8 * m11 + tmp_11 * m21) -
	      (tmp_4 * m01 + tmp_9 * m11 + tmp_10 * m21);

	  const d = 1.0 / (m00 * t0 + m10 * t1 + m20 * t2 + m30 * t3);

	  dst[ 0] = d * t0;
	  dst[ 1] = d * t1;
	  dst[ 2] = d * t2;
	  dst[ 3] = d * t3;
	  dst[ 4] = d * ((tmp_1 * m10 + tmp_2 * m20 + tmp_5 * m30) -
	          (tmp_0 * m10 + tmp_3 * m20 + tmp_4 * m30));
	  dst[ 5] = d * ((tmp_0 * m00 + tmp_7 * m20 + tmp_8 * m30) -
	          (tmp_1 * m00 + tmp_6 * m20 + tmp_9 * m30));
	  dst[ 6] = d * ((tmp_3 * m00 + tmp_6 * m10 + tmp_11 * m30) -
	          (tmp_2 * m00 + tmp_7 * m10 + tmp_10 * m30));
	  dst[ 7] = d * ((tmp_4 * m00 + tmp_9 * m10 + tmp_10 * m20) -
	          (tmp_5 * m00 + tmp_8 * m10 + tmp_11 * m20));
	  dst[ 8] = d * ((tmp_12 * m13 + tmp_15 * m23 + tmp_16 * m33) -
	          (tmp_13 * m13 + tmp_14 * m23 + tmp_17 * m33));
	  dst[ 9] = d * ((tmp_13 * m03 + tmp_18 * m23 + tmp_21 * m33) -
	          (tmp_12 * m03 + tmp_19 * m23 + tmp_20 * m33));
	  dst[10] = d * ((tmp_14 * m03 + tmp_19 * m13 + tmp_22 * m33) -
	          (tmp_15 * m03 + tmp_18 * m13 + tmp_23 * m33));
	  dst[11] = d * ((tmp_17 * m03 + tmp_20 * m13 + tmp_23 * m23) -
	          (tmp_16 * m03 + tmp_21 * m13 + tmp_22 * m23));
	  dst[12] = d * ((tmp_14 * m22 + tmp_17 * m32 + tmp_13 * m12) -
	          (tmp_16 * m32 + tmp_12 * m12 + tmp_15 * m22));
	  dst[13] = d * ((tmp_20 * m32 + tmp_12 * m02 + tmp_19 * m22) -
	          (tmp_18 * m22 + tmp_21 * m32 + tmp_13 * m02));
	  dst[14] = d * ((tmp_18 * m12 + tmp_23 * m32 + tmp_15 * m02) -
	          (tmp_22 * m32 + tmp_14 * m02 + tmp_19 * m12));
	  dst[15] = d * ((tmp_22 * m22 + tmp_16 * m02 + tmp_21 * m12) -
	          (tmp_20 * m12 + tmp_23 * m22 + tmp_17 * m02));

	  return dst;
	}

	/**
	 * Multiplies two 4-by-4 matrices with a on the left and b on the right
	 * @param {module:twgl/m4.Mat4} a The matrix on the left.
	 * @param {module:twgl/m4.Mat4} b The matrix on the right.
	 * @param {module:twgl/m4.Mat4} [dst] matrix to hold result. If not passed a new one is created.
	 * @return {module:twgl/m4.Mat4} The matrix product of a and b.
	 * @memberOf module:twgl/m4
	 */
	function multiply$1(a, b, dst) {
	  dst = dst || new MatType(16);

	  const a00 = a[0];
	  const a01 = a[1];
	  const a02 = a[2];
	  const a03 = a[3];
	  const a10 = a[ 4 + 0];
	  const a11 = a[ 4 + 1];
	  const a12 = a[ 4 + 2];
	  const a13 = a[ 4 + 3];
	  const a20 = a[ 8 + 0];
	  const a21 = a[ 8 + 1];
	  const a22 = a[ 8 + 2];
	  const a23 = a[ 8 + 3];
	  const a30 = a[12 + 0];
	  const a31 = a[12 + 1];
	  const a32 = a[12 + 2];
	  const a33 = a[12 + 3];
	  const b00 = b[0];
	  const b01 = b[1];
	  const b02 = b[2];
	  const b03 = b[3];
	  const b10 = b[ 4 + 0];
	  const b11 = b[ 4 + 1];
	  const b12 = b[ 4 + 2];
	  const b13 = b[ 4 + 3];
	  const b20 = b[ 8 + 0];
	  const b21 = b[ 8 + 1];
	  const b22 = b[ 8 + 2];
	  const b23 = b[ 8 + 3];
	  const b30 = b[12 + 0];
	  const b31 = b[12 + 1];
	  const b32 = b[12 + 2];
	  const b33 = b[12 + 3];

	  dst[ 0] = a00 * b00 + a10 * b01 + a20 * b02 + a30 * b03;
	  dst[ 1] = a01 * b00 + a11 * b01 + a21 * b02 + a31 * b03;
	  dst[ 2] = a02 * b00 + a12 * b01 + a22 * b02 + a32 * b03;
	  dst[ 3] = a03 * b00 + a13 * b01 + a23 * b02 + a33 * b03;
	  dst[ 4] = a00 * b10 + a10 * b11 + a20 * b12 + a30 * b13;
	  dst[ 5] = a01 * b10 + a11 * b11 + a21 * b12 + a31 * b13;
	  dst[ 6] = a02 * b10 + a12 * b11 + a22 * b12 + a32 * b13;
	  dst[ 7] = a03 * b10 + a13 * b11 + a23 * b12 + a33 * b13;
	  dst[ 8] = a00 * b20 + a10 * b21 + a20 * b22 + a30 * b23;
	  dst[ 9] = a01 * b20 + a11 * b21 + a21 * b22 + a31 * b23;
	  dst[10] = a02 * b20 + a12 * b21 + a22 * b22 + a32 * b23;
	  dst[11] = a03 * b20 + a13 * b21 + a23 * b22 + a33 * b23;
	  dst[12] = a00 * b30 + a10 * b31 + a20 * b32 + a30 * b33;
	  dst[13] = a01 * b30 + a11 * b31 + a21 * b32 + a31 * b33;
	  dst[14] = a02 * b30 + a12 * b31 + a22 * b32 + a32 * b33;
	  dst[15] = a03 * b30 + a13 * b31 + a23 * b32 + a33 * b33;

	  return dst;
	}

	/**
	 * Sets the translation component of a 4-by-4 matrix to the given
	 * vector.
	 * @param {module:twgl/m4.Mat4} a The matrix.
	 * @param {module:twgl/v3.Vec3} v The vector.
	 * @param {module:twgl/m4.Mat4} [dst] matrix to hold result. If not passed a new one is created.
	 * @return {module:twgl/m4.Mat4} The matrix with translation set.
	 * @memberOf module:twgl/m4
	 */
	function setTranslation(a, v, dst) {
	  dst = dst || identity();
	  if (a !== dst) {
	    dst[ 0] = a[ 0];
	    dst[ 1] = a[ 1];
	    dst[ 2] = a[ 2];
	    dst[ 3] = a[ 3];
	    dst[ 4] = a[ 4];
	    dst[ 5] = a[ 5];
	    dst[ 6] = a[ 6];
	    dst[ 7] = a[ 7];
	    dst[ 8] = a[ 8];
	    dst[ 9] = a[ 9];
	    dst[10] = a[10];
	    dst[11] = a[11];
	  }
	  dst[12] = v[0];
	  dst[13] = v[1];
	  dst[14] = v[2];
	  dst[15] = 1;
	  return dst;
	}

	/**
	 * Returns the translation component of a 4-by-4 matrix as a vector with 3
	 * entries.
	 * @param {module:twgl/m4.Mat4} m The matrix.
	 * @param {module:twgl/v3.Vec3} [dst] vector to hold result. If not passed a new one is created.
	 * @return {module:twgl/v3.Vec3} The translation component of m.
	 * @memberOf module:twgl/m4
	 */
	function getTranslation(m, dst) {
	  dst = dst || create();
	  dst[0] = m[12];
	  dst[1] = m[13];
	  dst[2] = m[14];
	  return dst;
	}

	/**
	 * Returns an axis of a 4x4 matrix as a vector with 3 entries
	 * @param {module:twgl/m4.Mat4} m The matrix.
	 * @param {number} axis The axis 0 = x, 1 = y, 2 = z;
	 * @return {module:twgl/v3.Vec3} [dst] vector.
	 * @return {module:twgl/v3.Vec3} The axis component of m.
	 * @memberOf module:twgl/m4
	 */
	function getAxis(m, axis, dst) {
	  dst = dst || create();
	  const off = axis * 4;
	  dst[0] = m[off + 0];
	  dst[1] = m[off + 1];
	  dst[2] = m[off + 2];
	  return dst;
	}

	/**
	 * Sets an axis of a 4x4 matrix as a vector with 3 entries
	 * @param {module:twgl/m4.Mat4} m The matrix.
	 * @param {module:twgl/v3.Vec3} v the axis vector
	 * @param {number} axis The axis  0 = x, 1 = y, 2 = z;
	 * @param {module:twgl/m4.Mat4} [dst] The matrix to set. If not passed a new one is created.
	 * @return {module:twgl/m4.Mat4} The matrix with axis set.
	 * @memberOf module:twgl/m4
	 */
	function setAxis(a, v, axis, dst) {
	  if (dst !== a) {
	    dst = copy$1(a, dst);
	  }
	  const off = axis * 4;
	  dst[off + 0] = v[0];
	  dst[off + 1] = v[1];
	  dst[off + 2] = v[2];
	  return dst;
	}

	/**
	 * Computes a 4-by-4 perspective transformation matrix given the angular height
	 * of the frustum, the aspect ratio, and the near and far clipping planes.  The
	 * arguments define a frustum extending in the negative z direction.  The given
	 * angle is the vertical angle of the frustum, and the horizontal angle is
	 * determined to produce the given aspect ratio.  The arguments near and far are
	 * the distances to the near and far clipping planes.  Note that near and far
	 * are not z coordinates, but rather they are distances along the negative
	 * z-axis.  The matrix generated sends the viewing frustum to the unit box.
	 * We assume a unit box extending from -1 to 1 in the x and y dimensions and
	 * from 0 to 1 in the z dimension.
	 * @param {number} fieldOfViewYInRadians The camera angle from top to bottom (in radians).
	 * @param {number} aspect The aspect ratio width / height.
	 * @param {number} zNear The depth (negative z coordinate)
	 *     of the near clipping plane.
	 * @param {number} zFar The depth (negative z coordinate)
	 *     of the far clipping plane.
	 * @param {module:twgl/m4.Mat4} [dst] matrix to hold result. If not passed a new one is created.
	 * @return {module:twgl/m4.Mat4} The perspective matrix.
	 * @memberOf module:twgl/m4
	 */
	function perspective(fieldOfViewYInRadians, aspect, zNear, zFar, dst) {
	  dst = dst || new MatType(16);

	  const f = Math.tan(Math.PI * 0.5 - 0.5 * fieldOfViewYInRadians);
	  const rangeInv = 1.0 / (zNear - zFar);

	  dst[0]  = f / aspect;
	  dst[1]  = 0;
	  dst[2]  = 0;
	  dst[3]  = 0;

	  dst[4]  = 0;
	  dst[5]  = f;
	  dst[6]  = 0;
	  dst[7]  = 0;

	  dst[8]  = 0;
	  dst[9]  = 0;
	  dst[10] = (zNear + zFar) * rangeInv;
	  dst[11] = -1;

	  dst[12] = 0;
	  dst[13] = 0;
	  dst[14] = zNear * zFar * rangeInv * 2;
	  dst[15] = 0;

	  return dst;
	}

	/**
	 * Computes a 4-by-4 orthogonal transformation matrix given the left, right,
	 * bottom, and top dimensions of the near clipping plane as well as the
	 * near and far clipping plane distances.
	 * @param {number} left Left side of the near clipping plane viewport.
	 * @param {number} right Right side of the near clipping plane viewport.
	 * @param {number} bottom Bottom of the near clipping plane viewport.
	 * @param {number} top Top of the near clipping plane viewport.
	 * @param {number} near The depth (negative z coordinate)
	 *     of the near clipping plane.
	 * @param {number} far The depth (negative z coordinate)
	 *     of the far clipping plane.
	 * @param {module:twgl/m4.Mat4} [dst] Output matrix. If not passed a new one is created.
	 * @return {module:twgl/m4.Mat4} The perspective matrix.
	 * @memberOf module:twgl/m4
	 */
	function ortho(left, right, bottom, top, near, far, dst) {
	  dst = dst || new MatType(16);

	  dst[0]  = 2 / (right - left);
	  dst[1]  = 0;
	  dst[2]  = 0;
	  dst[3]  = 0;

	  dst[4]  = 0;
	  dst[5]  = 2 / (top - bottom);
	  dst[6]  = 0;
	  dst[7]  = 0;

	  dst[8]  = 0;
	  dst[9]  = 0;
	  dst[10] = 2 / (near - far);
	  dst[11] = 0;

	  dst[12] = (right + left) / (left - right);
	  dst[13] = (top + bottom) / (bottom - top);
	  dst[14] = (far + near) / (near - far);
	  dst[15] = 1;

	  return dst;
	}

	/**
	 * Computes a 4-by-4 perspective transformation matrix given the left, right,
	 * top, bottom, near and far clipping planes. The arguments define a frustum
	 * extending in the negative z direction. The arguments near and far are the
	 * distances to the near and far clipping planes. Note that near and far are not
	 * z coordinates, but rather they are distances along the negative z-axis. The
	 * matrix generated sends the viewing frustum to the unit box. We assume a unit
	 * box extending from -1 to 1 in the x and y dimensions and from 0 to 1 in the z
	 * dimension.
	 * @param {number} left The x coordinate of the left plane of the box.
	 * @param {number} right The x coordinate of the right plane of the box.
	 * @param {number} bottom The y coordinate of the bottom plane of the box.
	 * @param {number} top The y coordinate of the right plane of the box.
	 * @param {number} near The negative z coordinate of the near plane of the box.
	 * @param {number} far The negative z coordinate of the far plane of the box.
	 * @param {module:twgl/m4.Mat4} [dst] Output matrix. If not passed a new one is created.
	 * @return {module:twgl/m4.Mat4} The perspective projection matrix.
	 * @memberOf module:twgl/m4
	 */
	function frustum(left, right, bottom, top, near, far, dst) {
	  dst = dst || new MatType(16);

	  const dx = (right - left);
	  const dy = (top - bottom);
	  const dz = (near - far);

	  dst[ 0] = 2 * near / dx;
	  dst[ 1] = 0;
	  dst[ 2] = 0;
	  dst[ 3] = 0;
	  dst[ 4] = 0;
	  dst[ 5] = 2 * near / dy;
	  dst[ 6] = 0;
	  dst[ 7] = 0;
	  dst[ 8] = (left + right) / dx;
	  dst[ 9] = (top + bottom) / dy;
	  dst[10] = far / dz;
	  dst[11] = -1;
	  dst[12] = 0;
	  dst[13] = 0;
	  dst[14] = near * far / dz;
	  dst[15] = 0;

	  return dst;
	}

	let xAxis;
	let yAxis;
	let zAxis;

	/**
	 * Computes a 4-by-4 look-at transformation.
	 *
	 * This is a matrix which positions the camera itself. If you want
	 * a view matrix (a matrix which moves things in front of the camera)
	 * take the inverse of this.
	 *
	 * @param {module:twgl/v3.Vec3} eye The position of the eye.
	 * @param {module:twgl/v3.Vec3} target The position meant to be viewed.
	 * @param {module:twgl/v3.Vec3} up A vector pointing up.
	 * @param {module:twgl/m4.Mat4} [dst] matrix to hold result. If not passed a new one is created.
	 * @return {module:twgl/m4.Mat4} The look-at matrix.
	 * @memberOf module:twgl/m4
	 */
	function lookAt(eye, target, up, dst) {
	  dst = dst || new MatType(16);

	  xAxis = xAxis || create();
	  yAxis = yAxis || create();
	  zAxis = zAxis || create();

	  normalize(
	      subtract(eye, target, zAxis), zAxis);
	  normalize(cross(up, zAxis, xAxis), xAxis);
	  normalize(cross(zAxis, xAxis, yAxis), yAxis);

	  dst[ 0] = xAxis[0];
	  dst[ 1] = xAxis[1];
	  dst[ 2] = xAxis[2];
	  dst[ 3] = 0;
	  dst[ 4] = yAxis[0];
	  dst[ 5] = yAxis[1];
	  dst[ 6] = yAxis[2];
	  dst[ 7] = 0;
	  dst[ 8] = zAxis[0];
	  dst[ 9] = zAxis[1];
	  dst[10] = zAxis[2];
	  dst[11] = 0;
	  dst[12] = eye[0];
	  dst[13] = eye[1];
	  dst[14] = eye[2];
	  dst[15] = 1;

	  return dst;
	}

	/**
	 * Creates a 4-by-4 matrix which translates by the given vector v.
	 * @param {module:twgl/v3.Vec3} v The vector by
	 *     which to translate.
	 * @param {module:twgl/m4.Mat4} [dst] matrix to hold result. If not passed a new one is created.
	 * @return {module:twgl/m4.Mat4} The translation matrix.
	 * @memberOf module:twgl/m4
	 */
	function translation(v, dst) {
	  dst = dst || new MatType(16);

	  dst[ 0] = 1;
	  dst[ 1] = 0;
	  dst[ 2] = 0;
	  dst[ 3] = 0;
	  dst[ 4] = 0;
	  dst[ 5] = 1;
	  dst[ 6] = 0;
	  dst[ 7] = 0;
	  dst[ 8] = 0;
	  dst[ 9] = 0;
	  dst[10] = 1;
	  dst[11] = 0;
	  dst[12] = v[0];
	  dst[13] = v[1];
	  dst[14] = v[2];
	  dst[15] = 1;
	  return dst;
	}

	/**
	 * Translates the given 4-by-4 matrix by the given vector v.
	 * @param {module:twgl/m4.Mat4} m The matrix.
	 * @param {module:twgl/v3.Vec3} v The vector by
	 *     which to translate.
	 * @param {module:twgl/m4.Mat4} [dst] matrix to hold result. If not passed a new one is created.
	 * @return {module:twgl/m4.Mat4} The translated matrix.
	 * @memberOf module:twgl/m4
	 */
	function translate$1(m, v, dst) {
	  dst = dst || new MatType(16);

	  const v0 = v[0];
	  const v1 = v[1];
	  const v2 = v[2];
	  const m00 = m[0];
	  const m01 = m[1];
	  const m02 = m[2];
	  const m03 = m[3];
	  const m10 = m[1 * 4 + 0];
	  const m11 = m[1 * 4 + 1];
	  const m12 = m[1 * 4 + 2];
	  const m13 = m[1 * 4 + 3];
	  const m20 = m[2 * 4 + 0];
	  const m21 = m[2 * 4 + 1];
	  const m22 = m[2 * 4 + 2];
	  const m23 = m[2 * 4 + 3];
	  const m30 = m[3 * 4 + 0];
	  const m31 = m[3 * 4 + 1];
	  const m32 = m[3 * 4 + 2];
	  const m33 = m[3 * 4 + 3];

	  if (m !== dst) {
	    dst[ 0] = m00;
	    dst[ 1] = m01;
	    dst[ 2] = m02;
	    dst[ 3] = m03;
	    dst[ 4] = m10;
	    dst[ 5] = m11;
	    dst[ 6] = m12;
	    dst[ 7] = m13;
	    dst[ 8] = m20;
	    dst[ 9] = m21;
	    dst[10] = m22;
	    dst[11] = m23;
	  }

	  dst[12] = m00 * v0 + m10 * v1 + m20 * v2 + m30;
	  dst[13] = m01 * v0 + m11 * v1 + m21 * v2 + m31;
	  dst[14] = m02 * v0 + m12 * v1 + m22 * v2 + m32;
	  dst[15] = m03 * v0 + m13 * v1 + m23 * v2 + m33;

	  return dst;
	}

	/**
	 * Creates a 4-by-4 matrix which rotates around the x-axis by the given angle.
	 * @param {number} angleInRadians The angle by which to rotate (in radians).
	 * @param {module:twgl/m4.Mat4} [dst] matrix to hold result. If not passed a new one is created.
	 * @return {module:twgl/m4.Mat4} The rotation matrix.
	 * @memberOf module:twgl/m4
	 */
	function rotationX(angleInRadians, dst) {
	  dst = dst || new MatType(16);

	  const c = Math.cos(angleInRadians);
	  const s = Math.sin(angleInRadians);

	  dst[ 0] = 1;
	  dst[ 1] = 0;
	  dst[ 2] = 0;
	  dst[ 3] = 0;
	  dst[ 4] = 0;
	  dst[ 5] = c;
	  dst[ 6] = s;
	  dst[ 7] = 0;
	  dst[ 8] = 0;
	  dst[ 9] = -s;
	  dst[10] = c;
	  dst[11] = 0;
	  dst[12] = 0;
	  dst[13] = 0;
	  dst[14] = 0;
	  dst[15] = 1;

	  return dst;
	}

	/**
	 * Rotates the given 4-by-4 matrix around the x-axis by the given
	 * angle.
	 * @param {module:twgl/m4.Mat4} m The matrix.
	 * @param {number} angleInRadians The angle by which to rotate (in radians).
	 * @param {module:twgl/m4.Mat4} [dst] matrix to hold result. If not passed a new one is created.
	 * @return {module:twgl/m4.Mat4} The rotated matrix.
	 * @memberOf module:twgl/m4
	 */
	function rotateX(m, angleInRadians, dst) {
	  dst = dst || new MatType(16);

	  const m10 = m[4];
	  const m11 = m[5];
	  const m12 = m[6];
	  const m13 = m[7];
	  const m20 = m[8];
	  const m21 = m[9];
	  const m22 = m[10];
	  const m23 = m[11];
	  const c = Math.cos(angleInRadians);
	  const s = Math.sin(angleInRadians);

	  dst[4]  = c * m10 + s * m20;
	  dst[5]  = c * m11 + s * m21;
	  dst[6]  = c * m12 + s * m22;
	  dst[7]  = c * m13 + s * m23;
	  dst[8]  = c * m20 - s * m10;
	  dst[9]  = c * m21 - s * m11;
	  dst[10] = c * m22 - s * m12;
	  dst[11] = c * m23 - s * m13;

	  if (m !== dst) {
	    dst[ 0] = m[ 0];
	    dst[ 1] = m[ 1];
	    dst[ 2] = m[ 2];
	    dst[ 3] = m[ 3];
	    dst[12] = m[12];
	    dst[13] = m[13];
	    dst[14] = m[14];
	    dst[15] = m[15];
	  }

	  return dst;
	}

	/**
	 * Creates a 4-by-4 matrix which rotates around the y-axis by the given angle.
	 * @param {number} angleInRadians The angle by which to rotate (in radians).
	 * @param {module:twgl/m4.Mat4} [dst] matrix to hold result. If not passed a new one is created.
	 * @return {module:twgl/m4.Mat4} The rotation matrix.
	 * @memberOf module:twgl/m4
	 */
	function rotationY(angleInRadians, dst) {
	  dst = dst || new MatType(16);

	  const c = Math.cos(angleInRadians);
	  const s = Math.sin(angleInRadians);

	  dst[ 0] = c;
	  dst[ 1] = 0;
	  dst[ 2] = -s;
	  dst[ 3] = 0;
	  dst[ 4] = 0;
	  dst[ 5] = 1;
	  dst[ 6] = 0;
	  dst[ 7] = 0;
	  dst[ 8] = s;
	  dst[ 9] = 0;
	  dst[10] = c;
	  dst[11] = 0;
	  dst[12] = 0;
	  dst[13] = 0;
	  dst[14] = 0;
	  dst[15] = 1;

	  return dst;
	}

	/**
	 * Rotates the given 4-by-4 matrix around the y-axis by the given
	 * angle.
	 * @param {module:twgl/m4.Mat4} m The matrix.
	 * @param {number} angleInRadians The angle by which to rotate (in radians).
	 * @param {module:twgl/m4.Mat4} [dst] matrix to hold result. If not passed a new one is created.
	 * @return {module:twgl/m4.Mat4} The rotated matrix.
	 * @memberOf module:twgl/m4
	 */
	function rotateY(m, angleInRadians, dst) {
	  dst = dst || new MatType(16);

	  const m00 = m[0 * 4 + 0];
	  const m01 = m[0 * 4 + 1];
	  const m02 = m[0 * 4 + 2];
	  const m03 = m[0 * 4 + 3];
	  const m20 = m[2 * 4 + 0];
	  const m21 = m[2 * 4 + 1];
	  const m22 = m[2 * 4 + 2];
	  const m23 = m[2 * 4 + 3];
	  const c = Math.cos(angleInRadians);
	  const s = Math.sin(angleInRadians);

	  dst[ 0] = c * m00 - s * m20;
	  dst[ 1] = c * m01 - s * m21;
	  dst[ 2] = c * m02 - s * m22;
	  dst[ 3] = c * m03 - s * m23;
	  dst[ 8] = c * m20 + s * m00;
	  dst[ 9] = c * m21 + s * m01;
	  dst[10] = c * m22 + s * m02;
	  dst[11] = c * m23 + s * m03;

	  if (m !== dst) {
	    dst[ 4] = m[ 4];
	    dst[ 5] = m[ 5];
	    dst[ 6] = m[ 6];
	    dst[ 7] = m[ 7];
	    dst[12] = m[12];
	    dst[13] = m[13];
	    dst[14] = m[14];
	    dst[15] = m[15];
	  }

	  return dst;
	}

	/**
	 * Creates a 4-by-4 matrix which rotates around the z-axis by the given angle.
	 * @param {number} angleInRadians The angle by which to rotate (in radians).
	 * @param {module:twgl/m4.Mat4} [dst] matrix to hold result. If not passed a new one is created.
	 * @return {module:twgl/m4.Mat4} The rotation matrix.
	 * @memberOf module:twgl/m4
	 */
	function rotationZ(angleInRadians, dst) {
	  dst = dst || new MatType(16);

	  const c = Math.cos(angleInRadians);
	  const s = Math.sin(angleInRadians);

	  dst[ 0] = c;
	  dst[ 1] = s;
	  dst[ 2] = 0;
	  dst[ 3] = 0;
	  dst[ 4] = -s;
	  dst[ 5] = c;
	  dst[ 6] = 0;
	  dst[ 7] = 0;
	  dst[ 8] = 0;
	  dst[ 9] = 0;
	  dst[10] = 1;
	  dst[11] = 0;
	  dst[12] = 0;
	  dst[13] = 0;
	  dst[14] = 0;
	  dst[15] = 1;

	  return dst;
	}

	/**
	 * Rotates the given 4-by-4 matrix around the z-axis by the given
	 * angle.
	 * @param {module:twgl/m4.Mat4} m The matrix.
	 * @param {number} angleInRadians The angle by which to rotate (in radians).
	 * @param {module:twgl/m4.Mat4} [dst] matrix to hold result. If not passed a new one is created.
	 * @return {module:twgl/m4.Mat4} The rotated matrix.
	 * @memberOf module:twgl/m4
	 */
	function rotateZ(m, angleInRadians, dst) {
	  dst = dst || new MatType(16);

	  const m00 = m[0 * 4 + 0];
	  const m01 = m[0 * 4 + 1];
	  const m02 = m[0 * 4 + 2];
	  const m03 = m[0 * 4 + 3];
	  const m10 = m[1 * 4 + 0];
	  const m11 = m[1 * 4 + 1];
	  const m12 = m[1 * 4 + 2];
	  const m13 = m[1 * 4 + 3];
	  const c = Math.cos(angleInRadians);
	  const s = Math.sin(angleInRadians);

	  dst[ 0] = c * m00 + s * m10;
	  dst[ 1] = c * m01 + s * m11;
	  dst[ 2] = c * m02 + s * m12;
	  dst[ 3] = c * m03 + s * m13;
	  dst[ 4] = c * m10 - s * m00;
	  dst[ 5] = c * m11 - s * m01;
	  dst[ 6] = c * m12 - s * m02;
	  dst[ 7] = c * m13 - s * m03;

	  if (m !== dst) {
	    dst[ 8] = m[ 8];
	    dst[ 9] = m[ 9];
	    dst[10] = m[10];
	    dst[11] = m[11];
	    dst[12] = m[12];
	    dst[13] = m[13];
	    dst[14] = m[14];
	    dst[15] = m[15];
	  }

	  return dst;
	}

	/**
	 * Creates a 4-by-4 matrix which rotates around the given axis by the given
	 * angle.
	 * @param {module:twgl/v3.Vec3} axis The axis
	 *     about which to rotate.
	 * @param {number} angleInRadians The angle by which to rotate (in radians).
	 * @param {module:twgl/m4.Mat4} [dst] matrix to hold result. If not passed a new one is created.
	 * @return {module:twgl/m4.Mat4} A matrix which rotates angle radians
	 *     around the axis.
	 * @memberOf module:twgl/m4
	 */
	function axisRotation(axis, angleInRadians, dst) {
	  dst = dst || new MatType(16);

	  let x = axis[0];
	  let y = axis[1];
	  let z = axis[2];
	  const n = Math.sqrt(x * x + y * y + z * z);
	  x /= n;
	  y /= n;
	  z /= n;
	  const xx = x * x;
	  const yy = y * y;
	  const zz = z * z;
	  const c = Math.cos(angleInRadians);
	  const s = Math.sin(angleInRadians);
	  const oneMinusCosine = 1 - c;

	  dst[ 0] = xx + (1 - xx) * c;
	  dst[ 1] = x * y * oneMinusCosine + z * s;
	  dst[ 2] = x * z * oneMinusCosine - y * s;
	  dst[ 3] = 0;
	  dst[ 4] = x * y * oneMinusCosine - z * s;
	  dst[ 5] = yy + (1 - yy) * c;
	  dst[ 6] = y * z * oneMinusCosine + x * s;
	  dst[ 7] = 0;
	  dst[ 8] = x * z * oneMinusCosine + y * s;
	  dst[ 9] = y * z * oneMinusCosine - x * s;
	  dst[10] = zz + (1 - zz) * c;
	  dst[11] = 0;
	  dst[12] = 0;
	  dst[13] = 0;
	  dst[14] = 0;
	  dst[15] = 1;

	  return dst;
	}

	/**
	 * Rotates the given 4-by-4 matrix around the given axis by the
	 * given angle.
	 * @param {module:twgl/m4.Mat4} m The matrix.
	 * @param {module:twgl/v3.Vec3} axis The axis
	 *     about which to rotate.
	 * @param {number} angleInRadians The angle by which to rotate (in radians).
	 * @param {module:twgl/m4.Mat4} [dst] matrix to hold result. If not passed a new one is created.
	 * @return {module:twgl/m4.Mat4} The rotated matrix.
	 * @memberOf module:twgl/m4
	 */
	function axisRotate(m, axis, angleInRadians, dst) {
	  dst = dst || new MatType(16);

	  let x = axis[0];
	  let y = axis[1];
	  let z = axis[2];
	  const n = Math.sqrt(x * x + y * y + z * z);
	  x /= n;
	  y /= n;
	  z /= n;
	  const xx = x * x;
	  const yy = y * y;
	  const zz = z * z;
	  const c = Math.cos(angleInRadians);
	  const s = Math.sin(angleInRadians);
	  const oneMinusCosine = 1 - c;

	  const r00 = xx + (1 - xx) * c;
	  const r01 = x * y * oneMinusCosine + z * s;
	  const r02 = x * z * oneMinusCosine - y * s;
	  const r10 = x * y * oneMinusCosine - z * s;
	  const r11 = yy + (1 - yy) * c;
	  const r12 = y * z * oneMinusCosine + x * s;
	  const r20 = x * z * oneMinusCosine + y * s;
	  const r21 = y * z * oneMinusCosine - x * s;
	  const r22 = zz + (1 - zz) * c;

	  const m00 = m[0];
	  const m01 = m[1];
	  const m02 = m[2];
	  const m03 = m[3];
	  const m10 = m[4];
	  const m11 = m[5];
	  const m12 = m[6];
	  const m13 = m[7];
	  const m20 = m[8];
	  const m21 = m[9];
	  const m22 = m[10];
	  const m23 = m[11];

	  dst[ 0] = r00 * m00 + r01 * m10 + r02 * m20;
	  dst[ 1] = r00 * m01 + r01 * m11 + r02 * m21;
	  dst[ 2] = r00 * m02 + r01 * m12 + r02 * m22;
	  dst[ 3] = r00 * m03 + r01 * m13 + r02 * m23;
	  dst[ 4] = r10 * m00 + r11 * m10 + r12 * m20;
	  dst[ 5] = r10 * m01 + r11 * m11 + r12 * m21;
	  dst[ 6] = r10 * m02 + r11 * m12 + r12 * m22;
	  dst[ 7] = r10 * m03 + r11 * m13 + r12 * m23;
	  dst[ 8] = r20 * m00 + r21 * m10 + r22 * m20;
	  dst[ 9] = r20 * m01 + r21 * m11 + r22 * m21;
	  dst[10] = r20 * m02 + r21 * m12 + r22 * m22;
	  dst[11] = r20 * m03 + r21 * m13 + r22 * m23;

	  if (m !== dst) {
	    dst[12] = m[12];
	    dst[13] = m[13];
	    dst[14] = m[14];
	    dst[15] = m[15];
	  }

	  return dst;
	}

	/**
	 * Creates a 4-by-4 matrix which scales in each dimension by an amount given by
	 * the corresponding entry in the given vector; assumes the vector has three
	 * entries.
	 * @param {module:twgl/v3.Vec3} v A vector of
	 *     three entries specifying the factor by which to scale in each dimension.
	 * @param {module:twgl/m4.Mat4} [dst] matrix to hold result. If not passed a new one is created.
	 * @return {module:twgl/m4.Mat4} The scaling matrix.
	 * @memberOf module:twgl/m4
	 */
	function scaling(v, dst) {
	  dst = dst || new MatType(16);

	  dst[ 0] = v[0];
	  dst[ 1] = 0;
	  dst[ 2] = 0;
	  dst[ 3] = 0;
	  dst[ 4] = 0;
	  dst[ 5] = v[1];
	  dst[ 6] = 0;
	  dst[ 7] = 0;
	  dst[ 8] = 0;
	  dst[ 9] = 0;
	  dst[10] = v[2];
	  dst[11] = 0;
	  dst[12] = 0;
	  dst[13] = 0;
	  dst[14] = 0;
	  dst[15] = 1;

	  return dst;
	}

	/**
	 * Scales the given 4-by-4 matrix in each dimension by an amount
	 * given by the corresponding entry in the given vector; assumes the vector has
	 * three entries.
	 * @param {module:twgl/m4.Mat4} m The matrix to be modified.
	 * @param {module:twgl/v3.Vec3} v A vector of three entries specifying the
	 *     factor by which to scale in each dimension.
	 * @param {module:twgl/m4.Mat4} [dst] matrix to hold result. If not passed a new one is created.
	 * @return {module:twgl/m4.Mat4} The scaled matrix.
	 * @memberOf module:twgl/m4
	 */
	function scale(m, v, dst) {
	  dst = dst || new MatType(16);

	  const v0 = v[0];
	  const v1 = v[1];
	  const v2 = v[2];

	  dst[ 0] = v0 * m[0 * 4 + 0];
	  dst[ 1] = v0 * m[0 * 4 + 1];
	  dst[ 2] = v0 * m[0 * 4 + 2];
	  dst[ 3] = v0 * m[0 * 4 + 3];
	  dst[ 4] = v1 * m[1 * 4 + 0];
	  dst[ 5] = v1 * m[1 * 4 + 1];
	  dst[ 6] = v1 * m[1 * 4 + 2];
	  dst[ 7] = v1 * m[1 * 4 + 3];
	  dst[ 8] = v2 * m[2 * 4 + 0];
	  dst[ 9] = v2 * m[2 * 4 + 1];
	  dst[10] = v2 * m[2 * 4 + 2];
	  dst[11] = v2 * m[2 * 4 + 3];

	  if (m !== dst) {
	    dst[12] = m[12];
	    dst[13] = m[13];
	    dst[14] = m[14];
	    dst[15] = m[15];
	  }

	  return dst;
	}

	/**
	 * Takes a 4-by-4 matrix and a vector with 3 entries,
	 * interprets the vector as a point, transforms that point by the matrix, and
	 * returns the result as a vector with 3 entries.
	 * @param {module:twgl/m4.Mat4} m The matrix.
	 * @param {module:twgl/v3.Vec3} v The point.
	 * @param {module:twgl/v3.Vec3} [dst] optional vec3 to store result. If not passed a new one is created.
	 * @return {module:twgl/v3.Vec3} The transformed point.
	 * @memberOf module:twgl/m4
	 */
	function transformPoint(m, v, dst) {
	  dst = dst || create();
	  const v0 = v[0];
	  const v1 = v[1];
	  const v2 = v[2];
	  const d = v0 * m[0 * 4 + 3] + v1 * m[1 * 4 + 3] + v2 * m[2 * 4 + 3] + m[3 * 4 + 3];

	  dst[0] = (v0 * m[0 * 4 + 0] + v1 * m[1 * 4 + 0] + v2 * m[2 * 4 + 0] + m[3 * 4 + 0]) / d;
	  dst[1] = (v0 * m[0 * 4 + 1] + v1 * m[1 * 4 + 1] + v2 * m[2 * 4 + 1] + m[3 * 4 + 1]) / d;
	  dst[2] = (v0 * m[0 * 4 + 2] + v1 * m[1 * 4 + 2] + v2 * m[2 * 4 + 2] + m[3 * 4 + 2]) / d;

	  return dst;
	}

	/**
	 * Takes a 4-by-4 matrix and a vector with 3 entries, interprets the vector as a
	 * direction, transforms that direction by the matrix, and returns the result;
	 * assumes the transformation of 3-dimensional space represented by the matrix
	 * is parallel-preserving, i.e. any combination of rotation, scaling and
	 * translation, but not a perspective distortion. Returns a vector with 3
	 * entries.
	 * @param {module:twgl/m4.Mat4} m The matrix.
	 * @param {module:twgl/v3.Vec3} v The direction.
	 * @param {module:twgl/v3.Vec3} [dst] optional Vec3 to store result. If not passed a new one is created.
	 * @return {module:twgl/v3.Vec3} The transformed direction.
	 * @memberOf module:twgl/m4
	 */
	function transformDirection(m, v, dst) {
	  dst = dst || create();

	  const v0 = v[0];
	  const v1 = v[1];
	  const v2 = v[2];

	  dst[0] = v0 * m[0 * 4 + 0] + v1 * m[1 * 4 + 0] + v2 * m[2 * 4 + 0];
	  dst[1] = v0 * m[0 * 4 + 1] + v1 * m[1 * 4 + 1] + v2 * m[2 * 4 + 1];
	  dst[2] = v0 * m[0 * 4 + 2] + v1 * m[1 * 4 + 2] + v2 * m[2 * 4 + 2];

	  return dst;
	}

	/**
	 * Takes a 4-by-4 matrix m and a vector v with 3 entries, interprets the vector
	 * as a normal to a surface, and computes a vector which is normal upon
	 * transforming that surface by the matrix. The effect of this function is the
	 * same as transforming v (as a direction) by the inverse-transpose of m.  This
	 * function assumes the transformation of 3-dimensional space represented by the
	 * matrix is parallel-preserving, i.e. any combination of rotation, scaling and
	 * translation, but not a perspective distortion.  Returns a vector with 3
	 * entries.
	 * @param {module:twgl/m4.Mat4} m The matrix.
	 * @param {module:twgl/v3.Vec3} v The normal.
	 * @param {module:twgl/v3.Vec3} [dst] The direction. If not passed a new one is created.
	 * @return {module:twgl/v3.Vec3} The transformed normal.
	 * @memberOf module:twgl/m4
	 */
	function transformNormal(m, v, dst) {
	  dst = dst || create();
	  const mi = inverse(m);
	  const v0 = v[0];
	  const v1 = v[1];
	  const v2 = v[2];

	  dst[0] = v0 * mi[0 * 4 + 0] + v1 * mi[0 * 4 + 1] + v2 * mi[0 * 4 + 2];
	  dst[1] = v0 * mi[1 * 4 + 0] + v1 * mi[1 * 4 + 1] + v2 * mi[1 * 4 + 2];
	  dst[2] = v0 * mi[2 * 4 + 0] + v1 * mi[2 * 4 + 1] + v2 * mi[2 * 4 + 2];

	  return dst;
	}

	var m4 = /*#__PURE__*/Object.freeze({
	  __proto__: null,
	  axisRotate: axisRotate,
	  axisRotation: axisRotation,
	  copy: copy$1,
	  frustum: frustum,
	  getAxis: getAxis,
	  getTranslation: getTranslation,
	  identity: identity,
	  inverse: inverse,
	  lookAt: lookAt,
	  multiply: multiply$1,
	  negate: negate$1,
	  ortho: ortho,
	  perspective: perspective,
	  rotateX: rotateX,
	  rotateY: rotateY,
	  rotateZ: rotateZ,
	  rotationX: rotationX,
	  rotationY: rotationY,
	  rotationZ: rotationZ,
	  scale: scale,
	  scaling: scaling,
	  setAxis: setAxis,
	  setDefaultType: setDefaultType$1,
	  setTranslation: setTranslation,
	  transformDirection: transformDirection,
	  transformNormal: transformNormal,
	  transformPoint: transformPoint,
	  translate: translate$1,
	  translation: translation,
	  transpose: transpose
	});

	v3.setDefaultType(Array);

	const maths = {};
	const fns = {};
	const parser = new index.Parser({
		in: true,
		assignment: true
	});

	Object.entries(v3).forEach(([key, fn]) => {
		parser.functions[`v3_${key}`] = function (...args) {
			return fn(...args)
		};
	});

	Object.entries(m4).forEach(([key, fn]) => {
		parser.functions[`m4_${key}`] = function (...args) {
			return fn(...args)
		};
	});

	parser.functions.Color = color;

	const math = (formula) => {
		let p = maths[formula];

		if (!p) {
			p = parser.parse(formula);
			maths[formula] = p;
		}

		let keys;
		return (variables) => {
			if (
				!keys ||
				variables.length !== keys.length ||
				!fns[formula]
			) {
				keys = variables.map(([k]) => k);
				try {
					fns[formula] = p.toJSFunction(keys.join(`,`));
				} catch (ex) {
					console.warn(`math compile error`, ex);
					return
				}
			}

			let result = null;
			try {
				result = fns[formula](...variables.map(([_, v]) => v));
			} catch (er) {
				console.warn(`Math script error`, er);
				console.log(variables);
			}

			return result
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

			const leaf = this.weave.chain(this.id.get(), true)
				.filter((k) => k.indexOf(Wheel.DENOTE) !== -1).pop();

			let space_addr;
			if (leaf) space_addr = this.weave.to_address(leaf);

			// nad address
			if (!space_addr) return

			const space = Wheel.get(space_addr);

			if (space.type.get() !== `space`) {
				const leaf_right = this.weave.chain(this.id.get())
					.filter((k) => k.indexOf(Wheel.DENOTE) !== -1).pop();
				space_addr = this.weave.to_address(leaf_right);
			}

			let fail;
			new Set(matches).forEach((item) => {
				const shh = item[0] === `$`;
				const gette = item
					.replace(path_space, `${space_addr}${Wheel.DENOTE}`)
					.replace(path_weave, `${Wheel.DENOTE}${this.weave.name.get()}${Wheel.DENOTE}`)
					.replace(path_ssh, ``)
					.trim();

				const warp = Wheel.get(gette);
				if (!warp) {
					fail = true;
					return
				}

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

			if (fail) return

			try {
				this.fn = math(expression);

				this.values.set(vs);
			} catch (ex) {
				// TODO: Alert user of math error here
				console.warn(`Math parse error`, ex);
			}
		},

		rez () {
			requestAnimationFrame(() => {
				this.run(this.math.get());
			});

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
				this.value.set(this.value.last);
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

			const params = Object.entries(vs).map(
				([key, { warp }]) =>
					[
						key,
						warp.toJSON() === undefined
							? null
							: warp.toJSON()
					]
			);

			params.push([`value`, value]);
			const result = this.warp.fn(params);

			// null or undefined means do nothing
			if (result === null || result === undefined) return

			requestAnimationFrame(() => {
				proto_write.set.call(this, result);
			});
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
				.replace(`~`, `${Wheel.DENOTE}${this.weave.name.get()}`)
				.replace(`.`, `${this.weave.name.get()}${Wheel.DENOTE}${space ? space.get_value(`!name`) : `not connected`}`)
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
		whom = `${Wheel.DENOTE}sys${Wheel.DENOTE}mouse${Wheel.DENOTE}position`,
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
		id = cuid_1(),
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
			properties.id = properties.id || cuid_1();

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
				const $wefts_r = this.wefts_r.get();

				let dirty_wefts = false;

				ids.forEach((id) => {
					if ($wefts[id]) {
						dirty_wefts = true;
						delete $wefts[id];
					}

					if ($wefts_r[id]) {
						dirty_wefts = true;
						delete $wefts[$wefts_r[id]];
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
			const [warp, weft] = address.split(Wheel.DENOTE);

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
				const last = chain[chain.length - 1].split(Wheel.DENOTE)[0];
				const first = chain[0].split(Wheel.DENOTE)[0];
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
			const [warp] = id_path.split(Wheel.DENOTE);

			const space = this.get_id(warp);
			if (!space) return

			return `${Wheel.DENOTE}${this.name.get()}${Wheel.DENOTE}${space.id.get()}`
		},

		get_name (name) {
			const $ns = this.names.get();

			return $ns[name]
		},

		get_id (id) {
			if (!id || typeof id !== `string`) return

			const [k_id, chan_name] = id.split(Wheel.DENOTE);
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
		id = cuid_1(),
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

	// run the system weave by default (safe idle)
	const running = read({
		[SYSTEM]: true
	}, (set) => { });

	const trash = write();

	// name of the current wheel, path watches
	const name$1 = write(``);

	onmessage = ({ action, data }) => {
		switch (action) {
		case `wheel`:

			postMessage({ data });
		}
	};

}(os, crypto$1, fs));
//# sourceMappingURL=wheel.bundle.js.map
