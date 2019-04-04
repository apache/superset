function makeRegistry( base ) {
    return {
        _data: {},
        add: function(name, func) {
            // precautionary case conversion, as later querying of
            // the registry by function-caller uses lower case as well.
            name = name.toLowerCase();

            if (this._data.hasOwnProperty(name)) {
                // TODO warn
            }
            this._data[name] = func;
        },
        addMultiple: function(functions) {
            Object.keys(functions).forEach(
                function(name) {
                    this.add(name, functions[name]);
                }.bind(this));
        },
        get: function(name) {
            return this._data[name] || ( base && base.get( name ));
        },
        getLocalFunctions: function() {
            return this._data;
        },
        inherit: function() {
            return makeRegistry( this );
        },
        create: function(base) {
            return makeRegistry(base);
        }
    };
}

module.exports = makeRegistry( null );