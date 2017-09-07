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