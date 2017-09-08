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