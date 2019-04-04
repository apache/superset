var Node = require('./node'),
    Declaration = require('./declaration');

var Property = function (name, index, currentFileInfo) {
    this.name = name;
    this._index = index;
    this._fileInfo = currentFileInfo;
};
Property.prototype = new Node();
Property.prototype.type = 'Property';
Property.prototype.eval = function (context) {
    var property, name = this.name;
    // TODO: shorten this reference
    var mergeRules = context.pluginManager.less.visitors.ToCSSVisitor.prototype._mergeRules;

    if (this.evaluating) {
        throw { type: 'Name',
            message: 'Recursive property reference for ' + name,
            filename: this.fileInfo().filename,
            index: this.getIndex() };
    }

    this.evaluating = true;

    property = this.find(context.frames, function (frame) {

        var v, vArr = frame.property(name);
        if (vArr) {
            for (var i = 0; i < vArr.length; i++) {
                v = vArr[i];

                vArr[i] = new Declaration(v.name,
                    v.value,
                    v.important,
                    v.merge,
                    v.index,
                    v.currentFileInfo,
                    v.inline,
                    v.variable
                );
            }
            mergeRules(vArr);

            v = vArr[vArr.length - 1];
            if (v.important) {
                var importantScope = context.importantScope[context.importantScope.length - 1];
                importantScope.important = v.important;
            }
            v = v.value.eval(context);
            return v;
        }
    });
    if (property) {
        this.evaluating = false;
        return property;
    } else {
        throw { type: 'Name',
            message: 'Property \'' + name + '\' is undefined',
            filename: this.currentFileInfo.filename,
            index: this.index };
    }
};
Property.prototype.find = function (obj, fun) {
    for (var i = 0, r; i < obj.length; i++) {
        r = fun.call(obj, obj[i]);
        if (r) { return r; }
    }
    return null;
};
module.exports = Property;
