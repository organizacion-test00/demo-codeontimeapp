using System;
using System.Collections;
using System.Collections.Generic;
using System.Configuration;
using System.Data;
using System.Data.Common;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Reflection;
using System.Xml;
using System.Xml.XPath;

namespace MyCompany.Data
{
    public class ControllerNodeSet
    {

        private XPathNavigator _navigator;

        private XmlNamespaceManager _resolver;

        private List<XPathNavigator> _nodes;

        private object[] _args;

        private int _argIndex;

        private static Regex _variableRegex = new Regex("\\$\\w+");

        private static Regex _elementNameRegex = new Regex("(?\'String\'\"([\\s\\S]+?)\")|(?\'String\'\\\'([\\s\\S]+?)\\\')|(?\'AttrOrVar\'(@|\\$)\\w+)|(?\'Func" +
                "tion\'\\w+\\s*\\()|(?\'Element\'(?\'Axis\'[\\w-]+::)?(?\'Namespace\'\\w+\\:)?(([\\w-]+::\\*)|(?" +
                "\'Name\'[a-z]\\w*)))", RegexOptions.IgnoreCase);

        private static Regex _keywordRegex = new Regex("^(or|and|mod|div|[\\w-]+::\\*)$", RegexOptions.IgnoreCase);

        private static Regex _createElementRegex = new Regex("\\<(\\w+)/?\\>$");

        private static Regex _namespaceRegex = new Regex("^\\w+::");

        private int? _current;

        public ControllerNodeSet(ControllerNodeSet nodeSet) :
                this(nodeSet._navigator, nodeSet._resolver)
        {
        }

        public ControllerNodeSet(XPathNavigator navigator, XmlNamespaceManager resolver)
        {
            this._navigator = navigator;
            this._resolver = resolver;
            _nodes = new List<XPathNavigator>();
        }

        public ControllerNodeSet(ControllerNodeSet nodeSet, XPathNavigator node) :
                this(nodeSet, new List<XPathNavigator>())
        {
            _nodes.Add(node);
        }

        public ControllerNodeSet(ControllerNodeSet nodeSet, List<XPathNavigator> nodes)
        {
            this._navigator = nodeSet._navigator;
            this._resolver = nodeSet._resolver;
            this._nodes = nodes;
        }

        public List<XPathNavigator> Nodes
        {
            get
            {
                return _nodes;
            }
        }

        /// <summary>
        /// Returns true if the node set is empty.
        /// </summary>
        public bool IsEmpty
        {
            get
            {
                return (_nodes.Count == 0);
            }
        }

        public ControllerNodeSet Current
        {
            get
            {
                if (!_current.HasValue || (_nodes.Count <= _current))
                    return null;
                return new ControllerNodeSet(this, _nodes[_current.Value]);
            }
        }

        public override string ToString()
        {
            if ((_nodes != null) && (_nodes.Count == 1))
                return _nodes[0].Value;
            return base.ToString();
        }

        private string DoReplaceVariable(Match m)
        {
            var o = _args[_argIndex];
            _argIndex++;
            return string.Format("\'{0}\'", o);
        }

        private string DoReplaceElementName(Match m)
        {
            var name = m.Groups["Name"].Value;
            var axis = m.Groups["Axis"].Value;
            var ns = m.Groups["Namespace"].Value;
            if ((!(string.IsNullOrEmpty(name)) && string.IsNullOrEmpty(ns)) && !(_keywordRegex.IsMatch(m.Value)))
                return string.Format("{0}c:{1}", axis, name);
            return m.Value;
        }

        /// <summary>
        /// Adds selected nodes to the current node set.
        /// </summary>
        /// <param name="selector">XPath expression evaluated against the definition of the data controller. May contain variables.</param>
        /// <param name="args">Optional values of variables. If variables are specified then the expression is evaluated for each variable or group of variables specified in the selector.</param>
        /// <example>field[@name=$name]</example>
        /// <returns>Returns a combined nodeset.</returns>
        public ControllerNodeSet Add(string selector, params System.Object[] args)
        {
            return InternalSelect(true, selector, args);
        }

        /// <summary>
        /// Selects a node set containing zero or more XML nodes from the data controller definition.
        /// </summary>
        /// <param name="selector">XPath expression evaluated against the definition of the data controller. May contain variables.</param>
        /// <param name="args">Optional values of variables. If variables are specified then the expression is evaluated for each variable or group of variables specified in the selector.</param>
        /// <example>field[@name=$name]</example>
        /// <returns>A node set containing selected data controller nodes.</returns>
        public ControllerNodeSet Select(string selector, params System.Object[] args)
        {
            var m = _createElementRegex.Match(selector);
            if (m.Success)
            {
                var document = new XmlDocument();
                document.LoadXml(string.Format("<{0}/>", m.Groups[1].Value));
                return new ControllerNodeSet(this, document.FirstChild.CreateNavigator());
            }
            else
                return InternalSelect(false, selector, args);
        }

        private ControllerNodeSet InternalSelect(bool add, string selector, params System.Object[] args)
        {
            _argIndex = 0;
            selector = _elementNameRegex.Replace(selector, DoReplaceElementName);
            var list = new List<XPathNavigator>();
            if (add)
                list.AddRange(_nodes);
            var rootNodes = _nodes;
            if ((rootNodes.Count == 0) || add)
            {
                rootNodes = new List<XPathNavigator>();
                rootNodes.Add(_navigator);
                if (Char.IsLetter(selector, 0) && !(_namespaceRegex.IsMatch(selector)))
                    selector = ("//" + selector);
            }
            else
            {
                if (Char.IsLetter(selector, 0) && !(_namespaceRegex.IsMatch(selector)))
                    selector = (".//" + selector);
            }
            foreach (var root in rootNodes)
                if (args.Length > 0)
                {
                    _args = args;
                    while (_argIndex < args.Length)
                    {
                        var xpath = _variableRegex.Replace(selector, DoReplaceVariable);
                        var iterator = root.Select(xpath, _resolver);
                        while (iterator.MoveNext())
                            list.Add(iterator.Current.Clone());
                    }
                }
                else
                {
                    var iterator = root.Select(selector, _resolver);
                    while (iterator.MoveNext())
                        list.Add(iterator.Current.Clone());
                }
            return new ControllerNodeSet(this, list);
        }

        /// <summary>
        /// Deletes all nodes in the node set from the data controller definition.
        /// </summary>
        /// <returns>An empty node set.</returns>
        public ControllerNodeSet Delete()
        {
            foreach (var node in _nodes)
                node.DeleteSelf();
            return new ControllerNodeSet(_navigator, _resolver);
        }

        /// <summary>
        /// Selects the value of the attribute with the specified name from all nodes in the node set.
        /// </summary>
        /// <param name="name">The name of the XML attribute.</param>
        /// <returns>The collection of the XML nodes representing values of the specified attribute.</returns>
        public ControllerNodeSet Attr(string name)
        {
            return InternalSelect(false, ("@" + name));
        }

        /// <summary>
        /// Assigns the value to the attribute with the specified name for all nodes in the node set.
        /// </summary>
        /// <param name="name">The name of the XML attribute.</param>
        /// <param name="value">The value of the XML attribute.</param>
        /// <returns></returns>
        public ControllerNodeSet Attr(string name, object value)
        {
            var s = Convert.ToString(value);
            if (value is bool)
                s = s.ToLower();
            foreach (var nav in _nodes)
            {
                var attrNav = nav.SelectSingleNode(("@" + name));
                if (attrNav != null)
                    attrNav.SetValue(s);
                else
                    nav.CreateAttribute(string.Empty, name, string.Empty, s);
            }
            return this;
        }

        /// <summary>
        /// Appends a collection specified by the argument to each node in the node sets.
        /// </summary>
        /// <param name="nodeSet">The collection of child nodes.</param>
        /// <returns>The collection of child nodes after they were appended to the nodes in the original node set.</returns>
        public ControllerNodeSet AppendTo(ControllerNodeSet nodeSet)
        {
            foreach (var node in this._nodes)
                foreach (var parentNode in nodeSet._nodes)
                    parentNode.AppendChild(node.OuterXml);
            return nodeSet;
        }

        /// <summary>
        /// Appends a collection specified by the argument to each node in the node sets.
        /// </summary>
        /// <param name="selector">XPath expression evaluated against the definition of the data controller. May contain variables.</param>
        /// <param name="args">Optional values of variables. If variables are specified then the expression is evaluated for each variable or group of variables specified in the selector.</param>
        /// <example>field[@name=$name]</example>
        /// <returns>The collection of child nodes after they were appended to the nodes in the original node set.</returns>
        public ControllerNodeSet AppendTo(string selector, params System.Object[] args)
        {
            return AppendTo(new ControllerNodeSet(_navigator, _resolver).Select(selector, args));
        }

        public ControllerNodeSet Arrange(string selector, params System.String[] sequence)
        {
            var i = (sequence.Length - 1);
            while (i >= 0)
            {
                foreach (var node in _nodes)
                {
                    var seqNav = node.SelectSingleNode(selector, _resolver);
                    if ((seqNav != null) && (seqNav.Value == sequence[i]))
                    {
                        var sibling = node.Clone();
                        sibling.MoveToParent();
                        sibling.MoveToFirstChild();
                        if (!(sibling.IsSamePosition(node)))
                        {
                            sibling.InsertBefore(node);
                            node.DeleteSelf();
                        }
                        break;
                    }
                }
                // continue to the next value in sequence
                i = (i - 1);
            }
            return this;
        }

        public ControllerNodeSet Elem(string name)
        {
            return InternalSelect(false, name);
        }

        public ControllerNodeSet Elem(string name, object value)
        {
            var s = Convert.ToString(value);
            var selector = ("c:" + name);
            foreach (var node in _nodes)
            {
                var elemNav = node.SelectSingleNode(selector, _resolver);
                if (elemNav == null)
                {
                    node.AppendChild(string.Format("<{0}/>", name));
                    elemNav = node.SelectSingleNode(selector, _resolver);
                }
                elemNav.SetValue(s);
            }
            return this;
        }

        private ControllerNodeSet SelectInContext(string contextNode, string selector, params System.Object[] args)
        {
            foreach (var node in _nodes)
                if (node.Name == contextNode)
                {
                    node.MoveToParent();
                    return InternalSelect(false, selector, args);
                }
            return InternalSelect(false, selector, args);
        }

        /// <summary>
        /// Select the data controller field node.
        /// </summary>
        /// <param name="name">The name of the field.</param>
        /// <returns></returns>
        public ControllerNodeSet SelectField(string name)
        {
            return NodeSet().InternalSelect(false, string.Format("/dataController/fields/field[@name=\'{0}\']", name));
        }

        public ControllerNodeSet SelectCommand(string id)
        {
            return NodeSet().InternalSelect(false, string.Format("/dataController/commands/command[@id=\'{0}\']", id));
        }

        public ControllerNodeSet SelectViews(params System.String[] identifiers)
        {
            if (identifiers.Length == 0)
                return NodeSet().Select("/dataController/views/view");
            var searchByType = false;
            foreach (var s in new string[] {
                    "Grid",
                    "Form",
                    "DataSheet",
                    "Chart",
                    "Tree"})
                if (!((Array.IndexOf(identifiers, s) == -1)))
                {
                    searchByType = true;
                    break;
                }
            if (searchByType)
                return NodeSet().Select("/dataController/views/view[@type=$type]", identifiers);
            return NodeSet().Select("/dataController/views/view[@id=$id]", identifiers);
        }

        /// <summary>
        /// Creates an empty data controller node set.
        /// </summary>
        /// <returns>Returns an empty data controller node set.</returns>
        public ControllerNodeSet NodeSet()
        {
            return new ControllerNodeSet(this);
        }

        public ControllerNodeSet SelectView(string id)
        {
            return NodeSet().Select(string.Format("/dataController/views/view[@id=\'{0}\']", id));
        }

        public ControllerNodeSet SelectDataFields(params System.String[] fieldNames)
        {
            var list = new List<XPathNavigator>();
            foreach (var node in _nodes)
            {
                var nodeSet = new ControllerNodeSet(this, node);
                if (fieldNames.Length == 0)
                    list.AddRange(nodeSet.SelectInContext("dataField", "dataField").Nodes);
                else
                    list.AddRange(nodeSet.SelectInContext("dataField", "dataField[@fieldName=$fieldName]", fieldNames).Nodes);
            }
            return new ControllerNodeSet(this, list);
        }

        public ControllerNodeSet SelectDataField(string fieldName)
        {
            return SelectDataFields(fieldName);
        }

        public ControllerNodeSet SelectCategory(string id)
        {
            return SelectInContext("category", string.Format("category[@id=\'{0}\']", id));
        }

        public ControllerNodeSet SelectAction(string id)
        {
            return SelectInContext("action", string.Format("action[@id=\'{0}\']", id));
        }

        public ControllerNodeSet SelectActions(params System.String[] commandNames)
        {
            if (commandNames.Length == 0)
                return SelectInContext("action", "action");
            var commandNameList = new List<string>(commandNames);
            if (commandNameList.Contains("CHANGE"))
            {
                commandNameList.Remove("CHANGE");
                commandNameList.Add("Edit");
                commandNameList.Add("BatchEdit");
                commandNameList.Add("New");
                commandNameList.Add("Delete");
                commandNameList.Add("Update");
                commandNameList.Add("Insert");
                commandNameList.Add("Import");
                commandNameList.Add("Duplicate");
            }
            if (commandNameList.Contains("NEW"))
            {
                commandNameList.Remove("NEW");
                commandNameList.Add("New");
                commandNameList.Add("Insert");
                commandNameList.Add("Import");
                commandNameList.Add("Duplicate");
            }
            if (commandNameList.Contains("EDIT"))
            {
                commandNameList.Remove("EDIT");
                commandNameList.Add("Edit");
                commandNameList.Add("BatchEdit");
                commandNameList.Add("Update");
            }
            if (commandNameList.Contains("EXPORT"))
            {
                commandNameList.Remove("EXPORT");
                commandNameList.Add("ExportCsv");
                commandNameList.Add("ExportRss");
                commandNameList.Add("ExportRowset");
            }
            if (commandNameList.Contains("REPORT"))
            {
                commandNameList.Remove("REPORT");
                commandNameList.Add("Report");
                commandNameList.Add("ReportAsPdf");
                commandNameList.Add("ReportAsImage");
                commandNameList.Add("ReportAsExcel");
                commandNameList.Add("ReportAsWord");
            }
            return SelectInContext("action", "action[@commandName=$commandName]", commandNameList.ToArray());
        }

        public ControllerNodeSet SelectCustomAction(string commandArgument)
        {
            return SelectCustomActions(commandArgument);
        }

        public ControllerNodeSet SelectCustomActions(params System.String[] commandArguments)
        {
            if (commandArguments.Length == 0)
                return SelectInContext("action", "action[@commandName=\'Custom\']");
            return SelectInContext("action", "action[@commandName=\'Custom\' and @commandArgument=$commandArgument]", commandArguments);
        }

        public ControllerNodeSet SelectActionGroups(params System.String[] scopes)
        {
            if (scopes.Length == 0)
                return SelectInContext("actionGroup", "actionGroup");
            else
                return SelectInContext("actionGroup", "actionGroup[@scope=$scope]", scopes);
        }

        public ControllerNodeSet SelectActionGroup(string id)
        {
            return SelectInContext("actionGroup", string.Format("actionGroup[@id=\'{0}\']", id));
        }

        private ControllerNodeSet SetProperty(string name, object value, params System.String[] requiresElement)
        {
            foreach (var node in _nodes)
            {
                var nodeSet = new ControllerNodeSet(this, node);
                if (Array.IndexOf(requiresElement, node.Name) >= 0)
                    nodeSet.Elem(name, value);
                else
                    nodeSet.Attr(name, value);
            }
            return this;
        }

        /// <summary>
        /// Restricts access to the field or action to a list of comma-separated roles.
        /// </summary>
        /// <param name="roles">The list of comma-separated roles.</param>
        /// <returns>Returns the current node set.</returns>
        public ControllerNodeSet SetRoles(string roles)
        {
            return SetProperty("roles", roles);
        }

        /// <summary>
        /// Restricts 'write' access to the field to the list of comma-separated roles.
        /// </summary>
        /// <param name="writeRoles">The list of comma-separated roles.</param>
        /// <returns>Returns the current node set.</returns>
        public ControllerNodeSet SetWriteRoles(string writeRoles)
        {
            return SetProperty("writeRoles", writeRoles);
        }

        public virtual ControllerNodeSet SetTag(string value)
        {
            var attributeName = "tag";
            if ((_nodes.Count > 0) && (_nodes[0].Name == "view"))
                attributeName = "tags";
            var tagList = Attr(attributeName).Value();
            if (!(string.IsNullOrEmpty(tagList)) && !(string.IsNullOrEmpty(value)))
            {
                tagList = (tagList + " ");
                value = (tagList + value);
            }
            return Attr(attributeName, value);
        }

        public ControllerNodeSet SetHeaderText(string headerText)
        {
            return SetProperty("headerText", headerText, "dataField", "view");
        }

        public ControllerNodeSet SetFooterText(string footerText)
        {
            return SetProperty("footerText", footerText, "dataField", "view");
        }

        public ControllerNodeSet SetLabel(string label)
        {
            return SetProperty("label", label);
        }

        public ControllerNodeSet SetSortExpression(string sortExpression)
        {
            return SetProperty("sortExpression", sortExpression);
        }

        public ControllerNodeSet SetGroupExpression(string groupExpression)
        {
            return SetProperty("groupExpression", groupExpression);
        }

        public ControllerNodeSet SetFilter(string filter)
        {
            return SetProperty("filter", filter);
        }

        public ControllerNodeSet SetGroup(string group)
        {
            return SetProperty("group", group);
        }

        public ControllerNodeSet SetShowInSelector(bool showInSelector)
        {
            return SetProperty("showInSelector", showInSelector.ToString().ToLower());
        }

        public ControllerNodeSet SetShowInSelector(string showInSelector)
        {
            return SetShowInSelector(Convert.ToBoolean(showInSelector));
        }

        public ControllerNodeSet SetReportFont(string reportFont)
        {
            return SetProperty("reportFont", reportFont);
        }

        public ControllerNodeSet SetReportLabel(string reportLabel)
        {
            return SetProperty("reportLabel", reportLabel);
        }

        public ControllerNodeSet SetReportOrientation(string reportOrientation)
        {
            return SetProperty("reportOrientation", reportOrientation);
        }

        public ControllerNodeSet SetReportTemplate(string reportTemplate)
        {
            return SetProperty("reportTemplate", reportTemplate);
        }

        public ControllerNodeSet SetHidden(bool hidden)
        {
            return SetProperty("hidden", hidden.ToString().ToLower());
        }

        public ControllerNodeSet SetHidden(string hidden)
        {
            return SetHidden(Convert.ToBoolean(hidden));
        }

        public ControllerNodeSet SetReadOnly(bool readOnly)
        {
            return SetProperty("readOnly", readOnly.ToString().ToLower());
        }

        public ControllerNodeSet SetReadOnly(string readOnly)
        {
            return SetReadOnly(Convert.ToBoolean(readOnly));
        }

        public ControllerNodeSet SetFormatOnClient(bool formatOnClient)
        {
            return SetProperty("formatOnClient", formatOnClient.ToString().ToLower());
        }

        public ControllerNodeSet SetFormatOnClient(string formatOnClient)
        {
            return SetFormatOnClient(Convert.ToBoolean(formatOnClient));
        }

        public ControllerNodeSet SetCommandName(string commandName)
        {
            return SetProperty("commandName", commandName);
        }

        public ControllerNodeSet SetCommandArgument(string commandArgument)
        {
            return SetProperty("commandArgument", commandArgument);
        }

        public ControllerNodeSet SetConfirmation(string confirmation)
        {
            return SetProperty("confirmation", confirmation);
        }

        public ControllerNodeSet SetType(string type)
        {
            return SetProperty("type", type);
        }

        public ControllerNodeSet SetScope(string scope)
        {
            return SetProperty("scope", scope);
        }

        public ControllerNodeSet SetFlat(bool flat)
        {
            return SetProperty("flat", flat.ToString().ToLower());
        }

        public ControllerNodeSet SetFlat(string flat)
        {
            return SetFlat(Convert.ToBoolean(flat));
        }

        public ControllerNodeSet SetNewColumn(bool newColumn)
        {
            return SetProperty("newColumn", newColumn.ToString().ToLower());
        }

        public ControllerNodeSet SetNewColumn(string newColumn)
        {
            return SetNewColumn(Convert.ToBoolean(newColumn));
        }

        public ControllerNodeSet SetFloating(bool floating)
        {
            return SetProperty("floating", floating.ToString().ToLower());
        }

        public ControllerNodeSet SetFloating(string floating)
        {
            return SetFloating(Convert.ToBoolean(floating));
        }

        public ControllerNodeSet SetTab(string tab)
        {
            return SetProperty("tab", tab);
        }

        public ControllerNodeSet SetDescription(string description)
        {
            return SetProperty("description", description, "category");
        }

        public ControllerNodeSet SetColumns(int columns)
        {
            return SetProperty("columns", columns);
        }

        public ControllerNodeSet SetColumns(string columns)
        {
            return SetColumns(Convert.ToInt32(columns));
        }

        public ControllerNodeSet SetLength(int length)
        {
            return SetProperty("length", length);
        }

        public ControllerNodeSet SetLength(string length)
        {
            return SetLength(Convert.ToInt32(length));
        }

        public ControllerNodeSet SetRows(int rows)
        {
            return SetProperty("rows", rows);
        }

        public ControllerNodeSet SetRows(string rows)
        {
            return SetRows(Convert.ToInt32(rows));
        }

        public ControllerNodeSet SetDataFormatString(string dataFormatString)
        {
            return SetProperty("dataFormatString", dataFormatString);
        }

        public ControllerNodeSet SetTextMode(string textMode)
        {
            return SetProperty("textMode", textMode);
        }

        public ControllerNodeSet SetSearch(string search)
        {
            return SetProperty("search", search);
        }

        public ControllerNodeSet SetSearchOptions(string searchOptions)
        {
            return SetProperty("searchOptions", searchOptions);
        }

        public ControllerNodeSet SetAccess(string access)
        {
            return SetProperty("access", access);
        }

        public ControllerNodeSet SetAggregate(string aggregate)
        {
            return SetProperty("aggregate", aggregate);
        }

        public ControllerNodeSet SetAutoCompletePrefixLength(string autoCompletePrefixLength)
        {
            return SetProperty("autoCompletePrefixLength", autoCompletePrefixLength);
        }

        public ControllerNodeSet SetHyperlinkFormatString(string hyperlinkFormatString)
        {
            return SetProperty("hyperlinkFormatString", hyperlinkFormatString);
        }

        public ControllerNodeSet SetName(string name)
        {
            return SetProperty("name", name);
        }

        public ControllerNodeSet SetFieldName(string fieldName)
        {
            return SetProperty("fieldName", fieldName);
        }

        /// <summary>
        /// Allows action if the last command name executed in the data view matches the argument.
        /// </summary>
        /// <param name="lastCommandName">The name of the last command.</param>
        /// <returns>The node set containing the action.</returns>
        public ControllerNodeSet WhenLastCommandName(string lastCommandName)
        {
            return SetProperty("whenLastCommandName", lastCommandName);
        }

        /// <summary>
        /// Allows action if the last command argument executed in the data view matches the argument.
        /// </summary>
        /// <param name="lastCommandArgument">The name of the last argument.</param>
        /// <returns>The node set containing the action.</returns>
        public ControllerNodeSet WhenLastCommandArgument(string lastCommandArgument)
        {
            return SetProperty("whenLastCommandArgument", lastCommandArgument);
        }

        /// <summary>
        /// Allows action if the JavaScript expression specified in the argument evalues as true. The field values can be referenced in square brackets by name. For example, [Status] == 'Open'
        /// </summary>
        /// <param name="clientScript">The JavaScript expression.</param>
        /// <returns>The node set containing the action.</returns>
        public ControllerNodeSet WhenClientScript(string clientScript)
        {
            return SetProperty("whenClientScript", clientScript);
        }

        /// <summary>
        /// Allows action if the regular expression specified in the argument evalutes as a match against the URL in the address bar of the web browser.
        /// </summary>
        /// <param name="href">The regular expression.</param>
        /// <returns>The node set containing the action.</returns>
        public ControllerNodeSet WhenHRef(string href)
        {
            return SetProperty("whenHRef", href);
        }

        /// <summary>
        /// Allows action if the regular expression specified in the argument evalutes as a match against the data view 'Tag' property.
        /// </summary>
        /// <param name="tag">The regular expression.</param>
        /// <returns>The node set containing the action.</returns>
        public ControllerNodeSet WhenTag(string tag)
        {
            return SetProperty("whenTag", tag);
        }

        /// <summary>
        /// Allows action if the regular expression specified in the argument evalutes as a match against the ID of the view controller. For example, (grid1|grid2).
        /// </summary>
        /// <param name="viewId">The regular expression.</param>
        /// <returns>The node set containing the action.</returns>
        public ControllerNodeSet WhenView(string viewId)
        {
            return SetProperty("whenView", viewId);
        }

        /// <summary>
        /// Allows action if a data row is selected in the data view.
        /// </summary>
        /// <param name="keySelected">The boolean value indicating if a data row is selected.</param>
        /// <returns>The node set containing the action.</returns>
        public ControllerNodeSet WhenKeySelected(bool keySelected)
        {
            return SetProperty("whenKeySelected", keySelected.ToString().ToLower());
        }

        /// <summary>
        /// Allows action if a data row is selected in the data view.
        /// </summary>
        /// <param name="keySelected">The boolean value indicating if a data row is selected.</param>
        /// <returns>The node set containing the action.</returns>
        public ControllerNodeSet WhenKeySelected(string keySelected)
        {
            return WhenKeySelected(Convert.ToBoolean(keySelected));
        }

        public ControllerNodeSet CreateActionGroup()
        {
            return CreateActionGroup(null);
        }

        public ControllerNodeSet CreateActionGroup(string id)
        {
            var actionGroupNode = new ControllerNodeSet(_navigator, _resolver).Select("<actionGroup/>").AppendTo("/dataController/actions").Select("/dataController/actions/actionGroup[last()]");
            if (!(string.IsNullOrEmpty(id)))
                actionGroupNode.Attr("id", id);
            return actionGroupNode;
        }

        public ControllerNodeSet CreateAction()
        {
            return CreateAction(null, null, null);
        }

        public ControllerNodeSet CreateAction(string id)
        {
            return CreateAction(null, null, id);
        }

        public ControllerNodeSet CreateAction(string commandName, string commandArgument)
        {
            return CreateAction(commandName, commandArgument, null);
        }

        public ControllerNodeSet CreateAction(string commandName, string commandArgument, string id)
        {
            var actionNode = Select("<action/>").AppendTo(this.Select("ancestor-or-self::actionGroup")).Select("action[last()]");
            if (!(string.IsNullOrEmpty(id)))
                actionNode.Attr("id", id);
            if (!(string.IsNullOrEmpty(commandName)))
                actionNode.Attr("commandName", commandName);
            if (!(string.IsNullOrEmpty(commandArgument)))
                actionNode.Attr("commandArgument", commandArgument);
            return actionNode;
        }

        public ControllerNodeSet CreateView(string id)
        {
            return CreateView(id, "Grid", null);
        }

        public ControllerNodeSet CreateView(string id, string type)
        {
            return CreateView(id, type, null);
        }

        public ControllerNodeSet CreateView(string id, string type, string commandId)
        {
            if (string.IsNullOrEmpty(commandId))
            {
                var commandIdNav = _navigator.SelectSingleNode("/c:dataController/c:commands/c:command/@id", _resolver);
                if (commandIdNav != null)
                    commandId = commandIdNav.Value;
            }
            return new ControllerNodeSet(_navigator, _resolver).Select("<view/>").AppendTo("/dataController/views").Select("/dataController/views/view[last()]").Attr("type", type).Attr("commandId", commandId).Attr("id", id);
        }

        public ControllerNodeSet CreateCategory(string id)
        {
            return CreateCategory(id, null);
        }

        public ControllerNodeSet CreateCategory(string id, string headerText)
        {
            foreach (var node in _nodes)
            {
                var parentNode = new ControllerNodeSet(this, node);
                var categoriesNode = parentNode;
                if (node.Name != "categories")
                {
                    categoriesNode = parentNode.Select("categories|ancestor::categories[1]");
                    if (categoriesNode.Nodes.Count == 0)
                    {
                        Select("<categories/>").AppendTo(parentNode);
                        categoriesNode = parentNode.Select("categories");
                    }
                }
                return Select("<category/>").AppendTo(categoriesNode).Select("category[last()]").Attr("id", id).Attr("headerText", headerText).Elem("dataFields", null);
            }
            return this;
        }

        public ControllerNodeSet CreateDataField(string fieldName)
        {
            return CreateDataField(fieldName, null);
        }

        public ControllerNodeSet CreateDataField(string fieldName, string aliasFieldName)
        {
            var existingFieldNode = SelectDataField(fieldName);
            if (existingFieldNode.Nodes.Count > 0)
                return existingFieldNode;
            foreach (var node in _nodes)
            {
                var parentNode = new ControllerNodeSet(this, node);
                var dataFieldsNode = parentNode;
                if (node.Name != "dataFields")
                {
                    dataFieldsNode = parentNode.Select("dataFields|ancestor::dataFields[1]");
                    if (dataFieldsNode.Nodes.Count == 0)
                    {
                        Select("<dataFields/>").AppendTo(parentNode);
                        dataFieldsNode = parentNode.Select("dataFields");
                    }
                }
                var dataFieldNode = Select("<dataField/>").AppendTo(dataFieldsNode).Select("dataField[last()]").Attr("fieldName", fieldName);
                if (!(string.IsNullOrEmpty(aliasFieldName)))
                    dataFieldNode.Attr("aliasFieldName", aliasFieldName);
                return dataFieldNode;
            }
            return this;
        }

        public ControllerNodeSet Hide()
        {
            return SetHidden(true);
        }

        public ControllerNodeSet Show()
        {
            return SetHidden(false);
        }

        public ControllerNodeSet ArrangeViews(params System.String[] sequence)
        {
            Select("/dataController/views/view").Arrange("@id", sequence);
            return this;
        }

        public ControllerNodeSet ArrangeDataFields(params System.String[] sequence)
        {
            Select("dataField").Arrange("@fieldName", sequence);
            return this;
        }

        public ControllerNodeSet ArrangeCategories(params System.String[] sequence)
        {
            Select("category").Arrange("@id", sequence);
            return this;
        }

        public ControllerNodeSet ArrangeActionGroups(params System.String[] sequence)
        {
            Select("/dataController/actions/actionGroup").Arrange("@id", sequence);
            return this;
        }

        public ControllerNodeSet ArrangeActions(params System.String[] sequence)
        {
            Select("action").Arrange("@id", sequence);
            return this;
        }

        public ControllerNodeSet Move(ControllerNodeSet target)
        {
            if (target.Nodes.Count != 1)
                return this;
            var targetNode = target.Nodes[0];
            foreach (var node in _nodes)
            {
                var skip = true;
                if (((targetNode.Name == "category") || (targetNode.Name == "view")) && (node.Name == "dataField"))
                    skip = false;
                if ((targetNode.Name == "actionGroup") && (node.Name == "action"))
                    skip = false;
                if (!skip)
                {
                    var newParent = targetNode;
                    if (targetNode.Name == "category")
                        newParent = targetNode.SelectSingleNode("c:dataFields", _resolver);
                    if (newParent != null)
                    {
                        newParent.AppendChild(node);
                        node.DeleteSelf();
                    }
                }
            }
            return new ControllerNodeSet(this, targetNode);
        }

        public ControllerNodeSet Parent()
        {
            foreach (var node in _nodes)
            {
                node.MoveToParent();
                return new ControllerNodeSet(this, node);
            }
            return this;
        }

        public ControllerNodeSet SelectFields(params System.String[] names)
        {
            if (names.Length == 0)
                return NodeSet().Select("/dataController/fields/field");
            return NodeSet().Select("/dataController/fields/field[@name=$name]", names);
        }

        public ControllerNodeSet Use()
        {
            if (_nodes.Count > 0)
            {
                var sb = new StringBuilder();
                foreach (var node in _nodes)
                    sb.Append(node.OuterXml);
                var nodeName = _nodes[0].Name;
                var parentNode = _nodes[0].SelectSingleNode("parent::*");
                parentNode.InnerXml = sb.ToString();
                var nodeSet = new ControllerNodeSet(this, parentNode);
                var list = new List<XPathNavigator>();
                list.AddRange(nodeSet.SelectInContext(nodeName, nodeName).Nodes);
                return new ControllerNodeSet(this, list);
            }
            return this;
        }

        protected ControllerNodeSet SelectFieldItemsNode()
        {
            var list = new List<XPathNavigator>();
            foreach (var node in _nodes)
            {
                var parentNode = new ControllerNodeSet(this, node);
                var itemsNode = parentNode.Select("items");
                if (itemsNode.Nodes.Count == 0)
                {
                    parentNode.Select("<items/>").AppendTo(parentNode);
                    itemsNode = parentNode.Select("items");
                }
                list.AddRange(itemsNode.Nodes);
            }
            return new ControllerNodeSet(this, list);
        }

        /// <summary>
        /// Sets the style of lookup presentation for the field.
        /// </summary>
        /// <param name="style">The style of the lookup presentation. Supported values are AutoComplete, CheckBox, CheckBoxList, DropDownList, ListBox, Lookup, RadioButtonList, UserIdLookup, and UserNameLookup.</param>
        /// <returns>Returns the current node set.</returns>
        public ControllerNodeSet SetItemsStyle(string style)
        {
            SelectFieldItemsNode().Attr("style", style);
            return this;
        }

        /// <summary>
        /// Sets the new data view that will allow creating lookup items in-place.
        /// </summary>
        /// <param name="viewId">The id of a form view.</param>
        /// <returns>Returns the current node set.</returns>
        public ControllerNodeSet SetItemsNewView(string viewId)
        {
            SelectFieldItemsNode().Attr("newDataView", viewId);
            return this;
        }

        /// <summary>
        /// Sets the data controller providing dynamic items for the lookup field.
        /// </summary>
        /// <param name="controller">The name of a the lookup data controller.</param>
        /// <returns>Returns the current node set.</returns>
        public ControllerNodeSet SetItemsController(string controller)
        {
            SelectFieldItemsNode().Attr("dataController", controller);
            return this;
        }

        /// <summary>
        /// Sets the target data controller of a many-to-many lookup field.
        /// </summary>
        /// <param name="controller">The name of a the data controller that serves as a target of many-to-many lookup field.</param>
        /// <returns>Returns the current node set.</returns>
        public ControllerNodeSet SetItemsTargetController(string controller)
        {
            SelectFieldItemsNode().Attr("targetController", controller);
            return this;
        }

        /// <summary>
        /// Sets the view of a data controller providing dynamic items for the lookup field.
        /// </summary>
        /// <param name="viewId">The id of the view in the lookup data controller.</param>
        /// <returns>Returns the current node set.</returns>
        public ControllerNodeSet SetItemsView(string viewId)
        {
            SelectFieldItemsNode().Attr("dataView", viewId);
            return this;
        }

        /// <summary>
        /// Sets the name of the field in the lookup data controller that will provide the lookup value.
        /// </summary>
        /// <param name="fieldName">The name of the field in the lookup data controller.</param>
        /// <returns>Returns the current node set.</returns>
        public ControllerNodeSet SetItemsDataValueField(string fieldName)
        {
            SelectFieldItemsNode().Attr("dataValueField", fieldName);
            return this;
        }

        /// <summary>
        /// Sets the name of the field in the lookup data controller that will provide the user-friendly text displayed when a lookup value is selected.
        /// </summary>
        /// <param name="fieldName">The name of the field in the lookup data controller.</param>
        /// <returns>Returns the current node set.</returns>
        public ControllerNodeSet SetItemsDataTextField(string fieldName)
        {
            SelectFieldItemsNode().Attr("dataTextField", fieldName);
            return this;
        }

        /// <summary>
        /// Assigns a 'copy' map to the lookup field. The map will control, which fields from the lookup data controller will be copied when a lookup value is selected.
        /// </summary>
        /// <param name="map">The 'copy' map of the lookup field. Example: ShipName=ContactName,ShipAddress=Address,ShipRegion=Region</param>
        /// <returns>Returns the current node set.</returns>
        public ControllerNodeSet SetItemsCopyMap(string map)
        {
            SelectFieldItemsNode().Attr("copy", map);
            return this;
        }

        /// <summary>
        /// Sets the text displayed in the header area of lookup window.
        /// </summary>
        /// <param name="description">The description of the lookup window.</param>
        /// <returns>Returns the current node set.</returns>
        public ControllerNodeSet SetItemsDescription(string description)
        {
            SelectFieldItemsNode().Attr("description", description);
            return this;
        }

        /// <summary>
        /// Sets the flag that will cause the automatic display of a lookup window in 'edit' and 'new' modes when the lookup field is blank.
        /// </summary>
        /// <param name="enable">The value indicating if lookup window is activated in 'edit' and 'new' modes.</param>
        /// <returns>Returns the current node set.</returns>
        public ControllerNodeSet SetItemsAutoSelect(bool enable)
        {
            SelectFieldItemsNode().Attr("autoSelect", enable.ToString().ToLower());
            return this;
        }

        /// <summary>
        /// Sets the flag that will allow searching by first letter in the lookup window.
        /// </summary>
        /// <param name="enable">The value indicating if search by first letter is enabled in the lookup window.</param>
        /// <returns>Returns the current node set.</returns>
        public ControllerNodeSet SetItemsSearchByFirstLetter(bool enable)
        {
            SelectFieldItemsNode().Attr("letters", enable.ToString().ToLower());
            return this;
        }

        /// <summary>
        /// Sets the flag that will force the lookup window to display in 'search' mode instead of rendering the first page of lookup data rows.
        /// </summary>
        /// <param name="enable">The value indicating if the 'search' mode is enabled in the lookup window.</param>
        /// <returns>Returns the current node set.</returns>
        public ControllerNodeSet SetItemsSearchOnStart(bool enable)
        {
            SelectFieldItemsNode().Attr("searchOnStart", enable.ToString().ToLower());
            return this;
        }

        /// <summary>
        /// Sets the initial page size of the lookup window.
        /// </summary>
        /// <param name="size">The initial page size of the lookup window.</param>
        /// <returns>Returns the current node set.</returns>
        public ControllerNodeSet SetItemsPageSize(int size)
        {
            SelectFieldItemsNode().Attr("pageSize", size);
            return this;
        }

        /// <summary>
        /// Selects the items with the specified values.
        /// </summary>
        /// <param name="values">List of item values.</param>
        /// <returns>Returns a node set with items that were matched to the list of values.</returns>
        public ControllerNodeSet SelectItems(params System.Object[] values)
        {
            if (values.Length == 0)
                return Select("item");
            return Select("item[@value=$value]", values);
        }

        /// <summary>
        /// Create a new static item for this field.
        /// </summary>
        /// <param name="value">Value of the item stored in the database.</param>
        /// <param name="text">Text of the item presented to the user.</param>
        /// <returns>The node set containing the field.</returns>
        public ControllerNodeSet CreateItem(object value, string text)
        {
            var itemsNode = Select("items");
            if (itemsNode.Nodes.Count == 0)
            {
                Select("<items/>").AppendTo(this);
                itemsNode = Select("items").Attr("style", "DropDownList");
            }
            Select("<item/>").AppendTo(itemsNode).Select("item[last()]").Attr("value", value).Attr("text", text);
            return this;
        }

        /// <summary>
        /// Defines a JavaScript expression to evaluate visibility of a data field or category at runtime.
        /// </summary>
        /// <param name="clientScript">The JavaScript expression evaluating the data field or category visibility.</param>
        /// <param name="args">The list of arguments referenced in the JavaScript expression.</param>
        /// <returns>The node set containing the data field or category.</returns>
        public ControllerNodeSet VisibleWhen(string clientScript, params System.Object[] args)
        {
            return CreateExpression("visibility", "test", string.Format(clientScript, args));
        }

        /// <summary>
        /// Defines a JavaScript expression to evaluate if the data field is read-only. If that is the case, then the client libraray will set the 'Mode' property of the data field to 'Static'.
        /// </summary>
        /// <param name="clientScript">The JavaScript expression evaluating if the data field is read-only.</param>
        /// <param name="args">The list of arguments referenced in the JavaScript expression.</param>
        /// <returns>The node set containing the data field.</returns>
        public ControllerNodeSet ReadOnlyWhen(string clientScript, params System.Object[] args)
        {
            return CreateExpression("readOnly", "test", string.Format(clientScript, args));
        }

        protected ControllerNodeSet CreateExpression(string rootElement, params System.String[] attributes)
        {
            foreach (var node in _nodes)
            {
                var nodeSet = new ControllerNodeSet(this, node);
                var rootNode = nodeSet.Select(rootElement);
                if (rootNode.Nodes.Count == 0)
                {
                    Select(string.Format("<{0}/>", rootElement)).AppendTo(nodeSet);
                    rootNode = nodeSet.Select(rootElement);
                }
                var expressionNode = nodeSet.Select("expression[1]");
                if (expressionNode.Nodes.Count == 0)
                {
                    Select("<expression/>").AppendTo(rootNode);
                    expressionNode = rootNode.Select("expression");
                }
                var i = 0;
                while (i < attributes.Length)
                {
                    expressionNode.Attr(attributes[i], attributes[(i + 1)]);
                    i = (i + 2);
                }
            }
            return this;
        }

        ControllerNodeSet SelectBusinessRules(string filter)
        {
            var selector = "/dataController/businessRules/rule";
            if (!(string.IsNullOrEmpty(selector)))
                selector = string.Format("{0}[{1}]", selector, filter);
            return NodeSet().InternalSelect(false, selector);
        }

        private string CreateBusinessRuleFilter(string type, string phase, string commandName, string commandArgument, string view)
        {
            var sb = new StringBuilder();
            var first = true;
            if (!(string.IsNullOrEmpty(type)))
            {
                sb.AppendFormat(" @type=\'{0}\'", type);
                first = false;
            }
            if (!(string.IsNullOrEmpty(phase)))
            {
                if (!first)
                    sb.Append(" and ");
                sb.AppendFormat(" @phase=\'{0}\'", phase);
                first = false;
            }
            if (!(string.IsNullOrEmpty(commandName)))
            {
                if (!first)
                    sb.Append(" and ");
                sb.AppendFormat(" @commandName=\'{0}\'", commandName);
                first = false;
            }
            if (!(string.IsNullOrEmpty(commandArgument)))
            {
                if (!first)
                    sb.Append(" and ");
                sb.AppendFormat(" @commandArgument=\'{0}\'", commandArgument);
            }
            if (!(string.IsNullOrEmpty(view)))
            {
                if (!first)
                    sb.Append(" and ");
                sb.AppendFormat(" @view=\'{0}\'", view);
                first = false;
            }
            return sb.ToString();
        }

        public ControllerNodeSet SelectSqlBusinessRules(string phase, string commandName, string commandArgument, string view)
        {
            return SelectBusinessRules(CreateBusinessRuleFilter("Sql", phase, commandName, commandArgument, view));
        }

        public ControllerNodeSet SelectEmailBusinessRules(string phase, string commandName, string commandArgument, string view)
        {
            return SelectBusinessRules(CreateBusinessRuleFilter("Email", phase, commandName, commandArgument, view));
        }

        public ControllerNodeSet SelectJavaScriptBusinessRules(string phase, string commandName, string commandArgument, string view)
        {
            return SelectBusinessRules(CreateBusinessRuleFilter("JavaScript", phase, commandName, commandArgument, view));
        }

        public ControllerNodeSet Value(string v)
        {
            foreach (var node in _nodes)
                node.SetValue(Convert.ToString(v));
            return this;
        }

        public ControllerNodeSet CreateBusinessRule(string type, string phase, string commandName, string commandArgument, string view, string script)
        {
            return CreateBusinessRule(type, phase, commandName, commandArgument, view, script, null);
        }

        public ControllerNodeSet CreateBusinessRule(string type, string phase, string commandName, string commandArgument, string view, string script, string name)
        {
            var businessRulesNode = Select("/dataController/businessRules");
            if (businessRulesNode.Nodes.Count == 0)
                businessRulesNode = Select("<businessRules/>").AppendTo("/dataController").Select("businessRules");
            var ruleNode = Select("<rule/>").AppendTo(businessRulesNode).Select("rule[last()]");
            ruleNode.Attr("id", string.Format("crule{0}", businessRulesNode.Nodes[0].Evaluate("count(child::*)+1")));
            ruleNode.Attr("type", type);
            ruleNode.Attr("phase", phase);
            ruleNode.Attr("commandName", commandName);
            if (!(string.IsNullOrEmpty(commandArgument)))
                ruleNode.Attr("commandArgument", commandArgument);
            if (!(string.IsNullOrEmpty(view)))
                ruleNode.Attr("view", view);
            if (!(string.IsNullOrEmpty(name)))
                ruleNode.Attr("name", name);
            ruleNode.Value(script);
            return ruleNode;
        }

        public ControllerNodeSet CreateField(string name, string type)
        {
            return CreateField(name, type, null);
        }

        public ControllerNodeSet CreateField(string name, string type, string formula)
        {
            var fieldsNode = Select("/dataController/fields");
            if (fieldsNode.IsEmpty)
            {
                Select("<fields/>").AppendTo(Select("/dataController"));
                fieldsNode = Select("/dataController/fields");
            }
            if (string.IsNullOrEmpty(type))
                type = "String";
            var fieldNode = Select("<field/>").AppendTo(fieldsNode).Select("field[last()]").Attr("name", name).Attr("type", type);
            if (type == "String")
                fieldNode.Attr("length", 250);
            if (!(string.IsNullOrEmpty(formula)))
                fieldNode.Attr("computed", true).Elem("formula", formula);
            return fieldNode;
        }

        public ControllerNodeSet StatusBar(string statusMap)
        {
            return StatusBar(null, null, statusMap);
        }

        public ControllerNodeSet StatusBar(string formula, string statusMap)
        {
            return StatusBar(formula, null, statusMap);
        }

        public ControllerNodeSet StatusBar(string formula, string type, string statusMap)
        {
            if (!(string.IsNullOrEmpty(formula)) && SelectField("Status").IsEmpty)
                CreateField("Status", type, formula).Attr("readOnly", true);
            var statusBarNode = Select("/dataController/statusBar");
            if (statusBarNode.IsEmpty)
                statusBarNode = Select("<statusBar/>").AppendTo(Select("/dataController")).Select("/dataController/statusBar");
            statusBarNode.Value(statusMap);
            return statusBarNode;
        }

        public ControllerNodeSet CreateStatusDataField()
        {
            return CreateDataField("Status");
        }

        public string Value()
        {
            foreach (var node in _nodes)
                return node.Value;
            return string.Empty;
        }

        public void Reset()
        {
            _current = null;
        }

        public bool MoveNext()
        {
            if (_nodes.Count == 0)
                return false;
            if (_current.HasValue && (_current.Value >= (_nodes.Count - 1)))
                return false;
            if (!_current.HasValue)
                _current = 0;
            else
                _current++;
            return true;
        }

        public string GetName()
        {
            return Attr("name").Value();
        }

        public string GetFieldName()
        {
            return Attr("fieldName").Value();
        }

        public string GetLabel()
        {
            return Attr("label").Value();
        }
    }
}
