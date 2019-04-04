// @flow
export default resolveTokens;

/**
 * Replace tokens in a string template with values in an object
 *
 * @param properties a key/value relationship between tokens and replacements
 * @param text the template string
 * @returns the template with tokens replaced
 * @private
 */
function resolveTokens(properties: {+[string]: mixed}, text: string): string {
    return text.replace(/{([^{}]+)}/g, (match, key: string) => {
        return key in properties ? String(properties[key]) : '';
    });
}
