import { SET_EDIT_MODE } from '../actions/editMode';

export default function editModeReducer(editMode = false, action) {
  switch (action.type) {
    case SET_EDIT_MODE:
      return action.payload.editMode;

    default:
      return editMode;
  }
}
