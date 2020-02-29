(function (Color, uuid, scribble, Tone, exif, expr, twgl) {
	'use strict';

	Color = Color && Color.hasOwnProperty('default') ? Color['default'] : Color;
	uuid = uuid && uuid.hasOwnProperty('default') ? uuid['default'] : uuid;
	scribble = scribble && scribble.hasOwnProperty('default') ? scribble['default'] : scribble;
	Tone = Tone && Tone.hasOwnProperty('default') ? Tone['default'] : Tone;
	exif = exif && exif.hasOwnProperty('default') ? exif['default'] : exif;
	expr = expr && expr.hasOwnProperty('default') ? expr['default'] : expr;

	var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

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
		.join(`_`);

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
	const fns = {};
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

	// run the system weave by default (safe idle)
	const running = read({
		[SYSTEM]: true
	}, (set) => { });

	const trash = write();

	// name of the current wheel, path watches
	const name$1 = write(``);

	self.Color = color;

	onmessage = ({ action, data }) => {
		switch (action) {
		case `wheel`:

			postMessage({ data });
		}
	};

}(Color, cuid, scribble, Tone, EXT.piexifjs, exprEval, twgl));
//# sourceMappingURL=wheel.bundle.js.map
