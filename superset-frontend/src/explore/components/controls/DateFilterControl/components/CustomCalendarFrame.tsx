import { SEPARATOR } from 'src/explore/components/controls/DateFilterControl/utils';
import { DatePicker, Space } from 'antd';
import { FrameComponentProps } from 'src/explore/components/controls/DateFilterControl/types';
import moment, { Moment } from 'moment';
import { CUSTOM_CALENDAR_RANGE_OPTIONS } from 'src/explore/components/controls/DateFilterControl/utils';
//REFERENCE: https://github.com/apache/superset/issues/26651
// https://github.com/JanZuska/superset/commit/839f725968546540165f26b2e459299b8aee9529#diff-72911db9b9a6a7361dbba666847f9c38fcb957d17448a364a718c7dfe021f881L214
moment.locale('en', {
  week: {
    dow: 1,
  },
});

export function CustomCalendarFrame(props: FrameComponentProps) {
  const { RangePicker } = DatePicker;
  const spaceStyle: React.CSSProperties = { width: '100%' };
  function onChange(dates: [Moment, Moment], dateStrings: [string, string]) {
    const selectedPresetKey = Object.keys(CUSTOM_CALENDAR_RANGE_OPTIONS).find(
      key => {
        const [presetStart, presetEnd] = CUSTOM_CALENDAR_RANGE_OPTIONS[key];
        return (
          dates[0].isSame(presetStart, 'day') &&
          dates[1].isSame(presetEnd, 'day')
        );
      },
    );
       
    if (selectedPresetKey) {
      props.onChange(selectedPresetKey);
    } else {
      props.onChange(`${dateStrings[0]}${SEPARATOR}${dateStrings[1]}`);
    }
  }
  const initialRange = (() => {
    if (!props.value) {
      return undefined;
    }
    // Check if value is a preset key
    const presetGetter = CUSTOM_CALENDAR_RANGE_OPTIONS[props.value];
    if (presetGetter) {
      return presetGetter;
    }
    // Parse custom date range
    const dates = props.value
      .split(SEPARATOR)
      .map(date => moment(date, 'YYYY-MM-DD', true))
      .filter(date => date.isValid());
    return dates.length === 2 ? (dates as [Moment, Moment]) : undefined;
  })();
  return (
    <Space direction="vertical" size={12} style={spaceStyle}>
      <RangePicker
        ranges={CUSTOM_CALENDAR_RANGE_OPTIONS}
        onChange={onChange}
        value={
          initialRange && initialRange.length === 2 ? initialRange : undefined
        }
      />
    </Space>
  );
}