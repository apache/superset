/**
 * A showIf helper for showing any html element.
 *
 * @example
 *      {{showIf true}}     => ''
 *
 * @param {boolean} expression
 * @returns {string}
 */
export function showIf(expression: boolean) {
  return expression ? '' : 'hidden';
}

/**
 * A hideIf helper for hiding any html element.
 *
 * @example
 *      {{hideIf true}}     => 'hidden'
 *
 * @param {boolean} expression
 * @returns {string}
 */
export function hideIf(expression: boolean) {
  return expression ? 'hidden' : '';
}

/**
 * A selectedIf helper for dropdown and radio boxes.
 *
 * @example
 *      {{selectedIf true}} =>  'selected'
 *
 * @param {boolean} expression
 * @returns {string}
 */
export function selectedIf(expression: boolean) {
  return expression ? 'selected' : '';
}

/**
 * A checkedIf helper for checkboxes.
 *
 * @example
 *      {{checkedIf true}}  => 'checked'
 *
 * @param {boolean} expression
 * @returns {string}
 */
export function checkedIf(expression: boolean) {
  return expression ? 'checked' : '';
}

/**
 * An options helper for generating <option> list for <select> dropdowns.
 *
 * @example
 * A simple example:
 *
 *      const data = [
 *          {
 *              id: 1,
 *              description: 'Foo'
 *          },
 *          {
 *              id: 2,
 *              description: 'Bar'
 *          },
 *          {
 *              id: 3,
 *              description: 'Foo Bar'
 *          }
 *      ];
 *
 *      {{{options data selected="2"}}}
 *
 * will generate html like this:
 *
 *      <option value="1">Foo</option>
 *      <option value="2" selected>Bar</option>
 *      <option value="3">Foo Bar</option>
 *
 * @example
 * You can also override the default key names for 'id' & 'description'
 * using the 'id' & 'text' options in the helper.
 *
 *      const data = [
 *          {
 *              value: 1,
 *              text: 'New York'
 *          },
 *          {
 *              value: 2,
 *              text: 'London'
 *          }
 *      ];
 *
 *      {{{options data selected="1" id="value" text="text"}}}
 *
 * will generate html like this:
 *
 *      <option value="1" selected>New York</option>
 *      <option value="2">London</option>
 *
 * @param {array} data
 * @param {object} opts Object of options that includes id, text and selected attribute.
 * @returns {array}
 */
export function options(
  data: any[],
  opts: { hash: { id: string; text: string; selected: any } },
) {
  // The id & text for the <option>
  const id = opts.hash.id || 'id';
  const text = opts.hash.text || 'description';

  // The selection "id" of the <option>
  const selectedId = opts.hash.selected || null;

  return data
    .map(item => {
      const value = item[id] || '';
      const innerText = item[text] || '';
      const selected = value === selectedId ? ' selected' : '';

      return `<option value="${value}"${selected}>${innerText}</option>`;
    })
    .join('\n');
}
