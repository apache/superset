import React from 'react';
import PropTypes from 'prop-types';

import DashboardComponent from '../../containers/DashboardComponent';
import DragDroppable from '../dnd/DragDroppable';
import EditableTitle from '../../../../components/EditableTitle';
import DeleteComponentButton from '../DeleteComponentButton';
import WithPopoverMenu from '../menu/WithPopoverMenu';
import { componentShape } from '../../util/propShapes';

export const RENDER_TAB = 'RENDER_TAB';
export const RENDER_TAB_CONTENT = 'RENDER_TAB_CONTENT';

const propTypes = {
  id: PropTypes.string.isRequired,
  parentId: PropTypes.string.isRequired,
  component: componentShape.isRequired,
  parentComponent: componentShape.isRequired,
  index: PropTypes.number.isRequired,
  depth: PropTypes.number.isRequired,
  renderType: PropTypes.oneOf([RENDER_TAB, RENDER_TAB_CONTENT]).isRequired,
  onDropOnTab: PropTypes.func,
  onDeleteTab: PropTypes.func,

  // grid related
  availableColumnCount: PropTypes.number,
  columnWidth: PropTypes.number,
  onResizeStart: PropTypes.func,
  onResize: PropTypes.func,
  onResizeStop: PropTypes.func,

  // redux
  handleComponentDrop: PropTypes.func.isRequired,
  deleteComponent: PropTypes.func.isRequired,
  updateComponents: PropTypes.func.isRequired,
};

const defaultProps = {
  availableColumnCount: 0,
  columnWidth: 0,
  onDropOnTab() {},
  onDeleteTab() {},
  onResizeStart() {},
  onResize() {},
  onResizeStop() {},
};

export default class Tab extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      isFocused: false,
    };
    this.handleChangeFocus = this.handleChangeFocus.bind(this);
    this.handleChangeText = this.handleChangeText.bind(this);
    this.handleDeleteComponent = this.handleDeleteComponent.bind(this);
    this.handleDrop = this.handleDrop.bind(this);
  }

  handleChangeFocus(nextFocus) {
    this.setState(() => ({ isFocused: nextFocus }));
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

  handleDeleteComponent() {
    const { onDeleteTab, index, deleteComponent, id, parentId } = this.props;
    deleteComponent(id, parentId);
    onDeleteTab(index);
  }

  handleDrop(dropResult) {
    this.props.handleComponentDrop(dropResult);
    this.props.onDropOnTab(dropResult);
  }

  renderTabContent() {
    const {
      component: tabComponent,
      depth,
      availableColumnCount,
      columnWidth,
      onResizeStart,
      onResize,
      onResizeStop,
    } = this.props;

    return (
      <div className="dashboard-component-tabs-content">
        {tabComponent.children.map((componentId, componentIndex) => (
          <DashboardComponent
            key={componentId}
            id={componentId}
            parentId={tabComponent.id}
            depth={depth} // see isValidChild.js for why tabs don't increment child depth
            index={componentIndex}
            onDrop={this.handleDrop}
            availableColumnCount={availableColumnCount}
            columnWidth={columnWidth}
            onResizeStart={onResizeStart}
            onResize={onResize}
            onResizeStop={onResizeStop}
          />
        ))}
      </div>
    );
  }

  renderTab() {
    const { isFocused } = this.state;
    const {
      component,
      parentComponent,
      index,
      depth,
    } = this.props;

    return (
      <DragDroppable
        component={component}
        parentComponent={parentComponent}
        orientation="column"
        index={index}
        depth={depth}
        onDrop={this.handleDrop}
        disableDragDrop={isFocused}
      >
        {({ dropIndicatorProps, dragSourceRef }) => (
          <div className="dragdroppable-tab" ref={dragSourceRef}>
            <WithPopoverMenu
              onChangeFocus={this.handleChangeFocus}
              menuItems={parentComponent.children.length <= 1 ? [] : [
                <DeleteComponentButton onDelete={this.handleDeleteComponent} />,
              ]}
            >
              <EditableTitle
                title={component.meta.text}
                canEdit={isFocused}
                onSaveTitle={this.handleChangeText}
                showTooltip={false}
              />
            </WithPopoverMenu>

            {dropIndicatorProps && <div {...dropIndicatorProps} />}
          </div>
        )}
      </DragDroppable>
    );
  }

  render() {
    const { renderType } = this.props;
    return renderType === RENDER_TAB ? this.renderTab() : this.renderTabContent();
  }
}

Tab.propTypes = propTypes;
Tab.defaultProps = defaultProps;
