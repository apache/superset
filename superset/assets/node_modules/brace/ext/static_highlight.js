ace.define("ace/ext/static_highlight",["require","exports","module","ace/edit_session","ace/layer/text","ace/config","ace/lib/dom"], function(acequire, exports, module) {
"use strict";

var EditSession = acequire("../edit_session").EditSession;
var TextLayer = acequire("../layer/text").Text;
var baseStyles = ".ace_static_highlight {\
font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', 'Droid Sans Mono', monospace;\
font-size: 12px;\
white-space: pre-wrap\
}\
.ace_static_highlight .ace_gutter {\
width: 2em;\
text-align: right;\
padding: 0 3px 0 0;\
margin-right: 3px;\
}\
.ace_static_highlight.ace_show_gutter .ace_line {\
padding-left: 2.6em;\
}\
.ace_static_highlight .ace_line { position: relative; }\
.ace_static_highlight .ace_gutter-cell {\
-moz-user-select: -moz-none;\
-khtml-user-select: none;\
-webkit-user-select: none;\
user-select: none;\
top: 0;\
bottom: 0;\
left: 0;\
position: absolute;\
}\
.ace_static_highlight .ace_gutter-cell:before {\
content: counter(ace_line, decimal);\
counter-increment: ace_line;\
}\
.ace_static_highlight {\
counter-reset: ace_line;\
}\
";
var config = acequire("../config");
var dom = acequire("../lib/dom");

var SimpleTextLayer = function() {
    this.config = {};
};
SimpleTextLayer.prototype = TextLayer.prototype;

var highlight = function(el, opts, callback) {
    var m = el.className.match(/lang-(\w+)/);
    var mode = opts.mode || m && ("ace/mode/" + m[1]);
    if (!mode)
        return false;
    var theme = opts.theme || "ace/theme/textmate";
    
    var data = "";
    var nodes = [];

    if (el.firstElementChild) {
        var textLen = 0;
        for (var i = 0; i < el.childNodes.length; i++) {
            var ch = el.childNodes[i];
            if (ch.nodeType == 3) {
                textLen += ch.data.length;
                data += ch.data;
            } else {
                nodes.push(textLen, ch);
            }
        }
    } else {
        data = dom.getInnerText(el);
        if (opts.trim)
            data = data.trim();
    }
    
    highlight.render(data, mode, theme, opts.firstLineNumber, !opts.showGutter, function (highlighted) {
        dom.importCssString(highlighted.css, "ace_highlight");
        el.innerHTML = highlighted.html;
        var container = el.firstChild.firstChild;
        for (var i = 0; i < nodes.length; i += 2) {
            var pos = highlighted.session.doc.indexToPosition(nodes[i]);
            var node = nodes[i + 1];
            var lineEl = container.children[pos.row];
            lineEl && lineEl.appendChild(node);
        }
        callback && callback();
    });
};
highlight.render = function(input, mode, theme, lineStart, disableGutter, callback) {
    var waiting = 1;
    var modeCache = EditSession.prototype.$modes;
    if (typeof theme == "string") {
        waiting++;
        config.loadModule(['theme', theme], function(m) {
            theme = m;
            --waiting || done();
        });
    }
    var modeOptions;
    if (mode && typeof mode === "object" && !mode.getTokenizer) {
        modeOptions = mode;
        mode = modeOptions.path;
    }
    if (typeof mode == "string") {
        waiting++;
        config.loadModule(['mode', mode], function(m) {
            if (!modeCache[mode] || modeOptions)
                modeCache[mode] = new m.Mode(modeOptions);
            mode = modeCache[mode];
            --waiting || done();
        });
    }
    function done() {
        var result = highlight.renderSync(input, mode, theme, lineStart, disableGutter);
        return callback ? callback(result) : result;
    }
    return --waiting || done();
};
highlight.renderSync = function(input, mode, theme, lineStart, disableGutter) {
    lineStart = parseInt(lineStart || 1, 10);

    var session = new EditSession("");
    session.setUseWorker(false);
    session.setMode(mode);

    var textLayer = new SimpleTextLayer();
    textLayer.setSession(session);

    session.setValue(input);

    var stringBuilder = [];
    var length =  session.getLength();

    for(var ix = 0; ix < length; ix++) {
        stringBuilder.push("<div class='ace_line'>");
        if (!disableGutter)
            stringBuilder.push("<span class='ace_gutter ace_gutter-cell' unselectable='on'>" + /*(ix + lineStart) + */ "</span>");
        textLayer.$renderLine(stringBuilder, ix, true, false);
        stringBuilder.push("\n</div>");
    }
    var html = "<div class='" + theme.cssClass + "'>" +
        "<div class='ace_static_highlight" + (disableGutter ? "" : " ace_show_gutter") +
            "' style='counter-reset:ace_line " + (lineStart - 1) + "'>" +
            stringBuilder.join("") +
        "</div>" +
    "</div>";

    textLayer.destroy();

    return {
        css: baseStyles + theme.cssText,
        html: html,
        session: session
    };
};

module.exports = highlight;
module.exports.highlight = highlight;
});
                (function() {
                    ace.acequire(["ace/ext/static_highlight"], function() {});
                })();
            