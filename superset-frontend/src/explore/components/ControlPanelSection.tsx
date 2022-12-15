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
import React, { useCallback, useEffect } from 'react';
import {
  ControlPanelSectionConfig,
  CustomControlItem,
  ExpandedControlItem,
} from '@superset-ui/chart-controls';
import { ensureIsArray, SupersetTheme, t, css } from '@superset-ui/core';
import Collapse from 'src/components/Collapse';
import { Tooltip } from 'src/components/Tooltip';
import { kebabCase } from 'lodash';
import Icons from 'src/components/Icons';
import { usePrevious } from 'src/hooks/usePrevious';
import { ExploreActions } from 'src/explore/actions/exploreActions';
import ControlRow from './ControlRow';

export type ExpandedControlPanelSectionConfig = Omit<
  ControlPanelSectionConfig,
  'controlSetRows'
> & {
  controlSetRows: ExpandedControlItem[][];
};

export const iconStyles = css`
  &.anticon {
    font-size: unset;
    .anticon {
      line-height: unset;
      vertical-align: unset;
    }
  }
`;

type IControlPanelSectionProps = {
  actions: Partial<ExploreActions> & Pick<ExploreActions, 'setControlValue'>;
  sectionId: string;
  section: ExpandedControlPanelSectionConfig;
  hasErrors: boolean;
  errorColor: string;
  renderControl: (item: CustomControlItem) => JSX.Element;
  isDisabled?: boolean;
  disabledMessages?: string[];
};

export function ControlPanelSection({
  actions: { setControlValue },
  sectionId,
  section,
  hasErrors,
  errorColor,
  renderControl,
  isDisabled,
  disabledMessages,
  ...restProps // https://github.com/react-component/collapse/issues/73#issuecomment-323626120
}: IControlPanelSectionProps) {
  const { label, description } = section;
  const wasDisabled = usePrevious(isDisabled);
  const clearDisabledSectionControls = useCallback(() => {
    ensureIsArray(section.controlSetRows).forEach(controlSets => {
      controlSets.forEach(controlItem => {
        if (
          controlItem &&
          !React.isValidElement(controlItem) &&
          controlItem.name &&
          controlItem.config &&
          controlItem.name !== 'datasource'
        ) {
          setControlValue?.(controlItem.name, controlItem.config.default);
        }
      });
    });
  }, [setControlValue, section]);

  useEffect(() => {
    if (wasDisabled === false && isDisabled) {
      clearDisabledSectionControls();
    }
  }, [wasDisabled, isDisabled]);

  const PanelHeader = () => (
    <span data-test="collapsible-control-panel-header">
      <span
        css={(theme: SupersetTheme) => css`
          font-size: ${theme.typography.sizes.m}px;
          line-height: 1.3;
        `}
      >
        {label}
      </span>{' '}
      {!isDisabled && description && (
        <Tooltip id={sectionId} title={description}>
          <Icons.InfoCircleOutlined css={iconStyles} />
        </Tooltip>
      )}
      {!isDisabled && hasErrors && (
        <Tooltip
          id={`${kebabCase('validation-errors')}-tooltip`}
          title={t('This section contains validation errors')}
        >
          <Icons.InfoCircleOutlined
            css={css`
              ${iconStyles};
              color: ${errorColor};
            `}
          />
        </Tooltip>
      )}
      {isDisabled && disabledMessages && (
        <Tooltip
          id={`${kebabCase('disabled-section')}-tooltip`}
          title={disabledMessages.map(msg => <div>{msg}</div>)}
        >
          <Icons.InfoCircleOutlined
            data-test="disabled-section-tooltip"
            css={css`
              ${iconStyles};
            `}
          />
        </Tooltip>
      )}
    </span>
  );

  return (
    <Collapse.Panel
      {...restProps}
      collapsible={isDisabled ? 'disabled' : undefined}
      showArrow={!isDisabled}
      css={theme => css`
        margin-bottom: 0;
        box-shadow: none;

        &:last-child {
          padding-bottom: ${theme.gridUnit * 16}px;
          border-bottom: 0;
        }

        .panel-body {
          margin-left: ${theme.gridUnit * 4}px;
          padding-bottom: 0;
        }

        span.label {
          display: inline-block;
        }
        ${!section.label &&
        `
             .ant-collapse-header {
               display: none;
             }
           `}
      `}
      header={<PanelHeader />}
      key={sectionId}
    >
      {!isDisabled &&
        section.controlSetRows.map((controlSets, i) => {
          const renderedControls = controlSets
            .map(controlItem => {
              if (!controlItem) {
                // When the item is invalid
                return null;
              }
              if (React.isValidElement(controlItem)) {
                // When the item is a React element
                return controlItem;
              }
              if (
                controlItem.name &&
                controlItem.config &&
                controlItem.name !== 'datasource'
              ) {
                return renderControl(controlItem);
              }
              return null;
            })
            .filter(x => x !== null);
          // don't show the row if it is empty
          if (renderedControls.length === 0) {
            return null;
          }
          return (
            <ControlRow
              key={`controlsetrow-${i}`}
              controls={renderedControls}
            />
          );
        })}
    </Collapse.Panel>
  );
}
