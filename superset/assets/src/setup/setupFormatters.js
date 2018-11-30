import { getNumberFormatterRegistry, createD3NumberFormatter } from '@superset-ui/number-format';
import { getTimeFormatterRegistry, smartDateFormatter, smartDateVerboseFormatter } from '@superset-ui/time-format';

export default function setupFormatters() {
  getNumberFormatterRegistry().registerValue('+,', createD3NumberFormatter({
    formatString: '+,d',
  }));

  getTimeFormatterRegistry()
    .registerValue('smart_date', smartDateFormatter)
    .registerValue('smart_date_verbose', smartDateVerboseFormatter)
    .setDefaultKey('smart_date');
}
