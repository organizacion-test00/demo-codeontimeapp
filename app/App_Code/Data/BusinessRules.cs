using System;
using System.Collections;
using System.Collections.Generic;
using System.Configuration;
using System.ComponentModel;
using System.Data;
using System.Data.Common;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Mail;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Reflection;
using System.Xml;
using System.Xml.XPath;
using System.Web;
using System.Web.Caching;
using System.Web.Security;
using Newtonsoft.Json.Linq;
using MyCompany.Handlers;
using MyCompany.Services;
using MyCompany.Web;

namespace MyCompany.Data
{
    public enum ActionPhase
    {

        Execute,

        Before,

        After,
    }

    [AttributeUsage(AttributeTargets.Property, AllowMultiple=true, Inherited=true)]
    public class OverrideWhenAttribute : Attribute
    {

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _controller;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _view;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _virtualView;

        public OverrideWhenAttribute(string controller, string view, string virtualView)
        {
            _controller = controller;
            _view = view;
            _virtualView = virtualView;
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

        public string View
        {
            get
            {
                return _view;
            }
            set
            {
                _view = value;
            }
        }

        public string VirtualView
        {
            get
            {
                return _virtualView;
            }
            set
            {
                _virtualView = value;
            }
        }
    }

    /// <summary>
    /// Specifies the data controller, view, action command name, and other parameters that will cause execution of the method.
    /// Method arguments will have a value if the argument name is matched to a field value passed from the client.
    /// </summary>
    [AttributeUsage(AttributeTargets.Method, AllowMultiple=true, Inherited=true)]
    public class ControllerActionAttribute : Attribute
    {

        private string _commandName;

        private string _commandArgument;

        private string _controller;

        private string _view;

        private ActionPhase _phase;

        public ControllerActionAttribute(string controller, string commandName, string commandArgument) :
                this(controller, null, commandName, commandArgument, ActionPhase.Execute)
        {
        }

        public ControllerActionAttribute(string controller, string commandName, ActionPhase phase) :
                this(controller, null, commandName, phase)
        {
        }

        public ControllerActionAttribute(string controller, string view, string commandName, ActionPhase phase) :
                this(controller, view, commandName, string.Empty, phase)
        {
        }

        public ControllerActionAttribute(string controller, string view, string commandName, string commandArgument, ActionPhase phase)
        {
            this._controller = controller;
            this._view = view;
            this._commandName = commandName;
            this._commandArgument = commandArgument;
            this._phase = phase;
        }

        public string CommandName
        {
            get
            {
                return _commandName;
            }
        }

        public string CommandArgument
        {
            get
            {
                return _commandArgument;
            }
        }

        public string Controller
        {
            get
            {
                return _controller;
            }
        }

        public string View
        {
            get
            {
                return _view;
            }
        }

        public ActionPhase Phase
        {
            get
            {
                return _phase;
            }
        }
    }

    public enum RowKind
    {

        New,

        Existing,
    }

    [AttributeUsage(AttributeTargets.Method, AllowMultiple=true)]
    public class RowBuilderAttribute : Attribute
    {

        private string _controller;

        private string _view;

        private RowKind _kind;

        public RowBuilderAttribute(string controller, RowKind kind) :
                this(controller, null, kind)
        {
        }

        public RowBuilderAttribute(string controller, string view, RowKind kind)
        {
            this._controller = controller;
            this._view = view;
            this._kind = kind;
        }

        public string Controller
        {
            get
            {
                return _controller;
            }
        }

        public string View
        {
            get
            {
                return _view;
            }
        }

        public RowKind Kind
        {
            get
            {
                return _kind;
            }
        }
    }

    public enum RowFilterOperation
    {

        None,

        Equals,

        DoesNotEqual,

        Equal,

        NotEqual,

        LessThan,

        LessThanOrEqual,

        GreaterThan,

        GreaterThanOrEqual,

        Between,

        Like,

        IsEmpty,

        IsNotEmpty,

        Contains,

        BeginsWith,

        Includes,

        DoesNotInclude,

        DoesNotBeginWith,

        DoesNotContain,

        EndsWith,

        DoesNotEndWith,

        True,

        False,

        Tomorrow,

        Today,

        Yesterday,

        NextWeek,

        ThisWeek,

        LastWeek,

        NextMonth,

        ThisMonth,

        LastMonth,

        NextQuarter,

        ThisQuarter,

        LastQuarter,

        NextYear,

        ThisYear,

        YearToDate,

        LastYear,

        Past,

        Future,

        Quarter1,

        Quarter2,

        Quarter3,

        Quarter4,

        Month1,

        Month2,

        Month3,

        Month4,

        Month5,

        Month6,

        Month7,

        Month8,

        Month9,

        Month10,

        Month11,

        Month12,
    }

    [AttributeUsage(AttributeTargets.Property, AllowMultiple=true)]
    public class RowFilterAttribute : Attribute
    {

        public static string[] ComparisonOperations = new string[] {
                string.Empty,
                "=",
                "<>",
                "=",
                "<>",
                "<",
                "<=",
                ">",
                ">=",
                "$between$",
                "*",
                "$isempty$",
                "$isnotempty$",
                "$contains$",
                "$beginswith$",
                "$in$",
                "$notin$",
                "$doesnotbeginwith$",
                "$doesnotcontain$",
                "$endswith$",
                "$doesnotendwith$",
                "$true$",
                "$false$",
                "$tomorrow$",
                "$today$",
                "$yesterday$",
                "$nextweek$",
                "$thisweek$",
                "$lastweek$",
                "$nextmonth$",
                "$thismonth$",
                "$lastmonth$",
                "$nextquarter$",
                "$thisquarter$",
                "$lastquarter$",
                "$nextyear$",
                "$thisyear$",
                "$yeartodate$",
                "$lastyear$",
                "$past$",
                "$future$",
                "$quarter1$",
                "$quarter2$",
                "$quarter3$",
                "$quarter4$",
                "$month1$",
                "$month2$",
                "$month3$",
                "$month4$",
                "$month5$",
                "$month6$",
                "$month7$",
                "$month8$",
                "$month9$",
                "$month10$",
                "$month11$",
                "$month12$"};

        private string _controller;

        private string _view;

        private string _fieldName;

        private RowFilterOperation _operation;

        public RowFilterAttribute(string controller, string view) :
                this(controller, view, null)
        {
        }

        public RowFilterAttribute(string controller, string view, string fieldName) :
                this(controller, view, fieldName, RowFilterOperation.Equal)
        {
        }

        public RowFilterAttribute(string controller, string view, string fieldName, RowFilterOperation operation)
        {
            this._controller = controller;
            this._view = view;
            this._fieldName = fieldName;
            _operation = operation;
        }

        public string Controller
        {
            get
            {
                return _controller;
            }
        }

        public string View
        {
            get
            {
                return _view;
            }
        }

        public string FieldName
        {
            get
            {
                return _fieldName;
            }
        }

        public RowFilterOperation Operation
        {
            get
            {
                return _operation;
            }
        }

        public string OperationAsText()
        {
            return ComparisonOperations[Convert.ToInt32(Operation)];
        }
    }

    public class ParameterValue
    {

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _name;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private object _value;

        public ParameterValue(string name, object value)
        {
            this.Name = name;
            this.Value = value;
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

        public object Value
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

    public class FilterValue
    {

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _filterOperation;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _name;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private List<object> _values;

        public FilterValue(string fieldName, RowFilterOperation operation) :
                this(fieldName, operation, DBNull.Value)
        {
        }

        public FilterValue(string fieldName, RowFilterOperation operation, params System.Object[] value) :
                this(fieldName, RowFilterAttribute.ComparisonOperations[((int)(operation))], value)
        {
        }

        public FilterValue(string fieldName, string operation, object value)
        {
            this._name = fieldName;
            this._filterOperation = operation;
            _values = new List<object>();
            if ((value != null) && (typeof(System.Collections.IEnumerable).IsInstanceOfType(value) && !(typeof(string).IsInstanceOfType(value))))
                _values.AddRange(((IEnumerable<object>)(value)));
            else
                _values.Add(value);
        }

        public RowFilterOperation FilterOperation
        {
            get
            {
                var index = Array.IndexOf(RowFilterAttribute.ComparisonOperations, _filterOperation);
                if (index == -1)
                    index = 0;
                return ((RowFilterOperation)(index));
            }
        }

        public string Name
        {
            get
            {
                if (this._filterOperation == "~")
                    return string.Empty;
                return _name;
            }
        }

        public object Value
        {
            get
            {
                if (_values == null)
                    return null;
                return Values[0];
            }
        }

        public object[] Values
        {
            get
            {
                return this._values.ToArray();
            }
        }

        public void AddValue(object value)
        {
            _values.Add(value);
        }

        public void Clear()
        {
            _values.Clear();
        }
    }

    public class RowFilterContext
    {

        private string _controller;

        private string _view;

        private string _lookupContextController;

        private string _lookupContextView;

        private string _lookupContextFieldName;

        private bool _canceled;

        public RowFilterContext(string controller, string view, string lookupContextController, string lookupContextView, string lookupContextFieldName)
        {
            this.Controller = controller;
            this.View = view;
            this.LookupContextController = lookupContextController;
            this.LookupContextView = lookupContextView;
            this.LookupContextFieldName = lookupContextFieldName;
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

        public string View
        {
            get
            {
                return _view;
            }
            set
            {
                _view = value;
            }
        }

        public string LookupContextController
        {
            get
            {
                return _lookupContextController;
            }
            set
            {
                _lookupContextController = value;
            }
        }

        public string LookupContextView
        {
            get
            {
                return _lookupContextView;
            }
            set
            {
                _lookupContextView = value;
            }
        }

        public string LookupContextFieldName
        {
            get
            {
                return _lookupContextFieldName;
            }
            set
            {
                _lookupContextFieldName = value;
            }
        }

        public bool Canceled
        {
            get
            {
                return _canceled;
            }
            set
            {
                _canceled = value;
            }
        }
    }

    public enum AccessPermission
    {

        Allow,

        Deny,
    }

    [AttributeUsage(AttributeTargets.Method, AllowMultiple=true)]
    public class AccessControlAttribute : Attribute
    {

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _controller;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _fieldName;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private AccessPermission _permission;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _sql;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private List<SqlParam> _parameters;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private List<object> _restrictions;

        public AccessControlAttribute(string fieldName) :
                this(string.Empty, fieldName)
        {
        }

        public AccessControlAttribute(string fieldName, AccessPermission permission) :
                this(string.Empty, fieldName, permission)
        {
        }

        public AccessControlAttribute(string controller, string fieldName) :
                this(controller, fieldName, AccessPermission.Allow)
        {
        }

        public AccessControlAttribute(string controller, string fieldName, AccessPermission permission) :
                this(controller, fieldName, string.Empty, permission)
        {
        }

        public AccessControlAttribute(string controller, string fieldName, string sql) :
                this(controller, fieldName, sql, AccessPermission.Allow)
        {
        }

        public AccessControlAttribute(string controller, string fieldName, string sql, AccessPermission permission)
        {
            this._controller = controller;
            this._fieldName = fieldName;
            this._permission = permission;
            this._sql = sql;
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

        public string FieldName
        {
            get
            {
                return _fieldName;
            }
            set
            {
                _fieldName = value;
            }
        }

        public AccessPermission Permission
        {
            get
            {
                return _permission;
            }
            set
            {
                _permission = value;
            }
        }

        public string Sql
        {
            get
            {
                return _sql;
            }
            set
            {
                _sql = value;
            }
        }

        public List<SqlParam> Parameters
        {
            get
            {
                return _parameters;
            }
            set
            {
                _parameters = value;
            }
        }

        public List<object> Restrictions
        {
            get
            {
                return _restrictions;
            }
            set
            {
                _restrictions = value;
            }
        }
    }

    public class AccessControlRule
    {

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private AccessControlAttribute _accessControl;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private MethodInfo _method;

        public AccessControlRule(AccessControlAttribute accessControl, MethodInfo method)
        {
            this._accessControl = accessControl;
            this._method = method;
        }

        public AccessControlAttribute AccessControl
        {
            get
            {
                return _accessControl;
            }
            set
            {
                _accessControl = value;
            }
        }

        public MethodInfo Method
        {
            get
            {
                return _method;
            }
            set
            {
                _method = value;
            }
        }
    }

    public class AccessControlRuleDictionary : SortedDictionary<string, List<AccessControlRule>>
    {
    }

    public class DynamicAccessControlList : List<DynamicAccessControlRule>
    {

        public static Regex RuleRegex = new Regex("(?\'ParamList\'^(\\s*([\\w\\-]+)\\s*(\\:|\\=)\\s*(.+?)\\n)+)", RegexOptions.Multiline);

        public static Regex ParamRegex = new Regex("^(?\'Name\'[\\w\\-]+)\\s*(\\:|\\=)\\s*(?\'Value\'.+)$", RegexOptions.Multiline);

        public virtual void Parse(string fileName, string rules)
        {
            var parameters = new SortedDictionary<string, string>();
            var ruleMatch = RuleRegex.Match(rules);
            while (ruleMatch.Success)
            {
                parameters.Clear();
                var paramMatch = ParamRegex.Match(ruleMatch.Groups["ParamList"].Value);
                while (paramMatch.Success)
                {
                    parameters[paramMatch.Groups["Name"].Value.ToLower().Replace("-", string.Empty)] = paramMatch.Groups["Value"].Value.Trim();
                    paramMatch = paramMatch.NextMatch();
                }
                string v = null;
                if (parameters.TryGetValue("field", out v))
                {
                    var r = new DynamicAccessControlRule()
                    {
                        Field = v
                    };
                    if (parameters.TryGetValue("controller", out v))
                        r.Controller = v;
                    if (parameters.TryGetValue("tags", out v))
                        r.Tags = BusinessRules.ListRegex.Split(v);
                    if (parameters.TryGetValue("roles", out v))
                        r.Roles = BusinessRules.ListRegex.Split(v);
                    if (parameters.TryGetValue("roleexceptions", out v))
                        r.RoleExceptions = BusinessRules.ListRegex.Split(v);
                    if (parameters.TryGetValue("users", out v))
                        r.Users = BusinessRules.ListRegex.Split(v);
                    if (parameters.TryGetValue("userexceptions", out v))
                        r.UserExceptions = BusinessRules.ListRegex.Split(v);
                    parameters.TryGetValue("type", out v);
                    var index = (ruleMatch.Index + ruleMatch.Length);
                    var nextIndex = rules.Length;
                    ruleMatch = ruleMatch.NextMatch();
                    if (ruleMatch.Success)
                        nextIndex = ruleMatch.Index;
                    var sql = rules.Substring(index, (nextIndex - index)).Trim();
                    if ("deny".Equals(v, StringComparison.OrdinalIgnoreCase))
                        r.DenySql = sql;
                    else
                        r.AllowSql = sql;
                    Add(r);
                }
                else
                    ruleMatch = ruleMatch.NextMatch();
            }
        }
    }

    public class DynamicAccessControlRule
    {

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _field;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _controller;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string[] _tags;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string[] _roles;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string[] _roleExceptions;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string[] _users;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string[] _userExceptions;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _allowSql;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _denySql;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _fileName;

        public virtual string Field
        {
            get
            {
                return _field;
            }
            set
            {
                _field = value;
            }
        }

        public virtual string Controller
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

        public virtual string[] Tags
        {
            get
            {
                return _tags;
            }
            set
            {
                _tags = value;
            }
        }

        public virtual string[] Roles
        {
            get
            {
                return _roles;
            }
            set
            {
                _roles = value;
            }
        }

        public virtual string[] RoleExceptions
        {
            get
            {
                return _roleExceptions;
            }
            set
            {
                _roleExceptions = value;
            }
        }

        public virtual string[] Users
        {
            get
            {
                return _users;
            }
            set
            {
                _users = value;
            }
        }

        public virtual string[] UserExceptions
        {
            get
            {
                return _userExceptions;
            }
            set
            {
                _userExceptions = value;
            }
        }

        public virtual string AllowSql
        {
            get
            {
                return _allowSql;
            }
            set
            {
                _allowSql = value;
            }
        }

        public virtual string DenySql
        {
            get
            {
                return _denySql;
            }
            set
            {
                _denySql = value;
            }
        }

        public virtual string FileName
        {
            get
            {
                return _fileName;
            }
            set
            {
                _fileName = value;
            }
        }

        public override string ToString()
        {
            var mode = "allow";
            var sql = AllowSql;
            if (string.IsNullOrEmpty(AllowSql))
            {
                sql = DenySql;
                mode = "deny";
            }
            var trigger = Controller;
            if (!(string.IsNullOrEmpty(trigger)))
                trigger = (trigger + ".");
            trigger = (trigger + Field);
            return string.Format("{0} ({1}) -> {2}", trigger, mode, sql.Trim());
        }
    }

    public partial class BusinessRules : BusinessRulesBase
    {

        public static Regex ListRegex = new Regex("\\s*,\\s*");

        public static string StartUrl
        {
            get
            {
                var context = HttpContext.Current;
                var url = context.Request.Headers["X-Start-Url"];
                if (url == null)
                    url = context.Request.Headers["Referer"];
                if (url == null)
                    url = string.Empty;
                return url;
            }
        }
    }

    public class BusinessRulesBase : ActionHandlerBase, MyCompany.Data.IRowHandler, MyCompany.Data.IDataFilter, MyCompany.Data.IDataFilter2
    {

        private MethodInfo[] _newRow;

        private MethodInfo[] _prepareRow;

        private IEnumerable<object> _resultSetArray;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _enableResultSet;

        private DataTable _resultSet;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private int _resultSetSize;

        private int _resultSetCacheDuration;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _enableEmailMessages;

        private DataTable _emailMessages;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private ControllerConfiguration _config;

        private string _controllerName;

        private object[] _row;

        private PageRequest _request;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private ViewPage _page;

        private RowFilterContext _rowFilter;

        private bool _applyAccessControlRule = false;

        private List<object> _accessControlRestrictions;

        private DbCommand _accessControlCommand;

        private AccessControlRuleDictionary _dynamicAccessControlRules;

        private SelectClauseDictionary _expressions;

        public static Regex FieldNameRegex = new Regex("\\[(\\w+)\\]");

        private bool _sqlIsValid;

        public static Regex SelectDetectionRegex = new Regex("^\\s*select\\s+", RegexOptions.IgnoreCase);

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private XPathNavigator _navigator;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private XmlNamespaceManager _resolver;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _enableDccTest;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private SiteContentFileList _pendingAlterations;

        public static Regex TestPendingAlterRegex = new Regex("\\b(when\\-?(view|test|sql))\\b", RegexOptions.IgnoreCase);

        public static Regex AlterMethodRegex = new Regex("\\s*(?\'Method\'[\\w\\-]+)\\s*\\((?\'Parameters\'[\\s\\S]*?)\\)\\s*(?\'Terminator\'\\.|;|$)");

        public static Regex AlterParametersRegex = new Regex("\\s*(\"|\\\')(?\'Argument\'[\\s\\S]*?)(\"|\\\')(\\s*(,|$))");

        private string _userEmail;

        private string[] _requestFilter;

        private FieldValue[] _requestExternalFilter;

        public static Regex SqlFieldFilterOperationRegex = new Regex("^(?\'Name\'\\w+?)_Filter_((?\'Operation\'\\w+?)(?\'Index\'\\d*))?$");

        public static string[] SystemSqlParameters = new string[] {
                "BusinessRules_PreventDefault",
                "Result_Continue",
                "Result_Refresh",
                "Result_RefreshChildren",
                "Result_ClearSelection",
                "Result_KeepSelection",
                "Result_Master",
                "Result_ShowAlert",
                "Result_ShowMessage",
                "Result_ShowViewMessage",
                "Result_Focus",
                "Result_Error",
                "Result_ExecuteOnClient",
                "Result_NavigateUrl"};

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _requiresRowCount;

        public Regex SystemSqlPropertyRegex = new Regex("^(BusinessRules|Session|Url|Arguments|Profile)_");

        private SortedDictionary<string, string> _actionParameters;

        private string _actionParametersData;

        public IEnumerable<object> ResultSetArray
        {
            get
            {
                return _resultSetArray;
            }
            set
            {
                _resultSetArray = value;
                if (value == null)
                    ResultSet = null;
                else
                {
                    var table = new DataTable();
                    using (var enumerator = value.GetEnumerator())
                    {
                        List<PropertyInfo> propertyList = null;
                        while (enumerator.MoveNext())
                        {
                            var instance = enumerator.Current;
                            if (instance != null)
                            {
                                if (propertyList == null)
                                {
                                    propertyList = new List<PropertyInfo>();
                                    foreach (var pi in instance.GetType().GetProperties())
                                    {
                                        var propertyType = pi.PropertyType;
                                        if ((pi.GetIndexParameters().Length == 0) && propertyType.Namespace.Equals("System"))
                                        {
                                            propertyList.Add(pi);
                                            if (propertyType.IsGenericType)
                                                propertyType = Nullable.GetUnderlyingType(pi.PropertyType);
                                            table.Columns.Add(pi.Name, propertyType);
                                        }
                                    }
                                }
                                var r = table.NewRow();
                                for (var i = 0; (i < propertyList.Count); i++)
                                {
                                    var pi = propertyList[i];
                                    var v = pi.GetValue(instance, null);
                                    if (v == null)
                                        v = DBNull.Value;
                                    r[i] = v;
                                }
                                table.Rows.Add(r);
                            }
                        }
                    }
                    if (table.Columns.Count == 0)
                        ResultSet = null;
                    else
                        ResultSet = table;
                }
            }
        }

        public bool EnableResultSet
        {
            get
            {
                return _enableResultSet;
            }
            set
            {
                _enableResultSet = value;
            }
        }

        public DataTable ResultSet
        {
            get
            {
                return _resultSet;
            }
            set
            {
                this._resultSet = value;
                EnableResultSet = true;
            }
        }

        public int ResultSetSize
        {
            get
            {
                return _resultSetSize;
            }
            set
            {
                _resultSetSize = value;
            }
        }

        public int ResultSetCacheDuration
        {
            get
            {
                return _resultSetCacheDuration;
            }
            set
            {
                this._resultSetCacheDuration = value;
                EnableResultSet = true;
            }
        }

        public bool EnableEmailMessages
        {
            get
            {
                return _enableEmailMessages;
            }
            set
            {
                _enableEmailMessages = value;
            }
        }

        public DataTable EmailMessages
        {
            get
            {
                return _emailMessages;
            }
            set
            {
                EnableEmailMessages = true;
                _emailMessages = value;
                if (value != null)
                    foreach (DataRow message in value.Rows)
                        Email(message);
                EnableEmailMessages = false;
            }
        }

        public ControllerConfiguration Config
        {
            get
            {
                return _config;
            }
            set
            {
                _config = value;
            }
        }

        public string ControllerName
        {
            get
            {
                return _controllerName;
            }
            set
            {
                _controllerName = value;
            }
        }

        public object[] Row
        {
            get
            {
                return _row;
            }
        }

        public PageRequest Request
        {
            get
            {
                return _request;
            }
        }

        public ViewPage Page
        {
            get
            {
                return _page;
            }
            set
            {
                _page = value;
            }
        }

        protected System.Web.HttpContext Context
        {
            get
            {
                return System.Web.HttpContext.Current;
            }
        }

        public RowFilterContext RowFilter
        {
            get
            {
                return _rowFilter;
            }
        }

        public string LookupContextController
        {
            get
            {
                if (PageRequest.Current != null)
                    return PageRequest.Current.LookupContextController;
                if (DistinctValueRequest.Current != null)
                    return DistinctValueRequest.Current.LookupContextController;
                return null;
            }
        }

        public string LookupContextView
        {
            get
            {
                if (PageRequest.Current != null)
                    return PageRequest.Current.LookupContextView;
                if (DistinctValueRequest.Current != null)
                    return DistinctValueRequest.Current.LookupContextView;
                return null;
            }
        }

        public string LookupContextFieldName
        {
            get
            {
                if (PageRequest.Current != null)
                    return PageRequest.Current.LookupContextFieldName;
                if (DistinctValueRequest.Current != null)
                    return DistinctValueRequest.Current.LookupContextFieldName;
                return null;
            }
        }

        protected XPathNavigator Navigator
        {
            get
            {
                return _navigator;
            }
            set
            {
                _navigator = value;
            }
        }

        protected XmlNamespaceManager Resolver
        {
            get
            {
                return _resolver;
            }
            set
            {
                _resolver = value;
            }
        }

        public bool EnableDccTest
        {
            get
            {
                return _enableDccTest;
            }
            set
            {
                _enableDccTest = value;
            }
        }

        public SiteContentFileList PendingAlterations
        {
            get
            {
                return _pendingAlterations;
            }
            set
            {
                _pendingAlterations = value;
            }
        }

        protected string[] TagList
        {
            get
            {
                var t = Tags;
                if (string.IsNullOrEmpty(t))
                    t = string.Empty;
                return t.Split(new char[] {
                            ',',
                            ' '}, StringSplitOptions.RemoveEmptyEntries);
            }
            set
            {
                var sb = new StringBuilder();
                if (value != null)
                    foreach (var s in value)
                    {
                        if (sb.Length > 0)
                            sb.Append(",");
                        sb.Append(s);
                    }
                Tags = sb.ToString();
            }
        }

        public static string UserName
        {
            get
            {
                return System.Web.HttpContext.Current.User.Identity.Name;
            }
        }

        public virtual string UserEmail
        {
            get
            {
                if (!(string.IsNullOrEmpty(_userEmail)))
                    return _userEmail;
                if (!((System.Web.HttpContext.Current.User.Identity is System.Security.Principal.WindowsIdentity)))
                    return System.Web.Security.Membership.GetUser().Email;
                return null;
            }
            set
            {
                _userEmail = value;
            }
        }

        public virtual string UserRoles
        {
            get
            {
                return string.Join(",", Roles.GetRolesForUser());
            }
        }

        public static object UserId
        {
            get
            {
                if (System.Web.HttpContext.Current.User.Identity is System.Security.Principal.WindowsIdentity)
                    return System.Security.Principal.WindowsIdentity.GetCurrent().User.Value;
                else
                {
                    var user = Membership.GetUser();
                    if (user == null)
                        return null;
                    return user.ProviderUserKey;
                }
            }
        }

        public string QuickFindFilter
        {
            get
            {
                if (this._requestFilter != null)
                    foreach (var filterExpression in this._requestFilter)
                    {
                        var filterMatch = Controller.FilterExpressionRegex.Match(filterExpression);
                        if (filterMatch.Success)
                        {
                            var valueMatch = Controller.FilterValueRegex.Match(filterMatch.Groups["Values"].Value);
                            if (valueMatch.Success && (valueMatch.Groups["Operation"].Value == "~"))
                                return Convert.ToString(Controller.StringToValue(valueMatch.Groups["Value"].Value));
                        }
                    }
                return null;
            }
        }

        public string Tags
        {
            get
            {
                if (Page != null)
                    return Page.Tag;
                if (Arguments != null)
                {
                    if (Result.Tag == null)
                        Result.Tag = Arguments.Tag;
                    return Result.Tag;
                }
                if (DistinctValueRequest.Current != null)
                    return DistinctValueRequest.Current.Tag;
                if (PageRequest.Current != null)
                    return PageRequest.Current.Tag;
                return null;
            }
            set
            {
                if (Page != null)
                    Page.Tag = value;
                else
                {
                    if (Result != null)
                        Result.Tag = value;
                }
            }
        }

        /// <summary>
        /// Specfies if the the currently processed "Select" action must calculate the number of available data rows.
        /// </summary>
        public bool RequiresRowCount
        {
            get
            {
                return _requiresRowCount;
            }
            set
            {
                _requiresRowCount = value;
            }
        }

        /// <summary>
        /// Returns the name of the View that was active when the currently processed action has been invoked.
        /// </summary>
        public string View
        {
            get
            {
                if (_request != null)
                    return _request.View;
                if (Arguments != null)
                    return Arguments.View;
                return null;
            }
        }

        public SortedDictionary<string, string> ActionParameters
        {
            get
            {
                if (_actionParameters == null)
                {
                    _actionParameters = new SortedDictionary<string, string>();
                    var data = _actionParametersData;
                    if (string.IsNullOrEmpty(data))
                        data = ActionData;
                    if (!(string.IsNullOrEmpty(data)))
                    {
                        data = ReplaceFieldNamesWithValues(Regex.Replace(data, "^(?\'Name\'[\\w-]+)\\s*:\\s*(?\'Value\'.+?)\\s*$", DoReplaceActionParameter, RegexOptions.Multiline));
                        _actionParameters.Add(string.Empty, data.Trim());
                    }
                }
                return _actionParameters;
            }
        }

        /// <summary>
        /// The value of the 'Data' property of the currently processed action as defined in the data controller.
        /// </summary>
        public string ActionData
        {
            get
            {
                if (Arguments != null)
                    return Config.ReadActionData(Arguments.Path);
                return null;
            }
        }

        public virtual string Localize(string token, string text)
        {
            return Localizer.Replace("Controllers", (ControllerName + ".xml"), token, text);
        }

        public bool IsOverrideApplicable(string controller, string view, string virtualView)
        {
            foreach (var p in GetType().GetProperties(((BindingFlags.Public | BindingFlags.NonPublic) | BindingFlags.Instance)))
                foreach (OverrideWhenAttribute filter in p.GetCustomAttributes(typeof(OverrideWhenAttribute), true))
                    if (((filter.Controller == controller) && (filter.View == view)) && (filter.VirtualView == virtualView))
                    {
                        var v = p.GetValue(this, null);
                        return ((v is bool) && ((bool)(v)));
                    }
            return false;
        }

        private MethodInfo[] FindRowHandler(PageRequest request, RowKind kind)
        {
            var list = new List<MethodInfo>();
            foreach (var method in GetType().GetMethods((BindingFlags.Public | (BindingFlags.NonPublic | BindingFlags.Instance))))
                foreach (RowBuilderAttribute filter in method.GetCustomAttributes(typeof(RowBuilderAttribute), true))
                    if (filter.Kind == kind)
                    {
                        if (((request.Controller == filter.Controller) || Regex.IsMatch(request.Controller, filter.Controller)) && (string.IsNullOrEmpty(filter.View) || (request.View == filter.View)))
                            list.Add(method);
                    }
            return list.ToArray();
        }

        bool IRowHandler.SupportsNewRow(PageRequest request)
        {
            _newRow = FindRowHandler(request, RowKind.New);
            return (_newRow.Length > 0);
        }

        void IRowHandler.NewRow(PageRequest request, ViewPage page, object[] row)
        {
            if (_newRow != null)
            {
                this._request = request;
                this._page = page;
                this._row = row;
                foreach (var method in _newRow)
                    method.Invoke(this, new object[0]);
            }
        }

        bool IRowHandler.SupportsPrepareRow(PageRequest request)
        {
            _prepareRow = FindRowHandler(request, RowKind.Existing);
            return (_prepareRow.Length > 0);
        }

        void IRowHandler.PrepareRow(PageRequest request, ViewPage page, object[] row)
        {
            if (_prepareRow != null)
            {
                this._request = request;
                this._page = page;
                this._row = row;
                foreach (var method in _prepareRow)
                    method.Invoke(this, new object[0]);
            }
        }

        public virtual void ProcessPageRequest(PageRequest request, ViewPage page)
        {
        }

        public static List<string> ValueToList(string v)
        {
            if (string.IsNullOrEmpty(v))
                return new List<string>();
            return new List<string>(v.Split(','));
        }

        public object SelectFieldValue(string name)
        {
            return SelectFieldValue(name, true);
        }

        public static bool ListsAreEqual(List<string> list1, List<string> list2)
        {
            if (list1.Count != list2.Count)
                return false;
            foreach (var s in list1)
                if (!(list2.Contains(s)))
                    return false;
            return true;
        }

        public static bool ListsAreEqual(string list1, string list2)
        {
            return ListsAreEqual(ValueToList(list1), ValueToList(list2));
        }

        public object SelectFieldValue(string name, bool useExternalValues)
        {
            object v = null;
            if ((_page != null) && (_row != null))
                v = _page.SelectFieldValue(name, _row);
            else
            {
                if (Arguments != null)
                    foreach (var av in Arguments.Values)
                        if (av.Name.Equals(name, StringComparison.InvariantCultureIgnoreCase))
                            return av.Value;
            }
            if ((v == null) && useExternalValues)
                v = SelectExternalFilterFieldValue(name);
            return v;
        }

        protected override bool BuildingDataRows()
        {
            return ((_page != null) && (_row != null));
        }

        public override FieldValue SelectFieldValueObject(string name)
        {
            FieldValue result = null;
            if (this.Arguments != null)
                result = this.Arguments[name];
            if (((result == null) && BuildingDataRows()) && ((this.Request != null) && !this.Request.Inserting))
                result = _page.SelectFieldValueObject(name, _row);
            if (result == null)
                result = SelectExternalFilterFieldValueObject(name);
            return result;
        }

        public void UpdateMasterFieldValue(string name, object value)
        {
            if (DBNull.Value.Equals(value))
                value = null;
            if (Result != null)
            {
                var fvo = new FieldValue(name, value)
                {
                    Scope = "master"
                };
                Result.Values.Add(fvo);
            }
        }

        public void UpdateFieldValue(string name, object value)
        {
            if (DBNull.Value.Equals(value))
                value = null;
            if ((_page != null) && (_row != null))
                _page.UpdateFieldValue(name, _row, value);
            else
            {
                if (Result != null)
                    Result.Values.Add(new FieldValue(name, value));
                if (Arguments != null)
                {
                    var v = SelectFieldValueObject(name);
                    if (v != null)
                    {
                        v.NewValue = value;
                        v.Modified = true;
                    }
                }
            }
        }

        public object SelectExternalFilterFieldValue(string name)
        {
            var v = SelectExternalFilterFieldValueObject(name);
            if (v != null)
                return v.Value;
            return null;
        }

        public FieldValue SelectExternalFilterFieldValueObject(string name)
        {
            FieldValue[] values = null;
            if (Request != null)
                values = Request.ExternalFilter;
            else
            {
                if (Arguments != null)
                    values = Arguments.ExternalFilter;
            }
            if (values == null)
                values = this._requestExternalFilter;
            if (values != null)
                for (var i = 0; (i < values.Length); i++)
                    if (values[i].Name.Equals(name, StringComparison.InvariantCultureIgnoreCase))
                        return values[i];
            return null;
        }

        public void PopulateManyToManyField(string fieldName, string primaryKeyField, string targetController, string targetForeignKey1, string targetForeignKey2)
        {
            // Deprecated in 8.5.9.0. See DataControllerBase.PopulateManyToManyFields()
        }

        public void UpdateManyToManyField(string fieldName, string primaryKeyField, string targetController, string targetForeignKey1, string targetForeignKey2)
        {
            // Deprecated in 8.5.9.0. See DataControllerBase.ProcessManyToManyFields()
        }

        public void ClearManyToManyField(string fieldName, string primaryKeyField, string targetController, string targetForeignKey1, string targetForeignKey2)
        {
            // Deprecated in 8.5.9.0. See DataControllerBase.ProcessManyToManyFields()
        }

        private void UpdateGeoFields()
        {
            var geoFields = Config.Select("/c:dataController/c:views/c:view[@id=\'{0}\']/c:categories/c:category/c:dataFields/" +
                    "c:dataField[contains(@tag, \'geocode-\')]", View);
            if (geoFields.Count > 0)
            {
                // build address
                var wasModified = false;
                var latitudeField = string.Empty;
                var longitudeField = string.Empty;
                var values = new Dictionary<string, string>();
                values.Add("address", null);
                values.Add("city", null);
                values.Add("state", null);
                values.Add("region", null);
                values.Add("zip", null);
                values.Add("country", null);
                foreach (XPathNavigator nav in geoFields)
                {
                    var tag = nav.GetAttribute("tag", string.Empty);
                    var fieldName = nav.GetAttribute("fieldName", string.Empty);
                    var m = Regex.Match(tag, "(\\s|^)geocode-(?\'Type\'\\w+)(\\s|$)");
                    if (m.Success)
                    {
                        var type = m.Groups["Type"].Value;
                        if (type == "latitude")
                            latitudeField = fieldName;
                        else
                        {
                            if (type == "longitude")
                                longitudeField = fieldName;
                            else
                            {
                                if ((type == "zipcode") || (type == "postalcode"))
                                    type = "zip";
                                var fvo = SelectFieldValueObject(fieldName);
                                if (fvo != null)
                                {
                                    if (fvo.Modified)
                                        wasModified = true;
                                    values[type] = Convert.ToString(fvo.Value);
                                }
                            }
                        }
                    }
                }
                // geocode address
                var address = string.Join(",", values.Values.Distinct().ToArray());
                if (wasModified && !(string.IsNullOrEmpty("address")))
                {
                    decimal latitude;
                    decimal longitude;
                    if (Geocode(address, out latitude, out longitude))
                    {
                        if (!(string.IsNullOrEmpty(latitudeField)))
                            UpdateFieldValue(latitudeField, latitude);
                        if (!(string.IsNullOrEmpty(longitudeField)))
                            UpdateFieldValue(longitudeField, longitude);
                    }
                }
            }
        }

        /// <summary>
        /// Queries Google Geocode API for Latitude and Longitude of the requested Address.
        /// The Google Maps API Identifier must be defined within the Project Wizard.
        /// Please note the Google Maps APIs Terms of Service: https://developers.google.com/maps/premium/support#terms-of-use
        /// </summary>
        /// <param name="address">Address to query.</param>
        /// <param name="latitude">The returned Latitude. Will return 0 if request failed.</param>
        /// <param name="longitude">The returned Longitude. Will return 0 if request failed.</param>
        /// <returns>True if the geocode request succeeded.</returns>
        public virtual bool Geocode(string address, out decimal latitude, out decimal longitude)
        {
            // send request
            var request = WebRequest.Create(string.Format("https://maps.googleapis.com/maps/api/geocode/json?address={0}&{1}", HttpUtility.UrlEncode(address), ApplicationServices.MapsApiIdentifier));
            var response = request.GetResponse();
            var json = string.Empty;
            using (var sr = new StreamReader(response.GetResponseStream()))
                json = sr.ReadToEnd();
            if (!(string.IsNullOrEmpty(json)))
            {
                var m = Regex.Match(json, "\"location\"\\s*:\\s*{\\s*\"lat\"\\s*:\\s(?\'Latitude\'-?\\d+.\\d+),\\s*\"lng\"\\s*:\\s*(?\'Longitud" +
                        "e\'-?\\d+.\\d+)");
                if (m.Success)
                {
                    latitude = decimal.Parse(m.Groups["Latitude"].Value);
                    longitude = decimal.Parse(m.Groups["Longitude"].Value);
                    return true;
                }
            }
            latitude = 0;
            longitude = 0;
            return false;
        }

        /// <summary>
        /// Queries Google Distance Matrix API to fetch the estimated driving distance between the origin and destination.
        /// The Google Maps API Identifier must be defined within the Project Wizard.
        /// Please note the Google Maps APIs Terms of Service: https://developers.google.com/maps/premium/support#terms-of-use
        /// </summary>
        /// <param name="origin">The origin address.</param>
        /// <param name="destination">The destination address.</param>
        /// <returns>Returns the distance in meters. Will return 0 if the request has failed.</returns>
        public virtual int CalculateDistance(string origin, string destination)
        {
            // send request
            var request = WebRequest.Create(string.Format("https://maps.googleapis.com/maps/api/distancematrix/json?origins={0}&destinations" +
                        "={1}&{2}", HttpUtility.UrlEncode(origin), HttpUtility.UrlEncode(destination), ApplicationServices.MapsApiIdentifier));
            var response = request.GetResponse();
            var json = string.Empty;
            using (var sr = new StreamReader(response.GetResponseStream()))
                json = sr.ReadToEnd();
            if (!(string.IsNullOrEmpty(json)))
            {
                var m = Regex.Match(json, "\"distance\"\\s*:\\s*{\\s*\"text\"\\s*:\\s*\"[\\w\\d\\s\\.]+\",\\s*\"value\"\\s+:\\s+(?\'Distance\'\\d+)" +
                        "\\s*}");
                if (m.Success)
                    return int.Parse(m.Groups["Distance"].Value);
            }
            return 0;
        }

        void IDataFilter.Filter(SortedDictionary<string, object> filter)
        {
            // do nothing
        }

        void IDataFilter2.Filter(string controller, string view, SortedDictionary<string, object> filter)
        {
            this.Filter(controller, view, filter);
        }

        protected virtual void Filter(string controller, string view, SortedDictionary<string, object> filter)
        {
            foreach (var p in GetType().GetProperties((BindingFlags.Public | (BindingFlags.NonPublic | BindingFlags.Instance))))
                foreach (RowFilterAttribute rowFilter in p.GetCustomAttributes(typeof(RowFilterAttribute), true))
                    if ((controller == rowFilter.Controller) && (string.IsNullOrEmpty(rowFilter.View) || (view == rowFilter.View)))
                    {
                        this.RowFilter.Canceled = false;
                        var v = p.GetValue(this, null);
                        var fieldName = rowFilter.FieldName;
                        if (string.IsNullOrEmpty(fieldName))
                            fieldName = p.Name;
                        if (!this.RowFilter.Canceled)
                        {
                            if (typeof(System.Collections.IEnumerable).IsInstanceOfType(v) && !(typeof(String).IsInstanceOfType(v)))
                            {
                                var sb = new StringBuilder();
                                foreach (var item in ((System.Collections.IEnumerable)(v)))
                                {
                                    if (sb.Length > 0)
                                        sb.AppendFormat(rowFilter.OperationAsText());
                                    sb.Append(item);
                                    sb.Append(Convert.ToChar(0));
                                }
                                v = sb.ToString();
                            }
                            if (v == null)
                                v = "null";
                            var filterExpression = string.Format("{0}{1}", rowFilter.OperationAsText(), v);
                            if (!(filter.ContainsKey(fieldName)))
                                filter.Add(fieldName, filterExpression);
                            else
                                filter[fieldName] = string.Format("{0}{1}{2}", filter[fieldName], Convert.ToChar(0), filterExpression);
                        }
                    }
        }

        void IDataFilter2.AssignContext(string controller, string view, string lookupContextController, string lookupContextView, string lookupContextFieldName)
        {
            _rowFilter = new RowFilterContext(controller, view, lookupContextController, lookupContextView, lookupContextFieldName);
        }

        protected object LastEnteredValue(string controller, string fieldName)
        {
            if (Context == null)
                return null;
            var values = ((FieldValue[])(Context.Session[string.Format("{0}$LEVs", controller)]));
            if (values != null)
                foreach (var v in values)
                    if (v.Name.Equals(fieldName, StringComparison.InvariantCultureIgnoreCase))
                        return v.Value;
            return null;
        }

        protected virtual bool UserIsInRole(params System.String[] rules)
        {
            return DataControllerBase.UserIsInRole(rules);
        }

        /// <summary>
        /// Creates a controller node set to manipulate the XML definition of data controller.
        /// </summary>
        /// <returns>Returns an empty node set.</returns>
        public ControllerNodeSet NodeSet()
        {
            if (Navigator == null)
                return new ControllerNodeSet(Config.Navigator, ((XmlNamespaceManager)(Config.Resolver)));
            return new ControllerNodeSet(Navigator, Resolver);
        }

        /// <summary>
        /// Creates a controller node set matched to XPath selector. Controller node set allows manipulating the XML definition of data controller.
        /// </summary>
        /// <param name="selector">XPath expression evaluated against the definition of the data controller. May contain variables.</param>
        /// <param name="args">Optional values of variables. If variables are specified then the expression is evaluated for each variable or group of variables specified in the selector.</param>
        /// <example>field[@name=$name]</example>
        /// <returns>A node set containing selected data controller nodes.</returns>
        protected ControllerNodeSet NodeSet(string selector, params System.String[] args)
        {
            return new ControllerNodeSet(Navigator, Resolver).Select(selector, args);
        }

        protected void UnrestrictedAccess()
        {
            _applyAccessControlRule = false;
        }

        protected void RestrictAccess()
        {
            _applyAccessControlRule = true;
        }

        protected void RestrictAccess(object value)
        {
            _accessControlRestrictions.Add(value);
            _applyAccessControlRule = true;
        }

        protected void RestrictAccess(string parameterName, object value)
        {
            DbParameter parameter = null;
            foreach (DbParameter p in _accessControlCommand.Parameters)
                if (p.ParameterName == parameterName)
                {
                    parameter = p;
                    break;
                }
            if (parameter == null)
            {
                parameter = _accessControlCommand.CreateParameter();
                parameter.ParameterName = parameterName;
                _accessControlCommand.Parameters.Add(parameter);
            }
            parameter.Value = value;
            _applyAccessControlRule = true;
        }

        private AccessControlAttribute CreateDynamicAccessControlAttribute(string fieldName)
        {
            if (_dynamicAccessControlRules == null)
                _dynamicAccessControlRules = new AccessControlRuleDictionary();
            var a = new AccessControlAttribute(fieldName);
            List<AccessControlRule> attributes = null;
            if (!(_dynamicAccessControlRules.TryGetValue(fieldName, out attributes)))
            {
                attributes = new List<AccessControlRule>();
                _dynamicAccessControlRules.Add(fieldName, attributes);
            }
            attributes.Add(new AccessControlRule(a, null));
            return a;
        }

        /// <summary>
        /// Registers the access control rule that will be active only while processing the current request.
        /// </summary>
        /// <param name="fieldName">The name of the data field that must be present in the data view for the rule to be activated.</param>
        /// <param name="sql">The arbitrary SQL expression that will filter data. Names of the data fields can be referenced if enclosed in square brackets.</param>
        /// <param name="permission">The permission to allow or deny access to data. Access control rules are combined according to this formula: (List of  “Allow” restrictions) and Not (List of “Deny” restrictions).</param>
        /// <param name="parameters">Properties of this object are converted into parameters matched by name to the parameter references in the expression specified as 'sql' argument of this method.</param>
        protected void RegisterAccessControlRule(string fieldName, string sql, AccessPermission permission, object parameters)
        {
            var paramList = new BusinessObjectParameters();
            paramList.Assign(parameters);
            var sqlParamList = new List<SqlParam>();
            foreach (var paramName in paramList.Keys)
                sqlParamList.Add(new SqlParam(paramName, paramList[paramName]));
            RegisterAccessControlRule(fieldName, sql, permission, sqlParamList.ToArray());
        }

        /// <summary>
        /// Registers the access control rule that will be active only while processing the current request.
        /// </summary>
        /// <param name="fieldName">The name of the data field that must be present in the data view for the rule to be activated.</param>
        /// <param name="sql">The arbitrary SQL expression that will filter data. Names of the data fields can be referenced if enclosed in square brackets.</param>
        /// <param name="permission">The permission to allow or deny access to data. Access control rules are combined according to this formula: (List of  “Allow” restrictions) and Not (List of “Deny” restrictions).</param>
        /// <param name="parameters">Values of parameters references in SQL expression.</param>
        protected void RegisterAccessControlRule(string fieldName, string sql, AccessPermission permission, params SqlParam[] parameters)
        {
            if (!(_page.ContainsField(fieldName)))
                return;
            var a = CreateDynamicAccessControlAttribute(fieldName);
            a.Sql = sql;
            a.Permission = permission;
            a.Parameters = new List<SqlParam>();
            if (parameters.Length == 0)
            {
                using (var query = new SqlText(sql))
                {
                    var m = new Regex((Regex.Escape(query.ParameterMarker) + "([\\w_]+)")).Match(sql);
                    while (m.Success)
                    {
                        if (!(query.Parameters.Contains(m.Value)))
                            IsSystemSqlParameter(query, m.Value);
                        m = m.NextMatch();
                    }
                    foreach (DbParameter p in query.Parameters)
                        a.Parameters.Add(new SqlParam(p.ParameterName, p.Value));
                }
            }
            else
                foreach (var p in parameters)
                    a.Parameters.Add(p);
        }

        /// <summary>
        /// Registers the access control rule that will be active only while processing the current request.
        /// </summary>
        /// <param name="fieldName">The name of the data field that must be present in the data view for the rule to be activated.</param>
        /// <param name="permission">The permission to allow or deny access to data. Access control rules are combined according to this formula: (List of  “Allow” restrictions) and Not (List of “Deny” restrictions).</param>
        /// <param name="values">The list of values that will be matched to the SQL expression corresponding to the name of the field triggering the activation of the access control rule.</param>
        protected void RegisterAccessControlRule(string fieldName, AccessPermission permission, params System.Object[] values)
        {
            if (!(_page.ContainsField(fieldName)))
                return;
            var a = CreateDynamicAccessControlAttribute(fieldName);
            a.Permission = permission;
            if (values == null)
                values = new object[] {
                        null};
            a.Restrictions = new List<object>(values);
        }

        /// <summary>
        /// Enumerates the list of all access control rules that must be activated when processing the current request.
        /// </summary>
        /// <param name="controllerName">The name of the data controller that is requiring processing via the business rules.</param>
        protected virtual void EnumerateDynamicAccessControlRules(string controllerName)
        {
            // perform static access check and create "always false" data access control rule if permission to read is not granted.
            if (!(IsSystemController(controllerName)))
            {
                var acl = AccessControlList.Current;
                if (acl.Enabled)
                {
                    // deny access to data if "read" permission is not granted
                    if (!(acl.PermissionGranted(PermissionKind.Controller, controllerName, "read")))
                    {
                        DataField triggerField = null;
                        if (Page.Fields.Count > 0)
                            triggerField = Page.Fields[0];
                        foreach (var field in Page.Fields)
                            if (field.IsPrimaryKey)
                            {
                                triggerField = field;
                                break;
                            }
                        RegisterAccessControlRule(triggerField.Name, "1=0", AccessPermission.Allow);
                    }
                    // register custom access rules
                    foreach (var ap in acl.AccessRules)
                        if (acl.PermissionGranted(ap.Key))
                        {
                            if (!(string.IsNullOrEmpty(ap.Value.Allow)))
                                RegisterAccessControlRule(ap.Value.ParameterName, ap.Value.Allow, AccessPermission.Allow);
                        }
                        else
                        {
                            if (!(string.IsNullOrEmpty(ap.Value.Deny)))
                                RegisterAccessControlRule(ap.Value.ParameterName, ap.Value.Deny, AccessPermission.Allow);
                        }
                }
            }
        }

        protected virtual DynamicAccessControlList CreateAppDacl(string controllerName)
        {
            var dacl = ((DynamicAccessControlList)(Context.Cache["DynamicAccessControlList"]));
            if (dacl == null)
            {
                var rulesPath = Context.Server.MapPath("~/dacl");
                dacl = new DynamicAccessControlList();
                string[] files = null;
                if (Directory.Exists(rulesPath))
                {
                    files = Directory.GetFiles(rulesPath, "*.txt");
                    foreach (var fileName in files)
                        dacl.Parse(Path.GetFileName(fileName), File.ReadAllText(fileName));
                }
                else
                    files = new string[] {
                            rulesPath};
                Context.Cache.Add("DynamicAccessControlList", dacl, new CacheDependency(files), Cache.NoAbsoluteExpiration, Cache.NoSlidingExpiration, CacheItemPriority.Normal, null);
            }
            return dacl;
        }

        protected virtual DynamicAccessControlList CreateDbDacl(string controllerName)
        {
            var dacl = ((DynamicAccessControlList)(Context.Items["DbDacl"]));
            if (dacl == null)
            {
                dacl = new DynamicAccessControlList();
                Context.Items["DbDacl"] = dacl;
                if (ApplicationServices.IsSiteContentEnabled)
                {
                    var files = ApplicationServices.Current.ReadSiteContent("sys/dacl%", "%");
                    foreach (var f in files)
                        if (f.Data != null)
                            dacl.Parse(f.PhysicalName, f.Text);
                }
            }
            return dacl;
        }

        protected virtual void EnumerateRulesFromDACL(string controllerName)
        {
            if (ApplicationServices.IsSafeMode)
                return;
            var fields = new SortedDictionary<string, DataField>();
            foreach (var field in _page.Fields)
                fields[field.Name] = field;
            // create DACL
            var dacl = new DynamicAccessControlList();
            dacl.AddRange(CreateAppDacl(controllerName));
            dacl.AddRange(CreateDbDacl(controllerName));
            // evaluate rules for this user
            var userName = string.Empty;
            if (Context.User != null)
                userName = Context.User.Identity.Name.ToLower();
            foreach (var r in dacl)
                if (fields.ContainsKey(r.Field))
                {
                    if (string.IsNullOrEmpty(r.Controller) || r.Controller.Equals(controllerName, StringComparison.OrdinalIgnoreCase))
                    {
                        if ((r.Tags == null) || IsTagged(r.Tags))
                        {
                            if ((r.Users == null) || !((Array.IndexOf(r.Users, userName) == -1)))
                            {
                                if ((r.Roles == null) || UserIsInRole(r.Roles))
                                {
                                    if ((r.RoleExceptions == null) || !(UserIsInRole(r.RoleExceptions)))
                                    {
                                        if ((r.UserExceptions == null) || (Array.IndexOf(r.UserExceptions, userName) == -1))
                                        {
                                            if (!(string.IsNullOrEmpty(r.AllowSql)))
                                                RegisterAccessControlRule(r.Field, r.AllowSql, AccessPermission.Allow);
                                            if (!(string.IsNullOrEmpty(r.DenySql)))
                                                RegisterAccessControlRule(r.Field, r.DenySql, AccessPermission.Deny);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
        }

        public string EnumerateAccessControlRules(DbCommand command, string controllerName, string parameterMarker, ViewPage page, SelectClauseDictionary expressions)
        {
            AccessControlRuleDictionary rules = null;
            foreach (var m in GetType().GetMethods((BindingFlags.Public | (BindingFlags.NonPublic | BindingFlags.Instance))))
                foreach (AccessControlAttribute accessControl in m.GetCustomAttributes(typeof(AccessControlAttribute), true))
                    if (((controllerName == accessControl.Controller) || Regex.IsMatch(controllerName, accessControl.Controller)) || string.IsNullOrEmpty(accessControl.Controller))
                    {
                        if (page.ContainsField(accessControl.FieldName))
                        {
                            if (rules == null)
                                rules = new AccessControlRuleDictionary();
                            List<AccessControlRule> attributes = null;
                            if (!(rules.TryGetValue(accessControl.FieldName, out attributes)))
                            {
                                attributes = new List<AccessControlRule>();
                                rules.Add(accessControl.FieldName, attributes);
                            }
                            attributes.Add(new AccessControlRule(accessControl, m));
                        }
                    }
            this._page = page;
            if (ApplicationServicesBase.Create().Supports(ApplicationFeature.DynamicAccessControlList))
                EnumerateRulesFromDACL(controllerName);
            EnumerateDynamicAccessControlRules(controllerName);
            if (_dynamicAccessControlRules != null)
            {
                if (rules == null)
                    rules = _dynamicAccessControlRules;
                else
                    foreach (var fieldName in _dynamicAccessControlRules.Keys)
                        if (page.ContainsField(fieldName))
                        {
                            List<AccessControlRule> attributes = null;
                            if (!(rules.TryGetValue(fieldName, out attributes)))
                            {
                                attributes = new List<AccessControlRule>();
                                rules.Add(fieldName, attributes);
                            }
                            attributes.AddRange(_dynamicAccessControlRules[fieldName]);
                        }
                _dynamicAccessControlRules = null;
            }
            if (rules == null)
                return null;
            var allowRules = new StringBuilder();
            ProcessAccessControlList(rules, AccessPermission.Allow, allowRules, command, parameterMarker, page, expressions);
            var denyRules = new StringBuilder();
            ProcessAccessControlList(rules, AccessPermission.Deny, denyRules, command, parameterMarker, page, expressions);
            rules.Clear();
            if (allowRules.Length == 0)
            {
                if (denyRules.Length == 0)
                    return string.Empty;
                else
                    return string.Format("not({0})", denyRules.ToString());
            }
            else
            {
                if (denyRules.Length == 0)
                    return allowRules.ToString();
                else
                    return string.Format("({0})and not({1})", allowRules.ToString(), denyRules.ToString());
            }
        }

        protected string ValidateSql(string sql, SelectClauseDictionary expressions)
        {
            if (string.IsNullOrEmpty(sql))
                return null;
            _expressions = expressions;
            _sqlIsValid = true;
            sql = FieldNameRegex.Replace(sql, DoReplaceFieldNames);
            if (!_sqlIsValid)
                return null;
            return sql;
        }

        private string DoReplaceFieldNames(Match m)
        {
            string s = null;
            if (_expressions.TryGetValue(m.Groups[1].Value, out s))
                return s;
            else
                _sqlIsValid = false;
            return m.Value;
        }

        private void ProcessAccessControlList(AccessControlRuleDictionary rules, AccessPermission permission, StringBuilder sb, DbCommand command, string parameterMarker, ViewPage page, SelectClauseDictionary expressions)
        {
            var firstField = true;
            foreach (var fieldName in rules.Keys)
            {
                var fieldExpression = expressions[page.FindField(fieldName).ExpressionName()];
                var accessControlList = rules[fieldName];
                var firstRule = true;
                foreach (var info in accessControlList)
                    if (info.AccessControl.Permission == permission)
                    {
                        this._applyAccessControlRule = false;
                        this._accessControlRestrictions = new List<object>();
                        this._accessControlCommand = command;
                        if (info.Method == null)
                        {
                            if (info.AccessControl.Restrictions != null)
                                _accessControlRestrictions.AddRange(info.AccessControl.Restrictions);
                            else
                            {
                                if (info.AccessControl.Parameters != null)
                                    foreach (var p in info.AccessControl.Parameters)
                                        RestrictAccess(p.Name, p.Value);
                            }
                            _applyAccessControlRule = true;
                        }
                        else
                            info.Method.Invoke(this, new object[0]);
                        var sql = ValidateSql(info.AccessControl.Sql, expressions);
                        if (this._applyAccessControlRule && ((_accessControlRestrictions.Count > 0) || !(string.IsNullOrEmpty(sql))))
                        {
                            if (firstField)
                            {
                                firstField = false;
                                sb.Append("(");
                            }
                            else
                            {
                                if (firstRule)
                                    sb.Append("and");
                            }
                            if (firstRule)
                            {
                                firstRule = false;
                                sb.Append("(");
                            }
                            else
                                sb.Append("or");
                            sb.Append("(");
                            if (!(string.IsNullOrEmpty(sql)))
                            {
                                if (SelectDetectionRegex.IsMatch(sql))
                                    sb.AppendFormat("{0} in({1})", fieldExpression, sql);
                                else
                                    sb.Append(sql);
                            }
                            else
                            {
                                if (_accessControlRestrictions.Count > 1)
                                {
                                    var hasNull = false;
                                    var firstRestriction = true;
                                    foreach (var item in _accessControlRestrictions)
                                        if ((item == null) || DBNull.Value.Equals(item))
                                            hasNull = true;
                                        else
                                        {
                                            if (firstRestriction)
                                            {
                                                firstRestriction = false;
                                                sb.AppendFormat("{0} in(", fieldExpression);
                                            }
                                            else
                                                sb.Append(",");
                                            var p = command.CreateParameter();
                                            p.ParameterName = string.Format("{0}p{1}", parameterMarker, command.Parameters.Count);
                                            p.Value = item;
                                            command.Parameters.Add(p);
                                            sb.Append(p.ParameterName);
                                        }
                                    if (!firstRestriction)
                                        sb.Append(")");
                                    if (hasNull)
                                    {
                                        if (!firstRestriction)
                                            sb.AppendFormat("or {0}", fieldExpression);
                                        else
                                            sb.Append(fieldExpression);
                                        sb.Append(" is null");
                                    }
                                }
                                else
                                {
                                    var item = _accessControlRestrictions[0];
                                    if ((item == null) || DBNull.Value.Equals(item))
                                        sb.AppendFormat("{0} is null", fieldExpression);
                                    else
                                    {
                                        var p = command.CreateParameter();
                                        p.ParameterName = string.Format("{0}p{1}", parameterMarker, command.Parameters.Count);
                                        p.Value = item;
                                        command.Parameters.Add(p);
                                        sb.AppendFormat("{0}={1}", fieldExpression, p.ParameterName);
                                    }
                                }
                            }
                            sb.Append(")");
                        }
                        _accessControlCommand = null;
                        _accessControlRestrictions.Clear();
                    }
                if (!firstRule)
                    sb.Append(")");
            }
            if (!firstField)
                sb.Append(")");
        }

        public virtual bool SupportsVirtualization(string controllerName)
        {
            if (!(IsSystemController(controllerName)) && AccessControlList.Current.Enabled)
                return true;
            return ApplicationServices.IsSiteContentEnabled;
        }

        protected virtual void VirtualizeController(string controllerName)
        {
            // remove corresponding actions if persmissions (create|update|delete) are not not granted
            if (!(IsSystemController(controllerName)))
            {
                var acl = AccessControlList.Current;
                if (acl.Enabled)
                {
                    if (!(acl.PermissionGranted(PermissionKind.Controller, controllerName, "create")))
                        NodeSet().SelectActions("New", "Duplicate", "Insert", "Import").Delete();
                    if (!(acl.PermissionGranted(PermissionKind.Controller, controllerName, "update")))
                        NodeSet().SelectActions("Edit", "Update", "BatchEdit").Delete();
                    if (!(acl.PermissionGranted(PermissionKind.Controller, controllerName, "delete")))
                        NodeSet().SelectActions("Delete").Delete();
                    // prevent "create new" for lookups based on data controllers
                    var lookupIterator = Navigator.Select("/c:dataController/c:fields/c:field/c:items[@dataController!=\'\']", Resolver);
                    while (lookupIterator.MoveNext())
                    {
                        var lookupController = lookupIterator.Current.GetAttribute("dataController", string.Empty);
                        var newDataView = lookupIterator.Current.SelectSingleNode("@newDataView", Resolver);
                        if (((newDataView != null) && !(string.IsNullOrEmpty(newDataView.Value))) && !(acl.PermissionGranted(PermissionKind.Controller, "create")))
                            newDataView.SetValue(string.Empty);
                    }
                    //  apply custom permissions
                    foreach (var alteration in acl.Alterations)
                        if (alteration.Value.IsMatch(controllerName))
                        {
                            if (acl.PermissionGranted(alteration.Key))
                            {
                                if (!(string.IsNullOrEmpty(alteration.Value.Allow)))
                                    AlterControllerWith(alteration.Value.Allow);
                            }
                            else
                            {
                                if (!(string.IsNullOrEmpty(alteration.Value.Deny)))
                                    AlterControllerWith(alteration.Value.Deny);
                            }
                        }
                }
            }
        }

        public virtual bool VirtualizeControllerConditionally(string controllerName)
        {
            return false;
        }

        public virtual void VirtualizeController(string controllerName, XPathNavigator navigator, XmlNamespaceManager resolver)
        {
            this.Navigator = navigator;
            this.Resolver = resolver;
            AlterController(controllerName);
            VirtualizeController(controllerName);
        }

        public virtual bool CompleteConfiguration()
        {
            var result = false;
            var saveRow = _row;
            if (Page.NewRow != null)
                _row = Page.NewRow;
            else
            {
                if ((Page.Rows != null) && (Page.Rows.Count > 0))
                    _row = Page.Rows[0];
            }
            if (VirtualizeControllerConditionally(Page.Controller))
                result = true;
            if (Config.PendingAlterations != null)
                result = AlterController(Config.PendingAlterations, true);
            _row = saveRow;
            return result;
        }

        public virtual void AlterController(string controllerName)
        {
            if (ApplicationServices.IsSiteContentEnabled && (controllerName != ApplicationServices.SiteContentControllerName && ApplicationServices.Create().Supports(ApplicationFeature.DynamicControllerCustomization)))
            {
                var alterations = ApplicationServices.Current.ReadSiteContent("sys/controllers%", (controllerName + ".Alter%"));
                AlterController(alterations, false);
                var rules = ApplicationServices.Current.ReadSiteContent(("sys/rules/" + controllerName), "%");
                foreach (var r in rules)
                    AddBusinessRule(r.Text);
            }
        }

        public virtual bool AlterController(SiteContentFileList alterations, bool immediately)
        {
            var changed = false;
            foreach (var f in alterations)
            {
                var alter = f.Text;
                if (!(string.IsNullOrEmpty(alter)))
                {
                    if (!immediately && TestPendingAlterRegex.IsMatch(alter))
                    {
                        if (PendingAlterations == null)
                            PendingAlterations = new SiteContentFileList();
                        PendingAlterations.Add(f);
                    }
                    else
                    {
                        if (AlterControllerWith(alter))
                            changed = true;
                    }
                }
            }
            return changed;
        }

        public virtual void AddBusinessRule(string rule)
        {
            if (string.IsNullOrEmpty(rule))
                return;
            try
            {
                var json = JObject.Parse(rule);
                NodeSet().CreateBusinessRule(((string)(json["type"])), ((string)(json["phase"])), ((string)(json["command"])), ((string)(json["argument"])), string.Empty, ((string)(json["script"])));
            }
            catch (Exception)
            {
            }
        }

        public virtual bool AlterControllerWith(string alter)
        {
            var changed = false;
            var nodeSet = this.NodeSet();
            var m = AlterMethodRegex.Match(alter);
            var skipInvoke = false;
            while (m.Success)
            {
                var method = m.Groups["Method"].Value;
                var parameters = m.Groups["Parameters"].Value;
                var terminator = m.Groups["Terminator"].Value;
                var sb = new StringBuilder();
                foreach (var s in method.Split(new char[] {
                            '-'}, StringSplitOptions.RemoveEmptyEntries))
                    sb.Append((Char.ToUpper(s[0]) + s.Substring(1)));
                method = sb.ToString();
                var args = new List<string>();
                var p = AlterParametersRegex.Match(parameters);
                while (p.Success)
                {
                    args.Add(p.Groups["Argument"].Value);
                    p = p.NextMatch();
                }
                try
                {
                    var tested = false;
                    if (args.Count > 0)
                    {
                        if (method == "WhenTagged")
                        {
                            if (!(IsTagged(args.ToArray())))
                            {
                                skipInvoke = true;
                                if (terminator == ";")
                                    break;
                            }
                            tested = true;
                        }
                        if (method == "WhenUrl")
                        {
                            var urlRegex = new Regex(args[0], RegexOptions.IgnoreCase);
                            if ((Context.Request.UrlReferrer != null) && !(urlRegex.IsMatch(Context.Request.UrlReferrer.ToString())))
                            {
                                skipInvoke = true;
                                if (terminator == ";")
                                    break;
                            }
                            tested = true;
                        }
                        if (method == "WhenUserInterface")
                        {
                            var userInterface = args[0].ToLower();
                            if (((userInterface == "touch") && !ApplicationServices.IsTouchClient) || ((userInterface == "desktop") && ApplicationServices.IsTouchClient))
                            {
                                skipInvoke = true;
                                if (terminator == ";")
                                    break;
                            }
                            tested = true;
                        }
                        if (method == "WhenView")
                        {
                            if (!skipInvoke)
                            {
                                var viewRegex = new Regex(args[0], RegexOptions.IgnoreCase);
                                if ((this.View == null) || !(viewRegex.IsMatch(this.View)))
                                {
                                    skipInvoke = true;
                                    if (terminator == ";")
                                        break;
                                }
                            }
                            tested = true;
                        }
                        if (method == "WhenTest")
                        {
                            if (!skipInvoke)
                            {
                                var dt = Page.ToDataTable();
                                dt.DefaultView.RowFilter = args[0].Trim();
                                if (dt.DefaultView.Count == 0)
                                {
                                    skipInvoke = true;
                                    if (terminator == ";")
                                        break;
                                }
                            }
                            tested = true;
                        }
                        if (method == "WhenSql")
                        {
                            if (!skipInvoke)
                            {
                                var q = args[0].Trim();
                                var sqlText = "select 1";
                                var css = ConnectionStringSettingsFactory.Create(null);
                                if (css.ProviderName.Contains("Oracle"))
                                    sqlText = (sqlText + " from dual");
                                sqlText = (sqlText
                                            + (" where " + q));
                                EnableDccTest = true;
                                skipInvoke = (Sql(sqlText) == 0);
                                EnableDccTest = false;
                                if (skipInvoke)
                                {
                                    if (terminator == ";")
                                        break;
                                }
                            }
                            tested = true;
                        }
                    }
                    if (!skipInvoke && !tested)
                    {
                        nodeSet = ((ControllerNodeSet)(nodeSet.GetType().InvokeMember(method, BindingFlags.InvokeMethod, null, nodeSet, args.ToArray())));
                        changed = true;
                    }
                }
                catch (Exception ex)
                {
                    throw new Exception(string.Format("{0}){1}: {2}", method, parameters, ex.Message));
                }
                m = m.NextMatch();
                if (terminator == ";")
                {
                    nodeSet = this.NodeSet();
                    skipInvoke = false;
                }
            }
            return changed;
        }

        /// <summary>
        /// Returns true if the data view on the page is tagged with any of the values specified in the arguments.
        /// </summary>
        /// <param name="tags">The collection of string values representing tag names.</param>
        /// <returns>Returns true if at least one tag specified in the arguments is assigned to the data view.</returns>
        protected bool IsTagged(params System.String[] tags)
        {
            var list = TagList;
            foreach (var t in tags)
                if (Array.IndexOf(list, t) >= 0)
                    return true;
            return false;
        }

        protected void AddTag(params System.String[] tags)
        {
            var list = new List<string>(TagList);
            foreach (var t in tags)
                if (!(list.Contains(t)))
                    list.Add(t);
            TagList = list.ToArray();
        }

        protected void RemoveTag(params System.String[] tags)
        {
            var list = new List<string>(TagList);
            foreach (var t in tags)
                list.Remove(t);
            TagList = list.ToArray();
        }

        protected void AddFieldValue(FieldValue v)
        {
            if (Arguments != null)
            {
                var values = new List<FieldValue>(Arguments.Values);
                values.Add(v);
                Arguments.Values = values.ToArray();
            }
        }

        protected void AddFieldValue(string name, object newValue)
        {
            AddFieldValue(new FieldValue(name, newValue));
        }

        public void BeforeSelect(DistinctValueRequest request)
        {
            ExecuteServerRules(request, ActionPhase.Before);
            ExecuteSelect(request.Controller, request.View, request.Filter, request.ExternalFilter, ActionPhase.Before, "SelectDistinct");
        }

        public void AfterSelect(DistinctValueRequest request)
        {
            ExecuteServerRules(request, ActionPhase.Before);
            ExecuteSelect(request.Controller, request.View, request.Filter, request.ExternalFilter, ActionPhase.After, "SelectDistinct");
        }

        public void BeforeSelect(PageRequest request)
        {
            ExecuteServerRules(request, ActionPhase.Before);
            ExecuteSelect(request.Controller, request.View, request.Filter, request.ExternalFilter, ActionPhase.Before, "Select");
        }

        public void AfterSelect(PageRequest request)
        {
            ExecuteServerRules(request, ActionPhase.After);
            ExecuteSelect(request.Controller, request.View, request.Filter, request.ExternalFilter, ActionPhase.After, "Select");
        }

        public bool IsFiltered(string fieldName, params RowFilterOperation[] operations)
        {
            var fvo = SelectFilterValue(fieldName);
            if (fvo != null)
                foreach (var op in operations)
                    if (fvo.FilterOperation == op)
                        return true;
            return (fvo != null);
        }

        public FilterValue SelectFilterValue(string fieldName)
        {
            FilterValue fvo = null;
            var filters = _requestFilter;
            if ((filters == null) || (filters.Length == 0))
                filters = Result.Filter;
            if (filters != null)
                foreach (var filterExpression in filters)
                {
                    var filterMatch = Controller.FilterExpressionRegex.Match(filterExpression);
                    if (filterMatch.Success)
                    {
                        var valueMatch = Controller.FilterValueRegex.Match(filterMatch.Groups["Values"].Value);
                        var fieldAlias = filterMatch.Groups["Alias"].Value;
                        var operation = valueMatch.Groups["Operation"].Value;
                        if (valueMatch.Success && (fieldAlias.Equals(fieldName, StringComparison.InvariantCultureIgnoreCase) && !((operation == "~"))))
                        {
                            var filterValue = valueMatch.Groups["Value"].Value;
                            object v = null;
                            if (!(Controller.StringIsNull(filterValue)))
                            {
                                if (Regex.IsMatch(filterValue, "\\$(or|and)\\$"))
                                {
                                    var list = filterValue.Split(new string[] {
                                                "$or$",
                                                "$and$"}, StringSplitOptions.RemoveEmptyEntries);
                                    var values = new List<object>();
                                    foreach (var s in list)
                                        if (Controller.StringIsNull(s))
                                            values.Add(null);
                                        else
                                            values.Add(Controller.StringToValue(s));
                                    v = values.ToArray();
                                }
                                else
                                    v = Controller.StringToValue(filterValue);
                            }
                            fvo = new FilterValue(fieldAlias, operation, v);
                            break;
                        }
                    }
                }
            if ((fvo == null) && (_requestExternalFilter != null))
                foreach (var v in _requestExternalFilter)
                    if (v.Name.Equals(fieldName, StringComparison.InvariantCultureIgnoreCase))
                    {
                        fvo = new FilterValue(fieldName, "=", v.Value);
                        break;
                    }
            return fvo;
        }

        private void ExecuteSelect(string controllerName, string viewId, string[] filter, FieldValue[] externalFilter, ActionPhase phase, string commandName)
        {
            this._requestFilter = filter;
            this._requestExternalFilter = externalFilter;
            var methods = GetType().GetMethods((BindingFlags.Public | (BindingFlags.NonPublic | BindingFlags.Instance)));
            foreach (var method in methods)
            {
                var filters = method.GetCustomAttributes(typeof(ControllerActionAttribute), true);
                foreach (ControllerActionAttribute action in filters)
                    if ((string.IsNullOrEmpty(action.Controller) || ((action.Controller == controllerName) || Regex.IsMatch(controllerName, action.Controller))) && (string.IsNullOrEmpty(action.View) || ((action.View == viewId) || Regex.IsMatch(viewId, action.View))))
                    {
                        if ((action.CommandName == commandName) && (action.Phase == phase))
                        {
                            var parameters = method.GetParameters();
                            var arguments = new object[parameters.Length];
                            for (var i = 0; (i < parameters.Length); i++)
                            {
                                var p = parameters[i];
                                var fvo = SelectFilterValue(p.Name);
                                if (fvo != null)
                                {
                                    if (p.ParameterType.Equals(typeof(FilterValue)))
                                        arguments[i] = fvo;
                                    else
                                        try
                                        {
                                            if (p.ParameterType.IsArray)
                                            {
                                                var list = new ArrayList();
                                                foreach (var o in fvo.Values)
                                                {
                                                    object elemValue = null;
                                                    try
                                                    {
                                                        elemValue = Controller.ConvertToType(p.ParameterType.GetElementType(), o);
                                                    }
                                                    catch (Exception)
                                                    {
                                                    }
                                                    list.Add(elemValue);
                                                }
                                                arguments[i] = list.ToArray(p.ParameterType.GetElementType());
                                            }
                                            else
                                                arguments[i] = Controller.ConvertToType(p.ParameterType, fvo.Value);
                                        }
                                        catch (Exception)
                                        {
                                        }
                                }
                            }
                            method.Invoke(this, arguments);
                        }
                    }
            }
        }

        protected void ChangeFilter(params FilterValue[] filter)
        {
            ApplyFilter(false, filter);
        }

        protected void AssignFilter(params FilterValue[] filter)
        {
            ApplyFilter(true, filter);
        }

        private void ApplyFilter(bool replace, params FilterValue[] filter)
        {
            var newFilter = new List<string>();
            if (!replace)
            {
                var currentFilter = new List<string>();
                if ((Page != null) && (Page.Filter != null))
                    currentFilter.AddRange(Page.Filter);
                else
                {
                    if ((Result != null) && (Result.Filter != null))
                        currentFilter.AddRange(Result.Filter);
                }
                foreach (var fvo in filter)
                {
                    var i = 0;
                    while (i < currentFilter.Count)
                        if (currentFilter[i].StartsWith((fvo.Name + ":")))
                        {
                            currentFilter.RemoveAt(i);
                            break;
                        }
                        else
                            i++;
                    newFilter = new List<string>(currentFilter);
                }
            }
            foreach (var fvo in filter)
            {
                var filterValue = "%js%null";
                if (!(DBNull.Value.Equals(fvo.Value)))
                {
                    var sb = new StringBuilder();
                    var separator = "$or$";
                    if (fvo.FilterOperation == RowFilterOperation.Between)
                        separator = "$and$";
                    foreach (var o in fvo.Values)
                    {
                        if (sb.Length > 0)
                            sb.Append(separator);
                        sb.Append(Controller.ValueToString(o));
                    }
                    filterValue = sb.ToString();
                }
                newFilter.Add(string.Format("{0}:{1}{2}", fvo.Name, RowFilterAttribute.ComparisonOperations[((int)(fvo.FilterOperation))], filterValue));
            }
            if (_requestExternalFilter != null)
                foreach (var v in _requestExternalFilter)
                    newFilter.Add(string.Format("{0}:={1}", v.Name, Controller.ValueToString(v.Value)));
            if (Page != null)
            {
                Page.ChangeFilter(newFilter.ToArray());
                _requestFilter = Page.Filter;
            }
            if (Result != null)
                Result.Filter = newFilter.ToArray();
        }

        public static BusinessRules Create(ControllerConfiguration config)
        {
            var t = typeof(BusinessRules);
            var rules = ((BusinessRules)(t.Assembly.CreateInstance(t.FullName)));
            rules.Config = config;
            return rules;
        }

        protected virtual bool ResolveFieldValuesForMultipleSelection(ActionArgs args)
        {
            return !(Regex.IsMatch(args.CommandName, "^(Report|Export)"));
        }

        public void ProcessSpecialActions(ActionArgs args, ActionResult result)
        {
            this.Arguments = args;
            this.Result = result;
            var multipleSelection = (args.SelectedValues.Length > 1);
            List<DataField> fields = null;
            if (multipleSelection && !(((args.LastCommandName == "Edit") || (args.LastCommandName == "New"))))
            {
                var keyFields = new List<string>();
                var keyFieldIterator = Config.Select("/c:dataController/c:fields/c:field[@isPrimaryKey=\'true\']/@name");
                while (keyFieldIterator.MoveNext())
                    keyFields.Add(keyFieldIterator.Current.Value);
                foreach (var key in args.SelectedValues)
                {
                    ClearBlackAndWhiteLists();
                    var keyValues = key.Split(',');
                    var filter = new List<string>();
                    var index = 0;
                    foreach (var fieldName in keyFields)
                    {
                        var fvo = SelectFieldValueObject(fieldName);
                        if (fvo != null)
                        {
                            fvo.NewValue = keyValues[index];
                            fvo.OldValue = fvo.NewValue;
                            fvo.Modified = false;
                            filter.Add(string.Format("{0}:={1}", fieldName, DataControllerBase.ValueToString(fvo.Value)));
                        }
                        index++;
                    }
                    if (multipleSelection && ResolveFieldValuesForMultipleSelection(args))
                    {
                        var r = new PageRequest(0, 1, string.Empty, filter.ToArray())
                        {
                            Controller = args.Controller,
                            View = args.View,
                            Tag = args.Tag,
                            RequiresMetaData = (fields == null),
                            DisableJSONCompatibility = true
                        };
                        var p = ControllerFactory.CreateDataController().GetPage(r.Controller, r.View, r);
                        if (fields == null)
                            fields = p.Fields;
                        if (p.Rows.Count == 1)
                            for (var i = 0; (i < fields.Count); i++)
                            {
                                var f = fields[i];
                                if (!f.IsPrimaryKey)
                                {
                                    var fvo = SelectFieldValueObject(f.Name);
                                    if (fvo != null)
                                    {
                                        fvo.NewValue = p.Rows[0][i];
                                        fvo.OldValue = fvo.NewValue;
                                        fvo.Modified = false;
                                    }
                                }
                            }
                    }
                    ProcessSpecialActions(args);
                    if (result.CanceledSelectedValues)
                        break;
                }
            }
            else
                ProcessSpecialActions(args);
        }

        protected virtual void ProcessSpecialActions(ActionArgs args)
        {
            if (args.IgnoreBusinessRules)
                return;
            AutoFill.Evaluate(this);
            ExecuteServerRules(args, Result, ActionPhase.Before);
            if (!Result.Canceled)
            {
                if (!(string.IsNullOrEmpty(ActionData)))
                {
                    if (args.CommandName == "SQL")
                        Sql(ActionData);
                    if (args.CommandName == "Email")
                        Email(ActionData);
                }
                ExecuteServerRules(args, Result, ActionPhase.After);
            }
        }

        /// <summary>
        /// Executes the SQL statements specified in the 'text' argument. Any parameter referenced in the text is provided with a value if the parameter name is matched to the name of a data field.
        /// </summary>
        /// <param name="text">The text composed of valid SQL statements.
        /// Parameter names can reference data fields as @FieldName, @FieldName_Value, @FieldName_OldValue, and @FieldName_NewValue.
        /// Use the parameter marker supported by the database server.</param>
        /// <param name="parameters">Optional list of parameter values used if a matching data field is not found.</param>
        /// <returns>The number of records affected by execute of SQL statements</returns>
        protected int Sql(string text, params ParameterValue[] parameters)
        {
            return Sql(text, Config.ConnectionStringName, parameters);
        }

        protected virtual void CreateSqlParameter(SqlText query, string parameterName, object parameterValue, string fieldType, string fieldLen)
        {
            var p = query.AddParameter(parameterName, parameterValue);
            if (!(string.IsNullOrEmpty(fieldType)))
            {
                p.Direction = ParameterDirection.InputOutput;
                DataControllerBase.AssignParameterValue(p, fieldType, parameterValue);
                if (!(string.IsNullOrEmpty(fieldLen)))
                    p.Size = Convert.ToInt32(fieldLen);
                else
                {
                    if (fieldType == "String")
                        p.Direction = ParameterDirection.Input;
                    else
                    {
                        if (fieldType == "Decimal")
                        {
                            ((IDbDataParameter)(p)).Precision = 38;
                            ((IDbDataParameter)(p)).Scale = 10;
                        }
                    }
                }
            }
        }

        /// <summary>
        /// Executes the SQL statements specified in the 'text' argument. Any parameter referenced in the text is provided with a value if the parameter name is matched to the name of a data field.
        /// </summary>
        /// <param name="text">The text composed of valid SQL statements.
        /// Parameter names can reference data fields as @FieldName, @FieldName_Value, @FieldName_OldValue, and @FieldName_NewValue.
        /// Use the parameter marker supported by the database server.</param>
        /// <param name="connectionStringName">The name of the database connection string.</param>
        /// <param name="parameters">Optional list of parameter values used if a matching data field is not found.</param>
        /// <returns>The number of records affected by execute of SQL statements</returns>
        protected int Sql(string text, string connectionStringName, params ParameterValue[] parameters)
        {
            string resultSetCacheVar = null;
            if (EnableResultSet && (ResultSetCacheDuration > 0))
            {
                resultSetCacheVar = (("ResultSet_" + _page.Controller)
                            + ("_" + _page.View));
                ResultSet = ((DataTable)(HttpContext.Current.Cache[resultSetCacheVar]));
                if (ResultSet != null)
                    return 0;
            }
            text = Regex.Replace(text, "(^|\\n).*?Debug\\s+([\\s\\S]+?)End Debug(\\s+|$)", string.Empty, RegexOptions.IgnoreCase);
            var buildingRow = ((_page != null) && (_row != null));
            var names = new List<string>();
            using (var query = new SqlText(text, connectionStringName))
            {
                var paramRegex = new Regex(string.Format("({0}(?\'FieldName\'\\w+?)_(?\'ValueType\'OldValue|NewValue|Value|Modified|FilterValue\\" +
                            "d?|FilterOperation|Filter_\\w+))|({0}(?\'FieldName\'\\w+))", Regex.Escape(query.ParameterMarker)), RegexOptions.IgnoreCase);
                var m = paramRegex.Match(text);
                while (m.Success)
                {
                    var fieldName = m.Groups["FieldName"].Value;
                    var valueType = m.Groups["ValueType"].Value;
                    var paramName = m.Value;
                    if (!(names.Contains(paramName)))
                    {
                        names.Add(paramName);
                        string fieldType = null;
                        string fieldLen = null;
                        if (Config != null)
                        {
                            var fieldNav = Config.SelectSingleNode("/c:dataController/c:fields/c:field[@name=\'{0}\']", fieldName);
                            if (fieldNav != null)
                            {
                                fieldType = fieldNav.GetAttribute("type", string.Empty);
                                fieldLen = fieldNav.GetAttribute("length", string.Empty);
                            }
                        }
                        if (fieldName.StartsWith("Parameters_"))
                        {
                            object v = null;
                            var fvo = SelectFieldValueObject(paramName.Substring(1));
                            if (fvo != null)
                                v = fvo.Value;
                            else
                                fieldType = "String";
                            CreateSqlParameter(query, paramName, v, fieldType, null);
                        }
                        else
                        {
                            if (valueType.StartsWith("Filter") && !(string.IsNullOrEmpty(fieldType)))
                            {
                                object v = null;
                                var filter = SelectFilterValue(fieldName);
                                if (filter != null)
                                {
                                    if ((valueType == "FilterValue") || (valueType == "FilterValue1"))
                                        v = filter.Value;
                                    else
                                    {
                                        if ((valueType == "FilterValue2") && (filter.Values.Length > 1))
                                            v = filter.Values[1];
                                        else
                                        {
                                            if (valueType == "FilterOperation")
                                                v = Convert.ToString(filter.FilterOperation);
                                        }
                                    }
                                }
                                CreateSqlParameter(query, paramName, v, fieldType, fieldLen);
                            }
                            else
                            {
                                var fvo = SelectFieldValueObject(fieldName);
                                if (fvo != null)
                                {
                                    var v = fvo.Value;
                                    if (valueType == "OldValue")
                                        v = fvo.OldValue;
                                    else
                                    {
                                        if (valueType == "NewValue")
                                            v = fvo.NewValue;
                                        else
                                        {
                                            if (valueType == "Modified")
                                            {
                                                fieldType = "Boolean";
                                                fieldLen = null;
                                                v = fvo.Modified;
                                            }
                                        }
                                    }
                                    CreateSqlParameter(query, paramName, v, fieldType, fieldLen);
                                }
                                else
                                {
                                    if (fieldName.StartsWith("Context_"))
                                        CreateSqlParameter(query, paramName, null, fieldType, fieldLen);
                                    else
                                    {
                                        DataField field = null;
                                        if (buildingRow)
                                        {
                                            field = Page.FindField(fieldName);
                                            if (field != null)
                                                CreateSqlParameter(query, paramName, _row[Page.Fields.IndexOf(field)], fieldType, fieldLen);
                                        }
                                        if ((field == null) && !(IsSystemSqlParameter(query, paramName)))
                                            foreach (var pvo in parameters)
                                                if (pvo.Name.Equals(paramName))
                                                {
                                                    query.AddParameter(pvo.Name, pvo.Value).Direction = ParameterDirection.InputOutput;
                                                    break;
                                                }
                                    }
                                }
                            }
                        }
                    }
                    m = m.NextMatch();
                }
                ConfigureSqlQuery(query);
                if (EnableDccTest)
                {
                    if (query.Read())
                        return 1;
                    else
                        return 0;
                }
                else
                {
                    if (EnableResultSet)
                    {
                        ResultSet = new DataTable();
                        ResultSet.Load(query.ExecuteReader());
                        foreach (DataColumn c in ResultSet.Columns)
                        {
                            var columnName = c.ColumnName;
                            if (!(Char.IsLetter(columnName[0])))
                                columnName = ("n" + columnName);
                            columnName = Regex.Replace(columnName, "\\W", "");
                            c.ColumnName = columnName;
                        }
                        ResultSetSize = ResultSet.Rows.Count;
                        if (ResultSetCacheDuration > 0)
                            HttpContext.Current.Cache.Add(resultSetCacheVar, ResultSet.Copy(), null, DateTime.Now.AddSeconds(ResultSetCacheDuration), Cache.NoSlidingExpiration, System.Web.Caching.CacheItemPriority.Normal, null);
                        return 0;
                    }
                    else
                    {
                        if (EnableEmailMessages)
                        {
                            var messages = new DataTable();
                            messages.Load(query.ExecuteReader());
                            EmailMessages = messages;
                            return 0;
                        }
                        else
                        {
                            var rowsAffected = query.ExecuteNonQuery();
                            var clearedFilters = new List<string>();
                            foreach (DbParameter p in query.Parameters)
                            {
                                var fieldName = p.ParameterName.Substring(1);
                                var fm = SqlFieldFilterOperationRegex.Match(fieldName);
                                if (fm.Success)
                                {
                                    var name = fm.Groups["Name"].Value;
                                    var operation = fm.Groups["Operation"].Value;
                                    var value = p.Value;
                                    if (!(DBNull.Value.Equals(value)))
                                    {
                                        var filter = SelectFilterValue(name);
                                        if ("null".Equals(Convert.ToString(value), StringComparison.OrdinalIgnoreCase))
                                            value = null;
                                        if (filter != null)
                                        {
                                            if (!(clearedFilters.Contains(filter.Name)))
                                            {
                                                filter.Clear();
                                                clearedFilters.Add(filter.Name);
                                            }
                                            filter.AddValue(value);
                                        }
                                        else
                                        {
                                            filter = new FilterValue(name, ((RowFilterOperation)(TypeDescriptor.GetConverter(typeof(RowFilterOperation)).ConvertFromString(operation))), value);
                                            clearedFilters.Add(filter.Name);
                                        }
                                        ChangeFilter(filter);
                                    }
                                }
                                else
                                {
                                    if (fieldName.EndsWith("_Modified", StringComparison.OrdinalIgnoreCase))
                                    {
                                        fieldName = fieldName.Substring(0, (fieldName.Length - 9));
                                        var fvo = SelectFieldValueObject(fieldName);
                                        if (fvo != null)
                                            fvo.Modified = Convert.ToBoolean(p.Value);
                                    }
                                    else
                                    {
                                        var fvo = SelectFieldValueObject(fieldName);
                                        if ((fvo != null) && (Convert.ToString(fvo.Value) != Convert.ToString(p.Value)))
                                            UpdateFieldValue(fvo.Name, p.Value);
                                        DataField field = null;
                                        if (buildingRow)
                                        {
                                            field = Page.FindField(fieldName);
                                            if (field != null)
                                            {
                                                var v = p.Value;
                                                if (DBNull.Value.Equals(v))
                                                    v = null;
                                                _row[Page.Fields.IndexOf(field)] = v;
                                            }
                                        }
                                        if ((field == null) && !(ProcessSystemSqlParameter(query, p.ParameterName)))
                                            foreach (var pvo in parameters)
                                                if (pvo.Name.Equals(p.ParameterName, StringComparison.InvariantCultureIgnoreCase))
                                                    pvo.Value = p.Value;
                                    }
                                }
                            }
                            return rowsAffected;
                        }
                    }
                }
            }
        }

        /// <summary>
        /// Returns the maximum length of SQL Parameter
        /// </summary>
        /// <param name="parameterName">The name of SQL parameter without a leading "parameter marker" symbol.</param>
        /// <returns>The integer value representing the maximum size of SQL parameter.</returns>
        protected virtual int MaximumSizeOfSqlParameter(string parameterName)
        {
            if (parameterName.StartsWith("Result_"))
                return 512;
            return 255;
        }

        private bool IsSystemSqlProperty(string propertyName)
        {
            return SystemSqlPropertyRegex.IsMatch(propertyName);
        }

        /// <summary>
        /// Gets a property of a business rule class instance, session variable, or URL parameter.
        /// </summary>
        /// <param name="propertyName">The name of a business rule property, session variable, or URL parameter.</param>
        /// <returns>The value of the property.</returns>
        public virtual object GetProperty(string propertyName)
        {
            if (propertyName.StartsWith("Parameters_"))
                return SelectFieldValue(propertyName);
            if (propertyName.StartsWith("ContextFields_"))
                return SelectExternalFilterFieldValue(propertyName.Substring(14));
            if (propertyName.StartsWith("Url_"))
            {
                propertyName = propertyName.Substring(4);
                string query = null;
                if (Context.Request.UrlReferrer != null)
                    query = Context.Request.UrlReferrer.Query;
                if (string.IsNullOrEmpty(query))
                    query = Context.Request.Url.Query;
                if (!(string.IsNullOrEmpty(query)))
                {
                    var m = Regex.Match(query, string.Format("(\\?|&){0}=(?\'Value\'.*?)(&|$)", propertyName));
                    if (m.Success)
                        return m.Groups["Value"].Value;
                }
                return null;
            }
            else
            {
                if (propertyName.StartsWith("Session_"))
                {
                    propertyName = propertyName.Substring(8);
                    return Context.Session[propertyName];
                }
                else
                {
                    if (propertyName.StartsWith("Profile_"))
                    {
                        if (ApplicationServices.IsSiteContentEnabled)
                        {
                            propertyName = propertyName.Substring(8);
                            var profile = ((JObject)(HttpContext.Current.Items["profile"]));
                            if (profile == null)
                            {
                                profile = SiteContentFile.ReadJson((("sys/users/" + UserName)
                                                + ".json"));
                                HttpContext.Current.Items["profile"] = profile;
                            }
                            if (profile != null)
                                foreach (var kvp in profile)
                                    if (kvp.Key.Replace(':', '_') == propertyName)
                                        return kvp.Value.ToString();
                        }
                        return null;
                    }
                    else
                    {
                        var t = GetType();
                        object target = this;
                        if (propertyName.StartsWith("BusinessRules_"))
                            propertyName = propertyName.Substring(14);
                        else
                        {
                            if (propertyName.StartsWith("Arguments_"))
                            {
                                propertyName = propertyName.Substring(10);
                                t = typeof(ActionArgs);
                                target = this.Arguments;
                                if (target == null)
                                    return null;
                            }
                        }
                        return t.InvokeMember(propertyName, (((BindingFlags.GetProperty | BindingFlags.GetField) | BindingFlags.Public) | (((BindingFlags.Instance | BindingFlags.Static) | BindingFlags.FlattenHierarchy) | BindingFlags.IgnoreCase)), null, target, new object[0]);
                    }
                }
            }
        }

        /// <summary>
        /// Sets the property of the business rule class instance or the session variable value.
        /// </summary>
        /// <param name="propertyName">The name of the property or session variable.</param>
        /// <param name="value">The value of the property.</param>
        public virtual void SetProperty(string propertyName, object value)
        {
            if (propertyName.StartsWith("Url_"))
            {
                // URL properties are read-only.
                return;
            }
            else
            {
                if (propertyName.StartsWith("Session_") || propertyName.StartsWith("Arguments_"))
                {
                    propertyName = propertyName.Substring(8);
                    if (value is string)
                    {
                        var s = ((string)(value));
                        Guid tempGuid;
                        if (Guid.TryParse(s, out tempGuid))
                            value = tempGuid;
                        else
                        {
                            int tempInt;
                            if (int.TryParse(s, out tempInt))
                                value = tempInt;
                            else
                            {
                                double tempDouble;
                                if (double.TryParse(s, out tempDouble))
                                    value = tempDouble;
                                else
                                {
                                    System.DateTime tempDateTime;
                                    if (DateTime.TryParse(s, out tempDateTime))
                                        value = tempDateTime;
                                }
                            }
                        }
                    }
                    Context.Session[propertyName] = value;
                }
                else
                {
                    if (propertyName.StartsWith("BusinessRules_"))
                        propertyName = propertyName.Substring(14);
                    GetType().InvokeMember(propertyName, (((BindingFlags.SetProperty | BindingFlags.SetField) | BindingFlags.Public) | (((BindingFlags.Instance | BindingFlags.Static) | BindingFlags.FlattenHierarchy) | BindingFlags.IgnoreCase)), null, this, new object[] {
                                value});
                }
            }
        }

        protected static string ToNameWithoutDbType(string name)
        {
            var type = DbType.String;
            return ToNameWithoutDbType(name, out type);
        }

        protected static string ToNameWithoutDbType(string name, out DbType type)
        {
            type = DbType.String;
            var m = Regex.Match(name, "^(.+)_As(AnsiString|Binary|Byte|Boolean|Currency|Date|DateTime|Decimal|Double|Gui" +
                    "d|Int16|Int32|Int64|Object|SByte|Single|Time|UInt16|UInt32|UInt64|VarNumeric|Ans" +
                    "iStringFixedLength|StringFixedLength|StringFixedLength|Xml|DateTime2|DateTimeOff" +
                    "set)$", RegexOptions.IgnoreCase);
            if (m.Success)
            {
                type = ((DbType)(TypeDescriptor.GetConverter(typeof(DbType)).ConvertFromString(m.Groups[2].Value)));
                name = m.Groups[1].Value;
            }
            return name;
        }

        protected virtual bool IsSystemSqlParameter(SqlText sql, string parameterName)
        {
            var nameWithoutMarker = parameterName.Substring(1);
            var isProperty = IsSystemSqlProperty(nameWithoutMarker);
            var testName = nameWithoutMarker;
            var inputOutputDbType = DbType.Int32;
            if (testName.StartsWith("Result_Master_"))
            {
                testName = "Result_Master";
                ToNameWithoutDbType(nameWithoutMarker, out inputOutputDbType);
            }
            var systemParameterIndex = Array.IndexOf(SystemSqlParameters, testName);
            if ((systemParameterIndex == -1) && !isProperty)
                return false;
            // system bool parameters between BusinessRules_PreventDefault and Result_KeepSelection
            if ((systemParameterIndex >= 0) && (systemParameterIndex <= 6))
            {
                object v = null;
                if (inputOutputDbType == DbType.Int32)
                    v = 0;
                var p = sql.AddParameter(parameterName, v);
                p.Direction = ParameterDirection.InputOutput;
                p.DbType = inputOutputDbType;
                if (inputOutputDbType.ToString().Contains("String"))
                    p.Size = MaximumSizeOfSqlParameter(nameWithoutMarker);
            }
            else
            {
                object value = string.Empty;
                if (isProperty)
                    value = GetProperty(nameWithoutMarker);
                var p = sql.AddParameter(parameterName, value);
                if (IsSystemSqlProperty(nameWithoutMarker) && (value == null))
                    value = string.Empty;
                if ((value != null) && !(DBNull.Value.Equals(value)))
                {
                    p.Direction = ParameterDirection.InputOutput;
                    if ((value is string) && (((string)(value)).Length < MaximumSizeOfSqlParameter(nameWithoutMarker)))
                        p.Size = MaximumSizeOfSqlParameter(nameWithoutMarker);
                }
            }
            return true;
        }

        protected virtual bool ProcessSystemSqlParameter(SqlText sql, string parameterName)
        {
            var nameWithoutMarker = parameterName.Substring(1);
            var testName = nameWithoutMarker;
            if (testName.StartsWith("Result_Master_"))
                testName = "Result_Master";
            var isProperty = IsSystemSqlProperty(testName);
            if ((Array.IndexOf(SystemSqlParameters, testName) == -1) && !isProperty)
                return false;
            var p = sql.Parameters[parameterName];
            if (nameWithoutMarker == "BusinessRules_PreventDefault")
            {
                // prevent standard processing
                if (!(0.Equals(p.Value)))
                    PreventDefault();
            }
            else
            {
                if (nameWithoutMarker == "Result_ClearSelection")
                {
                    if (!(0.Equals(p.Value)))
                        Result.ClearSelection = true;
                }
                else
                {
                    if (nameWithoutMarker == "Result_KeepSelection")
                    {
                        if (!(0.Equals(p.Value)))
                            Result.KeepSelection = true;
                    }
                    else
                    {
                        if (nameWithoutMarker == "Result_Continue")
                        {
                            // continue standard processing on the client
                            if (!(0.Equals(p.Value)))
                                Result.Continue();
                        }
                        else
                        {
                            if (isProperty)
                            {
                                var currentValue = GetProperty(nameWithoutMarker);
                                if (!((Convert.ToString(currentValue) == Convert.ToString(p.Value))))
                                    SetProperty(nameWithoutMarker, p.Value);
                            }
                            else
                            {
                                if (nameWithoutMarker.StartsWith("Result_Master_"))
                                {
                                    var masterFieldName = nameWithoutMarker.Substring(14);
                                    UpdateMasterFieldValue(ToNameWithoutDbType(masterFieldName), p.Value);
                                }
                                else
                                {
                                    var s = Convert.ToString(p.Value);
                                    if (!(string.IsNullOrEmpty(s)))
                                    {
                                        if (nameWithoutMarker == "Result_Focus")
                                        {
                                            var m = Regex.Match(s, "^\\s*(?\'FieldName\'\\w+)\\s*(,\\s*(?\'Message\'.+))?$");
                                            Result.Focus(m.Groups["FieldName"].Value, m.Groups["Message"].Value);
                                        }
                                        if (nameWithoutMarker == "Result_ShowViewMessage")
                                            Result.ShowViewMessage(s);
                                        if (nameWithoutMarker == "Result_ShowMessage")
                                            Result.ShowMessage(s);
                                        if (nameWithoutMarker == "Result_ShowAlert")
                                            Result.ShowAlert(s);
                                        if (nameWithoutMarker == "Result_Error")
                                            throw new Exception(s);
                                        if (nameWithoutMarker == "Result_ExecuteOnClient")
                                            Result.ExecuteOnClient(s);
                                        if (nameWithoutMarker == "Result_NavigateUrl")
                                            Result.NavigateUrl = s;
                                        if (nameWithoutMarker == "Result_Refresh")
                                            Result.Refresh();
                                        if (nameWithoutMarker == "Result_RefreshChildren")
                                            Result.RefreshChildren();
                                    }
                                }
                            }
                        }
                    }
                }
            }
            return true;
        }

        protected override void ExecuteMethod(ActionArgs args, ActionResult result, ActionPhase phase)
        {
            ExecuteServerRules(args, result, phase);
        }

        public void ExecuteServerRules(ActionArgs args, ActionResult result, ActionPhase phase)
        {
            if (Result.Canceled || args.IgnoreBusinessRules)
                return;
            this.Arguments = args;
            this.Result = result;
            ExecuteServerRules(phase, args.View, args.CommandName, args.CommandArgument);
            if ((phase == ActionPhase.Before) && !Result.Canceled)
                ExecuteServerRules(ActionPhase.Execute, args.View, args.CommandName, args.CommandArgument);
        }

        public void ExecuteServerRules(PageRequest request, ActionPhase phase)
        {
            ExecuteServerRules(request, phase, "Select", null);
        }

        public void ExecuteServerRules(PageRequest request, ActionPhase phase, string commandName, object[] row)
        {
            _request = request;
            _requestFilter = request.Filter;
            _requestExternalFilter = request.ExternalFilter;
            _row = row;
            if ((phase == ActionPhase.Execute) && (commandName == "Select"))
                BlobAdapterFactory.InitializeRow(this.Page, row);
            ExecuteServerRules(phase, request.View, commandName, string.Empty);
        }

        public void ExecuteServerRules(DistinctValueRequest request, ActionPhase phase)
        {
            _requestFilter = request.Filter;
            _requestExternalFilter = request.ExternalFilter;
            ExecuteServerRules(phase, request.View, "Select", string.Empty);
        }

        protected void ExecuteServerRules(ActionPhase phase, string view, string commandName, string commandArgument)
        {
            InternalExecuteServerRules(phase, view, commandName, commandArgument);
        }

        public bool SupportsCommand(string type, string commandName)
        {
            var types = type.Split(new char[] {
                        '|'}, StringSplitOptions.RemoveEmptyEntries);
            var commandNames = commandName.Split(new char[] {
                        '|'}, StringSplitOptions.RemoveEmptyEntries);
            foreach (var t in types)
                foreach (var c in commandNames)
                {
                    var ruleIterator = Config.Select("/c:dataController/c:businessRules/c:rule[@type=\'{0}\']", t);
                    while (ruleIterator.MoveNext())
                    {
                        var ruleCommandName = ruleIterator.Current.GetAttribute("commandName", string.Empty);
                        if ((ruleCommandName == c) || Regex.IsMatch(c, ruleCommandName))
                            return true;
                    }
                }
            if (commandName == "Select")
                return (Config.SelectSingleNode("/c:dataController/c:fields/c:field[@onDemandHandler!=\'\']") != null);
            return false;
        }

        protected virtual void InternalExecuteServerRules(ActionPhase phase, string view, string commandName, string commandArgument)
        {
            if (view == null)
                view = string.Empty;
            if (this.Arguments != null)
                base.ExecuteMethod(this.Arguments, this.Result, phase);
            var iterator = Config.Select("/c:dataController/c:businessRules/c:rule[@phase=\'{0}\']", phase);
            while (iterator.MoveNext())
            {
                var ruleType = iterator.Current.GetAttribute("type", string.Empty);
                var ruleView = iterator.Current.GetAttribute("view", string.Empty);
                var ruleCommandName = iterator.Current.GetAttribute("commandName", string.Empty);
                var ruleCommandArgument = iterator.Current.GetAttribute("commandArgument", string.Empty);
                var ruleName = iterator.Current.GetAttribute("name", string.Empty);
                if (string.IsNullOrEmpty(ruleName))
                    ruleName = iterator.Current.GetAttribute("id", string.Empty);
                var skip = false;
                if (!((string.IsNullOrEmpty(ruleView) || ((ruleView == view) || Regex.IsMatch(view, ruleView)))))
                    skip = true;
                if (!((string.IsNullOrEmpty(ruleCommandName) || ((ruleCommandName == commandName) || Regex.IsMatch(commandName, ruleCommandName)))))
                    skip = true;
                if (!((string.IsNullOrEmpty(ruleCommandArgument) || ((ruleCommandArgument == commandArgument) || (!(string.IsNullOrEmpty(commandArgument)) && Regex.IsMatch(commandArgument, ruleCommandArgument))))))
                    skip = true;
                if (!skip && !(string.IsNullOrEmpty(ruleName)))
                {
                    if (!(RuleInWhitelist(ruleName)))
                        skip = true;
                    if (RuleInBlacklist(ruleName))
                        skip = true;
                }
                if (!skip)
                {
                    if (ruleType == "Sql")
                        Sql(iterator.Current.Value);
                    if (ruleType == "Code")
                        ExecuteRule(iterator.Current);
                    if (ruleType == "Email")
                        Email(iterator.Current.Value);
                    BlockRule(ruleName);
                    if (Result.Canceled)
                        break;
                }
            }
        }

        private string ReplaceFieldNamesWithValues(string text)
        {
            return Regex.Replace(text, "\\{(?\'ParameterMarker\':|@)?(?\'Name\'\\w+)(\\s*,\\s*(?\'Format\'.+?)\\s*)?\\}", DoReplaceFieldNameInText);
        }

        private string DoReplaceFieldNameInText(Match m)
        {
            object v = null;
            var name = m.Groups["Name"].Value;
            if (!(string.IsNullOrEmpty(m.Groups["ParameterMarker"].Value)))
                v = GetProperty(name);
            else
            {
                var m2 = Regex.Match(name, "^(?\'Name\'\\w+?)(_(?\'ValueType\'NewValue|OldValue|Value|Modified))?$");
                name = m2.Groups["Name"].Value;
                var valueType = m2.Groups["ValueType"].Value;
                var fvo = SelectFieldValueObject(name);
                if (fvo == null)
                    return m.Value;
                v = fvo.Value;
                if (valueType == "NewValue")
                    v = fvo.NewValue;
                else
                {
                    if (valueType == "OldValue")
                        v = fvo.OldValue;
                    else
                    {
                        if (valueType == "Modified")
                            v = fvo.Modified;
                    }
                }
            }
            var format = m.Groups["Format"].Value;
            if (!(string.IsNullOrEmpty(format)))
            {
                if (!(format.Contains("}")))
                    format = string.Format("{{0:{0}}}", format.Trim());
                return string.Format(format, v);
            }
            return Convert.ToString(v);
        }

        private string DoReplaceActionParameter(Match m)
        {
            var name = m.Groups["Name"].Value.ToLower();
            var value = ReplaceFieldNamesWithValues(m.Groups["Value"].Value);
            if (!(_actionParameters.ContainsKey(name)))
                _actionParameters.Add(name, value);
            return string.Empty;
        }

        protected void AssignActionParameters(string data)
        {
            if (!EnableEmailMessages)
            {
                _actionParameters = null;
                _actionParametersData = data;
            }
        }

        public string GetActionParameterByName(string name)
        {
            return GetActionParameterByName(name, null);
        }

        public string GetActionParameterByName(string name, object defaultValue)
        {
            string v = null;
            if (!(ActionParameters.TryGetValue(name.ToLower(), out v)))
                return Convert.ToString(defaultValue);
            return v;
        }

        protected virtual void Email(DataRow message)
        {
            _actionParameters = new SortedDictionary<string, string>();
            foreach (DataColumn c in message.Table.Columns)
            {
                var v = message[c.ColumnName];
                if (!(DBNull.Value.Equals(v)))
                {
                    var loweredName = c.ColumnName.ToLower();
                    if (loweredName == "body")
                        loweredName = string.Empty;
                    _actionParameters[loweredName] = Convert.ToString(v);
                }
            }
            // require "To" and "Subject" to be present
            if (_actionParameters.ContainsKey("to") && _actionParameters.ContainsKey("subject"))
                Email(string.Empty);
        }

        protected virtual void Email(string data)
        {
            Email(data, null);
        }

        protected virtual void Email(MailMessage message)
        {
            Email(null, message);
        }

        protected virtual void Email(string data, MailMessage message)
        {
            AssignActionParameters(data);
            var smtp = new SmtpClient();
            // configure SMTP properties
            var host = GetActionParameterByName("Host");
            if (!(string.IsNullOrEmpty(host)))
                smtp.Host = host;
            var port = GetActionParameterByName("Port");
            if (!(string.IsNullOrEmpty(port)))
                smtp.Port = Convert.ToInt32(port);
            var enableSsl = GetActionParameterByName("EnableSSL");
            if (!(string.IsNullOrEmpty(enableSsl)))
                smtp.EnableSsl = (enableSsl.ToLower() == "true");
            var userName = GetActionParameterByName("UserName");
            var password = GetActionParameterByName("Password");
            if (!(string.IsNullOrEmpty(userName)))
                smtp.Credentials = new NetworkCredential(userName, password, GetActionParameterByName("Domain"));
            // configure message properties
            if (message == null)
                message = new MailMessage();
            ConfigureMailMessage(smtp, message);
            var recepient = GetActionParameterByName("To");
            AddMailAddresses(message.To, recepient);
            var sender = GetActionParameterByName("From");
            if (!(string.IsNullOrEmpty(sender)))
                message.From = new MailAddress(sender);
            var cc = GetActionParameterByName("Cc");
            if (!(string.IsNullOrEmpty(cc)))
                AddMailAddresses(message.CC, cc);
            var bcc = GetActionParameterByName("Bcc");
            if (!(string.IsNullOrEmpty(bcc)))
                AddMailAddresses(message.Bcc, bcc);
            if (string.IsNullOrEmpty(message.Subject))
                message.Subject = GetActionParameterByName("Subject");
            if (string.IsNullOrEmpty(message.Body))
                message.Body = GetActionParameterByName(string.Empty);
            _actionParameters.Clear();
            if (!(string.IsNullOrEmpty(message.Body)))
                message.Body = Regex.Replace(message.Body, "<attachment\\s+type\\s*=s*\"(report|file)\"\\s*>([\\s\\S]+?)</attachment>", DoExtractAttachment);
            message.IsBodyHtml = Regex.IsMatch(message.Body, "(</\\w+>)|(<\\w+>)");
            // produce attachments
            foreach (var key in _actionParameters.Keys)
                try
                {
                    var nav = new XPathDocument(new StringReader(_actionParameters[key])).CreateNavigator();
                    var attachmentType = ((string)(nav.Evaluate("string(/attachment/@type)")));
                    var attachmentName = ((string)(nav.Evaluate("string(/attachment/name)")));
                    string mediaType = null;
                    byte[] attachmentData = null;
                    if (attachmentType == "report")
                    {
                        string argValue;
                        var args = new ReportArgs();
                        // controller
                        argValue = ((string)(nav.Evaluate("string(/attachment/controller)")));
                        if (!(string.IsNullOrEmpty(argValue)))
                            args.Controller = argValue;
                        // view
                        argValue = ((string)(nav.Evaluate("string(/attachment/view)")));
                        if (!(string.IsNullOrEmpty(argValue)))
                            args.View = argValue;
                        // template name
                        argValue = ((string)(nav.Evaluate("string(/attachment/templateName)")));
                        if (!(string.IsNullOrEmpty(argValue)))
                            args.TemplateName = argValue;
                        // format
                        argValue = ((string)(nav.Evaluate("string(/attachment/format)")));
                        if (!(string.IsNullOrEmpty(argValue)))
                            args.Format = argValue;
                        // sort expression
                        argValue = ((string)(nav.Evaluate("string(/attachment/sortExpression)")));
                        if (!(string.IsNullOrEmpty(argValue)))
                            args.SortExpression = argValue;
                        // filter details
                        argValue = ((string)(nav.Evaluate("string(/attachment/filterDetails)")));
                        if (!(string.IsNullOrEmpty(argValue)))
                            args.FilterDetails = argValue;
                        // filter
                        var filter = new List<FieldFilter>();
                        var filterIterator = nav.Select("/attachment/filter/item");
                        while (filterIterator.MoveNext())
                        {
                            var ff = new FieldFilter()
                            {
                                FieldName = ((string)(filterIterator.Current.Evaluate("string(field)")))
                            };
                            var operatorName = ((string)(filterIterator.Current.Evaluate("string(operator)")));
                            if (Regex.IsMatch(operatorName, "\\w+"))
                                operatorName = string.Format("${0}$", operatorName);
                            var operatorIndex = Array.IndexOf(RowFilterAttribute.ComparisonOperations, operatorName);
                            if (!((operatorIndex == -1)))
                            {
                                ff.Operation = ((RowFilterOperation)(operatorIndex));
                                var values = new List<object>();
                                var valueIterator = filterIterator.Current.Select("value");
                                while (valueIterator.MoveNext())
                                {
                                    object v = valueIterator.Current.Value;
                                    var t = valueIterator.Current.GetAttribute("type", string.Empty);
                                    if (!(string.IsNullOrEmpty(t)))
                                        v = Convert.ChangeType(v, Type.GetType(("System." + t)));
                                    values.Add(v);
                                }
                                if (values.Count == 1)
                                    ff.Value = values[0];
                                else
                                    ff.Value = values.ToArray();
                                filter.Add(ff);
                            }
                        }
                        args.Filter = filter.ToArray();
                        attachmentData = ReportBase.Execute(args);
                        mediaType = args.MimeType;
                        if (string.IsNullOrEmpty(attachmentName))
                            attachmentName = (args.Controller + key);
                        attachmentName = string.Format("{0}.{1}", attachmentName, args.FileNameExtension);
                    }
                    if (attachmentData != null)
                        message.Attachments.Add(new Attachment(new MemoryStream(attachmentData), attachmentName, mediaType));
                }
                catch (Exception error)
                {
                    var errorContent = new MemoryStream();
                    var esw = new StreamWriter(errorContent);
                    esw.Write(error.Message);
                    esw.Flush();
                    errorContent.Position = 0;
                    message.Attachments.Add(new Attachment(errorContent, (key + ".txt"), "text/plain"));
                }
            // send message
            WaitCallback workItem = DoSendEmail;
            ThreadPool.QueueUserWorkItem(workItem, new object[] {
                        smtp,
                        message,
                        _config.CreateBusinessRules()});
        }

        static void DoSendEmail(object state)
        {
            var args = ((object[])(state));
            var smtp = ((SmtpClient)(args[0]));
            var message = ((MailMessage)(args[1]));
            try
            {
                smtp.Send(message);
            }
            catch (Exception error)
            {
                ((BusinessRules)(args[2])).HandleEmailException(smtp, message, error);
            }
        }

        protected virtual void HandleEmailException(SmtpClient smtp, MailMessage message, Exception error)
        {
        }

        private string DoExtractAttachment(Match m)
        {
            _actionParameters.Add(((_actionParameters.Count + 1)).ToString("D3"), m.Value);
            return string.Empty;
        }

        /// <summary>
        /// Adds email addresses with optional display names from the string list to the mail address collection.
        /// </summary>
        /// <param name="list">The collection of mail addresses.</param>
        /// <param name="addresses">The string of addresses separated with comma and semicolon with optional display names.</param>
        protected virtual void AddMailAddresses(MailAddressCollection list, string addresses)
        {
            addresses = Regex.Replace(addresses, "(\\s*(,|;)\\s*(,|;)\\s*)+", ",");
            addresses = Regex.Replace(addresses, "((\'|\")\\s*(\'|\"))", string.Empty);
            var address = Regex.Match(addresses, "\\s*(?\'Email\'((\".+\")|(\'.+\'))?(.+?))\\s*(,|;|$)");
            while (address.Success)
            {
                var m = Regex.Match(address.Groups["Email"].Value.Trim(',', ';'), "^\\s*(((?\'DisplayName\'.+?)?\\s*<\\s*(?\'Address\'.+?@.+?)\\s*>)|(?\'Address\'.+?@.+?))\\s*" +
                        "$");
                if (m.Success)
                    list.Add(new MailAddress(m.Groups["Address"].Value, m.Groups["DisplayName"].Value.Trim('\'', '\"'), Encoding.UTF8));
                address = address.NextMatch();
            }
        }

        /// <summary>
        /// Configures a new email message with default parameters.
        /// </summary>
        /// <param name="smtp">The SMTP client that will send the message.</param>
        /// <param name="message">The new message with the default configuration</param>
        protected virtual void ConfigureMailMessage(SmtpClient smtp, MailMessage message)
        {
        }

        public static string JavaScriptString(object value)
        {
            return JavaScriptString(value, false);
        }

        public static string JavaScriptString(object value, bool addSingleQuotes)
        {
            var s = System.Web.HttpUtility.JavaScriptStringEncode(Convert.ToString(value));
            if (addSingleQuotes)
                s = string.Format("\'{0}\'\'", s);
            return s;
        }

        protected virtual void ConfigureSqlQuery(SqlText query)
        {
        }

        protected override void AfterSqlAction(ActionArgs args, ActionResult result)
        {
            base.AfterSqlAction(args, result);
            ApplicationServices.Create().AfterAction(args, result);
        }

        protected override void BeforeSqlAction(ActionArgs args, ActionResult result)
        {
            // perform server-side check to make sure that commands Insert|Update|Delete are allowed
            var allow = true;
            if (!(IsSystemController(args.Controller)))
            {
                var acl = AccessControlList.Current;
                if (acl.Enabled)
                {
                    if ((args.CommandName == "Insert") && !(acl.PermissionGranted(PermissionKind.Controller, args.Controller, "create")))
                        allow = false;
                    if ((args.CommandName == "Update") && !(acl.PermissionGranted(PermissionKind.Controller, args.Controller, "update")))
                        allow = false;
                    if ((args.CommandName == "Delete") && !(acl.PermissionGranted(PermissionKind.Controller, args.Controller, "delete")))
                        allow = false;
                }
            }
            if (!allow)
                throw new Exception(string.Format("Access Denied: {0} does not allow {1}.", args.Controller, args.CommandName));
            if ((args.CommandName == "Insert") || (args.CommandName == "Update"))
                UpdateGeoFields();
            ApplicationServices.Create().BeforeAction(args, result);
            base.BeforeSqlAction(args, result);
        }

        public virtual bool IsSystemController(string controller)
        {
            var systemControllers = new string[] {
                    ApplicationServices.SiteContentControllerName.ToLower(),
                    "myprofile",
                    "aspnet_membership",
                    "aspnet_roles"};
            return !((Array.IndexOf(systemControllers, controller.ToLower()) == -1));
        }
    }

    public enum PermissionKind
    {

        Controller,

        Page,
    }

    public class AccessControlPermission
    {

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _fullName;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _objectName;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _parameterName;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _type;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _text;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _description;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _allow;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _deny;

        public string FullName
        {
            get
            {
                return _fullName;
            }
            set
            {
                _fullName = value;
            }
        }

        public string ObjectName
        {
            get
            {
                return _objectName;
            }
            set
            {
                _objectName = value;
            }
        }

        public string ParameterName
        {
            get
            {
                return _parameterName;
            }
            set
            {
                _parameterName = value;
            }
        }

        public string Type
        {
            get
            {
                return _type;
            }
            set
            {
                _type = value;
            }
        }

        public string Text
        {
            get
            {
                return _text;
            }
            set
            {
                _text = value;
            }
        }

        public string Description
        {
            get
            {
                return _description;
            }
            set
            {
                _description = value;
            }
        }

        public string Allow
        {
            get
            {
                return _allow;
            }
            set
            {
                _allow = value;
            }
        }

        public string Deny
        {
            get
            {
                return _deny;
            }
            set
            {
                _deny = value;
            }
        }

        public bool IsMatch(string controller)
        {
            return ((ObjectName == "_any") || ObjectName.Equals(controller, StringComparison.CurrentCultureIgnoreCase));
        }
    }

    public class AccessControlPermissionDictionary : SortedDictionary<string, AccessControlPermission>
    {
    }

    public class AccessControlList
    {

        /// ACL cache duration expressed in seconds.
        public static int DefaultCacheDuration = 10;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private SortedDictionary<string, string> _grants;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private AccessControlPermissionDictionary _permissions;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private AccessControlPermissionDictionary _groups;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private AccessControlPermissionDictionary _alterations;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private AccessControlPermissionDictionary _accessRules;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _enabled;

        private int? _cacheDuration;

        public AccessControlList()
        {
            Grants = new SortedDictionary<string, string>();
            Permissions = new AccessControlPermissionDictionary();
            Groups = new AccessControlPermissionDictionary();
            Alterations = new AccessControlPermissionDictionary();
            AccessRules = new AccessControlPermissionDictionary();
        }

        public SortedDictionary<string, string> Grants
        {
            get
            {
                return _grants;
            }
            set
            {
                _grants = value;
            }
        }

        public AccessControlPermissionDictionary Permissions
        {
            get
            {
                return _permissions;
            }
            set
            {
                _permissions = value;
            }
        }

        public AccessControlPermissionDictionary Groups
        {
            get
            {
                return _groups;
            }
            set
            {
                _groups = value;
            }
        }

        public AccessControlPermissionDictionary Alterations
        {
            get
            {
                return _alterations;
            }
            set
            {
                _alterations = value;
            }
        }

        public AccessControlPermissionDictionary AccessRules
        {
            get
            {
                return _accessRules;
            }
            set
            {
                _accessRules = value;
            }
        }

        public virtual bool Enabled
        {
            get
            {
                return _enabled;
            }
            set
            {
                _enabled = value;
            }
        }

        public virtual int CacheDuration
        {
            get
            {
                if (_cacheDuration.HasValue)
                    return _cacheDuration.Value;
                return DefaultCacheDuration;
            }
        }

        public static AccessControlList Current
        {
            get
            {
                var acl = ((AccessControlList)(HttpContext.Current.Items["app_ACL"]));
                if (acl == null)
                {
                    acl = ((AccessControlList)(HttpContext.Current.Cache["app_ACL"]));
                    if (acl == null)
                    {
                        acl = new AccessControlList();
                        acl.Initialize();
                        // cache the ACL
                        HttpContext.Current.Cache.Add("app_ACL", acl, null, DateTime.Now.AddSeconds(acl.CacheDuration), Cache.NoSlidingExpiration, CacheItemPriority.Normal, null);
                    }
                    HttpContext.Current.Items["app_ACL"] = acl;
                }
                return acl;
            }
        }

        public virtual string FullName
        {
            get
            {
                return HttpContext.Current.Server.MapPath("~/acl.json");
            }
        }

        protected virtual void Initialize()
        {
            // read JSON definition from the file system
            JObject json = null;
            if (ApplicationServicesBase.IsSiteContentEnabled)
            {
                var access = Controller.GrantFullAccess("*");
                try
                {
                    var userDefinedACL = ApplicationServices.Current.ReadSiteContent("sys/acl.json");
                    if (userDefinedACL != null)
                        try
                        {
                            json = JObject.Parse(userDefinedACL.Text);
                        }
                        catch (Exception)
                        {
                            // do nothing
                        }
                }
                finally
                {
                    Controller.RevokeFullAccess(access);
                }
            }
            // read application-level ACL if there is no user-defined ACL in CMS
            var preventAccidentalDisabling = false;
            if (json == null)
            {
                if (File.Exists(FullName))
                    try
                    {
                        json = JObject.Parse(File.ReadAllText(FullName));
                    }
                    catch (Exception)
                    {
                        json = new JObject();
                        // JSON is broken - force the ACL mode anyway to call for Admin attention
                        json["enable"] = true;
                    }
                else
                    json = new JObject();
            }
            else
            {
                if (File.Exists(FullName))
                    preventAccidentalDisabling = true;
            }
            // initialize Access Control List
            var enabledFlag = json["enabled"];
            if (enabledFlag != null)
                Enabled = (((bool?)(enabledFlag)) == true);
            // prevent accidental disabling of application-level ACL by user-defined ACL from CMS
            if (preventAccidentalDisabling)
                Enabled = true;
            _cacheDuration = ((int?)(json["cacheDuration"]));
            if (Enabled)
            {
                InitializePermissions();
                InitializeGrants(json);
            }
        }

        protected virtual void InitializeGrants(JObject json)
        {
            var deny = new SortedDictionary<string, string>();
            var permissions = json["permissions"];
            if (permissions != null)
                foreach (JProperty permission in permissions)
                {
                    var permissionDefinition = ((JObject)(permissions)).GetValue(permission.Name, StringComparison.InvariantCultureIgnoreCase);
                    if (permissionDefinition != null)
                    {
                        var roles = Convert.ToString(permissionDefinition);
                        if (!(string.IsNullOrEmpty(roles)))
                        {
                            roles = Regex.Replace(roles.Trim(), "\\s+", ",");
                            EnumeratePermissions(permission.Name, roles, deny);
                        }
                    }
                }
            foreach (var name in deny.Keys)
                Grants.Remove(name);
        }

        protected virtual void EnumeratePermissions(string permission, string roles, SortedDictionary<string, string> deny)
        {
            if (permission.StartsWith("group."))
            {
                AccessControlPermission groupPermission = null;
                if (Groups.TryGetValue(permission, out groupPermission))
                {
                    // prevent duplicate and recursive group references
                    Groups.Remove(permission);
                    if (!(string.IsNullOrEmpty(groupPermission.Allow)))
                        foreach (var name in Regex.Split(groupPermission.Allow, "\\s+"))
                            EnumeratePermissions(name, roles, deny);
                    // only non-group permission can be denied
                    if (!(string.IsNullOrEmpty(groupPermission.Deny)))
                        foreach (var name in Regex.Split(groupPermission.Deny, "\\s+"))
                            deny[name.ToLower()] = name;
                }
            }
            else
                Grants[permission.ToLower()] = roles;
        }

        protected virtual void InitializePermissions()
        {
            var files = new SortedDictionary<string, string>();
            var permissionsFolderPath = HttpContext.Current.Server.MapPath("~/permissions");
            if (Directory.Exists(permissionsFolderPath))
                foreach (var fileName in Directory.GetFiles(permissionsFolderPath, "*.json"))
                    files[Path.GetFileName(fileName)] = File.ReadAllText(fileName);
            if (ApplicationServices.IsSiteContentEnabled)
            {
                var access = Controller.GrantFullAccess("*");
                try
                {
                    var siteFiles = ApplicationServices.Current.ReadSiteContent("sys/permissions", "*.json");
                    foreach (var f in siteFiles)
                        files[f.PhysicalName] = f.Text;
                }
                finally
                {
                    Controller.RevokeFullAccess(access);
                }
            }
            foreach (var fileName in files.Keys)
            {
                var permissionInfo = Regex.Match(Path.GetFileNameWithoutExtension(fileName), "^(?\'Type\'controller|access|group)\\.(?\'ObjectName\'\\w+)(\\.(?\'Param1\'.+?))?(\\.(?\'Par" +
                        "am2\'.+?))?$");
                if (permissionInfo.Success)
                    try
                    {
                        var json = JObject.Parse(files[fileName]);
                        var type = permissionInfo.Groups["Type"].Value;
                        var objectName = permissionInfo.Groups["ObjectName"].Value;
                        var parameterName = permissionInfo.Groups["Param1"].Value;
                        var name = permissionInfo.Value;
                        // parse "allow"
                        var allowDef = json["allow"];
                        var allow = string.Empty;
                        if (allowDef is JArray)
                            allow = string.Join("\n", ((JArray)(allowDef)));
                        else
                            allow = Convert.ToString(allowDef);
                        // parse "deny"
                        var denyDef = json["deny"];
                        var deny = string.Empty;
                        if (denyDef is JArray)
                            deny = string.Join("\n", ((JArray)(denyDef)));
                        else
                            deny = Convert.ToString(denyDef);
                        // add permission to the list
                        var permission = new AccessControlPermission()
                        {
                            FullName = name,
                            ObjectName = objectName,
                            ParameterName = parameterName,
                            Type = type,
                            Text = ((string)(json["text"])),
                            Description = ((string)(json["description"])),
                            Allow = allow,
                            Deny = deny
                        };
                        if (type == "group")
                            Groups[name] = permission;
                        else
                        {
                            Permissions[name] = permission;
                            if (type == "access")
                                AccessRules[name] = permission;
                            else
                            {
                                if (type == "controller")
                                    Alterations[name] = permission;
                            }
                        }
                    }
                    catch (Exception)
                    {
                    }
            }
        }

        public bool PermissionGranted(PermissionKind kind, string objectName)
        {
            return PermissionGranted(kind, objectName, null);
        }

        public bool PermissionGranted(PermissionKind kind, string objectName, string permission)
        {
            var granted = true;
            if (Enabled)
            {
                granted = false;
                var test = kind.ToString().ToLower();
                if (!(string.IsNullOrEmpty(objectName)))
                    test = (test
                                + ("." + objectName));
                if (!(string.IsNullOrEmpty(permission)))
                    test = (test
                                + ("." + permission));
                if (PermissionGranted(test))
                    granted = true;
            }
            return granted;
        }

        public bool PermissionGranted(string fullPermissionName)
        {
            var granted = false;
            var roles = string.Empty;
            if (Grants.TryGetValue(fullPermissionName.ToLower(), out roles))
            {
                if (!(string.IsNullOrEmpty(roles)))
                {
                    if (((roles == "*") && HttpContext.Current.User.Identity.IsAuthenticated) || ((roles == "?") || DataControllerBase.UserIsInRole(roles)))
                        granted = true;
                }
            }
            return granted;
        }
    }
}
