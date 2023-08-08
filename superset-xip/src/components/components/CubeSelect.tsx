import React, {useEffect, useState} from 'react';
import cubejs from "@cubejs-client/core";
import { Select, Row, Col, Tooltip, Button, Space, Modal } from "antd";
import FormItem from "./FormItem";
import { CameraOutlined } from '@ant-design/icons';
import QrScanner from "qr-scanner";
import {QrCodeScanner} from "./QrCodeScanner";

export function CubeSelect({ field, handleFormInput, formData, filters }) {
  const [selectOptions, setSelectOptions] = React.useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [scanResult, setScanResult] = useState('No result');
  const [deviceHasCamera, setDeviceHasCamera] = useState(false);

  const options = {
    apiToken: 'd60cb603dde98ba3037f2de9eda44938',
    apiUrl: 'https://odtest.xip.nl/cubejs-api/v1',
  };

  const cubejsApi = cubejs(options.apiToken, options);
  let labelIndex = 0;
  let selectedValue = formData[field.field_id];
  const uniqueDimensions: Array<string> = [... new Set(field.field_options.map((option) => field.field_dataset + "." + option.dimentions))] as Array<string>;


  const handleChange = (value: string) => {
    handleFormInput(field.field_id, value)
  };

  const showModal = () => {
    setIsModalOpen(true);
  };

  const handleOk = () => {
    setIsModalOpen(false);
  };

  const handleCancel = () => {
    setIsModalOpen(false);
  };

  useEffect(() => {
    QrScanner.hasCamera().then(
      (hasCamera) => setDeviceHasCamera(hasCamera)
    );
  }, []);

  useEffect(() => {
    const sortDimention = field.field_options.findIndex((option) => option.sort !== undefined);

    const order = {};
    if (sortDimention !== -1) {
      order[field.field_dataset + "." + field.field_options[sortDimention].dimentions] = field.field_options[sortDimention].sort;
    }

    labelIndex = field.field_options.findIndex((option) => option.show === 'true');
    labelIndex = labelIndex === -1 ? 0 : labelIndex;

    cubejsApi
      .load({
        dimensions: uniqueDimensions,
        order,
      })
      .then((result) => {
        setSelectOptions(result.loadResponse.results[0].data.map((item) => {
          return {
            value: JSON.stringify(item),
            label: item[field.field_dataset + "." + field.field_options[labelIndex].dimentions]
          }
        }));
      });
  }, [field.field_options]);

  const appliedFilters = filters.find((filter) => filter.dataset === field.field_dataset);

  useEffect(() => {
    if (appliedFilters) {
      if (formData[field.field_id] != undefined && formData[field.field_id] !== '') {
        try {
          const currentValue = JSON.parse(formData[field.field_id]);

          if (
            currentValue[field.field_dataset + "." + appliedFilters.col] === appliedFilters.val[0]
          ) {
            // Already applied
            return;
          }
        } catch (e) {
          console.log(e);
        }
      }

      const filter = {
        "member": field.field_dataset + "." + appliedFilters.col,
        "operator": "equals",
        "values": appliedFilters.val
      };

      cubejsApi
        .load({
          dimensions: uniqueDimensions,
          filters: [filter],
        })
        .then((result) => {
          const res = result.loadResponse.results[0].data[0];
          handleChange(JSON.stringify(res));
        });
    }
  }, [appliedFilters?.val]);

  useEffect(() => {
    if (scanResult !== 'No result' && isModalOpen) {
      const result = JSON.parse(scanResult);
      const col = Object.keys(result)[0];
      const val = result[col];

      const filter = {
        "member": field.field_dataset + "." + col,
        "operator": "equals",
        "values": [val],
      };

      cubejsApi
        .load({
          dimensions: uniqueDimensions,
          filters: [filter],
        })
        .then((result) => {
          const res = result.loadResponse.results[0].data[0];
          handleChange(JSON.stringify(res));
          setIsModalOpen(false);
          setScanResult('No result');
        });
    }
  }, [scanResult]);

  return (
    <>
      <FormItem
        name={field.form_id}
        label={field.form_label}
        initialValue={selectedValue}
      >
        <Row>
          <Col flex="auto">
            <label htmlFor={field.field_id} className="form-label">
              <h4>{field.field_label}</h4>
            </label>
            <Select
              value={selectedValue}
              defaultValue={selectedValue}
              onChange={handleChange}
              options={selectOptions}
            />
          </Col>
          { (field.field_scan === 'true' && deviceHasCamera) ?
            <Col flex="none">
              <Space align="end" style={{marginLeft: '20px', height: '100%'}}>
                <Tooltip title="scan code">
                  <Button type="primary" shape="circle" onClick={showModal} icon={<CameraOutlined/>}/>
                </Tooltip>
              </Space>
            </Col>
          : null }
        </Row>
      </FormItem>

    <Modal title="Scan code" visible={isModalOpen} onOk={handleOk} onCancel={handleCancel} destroyOnClose={true}>
      <QrCodeScanner
        onScan={setScanResult}
      ></QrCodeScanner>
    </Modal>
    </>
  );
}
