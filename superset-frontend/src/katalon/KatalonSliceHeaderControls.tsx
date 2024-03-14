import React, { useEffect, useState } from 'react';
import { RouteComponentProps, withRouter } from 'react-router-dom';
import {
  css,
  isFeatureEnabled,
  FeatureFlag,
  styled,
  t,
} from '@superset-ui/core';
import { Menu } from 'src/components/Menu';
import { NoAnimationDropdown } from 'src/components/Dropdown';
import ModalTrigger from 'src/components/ModalTrigger';
import ViewQueryModal from 'src/explore/components/controls/ViewQueryModal';
import { DrillDetailMenuItems } from 'src/components/Chart/DrillDetail';
import { getFormData } from 'packages/superset-ui-core/src/query/api/legacy';
import { isEmpty } from 'lodash';

const MENU_KEYS = {
  VIEW_QUERY: 'view_query',
  DRILL_TO_DETAIL: 'drill_to_detail',
};

// TODO: replace 3 dots with an icon
const VerticalDotsContainer = styled.div`
  padding: ${({ theme }) => theme.gridUnit / 4}px
    ${({ theme }) => theme.gridUnit * 1.5}px;

  .dot {
    display: block;

    height: ${({ theme }) => theme.gridUnit}px;
    width: ${({ theme }) => theme.gridUnit}px;
    border-radius: 50%;
    margin: ${({ theme }) => theme.gridUnit / 2}px 0;

    background-color: ${({ theme }) => theme.colors.text.label};
  }

  &:hover {
    cursor: pointer;
  }
`;
const VerticalDotsTrigger = () => (
  <VerticalDotsContainer>
    <span className="dot" />
    <span className="dot" />
    <span className="dot" />
  </VerticalDotsContainer>
);

export interface SliceHeaderControlsProps {
  sliceId: number;
  dashboardId: number;
}
type SliceHeaderControlsPropsWithRouter = SliceHeaderControlsProps &
  RouteComponentProps;

const SliceHeaderControls = (props: SliceHeaderControlsPropsWithRouter) => {
  const [formData, setFormData] = useState<object | null>(null);
  const dropdownOverlayStyle = {
    zIndex: 99,
    animationDuration: '0s',
  };

  useEffect(() => {
    getFormData({ sliceId: props.sliceId }).then(data => {
      setFormData(data);
    });
  }, []);

  if (formData === null || isEmpty(formData)) {
    return null;
  }

  const menu = (
    <Menu
      onClick={() => {}}
      selectable={false}
      data-test={`slice_${props.sliceId}-menu`}
    >
      <Menu.Item key={MENU_KEYS.VIEW_QUERY}>
        <ModalTrigger
          triggerNode={
            <span data-test="view-query-menu-item">{t('View query')}</span>
          }
          modalTitle={t('View query')}
          modalBody={<ViewQueryModal latestQueryFormData={formData} />}
          draggable
          resizable
          responsive
        />
      </Menu.Item>

      {isFeatureEnabled(FeatureFlag.DRILL_TO_DETAIL) && (
        <DrillDetailMenuItems chartId={props.sliceId} formData={formData} />
      )}
    </Menu>
  );

  return (
    <>
      <NoAnimationDropdown
        overlay={menu}
        overlayStyle={dropdownOverlayStyle}
        trigger={['click']}
        placement="bottomRight"
      >
        <span
          css={css`
            display: flex;
            align-items: center;
          `}
          id={`slice_${props.sliceId}-controls`}
          role="button"
          aria-label="More Options"
        >
          <VerticalDotsTrigger />
        </span>
      </NoAnimationDropdown>
    </>
  );
};

export default withRouter(SliceHeaderControls);
