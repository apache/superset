import React, { PropTypes } from 'react';

const propTypes = {
  faves: PropTypes.array.isRequired,
};

export default function FavesTable ({ faves }) {
  const rows = faves.map((fave) => {
    const url = `/caravel/${fave.class_name}/${fave.obj_id}`;
    return (
      <tr key={fave.class_name + fave.obj_id}>
        <td><a href={url}>{fave.class_name} {fave.obj_id}</a></td>
      </tr>
    );
  });
  return (
    <div>
      <table className="table" style={{display: 'table', width: '100%'}}>
        <tbody>
          {rows}
        </tbody>
      </table>
    </div>
  );
}

FavesTable.propTypes = propTypes;
