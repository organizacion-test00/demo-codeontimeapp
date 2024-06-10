using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Xml;
using System.Xml.XPath;
using System.Linq;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Web;
using System.Web.Caching;
using System.Reflection;
using MyCompany.Services;
using Newtonsoft.Json.Linq;

namespace MyCompany.Data
{
    public class ControllerConfiguration
    {

        private XPathNavigator _navigator;

        private XmlNamespaceManager _namespaceManager;

        private IXmlNamespaceResolver _resolver;

        private string _actionHandlerType;

        private string _dataFilterType;

        private string _handlerType;

        public static Regex VariableDetectionRegex = new Regex("\\$\\w+\\$");

        public static Regex VariableReplacementRegex = new Regex("\\$(\\w+)\\$([\\s\\S]*?)\\$(\\w+)\\$");

        public static Regex LocalizationDetectionRegex = new Regex("\\^\\w+\\^");

        public const string Namespace = "urn:schemas-codeontime-com:data-aquarium";

        private string _connectionStringName;

        private string _controllerName;

        private bool _conflictDetectionEnabled;

        private DynamicExpression[] _expressions;

        private IPlugIn _plugIn;

        private string _rawConfiguration;

        private bool _usesVariables;

        private bool _requiresLocalization;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private SiteContentFileList _pendingAlterations;

        public ControllerConfiguration(string path) :
                this(File.OpenRead(path))
        {
        }

        public ControllerConfiguration(Stream stream)
        {
            var sr = new StreamReader(stream);
            this._rawConfiguration = sr.ReadToEnd();
            sr.Close();
            this._usesVariables = VariableDetectionRegex.IsMatch(this._rawConfiguration);
            this._requiresLocalization = LocalizationDetectionRegex.IsMatch(this._rawConfiguration);
            Initialize(new XPathDocument(new StringReader(this._rawConfiguration)).CreateNavigator());
        }

        public ControllerConfiguration(XPathDocument document) :
                this(document.CreateNavigator())
        {
        }

        public ControllerConfiguration(XPathNavigator navigator)
        {
            Initialize(navigator);
        }

        public string ConnectionStringName
        {
            get
            {
                return _connectionStringName;
            }
        }

        public string ControllerName
        {
            get
            {
                return _controllerName;
            }
        }

        public bool ConflictDetectionEnabled
        {
            get
            {
                return _conflictDetectionEnabled;
            }
        }

        public IXmlNamespaceResolver Resolver
        {
            get
            {
                return _resolver;
            }
        }

        public XPathNavigator Navigator
        {
            get
            {
                return _navigator;
            }
        }

        public DynamicExpression[] Expressions
        {
            get
            {
                return _expressions;
            }
            set
            {
                _expressions = value;
            }
        }

        public IPlugIn PlugIn
        {
            get
            {
                return _plugIn;
            }
        }

        public string RawConfiguration
        {
            get
            {
                return _rawConfiguration;
            }
        }

        public bool UsesVariables
        {
            get
            {
                return _usesVariables;
            }
        }

        public bool RequiresLocalization
        {
            get
            {
                return _requiresLocalization;
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

        public XPathNavigator TrimmedNavigator
        {
            get
            {
                var hiddenFields = new List<string>();
                var fieldIterator = Select("/c:dataController/c:fields/c:field[@roles!=\'\']");
                while (fieldIterator.MoveNext())
                {
                    var roles = fieldIterator.Current.GetAttribute("roles", string.Empty);
                    if (!(DataControllerBase.UserIsInRole(roles)))
                        hiddenFields.Add(fieldIterator.Current.GetAttribute("name", string.Empty));
                }
                if (hiddenFields.Count == 0)
                    return Navigator;
                var doc = new XmlDocument();
                doc.LoadXml(Navigator.OuterXml);
                var nav = doc.CreateNavigator();
                var dataFieldIterator = nav.Select("//c:dataField", Resolver);
                while (dataFieldIterator.MoveNext())
                    if (hiddenFields.Contains(dataFieldIterator.Current.GetAttribute("fieldName", string.Empty)))
                    {
                        var hiddenAttr = dataFieldIterator.Current.SelectSingleNode("@hidden");
                        if (hiddenAttr == null)
                            dataFieldIterator.Current.CreateAttribute(string.Empty, "hidden", string.Empty, "true");
                        else
                            hiddenAttr.SetValue("true");
                    }
                return nav;
            }
        }

        public bool RequiresVirtualization(string controllerName)
        {
            var rules = CreateBusinessRules();
            return ((rules != null) && rules.SupportsVirtualization(controllerName));
        }

        public ControllerConfiguration Virtualize(string controllerName)
        {
            var config = this;
            if (!_navigator.CanEdit)
            {
                var doc = new XmlDocument();
                doc.LoadXml(_navigator.OuterXml);
                config = new ControllerConfiguration(doc.CreateNavigator());
            }
            var rules = CreateBusinessRules();
            if (rules != null)
            {
                rules.VirtualizeController(controllerName, config._navigator, config._namespaceManager);
                config.PendingAlterations = rules.PendingAlterations;
            }
            return config;
        }

        protected virtual void Initialize(XPathNavigator navigator)
        {
            _navigator = navigator;
            _namespaceManager = new XmlNamespaceManager(_navigator.NameTable);
            _namespaceManager.AddNamespace("c", ControllerConfiguration.Namespace);
            _resolver = _namespaceManager;
            ResolveBaseViews();
            _controllerName = ((string)(Evaluate("string(/c:dataController/@name)")));
            _handlerType = ((string)(Evaluate("string(/c:dataController/@handler)")));
            if (string.IsNullOrEmpty(_handlerType))
            {
                var t = ApplicationServices.StringToType("MyCompany.Rules.SharedBusinessRules");
                if (t != null)
                    _handlerType = t.FullName;
            }
            _actionHandlerType = _handlerType;
            _dataFilterType = _handlerType;
            var s = ((string)(Evaluate("string(/c:dataController/@actionHandlerType)")));
            if (!(string.IsNullOrEmpty(s)))
                _actionHandlerType = s;
            s = ((string)(Evaluate("string(/c:dataController/@dataFilterType)")));
            if (!(string.IsNullOrEmpty(s)))
                _dataFilterType = s;
            var plugInType = ((string)(Evaluate("string(/c:dataController/@plugIn)")));
            if (!(string.IsNullOrEmpty(plugInType)) && ApplicationServices.IsTouchClient)
                plugInType = string.Empty;
            if (!(string.IsNullOrEmpty(plugInType)))
            {
                var t = Type.GetType(plugInType);
                _plugIn = ((IPlugIn)(t.Assembly.CreateInstance(t.FullName)));
                _plugIn.Config = this;
            }
        }

        public virtual void Complete()
        {
            _connectionStringName = ((string)(Evaluate("string(/c:dataController/@connectionStringName)")));
            if (string.IsNullOrEmpty(_connectionStringName))
                _connectionStringName = "MyCompany";
            _conflictDetectionEnabled = ((bool)(Evaluate("/c:dataController/@conflictDetection=\'compareAllValues\'")));
            var expressions = new List<DynamicExpression>();
            var expressionIterator = Select("//c:expression[@test!=\'\' or @result!=\'\']");
            while (expressionIterator.MoveNext())
                expressions.Add(new DynamicExpression(expressionIterator.Current, _namespaceManager));
            var ruleIterator = Select("/c:dataController/c:businessRules/c:rule[@type=\'JavaScript\']");
            while (ruleIterator.MoveNext())
            {
                var rule = new DynamicExpression()
                {
                    Type = DynamicExpressionType.ClientScript,
                    Scope = DynamicExpressionScope.Rule
                };
                var ruleNav = ruleIterator.Current;
                rule.Result = string.Format("<id>{0}</id><command>{1}</command><argument>{2}</argument><view>{3}</view><phase>" +
                        "{4}</phase><js>{5}</js>", ruleNav.GetAttribute("id", string.Empty), ruleNav.GetAttribute("commandName", string.Empty), ruleNav.GetAttribute("commandArgument", string.Empty), ruleNav.GetAttribute("view", string.Empty), ruleNav.GetAttribute("phase", string.Empty), ruleNav.Value);
                expressions.Add(rule);
            }
            _expressions = expressions.ToArray();
        }

        private void EnsureChildNode(XPathNavigator parent, string nodeName)
        {
            var child = parent.SelectSingleNode(string.Format("c:{0}", nodeName), _resolver);
            if (child == null)
                parent.AppendChild(string.Format("<{0}/>", nodeName));
        }

        public virtual ControllerConfiguration EnsureVitalElements()
        {
            // verify that the data controller has views and actions
            var root = SelectSingleNode("/c:dataController[c:views/c:view and c:actions/c:actionGroup]");
            if (root != null)
                return this;
            // add missing configuration elements
            var doc = new XmlDocument();
            doc.LoadXml(_navigator.OuterXml);
            var config = new ControllerConfiguration(doc.CreateNavigator());
            var fieldsNode = config.SelectSingleNode("/c:dataController/c:fields[not(c:field[@isPrimaryKey=\'true\'])]");
            if (fieldsNode != null)
                fieldsNode.AppendChild("<field name=\"PrimaryKey\" type=\"Int32\" isPrimaryKey=\"true\" readOnly=\"true\"/>");
            root = config.SelectSingleNode("/c:dataController");
            EnsureChildNode(root, "views");
            var viewsNode = config.SelectSingleNode("/c:dataController/c:views[not(c:view)]");
            if (viewsNode != null)
            {
                var sb = new StringBuilder("<view id=\"view1\" type=\"Form\" label=\"Form\"><categories><category id=\"c1\" flow=\"New" +
                        "Column\"><dataFields>");
                var fieldIterator = config.Select("/c:dataController/c:fields/c:field");
                while (fieldIterator.MoveNext())
                {
                    var fieldName = fieldIterator.Current.GetAttribute("name", string.Empty);
                    var hidden = (fieldName == "PrimaryKey");
                    var length = fieldIterator.Current.GetAttribute("length", string.Empty);
                    if (string.IsNullOrEmpty(length) && (((bool)(fieldIterator.Current.Evaluate("not(c:items/@style!=\'\')", _resolver))) == true))
                    {
                        if (fieldIterator.Current.GetAttribute("type", string.Empty) == "String")
                            length = "50";
                        else
                            length = "20";
                    }
                    sb.AppendFormat("<dataField fieldName=\"{0}\" hidden=\"{1}\"", fieldName, hidden.ToString().ToLower());
                    if (!(string.IsNullOrEmpty(length)))
                        sb.AppendFormat(" columns=\"{0}\"", length);
                    sb.Append(" />");
                }
                sb.Append("</dataFields></category></categories></view>");
                viewsNode.AppendChild(sb.ToString());
            }
            EnsureChildNode(root, "actions");
            var actionsNode = config.SelectSingleNode("/c:dataController/c:actions[not(c:actionGroup)]");
            if (actionsNode != null)
                actionsNode.AppendChild(@"<actionGroup id=""ag1"" scope=""Form"">
<action id=""a1"" commandName=""Confirm"" causesValidation=""true"" whenLastCommandName=""New"" />
<action id=""a2"" commandName=""Cancel"" whenLastCommandName=""New"" />
<action id=""a3"" commandName=""Confirm"" causesValidation=""true"" whenLastCommandName=""Edit"" />
<action id=""a4"" commandName=""Cancel"" whenLastCommandName=""Edit"" />
<action id=""a5"" commandName=""Edit"" causesValidation=""true"" />
</actionGroup>");
            var plugIn = config.SelectSingleNode("/c:dataController/@plugIn");
            if (plugIn != null)
            {
                plugIn.DeleteSelf();
                config._plugIn = null;
            }
            return config;
        }

        protected virtual void ResolveBaseViews()
        {
            var firstUnresolvedView = SelectSingleNode("/c:dataController/c:views/c:view[@baseViewId!=\'\' and not (.//c:dataField)]");
            if (firstUnresolvedView != null)
            {
                var document = new XmlDocument();
                document.LoadXml(_navigator.OuterXml);
                _navigator = document.CreateNavigator();
                var unresolvedViewIterator = Select("/c:dataController/c:views/c:view[@baseViewId!=\'\']");
                while (unresolvedViewIterator.MoveNext())
                {
                    var baseViewId = unresolvedViewIterator.Current.GetAttribute("baseViewId", string.Empty);
                    unresolvedViewIterator.Current.SelectSingleNode("@baseViewId").DeleteSelf();
                    var baseView = SelectSingleNode(string.Format("/c:dataController/c:views/c:view[@id=\'{0}\']", baseViewId));
                    if (baseView != null)
                    {
                        var nodesToDelete = new List<XPathNavigator>();
                        var emptyNodeIterator = unresolvedViewIterator.Current.Select("c:*[not(child::*) and .=\'\']", _resolver);
                        while (emptyNodeIterator.MoveNext())
                            nodesToDelete.Add(emptyNodeIterator.Current.Clone());
                        foreach (var n in nodesToDelete)
                            n.DeleteSelf();
                        var copyNodeIterator = baseView.Select("c:*", _resolver);
                        while (copyNodeIterator.MoveNext())
                            if (unresolvedViewIterator.Current.SelectSingleNode(("c:" + copyNodeIterator.Current.LocalName), _resolver) == null)
                                unresolvedViewIterator.Current.AppendChild(copyNodeIterator.Current.OuterXml);
                    }
                }
                _navigator = new XPathDocument(new StringReader(_navigator.OuterXml)).CreateNavigator();
            }
        }

        private void InitializeHandler(object handler)
        {
            if ((handler != null) && (handler is BusinessRules))
                ((BusinessRules)(handler)).ControllerName = ControllerName;
        }

        public BusinessRules CreateBusinessRules()
        {
            var handler = CreateActionHandler();
            if (handler == null)
                return null;
            else
            {
                var rules = ((BusinessRules)(handler));
                rules.Config = this;
                return rules;
            }
        }

        public IActionHandler CreateActionHandler()
        {
            if (string.IsNullOrEmpty(_actionHandlerType))
                return null;
            else
            {
                var handler = ApplicationServices.CreateInstance(_actionHandlerType);
                InitializeHandler(handler);
                if (handler is BusinessRules)
                    ((BusinessRules)(handler)).Config = this;
                return ((IActionHandler)(handler));
            }
        }

        public IDataFilter CreateDataFilter()
        {
            if (string.IsNullOrEmpty(_dataFilterType))
                return null;
            else
            {
                var dataFilter = ApplicationServices.CreateInstance(_dataFilterType);
                InitializeHandler(dataFilter);
                if (typeof(IDataFilter).IsInstanceOfType(dataFilter))
                    return ((IDataFilter)(dataFilter));
                else
                    return null;
            }
        }

        public IRowHandler CreateRowHandler()
        {
            if (string.IsNullOrEmpty(_actionHandlerType))
                return null;
            else
            {
                var t = Type.GetType(_actionHandlerType);
                var handler = t.Assembly.CreateInstance(t.FullName);
                InitializeHandler(handler);
                if (typeof(IRowHandler).IsInstanceOfType(handler))
                    return ((IRowHandler)(handler));
                else
                    return null;
            }
        }

        public void AssignDynamicExpressions(ViewPage page)
        {
            var list = new List<DynamicExpression>();
            if (page.IncludeMetadata("expressions"))
                foreach (var de in _expressions)
                    if (de.AllowedInView(page.View))
                        list.Add(de);
            page.Expressions = list.ToArray();
        }

        public ControllerConfiguration Clone()
        {
            var variablesPath = Path.Combine(HttpRuntime.AppDomainAppPath, "Controllers\\_variables.xml");
            var variables = ((SortedDictionary<string, string>)(HttpRuntime.Cache[variablesPath]));
            if (variables == null)
            {
                variables = new SortedDictionary<string, string>();
                if (File.Exists(variablesPath))
                {
                    var varDoc = new XPathDocument(variablesPath);
                    var varNav = varDoc.CreateNavigator();
                    var varIterator = varNav.Select("/variables/variable");
                    while (varIterator.MoveNext())
                    {
                        var varName = varIterator.Current.GetAttribute("name", string.Empty);
                        var varValue = varIterator.Current.Value;
                        if (!(variables.ContainsKey(varName)))
                            variables.Add(varName, varValue);
                        else
                            variables[varName] = varValue;
                    }
                }
                HttpRuntime.Cache.Insert(variablesPath, variables, new CacheDependency(variablesPath));
            }
            return new ControllerConfiguration(new XPathDocument(new StringReader(new ControllerConfigurationUtility(_rawConfiguration, variables).ReplaceVariables())));
        }

        public ControllerConfiguration Localize(string controller)
        {
            var localizedContent = Localizer.Replace("Controllers", (controller + ".xml"), _navigator.OuterXml);
            if (PlugIn != null)
            {
                var doc = new XmlDocument();
                doc.LoadXml(localizedContent);
                return new ControllerConfiguration(doc.CreateNavigator());
            }
            else
                return new ControllerConfiguration(new XPathDocument(new StringReader(localizedContent)));
        }

        public XPathNavigator SelectSingleNode(string selector, params System.Object[] args)
        {
            return _navigator.SelectSingleNode(string.Format(selector, args), _resolver);
        }

        public XPathNodeIterator Select(string selector, params System.Object[] args)
        {
            return _navigator.Select(string.Format(selector, args), _resolver);
        }

        public object Evaluate(string selector, params System.Object[] args)
        {
            return _navigator.Evaluate(string.Format(selector, args), _resolver);
        }

        public string ReadActionData(string path)
        {
            if (!(string.IsNullOrEmpty(path)))
            {
                var p = path.Split('/');
                if (p.Length == 2)
                {
                    var dataNav = SelectSingleNode("/c:dataController/c:actions/c:actionGroup[@id=\'{0}\']/c:action[@id=\'{1}\']/c:data", p[0], p[1]);
                    if (dataNav != null)
                        return dataNav.Value;
                }
            }
            return null;
        }

        public void ParseActionData(string path, SortedDictionary<string, string> variables)
        {
            var data = ReadActionData(path);
            if (!(string.IsNullOrEmpty(data)))
            {
                var m = Regex.Match(data, "^\\s*(\\w+)\\s*=\\s*(.+?)\\s*$", RegexOptions.Multiline);
                while (m.Success)
                {
                    variables[m.Groups[1].Value] = m.Groups[2].Value;
                    m = m.NextMatch();
                }
            }
        }

        public string LoadLayout(string view)
        {
            string viewLayout = null;
            // load the view layout
            var fileName = string.Format("{0}.{1}.html", this.ControllerName, view);
            var tryLoad = true;
            while (tryLoad)
            {
                fileName = Path.Combine(Path.Combine(HttpRuntime.AppDomainAppPath, "Views"), fileName);
                if (File.Exists(fileName))
                    viewLayout = File.ReadAllText(fileName);
                else
                {
                    var stream = GetType().Assembly.GetManifestResourceStream(string.Format("MyCompany.Views.{0}.{1}.html", this.ControllerName, view));
                    if (stream != null)
                    {
                        using (var sr = new StreamReader(stream))
                            viewLayout = sr.ReadToEnd();
                    }
                }
                if ((viewLayout != null) && Regex.IsMatch(viewLayout, "^\\s*\\w+\\.\\w+\\.html\\s*$", RegexOptions.IgnoreCase))
                    fileName = viewLayout;
                else
                    tryLoad = false;
            }
            return viewLayout;
        }

        public string ToJson()
        {
            var config = this.Virtualize(this.ControllerName);
            Complete();
            var ruleIterator = config.Select("/c:dataController/c:businessRules/c:rule");
            var newOnServer = false;
            var calculateOnServer = false;
            while (ruleIterator.MoveNext())
            {
                var type = ruleIterator.Current.GetAttribute("type", string.Empty);
                var commandName = ruleIterator.Current.GetAttribute("commandName", string.Empty);
                if (type != "JavaScript")
                {
                    if ((commandName == "New") && !newOnServer)
                    {
                        newOnServer = true;
                        config.SelectSingleNode("/c:dataController").CreateAttribute(string.Empty, "newOnServer", null, "true");
                    }
                    else
                    {
                        if ((commandName == "Calculate") && !calculateOnServer)
                        {
                            calculateOnServer = true;
                            config.SelectSingleNode("/c:dataController").CreateAttribute(string.Empty, "calculateOnServer", null, "true");
                        }
                    }
                }
            }
            var expressions = JArray.FromObject(this.Expressions).ToString();
            var exceptions = new string[] {
                    "//comment()",
                    "c:dataController/c:commands",
                    "c:dataController/@handler",
                    "//c:field/c:formula",
                    "//c:businessRules/c:rule[@type=\"Code\" or @type=\"Sql\" or @type=\"Email\"]",
                    "//c:businessRules/c:rule/text()",
                    "//c:validate",
                    "//c:styles",
                    "//c:visibility",
                    "//c:readOnly",
                    "//c:expression",
                    "//c:blobAdapterConfig"};
            foreach (var ex in exceptions)
            {
                var toDelete = new List<XPathNavigator>();
                var iterator = config.Select(ex);
                while (iterator.MoveNext())
                    toDelete.Add(iterator.Current.Clone());
                foreach (var node in toDelete)
                    node.DeleteSelf();
            }
            // special case of items/item serialization
            var itemsIterator = config.Select("//c:items[c:item]");
            while (itemsIterator.MoveNext())
            {
                var lovBuilder = new StringBuilder("<list>");
                var itemIterator = itemsIterator.Current.SelectChildren(XPathNodeType.Element);
                while (itemIterator.MoveNext())
                    lovBuilder.Append(itemIterator.Current.OuterXml);
                lovBuilder.Append("</list>");
                itemsIterator.Current.InnerXml = lovBuilder.ToString();
            }
            // load custom view layouts
            var viewIterator = config.Select("//c:views/c:view");
            while (viewIterator.MoveNext())
            {
                var layout = LoadLayout(viewIterator.Current.GetAttribute("id", string.Empty));
                if (!(string.IsNullOrEmpty(layout)))
                    viewIterator.Current.AppendChild(string.Format("<layout><![CDATA[{0}]]></layout>", layout));
            }
            // extend JSON with "expressions"
            var json = XmlConverter.ToJson(config.Navigator, "dataController", true, true, "commands", "output", "fields", "views", "categories", "dataFields", "actions", "actionGroup", "businessRules", "list");
            var eof = Regex.Match(json, "\\}\\s*\\}\\s*$");
            json = (json.Substring(0, eof.Index)
                        + (",\"expressions\":"
                        + (expressions + eof.Value)));
            return json;
        }
    }

    public class ControllerConfigurationUtility
    {

        private static SortedDictionary<string, string> _assemblyResources;

        private string _rawConfiguration;

        private SortedDictionary<string, string> _variables;

        static ControllerConfigurationUtility()
        {
            _assemblyResources = new SortedDictionary<string, string>();
            var a = typeof(ControllerConfigurationUtility).Assembly;
            foreach (var resource in a.GetManifestResourceNames())
                _assemblyResources[resource.ToLowerInvariant()] = resource;
        }

        public ControllerConfigurationUtility(string rawConfiguration, SortedDictionary<string, string> variables)
        {
            _rawConfiguration = rawConfiguration;
            _variables = variables;
        }

        public string ReplaceVariables()
        {
            return ControllerConfiguration.VariableReplacementRegex.Replace(_rawConfiguration, DoReplace);
        }

        private string DoReplace(Match m)
        {
            if (m.Groups[1].Value == m.Groups[3].Value)
            {
                string s = null;
                if (_variables.TryGetValue(m.Groups[1].Value, out s))
                    return s;
                else
                    return m.Groups[2].Value;
            }
            return m.Value;
        }

        public static Stream GetResourceStream(params string[] resourceNames)
        {
            string name = null;
            return GetResourceStream(out name, resourceNames);
        }

        public static Stream GetResourceStream(out string resourceName, params string[] resourceNames)
        {
            var a = typeof(ControllerConfigurationUtility).Assembly;
            resourceName = null;
            foreach (var resource in resourceNames)
                if (_assemblyResources.TryGetValue(resource.ToLowerInvariant(), out resourceName))
                    return a.GetManifestResourceStream(resourceName);
            return null;
        }

        public static string GetResourceText(params string[] resourceNames)
        {
            var name = string.Empty;
            var res = GetResourceStream(out name, resourceNames);
            if (res == null)
                return null;
            using (var sr = new StreamReader(res))
                return Localizer.Replace(string.Empty, name, sr.ReadToEnd());
        }

        public static string GetFilePath(params string[] paths)
        {
            foreach (var path in paths)
                if (File.Exists(path))
                    return path;
            return null;
        }

        public static string GetFileText(params string[] paths)
        {
            var p = GetFilePath(paths);
            if (!(string.IsNullOrEmpty(p)))
                return Localizer.Replace(Path.GetDirectoryName(p), Path.GetFileName(p), File.ReadAllText(p));
            return null;
        }
    }

    public class XmlConverter
    {

        private XPathNavigator _navigator;

        private string[] _arrays = null;

        private bool _renderMetadata = false;

        private string _root;

        private StringBuilder _sb;

        private bool _explicitElementValues;

        public XmlConverter(XPathNavigator navigator, string root, bool metadata, bool explicitElementValues, string[] arrays)
        {
            _navigator = navigator;
            _root = root;
            _renderMetadata = metadata;
            _arrays = arrays;
            _explicitElementValues = explicitElementValues;
            if (string.IsNullOrEmpty(root))
            {
                // cycle to the first element with a name
                while (string.IsNullOrEmpty(navigator.Name) && navigator.MoveToFirstChild())
                {
                }
                _root = navigator.Name;
            }
        }

        public static string ToJson(XPathNavigator navigator, string root, bool metadata, bool explicitElementValues, params System.String[] arrays)
        {
            var xmlc = new XmlConverter(navigator, root, metadata, explicitElementValues, arrays);
            return xmlc.ToJson();
        }

        public string ToJson()
        {
            var nav = _navigator;
            _sb = new StringBuilder("{\n");
            while (nav.Name != _root && nav.MoveToFirstChild())
            {
            }
            XmlToJson(nav, false, 1);
            _sb.AppendLine("\n}");
            return _sb.ToString();
        }

        private void WriteJsonValue(XPathNavigator nav)
        {
            var v = nav.ToString();
            int tempInt32;
            if (int.TryParse(v, out tempInt32))
                _sb.Append(tempInt32);
            else
            {
                bool tempBool;
                if (bool.TryParse(v, out tempBool))
                    _sb.Append(tempBool.ToString().ToLower());
                else
                    _sb.Append(HttpUtility.JavaScriptStringEncode(v, true));
            }
        }

        private void WriteMultilineValue(XPathNavigator nav)
        {
            string type = null;
            var props = nav.CreateNavigator();
            var keepGoing = true;
            while (keepGoing)
            {
                props.MoveToParent();
                if (props.MoveToFirstAttribute())
                    keepGoing = false;
            }
            keepGoing = true;
            while (keepGoing)
            {
                if (props.Name == "type")
                    type = props.Value;
                if (!(props.MoveToNextAttribute()))
                    keepGoing = false;
            }
            if (string.IsNullOrEmpty(type))
                WriteJsonValue(nav);
            else
            {
                props.MoveToRoot();
                props.MoveToFirstChild();
                WriteJsonValue(nav);
            }
        }

        private void XmlToJson(XPathNavigator nav, bool isArrayMember, int depth)
        {
            var padding = new string(' ', (depth * 2));
            var isArray = _arrays.Contains(nav.Name);
            var isComplexArray = (isArray && nav.HasAttributes);
            var closingBracket = true;
            var hasAttributes = nav.HasAttributes;
            var isEmpty = ((!hasAttributes && !nav.HasChildren) && (nav.IsEmptyElement || string.IsNullOrEmpty(nav.InnerXml.Trim())));
            if (!isComplexArray)
            {
                if (!isArrayMember)
                {
                    _sb.AppendFormat((padding + "\"{0}\": "), nav.Name);
                    if (nav.MoveToFirstChild())
                    {
                        if ((nav.NodeType == XPathNodeType.Text) && !hasAttributes)
                            closingBracket = false;
                        nav.MoveToParent();
                    }
                }
                if (closingBracket)
                {
                    if (isArray)
                        _sb.AppendLine("[");
                    else
                    {
                        if (!isArrayMember)
                        {
                            if (isEmpty)
                                _sb.Append("null");
                            else
                                _sb.AppendLine("{");
                        }
                        else
                            _sb.AppendLine((padding + "{"));
                    }
                }
            }
            var firstProp = true;
            var childPadding = (padding + "  ");
            bool keepGoing;
            if (isComplexArray && isArrayMember)
                _sb.AppendLine((padding + "{"));
            if (nav.MoveToFirstAttribute())
            {
                keepGoing = true;
                while (keepGoing)
                {
                    if (firstProp)
                        firstProp = false;
                    else
                        _sb.AppendLine(",");
                    _sb.AppendFormat((childPadding + "\"{0}\": "), nav.Name);
                    WriteJsonValue(nav);
                    if (!(nav.MoveToNextAttribute()))
                        keepGoing = false;
                }
                nav.MoveToParent();
                if (isComplexArray)
                {
                    _sb.AppendLine(",");
                    _sb.AppendFormat((childPadding + "\"{0}\": [\n"), nav.Name);
                    firstProp = true;
                }
            }
            if (nav.MoveToFirstChild())
            {
                if (nav.NodeType == XPathNodeType.Text)
                {
                    var hasParentWithoutAttributes = false;
                    if (isArrayMember)
                    {
                        _sb.AppendLine(",");
                        _sb.Append((childPadding + "\"@text\": "));
                    }
                    else
                    {
                        var parent = nav.Clone();
                        parent.MoveToParent();
                        hasParentWithoutAttributes = !parent.HasAttributes;
                        if (!hasParentWithoutAttributes || _explicitElementValues)
                        {
                            if (hasAttributes)
                                _sb.AppendLine(",");
                            else
                                _sb.AppendLine(" {");
                            _sb.Append((childPadding + "\"@value\": "));
                        }
                    }
                    if (nav.Value.Contains("\n"))
                        WriteMultilineValue(nav);
                    else
                        WriteJsonValue(nav);
                    if (!isArrayMember && (hasParentWithoutAttributes && _explicitElementValues))
                        _sb.Append(("\n"
                                        + (padding + "}")));
                }
                else
                {
                    keepGoing = true;
                    while (keepGoing)
                    {
                        if (firstProp)
                            firstProp = false;
                        else
                            _sb.AppendLine(",");
                        XmlToJson(nav, isArray, (depth + 1));
                        if (!(nav.MoveToNext()))
                            keepGoing = false;
                    }
                }
                nav.MoveToParent();
            }
            if (closingBracket)
            {
                if (!isEmpty)
                    _sb.AppendLine();
                if (isComplexArray)
                    _sb.Append((padding + "  ]"));
                else
                {
                    if (isArray)
                        _sb.Append((padding + "]"));
                    else
                    {
                        if (!isEmpty)
                            _sb.Append((padding + "}"));
                    }
                }
            }
            if (isComplexArray && isArrayMember)
                _sb.Append(("\n"
                                + (padding + "}")));
            if (nav.MoveToNext())
            {
                _sb.AppendLine(",");
                XmlToJson(nav, isArrayMember, depth);
            }
        }
    }
}
