var compressor = require('node-minify');


compressor.minify({
    compressor: 'no-compress',
    input: ['./src/lex/lex.js', './src/parser/parser.js', './src/generator/generator.js', './src/main/main.js', './src/router/router.js'],
    output: './build/mini.js',
    buffer: 1000 * 1024,
    callback: function (err, compressed_code) {
        if(!err){

            console.log(' finished merging files ');

        }
    }
});

compressor.minify({
    compressor: 'gcc',
    // input: ['./src/lex/lex.js', './src/parser/parser.js', './src/generator/generator.js', './src/main/main.js', './src/reactivity/reactive.js',  './src/router/router.js'],
    input: './src/**/*.js',
    output: './build/mini.min.js',
    buffer: 1000 * 1024,
    options: {
        compilation_level: 'ADVANCED_OPTIMIZATIONS',
        language: 'ECMASCRIPT5'
    },
    callback: function (err, min) {

        if(!err){

            console.log(' finished minifying js files ');

        }

    }
});