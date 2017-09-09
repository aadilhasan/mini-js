# mini-js

It is javascript framework for frontend development heighly inspired by Vue JS. I am developing it just to learn and understand JS and its framework more, it is not meant to be used in production.

## features

Mini JS has features of modern JS frameworks, here are some of the features - 

* **Virtual Dom**- A lightning fast virtual dom which with a good diff algorithm for fast partial rerender.
* **Two way data binding**- As soon as data gets change it will reflect in the ui.
* **Native Directives**- such as m-on, m-for, m-if, m-show etc.
* **Router**- for navigation between pages(routing)

## installation

To use it you can install using **npm install --save mini-js** or use this CDN **https://cdn.jsdelivr.net/npm/mini-js/build/mini.min.js**

## uses

### html element

Mini needs an element in which it can mount the template or it which it can operate

```
<body>

<div id='test_app'>
  
  <p> {{best_fruit}} is the best fruit in the world </p>
  <button m-on:click="change_best_fruit()" > change best fruit in the world <button>

<div>

</body>
```


### initialize app
```
var app = new Mini({
    
    el: '#test_app',
    data: {
      
      best_fruit: 'mango',
      fruits: ['apple', 'banana', 'berry', 'orange', 'cherry']
      
    },
    methods: {
    
      change_best_fruit: function(){
      
        var index = Math.ceil(Math.random()*5);
        this.best_fruit = this.fruits[index];
      
      }
    
    
    }
    
});
```

## links for example will be added soon.
