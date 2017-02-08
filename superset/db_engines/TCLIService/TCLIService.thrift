// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Coding Conventions for this file:
//
// Structs/Enums/Unions
// * Struct, Enum, and Union names begin with a "T",
//   and use a capital letter for each new word, with no underscores.
// * All fields should be declared as either optional or required.
//
// Functions
// * Function names start with a capital letter and have a capital letter for
//   each new word, with no underscores.
// * Each function should take exactly one parameter, named TFunctionNameReq,
//   and should return either void or TFunctionNameResp. This convention allows
//   incremental updates.
//
// Services
// * Service names begin with the letter "T", use a capital letter for each
//   new word (with no underscores), and end with the word "Service".

namespace py impala._thrift_gen.TCLIService
namespace java org.apache.hive.service.cli.thrift
namespace cpp apache.hive.service.cli.thrift

// List of protocol versions. A new token should be
// added to the end of this list every time a change is made.
enum TProtocolVersion {
  HIVE_CLI_SERVICE_PROTOCOL_V1,

  // V2 adds support for asynchronous execution
  HIVE_CLI_SERVICE_PROTOCOL_V2

  // V3 add varchar type, primitive type qualifiers
  HIVE_CLI_SERVICE_PROTOCOL_V3

  // V4 add decimal precision/scale, char type
  HIVE_CLI_SERVICE_PROTOCOL_V4

  // V5 adds error details when GetOperationStatus returns in error state
  HIVE_CLI_SERVICE_PROTOCOL_V5

  // V6 uses binary type for binary payload (was string) and uses columnar result set
  HIVE_CLI_SERVICE_PROTOCOL_V6

  // V7 adds support for delegation token based connection
  HIVE_CLI_SERVICE_PROTOCOL_V7
}

enum TTypeId {
  BOOLEAN_TYPE,
  TINYINT_TYPE,
  SMALLINT_TYPE,
  INT_TYPE,
  BIGINT_TYPE,
  FLOAT_TYPE,
  DOUBLE_TYPE,
  STRING_TYPE,
  TIMESTAMP_TYPE,
  BINARY_TYPE,
  ARRAY_TYPE,
  MAP_TYPE,
  STRUCT_TYPE,
  UNION_TYPE,
  USER_DEFINED_TYPE,
  DECIMAL_TYPE,
  NULL_TYPE,
  DATE_TYPE,
  VARCHAR_TYPE,
  CHAR_TYPE
}

const set<TTypeId> PRIMITIVE_TYPES = [
  TTypeId.BOOLEAN_TYPE,
  TTypeId.TINYINT_TYPE,
  TTypeId.SMALLINT_TYPE,
  TTypeId.INT_TYPE,
  TTypeId.BIGINT_TYPE,
  TTypeId.FLOAT_TYPE,
  TTypeId.DOUBLE_TYPE,
  TTypeId.STRING_TYPE,
  TTypeId.TIMESTAMP_TYPE,
  TTypeId.BINARY_TYPE,
  TTypeId.DECIMAL_TYPE,
  TTypeId.NULL_TYPE,
  TTypeId.DATE_TYPE,
  TTypeId.VARCHAR_TYPE,
  TTypeId.CHAR_TYPE
]

const set<TTypeId> COMPLEX_TYPES = [
  TTypeId.ARRAY_TYPE
  TTypeId.MAP_TYPE
  TTypeId.STRUCT_TYPE
  TTypeId.UNION_TYPE
  TTypeId.USER_DEFINED_TYPE
]

const set<TTypeId> COLLECTION_TYPES = [
  TTypeId.ARRAY_TYPE
  TTypeId.MAP_TYPE
]

const map<TTypeId,string> TYPE_NAMES = {
  TTypeId.BOOLEAN_TYPE: "BOOLEAN",
  TTypeId.TINYINT_TYPE: "TINYINT",
  TTypeId.SMALLINT_TYPE: "SMALLINT",
  TTypeId.INT_TYPE: "INT",
  TTypeId.BIGINT_TYPE: "BIGINT",
  TTypeId.FLOAT_TYPE: "FLOAT",
  TTypeId.DOUBLE_TYPE: "DOUBLE",
  TTypeId.STRING_TYPE: "STRING",
  TTypeId.TIMESTAMP_TYPE: "TIMESTAMP",
  TTypeId.BINARY_TYPE: "BINARY",
  TTypeId.ARRAY_TYPE: "ARRAY",
  TTypeId.MAP_TYPE: "MAP",
  TTypeId.STRUCT_TYPE: "STRUCT",
  TTypeId.UNION_TYPE: "UNIONTYPE",
  TTypeId.DECIMAL_TYPE: "DECIMAL",
  TTypeId.NULL_TYPE: "NULL"
  TTypeId.DATE_TYPE: "DATE"
  TTypeId.VARCHAR_TYPE: "VARCHAR"
  TTypeId.CHAR_TYPE: "CHAR"
}

// Thrift does not support recursively defined types or forward declarations,
// which makes it difficult to represent Hive's nested types.
// To get around these limitations TTypeDesc employs a type list that maps
// integer "pointers" to TTypeEntry objects. The following examples show
// how different types are represented using this scheme:
//
// "INT":
// TTypeDesc {
//   types = [
//     TTypeEntry.primitive_entry {
//       type = INT_TYPE
//     }
//   ]
// }
//
// "ARRAY<INT>":
// TTypeDesc {
//   types = [
//     TTypeEntry.array_entry {
//       object_type_ptr = 1
//     },
//     TTypeEntry.primitive_entry {
//       type = INT_TYPE
//     }
//   ]
// }
//
// "MAP<INT,STRING>":
// TTypeDesc {
//   types = [
//     TTypeEntry.map_entry {
//       key_type_ptr = 1
//       value_type_ptr = 2
//     },
//     TTypeEntry.primitive_entry {
//       type = INT_TYPE
//     },
//     TTypeEntry.primitive_entry {
//       type = STRING_TYPE
//     }
//   ]
// }

typedef i32 TTypeEntryPtr

// Valid TTypeQualifiers key names
const string CHARACTER_MAXIMUM_LENGTH = "characterMaximumLength"

// Type qualifier key name for decimal
const string PRECISION = "precision"
const string SCALE = "scale"

union TTypeQualifierValue {
  1: optional i32 i32Value
  2: optional string stringValue
}

// Type qualifiers for primitive type.
struct TTypeQualifiers {
  1: required map <string, TTypeQualifierValue> qualifiers
}

// Type entry for a primitive type.
struct TPrimitiveTypeEntry {
  // The primitive type token. This must satisfy the condition
  // that type is in the PRIMITIVE_TYPES set.
  1: required TTypeId type
  2: optional TTypeQualifiers typeQualifiers
}

// Type entry for an ARRAY type.
struct TArrayTypeEntry {
  1: required TTypeEntryPtr objectTypePtr
}

// Type entry for a MAP type.
struct TMapTypeEntry {
  1: required TTypeEntryPtr keyTypePtr
  2: required TTypeEntryPtr valueTypePtr
}

// Type entry for a STRUCT type.
struct TStructTypeEntry {
  1: required map<string, TTypeEntryPtr> nameToTypePtr
}

// Type entry for a UNIONTYPE type.
struct TUnionTypeEntry {
  1: required map<string, TTypeEntryPtr> nameToTypePtr
}

struct TUserDefinedTypeEntry {
  // The fully qualified name of the class implementing this type.
  1: required string typeClassName
}

// We use a union here since Thrift does not support inheritance.
union TTypeEntry {
  1: TPrimitiveTypeEntry primitiveEntry
  2: TArrayTypeEntry arrayEntry
  3: TMapTypeEntry mapEntry
  4: TStructTypeEntry structEntry
  5: TUnionTypeEntry unionEntry
  6: TUserDefinedTypeEntry userDefinedTypeEntry
}

// Type descriptor for columns.
struct TTypeDesc {
  // The "top" type is always the first element of the list.
  // If the top type is an ARRAY, MAP, STRUCT, or UNIONTYPE
  // type, then subsequent elements represent nested types.
  1: required list<TTypeEntry> types
}

// A result set column descriptor.
struct TColumnDesc {
  // The name of the column
  1: required string columnName

  // The type descriptor for this column
  2: required TTypeDesc typeDesc

  // The ordinal position of this column in the schema
  3: required i32 position

  4: optional string comment
}

// Metadata used to describe the schema (column names, types, comments)
// of result sets.
struct TTableSchema {
  1: required list<TColumnDesc> columns
}

// A Boolean column value.
struct TBoolValue {
  // NULL if value is unset.
  1: optional bool value
}

// A Byte column value.
struct TByteValue {
  // NULL if value is unset.
  1: optional byte value
}

// A signed, 16 bit column value.
struct TI16Value {
  // NULL if value is unset
  1: optional i16 value
}

// A signed, 32 bit column value
struct TI32Value {
  // NULL if value is unset
  1: optional i32 value
}

// A signed 64 bit column value
struct TI64Value {
  // NULL if value is unset
  1: optional i64 value
}

// A floating point 64 bit column value
struct TDoubleValue {
  // NULL if value is unset
  1: optional double value
}

struct TStringValue {
  // NULL if value is unset
  1: optional string value
}

// A single column value in a result set.
// Note that Hive's type system is richer than Thrift's,
// so in some cases we have to map multiple Hive types
// to the same Thrift type. On the client-side this is
// disambiguated by looking at the Schema of the
// result set.
union TColumnValue {
  1: TBoolValue   boolVal      // BOOLEAN
  2: TByteValue   byteVal      // TINYINT
  3: TI16Value    i16Val       // SMALLINT
  4: TI32Value    i32Val       // INT
  5: TI64Value    i64Val       // BIGINT, TIMESTAMP
  6: TDoubleValue doubleVal    // FLOAT, DOUBLE
  7: TStringValue stringVal    // STRING, LIST, MAP, STRUCT, UNIONTYPE, BINARY, DECIMAL, NULL
}

// Represents a row in a rowset.
struct TRow {
  1: required list<TColumnValue> colVals
}

struct TBoolColumn {
  1: required list<bool> values
  2: required binary nulls
}

struct TByteColumn {
  1: required list<byte> values
  2: required binary nulls
}

struct TI16Column {
  1: required list<i16> values
  2: required binary nulls
}

struct TI32Column {
  1: required list<i32> values
  2: required binary nulls
}

struct TI64Column {
  1: required list<i64> values
  2: required binary nulls
}

struct TDoubleColumn {
  1: required list<double> values
  2: required binary nulls
}

struct TStringColumn {
  1: required list<string> values
  2: required binary nulls
}

struct TBinaryColumn {
  1: required list<binary> values
  2: required binary nulls
}

// Note that Hive's type system is richer than Thrift's,
// so in some cases we have to map multiple Hive types
// to the same Thrift type. On the client-side this is
// disambiguated by looking at the Schema of the
// result set.
union TColumn {
  1: TBoolColumn   boolVal      // BOOLEAN
  2: TByteColumn   byteVal      // TINYINT
  3: TI16Column    i16Val       // SMALLINT
  4: TI32Column    i32Val       // INT
  5: TI64Column    i64Val       // BIGINT, TIMESTAMP
  6: TDoubleColumn doubleVal    // FLOAT, DOUBLE
  7: TStringColumn stringVal    // STRING, LIST, MAP, STRUCT, UNIONTYPE, DECIMAL, NULL
  8: TBinaryColumn binaryVal    // BINARY
}

// Represents a rowset
struct TRowSet {
  // The starting row offset of this rowset.
  1: required i64 startRowOffset
  2: required list<TRow> rows
  3: optional list<TColumn> columns
}

// The return status code contained in each response.
enum TStatusCode {
  SUCCESS_STATUS,
  SUCCESS_WITH_INFO_STATUS,
  STILL_EXECUTING_STATUS,
  ERROR_STATUS,
  INVALID_HANDLE_STATUS
}

// The return status of a remote request
struct TStatus {
  1: required TStatusCode statusCode

  // If status is SUCCESS_WITH_INFO, info_msgs may be populated with
  // additional diagnostic information.
  2: optional list<string> infoMessages

  // If status is ERROR, then the following fields may be set
  3: optional string sqlState  // as defined in the ISO/IEF CLI specification
  4: optional i32 errorCode    // internal error code
  5: optional string errorMessage
}

// The state of an operation (i.e. a query or other
// asynchronous operation that generates a result set)
// on the server.
enum TOperationState {
  // The operation has been initialized
  INITIALIZED_STATE,

  // The operation is running. In this state the result
  // set is not available.
  RUNNING_STATE,

  // The operation has completed. When an operation is in
  // this state its result set may be fetched.
  FINISHED_STATE,

  // The operation was canceled by a client
  CANCELED_STATE,

  // The operation was closed by a client
  CLOSED_STATE,

  // The operation failed due to an error
  ERROR_STATE,

  // The operation is in an unrecognized state
  UKNOWN_STATE,

  // The operation is in an pending state
  PENDING_STATE,
}

// A string identifier. This is interpreted literally.
typedef string TIdentifier

// A search pattern.
//
// Valid search pattern characters:
// '_': Any single character.
// '%': Any sequence of zero or more characters.
// '\': Escape character used to include special characters,
//      e.g. '_', '%', '\'. If a '\' precedes a non-special
//      character it has no special meaning and is interpreted
//      literally.
typedef string TPattern


// A search pattern or identifier. Used as input
// parameter for many of the catalog functions.
typedef string TPatternOrIdentifier

struct THandleIdentifier {
  // 16 byte globally unique identifier
  // This is the public ID of the handle and
  // can be used for reporting.
  1: required binary guid,

  // 16 byte secret generated by the server
  // and used to verify that the handle is not
  // being hijacked by another user.
  2: required binary secret,
}

// Client-side handle to persistent
// session information on the server-side.
struct TSessionHandle {
  1: required THandleIdentifier sessionId
}

// The subtype of an OperationHandle.
enum TOperationType {
  EXECUTE_STATEMENT,
  GET_TYPE_INFO,
  GET_CATALOGS,
  GET_SCHEMAS,
  GET_TABLES,
  GET_TABLE_TYPES,
  GET_COLUMNS,
  GET_FUNCTIONS,
  UNKNOWN,
}

// Client-side reference to a task running
// asynchronously on the server.
struct TOperationHandle {
  1: required THandleIdentifier operationId
  2: required TOperationType operationType

  // If hasResultSet = TRUE, then this operation
  // generates a result set that can be fetched.
  // Note that the result set may be empty.
  //
  // If hasResultSet = FALSE, then this operation
  // does not generate a result set, and calling
  // GetResultSetMetadata or FetchResults against
  // this OperationHandle will generate an error.
  3: required bool hasResultSet

  // For operations that don't generate result sets,
  // modifiedRowCount is either:
  //
  // 1) The number of rows that were modified by
  //    the DML operation (e.g. number of rows inserted,
  //    number of rows deleted, etc).
  //
  // 2) 0 for operations that don't modify or add rows.
  //
  // 3) < 0 if the operation is capable of modifiying rows,
  //    but Hive is unable to determine how many rows were
  //    modified. For example, Hive's LOAD DATA command
  //    doesn't generate row count information because
  //    Hive doesn't inspect the data as it is loaded.
  //
  // modifiedRowCount is unset if the operation generates
  // a result set.
  4: optional double modifiedRowCount
}


// OpenSession()
//
// Open a session (connection) on the server against
// which operations may be executed.
struct TOpenSessionReq {
  // The version of the HiveServer2 protocol that the client is using.
  1: required TProtocolVersion client_protocol = TProtocolVersion.HIVE_CLI_SERVICE_PROTOCOL_V6

  // Username and password for authentication.
  // Depending on the authentication scheme being used,
  // this information may instead be provided by a lower
  // protocol layer, in which case these fields may be
  // left unset.
  2: optional string username
  3: optional string password

  // Configuration overlay which is applied when the session is
  // first created.
  4: optional map<string, string> configuration
}

struct TOpenSessionResp {
  1: required TStatus status

  // The protocol version that the server is using.
  2: required TProtocolVersion serverProtocolVersion = TProtocolVersion.HIVE_CLI_SERVICE_PROTOCOL_V6

  // Session Handle
  3: optional TSessionHandle sessionHandle

  // The configuration settings for this session.
  4: optional map<string, string> configuration
}


// CloseSession()
//
// Closes the specified session and frees any resources
// currently allocated to that session. Any open
// operations in that session will be canceled.
struct TCloseSessionReq {
  1: required TSessionHandle sessionHandle
}

struct TCloseSessionResp {
  1: required TStatus status
}



enum TGetInfoType {
  CLI_MAX_DRIVER_CONNECTIONS =           0,
  CLI_MAX_CONCURRENT_ACTIVITIES =        1,
  CLI_DATA_SOURCE_NAME =                 2,
  CLI_FETCH_DIRECTION =                  8,
  CLI_SERVER_NAME =                      13,
  CLI_SEARCH_PATTERN_ESCAPE =            14,
  CLI_DBMS_NAME =                        17,
  CLI_DBMS_VER =                         18,
  CLI_ACCESSIBLE_TABLES =                19,
  CLI_ACCESSIBLE_PROCEDURES =            20,
  CLI_CURSOR_COMMIT_BEHAVIOR =           23,
  CLI_DATA_SOURCE_READ_ONLY =            25,
  CLI_DEFAULT_TXN_ISOLATION =            26,
  CLI_IDENTIFIER_CASE =                  28,
  CLI_IDENTIFIER_QUOTE_CHAR =            29,
  CLI_MAX_COLUMN_NAME_LEN =              30,
  CLI_MAX_CURSOR_NAME_LEN =              31,
  CLI_MAX_SCHEMA_NAME_LEN =              32,
  CLI_MAX_CATALOG_NAME_LEN =             34,
  CLI_MAX_TABLE_NAME_LEN =               35,
  CLI_SCROLL_CONCURRENCY =               43,
  CLI_TXN_CAPABLE =                      46,
  CLI_USER_NAME =                        47,
  CLI_TXN_ISOLATION_OPTION =             72,
  CLI_INTEGRITY =                        73,
  CLI_GETDATA_EXTENSIONS =               81,
  CLI_NULL_COLLATION =                   85,
  CLI_ALTER_TABLE =                      86,
  CLI_ORDER_BY_COLUMNS_IN_SELECT =       90,
  CLI_SPECIAL_CHARACTERS =               94,
  CLI_MAX_COLUMNS_IN_GROUP_BY =          97,
  CLI_MAX_COLUMNS_IN_INDEX =             98,
  CLI_MAX_COLUMNS_IN_ORDER_BY =          99,
  CLI_MAX_COLUMNS_IN_SELECT =            100,
  CLI_MAX_COLUMNS_IN_TABLE =             101,
  CLI_MAX_INDEX_SIZE =                   102,
  CLI_MAX_ROW_SIZE =                     104,
  CLI_MAX_STATEMENT_LEN =                105,
  CLI_MAX_TABLES_IN_SELECT =             106,
  CLI_MAX_USER_NAME_LEN =                107,
  CLI_OJ_CAPABILITIES =                  115,

  CLI_XOPEN_CLI_YEAR =                   10000,
  CLI_CURSOR_SENSITIVITY =               10001,
  CLI_DESCRIBE_PARAMETER =               10002,
  CLI_CATALOG_NAME =                     10003,
  CLI_COLLATION_SEQ =                    10004,
  CLI_MAX_IDENTIFIER_LEN =               10005,
}

union TGetInfoValue {
  1: string stringValue
  2: i16 smallIntValue
  3: i32 integerBitmask
  4: i32 integerFlag
  5: i32 binaryValue
  6: i64 lenValue
}

// GetInfo()
//
// This function is based on ODBC's CLIGetInfo() function.
// The function returns general information about the data source
// using the same keys as ODBC.
struct TGetInfoReq {
  // The sesssion to run this request against
  1: required TSessionHandle sessionHandle

  2: required TGetInfoType infoType
}

struct TGetInfoResp {
  1: required TStatus status

  2: required TGetInfoValue infoValue
}


// ExecuteStatement()
//
// Execute a statement.
// The returned OperationHandle can be used to check on the
// status of the statement, and to fetch results once the
// statement has finished executing.
struct TExecuteStatementReq {
  // The session to execute the statement against
  1: required TSessionHandle sessionHandle

  // The statement to be executed (DML, DDL, SET, etc)
  2: required string statement

  // Configuration properties that are overlayed on top of the
  // the existing session configuration before this statement
  // is executed. These properties apply to this statement
  // only and will not affect the subsequent state of the Session.
  3: optional map<string, string> confOverlay

  // Execute asynchronously when runAsync is true
  4: optional bool runAsync = false
}

struct TExecuteStatementResp {
  1: required TStatus status
  2: optional TOperationHandle operationHandle
}

// GetTypeInfo()
//
// Get information about types supported by the HiveServer instance.
// The information is returned as a result set which can be fetched
// using the OperationHandle provided in the response.
//
// Refer to the documentation for ODBC's CLIGetTypeInfo function for
// the format of the result set.
struct TGetTypeInfoReq {
  // The session to run this request against.
  1: required TSessionHandle sessionHandle
}

struct TGetTypeInfoResp {
  1: required TStatus status
  2: optional TOperationHandle operationHandle
}


// GetCatalogs()
//
// Returns the list of catalogs (databases)
// Results are ordered by TABLE_CATALOG
//
// Resultset columns :
// col1
// name: TABLE_CAT
// type: STRING
// desc: Catalog name. NULL if not applicable.
//
struct TGetCatalogsReq {
  // Session to run this request against
  1: required TSessionHandle sessionHandle
}

struct TGetCatalogsResp {
  1: required TStatus status
  2: optional TOperationHandle operationHandle
}


// GetSchemas()
//
// Retrieves the schema names available in this database.
// The results are ordered by TABLE_CATALOG and TABLE_SCHEM.
// col1
// name: TABLE_SCHEM
// type: STRING
// desc: schema name
// col2
// name: TABLE_CATALOG
// type: STRING
// desc: catalog name
struct TGetSchemasReq {
  // Session to run this request against
  1: required TSessionHandle sessionHandle

  // Name of the catalog. Must not contain a search pattern.
  2: optional TIdentifier catalogName

  // schema name or pattern
  3: optional TPatternOrIdentifier schemaName
}

struct TGetSchemasResp {
  1: required TStatus status
  2: optional TOperationHandle operationHandle
}


// GetTables()
//
// Returns a list of tables with catalog, schema, and table
// type information. The information is returned as a result
// set which can be fetched using the OperationHandle
// provided in the response.
// Results are ordered by TABLE_TYPE, TABLE_CAT, TABLE_SCHEM, and TABLE_NAME
//
// Result Set Columns:
//
// col1
// name: TABLE_CAT
// type: STRING
// desc: Catalog name. NULL if not applicable.
//
// col2
// name: TABLE_SCHEM
// type: STRING
// desc: Schema name.
//
// col3
// name: TABLE_NAME
// type: STRING
// desc: Table name.
//
// col4
// name: TABLE_TYPE
// type: STRING
// desc: The table type, e.g. "TABLE", "VIEW", etc.
//
// col5
// name: REMARKS
// type: STRING
// desc: Comments about the table
//
struct TGetTablesReq {
  // Session to run this request against
  1: required TSessionHandle sessionHandle

  // Name of the catalog or a search pattern.
  2: optional TPatternOrIdentifier catalogName

  // Name of the schema or a search pattern.
  3: optional TPatternOrIdentifier schemaName

  // Name of the table or a search pattern.
  4: optional TPatternOrIdentifier tableName

  // List of table types to match
  // e.g. "TABLE", "VIEW", "SYSTEM TABLE", "GLOBAL TEMPORARY",
  // "LOCAL TEMPORARY", "ALIAS", "SYNONYM", etc.
  5: optional list<string> tableTypes
}

struct TGetTablesResp {
  1: required TStatus status
  2: optional TOperationHandle operationHandle
}


// GetTableTypes()
//
// Returns the table types available in this database.
// The results are ordered by table type.
//
// col1
// name: TABLE_TYPE
// type: STRING
// desc: Table type name.
struct TGetTableTypesReq {
  // Session to run this request against
  1: required TSessionHandle sessionHandle
}

struct TGetTableTypesResp {
  1: required TStatus status
  2: optional TOperationHandle operationHandle
}


// GetColumns()
//
// Returns a list of columns in the specified tables.
// The information is returned as a result set which can be fetched
// using the OperationHandle provided in the response.
// Results are ordered by TABLE_CAT, TABLE_SCHEM, TABLE_NAME,
// and ORDINAL_POSITION.
//
// Result Set Columns are the same as those for the ODBC CLIColumns
// function.
//
struct TGetColumnsReq {
  // Session to run this request against
  1: required TSessionHandle sessionHandle

  // Name of the catalog. Must not contain a search pattern.
  2: optional TIdentifier catalogName

  // Schema name or search pattern
  3: optional TPatternOrIdentifier schemaName

  // Table name or search pattern
  4: optional TPatternOrIdentifier tableName

  // Column name or search pattern
  5: optional TPatternOrIdentifier columnName
}

struct TGetColumnsResp {
  1: required TStatus status
  2: optional TOperationHandle operationHandle
}


// GetFunctions()
//
// Returns a list of functions supported by the data source. The
// behavior of this function matches
// java.sql.DatabaseMetaData.getFunctions() both in terms of
// inputs and outputs.
//
// Result Set Columns:
//
// col1
// name: FUNCTION_CAT
// type: STRING
// desc: Function catalog (may be null)
//
// col2
// name: FUNCTION_SCHEM
// type: STRING
// desc: Function schema (may be null)
//
// col3
// name: FUNCTION_NAME
// type: STRING
// desc: Function name. This is the name used to invoke the function.
//
// col4
// name: REMARKS
// type: STRING
// desc: Explanatory comment on the function.
//
// col5
// name: FUNCTION_TYPE
// type: SMALLINT
// desc: Kind of function. One of:
//       * functionResultUnknown - Cannot determine if a return value or a table
//                                 will be returned.
//       * functionNoTable       - Does not a return a table.
//       * functionReturnsTable  - Returns a table.
//
// col6
// name: SPECIFIC_NAME
// type: STRING
// desc: The name which uniquely identifies this function within its schema.
//       In this case this is the fully qualified class name of the class
//       that implements this function.
//
struct TGetFunctionsReq {
  // Session to run this request against
  1: required TSessionHandle sessionHandle

  // A catalog name; must match the catalog name as it is stored in the
  // database; "" retrieves those without a catalog; null means
  // that the catalog name should not be used to narrow the search.
  2: optional TIdentifier catalogName

  // A schema name pattern; must match the schema name as it is stored
  // in the database; "" retrieves those without a schema; null means
  // that the schema name should not be used to narrow the search.
  3: optional TPatternOrIdentifier schemaName

  // A function name pattern; must match the function name as it is stored
  // in the database.
  4: required TPatternOrIdentifier functionName
}

struct TGetFunctionsResp {
  1: required TStatus status
  2: optional TOperationHandle operationHandle
}


// GetOperationStatus()
//
// Get the status of an operation running on the server.
struct TGetOperationStatusReq {
  // Session to run this request against
  1: required TOperationHandle operationHandle
}

struct TGetOperationStatusResp {
  1: required TStatus status
  2: optional TOperationState operationState

  // If operationState is ERROR_STATE, then the following fields may be set
  // sqlState as defined in the ISO/IEF CLI specification
  3: optional string sqlState

  // Internal error code
  4: optional i32 errorCode

  // Error message
  5: optional string errorMessage
}


// CancelOperation()
//
// Cancels processing on the specified operation handle and
// frees any resources which were allocated.
struct TCancelOperationReq {
  // Operation to cancel
  1: required TOperationHandle operationHandle
}

struct TCancelOperationResp {
  1: required TStatus status
}


// CloseOperation()
//
// Given an operation in the FINISHED, CANCELED,
// or ERROR states, CloseOperation() will free
// all of the resources which were allocated on
// the server to service the operation.
struct TCloseOperationReq {
  1: required TOperationHandle operationHandle
}

struct TCloseOperationResp {
  1: required TStatus status
}


// GetResultSetMetadata()
//
// Retrieves schema information for the specified operation
struct TGetResultSetMetadataReq {
  // Operation for which to fetch result set schema information
  1: required TOperationHandle operationHandle
}

struct TGetResultSetMetadataResp {
  1: required TStatus status
  2: optional TTableSchema schema
}


enum TFetchOrientation {
  // Get the next rowset. The fetch offset is ignored.
  FETCH_NEXT,

  // Get the previous rowset. The fetch offset is ignored.
  // NOT SUPPORTED
  FETCH_PRIOR,

  // Return the rowset at the given fetch offset relative
  // to the curren rowset.
  // NOT SUPPORTED
  FETCH_RELATIVE,

  // Return the rowset at the specified fetch offset.
  // NOT SUPPORTED
  FETCH_ABSOLUTE,

  // Get the first rowset in the result set.
  FETCH_FIRST,

  // Get the last rowset in the result set.
  // NOT SUPPORTED
  FETCH_LAST
}

// FetchResults()
//
// Fetch rows from the server corresponding to
// a particular OperationHandle.
struct TFetchResultsReq {
  // Operation from which to fetch results.
  1: required TOperationHandle operationHandle

  // The fetch orientation. For V1 this must be either
  // FETCH_NEXT or FETCH_FIRST. Defaults to FETCH_NEXT.
  2: required TFetchOrientation orientation = TFetchOrientation.FETCH_NEXT

  // Max number of rows that should be returned in
  // the rowset.
  3: required i64 maxRows

  // The type of a fetch results request.
  // 0 represents Query output. 1 represents Log.
  4: optional i16 fetchType
}

struct TFetchResultsResp {
  1: required TStatus status

  // TRUE if there are more rows left to fetch from the server.
  2: optional bool hasMoreRows

  // The rowset. This is optional so that we have the
  // option in the future of adding alternate formats for
  // representing result set data, e.g. delimited strings,
  // binary encoded, etc.
  3: optional TRowSet results
}

// GetDelegationToken()
// Retrieve delegation token for the current user
struct  TGetDelegationTokenReq {
  // session handle
  1: required TSessionHandle sessionHandle

  // userid for the proxy user
  2: required string owner

  // designated renewer userid
  3: required string renewer
}

struct TGetDelegationTokenResp {
  // status of the request
  1: required TStatus status

  // delegation token string
  2: optional string delegationToken
}

// CancelDelegationToken()
// Cancel the given delegation token
struct TCancelDelegationTokenReq {
  // session handle
  1: required TSessionHandle sessionHandle

  // delegation token to cancel
  2: required string delegationToken
}

struct TCancelDelegationTokenResp {
  // status of the request
  1: required TStatus status
}

// RenewDelegationToken()
// Renew the given delegation token
struct TRenewDelegationTokenReq {
  // session handle
  1: required TSessionHandle sessionHandle

  // delegation token to renew
  2: required string delegationToken
}

struct TRenewDelegationTokenResp {
  // status of the request
  1: required TStatus status
}

// GetLog()
// Not present in Hive 0.13, re-added for backwards compatibility.
//
// Fetch operation log from the server corresponding to
// a particular OperationHandle.
struct TGetLogReq {
  // Operation whose log is requested
  1: required TOperationHandle operationHandle
}

struct TGetLogResp {
  1: required TStatus status
  2: required string log
}

service TCLIService {

  TOpenSessionResp OpenSession(1:TOpenSessionReq req);

  TCloseSessionResp CloseSession(1:TCloseSessionReq req);

  TGetInfoResp GetInfo(1:TGetInfoReq req);

  TExecuteStatementResp ExecuteStatement(1:TExecuteStatementReq req);

  TGetTypeInfoResp GetTypeInfo(1:TGetTypeInfoReq req);

  TGetCatalogsResp GetCatalogs(1:TGetCatalogsReq req);

  TGetSchemasResp GetSchemas(1:TGetSchemasReq req);

  TGetTablesResp GetTables(1:TGetTablesReq req);

  TGetTableTypesResp GetTableTypes(1:TGetTableTypesReq req);

  TGetColumnsResp GetColumns(1:TGetColumnsReq req);

  TGetFunctionsResp GetFunctions(1:TGetFunctionsReq req);

  TGetOperationStatusResp GetOperationStatus(1:TGetOperationStatusReq req);

  TCancelOperationResp CancelOperation(1:TCancelOperationReq req);

  TCloseOperationResp CloseOperation(1:TCloseOperationReq req);

  TGetResultSetMetadataResp GetResultSetMetadata(1:TGetResultSetMetadataReq req);

  TFetchResultsResp FetchResults(1:TFetchResultsReq req);

  TGetDelegationTokenResp GetDelegationToken(1:TGetDelegationTokenReq req);

  TCancelDelegationTokenResp CancelDelegationToken(1:TCancelDelegationTokenReq req);

  TRenewDelegationTokenResp RenewDelegationToken(1:TRenewDelegationTokenReq req);

  // Not present in Hive 0.13, re-added for backwards compatibility.
  TGetLogResp GetLog(1:TGetLogReq req);
}
