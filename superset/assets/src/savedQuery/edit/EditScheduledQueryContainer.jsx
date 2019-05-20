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
import PropTypes from 'prop-types';
import ScheduleQueryButton from 'src/SqlLab/components/ScheduleQueryButton';
import { t } from '@superset-ui/translation';

const propTypes = {
  query: PropTypes.object.isRequired,
};

function updateScheduleInfo(scheduleInfo) {
  const input = document.getElementById('extra_json');
  input.value = JSON.stringify({
    ...JSON.parse(input.value),
    schedule_info: scheduleInfo,
  });
}

export default class EditScheduledQueryContainer extends React.PureComponent {
  constructor(props) {
    super(props);
    this.onSchedule = this.onSchedule.bind(this);
  }

  onSchedule(query) {
    updateScheduleInfo(JSON.parse(query.extra_json).schedule_info);
    const form = document.getElementById('model_form');
    form.submit();
  }

  render() {
    const { query } = this.props;
    return (query.extra_json.schedule_info
      ? <ScheduleQueryButton
        sql={query.sql}
        schema={query.schema}
        dbId={query.db_id}
        onSchedule={this.onSchedule}
        modalTitle={t('Edit schedule')}
        formData={query.extra_json.schedule_info}
        defaultLabel={query.label}
        defaultDescription={query.description}
      />
      : null
    );
  }
}

EditScheduledQueryContainer.propTypes = propTypes;
