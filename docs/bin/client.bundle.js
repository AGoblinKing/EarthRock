(function (twgl_js, Color) {
    'use strict';

    Color = Color && Object.prototype.hasOwnProperty.call(Color, 'default') ? Color['default'] : Color;

    function noop() { }
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
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function action_destroyer(action_result) {
        return action_result && is_function(action_result.destroy) ? action_result.destroy : noop;
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
    function space() {
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
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
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
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
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
            update: noop,
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
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
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
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
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
            this.$destroy = noop;
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
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.20.1' }, detail)));
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
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
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
        $capture_state() { }
        $inject_state() { }
    }

    /* src\client\Github.svelte generated by Svelte v3.20.1 */

    const file = "src\\client\\Github.svelte";

    function create_fragment(ctx) {
    	let a;
    	let svg;
    	let path0;
    	let path1;
    	let path2;

    	const block = {
    		c: function create() {
    			a = element("a");
    			svg = svg_element("svg");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			path2 = svg_element("path");
    			attr_dev(path0, "class", "bg svelte-mz8sa2");
    			attr_dev(path0, "d", "M0 0l115 115h15l12 27 108 108V0z");
    			attr_dev(path0, "fill", "#fff");
    			add_location(path0, file, 2, 4, 204);
    			attr_dev(path1, "class", "octo-arm svelte-mz8sa2");
    			attr_dev(path1, "d", "M128 109c-15-9-9-19-9-19 3-7 2-11 2-11-1-7 3-2 3-2 4 5 2 11 2 11-3 10 5 15 9 16");
    			set_style(path1, "-webkit-transform-origin", "130px 106px");
    			set_style(path1, "transform-origin", "130px 106px");
    			add_location(path1, file, 3, 4, 278);
    			attr_dev(path2, "class", "octo-body svelte-mz8sa2");
    			attr_dev(path2, "d", "M115 115s4 2 5 0l14-14c3-2 6-3 8-3-8-11-15-24 2-41 5-5 10-7 16-7 1-2 3-7 12-11 0 0 5 3 7 16 4 2 8 5 12 9s7 8 9 12c14 3 17 7 17 7-4 8-9 11-11 11 0 6-2 11-7 16-16 16-30 10-41 2 0 3-1 7-5 11l-12 11c-1 1 1 5 1 5z");
    			add_location(path2, file, 4, 4, 469);
    			attr_dev(svg, "id", "github");
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "width", "80");
    			attr_dev(svg, "height", "80");
    			attr_dev(svg, "viewBox", "0 0 250 250");
    			attr_dev(svg, "fill", "#151513");
    			attr_dev(svg, "class", "svelte-mz8sa2");
    			add_location(svg, file, 1, 2, 85);
    			attr_dev(a, "class", "github");
    			attr_dev(a, "href", "https://github.com/agoblinking/earthrock");
    			attr_dev(a, "target", "_new");
    			add_location(a, file, 0, 1, 1);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);
    			append_dev(a, svg);
    			append_dev(svg, path0);
    			append_dev(svg, path1);
    			append_dev(svg, path2);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
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

    function instance($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Github> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Github", $$slots, []);
    	return [];
    }

    class Github extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Github",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    // Stores are observables
    class Store  {
    	
    	

    	constructor(value) {
    		this.value = value;
    	}

    	notify () {
    		if (!this.listeners) return
    		this.listeners.forEach((listener) => listener(this.value));
    	}

    	subscribe (listener) {
    		return this.listen(listener)
    	}

    	listen (listener, no_initial = false)  { 
    		if (!this.listeners) this.listeners = new Set();

    		this.listeners.add(listener);
    		
    		if (!no_initial) listener(this.get());

    		return () => this.listeners.delete(listener)
    	}

    	get ()  { return this.value }
    	
    	set (value, silent = false) {
    		this.value = value;
    		if(silent) return
    		
    		this.notify();
    	}

    	update (updator) {
    		this.set(updator(this.value));
    	}

    	toJSON ()  {
    		switch (typeof this.value) {
    		case `undefined`:
    		case `number`:
    		case `string`:
    			return this.value 

    		case `object`:
    			if(Set.prototype.isPrototypeOf(this.value)) {
    				return Array.from(this.value)
    			}

    			if (
    				Array.isArray(this.value) ||
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
    }

    class Read extends Store {
        constructor(value, setter) {
            super(value);

            if(setter) setter(Store.prototype.set.bind(this));
        }

         p_set(value, silent = false) {
            super.set(value, silent);
        }

        set(value, silent = false) {
            return
        }
    }

    const void_fn = () => {};

    var EGrok; (function (EGrok) {
    	const ADD = 0; EGrok[EGrok["ADD"] = ADD] = "ADD";
    	const REMOVE = ADD + 1; EGrok[EGrok["REMOVE"] = REMOVE] = "REMOVE";
    	const UPDATE = REMOVE + 1; EGrok[EGrok["UPDATE"] = UPDATE] = "UPDATE";
    	// living
    	const START = UPDATE + 1; EGrok[EGrok["START"] = START] = "START";
    	const STOP = START + 1; EGrok[EGrok["STOP"] = STOP] = "STOP";
    	// weave
    	const THREAD = STOP + 1; EGrok[EGrok["THREAD"] = THREAD] = "THREAD";
    	const UNTHREAD = THREAD + 1; EGrok[EGrok["UNTHREAD"] = UNTHREAD] = "UNTHREAD";
    })(EGrok || (EGrok = {}));



















    class Tree extends Read {
    	
    	
    	

    	constructor(tree = {}, setter) {
    		super({}, setter);

    		this.add(tree);
    	}

    	groke(action, path, value) {
    		if (!this.grokers) return

    		for (let grok of Array.from(this.grokers)) {
    			grok(action, path, value);
    		}

    		switch (action) {
    			case EGrok.ADD:
    				const val = this.query(...path.split('/'));
    				this.groke_cancels[path] = val.grok
    					? val.grok((s_action, s_path, s_value) => {
    							for (let grok of Array.from(this.grokers)) {
    								grok(s_action, `${path}/${s_path}`, s_value);
    							}
    					  })
    					: val.listen
    					? val.listen(($val) => {
    							this.groke(EGrok.UPDATE, path, $val);
    					  })
    					: this.groke(EGrok.UPDATE, path, val);

    				break
    			case EGrok.REMOVE:
    				this.groke_cancels[path]();
    				delete this.groke_cancels[path];
    				break
    		}

    		return void_fn
    	}

    	has(name) {
    		return this.query(name) !== undefined
    	}

    	add(tree_json, silent = false) {
    		const $tree = this.get();

    		for (let [key, value] of Object.entries(tree_json)) {
    			const is_store = value && value.get !== undefined;
    			const is_obj =
    				(Array.isArray(value) ||
    					['string', 'number', 'boolean'].indexOf(typeof value) !==
    						-1) === false;

    			const new_val = ($tree[key] = is_store
    				? value
    				: is_obj
    				? new Tree()
    				: new Store(value));

    			this.groke(EGrok.ADD, key, new_val.toJSON());
    		}

    		this.p_set($tree, silent);

    		return tree_json
    	}

    	remove(name, silent = false) {
    		delete this.value[name];
    		if (!silent) this.notify();

    		this.groke(EGrok.REMOVE, name);
    	}

    	query(...steps) {
    		const cursor = this.value[steps.shift()]; 

    		if (steps.length === 0 || !cursor) return cursor
    		return cursor.query(...steps)
    	}

    	count() {
    		return Object.keys(this.get()).length
    	}

    	groker(action, path, value) {
    		const split = path.split('/');
    		const item =
    			split.length === 1 ? this : this.query(...split.slice(0, -1));

    		const key = split[split.length - 1];

    		switch (action) {
    			case EGrok.ADD:
    				item.add({
    					[key]: value,
    				});
    				break
    			case EGrok.REMOVE:
    				item.remove(key);
    				break
    			case EGrok.UPDATE:
    				if (split.length === 1) {
    					item.set(value);
    				} else {
    					item.query(key).set(value);
    				}
    		}
    	}

    	grok(groker) {
    		if (this.grokers === undefined) {
    			this.grokers = new Set([groker]);
    			this.groke_cancels = {};

    			for (let [key, value] of Object.entries(this.get())) {
    				const $v = value; 
    				this.groke(EGrok.ADD, key, $v.toJSON ? $v.toJSON() : value);
    			}
    		} else {
    			this.grokers.add(groker);
    			for (let [key, value] of Object.entries(this.get())) {
    				const $v = value; 
    				groker(EGrok.ADD, key, $v.toJSON ? $v.toJSON() : value);
    			}
    		}

    		return () => {
    			this.grokers.delete(groker);
    			if (this.grokers.size !== 0) return

    			delete this.grokers;
    			for (let cancel of Object.values(this.groke_cancels)) {
    				cancel();
    			}

    			delete this.groke_cancels;
    		}
    	}
    }

    class Proxy {
    	

    	get() {
    		return this.value.get()
    	}

    	listen(listen) {
    		return this.value.listen(listen)
    	}

    	set(value, silent = false) {
    		this.value.set(value, silent);
    	}

    	toJSON() {
    		return this.value.toJSON()
    	}

    	notify() {
    		this.value.notify();
    	}

    	subscribe(listen) {
    		return this.listen(listen)
    	}
    }

    class ProxyTree extends Proxy
     {
    	

    	add(tree_write, silent) {
    		return this.value.add(tree_write, silent)
    	}

    	remove(name, silent) {
    		this.value.remove(name, silent);
    	}

    	query(...steps) {
    		return this.value.query(...steps)
    	}

    	has(name) {
    		return this.query(name) !== undefined
    	}

    	grok(groker) {
    		return this.value.grok(groker)
    	}

    	groker(action, key, value) {
    		return this.value.groker(action, key, value)
    	}

    	groke(action, key, value) {
    		return this.value.groke(action, key, value)
    	}
    }

    class BufferValue extends Store {
        set (value, silent = false) {
            this.get().set(value);
            if(silent === false) this.notify();
        }
    }

    class Buffer extends Tree {
        
        
        
        

         create_data (size) {
            const data = {};
            
            for(let key of Object.keys(this.defaults)) {
                data[key] = new Float32Array(this.defaults[key].length * size);

                // copy existing data
                if(this.value && Object.keys(this.value).length > 0) {
                    data[key].set(this.value[key]);
                }
            }
            
            if(this.available) {
                const additions = Array.from(Array(size - this.count).keys()).map(i => i + this.count);
                this.available = new Set([...Array.from(this.available), ...additions]);
            } else {
                this.available = new Set(Array(size).keys());
            }

            this.value = data;
            this.count = size;
        }

        constructor (defaults, initial_size = 100) {
            super();

            this.defaults = defaults;
            this.create_data(initial_size);
        }
        
        allocates (...data)  {
            const results = [];
            for(let datum of data) {
                results.push(this.allocate(datum));
            }

            return results
        }

        allocate (datum)  {
            const buffer_view = {};
            let cursor = this.available.values().next().value;
            if(cursor === undefined) {
                this.resize();
                cursor = this.available.values().next().value;
            }

            this.available.delete(cursor);

            for(let key of Object.keys(this.defaults)) {
                const len = this.defaults[key].length;
                const idx = cursor * len; 
                const view = this.value[key].subarray(idx, idx + len);

                view.set(datum[key] ? datum[key] : this.defaults[key]);

                buffer_view[key] = new BufferValue(view);
            }

            return [buffer_view, cursor]
        }

        free (idx) {
            this.available.add(idx);

            for(let key of Object.keys(this.defaults)) {    
                const len = this.defaults[key].length;
                this.value[key].set(Array(len).fill(0), len * idx);
            }
        }

        resize (size) {
            if(size === undefined) size = this.count * 2;
            if(size < this.count) throw new Error("cannot reduce the size of a buffer")

            this.create_data(size);
            this.notify();
        }

        hydrate (data) {
            for(let key of Object.keys(this.value)) {
                this.value[key].set(data[key]);
            }

            this.notify();
        }

        toJSON ()  {
            const json = {};
            for(let key of Object.keys(this.value)) {
                json[key] = this.value[key];
            }

            return json
        }
    }

    var ELivingAction; (function (ELivingAction) {
    	const CREATE = 'create'; ELivingAction["CREATE"] = CREATE;
    	const REZ = 'rez'; ELivingAction["REZ"] = REZ;
    	const DEREZ = 'derez'; ELivingAction["DEREZ"] = DEREZ;
    	const DESTROY = 'destroy'; ELivingAction["DESTROY"] = DESTROY;
    })(ELivingAction || (ELivingAction = {}));

    var ELivingStatus; (function (ELivingStatus) {
    	const VOID = 'VOID'; ELivingStatus["VOID"] = VOID;
    	const CREATED = 'CREATED'; ELivingStatus["CREATED"] = CREATED;
    	const REZED = 'REZED'; ELivingStatus["REZED"] = REZED;
    })(ELivingStatus || (ELivingStatus = {}));

    class Living extends ProxyTree {constructor(...args) { super(...args); Living.prototype.__init.call(this); }
    	
    	 __init() {this.status = new Store(ELivingStatus.VOID);}
    	
    	add(living_data, silent = false) {
    		// when adding check to see if they have rezed/value
    		// if they do its a living
    		super.add(living_data, silent);
    		const $status = this.status.get();
    		const items = Object.entries(living_data);

    		switch ($status) {
    			case ELivingStatus.CREATED:
    				for (let [_, item] of items) {
    					item.create && item.create();
    				}

    			case ELivingStatus.REZED:
    				const $rezed = this.rezed && this.rezed.get();

    				// create doesn't auto rez
    				// so you can batch creates together then rez
    				for (let [name, item] of items) {
    					if ($rezed && !$rezed[name]) continue
    					item.rez && item.rez();
    				}
    		}
    	}

    	remove(name, silent = false) {
    		const $value = this.get(); 

    		if ($value[name] && $value[name].destroy) {
    			$value[name].destroy();
    		}

    		const $rezed = this.rezed && this.rezed.get();
    		if ($rezed) {
    			$rezed.delete(name);
    		}

    		super.remove(name, silent);
    	}

    	removes(...names) {
    		for (let name of names) {
    			this.remove(name, true);
    		}

    		this.notify();
    	}

    	create() {
    		if (this.status.get() !== ELivingStatus.VOID) {
    			throw new Error('Tried to create a nonvoid living class')
    		}

    		// run through my tree to guarantee its destroyed
    		let sub;
    		for (sub of Object.values(this.get())) {
    			sub.create && sub.create();
    		}

    		this.status.set(ELivingStatus.CREATED);
    	}

    	destroy() {
    		if (this.status.get() === ELivingStatus.REZED) {
    			this.derez();
    		}

    		let sub;
    		for (sub of Object.values(this.get())) {
    			sub.destroy && sub.destroy();
    		}

    		this.status.set(ELivingStatus.VOID);
    	}

    	rez() {
    		if (this.status.get() === ELivingStatus.VOID) {
    			this.create();
    		}

    		const rezed = this.rezed && this.rezed.get();

    		for (let [name, sub] of Object.entries(this.get())) {
    			if (rezed && !rezed.has(name)) continue
    			;(sub ).rez && (sub ).rez();
    		}

    		this.status.set(ELivingStatus.REZED);
    	}

    	derez() {
    		if (this.status.get() !== ELivingStatus.REZED) {
    			return
    		}

    		const $rezed = this.rezed && this.rezed.get();

    		for (let [name, sub] of Object.entries(this.get())) {
    			if ($rezed && !$rezed.has(name)) continue
    			;(sub ).derez && (sub ).derez();
    		}

    		this.status.set(ELivingStatus.CREATED);
    	}

    	start(...names) {
    		const $rezed = this.rezed && this.rezed.get();

    		for (let name of names) {
    			const item = this.query(name);

    			if (!item) continue

    			// can only rez if I am
    			if (this.status.get() === ELivingStatus.REZED) {
     (item ).rez && (item ).rez();
    			}

    			if ($rezed) {
    				$rezed.add(name);
    				this.rezed.notify();
    			}

    			this.groke(EGrok.START, name);
    		}
    	}

    	stop(...names) {
    		const $rezed = this.rezed && this.rezed.get();
    		for (let name of names) {
    			const item = this.query(name);
    			if (!item) continue // can derez whenever though

    			;(item ).derez && (item ).derez();

    			if (!$rezed) continue

    			$rezed.delete(name);
    			this.groke(EGrok.STOP, name);
    		}

    		this.rezed.notify();
    	}

    	restart(name) {
    		this.stop(name);
    		this.start(name);
    	}

    	serialize() {
    		return {
    			value: this.toJSON(),
    			rezed: this.rezed ? this.rezed.toJSON() : undefined
    		}
    	}

    	ensure(first, ...path) {
    		let $item = this.query(first);

    		if ($item === undefined) {
    			this.add({
    				[first]: {}
    			});

    			$item = this.query(first);
    		}

    		if (path.length === 0) return $item

    		if ($item instanceof Living) {
    			return $item.ensure(path[0], ...path.slice(1))
    		}

    		throw new Error('tried to ensure non living item')
    	}
    	
    	groker(action, path, value) {
    		const parts = path.split("/");
    		const target = parts.length === 1 
    			? this
    			: this.query(...parts.slice(0, -1));
    		
    		const key = path[path.length - 1];

    		// path can be tiered, split it out and start based on parent
    		switch (action) {
    			case EGrok.START:
    				target.start && target.start(key);
    				break
    			case EGrok.STOP:
    				target.stop && target.stop(key);
    				break
    			default:
    				super.groker(action, key, value);
    		}
    	}
    	
    	grok(groker) {
    		const cancel = super.grok(groker);
    		if (this.rezed !== undefined) {
    			for (let key of Array.from(this.rezed.get())) {
    				groker(EGrok.START, key);
    			}
    		}
    		return cancel
    	}
    }

    class Transformer extends Store {
        

        constructor(initial, transformer) {
            super(transformer(initial));
            this.transformer = transformer;
        }
        
        set (value) {
            super.set(this.transformer(value));
        }
    }

    var EWarp; (function (EWarp) {
    	const SPACE = 'SPACE'; EWarp["SPACE"] = SPACE;
    	const MATH = 'MATH'; EWarp["MATH"] = MATH;
    	const VALUE = 'VALUE'; EWarp["VALUE"] = VALUE;
    	const MAIL = 'MAIL'; EWarp["MAIL"] = MAIL;
    })(EWarp || (EWarp = {}));

    class Warp extends Living {
    	
    	

    	
    	

    	constructor(weave, name) {
    		super();

    		this.name = name;
    		this.weave = weave;
    	}
    }

    var ETwist; (function (ETwist) {
    	const VISIBLE = 'VISIBLE'; ETwist["VISIBLE"] = VISIBLE;
    	const PHYSICAL = 'PHYSICAL'; ETwist["PHYSICAL"] = PHYSICAL;
    	const DATA = 'DATA'; ETwist["DATA"] = DATA;
    })(ETwist || (ETwist = {}));





    class Twist extends Living {
    	
    	
    	

    	constructor(weave, space) {
    		super();

    		this.space = space;
    		this.weave = weave;

    		this.value = new Tree();
    	}

    	add(data, silent = false) {
    		const write = {};
    		for (let [name, value] of Object.entries(data)) {
    			if (value instanceof Store) {
    				write[name] = value;
    			} else {
    				write[name] = new Store(value);
    			}
    		}

    		super.add(write, silent);
    	}

    	toJSON() {
    		return this.value.toJSON()
    	}
    }

    // Visible spaces
    class Visible extends Twist { 
        static __initStatic() {this.defaults = { 
            position: [0, 0, 0],
            sprite: [0],
            scale: [1],
            color: [255, 255, 255, 1],
            rotation: [0]
        };}

        static __initStatic2() {this.data = new Buffer(Visible.defaults);}

        

        constructor(weave, space, visible_data) {
            // set the views
            super(weave, space);
            const [view, idx] = Visible.data.allocate(visible_data);
            this.index = idx;
            this.add(view);
        }

        toJSON() {
            const json = {};
            const $value = this.get();
            for(let key of Object.keys($value)) {
                const $item = $value[key].get();

                json[key] = Array.from($item);
            }

            return json
        }
    } Visible.__initStatic(); Visible.__initStatic2();

    class Data extends Twist  {
        constructor(weave,  space, data) {
            super(weave, space);
            this.add(data);
        }
    }

    class Physical extends Twist {
        constructor(weave, space, physical_data = {}) {
            super(weave, space);
            this.add(physical_data);
        }
    }

    class Space extends Warp {
    	constructor(warp_data, weave, name) {
    		super(weave, name);
    		this.value = new Tree();

    		if (warp_data !== undefined) this.add(warp_data);
    	}

    	add(data) {
    		const adds = {};

    		for (let [type, value] of Object.entries(data)) {
    			adds[type] = this.create_twist(type, value);
    		}

    		super.add(adds);
    	}

    	 create_twist(
    		type,
    		twist_data = {}
    	) {
    		switch (type) {
    			case ETwist.DATA:
    				return new Data(this.weave, this, twist_data)
    			case ETwist.VISIBLE:
    				return new Visible(this.weave, this, twist_data )
    			case ETwist.PHYSICAL:
    				return new Physical(this.weave, this, twist_data )
    		}

    		return new Store(twist_data)
    	}

    	create() {
    		super.create();
    		this.weave.spaces.add({ [this.name]: this });
    	}

    	destroy() {
    		super.destroy();
    		this.weave.spaces.remove(this.name);
    	}
    }

    class Weave extends Living {
    	
    	
    	 __init() {this.value = new Tree({});}

    	// caches
    	
    	 __init2() {this.spaces = new Tree({});}

    	// clean up
    	  __init3() {this.cancels = new Set();}
    	
    	 __init4() {this.nerves = {};}

    	create_warp($warp, name) {
    		const [type] = name.split('_');

    		switch (type) {
    			case EWarp.SPACE:
    				return new Space($warp, this, name)
    			case EWarp.MAIL:
    			case EWarp.VALUE:
    			case EWarp.MATH:
    				throw new Error('unsupported')
    			default:
    				return new Space($warp, this, name)
    		}
    	}

    	constructor(data) {
    		super();Weave.prototype.__init.call(this);Weave.prototype.__init2.call(this);Weave.prototype.__init3.call(this);Weave.prototype.__init4.call(this);

    		if (data.name === undefined) {
    			throw new Error('Undefined name for weave')
    		}

    		this.name = data.name;
    		this.threads = new Tree(data.thread || {});
    		this.rezed = new Store(new Set(data.rezed || []));

    		this.threads_reverse = new Tree({}, (set) => {
    			this.cancels.add(
    				this.threads.listen(($threads) => {
    					const w_r = {};
    					for (let key of Object.keys($threads)) {
    						w_r[$threads[key]] = key;
    					}

    					set(w_r);
    				})
    			);
    		});

    		this.add(data.value || {});
    	}

    	add(warp_data, silent = false) {
    		if (!warp_data) return
    		const warps = {};

    		for (let [name, warp] of Object.entries(warp_data)) {
    			if (warp instanceof Warp) {
    				warps[name] = warp;
    				continue
    			}

    			warps[name] = this.create_warp(warp, name);
    		}

    		super.add(warps, silent);

    		return warps
    	}

    	rez() {
    		super.rez();

    		// connect threads to form nerves
    		this.thread_cancel = this.threads.listen(this.thread_update.bind(this));
    	}

    	thread_update($threads) {
    		for (let [name, cancel] of Object.entries(this.nerves)) {
    			if ($threads[name]) {
    				delete $threads[name];
    				continue
    			}

    			cancel();
    			delete this.nerves[name];
    		}

    		for (let [from, to] of Object.entries($threads)) {
    			const f = this.query(...from.split('/'));
    			const t = this.query(...to.split('/'));
    			if (!f || !t) continue
    			this.nerves[from] = f.listen(t.set.bind(t));
    		}
    	}

    	derez() {
    		super.derez();

    		for (let cancel of Object.values(this.nerves)) {
    			cancel();
    		}

    		this.thread_cancel();
    	}

    	removes(...names) {
    		const $warps = this.value.get();
    		const $wefts = this.threads.get();
    		const $wefts_r = this.threads_reverse.get();
    		const $rezed = this.rezed.get();

    		for (let name of names) {
    			const warp = $warps[name];
    			if (warp) warp.destroy();

    			delete $warps[name];
    			delete $wefts[name];
    			$rezed.delete(name);

    			const r = $wefts_r[name];
    			if (r) {
    				delete $wefts[r];
    			}
    		}

    		this.value.set($warps);
    		this.threads.set($wefts);
    		this.rezed.set($rezed);
    	}

    	remove(name) {
    		this.removes(name);
    	}

    	destroy() {
    		super.destroy();

    		for (let cancel of Array.from(this.cancels)) {
    			cancel();
    		}

    		this.cancels.clear();
    	}

    	serialize() {
    		return {
    			name: this.name,
    			thread: this.threads.toJSON(),

    			value: this.value.toJSON(),
    			rezed: this.rezed.toJSON(),
    		}
    	}

    	// TODO: custom grok/groker that provides thread updates
    }

    class Wheel extends Living {
    	 __init() {this.value = new Tree({
    		sys: new Weave({
    			name: `sys`,
    			thread: {},
    			value: {},
    			rezed: []
    		})
    	});}

    	constructor(wheel_data) {
    		super();Wheel.prototype.__init.call(this);

    		this.rezed = new Store(new Set(wheel_data.rezed));

    		this.add(wheel_data.value);
    	}

    	add(weaves, silent = false) {
    		const write = {};

    		for (let [name, value] of Object.entries(weaves)) {
    			if (value instanceof Weave) {
    				write[name] = value;
    				continue
    			}

    			value.name = name;
    			write[name] = new Weave(value);
    		}

    		super.add(write, silent);
    	}
    }

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    function createCommonjsModule(fn, module) {
    	return module = { exports: {} }, fn(module, module.exports), module.exports;
    }

    var performanceNow = createCommonjsModule(function (module) {
    // Generated by CoffeeScript 1.12.2
    (function() {
      var getNanoSeconds, hrtime, loadTime, moduleLoadTime, nodeLoadTime, upTime;

      if ((typeof performance !== "undefined" && performance !== null) && performance.now) {
        module.exports = function() {
          return performance.now();
        };
      } else if ((typeof process !== "undefined" && process !== null) && process.hrtime) {
        module.exports = function() {
          return (getNanoSeconds() - nodeLoadTime) / 1e6;
        };
        hrtime = process.hrtime;
        getNanoSeconds = function() {
          var hr;
          hr = hrtime();
          return hr[0] * 1e9 + hr[1];
        };
        moduleLoadTime = getNanoSeconds();
        upTime = process.uptime() * 1e9;
        nodeLoadTime = moduleLoadTime - upTime;
      } else if (Date.now) {
        module.exports = function() {
          return Date.now() - loadTime;
        };
        loadTime = Date.now();
      } else {
        module.exports = function() {
          return new Date().getTime() - loadTime;
        };
        loadTime = new Date().getTime();
      }

    }).call(commonjsGlobal);

    //# sourceMappingURL=performance-now.js.map
    });

    var root = typeof window === 'undefined' ? commonjsGlobal : window
      , vendors = ['moz', 'webkit']
      , suffix = 'AnimationFrame'
      , raf = root['request' + suffix]
      , caf = root['cancel' + suffix] || root['cancelRequest' + suffix];

    for(var i = 0; !raf && i < vendors.length; i++) {
      raf = root[vendors[i] + 'Request' + suffix];
      caf = root[vendors[i] + 'Cancel' + suffix]
          || root[vendors[i] + 'CancelRequest' + suffix];
    }

    // Some versions of FF have rAF but not cAF
    if(!raf || !caf) {
      var last = 0
        , id = 0
        , queue = []
        , frameDuration = 1000 / 60;

      raf = function(callback) {
        if(queue.length === 0) {
          var _now = performanceNow()
            , next = Math.max(0, frameDuration - (_now - last));
          last = next + _now;
          setTimeout(function() {
            var cp = queue.slice(0);
            // Clear queue here to prevent
            // callbacks from appending listeners
            // to the current frame's queue
            queue.length = 0;
            for(var i = 0; i < cp.length; i++) {
              if(!cp[i].cancelled) {
                try{
                  cp[i].callback(last);
                } catch(e) {
                  setTimeout(function() { throw e }, 0);
                }
              }
            }
          }, Math.round(next));
        }
        queue.push({
          handle: ++id,
          callback: callback,
          cancelled: false
        });
        return id
      };

      caf = function(handle) {
        for(var i = 0; i < queue.length; i++) {
          if(queue[i].handle === handle) {
            queue[i].cancelled = true;
          }
        }
      };
    }

    var raf_1 = function(fn) {
      // Wrap in a new function to prevent
      // `cancel` potentially being assigned
      // to the native rAF function
      return raf.call(root, fn)
    };
    var cancel = function() {
      caf.apply(root, arguments);
    };
    var polyfill = function(object) {
      if (!object) {
        object = root;
      }
      object.requestAnimationFrame = raf;
      object.cancelAnimationFrame = caf;
    };
    raf_1.cancel = cancel;
    raf_1.polyfill = polyfill;

    class Messenger  {
    	

    	onmessage(event) {
    		const msg = event.data;
    		const fn = `msg_${msg.name}`;
    		if (this[fn]) this[fn](msg.data);
    	}

    	postMessage(message) {
    		this.remote.onmessage({ data: message });
    	}
    }

    class RemoteGoblin extends Messenger {
    	 __init() {this.wheel = new Wheel({
    		rezed: [],
    		value: {}
    	});}
    	
    	
    	constructor(remote) {
    		super();RemoteGoblin.prototype.__init.call(this);
    		this.remote = remote;

    		raf_1(() => {
    			this.postMessage({
    				name: 'ready'
    			});
    		});
    	}

    	 tick() {
    		raf_1(() => {
    			this.postMessage({
    				name: 'buffer',
    				data: {
    					VISIBLE: Visible.data.toJSON()
    				}
    			});
    		});
    	}

    	 msg_toJSON() {
    		this.postMessage({
    			name: 'toJSON',
    			data: this.wheel.toJSON()
    		});
    	}

    	 msg_add(data) {
    		if (data.value) this.wheel.add(data.value);

    		if (data.rezed === undefined) return

    		for (const name of data.rezed) {
    			this.wheel.start(name);
    		}
    	}

    	 msg_status(data) {
    		this.wheel[data]();
    		if (data !== ELivingAction.DESTROY) return

    		this.postMessage({
    			name: 'destroy'
    		});
    	}

    	 msg_start(data) {
    		this.wheel.start(data);
    	}

    	 msg_stop(data) {
    		this.wheel.stop(data);
    	}

    	 msg_update(data) {
    		this.wheel.ensure(data.path[0], ...data.path.slice(1)).set(data.value);
    	}

    	 msg_relay() {
    		if (this.timeout) this.timeout();
    		this.timeout = this.wheel
    			.query('sys', 'time', 'tick')
    			.listen(this.tick.bind(this));
    	}

    	 msg_grok() {
    		if (this.cancel_grok) return
    		this.cancel_grok = this.wheel.grok(
    			(action, key, value) => {
    				this.postMessage({
    					name: 'groker',
    					data: {
    						action,
    						key,
    						value
    					}
    				});
    			}
    		);
    	}

    	 msg_grok_stop() {
    		if (!this.cancel_grok) return
    		this.cancel_grok();
    	}
    }

    class LocalWorker extends Messenger  {constructor(...args) { super(...args); LocalWorker.prototype.__init.call(this); }
    	 __init() {this.remote = new RemoteGoblin(this);}

    	terminate() {
    		// okay
    	}

    	onerror(ev) {
    		// okay
    	}
    }

    class Goblin extends Living {
    	// this could use sharedmemory but not everyone supports it
    	__init2() {this.buffer = new Tree({
    		VISIBLE: Visible.data
    	});}

    	// convert to an inactive wheel
    	__init3() {this.value = new Wheel({
    		value: {},
    		rezed: []
    	});}

    	
    	
    	 __init4() {this.sys_cancels = {};}
    	
    	
    	

    	 __init5() {this.json_resolvers = [];}

    	constructor(sys, local = false) {
    		super();Goblin.prototype.__init2.call(this);Goblin.prototype.__init3.call(this);Goblin.prototype.__init4.call(this);Goblin.prototype.__init5.call(this);Goblin.prototype.__init6.call(this);

    		// doesn't guarantee syncing
    		this.sys = sys;
    		this.local = local;
    		this.grokers = new Set();
    		this.value.stop();
    	}

    	create() {
    		this.worker = this.local
    			? new LocalWorker()
    			: new Worker(`/bin/goblin.bundle.js`);

    		this.worker.onmessage = this.onmessage.bind(this);
    		this.worker.onerror = this.onerror.bind(this);

    		this.worker.postMessage({
    			name: 'status',
    			data: ELivingAction.CREATE
    		});
    	}

    	rez() {
    		this.sys_cancel = this.sys.listen(this.sys_update.bind(this));

    		this.worker.postMessage({
    			name: 'status',
    			data: ELivingAction.REZ
    		});
    	}

    	derez() {
    		for (let cancel of Object.values(this.sys_cancels)) {
    			cancel();
    		}

    		this.sys_cancel();

    		this.worker.postMessage({
    			name: 'status',
    			data: ELivingAction.DEREZ
    		});
    	}

    	destroy() {
    		this.worker.postMessage({
    			name: 'status',
    			data: ELivingAction.DESTROY
    		});

    		if (this.grokers.size > 0) {
    			this.worker.postMessage({
    				name: 'grok_stop'
    			});

    			this.grokers.clear();
    		}
    	}

    	// replicate system changes into the worker
    	 sys_update($sys) {
    		// this should happen very rarely
    		for (let cancel of Object.values(this.sys_cancels)) {
    			cancel();
    		}

    		this.sys_cancels = {};

    		for (let [name, category] of Object.entries($sys)) {
    			this.sys_cancels[name] = category.listen($category => {
    				for (let [key, store] of Object.entries($category)) {
    					this.sys_cancels[`${name}/${key}`] = store.listen(
    						$store => {
    							this.worker.postMessage({
    								name: 'update',
    								data: {
    									path: [`sys`, name, key],
    									value: $store
    								}
    							});
    						}
    					);
    				}
    			});
    		}
    	}

    	 msg_destroy() {
    		this.worker.terminate();
    	}

    	 msg_groker({ action, key, value }) {
    		// hydrate self
    		this.value.groker(action, key, value);
    	}

    	 msg_toJSON(json) {
    		for (let resolve of this.json_resolvers) {
    			resolve(json);
    		}
    	}

    	 msg_buffer(data) {
    		for (let [name, buffer] of Object.entries(data)) {
    			const buff = this.buffer.query(name);

    			if (buff === undefined) return
    			buff.hydrate(buffer);
    		}

    		this.buffer.notify();
    	}

    	 msg_ready() {
    		this.worker.postMessage({
    			name: 'relay'
    		});
    	}

    	 __init6() {this.onmessage = Messenger.prototype.onmessage;}

    	 onerror(event) {
    		console.error(`Worker Error`, event);
    	}

    	async remote_toJSON() {
    		return new Promise(resolve => {
    			this.json_resolvers.push(resolve);

    			if (this.json_resolvers.length !== 1) return

    			this.worker.postMessage({
    				name: 'toJSON'
    			});
    		})
    	}

    	add(data) {
    		this.worker.postMessage({
    			name: 'add',
    			data
    		});
    	}

    	start(data) {
    		this.worker.postMessage({
    			name: 'start',
    			data
    		});
    	}

    	stop(data) {
    		this.worker.postMessage({
    			name: 'stop',
    			data
    		});
    	}

    	remote_grok() {
    		if (this.grokers.size === 0) {
    			this.worker.postMessage({
    				name: 'grok'
    			});
    		}
    		const groker = this.groker.bind(this);

    		this.grokers.add(groker);

    		return () => {
    			this.grokers.delete(groker);

    			if (this.grokers.size === 0) {
    				this.worker.postMessage({
    					name: 'grok_stop'
    				});
    			}
    		}
    	}
    }

    /* src\client\Weave.svelte generated by Svelte v3.20.1 */
    const file$1 = "src\\client\\Weave.svelte";

    function create_fragment$1(ctx) {
    	let div;
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text(/*name*/ ctx[0]);
    			attr_dev(div, "class", "weave svelte-twsg0x");
    			add_location(div, file$1, 6, 0, 139);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*name*/ 1) set_data_dev(t, /*name*/ ctx[0]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
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
    	let { goblin } = $$props;
    	let { weave } = $$props;
    	let { name } = $$props;
    	const writable_props = ["goblin", "weave", "name"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Weave> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Weave", $$slots, []);

    	$$self.$set = $$props => {
    		if ("goblin" in $$props) $$invalidate(1, goblin = $$props.goblin);
    		if ("weave" in $$props) $$invalidate(2, weave = $$props.weave);
    		if ("name" in $$props) $$invalidate(0, name = $$props.name);
    	};

    	$$self.$capture_state = () => ({ Goblin, goblin, weave, name });

    	$$self.$inject_state = $$props => {
    		if ("goblin" in $$props) $$invalidate(1, goblin = $$props.goblin);
    		if ("weave" in $$props) $$invalidate(2, weave = $$props.weave);
    		if ("name" in $$props) $$invalidate(0, name = $$props.name);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [name, goblin, weave];
    }

    class Weave$1 extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { goblin: 1, weave: 2, name: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Weave",
    			options,
    			id: create_fragment$1.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*goblin*/ ctx[1] === undefined && !("goblin" in props)) {
    			console.warn("<Weave> was created without expected prop 'goblin'");
    		}

    		if (/*weave*/ ctx[2] === undefined && !("weave" in props)) {
    			console.warn("<Weave> was created without expected prop 'weave'");
    		}

    		if (/*name*/ ctx[0] === undefined && !("name" in props)) {
    			console.warn("<Weave> was created without expected prop 'name'");
    		}
    	}

    	get goblin() {
    		throw new Error("<Weave>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set goblin(value) {
    		throw new Error("<Weave>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get weave() {
    		throw new Error("<Weave>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set weave(value) {
    		throw new Error("<Weave>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get name() {
    		throw new Error("<Weave>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<Weave>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    // Starts up in the main thread
    class Isekai extends Living {
    	 __init() {this.goblins = new Tree();}
    	 __init2() {this.value = this.goblins;}

    	 __init3() {this.sys = new Tree();}
    	 __init4() {this.local = new Store(false);}

    	constructor(sys, local = false) {
    		super();Isekai.prototype.__init.call(this);Isekai.prototype.__init2.call(this);Isekai.prototype.__init3.call(this);Isekai.prototype.__init4.call(this);
    		this.local.set(local);

    		const write = {};
    		for (let [name, value] of Object.entries(sys)) {
    			write[name] = new Tree(value);
    		}

    		this.sys.add(write);

    		// Check Path
    		// Check Database
    		this.create();
    		this.rez();
    	}

    	add(wheels) {
    		const write = {};

    		for (let [name, wheel_json] of Object.entries(wheels)) {
    			const worker = (write[name] = new Goblin(
    				this.sys,
    				this.local.get()
    			));

    			worker.create();
    			worker.add(wheel_json);
    		}

    		super.add(write);
    	}
    }

    const position = new Read([0, 0], set => window
    	.addEventListener(`mousemove`, ({ clientX, clientY }) => set([clientX, clientY]))
    );

    const scroll = new Read([0, 0, 0], set => window
    	.addEventListener(`wheel`, (e) => {
    		set([-e.deltaX, -e.deltaY, 0]);
    	})
    );

    var mouse = /*#__PURE__*/Object.freeze({
        __proto__: null,
        position: position,
        scroll: scroll
    });

    const size = new Read([window.innerWidth, window.innerHeight], (set) => {
    	window.addEventListener(`resize`, () => {
    		set([window.innerWidth, window.innerHeight]);
    	});
    });

    const scale = new Store(1);

    size.listen(([width, height]) => {
    	const target = width > height
    		? height
    		: width;

    	scale.set(target / 80);
    	window.document.documentElement.style.fontSize = `${Math.round(scale.get())}px`;
    });

    const clear_color = new Store([0, 0, 0, 1]);

    var screen = /*#__PURE__*/Object.freeze({
        __proto__: null,
        size: size,
        scale: scale,
        clear_color: clear_color
    });

    const key_virtual = new Store(``);

    const key = new Read(``, (set) => {
    	key_virtual.listen((k) => set(k));

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

    const keys = new Read({}, (set) => {
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

    var keyboard = /*#__PURE__*/Object.freeze({
        __proto__: null,
        key_virtual: key_virtual,
        key: key,
        keys: keys
    });

    let tick_set;
    const tick = new Read(0, (set) => {
    	tick_set = set;
    });

    let last_tick = Date.now();
    const TIME_TICK_RATE = new Store(100);

    const frame = new Read([0, 0], (set) => {
    	let old;
    	
    	const data = [0, 0];
    	const frame_t = (ts) => {
    		raf_1(frame_t);

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

    	raf_1(frame_t);
    });

    var time = /*#__PURE__*/Object.freeze({
        __proto__: null,
        tick: tick,
        TIME_TICK_RATE: TIME_TICK_RATE
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
    const axes = new Read({}, (set) => {
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

    const button = new Read("", (set) => {
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

    const buttons = new Read({}, (set) => {
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

    // Collection of meta controllers

    const { length, add, mulScalar } = twgl_js.v3;

    document.addEventListener(`touchmove`, event => {
    	if (event.scale !== 1) { event.preventDefault(); }
    }, { passive: false });

    let lastTouchEnd = 0;
    document.addEventListener(`touchend`, event => {
    	const now = (new Date()).getTime();
    	if (now - lastTouchEnd <= 500) event.preventDefault();
    	lastTouchEnd = now;
    }, { passive: false });

    // input to replicate to remotes
    const button_map = {
    	home: ({ home }, { start }) => home || start,

    	left: ({ arrowleft, a }, { left }) => a || arrowleft || left,
    	right: ({ arrowright, d }, { right }) => d || arrowright || right,
    	up: ({ arrowup, tab, shift, w }, { up }) => arrowup || (tab && shift) || up || w,
    	down: ({ arrowdown, tab, shift, s }, { down }) => arrowdown || (tab && !shift) || down || s,
    	pagedown: ({ pagedown }, { righttrigger }) => pagedown || righttrigger,
    	pageup: ({ pageup, ' ': space, shift }, { rightshoulder }) => pageup || rightshoulder || (space && shift),

    	insert: ({ insert, '=': equal }, { x }) => insert || x || equal,
    	delete: ({ delete: del, backspace }, { y }) => del || y || backspace,
    	confirm: ({ enter }, { a }) => a || enter,
    	cancel: ({ end, escape }, { b }) => end || b || escape,
    	editor: ({ pause, tilde }, { select }) => tilde || pause || select,

    	undo: ({ control, z, backspace }) => (control && z) || backspace,
    	redo: ({ shift, control, z, backspace, redo }) => redo || (shift && control && z) || (shift && backspace)
    };

    const buttons$1 = new Read({}, (set) => {
    	const values = {};
    	tick.listen(() => {
    		const $keys = keys.get();
    		const $buttons = buttons.get();

    		Object.entries(button_map).forEach(([key, fn]) => {
    			values[key] = fn($keys, $buttons);
    		});

    		set(values);
    	});
    });

    const button$1 = new Read("", set => {
    	key.listen(set);
    });


    // raw translate commands
    const translate = new Read([0, 0, 0], (set) => {
    	const b_key = [0, 0, 0];
    	// frame stuff has to be fast :/
    	tick.listen(() => {
    		const { up, down, left, right } = buttons$1.get();

    		b_key[0] = 0;
    		b_key[1] = 0;
    		b_key[2] = 0;

    		if (up) b_key[1] -= 1;
    		if (down) b_key[1] += 1;
    		if (left) b_key[0] -= 1;
    		if (right) b_key[0] += 1;

    		if (length(b_key) === 0) return

    		set(b_key);
    	});
    });

    let scroll_velocity = [0, 0, 0];

    const scroll$1 = new Transformer([0,0], (data) => data.map((i) => Math.round(i)));

    scroll$1.set([0, 0, 0]);

    tick.listen(() => {
    	if (Math.abs(length(scroll_velocity)) < 1) return

    	scroll$1.set(add(
    		scroll$1.get(),
    		scroll_velocity
    	).map((n) => Math.round(n)));

    	scroll_velocity = mulScalar(
    		scroll_velocity,
    		0.25
    	);
    });

    scroll.listen((vel) => {
    	scroll_velocity = add(scroll_velocity, vel);
    });

    var input = /*#__PURE__*/Object.freeze({
        __proto__: null,
        buttons: buttons$1,
        button: button$1,
        translate: translate,
        scroll: scroll$1
    });

    const SPRITES = new Store(`/sheets/default_2.png`);
    const SPRITES_COLOR = new Store(`/sheets/default_2_color.png`);
    const IS_DEV = new Store(false);

    const SVELTE_ANIMATION = new Store({ delay: 100, duration: 300 });

    const TILE_COUNT = new Store(1024);
    const TILE_COLUMNS = new Store(32);

    const THEME_COLOR = new Store(`rgb(224, 168, 83)`);
    const THEME_BG = new Store(`#033`);
    const THEME_GLOW = new Store(`green`);

    const CURSOR = new Store(`/`);

    const THEME_BORDER = new Store(``, $value => Color($value)
    	.darkenByRatio(0.5)
    	.toCSS()
    );

    const THEME_STYLE = new Read(``, set => {
    	let $THEME_BORDER = ``;

    	const update = () => set([
    		`border: 0.2rem solid ${$THEME_BORDER};`
    	].join(``));

    	THEME_BORDER.listen($val => {
    		$THEME_BORDER = $val;
    		update();
    	});
    });

    var flag = /*#__PURE__*/Object.freeze({
        __proto__: null,
        SPRITES: SPRITES,
        SPRITES_COLOR: SPRITES_COLOR,
        IS_DEV: IS_DEV,
        SVELTE_ANIMATION: SVELTE_ANIMATION,
        TILE_COUNT: TILE_COUNT,
        TILE_COLUMNS: TILE_COLUMNS,
        THEME_COLOR: THEME_COLOR,
        THEME_BG: THEME_BG,
        THEME_GLOW: THEME_GLOW,
        CURSOR: CURSOR,
        THEME_BORDER: THEME_BORDER,
        THEME_STYLE: THEME_STYLE
    });

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

    const camera = new Store(twgl_js.m4.identity());
    const position$1 = new Store([0, 0, 0]);
    const look = new Store([0, 0, -1]);

    look.set = validate(look);
    position$1.set = validate(position$1);

    var camera$1 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        camera: camera,
        position: position$1,
        look: look
    });

    const screen_ui_regex = /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i;

    const agent = new Store((navigator.userAgent || navigator.vendor || window.opera).toLowerCase());

    const keyboard$1 = new Store(
    	!screen_ui_regex.test(agent.get())
    );

    const sound = new Store(true);

    var device = /*#__PURE__*/Object.freeze({
        __proto__: null,
        agent: agent,
        keyboard: keyboard$1,
        sound: sound
    });

    class BrowserPath extends Store {
    	constructor(start) {
    		super(start);

    		window.addEventListener(`popstate`, e => {
    			e.preventDefault();
    			e.stopPropagation();
    			this.path_update();
    		});

    		this.path_update();
    	}

    	 path_update() {
    		const path_str = window.location.search
    			? window.location.search.slice(1)
    			: window.location.pathname.slice(1);

    		this.set(decodeURI(path_str).replace(/ /g, `_`));
    	}

    	set(path_new) {
    		if (Array.isArray(path_new)) {
    			return super.set(path_new)
    		}

    		super.set(path_new.split(`/`));
    	}
    }

    const path = new BrowserPath([]);

    const flag$1 = new Read('', set => {
    	set(window.location.hash);
    });

    var path$1 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        path: path,
        flag: flag$1
    });



    var ClientSYS = /*#__PURE__*/Object.freeze({
        __proto__: null,
        mouse: mouse,
        screen: screen,
        input: input,
        keyboard: keyboard,
        gamepad: gamepad,
        flag: flag,
        camera: camera$1,
        device: device,
        path: path$1
    });

    // TODO: maybe an input one that gets written to from client?

    var CoreSYS = /*#__PURE__*/Object.freeze({
        __proto__: null,
        time: time
    });

    const is = ((window ).is = new Isekai({
    	...ClientSYS,
    	...CoreSYS
    }));

    /* src\client\Goblin.svelte generated by Svelte v3.20.1 */

    const { Object: Object_1 } = globals;
    const file$2 = "src\\client\\Goblin.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[3] = list[i][0];
    	child_ctx[5] = list[i][1];
    	return child_ctx;
    }

    // (23:4) {#each Object.entries($groked) as [name, weave]}
    function create_each_block(ctx) {
    	let current;

    	const weave = new Weave$1({
    			props: {
    				weave: /*weave*/ ctx[5],
    				goblin: /*goblin*/ ctx[1]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(weave.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(weave, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const weave_changes = {};
    			if (dirty & /*$groked*/ 1) weave_changes.weave = /*weave*/ ctx[5];
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
    			destroy_component(weave, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(23:4) {#each Object.entries($groked) as [name, weave]}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let div1;
    	let div0;
    	let t1;
    	let t2_value = JSON.stringify(/*$groked*/ ctx[0]) + "";
    	let t2;
    	let t3;
    	let current;
    	let each_value = Object.entries(/*$groked*/ ctx[0]);
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			div0.textContent = `${/*goblin*/ ctx[1]}`;
    			t1 = space();
    			t2 = text(t2_value);
    			t3 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(div0, "class", "title svelte-1rvfdfh");
    			add_location(div0, file$2, 16, 4, 314);
    			attr_dev(div1, "class", "wheel svelte-1rvfdfh");
    			add_location(div1, file$2, 15, 0, 289);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div1, t1);
    			append_dev(div1, t2);
    			append_dev(div1, t3);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div1, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if ((!current || dirty & /*$groked*/ 1) && t2_value !== (t2_value = JSON.stringify(/*$groked*/ ctx[0]) + "")) set_data_dev(t2, t2_value);

    			if (dirty & /*Object, $groked, goblin*/ 3) {
    				each_value = Object.entries(/*$groked*/ ctx[0]);
    				validate_each_argument(each_value);
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
    						each_blocks[i].m(div1, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
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
    			if (detaching) detach_dev(div1);
    			destroy_each(each_blocks, detaching);
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
    	let $groked;
    	let { name = "" } = $$props;
    	const goblin = is.query(name);

    	// TODO: lifecycle
    	const cancel = goblin.remote_grok();

    	const { groked } = goblin;
    	validate_store(groked, "groked");
    	component_subscribe($$self, groked, value => $$invalidate(0, $groked = value));
    	onDestroy(cancel);
    	const writable_props = ["name"];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Goblin> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Goblin", $$slots, []);

    	$$self.$set = $$props => {
    		if ("name" in $$props) $$invalidate(3, name = $$props.name);
    	};

    	$$self.$capture_state = () => ({
    		Weave: Weave$1,
    		is,
    		onDestroy,
    		name,
    		goblin,
    		cancel,
    		groked,
    		$groked
    	});

    	$$self.$inject_state = $$props => {
    		if ("name" in $$props) $$invalidate(3, name = $$props.name);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [$groked, goblin, groked, name];
    }

    class Goblin$1 extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { name: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Goblin",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get name() {
    		throw new Error("<Goblin>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<Goblin>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    window.addEventListener(`contextmenu`, e => {
    	e.preventDefault();
    	return false
    });





















    const buttons$2 = is.sys.query('input', 'buttons');
    const tick$1 = is.sys.query('time', 'tick');







    const cursor = new Store(undefined);
    const nav_map = {};
    const goto = (key) => {
    	if (!nav_map[key]) return

    	cursor.set(nav_map[key]);
    };

    let last_node;
    let origin_addr;

    const BUTTONS = {
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

    let last_button = {};
    tick$1.listen(() => {
    	if (!last_node) return

    	const $button = buttons$2.get();

    	let dest;
    	Object.entries(BUTTONS).forEach(([key, { repeat, fn, alias }]) => {
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
    	if (target === null) return
    	cursor.set(target);
    });

    const current = $node => {
    	if (last_node) {
    		if (last_node instanceof Element) last_node.classList.remove(`nav`);
    		last_node.blur && last_node.blur();
    		last_node = undefined;
    	}

    	if (!$node) return

    	last_node = $node;
    	$node.focus && $node.focus();

    	if ($node instanceof Element) $node.classList.add(`nav`);
    };

    cursor.listen(current);

    const nav = (node, opts) => {
    	const { id, origin = false } = opts;
    	node.id = id;

    	const navigation = {
    		update: (navable) => {
    			Object.assign(node, navable);
    		},
    		destroy: () => {
    			node.removeEventListener(`mousedown`, listener);
    			delete nav_map[id];
    		}
    	};

    	navigation.update(opts);

    	nav_map[id] = node;

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
    		cursor.set(node);
    	}

    	return navigation
    };

    const TILE_COUNT$1 = 1024;

    const str_color = (str) => {
    	if (!str) return `#111`

    	let hash = 0;
    	for (let i = 0; i < str.length; i++) {
    		hash = str.charCodeAt(i) + ((hash << 5) - hash);
    	}

    	let color = `#`;
    	for (let i = 0; i < 3; i++) {
    		const value = (hash >> (i * 8)) & 0xff;
    		color += (`00` + value.toString(16)).substr(-2);
    	}

    	return color
    };

    const color = str_color;

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
    ];

    const tile = (str) => {
    	let hash = 0;
    	for (let i = 0; i < str.length; i++) {
    		hash = str.charCodeAt(i) + ((hash << 5) - hash);
    	}

    	return `${Math.abs(hash) % TILE_COUNT$1}`
    };

    const random = (count) =>
    	Array.from(new Array(count))
    		.map(() => words[Math.floor(Math.random() * words.length)])
    		.join(`_`);

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

    /* src\client\image\Tile.svelte generated by Svelte v3.20.1 */
    const file$3 = "src\\client\\image\\Tile.svelte";

    // (1:0) <script>  import { tile }
    function create_catch_block(ctx) {
    	const block = { c: noop, m: noop, p: noop, d: noop };

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_catch_block.name,
    		type: "catch",
    		source: "(1:0) <script>  import { tile }",
    		ctx
    	});

    	return block;
    }

    // (25:28)   <img      class="tileset"      alt="tileset image"      {src}
    function create_then_block(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "tileset svelte-1jo87w8");
    			attr_dev(img, "alt", "tileset image");
    			if (img.src !== (img_src_value = /*src*/ ctx[7])) attr_dev(img, "src", img_src_value);
    			add_location(img, file$3, 25, 0, 364);
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
    		source: "(25:28)   <img      class=\\\"tileset\\\"      alt=\\\"tileset image\\\"      {src}",
    		ctx
    	});

    	return block;
    }

    // (1:0) <script>  import { tile }
    function create_pending_block(ctx) {
    	const block = { c: noop, m: noop, p: noop, d: noop };

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_pending_block.name,
    		type: "pending",
    		source: "(1:0) <script>  import { tile }",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
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
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(await_block_anchor);
    			info.block.d(detaching);
    			info.token = null;
    			info = null;
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
    	let { data = `` } = $$props;
    	let { width = 10 } = $$props;
    	let { height = 7 } = $$props;
    	let { random = false } = $$props;
    	let { text = false } = $$props;
    	const writable_props = ["data", "width", "height", "random", "text"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Tile> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Tile", $$slots, []);

    	$$self.$set = $$props => {
    		if ("data" in $$props) $$invalidate(1, data = $$props.data);
    		if ("width" in $$props) $$invalidate(2, width = $$props.width);
    		if ("height" in $$props) $$invalidate(3, height = $$props.height);
    		if ("random" in $$props) $$invalidate(4, random = $$props.random);
    		if ("text" in $$props) $$invalidate(5, text = $$props.text);
    	};

    	$$self.$capture_state = () => ({
    		tile,
    		Tile,
    		data,
    		width,
    		height,
    		random,
    		text,
    		tru_data,
    		image_src
    	});

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

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

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

    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {
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
    			id: create_fragment$3.name
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

    /* src\client\Isekai.svelte generated by Svelte v3.20.1 */

    const { Object: Object_1$1 } = globals;
    const file$4 = "src\\client\\Isekai.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[17] = list[i][0];
    	child_ctx[18] = list[i][1];
    	child_ctx[20] = i;
    	return child_ctx;
    }

    // (83:8) {#each positions as [x, y], idx}
    function create_each_block$1(ctx) {
    	let g;
    	let circle;
    	let circle_cx_value;
    	let circle_cy_value;
    	let text_1;
    	let t_value = (/*names*/ ctx[3][/*idx*/ ctx[20]] || "") + "";
    	let t;
    	let text_1_x_value;
    	let text_1_y_value;
    	let text_1_font_size_value;
    	let text_1_stroke_value;
    	let nav_action;
    	let dispose;

    	function mouseover_handler(...args) {
    		return /*mouseover_handler*/ ctx[13](/*idx*/ ctx[20], ...args);
    	}

    	const block = {
    		c: function create() {
    			g = svg_element("g");
    			circle = svg_element("circle");
    			text_1 = svg_element("text");
    			t = text(t_value);
    			attr_dev(circle, "class", "circle svelte-m1krv0");
    			attr_dev(circle, "cx", circle_cx_value = /*x*/ ctx[17]);
    			attr_dev(circle, "cy", circle_cy_value = /*y*/ ctx[18]);
    			add_location(circle, file$4, 91, 16, 2076);
    			attr_dev(text_1, "x", text_1_x_value = /*x*/ ctx[17]);
    			attr_dev(text_1, "y", text_1_y_value = /*y*/ ctx[18]);
    			attr_dev(text_1, "class", "goblin-name svelte-m1krv0");

    			attr_dev(text_1, "font-size", text_1_font_size_value = /*$cursor*/ ctx[6] && /*$cursor*/ ctx[6].id === `goblin-${/*idx*/ ctx[20]}`
    			? 2
    			: 5);

    			attr_dev(text_1, "stroke", text_1_stroke_value = color(/*names*/ ctx[3][/*idx*/ ctx[20]] || "EMPTY"));
    			add_location(text_1, file$4, 92, 16, 2137);
    			attr_dev(g, "class", "goblin svelte-m1krv0");
    			add_location(g, file$4, 83, 12, 1780);
    		},
    		m: function mount(target, anchor, remount) {
    			insert_dev(target, g, anchor);
    			append_dev(g, circle);
    			append_dev(g, text_1);
    			append_dev(text_1, t);
    			if (remount) run_all(dispose);

    			dispose = [
    				action_destroyer(nav_action = nav.call(null, g, /*nav_goblin*/ ctx[11](/*idx*/ ctx[20]))),
    				listen_dev(g, "mouseover", mouseover_handler, false, false, false)
    			];
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*names*/ 8 && t_value !== (t_value = (/*names*/ ctx[3][/*idx*/ ctx[20]] || "") + "")) set_data_dev(t, t_value);

    			if (dirty & /*$cursor*/ 64 && text_1_font_size_value !== (text_1_font_size_value = /*$cursor*/ ctx[6] && /*$cursor*/ ctx[6].id === `goblin-${/*idx*/ ctx[20]}`
    			? 2
    			: 5)) {
    				attr_dev(text_1, "font-size", text_1_font_size_value);
    			}

    			if (dirty & /*names*/ 8 && text_1_stroke_value !== (text_1_stroke_value = color(/*names*/ ctx[3][/*idx*/ ctx[20]] || "EMPTY"))) {
    				attr_dev(text_1, "stroke", text_1_stroke_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(g);
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(83:8) {#each positions as [x, y], idx}",
    		ctx
    	});

    	return block;
    }

    // (131:0) {#if goblin}
    function create_if_block(ctx) {
    	let current;

    	const goblin_1 = new Goblin$1({
    			props: { name: /*goblin*/ ctx[2] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(goblin_1.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(goblin_1, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const goblin_1_changes = {};
    			if (dirty & /*goblin*/ 4) goblin_1_changes.name = /*goblin*/ ctx[2];
    			goblin_1.$set(goblin_1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(goblin_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(goblin_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(goblin_1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(131:0) {#if goblin}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let svg;
    	let g;
    	let path_1;
    	let text_1;
    	let t0;
    	let text_1_font_size_value;
    	let text_1_stroke_value;
    	let text_1_stroke_width_value;
    	let nav_action;
    	let g_transform_value;
    	let t1;
    	let if_block_anchor;
    	let current;
    	let dispose;
    	let each_value = /*positions*/ ctx[9];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	let if_block = /*goblin*/ ctx[2] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			g = svg_element("g");
    			path_1 = svg_element("path");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			text_1 = svg_element("text");
    			t0 = text(/*name*/ ctx[10]);
    			t1 = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			attr_dev(path_1, "d", /*lines*/ ctx[8]);
    			attr_dev(path_1, "class", "svelte-m1krv0");
    			add_location(path_1, file$4, 80, 8, 1704);
    			attr_dev(text_1, "class", "name svelte-m1krv0");
    			attr_dev(text_1, "x", "50");
    			attr_dev(text_1, "y", "50");
    			attr_dev(text_1, "font-size", text_1_font_size_value = /*tiny*/ ctx[5] ? 5 : 10);
    			attr_dev(text_1, "stroke", text_1_stroke_value = color(/*$path*/ ctx[4][0] || "gree"));
    			attr_dev(text_1, "stroke-width", text_1_stroke_width_value = /*tiny*/ ctx[5] ? 0.25 : 0.5);
    			add_location(text_1, file$4, 102, 8, 2474);
    			attr_dev(g, "transform", g_transform_value = "\r\n        translate(" + /*offset*/ ctx[0][0] + ", " + /*offset*/ ctx[0][1] + ")\r\n        scale(" + /*scale*/ ctx[1] + ")\r\n        ");
    			attr_dev(g, "class", "map svelte-m1krv0");
    			add_location(g, file$4, 75, 4, 1578);
    			attr_dev(svg, "viewBox", "-5 -5 110 110");
    			attr_dev(svg, "class", "svg isekai svelte-m1krv0");
    			set_style(svg, "filter", "drop-shadow(0 0 0.5rem " + color(/*name*/ ctx[10]) + ")");
    			add_location(svg, file$4, 72, 0, 1461);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor, remount) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, g);
    			append_dev(g, path_1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(g, null);
    			}

    			append_dev(g, text_1);
    			append_dev(text_1, t0);
    			insert_dev(target, t1, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    			if (remount) run_all(dispose);

    			dispose = [
    				listen_dev(text_1, "mouseover", /*mouseover_handler_1*/ ctx[14], false, false, false),
    				listen_dev(text_1, "click", /*click_handler*/ ctx[15], false, false, false),
    				action_destroyer(nav_action = nav.call(null, text_1, {
    					id: "workspace",
    					origin: true,
    					focus: /*nav_function*/ ctx[16]
    				}))
    			];
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*nav_goblin, $cursor, offset, positions, color, names*/ 2633) {
    				each_value = /*positions*/ ctx[9];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(g, text_1);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (!current || dirty & /*tiny*/ 32 && text_1_font_size_value !== (text_1_font_size_value = /*tiny*/ ctx[5] ? 5 : 10)) {
    				attr_dev(text_1, "font-size", text_1_font_size_value);
    			}

    			if (!current || dirty & /*$path*/ 16 && text_1_stroke_value !== (text_1_stroke_value = color(/*$path*/ ctx[4][0] || "gree"))) {
    				attr_dev(text_1, "stroke", text_1_stroke_value);
    			}

    			if (!current || dirty & /*tiny*/ 32 && text_1_stroke_width_value !== (text_1_stroke_width_value = /*tiny*/ ctx[5] ? 0.25 : 0.5)) {
    				attr_dev(text_1, "stroke-width", text_1_stroke_width_value);
    			}

    			if (nav_action && is_function(nav_action.update) && dirty & /*offset, scale*/ 3) nav_action.update.call(null, {
    				id: "workspace",
    				origin: true,
    				focus: /*nav_function*/ ctx[16]
    			});

    			if (!current || dirty & /*offset, scale*/ 3 && g_transform_value !== (g_transform_value = "\r\n        translate(" + /*offset*/ ctx[0][0] + ", " + /*offset*/ ctx[0][1] + ")\r\n        scale(" + /*scale*/ ctx[1] + ")\r\n        ")) {
    				attr_dev(g, "transform", g_transform_value);
    			}

    			if (/*goblin*/ ctx[2]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    					transition_in(if_block, 1);
    				} else {
    					if_block = create_if_block(ctx);
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
    			if (detaching) detach_dev(svg);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(t1);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
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
    	let $is;
    	let $path;
    	let $cursor;
    	validate_store(is, "is");
    	component_subscribe($$self, is, $$value => $$invalidate(12, $is = $$value));
    	validate_store(cursor, "cursor");
    	component_subscribe($$self, cursor, $$value => $$invalidate(6, $cursor = $$value));
    	const path = is.sys.query("path", "path");
    	validate_store(path, "path");
    	component_subscribe($$self, path, value => $$invalidate(4, $path = value));

    	const lines = [
    		`M0 50 L15 15 L50 0 L85 15 L100 50 L85 85 L50 100 L 15 85 L0 50`,
    		`M15 85 Q25 50, 50 50 T 85 15`,
    		`M15 85 Q50 75, 50 50 T 85 15`,
    		`M15 15 Q25 50, 50 50 T 85 85`,
    		`M15 15 Q50 25, 50 50 T 85 85`,
    		`M0 50 Q25 75, 50 50 T 100 50`,
    		`M50 0 Q25 25, 50 50 T 50 100`,
    		`M0 50 Q25 25, 50 50 T 100 50`,
    		`M50 0 Q75 25, 50 50 T 50 100`
    	].join(` `);

    	const positions = [[15, 15], [15, 85], [85, 85], [85, 15], [0, 50], [50, 0], [100, 50], [50, 100]];
    	let offset = [0, 0];
    	let scale = 1;

    	let name = $path.length > 0 && $path[0] !== ""
    	? $path.join("/")
    	: "EARTHROCK";

    	let goblin;

    	const nav_goblin = idx => ({
    		id: `goblin-${idx}`,
    		focus() {
    			$$invalidate(1, scale = 5);
    			$$invalidate(0, offset = positions[idx].map(i => 50 - i * scale));

    			if (names[idx] === undefined) {
    				$$invalidate(3, names[idx] = random(2), names);
    				is.add({ [names[idx]]: {} });
    			}

    			$$invalidate(2, goblin = names[idx]);
    		},
    		blur() {
    			$$invalidate(2, goblin = undefined);
    		},
    		cancel() {
    			goto("workspace");
    		}
    	});

    	const writable_props = [];

    	Object_1$1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Isekai> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Isekai", $$slots, []);

    	const mouseover_handler = idx => {
    		if ($cursor && $cursor.id === `goblin-${idx}`) return;
    		$$invalidate(0, offset = positions[idx].map(i => (50 - i) / 2));
    	};

    	const mouseover_handler_1 = () => {
    		$$invalidate(0, offset = [0, 0]);
    	};

    	const click_handler = () => {
    		window.open("https://www.patreon.com/earthrock");
    	};

    	const nav_function = function () {
    		$$invalidate(0, offset = [0, 0]);
    		$$invalidate(1, scale = 1);
    	};

    	$$self.$capture_state = () => ({
    		Goblin: Goblin$1,
    		nav,
    		cursor,
    		goto,
    		color,
    		random,
    		is,
    		Tile: Tile_1,
    		path,
    		lines,
    		positions,
    		offset,
    		scale,
    		name,
    		goblin,
    		nav_goblin,
    		names,
    		$is,
    		$path,
    		tiny,
    		$cursor
    	});

    	$$self.$inject_state = $$props => {
    		if ("offset" in $$props) $$invalidate(0, offset = $$props.offset);
    		if ("scale" in $$props) $$invalidate(1, scale = $$props.scale);
    		if ("name" in $$props) $$invalidate(10, name = $$props.name);
    		if ("goblin" in $$props) $$invalidate(2, goblin = $$props.goblin);
    		if ("names" in $$props) $$invalidate(3, names = $$props.names);
    		if ("tiny" in $$props) $$invalidate(5, tiny = $$props.tiny);
    	};

    	let names;
    	let tiny;

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$is*/ 4096) {
    			 $$invalidate(3, names = Object.keys($is));
    		}
    	};

    	 $$invalidate(5, tiny = name.length > 13);

    	return [
    		offset,
    		scale,
    		goblin,
    		names,
    		$path,
    		tiny,
    		$cursor,
    		path,
    		lines,
    		positions,
    		name,
    		nav_goblin,
    		$is,
    		mouseover_handler,
    		mouseover_handler_1,
    		click_handler,
    		nav_function
    	];
    }

    class Isekai$1 extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Isekai",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    /* src\client\Client.svelte generated by Svelte v3.20.1 */
    const file$5 = "src\\client\\Client.svelte";

    function create_fragment$5(ctx) {
    	let div;
    	let t;
    	let current;
    	const github = new Github({ $$inline: true });
    	const isekai = new Isekai$1({ $$inline: true });

    	const block = {
    		c: function create() {
    			div = element("div");
    			create_component(github.$$.fragment);
    			t = space();
    			create_component(isekai.$$.fragment);
    			attr_dev(div, "class", "dev svelte-19gtc4k");
    			toggle_class(div, "hidden", /*hidden*/ ctx[0]);
    			add_location(div, file$5, 16, 0, 303);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(github, div, null);
    			append_dev(div, t);
    			mount_component(isekai, div, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*hidden*/ 1) {
    				toggle_class(div, "hidden", /*hidden*/ ctx[0]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(github.$$.fragment, local);
    			transition_in(isekai.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(github.$$.fragment, local);
    			transition_out(isekai.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(github);
    			destroy_component(isekai);
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
    	let $button;
    	let hidden = is.sys.query("path", "flag").get() === "dev";
    	const button = is.sys.query("input", "button");
    	validate_store(button, "button");
    	component_subscribe($$self, button, value => $$invalidate(2, $button = value));
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Client> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Client", $$slots, []);

    	$$self.$capture_state = () => ({
    		Github,
    		Isekai: Isekai$1,
    		is,
    		hidden,
    		button,
    		$button
    	});

    	$$self.$inject_state = $$props => {
    		if ("hidden" in $$props) $$invalidate(0, hidden = $$props.hidden);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$button, hidden*/ 5) {
    			 {
    				if ($button === "`") {
    					$$invalidate(0, hidden = !hidden);
    				}
    			}
    		}
    	};

    	return [hidden, button];
    }

    class Client extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Client",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    const main = new Client({
    	target: document.body
    });

}(TWGL, Color));
//# sourceMappingURL=client.bundle.js.map
