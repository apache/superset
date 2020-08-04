import {array} from 'vega-util';
import {
  ChannelDef,
  Conditional,
  FieldDef,
  isConditionalSelection,
  ValueDef,
  ValueOrGradientOrText
} from '../../../channeldef';
import {VgEncodeEntry, VgValueRef} from '../../../vega.schema';
import {expression} from '../../predicate';
import {parseSelectionPredicate} from '../../selection/parse';
import {UnitModel} from '../../unit';

/**
 * Return a mixin that includes a Vega production rule for a Vega-Lite conditional channel definition.
 * or a simple mixin if channel def has no condition.
 */
export function wrapCondition<FD extends FieldDef<any>, V extends ValueOrGradientOrText>(
  model: UnitModel,
  channelDef: ChannelDef<FD, V>,
  vgChannel: string,
  refFn: (cDef: ChannelDef<FD, V> | Conditional<ValueDef<V> | FD>) => VgValueRef
): VgEncodeEntry {
  const condition = channelDef && channelDef.condition;
  const valueRef = refFn(channelDef);
  if (condition) {
    const conditions = array(condition);
    const vgConditions = conditions.map(c => {
      const conditionValueRef = refFn(c);
      const test = isConditionalSelection(c) ? parseSelectionPredicate(model, c.selection) : expression(model, c.test);
      return {
        test,
        ...conditionValueRef
      };
    });
    return {
      [vgChannel]: [...vgConditions, ...(valueRef !== undefined ? [valueRef] : [])]
    };
  } else {
    return valueRef !== undefined ? {[vgChannel]: valueRef} : {};
  }
}
