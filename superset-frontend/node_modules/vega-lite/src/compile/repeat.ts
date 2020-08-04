import {isArray} from 'vega-util';
import {Config} from '../config';
import * as log from '../log';
import {NormalizedRepeatSpec} from '../spec';
import {RepeatMapping} from '../spec/repeat';
import {VgLayout} from '../vega.schema';
import {BaseConcatModel} from './baseconcat';
import {buildModel} from './buildmodel';
import {parseRepeatLayoutSize} from './layoutsize/parse';
import {Model} from './model';
import {RepeaterValue} from './repeater';

export class RepeatModel extends BaseConcatModel {
  public readonly repeat: RepeatMapping | string[];

  public readonly children: Model[];

  constructor(
    spec: NormalizedRepeatSpec,
    parent: Model,
    parentGivenName: string,
    repeatValues: RepeaterValue,
    config: Config
  ) {
    super(spec, 'repeat', parent, parentGivenName, config, repeatValues, spec.resolve);

    if (spec.resolve && spec.resolve.axis && (spec.resolve.axis.x === 'shared' || spec.resolve.axis.y === 'shared')) {
      log.warn(log.message.REPEAT_CANNOT_SHARE_AXIS);
    }

    this.repeat = spec.repeat;
    this.children = this._initChildren(spec, this.repeat, repeatValues, config);
  }

  private _initChildren(
    spec: NormalizedRepeatSpec,
    repeat: RepeatMapping | string[],
    repeater: RepeaterValue,
    config: Config
  ): Model[] {
    const children: Model[] = [];

    const row = (!isArray(repeat) && repeat.row) || [repeater ? repeater.row : null];
    const column = (!isArray(repeat) && repeat.column) || [repeater ? repeater.column : null];
    const repeatValues = (isArray(repeat) && repeat) || [repeater ? repeater.repeat : null];

    // cross product
    for (const repeatValue of repeatValues) {
      for (const rowValue of row) {
        for (const columnValue of column) {
          const name =
            (repeatValue ? `__repeat_repeat_${repeatValue}` : '') +
            (rowValue ? `__repeat_row_${rowValue}` : '') +
            (columnValue ? `__repeat_column_${columnValue}` : '');

          const childRepeat = {
            repeat: repeatValue,
            row: rowValue,
            column: columnValue
          };

          children.push(buildModel(spec.spec, this, this.getName('child' + name), undefined, childRepeat, config));
        }
      }
    }

    return children;
  }

  public parseLayoutSize() {
    parseRepeatLayoutSize(this);
  }

  protected assembleDefaultLayout(): VgLayout {
    const {repeat} = this;
    const columns = isArray(repeat) ? undefined : repeat.column ? repeat.column.length : 1;

    return {
      ...(columns ? {columns} : {}),
      bounds: 'full',
      align: 'all'
    };
  }
}
