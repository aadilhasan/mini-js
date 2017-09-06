

// var event_listeners = null;
var generate_event_listeners = function (event_listeners) {

    var event_listener_code = `"event_listeners": {`;

    for (var type in event_listeners) {

        var handlers = event_listeners[type];
        event_listener_code += `"${type}": [`;
        for (var i = 0; i < handlers.length; i++) {

            event_listener_code += handlers[i] + ', ';

        }

        event_listener_code = event_listener_code.substring(0, event_listener_code.length - 2) + "], ";

    }

    event_listener_code = event_listener_code.substring(0, event_listener_code.length - 2) + "}, ";
    return event_listener_code;

}

var generate_meta = function (meta) {

    var meta_code = '{';
    for (var key in meta) {

        if (key == 'event_listeners') {

            meta_code += generate_event_listeners(meta[key]);

        } else {

            meta_code += `"${key}": ${meta[key]}, `
        }

    }

    meta_code = meta_code.substring(0, meta_code.length - 2) + '}, ';
    return meta_code;

}

var default_metadata = function () {

    return {should_render: false}

}

// for special directives
var empty_v_node = "m(\"#text\", " + (generate_meta(default_metadata())) + "\"\")",
    special_directives = {},
    directives = {};

var noop = function() {

}

var add_event_listener_code_to_v_node = function(name, handler, vnode) {
    var meta = vnode.meta;
    var event_listeners = meta.event_listeners;
    if(event_listeners === undefined) {
        event_listeners = meta.event_listeners = {};
    }
    var eventHandlers = event_listeners[name];
    if(eventHandlers === undefined) {
        event_listeners[name] = [handler];
    } else {
        eventHandlers.push(handler);
    }
}


var event_modifiers_code = {
    stop: 'event.stopPropagation();',
    prevent: 'event.preventDefault();',
    ctrl: 'if(event.ctrlKey === false) {return null;};',
    shift: 'if(event.shiftKey === false) {return null;};',
    alt: 'if(event.altKey === false) {return null;};',
    enter: 'if(event.keyCode !== 13) {return null;};'
}



// ================ inbuilt directives ==============>


special_directives["m-if"] = {
    after_generate: function (prop, code, vnode, state) {
        var value = prop.value;
        compile_template_expression(value, state.dependencies);
        return (value + " ? " + code + " : " + empty_v_node);
    }
}

special_directives["m-for"] = {
    before_generate: function (prop, vnode, paren_v_node, state) {
        // Setup Deep Flag to Flatten Array
        paren_v_node.deep = true;
    },
    after_generate: function (prop, code, vnode, state) {
        // Get dependencies
        var dependencies = state.dependencies;

        // Get Parts
        var parts = prop.value.split(" in ");

        // Aliases
        var aliases = parts[0].split(",");

        // The Iteratable
        var iteratable = parts[1];
        compile_template_expression(iteratable, dependencies);

        // Get any parameters
        var params = aliases.join(",");

        // Add aliases to scope
        for (var i = 0; i < aliases.length; i++) {
            var aliasIndex = dependencies.indexOf(aliases[i]);
            if (aliasIndex !== -1) {
                dependencies.splice(aliasIndex, 1);
            }
        }

        // Use the render_loop runtime helper
        return ("m.render_loop(" + iteratable + ", function(" + params + ") { return " + code + "; })");
    }
}

special_directives["m-on"] = {
    before_generate: function (prop, vnode, paren_v_node, state) {
        // Extract Event, Modifiers, and Parameters
        var value = prop.value;
        var meta = prop.meta;

        var method_to_call = value;

        var raw_modifiers = meta.args.split(".");
        var event_type = raw_modifiers.shift();

        var params = "event";
        var raw_params = method_to_call.split("(");

        if (raw_params.length > 1) {
            // Custom parameters detected, update method to call, and generated parameter code
            method_to_call = raw_params.shift();
            params = raw_params.join("(").slice(0, -1);
            compile_template_expression(params, state.dependencies);
        }

        // Generate any modifiers
        var modifiers = "";
        for (var i = 0; i < raw_modifiers.length; i++) {
            var event_modifier_code = event_modifiers_code[raw_modifiers[i]];
            if (event_modifier_code === undefined) {
                modifiers += "if(m.render_event_modifier(event.keyCode, \"" + (raw_modifiers[i]) + "\") === false) {return null;};"
            } else {
                modifiers += event_modifier_code;
            }
        }

        // Final event listener code
        var code = "function(event) {" + modifiers + "instance.call_method(\"" + method_to_call + "\", [" + params + "])}";
        add_event_listener_code_to_v_node(event_type, code, vnode);
    }
}

special_directives["m-model"] = {
    before_generate: function (prop, vnode, paren_v_node, state) {
        // Get attributes
        var value = prop.value;
        var attrs = vnode.props.attrs;

        // Get dependencies
        var dependencies = state.dependencies;
        console.log(' m-model :: ', value, attrs)

        // Add dependencies for the getter and setter
        compile_template_expression(value, dependencies);

        // Setup default event type, keypath to set, value of setter, DOM property to change, and value of DOM property
        var event_type = "input";
        var dom_getter = "value";
        var dom_setter = value;
        var keypath_getter = value;
        var keypath_setter = "event.target." + dom_getter;

        // If input type is checkbox, listen on 'change' and change the 'checked' DOM property
        var type = attrs.type;
        if (type !== undefined) {
            type = type.value;
            var radio = false;
            if (type === "checkbox" || (type === "radio" && (radio = true))) {
                event_type = "change";
                dom_getter = "checked";

                if (radio === true) {
                    var value_attr = attrs.value;
                    var literal_value_attr = null;
                    var value_attrValue = "null";
                    if (value_attr !== undefined) {
                        value_attrValue = "\"" + (compile_template(value_attr.value, dependencies, true)) + "\"";
                    } else if ((literal_value_attr = attrs["m-literal:value"])) {
                        value_attrValue = "" + (compile_template(literal_value_attr.value, dependencies, true));
                    }
                    dom_setter = dom_setter + " === " + value_attrValue;
                    keypath_setter = value_attrValue;
                } else {
                    keypath_setter = "event.target." + dom_getter;
                }
            }
        }

        // Compute getter base if dynamic
        var bracket_index = keypath_getter.indexOf("[");
        var dot_index = keypath_getter.indexOf(".");
        var base = null;
        var dynamic_path = null;
        var dynamic_index = -1;

        if (bracket_index !== -1 || dot_index !== -1) {
            // Dynamic keypath found,
            // Extract base and dynamic path
            if (bracket_index === -1) {
                dynamic_index = dot_index;
            } else if (dot_index === -1) {
                dynamic_index = bracket_index;
            } else if (bracket_index < dot_index) {
                dynamic_index = bracket_index;
            } else {
                dynamic_index = dot_index;
            }
            base = value.substring(0, dynamic_index);
            dynamic_path = value.substring(dynamic_index);

            // Replace string references with actual references
            keypath_getter = base + dynamic_path.replace(expression_RE, function (match, reference) {
                    if (reference !== undefined) {
                        return ("\" + " + reference + " + \"");
                    } else {
                        return match;
                    }
                });
        }

        // Generate the listener
        var code = "function(event) {instance.set(\"" + keypath_getter + "\", " + keypath_setter + ")}";

        // Push the listener to it's event listeners
        add_event_listener_code_to_v_node(event_type, code, vnode);

        // Setup a query used to get the value, and set the corresponding dom property
        var dom = vnode.props.dom;
        if (dom === undefined) {
            vnode.props.dom = dom = {};
        }
        dom[dom_getter] = dom_setter;
    }
};

special_directives["m-literal"] = {
    during_prop_generate: function (prop, vnode, state) {
        var prop_name = prop.meta.args;
        var prop_value = prop.value;
        compile_template_expression(prop_value, state.dependencies);

        if (state.hasAttrs === false) {
            state.hasAttrs = true;
        }

        if (prop_name === "class") {
            // Detected class, use runtime class render helper
            return ("\"class\": m.render_class(" + prop_value + "), ");
        } else {
            // Default literal attribute
            return ("\"" + prop_name + "\": " + prop_value + ", ");
        }
    }
};

special_directives["m-html"] = {
    before_generate: function (prop, vnode, paren_v_node, state) {
        var value = prop.value;
        var dom = vnode.props.dom;
        if (dom === undefined) {
            vnode.props.dom = dom = {};
        }
        compile_template_expression(value, state.dependencies);
        dom.innerHTML = "(\"\" + " + value + ")";
    }
}

special_directives["m-mask"] = {}

directives["m-show"] = function (el, val, vnode) {
    el.style.display = (val ? '' : 'none');
}





var generate_node = function (node, parent, state) {

    if (typeof node === 'string') {

        var compiled = compile_template(node, state.dependencies, true); // node, dependencies, is_string
        var meta = default_metadata();

        if (node !== compiled) {

            meta.should_render = true;
            parent.meta.should_render = true;

        }

        return `m("#text", ${generate_meta(meta)}"${compiled}")`


    } else {

        var call = `m("${node.type}", `;

        var meta$1 = default_metadata();

        node.meta = meta$1;

        var props_code = generate_props(node, parent, state);
        var special_directives_after = state.special_directives_after;

        if(special_directives_after !== null){

            state.special_directives_after = null;

        }

        var children = node.children,
            children_length = children.length,
            children_code = '[';

        if(children_length == 0){
            children_code += ']';
        }else{

            for(var i=0; i < children_length; i++){

                children_code += `${generate_node(children[i], node, state)}, `;

            }
            children_code = children_code.substring(0, children_code.length-2)+']';
        }

        if(node.deep == true){

            children_code = `[].concat.apply([], ${children_code})`;

        }

        if(node.meta.should_render == true && parent !== undefined){

            parent.meta.should_render = true;
        }

        call += props_code;
        call += generate_meta(meta$1);
        call += children_code;
        call += ')';

        if(special_directives_after !== null){

            var special_directive_after;
            for(var key in special_directives_after){

                special_directive_after = special_directives_after[key];
                call = special_directive_after.after_generate(special_directive_after.prop, call, node, state);

            }
        }

        return call;

    }

}


var generate_props = function (node, parent, state) {

    var props = node.props;
    node.props = {
        attrs: props
    };

    var has_directives = false,
        directive_props = [],
        has_special_directives_after = false,
        special_directives_after = {},
        props_key = null,
        special_directive = null;

    var props_code = `{attrs: {`;
    var before_generate = null;

    for (props_key in props) {

        var prop = props[props_key],
            name = prop.name;

        if ((special_directive = special_directives[name]) !== undefined && (before_generate = special_directive.before_generate) !== undefined) {

            before_generate(prop, node, parent, state);
        }
    }

    var after_generate = null,
        during_prop_generate = null;

    for (props_key in props) {

        var prop = props[props_key],
            name = prop.name;

        if ((special_directive = special_directives[name]) !== undefined) {
            if ((after_generate = special_directive.after_generate) !== undefined) {

                special_directives_after[name] = {
                    prop: prop,
                    after_generate: after_generate
                };

                has_special_directives_after = true;

            }

            if ((during_prop_generate = special_directive.during_prop_generate) !== undefined) {

                props_code += during_prop_generate(prop, node, state);

            }

            node.meta.should_render = true

        }
        else if (name[0] == 'm' && name[1] == '-') {

            directive_props.push(prop);
            has_directives = true;

            node.meta.should_render = true

        }
        else {

            var value = prop.value,
                compiled = compile_template(value, state.dependencies, true);

            if (value !== compiled) {

                node.meta.should_render = true

            }

            if (state.has_attrs == false) {

                state.has_attrs = true;

            }

            props_code += `"${props_key}": "${compiled}", `;

        }
    }

    if (state.has_attrs == true) {

        props_code = props_code.substring(0, props_code.length - 2) + '}';
        state.has_attrs = false;

    } else {

        props_code += '}';

    }

    if(has_directives == true){

        props_code += `, {directives: {`;
        var directive_prop = null,
            directive_prop_value = null;

        for(var i=0; i <directive_props.length; i++){
            directive_prop = directive_props[i];
            directive_prop_value = directive_prop.value;
            compile_template_expression(directive_prop_value, state.dependencies);
            props_code += `"${directive_prop.name}": "${directive_prop_value.length == 0 ? "" : directive_prop_value}", `
        }

        props_code = props_code.substring(0, props_code.length-2)+'}'


    }

    if (has_special_directives_after == true) {

        state.special_directives_after = special_directives_after;

    }

    var dom_props = node.props.dom;
    if (dom_props !== undefined) {

        props_code += ", dom: {";

        for (var dom_prop in dom_props) {

            props_code += `"${dom_prop}": ${dom_props[dom_prop]}, `;

        }

        props_code = props_code.substring(0, props_code.length - 2) + '}';

    }

    props_code += '}, ';
    return props_code;


}


var compile_template = function (template, dependencies, is_string) {

    var state = {
        template: template,
        current: 0,
        dependencies: dependencies,
        output: ''
    }

    compile_template_state(state, is_string);
    return state.output;


}

var open_RE = /\{\{/,
    close_RE = /\}\}/;

var compile_template_state = function (state, is_string) {

    var template = state.template,
        length = template.length;

    while (state.current < length) {

        var text_before_curelly_braces = scan_template_until(state, open_RE);

        if(text_before_curelly_braces.length !== 0){
            state.output += escape_string(text_before_curelly_braces);
        }

        if (state.current == length) {
            break
        }

        state.current += 2; // skip opening braces;

        scan_template_for_white_space(state); // skip white spaces

        // if (state.current == length) {
        //     break
        // }

        var exp = scan_template_until(state, close_RE);

        if (state.current == length) {

            console.error(`Expected closing delimiter "}}" after "${exp}"`);
            break;

        }

        if (exp.length !== 0) {

            compile_template_expression(exp, state.dependencies);

            if (is_string) {

                exp = `" + ${exp} + "`;
            }

            state.output += exp;


        }

        scan_template_for_white_space(state);
        state.current += 2;

    }

}

var scan_template_until = function (state, RE) {

    var match = "",
        template = state.template,
        length = template.length,
        tail = template.substring(state.current);

    var index = tail.search(RE);

    switch (index) {

        case -1:
            match = tail;
            break;

        case 0:
            match = "";
            break;

        default:
            match = tail.substring(0, index)

    }

    state.current += match.length;
    return match;


}

var expression_RE = /"[^"]*"|'[^']*'|\.\w*[a-zA-Z$_]\w*|\w*[a-zA-Z$_]\w*:|(\w*[a-zA-Z$_]\w*)/g;
var globals = ['true', 'false', 'undefined', 'null', 'NaN', 'typeof', 'in'];
var compile_template_expression = function (exp, dependencies) {

    exp.replace(expression_RE, function (match, reference) {

        if (reference !== undefined && dependencies.indexOf(reference) == -1 && globals.indexOf(reference) == -1) {

            dependencies.push(reference);
        }

    })

    return dependencies;
}


var escapeRE = /(?:(?:&(?:lt|gt|quot|amp);)|"|\\|\n)/g;
var escapeMap = {
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": "\\\"",
    "&amp;": "&",
    "\\": "\\\\",
    "\"": "\\\"",
    "\n": "\\n"
}

var escape_string = function (string) {

    return string.replace(escapeRE, function (match) {

        return escapeMap[match];

    })


}

var white_space_RE = /\s/;

var scan_template_for_white_space = function (state) {

    var template = state.template,
        char = template[state.current];

    while (white_space_RE.test(char)) {

        char = template[++state.current];

    }

}




var generator = function (tree) {

    var root = tree.children[0];
    var state = {
        has_attrs: false,
        dependencies: [],
        special_directives_after: null
    }

    var root_code = generate_node(root, undefined, state); // node, parent_node, state;
    var dependencies = state.dependencies;
    var dependecies_code = "";

    for(var i=0; i < dependencies.length; i++){

        var dependency = dependencies[i];
        dependecies_code += `var ${dependency} = instance.get("${dependency}"); `;

    }
    var code  = `var instance = this; ${dependecies_code} return ${root_code};`;

    console.log(' generated code is :: ', code);

    try {

        return new Function('m', code);

    }
    catch(e){

        console.log(' Unable to create render function, ', e);
        return noop;

    }

};
