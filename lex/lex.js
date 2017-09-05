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





var str = `<p title="xk" id="this is id" m-on:click="test()">
  <!-- thsi is comment test -->
    <h1> Hello </h1> 
  <span id="span_1"></span> 
<span id="span_2"></span>
<img src="tet.img" />
      </p> 
    <div id="div_test"></div>
    <div></div>`;
lexical_analysis(str);