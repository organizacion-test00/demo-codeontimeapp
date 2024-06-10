using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Configuration;
using System.Data;
using System.Data.Common;
using System.IO;
using System.Linq;
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
using MyCompany.Services;

namespace MyCompany.Data
{
    public partial class DataControllerBase
    {

        private XPathNavigator _view;

        private string _viewId;

        private string _parameterMarker;

        private string _leftQuote;

        private string _rightQuote;

        private string _viewType;

        private ControllerConfiguration _config;

        private ViewPage _viewPage;

        private bool _viewOverridingDisabled;

        public static Regex SqlSelectRegex1 = new Regex("/\\*<select>\\*/(?\'Select\'[\\S\\s]*)?/\\*</select>\\*[\\S\\s]*?/\\*<from>\\*/(?\'From\'[\\S\\s]" +
                "*)?/\\*</from>\\*[\\S\\s]*?/\\*(<order-by>\\*/(?\'OrderBy\'[\\S\\s]*)?/\\*</order-by>\\*/)?", RegexOptions.IgnoreCase);

        public static Regex SqlSelectRegex2 = new Regex(@"\s*select\s*(?'Select'[\S\s]*)?\sfrom\s*(?'From'[\S\s]*)?\swhere\s*(?'Where'[\S\s]*)?\sorder\s+by\s*(?'OrderBy'[\S\s]*)?|\s*select\s*(?'Select'[\S\s]*)?\sfrom\s*(?'From'[\S\s]*)?\swhere\s*(?'Where'[\S\s]*)?|\s*select\s*(?'Select'[\S\s]*)?\sfrom\s*(?'From'[\S\s]*)?\sorder\s+by\s*(?'OrderBy'[\S\s]*)?|\s*select\s*(?'Select'[\S\s]*)?\sfrom\s*(?'From'[\S\s]*)?", RegexOptions.IgnoreCase);

        /// "table name" regular expression:
        /// ^(?'Table'((\[|"|`)([\w\s]+)?(\]|"|`)|\w+)(\s*\.\s*((\[|"|`)([\w\s]+)?(\]|"|`)|\w+))*(\s*\.\s*((\[|"|`)([\w\s]+)?(\]|"|`)|\w+))*)(\s*(as|)\s*(\[|"|`|)([\w\s]+)?(\]|"|`|))
        public static Regex TableNameRegex = new Regex("^(?\'Table\'((\\[|\"|`)([\\w\\s]+)?(\\]|\"|`)|\\w+)(\\s*\\.\\s*((\\[|\"|`)([\\w\\s]+)?(\\]|\"|`)|\\w" +
                "+))*(\\s*\\.\\s*((\\[|\"|`)([\\w\\s]+)?(\\]|\"|`)|\\w+))*)(\\s*(as|)\\s*(\\[|\"|`|)([\\w\\s]+)?(" +
                "\\]|\"|`|))", RegexOptions.IgnoreCase);

        private SelectClauseDictionary _expressions;

        public static Regex ParamDetectionRegex = new Regex("(?:(\\W|^))(?\'Parameter\'(@|:)\\w+)");

        public static Regex SelectExpressionRegex = new Regex("\\s*(?\'Expression\'[\\S\\s]*?(\\([\\s\\S]*?\\)|(\\.((\"|\'|\\[|`)(?\'FieldName\'[\\S\\s]*?)(\"|\'|\\" +
                "]|`))|(\"|\'|\\[|`|)(?\'FieldName\'[\\w\\s]*?)(\"|\'|\\]|)|)))((\\s+as\\s+|\\s+)(\"|\'|\\[|`|)(?" +
                "\'Alias\'[\\S\\s]*?)|)(\"|\'|\\]|`|)\\s*(,|$)", RegexOptions.IgnoreCase);

        private static SortedDictionary<string, Type> _typeMap;

        public virtual ControllerConfiguration Config
        {
            get
            {
                return _config;
            }
        }

        private IXmlNamespaceResolver Resolver
        {
            get
            {
                return _config.Resolver;
            }
        }

        public bool ViewOverridingDisabled
        {
            get
            {
                return _viewOverridingDisabled;
            }
            set
            {
                _viewOverridingDisabled = value;
            }
        }

        public static SortedDictionary<string, Type> TypeMap
        {
            get
            {
                return _typeMap;
            }
        }

        protected virtual bool YieldsSingleRow(DbCommand command)
        {
            return ((command == null) || !(((command.CommandText.IndexOf("count(*)") > 0) || (command.CommandText.IndexOf("count(distinct ") > 0))));
        }

        protected string CreateValueFromSourceFields(DataField field, DbDataReader reader)
        {
            var v = string.Empty;
            if (DBNull.Value.Equals(reader[field.Name]))
                v = "null";
            var m = Regex.Match(field.SourceFields, "(\\w+)\\s*(,|$)");
            while (m.Success)
            {
                if (v.Length > 0)
                    v = (v + "|");
                var rawValue = reader[m.Groups[1].Value];
                if (DBNull.Value.Equals(rawValue))
                    v = (v + "null");
                else
                {
                    if ((rawValue != null) && (rawValue is byte[]))
                        rawValue = new Guid(((byte[])(rawValue)));
                    v = (v + Convert.ToString(rawValue));
                }
                m = m.NextMatch();
            }
            return v;
        }

        private void PopulatePageCategories(ViewPage page)
        {
            var categoryIterator = _view.Select("c:categories/c:category", Resolver);
            while (categoryIterator.MoveNext())
                page.Categories.Add(new Category(categoryIterator.Current, Resolver));
            if (page.Categories.Count == 0)
                page.Categories.Add(new Category());
        }

        public ViewPage CreateViewPage()
        {
            if (_viewPage == null)
            {
                _viewPage = new ViewPage();
                PopulatePageFields(_viewPage);
                EnsurePageFields(_viewPage, null);
            }
            return _viewPage;
        }

        void PopulateDynamicLookups(ActionArgs args, ActionResult result)
        {
            var page = CreateViewPage();
            foreach (var field in page.Fields)
                if (!(string.IsNullOrEmpty(field.ContextFields)) && page.PopulateStaticItems(field, args.Values))
                    result.Values.Add(new FieldValue(field.Name, field.Items.ToArray()));
        }

        public static bool UserIsInRole(params System.String[] roles)
        {
            return new ControllerUtilities().UserIsInRole(roles);
        }

        private void ExecutePostActionCommands(ActionArgs args, ActionResult result, DataConnection connection)
        {
            var eventName = string.Empty;
            if (args.CommandName.Equals("insert", StringComparison.OrdinalIgnoreCase))
                eventName = "Inserted";
            else
            {
                if (args.CommandName.Equals("update", StringComparison.OrdinalIgnoreCase))
                    eventName = "Updated";
                else
                {
                    if (args.CommandName.Equals("delete", StringComparison.OrdinalIgnoreCase))
                        eventName = "Deleted";
                }
            }
            var eventCommandIterator = _config.Select("/c:dataController/c:commands/c:command[@event=\'{0}\']", eventName);
            while (eventCommandIterator.MoveNext())
                ExecuteActionCommand(args, result, connection, eventCommandIterator.Current);
            if (new ControllerUtilities().SupportsLastEnteredValues(args.Controller))
            {
                if ((args.SaveLEVs && (HttpContext.Current.Session != null)) && ((args.CommandName == "Insert") || (args.CommandName == "Update")))
                    HttpContext.Current.Session[string.Format("{0}$LEVs", args.Controller)] = args.Values;
            }
            if ((args.CommandName == "Insert") && connection.CanClose)
            {
                var oneToOneField = _config.SelectSingleNode("/c:dataController/c:fields/c:field[c:items/@style=\'OneToOne\']");
                if (oneToOneField != null)
                {
                    var fvo = args[oneToOneField.GetAttribute("name", string.Empty)];
                    if ((fvo != null) && fvo.Modified)
                        result.Values.Add(fvo);
                }
            }
        }

        private void ExecuteActionCommand(ActionArgs args, ActionResult result, DataConnection connection, XPathNavigator commandNavigator)
        {
            var command = SqlStatement.CreateCommand(connection.Connection);
            var commandType = commandNavigator.GetAttribute("type", string.Empty);
            if (string.IsNullOrEmpty(commandType))
                commandType = "Text";
            command.CommandType = ((CommandType)(TypeDescriptor.GetConverter(typeof(CommandType)).ConvertFromString(commandType)));
            command.CommandText = ((string)(commandNavigator.Evaluate("string(c:text)", Resolver)));
            command.Transaction = connection.Transaction;
            var reader = command.ExecuteReader();
            if (reader.Read())
            {
                var outputIndex = 0;
                var outputIterator = commandNavigator.Select("c:output/c:*", Resolver);
                while (outputIterator.MoveNext())
                {
                    if (outputIterator.Current.LocalName == "fieldOutput")
                    {
                        var name = outputIterator.Current.GetAttribute("name", string.Empty);
                        var fieldName = outputIterator.Current.GetAttribute("fieldName", string.Empty);
                        foreach (var v in args.Values)
                            if (v.Name.Equals(fieldName, StringComparison.CurrentCultureIgnoreCase))
                            {
                                if (string.IsNullOrEmpty(name))
                                    v.NewValue = reader[outputIndex];
                                else
                                    v.NewValue = reader[name];
                                if ((v.NewValue != null) && ((v.NewValue is byte[]) && (((byte[])(v.NewValue)).Length == 16)))
                                    v.NewValue = new Guid(((byte[])(v.NewValue)));
                                v.Modified = true;
                                if (result != null)
                                    result.Values.Add(v);
                                break;
                            }
                    }
                    outputIndex++;
                }
            }
            reader.Close();
        }

        private void ExecutePreActionCommands(ActionArgs args, ActionResult result, DataConnection connection)
        {
            var eventName = string.Empty;
            if (args.CommandName.Equals("insert", StringComparison.OrdinalIgnoreCase))
                eventName = "Inserting";
            else
            {
                if (args.CommandName.Equals("update", StringComparison.OrdinalIgnoreCase))
                    eventName = "Updating";
                else
                {
                    if (args.CommandName.Equals("delete", StringComparison.OrdinalIgnoreCase))
                        eventName = "Deleting";
                }
            }
            var eventCommandIterator = _config.Select("/c:dataController/c:commands/c:command[@event=\'{0}\']", eventName);
            while (eventCommandIterator.MoveNext())
                ExecuteActionCommand(args, result, connection, eventCommandIterator.Current);
        }

        protected virtual ControllerConfiguration CreateConfiguration(string controllerName)
        {
            return Controller.CreateConfigurationInstance(GetType(), controllerName);
        }

        public static ControllerConfiguration CreateConfigurationInstance(Type t, string controller)
        {
            var configKey = ("DataController_" + controller);
            var config = ((ControllerConfiguration)(HttpContext.Current.Items[configKey]));
            if (config != null)
                return config;
            config = ((ControllerConfiguration)(HttpRuntime.Cache[configKey]));
            if (config == null)
            {
                var res = ControllerFactory.GetDataControllerStream(controller);
                var allowCaching = (res == null);
                if (ApplicationServices.IsSiteContentEnabled)
                    allowCaching = false;
                if ((res == null) || (res == DefaultDataControllerStream))
                    res = ControllerConfigurationUtility.GetResourceStream(string.Format("MyCompany.controllers.{0}.xml", controller), string.Format("MyCompany.{0}.xml", controller));
                if (res == null)
                {
                    var controllerPath = ControllerConfigurationUtility.GetFilePath(Path.Combine(Path.Combine(HttpRuntime.AppDomainAppPath, "Controllers"), (controller + ".xml")));
                    if (string.IsNullOrEmpty(controllerPath))
                        throw new Exception(string.Format("Controller \'{0}\' does not exist.", controller));
                    config = new ControllerConfiguration(controllerPath);
                    if (allowCaching)
                        HttpRuntime.Cache.Insert(configKey, config, new CacheDependency(controllerPath));
                }
                else
                {
                    config = new ControllerConfiguration(res);
                    if (allowCaching)
                        HttpRuntime.Cache.Insert(configKey, config);
                }
            }
            var requiresLocalization = config.RequiresLocalization;
            if (config.UsesVariables)
                config = config.Clone();
            config = config.EnsureVitalElements();
            if (config.PlugIn != null)
                config = config.PlugIn.Create(config);
            if (requiresLocalization)
                config = config.Localize(controller);
            if (config.RequiresVirtualization(controller))
                config = config.Virtualize(controller);
            config.Complete();
            HttpContext.Current.Items[configKey] = config;
            return config;
        }

        public virtual void SelectView(string controller, string view)
        {
            view = ControllerUtilities.ValidateName(view);
            _config = CreateConfiguration(controller);
            XPathNodeIterator iterator = null;
            if (string.IsNullOrEmpty(view))
                iterator = _config.Select("/c:dataController/c:views/c:view[1]");
            else
            {
                if (view == "offline")
                    iterator = CreateOfflineView(controller);
                else
                    iterator = _config.Select("/c:dataController/c:views/c:view[@id=\'{0}\']", view);
            }
            if (!(iterator.MoveNext()))
            {
                iterator = _config.Select("/c:dataController/c:views/c:view[1]");
                if (!(iterator.MoveNext()))
                    throw new Exception(string.Format("The view \'{0}\' does not exist.", view));
            }
            _view = iterator.Current;
            _viewId = iterator.Current.GetAttribute("id", string.Empty);
            if (!ViewOverridingDisabled)
            {
                var overrideIterator = _config.Select("/c:dataController/c:views/c:view[@virtualViewId=\'{0}\']", _viewId);
                while (overrideIterator.MoveNext())
                {
                    var viewId = overrideIterator.Current.GetAttribute("id", string.Empty);
                    var rules = _config.CreateBusinessRules();
                    if ((rules != null) && rules.IsOverrideApplicable(controller, viewId, _viewId))
                    {
                        _view = overrideIterator.Current;
                        break;
                    }
                }
            }
            _viewType = iterator.Current.GetAttribute("type", string.Empty);
            var accessType = iterator.Current.GetAttribute("access", string.Empty);
            if (string.IsNullOrEmpty(accessType))
                accessType = "Private";
            if (!(ValidateViewAccess(controller, _viewId, accessType)))
                throw new Exception(string.Format("Not authorized to access private view \'{0}\' in data controller \'{1}\'. Set \'Access" +
                            "\' property of the view to \'Public\' or enable \'Idle User Detection\' to automatica" +
                            "lly logout user after a period of inactivity.", _viewId, controller));
        }

        protected virtual XPathNodeIterator CreateOfflineView(string controller)
        {
            if (!_config.Navigator.CanEdit)
                _config = _config.Virtualize(controller);
            var viewsNode = _config.SelectSingleNode("/c:dataController/c:views");
            viewsNode.AppendChild("<view id=\"offline\" type=\"Grid\" commandId=\"command1\"><dataFields/></view>");
            var offlineViewNode = _config.SelectSingleNode("/c:dataController/c:views/c:view[@id=\"offline\"]");
            // create sort expression
            var sortExpression = new List<string>();
            var fieldIterator = _config.Select("/c:dataController/c:fields/c:field[@isPrimaryKey=\"true\"]");
            while (fieldIterator.MoveNext())
                sortExpression.Add(fieldIterator.Current.GetAttribute("name", string.Empty));
            offlineViewNode.CreateAttribute(string.Empty, "sortExpression", string.Empty, string.Join(",", sortExpression.ToArray()));
            // enumerate all fields
            var dataFieldsNode = offlineViewNode.SelectSingleNode("c:dataFields", _config.Resolver);
            fieldIterator = _config.Select("/c:dataController/c:fields/c:field");
            while (fieldIterator.MoveNext())
                if (!((fieldIterator.Current.GetAttribute("type", string.Empty) == "DataView")))
                    dataFieldsNode.AppendChild(string.Format("<dataField fieldName=\"{0}\"/>", fieldIterator.Current.GetAttribute("name", string.Empty)));
            return _config.Select("/c:dataController/c:views/c:view[@id=\"offline\"]");
        }

        protected virtual bool RequiresTransaction()
        {
            return false;
        }

        protected virtual bool SupportsTransaction()
        {
            return true;
        }

        public virtual DataConnection CreateConnection(DataControllerBase controller)
        {
            return CreateConnection(controller, false);
        }

        public virtual DataConnection CreateConnection(DataControllerBase controller, bool useTransaction)
        {
            var txn = false;
            if (useTransaction && SupportsTransaction())
            {
                txn = RequiresTransaction();
                if (!txn)
                    txn = (controller.Config.SelectSingleNode("/c:dataController/c:fields/c:field/c:items[@dataController and (@style=\'OneToOne\'" +
                            " or @targetController!=\'\')]") != null);
            }
            DataConnection connection = null;
            if (txn)
                connection = new DataTransaction(_config.ConnectionStringName);
            else
                connection = new DataConnection(_config.ConnectionStringName);
            _parameterMarker = connection.ParameterMarker;
            _leftQuote = connection.LeftQuote;
            _rightQuote = connection.RightQuote;
            return connection;
        }

        protected virtual DbConnection CreateConnection()
        {
            return CreateConnection(true);
        }

        protected virtual DbConnection CreateConnection(bool open)
        {
            return SqlStatement.CreateConnection(_config.ConnectionStringName, open, out _parameterMarker, out _leftQuote, out _rightQuote);
        }

        protected virtual DbCommand CreateCommand(DataConnection connection)
        {
            return CreateCommand(connection, null);
        }

        protected virtual DbCommand CreateCommand(DataConnection connection, ActionArgs args)
        {
            var command = CreateCommand(connection.Connection, args);
            if (command != null)
                command.Transaction = connection.Transaction;
            return command;
        }

        protected virtual DbCommand CreateCommand(DbConnection connection)
        {
            return CreateCommand(connection, null);
        }

        protected virtual DbCommand CreateCommand(DbConnection connection, ActionArgs args)
        {
            var commandId = _view.GetAttribute("commandId", string.Empty);
            var commandNav = _config.SelectSingleNode("/c:dataController/c:commands/c:command[@id=\'{0}\']", commandId);
            if ((args != null) && !(string.IsNullOrEmpty(args.CommandArgument)))
            {
                var commandNav2 = _config.SelectSingleNode("/c:dataController/c:commands/c:command[@id=\'{0}\']", args.CommandArgument);
                if (commandNav2 != null)
                    commandNav = commandNav2;
            }
            if (commandNav == null)
                return null;
            var command = SqlStatement.CreateCommand(connection);
            var theCommandType = commandNav.GetAttribute("type", string.Empty);
            if (!(string.IsNullOrEmpty(theCommandType)))
                command.CommandType = ((CommandType)(TypeDescriptor.GetConverter(typeof(CommandType)).ConvertFromString(theCommandType)));
            command.CommandText = ((string)(commandNav.Evaluate("string(c:text)", Resolver)));
            if (string.IsNullOrEmpty(command.CommandText))
                command.CommandText = commandNav.InnerXml;
            var handler = _config.CreateActionHandler();
            var parameterIterator = commandNav.Select("c:parameters/c:parameter", Resolver);
            SortedDictionary<string, string> missingFields = null;
            while (parameterIterator.MoveNext())
            {
                var parameter = command.CreateParameter();
                parameter.ParameterName = parameterIterator.Current.GetAttribute("name", string.Empty);
                var s = parameterIterator.Current.GetAttribute("type", string.Empty);
                if (!(string.IsNullOrEmpty(s)))
                    parameter.DbType = ((DbType)(TypeDescriptor.GetConverter(typeof(DbType)).ConvertFromString(s)));
                s = parameterIterator.Current.GetAttribute("direction", string.Empty);
                if (!(string.IsNullOrEmpty(s)))
                    parameter.Direction = ((ParameterDirection)(TypeDescriptor.GetConverter(typeof(ParameterDirection)).ConvertFromString(s)));
                command.Parameters.Add(parameter);
                s = parameterIterator.Current.GetAttribute("defaultValue", string.Empty);
                if (!(string.IsNullOrEmpty(s)))
                    parameter.Value = s;
                s = parameterIterator.Current.GetAttribute("fieldName", string.Empty);
                if ((args != null) && !(string.IsNullOrEmpty(s)))
                {
                    var v = args.SelectFieldValueObject(s);
                    if (v != null)
                    {
                        s = parameterIterator.Current.GetAttribute("fieldValue", string.Empty);
                        if (s == "Old")
                            parameter.Value = v.OldValue;
                        else
                        {
                            if (s == "New")
                                parameter.Value = v.NewValue;
                            else
                                parameter.Value = v.Value;
                        }
                    }
                    else
                    {
                        if (missingFields == null)
                            missingFields = new SortedDictionary<string, string>();
                        missingFields.Add(parameter.ParameterName, s);
                    }
                }
                s = parameterIterator.Current.GetAttribute("propertyName", string.Empty);
                if (!(string.IsNullOrEmpty(s)) && (handler != null))
                {
                    var result = handler.GetType().InvokeMember(s, (System.Reflection.BindingFlags.GetProperty | System.Reflection.BindingFlags.GetField), null, handler, new object[0]);
                    parameter.Value = result;
                }
                if (parameter.Value == null)
                    parameter.Value = DBNull.Value;
            }
            if (missingFields != null)
            {
                var retrieveMissingValues = true;
                var filter = new List<string>();
                var page = CreateViewPage();
                foreach (var field in page.Fields)
                    if (field.IsPrimaryKey)
                    {
                        var v = args.SelectFieldValueObject(field.Name);
                        if (v == null)
                        {
                            retrieveMissingValues = false;
                            break;
                        }
                        else
                            filter.Add(string.Format("{0}:={1}", v.Name, v.Value));
                    }
                if (retrieveMissingValues)
                {
                    var editView = ((string)(_config.Evaluate("string(//c:view[@type=\'Form\']/@id)")));
                    if (!(string.IsNullOrEmpty(editView)))
                    {
                        var request = new PageRequest(0, 1, null, filter.ToArray())
                        {
                            RequiresMetaData = true
                        };
                        page = ControllerFactory.CreateDataController().GetPage(args.Controller, editView, request);
                        if (page.Rows.Count > 0)
                            foreach (var parameterName in missingFields.Keys)
                            {
                                var index = 0;
                                var fieldName = missingFields[parameterName];
                                foreach (var field in page.Fields)
                                {
                                    if (field.Name.Equals(fieldName))
                                    {
                                        var v = page.Rows[0][index];
                                        if (v != null)
                                            command.Parameters[parameterName].Value = v;
                                    }
                                    index++;
                                }
                            }
                    }
                }
            }
            return command;
        }

        protected virtual bool ConfigureCommand(DbCommand command, ViewPage page, CommandConfigurationType commandConfiguration, FieldValue[] values)
        {
            if (page == null)
                page = new ViewPage();
            PopulatePageFields(page);
            if (command == null)
                return true;
            if (command.CommandType == CommandType.Text)
            {
                var statementMatch = SqlSelectRegex1.Match(command.CommandText);
                if (!statementMatch.Success)
                    statementMatch = SqlSelectRegex2.Match(command.CommandText);
                var expressions = _expressions;
                if (expressions == null)
                {
                    expressions = ParseSelectExpressions(statementMatch.Groups["Select"].Value);
                    _expressions = expressions;
                }
                EnsurePageFields(page, expressions);
                var commandId = _view.GetAttribute("commandId", string.Empty);
                var commandIsCustom = ((_config.SelectSingleNode("/c:dataController/c:commands/c:command[@id=\'{0}\' and @custom=\'true\']", commandId) != null) || page.RequiresResultSet(commandConfiguration));
                AddComputedExpressions(expressions, page, commandConfiguration, commandIsCustom);
                if (statementMatch.Success)
                {
                    var fromClause = statementMatch.Groups["From"].Value;
                    var whereClause = statementMatch.Groups["Where"].Value;
                    var orderByClause = statementMatch.Groups["OrderBy"].Value;
                    if (commandIsCustom)
                    {
                        var customCommandText = command.CommandText;
                        if (!(string.IsNullOrEmpty(orderByClause)))
                            customCommandText = Regex.Replace(customCommandText, ("order\\s+by\\s+" + Regex.Escape(orderByClause)), string.Empty, RegexOptions.IgnoreCase);
                        fromClause = string.Format("({0}) resultset__", customCommandText);
                        whereClause = string.Empty;
                        orderByClause = string.Empty;
                    }
                    string tableName = null;
                    if (!(commandConfiguration.ToString().StartsWith("Select")))
                        tableName = ((string)(_config.Evaluate("string(/c:dataController/c:commands/c:command[@id=\'{0}\']/@tableName)", commandId)));
                    if (string.IsNullOrEmpty(tableName))
                        tableName = TableNameRegex.Match(fromClause).Groups["Table"].Value;
                    if (commandConfiguration == CommandConfigurationType.Update)
                        return ConfigureCommandForUpdate(command, page, expressions, tableName, values);
                    else
                    {
                        if (commandConfiguration == CommandConfigurationType.Insert)
                            return ConfigureCommandForInsert(command, page, expressions, tableName, values);
                        else
                        {
                            if (commandConfiguration == CommandConfigurationType.Delete)
                                return ConfigureCommandForDelete(command, page, expressions, tableName, values);
                            else
                            {
                                ConfigureCommandForSelect(command, page, expressions, fromClause, whereClause, orderByClause, commandConfiguration);
                                ProcessExpressionParameters(command, expressions);
                            }
                        }
                    }
                }
                else
                {
                    if ((commandConfiguration == CommandConfigurationType.Select) && YieldsSingleRow(command))
                    {
                        var sb = new StringBuilder();
                        sb.Append("select ");
                        AppendSelectExpressions(sb, page, expressions, true);
                        command.CommandText = sb.ToString();
                    }
                }
                return commandConfiguration != CommandConfigurationType.None;
            }
            return (command.CommandType == CommandType.StoredProcedure);
        }

        private void ProcessExpressionParameters(DbCommand command, SelectClauseDictionary expressions)
        {
            foreach (var fieldName in expressions.Keys)
            {
                this._currentCommand = command;
                var formula = expressions[fieldName];
                var m = ParamDetectionRegex.Match(formula);
                if (m.Success)
                    AssignFilterParameterValue(m.Groups[3].Value);
            }
        }

        private void AddComputedExpressions(SelectClauseDictionary expressions, ViewPage page, CommandConfigurationType commandConfiguration, bool generateFormula)
        {
            var useFormulaAsIs = ((commandConfiguration == CommandConfigurationType.Insert) || (commandConfiguration == CommandConfigurationType.Update));
            foreach (var field in page.Fields)
                if (!(string.IsNullOrEmpty(field.Formula)))
                {
                    if (useFormulaAsIs)
                        expressions[field.ExpressionName()] = field.Formula;
                    else
                        expressions[field.ExpressionName()] = string.Format("({0})", field.Formula);
                }
                else
                {
                    if (generateFormula && field.Type != "DataView")
                    {
                        if (useFormulaAsIs)
                            expressions[field.ExpressionName()] = field.Name;
                        else
                            expressions[field.ExpressionName()] = string.Format("({0})", field.Name);
                    }
                }
        }

        private bool ConfigureCommandForDelete(DbCommand command, ViewPage page, SelectClauseDictionary expressions, string tableName, FieldValue[] values)
        {
            var sb = new StringBuilder();
            sb.AppendFormat("delete from {0}", tableName);
            AppendWhereExpressions(sb, command, page, expressions, values);
            command.CommandText = sb.ToString();
            return true;
        }

        protected virtual bool SupportsInsertWithDefaultValues()
        {
            return true;
        }

        private bool ConfigureCommandForInsert(DbCommand command, ViewPage page, SelectClauseDictionary expressions, string tableName, FieldValue[] values)
        {
            var sb = new StringBuilder();
            sb.AppendFormat("insert into {0}", tableName);
            var firstField = true;
            foreach (var v in values)
            {
                var field = page.FindField(v.Name);
                if (IsFieldInsertable(field) && v.Modified)
                {
                    sb.AppendLine();
                    if (firstField)
                    {
                        sb.Append(" (");
                        firstField = false;
                    }
                    else
                        sb.Append(",");
                    sb.AppendFormat(RemoveTableAliasFromExpression(expressions[v.Name]));
                }
            }
            if (firstField)
            {
                if (SupportsInsertWithDefaultValues())
                    sb.Append(" default values");
                else
                    return false;
            }
            else
            {
                sb.AppendLine(")");
                sb.AppendLine("values(");
                firstField = true;
                foreach (var v in values)
                {
                    var field = page.FindField(v.Name);
                    if (IsFieldInsertable(field) && v.Modified)
                    {
                        sb.AppendLine();
                        if (firstField)
                            firstField = false;
                        else
                            sb.Append(",");
                        if ((v.NewValue == null) && field.HasDefaultValue)
                            sb.Append(field.DefaultValue);
                        else
                        {
                            sb.AppendFormat("{0}p{1}", _parameterMarker, command.Parameters.Count);
                            var parameter = command.CreateParameter();
                            parameter.ParameterName = string.Format("{0}p{1}", _parameterMarker, command.Parameters.Count);
                            AssignParameterValue(parameter, field.Type, v.NewValue);
                            command.Parameters.Add(parameter);
                        }
                    }
                }
                sb.AppendLine(")");
            }
            command.CommandText = sb.ToString();
            return true;
        }

        private string RemoveTableAliasFromExpression(string expression)
        {
            // alias extraction regular expression:
            // "[\w\s]+".("[\w\s]+")
            var m = Regex.Match(expression, "\"[\\w\\s]+\".(\"[\\w\\s]+\")");
            if (m.Success)
                return m.Groups[1].Value;
            return expression;
        }

        private bool ConfigureCommandForUpdate(DbCommand command, ViewPage page, SelectClauseDictionary expressions, string tableName, FieldValue[] values)
        {
            var sb = new StringBuilder();
            sb.AppendFormat("update {0} set ", tableName);
            var firstField = true;
            foreach (var v in values)
            {
                var field = page.FindField(v.Name);
                if (IsFieldUpdatable(field) && v.Modified)
                {
                    sb.AppendLine();
                    if (firstField)
                        firstField = false;
                    else
                        sb.Append(",");
                    sb.AppendFormat(RemoveTableAliasFromExpression(expressions[v.Name]));
                    if ((v.NewValue == null) && field.HasDefaultValue)
                        sb.Append(string.Format("={0}", field.DefaultValue));
                    else
                    {
                        sb.AppendFormat("={0}p{1}", _parameterMarker, command.Parameters.Count);
                        var parameter = command.CreateParameter();
                        parameter.ParameterName = string.Format("{0}p{1}", _parameterMarker, command.Parameters.Count);
                        AssignParameterValue(parameter, field.Type, v.NewValue);
                        command.Parameters.Add(parameter);
                    }
                }
            }
            if (firstField)
                return false;
            AppendWhereExpressions(sb, command, page, expressions, values);
            command.CommandText = sb.ToString();
            return true;
        }

        private void ConfigureCommandForSelect(DbCommand command, ViewPage page, SelectClauseDictionary expressions, string fromClause, string whereClause, string orderByClause, CommandConfigurationType commandConfiguration)
        {
            var useServerPaging = ((commandConfiguration != CommandConfigurationType.SelectDistinct && !_serverRules.EnableResultSet) && (commandConfiguration != CommandConfigurationType.SelectAggregates && commandConfiguration != CommandConfigurationType.SelectFirstLetters));
            var useLimit = SupportsLimitInSelect(command);
            var useSkip = SupportsSkipInSelect(command);
            if (useServerPaging)
                page.AcceptAllRows();
            var sb = new StringBuilder();
            if (useLimit || useSkip)
                useServerPaging = false;
            var countUsingHierarchy = false;
            if ((commandConfiguration == CommandConfigurationType.SelectCount) && (useServerPaging && RequiresHierarchy(page)))
            {
                countUsingHierarchy = true;
                commandConfiguration = CommandConfigurationType.Select;
            }
            if (commandConfiguration == CommandConfigurationType.SelectExisting)
                useServerPaging = false;
            if (commandConfiguration == CommandConfigurationType.SelectCount)
            {
                if (page.Distinct)
                {
                    sb.Append("select count(distinct ");
                    AppendSelectExpressions(sb, page, expressions, true, false);
                    sb.AppendLine(")");
                }
                else
                    sb.AppendLine("select count(*)");
            }
            else
            {
                if (useServerPaging)
                    sb.AppendLine("with page_cte__ as (");
                else
                {
                    if ((commandConfiguration == CommandConfigurationType.Sync) && useLimit)
                        sb.Append("select * from (select @row_num := @row_num+1 row_number__,cte__.* from (select @r" +
                                "ow_num:=0) r,(");
                }
                sb.AppendLine("select");
                if (useServerPaging)
                    AppendRowNumberExpression(sb, page, expressions, orderByClause);
                if (commandConfiguration == CommandConfigurationType.SelectDistinct)
                {
                    var distinctField = page.FindField(page.DistinctValueFieldName);
                    var distinctExpression = expressions[distinctField.ExpressionName()];
                    if (distinctField.Type.StartsWith("Date"))
                    {
                        var commandType = command.GetType().ToString();
                        if (commandType == "System.Data.SqlClient.SqlCommand")
                            distinctExpression = string.Format("DATEADD(dd, 0, DATEDIFF(dd, 0, {0}))", distinctExpression);
                        if (commandType == "MySql.Data.MySqlClient.MySqlCommand")
                            distinctExpression = string.Format("cast({0} as date)", distinctExpression);
                    }
                    sb.AppendFormat("distinct {0} \"{1}\"\r\n", distinctExpression, page.DistinctValueFieldName);
                }
                else
                {
                    if (commandConfiguration == CommandConfigurationType.SelectAggregates)
                        AppendAggregateExpressions(sb, page, expressions);
                    else
                    {
                        if (commandConfiguration == CommandConfigurationType.SelectFirstLetters)
                        {
                            var substringFunction = "substring";
                            if (DatabaseEngineIs(command, "Oracle", "DB2"))
                                substringFunction = "substr";
                            AppendFirstLetterExpressions(sb, page, expressions, substringFunction);
                        }
                        else
                        {
                            if ((commandConfiguration == CommandConfigurationType.Select) && useSkip)
                                sb.AppendFormat(" first {0} skip {1}\r\n", page.PageSize, (page.PageSize * page.PageIndex));
                            if ((commandConfiguration == CommandConfigurationType.Sync) && useSkip)
                            {
                                // select only the primary key fields or sync fields
                                var first = true;
                                foreach (var field in page.EnumerateSyncFields())
                                {
                                    if (first)
                                        first = false;
                                    else
                                        sb.Append(",");
                                    sb.Append(expressions[field.ExpressionName()]);
                                }
                            }
                            else
                            {
                                if (commandConfiguration == CommandConfigurationType.SelectExisting)
                                    sb.AppendLine("*");
                                else
                                {
                                    AppendSelectExpressions(sb, page, expressions, !useServerPaging);
                                    if (page.Distinct)
                                    {
                                        sb.Append(", count(*) group_count_");
                                        sb.AppendLine();
                                    }
                                }
                            }
                        }
                    }
                }
            }
            sb.AppendLine("from");
            sb.AppendLine("___from_begin");
            sb.AppendLine(fromClause);
            sb.AppendLine("___from_end");
            _hasWhere = false;
            if (string.IsNullOrEmpty(_viewFilter))
            {
                _viewFilter = _view.GetAttribute("filter", string.Empty);
                if (string.IsNullOrEmpty(_viewFilter) && ((_viewType == "Form") && !(string.IsNullOrEmpty(page.LastView))))
                {
                    var lastView = _config.SelectSingleNode("/c:dataController/c:views/c:view[@id=\'{0}\']", page.LastView);
                    if (lastView != null)
                        _viewFilter = lastView.GetAttribute("filter", string.Empty);
                }
            }
            if (!(string.IsNullOrEmpty(_viewFilter)))
                _viewFilter = string.Format("({0})", _viewFilter);
            if (commandConfiguration == CommandConfigurationType.SelectExisting)
            {
                EnsureWhereKeyword(sb);
                sb.Append(expressions[page.InnerJoinForeignKey.ToLower()]);
                sb.Append("=");
                sb.Append(page.InnerJoinPrimaryKey);
                sb.AppendLine(" and ");
            }
            AppendSystemFilter(command, page, expressions);
            AppendAccessControlRules(command, page, expressions);
            if (((page.Filter != null) && (page.Filter.Length > 0)) || !(string.IsNullOrEmpty(_viewFilter)))
                AppendFilterExpressionsToWhere(sb, page, command, expressions, whereClause);
            else
            {
                if (!(string.IsNullOrEmpty(whereClause)))
                {
                    EnsureWhereKeyword(sb);
                    sb.AppendLine(whereClause);
                }
            }
            if (page.Distinct && CommandConfigurationType.SelectCount != commandConfiguration)
            {
                sb.AppendLine("group by");
                AppendSelectExpressions(sb, page, expressions, true, false);
                sb.AppendLine();
            }
            if (commandConfiguration == CommandConfigurationType.Select)
            {
                var preFetch = RequiresPreFetching(page);
                if (useServerPaging)
                {
                    if (!(ConfigureCTE(sb, page, command, expressions, countUsingHierarchy)))
                        sb.Append(")\r\nselect * from page_cte__ ");
                    if (!countUsingHierarchy)
                    {
                        sb.AppendFormat("where row_number__ > {0}PageRangeFirstRowNumber and row_number__ <= {0}PageRangeL" +
                                "astRowNumber order by row_number__", _parameterMarker);
                        var p = command.CreateParameter();
                        p.ParameterName = (_parameterMarker + "PageRangeFirstRowNumber");
                        p.Value = ((page.PageSize * page.PageIndex)
                                    + page.PageOffset);
                        if (preFetch)
                            p.Value = (((int)(p.Value)) - page.PageSize);
                        command.Parameters.Add(p);
                        var p2 = command.CreateParameter();
                        p2.ParameterName = (_parameterMarker + "PageRangeLastRowNumber");
                        p2.Value = ((page.PageSize
                                    * (page.PageIndex + 1))
                                    + page.PageOffset);
                        if (preFetch)
                            p2.Value = (((int)(p2.Value)) + page.PageSize);
                        command.Parameters.Add(p2);
                    }
                }
                else
                {
                    AppendOrderByExpression(sb, page, expressions, orderByClause);
                    if (useLimit)
                    {
                        sb.AppendFormat("\r\nlimit {0}Limit_PageOffset, {0}Limit_PageSize", _parameterMarker);
                        var p = command.CreateParameter();
                        p.ParameterName = (_parameterMarker + "Limit_PageOffset");
                        p.Value = ((page.PageSize * page.PageIndex)
                                    + page.PageOffset);
                        if (preFetch && (((int)(p.Value)) > page.PageSize))
                            p.Value = (((int)(p.Value)) - page.PageSize);
                        command.Parameters.Add(p);
                        var p2 = command.CreateParameter();
                        p2.ParameterName = (_parameterMarker + "Limit_PageSize");
                        p2.Value = page.PageSize;
                        if (preFetch)
                        {
                            var pagesToFetch = 2;
                            if (((int)(p.Value)) > page.PageSize)
                                pagesToFetch = 3;
                            p2.Value = (page.PageSize * pagesToFetch);
                        }
                        command.Parameters.Add(p2);
                    }
                }
            }
            else
            {
                if (commandConfiguration == CommandConfigurationType.Sync)
                {
                    if (useServerPaging)
                    {
                        if (!(ConfigureCTE(sb, page, command, expressions, false)))
                            sb.Append(")\r\nselect * from page_cte__ ");
                        sb.Append("where ");
                    }
                    else
                    {
                        if (useLimit || useSkip)
                            AppendOrderByExpression(sb, page, expressions, orderByClause);
                        if (!useSkip)
                            sb.Append(") cte__)cte2__ where ");
                    }
                    var first = true;
                    if (!useSkip)
                        foreach (var field in page.EnumerateSyncFields())
                        {
                            if (first)
                                first = false;
                            else
                                sb.AppendFormat(" and ");
                            sb.AppendFormat("{2}{1}{3}={0}PrimaryKey_{1}", _parameterMarker, field.Name, _leftQuote, _rightQuote);
                        }
                }
                else
                {
                    if ((commandConfiguration == CommandConfigurationType.SelectDistinct) || (commandConfiguration == CommandConfigurationType.SelectFirstLetters))
                        sb.Append("order by 1");
                }
            }
            command.CommandText = OptimizeFromClause(sb.ToString(), expressions, page);
            if (commandConfiguration == CommandConfigurationType.Select)
                ApplyFieldFilter(page);
            _viewFilter = null;
        }

        public string OptimizeFromClause(string sql, SelectClauseDictionary expressions, ViewPage page)
        {
            if (page.Filter != null)
                foreach (var f in page.Filter)
                    if (f.StartsWith("_quickfind_:") || (f.EndsWith(":=%js%null") || f.Contains(":$isempty$")))
                        return Regex.Replace(sql, "\\s*___from_(begin|end)\\s*?\\n", "\n");
            var fromClause = Regex.Match(sql, "\\s*___from_begin(?\'From\'[\\s\\S]+?)\\s*___from_end\\s*");
            if (fromClause.Success)
            {
                var fromClauseSql = (fromClause.Groups["From"].Value + "\r\n");
                if (expressions.ReferencedAliases != null)
                    foreach (var a in expressions.ReferencedAliases)
                    {
                        var aliasName = a;
                        while (!(string.IsNullOrEmpty(aliasName)))
                        {
                            var leftJoin = Regex.Match(fromClauseSql, (("left join .+ (\'|\"|\\[|`)" + Regex.Escape(aliasName))
                                            + "(\'|\"|\\|`]) on (\'|\"|\\[)(?\'Alias\'\\w+)(\'|\"|\\|`])\\..+\\n"));
                            if (leftJoin.Success)
                            {
                                fromClauseSql = ((fromClauseSql.Substring(0, leftJoin.Index) + "inner")
                                            + (leftJoin.Value.Substring(4) + fromClauseSql.Substring((leftJoin.Index + leftJoin.Length))));
                                aliasName = leftJoin.Groups["Alias"].Value;
                            }
                            else
                                aliasName = null;
                        }
                    }
                sql = (sql.Substring(0, fromClause.Index)
                            + (fromClauseSql + sql.Substring((fromClause.Index + fromClause.Length))));
            }
            return sql;
        }

        protected virtual bool ConfigureCTE(StringBuilder sb, ViewPage page, DbCommand command, SelectClauseDictionary expressions, bool performCount)
        {
            if (!(RequiresHierarchy(page)))
                return false;
            // detect hierarchy
            DataField primaryKeyField = null;
            DataField parentField = null;
            DataField sortField = null;
            var sortOrder = "asc";
            var hierarchyOrganization = HierarchyOrganizationFieldName;
            foreach (var field in page.Fields)
            {
                if (field.IsPrimaryKey)
                    primaryKeyField = field;
                if (field.IsTagged("hierarchy-parent"))
                    parentField = field;
                else
                {
                    if (field.IsTagged("hierarchy-organization"))
                        hierarchyOrganization = field.Name;
                }
            }
            if (parentField == null)
                return false;
            // select a hierarchy sort field
            if (sortField == null)
            {
                if (!(string.IsNullOrEmpty(page.SortExpression)))
                {
                    var sortExpression = Regex.Match(page.SortExpression, "(?\'FieldName\'\\w+)(\\s+(?\'SortOrder\'asc|desc)?)", RegexOptions.IgnoreCase);
                    if (sortExpression.Success)
                        foreach (var field in page.Fields)
                            if (field.Name == sortExpression.Groups["FieldName"].Value)
                            {
                                sortField = field;
                                sortOrder = sortExpression.Groups["SortOrder"].Value;
                                break;
                            }
                }
                if (sortField == null)
                    foreach (var field in page.Fields)
                        if (!field.Hidden)
                        {
                            sortField = field;
                            break;
                        }
            }
            if (sortField == null)
                sortField = page.Fields[0];
            // append a hierarchical CTE
            var isOracle = DatabaseEngineIs(command, "Oracle");
            sb.AppendLine("),");
            sb.AppendLine("h__(");
            var first = true;
            foreach (var field in page.Fields)
            {
                if (first)
                    first = false;
                else
                    sb.Append(",");
                sb.AppendFormat("{0}{1}{2}", _leftQuote, field.Name, _rightQuote);
                sb.AppendLine();
            }
            sb.AppendFormat(",{0}{1}{2}", _leftQuote, hierarchyOrganization, _rightQuote);
            sb.AppendLine(")as(");
            // top-level of self-referring CTE
            sb.AppendLine("select");
            first = true;
            foreach (var field in page.Fields)
            {
                if (first)
                    first = false;
                else
                    sb.Append(",");
                sb.AppendFormat("h1__.{0}{1}{2}", _leftQuote, field.Name, _rightQuote);
                sb.AppendLine();
            }
            // add top-level hierarchy organization field
            if (isOracle)
                sb.AppendFormat(",lpad(cast(row_number() over (partition by h1__.{0}{1}{2} order by h1__.{0}{3}{2}" +
                        " {4}) as varchar(5)), 5, \'0\') as {0}{5}{2}", _leftQuote, parentField.Name, _rightQuote, sortField.Name, sortOrder, hierarchyOrganization);
            else
                sb.AppendFormat(",cast(right(\'0000\' + cast(row_number() over (partition by h1__.{0}{1}{2} order by" +
                        " h1__.{0}{3}{2} {4}) as varchar), 4) as varchar) as {0}{5}{2}", _leftQuote, parentField.Name, _rightQuote, sortField.Name, sortOrder, hierarchyOrganization);
            // add top-level "from" clause
            sb.AppendLine();
            sb.AppendFormat("from page_cte__ h1__ where h1__.{0}{1}{2} is null ", _leftQuote, parentField.Name, _rightQuote);
            sb.AppendLine();
            sb.AppendLine("union all");
            // sublevel of self-referring CTE
            sb.AppendLine("select");
            first = true;
            foreach (var field in page.Fields)
            {
                if (first)
                    first = false;
                else
                    sb.Append(",");
                sb.AppendFormat("h2__.{0}{1}{2}", _leftQuote, field.Name, _rightQuote);
                sb.AppendLine();
            }
            // add sublevel hierarchy organization field
            if (isOracle)
                sb.AppendFormat(",h__.{0}{5}{2} || \'/\' || lpad(cast(row_number() over (partition by h2__.{0}{1}{2}" +
                        " order by h2__.{0}{3}{2} {4}) as varchar(5)), 5, \'0\') as {0}{5}{2}", _leftQuote, parentField.Name, _rightQuote, sortField.Name, sortOrder, hierarchyOrganization);
            else
                sb.AppendFormat(",convert(varchar, h__.{0}{5}{2} + \'/\' + cast(right(\'0000\' + cast(row_number() ove" +
                        "r (partition by h2__.{0}{1}{2} order by h2__.{0}{3}{2} {4}) as varchar), 4) as v" +
                        "archar)) as {0}{5}{2}", _leftQuote, parentField.Name, _rightQuote, sortField.Name, sortOrder, hierarchyOrganization);
            sb.AppendLine();
            // add sublevel "from" clause
            sb.AppendFormat("from page_cte__ h2__ inner join h__ on h2__.{0}{1}{2} = h__.{0}{3}{2}", _leftQuote, parentField.Name, _rightQuote, primaryKeyField.Name);
            sb.AppendLine();
            sb.AppendLine("),");
            sb.AppendFormat("ho__ as (select row_number() over (order by ({0}{1}{2})) as row_number__, h__.* f" +
                    "rom h__)", _leftQuote, hierarchyOrganization, _rightQuote);
            if (performCount)
                sb.AppendLine("select count(*) from ho__");
            else
                sb.AppendLine("select * from ho__");
            sb.AppendLine();
            return true;
        }

        private void AppendFirstLetterExpressions(StringBuilder sb, ViewPage page, SelectClauseDictionary expressions, string substringFunction)
        {
            foreach (var field in page.Fields)
                if ((!field.Hidden && field.AllowQBE) && (field.Type == "String"))
                {
                    var fieldName = field.AliasName;
                    if (string.IsNullOrEmpty(fieldName))
                        fieldName = field.Name;
                    sb.AppendFormat("distinct {1}({0},1,1) first_letter__\r\n", expressions[fieldName], substringFunction);
                    page.FirstLetters = fieldName;
                    page.RemoveFromFilter(fieldName);
                    break;
                }
        }

        public static void AssignParameterDbType(DbParameter parameter, string systemType)
        {
            if (systemType == "SByte")
                parameter.DbType = DbType.Int16;
            else
            {
                if (systemType == "TimeSpan")
                    parameter.DbType = DbType.String;
                else
                {
                    if ((systemType == "Byte[]") || ((systemType == "Guid") && parameter.GetType().Name.Contains("Oracle")))
                        parameter.DbType = DbType.Binary;
                    else
                        parameter.DbType = ((DbType)(TypeDescriptor.GetConverter(typeof(DbType)).ConvertFrom(systemType)));
                }
            }
        }

        public static void AssignParameterValue(DbParameter parameter, DataField field, object v)
        {
            AssignParameterValue(parameter, field.Type, v);
        }

        public static void AssignParameterValue(DbParameter parameter, string systemType, object v)
        {
            AssignParameterDbType(parameter, systemType);
            if (v == null)
                parameter.Value = DBNull.Value;
            else
            {
                if (parameter.DbType == DbType.String)
                    parameter.Value = v.ToString();
                else
                    parameter.Value = ConvertToType(Controller.TypeMap[systemType], v);
                if ((parameter.DbType == DbType.Binary) && (parameter.Value is Guid))
                    parameter.Value = ((Guid)(parameter.Value)).ToByteArray();
            }
        }

        private void AppendSelectExpressions(StringBuilder sb, ViewPage page, SelectClauseDictionary expressions, bool firstField)
        {
            AppendSelectExpressions(sb, page, expressions, firstField, true);
        }

        private void AppendSelectExpressions(StringBuilder sb, ViewPage page, SelectClauseDictionary expressions, bool firstField, bool autoAlias)
        {
            foreach (var field in page.Fields)
                if ((field.IsPrimaryKey && !page.Distinct) || page.IncludeField(field.Name))
                {
                    if (firstField)
                        firstField = false;
                    else
                        sb.Append(",");
                    try
                    {
                        if (field.OnDemand)
                        {
                            var onDemandExpression = field.ExpressionName();
                            var sourceField = page.FindField(field.SourceFields);
                            if ((sourceField != null) && !sourceField.IsPrimaryKey)
                                onDemandExpression = sourceField.ExpressionName();
                            sb.Append(string.Format("case when {0} is not null then 1 else null end as ", expressions[onDemandExpression]));
                        }
                        else
                            sb.Append(expressions[field.ExpressionName()]);
                    }
                    catch (Exception)
                    {
                        throw new Exception(string.Format("Unknown data field \'{0}\'.", field.Name));
                    }
                    if (autoAlias)
                    {
                        sb.Append(" \"");
                        sb.Append(field.Name);
                        sb.AppendLine("\"");
                    }
                }
        }

        void AppendAggregateExpressions(StringBuilder sb, ViewPage page, SelectClauseDictionary expressions)
        {
            var firstField = true;
            foreach (var field in page.Fields)
            {
                if (firstField)
                    firstField = false;
                else
                    sb.Append(",");
                if (field.Aggregate == DataFieldAggregate.None)
                    sb.Append("null ");
                else
                {
                    var functionName = field.Aggregate.ToString();
                    if (functionName == "Average")
                        functionName = "Avg";
                    var fmt = "{0}({1})";
                    if (functionName == "Count")
                        fmt = "{0}(distinct {1})";
                    sb.AppendFormat(fmt, functionName, expressions[field.ExpressionName()]);
                }
                sb.Append(" \"");
                sb.Append(field.Name);
                sb.AppendLine("\"");
            }
        }

        private void AppendRowNumberExpression(StringBuilder sb, ViewPage page, SelectClauseDictionary expressions, string orderByClause)
        {
            sb.Append("row_number() over (");
            AppendOrderByExpression(sb, page, expressions, orderByClause);
            sb.AppendLine(") as row_number__");
        }

        public virtual bool IsEmptyString(string s)
        {
            return string.IsNullOrEmpty(s);
        }

        public virtual bool IsFieldUpdatable(DataField field)
        {
            return (((field != null) && string.IsNullOrEmpty(field.ItemsTargetController)) && (!field.IsVirtual && !field.ReadOnly));
        }

        public virtual bool IsFieldInsertable(DataField field)
        {
            return ((field != null) && (field.IsPrimaryKey || IsFieldUpdatable(field)));
        }

        private void AppendOrderByExpression(StringBuilder sb, ViewPage page, SelectClauseDictionary expressions, string orderByClause)
        {
            var viewSortExpression = _view.GetAttribute("sortExpression", string.Empty);
            var hasGroupExpression = (!(string.IsNullOrEmpty(page.GroupExpression)) || page.Distinct);
            if (string.IsNullOrEmpty(page.SortExpression))
                page.SortExpression = viewSortExpression;
            else
            {
                if (!(string.IsNullOrEmpty(viewSortExpression)) && (((page.FieldFilter != null) && (page.FieldFilter.Length > 0)) && ((page.FieldFilter[0] == page.SortExpression) && !hasGroupExpression)))
                    page.SortExpression = viewSortExpression;
            }
            if (!hasGroupExpression)
            {
                page.GroupExpression = _view.GetAttribute("groupExpression", string.Empty);
                if (!(string.IsNullOrEmpty(page.GroupExpression)))
                {
                    if (page.SortExpression == null)
                        page.SortExpression = string.Empty;
                }
                var groupBy = new List<string>(BusinessRules.ListRegex.Split(page.GroupExpression.Trim()));
                var sortBy = new List<string>(BusinessRules.ListRegex.Split(page.SortExpression.Trim()));
                groupBy.RemoveAll(IsEmptyString);
                page.GroupExpression = string.Join(",", groupBy.ToArray());
                sortBy.RemoveAll(IsEmptyString);
                var i = 0;
                while (i < groupBy.Count)
                {
                    var groupField = groupBy[i];
                    if (i < sortBy.Count)
                    {
                        var sortField = Regex.Split(sortBy[i], "\\s+");
                        if (!((groupField == sortField[0])))
                            sortBy.Insert(i, groupField);
                    }
                    else
                        sortBy.Insert(i, groupField);
                    i++;
                }
                page.SortExpression = string.Join(",", sortBy.ToArray());
            }
            var hasOrderBy = false;
            sb.Append("order by ");
            if (string.IsNullOrEmpty(page.SortExpression))
            {
                if (!(string.IsNullOrEmpty(orderByClause)))
                {
                    sb.Append(orderByClause);
                    hasOrderBy = true;
                }
            }
            else
            {
                var firstSortField = true;
                var orderByMatch = Regex.Match(page.SortExpression, "\\s*(?\'Alias\'[\\s\\w]+?)\\s*(?\'Order\'\\s(ASC|DESC))?\\s*(,|$)", RegexOptions.IgnoreCase);
                while (orderByMatch.Success)
                {
                    if (firstSortField)
                        firstSortField = false;
                    else
                        sb.Append(",");
                    var fieldName = orderByMatch.Groups["Alias"].Value;
                    if (fieldName.EndsWith("_Mirror"))
                        fieldName = fieldName.Substring(0, (fieldName.Length - 7));
                    sb.Append(expressions[fieldName]);
                    sb.Append(" ");
                    sb.Append(orderByMatch.Groups["Order"].Value);
                    orderByMatch = orderByMatch.NextMatch();
                    hasOrderBy = true;
                }
            }
            var firstKey = !hasOrderBy;
            if (!page.Distinct)
                foreach (var field in page.Fields)
                    if (field.IsPrimaryKey)
                    {
                        if (firstKey)
                            firstKey = false;
                        else
                            sb.Append(",");
                        sb.Append(expressions[field.ExpressionName()]);
                    }
            if (firstKey)
                sb.Append(expressions[page.Fields[0].ExpressionName()]);
        }

        private void EnsurePageFields(ViewPage page, SelectClauseDictionary expressions)
        {
            var statusBar = _config.SelectSingleNode("/c:dataController/c:statusBar");
            if (statusBar != null)
                page.StatusBar = statusBar.Value;
            if (page.Fields.Count == 0)
            {
                var fieldIterator = _config.Select("/c:dataController/c:fields/c:field");
                while (fieldIterator.MoveNext())
                {
                    var fieldName = fieldIterator.Current.GetAttribute("name", string.Empty);
                    if (expressions.ContainsKey(fieldName))
                        page.Fields.Add(new DataField(fieldIterator.Current, Resolver));
                }
            }
            var keyFieldIterator = _config.Select("/c:dataController/c:fields/c:field[@isPrimaryKey=\'true\' or @hidden=\'true\']");
            while (keyFieldIterator.MoveNext())
            {
                var fieldName = keyFieldIterator.Current.GetAttribute("name", string.Empty);
                if (!(page.ContainsField(fieldName)))
                    page.Fields.Add(new DataField(keyFieldIterator.Current, Resolver, true));
            }
            var aliasIterator = _view.Select(".//c:dataFields/c:dataField/@aliasFieldName", Resolver);
            while (aliasIterator.MoveNext())
            {
                var aliasField = page.FindField(aliasIterator.Current.Value);
                if (aliasField == null)
                {
                    var fieldIterator = _config.Select("/c:dataController/c:fields/c:field[@name=\'{0}\']", aliasIterator.Current.Value);
                    if (fieldIterator.MoveNext())
                        page.Fields.Add(new DataField(fieldIterator.Current, Resolver, true));
                }
                else
                    aliasField.Hidden = true;
            }
            var groupExpression = _view.GetAttribute("groupExpression", string.Empty);
            if (!(string.IsNullOrEmpty(groupExpression)))
                foreach (var groupField in BusinessRules.ListRegex.Split(groupExpression))
                    if (!(string.IsNullOrEmpty(groupField)) && !(page.ContainsField(groupField)))
                    {
                        var groupFieldIterator = _config.Select("/c:dataController/c:fields/c:field[@name=\'{0}\']", groupField);
                        if (groupFieldIterator.MoveNext())
                            page.Fields.Add(new DataField(groupFieldIterator.Current, Resolver, true));
                    }
            var i = 0;
            while (i < page.Fields.Count)
            {
                var field = page.Fields[i];
                if ((!field.FormatOnClient && !(string.IsNullOrEmpty(field.DataFormatString))) && !field.IsMirror)
                {
                    page.Fields.Insert((i + 1), new DataField(field));
                    i = (i + 2);
                }
                else
                    i++;
            }
            var dynamicConfigIterator = _config.Select("/c:dataController/c:fields/c:field[c:configuration!=\'\']/c:configuration|/c:dataCo" +
                    "ntroller/c:fields/c:field/c:items[@copy!=\'\']/@copy");
            while (dynamicConfigIterator.MoveNext())
            {
                var dynamicConfig = Regex.Match(dynamicConfigIterator.Current.Value, "(\\w+)=(\\w+)");
                while (dynamicConfig.Success)
                {
                    var groupIndex = 2;
                    if (dynamicConfigIterator.Current.Name == "copy")
                        groupIndex = 1;
                    if (!(page.ContainsField(dynamicConfig.Groups[groupIndex].Value)))
                    {
                        var nav = _config.SelectSingleNode("/c:dataController/c:fields/c:field[@name=\'{0}\']", dynamicConfig.Groups[1].Value);
                        if (nav != null)
                            page.Fields.Add(new DataField(nav, Resolver, true));
                    }
                    dynamicConfig = dynamicConfig.NextMatch();
                }
            }
            foreach (var field in page.Fields)
                ConfigureDataField(page, field);
            if (page.RequiresSiteContentText && (page.Controller == ApplicationServices.SiteContentControllerName))
            {
                var siteContentTextFieldName = ApplicationServices.Current.SiteContentFieldName(SiteContentFields.Text);
                if (page.FindField(siteContentTextFieldName) == null)
                {
                    var field = new DataField()
                    {
                        Name = siteContentTextFieldName,
                        Type = "String"
                    };
                    page.Fields.Add(field);
                }
            }
        }

        private SelectClauseDictionary ParseSelectExpressions(string selectClause)
        {
            var expressions = new SelectClauseDictionary();
            var fieldMatch = SelectExpressionRegex.Match(selectClause);
            while (fieldMatch.Success)
            {
                var expression = fieldMatch.Groups["Expression"].Value;
                var fieldName = fieldMatch.Groups["FieldName"].Value;
                var aliasField = fieldMatch.Groups["Alias"].Value;
                if (!(string.IsNullOrEmpty(expression)))
                {
                    if (string.IsNullOrEmpty(aliasField))
                    {
                        if (string.IsNullOrEmpty(fieldName))
                            aliasField = expression;
                        else
                            aliasField = fieldName;
                    }
                    if (!(expressions.ContainsKey(aliasField)))
                        expressions.Add(aliasField, expression);
                }
                fieldMatch = fieldMatch.NextMatch();
            }
            return expressions;
        }

        protected void PopulatePageFields(ViewPage page)
        {
            if (page.Fields.Count > 0)
                return;
            var dataFieldIterator = _view.Select(".//c:dataFields/c:dataField", Resolver);
            while (dataFieldIterator.MoveNext())
            {
                var fieldIterator = _config.Select("/c:dataController/c:fields/c:field[@name=\'{0}\']", dataFieldIterator.Current.GetAttribute("fieldName", string.Empty));
                if (fieldIterator.MoveNext())
                {
                    var field = new DataField(fieldIterator.Current, Resolver)
                    {
                        Hidden = (dataFieldIterator.Current.GetAttribute("hidden", string.Empty) == "true")
                    };
                    var formatOnClient = dataFieldIterator.Current.GetAttribute("formatOnClient", string.Empty);
                    if (!(string.IsNullOrEmpty(formatOnClient)))
                        field.FormatOnClient = formatOnClient != "false";
                    if (string.IsNullOrEmpty(field.DataFormatString))
                        field.DataFormatString = dataFieldIterator.Current.GetAttribute("dataFormatString", string.Empty);
                    field.HeaderText = ((string)(dataFieldIterator.Current.Evaluate("string(c:headerText)", Resolver)));
                    field.FooterText = ((string)(dataFieldIterator.Current.Evaluate("string(c:footerText)", Resolver)));
                    field.ToolTip = dataFieldIterator.Current.GetAttribute("toolTip", string.Empty);
                    field.Watermark = dataFieldIterator.Current.GetAttribute("watermark", string.Empty);
                    field.HyperlinkFormatString = dataFieldIterator.Current.GetAttribute("hyperlinkFormatString", string.Empty);
                    field.AliasName = dataFieldIterator.Current.GetAttribute("aliasFieldName", string.Empty);
                    field.Tag = dataFieldIterator.Current.GetAttribute("tag", string.Empty);
                    if (!(string.IsNullOrEmpty(dataFieldIterator.Current.GetAttribute("allowQBE", string.Empty))))
                        field.AllowQBE = (dataFieldIterator.Current.GetAttribute("allowQBE", string.Empty) == "true");
                    if (!(string.IsNullOrEmpty(dataFieldIterator.Current.GetAttribute("allowSorting", string.Empty))))
                        field.AllowSorting = (dataFieldIterator.Current.GetAttribute("allowSorting", string.Empty) == "true");
                    field.CategoryIndex = Convert.ToInt32(dataFieldIterator.Current.Evaluate("count(parent::c:dataFields/parent::c:category/preceding-sibling::c:category)", Resolver));
                    var columns = dataFieldIterator.Current.GetAttribute("columns", string.Empty);
                    if (!(string.IsNullOrEmpty(columns)))
                        field.Columns = Convert.ToInt32(columns);
                    var rows = dataFieldIterator.Current.GetAttribute("rows", string.Empty);
                    if (!(string.IsNullOrEmpty(rows)))
                        field.Rows = Convert.ToInt32(rows);
                    var textMode = dataFieldIterator.Current.GetAttribute("textMode", string.Empty);
                    if (!(string.IsNullOrEmpty(textMode)))
                        field.TextMode = ((TextInputMode)(TypeDescriptor.GetConverter(typeof(TextInputMode)).ConvertFromString(textMode)));
                    var maskType = fieldIterator.Current.GetAttribute("maskType", string.Empty);
                    if (!(string.IsNullOrEmpty(maskType)))
                        field.MaskType = ((DataFieldMaskType)(TypeDescriptor.GetConverter(typeof(DataFieldMaskType)).ConvertFromString(maskType)));
                    field.Mask = fieldIterator.Current.GetAttribute("mask", string.Empty);
                    var isReadOnly = dataFieldIterator.Current.GetAttribute("readOnly", string.Empty);
                    if (!(string.IsNullOrEmpty(isReadOnly)))
                        field.ReadOnly = (isReadOnly == "true");
                    var aggregate = dataFieldIterator.Current.GetAttribute("aggregate", string.Empty);
                    if (!(string.IsNullOrEmpty(aggregate)))
                        field.Aggregate = ((DataFieldAggregate)(TypeDescriptor.GetConverter(typeof(DataFieldAggregate)).ConvertFromString(aggregate)));
                    var search = dataFieldIterator.Current.GetAttribute("search", string.Empty);
                    if (!(string.IsNullOrEmpty(search)))
                    {
                        var searchMode = ((FieldSearchMode)(TypeDescriptor.GetConverter(typeof(FieldSearchMode)).ConvertFromString(search)));
                        if (ApplicationServices.IsTouchClient)
                            field.Tag = (field.Tag
                                        + (" search-mode-" + searchMode.ToString().ToLower()));
                        else
                            field.Search = searchMode;
                    }
                    field.SearchOptions = dataFieldIterator.Current.GetAttribute("searchOptions", string.Empty);
                    var prefixLength = dataFieldIterator.Current.GetAttribute("autoCompletePrefixLength", string.Empty);
                    if (!(string.IsNullOrEmpty(prefixLength)))
                        field.AutoCompletePrefixLength = Convert.ToInt32(prefixLength);
                    var itemsIterator = dataFieldIterator.Current.Select("c:items[c:item]", Resolver);
                    if (!(itemsIterator.MoveNext()))
                    {
                        itemsIterator = fieldIterator.Current.Select("c:items", Resolver);
                        if (!(itemsIterator.MoveNext()))
                            itemsIterator = null;
                    }
                    if (itemsIterator != null)
                    {
                        field.ItemsDataController = itemsIterator.Current.GetAttribute("dataController", string.Empty);
                        field.ItemsDataView = itemsIterator.Current.GetAttribute("dataView", string.Empty);
                        field.ItemsDataValueField = itemsIterator.Current.GetAttribute("dataValueField", string.Empty);
                        field.ItemsDataTextField = itemsIterator.Current.GetAttribute("dataTextField", string.Empty);
                        field.ItemsStyle = itemsIterator.Current.GetAttribute("style", string.Empty);
                        if (field.ItemsStyle == "Actions")
                            field.IsVirtual = true;
                        field.ItemsNewDataView = itemsIterator.Current.GetAttribute("newDataView", string.Empty);
                        field.ItemsTargetController = itemsIterator.Current.GetAttribute("targetController", string.Empty);
                        field.Copy = itemsIterator.Current.GetAttribute("copy", string.Empty);
                        var pageSize = itemsIterator.Current.GetAttribute("pageSize", string.Empty);
                        if (!(string.IsNullOrEmpty(pageSize)))
                            field.ItemsPageSize = Convert.ToInt32(pageSize);
                        field.ItemsLetters = (itemsIterator.Current.GetAttribute("letters", string.Empty) == "true");
                        var itemIterator = itemsIterator.Current.Select("c:item", Resolver);
                        while (itemIterator.MoveNext())
                        {
                            var itemValue = itemIterator.Current.GetAttribute("value", string.Empty);
                            if (itemValue == "NULL")
                                itemValue = string.Empty;
                            var itemText = itemIterator.Current.GetAttribute("text", string.Empty);
                            field.Items.Add(new object[] {
                                        itemValue,
                                        itemText});
                        }
                        if (!(string.IsNullOrEmpty(field.ItemsNewDataView)) && (((ActionArgs.Current == null) || (ActionArgs.Current.Controller == field.ItemsDataController)) && ((PageRequest.Current == null) || (PageRequest.Current.Controller == field.ItemsDataController))))
                        {
                            var itemsController = ((Controller)(this.GetType().Assembly.CreateInstance(this.GetType().FullName)));
                            itemsController.SelectView(field.ItemsDataController, field.ItemsNewDataView);
                            var roles = ((string)(itemsController._config.Evaluate("string(//c:action[@commandName=\'New\' and @commandArgument=\'{0}\'][1]/@roles)", field.ItemsNewDataView)));
                            if (!(Controller.UserIsInRole(roles)))
                                field.ItemsNewDataView = null;
                        }
                        field.AutoSelect = (itemsIterator.Current.GetAttribute("autoSelect", string.Empty) == "true");
                        field.SearchOnStart = (itemsIterator.Current.GetAttribute("searchOnStart", string.Empty) == "true");
                        field.ItemsDescription = itemsIterator.Current.GetAttribute("description", string.Empty);
                    }
                    if (!(Controller.UserIsInRole(fieldIterator.Current.GetAttribute("writeRoles", string.Empty))))
                        field.ReadOnly = true;
                    if (!(Controller.UserIsInRole(fieldIterator.Current.GetAttribute("roles", string.Empty))))
                    {
                        field.ReadOnly = true;
                        field.Hidden = true;
                    }
                    page.Fields.Add(field);
                    // populate DataView field properties
                    var dataViewNav = dataFieldIterator.Current.SelectSingleNode("c:dataView", Resolver);
                    if (dataViewNav != null)
                    {
                        field.DataViewShowInSummary = (dataViewNav.GetAttribute("showInSummary", string.Empty) == "true");
                        field.DataViewShowActionBar = !((dataViewNav.GetAttribute("showActionBar", string.Empty) == "false"));
                        field.DataViewShowActionButtons = dataViewNav.GetAttribute("showActionButtons", string.Empty);
                        field.DataViewShowDescription = !((dataViewNav.GetAttribute("showDescription", string.Empty) == "false"));
                        field.DataViewShowViewSelector = !((dataViewNav.GetAttribute("showViewSelector", string.Empty) == "false"));
                        field.DataViewShowModalForms = (dataViewNav.GetAttribute("showModalForms", string.Empty) == "true");
                        field.DataViewSearchByFirstLetter = (dataViewNav.GetAttribute("searchByFirstLetter", string.Empty) == "true");
                        field.DataViewSearchOnStart = (dataViewNav.GetAttribute("searchOnStart", string.Empty) == "true");
                        var pageSize = dataViewNav.GetAttribute("pageSize", string.Empty);
                        if (!(string.IsNullOrEmpty(pageSize)))
                            field.DataViewPageSize = Convert.ToInt32(pageSize);
                        field.DataViewMultiSelect = (dataViewNav.GetAttribute("multiSelect", string.Empty) == "true");
                        field.DataViewShowPager = dataViewNav.GetAttribute("showPager", string.Empty);
                        field.DataViewShowPageSize = !((dataViewNav.GetAttribute("showPageSize", string.Empty) == "false"));
                        field.DataViewShowSearchBar = !((dataViewNav.GetAttribute("showSearchBar", string.Empty) == "false"));
                        field.DataViewShowQuickFind = !((dataViewNav.GetAttribute("showQuickFind", string.Empty) == "false"));
                        field.DataViewShowRowNumber = (dataViewNav.GetAttribute("showRowNumber", string.Empty) == "true");
                        field.DataViewAutoSelectFirstRow = (dataViewNav.GetAttribute("autoSelectFirstRow", string.Empty) == "true");
                        field.DataViewAutoHighlightFirstRow = (dataViewNav.GetAttribute("autoHighlightFirstRow", string.Empty) == "true");
                        var refreshInterval = dataViewNav.GetAttribute("refreshInterval", string.Empty);
                        if (!(string.IsNullOrEmpty(refreshInterval)))
                            field.DataViewRefreshInterval = Convert.ToInt32(refreshInterval);
                    }
                    // populate pivot info
                    if (page.RequiresPivot)
                    {
                        if ((page.PivotDefinitions != null) && (page.PivotDefinitions.Count > 0))
                        {
                            field.Tag = string.Empty;
                            if (page.PivotDefinitions.ContainsKey(field.Name))
                                field.Tag = page.PivotDefinitions[field.Name];
                        }
                        foreach (var tag in field.Tag.Split(' '))
                            if (tag.StartsWith("pivot"))
                            {
                                page.AddPivotField(field);
                                break;
                            }
                    }
                }
            }
        }

        protected virtual void ConfigureDataField(ViewPage page, DataField field)
        {
        }

        public static string LookupText(string controllerName, string filterExpression, string fieldNames)
        {
            var dataTextFields = fieldNames.Split(',');
            var request = new PageRequest(-1, 1, null, new string[] {
                        filterExpression});
            var page = ControllerFactory.CreateDataController().GetPage(controllerName, string.Empty, request);
            var result = string.Empty;
            if (page.Rows.Count > 0)
                for (var i = 0; (i < page.Fields.Count); i++)
                {
                    var field = page.Fields[i];
                    if (Array.IndexOf(dataTextFields, field.Name) >= 0)
                    {
                        if (result.Length > 0)
                            result = (result + "; ");
                        result = (result + Convert.ToString(page.Rows[0][i]));
                    }
                }
            return result;
        }

        public static string ConvertSampleToQuery(string sample)
        {
            var m = Regex.Match(sample, "^\\s*(?\'Operation\'(<|>)={0,1}){0,1}\\s*(?\'Value\'.+)\\s*$");
            if (!m.Success)
                return null;
            var operation = m.Groups["Operation"].Value;
            sample = m.Groups["Value"].Value.Trim();
            if (string.IsNullOrEmpty(operation))
            {
                operation = "*";
                double doubleTest;
                if (Double.TryParse(sample, out doubleTest))
                    operation = "=";
                else
                {
                    bool boolTest;
                    if (Boolean.TryParse(sample, out boolTest))
                        operation = "=";
                    else
                    {
                        DateTime dateTest;
                        if (DateTime.TryParse(sample, out dateTest))
                            operation = "=";
                    }
                }
            }
            return string.Format("{0}{1}{2}", operation, sample, Convert.ToChar(0));
        }

        public static string LookupActionArgument(string controllerName, string commandName)
        {
            var c = new Controller();
            c.SelectView(controllerName, null);
            var action = c._config.SelectSingleNode("//c:action[@commandName=\'{0}\' and contains(@commandArgument, \'Form\')]", commandName);
            if (action == null)
                return null;
            if (!(UserIsInRole(action.GetAttribute("roles", string.Empty))))
                return null;
            return action.GetAttribute("commandArgument", string.Empty);
        }

        public static string CreateReportInstance(Type t, string name, string controller, string view)
        {
            return CreateReportInstance(t, name, controller, view, true);
        }

        public static string CreateReportInstance(Type t, string name, string controller, string view, bool validate)
        {
            if (string.IsNullOrEmpty(name))
            {
                var instance = CreateReportInstance(t, string.Format("{0}_{1}.rdlc", controller, view), controller, view, false);
                if (!(string.IsNullOrEmpty(instance)))
                    return instance;
                instance = CreateReportInstance(t, "CustomTemplate.xslt", controller, view, false);
                if (!(string.IsNullOrEmpty(instance)))
                    return instance;
                name = "Template.xslt";
            }
            var isGeneric = (Path.GetExtension(name).ToLower() == ".xslt");
            var reportKey = ("Report_" + name);
            if (isGeneric)
                reportKey = string.Format("Reports_{0}_{1}", controller, view);
            string report = null;
            // try loading a report as a resource or from the folder ~/Reports/
            if (t == null)
                t = typeof(MyCompany.Data.Controller);
            var res = ControllerConfigurationUtility.GetResourceStream(string.Format("MyCompany.Reports.{0}", name), string.Format("MyCompany.{0}", name));
            if (res == null)
            {
                var templatePath = Path.Combine(Path.Combine(HttpRuntime.AppDomainAppPath, "Reports"), name);
                if (!(File.Exists(templatePath)))
                {
                    if (validate)
                        throw new Exception(string.Format("Report or report template \\\'{0}\\\' does not exist.", name));
                    else
                        return null;
                }
                report = File.ReadAllText(templatePath);
            }
            else
            {
                var reader = new StreamReader(res);
                report = reader.ReadToEnd();
                reader.Close();
            }
            if (isGeneric)
            {
                // transform a data controller into a report by applying the specified template
                var config = MyCompany.Data.Controller.CreateConfigurationInstance(t, controller);
                var arguments = new XsltArgumentList();
                arguments.AddParam("ViewName", string.Empty, view);
                var transform = new XslCompiledTransform();
                transform.Load(new XPathDocument(new StringReader(report)));
                var output = new MemoryStream();
                transform.Transform(config.TrimmedNavigator, arguments, output);
                output.Position = 0;
                var sr = new StreamReader(output);
                report = sr.ReadToEnd();
                sr.Close();
            }
            report = Regex.Replace(report, "(<Language>)(.+?)(</Language>)", string.Format("$1{0}$3", System.Threading.Thread.CurrentThread.CurrentUICulture.Name));
            report = Localizer.Replace("Reports", name, report);
            return report;
        }

        public static object FindSelectedValueByTag(string tag)
        {
            var selectedValues = JsonConvert.DeserializeObject<object[]>(HttpContext.Current.Request.Form["__WEB_DATAVIEWSTATE"]);
            if (selectedValues != null)
            {
                var i = 0;
                while (i < selectedValues.Length)
                {
                    var k = ((string)(selectedValues[i]));
                    i++;
                    if (k == tag)
                    {
                        var v = ((object[])(selectedValues[i]));
                        if ((v == null) || (v.Length == 0))
                            return null;
                        if (v.Length == 1)
                            return v[0];
                        return v;
                    }
                    i++;
                }
            }
            return null;
        }
    }
}
