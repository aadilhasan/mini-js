
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