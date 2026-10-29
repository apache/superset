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
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  type RefObject,
} from 'react';
import { t } from '@apache-superset/core/translation';
import {
  NO_TIME_RANGE,
  SupersetClient,
  fetchTimeRange,
} from '@superset-ui/core';
import rison from 'rison';
import { css, styled, useTheme } from '@apache-superset/core/theme';
import {
  Button,
  Constants,
  Divider,
  Icons,
  Select,
} from '@superset-ui/core/components';
import { useDebouncedEffect } from 'src/explore/exploreUtils';
import {
  FRAME_OPTIONS,
  guessFrame,
  useDefaultTimeFilter,
} from 'src/explore/components/controls/DateFilterControl/utils';
import {
  AdvancedFrame,
  CalendarFrame,
  CommonFrame,
  CustomFrame,
} from 'src/explore/components/controls/DateFilterControl/components';
import { CurrentCalendarFrame } from 'src/explore/components/controls/DateFilterControl/components/CurrentCalendarFrame';
import type { FrameType } from 'src/explore/components/controls/DateFilterControl/types';
import type { FilterHandler } from './types';

interface TimeRangeFilterProps {
  value?: string;
  onSubmit: (value: [string, string] | undefined) => void;
  onClose: () => void;
}

const StyledRangeType = styled(Select)`
  width: 272px;
`;

const ContentWrapper = styled.div`
  ${({ theme }) => css`
    width: 600px;
    padding: ${theme.sizeUnit * 3}px;
    background: ${theme.colorBgElevated};
    border-radius: ${theme.borderRadiusLG}px;
    box-shadow: ${theme.boxShadowSecondary};

    .ant-row {
      margin-top: 8px;
    }

    .ant-picker {
      padding: 4px 17px 4px;
      border-radius: 4px;
    }

    .ant-divider-horizontal {
      margin: 16px 0;
    }

    .control-label {
      font-size: ${theme.fontSizeSM}px;
      line-height: 16px;
      margin: 8px 0;
    }

    .section-title {
      font-style: normal;
      font-weight: ${theme.fontWeightStrong};
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
    margin-right: ${({ theme }) => 2 * theme.sizeUnit}px;
    vertical-align: middle;
  }
  .text {
    vertical-align: middle;
  }
  .error {
    color: ${({ theme }) => theme.colorError};
  }
`;

function TimeRangeFilter(
  { value: valueProp, onSubmit, onClose }: TimeRangeFilterProps,
  ref: RefObject<FilterHandler>,
) {
  const defaultTimeFilter = useDefaultTimeFilter();
  const value = valueProp ?? defaultTimeFilter;
  const theme = useTheme();

  // guessedFrame is only used for the initial useState — value is stable at
  // mount because CompactFilterTrigger uses destroyPopupOnHide, so the panel
  // always mounts fresh with the current committed value.
  const guessedFrame = useMemo(() => guessFrame(value), [value]);
  const [frame, setFrame] = useState<FrameType>(guessedFrame);
  const [timeRangeValue, setTimeRangeValue] = useState(value);
  const [evalResponse, setEvalResponse] = useState(value);
  const [validTimeRange, setValidTimeRange] = useState(false);
  const [lastFetched, setLastFetched] = useState(value);

  // Evaluate the committed value shown in "Actual time range".
  useEffect(() => {
    if (value === NO_TIME_RANGE) {
      setEvalResponse(NO_TIME_RANGE);
      setValidTimeRange(true);
      return;
    }
    fetchTimeRange(value).then(({ value: actual, error }) => {
      if (error) {
        setEvalResponse(error ?? '');
        setValidTimeRange(false);
      } else {
        setEvalResponse(actual ?? value);
        setValidTimeRange(true);
      }
      setLastFetched(value);
    });
  }, [value]);

  // Debounced evaluation of the in-progress selection (drives "Actual time range").
  useDebouncedEffect(
    () => {
      if (timeRangeValue === NO_TIME_RANGE) {
        setEvalResponse(NO_TIME_RANGE);
        setLastFetched(NO_TIME_RANGE);
        setValidTimeRange(true);
        return;
      }
      if (lastFetched !== timeRangeValue) {
        fetchTimeRange(timeRangeValue).then(({ value: actual, error }) => {
          if (error) {
            setEvalResponse(error ?? '');
            setValidTimeRange(false);
          } else {
            setEvalResponse(actual ?? '');
            setValidTimeRange(true);
          }
          setLastFetched(timeRangeValue);
        });
      }
    },
    Constants.SLOW_DEBOUNCE,
    [timeRangeValue],
  );

  useImperativeHandle(ref, () => ({
    clearFilter: () => {
      onSubmit(undefined);
    },
  }));

  function onChangeFrame(val: FrameType) {
    if (val === NO_TIME_RANGE) {
      setTimeRangeValue(NO_TIME_RANGE);
    }
    setFrame(val);
  }

  return (
    <ContentWrapper>
      <div className="control-label">{t('Range type')}</div>
      <StyledRangeType
        ariaLabel={t('Range type')}
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
      {frame === 'Current' && (
        <CurrentCalendarFrame
          value={timeRangeValue}
          onChange={setTimeRangeValue}
        />
      )}
      {frame === 'Advanced' && (
        <AdvancedFrame value={timeRangeValue} onChange={setTimeRangeValue} />
      )}
      {frame === 'Custom' && (
        <CustomFrame value={timeRangeValue} onChange={setTimeRangeValue} />
      )}
      <Divider />
      <div>
        <div className="section-title">{t('Actual time range')}</div>
        {validTimeRange && (
          <div>
            {evalResponse === NO_TIME_RANGE ? t('No filter') : evalResponse}
          </div>
        )}
        {!validTimeRange && (
          <IconWrapper className="warning">
            <Icons.ExclamationCircleOutlined iconColor={theme.colorError} />
            <span className="text error">{evalResponse}</span>
          </IconWrapper>
        )}
      </div>
      <Divider />
      <div className="footer">
        <Button buttonStyle="secondary" cta key="cancel" onClick={onClose}>
          {t('Cancel')}
        </Button>
        <Button
          buttonStyle="primary"
          cta
          disabled={!validTimeRange}
          key="apply"
          onClick={async () => {
            if (timeRangeValue === NO_TIME_RANGE) {
              onSubmit(undefined);
              onClose();
              return;
            }
            // fetchTimeRange returns a formatted display string ("X ≤ col < Y"),
            // not the raw since/until strings. Call the API directly to get them.
            try {
              const response = await SupersetClient.get({
                endpoint: `/api/v1/time_range/?q=${rison.encode_uri(timeRangeValue)}`,
              });
              const since: string | undefined =
                response?.json?.result[0]?.since;
              const until: string | undefined =
                response?.json?.result[0]?.until;
              if (since !== undefined && until !== undefined) {
                onSubmit([since, until]);
              }
            } catch {
              // leave filter unchanged on error
            }
            onClose();
          }}
        >
          {t('Apply')}
        </Button>
      </div>
    </ContentWrapper>
  );
}

export default forwardRef(TimeRangeFilter);
