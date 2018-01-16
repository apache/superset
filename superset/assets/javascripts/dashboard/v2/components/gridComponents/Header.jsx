import React from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';

import DragDroppable from '../dnd/DragDroppable';
import DragHandle from '../dnd/DragHandle';
import EditableTitle from '../../../../components/EditableTitle';
import HoverMenu from '../menu/HoverMenu';
import WithPopoverMenu from '../menu/WithPopoverMenu';
import RowStyleDropdown from '../menu/RowStyleDropdown';
import DeleteComponentButton from '../DeleteComponentButton';
import PopoverDropdown from '../menu/PopoverDropdown';
import headerStyleOptions from '../../util/headerStyleOptions';
import rowStyleOptions from '../../util/rowStyleOptions';
import { componentShape } from '../../util/propShapes';
import { SMALL_HEADER, ROW_TRANSPARENT } from '../../util/constants';

const propTypes = {
  id: PropTypes.string.isRequired,
  parentId: PropTypes.string.isRequired,
  component: componentShape.isRequired,
  parentComponent: componentShape.isRequired,
  index: PropTypes.number.isRequired,

  // redux
  handleComponentDrop: PropTypes.func.isRequired,
  deleteComponent: PropTypes.func.isRequired,
  updateComponents: PropTypes.func.isRequired,
};

const defaultProps = {
};

class Header extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      isFocused: false,
    };
    this.handleDeleteComponent = this.handleDeleteComponent.bind(this);
    this.handleChangeFocus = this.handleChangeFocus.bind(this);
    this.handleUpdateMeta = this.handleUpdateMeta.bind(this);
    this.handleChangeSize = this.handleUpdateMeta.bind(this, 'headerSize');
    this.handleChangeRowStyle = this.handleUpdateMeta.bind(this, 'rowStyle');
    this.handleChangeText = this.handleUpdateMeta.bind(this, 'text');
  }

  handleChangeFocus(nextFocus) {
    this.setState(() => ({ isFocused: nextFocus }));
  }

  handleUpdateMeta(metaKey, nextValue) {
    const { updateComponents, component } = this.props;
    if (nextValue && component.meta[metaKey] !== nextValue) {
      updateComponents({
        [component.id]: {
          ...component,
          meta: {
            ...component.meta,
            [metaKey]: nextValue,
          },
        },
      });
    }
  }

  handleDeleteComponent() {
    const { deleteComponent, id, parentId } = this.props;
    deleteComponent(id, parentId);
  }

  render() {
    const { isFocused } = this.state;

    const {
      component,
      parentComponent,
      index,
      handleComponentDrop,
    } = this.props;

    const headerStyle = headerStyleOptions.find(
      opt => opt.value === (component.meta.headerSize || SMALL_HEADER),
    );

    const rowStyle = rowStyleOptions.find(
      opt => opt.value === (component.meta.rowStyle || ROW_TRANSPARENT),
    );

    return (
      <DragDroppable
        component={component}
        parentComponent={parentComponent}
        orientation="row"
        index={index}
        onDrop={handleComponentDrop}
        disableDragDrop={isFocused}
      >
        {({ dropIndicatorProps, dragSourceRef }) => (
          <div ref={dragSourceRef}>
            <HoverMenu position="left">
              <DragHandle position="left" />
            </HoverMenu>

            <WithPopoverMenu
              onChangeFocus={this.handleChangeFocus}
              menuItems={[
                <PopoverDropdown
                  id={`${component.id}-header-style`}
                  options={headerStyleOptions}
                  value={component.meta.headerSize}
                  onChange={this.handleChangeSize}
                  renderTitle={option => `${option.label} header`}
                />,
                <RowStyleDropdown
                  id={`${component.id}-row-style`}
                  value={component.meta.rowStyle}
                  onChange={this.handleChangeRowStyle}
                />,
                <DeleteComponentButton onDelete={this.handleDeleteComponent} />,
              ]}
            >
              <div
                className={cx(
                  'dashboard-component',
                  'dashboard-component-header',
                  headerStyle.className,
                  rowStyle.className,
                )}
              >
                <EditableTitle
                  title={component.meta.text}
                  canEdit={isFocused}
                  onSaveTitle={this.handleChangeText}
                  showTooltip={false}
                />
              </div>
            </WithPopoverMenu>

            {dropIndicatorProps && <div {...dropIndicatorProps} />}
          </div>
        )}
      </DragDroppable>
    );
  }
}

Header.propTypes = propTypes;
Header.defaultProps = defaultProps;

export default Header;
