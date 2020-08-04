// Type definitions for JQuery DataTables 1.10
// Project: https://datatables.net
// Definitions by: Kiarash Ghiaseddin <https://github.com/Silver-Connection>
//                 Omid Rad <https://github.com/omidkrad>
//                 Armin Sander <https://github.com/pragmatrix>
//                 Craig Boland <https://github.com/CNBoland>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 2.4

// missing:
// - Some return types are not fully working

/// <reference types="jquery" />

interface JQuery {
    DataTable(opts?: DataTables.Settings): DataTables.Api;
    dataTable: DataTables.StaticFunctions;
}

declare namespace DataTables {
    interface JQueryDataTables extends JQuery {
        /**
         * Returns DataTables API instance
         * Usage:
         * $( selector ).dataTable().api();
         */
        api(): Api;
    }

    interface Api extends CoreMethods {
        /**
         * API should be array-like
         */
        [key: number]: any;
        /**
         * Returns DataTables API instance
         *
         * @param table Selector string for table
         */
        (selector: string | Node | Node[] | JQuery): Api;

        /**
         * Get the data for the whole table.
         */
        data(): Api;

        /**
         * Order Methods / object
         */
        order: OrderMethods;

        //#region "Cell/Cells"

        /**
         * Select the cell found by a cell selector
         *
         * @param cellSelector Cell selector.
         * @param Option used to specify how the cells should be ordered, and if paging or filtering
         */
        cell(cellSelector: any, modifier?: ObjectSelectorModifier): CellMethods;

        /**
         * Select the cell found by a cell selector
         *
         * @param rowSelector Row selector.
         * @param cellSelector Cell selector.
         * @param Option used to specify how the cells should be ordered, and if paging or filtering
         */
        cell(rowSelector: any, cellSelector: any, modifier?: ObjectSelectorModifier): CellMethods;

        /**
         * Select all cells
         *
         * @param Option used to specify how the cells should be ordered, and if paging or filtering
         */
        cells(modifier?: ObjectSelectorModifier): CellsMethods;

        /**
         * Select cells found by a cell selector
         *
         * @param cellSelector Cell selector.
         * @param Option used to specify how the cells should be ordered, and if paging or filtering
         */
        cells(cellSelector: any, modifier?: ObjectSelectorModifier): CellsMethods;

        /**
         * Select cells found by both row and column selectors
         *
         * @param rowSelector Row selector.
         * @param cellSelector Cell selector.
         * @param Option used to specify how the cells should be ordered, and if paging or filtering
         */
        cells(rowSelector: any, cellSelector: any, modifier?: ObjectSelectorModifier): CellsMethods;
        //#endregion "Cell/Cells"

        //#region "Column/Columns"

        /**
         * Column Methods / object
         */
        column: ColumnMethodsModel;

        /**
         * Columns Methods / object
         */
        columns: ColumnsMethodsModel;

        //#endregion "Column/Columns"

        //#region "Row/Rows"

        /**
         * Row Methode / object
         */
        row: RowMethodsModel;

        /**
         * Rows Methods / object
         */
        rows: RowsMethodsModel;

        //#endregion "Row/Rows"

        //#region "Table/Tables"

        /**
         * Select a table based on a selector from the API's context
         *
         * @param tableSelector Table selector.
         */
        table(tableSelector: any): TableMethods;

        /**
         * Select tables based on the given selector
         *
         * @param tableSelector Table selector.
         */
        tables(tableSelector?: any): TablesMethods;

        //#endregion "Table/Tables"
    }

    interface DataTables extends CoreMethods {
        [index: number]: Api;
    }

    interface ObjectSelectorModifier {
        /**
         * The order modifier provides the ability to control which order the rows are processed in.
         * Values: 'current', 'applied', 'index',  'original'
         */
        order?: string;

        /**
         * The search modifier provides the ability to govern which rows are used by the selector using the search options that are applied to the table.
         * Values: 'none', 'applied', 'removed'
         */
        search?: string;

        /**
         * The searchPlaceholder modifier provides the ability to provide informational text for an input control when it has no value.
         */
        searchPlaceholder?: string;

        /**
         * The page modifier allows you to control if the selector should consider all data in the table, regardless of paging, or if only the rows in the currently disabled page should be used.
         * Values: 'all', 'current'
         */
        page?: string;
    }

    //#region "Namespaces"

    //#region "core-methods"

    interface CoreMethods extends UtilityMethods {
        /**
         * Get jquery object
         */
        $(selector: string | Node | Node[] | JQuery, modifier?: ObjectSelectorModifier): JQuery;

        /**
         * Ajax Methods
         */
        ajax: AjaxMethodModel;

        /**
         * Clear the table of all data.
         */
        clear(): Api;

        /**
         * Destroy the DataTables in the current context.
         *
         * @param remove Completely remove the table from the DOM (true) or leave it in the DOM in its original plain un-enhanced HTML state (default, false).
         */
        destroy(remove?: boolean): Api;

        /**
         * Redraw the DataTables in the current context, optionally updating ordering, searching and paging as required.
         *
         * @param paging This parameter is used to determine what kind of draw DataTables will perform.
         */
        draw(paging?: boolean | string): Api;

        /*
         * Look up a language token that was defined in the DataTables' language initialisation object.
         *
         * @param token The language token to lookup from the language object.
         * @param def The default value to use if the DataTables initialisation has not specified a value.
         * @param numeric If handling numeric output, the number to be presented should be given in this parameter.
         *
         * @returns Resulting internationalised string.
         */
        i18n(token: string, def: any, numeric?: number): string;

        /*
         * Get the initialisation options used for the table. Since: DataTables 1.10.6
         */
        init(): Settings;

        /**
         * Table events removal.
         *
         * @param event Event name to remove.
         * @param callback Specific callback function to remove if you want to unbind a single event listener.
         */
        off(event: string, callback?: ((e: Event, ...args: any[]) => void)): Api;

        /**
         * Table events listener.
         *
         * @param event Event to listen for.
         * @param callback Specific callback function to remove if you want to unbind a single event listener.
         */
        on(event: string, callback: ((e: Event, ...args: any[]) => void)): Api;

        /**
         * Listen for a table event once and then remove the listener.
         *
         * @param event Event to listen for.
         * @param callback Specific callback function to remove if you want to unbind a single event listener.
         */
        one(event: string, callback: ((e: Event, ...args: any[]) => void)): Api;

        /**
         * Page Methods / object
         */
        page: PageMethods;

        /**
         * Get current search
         */
        search(): string;

        /**
         * Search for data in the table.
         *
         * @param input Search string to apply to the table.
         * @param regex Treat as a regular expression (true) or not (default, false).
         * @param smart Perform smart search.
         * @param caseInsen Do case-insensitive matching (default, true) or not (false).
         */
        search(input: string, regex?: boolean, smart?: boolean, caseInsen?: boolean): Api;

        /**
         * Obtain the table's settings object
         */
        settings(): Api;

        /**
         * Page Methods / object
         */
        state: StateMethods;
    }

    //#region "ajax-methods"

    interface AjaxMethods extends Api {
        /**
         * Reload the table data from the Ajax data source.
         *
         * @param callback Function which is executed when the data as been reloaded and the table fully redrawn.
         * @param resetPaging Reset (default action or true) or hold the current paging position (false).
         */
        load(callback?: ((json: any) => void), resetPaging?: boolean): Api;
    }

    interface AjaxMethodModel {
        /**
         * Get the latest JSON data obtained from the last Ajax request DataTables made
         */
        json(): object;

        /**
         * Get the data submitted by DataTables to the server in the last Ajax request
         */
        params(): object;

        /**
         * Reload the table data from the Ajax data source.
         *
         * @param callback Function which is executed when the data as been reloaded and the table fully redrawn.
         * @param resetPaging Reset (default action or true) or hold the current paging position (false).
         */
        reload(callback?: ((json: any) => void), resetPaging?: boolean): Api;

        /**
         * Reload the table data from the Ajax data source
         */
        url(): string;

        /**
         * Reload the table data from the Ajax data source
         *
         * @param url URL to set to be the Ajax data source for the table.
         */
        url(url: string): AjaxMethods;
    }

    //#endregion "ajax-methods"

    //#region "order-methods"

    interface OrderMethods {
        /**
         * Get the ordering applied to the table.
         */
        (): Array<Array<(string | number)>>;

        /**
         * Set the ordering applied to the table.
         *
         * @param order Order Model
         */
        (order?: Array<(string | number)> | Array<Array<(string | number)>>): Api;
        (order: Array<(string | number)>, ...args: any[]): Api;

        /**
         * Get the fixed ordering that is applied to the table. If there is more than one table in the API's context,
         * the ordering of the first table will be returned only (use table() if you require the ordering of a different table in the API's context).
         */
        fixed(): ObjectOrderFixed;
        /**
         * Set the table's fixed ordering. Note this doesn't actually perform the order, but rather queues it up - use draw() to perform the ordering.
         */
        fixed(order: ObjectOrderFixed): Api;

        /**
         * Add an ordering listener to an element, for a given column.
         *
         * @param node Selector
         * @param column Column index
         * @param callback Callback function
         */
        listener(node: string | Node | JQuery, column: number, callback: (() => void)): Api;
    }
    //#endregion "order-methods"

    //#region "page-methods"

    interface PageMethods {
        /**
         * Get the current page of the table.
         */
        (): number;

        /**
         * Set the current page of the table.
         *
         * @param page Index or 'first', 'next', 'previous', 'last'
         */
        (page: number | string): Api;

        /**
         * Get paging information about the table
         */
        info(): PageMethodeModelInfoReturn;

        /**
         * Get the table's page length.
         */
        len(): number;

        /**
         * Set the table's page length.
         *
         * @param length Page length to set. use -1 to show all records.
         */
        len(length: number): Api;
    }

    interface PageMethodeModelInfoReturn {
        page: number;
        pages: number;
        start: number;
        end: number;
        length: number;
        recordsTotal: number;
        recordsDisplay: number;
        serverSide: boolean;
    }

    //#endregion "page-methods"

    //#region "state-methods"

    interface StateMethods {
        /**
         * Get the last saved state of the table
         */
        (): StateReturnModel;

        /**
         * Clear the saved state of the table.
         */
        clear(): Api;

        /**
         * Get the table state that was loaded during initialisation.
         */
        loaded(): StateReturnModel;

        /**
         * Trigger a state save.
         */
        save(): Api;
    }

    interface StateReturnModel {
        time: number;
        start: number;
        length: number;
        order: Array<Array<(string | number)>>;
        search: SearchSettings;
        columns: StateReturnModelColumns[];
    }

    interface StateReturnModelColumns {
        search: SearchSettings;
        visible: boolean;
    }

    //#endregion "state-methods"

    //#endregion "core-methods"

    //#region "util-methods"

    interface UtilityMethods {
        /*
         * Get a boolean value to indicate if there are any entries in the API instance's result set (i.e. any data, selected rows, etc).
         */
        any(): boolean;

        /**
         * Concatenate two or more API instances together
         *
         * @param a API instance to concatenate to the initial instance.
         * @param b Additional API instance(s) to concatenate to the initial instance.
         */
        concat(a: object, ...b: object[]): Api;

        /**
         * Get the number of entries in an API instance's result set, regardless of multi-table grouping (e.g. any data, selected rows, etc). Since: 1.10.8
         */
        count(): number;

        /**
         * Iterate over the contents of the API result set.
         *
         * @param fn Callback function which is called for each item in the API instance result set. The callback is called with three parameters
         */
        each(fn: ((value: any, index: number, dt: Api) => void)): Api;

        /**
         * Reduce an Api instance to a single context and result set.
         *
         * @param idx Index to select
         */
        eq(idx: number): Api;

        /**
         * Iterate over the result set of an API instance and test each item, creating a new instance from those items which pass.
         *
         * @param fn Callback function which is called for each item in the API instance result set. The callback is called with three parameters.
         */
        filter(fn: ((value: any, index: number, dt: Api) => boolean)): Api;

        /**
         * Flatten a 2D array structured API instance to a 1D array structure.
         */
        flatten(): Api;

        /**
         * Find the first instance of a value in the API instance's result set.
         *
         * @param value Value to find in the instance's result set.
         */
        indexOf(value: any): number;

        /**
         * Join the elements in the result set into a string.
         *
         * @param separator The string that will be used to separate each element of the result set.
         */
        join(separator: string): string;

        /**
         * Find the last instance of a value in the API instance's result set.
         *
         * @param value Value to find in the instance's result set.
         */
        lastIndexOf(value: any): number;

        /**
         * Number of elements in an API instance's result set.
         */
        length: number;

        /**
         * Iterate over the result set of an API instance, creating a new API instance from the values returned by the callback.
         *
         * @param fn Callback function which is called for each item in the API instance result set. The callback is called with three parameters.
         */
        map(fn: ((value: any, index: number, dt: Api) => any)): Api;

        /**
         * Iterate over the result set of an API instance, creating a new API instance from the values retrieved from the original elements.
         *
         * @param property object property name to use from the element in the original result set for the new result set.
         */
        pluck(property: number | string): Api;

        /**
         * Remove the last item from an API instance's result set.
         */
        pop(): any;

        /**
         * Add one or more items to the end of an API instance's result set.
         *
         * @param value_1 Item to add to the API instance's result set.
         */
        push(value_1: any, ...value_2: any[]): number;

        /**
         * Apply a callback function against and accumulator and each element in the Api's result set (left-to-right).
         *
         * @param fn Callback function which is called for each item in the API instance result set. The callback is called with four parameters.
         * @param initialValue Value to use as the first argument of the first call to the fn callback.
         */
        reduce(fn: ((current: number, value: any, index: number, dt: Api) => number), initialValue?: any): any;

        /**
         * Apply a callback function against and accumulator and each element in the Api's result set (right-to-left).
         *
         * @param fn Callback function which is called for each item in the API instance result set. The callback is called with four parameters.
         * @param initialValue Value to use as the first argument of the first call to the fn callback.
         */
        reduceRight(fn: ((current: number, value: any, index: number, dt: Api) => number), initialValue?: any): any;

        /**
         * Reverse the result set of the API instance and return the original array.
         */
        reverse(): Api;

        /**
         * Remove the first item from an API instance's result set.
         */
        shift(): any;

        /**
         * Sort the elements of the API instance's result set.
         *
         * @param fn This is a standard Javascript sort comparison function. It accepts two parameters.
         */
        sort(fn?: ((value1: any, value2: any) => number)): Api;

        /**
         * Modify the contents of an Api instance's result set, adding or removing items from it as required.
         *
         * @param index Index at which to start modifying the Api instance's result set.
         * @param howMany Number of elements to remove from the result set.
         * @param value_1 Item to add to the result set at the index specified by the first parameter.
         */
        splice(index: number, howMany: number, value_1?: any, ...value_2: any[]): any[];

        /**
         * Convert the API instance to a jQuery object, with the objects from the instance's result set in the jQuery result set.
         */
        to$(): JQuery;

        /**
         * Create a native Javascript array object from an API instance.
         */
        toArray(): any[];

        /**
         * Convert the API instance to a jQuery object, with the objects from the instance's result set in the jQuery result set.
         */
        toJQuery(): JQuery;

        /**
         * Create a new API instance containing only the unique items from a the elements in an instance's result set.
         */
        unique(): Api;

        /**
         * Add one or more items to the start of an API instance's result set.
         *
         * @param value_1 Item to add to the API instance's result set.
         */
        unshift(value_1: any, ...value_2: any[]): number;
    }

    //#endregion "util-methods"

    interface CommonSubMethods {
        /**
         * Get the DataTables cached data for the selected cell
         *
         * @param t Specify which cache the data should be read from. Can take one of two values: search or order
         */
        cache(t: string): Api;
    }

    //#region "cell-methods"

    interface CommonCellMethods extends CommonSubMethods {
        /**
         * Invalidate the data held in DataTables for the selected cells
         *
         * @param source Data source to read the new data from.
         */
        invalidate(source?: string): Api;

        /**
         * Get data for the selected cell
         *
         * @param f Data type to get. This can be one of: 'display', 'filter', 'sort', 'type'
         */
        render(t: string): any;
    }

    interface CellMethods extends CoreMethods, CommonCellMethods {
        /**
         * Get data for the selected cell
         */
        data(): any;

        /**
         * Get data for the selected cell
         *
         * @param data Value to assign to the data for the cell
         */
        data(data: any): Api;

        /**
         * Get index information about the selected cell
         */
        index(): CellIndexReturn;

        /**
         * Get the DOM element for the selected cell
         */
        node(): Node;
    }

    interface CellIndexReturn {
        row: number;
        column: number;
        columnVisible: number;
    }

    interface CellsMethods extends CoreMethods, CommonCellMethods {
        /**
         * Get data for the selected cells
         */
        data(): Api;

        /**
         * Iterate over each selected cell, with the function context set to be the cell in question. Since: DataTables 1.10.6
         *
         * @param fn Function to execute for every cell selected.
         */
        every(fn: (this: CellMethods, cellRowIdx: number, cellColIdx: number, tableLoop: number, cellLoop: number) => void): Api;

        /**
         * Get index information about the selected cells
         */
        indexes(): Api;

        /**
         * Get the DOM elements for the selected cells
         */
        nodes(): Api;
    }
    //#endregion "cell-methods"

    //#region "column-methods"

    interface CommonColumnMethod extends CommonSubMethods {
        /**
         * Get the footer th / td cell for the selected column.
         */
        footer(): HTMLElement;

        /**
         * Get the header th / td cell for a column.
         */
        header(): HTMLElement;

        /**
         * Order the table, in the direction specified, by the column selected by the column()DT selector.
         *
         * @param direction Direction of sort to apply to the selected column - desc (descending) or asc (ascending).
         */
        order(direction: string): Api;

        /**
         * Get the visibility of the selected column.
         */
        visible(): boolean;

        /**
         * Set the visibility of the selected column.
         *
         * @param show Specify if the column should be visible (true) or not (false).
         * @param redrawCalculations Indicate if DataTables should recalculate the column layout (true - default) or not (false).
         */
        visible(show: boolean, redrawCalculations?: boolean): Api;
    }

    interface ColumnMethodsModel {
        /**
         * Select the column found by a column selector
         *
         * @param cellSelector Cell selector.
         * @param Option used to specify how the cells should be ordered, and if paging or filtering in the table should be taken into account.
         */
        (columnSelector: any, modifier?: ObjectSelectorModifier): ColumnMethods;

        /**
         * Convert from the input column index type to that required.
         *
         * @param t The type on conversion that should take place: 'fromVisible', 'toData', 'fromData', 'toVisible'
         * @param index The index to be converted
         */
        index(t: string, index: number): number;
    }

    interface ColumnMethods extends CoreMethods, CommonColumnMethod {
        /**
         * Get the data for the cells in the selected column.
         */
        data(): Api;

        /**
         * Get the data source property for the selected column
         */
        dataSrc(): number | string | (() => string);

        /**
         * Get index information about the selected cell
         *
         * @param t Specify if you want to get the column data index (default) or the visible index (visible).
         */
        index(t?: string): number;

        /**
         * Obtain the th / td nodes for the selected column
         */
        nodes(): Api;
    }

    interface ColumnsMethodsModel {
        /**
         * Select all columns
         *
         * @param Option used to specify how the cells should be ordered, and if paging or filtering in the table should be taken into account.
         */
        (modifier?: ObjectSelectorModifier): ColumnsMethods;

        /**
         * Select columns found by a cell selector
         *
         * @param cellSelector Cell selector.
         * @param Option used to specify how the cells should be ordered, and if paging or filtering in the table should be taken into account.
         */
        (columnSelector: any, modifier?: ObjectSelectorModifier): ColumnsMethods;

        /**
         * Recalculate the column widths for layout.
         */
        adjust(): Api;
    }

    interface ColumnsMethods extends CoreMethods, CommonColumnMethod {
        /**
         * Obtain the data for the columns from the selector
         */
        data(): Api;

        /**
         * Get the data source property for the selected columns.
         */
        dataSrc(): Api;

        /**
         * Iterate over each selected column, with the function context set to be the column in question. Since: DataTables 1.10.6
         *
         * @param fn Function to execute for every column selected.
         */
        every(fn: (this: ColumnMethods, colIdx: number, tableLoop: number, colLoop: number) => void): Api;

        /**
         * Get the column indexes of the selected columns.
         *
         * @param t Specify if you want to get the column data index (default) or the visible index (visible).
         */
        indexes(t?: string): Api;

        /**
         * Obtain the th / td nodes for the selected columns
         */
        nodes(): Api[][];
    }
    //#endregion "column-methods"

    //#region "row-methods"

    interface CommonRowMethod extends CommonSubMethods {
        /**
         * Obtain the th / td nodes for the selected column
         *
         * @param source Data source to read the new data from. Values: 'auto', 'data', 'dom'
         */
        invalidate(source?: string): Api;
    }

    interface RowChildMethodModel {
        /**
         * Get the child row(s) that have been set for a parent row
         */
        (): JQuery;

        /**
         * Get the child row(s) that have been set for a parent row
         *
         * @param showRemove This parameter can be given as true or false
         */
        (showRemove: boolean): RowChildMethods;

        /**
         * Set the data to show in the child row(s). Note that calling this method will replace any child rows which are already attached to the parent row.
         *
         * @param data The data to be shown in the child row can be given in multiple different ways.
         * @param className Class name that is added to the td cell node(s) of the child row(s). As of 1.10.1 it is also added to the tr row node of the child row(s).
         */
        (data: (string | Node | JQuery) | Array<(string | number | JQuery)>, className?: string): RowChildMethods;

        /**
         * Hide the child row(s) of a parent row
         */
        hide(): Api;

        /**
         * Check if the child rows of a parent row are visible
         */
        isShown(): Api;

        /**
         * Remove child row(s) from display and release any allocated memory
         */
        remove(): Api;

        /**
         * Show the child row(s) of a parent row
         */
        show(): Api;
    }

    interface RowChildMethods extends CoreMethods {
        /**
         * Hide the child row(s) of a parent row
         */
        hide(): Api;

        /**
         * Remove child row(s) from display and release any allocated memory
         */
        remove(): Api;

        /**
         * Make newly defined child rows visible
         */
        show(): Api;
    }

    interface RowMethodsModel {
        /**
         * Select a row found by a row selector
         *
         * @param rowSelector Row selector.
         * @param Option used to specify how the cells should be ordered, and if paging or filtering in the table should be taken into account.
         */
        (rowSelector: any, modifier?: ObjectSelectorModifier): RowMethods;

        /**
         * Add a new row to the table using the given data
         *
         * @param data Data to use for the new row. This may be an array, object or Javascript object instance, but must be in the same format as the other data in the table
         */
        add(data: any[] | object): Api;
    }

    interface RowMethods extends CoreMethods, CommonRowMethod {
        /**
         * Order Methods / object
         */
        child: RowChildMethodModel;

        /**
         * Get the data for the selected row
         */
        data(): any[] | object;

        /**
         * Set the data for the selected row
         *
         * @param d Data to use for the row.
         */
        data(d: any[] | object): Api;

        /**
         * Get the id of the selected row. Since: 1.10.8
         *
         * @param hash true - Append a hash (#) to the start of the row id. This can be useful for then using the id as a selector
         * false - Do not modify the id value.
         * @returns Row id. If the row does not have an id available 'undefined' will be returned.
         */
        id(hash?: boolean): string;

        /**
         * Get the row index of the row column.
         */
        index(): number;

        /**
         * Obtain the tr node for the selected row
         */
        node(): Node;

        /**
         * Delete the selected row from the DataTable.
         */
        remove(): Node;
    }

    interface RowsMethodsModel {
        /**
         * Select all rows
         *
         * @param Option used to specify how the cells should be ordered, and if paging or filtering in the table should be taken into account.
         */
        (modifier?: ObjectSelectorModifier): RowsMethods;

        /**
         * Select rows found by a row selector
         *
         * @param cellSelector Row selector.
         * @param Option used to specify how the cells should be ordered, and if paging or filtering in the table should be taken into account.
         */
        (rowSelector: any, modifier?: ObjectSelectorModifier): RowsMethods;

        /**
         * Add new rows to the table using the data given
         *
         * @param data Array of data elements, with each one describing a new row to be added to the table
         */
        add(data: any[]): Api;
    }

    interface RowsMethods extends CoreMethods, CommonRowMethod {
        /**
         * Get / Set the data for the selected row
         *
         * @param d Data to use for the row.
         */
        data(d?: any[] | object): Api;

        /**
         * Iterate over each selected row, with the function context set to be the row in question. Since: DataTables 1.10.6
         *
         * @param fn Function to execute for every row selected.
         */
        every(fn: (this: RowMethods, rowIdx: number, tableLoop: number, rowLoop: number) => void): Api;

        /**
         * Get the ids of the selected rows. Since: 1.10.8
         *
         * @param hash true - Append a hash (#) to the start of each row id. This can be useful for then using the ids as selectors
         * false - Do not modify the id value.
         * @returns Api instance with the selected rows in its result set. If a row does not have an id available 'undefined' will be returned as the value.
         */
        ids(hash?: boolean): Api;

        /**
         * Get the row indexes of the selected rows.
         */
        indexes(): Api;

        /**
         * Obtain the tr nodes for the selected rows
         */
        nodes(): Api;

        /**
         * Delete the selected rows from the DataTable.
         */
        remove(): Api;
    }
    //#endregion "row-methods"

    //#region "table-methods"

    interface TableMethods extends CoreMethods {
        /**
         * Get the tfoot node for the table in the API's context
         */
        footer(): Node;

        /**
         * Get the thead node for the table in the API's context
         */
        header(): Node;

        /**
         * Get the tbody node for the table in the API's context
         */
        body(): Node;

        /**
         * Get the div container node for the table in the API's context
         */
        container(): Node;

        /**
         * Get the table node for the table in the API's context
         */
        node(): Node;
    }

    interface TablesMethods extends CoreMethods {
        /**
         * Get the tfoot nodes for the tables in the API's context
         */
        footer(): Api;

        /**
         * Get the thead nodes for the tables in the API's context
         */
        header(): Api;

        /**
         * Get the tbody nodes for the tables in the API's context
         */
        body(): Api;

        /**
         * Get the div container nodes for the tables in the API's context
         */
        containers(): Api;

        /**
         * Get the table nodes for the tables in the API's context
         */
        nodes(): Api;
    }
    //#endregion "table-methods"

    //#endregion "Namespaces"

    //#region "Static-Methods"

    interface StaticFunctions {
        /**
         * Returns JQuery object
         *
         * Usage:
         * $( selector ).dataTable();
         */
        (): JQueryDataTables;

        /**
         * Check if a table node is a DataTable already or not.
         *
         * Usage:
         * $.fn.dataTable.isDataTable("selector");
         * @param table The table to check.
         */
        isDataTable(table: string | Node | JQuery | Api): boolean;

        /**
         * Helpers for `columns.render`.
         *
         * The options defined here can be used with the `columns.render` initialisation
         * option to provide a display renderer.
         */
        render: StaticRenderFunctions;

        /**
         * Get all DataTable tables that have been initialised - optionally you can select to get only currently visible tables and / or retrieve the tables as API instances.
         *
         * @param visible As a boolean value this options is used to indicate if you want all tables on the page should be returned (false), or visible tables only (true).
         * Since 1.10.8 this option can also be given as an object.
         */
        tables(visible?: boolean | objectTablesStatic): Api[] | Api;

        /**
         * Version number compatibility check function
         *
         * Usage:
         * $.fn.dataTable.versionCheck("1.10.0");
         * @param version Version string
         */
        versionCheck(version: string): boolean;

        /**
         * Utils
         */
        util: StaticUtilFunctions;

        /**
         * Get DataTable API instance
         *
         * @param table Selector string for table
         */
        Api: new (selector: string | Node | Node[] | JQuery | SettingsLegacy) => Api;

        /**
         * Default Settings
         */
        defaults: Settings;

        /**
         * Default Settings
         */
        ext: ExtSettings;
    }

    interface ObjectOrderFixed {
        /**
         * Two-element array:
         * 0: Column index to order upon.
         * 1: Direction so order to apply ("asc" for ascending order or "desc" for descending order).
         */
        pre?: any[];
        /**
         * Two-element array:
         * 0: Column index to order upon.
         * 1: Direction so order to apply ("asc" for ascending order or "desc" for descending order).
         */
        post?: any[];
    }

    interface StaticRenderFunctions {
        /**
         * Will format numeric data (defined by `columns.data`) for display, retaining the original unformatted data for sorting and filtering.
         *
         * @param thousands Thousands grouping separator.
         * @param decimal Decimal point indicator.
         * @param precision Integer number of decimal points to show.
         * @param prefix Prefix (optional).
         * @param postfix Postfix (/suffix) (optional).
         */
        number(thousands: string, decimal: string, precision: number, prefix?: string, postfix?: string): ObjectColumnRender;
        /**
         * Escape HTML to help prevent XSS attacks. It has no optional parameters.
         */
        text(): ObjectColumnRender;
    }

    interface StaticUtilFunctions {
        /**
         * Escape special characters in a regular expression string. Since: 1.10.4
         *
         * @param str String to escape
         */
        escapeRegex(str: string): string;

        /**
         * Throttle the calls to a method to reduce call frequency. Since: 1.10.3
         *
         * @param fn Function
         * @param period ms
         */
        throttle(fn: FunctionThrottle, period?: number): (() => void);
    }

    type FunctionThrottle = (data: any) => void;

    interface objectTablesStatic {
        /**
         * Get only visible tables (true) or all tables regardless of visibility (false).
         */
        visible: boolean;

        /**
         * Return a DataTables API instance for the selected tables (true) or an array (false).
         */
        api: boolean;
    }

    //#endregion "Static-Methods"

    //#region "Settings"

    interface Settings {
        //#region "Features"

        /**
         * Feature control DataTables' smart column width handling. Since: 1.10
         */
        autoWidth?: boolean;

        /**
         * Feature control deferred rendering for additional speed of initialisation. Since: 1.10
         */
        deferRender?: boolean;

        /**
         * Feature control table information display field. Since: 1.10
         */
        info?: boolean;

        /**
         * Use markup and classes for the table to be themed by jQuery UI ThemeRoller. Since: 1.10
         */
        jQueryUI?: boolean;

        /**
         * Feature control the end user's ability to change the paging display length of the table. Since: 1.10
         */
        lengthChange?: boolean;

        /**
         * Feature control ordering (sorting) abilities in DataTables. Since: 1.10
         */
        ordering?: boolean;

        /**
         * Enable or disable table pagination. Since: 1.10
         */
        paging?: boolean;

        /**
         * Feature control the processing indicator. Since: 1.10
         */
        processing?: boolean;

        /**
         * Horizontal scrolling. Since: 1.10
         */
        scrollX?: boolean;

        /**
         * Vertical scrolling. Since: 1.10 Exp: "200px"
         */
        scrollY?: string;

        /**
         * Feature control search (filtering) abilities Since: 1.10
         */
        searching?: boolean;

        /**
         * Feature control DataTables' server-side processing mode. Since: 1.10
         */
        serverSide?: boolean;

        /**
         * State saving - restore table state on page reload. Since: 1.10
         */
        stateSave?: boolean;

        //#endregion "Features"

        //#region "Data"

        /**
         * Load data for the table's content from an Ajax source. Since: 1.10
         */
        ajax?: string | AjaxSettings | FunctionAjax;

        /**
         * Data to use as the display data for the table. Since: 1.10
         */
        data?: any[];

        //#endregion "Data"

        //#region "Options"

        /**
         * Data to use as the display data for the table. Since: 1.10
         */
        columns?: ColumnSettings[];

        /**
         * Assign a column definition to one or more columns.. Since: 1.10
         */
        columnDefs?: ColumnDefsSettings[];

        /**
         * Delay the loading of server-side data until second draw
         */
        deferLoading?: number | number[];

        /**
         * Destroy any existing table matching the selector and replace with the new options. Since: 1.10
         */
        destroy?: boolean;

        /**
         * Initial paging start point. Since: 1.10
         */
        displayStart?: number;

        /**
         * Define the table control elements to appear on the page and in what order. Since: 1.10
         */
        dom?: string;

        /**
         * Change the options in the page length select list. Since: 1.10
         */
        lengthMenu?: Array<(number | string)> | Array<Array<(number | string)>>;

        /**
         * Control which cell the order event handler will be applied to in a column. Since: 1.10
         */
        orderCellsTop?: boolean;

        /**
         * Highlight the columns being ordered in the table's body. Since: 1.10
         */
        orderClasses?: boolean;

        /**
         * Initial order (sort) to apply to the table. Since: 1.10
         */
        order?: Array<(number | string)> | Array<Array<(number | string)>>;

        /**
         * Ordering to always be applied to the table. Since: 1.10
         */
        orderFixed?: Array<(number | string)> | Array<Array<(number | string)>> | object;

        /**
         * Multiple column ordering ability control. Since: 1.10
         */
        orderMulti?: boolean;

        /**
         * Change the initial page length (number of rows per page). Since: 1.10
         */
        pageLength?: number;

        /**
         * Pagination button display options. Basic Types: numbers (1.10.8) simple, simple_numbers, full, full_numbers
         */
        pagingType?: string;

        /**
         * Retrieve an existing DataTables instance. Since: 1.10
         */
        retrieve?: boolean;

        /**
         * Display component renderer types. Since: 1.10
         */
        renderer?: string | RendererSettings;

        /**
         * Data property name that DataTables will use to set <tr> element DOM IDs. Since: 1.10.8
         */
        rowId?: string;

        /**
         * Allow the table to reduce in height when a limited number of rows are shown. Since: 1.10
         */
        scrollCollapse?: boolean;

        /**
         * Set an initial filter in DataTables and / or filtering options. Since: 1.10
         */
        search?: SearchSettings | boolean;

        /**
         * Set placeholder attribute for input type="text" tag elements. Since: 1.10
         */
        searchPlaceholder?: SearchSettings;

        /**
         * Define an initial search for individual columns. Since: 1.10
         */
        searchCols?: SearchSettings[];

        /**
         * Set a throttle frequency for searching. Since: 1.10
         */
        searchDelay?: number;

        /**
         * Saved state validity duration. Since: 1.10
         */
        stateDuration?: number;

        /**
         * Set the zebra stripe class names for the rows in the table. Since: 1.10
         */
        stripeClasses?: string[];

        /**
         * Tab index control for keyboard navigation. Since: 1.10
         */
        tabIndex?: number;

        /**
         * Enable or disable datatables responsive. Since: 1.10
         */
        responsive?: boolean | object;

        //#endregion "Options"

        //#region "Callbacks"

        /**
         * Callback for whenever a TR element is created for the table's body. Since: 1.10
         */
        createdRow?: FunctionCreateRow;

        /**
         * Function that is called every time DataTables performs a draw. Since: 1.10
         */
        drawCallback?: FunctionDrawCallback;

        /**
         * Footer display callback function. Since: 1.10
         */
        footerCallback?: FunctionFooterCallback;

        /**
         * Number formatting callback function. Since: 1.10
         */
        formatNumber?: FunctionFormatNumber;

        /**
         * Header display callback function. Since: 1.10
         */
        headerCallback?: FunctionHeaderCallback;

        /**
         * Table summary information display callback. Since: 1.10
         */
        infoCallback?: FunctionInfoCallback;

        /**
         * Initialisation complete callback. Since: 1.10
         */
        initComplete?: FunctionInitComplete;

        /**
         * Pre-draw callback. Since: 1.10
         */
        preDrawCallback?: FunctionPreDrawCallback;

        /**
         * Row draw callback.. Since: 1.10
         */
        rowCallback?: FunctionRowCallback;

        /**
         * Callback that defines where and how a saved state should be loaded. Since: 1.10
         */
        stateLoadCallback?: FunctionStateLoadCallback;

        /**
         * State loaded callback. Since: 1.10
         */
        stateLoaded?: FunctionStateLoaded;

        /**
         * State loaded - data manipulation callback. Since: 1.10
         */
        stateLoadParams?: FunctionStateLoadParams;

        /**
         * Callback that defines how the table state is stored and where. Since: 1.10
         */
        stateSaveCallback?: FunctionStateSaveCallback;

        /**
         * State save - data manipulation callback. Since: 1.10
         */
        stateSaveParams?: FunctionStateSaveParams;

        //#endregion "Callbacks"

        //#region "Language"

        language?: LanguageSettings;

        //#endregion "Language"
    }

    //#region "ajax-settings"

    interface AjaxDataRequest {
        draw: number;
        start: number;
        length: number;
        data: any;
        order: AjaxDataRequestOrder[];
        columns: AjaxDataRequestColumn[];
        search: AjaxDataRequestSearch;
    }

    interface AjaxDataRequestSearch {
        value: string;
        regex: boolean;
    }

    interface AjaxDataRequestOrder {
        column: number;
        dir: string;
    }

    interface AjaxDataRequestColumn {
        data: string | number;
        name: string;
        searchable: boolean;
        orderable: boolean;
        search: AjaxDataRequestSearch;
    }

    interface AjaxData {
        draw?: number;
        recordsTotal?: number;
        recordsFiltered?: number;
        data: any;
        error?: string;
    }

    interface AjaxSettings extends JQueryAjaxSettings {
        /**
         * Add or modify data submitted to the server upon an Ajax request. Since: 1.10
         */
        data?: object | FunctionAjaxData;

        /**
         * Data property or manipulation method for table data. Since: 1.10
         */
        dataSrc?: string | ((data: any) => any[]);
    }

    type FunctionAjax = (data: object, callback: ((data: any) => void), settings: SettingsLegacy) => void;

    type FunctionAjaxData = (data: object, settings: Settings) => string | object;

    //#endregion "ajax-settings"

    //#region "colunm-settings"

    interface ColumnSettings {
        /**
         * Cell type to be created for a column. th/td Since: 1.10
         */
        cellType?: string;

        /**
         * Class to assign to each cell in the column. Since: 1.10
         */
        className?: string;

        /**
         * Add padding to the text content used when calculating the optimal with for a table. Since: 1.10
         */
        contentPadding?: string;

        /**
         * Cell created callback to allow DOM manipulation. Since: 1.10
         */
        createdCell?: FunctionColumnCreatedCell;

        /**
         * Class to assign to each cell in the column. Since: 1.10
         */
        data?: number | string | ObjectColumnData | FunctionColumnData | null;

        /**
         * Set default, static, content for a column. Since: 1.10
         */
        defaultContent?: string;

        /**
         * Set a descriptive name for a column. Since: 1.10
         */
        name?: string;

        /**
         * Enable or disable ordering on this column. Since: 1.10
         */
        orderable?: boolean;

        /**
         * Define multiple column ordering as the default order for a column. Since: 1.10
         */
        orderData?: number | number[];

        /**
         * Live DOM sorting type assignment. Since: 1.10
         */
        orderDataType?: string;

        /**
         * Ordering to always be applied to the table. Since 1.10
         *
         * Array type is prefix ordering only and is a two-element array:
         * 0: Column index to order upon.
         * 1: Direction so order to apply ("asc" for ascending order or "desc" for descending order).
         */
        orderFixed?: any[] | ObjectOrderFixed;

        /**
         * Order direction application sequence. Since: 1.10
         */
        orderSequence?: string[];

        /**
         * Render (process) the data for use in the table. Since: 1.10
         */
        render?: number | string | ObjectColumnData | FunctionColumnRender | ObjectColumnRender;

        /**
         * Enable or disable filtering on the data in this column. Since: 1.10
         */
        searchable?: boolean;

        /**
         * Set the column title. Since: 1.10
         */
        title?: string;

        /**
         * Set the column type - used for filtering and sorting string processing. Since: 1.10
         */
        type?: string;

        /**
         * Enable or disable the display of this column. Since: 1.10
         */
        visible?: boolean;

        /**
         * Column width assignment. Since: 1.10
         */
        width?: string;
    }

    interface ColumnDefsSettings extends ColumnSettings {
        targets: string | number | Array<(number | string)>;
    }

    type FunctionColumnCreatedCell = (cell: Node, cellData: any, rowData: any, row: number, col: number) => void;

    interface FunctionColumnData {
        (row: any, t: 'set', s: any, meta: CellMetaSettings): void;
        (row: any, t: 'display' | 'sort' | 'filter' | 'type', s: undefined, meta: CellMetaSettings): any;
    }

    interface ObjectColumnData {
        _: string | number | FunctionColumnData;
        filter?: string | number | FunctionColumnData;
        display?: string | number | FunctionColumnData;
        type?: string | number | FunctionColumnData;
        sort?: string | number | FunctionColumnData;
    }

    type FunctionColumnRender = (data: any, type: any, row: any, meta: CellMetaSettings) => any;

    interface ObjectColumnRender {
        _?: string | number | FunctionColumnRender;
        filter?: string | number | FunctionColumnRender;
        display?: string | number | FunctionColumnRender;
        type?: string | number | FunctionColumnRender;
        sort?: string | number | FunctionColumnRender;
    }

    interface CellMetaSettings {
        row: number;
        col: number;
        settings: Settings;
    }

    //#endregion "colunm-settings"

    //#region "other-settings"

    interface RendererSettings {
        header?: string;
        pageButton?: string;
    }

    interface SearchSettings {
        /**
         * Control case-sensitive filtering option. Since: 1.10
         */
        caseInsensitive?: boolean;

        /**
         * Enable / disable escaping of regular expression characters in the search term. Since: 1.10
         */
        regex?: boolean;

        /**
         * Enable / disable DataTables' smart filtering. Since: 1.10
         */
        smart?: boolean;

        /**
         * Set an initial filtering condition on the table. Since: 1.10
         */
        search?: string;

        /**
         * Set a placeholder attribute for input type="text" tag elements. Since: 1.10.1
         */
        searchPlaceholder?: string;
    }

    //#endregion "other-settings"

    //#region "callback-functions"

    type FunctionCreateRow = (row: Node, data: any[] | object, dataIndex: number) => void;

    type FunctionDrawCallback = (settings: SettingsLegacy) => void;

    type FunctionFooterCallback = (tfoot: Node, data: any[], start: number, end: number, display: any[]) => void;

    type FunctionFormatNumber = (formatNumber: number) => void;

    type FunctionHeaderCallback = (thead: Node, data: any[], start: number, end: number, display: any[]) => void;

    type FunctionInfoCallback = (settings: SettingsLegacy, start: number, end: number, mnax: number, total: number, pre: string) => void;

    type FunctionInitComplete = (settings: SettingsLegacy, json: object) => void;

    type FunctionPreDrawCallback = (settings: SettingsLegacy) => void;

    type FunctionRowCallback = (row: Node, data: any[] | object, index: number) => void;

    type FunctionStateLoadCallback = (settings: SettingsLegacy) => void;

    type FunctionStateLoaded = (settings: SettingsLegacy, data: object) => void;

    type FunctionStateLoadParams = (settings: SettingsLegacy, data: object) => void;

    type FunctionStateSaveCallback = (settings: SettingsLegacy, data: object) => void;

    type FunctionStateSaveParams = (settings: SettingsLegacy, data: object) => void;

    //#endregion "callback-functions"

    //#region "language-settings"

    // these are all optional
    interface LanguageSettings {
        emptyTable?: string;
        info?: string;
        infoEmpty?: string;
        infoFiltered?: string;
        infoPostFix?: string;
        decimal?: string;
        thousands?: string;
        lengthMenu?: string;
        loadingRecords?: string;
        processing?: string;
        search?: string;
        searchPlaceholder?: string;
        zeroRecords?: string;
        paginate?: LanguagePaginateSettings;
        aria?: LanguageAriaSettings;
        url?: string;
    }

    interface LanguagePaginateSettings {
        first: string;
        last: string;
        next: string;
        previous: string;
    }

    interface LanguageAriaSettings {
        sortAscending: string;
        sortDescending: string;
        paginate?: LanguagePaginateSettings;
    }

    //#endregion "language-settings"

    //#endregion "Settings"

    //#region "SettingsLegacy"

    interface ArrayStringNode {
        [index: string]: Node;
    }

    interface SettingsLegacy {
        ajax: any;
        oApi: any;
        oFeatures: FeaturesLegacy;
        oScroll: ScrollingLegacy;
        oLanguage: LanguageLegacy; // | { fnInfoCallback: FunctionInfoCallback; };
        oBrowser: BrowserLegacy;
        aanFeatures: ArrayStringNode[][];
        aoData: RowLegacy[];
        aIds: any;
        aiDisplay: number[];
        aiDisplayMaster: number[];
        aoColumns: ColumnLegacy[];
        aoHeader: any[];
        aoFooter: any[];
        asDataSearch: string[];
        oPreviousSearch: any;
        aoPreSearchCols: any[];
        aaSorting: any[][];
        aaSortingFixed: any[][];
        asStripeClasses: string[];
        asDestroyStripes: string[];
        sDestroyWidth: number;
        aoRowCallback: FunctionRowCallback[];
        aoHeaderCallback: FunctionHeaderCallback[];
        aoFooterCallback: FunctionFooterCallback[];
        aoDrawCallback: FunctionDrawCallback[];
        aoRowCreatedCallback: FunctionCreateRow[];
        aoPreDrawCallback: FunctionPreDrawCallback[];
        aoInitComplete: FunctionInitComplete[];
        aoStateSaveParams: FunctionStateSaveParams[];
        aoStateLoadParams: FunctionStateLoadParams[];
        aoStateLoaded: FunctionStateLoaded[];
        sTableId: string;
        nTable: Node;
        nTHead: Node;
        nTFoot: Node;
        nTBody: Node;
        nTableWrapper: Node;
        bDeferLoading: boolean;
        bInitialized: boolean;
        aoOpenRows: any[];
        sDom: string;
        sPaginationType: string;
        iCookieDuration: number;
        sCookiePrefix: string;
        fnCookieCallback: CookieCallbackLegacy;
        aoStateSave: FunctionStateSaveCallback[];
        aoStateLoad: FunctionStateLoadCallback[];
        oLoadedState: any;
        sAjaxSource: string;
        sAjaxDataProp: string;
        bAjaxDataGet: boolean;
        jqXHR: any;
        fnServerData: any;
        aoServerParams: any[];
        sServerMethod: string;
        fnFormatNumber: FunctionFormatNumber;
        aLengthMenu: any[];
        iDraw: number;
        bDrawing: boolean;
        iDrawError: number;
        _iDisplayLength: number;
        _iDisplayStart: number;
        _iDisplayEnd: number;
        _iRecordsTotal: number;
        _iRecordsDisplay: number;
        bJUI: boolean;
        oClasses: any;
        bFiltered: boolean;
        bSorted: boolean;
        bSortCellsTop: boolean;
        oInit: any;
        aoDestroyCallback: any[];
        fnRecordsTotal(): number;
        fnRecordsDisplay(): number;
        fnDisplayEnd(): number;
        oInstance: any;
        sInstance: string;
        iTabIndex: number;
        nScrollHead: Node;
        nScrollFoot: Node;
        rowIdFn(mSource: string | number | (() => void)): (() => void);
    }

    interface BrowserLegacy {
        barWidth: number;
        bBounding: boolean;
        bScrollbarLeft: boolean;
        bScrollOversize: boolean;
    }

    interface FeaturesLegacy {
        bAutoWidth: boolean;
        bDeferRender: boolean;
        bFilter: boolean;
        bInfo: boolean;
        bLengthChange: boolean;
        bPaginate: boolean;
        bProcessing: boolean;
        bServerSide: boolean;
        bSort: boolean;
        bSortClasses: boolean;
        bStateSave: boolean;
    }

    interface ScrollingLegacy {
        bAutoCss: boolean;
        bCollapse: boolean;
        bInfinite: boolean;
        iBarWidth: number;
        iLoadGap: number;
        sX: string;
        sY: string;
    }

    interface RowLegacy {
        nTr: Node;
        _aData: any;
        _aSortData: any[];
        _anHidden: Node[];
        _sRowStripe: string;
    }

    interface ColumnLegacy {
        idx: number;
        aDataSort: any;
        asSorting: string[];
        bSearchable: boolean;
        bSortable: boolean;
        bVisible: boolean;
        _bAutoType: boolean;
        fnCreatedCell: FunctionColumnCreatedCell;
        fnGetData(data: any, specific: string): any;
        fnSetData(data: any, value: any): void;
        mData: any;
        mRender: any;
        nTh: Node;
        nIf: Node;
        sClass: string;
        sContentPadding: string;
        sDefaultContent: string;
        sName: string;
        sSortDataType: string;
        sSortingClass: string;
        sSortingClassJUI: string;
        sTitle: string;
        sType: string;
        sWidth: string;
        sWidthOrig: string;
    }

    type CookieCallbackLegacy = (name: string, data: any, expires: string, path: string, cookie: string) => void;

    interface LanguageLegacy {
        oAria?: LanguageAriaLegacy;
        oPaginate?: LanguagePaginateLegacy;
        sEmptyTable?: string;
        sInfo?: string;
        sInfoEmpty?: string;
        sInfoFiltered?: string;
        sInfoPostFix?: string;
        sInfoThousands?: string;
        sLengthMenu?: string;
        sLoadingRecords?: string;
        sProcessing?: string;
        sSearch?: string;
        sUrl?: string;
        sZeroRecords?: string;
    }

    interface LanguageAriaLegacy {
        sSortAscending?: string;
        sSortDescending?: string;
    }

    interface LanguagePaginateLegacy {
        sFirst?: string;
        sLast?: string;
        sNext?: string;
        sPrevious?: string;
    }
    //#endregion "SettingsLegacy"

    //#region "ext internal"

    interface ExtSettings {
        aTypes: any[];
        afnFiltering: any[];
        afnSortData: object;
        aoFeatures: any[];
        builder: string;
        classes: ExtClassesSettings;
        errMode: string;
        feature: any[];
        fnVersionCheck(version: string): string;
        iApiIndex: number;
        internal: object;
        legacy: object;
        oApi: object;
        oJUIClasses: object;
        oPagination: object;
        oSort: object;
        oStdClasses: ExtClassesSettings;
        ofnSearch: object;
        order: object;
        pager: object;
        renderer: object;
        sVersion: string;
        search: any[];
        selector: object;
        /**
         * Type based plug-ins.
         */
        type: ExtTypeSettings;
    }

    interface ExtClassesSettings {
        /**
         * Default Value:
         * dataTable
         */
        sTable?: string;

        /**
         * Default Value:
         * no-footer
         */
        sNoFooter?: string;

        /**
         * Default Value:
         * paginate_button
         */
        sPageButton?: string;

        /**
         * Default Value:
         * current
         */
        sPageButtonActive?: string;

        /**
         * Default Value:
         * disabled
         */
        sPageButtonDisabled?: string;

        /**
         * Default Value:
         * odd
         */
        sStripeOdd?: string;

        /**
         * Default Value:
         * even
         */
        sStripeEven?: string;

        /**
         * Default Value:
         * dataTables_empty
         */
        sRowEmpty?: string;

        /**
         * Default Value:
         * dataTables_wrapper
         */
        sWrapper?: string;

        /**
         * Default Value:
         * dataTables_filter
         */
        sFilter?: string;

        /**
         * Default Value:
         * dataTables_info
         */
        sInfo?: string;

        /**
         * Default Value:
         * dataTables_paginate paging_
         */
        sPaging?: string;

        /**
         * Default Value:
         * dataTables_length
         */
        sLength?: string;

        /**
         * Default Value:
         * dataTables_processing
         */
        sProcessing?: string;

        /**
         * Default Value:
         * sorting_asc
         */
        sSortAsc?: string;

        /**
         * Default Value:
         * sorting_desc
         */
        sSortDesc?: string;

        /**
         * Default Value:
         * sorting
         */
        sSortable?: string;

        /**
         * Default Value:
         * sorting_asc_disabled
         */
        sSortableAsc?: string;

        /**
         * Default Value:
         * sorting_desc_disabled
         */
        sSortableDesc?: string;

        /**
         * Default Value:
         * sorting_disabled
         */
        sSortableNone?: string;

        /**
         * Default Value:
         * sorting_
         */
        sSortColumn?: string;

        sFilterInput?: string;
        sLengthSelect?: string;

        /**
         * Default Value:
         * dataTables_scroll
         */
        sScrollWrapper?: string;

        /**
         * Default Value:
         * dataTables_scrollHead
         */
        sScrollHead?: string;

        /**
         * Default Value:
         * dataTables_scrollHeadInner
         */
        sScrollHeadInner?: string;

        /**
         * Default Value:
         * dataTables_scrollBody
         */
        sScrollBody?: string;

        /**
         * Default Value:
         * dataTables_scrollFoot
         */
        sScrollFoot?: string;

        /**
         * Default Value:
         * dataTables_scrollFootInner
         */
        sScrollFootInner?: string;

        sHeaderTH?: string;
        sFooterTH?: string;
        sSortJUIAsc?: string;
        sSortJUIDesc?: string;
        sSortJUI?: string;
        sSortJUIAscAllowed?: string;
        sSortJUIDescAllowed?: string;
        sSortJUIWrapper?: string;
        sSortIcon?: string;
        sJUIHeader?: string;
        sJUIFooter?: string;
    }
    //#endregion "ext internal"

    interface ExtTypeSettings {
        /**
         * Type detection functions for plug-in development.
         *
         * @see https://datatables.net/manual/plug-ins/type-detection
         */
        detect: FunctionExtTypeSettingsDetect[];
        /**
         * Type based ordering functions for plug-in development.
         *
         * @see https://datatables.net/manual/plug-ins/sorting
         * @default {}
         */
        order: object;
        /**
         * Type based search formatting for plug-in development.
         *
         * @default {}
         * @example
         *   $.fn.dataTable.ext.type.search['title-numeric'] = function ( d ) {
         *     return d.replace(/\n/g," ").replace( /<.*?>/g, "" );
         *   }
         */
        search: object;
    }

    /**
     * @param data Data from the column cell to be analysed.
     * @param DataTables settings object.
     */
    type FunctionExtTypeSettingsDetect = (data: any, settings: Settings) => (string | null);
}
