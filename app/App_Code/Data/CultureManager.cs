using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Threading;
using System.Web;
using System.Web.UI;
using System.Web.UI.HtmlControls;
using MyCompany.Services;

namespace MyCompany.Data
{
    public class CultureManager
    {

        public const string AutoDetectCulture = "Detect,Detect";

        public static string[] SupportedCultures = new string[] {
                "en-US,en-US",
                "es-MX,es-MX"};

        public static void Initialize()
        {
            var ctx = HttpContext.Current;
            if ((ctx == null) || (ctx.Items["CultureManager_Initialized"] != null))
                return;
            ctx.Items["CultureManager_Initialized"] = true;
            var cultureCookie = ctx.Request.Cookies[".COTCULTURE"];
            string culture = null;
            if (cultureCookie != null)
                culture = cultureCookie.Value;
            if (string.IsNullOrEmpty(culture) || (culture == CultureManager.AutoDetectCulture))
            {
                if (ctx.Request.UserLanguages != null)
                    foreach (var l in ctx.Request.UserLanguages)
                    {
                        var languageInfo = l.Split(';');
                        foreach (var c in SupportedCultures)
                            if (c.StartsWith(languageInfo[0]))
                            {
                                culture = c;
                                break;
                            }
                        if (culture != null)
                            break;
                    }
                else
                    culture = SupportedCultures[0];
            }
            if (!(string.IsNullOrEmpty(culture)))
            {
                var cultureIndex = Array.IndexOf(SupportedCultures, culture);
                if (!((cultureIndex == -1)))
                {
                    var ci = culture.Split(',');
                    Thread.CurrentThread.CurrentCulture = CultureInfo.CreateSpecificCulture(ci[0]);
                    Thread.CurrentThread.CurrentUICulture = new CultureInfo(ci[1]);
                    if (ctx.Handler is Page)
                    {
                        var p = ((Page)(ctx.Handler));
                        p.Culture = ci[0];
                        p.UICulture = ci[1];
                        if (cultureCookie != null)
                        {
                            if (cultureCookie.Value == CultureManager.AutoDetectCulture)
                                cultureCookie.Expires = DateTime.Now.AddDays(-14);
                            else
                                cultureCookie.Expires = DateTime.Now.AddDays(14);
                            ApplicationServices.AppendCookie(cultureCookie);
                        }
                    }
                }
            }
        }

        public static string ResolveEmbeddedResourceName(string resourceName, string culture)
        {
            return ResolveEmbeddedResourceName(typeof(CultureManager).Assembly, resourceName, culture);
        }

        public static string ResolveEmbeddedResourceName(string resourceName)
        {
            return ResolveEmbeddedResourceName(typeof(CultureManager).Assembly, resourceName, Thread.CurrentThread.CurrentUICulture.Name);
        }

        public static string ResolveEmbeddedResourceName(Assembly a, string resourceName, string culture)
        {
            var extension = Path.GetExtension(resourceName);
            var fileName = Path.GetFileNameWithoutExtension(resourceName);
            var localizedResourceName = string.Format("{0}.{1}{2}", fileName, culture.Replace("-", "_"), extension);
            var mri = a.GetManifestResourceInfo(localizedResourceName);
            if (mri == null)
            {
                if (culture.Contains("-"))
                    localizedResourceName = string.Format("{0}.{1}_{2}", fileName, culture.Substring(0, culture.LastIndexOf("-")).Replace("-", "_"), extension);
                else
                    localizedResourceName = string.Format("{0}.{1}_{2}", fileName, culture, extension);
                mri = a.GetManifestResourceInfo(localizedResourceName);
            }
            if (mri == null)
                localizedResourceName = resourceName;
            return localizedResourceName;
        }
    }

    public class GenericHandlerBase
    {

        public GenericHandlerBase()
        {
            CultureManager.Initialize();
        }

        protected virtual string GenerateOutputFileName(ActionArgs args, string outputFileName)
        {
            args.CommandArgument = args.CommandName;
            args.CommandName = "FileName";
            var values = new List<FieldValue>();
            values.Add(new FieldValue("FileName", outputFileName));
            args.Values = values.ToArray();
            var result = ControllerFactory.CreateDataController().Execute(args.Controller, args.View, args);
            foreach (var v in result.Values)
                if (v.Name == "FileName")
                {
                    outputFileName = Convert.ToString(v.Value);
                    break;
                }
            return outputFileName;
        }

        protected virtual void AppendDownloadTokenCookie()
        {
            var context = HttpContext.Current;
            var downloadToken = "APPFACTORYDOWNLOADTOKEN";
            var tokenCookie = context.Request.Cookies[downloadToken];
            if (tokenCookie != null)
            {
                tokenCookie.Value = string.Format("{0},{1}", tokenCookie.Value, Guid.NewGuid());
                ApplicationServices.AppendCookie(tokenCookie);
            }
        }
    }
}
