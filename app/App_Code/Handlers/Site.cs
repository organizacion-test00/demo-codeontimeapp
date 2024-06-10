using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Globalization;
using System.IO;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using System.Web;
using System.Web.UI;
using System.Web.UI.HtmlControls;
using System.Web.UI.WebControls;
using System.Web.Configuration;
using System.Xml.XPath;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using MyCompany.Data;
using MyCompany.Services;
using MyCompany.Web;

namespace MyCompany.Handlers
{
    public partial class Site : SiteBase
    {
    }

    public class SiteBase : MyCompany.Web.PageBase
    {

        private bool _isTouchUI;

        private AttributeDictionary _bodyAttributes;

        private LiteralControl _bodyTag;

        private LiteralContainer _pageHeaderContent;

        private LiteralContainer _pageTitleContent;

        private LiteralContainer _headContent;

        private LiteralContainer _pageContent;

        private LiteralContainer _pageFooterContent;

        private LiteralContainer _pageSideBarContent;

        private bool _summaryDisabled = false;

        public static string[] UnsupportedDataViewProperties = new string[] {
                "data-start-command-name",
                "data-start-command-argument"};

        public static string Copyright
        {
            get
            {
                return "Demo";
            }
        }

        public override string Device
        {
            get
            {
                return _bodyAttributes["data-device"];
            }
        }

        public string ResolveAppUrl(string html)
        {
            var appPath = Request.ApplicationPath;
            if (!(appPath.EndsWith("/")))
                appPath = (appPath + "/");
            return html.Replace("=\"~/", ("=\"" + appPath));
        }

        protected virtual string InjectPrefetch(string s)
        {
            if (_isTouchUI)
            {
                var prefetch = PreparePrefetch(s);
                if (!(string.IsNullOrEmpty(prefetch)))
                    s = (prefetch + s);
            }
            return s;
        }

        protected override void OnInit(EventArgs e)
        {
            if (Request.Path.StartsWith((ResolveUrl(AquariumExtenderBase.DefaultServicePath) + "/"), StringComparison.CurrentCultureIgnoreCase) || Request.Path.StartsWith((ResolveUrl(AquariumExtenderBase.AppServicePath) + "/"), StringComparison.CurrentCultureIgnoreCase))
                ApplicationServices.HandleServiceRequest(Context);
            if (Request.Params["_page"] == "_blank")
                return;
            var link = Request.Params["_link"];
            if (!(string.IsNullOrEmpty(link)))
            {
                var permalink = StringEncryptor.FromString(link.Replace(" ", "+").Split(',')[0]).Split('?');
                if (permalink.Length == 2)
                    Page.ClientScript.RegisterStartupScript(GetType(), "Redirect", string.Format("window.location.replace(\'{0}?_link={1}\');", permalink[0], HttpUtility.UrlEncode(link)), true);
            }
            else
            {
                var requestUrl = Request.RawUrl;
                if ((requestUrl.Length > 1) && requestUrl.EndsWith("/"))
                    requestUrl = requestUrl.Substring(0, (requestUrl.Length - 1));
                if (Request.ApplicationPath.Equals(requestUrl, StringComparison.CurrentCultureIgnoreCase))
                {
                    var homePageUrl = ApplicationServices.HomePageUrl;
                    if (!(Request.ApplicationPath.Equals(homePageUrl)))
                        Response.Redirect(homePageUrl);
                }
            }
            var contentInfo = ApplicationServices.LoadContent();
            InitializeSiteMaster();
            string s = null;
            if (!(contentInfo.TryGetValue("PageTitle", out s)))
                s = ApplicationServicesBase.Current.DisplayName;
            this.Title = s;
            if (_pageTitleContent != null)
            {
                if (_isTouchUI)
                    _pageTitleContent.Text = string.Empty;
                else
                    _pageTitleContent.Text = s;
            }
            var appName = new LiteralControl(string.Format("<meta name=\"application-name\" content=\"{0}\">", HttpUtility.HtmlAttributeEncode(ApplicationServicesBase.Current.DisplayName)));
            Header.Controls.Add(appName);
            if (!(string.IsNullOrEmpty(Request.UserAgent)) && Regex.IsMatch(Request.UserAgent, "Trident/7\\."))
                Header.Controls.Add(new LiteralControl("<meta http-equiv=\"X-UA-COMPATIBLE\" content=\"IE=Edge\">"));
            if (contentInfo.TryGetValue("Head", out s) && (_headContent != null))
                _headContent.Text = s;
            if (contentInfo.TryGetValue("PageContent", out s) && (_pageContent != null))
            {
                if (_isTouchUI)
                    s = string.Format("<div id=\"PageContent\" style=\"display:none\">{0}</div>", s);
                var userControl = Regex.Match(s, "<div\\s+data-user-control\\s*=s*\"([\\s\\S]+?)\".*?>\\s*</div>");
                if (userControl.Success)
                {
                    var startPos = 0;
                    while (userControl.Success)
                    {
                        _pageContent.Controls.Add(new LiteralControl(s.Substring(startPos, (userControl.Index - startPos))));
                        startPos = (userControl.Index + userControl.Length);
                        var controlFileName = userControl.Groups[1].Value;
                        var controlExtension = Path.GetExtension(controlFileName);
                        string siteControlText = null;
                        if (!(controlFileName.StartsWith("~")))
                            controlFileName = (controlFileName + "~");
                        if (string.IsNullOrEmpty(controlExtension))
                        {
                            var testFileName = (controlFileName + ".ascx");
                            if (File.Exists(Server.MapPath(testFileName)))
                            {
                                controlFileName = testFileName;
                                controlExtension = ".ascx";
                            }
                            else
                            {
                                if (ApplicationServices.IsSiteContentEnabled)
                                {
                                    var relativeControlPath = controlFileName.Substring(1);
                                    if (relativeControlPath.StartsWith("/"))
                                        relativeControlPath = relativeControlPath.Substring(1);
                                    siteControlText = ApplicationServices.Current.ReadSiteContentString(("sys/" + relativeControlPath));
                                }
                                if (siteControlText == null)
                                {
                                    testFileName = (controlFileName + ".html");
                                    if (File.Exists(Server.MapPath(testFileName)))
                                    {
                                        controlFileName = testFileName;
                                        controlExtension = ".html";
                                    }
                                }
                            }
                        }
                        var userControlAuthorizeRoles = Regex.Match(userControl.Value, "data-authorize-roles\\s*=\\s*\"(.+?)\"");
                        var allowUserControl = !userControlAuthorizeRoles.Success;
                        if (!allowUserControl)
                        {
                            var authorizeRoles = userControlAuthorizeRoles.Groups[1].Value;
                            if (authorizeRoles == "?")
                            {
                                if (!Context.User.Identity.IsAuthenticated)
                                    allowUserControl = true;
                            }
                            else
                                allowUserControl = ApplicationServices.UserIsAuthorizedToAccessResource(controlFileName, authorizeRoles);
                        }
                        if (allowUserControl)
                            try
                            {
                                if (controlExtension == ".ascx")
                                    _pageContent.Controls.Add(LoadControl(controlFileName));
                                else
                                {
                                    var controlText = siteControlText;
                                    if (controlText == null)
                                        controlText = File.ReadAllText(Server.MapPath(controlFileName));
                                    var bodyMatch = Regex.Match(controlText, "<body[\\s\\S]*?>([\\s\\S]+?)</body>");
                                    if (bodyMatch.Success)
                                        controlText = bodyMatch.Groups[1].Value;
                                    controlText = ApplicationServices.EnrichData(Localizer.Replace("Controls", Path.GetFileName(Server.MapPath(controlFileName)), controlText));
                                    _pageContent.Controls.Add(new LiteralControl(InjectPrefetch(controlText)));
                                }
                            }
                            catch (Exception ex)
                            {
                                _pageContent.Controls.Add(new LiteralControl(string.Format("Error loading \'{0}\': {1}", controlFileName, ex.Message)));
                            }
                        userControl = userControl.NextMatch();
                    }
                    if (startPos < s.Length)
                        _pageContent.Controls.Add(new LiteralControl(s.Substring(startPos)));
                }
                else
                    _pageContent.Text = InjectPrefetch(s);
            }
            else
            {
                if (_isTouchUI)
                {
                    _pageContent.Text = "<div id=\"PageContent\" style=\"display:none\"><div data-app-role=\"page\">404 Not Foun" +
                        "d</div></div>";
                    this.Title = ApplicationServicesBase.Current.DisplayName;
                }
                else
                    _pageContent.Text = "404 Not Found";
            }
            if (_isTouchUI)
            {
                if (_pageFooterContent != null)
                    _pageFooterContent.Text = (("<footer style=\"display:none\"><small>" + Copyright)
                                + "</small></footer>");
            }
            else
            {
                if (contentInfo.TryGetValue("About", out s))
                {
                    if (_pageSideBarContent != null)
                        _pageSideBarContent.Text = string.Format("<div class=\"TaskBox About\"><div class=\"Inner\"><div class=\"Header\">About</div><div" +
                                " class=\"Value\">{0}</div></div></div>", s);
                }
            }
            string bodyAttributes = null;
            if (contentInfo.TryGetValue("BodyAttributes", out bodyAttributes))
                _bodyAttributes.Parse(bodyAttributes);
            if (!(ApplicationServices.UserIsAuthorizedToAccessResource(HttpContext.Current.Request.Path, _bodyAttributes["data-authorize-roles"])))
            {
                var requestPath = Request.Path.Substring(1);
                if (!((WorkflowRegister.IsEnabled || WorkflowRegister.Allows(requestPath))))
                    ApplicationServices.Current.RedirectToLoginPage();
            }
            _bodyAttributes.Remove("data-authorize-roles");
            var classAttr = _bodyAttributes["class"];
            if (string.IsNullOrEmpty(classAttr))
                classAttr = string.Empty;
            if (!_isTouchUI)
            {
                if (!(classAttr.Contains("Wide")))
                    classAttr = (classAttr + " Standard");
                classAttr = ((classAttr + " ")
                            + (Regex.Replace(Request.Path.ToLower(), "\\W", "_").Substring(1) + "_html"));
            }
            else
            {
                if (_summaryDisabled)
                    classAttr = (classAttr + " see-all-always");
            }
            if (!(string.IsNullOrEmpty(classAttr)))
                _bodyAttributes["class"] = classAttr.Trim();
            _bodyTag.Text = string.Format("\r\n<body{0}>\r\n", _bodyAttributes.ToString());
            base.OnInit(e);
        }

        protected string PreparePrefetch(string content)
        {
            string output = null;
            if (!(string.IsNullOrEmpty(Request.Url.Query)) || (Request.Headers["X-Cot-Manifest-Request"] == "true"))
                return output;
            var token = ApplicationServices.TryGetJsonProperty(ApplicationServices.Current.DefaultSettings, "ui.history.dataView");
            var supportGridPrefetch = ((token != null) && !(Regex.IsMatch(((string)(token)), "\\b(search|sort|group|filter)\\b")));
            var prefetches = new List<string>();
            var prefetch = false;
            var dataViews = new List<Tuple<string, AttributeDictionary>>();
            foreach (Match m in Regex.Matches(content, "<div\\s+(id=\"(?\'Id\'\\w+)\")\\s+(?\'Props\'data-controller.*?)>"))
                dataViews.Add(new Tuple<string, AttributeDictionary>(m.Groups["Id"].Value, new AttributeDictionary(m.Groups["Props"].Value)));
            if (dataViews.Count == 1)
                prefetch = true;
            else
            {
                // LEGACY MASTER DETAIL PAGE SUPPORT
                // 
                //											
                // 1. convert text of containers into single container with single dataview referring to virtual dashboard controller
                //                      
                // <div data-flow="row">
                //   <div id="view1" data-controller="Dashboards" data-view="form1" data-show-action-buttons="none"></div> 
                //
                // </div>
                //
                // 2. produce response for this controller.
                // a. standalone data views become data view fields of the virtual controller
                // b. the layout of the page is optionally converted into form1 layout of the virtual controller
                // c. render json response of virtual controller with layout in it
                //
            }
            if (prefetch)
                for (var i = 0; (i < dataViews.Count); i++)
                {
                    var dataView = dataViews[i];
                    var dataViewId = dataView.Item1;
                    var attrs = dataView.Item2;
                    foreach (var p in UnsupportedDataViewProperties)
                        if (attrs.ContainsKey(p))
                            return output;
                    var controllerName = attrs["data-controller"];
                    string viewId = null;
                    string tags = null;
                    attrs.TryGetValue("data-tags", out tags);
                    var c = Controller.CreateConfigurationInstance(GetType(), controllerName);
                    if (!(attrs.TryGetValue("data-view", out viewId)))
                        viewId = ((string)(c.Evaluate("string(/c:dataController/c:views/c:view[1]/@id)")));
                    var viewNav = c.SelectSingleNode("/c:dataController/c:views/c:view[@id=\'{0}\']", viewId);
                    if (!Context.User.Identity.IsAuthenticated && !((viewNav.GetAttribute("access", string.Empty) == "Public")))
                        return output;
                    string roles = null;
                    if (attrs.TryGetValue("data-roles", out roles) && !(new ControllerUtilities().UserIsInRole(roles.Split(','))))
                        return output;
                    tags = (tags
                                + (" " + viewNav.GetAttribute("tags", string.Empty)));
                    var isForm = (viewNav.GetAttribute("type", string.Empty) == "Form");
                    if (isForm)
                        _summaryDisabled = true;
                    if (!(Regex.IsMatch(tags, "\\bprefetch-data-none\\b")) && (supportGridPrefetch || isForm))
                    {
                        var request = new PageRequest(-1, 30, null, null)
                        {
                            Controller = controllerName,
                            View = viewId,
                            Tag = tags,
                            ContextKey = dataViewId,
                            SupportsCaching = true
                        };
                        if (attrs.ContainsKey("data-search-on-start"))
                            request.DoesNotRequireData = true;
                        var response = ControllerFactory.CreateDataController().GetPage(request.Controller, request.View, request);
                        var result = string.Format("{{ \"d\": {0} }}", ApplicationServices.CompressViewPageJsonOutput(JsonConvert.SerializeObject(response)));
                        prefetches.Add(string.Format("<script type=\"application/json\" id=\"_{0}_prefetch\">{1}</script>", dataViewId, Regex.Replace(result, "(<(/?\\s*script)(\\s|>))", "]_[$2$3]^[", RegexOptions.IgnoreCase)));
                        if (isForm)
                            foreach (var field in response.Fields)
                                if (string.IsNullOrEmpty(field.DataViewFilterFields) && (field.Type == "DataView"))
                                {
                                    var fieldAttr = new AttributeDictionary(string.Empty);
                                    fieldAttr.Add("data-controller", field.DataViewController);
                                    fieldAttr.Add("data-view", field.DataViewId);
                                    fieldAttr.Add("data-tags", field.Tag);
                                    if (field.DataViewSearchOnStart)
                                        fieldAttr.Add("data-search-on-start", "true");
                                    dataViews.Add(new Tuple<string, AttributeDictionary>(string.Format("{0}_{1}", dataViewId, field.Name), fieldAttr));
                                }
                    }
                }
            if (prefetches.Count > 0)
                output = string.Join(string.Empty, prefetches);
            return output;
        }

        protected virtual void InitializeSiteMaster()
        {
            _isTouchUI = ApplicationServices.IsTouchClient;
            var html = string.Empty;
            var siteMasterPath = "~/site.desktop.html";
            if (_isTouchUI)
                siteMasterPath = "~/site.touch.html";
            siteMasterPath = Server.MapPath(siteMasterPath);
            if (!(File.Exists(siteMasterPath)))
                siteMasterPath = Server.MapPath("~/site.html");
            if (File.Exists(siteMasterPath))
                html = File.ReadAllText(siteMasterPath);
            else
                throw new Exception("File site.html has not been found.");
            var htmlMatch = Regex.Match(html, "<html(?\'HtmlAttr\'[\\S\\s]*?)>\\s*<head(?\'HeadAttr\'[\\S\\s]*?)>\\s*(?\'Head\'[\\S\\s]*?)\\s*<" +
                    "/head>\\s*<body(?\'BodyAttr\'[\\S\\s]*?)>\\s*(?\'Body\'[\\S\\s]*?)\\s*</body>\\s*</html>\\s*");
            if (!htmlMatch.Success)
                throw new Exception("File site.html must contain \'head\' and \'body\' elements.");
            // instructions
            Controls.Add(new LiteralControl(html.Substring(0, htmlMatch.Index)));
            // html
            Controls.Add(new LiteralControl(string.Format("<html{0} xml:lang={1} lang=\"{1}\">\r\n", htmlMatch.Groups["HtmlAttr"].Value, CultureInfo.CurrentUICulture.IetfLanguageTag)));
            // head
            Controls.Add(new HtmlHead());
            if (_isTouchUI)
                Header.Controls.Add(new LiteralControl("<meta charset=\"utf-8\">\r\n"));
            else
                Header.Controls.Add(new LiteralControl("<meta http-equiv=\"Content-Type\" content=\"text/html; charset=utf-8\">\r\n"));
            var headHtml = Regex.Replace(htmlMatch.Groups["Head"].Value, "\\s*<title([\\s\\S+]*?title>)\\s*", string.Empty);
            Header.Controls.Add(new LiteralControl(headHtml));
            _headContent = new LiteralContainer();
            Header.Controls.Add(_headContent);
            // preload
            if (ApplicationServicesBase.IsTouchClient)
                Header.Controls.Add(new LiteralControl(StylesheetGenerator.ConfigureMaterialIconFont(ResolveAppUrl("<link rel=\"preload\" href=\"~/fonts/MaterialIcons-Regular.woff2\" as=\"font\" type=\"fo" +
                                    "nt/woff2\" crossorigin>"))));
            // body
            _bodyTag = new LiteralControl();
            _bodyAttributes = new AttributeDictionary(htmlMatch.Groups["BodyAttr"].Value);
            Controls.Add(_bodyTag);
            var themePath = Server.MapPath("~/App_Themes/MyCompany");
            if (Directory.Exists(themePath))
                foreach (var stylesheetFileName in Directory.GetFiles(themePath, "*.css"))
                {
                    var fileName = Path.GetFileName(stylesheetFileName);
                    if (!(fileName.Equals("_Theme_Aquarium.css")))
                    {
                        var link = new HtmlLink()
                        {
                            Href = ("~/App_Themes/MyCompany/" + fileName)
                        };
                        link.Attributes["type"] = "text/css";
                        link.Attributes["rel"] = "stylesheet";
                        Header.Controls.Add(link);
                    }
                }
            // form
            Controls.Add(new HtmlForm());
            Form.ID = "aspnetForm";
            // ScriptManager
            var sm = new ScriptManager()
            {
                ID = "sm",
                AjaxFrameworkMode = AjaxFrameworkMode.Disabled
            };
            if (AquariumExtenderBase.EnableCombinedScript)
                sm.EnableScriptLocalization = false;
            sm.ScriptMode = ScriptMode.Release;
            Form.Controls.Add(sm);
            // SiteMapDataSource
            var siteMapDataSource1 = new SiteMapDataSource()
            {
                ID = "SiteMapDataSource1",
                ShowStartingNode = false
            };
            Form.Controls.Add(siteMapDataSource1);
            // parse and initialize placeholders
            var body = htmlMatch.Groups["Body"].Value;
            var placeholderMatch = Regex.Match(body, "<div\\s+data-role\\s*=\\s*\"placeholder\"(?\'Attributes\'[\\s\\S]+?)>\\s*(?\'DefaultContent\'" +
                    "[\\s\\S]*?)\\s*</div>");
            var startPos = 0;
            while (placeholderMatch.Success)
            {
                var attributes = new AttributeDictionary(placeholderMatch.Groups["Attributes"].Value);
                // create placeholder content
                Form.Controls.Add(new LiteralControl(body.Substring(startPos, (placeholderMatch.Index - startPos))));
                var placeholder = attributes["data-placeholder"];
                var defaultContent = placeholderMatch.Groups["DefaultContent"].Value;
                if (!(CreatePlaceholder(Form.Controls, placeholder, defaultContent, attributes)))
                {
                    var placeholderControl = new LiteralContainer()
                    {
                        Text = defaultContent
                    };
                    Form.Controls.Add(placeholderControl);
                    if (placeholder == "page-header")
                        _pageHeaderContent = placeholderControl;
                    if (placeholder == "page-title")
                        _pageTitleContent = placeholderControl;
                    if (placeholder == "page-side-bar")
                        _pageSideBarContent = placeholderControl;
                    if (placeholder == "page-content")
                        _pageContent = placeholderControl;
                    if (placeholder == "page-footer")
                        _pageFooterContent = placeholderControl;
                }
                startPos = (placeholderMatch.Index + placeholderMatch.Length);
                placeholderMatch = placeholderMatch.NextMatch();
            }
            if (startPos < body.Length)
                Form.Controls.Add(new LiteralControl(body.Substring(startPos)));
            // end body
            Controls.Add(new LiteralControl("\r\n</body>\r\n"));
            // end html
            Controls.Add(new LiteralControl("\r\n</html>\r\n"));
        }

        protected virtual bool CreatePlaceholder(ControlCollection container, string placeholder, string defaultContent, AttributeDictionary attributes)
        {
            if (placeholder == "membership-bar")
            {
                var mb = new MembershipBar()
                {
                    ID = "mb"
                };
                if (attributes["data-display-remember-me"] == "false")
                    mb.DisplayRememberMe = false;
                if (attributes["data-remember-me-set"] == "true")
                    mb.RememberMeSet = true;
                if (attributes["data-display-password-recovery"] == "false")
                    mb.DisplayPasswordRecovery = false;
                if (attributes["data-display-sign-up"] == "false")
                    mb.DisplaySignUp = false;
                if (attributes["data-display-my-account"] == "false")
                    mb.DisplayMyAccount = false;
                if (attributes["data-display-help"] == "false")
                    mb.DisplayHelp = false;
                if (attributes["data-display-login"] == "false")
                    mb.DisplayLogin = false;
                if (!(string.IsNullOrEmpty(attributes["data-idle-user-timeout"])))
                    mb.IdleUserTimeout = Convert.ToInt32(attributes["data-idle-user-timeout"]);
                if (attributes["data-enable-history"] == "true")
                    mb.EnableHistory = true;
                if (attributes["data-enable-permalinks"] == "true")
                    mb.EnablePermalinks = true;
                container.Add(mb);
                return true;
            }
            if (placeholder == "menu-bar")
            {
                var menuDiv = new HtmlGenericControl()
                {
                    TagName = "div",
                    ID = "PageMenuBar"
                };
                menuDiv.Attributes["class"] = "PageMenuBar";
                container.Add(menuDiv);
                var menu = new MenuExtender()
                {
                    ID = "Menu1",
                    DataSourceID = "SiteMapDataSource1",
                    TargetControlID = menuDiv.ID,
                    HoverStyle = ((MenuHoverStyle)(TypeDescriptor.GetConverter(typeof(MenuHoverStyle)).ConvertFromString(attributes.ValueOf("data-hover-style", "Auto")))),
                    PopupPosition = ((MenuPopupPosition)(TypeDescriptor.GetConverter(typeof(MenuPopupPosition)).ConvertFromString(attributes.ValueOf("data-popup-position", "Left")))),
                    ShowSiteActions = (attributes["data-show-site-actions"] == "true"),
                    PresentationStyle = ((MenuPresentationStyle)(TypeDescriptor.GetConverter(typeof(MenuPresentationStyle)).ConvertFromString(attributes.ValueOf("data-presentation-style", "MultiLevel"))))
                };
                container.Add(menu);
                return true;
            }
            if (placeholder == "site-map-path")
            {
                var siteMapPath1 = new SiteMapPath()
                {
                    ID = "SiteMapPath1",
                    CssClass = "SiteMapPath"
                };
                siteMapPath1.PathSeparatorStyle.CssClass = "PathSeparator";
                siteMapPath1.CurrentNodeStyle.CssClass = "CurrentNode";
                siteMapPath1.NodeStyle.CssClass = "Node";
                siteMapPath1.RootNodeStyle.CssClass = "RootNode";
                container.Add(siteMapPath1);
                return true;
            }
            return false;
        }

        protected override void OnPreRender(EventArgs e)
        {
            ApplicationServices.RegisterCssLinks(this);
            if (_isTouchUI)
            {
                // hide top-level literals
                foreach (Control c in Form.Controls)
                    if (c is LiteralControl)
                        c.Visible = false;
                // look deep in children for ASP.NET controls
                HideAspNetControls(Form.Controls);
            }
            base.OnPreRender(e);
        }

        protected override void Render(HtmlTextWriter writer)
        {
            // create page content
            var sb = new StringBuilder();
            var w = new HtmlTextWriter(new StringWriter(sb));
            base.Render(w);
            w.Flush();
            w.Close();
            var content = sb.ToString();
            if (_isTouchUI)
            {
                // perform cleanup for super lightweight output
                content = Regex.Replace(content, "(<body([\\s\\S]*?)>\\s*)<form\\s+([\\s\\S]*?)</div>\\s*", "$1");
                content = Regex.Replace(content, "\\s*</form>\\s*(</body>)", "\r\n$1");
                content = Regex.Replace(content, "<script(?\'Attributes\'[\\s\\S]*?)>(?\'Script\'[\\s\\S]*?)</script>\\s*", DoValidateScript);
                content = Regex.Replace(content, "<title>\\s*([\\s\\S]+?)\\s*</title>", "<title>$1</title>");
                content = Regex.Replace(content, "<div>\\s*<input([\\s\\S]+?)VIEWSTATEGENERATOR([\\s\\S]+?)</div>", string.Empty);
                content = Regex.Replace(content, "</script>.+?(<div.+?class=\"PageMenuBar\"></div>)\\s*", "</script>");
                content = Regex.Replace(content, "\\$get\\(\".*?mb_d\"\\)", "null");
                content = Regex.Replace(content, "\\s*(<footer[\\s\\S]+?</small></footer>)\\s*", "$1");
                content = Regex.Replace(content, "\\s*type=\"text/javascript\"\\s*", " ");
            }
            content = Regex.Replace(content, "(>\\s+)//<\\!\\[CDATA\\[\\s*", "$1");
            content = Regex.Replace(content, "\\s*//\\]\\]>\\s*</script>", "\r\n</script>");
            content = Regex.Replace(content, "<div\\s+data-role\\s*=\"placeholder\"\\s+(?\'Attributes\'[\\s\\S]+?)>(?\'DefaultContent\'[\\s" +
                    "\\S]*?)</div>", DoReplacePlaceholder);
            content = ResolveAppUrl(content);
            Context.Response.ContentType = "text/html; charset=utf-8";
            ApplicationServices.CompressOutput(Context, content);
        }

        private string DoReplacePlaceholder(Match m)
        {
            var attributes = new AttributeDictionary(m.Groups["Attributes"].Value);
            var defaultContent = m.Groups["DefaultContent"].Value;
            var replacement = ReplaceStaticPlaceholder(attributes["data-placeholder"], attributes, defaultContent);
            if (replacement == null)
                return m.Value;
            else
                return replacement;
        }

        public virtual string ReplaceStaticPlaceholder(string name, AttributeDictionary attributes, string defaultContent)
        {
            return null;
        }

        private void HideAspNetControls(ControlCollection controls)
        {
            var i = 0;
            while (i < controls.Count)
            {
                var c = controls[i];
                if ((c is SiteMapPath) || ((c is Image) || (c is TreeView)))
                    controls.Remove(c);
                else
                {
                    HideAspNetControls(c.Controls);
                    i++;
                }
            }
        }

        private string DoValidateScript(Match m)
        {
            var script = m.Groups["Script"].Value;
            if (script.Contains("aspnetForm"))
                return string.Empty;
            var srcMatch = Regex.Match(m.Groups["Attributes"].Value, "src=\"(.+?)\"");
            if (srcMatch.Success)
            {
                var src = srcMatch.Groups[1].Value;
                if (src.Contains(".axd?"))
                {
                    try
                    {
                        var client = new WebClient();
                        script = client.DownloadString(string.Format("http://{0}/{1}", Request.Url.Authority, src));
                    }
                    catch (Exception)
                    {
                        return script;
                    }
                    if (script.Contains("WebForm_PostBack"))
                        return string.Empty;
                }
            }
            script = m.Value.Replace("WebForm_InitCallback();", string.Empty);
            return script;
        }
    }

    public class LiteralContainer : Panel
    {

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _text;

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

        protected override void Render(HtmlTextWriter output)
        {
            if (Controls.Count > 0)
                foreach (Control c in Controls)
                    c.RenderControl(output);
            else
                output.Write(Text);
        }
    }

    public class AttributeDictionary : SortedDictionary<string, string>
    {

        public AttributeDictionary(string attributes)
        {
            Parse(attributes);
        }

        public new string this[string name]
        {
            get
            {
                return this.ValueOf(name, null);
            }
            set
            {
                if (value == null)
                    Remove(name);
                else
                    base[name] = value;
            }
        }

        public string ValueOf(string name, string defaultValue)
        {
            string v = null;
            if (!(TryGetValue(name, out v)))
                v = defaultValue;
            return v;
        }

        public void Parse(string attributes)
        {
            var attributeMatch = Regex.Match(attributes, "\\s*(?\'Name\'[\\w\\-]+?)\\s*=\\s*\"(?\'Value\'.+?)\"");
            while (attributeMatch.Success)
            {
                this[attributeMatch.Groups["Name"].Value] = attributeMatch.Groups["Value"].Value;
                attributeMatch = attributeMatch.NextMatch();
            }
        }

        public override string ToString()
        {
            var sb = new StringBuilder();
            foreach (var name in Keys)
                sb.AppendFormat(" {0}=\"{1}\"", name, this[name]);
            return sb.ToString();
        }
    }
}
