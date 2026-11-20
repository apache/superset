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

import { CSSProperties, useEffect, useMemo, useState } from 'react';
import { DatePattern, TopBannerChartProps } from './types.js';

function getDateOptions(pattern: DatePattern): Intl.DateTimeFormatOptions {
  switch (pattern) {
    case 'short':
      return { year: 'numeric', month: '2-digit', day: '2-digit' };
    case 'medium':
      return { year: 'numeric', month: 'short', day: '2-digit' };
    case 'long':
      return { year: 'numeric', month: 'long', day: '2-digit' };
    case 'full':
      return { weekday: 'long', year: 'numeric', month: 'long', day: '2-digit' };
    case 'weekday':
    default:
      return { weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' };
  }
}

export default function TopBanner({
  width,
  height,
  bannerTitle,
  bannerSubtitle,
  bannerIcon,
  showIcon,
  showClock,
  clockPosition,
  timezone,
  locale,
  datePattern,
  showDate,
  showSeconds,
  use24Hour,
  titleFontSize,
  subtitleFontSize,
  clockFontSize,
  iconFontSize,
  horizontalPadding,
  verticalPadding,
  borderRadius,
  backgroundColor,
  titleColor,
  subtitleColor,
  clockColor,
  accentColor,
  showBottomBorder,
}: TopBannerChartProps) {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    let intervalId: number | undefined;
    const delay = 1000 - (Date.now() % 1000);
    const timeoutId = window.setTimeout(() => {
      setNow(new Date());
      intervalId = window.setInterval(() => setNow(new Date()), 1000);
    }, delay);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, []);

  const formatters = useMemo(() => {
    try {
      return {
        time: new Intl.DateTimeFormat(locale, {
          timeZone: timezone,
          hour: '2-digit',
          minute: '2-digit',
          second: showSeconds ? '2-digit' : undefined,
          hour12: !use24Hour,
        }),
        date: new Intl.DateTimeFormat(locale, {
          timeZone: timezone,
          ...getDateOptions(datePattern),
        }),
      };
    } catch {
      return null;
    }
  }, [locale, timezone, datePattern, showSeconds, use24Hour]);

  const clockOnLeft = clockPosition === 'left';
  const containerStyle: CSSProperties = {
    boxSizing: 'border-box', width, height, minWidth: 0, minHeight: 0,
    padding: `${verticalPadding}px ${horizontalPadding}px`, display: 'flex',
    flexDirection: clockOnLeft ? 'row-reverse' : 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 24, overflow: 'hidden',
    background: backgroundColor, borderRadius: `${borderRadius}px`,
    borderBottom: showBottomBorder ? `3px solid ${accentColor}` : 'none',
  };
  const brandingStyle: CSSProperties = { minWidth: 0, display: 'flex', alignItems: 'center', gap: 14 };
  const iconStyle: CSSProperties = {
    flex: '0 0 auto', width: iconFontSize + 22, height: iconFontSize + 22,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 10, color: '#fff', background: accentColor, fontSize: `${iconFontSize}px`,
  };
  const textStyle: CSSProperties = { minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 };
  const titleStyle: CSSProperties = {
    overflow: 'hidden', color: titleColor, fontSize: `${titleFontSize}px`,
    fontWeight: 700, lineHeight: 1.2, textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  };
  const subtitleStyle: CSSProperties = {
    overflow: 'hidden', color: subtitleColor, fontSize: `${subtitleFontSize}px`,
    lineHeight: 1.25, textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  };
  const clockAreaStyle: CSSProperties = {
    flex: '0 0 auto', display: 'flex', flexDirection: 'column',
    alignItems: clockOnLeft ? 'flex-start' : 'flex-end',
    textAlign: clockOnLeft ? 'left' : 'right', color: clockColor,
  };
  const dateStyle: CSSProperties = {
    fontSize: `${Math.max(11, Math.round(clockFontSize * 0.42))}px`,
    opacity: 0.75, lineHeight: 1.2, whiteSpace: 'nowrap',
  };
  const clockStyle: CSSProperties = {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
    fontSize: `${clockFontSize}px`, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
    lineHeight: 1.1, whiteSpace: 'nowrap',
  };
  const errorStyle: CSSProperties = { color: '#d32f2f', fontSize: 12, lineHeight: 1.4 };

  return (
    <div style={containerStyle}>
      <div style={brandingStyle}>
        {showIcon && bannerIcon.trim() !== '' && <div style={iconStyle}>{bannerIcon}</div>}
        <div style={textStyle}>
          {bannerTitle.trim() !== '' && <div style={titleStyle}>{bannerTitle}</div>}
          {bannerSubtitle.trim() !== '' && <div style={subtitleStyle}>{bannerSubtitle}</div>}
        </div>
      </div>

      {showClock && (
        formatters === null ? (
          <div style={errorStyle}>Invalid locale or time zone.<br />{locale} / {timezone}</div>
        ) : (
          <div style={clockAreaStyle}>
            {showDate && <div style={dateStyle}>{formatters.date.format(now)}</div>}
            <time style={clockStyle} dateTime={now.toISOString()}>{formatters.time.format(now)}</time>
          </div>
        )
      )}
    </div>
  );
}
