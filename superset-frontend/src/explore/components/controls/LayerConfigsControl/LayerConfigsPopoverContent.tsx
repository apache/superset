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
import { css, JsonValue, styled, t, useTheme } from '@superset-ui/core';
import { Button, Form, Tabs, Upload } from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { mix } from 'polished';
import { VectorData } from 'geostyler-data';
import { Style as GsStyle } from 'geostyler-style';
import {
  GeoStylerContext,
  GeoStylerContextInterface,
  GeoStylerLocale,
} from 'geostyler';
import WfsDataParser, {
  RequestParams1_1_0,
  RequestParams2_0_0,
} from 'geostyler-wfs-parser';
import { FC, useEffect, useMemo, useState } from 'react';
import SldStyleParser from 'geostyler-sld-parser';
import {
  isDataLayerConf,
  isWfsLayerConf,
  isWmsLayerConf,
  isXyzLayerConf,
} from './typeguards';
import {
  BaseLayerConf,
  DataLayerConf,
  LayerConf,
  LayerConfigsPopoverContentProps,
  WfsLayerConf,
  WmsLayerConf,
  XyzLayerConf,
} from './types';
import { getServiceVersions, hasAllRequiredWfsParams } from './serviceUtil';
import { ControlFormItem } from '../ColumnConfigControl/ControlForm';
import GeoStylerWrapper from './GeoStylerWrapper';
import {
  colTypesToGeoStylerData,
  createGeoStylerContext,
  getDefaultStyle,
  getGeoStylerLocale,
} from './geoStylerUtil';

// Enum for the different tabs
const LAYER_CONFIG_TABS = {
  LAYER: '1',
  GEOSTYLER: '2',
};

export const StyledButtonContainer = styled.div`
  display: flex;
  margin: 8px;
`;

export const StyledCloseButton = styled(Button)`
  ${({ theme }) => css`
    flex: 1;
    margin-right: 4px;
    line-height: 1.5715;
    border-radius: ${theme.borderRadius}px;
    background-color: ${theme.colors.primary.light4};
    color: ${theme.colors.primary.dark1};
    font-size: ${theme.typography.sizes.s}px;
    font-weight: ${theme.typography.weights.bold};
    text-transform: uppercase;
    min-width: ${theme.gridUnit * 36};
    min-height: ${theme.gridUnit * 8};
    box-shadow: none;
    border-width: 0px;
    border-style: none;
    border-color: transparent;
    &:hover {
      background-color: ${mix(
        0.1,
        theme.colors.primary.base,
        theme.colors.primary.light4,
      )};
      color: ${theme.colors.primary.dark1};
    }
  `}
`;

export const StyledControlFormItem = styled(ControlFormItem)`
  ${({ theme }) => css`
    border-radius: ${theme.borderRadius}px;
  `}
`;

export const StyledControlNumberFormItem = styled(ControlFormItem)`
  ${({ theme }) => css`
    border-radius: ${theme.borderRadius}px;
    width: 100%;
  `}
`;

export const StyledGeoStyler = styled(GeoStylerWrapper)`
  ${({ theme }) => css`
    h2 {
      font-weight: ${theme.typography.weights.normal};
      font-size: ${theme.typography.sizes.xl}px;
    }
    .gs-symbolizer-editor {
      width: 300px;
    }
  `}
`;

export const StyledSaveButton = styled(Button)`
  ${({ theme }) => css`
    flex: 1;
    margin-left: 4px;
    line-height: 1.5715;
    border-radius: ${theme.borderRadius}px;
    background-color: ${theme.colors.primary.base};
    color: ${theme.colors.grayscale.light5};
    font-size: ${theme.typography.sizes.s}px;
    font-weight: ${theme.typography.weights.bold};
    text-transform: uppercase;
    min-width: ${theme.gridUnit * 36};
    min-height: ${theme.gridUnit * 8};
    box-shadow: none;
    border-width: 0px;
    border-style: none;
    border-color: transparent;
    &:hover {
      background-color: ${theme.colors.primary.dark1};
    }
  `}
`;

export const StyledUploadButtonContainer = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
`;

export const StyledFeedbackMessage = styled.div<{ success: boolean }>`
  ${({ success, theme }) => css`
    color: ${success ? theme.colors.success.base : theme.colors.error.base};
    visibility: ${success === null ? 'hidden' : 'visible'};
    min-width: 150px;
    text-align: right;
  `}
`;

export const LayerConfigsPopoverContent: FC<
  LayerConfigsPopoverContentProps
> = ({
  onClose = () => {},
  onSave = () => {},
  layerConf,
  enableDataLayer,
  colTypeMapping,
  dataFeatureCollection,
  includedGeometryTypes,
}) => {
  const theme = useTheme();
  const [currentLayerConf, setCurrentLayerConf] =
    useState<LayerConf>(layerConf);
  const initialWmsVersion =
    layerConf.type === 'WMS' ? layerConf.version : undefined;
  const [wmsVersion, setWmsVersion] = useState<string | undefined>(
    initialWmsVersion,
  );
  const initialWfsVersion =
    layerConf.type === 'WFS' ? layerConf.version : undefined;
  const [wfsVersion, setWfsVersion] = useState<string | undefined>(
    initialWfsVersion,
  );
  const [geostylerData, setGeoStylerData] = useState<VectorData | undefined>(
    undefined,
  );
  const [feedback, setFeedback] = useState<{
    success: boolean | null;
    message: string | null;
  }>({ success: null, message: null });

  const getAppLocale = () => {
    const appContainer = document.getElementById('app');
    const { common } = JSON.parse(
      appContainer?.getAttribute('data-bootstrap') || '{}',
    );
    // There is a locale at common?.locale, but due to a bug
    // in superset, it cannot be serialized.
    return common?.menu_data?.navbar_right?.locale;
  };

  // Locales do not need to be state variables, since in superset
  // a change of the language triggers a reload of the client.
  const appLocale = getAppLocale();
  const geostylerLocale: GeoStylerLocale = useMemo(
    () => getGeoStylerLocale(appLocale),
    [appLocale],
  );

  const serviceVersions = getServiceVersions();

  // This is needed to force mounting the form every time
  // we get a new layerConf prop. Otherwise the input fields
  // will not be updated properly, since ControlFormItem only
  // recognises the `value` property once and then handles the
  // values in its on state. Remounting creates a new component
  // and thereby starts with a fresh state.
  const [formKey, setFormKey] = useState<number>(0);

  useEffect(() => {
    setCurrentLayerConf({ ...layerConf });
    setFormKey(oldFormKey => oldFormKey + 1);
  }, [layerConf]);

  const onFieldValueChange = (value: JsonValue, key: string) => {
    setCurrentLayerConf({
      ...currentLayerConf,
      [key]: value,
    });
  };

  const onLayerTypeChange = (value: LayerConf['type']) => {
    const styleName = t('Default Style');
    const ruleName = t('Default Rule');
    if (value === 'WFS') {
      setCurrentLayerConf({
        ...currentLayerConf,
        type: value,
        version: serviceVersions[value][0],
        style: getDefaultStyle(includedGeometryTypes, styleName, ruleName),
      } as WfsLayerConf);
    } else if (value === 'XYZ') {
      setCurrentLayerConf({
        ...currentLayerConf,
        type: value,
      } as XyzLayerConf);
    } else if (value === 'WMS') {
      setCurrentLayerConf({
        ...currentLayerConf,
        type: value,
        version: serviceVersions[value][0],
      } as WmsLayerConf);
    } else {
      setCurrentLayerConf({
        ...currentLayerConf,
        type: value,
        style: getDefaultStyle(includedGeometryTypes, styleName, ruleName),
      } as DataLayerConf);
    }
  };

  const onLayerTitleChange = (fieldValue: string) => {
    onFieldValueChange(fieldValue, 'title');
  };

  const onLayerUrlChange = (fieldValue: string) => {
    onFieldValueChange(fieldValue, 'url');
  };

  const onLayersParamChange = (fieldValue: string) => {
    onFieldValueChange(fieldValue, 'layersParam');
  };

  const onTypeNameChange = (fieldValue: string) => {
    onFieldValueChange(fieldValue, 'typeName');
  };

  const onWmsVersionChange = (fieldValue: string) => {
    onFieldValueChange(fieldValue, 'version');
    setWmsVersion(fieldValue);
  };

  const onWfsVersionChange = (fieldValue: string) => {
    onFieldValueChange(fieldValue, 'version');
    setWfsVersion(fieldValue);
  };

  const onMaxFeaturesChange = (fieldValue: number) => {
    onFieldValueChange(fieldValue, 'maxFeatures');
  };

  const onStyleChange = (fieldValue: GsStyle) => {
    onFieldValueChange(fieldValue, 'style');
  };

  const onAttributionChange = (fieldValue: string) => {
    onFieldValueChange(fieldValue, 'attribution');
  };

  const onCloseClick = () => {
    onClose();
  };

  const onSaveClick = () => {
    const baseConfs: BaseLayerConf = {
      title: currentLayerConf.title,
      type: currentLayerConf.type,
      attribution: currentLayerConf.attribution,
    };

    let conf: LayerConf;
    if (isWmsLayerConf(currentLayerConf)) {
      conf = {
        ...baseConfs,
        url: currentLayerConf.url,
        version: currentLayerConf.version,
        type: currentLayerConf.type,
        layersParam: currentLayerConf.layersParam,
      };
    } else if (isXyzLayerConf(currentLayerConf)) {
      conf = {
        ...baseConfs,
        type: currentLayerConf.type,
        url: currentLayerConf.url,
      };
    } else if (isWfsLayerConf(currentLayerConf)) {
      conf = {
        ...baseConfs,
        type: currentLayerConf.type,
        url: currentLayerConf.url,
        version: currentLayerConf.version,
        typeName: currentLayerConf.typeName,
        maxFeatures: currentLayerConf.maxFeatures,
        style: currentLayerConf.style,
      };
    } else {
      conf = {
        ...baseConfs,
        type: currentLayerConf.type,
        style: currentLayerConf.style,
      };
    }

    onSave(conf);
  };

  useEffect(() => {
    if (
      isWmsLayerConf(currentLayerConf) ||
      isXyzLayerConf(currentLayerConf) ||
      (isWfsLayerConf(currentLayerConf) &&
        !hasAllRequiredWfsParams(currentLayerConf))
    ) {
      setGeoStylerData(undefined);
      return undefined;
    }
    if (isDataLayerConf(currentLayerConf)) {
      const geostylerData = colTypeMapping
        ? colTypesToGeoStylerData(colTypeMapping, dataFeatureCollection)
        : undefined;

      setGeoStylerData(geostylerData);
      return undefined;
    }

    const readWfsData = async (conf: WfsLayerConf) => {
      const wfsParser = new WfsDataParser();
      try {
        let requestParams: RequestParams1_1_0 | RequestParams2_0_0 = {} as
          | RequestParams1_1_0
          | RequestParams2_0_0;
        if (conf.version.startsWith('1.')) {
          requestParams = {
            version: conf.version as RequestParams1_1_0['version'],
            maxFeatures: conf.maxFeatures,
            typeName: conf.typeName,
          };
        }
        if (conf.version.startsWith('2.')) {
          requestParams = {
            version: conf.version as RequestParams2_0_0['version'],
            count: conf.maxFeatures,
            typeNames: conf.typeName,
          };
        }

        const gsData = await wfsParser.readData({
          url: conf.url,
          requestParams,
        });
        setGeoStylerData(gsData);
      } catch {
        console.warn('Could not read geostyler data');
        setGeoStylerData(undefined);
      }
    };

    // debounce function
    const timer = setTimeout(() => readWfsData(currentLayerConf), 500);

    return () => {
      clearTimeout(timer);
    };
  }, [currentLayerConf, colTypeMapping, dataFeatureCollection]);

  const geoStylerContext: GeoStylerContextInterface = useMemo(
    () =>
      createGeoStylerContext(
        geostylerLocale,
        geostylerData,
        includedGeometryTypes,
      ),
    [geostylerLocale, geostylerData, includedGeometryTypes],
  );

  useEffect(() => {
    if (feedback.success !== null) {
      const timer = setTimeout(
        () => setFeedback({ success: null, message: null }),
        3000,
      );
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [feedback.success]);

  const beforeUpload = (file: File): boolean => {
    const reader = new FileReader();
    reader.onload = async event => {
      const sldContent = event.target?.result as string;
      const sldParser = new SldStyleParser();

      try {
        const geoStylerResponse = await sldParser.readStyle(sldContent);
        const { output, errors } = geoStylerResponse;

        if (errors && errors.length > 0) {
          throw new Error(errors.join('\n'));
        }

        const updatedStyle = {
          name: output?.name,
          rules: output?.rules,
        };

        setCurrentLayerConf(prevState => ({
          ...prevState,
          style: updatedStyle as GsStyle,
        }));

        setFeedback({
          success: true,
          message: null,
        });
      } catch (error) {
        console.error('Error parsing SLD:', error);
        setFeedback({
          success: false,
          message: t('Error parsing SLD file.'),
        });
      }
    };

    reader.readAsText(file);
    return false;
  };

  const layerTabLabel = t('Layer');
  const styleTabLabel = t('Style');
  const layerTypeLabel = t('Layer type');
  const layerTypeDescription = t('The type of the layer');
  const serviceVersionLabel = t('Service version');
  const serviceVersionDescription = t('The version of the service');
  const layersParamLabel = t('Layer Name');
  const layersParamDescription = t(
    'The name of the layer as described in GetCapabilities',
  );
  const layersParamPlaceholder = t('Layer Name');
  const layerTitleLabel = t('Layer title');
  const layerTitleDescription = t('The visible title of the layer');
  const layerTitlePlaceholder = t('Insert Layer title');
  const layerUrlLabel = t('Layer URL');
  const layerUrlDescription = t('The service url of the layer');
  const layerUrlPlaceholder = t('Insert Layer URL');
  const maxFeaturesLabel = t('Max. features');
  const maxFeaturesDescription = t(
    'Maximum number of features to fetch from service',
  );
  const maxFeaturesPlaceholder = t('10000');
  const attributionLabel = t('Attribution');
  const attributionDescription = t('The layer attribution');
  const attributionPlaceholder = t('© Layer attribution');

  const wmsVersionOptions: { value: any; label: string }[] =
    serviceVersions.WMS.map(version => ({ value: version, label: version }));
  const wfsVersionOptions: { value: any; label: string }[] =
    serviceVersions.WFS.map(version => ({ value: version, label: version }));
  const layerTypeOptions: { value: string; label: string }[] = [
    { value: 'WMS', label: t('WMS') },
    { value: 'WFS', label: t('WFS') },
    { value: 'XYZ', label: t('XYZ') },
  ];
  if (enableDataLayer) {
    layerTypeOptions.push({ value: 'DATA', label: 'DATA' });
  }

  return (
    <div>
      <Form key={JSON.stringify(formKey)}>
        <Tabs defaultActiveKey={LAYER_CONFIG_TABS.LAYER}>
          <Tabs.TabPane tab={layerTabLabel} key={LAYER_CONFIG_TABS.LAYER}>
            <StyledControlFormItem
              controlType="Select"
              label={layerTypeLabel}
              description={layerTypeDescription}
              options={layerTypeOptions}
              value={currentLayerConf.type}
              defaultValue={currentLayerConf.type}
              name="type"
              onChange={onLayerTypeChange}
            />
            {(isWfsLayerConf(currentLayerConf) ||
              isWmsLayerConf(currentLayerConf) ||
              isXyzLayerConf(currentLayerConf)) && (
              <StyledControlFormItem
                controlType="Input"
                label={layerUrlLabel}
                description={layerUrlDescription}
                placeholder={layerUrlPlaceholder}
                value={currentLayerConf.url}
                name="url"
                onChange={onLayerUrlChange}
              />
            )}
            {isWmsLayerConf(currentLayerConf) && (
              <StyledControlFormItem
                controlType="Select"
                label={serviceVersionLabel}
                description={serviceVersionDescription}
                options={wmsVersionOptions}
                value={wmsVersion}
                defaultValue={wmsVersionOptions[0].value as string}
                name="wmsVersion"
                onChange={onWmsVersionChange}
              />
            )}
            {isWfsLayerConf(currentLayerConf) && (
              <StyledControlFormItem
                controlType="Select"
                label={serviceVersionLabel}
                description={serviceVersionDescription}
                options={wfsVersionOptions}
                value={wfsVersion}
                defaultValue={wfsVersionOptions[0].value as string}
                name="wfsVersion"
                onChange={onWfsVersionChange}
              />
            )}
            {isWmsLayerConf(currentLayerConf) && (
              <StyledControlFormItem
                controlType="Input"
                label={layersParamLabel}
                description={layersParamDescription}
                placeholder={layersParamPlaceholder}
                value={currentLayerConf.layersParam}
                name="layersParam"
                onChange={onLayersParamChange}
              />
            )}
            {isWfsLayerConf(currentLayerConf) && (
              <StyledControlFormItem
                controlType="Input"
                label={layersParamLabel}
                description={layersParamDescription}
                placeholder={layersParamPlaceholder}
                value={currentLayerConf.typeName}
                name="typeName"
                onChange={onTypeNameChange}
              />
            )}
            <StyledControlFormItem
              controlType="Input"
              label={layerTitleLabel}
              description={layerTitleDescription}
              placeholder={layerTitlePlaceholder}
              value={currentLayerConf.title}
              name="title"
              onChange={onLayerTitleChange}
            />
            {isWfsLayerConf(currentLayerConf) && (
              <StyledControlNumberFormItem
                controlType="InputNumber"
                label={maxFeaturesLabel}
                description={maxFeaturesDescription}
                placeholder={maxFeaturesPlaceholder}
                value={currentLayerConf.maxFeatures}
                name="maxFeatures"
                onChange={onMaxFeaturesChange}
              />
            )}
            <StyledControlFormItem
              controlType="Input"
              label={attributionLabel}
              description={attributionDescription}
              placeholder={attributionPlaceholder}
              value={currentLayerConf.attribution}
              name="attribution"
              onChange={onAttributionChange}
            />
          </Tabs.TabPane>
          <Tabs.TabPane
            tab={styleTabLabel}
            key={LAYER_CONFIG_TABS.GEOSTYLER}
            disabled={
              !(
                isWfsLayerConf(currentLayerConf) ||
                isDataLayerConf(currentLayerConf)
              )
            }
          >
            {(isWfsLayerConf(currentLayerConf) ||
              isDataLayerConf(currentLayerConf)) && (
              <>
                <StyledUploadButtonContainer>
                  <div>
                    <StyledFeedbackMessage success={!!feedback.success}>
                      {feedback.message}
                    </StyledFeedbackMessage>
                  </div>
                  <Upload
                    beforeUpload={beforeUpload}
                    showUploadList={false}
                    accept=".sld"
                  >
                    <Button
                      size="small"
                      icon={
                        feedback.success !== null ? (
                          feedback.success ? (
                            <CheckOutlined
                              style={{ color: theme.colors.success.base }}
                            />
                          ) : (
                            <CloseOutlined
                              style={{ color: theme.colors.error.base }}
                            />
                          )
                        ) : (
                          <UploadOutlined />
                        )
                      }
                      style={{ float: 'right' }}
                    >
                      {t('Import SLD')}
                    </Button>
                  </Upload>
                </StyledUploadButtonContainer>
                <GeoStylerContext.Provider value={geoStylerContext}>
                  <StyledGeoStyler
                    style={currentLayerConf.style}
                    onStyleChange={onStyleChange}
                  />
                </GeoStylerContext.Provider>
              </>
            )}
          </Tabs.TabPane>
        </Tabs>
        <StyledButtonContainer>
          <StyledCloseButton type="default" onClick={onCloseClick}>
            {t('Close')}
          </StyledCloseButton>
          <StyledSaveButton type="primary" onClick={onSaveClick}>
            {t('Save')}
          </StyledSaveButton>
        </StyledButtonContainer>
      </Form>
    </div>
  );
};

export default LayerConfigsPopoverContent;
