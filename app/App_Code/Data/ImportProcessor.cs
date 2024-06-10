using System;
using System.Collections.Generic;
using System.Data;
using System.Data.OleDb;
using System.Globalization;
using System.Linq;
using System.Net.Mail;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Web;
using System.Web.Caching;
using System.Web.Configuration;
using System.Data.Common;
using System.Runtime.Serialization;
using System.Collections;

namespace MyCompany.Data
{
    public class ImportMapDictionary : SortedDictionary<int, DataField>
    {
    }

    public class ImportLookupDictionary : SortedDictionary<string, DataField>
    {
    }

    public partial class ImportProcessor : ImportProcessorBase
    {
    }

    public partial class CsvImportProcessor : ImportProcessorBase
    {

        public override IDataReader OpenRead(string fileName, string selectClause)
        {
            return new CsvReader(new StreamReader(fileName, true), true);
        }

        public override int CountRecords(string fileName)
        {
            var count = 0;
            using (var reader = new CsvReader(new StreamReader(fileName), true))
                while (reader.ReadNextRecord())
                    count++;
                return count;
        }
    }

    public partial class ImportProcessorFactory : ImportProcessorFactoryBase
    {
    }

    public class ImportProcessorFactoryBase
    {

        public virtual ImportProcessorBase CreateProcessor(string fileName)
        {
            var extension = Path.GetExtension(fileName).ToLower();
            if (extension.Contains(".xls") || extension.Contains(".xlsx"))
                return new ImportProcessor();
            if (extension.Contains(".csv") || extension.Contains(".txt"))
                return new CsvImportProcessor();
            throw new Exception(string.Format("The format of file <b>{0}</b> is not supported.", Path.GetFileName(fileName)));
        }

        public static ImportProcessorBase Create(string fileName)
        {
            var factory = new ImportProcessorFactory();
            return factory.CreateProcessor(fileName);
        }
    }

    public class ImportProcessorBase
    {

        public ImportProcessorBase()
        {
        }

        public static string SharedTempPath
        {
            get
            {
                var p = WebConfigurationManager.AppSettings["SharedTempPath"];
                if (string.IsNullOrEmpty(p))
                    p = Path.GetTempPath();
                if (!(Path.IsPathRooted(p)))
                    p = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, p);
                return p;
            }
        }

        public static void Execute(ActionArgs args)
        {
            Process(args);
        }

        private static void Process(object args)
        {
            var arguments = new List<string>(((ActionArgs)(args)).CommandArgument.Split(';'));
            var fileName = Path.Combine(ImportProcessor.SharedTempPath, arguments[0]);
            arguments.RemoveAt(0);
            var controller = arguments[0];
            arguments.RemoveAt(0);
            var view = arguments[0];
            arguments.RemoveAt(0);
            var notify = arguments[0];
            arguments.RemoveAt(0);
            var ip = ImportProcessorFactory.Create(fileName);
            try
            {
                ip.Process(fileName, controller, view, notify, arguments);
            }
            finally
            {
                if (File.Exists(fileName))
                    try
                    {
                        File.Delete(fileName);
                    }
                    catch (Exception)
                    {
                    }
            }
        }

        public virtual IDataReader OpenRead(string fileName, string selectClause)
        {
            var extension = Path.GetExtension(fileName).ToLower();
            string tableName = null;
            var connectionString = new OleDbConnectionStringBuilder()
            {
                Provider = "Microsoft.ACE.OLEDB.12.0"
            };
            if (extension == ".csv")
            {
                connectionString["Extended Properties"] = "text;HDR=Yes;FMT=Delimited";
                connectionString.DataSource = Path.GetDirectoryName(fileName);
                tableName = Path.GetFileName(fileName);
            }
            else
            {
                if (extension == ".xls")
                {
                    connectionString["Extended Properties"] = "Excel 8.0;HDR=Yes;IMEX=1";
                    connectionString.DataSource = fileName;
                }
                else
                {
                    if (extension == ".xlsx")
                    {
                        connectionString["Extended Properties"] = "Excel 12.0 Xml;HDR=YES";
                        connectionString.DataSource = fileName;
                    }
                }
            }
            var connection = new OleDbConnection(connectionString.ToString());
            connection.Open();
            if (string.IsNullOrEmpty(tableName))
            {
                var tables = connection.GetSchema("Tables");
                tableName = Convert.ToString(tables.Rows[0]["TABLE_NAME"]);
            }
            try
            {
                var command = connection.CreateCommand();
                command.CommandText = string.Format("select {0} from [{1}]", selectClause, tableName);
                return command.ExecuteReader(CommandBehavior.CloseConnection);
            }
            catch (Exception)
            {
                connection.Close();
                throw;
            }
        }

        private void EnumerateFields(IDataReader reader, ViewPage page, ImportMapDictionary map, ImportLookupDictionary lookups, List<string> userMapping)
        {
            var mappedFields = new List<string>();
            for (var i = 0; (i < reader.FieldCount); i++)
            {
                var fieldName = reader.GetName(i);
                DataField field = null;
                var autoDetect = true;
                if (userMapping != null)
                {
                    var mappedFieldName = userMapping[i];
                    autoDetect = string.IsNullOrEmpty(mappedFieldName);
                    if (!autoDetect)
                        fieldName = mappedFieldName;
                }
                if (autoDetect)
                    foreach (var f in page.Fields)
                        if (fieldName.Equals(f.HeaderText, StringComparison.CurrentCultureIgnoreCase) || fieldName.Equals(f.Label, StringComparison.CurrentCultureIgnoreCase))
                        {
                            field = f;
                            break;
                        }
                if (field == null)
                    field = page.FindField(fieldName);
                if (field != null)
                {
                    if (!(string.IsNullOrEmpty(field.AliasName)))
                        field = page.FindField(field.AliasName);
                    if (!field.ReadOnly)
                    {
                        if (!(mappedFields.Contains(field.Name)))
                        {
                            map.Add(i, field);
                            mappedFields.Add(field.Name);
                        }
                    }
                    else
                        foreach (var f in page.Fields)
                            if (f.AliasName == field.Name)
                            {
                                map.Add(i, field);
                                lookups.Add(field.Name, f);
                                break;
                            }
                }
            }
        }

        public void ResolveLookups(ImportLookupDictionary lookups)
        {
            foreach (var fieldName in lookups.Keys)
            {
                var lookupField = lookups[fieldName];
                if ((lookupField.Items.Count == 0) && (string.IsNullOrEmpty(lookupField.ItemsDataValueField) || string.IsNullOrEmpty(lookupField.ItemsDataTextField)))
                {
                    var lookupRequest = new PageRequest()
                    {
                        Controller = lookupField.ItemsDataController,
                        View = lookupField.ItemsDataView,
                        RequiresMetaData = true
                    };
                    var lp = ControllerFactory.CreateDataController().GetPage(lookupRequest.Controller, lookupRequest.View, lookupRequest);
                    if (string.IsNullOrEmpty(lookupField.ItemsDataValueField))
                        foreach (var f in lp.Fields)
                            if (f.IsPrimaryKey)
                            {
                                lookupField.ItemsDataValueField = f.Name;
                                break;
                            }
                    if (string.IsNullOrEmpty(lookupField.ItemsDataTextField))
                        foreach (var f in lp.Fields)
                            if ((!f.IsPrimaryKey && !f.Hidden) && (!f.AllowNulls || (f.Type == "String")))
                            {
                                lookupField.ItemsDataTextField = f.Name;
                                break;
                            }
                }
            }
        }

        protected virtual void BeforeProcess(string fileName, string controller, string view, string notify, List<string> userMapping)
        {
        }

        protected virtual void AfterProcess(string fileName, string controller, string view, string notify, List<string> userMapping)
        {
        }

        public virtual void Process(string fileName, string controller, string view, string notify, List<string> userMapping)
        {
            BeforeProcess(fileName, controller, view, notify, userMapping);
            var logFileName = Path.GetTempFileName();
            var log = File.CreateText(logFileName);
            log.WriteLine("{0:s} Import process started.", DateTime.Now);
            // retrieve metadata
            var request = new PageRequest()
            {
                Controller = controller,
                View = view,
                RequiresMetaData = true
            };
            var page = ControllerFactory.CreateDataController().GetPage(controller, view, request);
            // open data reader and enumerate fields
            var reader = OpenRead(fileName, "*");
            var map = new ImportMapDictionary();
            var lookups = new ImportLookupDictionary();
            EnumerateFields(reader, page, map, lookups, userMapping);
            // resolve lookup data value field and data text fields
            ResolveLookups(lookups);
            // insert records from the file
            var recordCount = 0;
            var errorCount = 0;
            var nfi = CultureInfo.CurrentCulture.NumberFormat;
            var numberCleanupRegex = new Regex(string.Format("[^\\d\\{0}\\{1}\\{2}]", nfi.CurrencyDecimalSeparator, nfi.NegativeSign, nfi.NumberDecimalSeparator));
            var externalFilterValues = new SortedDictionary<string, object>();
            if (ActionArgs.Current.ExternalFilter != null)
                foreach (var fvo in ActionArgs.Current.ExternalFilter)
                    externalFilterValues[fvo.Name] = fvo.Value;
            // prepare default values
            var newRequest = new PageRequest()
            {
                RequiresMetaData = true,
                Inserting = true,
                LastCommandName = "New",
                LastCommandArgument = view,
                Controller = controller,
                View = view
            };
            var newPage = ControllerFactory.CreateDataController().GetPage(controller, view, newRequest);
            var defaultValues = new SortedDictionary<string, object>();
            for (var i = 0; (i < newPage.Fields.Count); i++)
                defaultValues[newPage.Fields[i].Name] = newPage.NewRow[i];
            // process data rows
            while (reader.Read())
            {
                var args = new ActionArgs()
                {
                    Controller = controller,
                    View = view,
                    LastCommandName = "New",
                    CommandName = "Insert"
                };
                var values = new List<FieldValue>();
                var valueDictionary = new SortedDictionary<string, string>();
                foreach (var index in map.Keys)
                {
                    var field = map[index];
                    var v = reader[index];
                    if (string.Empty.Equals(v))
                        v = DBNull.Value;
                    if (DBNull.Value.Equals(v))
                        v = defaultValues[field.Name];
                    else
                    {
                        if (field.Type != "String" && (v is string))
                        {
                            var s = ((string)(v));
                            if (field.Type == "Boolean")
                                v = s.ToLower();
                            else
                            {
                                if (!(field.Type.StartsWith("Date")) && field.Type != "Time")
                                    v = numberCleanupRegex.Replace(s, string.Empty);
                            }
                        }
                    }
                    if (v != null)
                    {
                        DataField lookupField = null;
                        if (lookups.TryGetValue(field.Name, out lookupField))
                        {
                            if (lookupField.Items.Count > 0)
                            {
                                // copy static values
                                foreach (var item in lookupField.Items)
                                    if (Convert.ToString(item[1]).Equals(Convert.ToString(v), StringComparison.CurrentCultureIgnoreCase))
                                        values.Add(new FieldValue(lookupField.Name, item[0]));
                            }
                            else
                            {
                                var lookupRequest = new PageRequest()
                                {
                                    Controller = lookupField.ItemsDataController,
                                    View = lookupField.ItemsDataView,
                                    RequiresMetaData = true,
                                    PageSize = 1,
                                    Filter = new string[] {
                                        string.Format("{0}:={1}{2}", lookupField.ItemsDataTextField, v, Convert.ToChar(0))}
                                };
                                var vp = ControllerFactory.CreateDataController().GetPage(lookupRequest.Controller, lookupRequest.View, lookupRequest);
                                if (vp.Rows.Count > 0)
                                    values.Add(new FieldValue(lookupField.Name, vp.Rows[0][vp.Fields.IndexOf(vp.FindField(lookupField.ItemsDataValueField))]));
                            }
                        }
                        else
                            values.Add(new FieldValue(field.Name, v));
                        if (values.Count > 0)
                        {
                            var lastValue = values[(values.Count - 1)];
                            valueDictionary[lastValue.Name] = string.Empty;
                        }
                    }
                }
                recordCount++;
                if (values.Count > 0)
                {
                    foreach (var field in page.Fields)
                        if (!(valueDictionary.ContainsKey(field.Name)))
                        {
                            var missingField = new FieldValue(field.Name);
                            object missingValue = null;
                            if (externalFilterValues.TryGetValue(missingField.Name, out missingValue))
                            {
                                missingField.NewValue = missingValue;
                                missingField.Modified = true;
                            }
                            values.Add(missingField);
                        }
                    args.Values = values.ToArray();
                    var r = ControllerFactory.CreateDataController().Execute(controller, view, args);
                    if (r.Errors.Count > 0)
                    {
                        if (!(HandleError(r, args)))
                        {
                            log.WriteLine("{0:s} Error importing record #{1}.", DateTime.Now, recordCount);
                            log.WriteLine();
                            foreach (var s in r.Errors)
                                log.WriteLine(s);
                            foreach (var v in values)
                                if (v.Modified)
                                    log.WriteLine("{0}={1};", v.Name, v.Value);
                            log.WriteLine();
                            errorCount++;
                        }
                    }
                }
                else
                {
                    log.WriteLine("{0:s} Record #1 has been ignored.", DateTime.Now, recordCount);
                    errorCount++;
                }
            }
            reader.Close();
            log.WriteLine("{0:s} Processed {1} records. Detected {2} errors.", DateTime.Now, recordCount, errorCount);
            log.Close();
            if (!(string.IsNullOrEmpty(notify)))
                ReportErrors(controller, notify, logFileName);
            File.Delete(logFileName);
            AfterProcess(fileName, controller, view, notify, userMapping);
        }

        protected virtual void ReportErrors(string controller, string recipients, string logFileName)
        {
            var recipientsList = recipients.Split(',');
            var client = new SmtpClient();
            foreach (var s in recipientsList)
            {
                var address = s.Trim();
                if (!(string.IsNullOrEmpty(address)))
                {
                    var message = new MailMessage();
                    try
                    {
                        message.To.Add(new MailAddress(address));
                        message.Subject = string.Format("Import of {0} has been completed", controller);
                        message.Body = File.ReadAllText(logFileName);
                        client.Send(message);
                    }
                    catch (Exception)
                    {
                    }
                }
            }
        }

        protected virtual bool HandleError(ActionResult r, ActionArgs args)
        {
            return false;
        }

        public virtual int CountRecords(string fileName)
        {
            var reader = OpenRead(fileName, "count(*)");
            try
            {
                reader.Read();
                return Convert.ToInt32(reader[0]);
            }
            finally
            {
                reader.Close();
            }
        }

        public virtual string MapFieldName(DataField field)
        {
            var s = field.HeaderText;
            if (string.IsNullOrEmpty(s))
                s = field.Label;
            if (string.IsNullOrEmpty(s))
                s = field.Name;
            return s;
        }

        public string CreateListOfAvailableFields(string controller, string view)
        {
            var request = new PageRequest()
            {
                Controller = controller,
                View = view,
                RequiresMetaData = true
            };
            var page = ControllerFactory.CreateDataController().GetPage(controller, view, request);
            var sb = new StringBuilder();
            foreach (var f in page.Fields)
                if (!f.Hidden && !f.ReadOnly)
                {
                    sb.AppendFormat("{0}=", f.Name);
                    var field = f;
                    if (!(string.IsNullOrEmpty(f.AliasName)))
                        field = page.FindField(f.AliasName);
                    sb.AppendLine(MapFieldName(field));
                }
            return sb.ToString();
        }

        public string CreateInitialFieldMap(string fileName, string controller, string view)
        {
            // retreive metadata
            var request = new PageRequest()
            {
                Controller = controller,
                View = view,
                RequiresMetaData = true
            };
            var page = ControllerFactory.CreateDataController().GetPage(controller, view, request);
            // create initial map
            var sb = new StringBuilder();
            var reader = OpenRead(fileName, "*");
            try
            {
                var map = new ImportMapDictionary();
                var lookups = new ImportLookupDictionary();
                EnumerateFields(reader, page, map, lookups, null);
                for (var i = 0; (i < reader.FieldCount); i++)
                {
                    sb.AppendFormat("{0}=", reader.GetName(i));
                    DataField field = null;
                    if (map.TryGetValue(i, out field))
                    {
                        var fieldName = field.Name;
                        foreach (var lookupField in lookups.Values)
                            if (lookupField.AliasName == field.Name)
                            {
                                fieldName = lookupField.Name;
                                break;
                            }
                        sb.Append(fieldName);
                    }
                    sb.AppendLine();
                }
            }
            finally
            {
                reader.Close();
            }
            return sb.ToString();
        }
    }

    /// Copyright (c) 2005 Sébastien Lorion
    /// MIT license (http://en.wikipedia.org/wiki/MIT_License)
    /// Permission is hereby granted, free of charge, to any person obtaining a copy
    /// of this software and associated documentation files (the "Software"), to deal
    /// in the Software without restriction, including without limitation the rights
    /// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
    /// of the Software, and to permit persons to whom the Software is furnished to do so,
    /// subject to the following conditions:
    /// The above copyright notice and this permission notice shall be included in all
    /// copies or substantial portions of the Software.
    /// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
    /// INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
    /// PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE
    /// FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
    /// ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
    public partial class CsvReader : IDataReader, IDisposable
    {

        public const int DefaultBufferSize = 4096;

        public const char DefaultDelimiter = ',';

        public const char DefaultQuote = '\"';

        public const char DefaultEscape = '\"';

        public const char DefaultComment = '#';

        private StringComparer _fieldHeaderComparer = StringComparer.CurrentCultureIgnoreCase;

        private TextReader _reader;

        private char _comment;

        private char _escape;

        private char _delimiter;

        private char _quote;

        private bool _hasHeaders;

        private ValueTrimmingOptions _trimmingOptions;

        private int _bufferSize;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private ParseErrorAction _defaultParseErrorAction;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private MissingFieldAction _missingFieldAction;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _supportsMultiline;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _skipEmptyLines;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _defaultHeaderName;

        private int _fieldCount;

        private bool _eof;

        private string[] _fieldHeaders;

        private Dictionary<string, int> _fieldHeaderIndexes;

        private long _currentRecordIndex;

        private bool _missingFieldFlag;

        private bool _parseErrorFlag;

        private bool _initialized;

        private char[] _buffer;

        private int _bufferLength;

        private string[] _fields;

        private int _nextFieldStart;

        private int _nextFieldIndex;

        private bool _eol;

        private bool _firstRecordInCache;

        private bool _isDisposed = false;

        public CsvReader(TextReader reader, bool hasHeaders) :
                this(reader, hasHeaders, DefaultDelimiter, DefaultQuote, DefaultEscape, DefaultComment, ValueTrimmingOptions.UnquotedOnly, DefaultBufferSize)
        {
        }

        public CsvReader(TextReader reader, bool hasHeaders, int bufferSize) :
                this(reader, hasHeaders, DefaultDelimiter, DefaultQuote, DefaultEscape, DefaultComment, ValueTrimmingOptions.UnquotedOnly, bufferSize)
        {
        }

        public CsvReader(TextReader reader, bool hasHeaders, char delimiter) :
                this(reader, hasHeaders, delimiter, DefaultQuote, DefaultEscape, DefaultComment, ValueTrimmingOptions.UnquotedOnly, DefaultBufferSize)
        {
        }

        public CsvReader(TextReader reader, bool hasHeaders, char delimiter, int bufferSize) :
                this(reader, hasHeaders, delimiter, DefaultQuote, DefaultEscape, DefaultComment, ValueTrimmingOptions.UnquotedOnly, bufferSize)
        {
        }

        public CsvReader(TextReader reader, bool hasHeaders, char delimiter, char quote, char escape, char comment, ValueTrimmingOptions trimmingOptions) :
                this(reader, hasHeaders, delimiter, quote, escape, comment, trimmingOptions, DefaultBufferSize)
        {
        }

        public CsvReader(TextReader reader, bool hasHeaders, char delimiter, char quote, char escape, char comment, ValueTrimmingOptions trimmingOptions, int bufferSize)
        {
            if (reader == null)
                throw new ArgumentNullException("reader");
            if (bufferSize <= 0)
                throw new ArgumentOutOfRangeException("bufferSize", bufferSize, ExceptionMessage.BufferSizeTooSmall);
            _bufferSize = bufferSize;
            if (reader is StreamReader)
            {
                var stream = ((StreamReader)(reader)).BaseStream;
                if (stream.CanSeek)
                {
                    if (stream.Length > 0)
                        _bufferSize = ((int)(Math.Min(bufferSize, stream.Length)));
                }
            }
            _reader = reader;
            _delimiter = delimiter;
            _quote = quote;
            _escape = escape;
            _comment = comment;
            _hasHeaders = hasHeaders;
            _trimmingOptions = trimmingOptions;
            _supportsMultiline = true;
            _skipEmptyLines = true;
            this.DefaultHeaderName = "Column";
            _currentRecordIndex = -1;
            _defaultParseErrorAction = ParseErrorAction.RaiseEvent;
        }

        public char Comment
        {
            get
            {
                return _comment;
            }
        }

        public char Escape
        {
            get
            {
                return _escape;
            }
        }

        public char Delimiter
        {
            get
            {
                return _delimiter;
            }
        }

        public char Quote
        {
            get
            {
                return _quote;
            }
        }

        public bool HasHeaders
        {
            get
            {
                return _hasHeaders;
            }
        }

        public ValueTrimmingOptions TrimmingOptions
        {
            get
            {
                return _trimmingOptions;
            }
        }

        public int BufferSize
        {
            get
            {
                return _bufferSize;
            }
        }

        public ParseErrorAction DefaultParseErrorAction
        {
            get
            {
                return _defaultParseErrorAction;
            }
            set
            {
                _defaultParseErrorAction = value;
            }
        }

        public MissingFieldAction MissingFieldAction
        {
            get
            {
                return _missingFieldAction;
            }
            set
            {
                _missingFieldAction = value;
            }
        }

        public bool SupportsMultiline
        {
            get
            {
                return _supportsMultiline;
            }
            set
            {
                _supportsMultiline = value;
            }
        }

        public bool SkipEmptyLines
        {
            get
            {
                return _skipEmptyLines;
            }
            set
            {
                _skipEmptyLines = value;
            }
        }

        public string DefaultHeaderName
        {
            get
            {
                return _defaultHeaderName;
            }
            set
            {
                _defaultHeaderName = value;
            }
        }

        int IDataRecord.FieldCount
        {
            get
            {
                EnsureInitialize();
                return _fieldCount;
            }
        }

        public virtual bool EndOfStream
        {
            get
            {
                return _eof;
            }
        }

        public long CurrentRecordIndex
        {
            get
            {
                return _currentRecordIndex;
            }
        }

        public bool MissingFieldFlag
        {
            get
            {
                return _missingFieldFlag;
            }
        }

        public bool ParseErrorFlag
        {
            get
            {
                return _parseErrorFlag;
            }
        }

        public string this[int record, string field]
        {
            get
            {
                if (!(MoveTo(record)))
                    throw new InvalidOperationException(string.Format(CultureInfo.InvariantCulture, ExceptionMessage.CannotReadRecordAtIndex, record));
                return this[field];
            }
        }

        public string this[int record, int field]
        {
            get
            {
                if (!(MoveTo(record)))
                    throw new InvalidOperationException(string.Format(CultureInfo.InvariantCulture, ExceptionMessage.CannotReadRecordAtIndex, record));
                return this[field];
            }
        }

        public string this[string field]
        {
            get
            {
                if (string.IsNullOrEmpty(field))
                    throw new ArgumentNullException("field");
                if (!_hasHeaders)
                    throw new InvalidOperationException(ExceptionMessage.NoHeaders);
                var index = GetFieldIndex(field);
                if (index < 0)
                    throw new ArgumentException(string.Format(CultureInfo.InvariantCulture, ExceptionMessage.FieldHeaderNotFound, field), "field");
                return this[index];
            }
        }

        public virtual string this[int field]
        {
            get
            {
                return ReadField(field, false, false);
            }
        }

        int IDataReader.RecordsAffected
        {
            get
            {
                return -1;
            }
        }

        bool IDataReader.IsClosed
        {
            get
            {
                return _eof;
            }
        }

        int IDataReader.Depth
        {
            get
            {
                ValidateDataReader(DataReaderValidations.IsNotClosed);
                return 0;
            }
        }

        object IDataRecord.this[string name]
        {
            get
            {
                ValidateDataReader((DataReaderValidations.IsInitialized | DataReaderValidations.IsNotClosed));
                return this[name];
            }
        }

        object IDataRecord.this[int i]
        {
            get
            {
                ValidateDataReader((DataReaderValidations.IsInitialized | DataReaderValidations.IsNotClosed));
                return this[i];
            }
        }

        public bool IsDisposed
        {
            get
            {
                return _isDisposed;
            }
        }

        public event EventHandler<ParseErrorEventArgs> ParseError;

        public event EventHandler Disposed;

        public string[] GetFieldHeaders()
        {
            EnsureInitialize();
            var fieldHeaders = new string[_fieldHeaders.Length];
            for (var i = 0; (i < fieldHeaders.Length); i++)
                fieldHeaders[i] = _fieldHeaders[i];
            return fieldHeaders;
        }

        protected virtual void OnParseError(ParseErrorEventArgs e)
        {
            var handler = this.ParseError;
            if (handler != null)
                handler(this, e);
        }

        private void EnsureInitialize()
        {
            if (!_initialized)
                this.ReadNextRecord(true, false);
        }

        public int GetFieldIndex(string header)
        {
            EnsureInitialize();
            int index;
            if ((_fieldHeaderIndexes != null) && _fieldHeaderIndexes.TryGetValue(header, out index))
                return index;
            else
                return -1;
        }

        public void CopyCurrentRecordTo(string[] array)
        {
            CopyCurrentRecordTo(array, 0);
        }

        public void CopyCurrentRecordTo(string[] array, int index)
        {
            if (array == null)
                throw new ArgumentNullException("array");
            if ((index < 0) || (index >= array.Length))
                throw new ArgumentOutOfRangeException("index", index, string.Empty);
            if ((_currentRecordIndex < 0) || !_initialized)
                throw new InvalidOperationException(ExceptionMessage.NoCurrentRecord);
            if ((array.Length - index) < _fieldCount)
                throw new ArgumentException(ExceptionMessage.NotEnoughSpaceInArray, "array");
            for (var i = 0; (i < _fieldCount); i++)
                if (_parseErrorFlag)
                    array[(index + i)] = null;
                else
                    array[(index + i)] = this[i];
        }

        public string GetCurrentRawData()
        {
            if ((_buffer != null) & (_bufferLength > 0))
                return new String(_buffer, 0, _bufferLength);
            else
                return string.Empty;
        }

        private bool IsWhiteSpace(char c)
        {
            if (c == _delimiter)
                return false;
            else
            {
                if (c <= Convert.ToChar(255))
                    return ((c == ' ') || (c == '\t'));
                else
                    return (System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c) == System.Globalization.UnicodeCategory.SpaceSeparator);
            }
        }

        public virtual bool MoveTo(long record)
        {
            if (record < _currentRecordIndex)
                return false;
            var offset = (record - _currentRecordIndex);
            while (offset > 0)
            {
                if (!(ReadNextRecord()))
                    return false;
                offset--;
            }
            return true;
        }

        private bool ParseNewLine(ref int pos)
        {
            if (pos == _bufferLength)
            {
                pos = 0;
                if (!(ReadBuffer()))
                    return false;
            }
            var c = _buffer[pos];
            if ((c == '\r') && !((_delimiter == '\r')))
            {
                pos++;
                if (pos < _bufferLength)
                {
                    if (_buffer[pos] == '\n')
                        pos++;
                }
                else
                {
                    if (ReadBuffer())
                    {
                        if (_buffer[0] == '\n')
                            pos = 1;
                        else
                            pos = 0;
                    }
                }
                if (pos >= _bufferLength)
                {
                    ReadBuffer();
                    pos = 0;
                }
                return true;
            }
            else
            {
                if (c == '\n')
                {
                    pos++;
                    if (pos >= _bufferLength)
                    {
                        ReadBuffer();
                        pos = 0;
                    }
                    return true;
                }
            }
            return false;
        }

        bool IsNewLine(int pos)
        {
            var c = _buffer[pos];
            if (c == '\n')
                return true;
            if ((c == '\r') && !((_delimiter == '\r')))
                return true;
            return false;
        }

        private bool ReadBuffer()
        {
            if (_eof)
                return false;
            CheckDisposed();
            _bufferLength = _reader.Read(_buffer, 0, _bufferSize);
            if (_bufferLength > 0)
                return true;
            else
            {
                _eof = true;
                _buffer = null;
                return false;
            }
        }

        private string ReadField(int field, bool initializing, bool discardValue)
        {
            if (!initializing)
            {
                if ((field < 0) || (field >= _fieldCount))
                    throw new ArgumentOutOfRangeException("field", field, string.Format(CultureInfo.InvariantCulture, ExceptionMessage.FieldIndexOutOfRange, field));
                if (_currentRecordIndex < 0)
                    throw new InvalidOperationException(ExceptionMessage.NoCurrentRecord);
                if (_fields[field] != null)
                    return _fields[field];
                else
                {
                    if (_missingFieldFlag)
                        return HandleMissingField(null, field, ref _nextFieldStart);
                }
            }
            CheckDisposed();
            var index = _nextFieldIndex;
            while (index < (field + 1))
            {
                if (_nextFieldStart == _bufferLength)
                {
                    _nextFieldStart = 0;
                    ReadBuffer();
                }
                string value = null;
                if (_missingFieldFlag)
                    value = HandleMissingField(value, index, ref _nextFieldStart);
                else
                {
                    if (_nextFieldStart == _bufferLength)
                    {
                        if (index == field)
                        {
                            if (!discardValue)
                            {
                                value = string.Empty;
                                _fields[index] = value;
                            }
                            _missingFieldFlag = true;
                        }
                        else
                            value = HandleMissingField(value, index, ref _nextFieldStart);
                    }
                    else
                    {
                        if ((_trimmingOptions & ValueTrimmingOptions.UnquotedOnly) != 0)
                            SkipWhiteSpaces(ref _nextFieldStart);
                        if (_eof)
                        {
                            value = string.Empty;
                            _fields[field] = value;
                            if (field < _fieldCount)
                                _missingFieldFlag = true;
                        }
                        else
                        {
                            if (!((_buffer[_nextFieldStart] == _quote)))
                            {
                                var start = _nextFieldStart;
                                var pos = _nextFieldStart;
                                while (true)
                                {
                                    // read characters
                                    while (pos < _bufferLength)
                                    {
                                        var c = _buffer[pos];
                                        if (c == _delimiter)
                                        {
                                            _nextFieldStart = (pos + 1);
                                            break;
                                        }
                                        else
                                        {
                                            if ((c == '\r') || (c == '\n'))
                                            {
                                                _nextFieldStart = pos;
                                                _eol = true;
                                                break;
                                            }
                                            else
                                                pos++;
                                        }
                                    }
                                    if (pos < _bufferLength)
                                        break;
                                    else
                                    {
                                        if (!discardValue)
                                            value = (value + new string(_buffer, start, (pos - start)));
                                        start = 0;
                                        pos = 0;
                                        _nextFieldStart = 0;
                                        if (!(ReadBuffer()))
                                            break;
                                    }
                                }
                                if (!discardValue)
                                {
                                    if ((_trimmingOptions & ValueTrimmingOptions.UnquotedOnly) == 0)
                                    {
                                        if (!_eof && (pos > start))
                                            value = (value + new string(_buffer, start, (pos - start)));
                                    }
                                    else
                                    {
                                        if (!_eof && (pos > start))
                                        {
                                            pos--;
                                            while ((pos > -1) && IsWhiteSpace(_buffer[pos]))
                                                pos--;
                                            pos++;
                                            if (pos > 0)
                                                value = (value + new string(_buffer, start, (pos - start)));
                                        }
                                        else
                                            pos = -1;
                                        if (pos <= 0)
                                        {
                                            if (value == null)
                                                pos = -1;
                                            else
                                                pos = (value.Length - 1);
                                            while ((pos > -1) && IsWhiteSpace(value[pos]))
                                                pos--;
                                            pos++;
                                            if ((pos > 0) && pos != value.Length)
                                                value = value.Substring(0, pos);
                                        }
                                    }
                                    if (value == null)
                                        value = string.Empty;
                                }
                                if (_eol || _eof)
                                {
                                    _eol = ParseNewLine(ref _nextFieldStart);
                                    if (!initializing && !((index == (_fieldCount - 1))))
                                    {
                                        if ((value != null) && (value.Length == 0))
                                            value = null;
                                        value = HandleMissingField(value, index, ref _nextFieldStart);
                                    }
                                }
                                if (!discardValue)
                                    _fields[index] = value;
                            }
                            else
                            {
                                var start = (_nextFieldStart + 1);
                                var pos = start;
                                var quoted = true;
                                var escaped = false;
                                if (!(((_trimmingOptions & ValueTrimmingOptions.QuotedOnly) == 0)))
                                {
                                    SkipWhiteSpaces(ref start);
                                    pos = start;
                                }
                                while (true)
                                {
                                    // read value
                                    while (pos < _bufferLength)
                                    {
                                        var c = _buffer[pos];
                                        if (escaped)
                                        {
                                            escaped = false;
                                            start = pos;
                                        }
                                        else
                                        {
                                            if ((c == _escape) && (_escape != _quote || ((((pos + 1) < _bufferLength) && (_buffer[(pos + 1)] == _quote)) || (((pos + 1) == _bufferLength) && _reader.Peek().Equals(_quote)))))
                                            {
                                                if (!discardValue)
                                                    value = (value + new string(_buffer, start, (pos - start)));
                                                escaped = true;
                                            }
                                            else
                                            {
                                                if (c == _quote)
                                                {
                                                    quoted = false;
                                                    break;
                                                }
                                            }
                                        }
                                        pos++;
                                    }
                                    if (!quoted)
                                        break;
                                    else
                                    {
                                        if (!discardValue && !escaped)
                                            value = (value + new string(_buffer, start, (pos - start)));
                                        start = 0;
                                        pos = 0;
                                        _nextFieldStart = 0;
                                        if (!(ReadBuffer()))
                                        {
                                            HandleParseError(new MalformedCsvException(GetCurrentRawData(), _nextFieldStart, Math.Max(0, _currentRecordIndex), index), ref _nextFieldStart);
                                            return null;
                                        }
                                    }
                                }
                                if (!_eof)
                                {
                                    if (!discardValue && (pos > start))
                                        value = (value + new string(_buffer, start, (pos - start)));
                                    if ((!discardValue && (value != null)) && !(((_trimmingOptions & ValueTrimmingOptions.QuotedOnly) == 0)))
                                    {
                                        var newLength = value.Length;
                                        while ((newLength > 0) && IsWhiteSpace(value[(newLength - 1)]))
                                            newLength--;
                                        if (newLength < value.Length)
                                            value = value.Substring(0, newLength);
                                    }
                                    _nextFieldStart = (pos + 1);
                                    SkipWhiteSpaces(ref _nextFieldStart);
                                    bool delimiterSkipped;
                                    if ((_nextFieldStart < _bufferLength) && (_buffer[_nextFieldStart] == _delimiter))
                                    {
                                        delimiterSkipped = true;
                                        _nextFieldStart++;
                                    }
                                    else
                                        delimiterSkipped = false;
                                    if ((!_eof && !delimiterSkipped) && (initializing || (index == (_fieldCount - 1))))
                                        _eol = ParseNewLine(ref _nextFieldStart);
                                    if ((!delimiterSkipped && !_eof) && !((_eol || IsNewLine(_nextFieldStart))))
                                        HandleParseError(new MalformedCsvException(GetCurrentRawData(), _nextFieldStart, Math.Max(0, _currentRecordIndex), index), ref _nextFieldStart);
                                }
                                if (!discardValue)
                                {
                                    if (value == null)
                                        value = string.Empty;
                                    _fields[index] = value;
                                }
                            }
                        }
                    }
                }
                if (!((_missingFieldFlag || (_nextFieldStart == _bufferLength))))
                {
                }
                _nextFieldIndex = Math.Max((index + 1), _nextFieldIndex);
                if (index == field)
                {
                    if (initializing)
                    {
                        if (_eol || _eof)
                            return null;
                        else
                        {
                            if (string.IsNullOrEmpty(value))
                                return string.Empty;
                            else
                                return value;
                        }
                    }
                    else
                        return value;
                }
                index++;
            }
            HandleParseError(new MalformedCsvException(GetCurrentRawData(), _nextFieldStart, Math.Max(0, _currentRecordIndex), index), ref _nextFieldStart);
            return null;
        }

        public bool ReadNextRecord()
        {
            return ReadNextRecord(false, false);
        }

        protected virtual bool ReadNextRecord(bool onlyReadHeaders, bool skipToNextLine)
        {
            if (_eof)
            {
                if (_firstRecordInCache)
                {
                    _firstRecordInCache = false;
                    _currentRecordIndex++;
                    return true;
                }
                else
                    return false;
            }
            CheckDisposed();
            if (!_initialized)
            {
                _buffer = new char[_bufferSize];
                _fieldHeaders = new string[0];
                if (!(ReadBuffer()))
                    return false;
                if (!(SkipEmptyAndCommentedLines(ref _nextFieldStart)))
                    return false;
                _fieldCount = 0;
                _fields = new string[512];
                while (ReadField(_fieldCount, true, false) != null)
                    if (_parseErrorFlag)
                    {
                        _fieldCount = 0;
                        System.Array.Clear(_fields, 0, _fields.Length);
                        _parseErrorFlag = false;
                        _nextFieldIndex = 0;
                    }
                    else
                        _fieldCount++;
                        if (_fieldCount == _fields.Length)
                            System.Array.Resize<string>(ref _fields, ((_fieldCount + 1)
                                            * 2));
                _fieldCount++;
                if (_fields.Length != _fieldCount)
                    System.Array.Resize<string>(ref _fields, _fieldCount);
                _initialized = true;
                if (_hasHeaders)
                {
                    _currentRecordIndex = -1;
                    _firstRecordInCache = false;
                    _fieldHeaders = new string[_fieldCount];
                    _fieldHeaderIndexes = new Dictionary<string, int>(_fieldCount, _fieldHeaderComparer);
                    for (var i = 0; (i < _fields.Length); i++)
                    {
                        var headerName = _fields[i];
                        if (string.IsNullOrEmpty(headerName) || (headerName.Trim().Length == 0))
                            headerName = (this.DefaultHeaderName + i.ToString());
                        _fieldHeaders[i] = headerName;
                        _fieldHeaderIndexes.Add(headerName, i);
                    }
                    if (!onlyReadHeaders)
                    {
                        if (!(SkipEmptyAndCommentedLines(ref _nextFieldStart)))
                            return false;
                        Array.Clear(_fields, 0, _fields.Length);
                        _nextFieldIndex = 0;
                        _eol = false;
                        _currentRecordIndex++;
                        return true;
                    }
                }
                else
                {
                    if (onlyReadHeaders)
                    {
                        _firstRecordInCache = true;
                        _currentRecordIndex = -1;
                    }
                    else
                    {
                        _firstRecordInCache = false;
                        _currentRecordIndex = 0;
                    }
                }
            }
            else
            {
                if (skipToNextLine)
                    this.SkipToNextLine(ref _nextFieldStart);
                else
                {
                    if ((_currentRecordIndex > -1) && !_missingFieldFlag)
                    {
                        if (!_eol && !_eof)
                        {
                            if (!_supportsMultiline)
                                this.SkipToNextLine(ref _nextFieldStart);
                            else
                                while (ReadField(_nextFieldIndex, true, true) != null)
                                {
                                }
                        }
                    }
                }
                if (!_firstRecordInCache && !(SkipEmptyAndCommentedLines(ref _nextFieldStart)))
                    return false;
                if (_hasHeaders || !_firstRecordInCache)
                    _eol = false;
                if (_firstRecordInCache)
                    _firstRecordInCache = false;
                else
                {
                    Array.Clear(_fields, 0, _fields.Length);
                    _nextFieldIndex = 0;
                }
                _missingFieldFlag = false;
                _parseErrorFlag = false;
                _currentRecordIndex++;
            }
            return true;
        }

        private bool SkipEmptyAndCommentedLines(ref int pos)
        {
            if (pos < _bufferLength)
                DoSkipEmptyAndCommentedLines(ref pos);
            while ((pos >= _bufferLength) && !_eof)
                if (ReadBuffer())
                {
                    pos = 0;
                    DoSkipEmptyAndCommentedLines(ref pos);
                }
                else
                    return false;
            return !_eof;
        }

        private void DoSkipEmptyAndCommentedLines(ref int pos)
        {
            while (pos < _bufferLength)
                if (_buffer[pos] == _comment)
                {
                    pos++;
                    SkipToNextLine(ref pos);
                }
                else
                {
                    if (!((_skipEmptyLines && ParseNewLine(ref pos))))
                        break;
                }
        }

        private bool SkipWhiteSpaces(ref int pos)
        {
            while (true)
            {
                // skip spaces
                while ((pos < _bufferLength) && IsWhiteSpace(_buffer[pos]))
                    pos++;
                if (pos < _bufferLength)
                    break;
                else
                {
                    pos = 0;
                    if (!(ReadBuffer()))
                        return false;
                }
            }
            return true;
        }

        private bool SkipToNextLine(ref int pos)
        {
            // It should be ((pos = 0) == 0), double-check to ensure it works
            pos = 0;
            while (((pos < _bufferLength) || ReadBuffer()) && !(ParseNewLine(ref pos)))
            {
                pos = 0;
                pos++;
            }
            return !_eof;
        }

        private void HandleParseError(MalformedCsvException error, ref int pos)
        {
            // check this one as well, uses switches
            if (error == null)
                throw new ArgumentNullException("error");
            _parseErrorFlag = true;
            if (_defaultParseErrorAction == ParseErrorAction.ThrowException)
                throw error;
            if (_defaultParseErrorAction == ParseErrorAction.RaiseEvent)
            {
                var e = new ParseErrorEventArgs(error, ParseErrorAction.ThrowException);
                OnParseError(e);
                if (e.Action == ParseErrorAction.ThrowException)
                    throw e.Error;
                if (e.Action == ParseErrorAction.RaiseEvent)
                    throw new InvalidOperationException(string.Format(CultureInfo.InvariantCulture, ExceptionMessage.ParseErrorActionInvalidInsideParseErrorEvent, e.Action), e.Error);
                if (e.Action == ParseErrorAction.AdvanceToNextLine)
                {
                    if (!_missingFieldFlag && (pos >= 0))
                        SkipToNextLine(ref pos);
                }
                else
                    throw new NotSupportedException(string.Format(CultureInfo.InvariantCulture, ExceptionMessage.ParseErrorActionNotSupported, e.Action), e.Error);
            }
            if (_defaultParseErrorAction == ParseErrorAction.AdvanceToNextLine)
            {
                if (!_missingFieldFlag && (pos >= 0))
                    SkipToNextLine(ref pos);
            }
            else
                throw new NotSupportedException(string.Format(CultureInfo.InvariantCulture, ExceptionMessage.ParseErrorActionNotSupported, _defaultParseErrorAction), error);
        }

        private string HandleMissingField(string value, int fieldIndex, ref int currentPosition)
        {
            if ((fieldIndex < 0) || (fieldIndex >= _fieldCount))
                throw new ArgumentOutOfRangeException("fieldIndex", fieldIndex, string.Format(CultureInfo.InvariantCulture, ExceptionMessage.FieldIndexOutOfRange, fieldIndex));
            _missingFieldFlag = true;
            for (var i = (fieldIndex + 1); (i < _fieldCount); i++)
                _fields[i] = null;
            if (value != null)
                return value;
            else
            {
                if (_missingFieldAction == MissingFieldAction.ParseError)
                {
                    HandleParseError(new MissingFieldCsvException(GetCurrentRawData(), currentPosition, Math.Max(0, _currentRecordIndex), fieldIndex), ref currentPosition);
                    return value;
                }
                if (_missingFieldAction == MissingFieldAction.ReplaceByEmpty)
                    return string.Empty;
                if (_missingFieldAction == MissingFieldAction.ReplaceByNull)
                    return null;
                throw new NotSupportedException(string.Format(CultureInfo.InvariantCulture, ExceptionMessage.MissingFieldActionNotSupported, _missingFieldAction));
            }
        }

        private void ValidateDataReader(DataReaderValidations validations)
        {
            if (!(((validations & DataReaderValidations.IsInitialized) == 0)) && !_initialized)
                throw new InvalidOperationException(ExceptionMessage.NoCurrentRecord);
            if (!(((validations & DataReaderValidations.IsNotClosed) == 0)) && _isDisposed)
                throw new InvalidOperationException(ExceptionMessage.ReaderClosed);
        }

        private long CopyFieldToArray(int field, long fieldOffset, Array destinationArray, int destinationOffset, int length)
        {
            EnsureInitialize();
            if ((field < 0) || (field >= _fieldCount))
                throw new ArgumentOutOfRangeException("field", field, string.Format(CultureInfo.InvariantCulture, ExceptionMessage.FieldIndexOutOfRange, field));
            if ((fieldOffset < 0) || (fieldOffset >= int.MaxValue))
                throw new ArgumentOutOfRangeException("fieldOffset");
            if (length == 0)
                return 0;
            var value = this[field];
            if (value == null)
                value = string.Empty;
            if (destinationArray is char[])
                Array.Copy(value.ToCharArray(((int)(fieldOffset)), length), 0, destinationArray, destinationOffset, length);
            else
            {
                var chars = value.ToCharArray(((int)(fieldOffset)), length);
                var source = new byte[chars.Length];
                for (var i = 0; (i < chars.Length); i++)
                    source[i] = Convert.ToByte(chars[i]);
                Array.Copy(source, 0, destinationArray, destinationOffset, length);
            }
            return length;
        }

        bool IDataReader.NextResult()
        {
            ValidateDataReader(DataReaderValidations.IsNotClosed);
            return false;
        }

        void IDataReader.Close()
        {
            ((IDataReader)(this)).Dispose();
        }

        bool IDataReader.Read()
        {
            ValidateDataReader(DataReaderValidations.IsNotClosed);
            return ReadNextRecord();
        }

        DataTable IDataReader.GetSchemaTable()
        {
            EnsureInitialize();
            ValidateDataReader(DataReaderValidations.IsNotClosed);
            var schema = new DataTable("SchemaTable")
            {
                Locale = CultureInfo.InvariantCulture,
                MinimumCapacity = _fieldCount
            };
            schema.Columns.Add(SchemaTableColumn.AllowDBNull, typeof(bool)).ReadOnly = true;
            schema.Columns.Add(SchemaTableColumn.BaseColumnName, typeof(string)).ReadOnly = true;
            schema.Columns.Add(SchemaTableColumn.BaseSchemaName, typeof(string)).ReadOnly = true;
            schema.Columns.Add(SchemaTableColumn.BaseTableName, typeof(string)).ReadOnly = true;
            schema.Columns.Add(SchemaTableColumn.ColumnName, typeof(string)).ReadOnly = true;
            schema.Columns.Add(SchemaTableColumn.ColumnOrdinal, typeof(int)).ReadOnly = true;
            schema.Columns.Add(SchemaTableColumn.ColumnSize, typeof(int)).ReadOnly = true;
            schema.Columns.Add(SchemaTableColumn.DataType, typeof(object)).ReadOnly = true;
            schema.Columns.Add(SchemaTableColumn.IsAliased, typeof(bool)).ReadOnly = true;
            schema.Columns.Add(SchemaTableColumn.IsExpression, typeof(bool)).ReadOnly = true;
            schema.Columns.Add(SchemaTableColumn.IsKey, typeof(bool)).ReadOnly = true;
            schema.Columns.Add(SchemaTableColumn.IsLong, typeof(bool)).ReadOnly = true;
            schema.Columns.Add(SchemaTableColumn.IsUnique, typeof(bool)).ReadOnly = true;
            schema.Columns.Add(SchemaTableColumn.NumericPrecision, typeof(short)).ReadOnly = true;
            schema.Columns.Add(SchemaTableColumn.NumericScale, typeof(short)).ReadOnly = true;
            schema.Columns.Add(SchemaTableColumn.ProviderType, typeof(int)).ReadOnly = true;
            schema.Columns.Add(SchemaTableOptionalColumn.BaseCatalogName, typeof(string)).ReadOnly = true;
            schema.Columns.Add(SchemaTableOptionalColumn.BaseServerName, typeof(string)).ReadOnly = true;
            schema.Columns.Add(SchemaTableOptionalColumn.IsAutoIncrement, typeof(bool)).ReadOnly = true;
            schema.Columns.Add(SchemaTableOptionalColumn.IsHidden, typeof(bool)).ReadOnly = true;
            schema.Columns.Add(SchemaTableOptionalColumn.IsReadOnly, typeof(bool)).ReadOnly = true;
            schema.Columns.Add(SchemaTableOptionalColumn.IsRowVersion, typeof(bool)).ReadOnly = true;
            string[] columnNames;
            if (_hasHeaders)
                columnNames = _fieldHeaders;
            else
            {
                columnNames = new string[_fieldCount];
                for (var i = 0; (i < _fieldCount); i++)
                    columnNames[i] = ("Column" + i.ToString(CultureInfo.InvariantCulture));
            }
            var schemaRow = new object[] {
                    true,
                    null,
                    string.Empty,
                    string.Empty,
                    null,
                    null,
                    int.MaxValue,
                    typeof(string),
                    false,
                    false,
                    false,
                    false,
                    false,
                    DBNull.Value,
                    DBNull.Value,
                    ((int)(DbType.String)),
                    string.Empty,
                    string.Empty,
                    false,
                    false,
                    true,
                    false};
            for (var j = 0; (j < columnNames.Length); j++)
            {
                schemaRow[1] = columnNames[j];
                schemaRow[4] = columnNames[j];
                schemaRow[5] = j;
                schema.Rows.Add(schemaRow);
            }
            return schema;
        }

        int IDataRecord.GetInt32(int i)
        {
            ValidateDataReader((DataReaderValidations.IsInitialized | DataReaderValidations.IsNotClosed));
            var value = this[i];
            if (value == null)
                return int.Parse(string.Empty);
            else
                return int.Parse(value, CultureInfo.InvariantCulture);
        }

        object IDataRecord.GetValue(int i)
        {
            ValidateDataReader((DataReaderValidations.IsInitialized | DataReaderValidations.IsNotClosed));
            var isNull = ((IDataRecord)(this)).IsDBNull(i);
            if (isNull)
                return DBNull.Value;
            else
                return this[i];
        }

        bool IDataRecord.IsDBNull(int i)
        {
            ValidateDataReader((DataReaderValidations.IsInitialized | DataReaderValidations.IsNotClosed));
            return string.IsNullOrEmpty(this[i]);
        }

        long IDataRecord.GetBytes(int i, long fieldOffset, byte[] buffer, int bufferoffset, int length)
        {
            ValidateDataReader((DataReaderValidations.IsInitialized | DataReaderValidations.IsNotClosed));
            return CopyFieldToArray(i, fieldOffset, buffer, bufferoffset, length);
        }

        byte IDataRecord.GetByte(int i)
        {
            ValidateDataReader((DataReaderValidations.IsInitialized | DataReaderValidations.IsNotClosed));
            return byte.Parse(this[i], CultureInfo.CurrentCulture);
        }

        Type IDataRecord.GetFieldType(int i)
        {
            EnsureInitialize();
            ValidateDataReader((DataReaderValidations.IsInitialized | DataReaderValidations.IsNotClosed));
            if ((i < 0) || (i >= _fieldCount))
                throw new ArgumentOutOfRangeException("i", i, string.Format(CultureInfo.InvariantCulture, ExceptionMessage.FieldIndexOutOfRange, i));
            return typeof(string);
        }

        decimal IDataRecord.GetDecimal(int i)
        {
            ValidateDataReader((DataReaderValidations.IsInitialized | DataReaderValidations.IsNotClosed));
            return decimal.Parse(this[i], CultureInfo.CurrentCulture);
        }

        int IDataRecord.GetValues(object[] values)
        {
            ValidateDataReader((DataReaderValidations.IsInitialized | DataReaderValidations.IsNotClosed));
            var record = ((IDataRecord)(this));
            for (var i = 0; (i < _fieldCount); i++)
                values[i] = record.GetValue(i);
            return _fieldCount;
        }

        string IDataRecord.GetName(int i)
        {
            ValidateDataReader(DataReaderValidations.IsNotClosed);
            if ((i < 0) || (i >= _fieldCount))
                throw new ArgumentOutOfRangeException("i", i, string.Format(CultureInfo.InvariantCulture, ExceptionMessage.FieldIndexOutOfRange, i));
            if (_hasHeaders)
                return _fieldHeaders[i];
            else
                return ("Column" + i.ToString(CultureInfo.InvariantCulture));
        }

        long IDataRecord.GetInt64(int i)
        {
            ValidateDataReader((DataReaderValidations.IsInitialized | DataReaderValidations.IsNotClosed));
            return long.Parse(this[i], CultureInfo.CurrentCulture);
        }

        double IDataRecord.GetDouble(int i)
        {
            ValidateDataReader((DataReaderValidations.IsInitialized | DataReaderValidations.IsNotClosed));
            return double.Parse(this[i], CultureInfo.CurrentCulture);
        }

        bool IDataRecord.GetBoolean(int i)
        {
            ValidateDataReader((DataReaderValidations.IsInitialized | DataReaderValidations.IsNotClosed));
            var value = this[i];
            int result;
            if (int.TryParse(value, out result))
                return result != 0;
            else
                return bool.Parse(value);
        }

        Guid IDataRecord.GetGuid(int i)
        {
            ValidateDataReader((DataReaderValidations.IsInitialized | DataReaderValidations.IsNotClosed));
            return new Guid(this[i]);
        }

        DateTime IDataRecord.GetDateTime(int i)
        {
            ValidateDataReader((DataReaderValidations.IsInitialized | DataReaderValidations.IsNotClosed));
            return DateTime.Parse(this[i], CultureInfo.CurrentCulture);
        }

        int IDataRecord.GetOrdinal(string name)
        {
            EnsureInitialize();
            ValidateDataReader(DataReaderValidations.IsNotClosed);
            int index;
            if (!(_fieldHeaderIndexes.TryGetValue(name, out index)))
                throw new ArgumentException(string.Format(CultureInfo.InvariantCulture, ExceptionMessage.FieldHeaderNotFound, name), "name");
            return index;
        }

        string IDataRecord.GetDataTypeName(int i)
        {
            ValidateDataReader((DataReaderValidations.IsInitialized | DataReaderValidations.IsNotClosed));
            return typeof(string).FullName;
        }

        float IDataRecord.GetFloat(int i)
        {
            ValidateDataReader((DataReaderValidations.IsInitialized | DataReaderValidations.IsNotClosed));
            return float.Parse(this[i], CultureInfo.CurrentCulture);
        }

        IDataReader IDataRecord.GetData(int i)
        {
            ValidateDataReader((DataReaderValidations.IsInitialized | DataReaderValidations.IsNotClosed));
            if (i == 0)
                return this;
            else
                return null;
        }

        long IDataRecord.GetChars(int i, long fieldoffset, char[] buffer, int bufferoffset, int length)
        {
            ValidateDataReader((DataReaderValidations.IsInitialized | DataReaderValidations.IsNotClosed));
            return CopyFieldToArray(i, fieldoffset, buffer, bufferoffset, length);
        }

        string IDataRecord.GetString(int i)
        {
            ValidateDataReader((DataReaderValidations.IsInitialized | DataReaderValidations.IsNotClosed));
            return this[i];
        }

        char IDataRecord.GetChar(int i)
        {
            ValidateDataReader((DataReaderValidations.IsInitialized | DataReaderValidations.IsNotClosed));
            return char.Parse(this[i]);
        }

        short IDataRecord.GetInt16(int i)
        {
            ValidateDataReader((DataReaderValidations.IsInitialized | DataReaderValidations.IsNotClosed));
            return short.Parse(this[i], CultureInfo.CurrentCulture);
        }

        public CsvReaderRecordEnumerator GetEnumerator()
        {
            return new CsvReaderRecordEnumerator(this);
        }

        protected virtual void OnDisposed(EventArgs e)
        {
            var handler = this.Disposed;
            if (handler != null)
                handler(this, e);
        }

        protected void CheckDisposed()
        {
            if (_isDisposed)
                throw new ObjectDisposedException(this.GetType().FullName);
        }

        void IDisposable.Dispose()
        {
            if (!_isDisposed)
            {
                Dispose(true);
                GC.SuppressFinalize(this);
            }
        }

        protected virtual void Dispose(bool disposing)
        {
            if (!_isDisposed)
                try
                {
                    if (disposing)
                    {
                        if (_reader != null)
                        {
                            if (_reader != null)
                            {
                                _reader.Dispose();
                                _reader = null;
                                _buffer = null;
                                _eof = true;
                            }
                        }
                    }
                }
                finally
                {
                    _isDisposed = true;
                    try
                    {
                        OnDisposed(EventArgs.Empty);
                    }
                    catch (Exception)
                    {
                    }
                }
        }
    }

    internal enum DataReaderValidations
    {

        None = 0,

        IsInitialized = 1,

        IsNotClosed = 2,
    }

    public class CsvReaderRecordEnumerator : IEnumerator, IDisposable
    {

        private string[] _current;

        private long _currentRecordIndex;

        private CsvReader _reader;

        public CsvReaderRecordEnumerator(CsvReader reader)
        {
            if (reader == null)
                throw new ArgumentNullException("reader");
            _reader = reader;
            _current = null;
            _currentRecordIndex = reader.CurrentRecordIndex;
        }

        public string[] Current
        {
            get
            {
                return _current;
            }
        }

        object IEnumerator.Current
        {
            get
            {
                if (_reader.CurrentRecordIndex != _currentRecordIndex)
                    throw new InvalidOperationException(ExceptionMessage.EnumerationVersionCheckFailed);
                return this.Current;
            }
        }

        bool IEnumerator.MoveNext()
        {
            if (_reader.CurrentRecordIndex != _currentRecordIndex)
                throw new InvalidOperationException(ExceptionMessage.EnumerationVersionCheckFailed);
            if (_reader.ReadNextRecord())
            {
                _current = new string[((IDataRecord)(_reader)).FieldCount];
                _reader.CopyCurrentRecordTo(_current);
                _currentRecordIndex = _reader.CurrentRecordIndex;
                return true;
            }
            else
            {
                _current = null;
                _currentRecordIndex = _reader.CurrentRecordIndex;
                return false;
            }
        }

        void IEnumerator.Reset()
        {
            if (_reader.CurrentRecordIndex != _currentRecordIndex)
                throw new InvalidOperationException(ExceptionMessage.EnumerationVersionCheckFailed);
            _reader.MoveTo(-1);
            _current = null;
            _currentRecordIndex = _reader.CurrentRecordIndex;
        }

        void IDisposable.Dispose()
        {
            _reader = null;
            _current = null;
        }
    }

    public enum MissingFieldAction
    {

        ParseError = 0,

        ReplaceByEmpty = 1,

        ReplaceByNull = 2,
    }

    public enum ParseErrorAction
    {

        RaiseEvent = 0,

        AdvanceToNextLine = 1,

        ThrowException = 2,
    }

    [Flags]
    public enum ValueTrimmingOptions
    {

        None = 0,

        UnquotedOnly = 1,

        QuotedOnly = 2,

        All = (UnquotedOnly | QuotedOnly),
    }

    public class ParseErrorEventArgs : EventArgs
    {

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private MalformedCsvException _error;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private ParseErrorAction _action;

        public ParseErrorEventArgs(MalformedCsvException error, ParseErrorAction defaultAction) :
                base()
        {
        }

        public MalformedCsvException Error
        {
            get
            {
                return _error;
            }
            set
            {
                _error = value;
            }
        }

        public ParseErrorAction Action
        {
            get
            {
                return _action;
            }
            set
            {
                _action = value;
            }
        }
    }

    public class MalformedCsvException : Exception
    {

        private string _message;

        private string _rawData;

        private int _currentFieldIndex;

        private long _currentRecordIndex;

        private int _currentPosition;

        public MalformedCsvException() :
                this(((string)(null)), null)
        {
        }

        public MalformedCsvException(string message) :
                this(message, null)
        {
        }

        public MalformedCsvException(string message, Exception innerException) :
                base(string.Empty, innerException)
        {
            if (message == null)
                _message = string.Empty;
            else
                _message = message;
            _rawData = string.Empty;
            _currentPosition = -1;
            _currentRecordIndex = -1;
            _currentFieldIndex = -1;
        }

        public MalformedCsvException(string rawData, int currentPosition, long currentRecordIndex, int currentFieldIndex) :
                this(rawData, currentPosition, currentRecordIndex, currentFieldIndex, null)
        {
        }

        public MalformedCsvException(string rawData, int currentPosition, long currentRecordIndex, int currentFieldIndex, Exception innerException) :
                base(string.Empty, innerException)
        {
            if (rawData == null)
                _rawData = string.Empty;
            else
                _rawData = rawData;
            _currentPosition = currentPosition;
            _currentRecordIndex = currentRecordIndex;
            _currentFieldIndex = currentFieldIndex;
        }

        protected MalformedCsvException(SerializationInfo info, StreamingContext context) :
                base(info, context)
        {
            _message = info.GetString("MyMessage");
            _rawData = info.GetString("RawData");
            _currentPosition = info.GetInt32("CurrentPosition");
            _currentRecordIndex = info.GetInt64("currentRecordIndex");
            _currentFieldIndex = info.GetInt32("currentFieldIndex");
        }

        public string RawData
        {
            get
            {
                return _rawData;
            }
        }

        public int CurrentPosition
        {
            get
            {
                return _currentPosition;
            }
        }

        public long CurrentRecordIndex
        {
            get
            {
                return _currentRecordIndex;
            }
        }

        public int CurrentFieldIndex
        {
            get
            {
                return _currentFieldIndex;
            }
        }

        public override string Message
        {
            get
            {
                return _message;
            }
        }

        public override void GetObjectData(System.Runtime.Serialization.SerializationInfo info, System.Runtime.Serialization.StreamingContext context)
        {
            base.GetObjectData(info, context);
            info.AddValue("MyMessage", _message);
            info.AddValue("RawData", _rawData);
            info.AddValue("CurrentPosition", _currentPosition);
            info.AddValue("CurrentRecordIndex", _currentRecordIndex);
            info.AddValue("CurrentFieldIndex", _currentFieldIndex);
        }
    }

    [Serializable]
    public class MissingFieldCsvException : MalformedCsvException
    {

        public MissingFieldCsvException() :
                base()
        {
        }

        public MissingFieldCsvException(string message) :
                base(message)
        {
        }

        public MissingFieldCsvException(string message, Exception innerException) :
                base(message, innerException)
        {
        }

        public MissingFieldCsvException(string rawData, int currentPosition, long currentRecordIndex, int currentFieldIndex) :
                base(rawData, currentPosition, currentRecordIndex, currentFieldIndex)
        {
        }

        public MissingFieldCsvException(string rawData, int currentPosition, long currentRecordIndex, int currentFieldIndex, Exception innerException) :
                base(rawData, currentPosition, currentRecordIndex, currentFieldIndex, innerException)
        {
        }

        protected MissingFieldCsvException(SerializationInfo info, StreamingContext context) :
                base(info, context)
        {
        }
    }

    [System.Diagnostics.DebuggerNonUserCodeAttribute()]
    internal class ExceptionMessage
    {

        internal ExceptionMessage()
        {
        }

        internal static string BufferSizeTooSmall
        {
            get
            {
                return "Buffer size is too small.";
            }
        }

        internal static string CannotMovePreviousRecordInForwardOnly
        {
            get
            {
                return "Cannot move previous record in forward only.";
            }
        }

        internal static string CannotReadRecordAtIndex
        {
            get
            {
                return "Cannot read record at index.";
            }
        }

        internal static string EnumerationFinishedOrNotStarted
        {
            get
            {
                return "Enumeration finished or not started.";
            }
        }

        internal static string EnumerationVersionCheckFailed
        {
            get
            {
                return "Enumeration version check failed.";
            }
        }

        internal static string FieldHeaderNotFound
        {
            get
            {
                return "Field header not found.";
            }
        }

        internal static string FieldIndexOutOfRange
        {
            get
            {
                return "Field index out of range.";
            }
        }

        internal static string MalformedCsvException
        {
            get
            {
                return "Malformed CSV exception.";
            }
        }

        internal static string MissingFieldActionNotSupported
        {
            get
            {
                return "Missing field action not supported.";
            }
        }

        internal static string NoCurrentRecord
        {
            get
            {
                return "No current record.";
            }
        }

        internal static string NoHeaders
        {
            get
            {
                return "No headers.";
            }
        }

        internal static string NotEnoughSpaceInArray
        {
            get
            {
                return "Not enough space in array.";
            }
        }

        internal static string ParseErrorActionInvalidInsideParseErrorEvent
        {
            get
            {
                return "Parse error action invalid inside parse error event.";
            }
        }

        internal static string ParseErrorActionNotSupported
        {
            get
            {
                return "Parse error action not supported.";
            }
        }

        internal static string ReaderClosed
        {
            get
            {
                return "Reader closed.";
            }
        }

        internal static string RecordIndexLessThanZero
        {
            get
            {
                return "Record index less than zero.";
            }
        }
    }
}
