var
    /**
     * Dependencies.
     */
    fs = require('fs'),

    /**
     * Local variables.
     */
    style = fs.readFileSync(__dirname + '/robot.html', 'utf8');


module.exports = function () {
    console.log(style);
};

module.exports();