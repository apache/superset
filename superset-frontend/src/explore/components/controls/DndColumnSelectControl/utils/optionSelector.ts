import { ensureIsArray } from '@superset-ui/core';

/**
 * Get value from an option array.
 */ type GetValue<T> = (
  option: T | string,
  index?: number,
  array?: (T | string)[],
) => T | string;

/**
 * Get option from a value array.
 */ type GetOption<T> = (
  value: T | string,
  index?: number,
  array?: (T | string)[],
) => T;

/**
 * Select options from a known list by option value. Ignores invalid options. *
 *
 * @param options - all known options, a dict of value to option.
 * @param selected - value of selected options
 * @param getValue - how to get value from each option */
export class OptionSelector<T> {
  options: { [key: string]: T };

  /**
   * Selected values, always an array.
   *
   * If an item is string, then we look it up from options.
   */
  selected: (T | string)[];

  getValue: GetValue<T>;

  getOption: GetOption<T>;

  constructor({
    options,
    selected,
    getValue = x => x,
    getOption = x => (typeof x === 'string' ? this.options[x] : x),
  }: {
    options: { [key: string]: T | string };
    selected: (T | string)[] | T | string | null;
    getValue?: GetValue<T>;
    getOption?: GetOption<T>;
  }) {
    this.options = options;
    this.selected = ensureIsArray(selected)
      .map(getValue)
      .filter(x => (typeof x === 'string' ? x in options : Boolean(x)));
    this.getOption = getOption;
    this.getValue = getValue;
  }

  add(option: T) {
    const value = this.getValue(option);
    if (typeof value === 'string' || value in this.options) {
      this.selected.push(value);
    }
  }

  has(option: T): boolean {
    return this.selected.includes(this.getValue(option));
  }

  replace(idx: number, value: T | string) {
    this.selected[idx] = value;
  }

  del(idx: number) {
    this.selected.splice(idx, 1);
  }

  swap(a: number, b: number) {
    [this.selected[a], this.selected[b]] = [this.selected[b], this.selected[a]];
  }

  /**
   * Return selected options from value.
   */
  selectedOptions(): T[] {
    return this.selected.map(this.getOption);
  }
}
