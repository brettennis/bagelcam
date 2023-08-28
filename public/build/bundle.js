
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
    // TODO figure out if we still want to support
    // shorthand events, or if we want to implement
    // a real bubbling mechanism
    function bubble(component, event) {
        const callbacks = component.$$.callbacks[event.type];
        if (callbacks) {
            // @ts-ignore
            callbacks.slice().forEach(fn => fn.call(this, event));
        }
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

    /* src/Sidebar.svelte generated by Svelte v3.57.0 */
    const file$5 = "src/Sidebar.svelte";

    function create_fragment$5(ctx) {
    	let div1;
    	let img;
    	let img_src_value;
    	let t0;
    	let div0;
    	let input;
    	let t1;
    	let button0;
    	let t3;
    	let button1;
    	let t5;
    	let p0;
    	let t6;
    	let t7;
    	let p1;
    	let t9;
    	let button2;
    	let t11;
    	let button3;
    	let t13;
    	let button4;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			img = element("img");
    			t0 = space();
    			div0 = element("div");
    			input = element("input");
    			t1 = space();
    			button0 = element("button");
    			button0.textContent = "save";
    			t3 = space();
    			button1 = element("button");
    			button1.textContent = "load";
    			t5 = space();
    			p0 = element("p");
    			t6 = text(/*presetConsole*/ ctx[2]);
    			t7 = space();
    			p1 = element("p");
    			p1.textContent = "choose a preset below";
    			t9 = space();
    			button2 = element("button");
    			button2.textContent = "sprite";
    			t11 = space();
    			button3 = element("button");
    			button3.textContent = "purple haze";
    			t13 = space();
    			button4 = element("button");
    			button4.textContent = "the void";
    			attr_dev(img, "class", "logo svelte-16d8hfu");
    			attr_dev(img, "alt", "");
    			if (!src_url_equal(img.src, img_src_value = "images/bagel_long.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "width", "200px");
    			add_location(img, file$5, 41, 4, 1077);
    			attr_dev(input, "class", "preset-input svelte-16d8hfu");
    			attr_dev(input, "type", "text");
    			add_location(input, file$5, 44, 8, 1195);
    			attr_dev(button0, "class", "buttonSave");
    			add_location(button0, file$5, 48, 8, 1375);
    			attr_dev(button1, "class", "buttonSave");
    			add_location(button1, file$5, 49, 8, 1442);
    			attr_dev(p0, "class", "preset-console svelte-16d8hfu");
    			add_location(p0, file$5, 50, 8, 1509);
    			attr_dev(div0, "class", "presets-container");
    			add_location(div0, file$5, 43, 4, 1155);
    			add_location(p1, file$5, 53, 4, 1571);
    			attr_dev(button2, "class", "button-preset svelte-16d8hfu");
    			add_location(button2, file$5, 55, 4, 1605);
    			attr_dev(button3, "class", "button-preset svelte-16d8hfu");
    			add_location(button3, file$5, 61, 4, 2241);
    			attr_dev(button4, "class", "button-preset svelte-16d8hfu");
    			add_location(button4, file$5, 67, 4, 2882);
    			attr_dev(div1, "class", "backdrop svelte-16d8hfu");
    			add_location(div1, file$5, 39, 0, 1049);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, img);
    			append_dev(div1, t0);
    			append_dev(div1, div0);
    			append_dev(div0, input);
    			set_input_value(input, /*inputString*/ ctx[1]);
    			/*input_binding*/ ctx[8](input);
    			append_dev(div0, t1);
    			append_dev(div0, button0);
    			append_dev(div0, t3);
    			append_dev(div0, button1);
    			append_dev(div0, t5);
    			append_dev(div0, p0);
    			append_dev(p0, t6);
    			append_dev(div1, t7);
    			append_dev(div1, p1);
    			append_dev(div1, t9);
    			append_dev(div1, button2);
    			append_dev(div1, t11);
    			append_dev(div1, button3);
    			append_dev(div1, t13);
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

    			if (dirty & /*presetConsole*/ 4) set_data_dev(t6, /*presetConsole*/ ctx[2]);
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
    	let defaultConsole = "click save to copy preset to clipboard";
    	let presetConsole = defaultConsole;

    	function doLoad() {
    		if (inputString[0] == '{') {
    			$$invalidate(5, presetString = inputString);
    			$$invalidate(2, presetConsole = "loaded from text input!");

    			setTimeout(
    				() => {
    					$$invalidate(2, presetConsole = defaultConsole);
    				},
    				"3000"
    			);
    		} else {
    			$$invalidate(2, presetConsole = "sorry, invalid format!");

    			setTimeout(
    				() => {
    					$$invalidate(2, presetConsole = defaultConsole);
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
    				$$invalidate(2, presetConsole = defaultConsole);
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
    		defaultConsole,
    		presetConsole,
    		doLoad,
    		doSave
    	});

    	$$self.$inject_state = $$props => {
    		if ('presetString' in $$props) $$invalidate(5, presetString = $$props.presetString);
    		if ('presetSaving' in $$props) $$invalidate(6, presetSaving = $$props.presetSaving);
    		if ('inputObject' in $$props) $$invalidate(0, inputObject = $$props.inputObject);
    		if ('inputString' in $$props) $$invalidate(1, inputString = $$props.inputString);
    		if ('defaultConsole' in $$props) defaultConsole = $$props.defaultConsole;
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
    			attr_dev(input0, "class", input0_class_value = "slider" + /*variation*/ ctx[1] + " svelte-13kazuu");
    			attr_dev(input0, "min", /*minval*/ ctx[2]);
    			attr_dev(input0, "max", /*maxval*/ ctx[3]);
    			add_location(input0, file$4, 22, 4, 518);
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "class", input1_class_value = "param_val" + /*variation*/ ctx[1] + " svelte-13kazuu");
    			input1.value = /*displayValue*/ ctx[4];
    			add_location(input1, file$4, 30, 1, 721);
    			attr_dev(div, "class", div_class_value = "backdrop" + /*variation*/ ctx[1] + " svelte-13kazuu");
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
    			if (dirty & /*variation*/ 2 && input0_class_value !== (input0_class_value = "slider" + /*variation*/ ctx[1] + " svelte-13kazuu")) {
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

    			if (dirty & /*variation*/ 2 && input1_class_value !== (input1_class_value = "param_val" + /*variation*/ ctx[1] + " svelte-13kazuu")) {
    				attr_dev(input1, "class", input1_class_value);
    			}

    			if (dirty & /*displayValue*/ 16 && input1.value !== /*displayValue*/ ctx[4]) {
    				prop_dev(input1, "value", /*displayValue*/ ctx[4]);
    			}

    			if (dirty & /*variation*/ 2 && div_class_value !== (div_class_value = "backdrop" + /*variation*/ ctx[1] + " svelte-13kazuu")) {
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

    /* src/Toggle.svelte generated by Svelte v3.57.0 */

    const file$3 = "src/Toggle.svelte";

    // (11:4) {:else}
    function create_else_block(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			set_style(div, "height", "1.2rem");
    			add_location(div, file$3, 11, 4, 178);
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
    function create_if_block$2(ctx) {
    	let h3;
    	let t;

    	const block = {
    		c: function create() {
    			h3 = element("h3");
    			t = text(/*id*/ ctx[1]);
    			attr_dev(h3, "class", "label svelte-1azwifc");
    			add_location(h3, file$3, 9, 4, 134);
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
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(9:4) {#if showID}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let div;
    	let t0;
    	let label;
    	let input;
    	let t1;
    	let span;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (/*showID*/ ctx[2]) return create_if_block$2;
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
    			add_location(input, file$3, 15, 8, 263);
    			attr_dev(span, "class", "slider svelte-1azwifc");
    			add_location(span, file$3, 16, 8, 314);
    			attr_dev(label, "class", "switch svelte-1azwifc");
    			add_location(label, file$3, 14, 4, 232);
    			attr_dev(div, "class", "backdrop svelte-1azwifc");
    			add_location(div, file$3, 7, 0, 90);
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
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
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
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { id: 1, showID: 2, opt: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Toggle",
    			options,
    			id: create_fragment$3.name
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
    const file$2 = "src/Control.svelte";

    // (469:8) {#if loading}
    function create_if_block_2(ctx) {
    	let h3;

    	const block = {
    		c: function create() {
    			h3 = element("h3");
    			h3.textContent = "loading...";
    			add_location(h3, file$2, 469, 8, 13128);
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
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(469:8) {#if loading}",
    		ctx
    	});

    	return block;
    }

    // (484:8) {#if params_poster.active}
    function create_if_block_1(ctx) {
    	let canvas;
    	let canvas_style_value;

    	const block = {
    		c: function create() {
    			canvas = element("canvas");
    			attr_dev(canvas, "id", "v_out_ocv");
    			attr_dev(canvas, "width", /*wt*/ ctx[13]);
    			attr_dev(canvas, "height", /*ht*/ ctx[14]);

    			attr_dev(canvas, "style", canvas_style_value = /*viewport_showInput*/ ctx[9]
    			? "display:none"
    			: "display:block");

    			attr_dev(canvas, "class", "svelte-hvomf6");
    			add_location(canvas, file$2, 484, 8, 13614);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, canvas, anchor);
    			/*canvas_binding*/ ctx[22](canvas);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*viewport_showInput*/ 512 && canvas_style_value !== (canvas_style_value = /*viewport_showInput*/ ctx[9]
    			? "display:none"
    			: "display:block")) {
    				attr_dev(canvas, "style", canvas_style_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(canvas);
    			/*canvas_binding*/ ctx[22](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(484:8) {#if params_poster.active}",
    		ctx
    	});

    	return block;
    }

    // (503:12) {#if streaming}
    function create_if_block$1(ctx) {
    	let p;
    	let t0;
    	let t1;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t0 = text("FPS: ");
    			t1 = text(/*fps*/ ctx[2]);
    			attr_dev(p, "class", "fps svelte-hvomf6");
    			add_location(p, file$2, 503, 12, 14232);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t0);
    			append_dev(p, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*fps*/ 4) set_data_dev(t1, /*fps*/ ctx[2]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(503:12) {#if streaming}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let script;
    	let script_src_value;
    	let t0;
    	let div22;
    	let div2;
    	let t1;
    	let video;
    	let video_style_value;
    	let t2;
    	let canvas0;
    	let canvas0_style_value;
    	let t3;
    	let t4;
    	let canvas1;
    	let t5;
    	let div1;
    	let div0;
    	let button0;
    	let t7;
    	let t8;
    	let div4;
    	let input0;
    	let t9;
    	let label0;
    	let t10;
    	let div3;
    	let slider0;
    	let updating_sliderValue;
    	let t11;
    	let slider1;
    	let updating_sliderValue_1;
    	let t12;
    	let slider2;
    	let updating_sliderValue_2;
    	let t13;
    	let div11;
    	let input1;
    	let t14;
    	let label1;
    	let t15;
    	let div10;
    	let div5;
    	let button1;
    	let t17;
    	let p;
    	let t19;
    	let div6;
    	let t20;
    	let div9;
    	let toggle0;
    	let updating_opt;
    	let t21;
    	let div7;
    	let input2;
    	let t22;
    	let toggle1;
    	let updating_opt_1;
    	let t23;
    	let div8;
    	let input3;
    	let t24;
    	let slider3;
    	let updating_sliderValue_3;
    	let t25;
    	let div17;
    	let input4;
    	let t26;
    	let label2;
    	let t27;
    	let div16;
    	let slider4;
    	let updating_sliderValue_4;
    	let t28;
    	let toggle2;
    	let updating_opt_2;
    	let t29;
    	let div12;
    	let t30;
    	let div15;
    	let toggle3;
    	let updating_opt_3;
    	let t31;
    	let div13;
    	let input5;
    	let t32;
    	let toggle4;
    	let updating_opt_4;
    	let t33;
    	let div14;
    	let input6;
    	let t34;
    	let slider5;
    	let updating_sliderValue_5;
    	let t35;
    	let div19;
    	let input7;
    	let t36;
    	let label3;
    	let t37;
    	let div18;
    	let slider6;
    	let updating_sliderValue_6;
    	let t38;
    	let div21;
    	let input8;
    	let t39;
    	let label4;
    	let t40;
    	let div20;
    	let slider7;
    	let updating_sliderValue_7;
    	let t41;
    	let slider8;
    	let updating_sliderValue_8;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block0 = /*loading*/ ctx[7] && create_if_block_2(ctx);
    	let if_block1 = /*params_poster*/ ctx[12].active && create_if_block_1(ctx);
    	let if_block2 = /*streaming*/ ctx[8] && create_if_block$1(ctx);

    	function slider0_sliderValue_binding(value) {
    		/*slider0_sliderValue_binding*/ ctx[25](value);
    	}

    	let slider0_props = {
    		id: "eff-filter-temp",
    		label: "temp",
    		minval: 0,
    		maxval: 100,
    		defval: 50
    	};

    	if (/*params_filter*/ ctx[11].temp !== void 0) {
    		slider0_props.sliderValue = /*params_filter*/ ctx[11].temp;
    	}

    	slider0 = new Slider({ props: slider0_props, $$inline: true });
    	binding_callbacks.push(() => bind(slider0, 'sliderValue', slider0_sliderValue_binding));

    	function slider1_sliderValue_binding(value) {
    		/*slider1_sliderValue_binding*/ ctx[26](value);
    	}

    	let slider1_props = {
    		id: "eff-filter-saturate",
    		label: "saturate",
    		minval: 0,
    		maxval: 100,
    		defval: 50
    	};

    	if (/*params_filter*/ ctx[11].saturate !== void 0) {
    		slider1_props.sliderValue = /*params_filter*/ ctx[11].saturate;
    	}

    	slider1 = new Slider({ props: slider1_props, $$inline: true });
    	binding_callbacks.push(() => bind(slider1, 'sliderValue', slider1_sliderValue_binding));

    	function slider2_sliderValue_binding(value) {
    		/*slider2_sliderValue_binding*/ ctx[27](value);
    	}

    	let slider2_props = {
    		id: "eff-filter-bright",
    		label: "bright",
    		minval: 0,
    		maxval: 100,
    		defval: 50
    	};

    	if (/*params_filter*/ ctx[11].bright !== void 0) {
    		slider2_props.sliderValue = /*params_filter*/ ctx[11].bright;
    	}

    	slider2 = new Slider({ props: slider2_props, $$inline: true });
    	binding_callbacks.push(() => bind(slider2, 'sliderValue', slider2_sliderValue_binding));

    	function toggle0_opt_binding(value) {
    		/*toggle0_opt_binding*/ ctx[29](value);
    	}

    	let toggle0_props = { id: "fg", showID: true };

    	if (/*params_ghost*/ ctx[0].fg !== void 0) {
    		toggle0_props.opt = /*params_ghost*/ ctx[0].fg;
    	}

    	toggle0 = new Toggle({ props: toggle0_props, $$inline: true });
    	binding_callbacks.push(() => bind(toggle0, 'opt', toggle0_opt_binding));

    	function toggle1_opt_binding(value) {
    		/*toggle1_opt_binding*/ ctx[31](value);
    	}

    	let toggle1_props = { id: "bg", showID: true };

    	if (/*params_ghost*/ ctx[0].bg !== void 0) {
    		toggle1_props.opt = /*params_ghost*/ ctx[0].bg;
    	}

    	toggle1 = new Toggle({ props: toggle1_props, $$inline: true });
    	binding_callbacks.push(() => bind(toggle1, 'opt', toggle1_opt_binding));

    	function slider3_sliderValue_binding(value) {
    		/*slider3_sliderValue_binding*/ ctx[33](value);
    	}

    	let slider3_props = {
    		id: "eff-ghost-threshold",
    		label: "threshold",
    		minval: 10,
    		maxval: 120,
    		defval: 30
    	};

    	if (/*params_ghost*/ ctx[0].threshold !== void 0) {
    		slider3_props.sliderValue = /*params_ghost*/ ctx[0].threshold;
    	}

    	slider3 = new Slider({ props: slider3_props, $$inline: true });
    	binding_callbacks.push(() => bind(slider3, 'sliderValue', slider3_sliderValue_binding));

    	function slider4_sliderValue_binding(value) {
    		/*slider4_sliderValue_binding*/ ctx[35](value);
    	}

    	let slider4_props = {
    		id: "eff-movey-length",
    		label: "length",
    		minval: 1,
    		maxval: 60,
    		defval: 10
    	};

    	if (/*params_movey*/ ctx[1].length !== void 0) {
    		slider4_props.sliderValue = /*params_movey*/ ctx[1].length;
    	}

    	slider4 = new Slider({ props: slider4_props, $$inline: true });
    	binding_callbacks.push(() => bind(slider4, 'sliderValue', slider4_sliderValue_binding));

    	function toggle2_opt_binding(value) {
    		/*toggle2_opt_binding*/ ctx[36](value);
    	}

    	let toggle2_props = { id: "trail", showID: true };

    	if (/*params_movey*/ ctx[1].trail !== void 0) {
    		toggle2_props.opt = /*params_movey*/ ctx[1].trail;
    	}

    	toggle2 = new Toggle({ props: toggle2_props, $$inline: true });
    	binding_callbacks.push(() => bind(toggle2, 'opt', toggle2_opt_binding));

    	function toggle3_opt_binding(value) {
    		/*toggle3_opt_binding*/ ctx[37](value);
    	}

    	let toggle3_props = { id: "fg", showID: true };

    	if (/*params_movey*/ ctx[1].fg !== void 0) {
    		toggle3_props.opt = /*params_movey*/ ctx[1].fg;
    	}

    	toggle3 = new Toggle({ props: toggle3_props, $$inline: true });
    	binding_callbacks.push(() => bind(toggle3, 'opt', toggle3_opt_binding));

    	function toggle4_opt_binding(value) {
    		/*toggle4_opt_binding*/ ctx[39](value);
    	}

    	let toggle4_props = { id: "bg", showID: true };

    	if (/*params_movey*/ ctx[1].bg !== void 0) {
    		toggle4_props.opt = /*params_movey*/ ctx[1].bg;
    	}

    	toggle4 = new Toggle({ props: toggle4_props, $$inline: true });
    	binding_callbacks.push(() => bind(toggle4, 'opt', toggle4_opt_binding));

    	function slider5_sliderValue_binding(value) {
    		/*slider5_sliderValue_binding*/ ctx[41](value);
    	}

    	let slider5_props = {
    		id: "eff-movey-threshold",
    		label: "threshold",
    		minval: 10,
    		maxval: 120,
    		defval: 40
    	};

    	if (/*params_movey*/ ctx[1].threshold !== void 0) {
    		slider5_props.sliderValue = /*params_movey*/ ctx[1].threshold;
    	}

    	slider5 = new Slider({ props: slider5_props, $$inline: true });
    	binding_callbacks.push(() => bind(slider5, 'sliderValue', slider5_sliderValue_binding));

    	function slider6_sliderValue_binding(value) {
    		/*slider6_sliderValue_binding*/ ctx[43](value);
    	}

    	let slider6_props = {
    		id: "eff-pixel-resolution",
    		label: "resolution",
    		minval: 3,
    		maxval: 20,
    		defval: 3
    	};

    	if (/*params_pixel*/ ctx[10].chunkSize !== void 0) {
    		slider6_props.sliderValue = /*params_pixel*/ ctx[10].chunkSize;
    	}

    	slider6 = new Slider({ props: slider6_props, $$inline: true });
    	binding_callbacks.push(() => bind(slider6, 'sliderValue', slider6_sliderValue_binding));

    	function slider7_sliderValue_binding(value) {
    		/*slider7_sliderValue_binding*/ ctx[45](value);
    	}

    	let slider7_props = {
    		id: "eff-poster-threshold",
    		label: "threshold",
    		minval: 30,
    		maxval: 250,
    		defval: 120
    	};

    	if (/*params_poster*/ ctx[12].threshold !== void 0) {
    		slider7_props.sliderValue = /*params_poster*/ ctx[12].threshold;
    	}

    	slider7 = new Slider({ props: slider7_props, $$inline: true });
    	binding_callbacks.push(() => bind(slider7, 'sliderValue', slider7_sliderValue_binding));

    	function slider8_sliderValue_binding(value) {
    		/*slider8_sliderValue_binding*/ ctx[46](value);
    	}

    	let slider8_props = {
    		id: "eff-poster-maxvalue",
    		label: "opacity",
    		minval: 0,
    		maxval: 255,
    		defval: 150
    	};

    	if (/*params_poster*/ ctx[12].maxvalue !== void 0) {
    		slider8_props.sliderValue = /*params_poster*/ ctx[12].maxvalue;
    	}

    	slider8 = new Slider({ props: slider8_props, $$inline: true });
    	binding_callbacks.push(() => bind(slider8, 'sliderValue', slider8_sliderValue_binding));

    	const block = {
    		c: function create() {
    			script = element("script");
    			t0 = space();
    			div22 = element("div");
    			div2 = element("div");
    			if (if_block0) if_block0.c();
    			t1 = space();
    			video = element("video");
    			t2 = space();
    			canvas0 = element("canvas");
    			t3 = space();
    			if (if_block1) if_block1.c();
    			t4 = space();
    			canvas1 = element("canvas");
    			t5 = space();
    			div1 = element("div");
    			div0 = element("div");
    			button0 = element("button");
    			button0.textContent = "Bypass";
    			t7 = space();
    			if (if_block2) if_block2.c();
    			t8 = space();
    			div4 = element("div");
    			input0 = element("input");
    			t9 = space();
    			label0 = element("label");
    			t10 = space();
    			div3 = element("div");
    			create_component(slider0.$$.fragment);
    			t11 = space();
    			create_component(slider1.$$.fragment);
    			t12 = space();
    			create_component(slider2.$$.fragment);
    			t13 = space();
    			div11 = element("div");
    			input1 = element("input");
    			t14 = space();
    			label1 = element("label");
    			t15 = space();
    			div10 = element("div");
    			div5 = element("div");
    			button1 = element("button");
    			button1.textContent = "capture";
    			t17 = space();
    			p = element("p");
    			p.textContent = "move out of frame, click capture, then reenter frame";
    			t19 = space();
    			div6 = element("div");
    			t20 = space();
    			div9 = element("div");
    			create_component(toggle0.$$.fragment);
    			t21 = space();
    			div7 = element("div");
    			input2 = element("input");
    			t22 = space();
    			create_component(toggle1.$$.fragment);
    			t23 = space();
    			div8 = element("div");
    			input3 = element("input");
    			t24 = space();
    			create_component(slider3.$$.fragment);
    			t25 = space();
    			div17 = element("div");
    			input4 = element("input");
    			t26 = space();
    			label2 = element("label");
    			t27 = space();
    			div16 = element("div");
    			create_component(slider4.$$.fragment);
    			t28 = space();
    			create_component(toggle2.$$.fragment);
    			t29 = space();
    			div12 = element("div");
    			t30 = space();
    			div15 = element("div");
    			create_component(toggle3.$$.fragment);
    			t31 = space();
    			div13 = element("div");
    			input5 = element("input");
    			t32 = space();
    			create_component(toggle4.$$.fragment);
    			t33 = space();
    			div14 = element("div");
    			input6 = element("input");
    			t34 = space();
    			create_component(slider5.$$.fragment);
    			t35 = space();
    			div19 = element("div");
    			input7 = element("input");
    			t36 = space();
    			label3 = element("label");
    			t37 = space();
    			div18 = element("div");
    			create_component(slider6.$$.fragment);
    			t38 = space();
    			div21 = element("div");
    			input8 = element("input");
    			t39 = space();
    			label4 = element("label");
    			t40 = space();
    			div20 = element("div");
    			create_component(slider7.$$.fragment);
    			t41 = space();
    			create_component(slider8.$$.fragment);
    			if (!src_url_equal(script.src, script_src_value = "https://docs.opencv.org/3.4.0/opencv.js")) attr_dev(script, "src", script_src_value);
    			add_location(script, file$2, 1, 1, 15);
    			attr_dev(video, "id", "v_in");
    			attr_dev(video, "width", /*wt*/ ctx[13]);
    			attr_dev(video, "height", /*ht*/ ctx[14]);

    			attr_dev(video, "style", video_style_value = /*viewport_showInput*/ ctx[9]
    			? "display:block"
    			: "display:none");

    			add_location(video, file$2, 473, 8, 13225);
    			attr_dev(canvas0, "id", "v_out");
    			attr_dev(canvas0, "width", /*wt*/ ctx[13]);
    			attr_dev(canvas0, "height", /*ht*/ ctx[14]);

    			attr_dev(canvas0, "style", canvas0_style_value = /*viewport_showInput*/ ctx[9]
    			? "display:none"
    			: "display:block");

    			add_location(canvas0, file$2, 478, 8, 13406);
    			attr_dev(canvas1, "width", /*wt*/ ctx[13]);
    			attr_dev(canvas1, "height", /*ht*/ ctx[14]);
    			set_style(canvas1, "display", "none");
    			add_location(canvas1, file$2, 490, 8, 13817);
    			attr_dev(button0, "class", "button1-2");
    			add_location(button0, file$2, 499, 16, 14111);
    			attr_dev(div0, "class", "button-controller svelte-hvomf6");
    			add_location(div0, file$2, 497, 12, 13976);
    			attr_dev(div1, "class", "controller svelte-hvomf6");
    			add_location(div1, file$2, 495, 8, 13938);
    			attr_dev(div2, "class", "viewport svelte-hvomf6");
    			set_style(div2, "grid-area", "1 / 1 / 2 / 3");
    			add_location(div2, file$2, 467, 4, 13042);
    			attr_dev(input0, "class", "effect-toggle svelte-hvomf6");
    			attr_dev(input0, "type", "checkbox");
    			attr_dev(input0, "id", "tgl-filter");
    			add_location(input0, file$2, 510, 8, 14390);
    			attr_dev(label0, "class", "tgl-btn svelte-hvomf6");
    			attr_dev(label0, "for", "tgl-filter");
    			attr_dev(label0, "data-tg-off", "filter");
    			attr_dev(label0, "data-tg-on", "filter!");
    			add_location(label0, file$2, 512, 8, 14513);
    			attr_dev(div3, "class", "effect-inner svelte-hvomf6");
    			add_location(div3, file$2, 514, 8, 14624);
    			attr_dev(div4, "class", "effect svelte-hvomf6");
    			attr_dev(div4, "id", "eff-filter");
    			set_style(div4, "grid-area", "2 / 1 / 3 / 3");
    			add_location(div4, file$2, 509, 4, 14312);
    			attr_dev(input1, "class", "effect-toggle svelte-hvomf6");
    			attr_dev(input1, "type", "checkbox");
    			attr_dev(input1, "id", "tgl-ghost");
    			add_location(input1, file$2, 540, 8, 15458);
    			attr_dev(label1, "class", "tgl-btn svelte-hvomf6");
    			attr_dev(label1, "for", "tgl-ghost");
    			attr_dev(label1, "data-tg-off", "ghost");
    			attr_dev(label1, "data-tg-on", "ghost!");
    			add_location(label1, file$2, 542, 8, 15579);
    			attr_dev(button1, "class", "button3");
    			add_location(button1, file$2, 546, 16, 15774);
    			add_location(p, file$2, 547, 16, 15858);
    			attr_dev(div5, "class", "ghost-container-1 svelte-hvomf6");
    			add_location(div5, file$2, 545, 12, 15726);
    			attr_dev(div6, "class", "divider svelte-hvomf6");
    			add_location(div6, file$2, 550, 12, 15950);
    			attr_dev(input2, "type", "color");
    			attr_dev(input2, "class", "svelte-hvomf6");
    			add_location(input2, file$2, 558, 20, 16222);
    			attr_dev(div7, "class", "color-container svelte-hvomf6");
    			add_location(div7, file$2, 557, 16, 16172);
    			attr_dev(input3, "type", "color");
    			attr_dev(input3, "class", "svelte-hvomf6");
    			add_location(input3, file$2, 567, 20, 16548);
    			attr_dev(div8, "class", "color-container svelte-hvomf6");
    			add_location(div8, file$2, 566, 16, 16498);
    			attr_dev(div9, "class", "ghost-container svelte-hvomf6");
    			add_location(div9, file$2, 552, 12, 15991);
    			attr_dev(div10, "class", "effect-inner svelte-hvomf6");
    			add_location(div10, file$2, 544, 8, 15687);
    			attr_dev(div11, "class", "effect svelte-hvomf6");
    			attr_dev(div11, "id", "eff-ghost");
    			set_style(div11, "grid-area", "1 / 3 / 2 / 5");
    			add_location(div11, file$2, 539, 4, 15381);
    			attr_dev(input4, "class", "effect-toggle svelte-hvomf6");
    			attr_dev(input4, "type", "checkbox");
    			attr_dev(input4, "id", "tgl-movey");
    			add_location(input4, file$2, 597, 8, 17491);
    			attr_dev(label2, "class", "tgl-btn svelte-hvomf6");
    			attr_dev(label2, "for", "tgl-movey");
    			attr_dev(label2, "data-tg-off", "movey");
    			attr_dev(label2, "data-tg-on", "movey!");
    			add_location(label2, file$2, 599, 8, 17612);
    			attr_dev(div12, "class", "divider svelte-hvomf6");
    			add_location(div12, file$2, 614, 12, 18115);
    			attr_dev(input5, "type", "color");
    			attr_dev(input5, "class", "svelte-hvomf6");
    			add_location(input5, file$2, 622, 20, 18399);
    			attr_dev(div13, "class", "color-container svelte-hvomf6");
    			add_location(div13, file$2, 621, 16, 18349);
    			attr_dev(input6, "type", "color");
    			attr_dev(input6, "class", "svelte-hvomf6");
    			add_location(input6, file$2, 631, 20, 18725);
    			attr_dev(div14, "class", "color-container svelte-hvomf6");
    			add_location(div14, file$2, 630, 16, 18675);
    			attr_dev(div15, "class", "movey-container svelte-hvomf6");
    			add_location(div15, file$2, 616, 12, 18168);
    			attr_dev(div16, "class", "effect-inner svelte-hvomf6");
    			add_location(div16, file$2, 601, 8, 17720);
    			attr_dev(div17, "class", "effect svelte-hvomf6");
    			attr_dev(div17, "id", "eff-movey");
    			set_style(div17, "grid-area", "2 / 3 / 3 / 5");
    			add_location(div17, file$2, 596, 4, 17414);
    			attr_dev(input7, "class", "effect-toggle svelte-hvomf6");
    			attr_dev(input7, "type", "checkbox");
    			attr_dev(input7, "id", "tgl-pixel");
    			add_location(input7, file$2, 647, 8, 19218);
    			attr_dev(label3, "class", "tgl-btn svelte-hvomf6");
    			attr_dev(label3, "for", "tgl-pixel");
    			attr_dev(label3, "data-tg-off", "pixel");
    			attr_dev(label3, "data-tg-on", "pixel!");
    			add_location(label3, file$2, 649, 8, 19339);
    			attr_dev(div18, "class", "effect-inner svelte-hvomf6");
    			add_location(div18, file$2, 651, 8, 19447);
    			attr_dev(div19, "class", "effect svelte-hvomf6");
    			attr_dev(div19, "id", "eff-pixel");
    			set_style(div19, "grid-area", "1 / 5 / 2 / 6");
    			add_location(div19, file$2, 646, 4, 19141);
    			attr_dev(input8, "class", "effect-toggle svelte-hvomf6");
    			attr_dev(input8, "type", "checkbox");
    			attr_dev(input8, "id", "tgl-poster");
    			add_location(input8, file$2, 663, 8, 19823);
    			attr_dev(label4, "class", "tgl-btn svelte-hvomf6");
    			attr_dev(label4, "for", "tgl-poster");
    			attr_dev(label4, "data-tg-off", "poster");
    			attr_dev(label4, "data-tg-on", "poster!");
    			add_location(label4, file$2, 665, 8, 19946);
    			attr_dev(div20, "class", "effect-inner svelte-hvomf6");
    			add_location(div20, file$2, 667, 8, 20057);
    			attr_dev(div21, "class", "effect svelte-hvomf6");
    			attr_dev(div21, "id", "eff-poster");
    			set_style(div21, "grid-area", "2 / 5 / 3 / 6");
    			add_location(div21, file$2, 662, 4, 19745);
    			attr_dev(div22, "class", "backdrop svelte-hvomf6");
    			add_location(div22, file$2, 465, 0, 13014);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			append_dev(document.head, script);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div22, anchor);
    			append_dev(div22, div2);
    			if (if_block0) if_block0.m(div2, null);
    			append_dev(div2, t1);
    			append_dev(div2, video);
    			/*video_binding*/ ctx[20](video);
    			append_dev(div2, t2);
    			append_dev(div2, canvas0);
    			/*canvas0_binding*/ ctx[21](canvas0);
    			append_dev(div2, t3);
    			if (if_block1) if_block1.m(div2, null);
    			append_dev(div2, t4);
    			append_dev(div2, canvas1);
    			/*canvas1_binding*/ ctx[23](canvas1);
    			append_dev(div2, t5);
    			append_dev(div2, div1);
    			append_dev(div1, div0);
    			append_dev(div0, button0);
    			append_dev(div1, t7);
    			if (if_block2) if_block2.m(div1, null);
    			append_dev(div22, t8);
    			append_dev(div22, div4);
    			append_dev(div4, input0);
    			input0.checked = /*params_filter*/ ctx[11].active;
    			append_dev(div4, t9);
    			append_dev(div4, label0);
    			append_dev(div4, t10);
    			append_dev(div4, div3);
    			mount_component(slider0, div3, null);
    			append_dev(div3, t11);
    			mount_component(slider1, div3, null);
    			append_dev(div3, t12);
    			mount_component(slider2, div3, null);
    			append_dev(div22, t13);
    			append_dev(div22, div11);
    			append_dev(div11, input1);
    			input1.checked = /*params_ghost*/ ctx[0].active;
    			append_dev(div11, t14);
    			append_dev(div11, label1);
    			append_dev(div11, t15);
    			append_dev(div11, div10);
    			append_dev(div10, div5);
    			append_dev(div5, button1);
    			append_dev(div5, t17);
    			append_dev(div5, p);
    			append_dev(div10, t19);
    			append_dev(div10, div6);
    			append_dev(div10, t20);
    			append_dev(div10, div9);
    			mount_component(toggle0, div9, null);
    			append_dev(div9, t21);
    			append_dev(div9, div7);
    			append_dev(div7, input2);
    			set_input_value(input2, /*params_ghost*/ ctx[0].fg_hex);
    			append_dev(div9, t22);
    			mount_component(toggle1, div9, null);
    			append_dev(div9, t23);
    			append_dev(div9, div8);
    			append_dev(div8, input3);
    			set_input_value(input3, /*params_ghost*/ ctx[0].bg_hex);
    			append_dev(div10, t24);
    			mount_component(slider3, div10, null);
    			append_dev(div22, t25);
    			append_dev(div22, div17);
    			append_dev(div17, input4);
    			input4.checked = /*params_movey*/ ctx[1].active;
    			append_dev(div17, t26);
    			append_dev(div17, label2);
    			append_dev(div17, t27);
    			append_dev(div17, div16);
    			mount_component(slider4, div16, null);
    			append_dev(div16, t28);
    			mount_component(toggle2, div16, null);
    			append_dev(div16, t29);
    			append_dev(div16, div12);
    			append_dev(div16, t30);
    			append_dev(div16, div15);
    			mount_component(toggle3, div15, null);
    			append_dev(div15, t31);
    			append_dev(div15, div13);
    			append_dev(div13, input5);
    			set_input_value(input5, /*params_movey*/ ctx[1].fg_hex);
    			append_dev(div15, t32);
    			mount_component(toggle4, div15, null);
    			append_dev(div15, t33);
    			append_dev(div15, div14);
    			append_dev(div14, input6);
    			set_input_value(input6, /*params_movey*/ ctx[1].bg_hex);
    			append_dev(div16, t34);
    			mount_component(slider5, div16, null);
    			append_dev(div22, t35);
    			append_dev(div22, div19);
    			append_dev(div19, input7);
    			input7.checked = /*params_pixel*/ ctx[10].active;
    			append_dev(div19, t36);
    			append_dev(div19, label3);
    			append_dev(div19, t37);
    			append_dev(div19, div18);
    			mount_component(slider6, div18, null);
    			append_dev(div22, t38);
    			append_dev(div22, div21);
    			append_dev(div21, input8);
    			input8.checked = /*params_poster*/ ctx[12].active;
    			append_dev(div21, t39);
    			append_dev(div21, label4);
    			append_dev(div21, t40);
    			append_dev(div21, div20);
    			mount_component(slider7, div20, null);
    			append_dev(div20, t41);
    			mount_component(slider8, div20, null);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(script, "load", /*init*/ ctx[16], false, false, false, false),
    					listen_dev(button0, "click", /*doTrade*/ ctx[17], false, false, false, false),
    					listen_dev(input0, "change", /*input0_change_handler*/ ctx[24]),
    					listen_dev(input1, "change", /*input1_change_handler*/ ctx[28]),
    					listen_dev(button1, "click", /*ghost_doCapture*/ ctx[15], false, false, false, false),
    					listen_dev(input2, "input", /*input2_input_handler*/ ctx[30]),
    					listen_dev(input3, "input", /*input3_input_handler*/ ctx[32]),
    					listen_dev(input4, "change", /*input4_change_handler*/ ctx[34]),
    					listen_dev(input5, "input", /*input5_input_handler*/ ctx[38]),
    					listen_dev(input6, "input", /*input6_input_handler*/ ctx[40]),
    					listen_dev(input7, "change", /*input7_change_handler*/ ctx[42]),
    					listen_dev(input8, "change", /*input8_change_handler*/ ctx[44])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (/*loading*/ ctx[7]) {
    				if (if_block0) ; else {
    					if_block0 = create_if_block_2(ctx);
    					if_block0.c();
    					if_block0.m(div2, t1);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (!current || dirty[0] & /*viewport_showInput*/ 512 && video_style_value !== (video_style_value = /*viewport_showInput*/ ctx[9]
    			? "display:block"
    			: "display:none")) {
    				attr_dev(video, "style", video_style_value);
    			}

    			if (!current || dirty[0] & /*viewport_showInput*/ 512 && canvas0_style_value !== (canvas0_style_value = /*viewport_showInput*/ ctx[9]
    			? "display:none"
    			: "display:block")) {
    				attr_dev(canvas0, "style", canvas0_style_value);
    			}

    			if (/*params_poster*/ ctx[12].active) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_1(ctx);
    					if_block1.c();
    					if_block1.m(div2, t4);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (/*streaming*/ ctx[8]) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block$1(ctx);
    					if_block2.c();
    					if_block2.m(div1, null);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (dirty[0] & /*params_filter*/ 2048) {
    				input0.checked = /*params_filter*/ ctx[11].active;
    			}

    			const slider0_changes = {};

    			if (!updating_sliderValue && dirty[0] & /*params_filter*/ 2048) {
    				updating_sliderValue = true;
    				slider0_changes.sliderValue = /*params_filter*/ ctx[11].temp;
    				add_flush_callback(() => updating_sliderValue = false);
    			}

    			slider0.$set(slider0_changes);
    			const slider1_changes = {};

    			if (!updating_sliderValue_1 && dirty[0] & /*params_filter*/ 2048) {
    				updating_sliderValue_1 = true;
    				slider1_changes.sliderValue = /*params_filter*/ ctx[11].saturate;
    				add_flush_callback(() => updating_sliderValue_1 = false);
    			}

    			slider1.$set(slider1_changes);
    			const slider2_changes = {};

    			if (!updating_sliderValue_2 && dirty[0] & /*params_filter*/ 2048) {
    				updating_sliderValue_2 = true;
    				slider2_changes.sliderValue = /*params_filter*/ ctx[11].bright;
    				add_flush_callback(() => updating_sliderValue_2 = false);
    			}

    			slider2.$set(slider2_changes);

    			if (dirty[0] & /*params_ghost*/ 1) {
    				input1.checked = /*params_ghost*/ ctx[0].active;
    			}

    			const toggle0_changes = {};

    			if (!updating_opt && dirty[0] & /*params_ghost*/ 1) {
    				updating_opt = true;
    				toggle0_changes.opt = /*params_ghost*/ ctx[0].fg;
    				add_flush_callback(() => updating_opt = false);
    			}

    			toggle0.$set(toggle0_changes);

    			if (dirty[0] & /*params_ghost*/ 1) {
    				set_input_value(input2, /*params_ghost*/ ctx[0].fg_hex);
    			}

    			const toggle1_changes = {};

    			if (!updating_opt_1 && dirty[0] & /*params_ghost*/ 1) {
    				updating_opt_1 = true;
    				toggle1_changes.opt = /*params_ghost*/ ctx[0].bg;
    				add_flush_callback(() => updating_opt_1 = false);
    			}

    			toggle1.$set(toggle1_changes);

    			if (dirty[0] & /*params_ghost*/ 1) {
    				set_input_value(input3, /*params_ghost*/ ctx[0].bg_hex);
    			}

    			const slider3_changes = {};

    			if (!updating_sliderValue_3 && dirty[0] & /*params_ghost*/ 1) {
    				updating_sliderValue_3 = true;
    				slider3_changes.sliderValue = /*params_ghost*/ ctx[0].threshold;
    				add_flush_callback(() => updating_sliderValue_3 = false);
    			}

    			slider3.$set(slider3_changes);

    			if (dirty[0] & /*params_movey*/ 2) {
    				input4.checked = /*params_movey*/ ctx[1].active;
    			}

    			const slider4_changes = {};

    			if (!updating_sliderValue_4 && dirty[0] & /*params_movey*/ 2) {
    				updating_sliderValue_4 = true;
    				slider4_changes.sliderValue = /*params_movey*/ ctx[1].length;
    				add_flush_callback(() => updating_sliderValue_4 = false);
    			}

    			slider4.$set(slider4_changes);
    			const toggle2_changes = {};

    			if (!updating_opt_2 && dirty[0] & /*params_movey*/ 2) {
    				updating_opt_2 = true;
    				toggle2_changes.opt = /*params_movey*/ ctx[1].trail;
    				add_flush_callback(() => updating_opt_2 = false);
    			}

    			toggle2.$set(toggle2_changes);
    			const toggle3_changes = {};

    			if (!updating_opt_3 && dirty[0] & /*params_movey*/ 2) {
    				updating_opt_3 = true;
    				toggle3_changes.opt = /*params_movey*/ ctx[1].fg;
    				add_flush_callback(() => updating_opt_3 = false);
    			}

    			toggle3.$set(toggle3_changes);

    			if (dirty[0] & /*params_movey*/ 2) {
    				set_input_value(input5, /*params_movey*/ ctx[1].fg_hex);
    			}

    			const toggle4_changes = {};

    			if (!updating_opt_4 && dirty[0] & /*params_movey*/ 2) {
    				updating_opt_4 = true;
    				toggle4_changes.opt = /*params_movey*/ ctx[1].bg;
    				add_flush_callback(() => updating_opt_4 = false);
    			}

    			toggle4.$set(toggle4_changes);

    			if (dirty[0] & /*params_movey*/ 2) {
    				set_input_value(input6, /*params_movey*/ ctx[1].bg_hex);
    			}

    			const slider5_changes = {};

    			if (!updating_sliderValue_5 && dirty[0] & /*params_movey*/ 2) {
    				updating_sliderValue_5 = true;
    				slider5_changes.sliderValue = /*params_movey*/ ctx[1].threshold;
    				add_flush_callback(() => updating_sliderValue_5 = false);
    			}

    			slider5.$set(slider5_changes);

    			if (dirty[0] & /*params_pixel*/ 1024) {
    				input7.checked = /*params_pixel*/ ctx[10].active;
    			}

    			const slider6_changes = {};

    			if (!updating_sliderValue_6 && dirty[0] & /*params_pixel*/ 1024) {
    				updating_sliderValue_6 = true;
    				slider6_changes.sliderValue = /*params_pixel*/ ctx[10].chunkSize;
    				add_flush_callback(() => updating_sliderValue_6 = false);
    			}

    			slider6.$set(slider6_changes);

    			if (dirty[0] & /*params_poster*/ 4096) {
    				input8.checked = /*params_poster*/ ctx[12].active;
    			}

    			const slider7_changes = {};

    			if (!updating_sliderValue_7 && dirty[0] & /*params_poster*/ 4096) {
    				updating_sliderValue_7 = true;
    				slider7_changes.sliderValue = /*params_poster*/ ctx[12].threshold;
    				add_flush_callback(() => updating_sliderValue_7 = false);
    			}

    			slider7.$set(slider7_changes);
    			const slider8_changes = {};

    			if (!updating_sliderValue_8 && dirty[0] & /*params_poster*/ 4096) {
    				updating_sliderValue_8 = true;
    				slider8_changes.sliderValue = /*params_poster*/ ctx[12].maxvalue;
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
    			if (detaching) detach_dev(div22);
    			if (if_block0) if_block0.d();
    			/*video_binding*/ ctx[20](null);
    			/*canvas0_binding*/ ctx[21](null);
    			if (if_block1) if_block1.d();
    			/*canvas1_binding*/ ctx[23](null);
    			if (if_block2) if_block2.d();
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
    		id: create_fragment$2.name,
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

    function instance$2($$self, $$props, $$invalidate) {
    	let ghost_threshold;
    	let ghost_fg_rgb;
    	let ghost_bg_rgb;
    	let movey_threshold;
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
    	// FIFO queue for use in ghost effect (unused)
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
    	// let ghost_A = false;
    	// let ghost_fg = true;
    	// let ghost_bg = false;
    	// let ghost_capture = false;
    	// function ghost_doCapture() {ghost_capture = true;}
    	// let ghost_threshold = 30;
    	// $: gThreshold = ghost_threshold * ghost_threshold;
    	// let ghost_fg_hex = "#ffffff";
    	// let ghost_bg_hex = "#000000";
    	// $: ghost_fg_rgb = hextorgb(ghost_fg_hex);
    	// $: ghost_bg_rgb = hextorgb(ghost_bg_hex);
    	// let ghost_frame;
    	// let ghost_accum = new Queue();
    	let params_ghost = {
    		active: false,
    		fg: true,
    		bg: false,
    		capture: false,
    		threshold: 30,
    		fg_hex: "#ffffff",
    		bg_hex: "#000000"
    	};

    	function ghost_doCapture() {
    		$$invalidate(0, params_ghost.capture = true, params_ghost);
    	}

    	let ghost_frame;

    	// let pixel_A = false;
    	// let pixel_chunkSize = 3;
    	// let pixel_corner = [];
    	let params_pixel = { active: false, chunkSize: 3, corner: [] };

    	// let filter_A = false;
    	// let filter_temp = 50;
    	// let filter_saturate = 50;
    	// let filter_bright = 50; 
    	let params_filter = {
    		active: false,
    		temp: 50,
    		saturate: 50,
    		bright: 50
    	};

    	// let movey_A = false;
    	// let movey_fg = true;
    	// let movey_bg = false;
    	// let movey_trail = false;
    	// let movey_length = 10;
    	// let movey_threshold = 40;
    	// $: mThreshold = movey_threshold * movey_threshold;
    	// let movey_fg_hex = "#ffffff";
    	// let movey_bg_hex = "#000000";
    	// $: movey_fg_rgb = hextorgb(movey_fg_hex);
    	// $: movey_bg_rgb = hextorgb(movey_bg_hex);
    	// let prev;
    	// let movey_motion = Array(wt * ht).fill(0);
    	let params_movey = {
    		active: false,
    		fg: true,
    		bg: false,
    		trail: false,
    		length: 10,
    		threshold: 40,
    		fg_hex: "#ffffff",
    		bg_hex: "#000000",
    		motion: null
    	};

    	params_movey.motion = Array(wt * ht).fill(0);
    	let prev;

    	let params_poster = {
    		active: false,
    		threshold: 120,
    		maxvalue: 150
    	};

    	// -----------------
    	// loadPreset
    	// 
    	// change all effect attributes based on json file
    	// -----------------
    	function loadPreset() {
    		// translate string to json object
    		try {
    			const preset = JSON.parse(presetString);
    			$$invalidate(0, params_ghost.active = preset.ghost_A, params_ghost);
    			$$invalidate(0, params_ghost.fg = preset.ghost_fg, params_ghost);
    			$$invalidate(0, params_ghost.bg = preset.ghost_bg, params_ghost);
    			$$invalidate(0, params_ghost.capture = preset.ghost_capture, params_ghost);
    			$$invalidate(0, params_ghost.threshold = preset.ghost_threshold, params_ghost);
    			$$invalidate(0, params_ghost.fg_hex = preset.ghost_fg_hex, params_ghost);
    			$$invalidate(0, params_ghost.bg_hex = preset.ghost_bg_hex, params_ghost);
    			$$invalidate(10, params_pixel.active = preset.pixel_A, params_pixel);
    			$$invalidate(10, params_pixel.chunkSize = preset.pixel_chunkSize, params_pixel);
    			$$invalidate(11, params_filter.active = preset.filter_A, params_filter);
    			$$invalidate(11, params_filter.temp = preset.filter_temp, params_filter);
    			$$invalidate(11, params_filter.saturate = preset.filter_saturate, params_filter);
    			$$invalidate(11, params_filter.bright = preset.filter_bright, params_filter);
    			$$invalidate(1, params_movey.active = preset.movey_A, params_movey);
    			$$invalidate(1, params_movey.fg = preset.movey_fg, params_movey);
    			$$invalidate(1, params_movey.bg = preset.movey_bg, params_movey);
    			$$invalidate(1, params_movey.trail = preset.movey_trail, params_movey);
    			$$invalidate(1, params_movey.length = preset.movey_length, params_movey);
    			$$invalidate(1, params_movey.threshold = preset.movey_threshold, params_movey);
    			$$invalidate(1, params_movey.fg_hex = preset.movey_fg_hex, params_movey);
    			$$invalidate(1, params_movey.bg_hex = preset.movey_bg_hex, params_movey);
    			$$invalidate(12, params_poster.active = preset.poster_A, params_poster);
    			$$invalidate(12, params_poster.threshold = preset.poster_threshold, params_poster);
    			$$invalidate(12, params_poster.maxvalue = preset.poster_maxvalue, params_poster);
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
    		preset.ghost_A = params_ghost.active;
    		preset.ghost_fg = params_ghost.fg;
    		preset.ghost_bg = params_ghost.bg;
    		preset.ghost_capture = params_ghost.capture;
    		preset.ghost_threshold = params_ghost.threshold;
    		preset.ghost_fg_hex = params_ghost.fg_hex;
    		preset.ghost_bg_hex = params_ghost.bg_hex;
    		preset.pixel_A = params_pixel.active;
    		preset.pixel_chunkSize = params_pixel.chunkSize;
    		preset.filter_A = params_filter.active;
    		preset.filter_temp = params_filter.temp;
    		preset.filter_saturate = params_filter.saturate;
    		preset.filter_bright = params_filter.bright;
    		preset.movey_A = params_movey.active;
    		preset.movey_fg = params_movey.fg;
    		preset.movey_bg = params_movey.bg;
    		preset.movey_trail = params_movey.trail;
    		preset.movey_length = params_movey.length;
    		preset.movey_threshold = params_movey.threshold;
    		preset.movey_fg_hex = params_movey.fg_hex;
    		preset.movey_bg_hex = params_movey.bg_hex;
    		preset.poster_A = params_poster.active;
    		preset.poster_threshold = params_poster.threshold;
    		preset.poster_maxvalue = params_poster.maxvalue;
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
    		$$invalidate(8, streaming = true);
    		$$invalidate(7, loading = true);
    		const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    		$$invalidate(3, v_in.srcObject = stream, v_in);
    		v_in.play();
    		$$invalidate(7, loading = false);
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

    		if (params_pixel.active) {
    			// for each row
    			for (let y = 0; y < ht; y += params_pixel.chunkSize) {
    				// for each col
    				for (let x = 0; x < wt; x += params_pixel.chunkSize) {
    					$$invalidate(10, params_pixel.corner = v_temp_ctx.getImageData(x, y, 1, 1).data, params_pixel);
    					v_temp_ctx.fillStyle = "rgb(" + params_pixel.corner[0] + "," + params_pixel.corner[1] + "," + params_pixel.corner[2] + ")";
    					v_temp_ctx.fillRect(x, y, params_pixel.chunkSize, params_pixel.chunkSize);
    				}
    			}
    		}

    		frame = v_temp_ctx.getImageData(0, 0, wt, ht);

    		for (let i = 0; i < frame.data.length / 4; i++) {
    			let r = frame.data[i * 4 + 0];
    			let g = frame.data[i * 4 + 1];
    			let b = frame.data[i * 4 + 2];

    			if (params_ghost.active) {
    				if (distSq(r, g, b, ghost_frame.data[i * 4 + 0], ghost_frame.data[i * 4 + 1], ghost_frame.data[i * 4 + 2]) > ghost_threshold) {
    					if (params_ghost.fg) {
    						r = ghost_fg_rgb.r;
    						g = ghost_fg_rgb.g;
    						b = ghost_fg_rgb.b;
    					}
    				} else if (params_ghost.bg) {
    					r = ghost_bg_rgb.r;
    					g = ghost_bg_rgb.g;
    					b = ghost_bg_rgb.b;
    				}
    			}

    			if (params_movey.active) {
    				if (params_movey.motion[i * 4 + 0] > 0) {
    					if (params_movey.fg) {
    						r = movey_fg_rgb.r;
    						g = movey_fg_rgb.g;
    						b = movey_fg_rgb.b;
    					}
    				} else if (distSq(r, g, b, prev.data[i * 4 + 0], prev.data[i * 4 + 1], prev.data[i * 4 + 2]) > movey_threshold) {
    					if (params_movey.fg) {
    						r = movey_fg_rgb.r;
    						g = movey_fg_rgb.g;
    						b = movey_fg_rgb.b;
    					}

    					if (params_movey.trail) $$invalidate(1, params_movey.motion[i * 4 + 0] = params_movey.length, params_movey);
    				} else if (params_movey.bg) {
    					r = movey_bg_rgb.r;
    					g = movey_bg_rgb.g;
    					b = movey_bg_rgb.b;
    				}

    				// decrement current pixel in motion array
    				$$invalidate(1, params_movey.motion[i * 4 + 0]--, params_movey);
    			}

    			if (params_filter.active) {
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

    				let temp_amt = params_filter.temp - 50;
    				if (temp_amt > 0) r += temp_amt; else b += temp_amt;
    				let saturate_amt = params_filter.saturate - 50;
    				if (r == max) r += saturate_amt; else if (g == max) g += saturate_amt; else if (b == max) b += saturate_amt;
    				if (r == min) r -= saturate_amt; else if (g == min) g -= saturate_amt; else if (b == min) b -= saturate_amt;
    				let bright_amt = params_filter.bright - 50;
    				r += bright_amt;
    				g += bright_amt;
    				b += bright_amt;
    			}

    			frame.data[i * 4 + 0] = r;
    			frame.data[i * 4 + 1] = g;
    			frame.data[i * 4 + 2] = b;
    		}

    		if (params_movey.active) prev = v_temp_ctx.getImageData(0, 0, wt, ht);

    		if (params_ghost.capture) {
    			ghost_frame = v_temp_ctx.getImageData(0, 0, wt, ht);
    			$$invalidate(0, params_ghost.capture = false, params_ghost);
    		}

    		v_out_ctx.putImageData(frame, 0, 0);

    		// #endregion
    		ocv_mat_src.data.set(v_out_ctx_ocv.getImageData(0, 0, wt, ht).data);

    		if (params_poster.active) {
    			cv.threshold(ocv_mat_src, ocv_mat_dst, params_poster.threshold, params_poster.maxvalue, cv.THRESH_BINARY);
    			cv.imshow("v_out_ocv", ocv_mat_dst);
    		}

    		delay = 1000 / 30 - (Date.now() - begin);

    		if (iter > 3) {
    			//update fps every 3 frames
    			$$invalidate(2, fps = parseInt(delay));

    			iter = 0;
    		} else iter++;

    		setTimeout(computeFrame, delay);
    	}

    	function doTrade() {
    		$$invalidate(9, viewport_showInput = !viewport_showInput);
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
    			$$invalidate(3, v_in);
    		});
    	}

    	function canvas0_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			v_out = $$value;
    			$$invalidate(4, v_out);
    		});
    	}

    	function canvas_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			v_out_ocv = $$value;
    			$$invalidate(5, v_out_ocv);
    		});
    	}

    	function canvas1_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			v_temp = $$value;
    			$$invalidate(6, v_temp);
    		});
    	}

    	function input0_change_handler() {
    		params_filter.active = this.checked;
    		$$invalidate(11, params_filter);
    	}

    	function slider0_sliderValue_binding(value) {
    		if ($$self.$$.not_equal(params_filter.temp, value)) {
    			params_filter.temp = value;
    			$$invalidate(11, params_filter);
    		}
    	}

    	function slider1_sliderValue_binding(value) {
    		if ($$self.$$.not_equal(params_filter.saturate, value)) {
    			params_filter.saturate = value;
    			$$invalidate(11, params_filter);
    		}
    	}

    	function slider2_sliderValue_binding(value) {
    		if ($$self.$$.not_equal(params_filter.bright, value)) {
    			params_filter.bright = value;
    			$$invalidate(11, params_filter);
    		}
    	}

    	function input1_change_handler() {
    		params_ghost.active = this.checked;
    		$$invalidate(0, params_ghost);
    	}

    	function toggle0_opt_binding(value) {
    		if ($$self.$$.not_equal(params_ghost.fg, value)) {
    			params_ghost.fg = value;
    			$$invalidate(0, params_ghost);
    		}
    	}

    	function input2_input_handler() {
    		params_ghost.fg_hex = this.value;
    		$$invalidate(0, params_ghost);
    	}

    	function toggle1_opt_binding(value) {
    		if ($$self.$$.not_equal(params_ghost.bg, value)) {
    			params_ghost.bg = value;
    			$$invalidate(0, params_ghost);
    		}
    	}

    	function input3_input_handler() {
    		params_ghost.bg_hex = this.value;
    		$$invalidate(0, params_ghost);
    	}

    	function slider3_sliderValue_binding(value) {
    		if ($$self.$$.not_equal(params_ghost.threshold, value)) {
    			params_ghost.threshold = value;
    			$$invalidate(0, params_ghost);
    		}
    	}

    	function input4_change_handler() {
    		params_movey.active = this.checked;
    		$$invalidate(1, params_movey);
    	}

    	function slider4_sliderValue_binding(value) {
    		if ($$self.$$.not_equal(params_movey.length, value)) {
    			params_movey.length = value;
    			$$invalidate(1, params_movey);
    		}
    	}

    	function toggle2_opt_binding(value) {
    		if ($$self.$$.not_equal(params_movey.trail, value)) {
    			params_movey.trail = value;
    			$$invalidate(1, params_movey);
    		}
    	}

    	function toggle3_opt_binding(value) {
    		if ($$self.$$.not_equal(params_movey.fg, value)) {
    			params_movey.fg = value;
    			$$invalidate(1, params_movey);
    		}
    	}

    	function input5_input_handler() {
    		params_movey.fg_hex = this.value;
    		$$invalidate(1, params_movey);
    	}

    	function toggle4_opt_binding(value) {
    		if ($$self.$$.not_equal(params_movey.bg, value)) {
    			params_movey.bg = value;
    			$$invalidate(1, params_movey);
    		}
    	}

    	function input6_input_handler() {
    		params_movey.bg_hex = this.value;
    		$$invalidate(1, params_movey);
    	}

    	function slider5_sliderValue_binding(value) {
    		if ($$self.$$.not_equal(params_movey.threshold, value)) {
    			params_movey.threshold = value;
    			$$invalidate(1, params_movey);
    		}
    	}

    	function input7_change_handler() {
    		params_pixel.active = this.checked;
    		$$invalidate(10, params_pixel);
    	}

    	function slider6_sliderValue_binding(value) {
    		if ($$self.$$.not_equal(params_pixel.chunkSize, value)) {
    			params_pixel.chunkSize = value;
    			$$invalidate(10, params_pixel);
    		}
    	}

    	function input8_change_handler() {
    		params_poster.active = this.checked;
    		$$invalidate(12, params_poster);
    	}

    	function slider7_sliderValue_binding(value) {
    		if ($$self.$$.not_equal(params_poster.threshold, value)) {
    			params_poster.threshold = value;
    			$$invalidate(12, params_poster);
    		}
    	}

    	function slider8_sliderValue_binding(value) {
    		if ($$self.$$.not_equal(params_poster.maxvalue, value)) {
    			params_poster.maxvalue = value;
    			$$invalidate(12, params_poster);
    		}
    	}

    	$$self.$$set = $$props => {
    		if ('presetString' in $$props) $$invalidate(18, presetString = $$props.presetString);
    		if ('presetSaving' in $$props) $$invalidate(19, presetSaving = $$props.presetSaving);
    	};

    	$$self.$capture_state = () => ({
    		Slider,
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
    		params_ghost,
    		ghost_doCapture,
    		ghost_frame,
    		params_pixel,
    		params_filter,
    		params_movey,
    		prev,
    		params_poster,
    		loadPreset,
    		savePreset,
    		init,
    		computeFrame,
    		doPopout,
    		doTrade,
    		distSq,
    		movey_bg_rgb,
    		movey_fg_rgb,
    		movey_threshold,
    		ghost_bg_rgb,
    		ghost_fg_rgb,
    		ghost_threshold
    	});

    	$$self.$inject_state = $$props => {
    		if ('presetString' in $$props) $$invalidate(18, presetString = $$props.presetString);
    		if ('presetSaving' in $$props) $$invalidate(19, presetSaving = $$props.presetSaving);
    		if ('fps' in $$props) $$invalidate(2, fps = $$props.fps);
    		if ('delay' in $$props) delay = $$props.delay;
    		if ('iter' in $$props) iter = $$props.iter;
    		if ('v_in' in $$props) $$invalidate(3, v_in = $$props.v_in);
    		if ('v_out' in $$props) $$invalidate(4, v_out = $$props.v_out);
    		if ('v_out_ocv' in $$props) $$invalidate(5, v_out_ocv = $$props.v_out_ocv);
    		if ('v_out_ctx' in $$props) v_out_ctx = $$props.v_out_ctx;
    		if ('v_out_ctx_ocv' in $$props) v_out_ctx_ocv = $$props.v_out_ctx_ocv;
    		if ('v_temp' in $$props) $$invalidate(6, v_temp = $$props.v_temp);
    		if ('v_temp_ctx' in $$props) v_temp_ctx = $$props.v_temp_ctx;
    		if ('ocv_mat_src' in $$props) ocv_mat_src = $$props.ocv_mat_src;
    		if ('ocv_mat_tmp1' in $$props) ocv_mat_tmp1 = $$props.ocv_mat_tmp1;
    		if ('ocv_mat_dst' in $$props) ocv_mat_dst = $$props.ocv_mat_dst;
    		if ('ocv_mask' in $$props) ocv_mask = $$props.ocv_mask;
    		if ('ocv_fgbg' in $$props) ocv_fgbg = $$props.ocv_fgbg;
    		if ('frame' in $$props) frame = $$props.frame;
    		if ('loading' in $$props) $$invalidate(7, loading = $$props.loading);
    		if ('streaming' in $$props) $$invalidate(8, streaming = $$props.streaming);
    		if ('viewport_showInput' in $$props) $$invalidate(9, viewport_showInput = $$props.viewport_showInput);
    		if ('params_ghost' in $$props) $$invalidate(0, params_ghost = $$props.params_ghost);
    		if ('ghost_frame' in $$props) ghost_frame = $$props.ghost_frame;
    		if ('params_pixel' in $$props) $$invalidate(10, params_pixel = $$props.params_pixel);
    		if ('params_filter' in $$props) $$invalidate(11, params_filter = $$props.params_filter);
    		if ('params_movey' in $$props) $$invalidate(1, params_movey = $$props.params_movey);
    		if ('prev' in $$props) prev = $$props.prev;
    		if ('params_poster' in $$props) $$invalidate(12, params_poster = $$props.params_poster);
    		if ('movey_bg_rgb' in $$props) movey_bg_rgb = $$props.movey_bg_rgb;
    		if ('movey_fg_rgb' in $$props) movey_fg_rgb = $$props.movey_fg_rgb;
    		if ('movey_threshold' in $$props) movey_threshold = $$props.movey_threshold;
    		if ('ghost_bg_rgb' in $$props) ghost_bg_rgb = $$props.ghost_bg_rgb;
    		if ('ghost_fg_rgb' in $$props) ghost_fg_rgb = $$props.ghost_fg_rgb;
    		if ('ghost_threshold' in $$props) ghost_threshold = $$props.ghost_threshold;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*presetString*/ 262144) {
    			presetString && loadPreset();
    		}

    		if ($$self.$$.dirty[0] & /*presetSaving*/ 524288) {
    			presetSaving && savePreset();
    		}

    		if ($$self.$$.dirty[0] & /*params_ghost*/ 1) {
    			ghost_threshold = params_ghost.threshold * params_ghost.threshold;
    		}

    		if ($$self.$$.dirty[0] & /*params_ghost*/ 1) {
    			ghost_fg_rgb = hextorgb(params_ghost.fg_hex);
    		}

    		if ($$self.$$.dirty[0] & /*params_ghost*/ 1) {
    			ghost_bg_rgb = hextorgb(params_ghost.bg_hex);
    		}

    		if ($$self.$$.dirty[0] & /*params_movey*/ 2) {
    			movey_threshold = params_movey.threshold * params_movey.threshold;
    		}

    		if ($$self.$$.dirty[0] & /*params_movey*/ 2) {
    			movey_fg_rgb = hextorgb(params_movey.fg_hex);
    		}

    		if ($$self.$$.dirty[0] & /*params_movey*/ 2) {
    			movey_bg_rgb = hextorgb(params_movey.bg_hex);
    		}
    	};

    	return [
    		params_ghost,
    		params_movey,
    		fps,
    		v_in,
    		v_out,
    		v_out_ocv,
    		v_temp,
    		loading,
    		streaming,
    		viewport_showInput,
    		params_pixel,
    		params_filter,
    		params_poster,
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
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { presetString: 18, presetSaving: 19 }, null, [-1, -1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Control",
    			options,
    			id: create_fragment$2.name
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

    /* src/Modal.svelte generated by Svelte v3.57.0 */

    const file$1 = "src/Modal.svelte";

    // (6:0) {#if showModal}
    function create_if_block(ctx) {
    	let div8;
    	let div7;
    	let div1;
    	let h1;
    	let t1;
    	let div0;
    	let h30;
    	let t3;
    	let button;
    	let t5;
    	let div5;
    	let div2;
    	let h31;
    	let t6;
    	let t7;
    	let input0;
    	let t8;
    	let div3;
    	let h32;
    	let t10;
    	let input1;
    	let t11;
    	let label;
    	let t12;
    	let div4;
    	let h33;
    	let t14;
    	let div6;
    	let a;
    	let img;
    	let img_src_value;
    	let t15;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div8 = element("div");
    			div7 = element("div");
    			div1 = element("div");
    			h1 = element("h1");
    			h1.textContent = "Welcome to bagelcam.";
    			t1 = space();
    			div0 = element("div");
    			h30 = element("h3");
    			h30.textContent = "This app requires access to \n                    your device's built-in webcam.";
    			t3 = space();
    			button = element("button");
    			button.textContent = "I'm ready!";
    			t5 = space();
    			div5 = element("div");
    			div2 = element("div");
    			h31 = element("h3");
    			t6 = text("Use color pickers to choose your favorite color.");
    			t7 = space();
    			input0 = element("input");
    			t8 = space();
    			div3 = element("div");
    			h32 = element("h3");
    			h32.textContent = "Click an effect's name to enable it.";
    			t10 = space();
    			input1 = element("input");
    			t11 = space();
    			label = element("label");
    			t12 = space();
    			div4 = element("div");
    			h33 = element("h3");
    			h33.textContent = "Choose a preset or make your own.";
    			t14 = space();
    			div6 = element("div");
    			a = element("a");
    			img = element("img");
    			t15 = text("\n            Created by Brett Ennis");
    			add_location(h1, file$1, 10, 12, 256);
    			set_style(h30, "width", "60%");
    			add_location(h30, file$1, 12, 16, 346);
    			attr_dev(button, "class", "button-start svelte-b4jw4");
    			add_location(button, file$1, 16, 16, 507);
    			attr_dev(div0, "class", "button-start-flex svelte-b4jw4");
    			add_location(div0, file$1, 11, 12, 298);
    			attr_dev(div1, "class", "welcome svelte-b4jw4");
    			add_location(div1, file$1, 9, 8, 222);
    			set_style(h31, "color", /*tutorial_text_color*/ ctx[1]);
    			add_location(h31, file$1, 21, 16, 677);
    			attr_dev(input0, "type", "color");
    			attr_dev(input0, "class", "svelte-b4jw4");
    			add_location(input0, file$1, 24, 16, 825);
    			attr_dev(div2, "class", "info-row svelte-b4jw4");
    			add_location(div2, file$1, 20, 12, 638);
    			add_location(h32, file$1, 27, 16, 949);
    			attr_dev(input1, "class", "effect-toggle svelte-b4jw4");
    			attr_dev(input1, "type", "checkbox");
    			attr_dev(input1, "id", "tgl-tut");
    			add_location(input1, file$1, 30, 16, 1049);
    			attr_dev(label, "class", "tgl-btn svelte-b4jw4");
    			attr_dev(label, "for", "tgl-tut");
    			attr_dev(label, "data-tg-off", "click me");
    			attr_dev(label, "data-tg-on", "enabled!");
    			add_location(label, file$1, 33, 16, 1170);
    			attr_dev(div3, "class", "info-row svelte-b4jw4");
    			add_location(div3, file$1, 26, 12, 910);
    			add_location(h33, file$1, 39, 16, 1393);
    			attr_dev(div4, "class", "info-row svelte-b4jw4");
    			add_location(div4, file$1, 38, 12, 1354);
    			attr_dev(div5, "class", "info svelte-b4jw4");
    			add_location(div5, file$1, 19, 8, 607);
    			attr_dev(img, "class", "logo");
    			attr_dev(img, "alt", "https://github.com/brettennis");
    			if (!src_url_equal(img.src, img_src_value = "images/github-mark-white.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "width", "40px");
    			add_location(img, file$1, 47, 16, 1684);
    			attr_dev(a, "href", "https://github.com/brettennis");
    			add_location(a, file$1, 46, 12, 1627);
    			attr_dev(div6, "class", "created-by svelte-b4jw4");
    			add_location(div6, file$1, 45, 8, 1590);
    			attr_dev(div7, "class", "modal svelte-b4jw4");
    			add_location(div7, file$1, 8, 4, 194);
    			attr_dev(div8, "class", "backdrop svelte-b4jw4");
    			add_location(div8, file$1, 7, 0, 167);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div8, anchor);
    			append_dev(div8, div7);
    			append_dev(div7, div1);
    			append_dev(div1, h1);
    			append_dev(div1, t1);
    			append_dev(div1, div0);
    			append_dev(div0, h30);
    			append_dev(div0, t3);
    			append_dev(div0, button);
    			append_dev(div7, t5);
    			append_dev(div7, div5);
    			append_dev(div5, div2);
    			append_dev(div2, h31);
    			append_dev(h31, t6);
    			append_dev(div2, t7);
    			append_dev(div2, input0);
    			set_input_value(input0, /*tutorial_text_color*/ ctx[1]);
    			append_dev(div5, t8);
    			append_dev(div5, div3);
    			append_dev(div3, h32);
    			append_dev(div3, t10);
    			append_dev(div3, input1);
    			append_dev(div3, t11);
    			append_dev(div3, label);
    			append_dev(div5, t12);
    			append_dev(div5, div4);
    			append_dev(div4, h33);
    			append_dev(div7, t14);
    			append_dev(div7, div6);
    			append_dev(div6, a);
    			append_dev(a, img);
    			append_dev(div6, t15);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button, "click", /*click_handler*/ ctx[2], false, false, false, false),
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[3])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*tutorial_text_color*/ 2) {
    				set_style(h31, "color", /*tutorial_text_color*/ ctx[1]);
    			}

    			if (dirty & /*tutorial_text_color*/ 2) {
    				set_input_value(input0, /*tutorial_text_color*/ ctx[1]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div8);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(6:0) {#if showModal}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let if_block_anchor;
    	let if_block = /*showModal*/ ctx[0] && create_if_block(ctx);

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
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*showModal*/ ctx[0]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
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

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Modal', slots, []);
    	let { showModal = true } = $$props;
    	let tutorial_text_color = "#c43b33";
    	const writable_props = ['showModal'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Modal> was created with unknown prop '${key}'`);
    	});

    	function click_handler(event) {
    		bubble.call(this, $$self, event);
    	}

    	function input0_input_handler() {
    		tutorial_text_color = this.value;
    		$$invalidate(1, tutorial_text_color);
    	}

    	$$self.$$set = $$props => {
    		if ('showModal' in $$props) $$invalidate(0, showModal = $$props.showModal);
    	};

    	$$self.$capture_state = () => ({ showModal, tutorial_text_color });

    	$$self.$inject_state = $$props => {
    		if ('showModal' in $$props) $$invalidate(0, showModal = $$props.showModal);
    		if ('tutorial_text_color' in $$props) $$invalidate(1, tutorial_text_color = $$props.tutorial_text_color);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [showModal, tutorial_text_color, click_handler, input0_input_handler];
    }

    class Modal extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { showModal: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Modal",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get showModal() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set showModal(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/App.svelte generated by Svelte v3.57.0 */
    const file = "src/App.svelte";

    function create_fragment(ctx) {
    	let modal;
    	let t0;
    	let div1;
    	let div0;
    	let button;
    	let t2;
    	let sidebar;
    	let updating_presetString;
    	let updating_presetSaving;
    	let t3;
    	let control;
    	let updating_presetString_1;
    	let updating_presetSaving_1;
    	let current;
    	let mounted;
    	let dispose;

    	modal = new Modal({
    			props: { showModal: /*showModal*/ ctx[0] },
    			$$inline: true
    		});

    	modal.$on("click", /*toggleModal*/ ctx[3]);

    	function sidebar_presetString_binding(value) {
    		/*sidebar_presetString_binding*/ ctx[4](value);
    	}

    	function sidebar_presetSaving_binding(value) {
    		/*sidebar_presetSaving_binding*/ ctx[5](value);
    	}

    	let sidebar_props = {};

    	if (/*preset*/ ctx[1] !== void 0) {
    		sidebar_props.presetString = /*preset*/ ctx[1];
    	}

    	if (/*presetSaving*/ ctx[2] !== void 0) {
    		sidebar_props.presetSaving = /*presetSaving*/ ctx[2];
    	}

    	sidebar = new Sidebar({ props: sidebar_props, $$inline: true });
    	binding_callbacks.push(() => bind(sidebar, 'presetString', sidebar_presetString_binding));
    	binding_callbacks.push(() => bind(sidebar, 'presetSaving', sidebar_presetSaving_binding));

    	function control_presetString_binding(value) {
    		/*control_presetString_binding*/ ctx[6](value);
    	}

    	function control_presetSaving_binding(value) {
    		/*control_presetSaving_binding*/ ctx[7](value);
    	}

    	let control_props = {};

    	if (/*preset*/ ctx[1] !== void 0) {
    		control_props.presetString = /*preset*/ ctx[1];
    	}

    	if (/*presetSaving*/ ctx[2] !== void 0) {
    		control_props.presetSaving = /*presetSaving*/ ctx[2];
    	}

    	control = new Control({ props: control_props, $$inline: true });
    	binding_callbacks.push(() => bind(control, 'presetString', control_presetString_binding));
    	binding_callbacks.push(() => bind(control, 'presetSaving', control_presetSaving_binding));

    	const block = {
    		c: function create() {
    			create_component(modal.$$.fragment);
    			t0 = space();
    			div1 = element("div");
    			div0 = element("div");
    			button = element("button");
    			button.textContent = "i";
    			t2 = space();
    			create_component(sidebar.$$.fragment);
    			t3 = space();
    			create_component(control.$$.fragment);
    			attr_dev(button, "class", "showModal svelte-j8w88h");
    			add_location(button, file, 24, 2, 349);
    			attr_dev(div0, "class", "container svelte-j8w88h");
    			add_location(div0, file, 22, 1, 322);
    			add_location(div1, file, 18, 0, 291);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(modal, target, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div0, button);
    			append_dev(div0, t2);
    			mount_component(sidebar, div0, null);
    			append_dev(div0, t3);
    			mount_component(control, div0, null);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*toggleModal*/ ctx[3], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			const modal_changes = {};
    			if (dirty & /*showModal*/ 1) modal_changes.showModal = /*showModal*/ ctx[0];
    			modal.$set(modal_changes);
    			const sidebar_changes = {};

    			if (!updating_presetString && dirty & /*preset*/ 2) {
    				updating_presetString = true;
    				sidebar_changes.presetString = /*preset*/ ctx[1];
    				add_flush_callback(() => updating_presetString = false);
    			}

    			if (!updating_presetSaving && dirty & /*presetSaving*/ 4) {
    				updating_presetSaving = true;
    				sidebar_changes.presetSaving = /*presetSaving*/ ctx[2];
    				add_flush_callback(() => updating_presetSaving = false);
    			}

    			sidebar.$set(sidebar_changes);
    			const control_changes = {};

    			if (!updating_presetString_1 && dirty & /*preset*/ 2) {
    				updating_presetString_1 = true;
    				control_changes.presetString = /*preset*/ ctx[1];
    				add_flush_callback(() => updating_presetString_1 = false);
    			}

    			if (!updating_presetSaving_1 && dirty & /*presetSaving*/ 4) {
    				updating_presetSaving_1 = true;
    				control_changes.presetSaving = /*presetSaving*/ ctx[2];
    				add_flush_callback(() => updating_presetSaving_1 = false);
    			}

    			control.$set(control_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(modal.$$.fragment, local);
    			transition_in(sidebar.$$.fragment, local);
    			transition_in(control.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(modal.$$.fragment, local);
    			transition_out(sidebar.$$.fragment, local);
    			transition_out(control.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(modal, detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div1);
    			destroy_component(sidebar);
    			destroy_component(control);
    			mounted = false;
    			dispose();
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
    	let showModal = true;
    	let preset;
    	let presetSaving;

    	const toggleModal = () => {
    		$$invalidate(0, showModal = !showModal);
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function sidebar_presetString_binding(value) {
    		preset = value;
    		$$invalidate(1, preset);
    	}

    	function sidebar_presetSaving_binding(value) {
    		presetSaving = value;
    		$$invalidate(2, presetSaving);
    	}

    	function control_presetString_binding(value) {
    		preset = value;
    		$$invalidate(1, preset);
    	}

    	function control_presetSaving_binding(value) {
    		presetSaving = value;
    		$$invalidate(2, presetSaving);
    	}

    	$$self.$capture_state = () => ({
    		Sidebar,
    		Control,
    		Modal,
    		showModal,
    		preset,
    		presetSaving,
    		toggleModal
    	});

    	$$self.$inject_state = $$props => {
    		if ('showModal' in $$props) $$invalidate(0, showModal = $$props.showModal);
    		if ('preset' in $$props) $$invalidate(1, preset = $$props.preset);
    		if ('presetSaving' in $$props) $$invalidate(2, presetSaving = $$props.presetSaving);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		showModal,
    		preset,
    		presetSaving,
    		toggleModal,
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
