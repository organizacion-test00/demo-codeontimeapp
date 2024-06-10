using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Configuration;
using System.Data;
using System.Data.Common;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Transactions;
using System.Xml;
using System.Xml.XPath;
using System.Xml.Xsl;
using System.Web;
using System.Web.Caching;
using System.Web.Configuration;
using System.Web.Security;
using Newtonsoft.Json;
using MyCompany.Handlers;
using MyCompany.Services;

namespace MyCompany.Data
{
    public partial class Controller : DataControllerBase
    {

        public static string[] GrantFullAccess(params System.String[] controllers)
        {
            FullAccess(true, controllers);
            return controllers;
        }

        public static void RevokeFullAccess(params System.String[] controllers)
        {
            FullAccess(false, controllers);
        }
    }

    public partial class DataControllerBase : IDataController, IAutoCompleteManager, IDataEngine, IBusinessObject
    {

        public const int MaximumDistinctValues = 200;

        public static Type[] SpecialConversionTypes = new Type[] {
                typeof(System.Guid),
                typeof(System.DateTimeOffset),
                typeof(System.TimeSpan)};

        public static SpecialConversionFunction[] SpecialConverters;

        public static Regex ISO8601DateStringMatcher = new Regex("^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}$");

        public static string[] SpecialTypes = new string[] {
                "System.DateTimeOffset",
                "System.TimeSpan",
                "Microsoft.SqlServer.Types.SqlGeography",
                "Microsoft.SqlServer.Types.SqlHierarchyId"};

        private BusinessRules _serverRules;

        private FieldValue[] _originalFieldValues;

        private SortedDictionary<string, List<string>> _junctionTableMap;

        private string _junctionTableFieldName;

        public static Stream DefaultDataControllerStream = new MemoryStream();

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _allowPublicAccess;

        private DbParameterCollection _resultSetParameters;

        static DataControllerBase()
        {
            // initialize type map
            _typeMap = new SortedDictionary<string, Type>();
            _typeMap.Add("AnsiString", typeof(string));
            _typeMap.Add("Binary", typeof(byte[]));
            _typeMap.Add("Byte[]", typeof(byte[]));
            _typeMap.Add("Byte", typeof(byte));
            _typeMap.Add("Boolean", typeof(bool));
            _typeMap.Add("Currency", typeof(decimal));
            _typeMap.Add("Date", typeof(DateTime));
            _typeMap.Add("DateTime", typeof(DateTime));
            _typeMap.Add("Decimal", typeof(decimal));
            _typeMap.Add("Double", typeof(double));
            _typeMap.Add("Guid", typeof(Guid));
            _typeMap.Add("Int16", typeof(short));
            _typeMap.Add("Int32", typeof(int));
            _typeMap.Add("Int64", typeof(long));
            _typeMap.Add("Object", typeof(object));
            _typeMap.Add("SByte", typeof(sbyte));
            _typeMap.Add("Single", typeof(float));
            _typeMap.Add("String", typeof(string));
            _typeMap.Add("Time", typeof(TimeSpan));
            _typeMap.Add("TimeSpan", typeof(DateTime));
            _typeMap.Add("UInt16", typeof(ushort));
            _typeMap.Add("UInt32", typeof(uint));
            _typeMap.Add("UInt64", typeof(ulong));
            _typeMap.Add("VarNumeric", typeof(object));
            _typeMap.Add("AnsiStringFixedLength", typeof(string));
            _typeMap.Add("StringFixedLength", typeof(string));
            _typeMap.Add("Xml", typeof(string));
            _typeMap.Add("DateTime2", typeof(DateTime));
            _typeMap.Add("DateTimeOffset", typeof(DateTimeOffset));
            // initialize rowset type map
            _rowsetTypeMap = new SortedDictionary<string, string>();
            _rowsetTypeMap.Add("AnsiString", "string");
            _rowsetTypeMap.Add("Binary", "bin.base64");
            _rowsetTypeMap.Add("Byte", "u1");
            _rowsetTypeMap.Add("Boolean", "boolean");
            _rowsetTypeMap.Add("Currency", "float");
            _rowsetTypeMap.Add("Date", "date");
            _rowsetTypeMap.Add("DateTime", "dateTime");
            _rowsetTypeMap.Add("Decimal", "float");
            _rowsetTypeMap.Add("Double", "float");
            _rowsetTypeMap.Add("Guid", "uuid");
            _rowsetTypeMap.Add("Int16", "i2");
            _rowsetTypeMap.Add("Int32", "i4");
            _rowsetTypeMap.Add("Int64", "i8");
            _rowsetTypeMap.Add("Object", "string");
            _rowsetTypeMap.Add("SByte", "i1");
            _rowsetTypeMap.Add("Single", "float");
            _rowsetTypeMap.Add("String", "string");
            _rowsetTypeMap.Add("Time", "time");
            _rowsetTypeMap.Add("UInt16", "u2");
            _rowsetTypeMap.Add("UInt32", "u4");
            _rowsetTypeMap.Add("UIn64", "u8");
            _rowsetTypeMap.Add("VarNumeric", "float");
            _rowsetTypeMap.Add("AnsiStringFixedLength", "string");
            _rowsetTypeMap.Add("StringFixedLength", "string");
            _rowsetTypeMap.Add("Xml", "string");
            _rowsetTypeMap.Add("DateTime2", "dateTime");
            _rowsetTypeMap.Add("DateTimeOffset", "dateTime.tz");
            _rowsetTypeMap.Add("TimeSpan", "time");
            // initialize the special converters
            SpecialConverters = new SpecialConversionFunction[SpecialConversionTypes.Length];
            SpecialConverters[0] = ConvertToGuid;
            SpecialConverters[1] = ConvertToDateTimeOffset;
            SpecialConverters[2] = ConvertToTimeSpan;
        }

        public DataControllerBase()
        {
            Initialize();
        }

        protected virtual FieldValue[] OriginalFieldValues
        {
            get
            {
                return _originalFieldValues;
            }
        }

        protected virtual string HierarchyOrganizationFieldName
        {
            get
            {
                return "HierarchyOrganization__";
            }
        }

        public virtual bool AllowPublicAccess
        {
            get
            {
                return _allowPublicAccess;
            }
            set
            {
                _allowPublicAccess = value;
            }
        }

        protected virtual void Initialize()
        {
            CultureManager.Initialize();
        }

        public static bool StringIsNull(string s)
        {
            return ((s == "null") || (s == "%js%null"));
        }

        public static object ConvertToGuid(object o)
        {
            return new Guid(Convert.ToString(o));
        }

        public static object ConvertToDateTimeOffset(object o)
        {
            return System.DateTimeOffset.Parse(Convert.ToString(o));
        }

        public static object ConvertToTimeSpan(object o)
        {
            return System.TimeSpan.Parse(Convert.ToString(o));
        }

        public static object ConvertToType(Type targetType, object o)
        {
            if (targetType.IsGenericType)
                targetType = targetType.GetProperty("Value").PropertyType;
            if ((o == null) || o.GetType().Equals(targetType))
                return o;
            for (var i = 0; (i < SpecialConversionTypes.Length); i++)
            {
                var t = SpecialConversionTypes[i];
                if (t == targetType)
                    return SpecialConverters[i](o);
            }
            if (o is IConvertible)
                o = Convert.ChangeType(o, targetType);
            else
            {
                if (targetType.Equals(typeof(string)) && (o != null))
                    o = o.ToString();
            }
            return o;
        }

        public static string ValueToString(object o)
        {
            if ((o != null) && (o is System.DateTime))
                o = ((DateTime)(o)).ToString("yyyy-MM-ddTHH\\:mm\\:ss.fff");
            return ("%js%" + JsonConvert.SerializeObject(o));
        }

        public static object StringToValue(string s)
        {
            return StringToValue(null, s);
        }

        public static object StringToValue(DataField field, string s)
        {
            if (!(string.IsNullOrEmpty(s)) && s.StartsWith("%js%"))
            {
                var v = JsonConvert.DeserializeObject(s.Substring(4));
                if ((v is string) && ISO8601DateStringMatcher.IsMatch(((string)(v))))
                    return System.DateTime.Parse(((string)(v)));
                if (!((v is string)) || ((field == null) || (field.Type == "String")))
                    return v;
                s = ((string)(v));
            }
            else
            {
                if (ISO8601DateStringMatcher.IsMatch(s))
                    return System.DateTime.Parse(s);
            }
            if (field != null)
                return TypeDescriptor.GetConverter(Controller.TypeMap[field.Type]).ConvertFromString(s);
            return s;
        }

        public static object ConvertObjectToValue(object o)
        {
            if (SpecialTypes.Contains(o.GetType().FullName))
                return o.ToString();
            return o;
        }

        public static object EnsureJsonCompatibility(object o)
        {
            if (o != null)
            {
                if (o is List<object[]>)
                    foreach (var values in ((List<object[]>)(o)))
                        EnsureJsonCompatibility(values);
                else
                {
                    if ((o is Array) && (o.GetType().GetElementType() == typeof(object)))
                    {
                        var row = ((object[])(o));
                        for (var i = 0; (i < row.Length); i++)
                            row[i] = EnsureJsonCompatibility(row[i]);
                    }
                    else
                    {
                        if (o is DateTime)
                        {
                            var d = ((DateTime)(o));
                            return string.Format("{0:d4}-{1:d2}-{2:d2}T{3:d2}:{4:d2}:{5:d2}.{6:d3}", d.Year, d.Month, d.Day, d.Hour, d.Minute, d.Second, d.Millisecond);
                        }
                    }
                }
            }
            return o;
        }

        protected BusinessRules CreateBusinessRules()
        {
            return BusinessRules.Create(_config);
        }

        private void ApplyFieldFilter(ViewPage page)
        {
            if ((page.FieldFilter != null) && (page.FieldFilter.Length > 0))
            {
                var newFields = new List<DataField>();
                foreach (var f in page.Fields)
                    if (f.IsPrimaryKey || page.IncludeField(f.Name))
                        newFields.Add(f);
                page.Fields.Clear();
                page.Fields.AddRange(newFields);
                page.FieldFilter = null;
            }
        }

        protected virtual BusinessRules InitBusinessRules(PageRequest request, ViewPage page)
        {
            var rules = _config.CreateBusinessRules();
            _serverRules = rules;
            if (_serverRules == null)
                _serverRules = CreateBusinessRules();
            _serverRules.Page = page;
            _serverRules.RequiresRowCount = (page.RequiresRowCount && !((request.Inserting || request.DoesNotRequireData)));
            if (rules != null)
                rules.BeforeSelect(request);
            else
                _serverRules.ExecuteServerRules(request, ActionPhase.Before);
            return rules;
        }

        public virtual ViewPage[] GetPageList(PageRequest[] requests)
        {
            var result = new List<ViewPage>();
            foreach (var r in requests)
                result.Add(ControllerFactory.CreateDataController().GetPage(r.Controller, r.View, r));
            return result.ToArray();
        }

        public virtual ActionResult[] ExecuteList(ActionArgs[] requests)
        {
            var result = new List<ActionResult>();
            foreach (var r in requests)
                result.Add(ControllerFactory.CreateDataController().Execute(r.Controller, r.View, r));
            return result.ToArray();
        }

        ViewPage IDataController.GetPage(string controller, string view, PageRequest request)
        {
            SelectView(controller, view);
            request.AssignContext(controller, this._viewId, _config);
            var page = new ViewPage(request);
            if (((page.FieldFilter != null) && !page.Distinct) && ((page.FieldFilter.Length > 0) && (Config.SelectSingleNode("/c:dataController/c:businessRules/c:rule[@commandName=\'Select\']") != null)))
                page.FieldFilter = null;
            if (_config.PlugIn != null)
                _config.PlugIn.PreProcessPageRequest(request, page);
            _config.AssignDynamicExpressions(page);
            page.ApplyDataFilter(_config.CreateDataFilter(), request.Controller, request.View, request.LookupContextController, request.LookupContextView, request.LookupContextFieldName);
            var rules = InitBusinessRules(request, page);
            using (var connection = CreateConnection(this))
            {
                var selectCommand = CreateCommand(connection);
                if ((selectCommand == null) && _serverRules.EnableResultSet)
                {
                    PopulatePageFields(page);
                    EnsurePageFields(page, null);
                }
                if (page.RequiresMetaData && page.IncludeMetadata("categories"))
                    PopulatePageCategories(page);
                SyncRequestedPage(request, page, connection);
                ConfigureCommand(selectCommand, page, CommandConfigurationType.Select, null);
                if ((page.PageSize > 0) && !((request.Inserting || request.DoesNotRequireData)))
                {
                    EnsureSystemPageFields(request, page, selectCommand);
                    var reader = ExecuteResultSetReader(page);
                    if (reader == null)
                    {
                        if (selectCommand == null)
                            reader = ExecuteVirtualReader(request, page);
                        else
                            reader = selectCommand.ExecuteReader();
                    }
                    while (page.SkipNext())
                        reader.Read();
                    List<int> fieldMap = null;
                    List<int> typedFieldMap = null;
                    while (page.ReadNext() && reader.Read())
                    {
                        if (fieldMap == null)
                        {
                            fieldMap = new List<int>();
                            typedFieldMap = new List<int>();
                            var availableColumns = new SortedDictionary<string, int>();
                            for (var j = 0; (j < reader.FieldCount); j++)
                                availableColumns[reader.GetName(j).ToLower()] = j;
                            for (var k = 0; (k < page.Fields.Count); k++)
                            {
                                var columnIndex = 0;
                                if (!(availableColumns.TryGetValue(page.Fields[k].Name.ToLower(), out columnIndex)))
                                    columnIndex = -1;
                                fieldMap.Add(columnIndex);
                                if (columnIndex >= 0)
                                {
                                    var columnType = reader.GetFieldType(columnIndex);
                                    if (columnType == null)
                                        typedFieldMap.Add(-1);
                                    else
                                        typedFieldMap.Add(columnIndex);
                                }
                                else
                                    typedFieldMap.Add(-1);
                            }
                        }
                        var values = new object[page.Fields.Count];
                        for (var i = 0; (i < values.Length); i++)
                        {
                            var columnIndex = fieldMap[i];
                            if (!((columnIndex == -1)))
                            {
                                var field = page.Fields[i];
                                object v;
                                if (typedFieldMap[i] == -1)
                                {
                                    using (var stream = new MemoryStream())
                                    {
                                        // use GetBytes instead of GetStream for compatiblity with .NET 4 and below
                                        var dataBuffer = new byte[4096];
                                        long bytesRead;
                                        try
                                        {
                                            bytesRead = reader.GetBytes(columnIndex, 0, dataBuffer, 0, dataBuffer.Length);
                                        }
                                        catch (Exception)
                                        {
                                            bytesRead = 0;
                                        }
                                        while (bytesRead > 0)
                                        {
                                            stream.Write(dataBuffer, 0, Convert.ToInt32(bytesRead));
                                            bytesRead = reader.GetBytes(columnIndex, stream.Length, dataBuffer, 0, dataBuffer.Length);
                                        }
                                        if (stream.Length == 0)
                                            v = DBNull.Value;
                                        else
                                        {
                                            stream.Position = 0;
                                            dataBuffer = new byte[stream.Length];
                                            stream.Read(dataBuffer, 0, Convert.ToInt32(stream.Length));
                                            v = ("0x" + BitConverter.ToString(dataBuffer).Replace("-", string.Empty));
                                        }
                                    }
                                }
                                else
                                    v = reader[columnIndex];
                                if (!(DBNull.Value.Equals(v)))
                                {
                                    if (field.IsMirror)
                                        v = string.Format(field.DataFormatString, v);
                                    else
                                    {
                                        if ((field.Type == "Guid") && (v is byte[]))
                                            v = new Guid(((byte[])(v)));
                                        else
                                            v = ConvertObjectToValue(v);
                                    }
                                    values[i] = v;
                                }
                                if (!(string.IsNullOrEmpty(field.SourceFields)))
                                    values[i] = CreateValueFromSourceFields(field, reader);
                            }
                        }
                        if (page.RequiresPivot)
                            page.AddPivotValues(values);
                        else
                            page.Rows.Add(values);
                    }
                    reader.Close();
                }
                if (_serverRules.RequiresRowCount)
                {
                    if (_serverRules.EnableResultSet)
                        page.TotalRowCount = _serverRules.ResultSetSize;
                    else
                    {
                        var countCommand = CreateCommand(connection);
                        page.FieldFilter = request.FieldFilter;
                        ConfigureCommand(countCommand, page, CommandConfigurationType.SelectCount, null);
                        page.FieldFilter = null;
                        if (YieldsSingleRow(countCommand))
                            page.TotalRowCount = 1;
                        else
                        {
                            if ((page.Rows.Count < page.PageSize) && (page.PageIndex <= 0))
                                page.TotalRowCount = page.Rows.Count;
                            else
                                page.TotalRowCount = Convert.ToInt32(countCommand.ExecuteScalar());
                        }
                    }
                    if (!request.DoesNotRequireAggregates && page.RequiresAggregates)
                    {
                        var aggregates = new object[page.Fields.Count];
                        if (_serverRules.EnableResultSet)
                        {
                            var dt = ExecuteResultSetTable(page);
                            for (var j = 0; (j < aggregates.Length); j++)
                            {
                                var field = page.Fields[j];
                                if (field.Aggregate != DataFieldAggregate.None)
                                {
                                    var func = field.Aggregate.ToString();
                                    if (func == "Count")
                                    {
                                        var uniqueValues = new SortedDictionary<string, string>();
                                        foreach (DataRow r in dt.Rows)
                                        {
                                            var v = r[field.Name];
                                            if (!(DBNull.Value.Equals(v)))
                                                uniqueValues[v.ToString()] = null;
                                        }
                                        aggregates[j] = uniqueValues.Keys.Count;
                                    }
                                    else
                                    {
                                        if (func == "Average")
                                            func = "avg";
                                        aggregates[j] = dt.Compute(string.Format("{0}([{1}])", func, field.Name), null);
                                    }
                                }
                            }
                        }
                        else
                        {
                            var aggregateCommand = CreateCommand(connection);
                            ConfigureCommand(aggregateCommand, page, CommandConfigurationType.SelectAggregates, null);
                            var reader = aggregateCommand.ExecuteReader();
                            if (reader.Read())
                                for (var j = 0; (j < aggregates.Length); j++)
                                {
                                    var field = page.Fields[j];
                                    if (field.Aggregate != DataFieldAggregate.None)
                                        aggregates[j] = reader[field.Name];
                                }
                            reader.Close();
                        }
                        for (var i = 0; (i < aggregates.Length); i++)
                        {
                            var field = page.Fields[i];
                            if (field.Aggregate != DataFieldAggregate.None)
                            {
                                var v = aggregates[i];
                                if (!(DBNull.Value.Equals(v)) && (v != null))
                                {
                                    if (!field.FormatOnClient && !(string.IsNullOrEmpty(field.DataFormatString)))
                                        v = string.Format(field.DataFormatString, v);
                                    aggregates[i] = v;
                                }
                            }
                        }
                        page.Aggregates = aggregates;
                    }
                }
                if (request.RequiresFirstLetters && this._viewType != "Form")
                {
                    if (!page.RequiresRowCount)
                        page.FirstLetters = string.Empty;
                    else
                    {
                        var firstLettersCommand = CreateCommand(connection);
                        var oldFilter = page.Filter;
                        ConfigureCommand(firstLettersCommand, page, CommandConfigurationType.SelectFirstLetters, null);
                        page.Filter = oldFilter;
                        if (!(string.IsNullOrEmpty(page.FirstLetters)))
                        {
                            var reader = firstLettersCommand.ExecuteReader();
                            var firstLetters = new StringBuilder(page.FirstLetters);
                            while (reader.Read())
                            {
                                firstLetters.Append(",");
                                var letter = Convert.ToString(reader[0]);
                                if (!(string.IsNullOrEmpty(letter)))
                                    firstLetters.Append(letter);
                            }
                            reader.Close();
                            page.FirstLetters = firstLetters.ToString();
                        }
                    }
                }
            }
            if (_config.PlugIn != null)
                _config.PlugIn.ProcessPageRequest(request, page);
            if (request.Inserting)
                page.NewRow = new object[page.Fields.Count];
            if (request.Inserting)
            {
                if (_serverRules.SupportsCommand("Sql|Code", "New"))
                    _serverRules.ExecuteServerRules(request, ActionPhase.Execute, "New", page.NewRow);
            }
            else
            {
                if (_serverRules.SupportsCommand("Sql|Code", "Select") && !page.Distinct)
                    foreach (var row in page.Rows)
                        _serverRules.ExecuteServerRules(request, ActionPhase.Execute, "Select", row);
            }
            if (!request.Inserting)
                PopulateManyToManyFields(page);
            if (rules != null)
            {
                IRowHandler rowHandler = rules;
                if (request.Inserting)
                {
                    if (rowHandler.SupportsNewRow(request))
                        rowHandler.NewRow(request, page, page.NewRow);
                }
                else
                {
                    if (rowHandler.SupportsPrepareRow(request))
                        foreach (var row in page.Rows)
                            rowHandler.PrepareRow(request, page, row);
                }
                rules.ProcessPageRequest(request, page);
                if (rules.CompleteConfiguration())
                    ResetViewPage(page);
            }
            if (rules != null)
                rules.AfterSelect(request);
            else
                _serverRules.ExecuteServerRules(request, ActionPhase.After);
            _serverRules.Result.Merge(page);
            return page.ToResult(_config, _view);
        }

        public virtual void ResetViewPage(ViewPage page)
        {
            page.RequiresMetaData = true;
            var fieldIndexes = new SortedDictionary<string, int>();
            for (var i = 0; (i < page.Fields.Count); i++)
                fieldIndexes[page.Fields[i].Name] = i;
            page.Fields.Clear();
            page.Categories.Clear();
            PopulatePageFields(page);
            EnsurePageFields(page, _expressions);
            page.FieldFilter = page.RequestedFieldFilter();
            ApplyFieldFilter(page);
            PopulatePageCategories(page);
            if (page.NewRow != null)
                page.NewRow = ReorderRowValues(page, fieldIndexes, page.NewRow);
            if (page.Rows != null)
                for (var j = 0; (j < page.Rows.Count); j++)
                    page.Rows[j] = ReorderRowValues(page, fieldIndexes, page.Rows[j]);
        }

        private object[] ReorderRowValues(ViewPage page, SortedDictionary<string, int> indexes, object[] row)
        {
            var newRow = new object[row.Length];
            for (var i = 0; (i < page.Fields.Count); i++)
            {
                var field = page.Fields[i];
                newRow[i] = row[indexes[field.Name]];
            }
            return newRow;
        }

        object[] IDataController.GetListOfValues(string controller, string view, DistinctValueRequest request)
        {
            SelectView(controller, view);
            var page = new ViewPage(request);
            page.ApplyDataFilter(_config.CreateDataFilter(), controller, view, request.LookupContextController, request.LookupContextView, request.LookupContextFieldName);
            var distinctValues = new List<object>();
            var rules = _config.CreateBusinessRules();
            _serverRules = rules;
            if (_serverRules == null)
                _serverRules = CreateBusinessRules();
            _serverRules.Page = page;
            if (rules != null)
                rules.BeforeSelect(request);
            else
                _serverRules.ExecuteServerRules(request, ActionPhase.Before);
            if (_serverRules.EnableResultSet)
            {
                var reader = ExecuteResultSetReader(page);
                var uniqueValues = new SortedDictionary<object, object>();
                var hasNull = false;
                while (reader.Read())
                {
                    var v = reader[request.FieldName];
                    if (DBNull.Value.Equals(v))
                        hasNull = true;
                    else
                        uniqueValues[v] = v;
                }
                if (hasNull)
                    distinctValues.Add(null);
                foreach (var v in uniqueValues.Keys)
                    if (distinctValues.Count < page.PageSize)
                        distinctValues.Add(ConvertObjectToValue(v));
                    else
                        break;
            }
            else
            {
                using (var connection = CreateConnection(this))
                {
                    var command = CreateCommand(connection);
                    ConfigureCommand(command, page, CommandConfigurationType.SelectDistinct, null);
                    var reader = command.ExecuteReader();
                    while (reader.Read() && (distinctValues.Count < page.PageSize))
                    {
                        var v = reader.GetValue(0);
                        if (!(DBNull.Value.Equals(v)))
                            v = ConvertObjectToValue(v);
                        distinctValues.Add(v);
                    }
                    reader.Close();
                }
            }
            if (rules != null)
                rules.AfterSelect(request);
            else
                _serverRules.ExecuteServerRules(request, ActionPhase.After);
            var result = distinctValues.ToArray();
            EnsureJsonCompatibility(result);
            return result;
        }

        ActionResult IDataController.Execute(string controller, string view, ActionArgs args)
        {
            var result = new ActionResult();
            SelectView(controller, view);
            try
            {
                _serverRules = _config.CreateBusinessRules();
                if (_serverRules == null)
                    _serverRules = CreateBusinessRules();
                var handler = ((IActionHandler)(_serverRules));
                if (_config.PlugIn != null)
                    _config.PlugIn.PreProcessArguments(args, result, CreateViewPage());
                EnsureFieldValues(args);
                if (args.SqlCommandType != CommandConfigurationType.None)
                {
                    if (args.IsBatchEditOrDelete)
                    {
                        var page = CreateViewPage();
                        PopulatePageFields(page);
                        foreach (var sv in args.SelectedValues)
                        {
                            result.Canceled = false;
                            _serverRules.ClearBlackAndWhiteLists();
                            var key = sv.Split(',');
                            var keyIndex = 0;
                            foreach (var v in OriginalFieldValues)
                            {
                                var field = page.FindField(v.Name);
                                if (field != null)
                                {
                                    if (!field.IsPrimaryKey)
                                        v.Modified = true;
                                    else
                                    {
                                        if (v.Name == field.Name)
                                        {
                                            v.OldValue = key[keyIndex];
                                            v.Modified = false;
                                            keyIndex++;
                                        }
                                    }
                                }
                            }
                            using (var connection = CreateConnection(this, true))
                                try
                                {
                                    var command = CreateCommand(connection, args);
                                    ExecutePreActionCommands(args, result, connection);
                                    if (handler != null)
                                        handler.BeforeSqlAction(args, result);
                                    else
                                        _serverRules.ExecuteServerRules(args, result, ActionPhase.Before);
                                    if ((result.Errors.Count == 0) && !result.Canceled)
                                    {
                                        if (args.CommandName != "Delete")
                                            ProcessOneToOneFields(args);
                                        if (args.CommandName == "Delete")
                                            ProcessManyToManyFields(args);
                                        var rowsAffected = 1;
                                        if (ConfigureCommand(command, null, args.SqlCommandType, args.Values))
                                            rowsAffected = command.ExecuteNonQuery();
                                        result.RowsAffected = (result.RowsAffected + rowsAffected);
                                        if (args.CommandName == "Update")
                                            ProcessManyToManyFields(args);
                                        if (args.CommandName == "Delete")
                                            ProcessOneToOneFields(args);
                                        if (handler != null)
                                            handler.AfterSqlAction(args, result);
                                        else
                                            _serverRules.ExecuteServerRules(args, result, ActionPhase.After);
                                        command.Parameters.Clear();
                                        if (_config.PlugIn != null)
                                            _config.PlugIn.ProcessArguments(args, result, page);
                                    }
                                }
                                catch (Exception ex)
                                {
                                    if (connection.CanClose && (connection is DataTransaction))
                                        ((DataTransaction)(connection)).Rollback();
                                    throw ex;
                                }
                            if (result.CanceledSelectedValues)
                                break;
                        }
                    }
                    else
                    {
                        using (var connection = CreateConnection(this, true))
                            try
                            {
                                var command = CreateCommand(connection, args);
                                ExecutePreActionCommands(args, result, connection);
                                if (handler != null)
                                    handler.BeforeSqlAction(args, result);
                                else
                                    _serverRules.ExecuteServerRules(args, result, ActionPhase.Before);
                                if ((result.Errors.Count == 0) && !result.Canceled)
                                {
                                    if (args.CommandName != "Delete")
                                        ProcessOneToOneFields(args);
                                    if (args.CommandName == "Delete")
                                        ProcessManyToManyFields(args);
                                    if (ConfigureCommand(command, null, args.SqlCommandType, args.Values))
                                    {
                                        result.RowsAffected = command.ExecuteNonQuery();
                                        if (result.RowsAffected == 0)
                                        {
                                            result.RowNotFound = true;
                                            result.Errors.Add(Localizer.Replace("RecordChangedByAnotherUser", "The record has been changed by another user."));
                                        }
                                        else
                                            ExecutePostActionCommands(args, result, connection);
                                    }
                                    if ((args.CommandName == "Insert") || (args.CommandName == "Update"))
                                        ProcessManyToManyFields(args);
                                    if (args.CommandName == "Delete")
                                        ProcessOneToOneFields(args);
                                    if (handler != null)
                                        handler.AfterSqlAction(args, result);
                                    else
                                        _serverRules.ExecuteServerRules(args, result, ActionPhase.After);
                                    if (_config.PlugIn != null)
                                        _config.PlugIn.ProcessArguments(args, result, CreateViewPage());
                                }
                            }
                            catch (Exception ex)
                            {
                                if (connection.CanClose && (connection is DataTransaction))
                                    ((DataTransaction)(connection)).Rollback();
                                throw ex;
                            }
                    }
                }
                else
                {
                    if (args.CommandName.Equals("PopulateDynamicLookups"))
                        PopulateDynamicLookups(args, result);
                    else
                    {
                        if (args.CommandName.Equals("ProcessImportFile"))
                            ImportProcessor.Execute(args);
                        else
                        {
                            if (args.CommandName.Equals("Execute"))
                            {
                                using (var connection = CreateConnection(this))
                                {
                                    var command = CreateCommand(connection, args);
                                    command.ExecuteNonQuery();
                                }
                            }
                            else
                                _serverRules.ProcessSpecialActions(args, result);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                if (ex is System.Reflection.TargetInvocationException)
                    ex = ex.InnerException;
                HandleException(ex, args, result);
            }
            result.EnsureJsonCompatibility();
            return result;
        }

        private void EnsureFieldValues(ActionArgs args)
        {
            _originalFieldValues = args.Values;
            var page = CreateViewPage();
            page.Controller = args.Controller;
            page.View = args.View;
            var fieldValues = new FieldValueDictionary();
            if (args.Values == null)
                args.Values = new FieldValue[0];
            if (args.Values.Length > 0)
                fieldValues.AddRange(args.Values);
            var missingValues = new List<FieldValue>();
            foreach (var f in page.Fields)
                if (!(fieldValues.ContainsKey(f.Name)))
                    missingValues.Add(new FieldValue(f.Name));
            if (missingValues.Count > 0)
            {
                var newValues = new List<FieldValue>(args.Values);
                newValues.AddRange(missingValues);
                args.Values = newValues.ToArray();
            }
        }

        private bool SupportsLimitInSelect(object command)
        {
            return command.ToString().Contains("MySql");
        }

        private bool SupportsSkipInSelect(object command)
        {
            return command.ToString().Contains("Firebird");
        }

        protected virtual void SyncRequestedPage(PageRequest request, ViewPage page, DataConnection connection)
        {
            if (((request.SyncKey == null) || (request.SyncKey.Length == 0)) || (page.PageSize < 0))
                return;
            var syncCommand = CreateCommand(connection);
            ConfigureCommand(syncCommand, page, CommandConfigurationType.Sync, null);
            var keyFields = page.EnumerateSyncFields();
            if ((keyFields.Count > 0) && (keyFields.Count == request.SyncKey.Length))
            {
                var useSkip = (_serverRules.EnableResultSet || SupportsSkipInSelect(syncCommand));
                if (!useSkip)
                    for (var i = 0; (i < keyFields.Count); i++)
                    {
                        var field = keyFields[i];
                        var p = syncCommand.CreateParameter();
                        p.ParameterName = string.Format("{0}PrimaryKey_{1}", _parameterMarker, field.Name);
                        try
                        {
                            AssignParameterValue(p, field, request.SyncKey[i]);
                        }
                        catch (Exception)
                        {
                            return;
                        }
                        syncCommand.Parameters.Add(p);
                    }
                DbDataReader reader;
                if (_serverRules.EnableResultSet)
                    reader = ExecuteResultSetReader(page);
                else
                    reader = syncCommand.ExecuteReader();
                if (!useSkip)
                {
                    if (reader.Read())
                    {
                        var rowIndex = Convert.ToInt64(reader[0]);
                        page.PageIndex = Convert.ToInt32(Math.Floor((Convert.ToDouble((rowIndex - 1)) / Convert.ToDouble(page.PageSize))));
                        page.PageOffset = 0;
                    }
                }
                else
                {
                    var rowIndex = 1;
                    var keyFieldIndexes = new List<int>();
                    foreach (var pkField in keyFields)
                        keyFieldIndexes.Add(reader.GetOrdinal(pkField.Name));
                    while (reader.Read())
                    {
                        var matchCount = 0;
                        foreach (var primaryKeyFieldIndex in keyFieldIndexes)
                            if (Convert.ToString(reader[primaryKeyFieldIndex]) == Convert.ToString(request.SyncKey[matchCount]))
                                matchCount++;
                            else
                                break;
                        if (matchCount == keyFieldIndexes.Count)
                        {
                            page.PageIndex = Convert.ToInt32(Math.Floor((Convert.ToDouble((rowIndex - 1)) / Convert.ToDouble(page.PageSize))));
                            page.PageOffset = 0;
                            page.ResetSkipCount(false);
                            break;
                        }
                        else
                            rowIndex++;
                    }
                }
                reader.Close();
            }
        }

        protected virtual void HandleException(Exception ex, ActionArgs args, ActionResult result)
        {
            while (ex != null)
            {
                result.Errors.Add(ex.Message);
                ex = ex.InnerException;
            }
        }

        DbDataReader IDataEngine.ExecuteReader(PageRequest request)
        {
            _viewPage = new ViewPage(request);
            if (_config == null)
            {
                _config = CreateConfiguration(request.Controller);
                SelectView(request.Controller, request.View);
            }
            _viewPage.ApplyDataFilter(_config.CreateDataFilter(), request.Controller, request.View, null, null, null);
            InitBusinessRules(request, _viewPage);
            var connection = CreateConnection();
            var selectCommand = CreateCommand(connection);
            ConfigureCommand(selectCommand, _viewPage, CommandConfigurationType.Select, null);
            return selectCommand.ExecuteReader(CommandBehavior.CloseConnection);
        }

        string[] IAutoCompleteManager.GetCompletionList(string prefixText, int count, string contextKey)
        {
            if (contextKey == null)
                return null;
            var arguments = contextKey.Split(',');
            if (arguments.Length != 3)
                return null;
            var request = new DistinctValueRequest()
            {
                FieldName = arguments[2]
            };
            var filter = (request.FieldName + ":");
            foreach (var s in prefixText.Split(',', ';'))
            {
                var query = Controller.ConvertSampleToQuery(s);
                if (!(string.IsNullOrEmpty(query)))
                    filter = (filter + query);
            }
            request.Filter = new string[] {
                    filter};
            request.AllowFieldInFilter = true;
            request.MaximumValueCount = count;
            request.Controller = arguments[0];
            request.View = arguments[1];
            var list = ControllerFactory.CreateDataController().GetListOfValues(arguments[0], arguments[1], request);
            var result = new List<string>();
            foreach (var o in list)
                result.Add(Convert.ToString(o));
            return result.ToArray();
        }

        void IBusinessObject.AssignFilter(string filter, BusinessObjectParameters parameters)
        {
            _viewFilter = filter;
            _parameters = parameters;
        }

        public static string GetSelectView(string controller)
        {
            var c = new ControllerUtilities();
            return c.GetActionView(controller, "editForm1", "Select");
        }

        public static string GetUpdateView(string controller)
        {
            var c = new ControllerUtilities();
            return c.GetActionView(controller, "editForm1", "Update");
        }

        public static string GetInsertView(string controller)
        {
            var c = new ControllerUtilities();
            return c.GetActionView(controller, "createForm1", "Insert");
        }

        public static string GetDeleteView(string controller)
        {
            var c = new ControllerUtilities();
            return c.GetActionView(controller, "editForm1", "Delete");
        }

        private void PopulateManyToManyFields(ViewPage page)
        {
            var primaryKeyField = string.Empty;
            foreach (var field in page.Fields)
                if (!(string.IsNullOrEmpty(field.ItemsTargetController)))
                {
                    if (string.IsNullOrEmpty(primaryKeyField))
                        foreach (var f in page.Fields)
                            if (f.IsPrimaryKey)
                            {
                                primaryKeyField = f.Name;
                                break;
                            }
                    PopulateManyToManyField(page, field, primaryKeyField);
                }
        }

        public void PopulateManyToManyField(ViewPage page, DataField field, string primaryKeyField)
        {
            if (_junctionTableFieldName != field.Name)
            {
                _junctionTableFieldName = field.Name;
                _junctionTableMap = null;
            }
            if (_junctionTableMap == null)
            {
                _junctionTableMap = new SortedDictionary<string, List<string>>();
                if (page.Rows.Count > 0)
                {
                    // read contents of junction table from the database for each row of the page
                    var foreignKeyIndex = page.IndexOfField(primaryKeyField);
                    var listOfForeignKeys = new StringBuilder();
                    foreach (var row in page.Rows)
                    {
                        if (listOfForeignKeys.Length > 0)
                            listOfForeignKeys.Append("$or$");
                        listOfForeignKeys.Append(DataControllerBase.ConvertObjectToValue(row[foreignKeyIndex]));
                    }
                    string targetForeignKey1 = null;
                    string targetForeignKey2 = null;
                    ViewPage.InitializeManyToManyProperties(field, page.Controller, out targetForeignKey1, out targetForeignKey2);
                    var filter = string.Format("{0}:$in${1}", targetForeignKey1, listOfForeignKeys.ToString());
                    var request = new PageRequest(0, Int32.MaxValue, null, new string[] {
                                filter});
                    request.RequiresMetaData = true;
                    var manyToManyPage = ControllerFactory.CreateDataController().GetPage(field.ItemsTargetController, null, request);
                    // enumerate values in junction table
                    var targetForeignKey1Index = manyToManyPage.IndexOfField(targetForeignKey1);
                    var targetForeignKey2Index = manyToManyPage.IndexOfField(targetForeignKey2);
                    // determine text field for items
                    var items = new SortedDictionary<object, object>();
                    var keyList = new List<object>();
                    var targetTextIndex = -1;
                    if (!(field.SupportsStaticItems()))
                        foreach (var f in manyToManyPage.Fields)
                            if (f.Name == targetForeignKey2)
                            {
                                if (!(string.IsNullOrEmpty(f.AliasName)))
                                    targetTextIndex = manyToManyPage.IndexOfField(f.AliasName);
                                else
                                    targetTextIndex = manyToManyPage.IndexOfField(f.Name);
                                break;
                            }
                    foreach (var row in manyToManyPage.Rows)
                    {
                        var v1 = row[targetForeignKey1Index];
                        var v2 = row[targetForeignKey2Index];
                        if (v1 != null)
                        {
                            var s1 = Convert.ToString(v1);
                            List<string> values = null;
                            if (!(_junctionTableMap.TryGetValue(s1, out values)))
                            {
                                values = new List<string>();
                                _junctionTableMap[s1] = values;
                            }
                            values.Add(Convert.ToString(v2));
                            if (!((targetTextIndex == -1)))
                            {
                                var text = row[targetTextIndex];
                                if (!(items.ContainsKey(v2)))
                                {
                                    items.Add(v2, text);
                                    keyList.Add(v2);
                                }
                            }
                        }
                    }
                    if (items.Count != 0)
                        foreach (var k in keyList)
                        {
                            var v = items[k];
                            field.Items.Add(new object[] {
                                        k,
                                        v});
                        }
                }
            }
            foreach (var values in page.Rows)
            {
                var key = Convert.ToString(page.SelectFieldValue(primaryKeyField, values));
                List<string> keyValues = null;
                if (_junctionTableMap.TryGetValue(key, out keyValues))
                    page.UpdateFieldValue(field.Name, values, string.Join(",", keyValues.ToArray()));
            }
        }

        protected virtual void ProcessOneToOneFields(ActionArgs args)
        {
            var oneToOneFieldNav = Config.SelectSingleNode("/c:dataController/c:fields/c:field[c:items/@style=\'OneToOne\']");
            if (oneToOneFieldNav != null)
            {
                var targetValues = new List<FieldValue>();
                var itemsNav = oneToOneFieldNav.SelectSingleNode("c:items", Config.Resolver);
                var fieldMap = new SortedDictionary<string, string>();
                // configure the primary key field value
                var localKeyFieldName = oneToOneFieldNav.GetAttribute("name", string.Empty);
                var targetKeyFieldName = itemsNav.GetAttribute("dataValueField", string.Empty);
                var fvo = args[localKeyFieldName];
                var targetFvo = new FieldValue(targetKeyFieldName, fvo.OldValue, fvo.NewValue, fvo.ReadOnly)
                {
                    Modified = fvo.Modified
                };
                targetValues.Add(targetFvo);
                fieldMap[targetKeyFieldName] = localKeyFieldName;
                //  enumerate "copy" field values
                var copy = itemsNav.GetAttribute("copy", string.Empty);
                var m = Regex.Match(copy, "(\\w+)\\s*=\\s*(\\w+)");
                while (m.Success)
                {
                    var localFieldName = m.Groups[1].Value;
                    var targetFieldName = m.Groups[2].Value;
                    if (!(fieldMap.ContainsKey(targetFieldName)))
                    {
                        fvo = args[localFieldName];
                        targetFvo = new FieldValue(targetFieldName, fvo.OldValue, fvo.NewValue, fvo.ReadOnly)
                        {
                            Modified = fvo.Modified
                        };
                        targetValues.Add(targetFvo);
                        fieldMap[targetFieldName] = localFieldName;
                    }
                    m = m.NextMatch();
                }
                // create a request
                var targetArgs = new ActionArgs()
                {
                    Controller = itemsNav.GetAttribute("dataController", string.Empty),
                    View = args.View,
                    CommandName = args.CommandName,
                    LastCommandName = args.LastCommandName
                };
                if (targetArgs.LastCommandName == "BatchEdit")
                    targetArgs.LastCommandName = "Edit";
                targetArgs.Values = targetValues.ToArray();
                var result = ControllerFactory.CreateDataController().Execute(targetArgs.Controller, targetArgs.View, targetArgs);
                result.RaiseExceptionIfErrors();
                // copy the new values back to the original source
                foreach (var tfvo in targetArgs.Values)
                {
                    string mappedFieldName = null;
                    if (fieldMap.TryGetValue(tfvo.Name, out mappedFieldName))
                    {
                        fvo = args[mappedFieldName];
                        if ((tfvo != null) && fvo.NewValue != tfvo.NewValue)
                        {
                            fvo.NewValue = tfvo.NewValue;
                            fvo.Modified = true;
                        }
                    }
                }
            }
        }

        private void ProcessManyToManyFields(ActionArgs args)
        {
            var m2mFields = Config.Select("/c:dataController/c:fields/c:field[c:items/@targetController!=\'\']");
            if (m2mFields.Count > 0)
            {
                var primaryKeyNode = Config.SelectSingleNode("/c:dataController/c:fields/c:field[@isPrimaryKey=\'true\']");
                var primaryKey = args.SelectFieldValueObject(primaryKeyNode.GetAttribute("name", string.Empty));
                while (m2mFields.MoveNext())
                {
                    var field = new DataField(m2mFields.Current, Config.Resolver);
                    var fv = args.SelectFieldValueObject(field.Name);
                    if (fv != null)
                    {
                        if (fv.Scope == "client")
                        {
                            fv.OldValue = fv.NewValue;
                            fv.Modified = false;
                        }
                        else
                        {
                            if (args.CommandName == "Delete")
                            {
                                fv.Modified = true;
                                fv.NewValue = null;
                            }
                            ProcessManyToManyField(args.Controller, field, fv, primaryKey.Value);
                            fv.Modified = false;
                        }
                    }
                }
            }
        }

        public void ProcessManyToManyField(string controllerName, DataField field, FieldValue fieldValue, object primaryKey)
        {
            var originalOldValue = fieldValue.OldValue;
            var restoreOldValue = false;
            var keepBatch = false;
            var args = ActionArgs.Current;
            if ((args != null) && args.IsBatchEditOrDelete)
            {
                if ((args.CommandName == "Update") && !fieldValue.Modified)
                    return;
                var pkFilter = new List<string>();
                var pkIterator = _config.Select("/c:dataController/c:fields/c:field[@isPrimaryKey=\'true\']");
                while (pkIterator.MoveNext())
                    pkFilter.Add(string.Format("{0}:={1}", pkIterator.Current.GetAttribute("name", string.Empty), primaryKey));
                var r = new PageRequest(0, 1, null, pkFilter.ToArray())
                {
                    FieldFilter = new string[] {
                        field.Name},
                    MetadataFilter = new string[] {
                        "fields"},
                    RequiresMetaData = true
                };
                var p = ControllerFactory.CreateDataController().GetPage(controllerName, _viewId, r);
                if (p.Rows.Count == 1)
                {
                    originalOldValue = fieldValue.OldValue;
                    restoreOldValue = true;
                    fieldValue.OldValue = p.Rows[0][p.IndexOfField(field.Name)];
                }
                var keepBatchFlag = args[(fieldValue.Name + "_BatchKeep")];
                if (keepBatchFlag != null)
                    keepBatch = true.Equals(keepBatchFlag.Value);
            }
            var oldValues = BusinessRulesBase.ValueToList(((string)(fieldValue.OldValue)));
            var newValues = BusinessRulesBase.ValueToList(((string)(fieldValue.Value)));
            if (keepBatch)
                foreach (var v in oldValues)
                    if (!(newValues.Contains(v)))
                        newValues.Add(v);
            if (!(BusinessRulesBase.ListsAreEqual(oldValues, newValues)))
            {
                string targetForeignKey1 = null;
                string targetForeignKey2 = null;
                ViewPage.InitializeManyToManyProperties(field, controllerName, out targetForeignKey1, out targetForeignKey2);
                var controller = ControllerFactory.CreateDataController();
                foreach (var s in oldValues)
                    if (!(newValues.Contains(s)))
                    {
                        var deleteArgs = new ActionArgs()
                        {
                            Controller = field.ItemsTargetController,
                            CommandName = "Delete",
                            LastCommandName = "Select",
                            Values = new FieldValue[] {
                                new FieldValue(targetForeignKey1, primaryKey, primaryKey),
                                new FieldValue(targetForeignKey2, s, s),
                                new FieldValue("_SurrogatePK", new string[] {
                                            targetForeignKey1,
                                            targetForeignKey2})}
                        };
                        var result = controller.Execute(field.ItemsTargetController, null, deleteArgs);
                        result.RaiseExceptionIfErrors();
                    }
                foreach (var s in newValues)
                    if (!(oldValues.Contains(s)))
                    {
                        var updateArgs = new ActionArgs()
                        {
                            Controller = field.ItemsTargetController,
                            CommandName = "Insert",
                            LastCommandName = "New",
                            Values = new FieldValue[] {
                                new FieldValue(targetForeignKey1, primaryKey),
                                new FieldValue(targetForeignKey2, s)}
                        };
                        var result = controller.Execute(field.ItemsTargetController, null, updateArgs);
                        result.RaiseExceptionIfErrors();
                    }
            }
            if (restoreOldValue)
                fieldValue.OldValue = originalOldValue;
        }

        public virtual Stream GetDataControllerStream(string controller)
        {
            if (!ApplicationServices.IsSiteContentEnabled || (controller == ApplicationServices.SiteContentControllerName))
                return null;
            var context = HttpContext.Current;
            var requiresUser = false;
            if (context.User == null)
            {
                requiresUser = true;
                // Establish user identity for REST requests
                var authorization = context.Request.Headers["Authorization"];
                if (string.IsNullOrEmpty(authorization))
                    context.User = new RolePrincipal(new AnonymousUserIdentity());
                else
                {
                    if (authorization.StartsWith("Basic", StringComparison.OrdinalIgnoreCase))
                    {
                        var login = Encoding.Default.GetString(Convert.FromBase64String(authorization.Substring(6))).Split(new char[] {
                                    ':'}, 2);
                        if (Membership.ValidateUser(login[0], login[1]))
                            context.User = new RolePrincipal(new FormsIdentity(new FormsAuthenticationTicket(login[0], false, 10)));
                    }
                    if (context.User == null)
                    {
                        context.Response.StatusCode = 401;
                        context.Response.End();
                    }
                }
            }
            var sysControllersPath = ("sys/controllers%/"
                        + (controller + ".xml"));
            var data = ((byte[])(HttpContext.Current.Cache[sysControllersPath]));
            if (data == null)
            {
                if (ApplicationServicesBase.Create().Supports(ApplicationFeature.DynamicControllerCustomization))
                    data = ApplicationServices.Current.ReadSiteContentBytes(sysControllersPath);
                if (data == null)
                    data = new byte[0];
                HttpContext.Current.Cache.Add(sysControllersPath, data, null, DateTime.Now.AddMinutes(10), Cache.NoSlidingExpiration, CacheItemPriority.Normal, null);
            }
            if (requiresUser)
                context.User = null;
            if ((data == null) || (data.Length == 0))
                return null;
            else
                return new MemoryStream(data);
        }

        public virtual string GetSurvey(string surveyName)
        {
            var root = Path.Combine(HttpRuntime.AppDomainAppPath, "js", "surveys");
            var survey = ControllerConfigurationUtility.GetFileText(Path.Combine(root, (surveyName + ".min.js")), Path.Combine(root, (surveyName + ".js")));
            var layout = ControllerConfigurationUtility.GetFileText(Path.Combine(root, (surveyName + ".html")), Path.Combine(root, (surveyName + ".htm")));
            var rules = ControllerConfigurationUtility.GetFileText(Path.Combine(root, (surveyName + ".rules.min.js")), Path.Combine(root, (surveyName + ".rules.js")));
            if (string.IsNullOrEmpty(survey))
                survey = ControllerConfigurationUtility.GetResourceText(string.Format("MyCompany.Surveys.{0}.min.js", surveyName), string.Format("MyCompany.{0}.min.js", surveyName), string.Format("MyCompany.Surveys.{0}.js", surveyName), string.Format("MyCompany.{0}.js", surveyName));
            if (string.IsNullOrEmpty(survey))
                throw new HttpException(404, "Not found.");
            if (string.IsNullOrEmpty(layout))
                layout = ControllerConfigurationUtility.GetResourceText(string.Format("MyCompany.Surveys.{0}.html", surveyName), string.Format("MyCompany.Surveys.{0}.htm", surveyName), string.Format("MyCompany.{0}.html", surveyName), string.Format("MyCompany.{0}.htm", surveyName));
            if (string.IsNullOrEmpty(rules))
                rules = ControllerConfigurationUtility.GetResourceText(string.Format("MyCompany.Surveys.{0}.rules.min.js", surveyName), string.Format("MyCompany.{0}.rules.min.js", surveyName), string.Format("MyCompany.Surveys.{0}.rules.js", surveyName), string.Format("MyCompany.{0}.rules.js", surveyName));
            var sb = new StringBuilder();
            if (!(string.IsNullOrEmpty(rules)))
            {
                sb.AppendLine("(function() {");
                sb.AppendFormat("$app.survey(\'register\', \'{0}\', function () {{", surveyName);
                sb.AppendLine();
                sb.AppendLine(rules);
                sb.AppendLine("});");
                sb.AppendLine("})();");
            }
            if (!(string.IsNullOrEmpty(layout)))
                survey = Regex.Replace(survey, "}\\s*\\)\\s*;?\\s*$", string.Format(", layout: \'{0}\' }});", HttpUtility.JavaScriptStringEncode(layout)));
            sb.Append(survey);
            return sb.ToString();
        }

        protected virtual DbDataReader ExecuteVirtualReader(PageRequest request, ViewPage page)
        {
            var table = new DataTable();
            foreach (var field in page.Fields)
                table.Columns.Add(field.Name, typeof(int));
            var r = table.NewRow();
            if (page.ContainsField("PrimaryKey"))
                r["PrimaryKey"] = 1;
            table.Rows.Add(r);
            return new DataTableReader(table);
        }

        protected virtual string GetRequestedViewType(ViewPage page)
        {
            var viewType = page.ViewType;
            if (string.IsNullOrEmpty(viewType))
                viewType = _view.GetAttribute("type", string.Empty);
            return viewType;
        }

        protected virtual void EnsureSystemPageFields(PageRequest request, ViewPage page, DbCommand command)
        {
            if (page.Distinct)
            {
                var i = 0;
                while (i < page.Fields.Count)
                    if (page.Fields[i].IsPrimaryKey)
                        page.Fields.RemoveAt(i);
                    else
                        i++;
                var field = new DataField()
                {
                    Name = "group_count_",
                    Type = "Double"
                };
                page.Fields.Add(field);
            }
            if (!(RequiresHierarchy(page)))
                return;
            var requiresHierarchyOrganization = false;
            foreach (var field in page.Fields)
                if (field.IsTagged("hierarchy-parent"))
                    requiresHierarchyOrganization = true;
                else
                {
                    if (field.IsTagged("hierarchy-organization"))
                    {
                        requiresHierarchyOrganization = false;
                        break;
                    }
                }
            if (requiresHierarchyOrganization)
            {
                var field = new DataField()
                {
                    Name = HierarchyOrganizationFieldName,
                    Type = "String",
                    Tag = "hierarchy-organization",
                    Len = 255,
                    Columns = 20,
                    Hidden = true,
                    ReadOnly = true
                };
                page.Fields.Add(field);
            }
        }

        protected virtual bool RequiresHierarchy(ViewPage page)
        {
            if (!((GetRequestedViewType(page) == "DataSheet")))
                return false;
            foreach (var field in page.Fields)
                if (field.IsTagged("hierarchy-parent"))
                {
                    if ((page.Filter != null) && (page.Filter.Length > 0))
                        return false;
                    return true;
                }
            return false;
        }

        protected virtual bool DatabaseEngineIs(DbCommand command, params System.String[] flavors)
        {
            return DatabaseEngineIs(command.GetType().FullName, flavors);
        }

        protected virtual bool DatabaseEngineIs(string typeName, params System.String[] flavors)
        {
            foreach (var s in flavors)
                if (typeName.Contains(s))
                    return true;
            return false;
        }

        protected static void FullAccess(bool grant, params System.String[] controllers)
        {
            var access = ((SortedDictionary<string, int>)(HttpContext.Current.Items["Controller_AccessGranted"]));
            if (access == null)
            {
                access = new SortedDictionary<string, int>();
                HttpContext.Current.Items["Controller_AccessGranted"] = access;
            }
            foreach (var c in controllers)
            {
                var count = 0;
                access.TryGetValue(c, out count);
                if (grant)
                    count++;
                else
                    count = (count - 1);
                access[c] = count;
            }
        }

        public static bool FullAccessGranted(string controller)
        {
            var access = ((SortedDictionary<string, int>)(HttpContext.Current.Items["Controller_AccessGranted"]));
            var count = 0;
            if (access != null)
            {
                access.TryGetValue(controller, out count);
                if (count == 0)
                    access.TryGetValue("*", out count);
            }
            return (count > 0);
        }

        protected virtual bool ValidateViewAccess(string controller, string view, string access)
        {
            if (!ApplicationServicesBase.AuthorizationIsSupported)
                return true;
            var context = HttpContext.Current;
            if ((AllowPublicAccess || FullAccessGranted(controller)) || (context.Request.Params["_validationKey"] == ApplicationServices.ValidationKey))
                return true;
            if (AccessControlList.Current.Enabled)
                return true;
            if (controller.Equals(ApplicationServicesBase.SiteContentControllerName, StringComparison.OrdinalIgnoreCase) && !(UserIsInRole(ApplicationServices.SiteContentEditors)))
                return false;
            var allow = true;
            var executionFilePath = context.Request.AppRelativeCurrentExecutionFilePath;
            if (!(executionFilePath.StartsWith("~/appservices/", StringComparison.OrdinalIgnoreCase)) && !(executionFilePath.Equals("~/charthost.aspx", StringComparison.OrdinalIgnoreCase)))
            {
                if (!context.User.Identity.IsAuthenticated && !(controller.StartsWith("aspnet_")))
                    allow = (access == "Public");
            }
            return allow;
        }

        DataTable ExecuteResultSetTable(ViewPage page)
        {
            if (_serverRules.ResultSet == null)
                return null;
            var expressions = new SelectClauseDictionary();
            foreach (DataColumn c in _serverRules.ResultSet.Columns)
                expressions[c.ColumnName] = c.ColumnName;
            if (page.Fields.Count == 0)
            {
                PopulatePageFields(page);
                EnsurePageFields(page, null);
            }
            var resultView = new DataView(_serverRules.ResultSet)
            {
                Sort = page.SortExpression
            };
            using (var connection = CreateConnection(false))
            {
                var command = connection.CreateCommand();
                var sb = new StringBuilder();
                _resultSetParameters = command.Parameters;
                expressions.Add("_DataView_RowFilter_", "true");
                AppendFilterExpressionsToWhere(sb, page, command, expressions, string.Empty);
                var filter = sb.ToString();
                if (filter.StartsWith("where"))
                    filter = filter.Substring(5);
                filter = Regex.Replace(filter, (Regex.Escape(_parameterMarker) + "\\w+"), DoReplaceResultSetParameter);
                resultView.RowFilter = filter;
                if (page.PageSize > 0)
                    page.TotalRowCount = resultView.Count;
            }
            if (RequiresPreFetching(page))
                page.ResetSkipCount(true);
            var result = resultView.ToTable();
            var fieldFilter = page.RequestedFieldFilter();
            if ((fieldFilter != null) && (fieldFilter.Length > 0))
            {
                var fieldIndex = 0;
                while (fieldIndex < page.Fields.Count)
                {
                    var outputField = page.Fields[fieldIndex];
                    var fieldName = outputField.Name;
                    if ((Array.IndexOf(fieldFilter, fieldName) == -1) && (fieldName != "group_count_" && !outputField.IsPrimaryKey))
                        page.Fields.RemoveAt(fieldIndex);
                    else
                        fieldIndex++;
                }
            }
            if (page.Distinct)
            {
                var groupedTable = result.DefaultView.ToTable(true, fieldFilter);
                groupedTable.Columns.Add(new DataColumn("group_count_", typeof(int)));
                foreach (DataRow r in groupedTable.Rows)
                {
                    var filterExpression = new StringBuilder();
                    foreach (var fieldName in fieldFilter)
                    {
                        if (filterExpression.Length > 0)
                            filterExpression.Append("and");
                        filterExpression.AppendFormat("({0}=\'{1}\')", fieldName, r[fieldName].ToString().Replace("\'", "\\\'\\\'"));
                    }
                    result.DefaultView.RowFilter = filterExpression.ToString();
                    r["group_count_"] = result.DefaultView.Count;
                }
                result = groupedTable;
            }
            _serverRules.ResultSetSize = result.Rows.Count;
            return result;
        }

        DbDataReader ExecuteResultSetReader(ViewPage page)
        {
            if (_serverRules.ResultSet == null)
                return null;
            return ExecuteResultSetTable(page).CreateDataReader();
        }

        protected virtual string DoReplaceResultSetParameter(Match m)
        {
            var p = _resultSetParameters[m.Value];
            return string.Format("\'{0}\'", p.Value.ToString().Replace("\'", "\'\'"));
        }

        bool RequiresPreFetching(ViewPage page)
        {
            var viewType = page.ViewType;
            if (string.IsNullOrEmpty(viewType))
                viewType = _view.GetAttribute("type", string.Empty);
            return (page.PageSize != Int32.MaxValue && new ControllerUtilities().SupportsCaching(page, viewType));
        }

        public delegate object SpecialConversionFunction(object o);
    }

    public partial class ControllerUtilities : ControllerUtilitiesBase
    {
    }

    public class ControllerUtilitiesBase
    {

        public virtual bool SupportsScrollingInDataSheet
        {
            get
            {
                return false;
            }
        }

        public virtual string GetActionView(string controller, string view, string action)
        {
            return view;
        }

        public virtual bool UserIsInRole(params System.String[] roles)
        {
            var context = HttpContext.Current;
            if (context == null)
                return true;
            var count = 0;
            foreach (var r in roles)
                if (!(string.IsNullOrEmpty(r)))
                    foreach (var role in r.Split(','))
                    {
                        var testRole = role.Trim();
                        if (!(string.IsNullOrEmpty(testRole)))
                        {
                            if (!context.User.Identity.IsAuthenticated)
                                return false;
                            var roleKey = ("IsInRole_" + testRole);
                            var isInRole = context.Items[roleKey];
                            if (isInRole == null)
                            {
                                isInRole = context.User.IsInRole(testRole);
                                context.Items[roleKey] = isInRole;
                            }
                            if ((bool)(isInRole))
                                return true;
                        }
                        count++;
                    }
            return (count == 0);
        }

        public virtual bool SupportsLastEnteredValues(string controller)
        {
            return false;
        }

        public virtual bool SupportsCaching(ViewPage page, string viewType)
        {
            if (viewType == "DataSheet")
            {
                if (!SupportsScrollingInDataSheet && !ApplicationServices.IsTouchClient)
                    page.SupportsCaching = false;
            }
            else
            {
                if (viewType == "Grid")
                {
                    if (!ApplicationServices.IsTouchClient)
                        page.SupportsCaching = false;
                }
                else
                    page.SupportsCaching = false;
            }
            return page.SupportsCaching;
        }

        public static string ValidateName(string name)
        {
            // Prevent injection of single quote in the name used in XPath queries.
            if (!(string.IsNullOrEmpty(name)))
                return name.Replace("\'", "_");
            return name;
        }
    }

    public class ControllerFactory
    {

        public static IDataController CreateDataController()
        {
            return new Controller();
        }

        public static IAutoCompleteManager CreateAutoCompleteManager()
        {
            return new Controller();
        }

        public static IDataEngine CreateDataEngine()
        {
            return new Controller();
        }

        public static Stream GetDataControllerStream(string controller)
        {
            return new Controller().GetDataControllerStream(controller);
        }

        public static string GetSurvey(string survey)
        {
            return new Controller().GetSurvey(survey);
        }
    }

    public partial class StringEncryptor : StringEncryptorBase
    {

        public static string ToString(object o)
        {
            var enc = new StringEncryptor();
            return enc.Encrypt(o.ToString());
        }

        public static string ToBase64String(object o)
        {
            return Convert.ToBase64String(Encoding.Default.GetBytes(ToString(o)));
        }

        public static string FromString(string s)
        {
            var enc = new StringEncryptor();
            return enc.Decrypt(s);
        }

        public static string FromBase64String(string s)
        {
            return FromString(Encoding.Default.GetString(Convert.FromBase64String(s)));
        }
    }

    public class StringEncryptorBase
    {

        public virtual byte[] Key
        {
            get
            {
                return new byte[] {
                        253,
                        124,
                        8,
                        201,
                        31,
                        27,
                        89,
                        189,
                        251,
                        47,
                        198,
                        241,
                        38,
                        78,
                        198,
                        193,
                        18,
                        179,
                        209,
                        220,
                        34,
                        84,
                        178,
                        99,
                        193,
                        84,
                        64,
                        15,
                        188,
                        98,
                        101,
                        153};
            }
        }

        public virtual byte[] IV
        {
            get
            {
                return new byte[] {
                        87,
                        84,
                        163,
                        98,
                        205,
                        255,
                        139,
                        173,
                        16,
                        88,
                        88,
                        254,
                        133,
                        176,
                        55,
                        112};
            }
        }

        public virtual string Encrypt(string s)
        {
            var plainText = Encoding.Default.GetBytes(string.Format("{0}$${1}", s, s.GetHashCode()));
            byte[] cipherText;
            using (var output = new MemoryStream())
            {
                using (var cOutput = new CryptoStream(output, Aes.Create().CreateEncryptor(Key, IV), CryptoStreamMode.Write))
                    cOutput.Write(plainText, 0, plainText.Length);
                cipherText = output.ToArray();
            }
            return Convert.ToBase64String(cipherText);
        }

        public virtual string Decrypt(string s)
        {
            var cipherText = Convert.FromBase64String(s);
            byte[] plainText;
            using (var output = new MemoryStream())
            {
                using (var cOutput = new CryptoStream(output, Aes.Create().CreateDecryptor(Key, IV), CryptoStreamMode.Write))
                    cOutput.Write(cipherText, 0, cipherText.Length);
                plainText = output.ToArray();
            }
            var plain = Encoding.Default.GetString(plainText);
            var parts = plain.Split(new string[] {
                        "$$"}, StringSplitOptions.None);
            if (parts.Length != 2 || !((parts[0].GetHashCode() == Convert.ToInt32(parts[1]))))
                throw new Exception("Attempt to alter the hashed URL.");
            return parts[0];
        }
    }
}
