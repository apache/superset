// DODO was here
import React from 'react';
import { useSelector } from 'react-redux';
import { t } from '@superset-ui/core';
import { Moment } from 'moment';
import { isInteger } from 'lodash';
// @ts-ignore
import { locales } from 'antd/dist/antd-with-locales';
import { Col, Row } from 'src/components';
import { InputNumber } from 'src/components/Input';
import { DatePicker } from 'src/components/DatePicker';
import { Radio } from 'src/components/Radio';
import Select from 'src/components/Select/Select';
import { InfoTooltipWithTrigger } from '@superset-ui/chart-controls';
import {
  SINCE_GRAIN_OPTIONS,
  SINCE_MODE_OPTIONS,
  UNTIL_GRAIN_OPTIONS,
  UNTIL_MODE_OPTIONS,
  MOMENT_FORMAT,
  MIDNIGHT,
  customTimeRangeDecode,
  customTimeRangeEncode,
  dttmToMoment,
  LOCALE_MAPPING,
} from 'src/explore/components/controls/DateFilterControl/utils';
import {
  CustomRangeKey,
  FrameComponentProps,
} from 'src/explore/components/controls/DateFilterControl/types';
import { ExplorePageState } from 'src/explore/types';
import { MOMENT_FORMAT_UI_DODO } from '../../../../../DodoExtensions/explore/components/controls/DateFilterControl/utils/constants';

export function CustomFrame(props: FrameComponentProps) {
  const { customRange, matchedFlag } = customTimeRangeDecode(props.value);
  if (!matchedFlag) {
    props.onChange(customTimeRangeEncode(customRange));
  }
  const {
    sinceDatetime,
    sinceMode,
    sinceGrain,
    sinceGrainValue,
    untilDatetime,
    untilMode,
    untilGrain,
    untilGrainValue,
    anchorValue,
    anchorMode,
  } = { ...customRange };

  function onChange(control: CustomRangeKey, value: string) {
    props.onChange(
      customTimeRangeEncode({
        ...customRange,
        [control]: value,
      }),
    );
  }

  function onGrainValue(
    control: 'sinceGrainValue' | 'untilGrainValue',
    value: string | number,
  ) {
    // only positive values in grainValue controls
    if (isInteger(value) && value > 0) {
      props.onChange(
        customTimeRangeEncode({
          ...customRange,
          [control]: value,
        }),
      );
    }
  }

  function onAnchorMode(option: any) {
    const radioValue = option.target.value;
    if (radioValue === 'now') {
      props.onChange(
        customTimeRangeEncode({
          ...customRange,
          anchorValue: 'now',
          anchorMode: radioValue,
        }),
      );
    } else {
      props.onChange(
        customTimeRangeEncode({
          ...customRange,
          anchorValue: MIDNIGHT,
          anchorMode: radioValue,
        }),
      );
    }
  }

  // For superset dashboard plugin we need to retranslate the labels
  const retranslateConstants = (opts: { value: string; label: string }[]) =>
    process.env.type === undefined
      ? opts
      : opts.map(opt => ({
          value: opt.value,
          label: t(opt.label),
        }));

  const retranslateConstantsComposed = (
    opts: { value: string; label: string }[],
    splitWord: string,
  ) =>
    process.env.type === undefined
      ? opts
      : opts.map(opt => {
          const mainString = `${opt.label.split(splitWord)[0].trim()} %s`;
          return {
            ...opt,
            label: `${t(mainString)} ${t(splitWord)}`.split(' %s').join(''),
          };
        });

  // check if there is a locale defined for explore
  const localFromFlaskBabel = useSelector(
    (state: ExplorePageState) => state?.common?.locale,
  );
  // An undefined datePickerLocale is acceptable if no match is found in the LOCALE_MAPPING[localFromFlaskBabel] lookup
  // and will fall back to antd's default locale when the antd DataPicker's prop locale === undefined
  // This also protects us from the case where state is populated with a locale that antd locales does not recognize
  const datePickerLocale =
    locales[LOCALE_MAPPING[localFromFlaskBabel]]?.DatePicker;

  return (
    <div data-test="custom-frame">
      <div className="section-title">{t('Configure custom time range')}</div>
      <Row gutter={24}>
        <Col span={12}>
          <div className="control-label">
            {t('START (INCLUSIVE)')}{' '}
            <InfoTooltipWithTrigger
              tooltip={t('Start date included in time range')}
              placement="right"
            />
          </div>
          <Select
            ariaLabel={t('START (INCLUSIVE)')}
            options={retranslateConstants(SINCE_MODE_OPTIONS)}
            value={sinceMode}
            onChange={(value: string) => onChange('sinceMode', value)}
          />
          {sinceMode === 'specific' && (
            <Row>
              <DatePicker
                showTime
                defaultValue={dttmToMoment(sinceDatetime)}
                format={MOMENT_FORMAT_UI_DODO} // DODO added #11681438
                onChange={(datetime: Moment) =>
                  onChange('sinceDatetime', datetime.format(MOMENT_FORMAT))
                }
                allowClear={false}
                locale={datePickerLocale}
              />
            </Row>
          )}
          {sinceMode === 'relative' && (
            <Row gutter={8}>
              <Col span={11}>
                {/* Make sure sinceGrainValue looks like a positive integer */}
                <InputNumber
                  placeholder={t('Relative quantity')}
                  value={Math.abs(sinceGrainValue)}
                  min={1}
                  defaultValue={1}
                  onChange={value =>
                    onGrainValue('sinceGrainValue', value || 1)
                  }
                  onStep={value => onGrainValue('sinceGrainValue', value || 1)}
                />
              </Col>
              <Col span={13}>
                <Select
                  ariaLabel={t('Relative period')}
                  options={SINCE_GRAIN_OPTIONS}
                  value={sinceGrain}
                  onChange={(value: string) => onChange('sinceGrain', value)}
                />
              </Col>
            </Row>
          )}
        </Col>
        <Col span={12}>
          <div className="control-label">
            {t('END (EXCLUSIVE)')}{' '}
            <InfoTooltipWithTrigger
              tooltip={t('End date excluded from time range')}
              placement="right"
            />
          </div>
          <Select
            ariaLabel={t('END (EXCLUSIVE)')}
            options={UNTIL_MODE_OPTIONS}
            value={untilMode}
            onChange={(value: string) => onChange('untilMode', value)}
          />
          {untilMode === 'specific' && (
            <Row>
              <DatePicker
                showTime
                defaultValue={dttmToMoment(untilDatetime)}
                format={MOMENT_FORMAT_UI_DODO} // DODO added #11681438
                onChange={(datetime: Moment) =>
                  onChange('untilDatetime', datetime.format(MOMENT_FORMAT))
                }
                allowClear={false}
                locale={datePickerLocale}
              />
            </Row>
          )}
          {untilMode === 'relative' && (
            <Row gutter={8}>
              <Col span={11}>
                <InputNumber
                  placeholder={t('Relative quantity')}
                  value={untilGrainValue}
                  min={1}
                  defaultValue={1}
                  onChange={value =>
                    onGrainValue('untilGrainValue', value || 1)
                  }
                  onStep={value => onGrainValue('untilGrainValue', value || 1)}
                />
              </Col>
              <Col span={13}>
                <Select
                  ariaLabel={t('Relative period')}
                  options={retranslateConstantsComposed(
                    UNTIL_GRAIN_OPTIONS,
                    'After',
                  )}
                  value={untilGrain}
                  onChange={(value: string) => onChange('untilGrain', value)}
                />
              </Col>
            </Row>
          )}
        </Col>
      </Row>
      {sinceMode === 'relative' && untilMode === 'relative' && (
        <div className="control-anchor-to">
          <div className="control-label">{t('Anchor to')}</div>
          <Row align="middle">
            <Col>
              <Radio.Group
                onChange={onAnchorMode}
                defaultValue="now"
                value={anchorMode}
              >
                <Radio key="now" value="now">
                  {t('NOW')}
                </Radio>
                <Radio key="specific" value="specific">
                  {t('Date/Time')}
                </Radio>
              </Radio.Group>
            </Col>
            {anchorMode !== 'now' && (
              <Col>
                <DatePicker
                  showTime
                  defaultValue={dttmToMoment(anchorValue)}
                  onChange={(datetime: Moment) =>
                    onChange('anchorValue', datetime.format(MOMENT_FORMAT))
                  }
                  allowClear={false}
                  className="control-anchor-to-datetime"
                  locale={datePickerLocale}
                />
              </Col>
            )}
          </Row>
        </div>
      )}
    </div>
  );
}
