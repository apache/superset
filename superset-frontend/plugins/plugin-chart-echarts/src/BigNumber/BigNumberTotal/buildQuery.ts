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
import {
  buildQueryContext,
  QueryFormData,
  getComparisonInfo,
} from '@superset-ui/core';

export default function buildQuery(formData: QueryFormData) {
  // Debug logging for buildQuery
  console.log('BigNumberTotal buildQuery - Input formData:', {
    hasExtraFormData: !!formData.extra_form_data,
    extraFormData: formData.extra_form_data,
    customFormData: formData.extra_form_data?.custom_form_data,
    timeCompare: (formData.extra_form_data?.custom_form_data as any)?.time_compare,
    timeCompareDirect: (formData.extra_form_data as any)?.time_compare,
    metrics: formData.metrics,
    datasource: formData.datasource,
  });

  const buildQuery = (baseQueryObject: any) => {
    console.log('BigNumberTotal buildQuery - baseQueryObject:', baseQueryObject);
    
    const queries = [baseQueryObject];

    // Handle both old and new time comparison formats
    const timeComparison = 
      (formData.extra_form_data?.custom_form_data as any)?.time_compare ||
      (formData.extra_form_data as any)?.time_compare;
      
    console.log('BigNumberTotal buildQuery - timeComparison resolved:', timeComparison);
    
    if (timeComparison && timeComparison !== 'NoComparison') {
      console.log('BigNumberTotal buildQuery - Processing time comparison for:', timeComparison);
      
      try {
        const comparisonFormData = getComparisonInfo(
          formData,
          timeComparison,
          formData.extra_form_data,
        );
        console.log('BigNumberTotal buildQuery - comparisonFormData from getComparisonInfo:', comparisonFormData);
        
        const comparisonQuery = {
          ...baseQueryObject,
          ...comparisonFormData,
        };
        console.log('BigNumberTotal buildQuery - comparisonQuery created:', comparisonQuery);
        
        queries.push(comparisonQuery);
      } catch (error) {
        console.error('BigNumberTotal buildQuery - Error in getComparisonInfo:', error);
      }
    } else {
      console.log('BigNumberTotal buildQuery - No time comparison or NoComparison selected');
    }
    
    console.log('BigNumberTotal buildQuery - Final queries array:', queries);
    return queries;
  };

  const result = buildQueryContext(formData, buildQuery);
  console.log('BigNumberTotal buildQuery - Final result from buildQueryContext:', result);
  
  return result;
}
