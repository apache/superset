import { getNumberFormatterRegistry, createD3NumberFormatter, createSiAtMostNDigitFormatter } from '@superset-ui/number-format';
import { getTimeFormatterRegistry, smartDateFormatter, smartDateVerboseFormatter } from '@superset-ui/time-format';

export default function setupFormatters() {
  const defaultNumberFormatter = createSiAtMostNDigitFormatter({ n: 3 });

  getNumberFormatterRegistry()
    .registerValue(defaultNumberFormatter.id, defaultNumberFormatter)
    .registerValue('+,', createD3NumberFormatter({
      formatString: '+,d',
    }))
    .setDefaultKey(defaultNumberFormatter.id);

  getTimeFormatterRegistry()
    .registerValue('smart_date', smartDateFormatter)
    .registerValue('smart_date_verbose', smartDateVerboseFormatter)
    .setDefaultKey('smart_date');
}
