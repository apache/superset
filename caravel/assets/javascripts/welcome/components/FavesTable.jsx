import React, { PropTypes } from 'react';

const propTypes = {
  faves: PropTypes.array
};

const defaultProps = {
  faves: [
    {
      user_id: 1,
      class_name: 'slice',
      obj_title: 'Some slice name',
      obj_id: 2,
    },
    {
      user_id: 1,
      class_name: 'dashboard',
      obj_title: 'Some Dashboard name',
      obj_id: 3,
    },
  ]
}

export default function FavesTable ({ faves }) {
  const rows = faves.map((fave) => {
    const url = `/caravel/${fave.class_name}/${fave.obj_id}`;
    return (
      <tr key={fave.obj_title + fave.obj_id}>
        <td><a href={url}>{fave.obj_title}</a></td>
      </tr>
    );
  });
  return (
    <div>
      <table className="table table-striped" style={{display: 'table', width: '100%'}}>
        <tbody>
          {rows}
        </tbody>
      </table>
    </div>
  );
}

FavesTable.propTypes = propTypes;
FavesTable.defaultProps = defaultProps;
