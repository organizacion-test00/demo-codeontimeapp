using System;
using System.Configuration;
using System.Data;
using System.Data.Common;
using System.Diagnostics;
using System.Text.RegularExpressions;
using System.Web;
using System.Web.Configuration;

namespace MyCompany.Data
{
    public class ConnectionStringSettingsFactoryBase
    {

        protected virtual ConnectionStringSettings CreateSettings(string connectionStringName)
        {
            if (string.IsNullOrEmpty(connectionStringName))
                connectionStringName = "MyCompany";
            return WebConfigurationManager.ConnectionStrings[connectionStringName];
        }
    }

    public partial class ConnectionStringSettingsFactory : ConnectionStringSettingsFactoryBase
    {

        public static ConnectionStringSettings Create(string connectionStringName)
        {
            var settingsFactory = new ConnectionStringSettingsFactory();
            return settingsFactory.CreateSettings(connectionStringName);
        }
    }

    public class SqlParam
    {

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _name;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private object _value;

        public SqlParam(string name, object value)
        {
            this.Name = name;
            this.Value = value;
        }

        public virtual string Name
        {
            get
            {
                return _name;
            }
            set
            {
                _name = value;
            }
        }

        public virtual object Value
        {
            get
            {
                return _value;
            }
            set
            {
                _value = value;
            }
        }
    }

    public class SqlStatementBase
    {

        public virtual string ParseSql(string sql)
        {
            return sql;
        }

        public virtual void Configure(DbCommand command)
        {
        }
    }

    public partial class SqlStatement : SqlStatementBase, IDisposable
    {

        private bool _disposed;

        private object _scalar;

        private DbConnection _connection;

        private DbCommand _command;

        private DbDataReader _reader;

        private bool _canCloseConnection;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _name;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _writeExceptionsToEventLog;

        private static Regex _sqlClientPatternEscape = new Regex("(%|_|\\[)");

        private string _parameterMarker;

        private string _leftQuote;

        private string _rightQuote;

        public static System.DateTime MinSqlServerDate = new DateTime(1753, 1, 1);

        public SqlStatement()
        {
        }

        public SqlStatement(CommandType commandType, string commandText, string connectionStringName)
        {
            if (string.IsNullOrEmpty(connectionStringName))
                connectionStringName = "MyCompany";
            var key = ("DataConnection_" + connectionStringName);
            var context = HttpContext.Current;
            if (context != null)
                _connection = ((DbConnection)(context.Items[(key + "_connection")]));
            if (_connection == null)
            {
                _canCloseConnection = true;
                _connection = CreateConnection(connectionStringName, false, out _parameterMarker, out _leftQuote, out _rightQuote);
            }
            _command = SqlStatement.CreateCommand(_connection);
            _command.CommandType = commandType;
            _command.CommandText = ParseSql(commandText);
            if (!_canCloseConnection)
            {
                _command.Transaction = ((DbTransaction)(HttpContext.Current.Items[(key + "_transaction")]));
                _parameterMarker = ((string)(HttpContext.Current.Items[(key + "_parameterMarker")]));
                _leftQuote = ((string)(HttpContext.Current.Items[(key + "_leftQuote")]));
                _rightQuote = ((string)(HttpContext.Current.Items[(key + "_rightQuote")]));
            }
        }

        public string Name
        {
            get
            {
                return _name;
            }
            set
            {
                _name = value;
            }
        }

        public bool WriteExceptionsToEventLog
        {
            get
            {
                return _writeExceptionsToEventLog;
            }
            set
            {
                _writeExceptionsToEventLog = value;
            }
        }

        public DbDataReader Reader
        {
            get
            {
                return _reader;
            }
        }

        public DbCommand Command
        {
            get
            {
                return _command;
            }
        }

        public object Scalar
        {
            get
            {
                return _scalar;
            }
        }

        public DbParameterCollection Parameters
        {
            get
            {
                return _command.Parameters;
            }
        }

        public object this[string name]
        {
            get
            {
                return _reader[name];
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

        public object this[int index]
        {
            get
            {
                return _reader[index];
            }
        }

        public static DbConnection CreateConnection(string connectionStringName)
        {
            string parameterMarker = null;
            string leftQuote = null;
            string rightQuote = null;
            return CreateConnection(connectionStringName, true, out parameterMarker, out leftQuote, out rightQuote);
        }

        public static DbConnection CreateConnection(string connectionStringName, bool open, out string parameterMarker, out string leftQuote, out string rightQuote)
        {
            var settings = ConnectionStringSettingsFactory.Create(connectionStringName);
            if (settings == null)
                throw new Exception(string.Format(connectionStringName));
            if (settings.ProviderName == "CodeOnTime.CustomDataProvider")
            {
                open = false;
                settings = new ConnectionStringSettings("CustomDataProvider", string.Empty, "System.Data.SqlClient");
            }
            var providerName = settings.ProviderName;
            var factory = DbProviderFactories.GetFactory(providerName);
            var connection = factory.CreateConnection();
            var connectionString = settings.ConnectionString;
            if (providerName.Contains("MySql"))
                connectionString = (connectionString + "Allow User Variables=True");
            connection.ConnectionString = connectionString;
            if (open)
                connection.Open();
            parameterMarker = ConvertTypeToParameterMarker(providerName);
            leftQuote = ConvertTypeToLeftQuote(providerName);
            rightQuote = ConvertTypeToRightQuote(providerName);
            return connection;
        }

        public static string EscapePattern(DbCommand command, string s)
        {
            if (string.IsNullOrEmpty(s))
                return s;
            if (command.GetType().FullName == "System.Data.SqlClient.SqlCommand")
                return _sqlClientPatternEscape.Replace(s, "[$1]");
            return s;
        }

        public static string GetParameterMarker(string connectionStringName)
        {
            var settings = ConnectionStringSettingsFactory.Create(connectionStringName);
            return ConvertTypeToParameterMarker(settings.ProviderName);
        }

        public static string ConvertTypeToParameterMarker(Type t)
        {
            return ConvertTypeToParameterMarker(t.FullName);
        }

        public static string ConvertTypeToParameterMarker(string typeName)
        {
            if (typeName.Contains("Oracle") || typeName.Contains("SQLAnywhere"))
                return ":";
            return "@";
        }

        public static string ConvertTypeToLeftQuote(string typeName)
        {
            if (typeName.Contains("OleDb"))
                return "[";
            if (typeName.Contains("MySql"))
                return "`";
            return "\"";
        }

        public static string ConvertTypeToRightQuote(string typeName)
        {
            var quote = ConvertTypeToLeftQuote(typeName);
            if (quote == "[")
                return "]";
            return quote;
        }

        public virtual object StringToValue(string s)
        {
            object v = s;
            Guid guidValue;
            if (Guid.TryParse(s, out guidValue))
            {
                v = guidValue;
                if (Command.GetType().FullName.Contains("Oracle"))
                    v = guidValue.ToByteArray();
            }
            return v;
        }

        public void Close()
        {
            if ((_reader != null) && !_reader.IsClosed)
                _reader.Close();
            if (((_command != null) && (_command.Connection.State == ConnectionState.Open)) && _canCloseConnection)
                _command.Connection.Close();
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
                if (_reader != null)
                    _reader.Dispose();
                if (_command != null)
                    _command.Dispose();
                if ((_connection != null) && _canCloseConnection)
                    _connection.Dispose();
                _disposed = true;
            }
            if (disposing)
                GC.SuppressFinalize(this);
        }

        private void EnsureOpenConnection()
        {
            if (_connection.State != ConnectionState.Open)
                _connection.Open();
        }

        public DbDataReader ExecuteReader()
        {
            try
            {
                EnsureOpenConnection();
                _reader = _command.ExecuteReader();
                return _reader;
            }
            catch (Exception e)
            {
                Log(e);
                throw;
            }
        }

        public DbDataReader ExecuteReader(object parameters)
        {
            AddParameters(parameters);
            return ExecuteReader();
        }

        public object ExecuteScalar()
        {
            try
            {
                EnsureOpenConnection();
                _scalar = _command.ExecuteScalar();
                return _scalar;
            }
            catch (Exception e)
            {
                Log(e);
                throw;
            }
        }

        public object ExecuteScalar(object parameters)
        {
            AddParameters(parameters);
            return ExecuteScalar();
        }

        public int ExecuteNonQuery()
        {
            try
            {
                EnsureOpenConnection();
                return _command.ExecuteNonQuery();
            }
            catch (Exception e)
            {
                Log(e);
                throw;
            }
        }

        public int ExecuteNonQuery(object parameters)
        {
            AddParameters(parameters);
            return ExecuteNonQuery();
        }

        public bool Read()
        {
            try
            {
                if (_reader == null)
                    ExecuteReader();
                return _reader.Read();
            }
            catch (Exception e)
            {
                Log(e);
                throw;
            }
        }

        public bool Read(object parameters)
        {
            AddParameters(parameters);
            return Read();
        }

        protected virtual void Log(Exception ex)
        {
            if (WriteExceptionsToEventLog)
            {
                var log = new EventLog("Application")
                {
                    Source = GetType().FullName
                };
                string action = null;
                if (!(string.IsNullOrEmpty(Name)))
                {
                    var parts = Name.Split(',');
                    log.Source = parts[0];
                    if (parts.Length > 1)
                        action = parts[1];
                }
                var message = "An exception has occurred. Please check the Event Log.\n\n";
                if (!(string.IsNullOrEmpty(action)))
                    message = string.Format("{0}Action: {1}\n\n", message, action);
                message = string.Format("{0}Exception: {1}", message, message.ToString());
                log.WriteEntry(message);
            }
            else
                throw ex;
        }

        private DbParameter AddParameterWithoutValue(string parameterName)
        {
            var p = _command.CreateParameter();
            p.ParameterName = parameterName;
            p.Value = DBNull.Value;
            _command.Parameters.Add(p);
            return p;
        }

        private DbParameter AddParameterWithValue(string parameterName, object value)
        {
            var p = _command.CreateParameter();
            p.ParameterName = parameterName;
            if (((value != null) && (value is Guid)) && p.GetType().FullName.Contains("Oracle"))
                value = ((Guid)(value)).ToByteArray();
            p.Value = value;
            _command.Parameters.Add(p);
            return p;
        }

        public DbParameter AddParameter(string parameterName, sbyte value)
        {
            return AddParameterWithValue(parameterName, value);
        }

        public DbParameter AddParameter(string parameterName, sbyte? value)
        {
            if (value.HasValue)
                return AddParameterWithValue(parameterName, value);
            else
                return AddParameterWithoutValue(parameterName);
        }

        public DbParameter AddParameter(string parameterName, byte value)
        {
            return AddParameterWithValue(parameterName, value);
        }

        public DbParameter AddParameter(string parameterName, byte? value)
        {
            if (value.HasValue)
                return AddParameterWithValue(parameterName, value);
            else
                return AddParameterWithoutValue(parameterName);
        }

        public DbParameter AddParameter(string parameterName, short value)
        {
            return AddParameterWithValue(parameterName, value);
        }

        public DbParameter AddParameter(string parameterName, short? value)
        {
            if (value.HasValue)
                return AddParameterWithValue(parameterName, value);
            else
                return AddParameterWithoutValue(parameterName);
        }

        public DbParameter AddParameter(string parameterName, ushort value)
        {
            return AddParameterWithValue(parameterName, value);
        }

        public DbParameter AddParameter(string parameterName, ushort? value)
        {
            if (value.HasValue)
                return AddParameterWithValue(parameterName, value);
            else
                return AddParameterWithoutValue(parameterName);
        }

        public DbParameter AddParameter(string parameterName, int value)
        {
            return AddParameterWithValue(parameterName, value);
        }

        public DbParameter AddParameter(string parameterName, int? value)
        {
            if (value.HasValue)
                return AddParameterWithValue(parameterName, value);
            else
                return AddParameterWithoutValue(parameterName);
        }

        public DbParameter AddParameter(string parameterName, uint value)
        {
            return AddParameterWithValue(parameterName, value);
        }

        public DbParameter AddParameter(string parameterName, uint? value)
        {
            if (value.HasValue)
                return AddParameterWithValue(parameterName, value);
            else
                return AddParameterWithoutValue(parameterName);
        }

        public DbParameter AddParameter(string parameterName, long value)
        {
            return AddParameterWithValue(parameterName, value);
        }

        public DbParameter AddParameter(string parameterName, long? value)
        {
            if (value.HasValue)
                return AddParameterWithValue(parameterName, value);
            else
                return AddParameterWithoutValue(parameterName);
        }

        public DbParameter AddParameter(string parameterName, ulong value)
        {
            return AddParameterWithValue(parameterName, value);
        }

        public DbParameter AddParameter(string parameterName, ulong? value)
        {
            if (value.HasValue)
                return AddParameterWithValue(parameterName, value);
            else
                return AddParameterWithoutValue(parameterName);
        }

        public DbParameter AddParameter(string parameterName, float value)
        {
            return AddParameterWithValue(parameterName, value);
        }

        public DbParameter AddParameter(string parameterName, float? value)
        {
            if (value.HasValue)
                return AddParameterWithValue(parameterName, value);
            else
                return AddParameterWithoutValue(parameterName);
        }

        public DbParameter AddParameter(string parameterName, decimal value)
        {
            return AddParameterWithValue(parameterName, value);
        }

        public DbParameter AddParameter(string parameterName, decimal? value)
        {
            if (value.HasValue)
                return AddParameterWithValue(parameterName, value);
            else
                return AddParameterWithoutValue(parameterName);
        }

        public DbParameter AddParameter(string parameterName, double value)
        {
            return AddParameterWithValue(parameterName, value);
        }

        public DbParameter AddParameter(string parameterName, double? value)
        {
            if (value.HasValue)
                return AddParameterWithValue(parameterName, value);
            else
                return AddParameterWithoutValue(parameterName);
        }

        public DbParameter AddParameter(string parameterName, char value)
        {
            return AddParameterWithValue(parameterName, value);
        }

        public DbParameter AddParameter(string parameterName, char? value)
        {
            if (value.HasValue)
                return AddParameterWithValue(parameterName, value);
            else
                return AddParameterWithoutValue(parameterName);
        }

        public DbParameter AddParameter(string parameterName, bool value)
        {
            return AddParameterWithValue(parameterName, value);
        }

        public DbParameter AddParameter(string parameterName, bool? value)
        {
            if (value.HasValue)
                return AddParameterWithValue(parameterName, value);
            else
                return AddParameterWithoutValue(parameterName);
        }

        public DbParameter AddParameter(string parameterName, System.DateTime value)
        {
            return AddParameterWithValue(parameterName, value);
        }

        public DbParameter AddParameter(string parameterName, System.DateTime? value)
        {
            if (value.HasValue)
                return AddParameterWithValue(parameterName, value);
            else
                return AddParameterWithoutValue(parameterName);
        }

        public DbParameter AddParameter(string parameterName, object value)
        {
            if ((value == null) || DBNull.Value.Equals(value))
                return AddParameterWithoutValue(parameterName);
            else
                return AddParameterWithValue(parameterName, value);
        }

        public void AddParameters(object parameters)
        {
            var paramList = BusinessObjectParameters.Create(ParameterMarker, parameters);
            foreach (var paramName in paramList.Keys)
                AddParameter(paramName, paramList[paramName]);
        }

        public static DbCommand CreateCommand(DbConnection connection)
        {
            var command = connection.CreateCommand();
            var t = command.GetType();
            var typeName = t.FullName;
            if (typeName.Contains("Oracle") && typeName.Contains("DataAccess"))
                t.GetProperty("BindByName").SetValue(command, true, null);
            using (var configurator = new SqlStatement())
                configurator.Configure(command);
            return command;
        }

        public static bool TryParseDate(Type t, string s, out System.DateTime result)
        {
            var success = System.DateTime.TryParse(s, out result);
            if (success)
            {
                if (t.FullName.Contains(".SqlClient.") && (result < MinSqlServerDate))
                    return false;
                return true;
            }
            return false;
        }

        /// <summary>
        /// The method will automatically locate and change an existing parameter for a given name with or without a parameter marker.
        /// If the parameter is not found then a new parameter is created. Otherwise the value of an existing parameter is changed.
        /// </summary>
        /// <param name="name">The name of a parameter.</param>
        /// <param name="value">The new value of a parameter.</param>
        public virtual void AssignParameter(string name, object value)
        {
            if ((value != null) && (value is bool))
            {
                if ((bool)(value))
                    value = 1;
                else
                    value = 0;
            }
            if (!(name.StartsWith(ParameterMarker)))
                name = (ParameterMarker + name);
            foreach (DbParameter p in Command.Parameters)
                if (p.ParameterName == name)
                {
                    p.Value = value;
                    return;
                }
            AddParameter(name, value);
        }
    }

    public class SqlProcedure : SqlStatement
    {

        public SqlProcedure(string procedureName) :
                this(procedureName, null)
        {
        }

        public SqlProcedure(string procedureName, string connectionStringName) :
                base(CommandType.StoredProcedure, procedureName, connectionStringName)
        {
        }
    }

    public class SqlText : SqlStatement
    {

        public SqlText(string text) :
                this(text, null)
        {
        }

        public SqlText(string text, string connectionStringName) :
                base(CommandType.Text, text, connectionStringName)
        {
        }

        public static SqlText Create(string text, string connectionStringName, params System.Object[] args)
        {
            var sel = new SqlText(text, connectionStringName);
            if ((args.Length == 1) && (args[0].GetType().Namespace == null))
            {
                var paramList = BusinessObjectParameters.Create(sel.ParameterMarker, args);
                foreach (var paramName in paramList.Keys)
                    sel.AddParameter(paramName, paramList[paramName]);
            }
            else
            {
                var m = Regex.Match(text, string.Format("({0}\\w+)", sel.ParameterMarker));
                var parameterIndex = 0;
                while (m.Success)
                {
                    sel.AddParameter(m.Value, args[parameterIndex]);
                    parameterIndex++;
                    m = m.NextMatch();
                }
            }
            return sel;
        }

        public static object ExecuteScalar(string text, params System.Object[] args)
        {
            return ExecuteScalar(text, string.Empty, args);
        }

        public static object ExecuteScalar(string text, string connectionStringName, params System.Object[] args)
        {
            using (var sel = Create(text, connectionStringName, args))
                return sel.ExecuteScalar();
        }

        public static int ExecuteNonQuery(string text, params System.Object[] args)
        {
            return ExecuteNonQuery(text, string.Empty, args);
        }

        public static int ExecuteNonQuery(string text, string connectionStringName, params System.Object[] args)
        {
            using (var sel = Create(text, connectionStringName, args))
                return sel.ExecuteNonQuery();
        }

        public static object[] Execute(string text, params System.Object[] args)
        {
            return Execute(text, string.Empty, args);
        }

        public static object[] Execute(string text, string connectionStringName, params System.Object[] args)
        {
            using (var sel = Create(text, connectionStringName, args))
                if (sel.Read())
                {
                    var result = new object[sel.Reader.FieldCount];
                    sel.Reader.GetValues(result);
                    return result;
                }
                else
                    return null;
        }

        public static int NextSequenceValue(string sequence)
        {
            try
            {
                return Convert.ToInt32(SqlText.ExecuteScalar(string.Format("select {0}.nextval from dual", sequence)));
            }
            catch (Exception)
            {
                return 0;
            }
        }

        public static int NextGeneratorValue(string generator)
        {
            try
            {
                return Convert.ToInt32(SqlText.ExecuteScalar(string.Format("SELECT NEXT VALUE FOR {0} FROM RDB$DATABASE", generator)));
            }
            catch (Exception)
            {
                return 0;
            }
        }
    }
}
