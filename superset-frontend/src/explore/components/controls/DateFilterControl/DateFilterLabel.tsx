/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { css, styled, t, useTheme, NO_TIME_RANGE } from '@superset-ui/core';
import Button from 'src/components/Button';
import ControlHeader from 'src/explore/components/ControlHeader';
import Label from 'src/components/Label';
import Modal from 'src/components/Modal';
import { Divider } from 'src/components';
import Icons from 'src/components/Icons';
import Select from 'src/components/Select/Select';
import { Tooltip } from 'src/components/Tooltip';
import { useDebouncedEffect } from 'src/explore/exploreUtils';
import { SLOW_DEBOUNCE } from 'src/constants';
import { noOp } from 'src/utils/common';
import ControlPopover from '../ControlPopover/ControlPopover';

import { DateFilterControlProps, FrameType } from './types';
import {
  DATE_FILTER_TEST_KEY,
  fetchTimeRange,
  FRAME_OPTIONS,
  guessFrame,
  useDefaultTimeFilter,
} from './utils';
import {
  CommonFrame,
  CalendarFrame,
  CustomFrame,
  AdvancedFrame,
} from './components';

const StyledRangeType = styled(Select)`
  width: 272px;
`;

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

export default function DateFilterLabel(props: DateFilterControlProps) {
  const {
    onChange,
    onOpenPopover = noOp,
    onClosePopover = noOp,
    overlayStyle = 'Popover',
  } = props;
  const defaultTimeFilter = useDefaultTimeFilter();

  const value = props.value ?? defaultTimeFilter;
  const [actualTimeRange, setActualTimeRange] = useState<string>(value);

  const [show, setShow] = useState<boolean>(false);
  const guessedFrame = useMemo(() => guessFrame(value), [value]);
  const [frame, setFrame] = useState<FrameType>(guessedFrame);
  const [lastFetchedTimeRange, setLastFetchedTimeRange] = useState(value);
  const [timeRangeValue, setTimeRangeValue] = useState(value);
  const [validTimeRange, setValidTimeRange] = useState<boolean>(false);
  const [evalResponse, setEvalResponse] = useState<string>(value);
  const [tooltipTitle, setTooltipTitle] = useState<string>(value);
  const theme = useTheme();

  useEffect(() => {
    if (value === NO_TIME_RANGE) {
      setActualTimeRange(NO_TIME_RANGE);
      setTooltipTitle(NO_TIME_RANGE);
      setValidTimeRange(true);
      return;
    }
    fetchTimeRange(value).then(({ value: actualRange, error }) => {
      if (error) {
        setEvalResponse(error || '');
        setValidTimeRange(false);
        setTooltipTitle(value || '');
      } else {
        /*
          HRT == human readable text
          ADR == actual datetime range
          +--------------+------+----------+--------+----------+-----------+
          |              | Last | Previous | Custom | Advanced | No Filter |
          +--------------+------+----------+--------+----------+-----------+
          | control pill | HRT  | HRT      | ADR    | ADR      |   HRT     |
          +--------------+------+----------+--------+----------+-----------+
          | tooltip      | ADR  | ADR      | HRT    | HRT      |   ADR     |
          +--------------+------+----------+--------+----------+-----------+
        */
        if (
          guessedFrame === 'Common' ||
          guessedFrame === 'Calendar' ||
          guessedFrame === 'No filter'
        ) {
          setActualTimeRange(value);
        } else {
          setActualTimeRange(actualRange || '');
          setTooltipTitle(value || '');
        }
        setValidTimeRange(true);
      }
      setLastFetchedTimeRange(value);
      setEvalResponse(actualRange || value);
    });
  }, [value]);

  useDebouncedEffect(
    () => {
      if (timeRangeValue === NO_TIME_RANGE) {
        setEvalResponse(NO_TIME_RANGE);
        setLastFetchedTimeRange(NO_TIME_RANGE);
        setValidTimeRange(true);
        return;
      }
      if (lastFetchedTimeRange !== timeRangeValue) {
        fetchTimeRange(timeRangeValue).then(({ value: actualRange, error }) => {
          if (error) {
            setEvalResponse(error || '');
            setValidTimeRange(false);
          } else {
            setEvalResponse(actualRange || '');
            setValidTimeRange(true);
          }
          setLastFetchedTimeRange(timeRangeValue);
        });
      }
    },
    SLOW_DEBOUNCE,
    [timeRangeValue],
  );

  function onSave() {
    onChange(timeRangeValue);
    setShow(false);
  }

  function onOpen() {
    setTimeRangeValue(value);
    setFrame(guessedFrame);
    setShow(true);
  }

  function onHide() {
    setTimeRangeValue(value);
    setFrame(guessedFrame);
    setShow(false);
  }

  const toggleOverlay = () => {
    if (show) {
      onHide();
      onClosePopover();
    } else {
      onOpen();
      onOpenPopover();
    }
  };

  function onChangeFrame(value: FrameType) {
    if (value === NO_TIME_RANGE) {
      setTimeRangeValue(NO_TIME_RANGE);
    }
    setFrame(value);
  }

  const overlayContent = (
    <ContentStyleWrapper>
      <div className="control-label">{t('RANGE TYPE')}</div>
      <StyledRangeType
        ariaLabel={t('RANGE TYPE')}
        options={FRAME_OPTIONS}
        value={frame}
        onChange={onChangeFrame}
      />
      {frame !== 'No filter' && <Divider />}
      {frame === 'Common' && (
        <CommonFrame value={timeRangeValue} onChange={setTimeRangeValue} />
      )}
      {frame === 'Calendar' && (
        <CalendarFrame value={timeRangeValue} onChange={setTimeRangeValue} />
      )}
      {frame === 'Advanced' && (
        <AdvancedFrame value={timeRangeValue} onChange={setTimeRangeValue} />
      )}
      {frame === 'Custom' && (
        <CustomFrame value={timeRangeValue} onChange={setTimeRangeValue} />
      )}
      {frame === 'No filter' && (
        <div data-test={DATE_FILTER_TEST_KEY.noFilter} />
      )}
      <Divider />
      <div>
        <div className="section-title">{t('Actual time range')}</div>
        {validTimeRange && <div>{evalResponse}</div>}
        {!validTimeRange && (
          <IconWrapper className="warning">
            <Icons.ErrorSolidSmall iconColor={theme.colors.error.base} />
            <span className="text error">{evalResponse}</span>
          </IconWrapper>
        )}
      </div>
      <Divider />
      <div className="footer">
        <Button
          buttonStyle="secondary"
          cta
          key="cancel"
          onClick={onHide}
          data-test={DATE_FILTER_TEST_KEY.cancelButton}
        >
          {t('CANCEL')}
        </Button>
        <Button
          buttonStyle="primary"
          cta
          disabled={!validTimeRange}
          key="apply"
          onClick={onSave}
          data-test={DATE_FILTER_TEST_KEY.applyButton}
        >
          {t('APPLY')}
        </Button>
      </div>
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
    >
      <Tooltip placement="top" title={tooltipTitle}>
        <Label
          className="pointer"
          data-test={DATE_FILTER_TEST_KEY.popoverOverlay}
        >
          {actualTimeRange}
        </Label>
      </Tooltip>
    </ControlPopover>
  );

  const modalContent = (
    <>
      <Tooltip placement="top" title={tooltipTitle}>
        <Label
          className="pointer"
          onClick={toggleOverlay}
          data-test={DATE_FILTER_TEST_KEY.modalOverlay}
        >
          {actualTimeRange}
        </Label>
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
