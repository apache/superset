import { getNumberFormatter, getNumberFormatterRegistry, createSiAtMostNDigitFormatter, NumberFormats } from '@superset-ui/number-format';
import { getTimeFormatterRegistry, smartDateFormatter, smartDateVerboseFormatter } from '@superset-ui/time-format';
import { NumberFormatter } from '@superset-ui/number-format';

function formatSecondsAsHourMinuteSeconds(time){
  try {
    // Hours, minutes and seconds
    var hrs = ~~(time / 3600);
    var mins = ~~((time % 3600) / 60);
    var secs = ~~time % 60;

    // Output like "1:01" or "4:03:59" or "123:03:59"
    var ret = "";

    //if (hrs > 0) {
        ret += "" + hrs + ":" + (mins < 10 ? "0" : "");
    //}

    ret += "" + mins + ":" + (secs < 10 ? "0" : "");
    ret += "" + secs;
    return ret;
  } catch (e) {
    return 'Err';
  }
}

export default function setupFormatters() {
  const defaultNumberFormatter = createSiAtMostNDigitFormatter({ n: 3 });

  getNumberFormatterRegistry()
    .registerValue(defaultNumberFormatter.id, defaultNumberFormatter)
    .setDefaultKey(defaultNumberFormatter.id)
    // Add shims for format strings that are deprecated or common typos.
    // Temporary solution until performing a db migration to fix this.
    .registerValue('+,', getNumberFormatter(NumberFormats.INTEGER_CHANGE))
    .registerValue(',0', getNumberFormatter(',.4~f'))
    .registerValue('.', getNumberFormatter('.4~f'))
    .registerValue(',#', getNumberFormatter(',.4~f'))
    .registerValue(',2f', getNumberFormatter(',.4~f'))
    .registerValue(',g', getNumberFormatter(',.4~f'))
    .registerValue('int', getNumberFormatter(NumberFormats.INTEGER))
    .registerValue(',.', getNumberFormatter(',.4~f'))
    .registerValue('.0%f', getNumberFormatter('.1%'))
    .registerValue('.1%f', getNumberFormatter('.1%'))
    .registerValue('.r', getNumberFormatter('.4~f'))
    .registerValue(',0s', getNumberFormatter(',.4~f'))
    .registerValue('%%%', getNumberFormatter('.0%'))
    .registerValue(',0f', getNumberFormatter(',.4~f'))
    .registerValue(',1', getNumberFormatter(',.4~f'))
    .registerValue('$,0', getNumberFormatter('$,.4f'))
    .registerValue('$,0f', getNumberFormatter('$,.4f'))
    .registerValue('$,.f', getNumberFormatter('$,.4f'));

  getTimeFormatterRegistry()
    .registerValue('smart_date', smartDateFormatter)
    .registerValue('smart_date_verbose', smartDateVerboseFormatter)
    .setDefaultKey('smart_date');



  getNumberFormatterRegistry().registerValue('hh:mm:ss', new NumberFormatter({
    id: 'hh:mm:ss',
    formatFunc: v => formatSecondsAsHourMinuteSeconds(v)
  }));

}

