// DODO was here
import React from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { styled, t } from '@superset-ui/core';

import { EmptyStateMedium } from 'src/components/EmptyState';
import EditableTitle from 'src/components/EditableTitle';
import { setEditMode } from 'src/dashboard/actions/dashboardState';
import DashboardComponent from 'src/dashboard/containers/DashboardComponent';
import AnchorLink from 'src/dashboard/components/AnchorLink';
import DragDroppable from 'src/dashboard/components/dnd/DragDroppable';
import { componentShape } from 'src/dashboard/util/propShapes';
import { LanguageIndicator, LanguageIndicatorWrapper } from 'src/DodoExtensions/Common';

export const RENDER_TAB = 'RENDER_TAB';
export const RENDER_TAB_CONTENT = 'RENDER_TAB_CONTENT';

const propTypes = {
  dashboardId: PropTypes.number.isRequired,
  id: PropTypes.string.isRequired,
  parentId: PropTypes.string.isRequired,
  component: componentShape.isRequired,
  parentComponent: componentShape.isRequired,
  index: PropTypes.number.isRequired,
  depth: PropTypes.number.isRequired,
  renderType: PropTypes.oneOf([RENDER_TAB, RENDER_TAB_CONTENT]).isRequired,
  onDropOnTab: PropTypes.func,
  onHoverTab: PropTypes.func,
  editMode: PropTypes.bool.isRequired,
  canEdit: PropTypes.bool.isRequired,

  // grid related
  availableColumnCount: PropTypes.number,
  columnWidth: PropTypes.number,
  onResizeStart: PropTypes.func,
  onResize: PropTypes.func,
  onResizeStop: PropTypes.func,

  // redux
  handleComponentDrop: PropTypes.func.isRequired,
  updateComponents: PropTypes.func.isRequired,
  setDirectPathToChild: PropTypes.func.isRequired,
  setEditMode: PropTypes.func.isRequired,
};

const defaultProps = {
  availableColumnCount: 0,
  columnWidth: 0,
  onDropOnTab() {},
  onHoverTab() {},
  onResizeStart() {},
  onResize() {},
  onResizeStop() {},
};

const TabTitleContainer = styled.div`
  ${({ isHighlighted, theme: { gridUnit, colors } }) => `
    padding: ${gridUnit}px ${gridUnit * 2}px;
    margin: ${-gridUnit}px ${gridUnit * -2}px;
    transition: box-shadow 0.2s ease-in-out;
    ${
      isHighlighted && `box-shadow: 0 0 ${gridUnit}px ${colors.primary.light1};`
    }
  `}
`;

const renderDraggableContentBottom = dropProps =>
  dropProps.dropIndicatorProps && (
    <div className="drop-indicator drop-indicator--bottom" />
  );

const renderDraggableContentTop = dropProps =>
  dropProps.dropIndicatorProps && (
    <div className="drop-indicator drop-indicator--top" />
  );

class Tab extends React.PureComponent {
  constructor(props) {
    super(props);
    this.handleChangeText = this.handleChangeText.bind(this);
    this.handleChangeTextRU = this.handleChangeTextRU.bind(this);
    this.handleDrop = this.handleDrop.bind(this);
    this.handleOnHover = this.handleOnHover.bind(this);
    this.handleTopDropTargetDrop = this.handleTopDropTargetDrop.bind(this);
    this.handleChangeTab = this.handleChangeTab.bind(this);
  }

  handleChangeTab({ pathToTabIndex }) {
    this.props.setDirectPathToChild(pathToTabIndex);
  }

  handleChangeText(nextTabText) {
    const { updateComponents, component } = this.props;
    if (nextTabText && nextTabText !== component.meta.text) {
      updateComponents({
        [component.id]: {
          ...component,
          meta: {
            ...component.meta,
            text: nextTabText,
          },
        },
      });
    }
  }

  // DODO added
  handleChangeTextRU(nextTabText) {
    const { updateComponents, component } = this.props;
    if (nextTabText && nextTabText !== component.meta.textRU) {
      updateComponents({
        [component.id]: {
          ...component,
          meta: {
            ...component.meta,
            textRU: nextTabText,
          },
        },
      });
    }
  }

  handleDrop(dropResult) {
    this.props.handleComponentDrop(dropResult);
    this.props.onDropOnTab(dropResult);
  }

  handleOnHover() {
    this.props.onHoverTab();
  }

  handleTopDropTargetDrop(dropResult) {
    if (dropResult) {
      this.props.handleComponentDrop({
        ...dropResult,
        destination: {
          ...dropResult.destination,
          // force appending as the first child if top drop target
          index: 0,
        },
      });
    }
  }

  renderTabContent() {
    const {
      component: tabComponent,
      parentComponent: tabParentComponent,
      depth,
      availableColumnCount,
      columnWidth,
      onResizeStart,
      onResize,
      onResizeStop,
      editMode,
      isComponentVisible,
      canEdit,
      setEditMode,
      dashboardId,
    } = this.props;

    const shouldDisplayEmptyState = tabComponent.children.length === 0;
    return (
      <div className="dashboard-component-tabs-content">
        {/* Make top of tab droppable */}
        {editMode && (
          <DragDroppable
            component={tabComponent}
            parentComponent={tabParentComponent}
            orientation="column"
            index={0}
            depth={depth}
            onDrop={this.handleTopDropTargetDrop}
            editMode
            className="empty-droptarget"
          >
            {renderDraggableContentTop}
          </DragDroppable>
        )}
        {shouldDisplayEmptyState && (
          <EmptyStateMedium
            title={
              editMode
                ? t('Drag and drop components to this tab')
                : t('There are no components added to this tab')
            }
            description={
              canEdit &&
              (editMode ? (
                <span>
                  {t('You can')}{' '}
                  <a
                    href={`/chart/add?dashboard_id=${dashboardId}`}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {t('create a new chart')}
                  </a>{' '}
                  {t('or use existing ones from the panel on the right')}
                </span>
              ) : (
                <span>
                  {t('You can add the components in the')}{' '}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={() => setEditMode(true)}
                  >
                    {t('edit mode')}
                  </span>
                </span>
              ))
            }
            image="chart.svg"
          />
        )}
        {tabComponent.children.map((componentId, componentIndex) => (
          <DashboardComponent
            key={componentId}
            id={componentId}
            parentId={tabComponent.id}
            depth={depth} // see isValidChild.js for why tabs don't increment child depth
            index={componentIndex}
            onDrop={this.handleDrop}
            onHover={this.handleOnHover}
            availableColumnCount={availableColumnCount}
            columnWidth={columnWidth}
            onResizeStart={onResizeStart}
            onResize={onResize}
            onResizeStop={onResizeStop}
            isComponentVisible={isComponentVisible}
            onChangeTab={this.handleChangeTab}
          />
        ))}
        {/* Make bottom of tab droppable */}
        {editMode && (
          <DragDroppable
            component={tabComponent}
            parentComponent={tabParentComponent}
            orientation="column"
            index={tabComponent.children.length}
            depth={depth}
            onDrop={this.handleDrop}
            onHover={this.handleOnHover}
            editMode
            className="empty-droptarget"
          >
            {renderDraggableContentBottom}
          </DragDroppable>
        )}
      </div>
    );
  }

  renderTab() {
    const {
      component,
      parentComponent,
      index,
      depth,
      editMode,
      isFocused,
      isHighlighted,
      // DODO added
      userLanguage,
    } = this.props;

    return (
      <DragDroppable
        component={component}
        parentComponent={parentComponent}
        orientation="column"
        index={index}
        depth={depth}
        onDrop={this.handleDrop}
        onHover={this.handleOnHover}
        editMode={editMode}
      >
        {({ dropIndicatorProps, dragSourceRef }) => (
          <TabTitleContainer
            isHighlighted={isHighlighted}
            className="dragdroppable-tab"
            ref={dragSourceRef}
          >
            {editMode && (
              <LanguageIndicatorWrapper>
                {/* DODO changed */}
                <LanguageIndicator language="gb" canEdit />
                <EditableTitle
                  title={component.meta.text}
                  defaultTitle={component.meta.defaultText}
                  placeholder={component.meta.placeholder}
                  canEdit={editMode && isFocused}
                  onSaveTitle={this.handleChangeText}
                  showTooltip={false}
                  editing={editMode && isFocused}
                />
              </LanguageIndicatorWrapper>
            )}
            {/* DODO added */}
            {editMode && (
              <LanguageIndicatorWrapper>
                <LanguageIndicator language="ru" canEdit />
                <EditableTitle
                  title={component.meta.textRU}
                  defaultTitle={component.meta.defaultText}
                  placeholder={component.meta.placeholder}
                  canEdit={editMode && isFocused}
                  onSaveTitle={this.handleChangeTextRU}
                  showTooltip={false}
                  editing={editMode && isFocused}
                />
              </LanguageIndicatorWrapper>
            )}
            {!editMode && (
              <EditableTitle
              // DODO changed
                title={
                  userLanguage === 'ru'
                    ? component.meta.textRU || component.meta.text
                    : component.meta.text
                }
                defaultTitle={component.meta.defaultText}
                placeholder={component.meta.placeholder}
                canEdit={editMode && isFocused}
                onSaveTitle={this.handleChangeText}
                showTooltip={false}
                editing={editMode && isFocused}
              />
            )}
            {!editMode && (
              <AnchorLink
                id={component.id}
                dashboardId={this.props.dashboardId}
                placement={index >= 5 ? 'left' : 'right'}
              />
            )}

            {dropIndicatorProps && <div {...dropIndicatorProps} />}
          </TabTitleContainer>
        )}
      </DragDroppable>
    );
  }

  render() {
    const { renderType } = this.props;
    return renderType === RENDER_TAB
      ? this.renderTab()
      : this.renderTabContent();
  }
}

Tab.propTypes = propTypes;
Tab.defaultProps = defaultProps;

function mapStateToProps(state) {
  return {
    canEdit: state.dashboardInfo.dash_edit_perm,
  };
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators(
    {
      setEditMode,
    },
    dispatch,
  );
}

export default connect(mapStateToProps, mapDispatchToProps)(Tab);
