// // This is a hack because shimming for $ extensions is not working.
// $('body').append([
//   '<script type="text/javascript" src="/static/refactor/vendor/dataTables/jquery.dataTables.min.js"></script>',
//   '<script type="text/javascript" src="/static/refactor/vendor/dataTables/dataTables.bootstrap.js"></script>',
// ]);

// // require('datatables');
// // console.log(jQuery.fn.dataTable);
// // require('../vendor/dataTables/jquery.dataTables.min.js');
// // require('../vendor/dataTables/dataTables.bootstrap.js');

// // CSS
// require('./pivot_table.css');
// require('../vendor/dataTables/dataTables.bootstrap.css');

// module.exports = function(slice) {
//   var container = slice.container;
//   var form_data = slice.data.form_data;

//   function refresh() {
//     $.getJSON(slice.jsonEndpoint(), function(json){
//       container.html(json.data);
//       if (form_data.groupby.length == 1){
//         var table = container.find('table').DataTable({
//           paging: false,
//           searching: false,
//         });
//         table.column('-1').order( 'desc' ).draw();
//       }
//       slice.done(json);
//     }).fail(function(xhr){
//         slice.error(xhr.responseText);
//     });
//   }
//   return {
//     render: refresh,
//     resize: refresh,
//   };

// };
