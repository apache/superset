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
import React from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';
import { ListGroup, ListGroupItem, Panel } from 'react-bootstrap';
import { BootstrapTable } from 'react-bootstrap-table-next';
import 'react-bootstrap-table-next/dist/react-bootstrap-table2.min.css';
import moment from 'moment';
import { unsafe } from 'reactable-arc';
import 'whatwg-fetch';

import DeleteComponentButton from '../DeleteComponentButton';
import DragDroppable from '../dnd/DragDroppable';
import HoverMenu from '../menu/HoverMenu';
import IconButton from '../IconButton';
import ResizableContainer from '../resizable/ResizableContainer';
import SelectControl from '../../../explore/components/controls/SelectControl';
import WithPopoverMenu from '../menu/WithPopoverMenu';
import { componentShape } from '../../util/propShapes';
import { fetchObjects, fetchSuggestions } from '../../../tags';
import { ROW_TYPE, COLUMN_TYPE } from '../../util/componentTypes';
import {
  GRID_MIN_COLUMN_COUNT,
  GRID_MIN_ROW_UNITS,
  GRID_BASE_UNIT,
  STANDARD_TAGS,
  TAGGED_CONTENT_TYPES,
} from '../../util/constants';

const HEADER_HEIGHT = 48;

const propTypes = {
  id: PropTypes.string.isRequired,
  parentId: PropTypes.string.isRequired,
  component: componentShape.isRequired,
  parentComponent: componentShape.isRequired,
  index: PropTypes.number.isRequired,
  depth: PropTypes.number.isRequired,
  editMode: PropTypes.bool.isRequired,

  // grid related
  availableColumnCount: PropTypes.number.isRequired,
  columnWidth: PropTypes.number.isRequired,
  onResizeStart: PropTypes.func.isRequired,
  onResize: PropTypes.func.isRequired,
  onResizeStop: PropTypes.func.isRequired,

  // dnd
  deleteComponent: PropTypes.func.isRequired,
  handleComponentDrop: PropTypes.func.isRequired,
  updateComponents: PropTypes.func.isRequired,
};

const defaultProps = {};

function linkFormatter(cell, row) {
  const url = `${cell}`;
  return (
    <a href={url} rel="noopener noreferrer" target="_blank">
      {row.name}
    </a>
  );
}

function changedOnFormatter(cell) {
  const date = new Date(cell);
  return unsafe(moment.utc(date).fromNow());
}

class Tags extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      isFocused: false,
      isConfiguring: false,
      data: [],
      tagSuggestions: STANDARD_TAGS,
    };

    this.handleChangeFocus = this.handleChangeFocus.bind(this);
    this.handleDeleteComponent = this.handleDeleteComponent.bind(this);
    this.toggleConfiguring = this.toggleConfiguring.bind(this);
    this.handleUpdateMeta = this.handleUpdateMeta.bind(this);
    this.handleChangeTags = this.handleUpdateMeta.bind(this, 'tags');
    this.handleChangeTypes = this.handleUpdateMeta.bind(this, 'types');

    this.fetchResults = this.fetchResults.bind(this);
    this.fetchTagSuggestions = this.fetchTagSuggestions.bind(this);
  }

  componentDidMount() {
    this.fetchResults(this.props.component);
    this.fetchTagSuggestions();
  }

  handleChangeFocus(nextFocus) {
    this.setState(() => ({ isFocused: nextFocus }));
  }

  handleUpdateMeta(metaKey, nextValue) {
    const { updateComponents, component } = this.props;
    if (nextValue && component.meta[metaKey] !== nextValue) {
      const nextComponent = {
        ...component,
        meta: {
          ...component.meta,
          [metaKey]: nextValue,
        },
      };
      updateComponents({ [component.id]: nextComponent });
      this.fetchResults(nextComponent);
    }
  }

  fetchResults(component) {
    const tags = component.meta.tags || [];
    const types = component.meta.types || TAGGED_CONTENT_TYPES;
    fetchObjects({ tags: tags.join(','), types: types.join(',') }, data =>
      this.setState({ data }),
    );
  }

  fetchTagSuggestions() {
    fetchSuggestions({ includeTypes: false }, suggestions => {
      const tagSuggestions = STANDARD_TAGS.concat(
        suggestions.map(tag => tag.name),
      );
      this.setState({ tagSuggestions });
    });
  }

  handleDeleteComponent() {
    const { deleteComponent, id, parentId } = this.props;
    deleteComponent(id, parentId);
  }

  toggleConfiguring() {
    this.setState({ isConfiguring: !this.state.isConfiguring });
  }

  renderEditMode() {
    const { component } = this.props;
    return (
      <Panel style={{ height: '100%' }}>
        <ListGroup>
          <ListGroupItem>
            <SelectControl
              label={'Types'}
              name={'types'}
              value={component.meta.types}
              multi
              onChange={this.handleChangeTypes}
              choices={[
                ['dashboard', 'Dashboard'],
                ['chart', 'Chart'],
                ['query', 'Query'],
              ]}
            />
          </ListGroupItem>
          <ListGroupItem>
            <SelectControl
              label={'Tags'}
              name={'tags'}
              value={component.meta.tags}
              multi
              freeForm
              onChange={this.handleChangeTags}
              choices={this.state.tagSuggestions}
            />
          </ListGroupItem>
        </ListGroup>
      </Panel>
    );
  }

  renderPreviewMode() {
    const component = this.props.component;
    const height = component.meta.height * GRID_BASE_UNIT - HEADER_HEIGHT;
    const columns = [
      { dataField: 'id', text: 'ID', hidden: true },
      {
        dataField: 'url',
        text: 'Name',
        dataFormat: linkFormatter,
        width: '50%',
      },
      { dataField: 'type', text: 'Type' },
      { dataField: 'creator', dataFormat: unsafe, dataSort: true },
      {
        dataField: 'changed_on',
        dataFormat: changedOnFormatter,
        dataSort: true,
      },
    ];
    return (
      <BootstrapTable
        data={this.state.data}
        columns={columns}
        height={height}
        bordered={false}
        scrollTop={'Top'}
        tableHeaderClass="tag-header-class"
        tableBodyClass="tag-body-class"
        containerClass="tag-container-class"
        tableContainerClass="tag-table-container-class"
        headerContainerClass="tag-header-container-class"
        bodyContainerClass="tag-body-container-class"
      />
    );
  }

  render() {
    const { isFocused, isConfiguring } = this.state;

    const {
      component,
      parentComponent,
      index,
      depth,
      availableColumnCount,
      columnWidth,
      onResizeStart,
      onResize,
      onResizeStop,
      handleComponentDrop,
      editMode,
    } = this.props;

    // inherit the size of parent columns
    const widthMultiple =
      parentComponent.type === COLUMN_TYPE
        ? parentComponent.meta.width || GRID_MIN_COLUMN_COUNT
        : component.meta.width || GRID_MIN_COLUMN_COUNT;

    const buttonClass = isConfiguring ? 'fa fa-table' : 'fa fa-cog';

    return (
      <DragDroppable
        component={component}
        parentComponent={parentComponent}
        orientation={parentComponent.type === ROW_TYPE ? 'column' : 'row'}
        index={index}
        depth={depth}
        onDrop={handleComponentDrop}
        disableDragDrop={isFocused}
        editMode={editMode}
      >
        {({ dropIndicatorProps, dragSourceRef }) => (
          <WithPopoverMenu
            onChangeFocus={this.handleChangeFocus}
            editMode={editMode}
          >
            <div className={cx('dashboard-tags')}>
              <ResizableContainer
                id={component.id}
                adjustableWidth={parentComponent.type === ROW_TYPE}
                adjustableHeight
                widthStep={columnWidth}
                widthMultiple={widthMultiple}
                heightStep={GRID_BASE_UNIT}
                heightMultiple={component.meta.height}
                minWidthMultiple={GRID_MIN_COLUMN_COUNT}
                minHeightMultiple={GRID_MIN_ROW_UNITS}
                maxWidthMultiple={availableColumnCount + widthMultiple}
                onResizeStart={onResizeStart}
                onResize={onResize}
                onResizeStop={onResizeStop}
                // disable resize when editing because if state is not synced
                // with props it will reset the editor text to whatever props is
                editMode={isFocused ? false : editMode}
              >
                <div
                  ref={dragSourceRef}
                  className="dashboard-component dashboard-component-chart-holder"
                >
                  {isConfiguring
                    ? this.renderEditMode()
                    : this.renderPreviewMode()}
                  {editMode && (
                    <HoverMenu position="top">
                      <IconButton
                        className={buttonClass}
                        onClick={this.toggleConfiguring}
                      />
                      <DeleteComponentButton
                        onDelete={this.handleDeleteComponent}
                      />
                    </HoverMenu>
                  )}
                </div>
              </ResizableContainer>
            </div>
            {dropIndicatorProps && <div {...dropIndicatorProps} />}
          </WithPopoverMenu>
        )}
      </DragDroppable>
    );
  }
}

Tags.propTypes = propTypes;
Tags.defaultProps = defaultProps;

export default Tags;
