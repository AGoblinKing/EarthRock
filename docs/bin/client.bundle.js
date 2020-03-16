(function (twgl_js) {
    'use strict';

    function noop() { }
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

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function empty() {
        return text('');
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
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
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
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.19.1' }, detail)));
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
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
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

    /* src\client\Github.svelte generated by Svelte v3.19.1 */

    const file = "src\\client\\Github.svelte";

    function create_fragment(ctx) {
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
    			attr_dev(path0, "class", "bg svelte-sce8qg");
    			attr_dev(path0, "d", "M0 0l115 115h15l12 27 108 108V0z");
    			attr_dev(path0, "fill", "#fff");
    			add_location(path0, file, 1, 2, 161);
    			attr_dev(path1, "class", "octo-arm svelte-sce8qg");
    			attr_dev(path1, "d", "M128 109c-15-9-9-19-9-19 3-7 2-11 2-11-1-7 3-2 3-2 4 5 2 11 2 11-3 10 5 15 9 16");
    			set_style(path1, "-webkit-transform-origin", "130px 106px");
    			set_style(path1, "transform-origin", "130px 106px");
    			add_location(path1, file, 2, 2, 233);
    			attr_dev(path2, "class", "octo-body svelte-sce8qg");
    			attr_dev(path2, "d", "M115 115s4 2 5 0l14-14c3-2 6-3 8-3-8-11-15-24 2-41 5-5 10-7 16-7 1-2 3-7 12-11 0 0 5 3 7 16 4 2 8 5 12 9s7 8 9 12c14 3 17 7 17 7-4 8-9 11-11 11 0 6-2 11-7 16-16 16-30 10-41 2 0 3-1 7-5 11l-12 11c-1 1 1 5 1 5z");
    			add_location(path2, file, 3, 2, 422);
    			attr_dev(svg, "id", "github");
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "width", "80");
    			attr_dev(svg, "height", "80");
    			attr_dev(svg, "viewBox", "0 0 250 250");
    			attr_dev(svg, "fill", "#151513");
    			set_style(svg, "position", "absolute");
    			set_style(svg, "top", "0");
    			set_style(svg, "right", "0");
    			attr_dev(svg, "class", "svelte-sce8qg");
    			add_location(svg, file, 0, 0, 0);
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
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
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

    class Github extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment, safe_not_equal, {});

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

    class Tree extends Read {
    	

    	constructor(tree = {}, setter) {
    		super(tree, setter);
    	}

    	item (name) {
    		return super.get()[name]
    	}

    	has (name) {
    		return this.item(name) !== undefined
    	}

    	reset (target, silent = false) {
    		const $tree = {};
    		if(target) {
    			Object.assign($tree, target);
    		}

    		this.p_set($tree, silent);
    	}

    	add (tree_json, silent = false) {
    		const $tree = this.get();
    		Object.assign($tree, tree_json);

    		this.p_set($tree, silent);
    	}

    	remove (name, silent = false) {
    		delete this.value[name];
    		if(!silent) this.notify();
    	}
    	
    	query (...steps)  {
    		
    		const cursor = this.value[steps.shift()]; 

    		if(steps.length === 0 || !cursor) return cursor 	
    		return cursor.query(...steps)
    	}
    }

    class Proxy {
        

        get() { return this.value.get() }
        listen(listen) { return this.value.listen(listen) }
        set(value, silent = false) { this.value.set(value, silent); }
        toJSON() { return this.value.toJSON() }
        notify() { this.value.notify(); }
    }

    class ProxyTree extends Proxy {
        
        
        item (name) {
            return this.value.item(name)
        }

        reset (target, silent)  {
            return this.value.reset(target, silent)
        }

        add (tree_write, silent) {
            return this.value.add(tree_write, silent)
        }

        remove (name, silent) {
            this.value.remove(name, silent);
        }

        query (...steps)  {
            return this.value.query(...steps)
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
        const CREATE = "create"; ELivingAction["CREATE"] = CREATE;
        const REZ = "rez"; ELivingAction["REZ"] = REZ;
        const DEREZ = "derez"; ELivingAction["DEREZ"] = DEREZ;
        const DESTROY = "destroy"; ELivingAction["DESTROY"] = DESTROY;
    })(ELivingAction || (ELivingAction = {}));

    var ELivingStatus; (function (ELivingStatus) {
        const VOID = "VOID"; ELivingStatus["VOID"] = VOID;
        const CREATED = "CREATED"; ELivingStatus["CREATED"] = CREATED;
        const REZED = "REZED"; ELivingStatus["REZED"] = REZED;
    })(ELivingStatus || (ELivingStatus = {}));

    class Living extends ProxyTree {constructor(...args) { super(...args); Living.prototype.__init.call(this); }
        
         __init() {this.status = new Store(ELivingStatus.VOID);}

        add (living_data, silent = false) {
            super.add(living_data, silent);
            const $status = this.status.get();

            const items = Object.entries(living_data);

            switch($status) {
                case ELivingStatus.CREATED:
                    for(let [_, item] of items) {
                        item.create && item.create();
                    }

                case ELivingStatus.REZED:
                    const $rezed = this.rezed && this.rezed.get(); 

                    // create doesn't auto rez
                    // so you can batch creates together then rez
                    for(let [name, item] of items) {
                        if($rezed && !$rezed[name]) continue 
                        item.rez && item.rez();
                    }
            }
        }
        
        remove (name, silent = false) {
            const $value = this.get(); 

            if($value[name] && $value[name].destroy) {
                $value[name].destroy();
            }

            const $rezed = this.rezed && this.rezed.get(); 
            if($rezed) {
                $rezed.delete(name);
            }

            super.remove(name, silent);
        }
        
        removes(...names) {
            for(let name of names) {
                this.remove(name, true);
            }

            this.notify();
        }

        create () {
            if(this.status.get() !== ELivingStatus.VOID) {
                throw new Error("Tried to create a nonvoid living class")
            }

            // run through my tree to guarantee its destroyed
            let sub;
            for(sub of Object.values(this.get())) {
                sub.create && sub.create();
            }

            this.status.set(ELivingStatus.CREATED);
        }

        destroy () {
            if(this.status.get() === ELivingStatus.REZED) {
                this.derez();
            }

            let sub;
            for(sub of Object.values(this.get())) {
                sub.destroy && sub.destroy();
            }

            this.status.set(ELivingStatus.VOID);
        }
        
        rez () {
            if(this.status.get() === ELivingStatus.VOID) {
                this.create();
            }

            const rezed = this.rezed && this.rezed.get();        

            for(let [name, sub] of Object.entries(this.get())) {
                if(rezed && !rezed.has(name)) continue

                (sub ).rez && (sub ).rez();
            }

            this.status.set(ELivingStatus.REZED);
        }

        derez () {
            if(this.status.get() !== ELivingStatus.REZED) {
                return   
            }

            const $rezed = this.rezed && this.rezed.get();        

            for(let [name, sub] of Object.entries(this.get())) {
                if($rezed && !$rezed.has(name)) continue
                
                (sub ).derez && (sub ).derez();
            }

            this.status.set(ELivingStatus.CREATED);
        }

        start_all(...all) {
            all = all.length === 0 ? Object.keys(this.get()) : all;
            for(let name of all) {
                this.start(name);
            }
        }

        start(name) {
            const $rezed = this.rezed && this.rezed.get();        
            const item = this.item(name);

            if(!item) return

            // can only rez if I am 
            if(this.status.get() === ELivingStatus.REZED) {
                (item ).rez && (item ).rez();
            }

            if($rezed) {
                $rezed.add(name);
                this.rezed.notify();
            }
        }

        stop(name) {
            const item = this.item(name);
            if(!item) return

            // can derez whenever though
            (item ).derez && (item ).derez();

            const $rezed = this.rezed && this.rezed.get();   
            if(!$rezed) return
            
            $rezed.delete(name);
            this.rezed.notify();
        }

        restart (name) {
            this.stop(name);
            this.start(name);
        }

        toJSON()  {
            return {
                value: this.value.toJSON(),
                rezed: this.rezed ? this.rezed.toJSON() : undefined
            }
        }

        ensure (first, ...path) {
            let $item = this.item(first);

            if($item === undefined) {
                this.add({
                    [first]: {}
                });

                $item = this.item(first);
            }

            if(path.length === 0) return $item
            
            if($item instanceof Living) {
                return $item.ensure(path[0], ...path.slice(1))
            }
            
            throw new Error("tried to ensure non living item")
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
        const SPACE = "SPACE"; EWarp["SPACE"] = SPACE;
        const MATH = "MATH"; EWarp["MATH"] = MATH;
        const VALUE = "VALUE"; EWarp["VALUE"] = VALUE;
        const MAIL = "MAIL"; EWarp["MAIL"] = MAIL;
    })(EWarp || (EWarp = {}));

    class Warp extends Living {
        
        

        

        constructor (data, weave) {
            super();

            this.name = data.name;
            this.type = data.type;
            this.weave = weave;
            
            // don't init value because who knows what they want
        }

        toJSON () {
            return {
                name: this.name,
                type: this.type,
                value: this.value.toJSON()
            }
        }
    }

    var ETwist; (function (ETwist) {
        const VISIBLE = "VISIBLE"; ETwist["VISIBLE"] = VISIBLE;
        const PHYSICAL = "PHYSICAL"; ETwist["PHYSICAL"] = PHYSICAL;
        const DATA = "DATA"; ETwist["DATA"] = DATA;
    })(ETwist || (ETwist = {}));





    class Twist extends Living {
        
        
        
        
        constructor (weave, space) {
            super();

            this.space = space;
            this.weave = weave;
            this.value = new Tree({});
        }

        add (data, silent = false) {
            const write = {};
            for(let [name, value] of Object.entries(data)) {
                if(value instanceof Store) {
                    write[name] = value;
                } else {
                    write[name] = new Store(value);
                }
            }

            super.add(write, silent);
        }

        toJSON () {
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
         __init() {this.value = new Tree();}

        constructor (warp_data, weave) {
            super(warp_data, weave);Space.prototype.__init.call(this);

            this.add(warp_data.value || {});
        }

        add (data) {
            const adds = {};

            for(let type of Object.keys(data)) {
                adds[type] = this.create_twist(type, data[type]);
            }

            super.add(adds);
        }

         create_twist (type, twist_data = {}) {
            switch(type) {
                case ETwist.DATA:
                    return new Data(this.weave, this, twist_data)
                case ETwist.VISIBLE: 
                    return new Visible(this.weave, this, twist_data )
                case ETwist.PHYSICAL:
                    return new Physical(this.weave, this, twist_data )
            }

            return new Store(twist_data)
        }   

        create () {
            super.create();
            this.weave.spaces.add({ [this.name]: this });
        }

        destroy () {
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

        create_warp ($warp) {
            switch($warp.type) {
                case undefined:
                    $warp.type = EWarp.SPACE;
                case EWarp.SPACE:
                     return new Space($warp, this)
                case EWarp.MAIL:
                case EWarp.VALUE:
                case EWarp.MATH:
            }

            throw new Error(`warp/unknown ${$warp}`)
        }

        constructor (data) {
            super();Weave.prototype.__init.call(this);Weave.prototype.__init2.call(this);Weave.prototype.__init3.call(this);Weave.prototype.__init4.call(this); 

            if(data.name === undefined) {
                throw new Error("Undefined name for weave")
            }

            this.name = new Store(data.name);
            this.threads = new Tree(data.thread || {});
            this.rezed = new Store(new Set(data.rezed || []));

            this.threads_reverse = new Tree({}, set => {
                this.cancels.add(this.threads.listen(($threads) => {
                    const w_r = {};
                    for(let key of Object.keys($threads)) {
                        w_r[$threads[key]] = key;
                    }

                    set(w_r);
                }));
            });

            this.add(data.value || {});
        }

        add (warp_data, silent = false)  {
            if(!warp_data) return
            const warps = {};

            for(let [name, warp] of Object.entries(warp_data)) {
                if (warp instanceof Warp) {
                    warps[name] = warp;
                    continue
                }

                warp.name = name;
                warps[name] = this.create_warp(warp);
            }

            super.add(warps, silent);

            return warps
        }

        rez () {
            super.rez();

            // connect threads to form nerves
            this.thread_cancel = this.threads.listen(this.thread_update.bind(this));
        }

        thread_update ($threads) {
            for(let [name, cancel] of Object.entries(this.nerves)) {
                if($threads[name]) {
                    delete $threads[name];
                    continue
                }

                cancel();
                delete this.nerves[name];
            }

            for(let [from, to] of Object.entries($threads)) {
                const f = this.query(...from.split("/"));
                const t = this.query(...to.split("/"));
                if(!f || !t) continue
                this.nerves[from] = f.listen(t.set.bind(t));
            }
        }

        derez () {
            super.derez();
            
            for(let cancel of Object.values(this.nerves)) {
                cancel();
            }

            this.thread_cancel();
        }

        removes (...names) {
            const $warps = this.value.get();
            const $wefts = this.threads.get();
            const $wefts_r = this.threads_reverse.get();
            const $rezed = this.rezed.get();

            for(let name of names) {
                const warp = $warps[name];
                if(warp) warp.destroy();

                delete $warps[name];
                delete $wefts[name];
                $rezed.delete(name);

                const r = $wefts_r[name];
                if(r) {
                    delete $wefts[r];
                }
            }

            this.value.set($warps);
            this.threads.set($wefts);
            this.rezed.set($rezed);
        }

        remove (name) {
            this.removes(name);
        }

        destroy() {
            super.destroy();

            for(let cancel of Array.from(this.cancels)) {
                cancel();
            }

            this.cancels.clear();
        }

        toJSON () {
            return {
                name: this.name.get(),
                thread: this.threads.get(),

                value: this.value.toJSON(),
                rezed: this.rezed.toJSON()
            }
        }
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

        constructor (wheel_data) {
            super();Wheel.prototype.__init.call(this);
            
            this.rezed = new Store(new Set(wheel_data.rezed));
            
            this.add(wheel_data.value);
        }

        add (weaves, silent = false) {
            const write = {};

            for(let [name, value] of Object.entries(weaves)) {
                if(value instanceof Weave) {
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
        

        onmessage (event) {
            const msg = event.data;
            const fn = `msg_${msg.name}`;
            if(this[fn]) this[fn](msg.data);
        }

        postMessage (message) {
            this.remote.onmessage({ data: message });
        }
    }

    class RemoteWorker extends Messenger {
        __init() {this.wheel = new Wheel({
            rezed: [],
            value: {}
        });}
        
        constructor (remote) {
            super();RemoteWorker.prototype.__init.call(this);
            this.remote = remote;

            raf_1(() => {
                this.postMessage({
                    name: "ready"
                });
            });
        }

         tick() {
            raf_1(() => {
                this.postMessage({
                    name: "buffer",
                    data: {
                        VISIBLE: Visible.data.toJSON()
                    }
                });
            });
        }

         msg_toJSON () {
            this.postMessage({
                name: "toJSON",
                data: this.wheel.toJSON()
            });
        }

         msg_add (data) {
            this.wheel.add(data.value);

            for(let name of data.rezed) {
                this.wheel.start(name);
            }
        }

         msg_status (data) {
            this.wheel[data]();
            if(data !== ELivingAction.DESTROY) return

            this.postMessage({
                name: "destroy"
            });
        }

         msg_start (data) {
            this.wheel.start(data);
        }

         msg_stop (data) {
            this.wheel.stop(data);
        }

         msg_update (data


    ) {
            this.wheel.ensure(data.path[0], ...data.path.slice(1)).set(data.value);
        }

         msg_relay () {
            if(this.timeout) this.timeout();
            this.timeout = this.wheel.query("sys", "time", "tick").listen(this.tick.bind(this));
        }
    }

    class LocalWorker extends Messenger  {constructor(...args) { super(...args); LocalWorker.prototype.__init.call(this); }
         __init() {this.remote = new RemoteWorker(this);}

        terminate() {
            // okay
        }

        onerror (ev) {
            // okay
        }
    }  

    class WheelWorker extends Living {
        // this could use sharedmemory but not everyone supports it
        __init2() {this.buffer = new Tree({
            VISIBLE: Visible.data
        });}

        
         __init3() {this.value = this.buffer;}
        
         __init4() {this.sys_cancels = {};}
        
        

         __init5() {this.json_resolvers = [];}

        constructor (sys, local = false) {
            super();WheelWorker.prototype.__init2.call(this);WheelWorker.prototype.__init3.call(this);WheelWorker.prototype.__init4.call(this);WheelWorker.prototype.__init5.call(this);WheelWorker.prototype.__init6.call(this);

            this.sys = sys;
            this.local = local;
        }

        create () {
            super.create();

            this.worker = this.local ? new LocalWorker() : new Worker(`/bin/wheel.bundle.js`);

            this.worker.onmessage = this.onmessage.bind(this);
            this.worker.onerror = this.onerror.bind(this);

            this.worker.postMessage({
                name: "status",
                data: ELivingAction.CREATE
            });
        }

        rez () {
            super.rez();

            this.sys_cancel = this.sys.listen(this.sys_update.bind(this));

            this.worker.postMessage({
                name: "status",
                data: ELivingAction.REZ
            });
        }

        derez () {
            super.derez();

            for(let cancel of Object.values(this.sys_cancels)) {
                cancel();
            }

            this.sys_cancel();

            this.worker.postMessage({
                name: "status",
                data: ELivingAction.DEREZ
            });
        }

        destroy () {
            super.destroy();

            this.worker.postMessage({
                name: "status",
                data: ELivingAction.DESTROY
            });
        }

        // replicate system changes into the worker
         sys_update ($sys) {
            // this should happen very rarely
            for(let cancel of Object.values(this.sys_cancels)) {
                cancel();
            }
            
            this.sys_cancels = {};

            for(let [name, category] of Object.entries($sys)) {
                this.sys_cancels[name] = category.listen(($category) => {
                    for(let [key, store] of Object.entries($category)) {
                        this.sys_cancels[`${name}/${key}`] = store.listen($store => {
                            this.worker.postMessage({
                                name: "update",
                                data: {
                                    path: [`sys`, name, key],
                                    value: $store
                                }
                            });
                        });
                    }
                });
            }
        }

         msg_destroy () {
            this.worker.terminate();
        }

         msg_toJSON (json) {
            for(let resolve of this.json_resolvers) {
                resolve(json);
            }
        }

         msg_buffer (data) {
            for(let [name, buffer] of Object.entries(data)) {
                const buff = this.buffer.item(name);

                if(buff === undefined) return
                buff.hydrate(buffer);
            }

            this.notify();
        }

         msg_ready () {
            this.worker.postMessage({
                name: "relay"
            });
        }

         __init6() {this.onmessage = Messenger.prototype.onmessage;}

         onerror (event) {
            console.error(`Worker Error`, event);
        }

        async remote_toJSON () {
            return new Promise((resolve) => {
                this.json_resolvers.push(resolve);

                if(this.json_resolvers.length !== 1) return

                this.worker.postMessage({
                    name: "toJSON"
                });
            })
        }

        remote_add (data) {
            this.worker.postMessage({
                name: "add",
                data
            });
        }

        remote_start (data) {
            this.worker.postMessage({
                name: "start",
                data
            });
        }

        remote_stop (data) {
            this.worker.postMessage({
                name: "stop",
                data
            });
        }
    }

    // Starts up in the main thread
    class Isekai extends Living {
         __init() {this.wheels = new Tree();}
         __init2() {this.value = this.wheels;}
        
         __init3() {this.sys = new Tree();}
         __init4() {this.local = new Store(false);}

        constructor(sys, local = false) {
            super();Isekai.prototype.__init.call(this);Isekai.prototype.__init2.call(this);Isekai.prototype.__init3.call(this);Isekai.prototype.__init4.call(this);
            this.local.set(local);

            const write = {};
            for(let [name, value] of Object.entries(sys)) {
                write[name] = new Tree(value);
            }

            this.sys.add(write);

            // Check Path
            // Check Database
            this.create();
            this.rez();
        }

        add (wheels) {
            const write = {};

            for(let [name, wheel_json] of Object.entries(wheels)) {
                const worker = write[name] = new WheelWorker(this.sys, this.local.get());
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

    /* src\client\Client.svelte generated by Svelte v3.19.1 */

    // (13:0) {#if !hidden}
    function create_if_block(ctx) {
    	let current;
    	const github = new Github({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(github.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(github, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(github.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(github.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(github, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(13:0) {#if !hidden}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = !/*hidden*/ ctx[0] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (!/*hidden*/ ctx[0]) {
    				if (!if_block) {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				} else {
    					transition_in(if_block, 1);
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
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let $button;
    	validate_store(button$1, "button");
    	component_subscribe($$self, button$1, $$value => $$invalidate(2, $button = $$value));
    	let { isekai } = $$props;
    	let hidden = true;
    	const writable_props = ["isekai"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Client> was created with unknown prop '${key}'`);
    	});

    	$$self.$set = $$props => {
    		if ("isekai" in $$props) $$invalidate(1, isekai = $$props.isekai);
    	};

    	$$self.$capture_state = () => ({
    		Github,
    		Isekai,
    		button: button$1,
    		isekai,
    		hidden,
    		$button
    	});

    	$$self.$inject_state = $$props => {
    		if ("isekai" in $$props) $$invalidate(1, isekai = $$props.isekai);
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

    	return [hidden, isekai];
    }

    class Client extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment$1, safe_not_equal, { isekai: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Client",
    			options,
    			id: create_fragment$1.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*isekai*/ ctx[1] === undefined && !("isekai" in props)) {
    			console.warn("<Client> was created without expected prop 'isekai'");
    		}
    	}

    	get isekai() {
    		throw new Error("<Client>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set isekai(value) {
    		throw new Error("<Client>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const main = new Client({
        target: document.body
    });

}(TWGL));
//# sourceMappingURL=client.bundle.js.map
