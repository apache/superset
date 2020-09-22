import React from 'react';
import { connect, Dispatch } from 'react-redux';
import { bindActionCreators } from 'redux';
import { WarningFilled } from '@ant-design/icons';
import { useTheme } from '@superset-ui/core';
import { ReactComponent as FilterIcon } from 'images/icons/filter.svg';
import { Popover, Icon } from 'src/common/components';
import DetailsPanel, { Indicator } from './DetailsPanel';
import S from './Styles';
import { setDirectPathToChild } from '../../actions/dashboardState';
import {
  selectIndicatorsForChart,
  INCOMPATIBLE,
  APPLIED,
  UNSET,
} from './selectors';

const mapDispatchToProps = (dispatch: Dispatch<any>) => {
  return bindActionCreators(
    {
      onHighlightFilterSource: setDirectPathToChild,
    },
    dispatch,
  );
};

interface FiltersBadgeProps {
  chartId: string;
}

const mapStateToProps = (
  { datasources, dashboardFilters, charts }: any,
  { chartId }: FiltersBadgeProps,
) => {
  const indicators = selectIndicatorsForChart(
    chartId,
    dashboardFilters,
    datasources,
    charts,
  );

  return {
    chartId,
    indicators,
  };
};

const FiltersBadge = ({
  indicators,
  onHighlightFilterSource,
}: {
  indicators: Indicator[];
  onHighlightFilterSource: (path: string) => void;
}) => {
  const theme = useTheme();
  const appliedIndicators = indicators.filter(
    indicator => indicator.status === APPLIED,
  );
  const unsetIndicators = indicators.filter(
    indicator => indicator.status === UNSET,
  );
  const incompatibleIndicators = indicators.filter(
    indicator => indicator.status === INCOMPATIBLE,
  );

  if (!appliedIndicators.length && !incompatibleIndicators.length) {
    return null;
  }

  return (
    <span>
      <Popover
        content={
          <DetailsPanel
            appliedIndicators={appliedIndicators}
            unsetIndicators={unsetIndicators}
            incompatibleIndicators={incompatibleIndicators}
            onHighlightFilterSource={onHighlightFilterSource}
          />
        }
        placement="bottomRight"
        trigger="click"
      >
        <S.Pill>
          <Icon component={FilterIcon} />{' '}
          <span className="indicator-count">
            {appliedIndicators.length + incompatibleIndicators.length}
          </span>
          {incompatibleIndicators.length ? (
            <span className="rejected-indicators">
              {' '}
              <WarningFilled style={{ color: theme.colors.warning.base }} />
            </span>
          ) : null}
        </S.Pill>
      </Popover>
    </span>
  );
};

export default connect(mapStateToProps, mapDispatchToProps)(FiltersBadge);
