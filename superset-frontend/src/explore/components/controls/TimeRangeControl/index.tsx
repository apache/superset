import { useMemo } from 'react';
import dayjs from 'dayjs';
import { TimeRangePicker } from 'src/components/TimePicker';
import ControlHeader, { ControlHeaderProps } from '../../ControlHeader';

type TimeRangeValueType = [string, string];

export interface TimeRangeControlProps extends ControlHeaderProps {
  value?: TimeRangeValueType;
  onChange?: (value: TimeRangeValueType, errors: any) => void;
  allowClear?: boolean;
  showNow?: boolean;
  allowEmpty?: [boolean, boolean];
}

export default function TimeRangeControl({
  value: stringValue,
  onChange,
  allowClear,
  showNow,
  allowEmpty,
  ...rest
}: TimeRangeControlProps) {
  const dayjsValue = useMemo(() => {
    const ret: [dayjs.Dayjs | null, dayjs.Dayjs | null] = [null, null];
    if (stringValue?.[0]) {
      ret[0] = dayjs.utc(stringValue[0], 'HH:mm:ss');
    }
    if (stringValue?.[1]) {
      ret[1] = dayjs.utc(stringValue[1], 'HH:mm:ss');
    }
    return ret;
  }, [stringValue]);

  return (
    <div>
      <ControlHeader {...rest} />
      <TimeRangePicker
        value={dayjsValue}
        onChange={(_, stringValue) => onChange?.(stringValue, null)}
        allowClear={allowClear}
        showNow={showNow}
        allowEmpty={allowEmpty}
      />
    </div>
  );
}
