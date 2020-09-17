import React from 'react';
import { connect, Dispatch, MapStateToProps } from 'react-redux';
import { bindActionCreators } from 'redux';
import { WarningFilled } from '@ant-design/icons';
import { ReactComponent as FilterIcon } from 'images/icons/filter.svg';
import { Popover, Icon, Collapse } from '../../../common/components';
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

interface IndexProps {
  chartId: string;
}

const mapStateToProps = (
  { datasources, dashboardFilters, charts }: any,
  { chartId }: IndexProps,
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

const Index = ({
  indicators,
  onHighlightFilterSource,
}: {
  indicators: Indicator[];
  onHighlightFilterSource: (path: string) => void;
}) => {
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
        color="rgba(0, 0, 0, 0.8)"
      >
        <S.Pill>
          <Icon component={FilterIcon} />{' '}
          {appliedIndicators.length + incompatibleIndicators.length}
          {incompatibleIndicators.length ? (
            <span>
              {' '}
              <WarningFilled style={{ color: '#FBC700' }} />
            </span>
          ) : null}
        </S.Pill>
      </Popover>
    </span>
  );
};

export default connect(mapStateToProps, mapDispatchToProps)(Index);
