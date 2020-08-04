import React from 'react';
import { Table } from './reactable/table';
import { Tr } from './reactable/tr';
import { Td } from './reactable/td';
import { Th } from './reactable/th';
import { Tfoot } from './reactable/tfoot';
import { Thead } from './reactable/thead';
import { Sort } from './reactable/sort';
import { unsafe } from './reactable/unsafe';

React.Children.children = function(children) {
    return React.Children.map(children, function(x) { return x; }) || [];
};

const Reactable = { Table, Tr, Td, Th, Tfoot, Thead, Sort, unsafe };

export default Reactable;

if(typeof(window) !== 'undefined') { window.Reactable = Reactable; }
