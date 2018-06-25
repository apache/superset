import React from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';

import DragDroppable from '../dnd/DragDroppable';
import DragHandle from '../dnd/DragHandle';
import EditableTitle from '../../../components/EditableTitle';
import HoverMenu from '../menu/HoverMenu';
import WithPopoverMenu from '../menu/WithPopoverMenu';
import BackgroundStyleDropdown from '../menu/BackgroundStyleDropdown';
import DeleteComponentButton from '../DeleteComponentButton';
import PopoverDropdown from '../menu/PopoverDropdown';
import headerStyleOptions from '../../util/headerStyleOptions';
import backgroundStyleOptions from '../../util/backgroundStyleOptions';
import { componentShape } from '../../util/propShapes';
import { SMALL_HEADER, BACKGROUND_TRANSPARENT } from '../../util/constants';

const propTypes = {
  id: PropTypes.string.isRequired,
  parentId: PropTypes.string.isRequired,
  component: componentShape.isRequired,
  depth: PropTypes.number.isRequired,
  parentComponent: componentShape.isRequired,
  index: PropTypes.number.isRequired,
  editMode: PropTypes.bool.isRequired,

  // redux
  handleComponentDrop: PropTypes.func.isRequired,
  deleteComponent: PropTypes.func.isRequired,
  updateComponents: PropTypes.func.isRequired,
};

const defaultProps = {};

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
    this.handleChangeBackground = this.handleUpdateMeta.bind(
      this,
      'background',
    );
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
      depth,
      parentComponent,
      index,
      handleComponentDrop,
      editMode,
    } = this.props;

    const headerStyle = headerStyleOptions.find(
      opt => opt.value === (component.meta.headerSize || SMALL_HEADER),
    );

    const rowStyle = backgroundStyleOptions.find(
      opt =>
        opt.value === (component.meta.background || BACKGROUND_TRANSPARENT),
    );

    return (
      <DragDroppable
        component={component}
        parentComponent={parentComponent}
        orientation="row"
        index={index}
        depth={depth}
        onDrop={handleComponentDrop}
        disableDragDrop={isFocused}
        editMode={editMode}
      >
        {({ dropIndicatorProps, dragSourceRef }) => (
          <div ref={dragSourceRef}>
            {editMode &&
            depth <= 2 && ( // drag handle looks bad when nested
                <HoverMenu position="left">
                  <DragHandle position="left" />
                </HoverMenu>
              )}

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
                <BackgroundStyleDropdown
                  id={`${component.id}-background`}
                  value={component.meta.background}
                  onChange={this.handleChangeBackground}
                />,
                <DeleteComponentButton onDelete={this.handleDeleteComponent} />,
              ]}
              editMode={editMode}
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
                  canEdit={editMode}
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
