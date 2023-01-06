import React from 'react';
import { Row, Col, Typography, Button } from 'antd';
import {
  ShareAltOutlined,
  SettingOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { SupersetTheme, useTheme } from '@superset-ui/core';

const { Title } = Typography;
interface IProsp {
  onShowUploadUI: () => void;
}
const HeaderPage = (props: IProsp) => {
  const theme: SupersetTheme = useTheme();
  const { onShowUploadUI } = props;

  return (
    <Row>
      <Col span="12">
        <Title>Data Management</Title>
      </Col>
      <Col span="12" style={{ display: 'inline-block' }}>
        <Row style={{ float: 'right' }}>
          <Button
            type="primary"
            icon={<ShareAltOutlined />}
            size="large"
            style={{
              marginRight: '8px',
              background: theme.colors.quotron.gray_white,
              color: theme.colors.quotron.black,
            }}
          />
          <Button
            type="primary"
            icon={<SettingOutlined />}
            size="large"
            style={{
              marginRight: '8px',
              background: theme.colors.quotron.gray_white,
              color: theme.colors.quotron.black,
            }}
          >
            Manage Data
          </Button>
          <Button
            type="primary"
            onClick={onShowUploadUI}
            icon={<DownloadOutlined />}
            size="large"
            style={{
              background: theme.colors.quotron.black,
              color: theme.colors.quotron.gray_white,
            }}
          >
            Import Data
          </Button>
        </Row>
      </Col>
    </Row>
  );
};

export default HeaderPage;
