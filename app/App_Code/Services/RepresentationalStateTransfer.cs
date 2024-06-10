using System;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.ComponentModel;
using System.IO;
using System.IO.Compression;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Xml;
using System.Xml.XPath;
using System.Web;
using System.Web.Security;
using System.Web.UI;
using System.Web.Routing;
using System.Net;
using System.Drawing;
using System.Drawing.Imaging;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using MyCompany.Data;
using MyCompany.Handlers;
using MyCompany.Security;
using MyCompany.Web;

namespace MyCompany.Services
{
    public class UriRestConfig
    {

        private Regex _uri;

        private SortedDictionary<string, string> _properties;

        public static string[] SupportedJSONContentTypes = new string[] {
                "application/json",
                "text/javascript",
                "application/javascript",
                "application/ecmascript",
                "application/x-ecmascript"};

        public UriRestConfig(string uri)
        {
            _uri = new Regex(uri, RegexOptions.IgnoreCase);
            _properties = new SortedDictionary<string, string>();
        }

        public string this[string propertyName]
        {
            get
            {
                string result = null;
                _properties.TryGetValue(propertyName.ToLower(), out result);
                return result;
            }
            set
            {
                if (!(string.IsNullOrEmpty(value)))
                    value = value.Trim();
                _properties[propertyName.ToLower()] = value;
            }
        }

        public static List<UriRestConfig> Enumerate(ControllerConfiguration config)
        {
            var list = new List<UriRestConfig>();
            var restConfigNode = config.SelectSingleNode("/c:dataController/c:restConfig");
            if (restConfigNode != null)
            {
                UriRestConfig urc = null;
                // configuration regex: ^\s*(?'Property'\w+)\s*(:|=)\s*(?'Value'.+?)\s*$
                var m = Regex.Match(restConfigNode.Value, "^\\s*(?\'Property\'\\w+)\\s*(:|=)\\s*(?\'Value\'.+?)\\s*$", (RegexOptions.IgnoreCase | RegexOptions.Multiline));
                while (m.Success)
                {
                    var propertyName = m.Groups["Property"].Value;
                    var propertyValue = m.Groups["Value"].Value;
                    if (propertyName.Equals("Uri", StringComparison.CurrentCultureIgnoreCase))
                        try
                        {
                            urc = new UriRestConfig(propertyValue);
                            list.Add(urc);
                        }
                        catch (Exception)
                        {
                        }
                    else
                    {
                        if (urc != null)
                            urc[propertyName] = propertyValue;
                    }
                    m = m.NextMatch();
                }
            }
            return list;
        }

        public virtual bool IsMatch(HttpRequest request)
        {
            return _uri.IsMatch(request.Path);
        }

        public static bool RequiresAuthentication(HttpRequest request, ControllerConfiguration config)
        {
            foreach (var urc in Enumerate(config))
                if (urc.IsMatch(request) && (urc["Users"] == "?"))
                    return false;
            return true;
        }

        public static bool IsAuthorized(HttpRequest request, ControllerConfiguration config)
        {
            if (request.AcceptTypes == null)
                return false;
            foreach (var urc in Enumerate(config))
                if (urc.IsMatch(request))
                {
                    // verify HTTP method
                    var httpMethod = urc["Method"];
                    if (!(string.IsNullOrEmpty(httpMethod)))
                    {
                        var methodList = Regex.Split(httpMethod, "(\\s*,\\s*)");
                        if (!(methodList.Contains(request.HttpMethod)))
                            return false;
                    }
                    // verify user identity
                    var users = urc["Users"];
                    if (!(string.IsNullOrEmpty(users)) && !((users == "?")))
                    {
                        if (!HttpContext.Current.User.Identity.IsAuthenticated)
                            return false;
                        if (!((users == "*")))
                        {
                            var userList = Regex.Split(users, "(\\s*,\\s*)");
                            if (!(userList.Contains(HttpContext.Current.User.Identity.Name)))
                                return false;
                        }
                    }
                    // verify user roles
                    var roles = urc["Roles"];
                    if (!(string.IsNullOrEmpty(roles)) && !(DataControllerBase.UserIsInRole(roles)))
                        return false;
                    // verify SSL, Xml, and JSON constrains
                    if (true.ToString().Equals(urc["Ssl"], StringComparison.OrdinalIgnoreCase) && !request.IsSecureConnection)
                        return false;
                    if (false.ToString().Equals(urc["Xml"], StringComparison.OrdinalIgnoreCase) && !(IsJSONRequest(request)))
                        return false;
                    if (false.ToString().Equals(urc["Json"], StringComparison.OrdinalIgnoreCase) && IsJSONRequest(request))
                        return false;
                    return true;
                }
            return false;
        }

        public static string TypeOfJSONRequest(HttpRequest request)
        {
            if (((request.QueryString["_dataType"] == "json") || !(string.IsNullOrEmpty(request.QueryString["_instance"]))) || !(string.IsNullOrEmpty(request.QueryString["callback"])))
                return "application/javascript";
            if (request.AcceptTypes != null)
                foreach (var t in request.AcceptTypes)
                {
                    var typeIndex = Array.IndexOf(UriRestConfig.SupportedJSONContentTypes, t);
                    if (!((typeIndex == -1)))
                        return t;
                }
            return null;
        }

        public static bool IsJSONRequest(HttpRequest request)
        {
            return !(string.IsNullOrEmpty(TypeOfJSONRequest(request)));
        }

        public static bool IsJSONPRequest(HttpRequest request)
        {
            var t = TypeOfJSONRequest(request);
            return (!(string.IsNullOrEmpty(t)) && !((t == SupportedJSONContentTypes[0])));
        }
    }

    public partial class RepresentationalStateTransfer : RepresentationalStateTransferBase
    {
    }

    public class RepresentationalStateTransferBase : IHttpHandler, System.Web.SessionState.IRequiresSessionState
    {

        public static Regex JsonDateRegex = new Regex("\"\\\\/Date\\((\\-?\\d+)\\)\\\\/\"");

        public static Regex ScriptResourceRegex = new Regex("^(?\'ScriptName\'[\\w\\-]+?)(\\-(?\'Version\'[\\.\\d]+))?(\\.(?\'Culture\'[\\w\\-]+?))?(\\.(?\'Ac" +
                "cent\'\\w+))?\\.(?\'Extension\'js|css)", RegexOptions.IgnoreCase);

        public static Regex CultureJavaScriptRegex = new Regex("//<\\!\\[CDATA\\[\\s+(?\'JavaScript\'var __cultureInfo[\\s\\S]*?)//\\]\\]>");

        public static string[] NumericTypes = new string[] {
                "SByte",
                "Byte",
                "Int16",
                "Int32",
                "UInt32",
                "Int64",
                "Single",
                "Double",
                "Decimal",
                "Currency"};

        bool IHttpHandler.IsReusable
        {
            get
            {
                return true;
            }
        }

        protected virtual string HttpMethod
        {
            get
            {
                var request = HttpContext.Current.Request;
                var requestType = request.HttpMethod;
                if ((requestType == "GET") && !(string.IsNullOrEmpty(request["callback"])))
                {
                    var t = request.QueryString["_type"];
                    if (!(string.IsNullOrEmpty(t)))
                        requestType = t;
                }
                return requestType;
            }
        }

        void IHttpHandler.ProcessRequest(HttpContext context)
        {
            CultureManager.Initialize();
            var routeValues = context.Request.RequestContext.RouteData.Values;
            var controllerName = ((string)(routeValues["Controller"]));
            if (string.IsNullOrEmpty(controllerName))
                controllerName = context.Request.QueryString["_controller"];
            var output = context.Response.OutputStream;
            var contentType = "text/xml";
            var json = UriRestConfig.IsJSONRequest(context.Request);
            if (json)
                contentType = (UriRestConfig.TypeOfJSONRequest(context.Request) + "; charset=utf-8");
            context.Response.ContentType = contentType;
            try
            {
                if (controllerName == "saas")
                {
                    var service = ((string)(routeValues["Segment1"]));
                    var handler = OAuthHandlerFactory.Create(service);
                    if (handler != null)
                        handler.ProcessRequest(context);
                }
                else
                {
                    if (controllerName == "_authenticate")
                        AuthenticateSaaS(context);
                    else
                    {
                        var script = ScriptResourceRegex.Match(controllerName);
                        var scriptName = script.Groups["ScriptName"].Value;
                        var isSaaS = (scriptName == "factory");
                        var isCombinedScript = (scriptName == "combined");
                        var isStylesheet = (scriptName == "stylesheet");
                        if ((isStylesheet || (scriptName == "touch-theme")) && (script.Groups["Extension"].Value == "css"))
                        {
                            context.Response.ContentType = "text/css; charset=utf-8";
                            var css = string.Empty;
                            if (isStylesheet)
                                css = ApplicationServices.CombineTouchUIStylesheets(context);
                            else
                                css = StylesheetGenerator.Compile(controllerName);
                            ApplicationServices.CompressOutput(context, css);
                        }
                        else
                        {
                            if ((isSaaS || isCombinedScript) && (HttpMethod == "GET"))
                                CombineScripts(context, isSaaS, scriptName, script.Groups["Culture"].Value, script.Groups["Version"].Value);
                            else
                            {
                                if (Regex.IsMatch(HttpMethod, "^(GET|POST|DELETE|PUT)$"))
                                    PerformRequest(context, output, json, controllerName);
                                else
                                    context.Response.StatusCode = 400;
                            }
                        }
                    }
                }
            }
            catch (Exception er)
            {
                if (context.Response.StatusCode != 302)
                {
                    context.Response.ContentType = "text/xml";
                    context.Response.Clear();
                    var writer = CreateXmlWriter(output);
                    RenderException(context, er, writer);
                    writer.Close();
                    context.Response.StatusCode = 400;
                }
            }
        }

        protected virtual void CombineScripts(HttpContext context, bool isSaaS, string scriptName, string culture, string version)
        {
            var request = context.Request;
            var response = context.Response;
            if (!isSaaS)
            {
                var cache = response.Cache;
                cache.SetCacheability(HttpCacheability.Public);
                cache.VaryByParams["_touch"] = true;
                cache.VaryByHeaders["User-Agent"] = true;
                cache.SetOmitVaryStar(true);
                cache.SetExpires(DateTime.Now.AddDays(365));
                cache.SetValidUntilExpires(true);
                cache.SetLastModifiedFromFileDependencies();
            }
            if (isSaaS)
            {
                if (!(string.IsNullOrEmpty(culture)))
                    try
                    {
                        Thread.CurrentThread.CurrentCulture = new CultureInfo(culture);
                        Thread.CurrentThread.CurrentUICulture = new CultureInfo(culture);
                    }
                    catch (Exception)
                    {
                    }
            }
            var sb = new StringBuilder();
            var baseUrl = string.Format("{0}://{1}{2}", request.Url.Scheme, request.Url.Authority, request.ApplicationPath);
            var scripts = AquariumExtenderBase.StandardScripts(true);
            foreach (var sr in scripts)
            {
                var add = true;
                var path = sr.Path;
                var index = path.IndexOf("?");
                if (index > 0)
                {
                    path = path.Substring(0, index);
                    if (path.EndsWith("_System.js"))
                        add = !((request.QueryString["jquery"] == "false"));
                    else
                    {
                        if (path.Contains("daf-membership") && !ApplicationServicesBase.AuthorizationIsSupported)
                            add = false;
                    }
                }
                if (add)
                    try
                    {
                        string script;
                        if (path.Equals("~/js/daf/add.min.js"))
                            script = ApplicationServices.Current.AddScripts();
                        else
                        {
                            if (string.IsNullOrEmpty(path))
                                script = new StreamReader(GetType().Assembly.GetManifestResourceStream(sr.Name)).ReadToEnd();
                            else
                                script = File.ReadAllText(context.Server.MapPath(path));
                        }
                        script = script.Replace(" sourceMappingURL=", " sourceMappingURL=../js/");
                        sb.AppendLine(script);
                        if (!(script.EndsWith(";")))
                            sb.Append(";");
                    }
                    catch (Exception ex)
                    {
                        sb.AppendFormat("alert(\'{0}\');", BusinessRules.JavaScriptString(string.Format("Unable to load {0}{1}:\n\n{2}", path, sr.Name, ex.Message)));
                    }
            }
            if (isSaaS)
            {
                if (ApplicationServices.IsTouchClient)
                    sb.AppendFormat("$(\'<link></link>\').appendTo($(\'head\')).attr({{ href: \'{0}/css//daf/touch-core.min" +
                            ".css\', type: \'text/css\', rel: \'stylesheet\' }});", baseUrl);
                else
                    sb.AppendFormat(string.Format("$(\'<link></link>\').appendTo($(\'head\')).attr({{ href: \'{0}/App_Themes/MyCompany/_T" +
                                "heme_Aquarium.css?{0}\', type: \'text/css\', rel: \'stylesheet\' }});", ApplicationServices.Version), baseUrl);
                try
                {
                    var blankPage = new StringBuilder();
                    var sw = new StringWriter(blankPage);
                    context.Server.Execute("~/default.aspx?_page=_blank", sw);
                    sw.Flush();
                    sw.Close();
                    var cultureJS = CultureJavaScriptRegex.Match(blankPage.ToString());
                    if (cultureJS.Success)
                    {
                        sb.AppendLine(cultureJS.Groups["JavaScript"].Value);
                        sb.AppendLine("Sys.CultureInfo.CurrentCulture=__cultureInfo;");
                    }
                }
                catch (Exception)
                {
                }
                sb.AppendFormat("var __targetFramework=\'4.7.2\';__tf=4.0;__cothost=\'appfactory\';__appInfo=\'Aplicaci" +
                        "onDemo|{0}\';", BusinessRules.JavaScriptString(context.User.Identity.Name));
                sb.AppendFormat("Sys.Application.add_init(function() {{ Web.DataView._run(\'{0}\',\'{0}/Services/Data" +
                        "ControllerService.asmx\', {1}) }});", baseUrl, context.User.Identity.IsAuthenticated.ToString().ToLower());
            }
            context.Response.ContentType = "application/javascript; charset=utf-8";
            ApplicationServices.CompressOutput(context, sb.ToString());
        }

        protected virtual void AuthenticateSaaS(HttpContext context)
        {
            var request = context.Request;
            var response = context.Response;
            var args = request.Params["args"];
            var result = new StringBuilder(string.Format("{0}(", request.QueryString["callback"]));
            object resultObject = false;
            var login = JsonConvert.DeserializeObject<string[]>(args);
            resultObject = ApplicationServices.Login(((string)(login[0])), ((string)(login[1])), false);
            result.Append(JsonConvert.SerializeObject(resultObject));
            result.Append(")");
            var jsonp = result.ToString();
            response.Write(jsonp);
        }

        private string DoReplaceDateTicks(Match m)
        {
            return string.Format("new Date({0})", m.Groups[1].Value);
        }

        internal virtual XmlWriter CreateXmlWriter(Stream output)
        {
            var settings = new XmlWriterSettings()
            {
                CloseOutput = false,
                Indent = true
            };
            var writer = XmlWriter.Create(output, settings);
            return writer;
        }

        internal virtual void RenderException(HttpContext context, Exception er, XmlWriter writer)
        {
            if (er != null)
            {
                writer.WriteStartElement("error");
                writer.WriteElementString("message", er.Message);
                writer.WriteElementString("type", er.GetType().ToString());
                if (context.Request.UserHostName == "::1")
                {
                    writer.WriteStartElement("stackTrace");
                    writer.WriteCData(er.StackTrace);
                    writer.WriteEndElement();
                    RenderException(context, er.InnerException, writer);
                }
                writer.WriteEndElement();
            }
        }

        protected XPathNavigator SelectView(ControllerConfiguration config, string viewId)
        {
            return config.SelectSingleNode("/c:dataController/c:views/c:view[@id=\'{0}\']", viewId);
        }

        protected XPathNavigator SelectDataField(ControllerConfiguration config, string viewId, string fieldName)
        {
            return config.SelectSingleNode("/c:dataController/c:views/c:view[@id=\'{0}\']/.//c:dataField[@fieldName=\'{1}\' or @a" +
                    "liasFieldName=\'{1}\']", viewId, fieldName);
        }

        protected XPathNavigator SelectField(ControllerConfiguration config, string name)
        {
            return config.SelectSingleNode("/c:dataController/c:fields/c:field[@name=\'{0}\']", name);
        }

        protected XPathNavigator SelectActionGroup(ControllerConfiguration config, string actionGroupId)
        {
            return config.SelectSingleNode("/c:dataController/c:actions/c:actionGroup[@id=\'{0}\']", actionGroupId);
        }

        protected XPathNavigator SelectAction(ControllerConfiguration config, string actionGroupId, string actionId)
        {
            return config.SelectSingleNode("/c:dataController/c:actions/c:actionGroup[@id=\'{0}\']/c:action[@id=\'{1}\']", actionGroupId, actionId);
        }

        private bool VerifyActionSegments(ControllerConfiguration config, string actionGroupId, string actionId, bool keyIsAvailable)
        {
            var result = true;
            if (SelectActionGroup(config, actionGroupId) != null)
            {
                var actionNode = SelectAction(config, actionGroupId, actionId);
                if (actionNode == null)
                    result = false;
                else
                {
                    if (!keyIsAvailable && ((actionNode.GetAttribute("whenKeySelected", string.Empty) == "true") || Regex.IsMatch(actionNode.GetAttribute("commandName", string.Empty), "^(Update|Delete)$")))
                        result = false;
                }
            }
            else
                result = false;
            return result;
        }

        private void AnalyzeRouteValues(HttpRequest request, HttpResponse response, bool isHttpGetMethod, ControllerConfiguration config, out string view, out string key, out string fieldName, out string actionGroupId, out string actionId, out string commandName)
        {
            var routeValues = request.RequestContext.RouteData.Values;
            var segment1 = ((string)(routeValues["Segment1"]));
            var segment2 = ((string)(routeValues["Segment2"]));
            var segment3 = ((string)(routeValues["Segment3"]));
            var segment4 = ((string)(routeValues["Segment4"]));
            view = null;
            key = null;
            fieldName = null;
            actionGroupId = null;
            actionId = null;
            commandName = null;
            if (!(string.IsNullOrEmpty(segment1)))
            {
                if (SelectView(config, segment1) != null)
                {
                    view = segment1;
                    if (isHttpGetMethod)
                    {
                        key = segment2;
                        fieldName = segment3;
                    }
                    else
                    {
                        if (VerifyActionSegments(config, segment2, segment3, false))
                        {
                            actionGroupId = segment2;
                            actionId = segment3;
                        }
                        else
                        {
                            if (string.IsNullOrEmpty(segment2))
                            {
                                if (HttpMethod != "POST")
                                    response.StatusCode = 404;
                            }
                            else
                            {
                                key = segment2;
                                if (VerifyActionSegments(config, segment3, segment4, true))
                                {
                                    actionGroupId = segment3;
                                    actionId = segment4;
                                }
                                else
                                {
                                    if (!(((HttpMethod == "PUT") || (HttpMethod == "DELETE"))))
                                        response.StatusCode = 404;
                                }
                            }
                        }
                    }
                }
                else
                {
                    if (isHttpGetMethod)
                    {
                        key = segment1;
                        fieldName = segment2;
                    }
                    else
                    {
                        if (VerifyActionSegments(config, segment1, segment2, false))
                        {
                            actionGroupId = segment1;
                            actionId = segment2;
                        }
                        else
                        {
                            if (string.IsNullOrEmpty(segment1))
                                response.StatusCode = 404;
                            else
                            {
                                key = segment1;
                                if (VerifyActionSegments(config, segment2, segment3, true))
                                {
                                    actionGroupId = segment2;
                                    actionId = segment3;
                                }
                                else
                                {
                                    if (!(((HttpMethod == "PUT") || (HttpMethod == "DELETE"))))
                                        response.StatusCode = 404;
                                }
                            }
                        }
                    }
                }
            }
            else
            {
                view = request.QueryString["_view"];
                key = request.QueryString["_key"];
                fieldName = request.QueryString["_fieldName"];
                if (!isHttpGetMethod)
                    actionGroupId = request.QueryString["_actionId"];
            }
            if (!isHttpGetMethod)
            {
                var actionNode = SelectAction(config, actionGroupId, actionId);
                if (actionNode != null)
                    commandName = actionNode.GetAttribute("commandName", string.Empty);
                else
                    commandName = HttpMethodToCommandName(request);
            }
        }

        private string HttpMethodToCommandName(HttpRequest request)
        {
            if (HttpMethod == "POST")
                return "Insert";
            if (HttpMethod == "PUT")
                return "Update";
            if (HttpMethod == "DELETE")
                return "Delete";
            return null;
        }

        protected virtual bool AuthorizeRequest(HttpRequest request, ControllerConfiguration config)
        {
            return UriRestConfig.IsAuthorized(request, config);
        }

        private void PerformRequest(HttpContext context, Stream output, bool json, string controllerName)
        {
            var request = context.Request;
            var response = context.Response;
            ControllerConfiguration config = null;
            try
            {
                config = DataControllerBase.CreateConfigurationInstance(GetType(), controllerName);
            }
            catch (Exception)
            {
                response.StatusCode = 404;
                return;
            }
            if (!(AuthorizeRequest(request, config)))
            {
                response.StatusCode = 404;
                return;
            }
            // analyze route segments
            var isHttpGetMethod = (HttpMethod == "GET");
            string view = null;
            string key = null;
            string fieldName = null;
            string actionGroupId = null;
            string actionId = null;
            string commandName = null;
            AnalyzeRouteValues(request, response, isHttpGetMethod, config, out view, out key, out fieldName, out actionGroupId, out actionId, out commandName);
            if (response.StatusCode == 404)
                return;
            var keyIsAvailable = !(string.IsNullOrEmpty(key));
            if (string.IsNullOrEmpty(view))
            {
                if (isHttpGetMethod)
                    view = Controller.GetSelectView(controllerName);
                else
                {
                    if (commandName == "Insert")
                        view = Controller.GetInsertView(controllerName);
                    else
                    {
                        if (commandName == "Update")
                            view = Controller.GetUpdateView(controllerName);
                        else
                        {
                            if (commandName == "Delete")
                                view = Controller.GetDeleteView(controllerName);
                        }
                    }
                }
            }
            if (SelectView(config, view) == null)
            {
                response.StatusCode = 404;
                return;
            }
            XPathNavigator dataFieldNode = null;
            XPathNavigator fieldNode = null;
            if (!(string.IsNullOrEmpty(fieldName)))
            {
                dataFieldNode = SelectDataField(config, view, fieldName);
                fieldNode = SelectField(config, fieldName);
                if ((dataFieldNode == null) || (fieldNode == null))
                {
                    response.StatusCode = 404;
                    return;
                }
            }
            // create a filter
            var filter = new List<string>();
            // process key fields
            if (keyIsAvailable)
            {
                var values = key.Split(new char[] {
                            ','}, StringSplitOptions.RemoveEmptyEntries);
                var keyIterator = config.Select("/c:dataController/c:fields/c:field[@isPrimaryKey=\'true\']");
                var index = 0;
                while (keyIterator.MoveNext())
                {
                    filter.Add(string.Format("{0}:={1}", keyIterator.Current.GetAttribute("name", string.Empty), values[index]));
                    index++;
                }
            }
            // process quick find
            var quickFind = request.Params["_q"];
            if (!(string.IsNullOrEmpty(quickFind)))
                filter.Add(string.Format("{0}:~{1}", config.SelectSingleNode("/c:dataController/c:views/c:view[@id=\'{0}\']/.//c:dataField[1]/@fieldName", view).Value, quickFind));
            // process filter parameters
            if (!keyIsAvailable)
                foreach (string filterName in request.Params.Keys)
                    if (SelectDataField(config, view, filterName) != null)
                        filter.Add(string.Format("{0}:={1}", filterName, request.Params[filterName]));
                    else
                    {
                        var m = BusinessRules.SqlFieldFilterOperationRegex.Match(filterName);
                        var filterFieldName = m.Groups["Name"].Value;
                        if (m.Success && (SelectDataField(config, view, filterFieldName) != null))
                        {
                            var operation = m.Groups["Operation"].Value;
                            var filterOperation = ((RowFilterOperation)(TypeDescriptor.GetConverter(typeof(RowFilterOperation)).ConvertFromString(operation)));
                            var filterValue = request.Params[filterName];
                            if ((filterOperation == RowFilterOperation.Includes) || (filterOperation == RowFilterOperation.DoesNotInclude))
                                filterValue = Regex.Replace(filterValue, ",", "$or$");
                            else
                            {
                                if (filterOperation == RowFilterOperation.Between)
                                    filterValue = Regex.Replace(filterValue, ",", "$and$");
                            }
                            filter.Add(string.Format("{0}:{1}{2}", filterFieldName, RowFilterAttribute.ComparisonOperations[Convert.ToInt32(filterOperation)], filterValue));
                        }
                    }
            // execute request
            if (isHttpGetMethod)
            {
                if (fieldNode != null)
                {
                    var style = "o";
                    if (request.QueryString["_style"] == "Thumbnail")
                        style = "t";
                    var blobPath = string.Format("~/Blob.ashx?{0}={1}|{2}", fieldNode.GetAttribute("onDemandHandler", string.Empty), style, key);
                    context.RewritePath(blobPath);
                    var blobHandler = new Blob();
                    ((IHttpHandler)(blobHandler)).ProcessRequest(context);
                }
                else
                    ExecuteHttpGetRequest(request, response, output, json, controllerName, view, filter, keyIsAvailable);
            }
            else
                ExecuteActionRequest(request, response, output, json, config, controllerName, view, key, filter, actionGroupId, actionId);
        }

        private void ExecuteActionRequest(HttpRequest request, HttpResponse response, Stream output, bool json, ControllerConfiguration config, string controllerName, string view, string key, List<string> filter, string actionGroupId, string actionId)
        {
            var actionNode = SelectAction(config, actionGroupId, actionId);
            var commandName = HttpMethodToCommandName(request);
            var commandArgument = string.Empty;
            var lastCommandName = string.Empty;
            if (actionNode == null)
            {
                if (string.IsNullOrEmpty(commandName))
                {
                    response.StatusCode = 404;
                    return;
                }
            }
            else
            {
                commandName = actionNode.GetAttribute("commandName", string.Empty);
                commandArgument = actionNode.GetAttribute("commandArgument", string.Empty);
                lastCommandName = actionNode.GetAttribute("whenLastCommandName", string.Empty);
            }
            // prepare action arguments
            var args = new ActionArgs()
            {
                Controller = controllerName,
                View = view,
                CommandName = commandName,
                CommandArgument = commandArgument,
                LastCommandName = lastCommandName,
                Filter = filter.ToArray(),
                SortExpression = request.QueryString["_sortExpression"]
            };
            var selectedValues = request.Params["_selectedValues"];
            if (!(string.IsNullOrEmpty(selectedValues)))
                args.SelectedValues = selectedValues.Split(new char[] {
                            ','}, StringSplitOptions.RemoveEmptyEntries);
            args.Trigger = request.Params["_trigger"];
            args.Path = string.Format("{0}/{1}", actionGroupId, actionId);
            var form = request.Form;
            if (request.HttpMethod == "GET")
                form = request.QueryString;
            var values = new List<FieldValue>();
            foreach (string fieldName in form.Keys)
            {
                var field = SelectField(config, fieldName);
                var dataField = SelectDataField(config, view, fieldName);
                if (field != null)
                {
                    object oldValue = form[(fieldName + "_OldValue")];
                    object value = form[fieldName];
                    // try parsing the values
                    string dataFormatString = null;
                    if (dataField != null)
                        dataFormatString = dataField.GetAttribute("dataFormatString", string.Empty);
                    if (string.IsNullOrEmpty(dataFormatString))
                        dataFormatString = field.GetAttribute("dataFormatString", string.Empty);
                    if (!(string.IsNullOrEmpty(dataFormatString)) && !(dataFormatString.StartsWith("{")))
                        dataFormatString = string.Format("{{0:{0}}}", dataFormatString);
                    var fieldType = field.GetAttribute("type", string.Empty);
                    if (NumericTypes.Contains(fieldType))
                    {
                        double d;
                        if (Double.TryParse(((string)(value)), NumberStyles.Any, CultureInfo.CurrentUICulture, out d))
                            value = d;
                        if (Double.TryParse(((string)(oldValue)), NumberStyles.Any, CultureInfo.CurrentUICulture, out d))
                            oldValue = d;
                    }
                    else
                    {
                        if (fieldType == "DateTime")
                        {
                            DateTime dt;
                            if (!(string.IsNullOrEmpty(dataFormatString)))
                            {
                                if (DateTime.TryParseExact(((string)(value)), dataFormatString, CultureInfo.CurrentUICulture, DateTimeStyles.None, out dt))
                                    value = dt;
                                if (DateTime.TryParseExact(((string)(oldValue)), dataFormatString, CultureInfo.CurrentUICulture, DateTimeStyles.None, out dt))
                                    oldValue = dt;
                            }
                            else
                            {
                                if (DateTime.TryParse(((string)(value)), out dt))
                                    value = dt;
                                if (DateTime.TryParse(((string)(oldValue)), out dt))
                                    oldValue = dt;
                            }
                        }
                    }
                    // create a field value
                    FieldValue fvo = null;
                    if (oldValue != null)
                        fvo = new FieldValue(fieldName, oldValue, value);
                    else
                        fvo = new FieldValue(fieldName, value);
                    // figure if the field is read-only
                    var isReadOnly = (field.GetAttribute("readOnly", string.Empty) == "true");
                    var writeRoles = field.GetAttribute("writeRoles", string.Empty);
                    if (!(string.IsNullOrEmpty(writeRoles)) && !(DataControllerBase.UserIsInRole(writeRoles)))
                        isReadOnly = true;
                    if (dataField == null)
                        isReadOnly = true;
                    fvo.ReadOnly = isReadOnly;
                    // add field value to the list
                    values.Add(fvo);
                }
            }
            var keyIndex = 0;
            var keyIterator = config.Select("/c:dataController/c:fields/c:field[@isPrimaryKey=\'true\']");
            while (keyIterator.MoveNext())
            {
                var fieldName = keyIterator.Current.GetAttribute("name", string.Empty);
                foreach (var fvo in values)
                    if (fvo.Name == fieldName)
                    {
                        fieldName = null;
                        if ((fvo.OldValue == null) && ((commandName == "Update") || (commandName == "Delete")))
                        {
                            fvo.OldValue = fvo.NewValue;
                            fvo.Modified = false;
                        }
                        break;
                    }
                if (!(string.IsNullOrEmpty(fieldName)))
                {
                    string oldValue = null;
                    if (!(string.IsNullOrEmpty(key)))
                    {
                        var keyValues = key.Split(new char[] {
                                    ','}, StringSplitOptions.RemoveEmptyEntries);
                        if (keyIndex < keyValues.Length)
                            oldValue = keyValues[keyIndex];
                    }
                    values.Add(new FieldValue(fieldName, oldValue, oldValue));
                }
                keyIndex++;
            }
            args.Values = values.ToArray();
            // execute action
            var controllerInstance = ControllerFactory.CreateDataController();
            var result = controllerInstance.Execute(controllerName, view, args);
            // redirect response location if success or error url has been specified
            var successUrl = request.Params["_successUrl"];
            var errorUrl = request.Params["_errorUrl"];
            if ((result.Errors.Count == 0) && !(string.IsNullOrEmpty(successUrl)))
            {
                response.RedirectLocation = successUrl;
                response.StatusCode = 301;
                return;
            }
            if ((result.Errors.Count > 0) && !(string.IsNullOrEmpty(errorUrl)))
            {
                if (errorUrl.Contains("?"))
                    errorUrl = (errorUrl + "&");
                else
                    errorUrl = (errorUrl + "?");
                errorUrl = string.Format("{0}_error={1}", errorUrl, HttpUtility.UrlEncode(result.Errors[0]));
                response.RedirectLocation = errorUrl;
                response.StatusCode = 301;
                return;
            }
            if (json)
            {
                var sw = CreateStreamWriter(request, response, output);
                BeginResponsePadding(request, sw);
                sw.Write("{{\"rowsAffected\":{0}", result.RowsAffected);
                if ((result.Errors != null) && (result.Errors.Count > 0))
                {
                    sw.Write(",\"errors\":[");
                    var first = true;
                    foreach (var er in result.Errors)
                    {
                        if (first)
                            first = false;
                        else
                            sw.Write(",");
                        sw.Write("{{\"message\":\"{0}\"}}", BusinessRules.JavaScriptString(er));
                    }
                    sw.Write("]");
                }
                if (!(string.IsNullOrEmpty(result.ClientScript)))
                    sw.Write(",\"clientScript\":\"{0}\"", BusinessRules.JavaScriptString(result.ClientScript));
                if (!(string.IsNullOrEmpty(result.NavigateUrl)))
                    sw.Write(",\"navigateUrl\":\"{0}\"", BusinessRules.JavaScriptString(result.NavigateUrl));
                if (result.Values != null)
                    foreach (var fvo in result.Values)
                    {
                        sw.Write(",\"{0}\":", fvo.Name);
                        WriteJSONValue(sw, fvo.Value, null);
                    }
                sw.Write("}");
                EndResponsePadding(request, sw);
                sw.Close();
            }
            else
            {
                var writer = CreateXmlWriter(output);
                writer.WriteStartDocument();
                writer.WriteStartElement("result");
                writer.WriteAttributeString("rowsAffected", result.RowsAffected.ToString());
                if ((result.Errors != null) && (result.Errors.Count > 0))
                {
                    writer.WriteStartElement("errors");
                    foreach (var er in result.Errors)
                    {
                        writer.WriteStartElement("error");
                        writer.WriteAttributeString("message", er);
                        writer.WriteEndElement();
                    }
                    writer.WriteEndElement();
                }
                if (!(string.IsNullOrEmpty(result.ClientScript)))
                    writer.WriteAttributeString("clientScript", result.ClientScript);
                if (!(string.IsNullOrEmpty(result.NavigateUrl)))
                    writer.WriteAttributeString("navigateUrl", result.NavigateUrl);
                if (result.Values != null)
                    foreach (var fvo in result.Values)
                        writer.WriteElementString(fvo.Name, Convert.ToString(fvo.Value));
                writer.WriteEndElement();
                writer.WriteEndDocument();
                writer.Close();
            }
        }

        protected virtual void WriteJSONValue(StreamWriter writer, object v, DataField field)
        {
            string dataFormatString = null;
            if (field != null)
                dataFormatString = field.DataFormatString;
            if (v == null)
                writer.Write("null");
            else
            {
                if (v is string)
                    writer.Write("\"{0}\"", BusinessRules.JavaScriptString(((string)(v))));
                else
                {
                    if (v is DateTime)
                        writer.Write("\"{0}\"", ConvertDateToJSON(((DateTime)(v)), dataFormatString));
                    else
                    {
                        if (v is Guid)
                            writer.Write("\"{0}\"", BusinessRules.JavaScriptString(v.ToString()));
                        else
                        {
                            if (v is bool)
                                writer.Write(v.ToString().ToLower());
                            else
                            {
                                if (!(string.IsNullOrEmpty(dataFormatString)))
                                    writer.Write("\"{0}\"", ConvertValueToJSON(v, dataFormatString));
                                else
                                    writer.Write(ConvertValueToJSON(v, null));
                            }
                        }
                    }
                }
            }
        }

        protected virtual void ExecuteHttpGetRequest(HttpRequest request, HttpResponse response, Stream output, bool json, string controllerName, string view, List<string> filter, bool keyIsAvailable)
        {
            // prepare a page request
            int pageSize;
            int.TryParse(request.QueryString["_pageSize"], out pageSize);
            if (pageSize == 0)
                pageSize = 100;
            int pageIndex;
            int.TryParse(request.QueryString["_pageIndex"], out pageIndex);
            var r = new PageRequest()
            {
                Controller = controllerName,
                View = view,
                RequiresMetaData = true,
                PageSize = pageSize,
                PageIndex = pageIndex,
                Filter = filter.ToArray(),
                RequiresRowCount = ((pageIndex == 0) && !keyIsAvailable),
                SortExpression = request.QueryString["_sortExpression"]
            };
            // request the data
            var controllerInstance = ControllerFactory.CreateDataController();
            var page = controllerInstance.GetPage(r.Controller, r.View, r);
            if (keyIsAvailable && (page.Rows.Count == 0))
            {
                response.StatusCode = 404;
                return;
            }
            // stream out the data
            XmlWriter writer = null;
            StreamWriter sw = null;
            if (json)
            {
                sw = CreateStreamWriter(request, response, output);
                BeginResponsePadding(request, sw);
                if (!keyIsAvailable)
                {
                    sw.Write("{");
                    if (r.RequiresRowCount)
                        sw.Write("\"totalRowCount\":{0},", page.TotalRowCount);
                    sw.Write("\"pageSize\":{0},\"pageIndex\":{1},\"rowCount\":{2},", page.PageSize, page.PageIndex, page.Rows.Count);
                    sw.Write("\"{0}\":[", controllerName);
                }
            }
            else
            {
                writer = CreateXmlWriter(output);
                writer.WriteStartDocument();
                writer.WriteStartElement(controllerName);
                if (r.RequiresRowCount)
                    writer.WriteAttributeString("totalRowCount", page.TotalRowCount.ToString());
                if (!keyIsAvailable)
                {
                    writer.WriteAttributeString("pageSize", page.PageSize.ToString());
                    writer.WriteAttributeString("pageIndex", page.PageIndex.ToString());
                    writer.WriteAttributeString("rowCount", page.Rows.Count.ToString());
                    writer.WriteStartElement("items");
                }
            }
            var firstRow = true;
            foreach (var field in page.Fields)
                if (!(string.IsNullOrEmpty(field.DataFormatString)) && !(field.DataFormatString.StartsWith("{")))
                    field.DataFormatString = string.Format("{{0:{0}}}", field.DataFormatString);
            foreach (var row in page.Rows)
            {
                var index = 0;
                if (json)
                {
                    if (firstRow)
                        firstRow = false;
                    else
                        sw.Write(",");
                    sw.Write("{");
                }
                else
                {
                    if (!keyIsAvailable)
                        writer.WriteStartElement("item");
                }
                var firstField = true;
                foreach (var field in page.Fields)
                {
                    if (json)
                    {
                        if (firstField)
                            firstField = false;
                        else
                            sw.Write(",");
                        sw.Write("\"{0}\":", field.Name);
                        WriteJSONValue(sw, row[index], field);
                    }
                    else
                    {
                        var v = row[index];
                        if (v != null)
                        {
                            string s = null;
                            if (!(string.IsNullOrEmpty(field.DataFormatString)))
                                s = string.Format(field.DataFormatString, v);
                            else
                                s = Convert.ToString(v);
                            writer.WriteAttributeString(field.Name, s);
                        }
                    }
                    index++;
                }
                if (json)
                    sw.Write("}");
                else
                {
                    if (!keyIsAvailable)
                        writer.WriteEndElement();
                }
                if (keyIsAvailable)
                    break;
            }
            if (json)
            {
                if (!keyIsAvailable)
                    sw.Write("]}");
                EndResponsePadding(request, sw);
                sw.Close();
            }
            else
            {
                if (!keyIsAvailable)
                    writer.WriteEndElement();
                writer.WriteEndElement();
                writer.WriteEndDocument();
                writer.Close();
            }
        }

        protected virtual string ConvertValueToJSON(object v, string dataFormatString)
        {
            if (string.IsNullOrEmpty(dataFormatString))
                return v.ToString();
            else
                return string.Format(dataFormatString, v);
        }

        protected virtual string ConvertDateToJSON(DateTime dt, string dataFormatString)
        {
            dt = dt.ToUniversalTime();
            if (string.IsNullOrEmpty(dataFormatString))
                return dt.ToString("F");
            else
                return string.Format(dataFormatString, dt);
        }

        protected virtual void BeginResponsePadding(HttpRequest request, StreamWriter sw)
        {
            var callback = request.QueryString["callback"];
            if (!(string.IsNullOrEmpty(callback)))
                sw.Write("{0}(", callback);
            else
            {
                if ((request.HttpMethod == "GET") && UriRestConfig.IsJSONPRequest(request))
                {
                    var instance = request.QueryString["_instance"];
                    if (string.IsNullOrEmpty(instance))
                        instance = ((string)(request.RequestContext.RouteData.Values["Controller"]));
                    sw.Write("MyCompany=typeof MyCompany==\'undefined\'?{{}}:MyCompany;MyCompany.{0}=", instance);
                }
            }
        }

        protected virtual void EndResponsePadding(HttpRequest request, StreamWriter sw)
        {
            var callback = request.QueryString["callback"];
            if (!(string.IsNullOrEmpty(callback)))
                sw.Write(")");
            else
            {
                if ((request.HttpMethod == "GET") && UriRestConfig.IsJSONPRequest(request))
                    sw.Write(";");
            }
        }

        protected virtual StreamWriter CreateStreamWriter(HttpRequest request, HttpResponse response, Stream output)
        {
            var acceptEncoding = request.Headers["Accept-Encoding"];
            if (!(string.IsNullOrEmpty(acceptEncoding)))
            {
                var encodings = acceptEncoding.Split(',');
                if (encodings.Contains("gzip"))
                {
                    output = new GZipStream(output, CompressionMode.Compress);
                    response.AppendHeader("Content-Encoding", "gzip");
                }
                else
                {
                    if (encodings.Contains("deflate"))
                    {
                        output = new DeflateStream(output, CompressionMode.Compress);
                        response.AppendHeader("Content-Encoding", "deflate");
                    }
                }
            }
            return new StreamWriter(output);
        }
    }

    public partial class FacebookOAuthHandler : FacebookOAuthHandlerBase
    {
    }

    public partial class FacebookOAuthHandlerBase : OAuthHandler
    {

        private JObject _userObj;

        protected override string Scope
        {
            get
            {
                return (("email" + Config["Scope"])).Trim();
            }
        }

        protected virtual string GetVersion()
        {
            var version = Config["Version"];
            if (string.IsNullOrEmpty(version))
                version = "v2.8";
            return version;
        }

        public override string GetHandlerName()
        {
            return "Facebook";
        }

        public override string GetAuthorizationUrl()
        {
            return string.Format("https://www.facebook.com/{0}/dialog/oauth?response_type=code&client_id={1}&redire" +
                    "ct_uri={2}&scope={3}&state={4}", GetVersion(), Config.ClientId, Config.RedirectUri, Uri.EscapeDataString(Scope), Uri.EscapeDataString(GetState()));
        }

        protected override WebRequest GetAccessTokenRequest(string code, bool refresh)
        {
            return WebRequest.Create(string.Format("https://graph.facebook.com/{0}/oauth/access_token?client_id={1}&redirect_uri={2}&" +
                        "client_secret={3}&code={4}", GetVersion(), Config.ClientId, Config.RedirectUri, Config.ClientSecret, code));
        }

        protected override WebRequest GetQueryRequest(string method, string token)
        {
            var request = WebRequest.Create((("https://graph.facebook.com/" + GetVersion())
                            + ("/" + method)));
            request.Headers[HttpRequestHeader.Authorization] = ("Bearer " + token);
            return request;
        }

        public override string GetUserName()
        {
            _userObj = Query(("me?fields=" + ProfileFieldList()), false);
            return ((string)(_userObj["email"]));
        }

        public override string GetUserImageUrl(MembershipUser user)
        {
            return ("https://graph.facebook.com/"
                        + (GetVersion()
                        + ("/"
                        + (((string)(_userObj["id"])) + "/picture"))));
        }

        protected override void HandleError(HttpContext context)
        {
            if (context.Request.QueryString["error_reason"] == "user_denied")
                context.Response.Redirect(ApplicationServices.HomePageUrl);
            base.HandleError(context);
        }

        protected virtual string ProfileFieldList()
        {
            var fieldList = new List<string>();
            var s = Config["Profile Field List"];
            if (!(string.IsNullOrEmpty(s)))
                fieldList.AddRange(Regex.Split(s, "\\s*\\,\\s*"));
            if (!(fieldList.Contains("email")))
                fieldList.Insert(0, "email");
            return string.Join(",", fieldList.ToArray());
        }
    }

    public partial class GoogleOAuthHandler : GoogleOAuthHandlerBase
    {
    }

    public partial class GoogleOAuthHandlerBase : OAuthHandler
    {

        private JObject _userObj;

        protected override string Scope
        {
            get
            {
                var defaultScope = (("email " + Config["Scope"])).Trim();
                if (StoreToken)
                    defaultScope = (defaultScope + " https://www.googleapis.com/auth/admin.directory.group.readonly");
                return defaultScope;
            }
        }

        public override string GetHandlerName()
        {
            return "Google";
        }

        public override string GetAuthorizationUrl()
        {
            var accessType = "online";
            if (StoreToken)
                accessType = "offline";
            var authUrl = string.Format("https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id={0}&red" +
                    "irect_uri={1}&scope={2}&state={3}&access_type={4}&prompt=select_account", Config.ClientId, Uri.EscapeDataString(Config.RedirectUri), Uri.EscapeDataString(Scope), Uri.EscapeDataString(GetState()), accessType);
            return authUrl;
        }

        protected override WebRequest GetAccessTokenRequest(string code, bool refresh)
        {
            var request = WebRequest.Create("https://www.googleapis.com/oauth2/v4/token");
            request.Method = "POST";
            var codeType = "code";
            if (refresh)
                codeType = "access_token";
            var body = string.Format("{0}={1}&client_id={2}&client_secret={3}&redirect_uri={4}&grant_type=authorization" +
                    "_code", codeType, code, Config.ClientId, Config.ClientSecret, Config.RedirectUri);
            var bodyBytes = Encoding.UTF8.GetBytes(body);
            request.ContentType = "application/x-www-form-urlencoded";
            request.ContentLength = bodyBytes.Length;
            using (var stream = request.GetRequestStream())
                stream.Write(bodyBytes, 0, bodyBytes.Length);
            return request;
        }

        protected override WebRequest GetQueryRequest(string method, string token)
        {
            var request = WebRequest.Create(("https://www.googleapis.com/" + method));
            request.Headers[HttpRequestHeader.Authorization] = ("Bearer " + token);
            return request;
        }

        public override string GetUserName()
        {
            _userObj = Query("userinfo/v2/me", false);
            return ((string)(_userObj["email"]));
        }

        public override List<string> GetUserRoles(MembershipUser user)
        {
            var roles = base.GetUserRoles(user);
            var result = Query(("admin/directory/v1/groups?userKey=" + ((string)(_userObj["id"]))), true);
            if (result != null)
                foreach (var group in ((JArray)(result["groups"])))
                    roles.Add(((string)(group["name"])));
            else
                throw new Exception("Unable to get roles.");
            return roles;
        }

        public override string GetUserImageUrl(MembershipUser user)
        {
            return ((string)(_userObj["picture"]));
        }
    }

    public partial class MSGraphOAuthHandler : MSGraphOAuthHandlerBase
    {
    }

    public partial class MSGraphOAuthHandlerBase : OAuthHandler
    {

        private string _userID = null;

        private string _tenantID;

        protected override string Scope
        {
            get
            {
                var sc = Config["Scope"];
                if (StoreToken)
                    sc = (sc + " https://graph.microsoft.com/.default");
                else
                    sc = (sc + " User.Read");
                return sc.Trim();
            }
        }

        public virtual string TenantID
        {
            get
            {
                if (string.IsNullOrEmpty(_tenantID))
                {
                    _tenantID = Config["Tenant ID"];
                    if (string.IsNullOrEmpty(_tenantID))
                        _tenantID = "common";
                }
                return _tenantID;
            }
        }

        public override string GetHandlerName()
        {
            return "MSGraph";
        }

        public override string GetAuthorizationUrl()
        {
            var sb = new StringBuilder("https://login.microsoftonline.com/");
            sb.Append(TenantID);
            if (!StoreToken)
                sb.Append("/oauth2/v2.0/authorize");
            else
                sb.Append("/adminconsent");
            sb.AppendFormat("?client_id={0}&redirect_uri={1}&state={2}", Config.ClientId, Uri.EscapeDataString(Config.RedirectUri), Uri.EscapeDataString(GetState()));
            if (!StoreToken)
            {
                sb.Append("&response_type=code&response_mode=query&scope=");
                sb.Append(Uri.EscapeDataString(Scope));
            }
            return sb.ToString();
        }

        protected override WebRequest GetAccessTokenRequest(string code, bool refresh)
        {
            var request = WebRequest.Create(string.Format("https://login.microsoftonline.com/{0}/oauth2/v2.0/token", TenantID));
            request.Method = "POST";
            var body = string.Format("client_id={0}&redirect_uri={1}&client_secret={2}&scope={3}", Config.ClientId, Uri.EscapeDataString(Config.RedirectUri), Config.ClientSecret, Uri.EscapeDataString(Scope));
            if (refresh)
                body = (body
                            + ("&grant_type=refresh_token&refresh_token=" + code));
            else
            {
                if (!StoreToken)
                    body = (body
                                + ("&grant_type=authorization_code&code=" + code));
                else
                    body = (body + "&grant_type=client_credentials");
            }
            var bodyBytes = Encoding.UTF8.GetBytes(body);
            request.ContentType = "application/x-www-form-urlencoded";
            request.ContentLength = bodyBytes.Length;
            using (var stream = request.GetRequestStream())
                stream.Write(bodyBytes, 0, bodyBytes.Length);
            return request;
        }

        protected override WebRequest GetQueryRequest(string method, string token)
        {
            var request = WebRequest.Create(("https://graph.microsoft.com/v1.0/" + method));
            request.Headers[HttpRequestHeader.Authorization] = ("Bearer " + token);
            return request;
        }

        protected override bool RefreshTokens(bool useSystemToken)
        {
            if (!useSystemToken)
                return base.RefreshTokens(useSystemToken);
            var success = GetAccessTokens("True", false);
            if (success)
                StoreTokens(Tokens, true);
            return success;
        }

        public override string GetUserName()
        {
            var userObj = Query("me", false);
            _userID = ((string)(userObj["id"]));
            return ((string)(userObj["userPrincipalName"]));
        }

        public override List<string> GetUserRoles(MembershipUser user)
        {
            var roles = base.GetUserRoles(user);
            var roleObj = Query((("users/" + _userID)
                            + "/memberOf"), true);
            if (roleObj != null)
                foreach (var role in ((JArray)(roleObj["value"])))
                    roles.Add(((string)(role["displayName"])));
            return roles;
        }

        protected override string GetAuthCode(HttpRequest request)
        {
            if (StoreToken)
                return request.QueryString["admin_consent"];
            return base.GetAuthCode(request);
        }

        public override void SetUserAvatar(MembershipUser user)
        {
        }
    }

    public partial class LinkedInOAuthHandler : LinkedInOAuthHandlerBase
    {
    }

    public partial class LinkedInOAuthHandlerBase : OAuthHandler
    {

        private JObject _userObj;

        protected override string Scope
        {
            get
            {
                return (("r_liteprofile r_emailaddress " + Config["Scope"])).Trim();
            }
        }

        public override string GetHandlerName()
        {
            return "LinkedIn";
        }

        public override string GetAuthorizationUrl()
        {
            return string.Format("https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id={0}&" +
                    "redirect_uri={1}&state={2}&scope={3}", Config.ClientId, Config.RedirectUri, Uri.EscapeDataString(GetState()), Uri.EscapeDataString(Scope));
        }

        public override string GetUserName()
        {
            var obj = Query("emailAddress?q=members&projection=(elements*(handle~))", false);
            _userObj = Query("me?projection=(id,firstName,lastName,profilePicture(displayImage~:playableStreams" +
                    "))", false);
            return ((string)(obj["elements"][0]["handle~"]["emailAddress"]));
        }

        public override string GetUserImageUrl(MembershipUser user)
        {
            return ((string)(_userObj["profilePicture"]["displayImage~"]["elements"].Last["identifiers"][0]["identifier"]));
        }

        protected override WebRequest GetAccessTokenRequest(string code, bool refresh)
        {
            var request = WebRequest.Create("https://www.linkedin.com/oauth/v2/accessToken");
            request.Method = "POST";
            var codeType = "code";
            if (refresh)
                codeType = "access_token";
            var body = string.Format("{0}={1}&client_id={2}&client_secret={3}&redirect_uri={4}&grant_type=authorization" +
                    "_code", codeType, code, Config.ClientId, Config.ClientSecret, Config.RedirectUri);
            var bodyBytes = Encoding.UTF8.GetBytes(body);
            request.ContentType = "application/x-www-form-urlencoded";
            request.ContentLength = bodyBytes.Length;
            using (var stream = request.GetRequestStream())
                stream.Write(bodyBytes, 0, bodyBytes.Length);
            return request;
        }

        protected override WebRequest GetQueryRequest(string method, string token)
        {
            var request = WebRequest.Create(("https://api.linkedin.com/v2/" + method));
            request.Headers[HttpRequestHeader.Authorization] = ("Bearer " + token);
            return request;
        }
    }

    public partial class SharePointOAuthHandler : SharePointOAuthHandlerBase
    {
    }

    public class SharePointOAuthHandlerBase : OAuthHandler
    {

        private string _realm;

        private string _showNavigation;

        private JObject _userObj;

        protected override string Scope
        {
            get
            {
                var sc = Config["Scope"];
                if (StoreToken)
                    sc = (sc + " Web.Read AllProfiles.Read");
                return sc.Trim();
            }
        }

        public override string GetHandlerName()
        {
            return "SharePoint";
        }

        public override string GetAuthorizationUrl()
        {
            var version = Config["Version"];
            if (string.IsNullOrEmpty(version))
                version = "15";
            var authUrl = string.Format("{0}/_layouts/{1}/OAuthAuthorize.aspx?client_id={2}&scope={3}&response_type=code&r" +
                    "edirect_uri={4}&state={5}", ClientUri, version, Config.ClientId, Uri.EscapeDataString(Scope), Uri.EscapeDataString(Config.RedirectUri), Uri.EscapeDataString(GetState()));
            return authUrl;
        }

        protected override WebRequest GetAccessTokenRequest(string code, bool refresh)
        {
            if (string.IsNullOrEmpty(_realm))
            {
                var getRealm = WebRequest.Create((ClientUri + "/_vti_bin/client.svc"));
                getRealm.Headers.Add(HttpRequestHeader.Authorization, "Bearer");
                WebResponse response;
                try
                {
                    response = getRealm.GetResponse();
                }
                catch (WebException ex)
                {
                    response = ex.Response;
                }
                var wwwAuthentication = response.Headers["WWW-Authenticate"];
                var realmMatch = Regex.Match(wwwAuthentication, "Bearer realm=\"(.+?)\"");
                _realm = realmMatch.Groups[1].Value;
            }
            var request = WebRequest.Create((("https://accounts.accesscontrol.windows.net/" + _realm)
                            + "/tokens/OAuth/2"));
            request.Method = "POST";
            var grantType = "authorization_code";
            var codeName = "code";
            if (refresh)
            {
                grantType = "refresh_token";
                codeName = grantType;
            }
            var body = string.Format("grant_type={0}&client_id={1}%40{2}&client_secret={3}&{4}={5}&redirect_uri={6}&res" +
                    "ource=00000003-0000-0ff1-ce00-000000000000%2F{7}%40{2}", grantType, Config.ClientId, _realm, Uri.EscapeDataString(Config.ClientSecret), codeName, code, Config.RedirectUri, ClientUri.Substring(8));
            var bodyBytes = Encoding.UTF8.GetBytes(body);
            request.ContentType = "application/x-www-form-urlencoded";
            request.ContentLength = bodyBytes.Length;
            using (var stream = request.GetRequestStream())
                stream.Write(bodyBytes, 0, bodyBytes.Length);
            return request;
        }

        protected override WebRequest GetQueryRequest(string method, string token)
        {
            var request = WebRequest.Create(string.Format("{0}/_api/{1}", ClientUri, method));
            ((HttpWebRequest)(request)).Accept = "application/json;odata=verbose";
            request.Headers[HttpRequestHeader.Authorization] = ("Bearer " + token);
            return request;
        }

        public override JObject Query(string method, bool useSystemToken)
        {
            var result = base.Query(method, useSystemToken);
            if ((result == null) || (result["d"] == null))
                return result;
            return ((JObject)(result["d"]));
        }

        public override string GetState()
        {
            return ((base.GetState() + "|showNavigation=")
                        + _showNavigation);
        }

        public override void SetState(string state)
        {
            base.SetState(state);
            foreach (var part in state.Split('|'))
            {
                var ps = part.Split('=');
                if (ps[0] == "showNavigation")
                    _showNavigation = ps[1];
            }
        }

        public override string GetUserName()
        {
            _userObj = Query("Web/CurrentUser", false);
            return ((string)(_userObj["LoginName"])).Split('|').Last();
        }

        public override List<string> GetUserRoles(MembershipUser user)
        {
            var roles = base.GetUserRoles(user);
            var groups = Query(("Web/GetUserById("
                            + (((string)(_userObj["Id"])) + ")/Groups")), !StoreToken);
            if (groups == null)
                throw new Exception("Unable to get roles.");
            foreach (var group in ((JArray)(groups["results"])).Children())
            {
                var name = ((string)(group["LoginName"]));
                if (!(name.StartsWith("SharingLinks.")))
                    roles.Add(name);
            }
            return roles;
        }

        public override void RestoreSession(HttpContext context)
        {
            if (string.IsNullOrEmpty(_showNavigation))
                _showNavigation = context.Request.QueryString["showNavigation"];
            var session = context.Request.QueryString["session"];
            if (!(string.IsNullOrEmpty(session)) && (session == "new"))
                ApplicationServices.Current.UserLogout();
            else
            {
                base.RestoreSession(context);
                if (!StoreToken && context.User.Identity.IsAuthenticated)
                    RedirectToStartPage(context);
            }
        }

        public override void RedirectToStartPage(HttpContext context)
        {
            var connector = "?";
            if (StartPage.Contains("?"))
                connector = "&";
            StartPage = ((StartPage
                        + (connector + "_showNavigation="))
                        + _showNavigation);
            base.RedirectToStartPage(context);
        }

        public override string GetUserImageUrl(MembershipUser user)
        {
            var info = Query(string.Format("SP.UserProfiles.PeopleManager/GetPropertiesFor(accountName=@v)?@v=\'{0}\'&$select=P" +
                        "ictureUrl", HttpUtility.UrlEncode(((string)(_userObj["LoginName"])))), true);
            return ((string)(info["PictureUrl"]));
        }
    }

    public partial class WindowsLiveOAuthHandler : WindowsLiveOAuthHandlerBase
    {
    }

    public partial class WindowsLiveOAuthHandlerBase : OAuthHandler
    {

        protected override string Scope
        {
            get
            {
                return (("wl.emails " + Config["Scope"])).Trim();
            }
        }

        public override string GetHandlerName()
        {
            return "WindowsLive";
        }

        public override string GetAuthorizationUrl()
        {
            return string.Format("https://login.live.com/oauth20_authorize.srf?client_id={0}&scope={1}&response_typ" +
                    "e=code&redirect_uri={2}&state={3}", Config.ClientId, Uri.EscapeDataString(Scope), Uri.EscapeDataString(Config.RedirectUri), Uri.EscapeDataString(GetState()));
        }

        protected override WebRequest GetAccessTokenRequest(string code, bool refresh)
        {
            var request = WebRequest.Create("https://login.live.com/oauth20_token.srf");
            request.Method = "POST";
            var codeName = "code";
            var grantType = "authorization_code";
            if (refresh)
            {
                codeName = "refresh_token";
                grantType = codeName;
            }
            var body = string.Format("client_id={0}&redirect_uri={1}&client_secret={2}&{3}={4}&grant_type={5}", Config.ClientId, Config.RedirectUri, Config.ClientSecret, codeName, code, grantType);
            var bodyBytes = Encoding.UTF8.GetBytes(body);
            request.ContentType = "application/x-www-form-urlencoded";
            request.ContentLength = bodyBytes.Length;
            using (var stream = request.GetRequestStream())
                stream.Write(bodyBytes, 0, bodyBytes.Length);
            return request;
        }

        protected override WebRequest GetQueryRequest(string method, string token)
        {
            var version = Config["Version"];
            if (string.IsNullOrEmpty(version))
                version = "v5.0";
            return WebRequest.Create(string.Format("https://apis.live.net/{0}/{1}?access_token={2}", version, method, token));
        }

        public override string GetUserName()
        {
            var userObj = Query("me", false);
            return ((string)(userObj["emails"]["account"]));
        }
    }

    public partial class IdentityServerOAuthHandler : IdentityServerOAuthHandlerBase
    {
    }

    public partial class IdentityServerOAuthHandlerBase : OAuthHandler
    {

        protected override string Scope
        {
            get
            {
                var configScope = Config["Scope"];
                if (!(string.IsNullOrEmpty(configScope)))
                    return configScope;
                return "openid email";
            }
        }

        public override string GetHandlerName()
        {
            return "IdentityServer";
        }

        public override string GetAuthorizationUrl()
        {
            return string.Format("{0}/connect/authorize?response_type=code&client_id={1}&redirect_uri={2}&scope={3}" +
                    "&state={4}", ClientUri, Config.ClientId, Config.RedirectUri, Uri.EscapeDataString(Scope), Uri.EscapeDataString(GetState()));
        }

        protected override WebRequest GetAccessTokenRequest(string code, bool refresh)
        {
            var request = WebRequest.Create((ClientUri + "/connect/token"));
            request.Method = "POST";
            var codeName = "code";
            var grantType = "authorization_code";
            if (refresh)
            {
                codeName = "refresh_token";
                grantType = codeName;
            }
            var body = string.Format("client_id={0}&redirect_uri={1}&client_secret={2}&{3}={4}&grant_type={5}", Config.ClientId, Config.RedirectUri, Config.ClientSecret, codeName, code, grantType);
            var bodyBytes = Encoding.UTF8.GetBytes(body);
            request.ContentType = "application/x-www-form-urlencoded";
            request.ContentLength = bodyBytes.Length;
            using (var stream = request.GetRequestStream())
                stream.Write(bodyBytes, 0, bodyBytes.Length);
            return request;
        }

        protected override WebRequest GetQueryRequest(string method, string token)
        {
            var request = WebRequest.Create(string.Format("{0}/connect/{1}", ClientUri, method));
            request.Headers[HttpRequestHeader.Authorization] = ("Bearer " + token);
            return request;
        }

        public override string GetUserName()
        {
            var userObj = Query("userinfo", false);
            return ((string)(userObj["email"]));
        }
    }
}
