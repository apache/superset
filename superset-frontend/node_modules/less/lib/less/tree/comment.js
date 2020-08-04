var Node = require('./node'),
    getDebugInfo = require('./debug-info');

var Comment = function (value, isLineComment, index, currentFileInfo) {
    this.value = value;
    this.isLineComment = isLineComment;
    this._index = index;
    this._fileInfo = currentFileInfo;
    this.allowRoot = true;
};
Comment.prototype = new Node();
Comment.prototype.type = 'Comment';
Comment.prototype.genCSS = function (context, output) {
    if (this.debugInfo) {
        output.add(getDebugInfo(context, this), this.fileInfo(), this.getIndex());
    }
    output.add(this.value);
};
Comment.prototype.isSilent = function(context) {
    var isCompressed = context.compress && this.value[2] !== '!';
    return this.isLineComment || isCompressed;
};
module.exports = Comment;
