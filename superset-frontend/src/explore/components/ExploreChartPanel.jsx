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
import React, { useMemo, useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import Split from 'react-split';
import { ParentSize } from '@vx/responsive';
import { styled, t } from '@superset-ui/core';
import debounce from 'lodash/debounce';
import Tabs from 'src/common/components/Tabs';
import { chartPropShape } from '../../dashboard/util/propShapes';
import ChartContainer from '../../chart/ChartContainer';
import ConnectedExploreChartHeader from './ExploreChartHeader';
import { applyFormattingToTabularData } from '../../utils/common';
import TableView, { EmptyWrapperType } from '../../components/TableView';
import { getChartDataRequest } from '../../chart/chartAction';
import getClientErrorObject from '../../utils/getClientErrorObject';
import Loading from '../../components/Loading';
import Icon from '../../components/Icon';

const propTypes = {
  actions: PropTypes.object.isRequired,
  addHistory: PropTypes.func,
  onQuery: PropTypes.func,
  can_overwrite: PropTypes.bool.isRequired,
  can_download: PropTypes.bool.isRequired,
  datasource: PropTypes.object,
  column_formats: PropTypes.object,
  containerId: PropTypes.string.isRequired,
  height: PropTypes.string.isRequired,
  width: PropTypes.string.isRequired,
  isStarred: PropTypes.bool.isRequired,
  slice: PropTypes.object,
  sliceName: PropTypes.string,
  table_name: PropTypes.string,
  vizType: PropTypes.string.isRequired,
  form_data: PropTypes.object,
  standalone: PropTypes.bool,
  timeout: PropTypes.number,
  refreshOverlayVisible: PropTypes.bool,
  chart: chartPropShape,
  errorMessage: PropTypes.node,
  triggerRender: PropTypes.bool,
};

export const EXPLORE_GUTTER_HEIGHT = 5;
export const EXPLORE_GUTTER_MARGIN = 3;
export const CHART_PANEL_PADDING = 30;

const INITIAL_SIZES = [80, 20];

const Styles = styled.div`
  background-color: ${({ theme }) => theme.colors.grayscale.light5};
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  align-content: stretch;
  & > div:last-of-type {
    flex-basis: 100%;
  }

  .gutter {
    border-top: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
    border-bottom: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
    width: 3%;
    margin: ${EXPLORE_GUTTER_MARGIN}px 47%;
  }

  .gutter.gutter-vertical {
    cursor: row-resize;
  }

  .ant-tabs {
    overflow: visible;
    .ant-tabs-content-holder {
      overflow: visible;
    }
    .ant-tabs-nav {
      padding-left: ${({ theme }) => theme.gridUnit * 5}px;
      margin: 0;
      background-color: ${({ theme }) => theme.colors.grayscale.light5};
    }
  }
`;

const SouthPane = styled.div`
  background-color: ${({ theme }) => theme.colors.grayscale.light5};
  z-index: 1;

  .table-condensed {
    max-height: 400px;
    overflow: auto;
  }
`;

const TabsWrapper = styled.div`
  height: ${({ contentHeight }) => contentHeight}px;
`;

const TabTitleContainer = styled.div`
  display: flex;
  align-items: center;
  padding-left: ${({ theme }) => theme.gridUnit}px;
`;

const CollapseButton = styled.div`
  display: flex;
  align-items: center;
  border-radius: 50%;
  margin-left: ${({ theme }) => theme.gridUnit}px;

  :hover {
    background-color: ${({ theme, isTabActive }) =>
      isTabActive ? theme.colors.grayscale.light2 : 'transparent'};
  }

  svg {
    transform: ${({ isOpen }) => (isOpen ? 'rotate(0deg)' : 'rotate(180deg)')};
    transition: transform 0.2s ease-out;
  }
`;

const CollapsibleContent = styled.div`
  height: 100%;
  max-height: ${({ isOpen, height }) => (isOpen ? height : 0)}px;
  overflow: ${({ isOpen }) => (isOpen ? 'visible' : 'hidden')};
  transition: max-height 0.2s ease-out;
`;

const ExploreChartPanel = props => {
  const panelHeadingRef = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(props.standalone ? 0 : 50);

  const calcSectionHeight = percent => {
    const containerHeight = parseInt(props.height, 10) - headerHeight;
    return (
      (containerHeight * percent) / 100 -
      (EXPLORE_GUTTER_HEIGHT / 2 + EXPLORE_GUTTER_MARGIN)
    );
  };

  const [chartSectionHeight, setChartSectionHeight] = useState(
    calcSectionHeight(INITIAL_SIZES[0]) - CHART_PANEL_PADDING,
  );
  const [tableSectionHeight, setTableSectionHeight] = useState(
    calcSectionHeight(INITIAL_SIZES[1]),
  );

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [openPanelKey, setOpenPanelKey] = useState('1');
  const [activeTabKey, setActiveTabKey] = useState('1');

  useEffect(() => {
    const calcHeaderSize = debounce(() => {
      setHeaderHeight(
        props.standalone ? 0 : panelHeadingRef?.current?.offsetHeight,
      );
    }, 100);
    calcHeaderSize();
    document.addEventListener('resize', calcHeaderSize);
    return () => document.removeEventListener('resize', calcHeaderSize);
  }, [props.standalone]);

  useEffect(() => {
    setIsLoading(true);
    getChartDataRequest({
      formData: props.chart.latestQueryFormData,
      resultFormat: 'json',
      resultType: 'results',
    })
      .then(response => {
        // Currently displaying of only first query is supported
        const result = response.result[0];
        setData(result.data);
        setIsLoading(false);
        setError(null);
      })
      .catch(response => {
        getClientErrorObject(response).then(({ error, statusText }) => {
          setError(error || statusText || t('Sorry, An error occurred'));
          setIsLoading(false);
        });
      });
  }, [props.chart.latestQueryFormData]);

  const tableData = useMemo(() => {
    if (!data?.length) {
      return [];
    }
    return applyFormattingToTabularData(data);
  }, [data]);

  const columns = useMemo(
    () =>
      data?.length
        ? Object.keys(data[0]).map(key => ({ accessor: key, Header: key }))
        : [],
    [data],
  );

  const onDrag = ([northPercent, southPercent]) => {
    setChartSectionHeight(
      calcSectionHeight(northPercent) - CHART_PANEL_PADDING,
    );
    setTableSectionHeight(calcSectionHeight(southPercent));
  };

  const renderResultsModalBody = () => {
    if (isLoading) {
      return <Loading />;
    }
    if (error) {
      return <pre>{error}</pre>;
    }
    if (data) {
      if (data.length === 0) {
        return <span>No data</span>;
      }
      return (
        <TableView
          columns={columns}
          data={tableData}
          withPagination={false}
          noDataText={t('No data')}
          emptyWrapperType={EmptyWrapperType.Small}
          className="table-condensed"
        />
      );
    }
    return null;
  };

  const renderChart = () => {
    const { chart } = props;

    return (
      <ParentSize>
        {({ width, height }) =>
          width > 0 &&
          height > 0 && (
            <ChartContainer
              width={Math.floor(width)}
              height={chartSectionHeight}
              annotationData={chart.annotationData}
              chartAlert={chart.chartAlert}
              chartStackTrace={chart.chartStackTrace}
              chartId={chart.id}
              chartStatus={chart.chartStatus}
              triggerRender={props.triggerRender}
              datasource={props.datasource}
              errorMessage={props.errorMessage}
              formData={props.form_data}
              onQuery={props.onQuery}
              owners={props?.slice?.owners}
              queryResponse={chart.queryResponse}
              refreshOverlayVisible={props.refreshOverlayVisible}
              setControlValue={props.actions.setControlValue}
              timeout={props.timeout}
              triggerQuery={chart.triggerQuery}
              vizType={props.vizType}
            />
          )
        }
      </ParentSize>
    );
  };

  if (props.standalone) {
    // dom manipulation hack to get rid of the boostrap theme's body background
    const standaloneClass = 'background-transparent';
    const bodyClasses = document.body.className.split(' ');
    if (bodyClasses.indexOf(standaloneClass) === -1) {
      document.body.className += ` ${standaloneClass}`;
    }
    return renderChart();
  }

  const header = (
    <ConnectedExploreChartHeader
      actions={props.actions}
      addHistory={props.addHistory}
      can_overwrite={props.can_overwrite}
      can_download={props.can_download}
      chartHeight={props.height}
      isStarred={props.isStarred}
      slice={props.slice}
      sliceName={props.sliceName}
      table_name={props.table_name}
      form_data={props.form_data}
      timeout={props.timeout}
      chart={props.chart}
    />
  );

  const elementStyle = (dimension, elementSize, gutterSize) => {
    return {
      [dimension]: `calc(${elementSize}% - ${
        gutterSize + EXPLORE_GUTTER_MARGIN
      }px)`,
    };
  };

  const TabTitle = ({ name, tabKey }) => {
    const isTabActive = tabKey === activeTabKey;
    const onClickHandler = () => {
      if (isTabActive) {
        setOpenPanelKey(openPanelKey === tabKey ? null : tabKey);
      }
    };
    return (
      <TabTitleContainer>
        {name}{' '}
        <CollapseButton
          role="button"
          tabIndex={0}
          onClick={onClickHandler}
          onKeyPress={onClickHandler}
          isOpen={openPanelKey === tabKey}
          isTabActive={isTabActive}
        >
          <Icon name="caret-down" />
        </CollapseButton>
      </TabTitleContainer>
    );
  };
  return (
    <Styles className="panel panel-default chart-container">
      <div className="panel-heading" ref={panelHeadingRef}>
        {header}
      </div>
      <Split
        sizes={INITIAL_SIZES}
        minSize={[200, 100]}
        direction="vertical"
        gutterSize={EXPLORE_GUTTER_HEIGHT}
        onDragEnd={onDrag}
        elementStyle={elementStyle}
      >
        <div className="panel-body">{renderChart()}</div>
        <SouthPane>
          <TabsWrapper contentHeight={tableSectionHeight}>
            <Tabs
              fullWidth={false}
              activeKey={activeTabKey}
              onChange={setActiveTabKey}
            >
              <Tabs.TabPane
                tab={<TabTitle name="Data" tabKey="1" />}
                forceRender
                key="1"
              >
                <CollapsibleContent
                  isOpen={openPanelKey === '1'}
                  height={tableSectionHeight}
                >
                  {renderResultsModalBody()}
                </CollapsibleContent>
              </Tabs.TabPane>
              <Tabs.TabPane
                tab={<TabTitle name="View samples" tabKey="2" />}
                forceRender
                key="2"
              >
                <CollapsibleContent
                  isOpen={openPanelKey === '2'}
                  height={tableSectionHeight}
                >
                  {renderResultsModalBody()}
                </CollapsibleContent>
              </Tabs.TabPane>
            </Tabs>
          </TabsWrapper>
        </SouthPane>
      </Split>
    </Styles>
  );
};

ExploreChartPanel.propTypes = propTypes;

export default ExploreChartPanel;
