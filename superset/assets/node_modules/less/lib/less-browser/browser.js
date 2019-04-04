var utils = require('./utils');
module.exports = {
    createCSS: function (document, styles, sheet) {
        // Strip the query-string
        var href = sheet.href || '';

        // If there is no title set, use the filename, minus the extension
        var id = 'less:' + (sheet.title || utils.extractId(href));

        // If this has already been inserted into the DOM, we may need to replace it
        var oldStyleNode = document.getElementById(id);
        var keepOldStyleNode = false;

        // Create a new stylesheet node for insertion or (if necessary) replacement
        var styleNode = document.createElement('style');
        styleNode.setAttribute('type', 'text/css');
        if (sheet.media) {
            styleNode.setAttribute('media', sheet.media);
        }
        styleNode.id = id;

        if (!styleNode.styleSheet) {
            styleNode.appendChild(document.createTextNode(styles));

            // If new contents match contents of oldStyleNode, don't replace oldStyleNode
            keepOldStyleNode = (oldStyleNode !== null && oldStyleNode.childNodes.length > 0 && styleNode.childNodes.length > 0 &&
                oldStyleNode.firstChild.nodeValue === styleNode.firstChild.nodeValue);
        }

        var head = document.getElementsByTagName('head')[0];

        // If there is no oldStyleNode, just append; otherwise, only append if we need
        // to replace oldStyleNode with an updated stylesheet
        if (oldStyleNode === null || keepOldStyleNode === false) {
            var nextEl = sheet && sheet.nextSibling || null;
            if (nextEl) {
                nextEl.parentNode.insertBefore(styleNode, nextEl);
            } else {
                head.appendChild(styleNode);
            }
        }
        if (oldStyleNode && keepOldStyleNode === false) {
            oldStyleNode.parentNode.removeChild(oldStyleNode);
        }

        // For IE.
        // This needs to happen *after* the style element is added to the DOM, otherwise IE 7 and 8 may crash.
        // See http://social.msdn.microsoft.com/Forums/en-US/7e081b65-878a-4c22-8e68-c10d39c2ed32/internet-explorer-crashes-appending-style-element-to-head
        if (styleNode.styleSheet) {
            try {
                styleNode.styleSheet.cssText = styles;
            } catch (e) {
                throw new Error('Couldn\'t reassign styleSheet.cssText.');
            }
        }
    },
    currentScript: function(window) {
        var document = window.document;
        return document.currentScript || (function() {
            var scripts = document.getElementsByTagName('script');
            return scripts[scripts.length - 1];
        })();
    }
};
