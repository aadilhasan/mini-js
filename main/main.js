

var define_property = function (obj, prop, value, def) {

    if (value == undefined) {

        obj[prop] = def

    } else {

        obj[prop] = value;

    }

}

var init_methods = function (instance, methods) {
    var data = this.$data;

    function init_method(name, method) {

        data[name] = function () {

            return method.apply(instance, arguments);

        }

    }

    for (var method in methods) {

        init_method(method, methods[method])

    }


}

var call_hooks = function (instance, name) {

    var hook = instance.$hooks[name];

    if (hook !== undefined) {

        hook.call(instance);

    }

}


var Observer = function (instance) {
    // Associated Moon Instance

    this.instance = instance;

    // Computed Property Cache
    this.cache = {};

    // Computed Property Setters
    this.setters = {};

    // Set of events to clear cache when dependencies change
    this.clear = {};

    // Property Currently Being Observed for Dependencies
    this.target = null;

    // Dependency Map
    this.map = {};
}

var create_element = function (tag, val, props, meta, children) {

    return {
        type: tag,
        val: val,
        props: props,
        children: children,
        meta: meta || default_metadata()
    }

}

var TEXT_TYPE = '#text', eventModifiers = {}, components = {};


/**
 * Compiles Arguments to a VNode
 * @param {String} tag
 * @param {Object} attrs
 * @param {Object} meta
 * @param {Object|String} children
 * @return {Object} Object usable in Virtual DOM (VNode)
 */
var m = function (tag, attrs, meta, children) {

    var component = null;

    if (tag == TEXT_TYPE) {
        // Text Node
        // Tag => #text
        // Attrs => meta
        // Meta => val
        return create_element(TEXT_TYPE, meta, {attrs: {}}, attrs, []);

    } else if ((component = components[tag]) !== undefined) {

        //console.log(' found a component in \"m\" function  :: ', component);
        //    can write code for custom compomemts

    }

    return create_element(tag, "", attrs, meta, children);

    // In the end, we have a VNode structure like:
    // {
    //  type: 'h1', <= nodename
    //  props: {
    //    attrs: {'id': 'someId'}, <= regular attributes
    //    dom: {'textContent': 'some text content'} <= only for DOM properties added by directives,
    //    directives: {'m-mask': ''} <= any directives
    //  },
    //  meta: {}, <= metadata used internally
    //  children: [], <= any child nodes
    // }

}


/**
 * Renders a Class in Array/Object Form
 * @param {Array|Object|String} classNames
 * @return {String} renderedClassNames
 */
m.renderClass = function (classNames) {
    if (typeof classNames === "string") {
        // If they are a string, no need for any more processing
        return classNames;
    }

    var renderedClassNames = "";
    if (Array.isArray(classNames)) {
        // It's an array, so go through them all and generate a string
        for (var i = 0; i < classNames.length; i++) {
            renderedClassNames += (m.renderClass(classNames[i])) + " ";
        }
    } else if (typeof classNames === "object") {
        // It's an object, so to through and render them to a string if the corresponding condition is truthy
        for (var className in classNames) {
            if (classNames[className]) {
                renderedClassNames += className + " ";
            }
        }
    }

    // Remove trailing space and return
    renderedClassNames = renderedClassNames.slice(0, -1);
    return renderedClassNames;
}

/**
 * Renders "m-for" Directive Array
 * @param {Array|Object|Number} iteratable
 * @param {Function} item
 */
m.renderLoop = function (iteratable, item) {
    var items = null;

    if (Array.isArray(iteratable)) {
        items = new Array(iteratable.length);

        // Iterate through the array
        for (var i = 0; i < iteratable.length; i++) {
            items[i] = item(iteratable[i], i);
        }
    } else if (typeof iteratable === "object") {
        items = [];

        // Iterate through the object
        for (var key in iteratable) {
            items.push(item(iteratable[key], key));
        }
    } else if (typeof iteratable === "number") {
        items = new Array(iteratable);

        // Repeat a certain amount of times
        for (var i$1 = 0; i$1 < iteratable; i$1++) {
            items[i$1] = item(i$1 + 1, i$1);
        }
    }

    return items;
}

/**
 * Renders an Event Modifier
 * @param {Number} keyCode
 * @param {String} modifier
 */
m.renderEventModifier = function (keyCode, modifier) {
    return keyCode === eventModifiers[modifier];
}


function Mini(options) {

    if (options === undefined) {
        options = {}
    }

    this.$options = options;
    // save/set app name
    define_property(this, '$name', options.name, 'root');

    var data = options.data;

    // save data
    if (data == undefined) {

        this.$data = {}

    } else if (typeof data == 'function') {

        this.$data = data();

    } else {

        this.$data = data;

    }

    // set render function if there
    define_property(this, '$render', options.render, noop);

    // set custom hooks
    define_property(this, '$hooks', options.hooks, {});


    var methods = options.methods;

    if (methods !== undefined) {

        init_methods(this, methods); // save methods in $data object

    }

    this.$events = {};
    this.$dom = {};
    this.$observer = new Observer(this);
    this.$destroyed = true;
    this.$queued = false;

//    computed method can be added here;


//=====================================


    //this.init();  // initialize the app.


}

var append_child = function (node, v_node, parent) {

    //console.log(" appending :: ", node, v_node, parent);
    parent.appendChild(node);

//     can write code for custom component here, if v_node is a custom component;

}

var add_event_listeners = function (node, event_listeners) {

    var add_handler = function (type) {

        var handle = function (evt) {

            var handlers = handle.handlers;
            for (var i = 0; i < handlers.length; i++) {

                handlers[i](evt);
            }
        }

        handle.handlers = event_listeners[type]; // add handler to v_node

        event_listeners[type] = handle;

        node.addEventListener(type, handle); // attach event to node
    }

    for (var type in event_listeners) {

        add_handler(type);
    }

}


var diff_props = function (node, node_props, v_node, props) { // old_node, old_props, new_node, new_props


    //console.log(' diff props 1 :: ', props);

    var v_node_props = props.attrs;

    for (var v_node_prop_name in v_node_props) {

        var v_node_prop_value = v_node_props[v_node_prop_name];
        var node_prop_value = node_props[v_node_prop_name];

        if ((v_node_prop_value !== undefined && v_node_prop_value !== null && v_node_prop_value !== false) && (node_prop_value == undefined || node_prop_value || false && node_prop_value || null || v_node_prop_value !== node_prop_value)) {

            node.setAttribute(v_node_prop_name, v_node_prop_value == true ? '' : v_node_prop_value);

        }

    }

    // Diff Node Props with VNode Props
    for (var node_prop_name in node_props) {

        var v_node_prop_value$1 = v_node_props[node_prop_name];

        if (v_node_prop_value$1 == undefined || v_node_prop_value$1 == false || v_node_prop_value$1 == null) {

            node.removeAttribute(node_prop_name);

        }

    }

    var v_node_directives = null; // execute directive

    if ((v_node_directives = props.directives) !== undefined) {

        for (var directive in v_node_directives) {

            var directive_fn = null;
            if ((directive_fn = v_node_directives[directive]) !== undefined) {

                directive_fn(node, v_node_directives[directive], v_node);

            }

        }

    }


    var dom = null; // add/update any dom props

    if ((dom = props.dom) !== undefined) {

        for (var dom_prop in dom) {

            var dom_prop_value = dom[dom_prop];
            if (node[dom_prop] !== undefined) {

                node[dom_prop] = dom_prop_value;

            }

        }

    }

    //console.log(' diff props 2 :: ', props);


}

var diff_event_listeners = function (node, new_event_listeners, old_event_listeners) {

    for (var type in new_event_listeners) {

        var old_event_listener = old_event_listeners[type];

        if (old_event_listener == undefined) {

            // if old node dont have new event listner, then remove it from the node
            node.removeEventListener(type, old_event_listener); // it takes type of listener and its handler/callback function

        } else {

            old_event_listeners[type].handler = new_event_listeners[type];

        }

    }


}


var create_node_from_v_node = function (v_node) {

    var type = v_node.type,
        meta = v_node.meta,
        el = null;

    //console.log(' crreate a node: ', v_node)

    if (type == '#text') {

        el = document.createTextNode(v_node.val)

    } else {

        var children = v_node.children;
        el = document.createElement(type);

        var first_child = children[0];

        if (children.length == 1 && first_child.type == '#text') {

            el.textContent = first_child.val;
            first_child.meta.el = el.firstChild;
        } else {

            for (var i = 0; i < children.length; i++) {

                var v_child = children[i];

                append_child(create_node_from_v_node(v_child), v_node, el)

            }

        }

        var event_listeners = null; // add all event listeners;
        if ((event_listeners = meta.event_listeners) !== undefined) {

            add_event_listeners(el, event_listeners);

        }

    }

    // write code for diff here tomorrow

    diff_props(el, {}, v_node, v_node.props)

    // hydrate
    v_node.meta.el = el;
    return el;

}

var replace_child = function (old_node, new_node, v_node, parent) {

    var component_instance = null;

    if ((component_instance = old_node._mini_) !== undefined) {

        component_instance.destroy();

    }

    //console.log(' replacing the child', new_node, old_node);

    parent.replaceChild(new_node, old_node);

    // check for component;

    var component = null;

    if ((component = v_node.meta.component) !== undefined) {

        create_node_from_v_node(new_node, v_node, component);

    }

}

var remove_child = function (node, parent) {

    var component_instance = null;

    if ((component_instance = node._mini_) !== undefined) {
        // Component was unmounted, destroy it here
        component_instance.destroy();
    }

    parent.removeChild(node);

}

/**
 * Converts attributes into key-value pairs
 * @param {Node} node
 * @return {Object} Key-Value pairs of Attributes
 */
var extract_attrs = function (node) {
    var attrs = {};
    for (var raw_attrs = node.attributes, i = raw_attrs.length; i--;) {
        attrs[raw_attrs[i].name] = raw_attrs[i].value;
    }
    return attrs;
}

var hydrate = function (node, v_node, parent) {

    var node_name = node !== null ? node.nodeName.toUpperCase() : null;
    var meta = v_node.meta;

    if (node_name !== v_node.type) {

        var new_node = create_node_from_v_node(v_node);
        replace_child(node, new_node, v_node, parent);
        return new_node;

    } else if (v_node == TEXT_TYPE) { // check if both are text type;

        if (node.textContent !== v_node.val) {

            node.textContent = v_node.val;

        }

        meta.el = node;

    } else if (meta.component !== undefined) {

        // code for component diff goes here;

    } else {

        meta.el = node; // hydrate

        var props = v_node.props;
        diff_props(node, extract_attrs(node), v_node, props);

        // add event listeners
        var event_listeners = null;
        if ((event_listeners = meta.event_listeners) !== undefined) {

            add_event_listeners(node, event_listeners);

        }

        // ensure inner HTML wasn't change
        var dom_props = props.dom;
        if (dom_props == undefined || dom_props.innerHTML == undefined) {

            var children = v_node.children,
                length = children.length;

            var i = 0,
                current_child_node = node.firstChild,
                v_child = length !== 0 ? children[0] : null,
                next_sibling = null;

            while (v_child !== null || current_child_node !== null) {

                next_sibling = null;
                if (current_child_node == undefined) {

                    append_child(create_node_from_v_node(v_child), v_child, node);

                } else {

                    next_sibling = current_child_node.nextSibling;
                    if (v_child == null) {
                        remove_child(current_child_node, node);
                    } else {

                        hydrate(current_child_node, v_child, node);

                    }


                }
                i++;
                v_child = i < length ? children[i] : null;
                current_child_node = next_sibling;
            }
        }

        return node;
    }
}

/**
 * Diffs VNodes, and applies Changes
 * @param {Object} oldVNode
 * @param {Array} oldChildren
 * @param {Object} vnode
 * @param {Array} children
 * @param {Number} index
 * @param {Object} parent
 */
var diff = function (old_v_node, old_children, v_node, children, index, parent) {

    var old_meta = old_v_node.meta;
    var meta = v_node.meta;

    if (old_v_node.type !== v_node.type) {

        old_children[index] = v_node;
        replace_child(old_meta.el, create_node_from_v_node(v_node), v_node, parent);

    } else if (meta.should_render == true) {

        //console.log(' didnt match in type in diff :: ', old_v_node, v_node);

        if (v_node.type == TEXT_TYPE) {

            var val = v_node.val;

            if (old_v_node.val !== val) {

                old_v_node.val = val;
                old_meta.el.textContent = val;

            }
        } else if (meta.component !== undefined) {

            //console.log(' inside diff , i found an component :: ', old_v_node, v_node);
            // code for diff component will go here

        } else {

            var node = old_meta.el;

            // diff props

            var old_props = old_v_node.props;
            var props = v_node.props;

            diff_props(node, old_props.attrs, v_node, props);

            old_props.attrs = props.attrs;

            var event_listeners = null;
            if ((event_listeners = meta.event_listeners) !== undefined) {

                diff_event_listeners(node, event_listeners, old_meta.event_listeners);

            }

            // ensure html wasn't changed

            var dom_props = props.dom;
            if (dom_props == undefined || dom_props.innerHTML == undefined) {

                // diff children;
                var children$1 = v_node.children,
                    old_children$1 = old_v_node.children,
                    old_length = old_children$1.length,
                    new_length = children$1.length;

                if (new_length == 0 && old_length !== 0) {

                    var first_child = null;
                    while ((first_child = node.firstChild) !== null) {

                        remove_child(first_child, node);

                    }
                    old_v_node.children = [];

                } else if (old_length == 0) {

                    var child_v_node = null;
                    for (var i = 0; i < new_length; i++) {

                        child_v_node = children$1[i];
                        append_child(create_node_from_v_node(child_v_node), child_v_node, node);
                    }
                    old_v_node.children = children$1;

                } else {

                    var total_length = new_length > old_length ? new_length : old_length;
                    var old_child = null,
                        child = null;

                    for (var i$1 = 0; i$1 < total_length; i$1++) {

                        if (i$1 >= new_length) {

                            // remove extra child
                            remove_child(old_children$1.pop().meta.el, node);

                        } else if (i$1 >= old_length) {

                            child = children$1[i$1];
                            append_child(create_node_from_v_node(child), child, node);
                            old_children$1.push(child);

                        } else {

                            // if both child don't have same reference then diff them
                            old_child = old_children$1[i$1];
                            child = children$1[i$1];

                            if (old_child !== child) {

                                diff(old_child, old_children$1, child, children$1, i$1, node);

                            }
                        }
                    }
                }
            }

            //console.log(' i am done here ', v_node);

        }
    }
}

var hash_RE = /\[(\w+)\]/g; // replace "[",  "]" with . ;
var resolve_key_path = function (instance, data, key, value) {

    //console.log(' finding key path :: ', key, value, data);
    key = key.replace(hash_RE, "$1");

    var path = key.split('.'), temp_data = data;
    var i = 0;
    for (i; i < path.length - 1; i++) {

        var prop_name = path[i];
        data = data[prop_name];
    }
    //console.log(data[path[i]]);
    data[path[i]] = value;
    return path[0];
}

var queue_build = function (instance) {

    if (instance.$queued === false || instance.$destroyed == false) {

        instance.$queued = true;
        setTimeout(function () {

            instance.build();
            call_hooks(instance, 'updated');
            instance.$queued = false;

        }, 0)


    }

}


Mini.prototype.get = function (key) {

    return this.$data[key];

}

Mini.prototype.set = function (key, val) {

    var observer = this.$observer;

    var base = resolve_key_path(this, this.$data, key, val);
    //console.log(' setting the data :: ', base, this.$data);

    // ******** code for components ******//

    // Invoke custom setter
    // var setter = null;
    // if((setter = observer.setters[base]) !== undefined) {
    //     setter.call(this, val);
    // }
    //
    // // Notify observer of change
    // observer.notify(base, val);

    // ***** ends here ********* //

    queue_build(this);

}

Mini.prototype.call_method = function (method, args) {
    // Get arguments
    args = args || [];
    args.push(this.$data);

    // Call method in context of instance
    return this.$data[method].apply(this, args);
}

Mini.prototype.off = function (eventName, handler) {
    if (eventName === undefined) {
        // No event name provided, remove all events
        this.$events = {};
    } else if (handler === undefined) {
        // No handler provided, remove all handlers for the event name
        this.$events[eventName] = [];
    } else {
        // Get handlers from event name
        var handlers = this.$events[eventName];

        // Get index of the handler to remove
        var index = handlers.indexOf(handler);

        // Remove the handler
        handlers.splice(index, 1);
    }
}

Mini.prototype.destroy = function () {
    // Remove event listeners
    this.off();

    // Remove reference to element
    this.$el = null;

    // Setup destroyed state
    this.$destroyed = true;

    // Call destroyed hook
    call_hooks(this, 'destroyed');
}


Mini.prototype.render = function () {

    return this.$render(m);

}

Mini.prototype.patch = function (old, v_node, parent) {

    if (old.meta !== undefined) { // check if v_node is not a v_node

        //console.log(' not old : ', old, v_node);

        if (old.type !== v_node.type) {

            var new_root = create_node_from_v_node(v_node);

            replace_child(old.meta.el, new_root, v_node, parent);

            // update bounded instance

            new_root._mini_ = this;
            this.$el = new_root;

        } else {

            diff(old, [], v_node, [], 0, parent);
        }

    } else if (old instanceof Node) { // check old is instance of dom's Node

        //console.log(' is old ', old);

        var new_node = hydrate(old, v_node, parent);

        if (new_node !== old) {

            this.$el = v_node.meta.el;
            this.$el._mini_ = this;

        }

    }

}


Mini.prototype.build = function () {

    var dom = this.render(); // get new virtual DOM

    var old = null; // old items to patch

    console.log('this.$dom.meta :: ', this.$dom.meta);

    if (this.$dom.meta !== undefined) { // if dom not destroyed

        old = this.$dom;

    } else {

        old = this.$el;
        this.$dom = dom;

    }

    console.log(' initial dom ins :: ', dom,old);

    this.patch(old, dom, this.$el.parentNode)


}

Mini.compile = function (template) {

    var tokens = lexical_analysis(template);
    var ast = parser(tokens);
    return generator(ast);

}

Mini.prototype.mount = function (el) {

    this.$el = typeof el == 'string' ? document.querySelector(el) : el; // get dom element

    this.$destroyed = false;

    if (this.$el == null) {
        //console.log(` Cannot find element "${el}"`);
    }

    this.$el._mini_ = this; // sync element and mini instance

    console.log(' checking for template: ', this.$options.template, this.$el.outerHTML, this.$render);

    define_property(this, '$template', this.$options.template, this.$el.outerHTML); // if template is given the use it else use html inside the dom element

    if (this.$render === noop) {

        this.$render = Mini.compile(this.$template);

    }
    console.log(' template is : ', this.$template);
    this.build(); // run build first

    call_hooks(this, 'mounted');

}


Mini.prototype.init = function () {

    //console.log(' calling hooks');
    call_hooks(this);
    var el = this.$options.el;
    if (el !== undefined) {

        this.mount(el);

    }

}


