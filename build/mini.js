

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

var lexical_analysis = function(template){

    var state = {
        str: template,
        tokens : [],
        current : 0
    };

    lex_state(state);
    console.log(' lex : ', state.tokens);
    return state.tokens;

}


function lex_state(state){

    var str = state.str,
        len = state.str.length;

    while(state.current < len){

        // it is text
        if(str.charAt(state.current) !== "<"){

            get_text(state);
            continue;

        }

        // it is comment
        if(str.substr(state.current, 4) == "<!--"){

            get_comment(state);
            continue;
        }

        // its a tag
        get_tag(state);
    }
}


function get_text(state){
    var str = state.str,
        len = state.str.length,
        current = state.current;

    var tag_or_comment_start_RE = /<\/?(?:[A-Za-z]+\w*)|<!--/ ;

    var end_of_txt = str.substring(current).search(tag_or_comment_start_RE);

    if(end_of_txt == -1){

        state.tokens.push({
            type: 'text',
            value: str.slice(current)
        });

        state.current = len;
        return;
    }else if(end_of_txt !== 0){

        end_of_txt += current;
        state.tokens.push({
            type: 'text',
            value: str.slice(current, end_of_txt)
        });

        state.current = end_of_txt;

    }

}


function get_comment(state){

    var current = state.current+4,  // skip "<!--"
        str = state.str,
        len = state.str.length;

    var end_of_comment = str.indexOf("-->", current);

    if(end_of_comment == -1){

        state.tokens.push({
            type: 'comment',
            value: str.slice(current)
        });

        state.current = len;

    }else{

        state.tokens.push({
            type: 'comment',
            value: str.slice(current, end_of_comment)
        });

        state.current = end_of_comment+3;

    }

}



function get_tag(state){

    var str = state.str,
        len = state.str.length;

    var is_tag_closing_started = str.charAt(state.current+1) == "/";
    state.current += is_tag_closing_started ? 2 : 1;

    var tag_token = get_tag_name(state);
    get_tag_attributes(tag_token, state);

    var is_tag_self_closing = str.charAt(state.current) == "/";
    state.current += is_tag_self_closing ? 2 : 1;

    if(is_tag_closing_started){
        tag_token.tag_closing = true;
    }

    if(is_tag_self_closing){
        tag_token.tag_self_closing = true;
    }

    console.log('done with get tag ');

}

function get_tag_name(state){

    var current = state.current, len = state.str.length, str = state.str, tag_name = '';
    while(current < len){
        var char = str.charAt(current);
        if(char == "/" || char == " " || char == ">"){
            break;
        }else{
            tag_name+=char;
        }
        current++;
    }

    state.current = current;
    var tag_token = {
        type : 'tag',
        value : tag_name
    };
    state.tokens.push(tag_token);
    return tag_token;

}



function get_tag_attributes(tag_token, state){

    var str = state.str,
        len = state.str.length,
        current = state.current,
        char = str.charAt(current),
        nextChar = str.charAt(current+1),
        attributes = {};

    function increment(){
        current++;
        char = str.charAt(current);
        nextChar = str.charAt(current+1);
    }


    while(current < len){

        if(char == ">" || (char == "/" && nextChar == ">")){
            break;
        }

        if(char == " "){
            increment();
            continue;
        }
        var attribute_name = "", no_value_in_tag = false;

        while(current < len && char !== "="){
            if(char == " " || (char == "/" && nextChar == ">")){
                no_value_in_tag = true;
                break;
            }
            attribute_name+=char;
            increment();
        }

        // skip "="
        increment();

        var attribute_value = {
            name : attribute_name,
            value : '',
            meta : {}
        };

        console.log(attribute_name, no_value_in_tag, char);

        if(no_value_in_tag){
            attributes[attribute_name] = attribute_value;
            continue;
        }

        var quote_type = "";
        if( char == "'" || char == "\""){

            quote_type = char;
            increment();

        }


        while( current < len && char !== quote_type){

            attribute_value.value += char;
            increment();

        }

        console.log(' val : ', attribute_value.value, quote_type);

        //skip quote end
        increment();

        var dot_index = attribute_name.indexOf(":");
        if(dot_index !== -1){
            var temp = attribute_name.split(":");
            attribute_value.name = temp[0];
            attribute_value.meta.args = temp[1];
        }
        attributes[attribute_name] = attribute_value;
    }

    console.log(' att ', attributes);

    state.current = current;
    tag_token.attributes = attributes;

}





// var str = `<p title="xk" id="this is id" m-on:click="test()">
//   <!-- thsi is comment test -->
//     <h1> Hello </h1>
//   <span id="span_1"></span>
// <span id="span_2"></span>
// <img src="tet.img" />
//       </p>
//     <div id="div_test"></div>
//     <div></div>`;
// lexical_analysis(str);
var __router__ = false;

var define_property = function (obj, prop, value, def) {

    if (value == undefined) {

        obj[prop] = def

    } else {

        obj[prop] = value;

    }

}

var init_methods = function (instance, methods) {
    var data = instance.$data;

    function init_method(name, method) {

        data[name] = function () {

            // attache data getter and setter to the instance so they can b
            instance.$data.get = instance.get.bind(instance);
            instance.$data.set = instance.set.bind(instance);

            // pass data to method so they can
            return method.apply(instance.$data, arguments);

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
m.render_class = function (classNames) {
    if (typeof classNames === "string") {
        // If they are a string, no need for any more processing
        return classNames;
    }

    var renderedClassNames = "";
    if (Array.isArray(classNames)) {
        // It's an array, so go through them all and generate a string
        for (var i = 0; i < classNames.length; i++) {
            renderedClassNames += (m.render_class(classNames[i])) + " ";
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
m.render_loop = function (iteratable, item) {
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
m.render_event_modifier = function (keyCode, modifier) {
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

    this.make_reactive(this.$data); // make objects reactive
    this.$events = {};
    this.$dom = {};
    this.$observer = new Observer(this);
    this.$destroyed = true;
    this.$queued = false;

//    computed method can be added here;


//=====================================


    //this.init();  // initialize the app.
    console.log(' checking for router :: ', __router__);
    if(!__router__){
        console.log(' no router found');
        this.init();
    }


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

    // new key may be getting added to the object so make the new key reactive
    instance.make_reactive(data, value);

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




function parser(tokens) {

    var root = {

        type : 'root',
        children: []

    }

    var state = {
        current: 0,
        tokens: tokens
    }

    while(state.current < tokens.length){

        var child = getChild(state);
        if(child){
            root.children.push(child);
        }

    }

    console.log(' root is  :: ', root);
    return root;

}

var SELF_CLOSING_ELEMENTS = ["area","base","br","command","embed","hr","img","input","keygen","link","meta","param","source","track","wbr"];
var SVG_ELEMENTS = ["svg","animate","circle","clippath","cursor","defs","desc","ellipse","filter","font-face","foreignObject","g","glyph","image","line","marker","mask","missing-glyph","path","pattern","polygon","polyline","rect","switch","symbol","text","textpath","tspan","use","view"];

function createNode(node_type, props, children) {

    return {
        type: node_type,
        props: props,
        children: children
    }

}


function getChild(state) {

    var token = state.tokens[state.current];
    var next_token = state.tokens[state.current+1];
    var prev_token = state.tokens[state.current-1];

    var move = function(num) {

        state.current += (num == undefined ? 1 : num);
        token = state.tokens[state.current];
        next_token = state.tokens[state.current+1];
        prev_token = state.tokens[state.current-1];

    }

    if(token.type == 'text'){
        move();
        return prev_token.value;
    }

    if(token.type == 'comment'){
        move();
        return null;
    }

    if(token.type == 'tag'){
        var tag_type = token.value,
            tag_self_closing = token.tag_self_closing,
            tag_closing = token.tag_closing;

        var is_svg_element = SVG_ELEMENTS.indexOf(tag_type) !== -1;
        var is_self_closing_element = SELF_CLOSING_ELEMENTS.indexOf(tag_type) !== -1 || tag_self_closing == true;
        var node = createNode(tag_type, token.attributes, []);

        move();

        if(is_svg_element){
            node.is_svg = true;
        }

        if(is_self_closing_element){
            // element is self closing so it will not have any children so no need to process further;
            return node

        }else if(tag_closing){

            console.error(' Cannot find a closing tag for element  : ', node.type);
            return null;

        }else if(token !== undefined){

            var current  = state.current;

            while(token.type !== 'tag' || ((token.type == 'tag') && ((token.tag_self_closing == undefined && token.tag_closing  == undefined) || (token.value !== tag_type))) ){

                var child = getChild(state);
                if(child !== null){
                    node.children.push(child);
                }

                move(0);

                if(token == undefined){
                    console.error(`The element "${node.type}" was left unclosed`);
                    break;
                }

            }
            move();


        }

        return node;
    }
    move();
    return;
}
/**
 * Created by developer on 9/8/17.
 */
function set_object_setter_getter(obj, key, instance){

    var property = Object.getOwnPropertyDescriptor(obj, key);

    if(property && property.configurable === false){
        return;
    }

    var val = obj[key];

    Object.defineProperty(obj, key, {
        enumerable: true,
        configurable: true,
        get: function(){

            return val

        },
        set: function(new_value){

            val = new_value;
            // console.log(' setting : ', new_value, ' new arr: ', val, instance.$data);
            queue_build(instance);


        }

    });

}

Mini.prototype.make_reactive = function(obj){

    console.log(' making reactive ', obj);
    var keys = Object.keys(obj), key, temp_obj;

    for(var i=0; i < keys.length; i++){

        key = keys[i];
        temp_obj = obj[key];

        if(typeof temp_obj == 'object'){

            this.make_reactive(temp_obj);


        }else if(Array.isArray(temp_obj)){

            for(var j=0; j < temp_obj.length; j++){

                this.make_reactive(temp_obj[i]);

            }

        }

        set_object_setter_getter(obj, key, this);

    }

}
var MiniRouter = (function() {

    var routes = {};
    var current_route = {};

    var run = function (route, app) {
        app.$dom.meta = undefined;

        if(current_route.route){

            // routes[route].controller.$data = current_route.initial_data;
            current_route = {};

        }

        app.init();
        current_route.route = route;
        current_route.initial_data = JSON.parse(JSON.stringify(app.$data)); // make a copy of initial data without reference, so it do not get modified when $data changes
        console.log(' initial data set : ', route, current_route.initial_data);
    }

    var route_changed = function (old_hash) {

        console.log(' route changed called');
        var app = null;

        // routes[location.hash].controller.$dom.meta = undefined;

        if (location.hash == '' || location.hash == '#/') {

            console.log(' in home page :: ', routes['#/']);
            app = routes['#/'].controller;
            run('#/', app);

        }
        else if ((app = routes[location.hash]) !== undefined) {

            app = app.controller;
            run(location.hash, app);

        } else if ((app = routes['404']) !== undefined) {

            //console.log(' 404 page not found ');


        } else {

            console.error(' sorry the route not found :-( !!  ')

        }

    }

    var init_router = function () {

        //console.log(' init is running ');
        var location = window.location;

        window.onhashchange = function (e) {

            console.log('has chnaged :: ', e, location.hash);
            var old_hash = '#'+e.oldURL.split('#')[1];
            console.log(' old hash is  :: ', old_hash, old_hash.length);
            route_changed(old_hash);

        }

        route_changed();


    }


    var when = function (path, options) {
        path = path.trim().charAt(0) == '#' ? path : '#'+path ;
        routes[path] = options;

        return this;
    }

    var done = function () {
        console.log('router running :: ', routes, __router__);
        __router__ = true;
        init_router();

    }
    var router = {
        when: when,
        done: done
    }

    return router;
}());