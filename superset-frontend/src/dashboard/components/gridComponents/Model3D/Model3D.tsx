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
import { PureComponent, ReactNode } from 'react';
import PropTypes from 'prop-types';
import { css, styled } from '@apache-superset/core/ui';
import { t } from '@superset-ui/core';
import { Input } from '@superset-ui/core/components';
// Import model-viewer as a module (bundled, avoids CSP issues)
import '@google/model-viewer';

import { Draggable } from 'src/dashboard/components/dnd/DragDroppable';
import HoverMenu from 'src/dashboard/components/menu/HoverMenu';
import DeleteComponentButton from 'src/dashboard/components/DeleteComponentButton';
import ResizableContainer from 'src/dashboard/components/resizable/ResizableContainer';
import { componentShape } from 'src/dashboard/util/propShapes';
import { ROW_TYPE, COLUMN_TYPE } from 'src/dashboard/util/componentTypes';
import {
  GRID_MIN_COLUMN_COUNT,
  GRID_MIN_ROW_UNITS,
  GRID_BASE_UNIT,
} from 'src/dashboard/util/constants';
import type { LayoutItem } from 'src/dashboard/types';
import type { ResizeCallback, ResizeStartCallback } from 're-resizable';

interface Model3DProps {
  id: string;
  parentId: string;
  component: LayoutItem;
  parentComponent: LayoutItem;
  index: number;
  depth: number;
  editMode: boolean;
  availableColumnCount: number;
  columnWidth: number;
  onResizeStart: ResizeStartCallback;
  onResize: ResizeCallback;
  onResizeStop: ResizeCallback;
  deleteComponent: (id: string, parentId: string) => void;
  handleComponentDrop: (dropResult: any) => void;
  updateComponents: (components: Record<string, Partial<LayoutItem>>) => void;
}

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

const Model3DContainer = styled.div`
  ${({ theme }) => css`
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    background-color: ${theme.colorBgContainer};
    min-height: ${GRID_BASE_UNIT * GRID_MIN_ROW_UNITS}px;

    .dashboard-component-chart-holder {
      flex: 1;
      overflow: hidden;
      border-radius: ${theme.borderRadius}px;
      position: relative;
      min-height: ${GRID_BASE_UNIT * GRID_MIN_ROW_UNITS}px;
      display: flex;
      flex-direction: column;
    }

    .model3d-input-container {
      padding: ${theme.sizeUnit * 2}px;
      background-color: ${theme.colorBgContainer};
      border-bottom: 1px solid ${theme.colorBorder};
    }

    .model3d-viewer {
      width: 100%;
      height: 100%;
      flex: 1;
      min-height: ${GRID_BASE_UNIT * GRID_MIN_ROW_UNITS}px;
      background-color: ${theme.colorFillQuaternary};
      
      /* Ensure model-viewer renders properly */
      display: block;
      
      /* Add some visual depth */
      box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.1);
      
      /* Ensure canvas renders properly */
      &::part(default-ar-button) {
        display: none;
      }
      
      /* Fix for texture rendering */
      canvas {
        display: block;
        width: 100% !important;
        height: 100% !important;
      }
    }

    .model3d-placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 1;
      min-height: ${GRID_BASE_UNIT * GRID_MIN_ROW_UNITS}px;
      color: ${theme.colorTextSecondary};
      background-color: ${theme.colorFillQuaternary};
      border-radius: ${theme.borderRadius}px;
      border: 2px dashed ${theme.colorBorder};
      padding: ${theme.sizeUnit * 4}px;
      text-align: center;
    }
  `}
`;

// Declare model-viewer web component type
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': {
        src?: string;
        alt?: string;
        'auto-rotate'?: boolean;
        'camera-controls'?: boolean;
        loading?: string;
        reveal?: string;
        exposure?: string;
        'shadow-intensity'?: string;
        'environment-image'?: string;
        'skybox-image'?: string;
        'tone-mapping'?: string;
        'interaction-policy'?: string;
        'min-camera-orbit'?: string;
        'max-camera-orbit'?: string;
        ar?: boolean;
        'ar-modes'?: string;
        style?: React.CSSProperties;
        className?: string;
        onError?: (e: Event) => void;
        onLoad?: (e: any) => void;
        children?: ReactNode;
      };
    }
  }
}

class Model3D extends PureComponent<Model3DProps> {
  state = {
    scriptLoaded: true, // Set to true by default since we import the module directly
    modelError: false,
  };

  private loadTimeout: NodeJS.Timeout | null = null;

  componentDidMount() {
    // Log registry status for debugging
    setTimeout(() => {
      if (customElements.get('model-viewer')) {
        console.log('Model3D: model-viewer custom element found in registry');
      } else {
        console.warn('Model3D: model-viewer not in registry - module may not have loaded');
      }
    }, 100);
  }

  componentWillUnmount() {
    if (this.loadTimeout) {
      clearTimeout(this.loadTimeout);
      this.loadTimeout = null;
    }
  }

  handleModelUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { updateComponents, component } = this.props;
    // Clear error state when URL changes
    this.setState({ modelError: false });
    updateComponents({
      [component.id]: {
        ...component,
        meta: {
          ...component.meta,
          modelUrl: e.target.value,
        },
      },
    });
  };

  handleDeleteComponent = () => {
    const { deleteComponent, id, parentId } = this.props;
    deleteComponent(id, parentId);
  };

  renderModelViewer(): ReactNode {
    const { component } = this.props;
    const { modelError } = this.state;
    const modelUrl = component.meta?.modelUrl || '';

    if (!modelUrl) {
      return (
        <div className="model3d-placeholder">
          {t('Enter a 3D model URL (GLTF, GLB, OBJ, etc.)')}
        </div>
      );
    }

    if (modelError) {
      return (
        <div className="model3d-placeholder">
          {t('Failed to load 3D model. Please check the URL and try again.')}
        </div>
      );
    }

    // Skip scriptLoaded check - we import the module directly, so it should be available
    // The model-viewer element will handle its own loading state

    return (
      <model-viewer
        src={modelUrl}
        alt="3D Model"
        auto-rotate
        camera-controls
        loading="auto"
        reveal="auto"
        exposure="0.8"
        shadow-intensity="1"
        environment-image="neutral"
        skybox-image=""
        tone-mapping="auto"
        min-camera-orbit="auto auto auto"
        max-camera-orbit="auto auto auto"
        interaction-policy="allow-when-focused"
        ar
        ar-modes="webxr scene-viewer quick-look"
        className="model3d-viewer"
        style={{ 
          width: '100%', 
          height: '100%', 
          backgroundColor: '#e8e8e8',
          minHeight: '400px'
        }}
        onError={(e: any) => {
          console.error('Model viewer error:', e);
          this.setState({ modelError: true });
        }}
        onLoad={(e: any) => {
          console.log('Model loaded successfully');
          const modelViewer = e.target;
          if (modelViewer && modelViewer.model) {
            // Use requestAnimationFrame for better performance instead of setTimeout
            requestAnimationFrame(() => {
              // Check if model has materials and textures
              modelViewer.model.traverse((node: any) => {
                if (node.isMesh && node.material) {
                  // Ensure material is visible
                  if (node.material.transparent) {
                    node.material.transparent = false;
                  }
                  node.material.needsUpdate = true;
                }
              });
            });
          }
        }}
      >
        {/* Add a default material if the model doesn't have one */}
        <div slot="poster" style={{ 
          width: '100%', 
          height: '100%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          backgroundColor: '#e8e8e8',
          color: '#666'
        }}>
          {t('Loading 3D model...')}
        </div>
      </model-viewer>
    );
  }

  render() {
    const {
      component,
      parentComponent,
      index,
      depth,
      availableColumnCount,
      columnWidth,
      onResize,
      onResizeStop,
      handleComponentDrop,
      editMode,
      onResizeStart,
    } = this.props;

    // inherit the size of parent columns
    const widthMultiple =
      parentComponent.type === COLUMN_TYPE
        ? parentComponent.meta.width || GRID_MIN_COLUMN_COUNT
        : component.meta.width || GRID_MIN_COLUMN_COUNT;

    const modelUrl = component.meta?.modelUrl || '';

    return (
      <Draggable
        component={component}
        parentComponent={parentComponent}
        orientation={parentComponent.type === ROW_TYPE ? 'column' : 'row'}
        index={index}
        depth={depth}
        onDrop={handleComponentDrop}
        editMode={editMode}
      >
        {({ dragSourceRef }) => (
          <Model3DContainer
            className="dashboard-component dashboard-component-model3d"
            data-test="dashboard-component-model3d"
          >
            <ResizableContainer
              id={component.id}
              adjustableWidth={parentComponent.type === ROW_TYPE}
              adjustableHeight
              widthStep={columnWidth}
              widthMultiple={widthMultiple}
              heightStep={GRID_BASE_UNIT}
              heightMultiple={component.meta.height || GRID_MIN_ROW_UNITS}
              minWidthMultiple={GRID_MIN_COLUMN_COUNT}
              minHeightMultiple={GRID_MIN_ROW_UNITS}
              maxWidthMultiple={availableColumnCount + widthMultiple}
              onResizeStart={onResizeStart}
              onResize={onResize}
              onResizeStop={onResizeStop}
              editMode={editMode}
            >
              <div
                ref={dragSourceRef}
                className="dashboard-component-chart-holder"
                data-test="dashboard-component-chart-holder"
              >
                {editMode && (
                  <HoverMenu position="top">
                    <DeleteComponentButton
                      onDelete={this.handleDeleteComponent}
                    />
                  </HoverMenu>
                )}
                {editMode && (
                  <div className="model3d-input-container">
                    <Input
                      type="url"
                      placeholder={t('Enter 3D model URL (GLTF, GLB, OBJ, etc.)')}
                      value={modelUrl}
                      onChange={this.handleModelUrlChange}
                      data-test="model3d-url-input"
                    />
                  </div>
                )}
                {this.renderModelViewer()}
              </div>
            </ResizableContainer>
          </Model3DContainer>
        )}
      </Draggable>
    );
  }
}

Model3D.propTypes = propTypes;
Model3D.defaultProps = defaultProps;

export default Model3D;

