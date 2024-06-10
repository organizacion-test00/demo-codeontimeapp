using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Web;
using System.Xml;
using System.Xml.XPath;
using System.Web.Security;
using Newtonsoft.Json;
using MyCompany.Data;
using MyCompany.Services;

namespace MyCompany.Handlers
{
    public partial class Export : ExportBase
    {
    }

    public class ExportBase : GenericHandlerBase, IHttpHandler, System.Web.SessionState.IRequiresSessionState
    {

        bool IHttpHandler.IsReusable
        {
            get
            {
                return true;
            }
        }

        public virtual int PageSize
        {
            get
            {
                return 1000;
            }
        }

        void IHttpHandler.ProcessRequest(HttpContext context)
        {
            var q = context.Request.Params["q"];
            if (!(string.IsNullOrEmpty(q)))
            {
                if (q.Contains("{"))
                {
                    q = Convert.ToBase64String(Encoding.Default.GetBytes(q));
                    context.Response.Redirect(((context.Request.AppRelativeCurrentExecutionFilePath + "?q=")
                                    + ((HttpUtility.UrlEncode(q) + "&t=")
                                    + context.Request.Params["t"])));
                }
                q = Encoding.Default.GetString(Convert.FromBase64String(q));
                var args = JsonConvert.DeserializeObject<ActionArgs>(q);
                var viewId = args.CommandArgument;
                if (string.IsNullOrEmpty(viewId))
                    viewId = args.View;
                var commandName = args.CommandName;
                var attchmentFileName = string.Format(string.Format("attachment; filename={0}", GenerateOutputFileName(args, string.Format("{0}_{1}", args.Controller, viewId))));
                // create an Excel Web Query
                if ((commandName == "ExportRowset") && !(context.Request.Url.AbsoluteUri.Contains("&d")))
                {
                    var webQueryUrl = context.Request.Url.AbsoluteUri;
                    var accessToken = string.Empty;
                    var user = Membership.GetUser();
                    if (user != null)
                        accessToken = ApplicationServicesBase.Create().CreateTicket(user, null, "export.rowset.accessTokenDuration", string.Empty).AccessToken;
                    var indexOfToken = webQueryUrl.IndexOf("&t=");
                    if (indexOfToken == -1)
                    {
                        webQueryUrl = (webQueryUrl + "&t=");
                        indexOfToken = webQueryUrl.Length;
                    }
                    else
                        indexOfToken = (indexOfToken + 3);
                    webQueryUrl = (webQueryUrl.Substring(0, indexOfToken) + accessToken);
                    webQueryUrl = ToClientUrl((webQueryUrl + "&d=true"));
                    context.Response.Write(("Web\r\n1\r\n" + webQueryUrl));
                    context.Response.ContentType = "text/x-ms-iqy";
                    context.Response.AddHeader("Content-Disposition", (attchmentFileName + ".iqy"));
                    return;
                }
                // execute data export
                var requestPageSize = PageSize;
                var requiresRowCount = true;
                var methodNameSuffix = "Csv";
                if (commandName == "ExportCsv")
                {
                    context.Response.ContentType = "text/csv";
                    context.Response.AddHeader("Content-Disposition", (attchmentFileName + ".csv"));
                    context.Response.Charset = "utf-8";
                }
                else
                {
                    if (commandName == "ExportRowset")
                    {
                        context.Response.ContentType = "text/xml";
                        methodNameSuffix = "Rowset";
                    }
                    else
                    {
                        context.Response.ContentType = "application/rss+xml";
                        methodNameSuffix = "Rss";
                        requestPageSize = DataControllerBase.MaximumRssItems;
                        requiresRowCount = false;
                    }
                }
                var r = new PageRequest()
                {
                    Controller = args.Controller,
                    View = viewId,
                    Filter = args.Filter,
                    ExternalFilter = args.ExternalFilter,
                    PageSize = requestPageSize,
                    RequiresMetaData = true,
                    MetadataFilter = new string[] {
                        "fields",
                        "items"}
                };
                var pageIndex = 0;
                var totalRowCount = -1;
                using (var writer = new StreamWriter(context.Response.OutputStream, Encoding.UTF8, (1024 * 10), true))
                    while ((totalRowCount == -1) || (totalRowCount > 0))
                    {
                        r.PageIndex = pageIndex;
                        r.RequiresRowCount = (requiresRowCount && (pageIndex == 0));
                        var controller = ControllerFactory.CreateDataController();
                        var p = controller.GetPage(r.Controller, r.View, r);
                        foreach (var field in p.Fields)
                            field.NormalizeDataFormatString();
                        var scope = "current";
                        if (pageIndex == 0)
                        {
                            totalRowCount = p.TotalRowCount;
                            if (totalRowCount > requestPageSize)
                                scope = "start";
                            else
                                scope = "all";
                        }
                        totalRowCount = (totalRowCount - p.Rows.Count);
                        if ((totalRowCount <= 0) && (pageIndex > 0))
                            scope = "end";
                        pageIndex++;
                        ResolveManyToManyFields(p);
                        // send data to the output
                        controller.GetType().GetMethod(("ExportDataAs" + methodNameSuffix)).Invoke(controller, new object[] {
                                    p,
                                    new DataTableReader(p.ToDataTable()),
                                    writer,
                                    scope});
                    }
            }
        }

        protected virtual string ToClientUrl(string url)
        {
            return url;
        }

        public static void ResolveManyToManyFields(ViewPage page)
        {
            var manyToManyFields = new List<int>();
            foreach (var df in page.Fields)
                if ((df.ItemsStyle == "CheckBoxList") || !(string.IsNullOrEmpty(df.ItemsTargetController)))
                {
                    var fieldIndex = page.IndexOfField(df.Name);
                    manyToManyFields.Add(fieldIndex);
                }
            if (manyToManyFields.Count > 0)
                foreach (var row in page.Rows)
                    foreach (var fieldIndex in manyToManyFields)
                    {
                        var v = ((string)(row[fieldIndex]));
                        var newValue = new List<string>();
                        if (!(string.IsNullOrEmpty(v)))
                        {
                            var lov = Regex.Split(v, ",");
                            foreach (var item in page.Fields[fieldIndex].Items)
                                if (lov.Contains(Convert.ToString(item[0])))
                                    newValue.Add(Convert.ToString(item[1]));
                        }
                        row[fieldIndex] = string.Join(", ", newValue);
                    }
        }
    }
}
