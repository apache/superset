/* eslint camel-case: 0 */
import React, { PropTypes } from 'react';

const propTypes = {
  can_edit: PropTypes.bool,
  slice: PropTypes.object,
};

export default function SaveModal(can_edit, slice) {
  return (
    <div className="modal fade" id="save_modal" tabIndex="-1" role="dialog">
      <div className="modal-dialog" role="document">
        <div className="modal-content">
          <div className="modal-header">
            <button type="button" className="close" data-dismiss="modal" aria-label="Close">
              <span aria-hidden="true">&times;</span>
            </button>
            <h4 className="modal-title">Save A Slice</h4>
          </div>
          <div className="modal-body">
            {slice &&
              <div>
                <input
                  type="radio"
                  name="rdo_save"
                  value="overwrite"
                  disabled={!can_edit}
                  checked={can_edit}
                />
                <span> `Overwrite slice ${slice.slice_name}` </span>
                <br />
                <br />
              </div>
            }
            <input
              id="save_as_new"
              type="radio"
              name="rdo_save"
              value="saveas"
              checked={!can_edit}
            />
            Save as
            <input type="text" name="new_slice_name" placeholder="[slice name]" /><br />
            <hr />
            <input type="radio" name="add_to_dash" checked value="false" />
            Do not add to a dashboard<br /><br />
            <input id="add_to_dash_existing" type="radio" name="add_to_dash" value="existing" />
            Add slice to existing dashboard
            <input type="text" id="save_to_dashboard_id" name="save_to_dashboard_id" />
            <br /><br />
            <input type="radio" id="add_to_new_dash" name="add_to_dash" value="new" />
            Add to new dashboard
            <input type="text" name="new_dashboard_name" placeholder="[dashboard name]" />
            <br /><br />
          </div>
          <div className="modal-footer">
            <button type="button" id="btn_modal_save" className="btn pull-left">
              Save
            </button>
            <button
              type="button"
              id="btn_modal_save_goto_dash"
              className="btn btn-primary
              pull-left gotodash"
              disabled
            >
              Save & go to dashboard
            </button>
            <button type="button" className="btn btn-default pull-right" data-dismiss="modal">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

SaveModal.propTypes = propTypes;
