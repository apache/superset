import isString from 'lodash/isString';
import { format as d3Format } from 'd3-format';
import { isRequired } from '@superset-ui/core';
import NumberFormatter from '../NumberFormatter';

export default class D3NumberFormatter extends NumberFormatter {
  /**
   * Pass only the D3 format string to constructor
   *
   * new D3NumberFormatter('.2f');
   *
   * or accompany it with human-readable label and description
   *
   * new D3NumberFormatter({
   *   id: '.2f',
   *   label: 'Float with 2 decimal points',
   *   description: 'lorem ipsum dolor sit amet',
   * });
   *
   * @param {String|Object} configOrFormatString
   */
  constructor(configOrFormatString = isRequired('configOrFormatString')) {
    const config = isString(configOrFormatString)
      ? { id: configOrFormatString }
      : configOrFormatString;

    let formatFunc;
    let isInvalid = false;

    const { id, label, description } = config;

    try {
      formatFunc = d3Format(id);
    } catch (e) {
      formatFunc = () => `Invalid format: ${id}`;
      isInvalid = true;
    }

    super({ description, formatFunc, id, label });
    this.isInvalid = isInvalid;
  }
}
