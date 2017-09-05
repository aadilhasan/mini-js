

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
var emptyVNode = "m(\"#text\", " + (generate_meta(default_metadata())) + "\"\")",
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



// ================ inbuilt directives ==============>


special_directives["m-if"] = {
    after_generate: function (prop, code, vnode, state) {
        var value = prop.value;
        compile_template_expression(value, state.dependencies);
        return (value + " ? " + code + " : " + emptyVNode);
    }
}

special_directives["m-for"] = {
    before_generate: function (prop, vnode, parentVNode, state) {
        // Setup Deep Flag to Flatten Array
        parentVNode.deep = true;
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

        // Use the renderLoop runtime helper
        return ("m.renderLoop(" + iteratable + ", function(" + params + ") { return " + code + "; })");
    }
}

special_directives["m-on"] = {
    before_generate: function (prop, vnode, parentVNode, state) {
        // Extract Event, Modifiers, and Parameters
        var value = prop.value;
        var meta = prop.meta;

        var methodToCall = value;

        var rawModifiers = meta.args.split(".");
        var eventType = rawModifiers.shift();

        var params = "event";
        var rawParams = methodToCall.split("(");

        if (rawParams.length > 1) {
            // Custom parameters detected, update method to call, and generated parameter code
            methodToCall = rawParams.shift();
            params = rawParams.join("(").slice(0, -1);
            compile_template_expression(params, state.dependencies);
        }

        // Generate any modifiers
        var modifiers = "";
        for (var i = 0; i < rawModifiers.length; i++) {
            var eventModifierCode = eventModifiersCode[rawModifiers[i]];
            if (eventModifierCode === undefined) {
                modifiers += "if(m.renderEventModifier(event.keyCode, \"" + (rawModifiers[i]) + "\") === false) {return null;};"
            } else {
                modifiers += eventModifierCode;
            }
        }

        // Final event listener code
        var code = "function(event) {" + modifiers + "instance.call_method(\"" + methodToCall + "\", [" + params + "])}";
        add_event_listener_code_to_v_node(eventType, code, vnode);
    }
}

special_directives["m-model"] = {
    before_generate: function (prop, vnode, parentVNode, state) {
        // Get attributes
        var value = prop.value;
        var attrs = vnode.props.attrs;

        // Get dependencies
        var dependencies = state.dependencies;
        console.log(' m-model :: ', value, attrs)

        // Add dependencies for the getter and setter
        compile_template_expression(value, dependencies);

        // Setup default event type, keypath to set, value of setter, DOM property to change, and value of DOM property
        var eventType = "input";
        var domGetter = "value";
        var domSetter = value;
        var keypathGetter = value;
        var keypathSetter = "event.target." + domGetter;

        // If input type is checkbox, listen on 'change' and change the 'checked' DOM property
        var type = attrs.type;
        if (type !== undefined) {
            type = type.value;
            var radio = false;
            if (type === "checkbox" || (type === "radio" && (radio = true))) {
                eventType = "change";
                domGetter = "checked";

                if (radio === true) {
                    var valueAttr = attrs.value;
                    var literalValueAttr = null;
                    var valueAttrValue = "null";
                    if (valueAttr !== undefined) {
                        valueAttrValue = "\"" + (compile_template(valueAttr.value, dependencies, true)) + "\"";
                    } else if ((literalValueAttr = attrs["m-literal:value"])) {
                        valueAttrValue = "" + (compile_template(literalValueAttr.value, dependencies, true));
                    }
                    domSetter = domSetter + " === " + valueAttrValue;
                    keypathSetter = valueAttrValue;
                } else {
                    keypathSetter = "event.target." + domGetter;
                }
            }
        }

        // Compute getter base if dynamic
        var bracketIndex = keypathGetter.indexOf("[");
        var dotIndex = keypathGetter.indexOf(".");
        var base = null;
        var dynamicPath = null;
        var dynamicIndex = -1;

        if (bracketIndex !== -1 || dotIndex !== -1) {
            // Dynamic keypath found,
            // Extract base and dynamic path
            if (bracketIndex === -1) {
                dynamicIndex = dotIndex;
            } else if (dotIndex === -1) {
                dynamicIndex = bracketIndex;
            } else if (bracketIndex < dotIndex) {
                dynamicIndex = bracketIndex;
            } else {
                dynamicIndex = dotIndex;
            }
            base = value.substring(0, dynamicIndex);
            dynamicPath = value.substring(dynamicIndex);

            // Replace string references with actual references
            keypathGetter = base + dynamicPath.replace(expressionRE, function (match, reference) {
                    if (reference !== undefined) {
                        return ("\" + " + reference + " + \"");
                    } else {
                        return match;
                    }
                });
        }

        // Generate the listener
        var code = "function(event) {instance.set(\"" + keypathGetter + "\", " + keypathSetter + ")}";

        // Push the listener to it's event listeners
        add_event_listener_code_to_v_node(eventType, code, vnode);

        // Setup a query used to get the value, and set the corresponding dom property
        var dom = vnode.props.dom;
        if (dom === undefined) {
            vnode.props.dom = dom = {};
        }
        dom[domGetter] = domSetter;
    }
};

special_directives["m-literal"] = {
    during_prop_generate: function (prop, vnode, state) {
        var propName = prop.meta.args;
        var propValue = prop.value;
        compile_template_expression(propValue, state.dependencies);

        if (state.hasAttrs === false) {
            state.hasAttrs = true;
        }

        if (propName === "class") {
            // Detected class, use runtime class render helper
            return ("\"class\": m.renderClass(" + propValue + "), ");
        } else {
            // Default literal attribute
            return ("\"" + propName + "\": " + propValue + ", ");
        }
    }
};

special_directives["m-html"] = {
    before_generate: function (prop, vnode, parentVNode, state) {
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
