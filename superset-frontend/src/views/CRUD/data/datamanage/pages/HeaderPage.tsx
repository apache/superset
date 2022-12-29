import React, { useState } from 'react';
import { Row, Col, Typography, Button, Modal } from 'antd';
import {
  ShareAltOutlined,
  SettingOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { SupersetTheme, useTheme } from '@superset-ui/core';
import Upload from 'src/views/components/Upload';

const { Title } = Typography;

const HeaderPage = () => {
  const theme: SupersetTheme = useTheme();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const showModal = async (column: any) => {
    setIsModalOpen(true);
  };
  const handleOk = () => {
    setIsModalOpen(false);
  };
  const handleCancel = () => {
    setIsModalOpen(false);
  };
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
            icon={<DownloadOutlined />}
            size="large"
            style={{
              background: theme.colors.quotron.black,
              color: theme.colors.quotron.gray_white,
            }}
            onClick={showModal}
          >
            Import Data
          </Button>
        </Row>
      </Col>
      <Modal
        visible={isModalOpen}
        onOk={handleOk}
        onCancel={handleCancel}
        closable={false}
        footer={null}
      >
        <Upload />
      </Modal>
    </Row>
  );
};

export default HeaderPage;
