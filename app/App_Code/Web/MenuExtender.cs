using System;
using System.Data;
using System.Collections;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Web;
using System.Web.UI;
using System.Web.UI.HtmlControls;
using System.Web.UI.WebControls;
using MyCompany.Data;
using MyCompany.Services;

namespace MyCompany.Web
{
    public enum MenuHoverStyle
    {

        Auto = 1,

        Click = 1,

        ClickAndStay = 1,
    }

    public enum MenuPresentationStyle
    {

        MultiLevel,

        TwoLevel,

        NavigationButton,
    }

    public enum MenuOrientation
    {

        Horizontal,
    }

    public enum MenuPopupPosition
    {

        Left,

        Right,
    }

    public enum MenuItemDescriptionStyle
    {

        None,

        Inline,

        ToolTip,
    }

    [TargetControlType(typeof(Panel))]
    [TargetControlType(typeof(HtmlContainerControl))]
    [DefaultProperty("TargetControlID")]
    public class MenuExtender : System.Web.UI.WebControls.HierarchicalDataBoundControl, IExtenderControl
    {

        private string _items;

        private ScriptManager _sm;

        private string _targetControlID;

        private bool _visible;

        private MenuHoverStyle _hoverStyle;

        private MenuPopupPosition _popupPosition;

        private MenuItemDescriptionStyle _itemDescriptionStyle;

        private bool _showSiteActions;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private MenuPresentationStyle _presentationStyle;

        public Regex MenuItemPropRegex = new Regex("\\s*(?\'Name\'\\w+)\\s*(=|:)\\s*(?\'Value\'.+?)\\s*(\\r?\\n|$)");

        public static Regex MenuItemRegex = new Regex("(?\'Text\'(?\'Depth\'(#|\\+|\\^)+)\\s*(?\'Title\'.+?)\\r?\\n(?\'Url\'.*?)(\\r?\\n|$)(?\'PropList\'" +
                "(\\s*\\w+\\s*(:|=)\\s*.+?(\\r?\\n|$))*))");

        public MenuExtender() :
                base()
        {
            this.Visible = true;
            ItemDescriptionStyle = MenuItemDescriptionStyle.ToolTip;
            HoverStyle = MenuHoverStyle.Auto;
        }

        [IDReferenceProperty]
        [Category("Behavior")]
        [DefaultValue("")]
        public string TargetControlID
        {
            get
            {
                return _targetControlID;
            }
            set
            {
                _targetControlID = value;
            }
        }

        [EditorBrowsable(EditorBrowsableState.Never)]
        [DesignerSerializationVisibility(DesignerSerializationVisibility.Hidden)]
        [Browsable(false)]
        public override bool Visible
        {
            get
            {
                return _visible;
            }
            set
            {
                _visible = value;
            }
        }

        public MenuHoverStyle HoverStyle
        {
            get
            {
                return _hoverStyle;
            }
            set
            {
                _hoverStyle = value;
            }
        }

        public MenuPopupPosition PopupPosition
        {
            get
            {
                return _popupPosition;
            }
            set
            {
                _popupPosition = value;
            }
        }

        public MenuItemDescriptionStyle ItemDescriptionStyle
        {
            get
            {
                return _itemDescriptionStyle;
            }
            set
            {
                _itemDescriptionStyle = value;
            }
        }

        [System.ComponentModel.Description("The \"Site Actions\" menu is automatically displayed.")]
        [System.ComponentModel.DefaultValue(false)]
        public bool ShowSiteActions
        {
            get
            {
                return _showSiteActions;
            }
            set
            {
                _showSiteActions = value;
            }
        }

        [System.ComponentModel.Description("Specifies the menu presentation style.")]
        [System.ComponentModel.DefaultValue(MenuPresentationStyle.MultiLevel)]
        public MenuPresentationStyle PresentationStyle
        {
            get
            {
                return _presentationStyle;
            }
            set
            {
                _presentationStyle = value;
            }
        }

        protected override void PerformDataBinding()
        {
            base.PerformDataBinding();
            if (!IsBoundUsingDataSourceID && (DataSource != null))
                return;
            var view = GetData(string.Empty);
            var enumerable = view.Select();
            if (ApplicationServices.IsSiteContentEnabled && !ApplicationServices.IsSafeMode)
            {
                var sitemaps = ApplicationServices.Current.ReadSiteContent("sys/sitemaps%", "%");
                if (sitemaps.Count > 0)
                {
                    var hasMain = false;
                    foreach (var f in sitemaps)
                        if (f.PhysicalName == "main")
                        {
                            hasMain = true;
                            sitemaps.Remove(f);
                            sitemaps.Insert(0, f);
                            break;
                        }
                    if (!hasMain && (enumerable != null))
                    {
                        var msb = new StringBuilder();
                        BuildMainMenu(enumerable, msb, 1);
                        var main = new SiteContentFile()
                        {
                            Text = Localizer.Replace("Pages", Path.GetFileName(Page.Request.PhysicalPath), msb.ToString())
                        };
                        sitemaps.Insert(0, main);
                    }
                    string text = null;
                    if (sitemaps.Count > 1)
                    {
                        var sm = new SiteMapBuilder();
                        foreach (var cf in sitemaps)
                        {
                            var sitemapText = cf.Text;
                            if (!(string.IsNullOrEmpty(sitemapText)))
                            {
                                var coll = MenuItemRegex.Matches(sitemapText);
                                foreach (Match m in coll)
                                    sm.Insert(m.Groups["Title"].Value, m.Groups["Depth"].Value.Length, m.Groups["Text"].Value);
                            }
                        }
                        text = sm.ToString();
                    }
                    else
                        text = sitemaps[0].Text;
                    var sb = new StringBuilder();
                    if (!(string.IsNullOrEmpty(text)))
                    {
                        var first = true;
                        var m = MenuItemRegex.Match(text);
                        while (m.Success)
                        {
                            BuildNode(ref m, sb, first);
                            if (first)
                                first = false;
                        }
                        _items = Regex.Replace(sb.ToString(), "(\\{\\}\\,?)+", string.Empty).Replace("},]", "}]");
                        return;
                    }
                }
            }
            if (enumerable != null)
            {
                var sb = new StringBuilder();
                RecursiveDataBindInternal(enumerable, sb);
                _items = sb.ToString();
            }
        }

        private void BuildMainMenu(IHierarchicalEnumerable enumerable, StringBuilder sb, int depth)
        {
            foreach (var item in enumerable)
            {
                var data = enumerable.GetHierarchyData(item);
                if (data != null)
                {
                    var props = TypeDescriptor.GetProperties(data);
                    if (props.Count > 0)
                    {
                        var title = ((string)(props["Title"].GetValue(data)));
                        var description = ((string)(props["Description"].GetValue(data)));
                        var url = ((string)(props["Url"].GetValue(data)));
                        string cssClass = null;
                        var roles = "*";
                        var roleList = ((ArrayList)(props["Roles"].GetValue(data)));
                        if (roleList.Count > 0)
                            roles = string.Join(",", ((string[])(roleList.ToArray(typeof(string)))));
                        if (item is SiteMapNode)
                        {
                            cssClass = ((SiteMapNode)(item))["cssClass"];
                            if ("true" == ((SiteMapNode)(item))["public"])
                                roles = "?";
                        }
                        sb.AppendFormat("{0} {1}", new String('+', depth), title);
                        sb.AppendLine();
                        if (!(string.IsNullOrEmpty(url)))
                            sb.AppendLine(url);
                        else
                            sb.AppendLine("about:blank");
                        if (!(string.IsNullOrEmpty(description)))
                        {
                            sb.AppendFormat("description: {0}", description);
                            sb.AppendLine();
                        }
                        if (!(string.IsNullOrEmpty(roles)))
                        {
                            sb.AppendFormat("roles: {0}", roles);
                            sb.AppendLine();
                        }
                        if (!(string.IsNullOrEmpty(cssClass)))
                        {
                            sb.AppendFormat("cssclass: {0}", cssClass);
                            sb.AppendLine();
                        }
                        sb.AppendLine();
                        if (data.HasChildren)
                        {
                            var childrenEnumerable = data.GetChildren();
                            if (childrenEnumerable != null)
                                BuildMainMenu(childrenEnumerable, sb, (depth + 1));
                        }
                    }
                }
            }
        }

        private void BuildNode(ref Match node, StringBuilder sb, bool first)
        {
            if (!first)
                sb.Append(",");
            var propList = new SortedDictionary<string, string>();
            var prop = MenuItemPropRegex.Match(node.Groups["PropList"].Value);
            while (prop.Success)
            {
                propList[prop.Groups["Name"].Value.ToLower().Replace("-", string.Empty)] = prop.Groups["Value"].Value;
                prop = prop.NextMatch();
            }
            string roles = null;
            propList.TryGetValue("roles", out roles);
            string users = null;
            propList.TryGetValue("users", out users);
            string roleExceptions = null;
            propList.TryGetValue("roleexceptions", out roleExceptions);
            string userExceptions = null;
            propList.TryGetValue("userexceptions", out userExceptions);
            string cssClass = null;
            propList.TryGetValue("cssclass", out cssClass);
            var url = node.Groups["Url"].Value.Trim();
            string target = null;
            if (url.StartsWith("_blank:"))
            {
                target = "_blank:";
                url = url.Substring(7);
            }
            url = ResolveUrl(url);
            if (!(string.IsNullOrEmpty(target)))
                url = (target + url);
            var resourceAuthorized = true;
            if (!(string.IsNullOrEmpty(roles)))
            {
                if (!(ApplicationServices.UserIsAuthorizedToAccessResource(url, roles)))
                    resourceAuthorized = false;
            }
            if (resourceAuthorized && !(string.IsNullOrEmpty(users)))
            {
                if (!((users == "?")) && (Array.IndexOf(users.ToLower().Split(new char[] {
                                            ','}, StringSplitOptions.RemoveEmptyEntries), Page.User.Identity.Name.ToLower()) == -1))
                    resourceAuthorized = false;
            }
            if (!resourceAuthorized && !(string.IsNullOrEmpty(roleExceptions)))
            {
                if (DataControllerBase.UserIsInRole(roleExceptions))
                    resourceAuthorized = true;
            }
            if (!resourceAuthorized && !(string.IsNullOrEmpty(userExceptions)))
            {
                if (!((Array.IndexOf(userExceptions.ToLower().Split(new char[] {
                                            ','}, StringSplitOptions.RemoveEmptyEntries), Page.User.Identity.Name.ToLower()) == -1)))
                    resourceAuthorized = true;
            }
            sb.Append("{");
            if (resourceAuthorized)
            {
                var title = node.Groups["Title"].Value.Trim();
                var depth = node.Groups["Depth"].Value;
                sb.AppendFormat("title:\"{0}\"", BusinessRules.JavaScriptString(title));
                if (!((url == "about:blank")))
                    sb.AppendFormat(",url:\"{0}\"", BusinessRules.JavaScriptString(url));
                if (Page.Request.RawUrl == url)
                    sb.Append(",selected:true");
                string description = null;
                propList.TryGetValue("description", out description);
                if (!(string.IsNullOrEmpty(description)))
                    sb.AppendFormat(",description:\"{0}\"", BusinessRules.JavaScriptString(description));
                if (!(string.IsNullOrEmpty(cssClass)))
                    sb.AppendFormat(",cssClass:\"{0}\"", BusinessRules.JavaScriptString(cssClass));
                node = node.NextMatch();
                if (node.Success)
                {
                    var firstChildDepth = node.Groups["Depth"].Value;
                    if (firstChildDepth.Length > depth.Length)
                    {
                        sb.Append(",children:[");
                        first = true;
                        while (node.Success)
                        {
                            BuildNode(ref node, sb, first);
                            if (first)
                                first = false;
                            if (node.Success)
                            {
                                var nextDepth = node.Groups["Depth"].Value;
                                if (firstChildDepth.Length > nextDepth.Length)
                                    break;
                            }
                        }
                        sb.Append("]");
                    }
                }
            }
            else
                node = node.NextMatch();
            sb.Append("}");
        }

        private void RecursiveDataBindInternal(IHierarchicalEnumerable enumerable, StringBuilder sb)
        {
            var first = true;
            if (this.Site != null)
                return;
            foreach (var item in enumerable)
            {
                var data = enumerable.GetHierarchyData(item);
                if (null != data)
                {
                    var props = TypeDescriptor.GetProperties(data);
                    if (props.Count > 0)
                    {
                        var title = ((string)(props["Title"].GetValue(data)));
                        var description = ((string)(props["Description"].GetValue(data)));
                        var url = ((string)(props["Url"].GetValue(data)));
                        string cssClass = null;
                        var isPublic = false;
                        if (item is SiteMapNode)
                        {
                            cssClass = ((SiteMapNode)(item))["cssClass"];
                            isPublic = ("true" == ((string)(((SiteMapNode)(item))["public"])));
                        }
                        var roles = string.Empty;
                        var roleList = ((ArrayList)(props["Roles"].GetValue(data)));
                        if (roleList.Count > 0)
                            roles = string.Join(",", ((string[])(roleList.ToArray(typeof(string)))));
                        var resourceAuthorized = ((isPublic || (roles == "*")) || ApplicationServices.UserIsAuthorizedToAccessResource(url, roles));
                        if (resourceAuthorized)
                        {
                            if (first)
                                first = false;
                            else
                                sb.Append(",");
                            sb.AppendFormat("{{title:\"{0}\",url:\"{1}\"", BusinessRules.JavaScriptString(title), BusinessRules.JavaScriptString(url));
                            if (!(string.IsNullOrEmpty(description)))
                                sb.AppendFormat(",description:\"{0}\"", BusinessRules.JavaScriptString(description));
                            if (url == Page.Request.RawUrl)
                                sb.Append(",selected:true");
                            if (!(string.IsNullOrEmpty(cssClass)))
                                sb.AppendFormat(",cssClass:\"{0}\"", cssClass);
                            if (data.HasChildren)
                            {
                                var childrenEnumerable = data.GetChildren();
                                if (null != childrenEnumerable)
                                {
                                    sb.Append(",\"children\":[");
                                    RecursiveDataBindInternal(childrenEnumerable, sb);
                                    sb.Append("]");
                                }
                            }
                            sb.Append("}");
                        }
                    }
                }
            }
        }

        protected override void OnInit(EventArgs e)
        {
            base.OnInit(e);
            _sm = ScriptManager.GetCurrent(Page);
        }

        protected override void OnLoad(EventArgs e)
        {
            base.OnLoad(e);
            AquariumExtenderBase.RegisterFrameworkSettings(Page);
            if (Page.IsPostBack)
                DataBind();
        }

        protected override void OnPreRender(EventArgs e)
        {
            base.OnPreRender(e);
            if (null == _sm)
                return;
            var script = string.Format("Web.Menu.Nodes.{0}=[{1}];", this.ClientID, _items);
            var target = Page.Form.FindControl(TargetControlID);
            if ((null != target) && target.Visible)
                ScriptManager.RegisterStartupScript(this, typeof(MenuExtender), "Nodes", script, true);
            _sm.RegisterExtenderControl<MenuExtender>(this, target);
        }

        protected override void Render(HtmlTextWriter writer)
        {
            var isTouchUI = ApplicationServices.IsTouchClient;
            if ((null == _sm) || (_sm.IsInAsyncPostBack || isTouchUI))
                return;
            _sm.RegisterScriptDescriptors(this);
        }

        IEnumerable<ScriptDescriptor> IExtenderControl.GetScriptDescriptors(Control targetControl)
        {
            var descriptor = new ScriptBehaviorDescriptor("Web.Menu", targetControl.ClientID);
            descriptor.AddProperty("id", this.ClientID);
            if (HoverStyle != MenuHoverStyle.Auto)
                descriptor.AddProperty("hoverStyle", Convert.ToInt32(HoverStyle));
            if (PopupPosition != MenuPopupPosition.Left)
                descriptor.AddProperty("popupPosition", Convert.ToInt32(PopupPosition));
            if (ItemDescriptionStyle != MenuItemDescriptionStyle.ToolTip)
                descriptor.AddProperty("itemDescriptionStyle", Convert.ToInt32(ItemDescriptionStyle));
            if (ShowSiteActions)
                descriptor.AddProperty("showSiteActions", "true");
            if (PresentationStyle != MenuPresentationStyle.MultiLevel)
                descriptor.AddProperty("presentationStyle", Convert.ToInt32(PresentationStyle));
            return new ScriptBehaviorDescriptor[] {
                    descriptor};
        }

        IEnumerable<ScriptReference> IExtenderControl.GetScriptReferences()
        {
            return AquariumExtenderBase.StandardScripts();
        }
    }

    public class SiteMapBuilder
    {

        private SiteMapBuilderNode _root = new SiteMapBuilderNode(string.Empty, 0, string.Empty);

        private SiteMapBuilderNode _last;

        public void Insert(string title, int depth, string text)
        {
            if (_last == null)
                _last = _root;
            var entry = new SiteMapBuilderNode(title, depth, text);
            _last = _last.AddNode(entry);
        }

        public override string ToString()
        {
            return _root.ToString();
        }
    }

    public class SiteMapBuilderNode
    {

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _title;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private int _depth;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _text;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private SiteMapBuilderNode _parent;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private List<SiteMapBuilderNode> _children;

        public SiteMapBuilderNode(string title, int depth, string text)
        {
            this.Title = title;
            this.Depth = depth;
            this.Text = text;
            Children = new List<SiteMapBuilderNode>();
        }

        public string Title
        {
            get
            {
                return _title;
            }
            set
            {
                _title = value;
            }
        }

        public int Depth
        {
            get
            {
                return _depth;
            }
            set
            {
                _depth = value;
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

        public SiteMapBuilderNode Parent
        {
            get
            {
                return _parent;
            }
            set
            {
                _parent = value;
            }
        }

        public List<SiteMapBuilderNode> Children
        {
            get
            {
                return _children;
            }
            set
            {
                _children = value;
            }
        }

        public SiteMapBuilderNode AddNode(SiteMapBuilderNode entry)
        {
            // go up
            if (entry.Depth <= Depth)
                return Parent.AddNode(entry);
            else
            {
                // current child
                foreach (var child in Children)
                    if (child.Title == entry.Title)
                    {
                        if (!(string.IsNullOrWhiteSpace(entry.Text.Replace(entry.Title, string.Empty).Replace("+", string.Empty))))
                            child.Text = entry.Text;
                        return child;
                    }
                Children.Add(entry);
                entry.Parent = this;
                return entry;
            }
        }

        public override string ToString()
        {
            var sb = new StringBuilder();
            if (!(string.IsNullOrEmpty(Text)))
                sb.AppendLine(Text);
            foreach (var entry in Children)
                sb.AppendLine(entry.ToString());
            return sb.ToString();
        }
    }
}
