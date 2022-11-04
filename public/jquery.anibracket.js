
/*
*   IIFE (Immediately Invoked Function Expression) used to make sure $ refers to jQuery and
*   does not conflicts with other libraries.
*/

// TODO: Node/AMD loading

// The semi-colon before the function invocation is a safety  net against concatenated scripts and/or other plugins
// that are not closed properly.
;(function ($) {
    "use strict";

    /*********************************************************************************************************************************
                                                                    GLOBALS
    *********************************************************************************************************************************/
    var pluginName = 'anibracket';
    var defaults = {
        roundMargin: 40,
        matchMargin: 20
    };
    var instances = [];

    /*********************************************************************************************************************************
                                                                    HELPERS
    *********************************************************************************************************************************/

    /*
    *   Returns the nearest power of two greater than n.
    */
    function nearestPow2(n){
        return Math.pow(2, Math.round(Math.log(n) / Math.log(2)));
    }

    /*
    *   Returns true if 'n' is a power of 2, false otherwise.
    */
    function isPow2(n) {
        return n && (n & (n - 1)) === 0;
    };

    /*
    *   Throws an exception if object 'obj' (represented by string 'context') has a property named 'prop' that is not of the
    *   type given by 'expectedType'.
    */
    function assertPropType(obj, prop, context, expectedType) {
        if (obj.hasOwnProperty(prop)) {
            var type = typeof obj[prop];
            if (type !== expectedType) {
                $.error("Property \"" + prop + "\" of " + context + " is of type " + type + " instead of type " + expectedType);
            }
        }
    };

    /*********************************************************************************************************************************
                                                                 VALUE
                  A wrapper class for simple values. This class provides some convenience methods to manipulate values.
    *********************************************************************************************************************************/

    /*
    *   Value constructor.
    */
    var Value = function(val) {
        this.val = val;
        if (this.val === undefined) {
            $.error("Cannot wrap an undefined value");
        }
    };

    /*
    *   Helper "static" method to instantiate a new Value object.
    */
    Value.new = function(value) {
        return new Value(value);
    }

    /*
    *   Helper "static" method to check whether a given object is an instance of Value.
    */
    Value.is = function(value) {
        return value instanceof Value;
    }

    /*
    *   Helper "static" method to instantiate a new empty Value object.
    */
    Value.empty = function() {
        return new Value(null);
    }

    /*
    *  Value methods definitions.
    */
    $.extend(Value.prototype, {

        /*
        *   Get the value encapsulated in the Value object.
        */
        get : function() {
            if(this.val === null) {
                $.error("Cannot get content of an empty Value");
            }
            return this.val;
        },

        /*
        *   Get the value encapsulated in the Value object, or a default value if it is empty.
        */
        getOrElse : function(default) {
            return this.val === null ? default : this.val;
        },

        /*
        *  Call function 'func' on the value and return a new Value object wrapping the result.
        */
        map : function(func) {
            return this.val === null ? Value.empty() : Value.new(func(this.val));
        },

        /*
        *  Returns true if the Value object is empty, false otherwise.
        */
        isEmpty : function(func) {
            return this.val === null;
        },

    });


    /*********************************************************************************************************************************
                                                            ANIBRACKET OBJECT
    *********************************************************************************************************************************/

    /*
    *   AniBracket constructor.
    */
    var AniBracket = function(el, options) {

        // Initialize AniBracket fields
        this.el = el;           // DOM element
        this.$el = $(el);       // jQuery element
        this.pairings = [];     // Bracket pairings
        this.results = [];      // Bracket results
        this.size = 0;          // Size of the tournament (number of matches in the first round)

        // Register instance
        this.instanceNumber = instances.length;
        instances.push(this);

        // Initialize and validate options
        this.opts = $.extend(true, defaults, options);
        // TODO: validate options

        // Check bracket initialization data was given
        if(!this.opts.init || (!this.opts.init.size && !this.opts.init.pairings)) {
            $.error("Either an array of pairings or a tournament size must be given at initialization");
        }

        // Validate and set tournament size and/or pairings
        var size, pairings;
        if(this.opts.init.size) {
            assertPropType(this.opts.init, "size", "init", "number");
            if(!isPow2(this.opts.init.size)) {
                $.error("To initialize the bracket either an array of pairings or the tournament size must be given");
            }
            size = this.opts.init.size;
            if(!this.opts.init.pairings) {
                // TODO: create mock up pairings
                // pairings =
            } else if(this.opts.init.pairings.length > size) {
                $.error("Number of pairs (" + this.opts.init.pairings.length + ") exceeds the tournament size (" + size + ")");
            } else if(this.opts.init.pairings.length < size) {
                // TODO: extend with mock up pairings
                // pairings =
            }
        } else if(this.opts.init.pairings){
            pairings = this.opts.init.pairings
            if(!isPow2(this.opts.init.pairings.length)) {
                // TODO: extend with mock up pairings
                // pairings =
            }
            size = pairings.length;
        }
        this.size = size;
        this.pairings = pairings;

        // Validate and set tournament results
        if(this.opts.init.results){
            this.pairiresultsngs = this.opts.init.results
        }


        // Safety checks: options type
        assertOptType(opts, "roundMargins", "number");
        assertOptType(opts, "matchMargins", "number");

    };


    /*
    *   AniBracket methods.
    */
    $.extend(AniBracket.prototype, {

        /*
        *   Initialize the anibracket element.
        */
        init : function(options) {




            //TODO: check if should return 'this' for chaining
        },

        /*
        *   Updates the anibracket element.
        */
        update : function() {

            //TODO: check if should return 'this' for chaining
        }
    };


    /*********************************************************************************************************************************
                                                        JQUERY PLUGIN INSTALLTION
    *********************************************************************************************************************************/

    /*
    *   Add plugin function to jQuery. Possible actions:
    *    - 'init' (default)
    *    - 'update'
    */
    $.fn[pluginName] = function(method) {

        // Save array of arguments
        var argumentsArray = Array.prototype.slice.call(arguments, 0);

        // Call method on all lements of the jQuery collection (if possible)
        return this.each(function() {

            // If current jQuery element already has an AniBracket object associated, dispatch method
            // to that object (if method is valid)
            var instanceNumber = $(this).data(pluginName + "-instance");
            if(instanceNumber !== undefined) {
                var instance = instances[instanceNumber];
                if(AniBracket.prototype.hasOwnProperty(method)) {
                    instance[method].apply(instance, argumentsArray.slice(1));
                } else {
                    $.error("Method " + method + " does not exist on jQuery.anibracket");
                }
            }

            // Otherwise a new AniBracket object needs to be initialized for the current jQuery element
            else {

                // Cannot do anything but initialization on an element with no associated AniBracket instance
                if(typeof method === "string") {
                    $.error("Cannot perform '" + method + "' on an element for which jQuery.anibracket has not been initialized");
                }

                // Create new AniBracket object and associate it with  the current jQuery element
                else(typeof method === "object") {
                    new AniBracket(this, argumentsArray);
                }
            }
        });
    };

    /*********************************************************************************************************************************
                                                        EXPOSE SETTINGS
    *********************************************************************************************************************************/
    $.fn[pluginName].defaults = defaults;


})(jQuery);
