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
import React from "react";
import FileDropper from "src/components/FileDropper/FileDropper";
import DropArea from "src/components/FileDropper/DropArea";

export default class QuickUploadContainer extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      file: undefined
    };
    this.setFile = this.setFile.bind(this);
  }

  setFile(file) {
    if (file) {
      file = file[0];
    }
    this.setState({ file: file });
  }

  render() {
    return (
      <div className='container'>
        <div className='panel panel-primary'>
          <div className='panel-heading'>
            <h4 className='panel-title'>CSV to Database configuration</h4>
          </div>
          <div id='Home' className='tab-pane active'>
            <form id='model_form' method='post' encType='multipart/form-data'>
              <div className='table-responsive'>
                <table className='table table-bordered'>
                  <tbody>
                    <tr>
                      <td className='col-lg-2'>
                        Table Name<strong style={{ color: "red" }}>*</strong>
                      </td>
                      <td>
                        <input
                          className='form-control'
                          id='name'
                          name='name'
                          placeholder='Table Name'
                          required
                          type='text'
                        />
                        <span className='help-block'>
                          Name of the table to be created from csv data.
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className='col-lg-2'>
                        CSV File<strong style={{ color: "red" }}>*</strong>
                      </td>
                      <td>
                        <FileDropper
                          onFileSelected={this.setFile}
                          allowedMimeTypes={["text/csv"]}
                        >
                          <DropArea
                            isVisible={true}
                            showFileSelected={true}
                            fileName={
                              this.state.file ? this.state.file.name : undefined
                            }
                          />
                        </FileDropper>
                        <span className='help-block'>
                          Select a CSV file to be uploaded to a database.
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }
}
