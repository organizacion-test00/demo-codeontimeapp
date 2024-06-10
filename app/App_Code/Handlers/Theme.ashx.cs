using System;
using System.Web;
using MyCompany.Data;
using MyCompany.Services;

namespace MyCompany.Handlers
{
    public partial class Theme : GenericHandlerBase, IHttpHandler, System.Web.SessionState.IRequiresSessionState
    {

        bool IHttpHandler.IsReusable
        {
            get
            {
                return true;
            }
        }

        void IHttpHandler.ProcessRequest(HttpContext context)
        {
            var theme = context.Request.QueryString["theme"];
            var accent = context.Request.QueryString["accent"];
            if (string.IsNullOrEmpty(theme) || string.IsNullOrEmpty(accent))
                throw new HttpException(400, "Bad Request");
            var services = new ApplicationServices();
            var css = new StylesheetGenerator(theme, accent).ToString();
            context.Response.ContentType = "text/css";
            var cache = context.Response.Cache;
            cache.SetCacheability(HttpCacheability.Public);
            cache.SetOmitVaryStar(true);
            cache.SetExpires(System.DateTime.Now.AddDays(365));
            cache.SetValidUntilExpires(true);
            cache.SetLastModifiedFromFileDependencies();
            ApplicationServices.CompressOutput(context, css);
        }
    }
}
