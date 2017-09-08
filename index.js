var compressor = require('node-minify');
var replace = require('replace-in-file');

console.log('====================== build process starts ====================== \n\n');

var mini_min_js_path = './build/mini.min.js';
var console_match_RE = /console.(log)/g ;

var options = {
    files: mini_min_js_path,
    from: console_match_RE,
    to: 'noop'
};

var remove_logs = function () {
    
    replace(options)
        .then(changedFiles => {
            console.log(' finished replacing \"console.log\" with \"noop\" \n\n ')
        })
        .catch(error => {
            console.log(' error while replacing \"console.log\" with \"noop\" \n\n ', error)
        });

    console.log('====================== build finished ======================');

}


compressor.minify({
    compressor: 'no-compress',
    input: './src/**/*.js',
    output: './build/mini.js',
    buffer: 1000 * 1024,
    callback: function (err, compressed_code) {
        if(!err){

            console.log(' finished merging js files to \"/build/mini.js\" \n\n');

        }
    }
});

compressor.minify({
    compressor: 'gcc',
    // input: ['./src/lex/lex.js', './src/parser/parser.js', './src/generator/generator.js', './src/main/main.js', './src/reactivity/reactive.js',  './src/router/router.js'],
    input: './src/**/*.js',
    output: mini_min_js_path,
    buffer: 1000 * 1024,
    options: {
        compilation_level: 'ADVANCED_OPTIMIZATIONS',
        language: 'ECMASCRIPT5'
    },
    callback: function (err, min) {

        if(!err){

            console.log(' finished minifying js files to \"/build/mini.min.js\", now replacing \"console.log\" with \"noop\" \"( in minified file is is hard to replace/remove console.log\"( anyhthing \") \") so just replacing it with noop function \"(a empty function \"). \n\n');
            remove_logs();

        }

    }
});