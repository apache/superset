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
  CSSProperties,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
  PropsWithChildren,
  RefObject,
  FC,
} from 'react';

import { t, isFeatureEnabled, FeatureFlag, css } from '@superset-ui/core';
import ImageLoader from 'src/components/ListViewCard/ImageLoader';
import { usePluginContext } from 'src/components/DynamicPlugins';
import { Tooltip } from 'src/components/Tooltip';
import { GenericLink } from 'src/components/GenericLink/GenericLink';
import { Theme } from '@emotion/react';

const FALLBACK_THUMBNAIL_URL = '/static/assets/images/chart-card-fallback.svg';

const TruncatedTextWithTooltip = ({
  children,
  tooltipText,
  ...props
}: PropsWithChildren<{
  tooltipText?: string;
}>) => {
  // Uses React.useState for testing purposes
  const [isTruncated, setIsTruncated] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setIsTruncated(
      ref.current ? ref.current.scrollWidth > ref.current.clientWidth : false,
    );
  }, [children]);

  const div = (
    <div
      {...props}
      ref={ref}
      css={css`
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        display: block;
      `}
    >
      {children}
    </div>
  );

  return isTruncated ? (
    <Tooltip title={tooltipText || children}>{div}</Tooltip>
  ) : (
    div
  );
};

const MetadataItem: FC<{
  label: ReactNode;
  value: ReactNode;
  tooltipText?: string;
}> = ({ label, value, tooltipText }) => (
  <div
    css={(theme: Theme) => css`
      font-size: ${theme.typography.sizes.s}px;
      display: flex;
      justify-content: space-between;

      &:not(:last-child) {
        margin-bottom: ${theme.gridUnit}px;
      }
    `}
  >
    <span
      css={(theme: Theme) => css`
        margin-right: ${theme.gridUnit * 4}px;
        color: ${theme.colors.grayscale.base};
      `}
    >
      {label}
    </span>
    <span
      css={css`
        min-width: 0;
      `}
    >
      <TruncatedTextWithTooltip tooltipText={tooltipText}>
        {value}
      </TruncatedTextWithTooltip>
    </span>
  </div>
);

const SliceAddedBadgePlaceholder: FC<{
  showThumbnails?: boolean;
  placeholderRef: (element: HTMLDivElement) => void;
}> = ({ showThumbnails, placeholderRef }) => (
  <div
    ref={placeholderRef}
    css={(theme: Theme) => css`
      /* Display styles */
      border: 1px solid ${theme.colors.primary.dark1};
      border-radius: ${theme.gridUnit}px;
      color: ${theme.colors.primary.dark1};
      font-size: ${theme.typography.sizes.xs}px;
      letter-spacing: 0.02em;
      padding: ${theme.gridUnit / 2}px ${theme.gridUnit * 2}px;
      margin-left: ${theme.gridUnit * 4}px;
      pointer-events: none;

      /* Position styles */
      visibility: hidden;
      position: ${showThumbnails ? 'absolute' : 'unset'};
      top: ${showThumbnails ? '72px' : 'unset'};
      left: ${showThumbnails ? '84px' : 'unset'};
    `}
  >
    {t('Added')}
  </div>
);

const SliceAddedBadge: FC<{ placeholder?: HTMLDivElement }> = ({
  placeholder,
}) => (
  <div
    css={(theme: Theme) => css`
      /* Display styles */
      border: 1px solid ${theme.colors.primary.dark1};
      border-radius: ${theme.gridUnit}px;
      color: ${theme.colors.primary.dark1};
      font-size: ${theme.typography.sizes.xs}px;
      letter-spacing: 0.02em;
      padding: ${theme.gridUnit / 2}px ${theme.gridUnit * 2}px;
      margin-left: ${theme.gridUnit * 4}px;
      pointer-events: none;

      /* Position styles */
      display: ${placeholder ? 'unset' : 'none'};
      position: absolute;
      top: ${placeholder ? `${placeholder.offsetTop}px` : 'unset'};
      left: ${placeholder ? `${placeholder.offsetLeft - 2}px` : 'unset'};
    `}
  >
    {t('Added')}
  </div>
);

const AddSliceCard: FC<{
  datasourceUrl?: string;
  datasourceName?: string;
  innerRef?: RefObject<HTMLDivElement>;
  isSelected?: boolean;
  lastModified?: string;
  sliceName: string;
  style?: CSSProperties;
  thumbnailUrl?: string | null;
  visType: string;
}> = ({
  datasourceUrl,
  datasourceName = '-',
  innerRef,
  isSelected = false,
  lastModified,
  sliceName,
  style = {},
  thumbnailUrl,
  visType,
}) => {
  const showThumbnails = isFeatureEnabled(FeatureFlag.Thumbnails);
  const [sliceAddedBadge, setSliceAddedBadge] = useState<HTMLDivElement>();
  const { mountedPluginMetadata } = usePluginContext();
  const vizName = useMemo(
    () => mountedPluginMetadata[visType]?.name || t('Unknown type'),
    [mountedPluginMetadata, visType],
  );

  return (
    <div ref={innerRef} style={style}>
      <div
        data-test="chart-card"
        css={(theme: Theme) => css`
          border: 1px solid ${theme.colors.grayscale.light2};
          border-radius: ${theme.gridUnit}px;
          background: ${theme.colors.grayscale.light5};
          padding: ${theme.gridUnit * 4}px;
          margin: 0 ${theme.gridUnit * 3}px ${theme.gridUnit * 3}px
            ${theme.gridUnit * 3}px;
          position: relative;
          cursor: ${isSelected ? 'not-allowed' : 'move'};
          white-space: nowrap;
          overflow: hidden;
          line-height: 1.3;
          color: ${theme.colors.grayscale.dark1};

          &:hover {
            background: ${theme.colors.grayscale.light4};
          }

          opacity: ${isSelected ? 0.4 : 'unset'};
        `}
      >
        <div
          css={css`
            display: flex;
          `}
        >
          {showThumbnails ? (
            <div
              data-test="thumbnail"
              css={css`
                width: 146px;
                height: 82px;
                flex-shrink: 0;
                margin-right: 16px;
              `}
            >
              <ImageLoader
                src={thumbnailUrl || ''}
                fallback={FALLBACK_THUMBNAIL_URL}
                position="top"
              />
              {isSelected && showThumbnails ? (
                <SliceAddedBadgePlaceholder
                  placeholderRef={setSliceAddedBadge}
                  showThumbnails={showThumbnails}
                />
              ) : null}
            </div>
          ) : null}
          <div
            css={css`
              flex-grow: 1;
              min-width: 0;
            `}
          >
            <div
              data-test="card-title"
              css={(theme: Theme) => css`
                margin-bottom: ${theme.gridUnit * 2}px;
                font-weight: ${theme.typography.weights.bold};
                display: flex;
                justify-content: space-between;
                align-items: center;
              `}
            >
              <TruncatedTextWithTooltip>{sliceName}</TruncatedTextWithTooltip>
              {isSelected && !showThumbnails ? (
                <SliceAddedBadgePlaceholder
                  placeholderRef={setSliceAddedBadge}
                />
              ) : null}
            </div>
            <div
              css={css`
                display: flex;
                flex-direction: column;
              `}
            >
              <MetadataItem label={t('Viz type')} value={vizName} />
              <MetadataItem
                label={t('Dataset')}
                value={
                  datasourceUrl ? (
                    <GenericLink to={datasourceUrl}>
                      {datasourceName}
                    </GenericLink>
                  ) : (
                    datasourceName
                  )
                }
                tooltipText={datasourceName}
              />
              <MetadataItem label={t('Modified')} value={lastModified} />
            </div>
          </div>
        </div>
      </div>
      <SliceAddedBadge placeholder={sliceAddedBadge} />
    </div>
  );
};

export default AddSliceCard;
