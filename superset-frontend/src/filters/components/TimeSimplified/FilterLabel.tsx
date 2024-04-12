import React, { ReactNode, useState, useEffect, useCallback } from 'react';
import {
  css,
  styled,
  t,
  useTheme,
  NO_TIME_RANGE,
  useCSSTextTruncation,
} from '@superset-ui/core';
import ControlHeader from 'src/explore/components/ControlHeader';
import Modal from 'src/components/Modal';
import Icons from 'src/components/Icons';
import Button from 'src/components/Button';
import { Tooltip } from 'src/components/Tooltip';
import { noOp } from 'src/utils/common';
import ControlPopover from 'src/explore/components/controls/ControlPopover/ControlPopover';
import { DateLabel } from 'src/explore/components/controls/DateFilterControl/components/DateLabel';
import { DateFilterControlProps } from 'src/explore/components/controls/DateFilterControl/types';
import { useDefaultTimeFilter } from 'src/explore/components/controls/DateFilterControl';
import { DateFilterTestKey } from 'src/explore/components/controls/DateFilterControl/utils/constants';
import { fetchTimeRange } from '@superset-ui/core';
import Datetime from 'react-datetime';
import 'react-datetime/css/react-datetime.css';
import moment, { Moment } from 'moment';

const ContentStyleWrapper = styled.div`
  ${({ theme }) => css`
    .ant-row {
      margin-top: 8px;
    }

    .ant-input-number {
      width: 100%;
    }

    .ant-picker {
      padding: 4px 17px 4px;
      border-radius: 4px;
      width: 100%;
    }

    .ant-divider-horizontal {
      margin: 16px 0;
    }

    .control-label {
      font-size: 11px;
      font-weight: ${theme.typography.weights.medium};
      color: ${theme.colors.grayscale.light2};
      line-height: 16px;
      text-transform: uppercase;
      margin: 8px 0;
    }

    .vertical-radio {
      display: block;
      height: 40px;
      line-height: 40px;
    }

    .section-title {
      font-style: normal;
      font-weight: ${theme.typography.weights.bold};
      font-size: 15px;
      line-height: 24px;
      margin-bottom: 8px;
    }

    .control-anchor-to {
      margin-top: 16px;
    }

    .control-anchor-to-datetime {
      width: 217px;
    }

    .footer {
      text-align: right;
    }

    .rdtPicker td.rdtActive {
      background-color: ${theme.colors.primary.base};
      border-radius: 4px;
    }
  `}
`;

const IconWrapper = styled.span`
  span {
    margin-right: ${({ theme }) => 2 * theme.gridUnit}px;
    vertical-align: middle;
  }
  .text {
    vertical-align: middle;
  }
  .error {
    color: ${({ theme }) => theme.colors.error.base};
  }
`;

const presets = [
  {
    label: 'previous calendar month',
    value: 'previous calendar month', // evaluated in date_parser.py
  },
  {
    label: 'this month',
    value: "DATETRUNC(DATETIME('today'), MONTH) : ",
  },
];

const isValidDate = (current: Moment) => current.isBefore(new Date());

const rangeToMoment = (range: string) => {
  const [from] = range.split(' : ');
  return moment(from, 'YYYY-MM-DD');
};

const getActualTimeRange = (value: string) => {
  const preset = presets.find(p => p.value === value);
  if (preset) {
    return preset.label;
  }
  return rangeToMoment(value).format('MMM YYYY');
};

export default function FilterLabel(props: DateFilterControlProps) {
  const {
    onChange,
    onOpenPopover = noOp,
    onClosePopover = noOp,
    overlayStyle = 'Popover',
    isOverflowingFilterBar = false,
  } = props;
  const defaultTimeFilter = useDefaultTimeFilter();

  const value = props.value ?? defaultTimeFilter;
  const [actualTimeRange, setActualTimeRange] = useState<string>(
    getActualTimeRange(value),
  );

  const [show, setShow] = useState<boolean>(false);
  const [tooltipTitle, setTooltipTitle] = useState<ReactNode | null>(value);
  const theme = useTheme();
  const [labelRef, labelIsTruncated] = useCSSTextTruncation<HTMLSpanElement>();

  useEffect(() => {
    if (value === NO_TIME_RANGE) {
      setActualTimeRange(NO_TIME_RANGE);
      setTooltipTitle(null);
      return;
    }
    fetchTimeRange(value).then(({ value: actualRange, error }) => {
      if (error) {
        setTooltipTitle(value || null);
      } else {
        setActualTimeRange(getActualTimeRange(value));
        setTooltipTitle(actualRange);
      }
    });
  }, [labelIsTruncated, labelRef, value]);

  function onOpen() {
    setShow(true);
    onOpenPopover();
  }

  function onHide() {
    setShow(false);
    onClosePopover();
  }

  const toggleOverlay = () => {
    if (show) {
      onHide();
    } else {
      onOpen();
    }
  };

  const handleMonthChange = useCallback(
    (date: Moment): void => {
      let newValue = '';
      if (date.isSame(moment(), 'month') && date.isSame(moment(), 'year')) {
        newValue = presets[1].value;
      } else {
        const dateFrom = date.format('YYYY-MM-01');
        const dateTo = date.add(1, 'month').format('YYYY-MM-01');
        newValue = `${dateFrom} : ${dateTo}`;
      }
      onChange(newValue);
      setShow(false);
      onClosePopover();
    },
    [onChange, onClosePopover],
  );

  const handlePresetChange = useCallback(
    (preset: string): void => {
      onChange(preset);
      setShow(false);
      onClosePopover();
    },
    [onChange, onClosePopover],
  );

  const overlayContent = (
    <ContentStyleWrapper>
      {presets.map((p, i) => (
        <Button key={`p${i}`} onClick={() => handlePresetChange(p.value)} buttonStyle={p.value === value  ? 'primary' : undefined}>
          {p.label}
        </Button>
      ))}
      <Datetime
        dateFormat="YYYY-MM"
        timeFormat={false}
        input={false}
        value={rangeToMoment(value)}
        onChange={handleMonthChange}
        isValidDate={isValidDate}
      />
    </ContentStyleWrapper>
  );

  const title = (
    <IconWrapper>
      <Icons.EditAlt iconColor={theme.colors.grayscale.base} />
      <span className="text">{t('Edit time range')}</span>
    </IconWrapper>
  );

  const popoverContent = (
    <ControlPopover
      placement="right"
      trigger="click"
      content={overlayContent}
      title={title}
      defaultVisible={show}
      visible={show}
      onVisibleChange={toggleOverlay}
      overlayStyle={{ width: '600px' }}
      getPopupContainer={triggerNode =>
        isOverflowingFilterBar
          ? (triggerNode.parentNode as HTMLElement)
          : document.body
      }
      destroyTooltipOnHide
    >
      <Tooltip
        placement="top"
        title={tooltipTitle}
        getPopupContainer={trigger => trigger.parentElement as HTMLElement}
      >
        <DateLabel
          label={actualTimeRange}
          isActive={show}
          isPlaceholder={actualTimeRange === NO_TIME_RANGE}
          data-test={DateFilterTestKey.PopoverOverlay}
          ref={labelRef}
        />
      </Tooltip>
    </ControlPopover>
  );

  const modalContent = (
    <>
      <Tooltip
        placement="top"
        title={tooltipTitle}
        getPopupContainer={trigger => trigger.parentElement as HTMLElement}
      >
        <DateLabel
          onClick={toggleOverlay}
          label={actualTimeRange}
          isActive={show}
          isPlaceholder={actualTimeRange === NO_TIME_RANGE}
          data-test={DateFilterTestKey.ModalOverlay}
          ref={labelRef}
        />
      </Tooltip>
      {/* the zIndex value is from trying so that the Modal doesn't overlay the AdhocFilter when GENERIC_CHART_AXES is enabled */}
      <Modal
        title={title}
        show={show}
        onHide={toggleOverlay}
        width="600px"
        hideFooter
        zIndex={1030}
      >
        {overlayContent}
      </Modal>
    </>
  );

  return (
    <>
      <ControlHeader {...props} />
      {overlayStyle === 'Modal' ? modalContent : popoverContent}
    </>
  );
}
