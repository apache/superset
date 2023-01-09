import { styled, css, SupersetTheme, useTheme } from '@superset-ui/core';
import { Button, message, Upload } from 'antd';
import type { UploadProps } from 'antd/lib/upload';
import { FileTextOutlined, CloudUploadOutlined } from '@ant-design/icons';
import React, { useState } from 'react';
import Modal from '../../components/Modal';

const uploadAreaStyle = (theme: SupersetTheme) => css`
  width: auto !important;
  border: 1px dashed ${theme.colors.primary.dark1};
  background: ${theme.colors.grayscale.dark2};
  margin: 40px !important;
  :hover {
    border-color: ${theme.colors.primary.dark1};
  }
`;

const uploadIconStyle = (theme: SupersetTheme) => css`
  color: ${theme.colors.grayscale.light5};
`;

const UploadCsv = () => {
  const [progress, setProgress] = useState(0);
  const { Dragger } = Upload;
  const [showProgressBarModal, setShowProgressBarModal] = useState(false);
  const theme = useTheme();
  const StyledNewUi = styled.div`
    background: ${theme.colors.grayscale.light5};
    .navigation {
      width: 64px;
      height: 100vh;
      background: ${theme.colors.grayscale.dark2};
      .icon-list,
      .bottom-icon-list {
        display: flex;
        align-items: center;
        flex-direction: column;
        justify-content: center;
        margin-top: 14px;
        .iocn-div {
          background: ${theme.colors.grayscale.dark2};
          border-radius: 4px;
          padding: 8px;
          margin-bottom: 12px;
          cursor: pointer;
        }
      }
      .bottom-icon-list {
        position: absolute;
        bottom: 0px;
        left: 10px;
      }
    }
    .contantWrap {
      width: 100%;
      padding: 40px;
      .navigation-part {
        span {
          font-family: 'Inter';
          font-style: normal;
          font-weight: 500;
          font-size: 12px;
          line-height: 16px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: ${theme.colors.grayscale.dark2};
        }
      }
      .title {
        font-family: 'Inter';
        font-style: normal;
        font-weight: 700;
        font-size: 28px;
        line-height: 28px;
        text-transform: capitalize;
        color: ${theme.colors.grayscale.dark2};
        margin-top: 12px;
      }
      .fileUploadDiv {
        margin-top: 56px;
        span {
          font-family: 'Inter';
          font-style: normal;
          font-weight: 600;
          font-size: 20px;
          line-height: 28px;
          text-transform: capitalize;
          color: ${theme.colors.grayscale.dark2};
        }
      }
    }
  `;
  const StyleProgressBar = styled.div`
    height: 28px;
    margin-bottom: 30px;
    .progress-bar {
      background: ${theme.colors.grayscale.dark2};
      opacity: 0.6;
      border-radius: 8px;
    }
  `;
  const StyleProgressBarCount = styled.div`
    .counter {
      font-family: 'Inter';
      font-style: normal;
      font-weight: 300;
      font-size: 160px;
      line-height: 160px;
      text-align: center;
      text-transform: capitalize;
      color: ${theme.colors.grayscale.dark2};
    }
    .upload-text {
      font-family: 'Inter';
      font-weight: 600;
      font-size: 20px;
      text-align: center;
      text-transform: capitalize;
      color: ${theme.colors.grayscale.dark2};
      margin-bottom: 20px;
    }
  `;
  const content = 'You can upload .CSV files .XSLS file of size < 200 MB';
  const props: UploadProps = {
    name: 'file',
    multiple: true,
    action: '/csvtodatabaseview/form',
    onChange(info) {
      const { status } = info.file;
      if (status === 'done') {
        message.success(`${info.file.name} file uploaded successfully.`);
      } else if (status === 'error') {
        message.error(`${info.file.name} file upload failed.`);
      }
    },
    progress: {
      strokeWidth: 3,
      format: (percent: any) => {
        if (percent) {
          setProgress(parseFloat(percent.toFixed(0)));
          setShowProgressBarModal(true);
        }
        return `${parseFloat(percent.toFixed(2))}%`;
      },
    },
  };

  return (
    <>
      <div>
        <StyledNewUi>
          <div className="contantWrap">
            <div className="navigation-part">
              <span>data managment / import DATA</span>
            </div>
            <div className="title">Import Data</div>
            <div className="fileUploadDiv">
              <span>Upload Files</span>
              <Dragger {...props} css={uploadAreaStyle}>
                <p className="ant-upload-drag-icon">
                  <FileTextOutlined css={uploadIconStyle} />
                </p>
                <p className="ant-upload-text">
                  You can upload tables via CSV files,{' '}
                </p>
                <p className="ant-upload-hint">Drag & Drop your files here</p>
                <Button icon={<CloudUploadOutlined />} size="large">
                  Upload Tables
                </Button>
                <p className="ant-upload-hint">{content}</p>
              </Dragger>
            </div>
          </div>
        </StyledNewUi>

        <Modal
          name="database"
          onHide={() => {
            setShowProgressBarModal(false);
          }}
          width="720px"
          centered
          show={showProgressBarModal}
          title={<h4>Uploading in progress...</h4>}
          hideFooter
        >
          <StyleProgressBarCount>
            <div className="counter">{progress}%</div>
            <div className="upload-text">uploaded</div>
          </StyleProgressBarCount>
          <StyleProgressBar>
            <div
              className="progress-bar"
              role="progressbar"
              style={{ width: `${progress}%` }}
            >
              <span style={{ display: 'none' }}>''</span>
            </div>
          </StyleProgressBar>
        </Modal>
      </div>
    </>
  );
};

export default UploadCsv;
