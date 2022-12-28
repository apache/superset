import { FileTextOutlined, CloudUploadOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd/lib/upload';
import { Button, message, Upload } from 'antd';
import { css, SupersetTheme } from '@superset-ui/core';
import React from 'react';

const uploadAreaStyle = (theme: SupersetTheme) => css`
  width: auto !important;
  border: 1px dashed rgba(0, 0, 0, 0.1);
  margin: 40px !important;
  :hover {
    border-color: rgba(0, 0, 0, 0.4);
  }
`;

const uploadBtnStyle = (theme: SupersetTheme) => css`
  color: ${theme.colors.grayscale.light5};
  background-color: ${theme.colors.grayscale.dark2};
  margin: 12px;
  border-radius: 8px;
  .ant-btn :hover{
    color: ${theme.colors.grayscale.dark2}
    background-color: ${theme.colors.grayscale.dark2}
    cursor: pointer
}`;

const uploadBtnIconStyle = (theme: SupersetTheme) => css`
  color: ${theme.colors.grayscale.light5};
  background-color: ${theme.colors.grayscale.dark2};
`;

const uploadIconStyle = (theme: SupersetTheme) => css`
  color: ${theme.colors.grayscale.light5};
`;

const { Dragger } = Upload;

const props: UploadProps = {
  name: 'file',
  multiple: true,
  action: '/csvtodatabaseview/form',
  onChange(info) {
    const { status } = info.file;
    if (status !== 'uploading') {
      console.log(info.file, info.fileList);
    }
    if (status === 'done') {
      message.success(`${info.file.name} file uploaded successfully.`);
    } else if (status === 'error') {
      message.error(`${info.file.name} file upload failed.`);
    }
  },
  //   onDrop(e) {
  //     console.log('Dropped files', e.dataTransfer.files);
  //   },
};
const content = 'You can upload .CSV files .XSLS file of size < 200 MB';
const App: React.FC = () => (
  <Dragger {...props} css={uploadAreaStyle}>
    <p className="ant-upload-drag-icon">
      <FileTextOutlined css={uploadIconStyle} />
    </p>
    <p className="ant-upload-text">You can upload tables via CSV files, </p>
    <p className="ant-upload-hint">Drag & Drop your files here</p>
    <Button
      css={uploadBtnStyle}
      icon={<CloudUploadOutlined css={uploadBtnIconStyle} />}
      size={'large'}
    >
      Upload Tables
    </Button>
    <p className="ant-upload-hint">{content}</p>
  </Dragger>
);

export default App;
