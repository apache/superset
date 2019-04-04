'use strict';

var DEFAULT_SEPARATOR = ':';

exports.type = 'perItem';

exports.active = false;

exports.description = 'removes specified attributes';

exports.params = {
    elemSeparator: DEFAULT_SEPARATOR,
    attrs: []
};

/**
 * Remove attributes
 *
 * @param elemSeparator
 *   format: string
 *
 * @param attrs:
 *
 *   format: [ element* : attribute* ]
 *
 *   element   : regexp (wrapped into ^...$), single * or omitted > all elements
 *   attribute : regexp (wrapped into ^...$)
 *
 *   examples:
 *
 *     > basic: remove fill attribute
 *     ---
 *     removeAttrs:
 *       attrs: 'fill'
 *
 *     > remove fill attribute on path element
 *     ---
 *       attrs: 'path:fill'
 *
 *
 *     > remove all fill and stroke attribute
 *     ---
 *       attrs:
 *         - 'fill'
 *         - 'stroke'
 *
 *     [is same as]
 *
 *       attrs: '(fill|stroke)'
 *
 *     [is same as]
 *
 *       attrs: '*:(fill|stroke)'
 *
 *     [is same as]
 *
 *       attrs: '.*:(fill|stroke)'
 *
 *
 *     > remove all stroke related attributes
 *     ----
 *     attrs: 'stroke.*'
 *
 *
 * @param {Object} item current iteration item
 * @param {Object} params plugin params
 * @return {Boolean} if false, item will be filtered out
 *
 * @author Benny Schudel
 */
exports.fn = function(item, params) {

        // wrap into an array if params is not
    if (!Array.isArray(params.attrs)) {
        params.attrs = [params.attrs];
    }

    if (item.isElem()) {
        var elemSeparator = typeof params.elemSeparator == 'string' ? params.elemSeparator : DEFAULT_SEPARATOR;

            // prepare patterns
        var patterns = params.attrs.map(function(pattern) {

                // apply to all elements if specifc element is omitted
            if (pattern.indexOf(elemSeparator) === -1) {
                pattern = ['.*', elemSeparator, pattern].join('');
            }

                // create regexps for element and attribute name
            return pattern.split(elemSeparator)
                .map(function(value) {

                        // adjust single * to match anything
                    if (value === '*') { value = '.*'; }

                    return new RegExp(['^', value, '$'].join(''), 'i');
                });

        });

            // loop patterns
        patterns.forEach(function(pattern) {

                // matches element
            if (pattern[0].test(item.elem)) {

                    // loop attributes
                item.eachAttr(function(attr) {
                    var name = attr.name;

                        // matches attribute name
                    if (pattern[1].test(name)) {
                        item.removeAttr(name);
                    }

                });

            }

        });

    }

};
