import isString from 'lodash/isString';
import { format as d3Format } from 'd3-format';
import { isRequired } from '@superset-ui/core';
import NumberFormatter from '../NumberFormatter';

export default class D3Formatter extends NumberFormatter {
  /**
   * Pass only the D3 format string to constructor
   *
   * new D3Formatter('.2f');
   *
   * or accompany it with human-readable label and description
   *
   * new D3Formatter({
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

    try {
      formatFunc = d3Format(config.id);
    } catch (e) {
      formatFunc = () => `Invalid format: ${config.id}`;
      isInvalid = true;
    }

    super({ ...config, formatFunc });
    this.isInvalid = isInvalid;
  }
}
