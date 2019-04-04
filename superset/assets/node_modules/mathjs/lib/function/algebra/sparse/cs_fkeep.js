'use strict';

function factory () {

  /**
   * Keeps entries in the matrix when the callback function returns true, removes the entry otherwise
   *
   * @param {Matrix}   a              The sparse matrix
   * @param {function} callback       The callback function, function will be invoked with the following args:
   *                                    - The entry row
   *                                    - The entry column
   *                                    - The entry value
   *                                    - The state parameter
   * @param {any}      other          The state
   *
   * @return                          The number of nonzero elements in the matrix
   *
   * Reference: http://faculty.cse.tamu.edu/davis/publications.html
   */
  var cs_fkeep = function (a, callback, other) {
    // a arrays
    var avalues = a._values;
    var aindex = a._index;
    var aptr = a._ptr;
    var asize = a._size;
    // columns
    var n = asize[1];
    // nonzero items
    var nz = 0;
    // loop columns
    for (var j = 0; j < n; j++) {
      // get current location of col j
      var p = aptr[j];
      // record new location of col j
      aptr[j] = nz;
      for (; p < aptr[j+1]; p++) {
        // check we need to keep this item
        if (callback(aindex[p], j, avalues ? avalues[p] : 1, other)) {
          // keep A(i,j)
          aindex[nz] = aindex[p];
          // check we need to process values (pattern only)
          if (avalues) 
            avalues[nz] = avalues[p];
          // increment nonzero items
          nz++;
        }
      }
    }
    // finalize A
    aptr[n] = nz;
    // trim arrays
    aindex.splice(nz, aindex.length - nz);
    // check we need to process values (pattern only)
    if (avalues)
      avalues.splice(nz, avalues.length - nz);    
    // return number of nonzero items
    return (nz);
  };
  
  return cs_fkeep;
}

exports.name = 'cs_fkeep';
exports.path = 'sparse';
exports.factory = factory;
