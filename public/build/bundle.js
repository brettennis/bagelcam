
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
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
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
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
    function init_binding_group(group) {
        let _inputs;
        return {
            /* push */ p(...inputs) {
                _inputs = inputs;
                _inputs.forEach(input => group.push(input));
            },
            /* remove */ r() {
                _inputs.forEach(input => group.splice(group.indexOf(input), 1));
            }
        };
    }
    function to_number(value) {
        return value === '' ? null : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        if (value === null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    /**
     * Creates an event dispatcher that can be used to dispatch [component events](/docs#template-syntax-component-directives-on-eventname).
     * Event dispatchers are functions that can take two arguments: `name` and `detail`.
     *
     * Component events created with `createEventDispatcher` create a
     * [CustomEvent](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent).
     * These events do not [bubble](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Building_blocks/Events#Event_bubbling_and_capture).
     * The `detail` argument corresponds to the [CustomEvent.detail](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/detail)
     * property and can contain any type of data.
     *
     * https://svelte.dev/docs#run-time-svelte-createeventdispatcher
     */
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail, { cancelable = false } = {}) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail, { cancelable });
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
                return !event.defaultPrevented;
            }
            return true;
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
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
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
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
        seen_callbacks.clear();
        set_current_component(saved_component);
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
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
    }
    const outroing = new Set();
    let outros;
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
        else if (callback) {
            callback();
        }
    }

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            flush_render_callbacks($$.after_update);
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
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
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
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.57.0' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation, has_stop_immediate_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        if (has_stop_immediate_propagation)
            modifiers.push('stopImmediatePropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src/Header.svelte generated by Svelte v3.57.0 */

    const file$6 = "src/Header.svelte";

    function create_fragment$6(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "backdrop svelte-vbptm7");
    			add_location(div, file$6, 4, 0, 21);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
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

    function instance$6($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Header', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Header> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Header extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Header",
    			options,
    			id: create_fragment$6.name
    		});
    	}
    }

    /* src/Sidebar.svelte generated by Svelte v3.57.0 */
    const file$5 = "src/Sidebar.svelte";

    function create_fragment$5(ctx) {
    	let div1;
    	let div0;
    	let h1;
    	let t1;
    	let input;
    	let t2;
    	let button0;
    	let t4;
    	let button1;
    	let t6;
    	let p;
    	let t7;
    	let t8;
    	let button2;
    	let t10;
    	let button3;
    	let t12;
    	let button4;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			h1 = element("h1");
    			h1.textContent = "preset";
    			t1 = space();
    			input = element("input");
    			t2 = space();
    			button0 = element("button");
    			button0.textContent = "save";
    			t4 = space();
    			button1 = element("button");
    			button1.textContent = "load";
    			t6 = space();
    			p = element("p");
    			t7 = text(/*presetConsole*/ ctx[2]);
    			t8 = space();
    			button2 = element("button");
    			button2.textContent = "sprite";
    			t10 = space();
    			button3 = element("button");
    			button3.textContent = "purple haze";
    			t12 = space();
    			button4 = element("button");
    			button4.textContent = "the void";
    			attr_dev(h1, "class", "svelte-12jnm1k");
    			add_location(h1, file$5, 41, 8, 1182);
    			attr_dev(input, "class", "preset-input svelte-12jnm1k");
    			attr_dev(input, "type", "text");
    			add_location(input, file$5, 43, 8, 1207);
    			attr_dev(button0, "class", "buttonSave");
    			add_location(button0, file$5, 47, 8, 1387);
    			attr_dev(button1, "class", "buttonSave");
    			add_location(button1, file$5, 48, 8, 1454);
    			attr_dev(p, "class", "preset-console svelte-12jnm1k");
    			add_location(p, file$5, 49, 8, 1521);
    			attr_dev(div0, "class", "presets-container");
    			add_location(div0, file$5, 40, 4, 1142);
    			add_location(button2, file$5, 52, 4, 1583);
    			add_location(button3, file$5, 58, 4, 2197);
    			add_location(button4, file$5, 64, 4, 2816);
    			attr_dev(div1, "class", "backdrop svelte-12jnm1k");
    			add_location(div1, file$5, 38, 0, 1110);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div0, h1);
    			append_dev(div0, t1);
    			append_dev(div0, input);
    			set_input_value(input, /*inputString*/ ctx[1]);
    			/*input_binding*/ ctx[8](input);
    			append_dev(div0, t2);
    			append_dev(div0, button0);
    			append_dev(div0, t4);
    			append_dev(div0, button1);
    			append_dev(div0, t6);
    			append_dev(div0, p);
    			append_dev(p, t7);
    			append_dev(div1, t8);
    			append_dev(div1, button2);
    			append_dev(div1, t10);
    			append_dev(div1, button3);
    			append_dev(div1, t12);
    			append_dev(div1, button4);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", /*input_input_handler*/ ctx[7]),
    					listen_dev(input, "focus", /*focus_handler*/ ctx[9], false, false, false, false),
    					listen_dev(button0, "click", /*doSave*/ ctx[4], false, false, false, false),
    					listen_dev(button1, "click", /*doLoad*/ ctx[3], false, false, false, false),
    					listen_dev(button2, "click", /*click_handler*/ ctx[10], false, false, false, false),
    					listen_dev(button3, "click", /*click_handler_1*/ ctx[11], false, false, false, false),
    					listen_dev(button4, "click", /*click_handler_2*/ ctx[12], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*inputString*/ 2 && input.value !== /*inputString*/ ctx[1]) {
    				set_input_value(input, /*inputString*/ ctx[1]);
    			}

    			if (dirty & /*presetConsole*/ 4) set_data_dev(t7, /*presetConsole*/ ctx[2]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			/*input_binding*/ ctx[8](null);
    			mounted = false;
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
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Sidebar', slots, []);
    	const dispatch = createEventDispatcher();
    	let { presetString = "" } = $$props;
    	let { presetSaving = false } = $$props;
    	let inputObject;
    	let inputString = " paste preset here";
    	let presetConsole = "click save to copy preset to clipboard";

    	function doLoad() {
    		if (inputString[0] == '{') {
    			$$invalidate(5, presetString = inputString);
    			$$invalidate(2, presetConsole = "loaded from text input!");

    			setTimeout(
    				() => {
    					$$invalidate(2, presetConsole = "click save to copy current preset to clipboard");
    				},
    				"3000"
    			);
    		} else {
    			$$invalidate(2, presetConsole = "sorry, invalid format!");

    			setTimeout(
    				() => {
    					$$invalidate(2, presetConsole = "click save to copy current preset to clipboard");
    				},
    				"3000"
    			);
    		}
    	}

    	function doSave() {
    		$$invalidate(6, presetSaving = true);
    		$$invalidate(2, presetConsole = "copied to clipboard!");

    		setTimeout(
    			() => {
    				$$invalidate(6, presetSaving = false);
    				$$invalidate(2, presetConsole = "click save to copy current preset to clipboard");
    			},
    			"3000"
    		);
    	}

    	const writable_props = ['presetString', 'presetSaving'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Sidebar> was created with unknown prop '${key}'`);
    	});

    	function input_input_handler() {
    		inputString = this.value;
    		$$invalidate(1, inputString);
    	}

    	function input_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			inputObject = $$value;
    			$$invalidate(0, inputObject);
    		});
    	}

    	const focus_handler = () => {
    		inputObject.select();
    	};

    	const click_handler = () => {
    		let mypreset = {
    			"ghost_A": false,
    			"ghost_fg": true,
    			"ghost_bg": false,
    			"ghost_capture": false,
    			"ghost_threshold": 30,
    			"ghost_fg_hex": "#ffffff",
    			"ghost_bg_hex": "#000000",
    			"pixel_A": true,
    			"pixel_chunkSize": 6,
    			"filter_A": true,
    			"filter_temp": 51,
    			"filter_saturate": 63,
    			"filter_bright": 58,
    			"movey_A": false,
    			"movey_fg": true,
    			"movey_bg": false,
    			"movey_trail": false,
    			"movey_length": 10,
    			"movey_threshold": 40,
    			"movey_fg_hex": "#ffffff",
    			"movey_bg_hex": "#000000",
    			"poster_A": true,
    			"poster_threshold": 143,
    			"poster_maxvalue": 100
    		};

    		$$invalidate(1, inputString = JSON.stringify(mypreset));
    		doLoad();
    	};

    	const click_handler_1 = () => {
    		let mypreset = {
    			"ghost_A": false,
    			"ghost_fg": true,
    			"ghost_bg": false,
    			"ghost_capture": false,
    			"ghost_threshold": 30,
    			"ghost_fg_hex": "#ffffff",
    			"ghost_bg_hex": "#000000",
    			"pixel_A": false,
    			"pixel_chunkSize": 3,
    			"filter_A": false,
    			"filter_temp": 50,
    			"filter_saturate": 50,
    			"filter_bright": 50,
    			"movey_A": true,
    			"movey_fg": true,
    			"movey_bg": true,
    			"movey_trail": true,
    			"movey_length": 10,
    			"movey_threshold": 40,
    			"movey_fg_hex": "#af65ec",
    			"movey_bg_hex": "#d8d2da",
    			"poster_A": false,
    			"poster_threshold": 120,
    			"poster_maxvalue": 150
    		};

    		$$invalidate(1, inputString = JSON.stringify(mypreset));
    		doLoad();
    	};

    	const click_handler_2 = () => {
    		let mypreset = {
    			"ghost_A": true,
    			"ghost_fg": false,
    			"ghost_bg": true,
    			"ghost_capture": false,
    			"ghost_threshold": 43,
    			"ghost_fg_hex": "#ffffff",
    			"ghost_bg_hex": "#610000",
    			"pixel_A": false,
    			"pixel_chunkSize": 10,
    			"filter_A": true,
    			"filter_temp": 36,
    			"filter_saturate": 67,
    			"filter_bright": 32,
    			"movey_A": false,
    			"movey_fg": false,
    			"movey_bg": false,
    			"movey_trail": false,
    			"movey_length": 10,
    			"movey_threshold": 40,
    			"movey_fg_hex": "#ffffff",
    			"movey_bg_hex": "#000000",
    			"poster_A": true,
    			"poster_threshold": 112,
    			"poster_maxvalue": 93
    		};

    		$$invalidate(1, inputString = JSON.stringify(mypreset));
    		doLoad();
    	};

    	$$self.$$set = $$props => {
    		if ('presetString' in $$props) $$invalidate(5, presetString = $$props.presetString);
    		if ('presetSaving' in $$props) $$invalidate(6, presetSaving = $$props.presetSaving);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		dispatch,
    		presetString,
    		presetSaving,
    		inputObject,
    		inputString,
    		presetConsole,
    		doLoad,
    		doSave
    	});

    	$$self.$inject_state = $$props => {
    		if ('presetString' in $$props) $$invalidate(5, presetString = $$props.presetString);
    		if ('presetSaving' in $$props) $$invalidate(6, presetSaving = $$props.presetSaving);
    		if ('inputObject' in $$props) $$invalidate(0, inputObject = $$props.inputObject);
    		if ('inputString' in $$props) $$invalidate(1, inputString = $$props.inputString);
    		if ('presetConsole' in $$props) $$invalidate(2, presetConsole = $$props.presetConsole);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		inputObject,
    		inputString,
    		presetConsole,
    		doLoad,
    		doSave,
    		presetString,
    		presetSaving,
    		input_input_handler,
    		input_binding,
    		focus_handler,
    		click_handler,
    		click_handler_1,
    		click_handler_2
    	];
    }

    class Sidebar extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, { presetString: 5, presetSaving: 6 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Sidebar",
    			options,
    			id: create_fragment$5.name
    		});
    	}

    	get presetString() {
    		throw new Error("<Sidebar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set presetString(value) {
    		throw new Error("<Sidebar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get presetSaving() {
    		throw new Error("<Sidebar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set presetSaving(value) {
    		throw new Error("<Sidebar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Slider.svelte generated by Svelte v3.57.0 */

    const file$4 = "src/Slider.svelte";

    function create_fragment$4(ctx) {
    	let div;
    	let input0;
    	let input0_class_value;
    	let t;
    	let input1;
    	let input1_class_value;
    	let div_class_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			input0 = element("input");
    			t = space();
    			input1 = element("input");
    			attr_dev(input0, "type", "range");
    			attr_dev(input0, "class", input0_class_value = "slider" + /*variation*/ ctx[1] + " svelte-9ucqwc");
    			attr_dev(input0, "min", /*minval*/ ctx[2]);
    			attr_dev(input0, "max", /*maxval*/ ctx[3]);
    			add_location(input0, file$4, 22, 4, 518);
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "class", input1_class_value = "param_val" + /*variation*/ ctx[1] + " svelte-9ucqwc");
    			input1.value = /*displayValue*/ ctx[4];
    			add_location(input1, file$4, 30, 1, 721);
    			attr_dev(div, "class", div_class_value = "backdrop" + /*variation*/ ctx[1] + " svelte-9ucqwc");
    			add_location(div, file$4, 21, 0, 480);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, input0);
    			set_input_value(input0, /*sliderValue*/ ctx[0]);
    			append_dev(div, t);
    			append_dev(div, input1);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*doDisplayValue*/ ctx[6], false, false, false, false),
    					listen_dev(input0, "mouseout", /*doDisplayLabel*/ ctx[7], false, false, false, false),
    					listen_dev(input0, "blur", blur_handler, false, false, false, false),
    					listen_dev(input0, "change", /*input0_change_input_handler*/ ctx[11]),
    					listen_dev(input0, "input", /*input0_change_input_handler*/ ctx[11]),
    					listen_dev(input1, "focus", /*doDisplayValue*/ ctx[6], false, false, false, false),
    					listen_dev(input1, "blur", /*handleInput*/ ctx[5], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*variation*/ 2 && input0_class_value !== (input0_class_value = "slider" + /*variation*/ ctx[1] + " svelte-9ucqwc")) {
    				attr_dev(input0, "class", input0_class_value);
    			}

    			if (dirty & /*minval*/ 4) {
    				attr_dev(input0, "min", /*minval*/ ctx[2]);
    			}

    			if (dirty & /*maxval*/ 8) {
    				attr_dev(input0, "max", /*maxval*/ ctx[3]);
    			}

    			if (dirty & /*sliderValue*/ 1) {
    				set_input_value(input0, /*sliderValue*/ ctx[0]);
    			}

    			if (dirty & /*variation*/ 2 && input1_class_value !== (input1_class_value = "param_val" + /*variation*/ ctx[1] + " svelte-9ucqwc")) {
    				attr_dev(input1, "class", input1_class_value);
    			}

    			if (dirty & /*displayValue*/ 16 && input1.value !== /*displayValue*/ ctx[4]) {
    				prop_dev(input1, "value", /*displayValue*/ ctx[4]);
    			}

    			if (dirty & /*variation*/ 2 && div_class_value !== (div_class_value = "backdrop" + /*variation*/ ctx[1] + " svelte-9ucqwc")) {
    				attr_dev(div, "class", div_class_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
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

    const blur_handler = () => {
    	
    };

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Slider', slots, []);
    	let { id } = $$props;
    	let { variation = 1 } = $$props;
    	let { label } = $$props;
    	let { minval } = $$props;
    	let { maxval } = $$props;
    	let { defval } = $$props;
    	let { sliderValue = defval } = $$props;
    	let displayValue = label;
    	id += 0; // gets rid of warning

    	const handleInput = e => {
    		$$invalidate(0, sliderValue = e.target.value);
    		doDisplayLabel();
    	};

    	const doDisplayValue = () => {
    		$$invalidate(4, displayValue = sliderValue);
    	};

    	const doDisplayLabel = () => {
    		$$invalidate(4, displayValue = label);
    	};

    	$$self.$$.on_mount.push(function () {
    		if (id === undefined && !('id' in $$props || $$self.$$.bound[$$self.$$.props['id']])) {
    			console.warn("<Slider> was created without expected prop 'id'");
    		}

    		if (label === undefined && !('label' in $$props || $$self.$$.bound[$$self.$$.props['label']])) {
    			console.warn("<Slider> was created without expected prop 'label'");
    		}

    		if (minval === undefined && !('minval' in $$props || $$self.$$.bound[$$self.$$.props['minval']])) {
    			console.warn("<Slider> was created without expected prop 'minval'");
    		}

    		if (maxval === undefined && !('maxval' in $$props || $$self.$$.bound[$$self.$$.props['maxval']])) {
    			console.warn("<Slider> was created without expected prop 'maxval'");
    		}

    		if (defval === undefined && !('defval' in $$props || $$self.$$.bound[$$self.$$.props['defval']])) {
    			console.warn("<Slider> was created without expected prop 'defval'");
    		}
    	});

    	const writable_props = ['id', 'variation', 'label', 'minval', 'maxval', 'defval', 'sliderValue'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Slider> was created with unknown prop '${key}'`);
    	});

    	function input0_change_input_handler() {
    		sliderValue = to_number(this.value);
    		$$invalidate(0, sliderValue);
    	}

    	$$self.$$set = $$props => {
    		if ('id' in $$props) $$invalidate(8, id = $$props.id);
    		if ('variation' in $$props) $$invalidate(1, variation = $$props.variation);
    		if ('label' in $$props) $$invalidate(9, label = $$props.label);
    		if ('minval' in $$props) $$invalidate(2, minval = $$props.minval);
    		if ('maxval' in $$props) $$invalidate(3, maxval = $$props.maxval);
    		if ('defval' in $$props) $$invalidate(10, defval = $$props.defval);
    		if ('sliderValue' in $$props) $$invalidate(0, sliderValue = $$props.sliderValue);
    	};

    	$$self.$capture_state = () => ({
    		id,
    		variation,
    		label,
    		minval,
    		maxval,
    		defval,
    		sliderValue,
    		displayValue,
    		handleInput,
    		doDisplayValue,
    		doDisplayLabel
    	});

    	$$self.$inject_state = $$props => {
    		if ('id' in $$props) $$invalidate(8, id = $$props.id);
    		if ('variation' in $$props) $$invalidate(1, variation = $$props.variation);
    		if ('label' in $$props) $$invalidate(9, label = $$props.label);
    		if ('minval' in $$props) $$invalidate(2, minval = $$props.minval);
    		if ('maxval' in $$props) $$invalidate(3, maxval = $$props.maxval);
    		if ('defval' in $$props) $$invalidate(10, defval = $$props.defval);
    		if ('sliderValue' in $$props) $$invalidate(0, sliderValue = $$props.sliderValue);
    		if ('displayValue' in $$props) $$invalidate(4, displayValue = $$props.displayValue);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		sliderValue,
    		variation,
    		minval,
    		maxval,
    		displayValue,
    		handleInput,
    		doDisplayValue,
    		doDisplayLabel,
    		id,
    		label,
    		defval,
    		input0_change_input_handler
    	];
    }

    class Slider extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {
    			id: 8,
    			variation: 1,
    			label: 9,
    			minval: 2,
    			maxval: 3,
    			defval: 10,
    			sliderValue: 0
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Slider",
    			options,
    			id: create_fragment$4.name
    		});
    	}

    	get id() {
    		throw new Error("<Slider>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<Slider>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get variation() {
    		throw new Error("<Slider>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set variation(value) {
    		throw new Error("<Slider>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get label() {
    		throw new Error("<Slider>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set label(value) {
    		throw new Error("<Slider>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get minval() {
    		throw new Error("<Slider>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set minval(value) {
    		throw new Error("<Slider>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get maxval() {
    		throw new Error("<Slider>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set maxval(value) {
    		throw new Error("<Slider>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get defval() {
    		throw new Error("<Slider>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set defval(value) {
    		throw new Error("<Slider>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get sliderValue() {
    		throw new Error("<Slider>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set sliderValue(value) {
    		throw new Error("<Slider>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/RadioOptions.svelte generated by Svelte v3.57.0 */

    const file$3 = "src/RadioOptions.svelte";

    function create_fragment$3(ctx) {
    	let div2;
    	let h3;
    	let t0;
    	let t1;
    	let div1;
    	let div0;
    	let t2;
    	let label0;
    	let input0;
    	let t3;
    	let t4;
    	let t5;
    	let label1;
    	let input1;
    	let t6;
    	let t7;
    	let t8;
    	let label2;
    	let input2;
    	let t9;
    	let t10;
    	let t11;
    	let label3;
    	let input3;
    	let t12;
    	let t13;
    	let binding_group;
    	let mounted;
    	let dispose;
    	binding_group = init_binding_group(/*$$binding_groups*/ ctx[8][0]);

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			h3 = element("h3");
    			t0 = text(/*id*/ ctx[1]);
    			t1 = space();
    			div1 = element("div");
    			div0 = element("div");
    			t2 = space();
    			label0 = element("label");
    			input0 = element("input");
    			t3 = space();
    			t4 = text(/*opt1*/ ctx[2]);
    			t5 = space();
    			label1 = element("label");
    			input1 = element("input");
    			t6 = space();
    			t7 = text(/*opt2*/ ctx[3]);
    			t8 = space();
    			label2 = element("label");
    			input2 = element("input");
    			t9 = space();
    			t10 = text(/*opt3*/ ctx[4]);
    			t11 = space();
    			label3 = element("label");
    			input3 = element("input");
    			t12 = space();
    			t13 = text(/*opt4*/ ctx[5]);
    			attr_dev(h3, "class", "svelte-in6cpj");
    			add_location(h3, file$3, 15, 4, 286);
    			attr_dev(div0, "class", "selected svelte-in6cpj");
    			set_style(div0, "--selectedPosition", /*selectedPosition*/ ctx[6] + "%");
    			add_location(div0, file$3, 19, 8, 336);
    			attr_dev(input0, "type", "radio");
    			attr_dev(input0, "name", /*id*/ ctx[1]);
    			input0.__value = 1;
    			input0.value = input0.__value;
    			attr_dev(input0, "class", "svelte-in6cpj");
    			add_location(input0, file$3, 22, 12, 457);
    			attr_dev(label0, "class", "option svelte-in6cpj");
    			add_location(label0, file$3, 21, 8, 422);
    			attr_dev(input1, "type", "radio");
    			attr_dev(input1, "name", /*id*/ ctx[1]);
    			input1.__value = 2;
    			input1.value = input1.__value;
    			attr_dev(input1, "class", "svelte-in6cpj");
    			add_location(input1, file$3, 27, 12, 604);
    			attr_dev(label1, "class", "option svelte-in6cpj");
    			add_location(label1, file$3, 26, 8, 569);
    			attr_dev(input2, "type", "radio");
    			attr_dev(input2, "name", /*id*/ ctx[1]);
    			input2.__value = 3;
    			input2.value = input2.__value;
    			attr_dev(input2, "class", "svelte-in6cpj");
    			add_location(input2, file$3, 32, 12, 751);
    			attr_dev(label2, "class", "option svelte-in6cpj");
    			add_location(label2, file$3, 31, 8, 716);
    			attr_dev(input3, "type", "radio");
    			attr_dev(input3, "name", /*id*/ ctx[1]);
    			input3.__value = 4;
    			input3.value = input3.__value;
    			attr_dev(input3, "class", "svelte-in6cpj");
    			add_location(input3, file$3, 37, 12, 898);
    			attr_dev(label3, "class", "option svelte-in6cpj");
    			add_location(label3, file$3, 36, 8, 863);
    			attr_dev(div1, "class", "options svelte-in6cpj");
    			add_location(div1, file$3, 17, 4, 305);
    			attr_dev(div2, "class", "backdrop svelte-in6cpj");
    			add_location(div2, file$3, 13, 0, 258);
    			binding_group.p(input0, input1, input2, input3);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, h3);
    			append_dev(h3, t0);
    			append_dev(div2, t1);
    			append_dev(div2, div1);
    			append_dev(div1, div0);
    			append_dev(div1, t2);
    			append_dev(div1, label0);
    			append_dev(label0, input0);
    			input0.checked = input0.__value === /*optionChosen*/ ctx[0];
    			append_dev(label0, t3);
    			append_dev(label0, t4);
    			append_dev(div1, t5);
    			append_dev(div1, label1);
    			append_dev(label1, input1);
    			input1.checked = input1.__value === /*optionChosen*/ ctx[0];
    			append_dev(label1, t6);
    			append_dev(label1, t7);
    			append_dev(div1, t8);
    			append_dev(div1, label2);
    			append_dev(label2, input2);
    			input2.checked = input2.__value === /*optionChosen*/ ctx[0];
    			append_dev(label2, t9);
    			append_dev(label2, t10);
    			append_dev(div1, t11);
    			append_dev(div1, label3);
    			append_dev(label3, input3);
    			input3.checked = input3.__value === /*optionChosen*/ ctx[0];
    			append_dev(label3, t12);
    			append_dev(label3, t13);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "change", /*input0_change_handler*/ ctx[7]),
    					listen_dev(input1, "change", /*input1_change_handler*/ ctx[9]),
    					listen_dev(input2, "change", /*input2_change_handler*/ ctx[10]),
    					listen_dev(input3, "change", /*input3_change_handler*/ ctx[11])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*id*/ 2) set_data_dev(t0, /*id*/ ctx[1]);

    			if (dirty & /*selectedPosition*/ 64) {
    				set_style(div0, "--selectedPosition", /*selectedPosition*/ ctx[6] + "%");
    			}

    			if (dirty & /*id*/ 2) {
    				attr_dev(input0, "name", /*id*/ ctx[1]);
    			}

    			if (dirty & /*optionChosen*/ 1) {
    				input0.checked = input0.__value === /*optionChosen*/ ctx[0];
    			}

    			if (dirty & /*opt1*/ 4) set_data_dev(t4, /*opt1*/ ctx[2]);

    			if (dirty & /*id*/ 2) {
    				attr_dev(input1, "name", /*id*/ ctx[1]);
    			}

    			if (dirty & /*optionChosen*/ 1) {
    				input1.checked = input1.__value === /*optionChosen*/ ctx[0];
    			}

    			if (dirty & /*opt2*/ 8) set_data_dev(t7, /*opt2*/ ctx[3]);

    			if (dirty & /*id*/ 2) {
    				attr_dev(input2, "name", /*id*/ ctx[1]);
    			}

    			if (dirty & /*optionChosen*/ 1) {
    				input2.checked = input2.__value === /*optionChosen*/ ctx[0];
    			}

    			if (dirty & /*opt3*/ 16) set_data_dev(t10, /*opt3*/ ctx[4]);

    			if (dirty & /*id*/ 2) {
    				attr_dev(input3, "name", /*id*/ ctx[1]);
    			}

    			if (dirty & /*optionChosen*/ 1) {
    				input3.checked = input3.__value === /*optionChosen*/ ctx[0];
    			}

    			if (dirty & /*opt4*/ 32) set_data_dev(t13, /*opt4*/ ctx[5]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			binding_group.r();
    			mounted = false;
    			run_all(dispose);
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
    	let selectedPosition;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('RadioOptions', slots, []);
    	let { id } = $$props;
    	let { opt1 } = $$props;
    	let { opt2 } = $$props;
    	let { opt3 } = $$props;
    	let { opt4 } = $$props;
    	let { optionChosen = 1 } = $$props;

    	$$self.$$.on_mount.push(function () {
    		if (id === undefined && !('id' in $$props || $$self.$$.bound[$$self.$$.props['id']])) {
    			console.warn("<RadioOptions> was created without expected prop 'id'");
    		}

    		if (opt1 === undefined && !('opt1' in $$props || $$self.$$.bound[$$self.$$.props['opt1']])) {
    			console.warn("<RadioOptions> was created without expected prop 'opt1'");
    		}

    		if (opt2 === undefined && !('opt2' in $$props || $$self.$$.bound[$$self.$$.props['opt2']])) {
    			console.warn("<RadioOptions> was created without expected prop 'opt2'");
    		}

    		if (opt3 === undefined && !('opt3' in $$props || $$self.$$.bound[$$self.$$.props['opt3']])) {
    			console.warn("<RadioOptions> was created without expected prop 'opt3'");
    		}

    		if (opt4 === undefined && !('opt4' in $$props || $$self.$$.bound[$$self.$$.props['opt4']])) {
    			console.warn("<RadioOptions> was created without expected prop 'opt4'");
    		}
    	});

    	const writable_props = ['id', 'opt1', 'opt2', 'opt3', 'opt4', 'optionChosen'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<RadioOptions> was created with unknown prop '${key}'`);
    	});

    	const $$binding_groups = [[]];

    	function input0_change_handler() {
    		optionChosen = this.__value;
    		$$invalidate(0, optionChosen);
    	}

    	function input1_change_handler() {
    		optionChosen = this.__value;
    		$$invalidate(0, optionChosen);
    	}

    	function input2_change_handler() {
    		optionChosen = this.__value;
    		$$invalidate(0, optionChosen);
    	}

    	function input3_change_handler() {
    		optionChosen = this.__value;
    		$$invalidate(0, optionChosen);
    	}

    	$$self.$$set = $$props => {
    		if ('id' in $$props) $$invalidate(1, id = $$props.id);
    		if ('opt1' in $$props) $$invalidate(2, opt1 = $$props.opt1);
    		if ('opt2' in $$props) $$invalidate(3, opt2 = $$props.opt2);
    		if ('opt3' in $$props) $$invalidate(4, opt3 = $$props.opt3);
    		if ('opt4' in $$props) $$invalidate(5, opt4 = $$props.opt4);
    		if ('optionChosen' in $$props) $$invalidate(0, optionChosen = $$props.optionChosen);
    	};

    	$$self.$capture_state = () => ({
    		id,
    		opt1,
    		opt2,
    		opt3,
    		opt4,
    		optionChosen,
    		selectedPosition
    	});

    	$$self.$inject_state = $$props => {
    		if ('id' in $$props) $$invalidate(1, id = $$props.id);
    		if ('opt1' in $$props) $$invalidate(2, opt1 = $$props.opt1);
    		if ('opt2' in $$props) $$invalidate(3, opt2 = $$props.opt2);
    		if ('opt3' in $$props) $$invalidate(4, opt3 = $$props.opt3);
    		if ('opt4' in $$props) $$invalidate(5, opt4 = $$props.opt4);
    		if ('optionChosen' in $$props) $$invalidate(0, optionChosen = $$props.optionChosen);
    		if ('selectedPosition' in $$props) $$invalidate(6, selectedPosition = $$props.selectedPosition);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*optionChosen*/ 1) {
    			// position white div based on option chosen
    			$$invalidate(6, selectedPosition = 25 * (optionChosen - 1));
    		}
    	};

    	return [
    		optionChosen,
    		id,
    		opt1,
    		opt2,
    		opt3,
    		opt4,
    		selectedPosition,
    		input0_change_handler,
    		$$binding_groups,
    		input1_change_handler,
    		input2_change_handler,
    		input3_change_handler
    	];
    }

    class RadioOptions extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {
    			id: 1,
    			opt1: 2,
    			opt2: 3,
    			opt3: 4,
    			opt4: 5,
    			optionChosen: 0
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "RadioOptions",
    			options,
    			id: create_fragment$3.name
    		});
    	}

    	get id() {
    		throw new Error("<RadioOptions>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<RadioOptions>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get opt1() {
    		throw new Error("<RadioOptions>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set opt1(value) {
    		throw new Error("<RadioOptions>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get opt2() {
    		throw new Error("<RadioOptions>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set opt2(value) {
    		throw new Error("<RadioOptions>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get opt3() {
    		throw new Error("<RadioOptions>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set opt3(value) {
    		throw new Error("<RadioOptions>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get opt4() {
    		throw new Error("<RadioOptions>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set opt4(value) {
    		throw new Error("<RadioOptions>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get optionChosen() {
    		throw new Error("<RadioOptions>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set optionChosen(value) {
    		throw new Error("<RadioOptions>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Toggle.svelte generated by Svelte v3.57.0 */

    const file$2 = "src/Toggle.svelte";

    // (11:4) {:else}
    function create_else_block(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			set_style(div, "height", "1.2rem");
    			add_location(div, file$2, 11, 4, 178);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(11:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (9:4) {#if showID}
    function create_if_block$1(ctx) {
    	let h3;
    	let t;

    	const block = {
    		c: function create() {
    			h3 = element("h3");
    			t = text(/*id*/ ctx[1]);
    			attr_dev(h3, "class", "label svelte-1azwifc");
    			add_location(h3, file$2, 9, 4, 134);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h3, anchor);
    			append_dev(h3, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*id*/ 2) set_data_dev(t, /*id*/ ctx[1]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(9:4) {#if showID}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let div;
    	let t0;
    	let label;
    	let input;
    	let t1;
    	let span;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (/*showID*/ ctx[2]) return create_if_block$1;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if_block.c();
    			t0 = space();
    			label = element("label");
    			input = element("input");
    			t1 = space();
    			span = element("span");
    			attr_dev(input, "type", "checkbox");
    			attr_dev(input, "class", "svelte-1azwifc");
    			add_location(input, file$2, 15, 8, 263);
    			attr_dev(span, "class", "slider svelte-1azwifc");
    			add_location(span, file$2, 16, 8, 314);
    			attr_dev(label, "class", "switch svelte-1azwifc");
    			add_location(label, file$2, 14, 4, 232);
    			attr_dev(div, "class", "backdrop svelte-1azwifc");
    			add_location(div, file$2, 7, 0, 90);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if_block.m(div, null);
    			append_dev(div, t0);
    			append_dev(div, label);
    			append_dev(label, input);
    			input.checked = /*opt*/ ctx[0];
    			append_dev(label, t1);
    			append_dev(label, span);

    			if (!mounted) {
    				dispose = listen_dev(input, "change", /*input_change_handler*/ ctx[3]);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div, t0);
    				}
    			}

    			if (dirty & /*opt*/ 1) {
    				input.checked = /*opt*/ ctx[0];
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if_block.d();
    			mounted = false;
    			dispose();
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
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Toggle', slots, []);
    	let { id } = $$props;
    	let { showID = true } = $$props;
    	let { opt } = $$props;

    	$$self.$$.on_mount.push(function () {
    		if (id === undefined && !('id' in $$props || $$self.$$.bound[$$self.$$.props['id']])) {
    			console.warn("<Toggle> was created without expected prop 'id'");
    		}

    		if (opt === undefined && !('opt' in $$props || $$self.$$.bound[$$self.$$.props['opt']])) {
    			console.warn("<Toggle> was created without expected prop 'opt'");
    		}
    	});

    	const writable_props = ['id', 'showID', 'opt'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Toggle> was created with unknown prop '${key}'`);
    	});

    	function input_change_handler() {
    		opt = this.checked;
    		$$invalidate(0, opt);
    	}

    	$$self.$$set = $$props => {
    		if ('id' in $$props) $$invalidate(1, id = $$props.id);
    		if ('showID' in $$props) $$invalidate(2, showID = $$props.showID);
    		if ('opt' in $$props) $$invalidate(0, opt = $$props.opt);
    	};

    	$$self.$capture_state = () => ({ id, showID, opt });

    	$$self.$inject_state = $$props => {
    		if ('id' in $$props) $$invalidate(1, id = $$props.id);
    		if ('showID' in $$props) $$invalidate(2, showID = $$props.showID);
    		if ('opt' in $$props) $$invalidate(0, opt = $$props.opt);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [opt, id, showID, input_change_handler];
    }

    class Toggle extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { id: 1, showID: 2, opt: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Toggle",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get id() {
    		throw new Error("<Toggle>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<Toggle>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get showID() {
    		throw new Error("<Toggle>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set showID(value) {
    		throw new Error("<Toggle>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get opt() {
    		throw new Error("<Toggle>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set opt(value) {
    		throw new Error("<Toggle>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Control.svelte generated by Svelte v3.57.0 */
    const file$1 = "src/Control.svelte";

    // (424:8) {#if loading}
    function create_if_block_3(ctx) {
    	let h3;

    	const block = {
    		c: function create() {
    			h3 = element("h3");
    			h3.textContent = "loading...";
    			add_location(h3, file$1, 424, 8, 11449);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h3, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(424:8) {#if loading}",
    		ctx
    	});

    	return block;
    }

    // (428:8) {#if !streaming}
    function create_if_block_2(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "start";
    			attr_dev(button, "class", "button2");
    			add_location(button, file$1, 428, 8, 11525);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*init*/ ctx[34], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(428:8) {#if !streaming}",
    		ctx
    	});

    	return block;
    }

    // (443:8) {#if poster_A}
    function create_if_block_1(ctx) {
    	let canvas;
    	let canvas_style_value;

    	const block = {
    		c: function create() {
    			canvas = element("canvas");
    			attr_dev(canvas, "id", "v_out_ocv");
    			attr_dev(canvas, "width", /*wt*/ ctx[31]);
    			attr_dev(canvas, "height", /*ht*/ ctx[32]);

    			attr_dev(canvas, "style", canvas_style_value = /*viewport_showInput*/ ctx[13]
    			? "display:none"
    			: "display:block");

    			attr_dev(canvas, "class", "svelte-gdhbtl");
    			add_location(canvas, file$1, 443, 8, 12034);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, canvas, anchor);
    			/*canvas_binding*/ ctx[40](canvas);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*viewport_showInput*/ 8192 && canvas_style_value !== (canvas_style_value = /*viewport_showInput*/ ctx[13]
    			? "display:none"
    			: "display:block")) {
    				attr_dev(canvas, "style", canvas_style_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(canvas);
    			/*canvas_binding*/ ctx[40](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(443:8) {#if poster_A}",
    		ctx
    	});

    	return block;
    }

    // (462:12) {#if streaming}
    function create_if_block(ctx) {
    	let p;
    	let t0;
    	let t1;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t0 = text("FPS: ");
    			t1 = text(/*fps*/ ctx[6]);
    			attr_dev(p, "class", "fps svelte-gdhbtl");
    			add_location(p, file$1, 462, 12, 12652);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t0);
    			append_dev(p, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*fps*/ 64) set_data_dev(t1, /*fps*/ ctx[6]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(462:12) {#if streaming}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let script;
    	let script_src_value;
    	let t0;
    	let div21;
    	let div2;
    	let t1;
    	let t2;
    	let video;
    	let video_style_value;
    	let t3;
    	let canvas0;
    	let canvas0_style_value;
    	let t4;
    	let t5;
    	let canvas1;
    	let t6;
    	let div1;
    	let div0;
    	let button0;
    	let t8;
    	let t9;
    	let div4;
    	let input0;
    	let t10;
    	let label0;
    	let t11;
    	let div3;
    	let slider0;
    	let updating_sliderValue;
    	let t12;
    	let slider1;
    	let updating_sliderValue_1;
    	let t13;
    	let slider2;
    	let updating_sliderValue_2;
    	let t14;
    	let div10;
    	let input1;
    	let t15;
    	let label1;
    	let t16;
    	let div9;
    	let button1;
    	let t18;
    	let div5;
    	let t19;
    	let div8;
    	let toggle0;
    	let updating_opt;
    	let t20;
    	let div6;
    	let input2;
    	let t21;
    	let toggle1;
    	let updating_opt_1;
    	let t22;
    	let div7;
    	let input3;
    	let t23;
    	let slider3;
    	let updating_sliderValue_3;
    	let t24;
    	let div16;
    	let input4;
    	let t25;
    	let label2;
    	let t26;
    	let div15;
    	let slider4;
    	let updating_sliderValue_4;
    	let t27;
    	let toggle2;
    	let updating_opt_2;
    	let t28;
    	let div11;
    	let t29;
    	let div14;
    	let toggle3;
    	let updating_opt_3;
    	let t30;
    	let div12;
    	let input5;
    	let t31;
    	let toggle4;
    	let updating_opt_4;
    	let t32;
    	let div13;
    	let input6;
    	let t33;
    	let slider5;
    	let updating_sliderValue_5;
    	let t34;
    	let div18;
    	let input7;
    	let t35;
    	let label3;
    	let t36;
    	let div17;
    	let slider6;
    	let updating_sliderValue_6;
    	let t37;
    	let div20;
    	let input8;
    	let t38;
    	let label4;
    	let t39;
    	let div19;
    	let slider7;
    	let updating_sliderValue_7;
    	let t40;
    	let slider8;
    	let updating_sliderValue_8;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block0 = /*loading*/ ctx[11] && create_if_block_3(ctx);
    	let if_block1 = !/*streaming*/ ctx[12] && create_if_block_2(ctx);
    	let if_block2 = /*poster_A*/ ctx[28] && create_if_block_1(ctx);
    	let if_block3 = /*streaming*/ ctx[12] && create_if_block(ctx);

    	function slider0_sliderValue_binding(value) {
    		/*slider0_sliderValue_binding*/ ctx[43](value);
    	}

    	let slider0_props = {
    		id: "eff-filter-temp",
    		label: "temp",
    		minval: 0,
    		maxval: 100,
    		defval: 50
    	};

    	if (/*filter_temp*/ ctx[20] !== void 0) {
    		slider0_props.sliderValue = /*filter_temp*/ ctx[20];
    	}

    	slider0 = new Slider({ props: slider0_props, $$inline: true });
    	binding_callbacks.push(() => bind(slider0, 'sliderValue', slider0_sliderValue_binding));

    	function slider1_sliderValue_binding(value) {
    		/*slider1_sliderValue_binding*/ ctx[44](value);
    	}

    	let slider1_props = {
    		id: "eff-filter-saturate",
    		label: "saturate",
    		minval: 0,
    		maxval: 100,
    		defval: 50
    	};

    	if (/*filter_saturate*/ ctx[21] !== void 0) {
    		slider1_props.sliderValue = /*filter_saturate*/ ctx[21];
    	}

    	slider1 = new Slider({ props: slider1_props, $$inline: true });
    	binding_callbacks.push(() => bind(slider1, 'sliderValue', slider1_sliderValue_binding));

    	function slider2_sliderValue_binding(value) {
    		/*slider2_sliderValue_binding*/ ctx[45](value);
    	}

    	let slider2_props = {
    		id: "eff-filter-bright",
    		label: "bright",
    		minval: 0,
    		maxval: 100,
    		defval: 50
    	};

    	if (/*filter_bright*/ ctx[22] !== void 0) {
    		slider2_props.sliderValue = /*filter_bright*/ ctx[22];
    	}

    	slider2 = new Slider({ props: slider2_props, $$inline: true });
    	binding_callbacks.push(() => bind(slider2, 'sliderValue', slider2_sliderValue_binding));

    	function toggle0_opt_binding(value) {
    		/*toggle0_opt_binding*/ ctx[47](value);
    	}

    	let toggle0_props = { id: "fg", showID: true };

    	if (/*ghost_fg*/ ctx[15] !== void 0) {
    		toggle0_props.opt = /*ghost_fg*/ ctx[15];
    	}

    	toggle0 = new Toggle({ props: toggle0_props, $$inline: true });
    	binding_callbacks.push(() => bind(toggle0, 'opt', toggle0_opt_binding));

    	function toggle1_opt_binding(value) {
    		/*toggle1_opt_binding*/ ctx[49](value);
    	}

    	let toggle1_props = { id: "bg", showID: true };

    	if (/*ghost_bg*/ ctx[16] !== void 0) {
    		toggle1_props.opt = /*ghost_bg*/ ctx[16];
    	}

    	toggle1 = new Toggle({ props: toggle1_props, $$inline: true });
    	binding_callbacks.push(() => bind(toggle1, 'opt', toggle1_opt_binding));

    	function slider3_sliderValue_binding(value) {
    		/*slider3_sliderValue_binding*/ ctx[51](value);
    	}

    	let slider3_props = {
    		id: "eff-ghost-threshold",
    		label: "threshold",
    		minval: 10,
    		maxval: 120,
    		defval: 30
    	};

    	if (/*ghost_threshold*/ ctx[0] !== void 0) {
    		slider3_props.sliderValue = /*ghost_threshold*/ ctx[0];
    	}

    	slider3 = new Slider({ props: slider3_props, $$inline: true });
    	binding_callbacks.push(() => bind(slider3, 'sliderValue', slider3_sliderValue_binding));

    	function slider4_sliderValue_binding(value) {
    		/*slider4_sliderValue_binding*/ ctx[53](value);
    	}

    	let slider4_props = {
    		id: "eff-movey-length",
    		label: "length",
    		minval: 1,
    		maxval: 60,
    		defval: 10
    	};

    	if (/*movey_length*/ ctx[27] !== void 0) {
    		slider4_props.sliderValue = /*movey_length*/ ctx[27];
    	}

    	slider4 = new Slider({ props: slider4_props, $$inline: true });
    	binding_callbacks.push(() => bind(slider4, 'sliderValue', slider4_sliderValue_binding));

    	function toggle2_opt_binding(value) {
    		/*toggle2_opt_binding*/ ctx[54](value);
    	}

    	let toggle2_props = { id: "trail", showID: true };

    	if (/*movey_trail*/ ctx[26] !== void 0) {
    		toggle2_props.opt = /*movey_trail*/ ctx[26];
    	}

    	toggle2 = new Toggle({ props: toggle2_props, $$inline: true });
    	binding_callbacks.push(() => bind(toggle2, 'opt', toggle2_opt_binding));

    	function toggle3_opt_binding(value) {
    		/*toggle3_opt_binding*/ ctx[55](value);
    	}

    	let toggle3_props = { id: "fg", showID: true };

    	if (/*movey_fg*/ ctx[24] !== void 0) {
    		toggle3_props.opt = /*movey_fg*/ ctx[24];
    	}

    	toggle3 = new Toggle({ props: toggle3_props, $$inline: true });
    	binding_callbacks.push(() => bind(toggle3, 'opt', toggle3_opt_binding));

    	function toggle4_opt_binding(value) {
    		/*toggle4_opt_binding*/ ctx[57](value);
    	}

    	let toggle4_props = { id: "bg", showID: true };

    	if (/*movey_bg*/ ctx[25] !== void 0) {
    		toggle4_props.opt = /*movey_bg*/ ctx[25];
    	}

    	toggle4 = new Toggle({ props: toggle4_props, $$inline: true });
    	binding_callbacks.push(() => bind(toggle4, 'opt', toggle4_opt_binding));

    	function slider5_sliderValue_binding(value) {
    		/*slider5_sliderValue_binding*/ ctx[59](value);
    	}

    	let slider5_props = {
    		id: "eff-movey-threshold",
    		label: "threshold",
    		minval: 10,
    		maxval: 120,
    		defval: 40
    	};

    	if (/*movey_threshold*/ ctx[3] !== void 0) {
    		slider5_props.sliderValue = /*movey_threshold*/ ctx[3];
    	}

    	slider5 = new Slider({ props: slider5_props, $$inline: true });
    	binding_callbacks.push(() => bind(slider5, 'sliderValue', slider5_sliderValue_binding));

    	function slider6_sliderValue_binding(value) {
    		/*slider6_sliderValue_binding*/ ctx[61](value);
    	}

    	let slider6_props = {
    		id: "eff-pixel-resolution",
    		label: "resolution",
    		minval: 3,
    		maxval: 20,
    		defval: 3
    	};

    	if (/*pixel_chunkSize*/ ctx[18] !== void 0) {
    		slider6_props.sliderValue = /*pixel_chunkSize*/ ctx[18];
    	}

    	slider6 = new Slider({ props: slider6_props, $$inline: true });
    	binding_callbacks.push(() => bind(slider6, 'sliderValue', slider6_sliderValue_binding));

    	function slider7_sliderValue_binding(value) {
    		/*slider7_sliderValue_binding*/ ctx[63](value);
    	}

    	let slider7_props = {
    		id: "eff-poster-threshold",
    		label: "threshold",
    		minval: 30,
    		maxval: 250,
    		defval: 120
    	};

    	if (/*poster_threshold*/ ctx[29] !== void 0) {
    		slider7_props.sliderValue = /*poster_threshold*/ ctx[29];
    	}

    	slider7 = new Slider({ props: slider7_props, $$inline: true });
    	binding_callbacks.push(() => bind(slider7, 'sliderValue', slider7_sliderValue_binding));

    	function slider8_sliderValue_binding(value) {
    		/*slider8_sliderValue_binding*/ ctx[64](value);
    	}

    	let slider8_props = {
    		id: "eff-poster-maxvalue",
    		label: "opacity",
    		minval: 0,
    		maxval: 255,
    		defval: 150
    	};

    	if (/*poster_maxvalue*/ ctx[30] !== void 0) {
    		slider8_props.sliderValue = /*poster_maxvalue*/ ctx[30];
    	}

    	slider8 = new Slider({ props: slider8_props, $$inline: true });
    	binding_callbacks.push(() => bind(slider8, 'sliderValue', slider8_sliderValue_binding));

    	const block = {
    		c: function create() {
    			script = element("script");
    			t0 = space();
    			div21 = element("div");
    			div2 = element("div");
    			if (if_block0) if_block0.c();
    			t1 = space();
    			if (if_block1) if_block1.c();
    			t2 = space();
    			video = element("video");
    			t3 = space();
    			canvas0 = element("canvas");
    			t4 = space();
    			if (if_block2) if_block2.c();
    			t5 = space();
    			canvas1 = element("canvas");
    			t6 = space();
    			div1 = element("div");
    			div0 = element("div");
    			button0 = element("button");
    			button0.textContent = "Bypass";
    			t8 = space();
    			if (if_block3) if_block3.c();
    			t9 = space();
    			div4 = element("div");
    			input0 = element("input");
    			t10 = space();
    			label0 = element("label");
    			t11 = space();
    			div3 = element("div");
    			create_component(slider0.$$.fragment);
    			t12 = space();
    			create_component(slider1.$$.fragment);
    			t13 = space();
    			create_component(slider2.$$.fragment);
    			t14 = space();
    			div10 = element("div");
    			input1 = element("input");
    			t15 = space();
    			label1 = element("label");
    			t16 = space();
    			div9 = element("div");
    			button1 = element("button");
    			button1.textContent = "capture";
    			t18 = space();
    			div5 = element("div");
    			t19 = space();
    			div8 = element("div");
    			create_component(toggle0.$$.fragment);
    			t20 = space();
    			div6 = element("div");
    			input2 = element("input");
    			t21 = space();
    			create_component(toggle1.$$.fragment);
    			t22 = space();
    			div7 = element("div");
    			input3 = element("input");
    			t23 = space();
    			create_component(slider3.$$.fragment);
    			t24 = space();
    			div16 = element("div");
    			input4 = element("input");
    			t25 = space();
    			label2 = element("label");
    			t26 = space();
    			div15 = element("div");
    			create_component(slider4.$$.fragment);
    			t27 = space();
    			create_component(toggle2.$$.fragment);
    			t28 = space();
    			div11 = element("div");
    			t29 = space();
    			div14 = element("div");
    			create_component(toggle3.$$.fragment);
    			t30 = space();
    			div12 = element("div");
    			input5 = element("input");
    			t31 = space();
    			create_component(toggle4.$$.fragment);
    			t32 = space();
    			div13 = element("div");
    			input6 = element("input");
    			t33 = space();
    			create_component(slider5.$$.fragment);
    			t34 = space();
    			div18 = element("div");
    			input7 = element("input");
    			t35 = space();
    			label3 = element("label");
    			t36 = space();
    			div17 = element("div");
    			create_component(slider6.$$.fragment);
    			t37 = space();
    			div20 = element("div");
    			input8 = element("input");
    			t38 = space();
    			label4 = element("label");
    			t39 = space();
    			div19 = element("div");
    			create_component(slider7.$$.fragment);
    			t40 = space();
    			create_component(slider8.$$.fragment);
    			if (!src_url_equal(script.src, script_src_value = "https://docs.opencv.org/3.4.0/opencv.js")) attr_dev(script, "src", script_src_value);
    			add_location(script, file$1, 1, 1, 15);
    			attr_dev(video, "id", "v_in");
    			attr_dev(video, "width", /*wt*/ ctx[31]);
    			attr_dev(video, "height", /*ht*/ ctx[32]);

    			attr_dev(video, "style", video_style_value = /*viewport_showInput*/ ctx[13]
    			? "display:block"
    			: "display:none");

    			add_location(video, file$1, 432, 8, 11657);
    			attr_dev(canvas0, "id", "v_out");
    			attr_dev(canvas0, "width", /*wt*/ ctx[31]);
    			attr_dev(canvas0, "height", /*ht*/ ctx[32]);

    			attr_dev(canvas0, "style", canvas0_style_value = /*viewport_showInput*/ ctx[13]
    			? "display:none"
    			: "display:block");

    			add_location(canvas0, file$1, 437, 8, 11838);
    			attr_dev(canvas1, "width", /*wt*/ ctx[31]);
    			attr_dev(canvas1, "height", /*ht*/ ctx[32]);
    			set_style(canvas1, "display", "none");
    			add_location(canvas1, file$1, 449, 8, 12237);
    			attr_dev(button0, "class", "button1-2");
    			add_location(button0, file$1, 458, 16, 12531);
    			attr_dev(div0, "class", "button-controller svelte-gdhbtl");
    			add_location(div0, file$1, 456, 12, 12396);
    			attr_dev(div1, "class", "controller svelte-gdhbtl");
    			add_location(div1, file$1, 454, 8, 12358);
    			attr_dev(div2, "class", "viewport svelte-gdhbtl");
    			set_style(div2, "grid-area", "1 / 1 / 2 / 3");
    			add_location(div2, file$1, 422, 4, 11363);
    			attr_dev(input0, "class", "effect-toggle svelte-gdhbtl");
    			attr_dev(input0, "type", "checkbox");
    			attr_dev(input0, "id", "tgl-filter");
    			add_location(input0, file$1, 469, 8, 12810);
    			attr_dev(label0, "class", "tgl-btn svelte-gdhbtl");
    			attr_dev(label0, "for", "tgl-filter");
    			attr_dev(label0, "data-tg-off", "filter");
    			attr_dev(label0, "data-tg-on", "filter!");
    			add_location(label0, file$1, 471, 8, 12921);
    			attr_dev(div3, "class", "effect-inner svelte-gdhbtl");
    			add_location(div3, file$1, 473, 8, 13032);
    			attr_dev(div4, "class", "effect svelte-gdhbtl");
    			attr_dev(div4, "id", "eff-filter");
    			set_style(div4, "grid-area", "2 / 1 / 3 / 3");
    			add_location(div4, file$1, 468, 4, 12732);
    			attr_dev(input1, "class", "effect-toggle svelte-gdhbtl");
    			attr_dev(input1, "type", "checkbox");
    			attr_dev(input1, "id", "tgl-ghost");
    			add_location(input1, file$1, 499, 8, 13845);
    			attr_dev(label1, "class", "tgl-btn svelte-gdhbtl");
    			attr_dev(label1, "for", "tgl-ghost");
    			attr_dev(label1, "data-tg-off", "ghost");
    			attr_dev(label1, "data-tg-on", "ghost!");
    			add_location(label1, file$1, 501, 8, 13954);
    			attr_dev(button1, "class", "button3");
    			add_location(button1, file$1, 504, 12, 14101);
    			attr_dev(div5, "class", "divider svelte-gdhbtl");
    			add_location(div5, file$1, 506, 12, 14182);
    			attr_dev(input2, "type", "color");
    			attr_dev(input2, "class", "svelte-gdhbtl");
    			add_location(input2, file$1, 514, 20, 14447);
    			attr_dev(div6, "class", "color-container svelte-gdhbtl");
    			add_location(div6, file$1, 513, 16, 14397);
    			attr_dev(input3, "type", "color");
    			attr_dev(input3, "class", "svelte-gdhbtl");
    			add_location(input3, file$1, 523, 20, 14759);
    			attr_dev(div7, "class", "color-container svelte-gdhbtl");
    			add_location(div7, file$1, 522, 16, 14709);
    			attr_dev(div8, "class", "ghost-container svelte-gdhbtl");
    			add_location(div8, file$1, 508, 12, 14223);
    			attr_dev(div9, "class", "effect-inner svelte-gdhbtl");
    			add_location(div9, file$1, 503, 8, 14062);
    			attr_dev(div10, "class", "effect svelte-gdhbtl");
    			attr_dev(div10, "id", "eff-ghost");
    			set_style(div10, "grid-area", "1 / 3 / 2 / 5");
    			add_location(div10, file$1, 498, 4, 13768);
    			attr_dev(input4, "class", "effect-toggle svelte-gdhbtl");
    			attr_dev(input4, "type", "checkbox");
    			attr_dev(input4, "id", "tgl-movey");
    			add_location(input4, file$1, 553, 8, 15688);
    			attr_dev(label2, "class", "tgl-btn svelte-gdhbtl");
    			attr_dev(label2, "for", "tgl-movey");
    			attr_dev(label2, "data-tg-off", "movey");
    			attr_dev(label2, "data-tg-on", "movey!");
    			add_location(label2, file$1, 555, 8, 15797);
    			attr_dev(div11, "class", "divider svelte-gdhbtl");
    			add_location(div11, file$1, 570, 12, 16286);
    			attr_dev(input5, "type", "color");
    			attr_dev(input5, "class", "svelte-gdhbtl");
    			add_location(input5, file$1, 578, 20, 16563);
    			attr_dev(div12, "class", "color-container svelte-gdhbtl");
    			add_location(div12, file$1, 577, 16, 16513);
    			attr_dev(input6, "type", "color");
    			attr_dev(input6, "class", "svelte-gdhbtl");
    			add_location(input6, file$1, 587, 20, 16875);
    			attr_dev(div13, "class", "color-container svelte-gdhbtl");
    			add_location(div13, file$1, 586, 16, 16825);
    			attr_dev(div14, "class", "movey-container svelte-gdhbtl");
    			add_location(div14, file$1, 572, 12, 16339);
    			attr_dev(div15, "class", "effect-inner svelte-gdhbtl");
    			add_location(div15, file$1, 557, 8, 15905);
    			attr_dev(div16, "class", "effect svelte-gdhbtl");
    			attr_dev(div16, "id", "eff-movey");
    			set_style(div16, "grid-area", "2 / 3 / 3 / 5");
    			add_location(div16, file$1, 552, 4, 15611);
    			attr_dev(input7, "class", "effect-toggle svelte-gdhbtl");
    			attr_dev(input7, "type", "checkbox");
    			attr_dev(input7, "id", "tgl-pixel");
    			add_location(input7, file$1, 603, 8, 17354);
    			attr_dev(label3, "class", "tgl-btn svelte-gdhbtl");
    			attr_dev(label3, "for", "tgl-pixel");
    			attr_dev(label3, "data-tg-off", "pixel");
    			attr_dev(label3, "data-tg-on", "pixel!");
    			add_location(label3, file$1, 605, 8, 17463);
    			attr_dev(div17, "class", "effect-inner svelte-gdhbtl");
    			add_location(div17, file$1, 607, 8, 17571);
    			attr_dev(div18, "class", "effect svelte-gdhbtl");
    			attr_dev(div18, "id", "eff-pixel");
    			set_style(div18, "grid-area", "1 / 5 / 2 / 6");
    			add_location(div18, file$1, 602, 4, 17277);
    			attr_dev(input8, "class", "effect-toggle svelte-gdhbtl");
    			attr_dev(input8, "type", "checkbox");
    			attr_dev(input8, "id", "tgl-poster");
    			add_location(input8, file$1, 619, 8, 17940);
    			attr_dev(label4, "class", "tgl-btn svelte-gdhbtl");
    			attr_dev(label4, "for", "tgl-poster");
    			attr_dev(label4, "data-tg-off", "poster");
    			attr_dev(label4, "data-tg-on", "poster!");
    			add_location(label4, file$1, 621, 8, 18051);
    			attr_dev(div19, "class", "effect-inner svelte-gdhbtl");
    			add_location(div19, file$1, 623, 8, 18162);
    			attr_dev(div20, "class", "effect svelte-gdhbtl");
    			attr_dev(div20, "id", "eff-poster");
    			set_style(div20, "grid-area", "2 / 5 / 3 / 6");
    			add_location(div20, file$1, 618, 4, 17862);
    			attr_dev(div21, "class", "backdrop svelte-gdhbtl");
    			add_location(div21, file$1, 420, 0, 11335);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			append_dev(document.head, script);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div21, anchor);
    			append_dev(div21, div2);
    			if (if_block0) if_block0.m(div2, null);
    			append_dev(div2, t1);
    			if (if_block1) if_block1.m(div2, null);
    			append_dev(div2, t2);
    			append_dev(div2, video);
    			/*video_binding*/ ctx[38](video);
    			append_dev(div2, t3);
    			append_dev(div2, canvas0);
    			/*canvas0_binding*/ ctx[39](canvas0);
    			append_dev(div2, t4);
    			if (if_block2) if_block2.m(div2, null);
    			append_dev(div2, t5);
    			append_dev(div2, canvas1);
    			/*canvas1_binding*/ ctx[41](canvas1);
    			append_dev(div2, t6);
    			append_dev(div2, div1);
    			append_dev(div1, div0);
    			append_dev(div0, button0);
    			append_dev(div1, t8);
    			if (if_block3) if_block3.m(div1, null);
    			append_dev(div21, t9);
    			append_dev(div21, div4);
    			append_dev(div4, input0);
    			input0.checked = /*filter_A*/ ctx[19];
    			append_dev(div4, t10);
    			append_dev(div4, label0);
    			append_dev(div4, t11);
    			append_dev(div4, div3);
    			mount_component(slider0, div3, null);
    			append_dev(div3, t12);
    			mount_component(slider1, div3, null);
    			append_dev(div3, t13);
    			mount_component(slider2, div3, null);
    			append_dev(div21, t14);
    			append_dev(div21, div10);
    			append_dev(div10, input1);
    			input1.checked = /*ghost_A*/ ctx[14];
    			append_dev(div10, t15);
    			append_dev(div10, label1);
    			append_dev(div10, t16);
    			append_dev(div10, div9);
    			append_dev(div9, button1);
    			append_dev(div9, t18);
    			append_dev(div9, div5);
    			append_dev(div9, t19);
    			append_dev(div9, div8);
    			mount_component(toggle0, div8, null);
    			append_dev(div8, t20);
    			append_dev(div8, div6);
    			append_dev(div6, input2);
    			set_input_value(input2, /*ghost_fg_hex*/ ctx[1]);
    			append_dev(div8, t21);
    			mount_component(toggle1, div8, null);
    			append_dev(div8, t22);
    			append_dev(div8, div7);
    			append_dev(div7, input3);
    			set_input_value(input3, /*ghost_bg_hex*/ ctx[2]);
    			append_dev(div9, t23);
    			mount_component(slider3, div9, null);
    			append_dev(div21, t24);
    			append_dev(div21, div16);
    			append_dev(div16, input4);
    			input4.checked = /*movey_A*/ ctx[23];
    			append_dev(div16, t25);
    			append_dev(div16, label2);
    			append_dev(div16, t26);
    			append_dev(div16, div15);
    			mount_component(slider4, div15, null);
    			append_dev(div15, t27);
    			mount_component(toggle2, div15, null);
    			append_dev(div15, t28);
    			append_dev(div15, div11);
    			append_dev(div15, t29);
    			append_dev(div15, div14);
    			mount_component(toggle3, div14, null);
    			append_dev(div14, t30);
    			append_dev(div14, div12);
    			append_dev(div12, input5);
    			set_input_value(input5, /*movey_fg_hex*/ ctx[4]);
    			append_dev(div14, t31);
    			mount_component(toggle4, div14, null);
    			append_dev(div14, t32);
    			append_dev(div14, div13);
    			append_dev(div13, input6);
    			set_input_value(input6, /*movey_bg_hex*/ ctx[5]);
    			append_dev(div15, t33);
    			mount_component(slider5, div15, null);
    			append_dev(div21, t34);
    			append_dev(div21, div18);
    			append_dev(div18, input7);
    			input7.checked = /*pixel_A*/ ctx[17];
    			append_dev(div18, t35);
    			append_dev(div18, label3);
    			append_dev(div18, t36);
    			append_dev(div18, div17);
    			mount_component(slider6, div17, null);
    			append_dev(div21, t37);
    			append_dev(div21, div20);
    			append_dev(div20, input8);
    			input8.checked = /*poster_A*/ ctx[28];
    			append_dev(div20, t38);
    			append_dev(div20, label4);
    			append_dev(div20, t39);
    			append_dev(div20, div19);
    			mount_component(slider7, div19, null);
    			append_dev(div19, t40);
    			mount_component(slider8, div19, null);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(script, "load", /*init*/ ctx[34], false, false, false, false),
    					listen_dev(button0, "click", /*doTrade*/ ctx[35], false, false, false, false),
    					listen_dev(input0, "change", /*input0_change_handler*/ ctx[42]),
    					listen_dev(input1, "change", /*input1_change_handler*/ ctx[46]),
    					listen_dev(button1, "click", /*ghost_doCapture*/ ctx[33], false, false, false, false),
    					listen_dev(input2, "input", /*input2_input_handler*/ ctx[48]),
    					listen_dev(input3, "input", /*input3_input_handler*/ ctx[50]),
    					listen_dev(input4, "change", /*input4_change_handler*/ ctx[52]),
    					listen_dev(input5, "input", /*input5_input_handler*/ ctx[56]),
    					listen_dev(input6, "input", /*input6_input_handler*/ ctx[58]),
    					listen_dev(input7, "change", /*input7_change_handler*/ ctx[60]),
    					listen_dev(input8, "change", /*input8_change_handler*/ ctx[62])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (/*loading*/ ctx[11]) {
    				if (if_block0) ; else {
    					if_block0 = create_if_block_3(ctx);
    					if_block0.c();
    					if_block0.m(div2, t1);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (!/*streaming*/ ctx[12]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_2(ctx);
    					if_block1.c();
    					if_block1.m(div2, t2);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (!current || dirty[0] & /*viewport_showInput*/ 8192 && video_style_value !== (video_style_value = /*viewport_showInput*/ ctx[13]
    			? "display:block"
    			: "display:none")) {
    				attr_dev(video, "style", video_style_value);
    			}

    			if (!current || dirty[0] & /*viewport_showInput*/ 8192 && canvas0_style_value !== (canvas0_style_value = /*viewport_showInput*/ ctx[13]
    			? "display:none"
    			: "display:block")) {
    				attr_dev(canvas0, "style", canvas0_style_value);
    			}

    			if (/*poster_A*/ ctx[28]) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block_1(ctx);
    					if_block2.c();
    					if_block2.m(div2, t5);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (/*streaming*/ ctx[12]) {
    				if (if_block3) {
    					if_block3.p(ctx, dirty);
    				} else {
    					if_block3 = create_if_block(ctx);
    					if_block3.c();
    					if_block3.m(div1, null);
    				}
    			} else if (if_block3) {
    				if_block3.d(1);
    				if_block3 = null;
    			}

    			if (dirty[0] & /*filter_A*/ 524288) {
    				input0.checked = /*filter_A*/ ctx[19];
    			}

    			const slider0_changes = {};

    			if (!updating_sliderValue && dirty[0] & /*filter_temp*/ 1048576) {
    				updating_sliderValue = true;
    				slider0_changes.sliderValue = /*filter_temp*/ ctx[20];
    				add_flush_callback(() => updating_sliderValue = false);
    			}

    			slider0.$set(slider0_changes);
    			const slider1_changes = {};

    			if (!updating_sliderValue_1 && dirty[0] & /*filter_saturate*/ 2097152) {
    				updating_sliderValue_1 = true;
    				slider1_changes.sliderValue = /*filter_saturate*/ ctx[21];
    				add_flush_callback(() => updating_sliderValue_1 = false);
    			}

    			slider1.$set(slider1_changes);
    			const slider2_changes = {};

    			if (!updating_sliderValue_2 && dirty[0] & /*filter_bright*/ 4194304) {
    				updating_sliderValue_2 = true;
    				slider2_changes.sliderValue = /*filter_bright*/ ctx[22];
    				add_flush_callback(() => updating_sliderValue_2 = false);
    			}

    			slider2.$set(slider2_changes);

    			if (dirty[0] & /*ghost_A*/ 16384) {
    				input1.checked = /*ghost_A*/ ctx[14];
    			}

    			const toggle0_changes = {};

    			if (!updating_opt && dirty[0] & /*ghost_fg*/ 32768) {
    				updating_opt = true;
    				toggle0_changes.opt = /*ghost_fg*/ ctx[15];
    				add_flush_callback(() => updating_opt = false);
    			}

    			toggle0.$set(toggle0_changes);

    			if (dirty[0] & /*ghost_fg_hex*/ 2) {
    				set_input_value(input2, /*ghost_fg_hex*/ ctx[1]);
    			}

    			const toggle1_changes = {};

    			if (!updating_opt_1 && dirty[0] & /*ghost_bg*/ 65536) {
    				updating_opt_1 = true;
    				toggle1_changes.opt = /*ghost_bg*/ ctx[16];
    				add_flush_callback(() => updating_opt_1 = false);
    			}

    			toggle1.$set(toggle1_changes);

    			if (dirty[0] & /*ghost_bg_hex*/ 4) {
    				set_input_value(input3, /*ghost_bg_hex*/ ctx[2]);
    			}

    			const slider3_changes = {};

    			if (!updating_sliderValue_3 && dirty[0] & /*ghost_threshold*/ 1) {
    				updating_sliderValue_3 = true;
    				slider3_changes.sliderValue = /*ghost_threshold*/ ctx[0];
    				add_flush_callback(() => updating_sliderValue_3 = false);
    			}

    			slider3.$set(slider3_changes);

    			if (dirty[0] & /*movey_A*/ 8388608) {
    				input4.checked = /*movey_A*/ ctx[23];
    			}

    			const slider4_changes = {};

    			if (!updating_sliderValue_4 && dirty[0] & /*movey_length*/ 134217728) {
    				updating_sliderValue_4 = true;
    				slider4_changes.sliderValue = /*movey_length*/ ctx[27];
    				add_flush_callback(() => updating_sliderValue_4 = false);
    			}

    			slider4.$set(slider4_changes);
    			const toggle2_changes = {};

    			if (!updating_opt_2 && dirty[0] & /*movey_trail*/ 67108864) {
    				updating_opt_2 = true;
    				toggle2_changes.opt = /*movey_trail*/ ctx[26];
    				add_flush_callback(() => updating_opt_2 = false);
    			}

    			toggle2.$set(toggle2_changes);
    			const toggle3_changes = {};

    			if (!updating_opt_3 && dirty[0] & /*movey_fg*/ 16777216) {
    				updating_opt_3 = true;
    				toggle3_changes.opt = /*movey_fg*/ ctx[24];
    				add_flush_callback(() => updating_opt_3 = false);
    			}

    			toggle3.$set(toggle3_changes);

    			if (dirty[0] & /*movey_fg_hex*/ 16) {
    				set_input_value(input5, /*movey_fg_hex*/ ctx[4]);
    			}

    			const toggle4_changes = {};

    			if (!updating_opt_4 && dirty[0] & /*movey_bg*/ 33554432) {
    				updating_opt_4 = true;
    				toggle4_changes.opt = /*movey_bg*/ ctx[25];
    				add_flush_callback(() => updating_opt_4 = false);
    			}

    			toggle4.$set(toggle4_changes);

    			if (dirty[0] & /*movey_bg_hex*/ 32) {
    				set_input_value(input6, /*movey_bg_hex*/ ctx[5]);
    			}

    			const slider5_changes = {};

    			if (!updating_sliderValue_5 && dirty[0] & /*movey_threshold*/ 8) {
    				updating_sliderValue_5 = true;
    				slider5_changes.sliderValue = /*movey_threshold*/ ctx[3];
    				add_flush_callback(() => updating_sliderValue_5 = false);
    			}

    			slider5.$set(slider5_changes);

    			if (dirty[0] & /*pixel_A*/ 131072) {
    				input7.checked = /*pixel_A*/ ctx[17];
    			}

    			const slider6_changes = {};

    			if (!updating_sliderValue_6 && dirty[0] & /*pixel_chunkSize*/ 262144) {
    				updating_sliderValue_6 = true;
    				slider6_changes.sliderValue = /*pixel_chunkSize*/ ctx[18];
    				add_flush_callback(() => updating_sliderValue_6 = false);
    			}

    			slider6.$set(slider6_changes);

    			if (dirty[0] & /*poster_A*/ 268435456) {
    				input8.checked = /*poster_A*/ ctx[28];
    			}

    			const slider7_changes = {};

    			if (!updating_sliderValue_7 && dirty[0] & /*poster_threshold*/ 536870912) {
    				updating_sliderValue_7 = true;
    				slider7_changes.sliderValue = /*poster_threshold*/ ctx[29];
    				add_flush_callback(() => updating_sliderValue_7 = false);
    			}

    			slider7.$set(slider7_changes);
    			const slider8_changes = {};

    			if (!updating_sliderValue_8 && dirty[0] & /*poster_maxvalue*/ 1073741824) {
    				updating_sliderValue_8 = true;
    				slider8_changes.sliderValue = /*poster_maxvalue*/ ctx[30];
    				add_flush_callback(() => updating_sliderValue_8 = false);
    			}

    			slider8.$set(slider8_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(slider0.$$.fragment, local);
    			transition_in(slider1.$$.fragment, local);
    			transition_in(slider2.$$.fragment, local);
    			transition_in(toggle0.$$.fragment, local);
    			transition_in(toggle1.$$.fragment, local);
    			transition_in(slider3.$$.fragment, local);
    			transition_in(slider4.$$.fragment, local);
    			transition_in(toggle2.$$.fragment, local);
    			transition_in(toggle3.$$.fragment, local);
    			transition_in(toggle4.$$.fragment, local);
    			transition_in(slider5.$$.fragment, local);
    			transition_in(slider6.$$.fragment, local);
    			transition_in(slider7.$$.fragment, local);
    			transition_in(slider8.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(slider0.$$.fragment, local);
    			transition_out(slider1.$$.fragment, local);
    			transition_out(slider2.$$.fragment, local);
    			transition_out(toggle0.$$.fragment, local);
    			transition_out(toggle1.$$.fragment, local);
    			transition_out(slider3.$$.fragment, local);
    			transition_out(slider4.$$.fragment, local);
    			transition_out(toggle2.$$.fragment, local);
    			transition_out(toggle3.$$.fragment, local);
    			transition_out(toggle4.$$.fragment, local);
    			transition_out(slider5.$$.fragment, local);
    			transition_out(slider6.$$.fragment, local);
    			transition_out(slider7.$$.fragment, local);
    			transition_out(slider8.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			detach_dev(script);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div21);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			/*video_binding*/ ctx[38](null);
    			/*canvas0_binding*/ ctx[39](null);
    			if (if_block2) if_block2.d();
    			/*canvas1_binding*/ ctx[41](null);
    			if (if_block3) if_block3.d();
    			destroy_component(slider0);
    			destroy_component(slider1);
    			destroy_component(slider2);
    			destroy_component(toggle0);
    			destroy_component(toggle1);
    			destroy_component(slider3);
    			destroy_component(slider4);
    			destroy_component(toggle2);
    			destroy_component(toggle3);
    			destroy_component(toggle4);
    			destroy_component(slider5);
    			destroy_component(slider6);
    			destroy_component(slider7);
    			destroy_component(slider8);
    			mounted = false;
    			run_all(dispose);
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

    function hextorgb(hexval) {
    	let result = (/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i).exec(hexval);

    	return result
    	? {
    			r: parseInt(result[1], 16),
    			g: parseInt(result[2], 16),
    			b: parseInt(result[3], 16)
    		}
    	: null;
    }

    function doPopout() {
    	
    }

    // used for movey
    function distSq(x1, y1, z1, x2, y2, z2) {
    	return (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1) + (z2 - z1) * (z2 - z1);
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let gThreshold;
    	let ghost_fg_rgb;
    	let ghost_bg_rgb;
    	let mThreshold;
    	let movey_fg_rgb;
    	let movey_bg_rgb;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Control', slots, []);
    	let { presetString } = $$props;
    	let { presetSaving } = $$props;
    	const wt = 320 * 1.2;
    	const ht = 240 * 1.2;
    	let fps = 30;
    	let delay = 0;
    	let iter = 0;
    	let v_in;
    	let v_out = null;
    	let v_out_ocv = null;
    	let v_out_ctx;
    	let v_out_ctx_ocv;
    	let v_temp = null;
    	let v_temp_ctx;
    	let ocv_mat_src;
    	let ocv_mat_tmp1;
    	let ocv_mat_dst;
    	let ocv_mask;
    	let ocv_fgbg;
    	let frame;
    	let loading = false;
    	let streaming = false;

    	// changed by trade button, defaults to show output
    	let viewport_showInput = false;

    	// -----------------
    	// Queue
    	// 
    	// FIFO queue for use in ghost effect
    	// -----------------
    	class Queue {
    		constructor() {
    			this.frames = {};
    			this.front = 0;
    			this.back = 0;
    		}

    		enqueue(frame) {
    			this.frames[this.back] = frame;
    			this.back++;
    		}

    		dequeue() {
    			const frame = this.frames[this.front];
    			delete this.frames[this.front];
    			this.front++;
    			return frame;
    		}
    	}

    	// -----------------
    	// effect parameters
    	// -----------------
    	let ghost_A = false;

    	let ghost_fg = true;
    	let ghost_bg = false;
    	let ghost_capture = false;

    	function ghost_doCapture() {
    		ghost_capture = true;
    	}

    	let ghost_threshold = 30;
    	let ghost_fg_hex = "#ffffff";
    	let ghost_bg_hex = "#000000";
    	let ghost_frame;

    	// let ghost_accum = new Queue();
    	let pixel_A = false;

    	let pixel_chunkSize = 3;
    	let pixel_corner = [];
    	let filter_A = false;
    	let filter_temp = 50;
    	let filter_saturate = 50;
    	let filter_bright = 50;
    	let movey_A = false;
    	let movey_fg = true;
    	let movey_bg = false;
    	let movey_trail = false;
    	let movey_length = 10;
    	let movey_threshold = 40;
    	let movey_fg_hex = "#ffffff";
    	let movey_bg_hex = "#000000";
    	let prev;
    	let movey_motion = Array(wt * ht).fill(0);
    	let poster_A = false;
    	let poster_threshold = 120;
    	let poster_maxvalue = 150;

    	// -----------------
    	// loadPreset
    	// 
    	// change all effect attributes based on json file
    	// -----------------
    	function loadPreset() {
    		// translate string to json object
    		try {
    			const preset = JSON.parse(presetString);
    			$$invalidate(14, ghost_A = preset.ghost_A);
    			$$invalidate(15, ghost_fg = preset.ghost_fg);
    			$$invalidate(16, ghost_bg = preset.ghost_bg);
    			ghost_capture = preset.ghost_capture;
    			$$invalidate(0, ghost_threshold = preset.ghost_threshold);
    			$$invalidate(1, ghost_fg_hex = preset.ghost_fg_hex);
    			$$invalidate(2, ghost_bg_hex = preset.ghost_bg_hex);
    			$$invalidate(17, pixel_A = preset.pixel_A);
    			$$invalidate(18, pixel_chunkSize = preset.pixel_chunkSize);
    			$$invalidate(19, filter_A = preset.filter_A);
    			$$invalidate(20, filter_temp = preset.filter_temp);
    			$$invalidate(21, filter_saturate = preset.filter_saturate);
    			$$invalidate(22, filter_bright = preset.filter_bright);
    			$$invalidate(23, movey_A = preset.movey_A);
    			$$invalidate(24, movey_fg = preset.movey_fg);
    			$$invalidate(25, movey_bg = preset.movey_bg);
    			$$invalidate(26, movey_trail = preset.movey_trail);
    			$$invalidate(27, movey_length = preset.movey_length);
    			$$invalidate(3, movey_threshold = preset.movey_threshold);
    			$$invalidate(4, movey_fg_hex = preset.movey_fg_hex);
    			$$invalidate(5, movey_bg_hex = preset.movey_bg_hex);
    			$$invalidate(28, poster_A = preset.poster_A);
    			$$invalidate(29, poster_threshold = preset.poster_threshold);
    			$$invalidate(30, poster_maxvalue = preset.poster_maxvalue);
    		} catch(e) {
    			alert("Hey! That preset is of the wrong format. Try again.");
    		}
    	}

    	// -----------------
    	// savePreset
    	// 
    	// parse all effect attributes into json string
    	// -----------------
    	function savePreset() {
    		let preset = {};
    		preset.ghost_A = ghost_A;
    		preset.ghost_fg = ghost_fg;
    		preset.ghost_bg = ghost_bg;
    		preset.ghost_capture = ghost_capture;
    		preset.ghost_threshold = ghost_threshold;
    		preset.ghost_fg_hex = ghost_fg_hex;
    		preset.ghost_bg_hex = ghost_bg_hex;
    		preset.pixel_A = pixel_A;
    		preset.pixel_chunkSize = pixel_chunkSize;
    		preset.filter_A = filter_A;
    		preset.filter_temp = filter_temp;
    		preset.filter_saturate = filter_saturate;
    		preset.filter_bright = filter_bright;
    		preset.movey_A = movey_A;
    		preset.movey_fg = movey_fg;
    		preset.movey_bg = movey_bg;
    		preset.movey_trail = movey_trail;
    		preset.movey_length = movey_length;
    		preset.movey_threshold = movey_threshold;
    		preset.movey_fg_hex = movey_fg_hex;
    		preset.movey_bg_hex = movey_bg_hex;
    		preset.poster_A = poster_A;
    		preset.poster_threshold = poster_threshold;
    		preset.poster_maxvalue = poster_maxvalue;
    		let savedPresetString = JSON.stringify(preset);
    		navigator.clipboard.writeText(savedPresetString);
    	}

    	// -----------------
    	// init
    	// 
    	// initialize webcam
    	// -----------------
    	const init = async () => {
    		// try {
    		v_out_ctx = v_out.getContext('2d');

    		v_out_ctx_ocv = v_out.getContext('2d');
    		v_temp_ctx = v_temp.getContext('2d', { willReadFrequently: true });
    		ocv_mat_src = new cv.Mat(ht, wt, cv.CV_8UC4);
    		ocv_mat_tmp1 = new cv.Mat(ht, wt, cv.CV_8UC1);
    		ocv_mat_dst = new cv.Mat(ht, wt, cv.CV_8UC1);
    		ocv_mask = new cv.Mat(ht, wt, cv.CV_8UC1);
    		ocv_fgbg = new cv.BackgroundSubtractorMOG2(500, 16, false);
    		$$invalidate(12, streaming = true);
    		$$invalidate(11, loading = true);
    		const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    		$$invalidate(7, v_in.srcObject = stream, v_in);
    		v_in.play();
    		$$invalidate(11, loading = false);
    		frame = v_temp_ctx.getImageData(0, 0, wt, ht);
    		prev = v_temp_ctx.getImageData(0, 0, wt, ht);
    		ghost_frame = v_temp_ctx.getImageData(0, 0, wt, ht);
    		v_in.addEventListener("play", computeFrame);
    	}; // } catch (error) {
    	//     alert("An error occurred!\n" + error);
    	// }

    	// -----------------
    	// computeFrame
    	// 
    	// compute and display next frame 
    	// -----------------
    	function computeFrame() {
    		if (!streaming) {
    			ocv_mat_src.delete();
    			ocv_mat_tmp1.delete();
    			ocv_mat_dst.delete();
    			return;
    		}

    		let begin = Date.now();

    		//#region
    		v_temp_ctx.drawImage(v_in, 0, 0, wt, ht);

    		if (pixel_A) {
    			// for each row
    			for (let y = 0; y < ht; y += pixel_chunkSize) {
    				// for each col
    				for (let x = 0; x < wt; x += pixel_chunkSize) {
    					pixel_corner = v_temp_ctx.getImageData(x, y, 1, 1).data;
    					v_temp_ctx.fillStyle = "rgb(" + pixel_corner[0] + "," + pixel_corner[1] + "," + pixel_corner[2] + ")";
    					v_temp_ctx.fillRect(x, y, pixel_chunkSize, pixel_chunkSize);
    				}
    			}
    		}

    		frame = v_temp_ctx.getImageData(0, 0, wt, ht);

    		for (let i = 0; i < frame.data.length / 4; i++) {
    			let r = frame.data[i * 4 + 0];
    			let g = frame.data[i * 4 + 1];
    			let b = frame.data[i * 4 + 2];

    			if (ghost_A) {
    				if (distSq(r, g, b, ghost_frame.data[i * 4 + 0], ghost_frame.data[i * 4 + 1], ghost_frame.data[i * 4 + 2]) > gThreshold) {
    					if (ghost_fg) {
    						r = ghost_fg_rgb.r;
    						g = ghost_fg_rgb.g;
    						b = ghost_fg_rgb.b;
    					}
    				} else if (ghost_bg) {
    					r = ghost_bg_rgb.r;
    					g = ghost_bg_rgb.g;
    					b = ghost_bg_rgb.b;
    				}
    			}

    			if (movey_A) {
    				if (movey_motion[i * 4 + 0] > 0) {
    					if (movey_fg) {
    						r = movey_fg_rgb.r;
    						g = movey_fg_rgb.g;
    						b = movey_fg_rgb.b;
    					}
    				} else if (distSq(r, g, b, prev.data[i * 4 + 0], prev.data[i * 4 + 1], prev.data[i * 4 + 2]) > mThreshold) {
    					if (movey_fg) {
    						r = movey_fg_rgb.r;
    						g = movey_fg_rgb.g;
    						b = movey_fg_rgb.b;
    					}

    					if (movey_trail) movey_motion[i * 4 + 0] = movey_length;
    				} else if (movey_bg) {
    					r = movey_bg_rgb.r;
    					g = movey_bg_rgb.g;
    					b = movey_bg_rgb.b;
    				}

    				// decrement current pixel in motion array
    				movey_motion[i * 4 + 0]--;
    			}

    			if (filter_A) {
    				// find min and max values
    				let min = r;

    				let mid = g;
    				let max = b;

    				if (min > mid) {
    					mid = r;
    					min = g;
    				}

    				if (mid > max) {
    					max = mid;
    					mid = b;
    					if (min > mid) min = b;
    				}

    				let temp_amt = filter_temp - 50;
    				if (temp_amt > 0) r += temp_amt; else b += temp_amt;
    				let saturate_amt = filter_saturate - 50;
    				if (r == max) r += saturate_amt; else if (g == max) g += saturate_amt; else if (b == max) b += saturate_amt;
    				if (r == min) r -= saturate_amt; else if (g == min) g -= saturate_amt; else if (b == min) b -= saturate_amt;
    				let bright_amt = filter_bright - 50;
    				r += bright_amt;
    				g += bright_amt;
    				b += bright_amt;
    			}

    			frame.data[i * 4 + 0] = r;
    			frame.data[i * 4 + 1] = g;
    			frame.data[i * 4 + 2] = b;
    		}

    		if (movey_A) prev = v_temp_ctx.getImageData(0, 0, wt, ht);

    		if (ghost_capture) {
    			ghost_frame = v_temp_ctx.getImageData(0, 0, wt, ht);
    			ghost_capture = false;
    		}

    		v_out_ctx.putImageData(frame, 0, 0);

    		// #endregion
    		ocv_mat_src.data.set(v_out_ctx_ocv.getImageData(0, 0, wt, ht).data);

    		if (poster_A) {
    			cv.threshold(ocv_mat_src, ocv_mat_dst, poster_threshold, poster_maxvalue, cv.THRESH_BINARY);
    			cv.imshow("v_out_ocv", ocv_mat_dst);
    		}

    		delay = 1000 / 30 - (Date.now() - begin);

    		if (iter > 3) {
    			//update fps every 3 frames
    			$$invalidate(6, fps = parseInt(delay));

    			iter = 0;
    		} else iter++;

    		setTimeout(computeFrame, delay);
    	}

    	function doTrade() {
    		$$invalidate(13, viewport_showInput = !viewport_showInput);
    	} // console.log(viewport_showInput);

    	$$self.$$.on_mount.push(function () {
    		if (presetString === undefined && !('presetString' in $$props || $$self.$$.bound[$$self.$$.props['presetString']])) {
    			console.warn("<Control> was created without expected prop 'presetString'");
    		}

    		if (presetSaving === undefined && !('presetSaving' in $$props || $$self.$$.bound[$$self.$$.props['presetSaving']])) {
    			console.warn("<Control> was created without expected prop 'presetSaving'");
    		}
    	});

    	const writable_props = ['presetString', 'presetSaving'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Control> was created with unknown prop '${key}'`);
    	});

    	function video_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			v_in = $$value;
    			$$invalidate(7, v_in);
    		});
    	}

    	function canvas0_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			v_out = $$value;
    			$$invalidate(8, v_out);
    		});
    	}

    	function canvas_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			v_out_ocv = $$value;
    			$$invalidate(9, v_out_ocv);
    		});
    	}

    	function canvas1_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			v_temp = $$value;
    			$$invalidate(10, v_temp);
    		});
    	}

    	function input0_change_handler() {
    		filter_A = this.checked;
    		$$invalidate(19, filter_A);
    	}

    	function slider0_sliderValue_binding(value) {
    		filter_temp = value;
    		$$invalidate(20, filter_temp);
    	}

    	function slider1_sliderValue_binding(value) {
    		filter_saturate = value;
    		$$invalidate(21, filter_saturate);
    	}

    	function slider2_sliderValue_binding(value) {
    		filter_bright = value;
    		$$invalidate(22, filter_bright);
    	}

    	function input1_change_handler() {
    		ghost_A = this.checked;
    		$$invalidate(14, ghost_A);
    	}

    	function toggle0_opt_binding(value) {
    		ghost_fg = value;
    		$$invalidate(15, ghost_fg);
    	}

    	function input2_input_handler() {
    		ghost_fg_hex = this.value;
    		$$invalidate(1, ghost_fg_hex);
    	}

    	function toggle1_opt_binding(value) {
    		ghost_bg = value;
    		$$invalidate(16, ghost_bg);
    	}

    	function input3_input_handler() {
    		ghost_bg_hex = this.value;
    		$$invalidate(2, ghost_bg_hex);
    	}

    	function slider3_sliderValue_binding(value) {
    		ghost_threshold = value;
    		$$invalidate(0, ghost_threshold);
    	}

    	function input4_change_handler() {
    		movey_A = this.checked;
    		$$invalidate(23, movey_A);
    	}

    	function slider4_sliderValue_binding(value) {
    		movey_length = value;
    		$$invalidate(27, movey_length);
    	}

    	function toggle2_opt_binding(value) {
    		movey_trail = value;
    		$$invalidate(26, movey_trail);
    	}

    	function toggle3_opt_binding(value) {
    		movey_fg = value;
    		$$invalidate(24, movey_fg);
    	}

    	function input5_input_handler() {
    		movey_fg_hex = this.value;
    		$$invalidate(4, movey_fg_hex);
    	}

    	function toggle4_opt_binding(value) {
    		movey_bg = value;
    		$$invalidate(25, movey_bg);
    	}

    	function input6_input_handler() {
    		movey_bg_hex = this.value;
    		$$invalidate(5, movey_bg_hex);
    	}

    	function slider5_sliderValue_binding(value) {
    		movey_threshold = value;
    		$$invalidate(3, movey_threshold);
    	}

    	function input7_change_handler() {
    		pixel_A = this.checked;
    		$$invalidate(17, pixel_A);
    	}

    	function slider6_sliderValue_binding(value) {
    		pixel_chunkSize = value;
    		$$invalidate(18, pixel_chunkSize);
    	}

    	function input8_change_handler() {
    		poster_A = this.checked;
    		$$invalidate(28, poster_A);
    	}

    	function slider7_sliderValue_binding(value) {
    		poster_threshold = value;
    		$$invalidate(29, poster_threshold);
    	}

    	function slider8_sliderValue_binding(value) {
    		poster_maxvalue = value;
    		$$invalidate(30, poster_maxvalue);
    	}

    	$$self.$$set = $$props => {
    		if ('presetString' in $$props) $$invalidate(36, presetString = $$props.presetString);
    		if ('presetSaving' in $$props) $$invalidate(37, presetSaving = $$props.presetSaving);
    	};

    	$$self.$capture_state = () => ({
    		Slider,
    		RadioOptions,
    		Toggle,
    		presetString,
    		presetSaving,
    		wt,
    		ht,
    		fps,
    		delay,
    		iter,
    		v_in,
    		v_out,
    		v_out_ocv,
    		v_out_ctx,
    		v_out_ctx_ocv,
    		v_temp,
    		v_temp_ctx,
    		ocv_mat_src,
    		ocv_mat_tmp1,
    		ocv_mat_dst,
    		ocv_mask,
    		ocv_fgbg,
    		frame,
    		loading,
    		streaming,
    		viewport_showInput,
    		hextorgb,
    		Queue,
    		ghost_A,
    		ghost_fg,
    		ghost_bg,
    		ghost_capture,
    		ghost_doCapture,
    		ghost_threshold,
    		ghost_fg_hex,
    		ghost_bg_hex,
    		ghost_frame,
    		pixel_A,
    		pixel_chunkSize,
    		pixel_corner,
    		filter_A,
    		filter_temp,
    		filter_saturate,
    		filter_bright,
    		movey_A,
    		movey_fg,
    		movey_bg,
    		movey_trail,
    		movey_length,
    		movey_threshold,
    		movey_fg_hex,
    		movey_bg_hex,
    		prev,
    		movey_motion,
    		poster_A,
    		poster_threshold,
    		poster_maxvalue,
    		loadPreset,
    		savePreset,
    		init,
    		computeFrame,
    		doPopout,
    		doTrade,
    		distSq,
    		movey_bg_rgb,
    		movey_fg_rgb,
    		mThreshold,
    		ghost_bg_rgb,
    		ghost_fg_rgb,
    		gThreshold
    	});

    	$$self.$inject_state = $$props => {
    		if ('presetString' in $$props) $$invalidate(36, presetString = $$props.presetString);
    		if ('presetSaving' in $$props) $$invalidate(37, presetSaving = $$props.presetSaving);
    		if ('fps' in $$props) $$invalidate(6, fps = $$props.fps);
    		if ('delay' in $$props) delay = $$props.delay;
    		if ('iter' in $$props) iter = $$props.iter;
    		if ('v_in' in $$props) $$invalidate(7, v_in = $$props.v_in);
    		if ('v_out' in $$props) $$invalidate(8, v_out = $$props.v_out);
    		if ('v_out_ocv' in $$props) $$invalidate(9, v_out_ocv = $$props.v_out_ocv);
    		if ('v_out_ctx' in $$props) v_out_ctx = $$props.v_out_ctx;
    		if ('v_out_ctx_ocv' in $$props) v_out_ctx_ocv = $$props.v_out_ctx_ocv;
    		if ('v_temp' in $$props) $$invalidate(10, v_temp = $$props.v_temp);
    		if ('v_temp_ctx' in $$props) v_temp_ctx = $$props.v_temp_ctx;
    		if ('ocv_mat_src' in $$props) ocv_mat_src = $$props.ocv_mat_src;
    		if ('ocv_mat_tmp1' in $$props) ocv_mat_tmp1 = $$props.ocv_mat_tmp1;
    		if ('ocv_mat_dst' in $$props) ocv_mat_dst = $$props.ocv_mat_dst;
    		if ('ocv_mask' in $$props) ocv_mask = $$props.ocv_mask;
    		if ('ocv_fgbg' in $$props) ocv_fgbg = $$props.ocv_fgbg;
    		if ('frame' in $$props) frame = $$props.frame;
    		if ('loading' in $$props) $$invalidate(11, loading = $$props.loading);
    		if ('streaming' in $$props) $$invalidate(12, streaming = $$props.streaming);
    		if ('viewport_showInput' in $$props) $$invalidate(13, viewport_showInput = $$props.viewport_showInput);
    		if ('ghost_A' in $$props) $$invalidate(14, ghost_A = $$props.ghost_A);
    		if ('ghost_fg' in $$props) $$invalidate(15, ghost_fg = $$props.ghost_fg);
    		if ('ghost_bg' in $$props) $$invalidate(16, ghost_bg = $$props.ghost_bg);
    		if ('ghost_capture' in $$props) ghost_capture = $$props.ghost_capture;
    		if ('ghost_threshold' in $$props) $$invalidate(0, ghost_threshold = $$props.ghost_threshold);
    		if ('ghost_fg_hex' in $$props) $$invalidate(1, ghost_fg_hex = $$props.ghost_fg_hex);
    		if ('ghost_bg_hex' in $$props) $$invalidate(2, ghost_bg_hex = $$props.ghost_bg_hex);
    		if ('ghost_frame' in $$props) ghost_frame = $$props.ghost_frame;
    		if ('pixel_A' in $$props) $$invalidate(17, pixel_A = $$props.pixel_A);
    		if ('pixel_chunkSize' in $$props) $$invalidate(18, pixel_chunkSize = $$props.pixel_chunkSize);
    		if ('pixel_corner' in $$props) pixel_corner = $$props.pixel_corner;
    		if ('filter_A' in $$props) $$invalidate(19, filter_A = $$props.filter_A);
    		if ('filter_temp' in $$props) $$invalidate(20, filter_temp = $$props.filter_temp);
    		if ('filter_saturate' in $$props) $$invalidate(21, filter_saturate = $$props.filter_saturate);
    		if ('filter_bright' in $$props) $$invalidate(22, filter_bright = $$props.filter_bright);
    		if ('movey_A' in $$props) $$invalidate(23, movey_A = $$props.movey_A);
    		if ('movey_fg' in $$props) $$invalidate(24, movey_fg = $$props.movey_fg);
    		if ('movey_bg' in $$props) $$invalidate(25, movey_bg = $$props.movey_bg);
    		if ('movey_trail' in $$props) $$invalidate(26, movey_trail = $$props.movey_trail);
    		if ('movey_length' in $$props) $$invalidate(27, movey_length = $$props.movey_length);
    		if ('movey_threshold' in $$props) $$invalidate(3, movey_threshold = $$props.movey_threshold);
    		if ('movey_fg_hex' in $$props) $$invalidate(4, movey_fg_hex = $$props.movey_fg_hex);
    		if ('movey_bg_hex' in $$props) $$invalidate(5, movey_bg_hex = $$props.movey_bg_hex);
    		if ('prev' in $$props) prev = $$props.prev;
    		if ('movey_motion' in $$props) movey_motion = $$props.movey_motion;
    		if ('poster_A' in $$props) $$invalidate(28, poster_A = $$props.poster_A);
    		if ('poster_threshold' in $$props) $$invalidate(29, poster_threshold = $$props.poster_threshold);
    		if ('poster_maxvalue' in $$props) $$invalidate(30, poster_maxvalue = $$props.poster_maxvalue);
    		if ('movey_bg_rgb' in $$props) movey_bg_rgb = $$props.movey_bg_rgb;
    		if ('movey_fg_rgb' in $$props) movey_fg_rgb = $$props.movey_fg_rgb;
    		if ('mThreshold' in $$props) mThreshold = $$props.mThreshold;
    		if ('ghost_bg_rgb' in $$props) ghost_bg_rgb = $$props.ghost_bg_rgb;
    		if ('ghost_fg_rgb' in $$props) ghost_fg_rgb = $$props.ghost_fg_rgb;
    		if ('gThreshold' in $$props) gThreshold = $$props.gThreshold;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[1] & /*presetString*/ 32) {
    			presetString && loadPreset();
    		}

    		if ($$self.$$.dirty[1] & /*presetSaving*/ 64) {
    			presetSaving && savePreset();
    		}

    		if ($$self.$$.dirty[0] & /*ghost_threshold*/ 1) {
    			gThreshold = ghost_threshold * ghost_threshold;
    		}

    		if ($$self.$$.dirty[0] & /*ghost_fg_hex*/ 2) {
    			ghost_fg_rgb = hextorgb(ghost_fg_hex);
    		}

    		if ($$self.$$.dirty[0] & /*ghost_bg_hex*/ 4) {
    			ghost_bg_rgb = hextorgb(ghost_bg_hex);
    		}

    		if ($$self.$$.dirty[0] & /*movey_threshold*/ 8) {
    			mThreshold = movey_threshold * movey_threshold;
    		}

    		if ($$self.$$.dirty[0] & /*movey_fg_hex*/ 16) {
    			movey_fg_rgb = hextorgb(movey_fg_hex);
    		}

    		if ($$self.$$.dirty[0] & /*movey_bg_hex*/ 32) {
    			movey_bg_rgb = hextorgb(movey_bg_hex);
    		}
    	};

    	return [
    		ghost_threshold,
    		ghost_fg_hex,
    		ghost_bg_hex,
    		movey_threshold,
    		movey_fg_hex,
    		movey_bg_hex,
    		fps,
    		v_in,
    		v_out,
    		v_out_ocv,
    		v_temp,
    		loading,
    		streaming,
    		viewport_showInput,
    		ghost_A,
    		ghost_fg,
    		ghost_bg,
    		pixel_A,
    		pixel_chunkSize,
    		filter_A,
    		filter_temp,
    		filter_saturate,
    		filter_bright,
    		movey_A,
    		movey_fg,
    		movey_bg,
    		movey_trail,
    		movey_length,
    		poster_A,
    		poster_threshold,
    		poster_maxvalue,
    		wt,
    		ht,
    		ghost_doCapture,
    		init,
    		doTrade,
    		presetString,
    		presetSaving,
    		video_binding,
    		canvas0_binding,
    		canvas_binding,
    		canvas1_binding,
    		input0_change_handler,
    		slider0_sliderValue_binding,
    		slider1_sliderValue_binding,
    		slider2_sliderValue_binding,
    		input1_change_handler,
    		toggle0_opt_binding,
    		input2_input_handler,
    		toggle1_opt_binding,
    		input3_input_handler,
    		slider3_sliderValue_binding,
    		input4_change_handler,
    		slider4_sliderValue_binding,
    		toggle2_opt_binding,
    		toggle3_opt_binding,
    		input5_input_handler,
    		toggle4_opt_binding,
    		input6_input_handler,
    		slider5_sliderValue_binding,
    		input7_change_handler,
    		slider6_sliderValue_binding,
    		input8_change_handler,
    		slider7_sliderValue_binding,
    		slider8_sliderValue_binding
    	];
    }

    class Control extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { presetString: 36, presetSaving: 37 }, null, [-1, -1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Control",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get presetString() {
    		throw new Error("<Control>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set presetString(value) {
    		throw new Error("<Control>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get presetSaving() {
    		throw new Error("<Control>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set presetSaving(value) {
    		throw new Error("<Control>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/App.svelte generated by Svelte v3.57.0 */
    const file = "src/App.svelte";

    function create_fragment(ctx) {
    	let div1;
    	let div0;
    	let sidebar;
    	let updating_presetString;
    	let updating_presetSaving;
    	let t;
    	let control;
    	let updating_presetString_1;
    	let updating_presetSaving_1;
    	let current;

    	function sidebar_presetString_binding(value) {
    		/*sidebar_presetString_binding*/ ctx[2](value);
    	}

    	function sidebar_presetSaving_binding(value) {
    		/*sidebar_presetSaving_binding*/ ctx[3](value);
    	}

    	let sidebar_props = {};

    	if (/*preset*/ ctx[0] !== void 0) {
    		sidebar_props.presetString = /*preset*/ ctx[0];
    	}

    	if (/*presetSaving*/ ctx[1] !== void 0) {
    		sidebar_props.presetSaving = /*presetSaving*/ ctx[1];
    	}

    	sidebar = new Sidebar({ props: sidebar_props, $$inline: true });
    	binding_callbacks.push(() => bind(sidebar, 'presetString', sidebar_presetString_binding));
    	binding_callbacks.push(() => bind(sidebar, 'presetSaving', sidebar_presetSaving_binding));

    	function control_presetString_binding(value) {
    		/*control_presetString_binding*/ ctx[4](value);
    	}

    	function control_presetSaving_binding(value) {
    		/*control_presetSaving_binding*/ ctx[5](value);
    	}

    	let control_props = {};

    	if (/*preset*/ ctx[0] !== void 0) {
    		control_props.presetString = /*preset*/ ctx[0];
    	}

    	if (/*presetSaving*/ ctx[1] !== void 0) {
    		control_props.presetSaving = /*presetSaving*/ ctx[1];
    	}

    	control = new Control({ props: control_props, $$inline: true });
    	binding_callbacks.push(() => bind(control, 'presetString', control_presetString_binding));
    	binding_callbacks.push(() => bind(control, 'presetSaving', control_presetSaving_binding));

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			create_component(sidebar.$$.fragment);
    			t = space();
    			create_component(control.$$.fragment);
    			attr_dev(div0, "class", "container svelte-qkzg4s");
    			add_location(div0, file, 15, 1, 202);
    			add_location(div1, file, 11, 0, 171);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			mount_component(sidebar, div0, null);
    			append_dev(div0, t);
    			mount_component(control, div0, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const sidebar_changes = {};

    			if (!updating_presetString && dirty & /*preset*/ 1) {
    				updating_presetString = true;
    				sidebar_changes.presetString = /*preset*/ ctx[0];
    				add_flush_callback(() => updating_presetString = false);
    			}

    			if (!updating_presetSaving && dirty & /*presetSaving*/ 2) {
    				updating_presetSaving = true;
    				sidebar_changes.presetSaving = /*presetSaving*/ ctx[1];
    				add_flush_callback(() => updating_presetSaving = false);
    			}

    			sidebar.$set(sidebar_changes);
    			const control_changes = {};

    			if (!updating_presetString_1 && dirty & /*preset*/ 1) {
    				updating_presetString_1 = true;
    				control_changes.presetString = /*preset*/ ctx[0];
    				add_flush_callback(() => updating_presetString_1 = false);
    			}

    			if (!updating_presetSaving_1 && dirty & /*presetSaving*/ 2) {
    				updating_presetSaving_1 = true;
    				control_changes.presetSaving = /*presetSaving*/ ctx[1];
    				add_flush_callback(() => updating_presetSaving_1 = false);
    			}

    			control.$set(control_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(sidebar.$$.fragment, local);
    			transition_in(control.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(sidebar.$$.fragment, local);
    			transition_out(control.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			destroy_component(sidebar);
    			destroy_component(control);
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
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let preset;
    	let presetSaving;
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function sidebar_presetString_binding(value) {
    		preset = value;
    		$$invalidate(0, preset);
    	}

    	function sidebar_presetSaving_binding(value) {
    		presetSaving = value;
    		$$invalidate(1, presetSaving);
    	}

    	function control_presetString_binding(value) {
    		preset = value;
    		$$invalidate(0, preset);
    	}

    	function control_presetSaving_binding(value) {
    		presetSaving = value;
    		$$invalidate(1, presetSaving);
    	}

    	$$self.$capture_state = () => ({
    		Header,
    		Sidebar,
    		Control,
    		preset,
    		presetSaving
    	});

    	$$self.$inject_state = $$props => {
    		if ('preset' in $$props) $$invalidate(0, preset = $$props.preset);
    		if ('presetSaving' in $$props) $$invalidate(1, presetSaving = $$props.presetSaving);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		preset,
    		presetSaving,
    		sidebar_presetString_binding,
    		sidebar_presetSaving_binding,
    		control_presetString_binding,
    		control_presetSaving_binding
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
