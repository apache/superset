import { getNumberFormatterRegistry } from '@superset-ui/number-format';
import createD3NumberFormatter from '@superset-ui/number-format/esm/factories/createD3NumberFormatter';
import { getTimeFormatterRegistry } from '@superset-ui/time-format';
import smartDateFormatter from '@superset-ui/time-format/lib/formatters/smartDate';
import smartDateVerboseFormatter from '@superset-ui/time-format/lib/formatters/smartDateVerbose';

export default function setupFormatters() {
  getNumberFormatterRegistry().registerValue('+,', createD3NumberFormatter({
    formatString: '+,d',
  }));

  getTimeFormatterRegistry()
    .registerValue('smart_date', smartDateFormatter)
    .registerValue('smart_date_verbose', smartDateVerboseFormatter)
    .setDefaultKey('smart_date');
}
