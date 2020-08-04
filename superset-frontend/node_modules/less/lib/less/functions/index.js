module.exports = function(environment) {
    var functions = {
        functionRegistry: require('./function-registry'),
        functionCaller: require('./function-caller')
    };

    // register functions
    require('./boolean');
    require('./default');
    require('./color');
    require('./color-blending');
    require('./data-uri')(environment);
    require('./list');
    require('./math');
    require('./number');
    require('./string');
    require('./svg')(environment);
    require('./types');

    return functions;
};
