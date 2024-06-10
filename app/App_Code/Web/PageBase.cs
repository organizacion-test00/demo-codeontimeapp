using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Web;
using System.Web.UI;
using System.Web.UI.HtmlControls;
using MyCompany.Data;
using MyCompany.Services;

namespace MyCompany.Web
{
    public partial class PageBase : PageBaseCore
    {
    }

    public class PageBaseCore : System.Web.UI.Page
    {

        public virtual string Device
        {
            get
            {
                return null;
            }
        }

        protected override void InitializeCulture()
        {
            CultureManager.Initialize();
            base.InitializeCulture();
        }

        protected override void OnInit(EventArgs e)
        {
            base.OnInit(e);
            ValidateUrlParameters();
            if (Thread.CurrentThread.CurrentUICulture.TextInfo.IsRightToLeft)
                foreach (Control c in Controls)
                    ChangeCurrentCultureTextFlowDirection(c);
            var mobileSwitch = Request.Params["_mobile"];
            if (string.IsNullOrEmpty(mobileSwitch))
                mobileSwitch = Request.Params["_touch"];
            if (mobileSwitch != null)
            {
                var cookie = new HttpCookie("appfactorytouchui", ((mobileSwitch == "true")).ToString().ToLower());
                if (string.IsNullOrEmpty(mobileSwitch))
                    cookie.Expires = DateTime.Today.AddDays(-1);
                else
                    cookie.Expires = DateTime.Now.AddDays(30);
                ApplicationServices.AppendCookie(cookie);
                Response.Redirect(Request.CurrentExecutionFilePath);
            }
            var isTouchUI = ApplicationServices.IsTouchClient;
            if (((Device == "touch") && !isTouchUI) || ((Device == "desktop") && isTouchUI))
                Response.Redirect("~/");
            ApplicationServices.VerifyUrl();
        }

        private bool ChangeCurrentCultureTextFlowDirection(Control c)
        {
            if (c is HtmlGenericControl)
            {
                var gc = ((HtmlGenericControl)(c));
                if (gc.TagName == "body")
                {
                    gc.Attributes["dir"] = "rtl";
                    gc.Attributes["class"] = "RTL";
                    return true;
                }
            }
            else
                foreach (Control child in c.Controls)
                {
                    var result = ChangeCurrentCultureTextFlowDirection(child);
                    if (result)
                        return true;
                }
            return false;
        }

        protected virtual string HideUnauthorizedDataViews(string content)
        {
            var tryRoles = true;
            while (tryRoles)
            {
                var m = Regex.Match(content, "\\s*\\bdata-roles\\s*=\\s*\"([\\S\\s]*?)\"");
                tryRoles = m.Success;
                if (tryRoles)
                {
                    var stringAfter = content.Substring((m.Index + m.Length));
                    if (DataControllerBase.UserIsInRole(m.Groups[1].Value))
                        content = (content.Substring(0, m.Index) + stringAfter);
                    else
                    {
                        var startPos = content.Substring(0, m.Index).LastIndexOf("<div");
                        var closingDiv = Regex.Match(stringAfter, "</div>");
                        content = (content.Substring(0, startPos) + stringAfter.Substring((closingDiv.Index + closingDiv.Length)));
                    }
                }
            }
            return content;
        }

        protected override void Render(HtmlTextWriter writer)
        {
            var sb = new StringBuilder();
            var tempWriter = new HtmlTextWriter(new StringWriter(sb));
            base.Render(tempWriter);
            tempWriter.Flush();
            tempWriter.Close();
            var page = MyCompany.Data.Localizer.Replace("Pages", Path.GetFileName(Request.PhysicalPath), sb.ToString());
            if (page.Contains("data-content-framework=\"bootstrap\""))
            {
                if (ApplicationServicesBase.EnableCombinedCss)
                    page = Regex.Replace(page, "_cf=\"", "_cf=bootstrap\"");
                else
                {
                    if (ApplicationServicesBase.IsTouchClient)
                        page = Regex.Replace(page, "(<link\\s+href=\"[.\\w\\/]+?touch\\-theme\\..+?\".+?/>)", (("<link href=\"" + ResolveClientUrl(("~/css/sys/bootstrap.css?" + ApplicationServices.Version)))
                                        + "\" type=\"text/css\" rel=\"stylesheet\" />$1"));
                    else
                        page = Regex.Replace(page, "\\/>\\s*<title>", (("/><link href=\"" + ResolveClientUrl(("~/css/sys/bootstrap.css?" + ApplicationServices.Version)))
                                        + "\" type=\"text/css\" rel=\"stylesheet\" /><title>"));
                }
                if (AquariumExtenderBase.EnableCombinedScript)
                    page = Regex.Replace(page, "(<script.+?/appservices/combined.+?)\"", "$1&_cf=bootstrap\"");
            }
            else
                page = Regex.Replace(page, "<script.+?bootstrap.min.js.+?</script>\\s+", string.Empty);
            writer.Write(HideUnauthorizedDataViews(page));
        }

        protected virtual void ValidateUrlParameters()
        {
            var success = true;
            var link = Page.Request["_link"];
            if (!(string.IsNullOrEmpty(link)))
                try
                {
                    link = StringEncryptor.FromString(link.Replace(" ", "+").Split(',')[0]);
                    if (!(link.Contains('?')))
                        link = ('?' + link);
                    var permalink = link.Split('?');
                    ClientScript.RegisterClientScriptBlock(GetType(), "CommandLine", string.Format("var __dacl=\'{0}?{1}\';", permalink[0], BusinessRules.JavaScriptString(permalink[1])), true);
                }
                catch (Exception)
                {
                    success = false;
                }
            if (!success)
            {
                Response.StatusCode = 403;
                Response.End();
            }
        }
    }

    public partial class ControlBase : ControlBaseCore
    {
    }

    public class ControlBaseCore : System.Web.UI.UserControl
    {

        protected override void OnInit(EventArgs e)
        {
            base.OnInit(e);
        }

        protected override void Render(HtmlTextWriter writer)
        {
            var sb = new StringBuilder();
            var tempWriter = new HtmlTextWriter(new StringWriter(sb));
            base.Render(tempWriter);
            tempWriter.Flush();
            tempWriter.Close();
            writer.Write(MyCompany.Data.Localizer.Replace("Pages", Path.GetFileName(Request.PhysicalPath), sb.ToString()));
        }

        public static System.Web.UI.Control LoadPageControl(System.Web.UI.Control placeholder, string pageName, bool developmentMode)
        {
            try
            {
                var page = placeholder.Page;
                var basePath = "~";
                if (!developmentMode)
                    basePath = "~/DesktopModules/MyCompany";
                var controlPath = string.Format("{0}/Pages/{1}.ascx", basePath, pageName);
                var c = page.LoadControl(controlPath);
                if (c != null)
                {
                    placeholder.Controls.Clear();
                    placeholder.Controls.Add(new LiteralControl("<table style=\"width:100%\" id=\"PageBody\" class=\"Hosted\"><tr><td valign=\"top\" id=\"P" +
                                "ageContent\">"));
                    placeholder.Controls.Add(c);
                    placeholder.Controls.Add(new LiteralControl("</td></tr></table>"));
                    return c;
                }
            }
            catch (Exception)
            {
            }
            return null;
        }
    }
}
