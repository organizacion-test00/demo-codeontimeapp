using System;
using System.Collections.Generic;
using System.Data;
using System.Data.Common;
using System.Web;
using System.Text.RegularExpressions;
using MyCompany.Services;
using Newtonsoft.Json.Linq;

namespace MyCompany.Data
{
    public class DataTransaction : DataConnection
    {

        public DataTransaction() :
                this("MyCompany")
        {
        }

        public DataTransaction(string connectionStringName) :
                base(connectionStringName, true)
        {
        }
    }

    public class DataConnection : Object, IDisposable
    {

        private string _connectionStringName;

        private bool _disposed;

        private bool _keepOpen;

        private bool _canClose;

        private DbConnection _connection;

        private string _parameterMarker;

        private string _leftQuote;

        private string _rightQuote;

        private DbTransaction _transaction;

        private bool _transactionsEnabled;

        public DataConnection(string connectionStringName) :
                this(connectionStringName, false)
        {
        }

        public DataConnection(string connectionStringName, bool keepOpen)
        {
            this._connectionStringName = connectionStringName;
            this._keepOpen = keepOpen;
            var contextItems = HttpContext.Current.Items;
            this._connection = ((DbConnection)(contextItems[ToContextKey("connection")]));
            if (this._connection == null)
            {
                this._connection = SqlStatement.CreateConnection(connectionStringName, true, out _parameterMarker, out _leftQuote, out _rightQuote);
                this._canClose = true;
                if (keepOpen)
                {
                    var transactionsEnabled = ApplicationServices.Settings("odp.transactions.enabled");
                    this._transactionsEnabled = ((transactionsEnabled == null) || ((bool)(transactionsEnabled)));
                    BeginTransaction();
                    contextItems[ToContextKey("connection")] = _connection;
                    contextItems[ToContextKey("parameterMarker")] = _parameterMarker;
                    contextItems[ToContextKey("leftQuote")] = _leftQuote;
                    contextItems[ToContextKey("rightQuote")] = _rightQuote;
                }
            }
            else
            {
                _transaction = ((DbTransaction)(contextItems[ToContextKey("transaction")]));
                _parameterMarker = ((string)(contextItems[ToContextKey("parameterMarker")]));
                _leftQuote = ((string)(contextItems[ToContextKey("leftQuote")]));
                _rightQuote = ((string)(contextItems[ToContextKey("rightQuote")]));
            }
        }

        public DbConnection Connection
        {
            get
            {
                return _connection;
            }
        }

        public DbTransaction Transaction
        {
            get
            {
                return _transaction;
            }
        }

        public bool KeepOpen
        {
            get
            {
                return _keepOpen;
            }
        }

        public bool CanClose
        {
            get
            {
                return _canClose;
            }
        }

        public string ConnectionStringName
        {
            get
            {
                return _connectionStringName;
            }
        }

        public string ParameterMarker
        {
            get
            {
                return _parameterMarker;
            }
        }

        public string LeftQuote
        {
            get
            {
                return _leftQuote;
            }
        }

        public string RightQuote
        {
            get
            {
                return _rightQuote;
            }
        }

        void IDisposable.Dispose()
        {
            Dispose(true);
        }

        public void Dispose(bool disposing)
        {
            Close();
            if (!_disposed)
            {
                if ((_connection != null) && _canClose)
                    _connection.Dispose();
                _disposed = true;
            }
            if (disposing)
                GC.SuppressFinalize(this);
        }

        public void Close()
        {
            if ((_connection != null) && (_connection.State == ConnectionState.Open))
            {
                if (_canClose)
                {
                    Commit();
                    _connection.Close();
                    if (_keepOpen)
                    {
                        var contextItems = HttpContext.Current.Items;
                        contextItems.Remove(ToContextKey("connection"));
                        contextItems.Remove(ToContextKey("transaction"));
                        contextItems.Remove(ToContextKey("parameterMarker"));
                        contextItems.Remove(ToContextKey("leftQuote"));
                        contextItems.Remove(ToContextKey("rightQuote"));
                    }
                }
            }
        }

        protected string ToContextKey(string name)
        {
            return string.Format("DataConnection_{0}_{1}", _connectionStringName, name);
        }

        public void BeginTransaction()
        {
            if (_transactionsEnabled)
            {
                if (this._transaction != null)
                    this._transaction.Dispose();
                this._transaction = this._connection.BeginTransaction();
                HttpContext.Current.Items[ToContextKey("transaction")] = this._transaction;
            }
        }

        public void Commit()
        {
            if (this._transaction != null)
            {
                this._transaction.Commit();
                HttpContext.Current.Items[ToContextKey("transaction")] = null;
                this._transaction.Dispose();
                this._transaction = null;
            }
        }

        public void Rollback()
        {
            if (this._transaction != null)
            {
                this._transaction.Rollback();
                HttpContext.Current.Items[ToContextKey("transaction")] = null;
                this._transaction.Dispose();
                this._transaction = null;
            }
        }
    }

    public class ControllerFieldValue : FieldValue
    {

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _controller;

        public ControllerFieldValue() :
                base()
        {
        }

        public ControllerFieldValue(string controller, string fieldName, object oldValue, object newValue) :
                base(fieldName, oldValue, newValue)
        {
            this.Controller = controller;
        }

        public string Controller
        {
            get
            {
                return _controller;
            }
            set
            {
                _controller = value;
            }
        }
    }

    public class CommitResult
    {

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _date;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private int _sequence;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private int _index;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string[] _errors;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private List<ControllerFieldValue> _values;

        public CommitResult()
        {
            _sequence = -1;
            _index = -1;
            _date = DateTime.Now.ToString("s");
            _values = new List<ControllerFieldValue>();
        }

        /// <summary>The timestamp indicating the start of ActionArgs log processing on the server.</summary>
        public string Date
        {
            get
            {
                return _date;
            }
            set
            {
                _date = value;
            }
        }

        /// <summary>The last committed sequence in the ActionArgs log. Equals -1 if no entries in the log were committed to the database.</summary>
        public int Sequence
        {
            get
            {
                return _sequence;
            }
            set
            {
                _sequence = value;
            }
        }

        /// <summary>The index of the ActionArgs entry in the log that has caused an error. Equals -1 if no errors were detected.</summary>
        public int Index
        {
            get
            {
                return _index;
            }
            set
            {
                _index = value;
            }
        }

        /// <summary>The array of errors reported when an entry in the log has failed to executed.</summary>
        public string[] Errors
        {
            get
            {
                return _errors;
            }
            set
            {
                _errors = value;
            }
        }

        /// <summary>The list of values that includes resolved primary key values.</summary>
        public List<ControllerFieldValue> Values
        {
            get
            {
                return _values;
            }
            set
            {
                _values = value;
            }
        }

        /// <summary>Indicates that the log has been committed sucessfully. Returns false if property Index has any value other than -1.</summary>
        public bool Success
        {
            get
            {
                return (Index == -1);
            }
        }
    }

    /// <summary>Provides a mechism to execute an array of ActionArgs instances in the context of a transaction.
    /// Transactions are enabled by default. The default "scope" is "all". The default "upload" is "all".
    /// </summary>
    /// <remarks>
    /// Use the following definition in touch-settings.json file to control Offline Data Processor (ODP):
    /// {
    /// "odp": {
    /// "enabled": true,
    /// "transactions": {
    /// "enabled": true,
    /// "scope": "sequence",
    /// "upload": "all"
    /// }
    /// }
    /// }
    /// </remarks>
    public class TransactionManager : TransactionManagerBase
    {
    }

    public class TransactionManagerBase
    {

        private SortedDictionary<string, ControllerConfiguration> _controllers;

        private SortedDictionary<string, object> _resolvedKeys;

        private FieldValue _pk;

        private CommitResult _commitResult;

        public TransactionManagerBase()
        {
            _controllers = new SortedDictionary<string, ControllerConfiguration>();
            _resolvedKeys = new SortedDictionary<string, object>();
        }

        protected virtual ControllerConfiguration LoadConfig(string controllerName)
        {
            ControllerConfiguration config = null;
            if (!(_controllers.TryGetValue(controllerName, out config)))
            {
                config = DataControllerBase.CreateConfigurationInstance(GetType(), controllerName);
                _controllers[controllerName] = config;
            }
            return config;
        }

        protected virtual void ResolvePrimaryKey(string controllerName, string fieldName, object oldValue, object newValue)
        {
            _resolvedKeys[string.Format("{0}${1}", controllerName, oldValue)] = newValue;
            if (newValue != null && (Convert.ToString(newValue).Length >= 36))
            {
                var oldValueAsInteger = 0;
                if (int.TryParse(Convert.ToString(oldValue), out oldValueAsInteger) && (oldValueAsInteger < 0))
                {
                    oldValueAsInteger = (oldValueAsInteger * -1);
                    var uid = ("000000000000" + oldValueAsInteger.ToString("x"));
                    uid = ("00000000-0000-0000-0000-" + uid.Substring((uid.Length - 12)));
                    oldValue = uid;
                }
            }
            _commitResult.Values.Add(new ControllerFieldValue(controllerName, fieldName, oldValue, newValue));
        }

        protected virtual bool TryParseTempPK(object v, out int value)
        {
            var s = Convert.ToString(v);
            if (string.IsNullOrEmpty(s))
            {
                value = 0;
                return false;
            }
            var uid = Regex.Match(s, "0{8}-0{4}-0{4}-0{4}-([\\da-f]{12})$");
            if (uid.Success)
            {
                value = (Convert.ToInt32(uid.Groups[1].Value, 16) * -1);
                return true;
            }
            return int.TryParse(s, out value);
        }

        protected virtual void ProcessArguments(ControllerConfiguration config, ActionArgs args)
        {
            if (args.Values == null)
                return;
            var values = new FieldValueDictionary(args);
            _pk = null;
            // detect negative primary keys
            var pkNav = config.SelectSingleNode("/c:dataController/c:fields/c:field[@isPrimaryKey=\'true\']");
            if (pkNav != null)
            {
                FieldValue fvo = null;
                if (values.TryGetValue(pkNav.GetAttribute("name", string.Empty), out fvo))
                {
                    var value = 0;
                    if (TryParseTempPK(fvo.Value, out value))
                    {
                        if (value < 0)
                        {
                            if (args.CommandName == "Insert")
                            {
                                // request a new row from business rules
                                var newRowRequest = new PageRequest()
                                {
                                    Controller = args.Controller,
                                    View = args.View,
                                    Inserting = true,
                                    RequiresMetaData = true,
                                    MetadataFilter = new string[] {
                                        "fields"}
                                };
                                var page = ControllerFactory.CreateDataController().GetPage(newRowRequest.Controller, newRowRequest.View, newRowRequest);
                                if (page.NewRow != null)
                                    for (var i = 0; (i < page.NewRow.Length); i++)
                                    {
                                        var newValue = page.NewRow[i];
                                        if (newValue != null)
                                        {
                                            var field = page.Fields[i];
                                            if (field.IsPrimaryKey)
                                            {
                                                // resolve the value of the primary key
                                                ResolvePrimaryKey(args.Controller, fvo.Name, value, newValue);
                                                value = 0;
                                                fvo.NewValue = newValue;
                                            }
                                            else
                                            {
                                                // inject a missing default value in the arguments
                                                FieldValue newFieldValue = null;
                                                if (values.TryGetValue(field.Name, out newFieldValue))
                                                {
                                                    if (!newFieldValue.Modified)
                                                    {
                                                        newFieldValue.NewValue = newValue;
                                                        newFieldValue.Modified = true;
                                                    }
                                                }
                                                else
                                                {
                                                    var newValues = new List<FieldValue>(args.Values);
                                                    newFieldValue = new FieldValue(field.Name, newValue);
                                                    newValues.Add(newFieldValue);
                                                    args.Values = newValues.ToArray();
                                                    values[field.Name] = newFieldValue;
                                                }
                                            }
                                        }
                                    }
                            }
                            // resolve the primary key after the command execution
                            if (value < 0)
                            {
                                if (args.CommandName == "Insert")
                                {
                                    if (pkNav.SelectSingleNode("c:items/@dataController", config.Resolver) == null)
                                    {
                                        _pk = new FieldValue(fvo.Name, value);
                                        fvo.NewValue = null;
                                        fvo.Modified = false;
                                    }
                                }
                                else
                                {
                                    // otherwise try to resolve the primary key
                                    object resolvedKey = null;
                                    var fkValue = 0;
                                    if (TryParseTempPK(fvo.Value, out fkValue) && _resolvedKeys.TryGetValue(string.Format("{0}${1}", args.Controller, fkValue), out resolvedKey))
                                    {
                                        if (fvo.Modified)
                                            fvo.NewValue = resolvedKey;
                                        else
                                            fvo.OldValue = resolvedKey;
                                    }
                                }
                            }
                        }
                    }
                }
            }
            // resolve negative foreign keys
            if (_resolvedKeys.Count > 0)
            {
                var fkIterator = config.Select("/c:dataController/c:fields/c:field[c:items/@dataController]");
                while (fkIterator.MoveNext())
                {
                    FieldValue fvo = null;
                    if (values.TryGetValue(fkIterator.Current.GetAttribute("name", string.Empty), out fvo))
                    {
                        var itemsDataControllerNav = fkIterator.Current.SelectSingleNode("c:items/@dataController", config.Resolver);
                        object resolvedKey = null;
                        var fkValue = 0;
                        if (TryParseTempPK(fvo.Value, out fkValue) && _resolvedKeys.TryGetValue(string.Format("{0}${1}", itemsDataControllerNav.Value, fkValue), out resolvedKey))
                        {
                            if (fvo.Modified)
                                fvo.NewValue = resolvedKey;
                            else
                                fvo.OldValue = resolvedKey;
                        }
                    }
                }
            }
            // scan resolved primary keys and look for the one that are matching the keys referenced in SelectedValues, ExternalFilter, or Filter of the action
            foreach (var resolvedKeyInfo in _resolvedKeys.Keys)
            {
                var separatorIndex = resolvedKeyInfo.IndexOf("$");
                var resolvedController = resolvedKeyInfo.Substring(0, separatorIndex);
                var unresolvedKeyValue = resolvedKeyInfo.Substring((separatorIndex + 1));
                object resolvedKeyValue = null;
                if ((args.Controller == resolvedController) && _resolvedKeys.TryGetValue(resolvedKeyInfo, out resolvedKeyValue))
                {
                    var resolvedKeyValueAsString = resolvedKeyValue.ToString();
                    // resolve primary key references in SelectedValues
                    if (args.SelectedValues != null)
                        for (var selectedValueIndex = 0; (selectedValueIndex < args.SelectedValues.Length); selectedValueIndex++)
                        {
                            var selectedKey = Regex.Split(args.SelectedValues[selectedValueIndex], ",");
                            var tempPK = 0;
                            for (var keyValueIndex = 0; (keyValueIndex < selectedKey.Length); keyValueIndex++)
                                if (TryParseTempPK(selectedKey[keyValueIndex], out tempPK) && (Convert.ToString(tempPK) == unresolvedKeyValue))
                                {
                                    selectedKey[keyValueIndex] = resolvedKeyValueAsString;
                                    args.SelectedValues[selectedValueIndex] = string.Join(",", selectedKey);
                                    selectedKey = null;
                                    break;
                                }
                            if (selectedKey == null)
                                break;
                        }
                }
            }
        }

        protected virtual void ProcessResult(ControllerConfiguration config, ActionResult result)
        {
            if (_pk == null)
                foreach (var fvo in result.Values)
                    _commitResult.Values.Add(new ControllerFieldValue(config.ControllerName, fvo.Name, fvo.OldValue, fvo.NewValue));
            else
                foreach (var fvo in result.Values)
                    if (fvo.Name == _pk.Name)
                    {
                        ResolvePrimaryKey(config.ControllerName, fvo.Name, _pk.Value, fvo.Value);
                        break;
                    }
        }

        public virtual CommitResult Commit(JArray log)
        {
            _commitResult = new CommitResult();
            try
            {
                if (log.Count > 0)
                {
                    using (var tx = new DataTransaction(LoadConfig(((string)(log[0]["controller"]))).ConnectionStringName))
                    {
                        var index = -1;
                        var sequence = -1;
                        var lastSequence = sequence;
                        var commitedValueCount = _commitResult.Values.Count;
                        var transactionScope = ((string)(ApplicationServices.Settings("odp.transactions.scope")));
                        for (var i = 0; (i < log.Count); i++)
                        {
                            var entry = log[i];
                            var controller = ((string)(entry["controller"]));
                            var view = ((string)(entry["view"]));
                            ActionArgs.Forget();
                            var executeArgs = entry["args"].ToObject<ActionArgs>();
                            if (executeArgs.Sequence.HasValue)
                            {
                                sequence = executeArgs.Sequence.Value;
                                if (transactionScope != "all" && (sequence != lastSequence && (i > 0)))
                                {
                                    tx.Commit();
                                    _commitResult.Sequence = lastSequence;
                                    commitedValueCount = _commitResult.Values.Count;
                                    tx.BeginTransaction();
                                }
                                lastSequence = sequence;
                            }
                            var config = LoadConfig(executeArgs.Controller);
                            ProcessArguments(config, executeArgs);
                            var executeResult = ControllerFactory.CreateDataController().Execute(controller, view, executeArgs);
                            if (executeResult.Errors.Count > 0)
                            {
                                index = i;
                                _commitResult.Index = index;
                                _commitResult.Errors = executeResult.Errors.ToArray();
                                break;
                            }
                            else
                                ProcessResult(config, executeResult);
                        }
                        if (index == -1)
                        {
                            tx.Commit();
                            _commitResult.Sequence = sequence;
                            commitedValueCount = _commitResult.Values.Count;
                        }
                        else
                        {
                            tx.Rollback();
                            _commitResult.Index = index;
                            _commitResult.Values.RemoveRange(commitedValueCount, (_commitResult.Values.Count - commitedValueCount));
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _commitResult.Errors = new string[] {
                        ex.Message};
                _commitResult.Index = 0;
            }
            return _commitResult;
        }
    }
}
