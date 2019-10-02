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
import PropTypes, { array } from 'prop-types';
import Mustache from 'mustache';
import Gallery from 'react-grid-gallery';

import './ImageGalleryTable.css';

const propTypes = {
  height: PropTypes.number,
  width: PropTypes.number,
  data:PropTypes.arrayOf(PropTypes.object),
  allColumnsY:PropTypes.string,
  allColumnsX:PropTypes.string 
};
const defaultProps = {
  height: undefined,
  width: undefined,
  data: undefined,
  allColumnsY:[],
  allColumnsX:[],
};

class ImageGalleryTable extends React.PureComponent {
  render() {

    const {
      height,
      width,
      data,
      allColumnsY,
      allColumnsX,   
    } = this.props;
   console.log(data)
   const imagewd = width/3
   let images = [];
   data.forEach(element => {
    images.push(
      {
        src: element[allColumnsX],
        thumbnail:element[allColumnsX],
        isSelected: false,
        thumbnailCaption: element[allColumnsY],
      }
    )
     
   });

   var style = {'overflow':'auto','height':'100%','width':'100%', 'display': 'inline-table'}

   console.log(images)

    return (
        <div style={style} >
         <Gallery images={images} enableImageSelection= {false}/>
         </div>
    );
  }
}

ImageGalleryTable.propTypes = propTypes;
ImageGalleryTable.defaultProps = defaultProps;

export default ImageGalleryTable;
