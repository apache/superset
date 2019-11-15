import ChannelEncoder from './ChannelEncoder';
import createFormatterFromFieldTypeAndFormat from '../parsers/format/createFormatterFromFieldTypeAndFormat';
import { CompleteAxisConfig } from '../fillers/completeAxisConfig';
import { ChannelDef } from '../types/ChannelDef';
import { Value, isDateTime } from '../types/VegaLite';
import { CompleteFieldDef } from '../fillers/completeChannelDef';
import { ChannelInput } from '../types/Channel';
import { HasToString } from '../types/Base';
import parseDateTime from '../parsers/parseDateTime';
import inferElementTypeFromUnionOfArrayTypes from '../utils/inferElementTypeFromUnionOfArrayTypes';

export default class ChannelEncoderAxis<
  Def extends ChannelDef<Output>,
  Output extends Value = Value
> {
  readonly channelEncoder: ChannelEncoder<Def, Output>;
  readonly config: Exclude<CompleteAxisConfig, false>;
  readonly formatValue: (value: ChannelInput | HasToString) => string;

  constructor(channelEncoder: ChannelEncoder<Def, Output>) {
    this.channelEncoder = channelEncoder;
    this.config = channelEncoder.definition.axis as Exclude<CompleteAxisConfig, false>;
    this.formatValue = createFormatterFromFieldTypeAndFormat(
      (channelEncoder.definition as CompleteFieldDef<Output>).type,
      this.config.format || '',
    );
  }

  getTitle() {
    return this.config.title;
  }

  hasTitle() {
    const { title } = this.config;

    return title !== null && typeof title !== 'undefined' && title !== '';
  }

  getTickLabels() {
    const { tickCount, values } = this.config;

    if (typeof values !== 'undefined') {
      return inferElementTypeFromUnionOfArrayTypes(values).map(v =>
        this.formatValue(isDateTime(v) ? parseDateTime(v) : v),
      );
    }

    const { scale } = this.channelEncoder;
    if (scale && 'domain' in scale) {
      return ('ticks' in scale ? scale.ticks(tickCount) : scale.domain()).map(this.formatValue);
    }

    return [];
  }
}
