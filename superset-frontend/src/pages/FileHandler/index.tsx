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
import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { t } from '@superset-ui/core';
import { Loading } from '@superset-ui/core/components';
import UploadDataModal from 'src/features/databases/UploadDataModel';
import withToasts from 'src/components/MessageToasts/withToasts';

interface FileLaunchParams {
  readonly files?: readonly FileSystemFileHandle[];
}

interface LaunchQueue {
  setConsumer: (consumer: (params: FileLaunchParams) => void) => void;
}

interface WindowWithLaunchQueue extends Window {
  launchQueue?: LaunchQueue;
}

interface FileHandlerProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

const FileHandler = ({ addDangerToast, addSuccessToast }: FileHandlerProps) => {
  const history = useHistory();
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState<
    'csv' | 'excel' | 'columnar' | null
  >(null);
  const [showModal, setShowModal] = useState(false);
  const [allowedExtensions, setAllowedExtensions] = useState<string[]>([]);

  useEffect(() => {
    const handleFileLaunch = async () => {
      const { launchQueue } = window as WindowWithLaunchQueue;

      if (!launchQueue) {
        addDangerToast(
          t(
            'File handling is not supported in this browser. Please use a modern browser like Chrome or Edge.',
          ),
        );
        history.push('/superset/welcome/');
        return;
      }

      launchQueue.setConsumer(async (launchParams: FileLaunchParams) => {
        if (!launchParams.files || launchParams.files.length === 0) {
          history.push('/superset/welcome/');
          return;
        }

        try {
          const fileHandle = launchParams.files[0];
          const file = await fileHandle.getFile();
          const fileName = file.name.toLowerCase();

          let type: 'csv' | 'excel' | 'columnar' | null = null;
          let extensions: string[] = [];

          if (fileName.endsWith('.csv')) {
            type = 'csv';
            extensions = ['csv'];
          } else if (fileName.endsWith('.xls') || fileName.endsWith('.xlsx')) {
            type = 'excel';
            extensions = ['xls', 'xlsx'];
          } else if (fileName.endsWith('.parquet')) {
            type = 'columnar';
            extensions = ['parquet'];
          } else {
            addDangerToast(
              t(
                'Unsupported file type. Please use CSV, Excel, or Columnar files.',
              ),
            );
            history.push('/superset/welcome/');
            return;
          }

          setUploadFile(file);
          setUploadType(type);
          setAllowedExtensions(extensions);
          setShowModal(true);
        } catch (error) {
          console.error('Error handling file launch:', error);
          addDangerToast(t('Failed to open file. Please try again.'));
          history.push('/superset/welcome/');
        }
      });
    };

    handleFileLaunch();
  }, [history, addDangerToast]);

  const handleModalClose = () => {
    setShowModal(false);
    setUploadFile(null);
    setUploadType(null);
    history.push('/superset/welcome/');
  };

  if (!uploadFile || !uploadType) {
    return <Loading />;
  }

  return (
    <UploadDataModal
      show={showModal}
      onHide={handleModalClose}
      fileListOverride={[uploadFile]}
      allowedExtensions={allowedExtensions}
      type={uploadType}
      addDangerToast={addDangerToast}
      addSuccessToast={addSuccessToast}
    />
  );
};

export default withToasts(FileHandler);
