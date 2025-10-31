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
import { useEffect, useState } from 'react';
import { t } from '@superset-ui/core';
import { Radio } from '@superset-ui/core/components/Radio';
import { DatePicker } from '@superset-ui/core/components/DatePicker';
import { Row, Col } from '@superset-ui/core/components/Grid';
import { extendedDayjs as dayjs } from '@superset-ui/core/utils/dates';
import type { Dayjs } from 'dayjs';
import { 
  gregorianToPersian, 
  getCurrentPersianDate,
} from 'src/utils/persianCalendar';

// Persian calendar range options
const PERSIAN_CALENDAR_RANGE_OPTIONS = [
  { label: t('Last 7 days'), value: 'last_7_days' },
  { label: t('Last 30 days'), value: 'last_30_days' },
  { label: t('Last 90 days'), value: 'last_90_days' },
  { label: t('Last year'), value: 'last_year' },
  { label: t('Custom Range'), value: 'custom_range' },
];

const PERSIAN_CALENDAR_RANGE_SET = new Set(
  PERSIAN_CALENDAR_RANGE_OPTIONS.map(o => o.value),
);

type PersianCalendarRangeType =
  | 'last_7_days'
  | 'last_30_days'
  | 'last_90_days'
  | 'last_year'
  | 'custom_range';

interface PersianCalendarFilterPluginProps {
  formData: {
    time_range?: string;
  };
  height: number;
  width: number;
  timeRange?: string;
  setDataMask?: (data: any) => void;
}

export default function PersianCalendarFilterPlugin({
  formData,
  height,
  width,
  timeRange,
  setDataMask,
}: PersianCalendarFilterPluginProps) {
  const [selectedRange, setSelectedRange] = useState<PersianCalendarRangeType>('last_7_days');
  const [customStartDate, setCustomStartDate] = useState<Dayjs | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Dayjs | null>(null);
  const [persianDate] = useState(getCurrentPersianDate());

  useEffect(() => {
    // Parse the current value to determine the range type
    if (timeRange && PERSIAN_CALENDAR_RANGE_SET.has(timeRange as PersianCalendarRangeType)) {
      setSelectedRange(timeRange as PersianCalendarRangeType);
    }
  }, [timeRange]);

  const handleRangeChange = (range: PersianCalendarRangeType) => {
    setSelectedRange(range);
    
    if (range === 'custom_range') {
      return;
    }

    // Generate the time range string based on the selected range
    const now = dayjs();
    let startDate: Dayjs;

    switch (range) {
      case 'last_7_days':
        startDate = now.subtract(7, 'day');
        break;
      case 'last_30_days':
        startDate = now.subtract(30, 'day');
        break;
      case 'last_90_days':
        startDate = now.subtract(90, 'day');
        break;
      case 'last_year':
        startDate = now.subtract(1, 'year');
        break;
      default:
        startDate = now.subtract(7, 'day');
    }

    // Convert to Persian calendar for display
    const startDatePersian = gregorianToPersian(
      startDate.year(),
      startDate.month() + 1,
      startDate.date()
    );
    const endDatePersian = gregorianToPersian(
      now.year(),
      now.month() + 1,
      now.date()
    );

    // Format Persian dates for display
    const startDatePersianStr = `${startDatePersian.year}-${startDatePersian.month.toString().padStart(2, '0')}-${startDatePersian.day.toString().padStart(2, '0')}`;
    const endDatePersianStr = `${endDatePersian.year}-${endDatePersian.month.toString().padStart(2, '0')}-${endDatePersian.day.toString().padStart(2, '0')}`;

    // Format Gregorian dates for backend processing
    const startDateGregorianStr = startDate.format('YYYY-MM-DD');
    const endDateGregorianStr = now.format('YYYY-MM-DD');

    // Create time range string in Gregorian format for backend
    const timeRangeStr = `${startDateGregorianStr} : ${endDateGregorianStr}`;
    
    // Use setDataMask to send data to other charts (no API call needed)
    if (setDataMask) {
      setDataMask({
        extraFormData: {
          time_range: timeRangeStr,
        },
        filterState: {
          value: timeRangeStr,
          // Store Persian dates for display purposes
          persianStartDate: startDatePersianStr,
          persianEndDate: endDatePersianStr,
        },
      });
    }
  };

  const handleCustomDateChange = (startDate: Dayjs | null, endDate: Dayjs | null) => {
    setCustomStartDate(startDate);
    setCustomEndDate(endDate);

    if (startDate && endDate) {
      // Convert Gregorian dates to Persian for display
      const startDatePersian = gregorianToPersian(
        startDate.year(),
        startDate.month() + 1,
        startDate.date()
      );
      const endDatePersian = gregorianToPersian(
        endDate.year(),
        endDate.month() + 1,
        endDate.date()
      );

      // Format Persian dates for display
      const startDatePersianStr = `${startDatePersian.year}-${startDatePersian.month.toString().padStart(2, '0')}-${startDatePersian.day.toString().padStart(2, '0')}`;
      const endDatePersianStr = `${endDatePersian.year}-${endDatePersian.month.toString().padStart(2, '0')}-${endDatePersian.day.toString().padStart(2, '0')}`;

      // Format Gregorian dates for backend processing
      const startDateGregorianStr = startDate.format('YYYY-MM-DD');
      const endDateGregorianStr = endDate.format('YYYY-MM-DD');

      const timeRangeStr = `${startDateGregorianStr} : ${endDateGregorianStr}`;
      
      // Use setDataMask to send data to other charts (no API call needed)
      if (setDataMask) {
        setDataMask({
          extraFormData: {
            time_range: timeRangeStr,
          },
          filterState: {
            value: timeRangeStr,
            // Store Persian dates for display purposes
            persianStartDate: startDatePersianStr,
            persianEndDate: endDatePersianStr,
          },
        });
      }
    }
  };

  return (
    <div style={{ padding: '16px', height, width }}>
      <div style={{ marginBottom: '16px', fontWeight: 'bold' }}>
        {t('Persian Calendar Filter')} 📅✨
      </div>
      
      <div style={{ marginBottom: '16px' }}>
        <div style={{ marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>
          {t('Select Time Range')}:
        </div>
        <Radio.Group
          value={selectedRange}
          onChange={(e) => handleRangeChange(e.target.value)}
          style={{ width: '100%' }}
        >
          <Row gutter={[8, 8]}>
            {PERSIAN_CALENDAR_RANGE_OPTIONS.map((option) => (
              <Col span={24} key={option.value}>
                <Radio value={option.value} style={{ width: '100%' }}>
                  {option.label}
                </Radio>
              </Col>
            ))}
          </Row>
        </Radio.Group>
      </div>

      {selectedRange === 'custom_range' && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>
            {t('Select Custom Date Range')}:
          </div>
          <Row gutter={8}>
            <Col span={12}>
              <DatePicker
                placeholder={t('Start Date')}
                value={customStartDate}
                onChange={(date) => handleCustomDateChange(date, customEndDate)}
                style={{ width: '100%' }}
              />
            </Col>
            <Col span={12}>
              <DatePicker
                placeholder={t('End Date')}
                value={customEndDate}
                onChange={(date) => handleCustomDateChange(customStartDate, date)}
                style={{ width: '100%' }}
              />
            </Col>
          </Row>
        </div>
      )}

      {/* Display selected Persian date range */}
      {selectedRange !== 'custom_range' && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          backgroundColor: '#f0f2f5',
          borderRadius: '6px',
          border: '1px solid #d9d9d9'
        }}>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
            {t('Selected Persian Date Range')}:
          </div>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1890ff' }}>
            {(() => {
              const now = dayjs();
              let startDate: Dayjs;

              switch (selectedRange) {
                case 'last_7_days':
                  startDate = now.subtract(7, 'day');
                  break;
                case 'last_30_days':
                  startDate = now.subtract(30, 'day');
                  break;
                case 'last_90_days':
                  startDate = now.subtract(90, 'day');
                  break;
                case 'last_year':
                  startDate = now.subtract(1, 'year');
                  break;
                default:
                  startDate = now.subtract(7, 'day');
              }

              const startDatePersian = gregorianToPersian(
                startDate.year(),
                startDate.month() + 1,
                startDate.date()
              );
              const endDatePersian = gregorianToPersian(
                now.year(),
                now.month() + 1,
                now.date()
              );

              const startDateStr = `${startDatePersian.year}/${startDatePersian.month.toString().padStart(2, '0')}/${startDatePersian.day.toString().padStart(2, '0')}`;
              const endDateStr = `${endDatePersian.year}/${endDatePersian.month.toString().padStart(2, '0')}/${endDatePersian.day.toString().padStart(2, '0')}`;

              return `${startDateStr} - ${endDateStr}`;
            })()}
          </div>
        </div>
      )}

      {/* Display selected Persian date range for custom range */}
      {customStartDate && customEndDate && (
        <div style={{
          marginTop: '12px',
          padding: '8px',
          backgroundColor: '#f0f2f5',
          borderRadius: '4px',
          border: '1px solid #d9d9d9'
        }}>
          <div style={{ fontSize: '11px', color: '#666', marginBottom: '2px' }}>
            {t('Selected Persian Date Range')}:
          </div>
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#1890ff' }}>
            {(() => {
              const startDatePersian = gregorianToPersian(
                customStartDate.year(),
                customStartDate.month() + 1,
                customStartDate.date()
              );
              const endDatePersian = gregorianToPersian(
                customEndDate.year(),
                customEndDate.month() + 1,
                customEndDate.date()
              );

              const startDateStr = `${startDatePersian.year}/${startDatePersian.month.toString().padStart(2, '0')}/${startDatePersian.day.toString().padStart(2, '0')}`;
              const endDateStr = `${endDatePersian.year}/${endDatePersian.month.toString().padStart(2, '0')}/${endDatePersian.day.toString().padStart(2, '0')}`;

              return `${startDateStr} - ${endDateStr}`;
            })()}
          </div>
        </div>
      )}

      {/* Current Persian date display */}
      <div style={{
        marginTop: '16px',
        padding: '8px',
        backgroundColor: '#e6f7ff',
        borderRadius: '4px',
        border: '1px solid #91d5ff'
      }}>
        <div style={{ fontSize: '11px', color: '#666', marginBottom: '2px' }}>
          {t('Current Persian Date')}:
        </div>
        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#1890ff' }}>
          {persianDate.year}/{persianDate.month.toString().padStart(2, '0')}/{persianDate.day.toString().padStart(2, '0')} - {persianDate.monthName}
        </div>
      </div>
    </div>
  );
}