// DODO was here
import React from 'react';
import { t } from '@superset-ui/core';
import { Radio } from 'src/components/Radio';
import {
  COMMON_RANGE_OPTIONS,
  COMMON_RANGE_SET,
} from 'src/explore/components/controls/DateFilterControl/utils';
import {
  CommonRangeType,
  FrameComponentProps,
} from 'src/explore/components/controls/DateFilterControl/types';

export function CommonFrame(props: FrameComponentProps) {
  const retranslateConstants = (opts: { value: string; label: string }[]) =>
    process.env.type === undefined
      ? opts
      : opts.map(opt => ({
          value: opt.value,
          label: t(opt.label),
        }));

  let commonRange = 'Last week';
  if (COMMON_RANGE_SET.has(props.value as CommonRangeType)) {
    commonRange = props.value;
  } else {
    props.onChange(commonRange);
  }

  return (
    <>
      <div className="section-title">{t('Configure Time Range: Last...')}</div>
      <Radio.Group
        value={commonRange}
        onChange={(e: any) => props.onChange(e.target.value)}
      >
        {retranslateConstants(COMMON_RANGE_OPTIONS).map(({ value, label }) => (
          <Radio key={value} value={value} className="vertical-radio">
            {label}
          </Radio>
        ))}
      </Radio.Group>
    </>
  );
}
