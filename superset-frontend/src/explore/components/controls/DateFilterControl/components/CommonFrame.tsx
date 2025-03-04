// DODO was here
import { t } from '@superset-ui/core';
import { Radio } from 'src/components/Radio';
import {
  COMMON_RANGE_OPTIONS,
  COMMON_RANGE_SET,
  DateFilterTestKey,
} from 'src/explore/components/controls/DateFilterControl/utils';
import {
  CommonRangeType,
  FrameComponentProps,
} from 'src/explore/components/controls/DateFilterControl/types';

const isStandalone = process.env.type === undefined; // DODO added 44611022

// DODO added 44611022
const retranslateConstants = (opts: { value: string; label: string }[]) =>
  isStandalone
    ? opts
    : opts.map(opt => ({
        value: opt.value,
        label: t(opt.label),
      }));

export function CommonFrame(props: FrameComponentProps) {
  let commonRange = 'Last week';
  if (COMMON_RANGE_SET.has(props.value as CommonRangeType)) {
    commonRange = props.value;
  } else {
    props.onChange(commonRange);
  }

  return (
    <>
      <div className="section-title" data-test={DateFilterTestKey.CommonFrame}>
        {t('Configure Time Range: Last...')}
      </div>
      <Radio.Group
        value={commonRange}
        onChange={(e: any) => props.onChange(e.target.value)}
      >
        {/* DODO changed 44611022 */}
        {retranslateConstants(COMMON_RANGE_OPTIONS).map(({ value, label }) => (
          <Radio key={value} value={value} className="vertical-radio">
            {label}
          </Radio>
        ))}
      </Radio.Group>
    </>
  );
}
