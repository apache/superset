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
import { memo, useContext, useMemo, useState } from 'react';
import {
  createHtmlPortalNode,
  InPortal,
  OutPortal,
} from 'react-reverse-portal';
import { styled, SupersetTheme, truncationCSS } from '@superset-ui/core';
import { FormItem as StyledFormItem, Form } from 'src/components/Form';
import { Tooltip } from 'src/components/Tooltip';
import { FilterBarOrientation } from 'src/dashboard/types';
import { checkIsMissingRequiredValue } from '../utils';
import FilterValue from './FilterValue';
import { FilterCard } from '../../FilterCard';
import { FilterBarScrollContext } from '../Vertical';
import { FilterControlProps } from './types';
import { FilterCardPlacement } from '../../FilterCard/types';
import { useIsFilterInScope } from '../../state';

const StyledIcon = styled.div`
  position: absolute;
  right: 0;
`;

const VerticalFilterControlTitle = styled.h4`
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  color: ${({ theme }) => theme.colors.grayscale.dark1};
  margin: 0;
  overflow-wrap: anywhere;
`;

const HorizontalFilterControlTitle = styled(VerticalFilterControlTitle)`
  font-weight: ${({ theme }) => theme.typography.weights.normal};
  color: ${({ theme }) => theme.colors.grayscale.base};
  ${truncationCSS};
`;

const HorizontalOverflowFilterControlTitle = styled(
  HorizontalFilterControlTitle,
)`
  max-width: none;
`;

const VerticalFilterControlTitleBox = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.gridUnit}px;
`;

const HorizontalFilterControlTitleBox = styled(VerticalFilterControlTitleBox)`
  margin-bottom: unset;
`;

const HorizontalOverflowFilterControlTitleBox = styled(
  VerticalFilterControlTitleBox,
)`
  width: 100%;
`;

const VerticalFilterControlContainer = styled(Form)`
  width: 100%;
  && .ant-form-item-label > label {
    text-transform: none;
    width: 100%;
    padding-right: ${({ theme }) => theme.gridUnit * 11}px;
  }
  .ant-form-item-tooltip {
    margin-bottom: ${({ theme }) => theme.gridUnit}px;
  }
`;

const HorizontalFilterControlContainer = styled(Form)`
  && .ant-form-item-label > label {
    margin-bottom: 0;
    text-transform: none;
  }
  .ant-form-item-tooltip {
    margin-bottom: ${({ theme }) => theme.gridUnit}px;
  }
`;

const HorizontalOverflowFilterControlContainer = styled(
  VerticalFilterControlContainer,
)`
  && .ant-form-item-label {
    line-height: 1;
    & > label {
      padding-right: unset;
    }
  }
`;

const VerticalFormItem = styled(StyledFormItem)`
  .ant-form-item-label {
    overflow: visible;
    label.ant-form-item-required:not(.ant-form-item-required-mark-optional) {
      &::after {
        display: none;
      }
    }
  }
`;

const HorizontalFormItem = styled(StyledFormItem)`
  && {
    margin-bottom: 0;
    align-items: center;
  }

  .ant-form-item-label {
    overflow: visible;
    padding-bottom: 0;
    margin-right: ${({ theme }) => theme.gridUnit * 2}px;
    label.ant-form-item-required:not(.ant-form-item-required-mark-optional) {
      &::after {
        display: none;
      }
    }

    & > label::after {
      display: none;
    }
  }

  .ant-form-item-control {
    width: ${({ theme }) => theme.gridUnit * 41}px;
  }
`;

const HorizontalOverflowFormItem = VerticalFormItem;

const useFilterControlDisplay = (
  orientation: FilterBarOrientation,
  overflow: boolean,
) =>
  useMemo(() => {
    if (orientation === FilterBarOrientation.Horizontal) {
      if (overflow) {
        return {
          FilterControlContainer: HorizontalOverflowFilterControlContainer,
          FormItem: HorizontalOverflowFormItem,
          FilterControlTitleBox: HorizontalOverflowFilterControlTitleBox,
          FilterControlTitle: HorizontalOverflowFilterControlTitle,
        };
      }
      return {
        FilterControlContainer: HorizontalFilterControlContainer,
        FormItem: HorizontalFormItem,
        FilterControlTitleBox: HorizontalFilterControlTitleBox,
        FilterControlTitle: HorizontalFilterControlTitle,
      };
    }
    return {
      FilterControlContainer: VerticalFilterControlContainer,
      FormItem: VerticalFormItem,
      FilterControlTitleBox: VerticalFilterControlTitleBox,
      FilterControlTitle: VerticalFilterControlTitle,
    };
  }, [orientation, overflow]);

const ToolTipContainer = styled.div`
  font-size: ${({ theme }) => theme.typography.sizes.m}px;
  display: flex;
`;

const RequiredFieldIndicator = () => (
  <span
    css={(theme: SupersetTheme) => ({
      color: theme.colors.error.base,
      fontSize: `${theme.typography.sizes.s}px`,
      paddingLeft: '1px',
    })}
  >
    *
  </span>
);

const DescriptionToolTip = ({ description }: { description: string }) => (
  <ToolTipContainer>
    <Tooltip
      title={description}
      placement="right"
      overlayInnerStyle={{
        display: '-webkit-box',
        WebkitLineClamp: 10,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'normal',
      }}
      getPopupContainer={trigger => trigger.parentElement as HTMLElement}
    >
      <i
        className="fa fa-info-circle text-muted"
        css={(theme: SupersetTheme) => ({
          paddingLeft: `${theme.gridUnit}px`,
          cursor: 'pointer',
        })}
      />
    </Tooltip>
  </ToolTipContainer>
);

const FilterControl = ({
  dataMaskSelected,
  filter,
  icon,
  onFilterSelectionChange,
  inView,
  showOverflow,
  parentRef,
  orientation = FilterBarOrientation.Vertical,
  overflow = false,
}: FilterControlProps) => {
  const portalNode = useMemo(() => createHtmlPortalNode(), []);
  const [isFilterActive, setIsFilterActive] = useState(false);

  const { name = '<undefined>' } = filter;

  const isFilterInScope = useIsFilterInScope();
  const isMissingRequiredValue =
    isFilterInScope(filter) &&
    checkIsMissingRequiredValue(filter, filter.dataMask?.filterState);
  const validateStatus = isMissingRequiredValue ? 'error' : undefined;
  const isRequired = !!filter.controlValues?.enableEmptyFilter;

  const {
    FilterControlContainer,
    FormItem,
    FilterControlTitleBox,
    FilterControlTitle,
  } = useFilterControlDisplay(orientation, overflow);

  const label = useMemo(
    () => (
      <FilterControlTitleBox>
        <FilterControlTitle data-test="filter-control-name">
          {name}
        </FilterControlTitle>
        {isRequired && <RequiredFieldIndicator />}
        {filter.description?.trim() && (
          <DescriptionToolTip description={filter.description} />
        )}
        <StyledIcon data-test="filter-icon">{icon}</StyledIcon>
      </FilterControlTitleBox>
    ),
    [
      FilterControlTitleBox,
      FilterControlTitle,
      name,
      isRequired,
      filter.description,
      icon,
    ],
  );

  const isScrolling = useContext(FilterBarScrollContext);
  const filterCardPlacement = useMemo(() => {
    if (orientation === FilterBarOrientation.Horizontal) {
      if (overflow) {
        return FilterCardPlacement.Left;
      }
      return FilterCardPlacement.Bottom;
    }
    return FilterCardPlacement.Right;
  }, [orientation, overflow]);

  return (
    <>
      <InPortal node={portalNode}>
        <FilterValue
          dataMaskSelected={dataMaskSelected}
          filter={filter}
          showOverflow={showOverflow}
          onFilterSelectionChange={onFilterSelectionChange}
          inView={inView}
          parentRef={parentRef}
          setFilterActive={setIsFilterActive}
          orientation={orientation}
          overflow={overflow}
          validateStatus={validateStatus}
        />
      </InPortal>
      <FilterControlContainer
        layout={
          orientation === FilterBarOrientation.Horizontal && !overflow
            ? 'horizontal'
            : 'vertical'
        }
      >
        <FilterCard
          filter={filter}
          isVisible={!isFilterActive && !isScrolling}
          placement={filterCardPlacement}
        >
          <div>
            <FormItem
              label={label}
              aria-label={name}
              required={filter?.controlValues?.enableEmptyFilter}
              validateStatus={validateStatus}
            >
              <OutPortal node={portalNode} />
            </FormItem>
          </div>
        </FilterCard>
      </FilterControlContainer>
    </>
  );
};

export default memo(FilterControl);
