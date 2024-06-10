using System;
using System.Data;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Web;
using Newtonsoft.Json;
using MyCompany.Data;
using MyCompany.Services;
using MyCompany.Web;

namespace MyCompany.Handlers
{
    public class ReportData
    {

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private byte[] _data;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _mimeType;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _fileNameExtension;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _encoding;

        public ReportData(byte[] data, string mimeType, string fileNameExtension, string encoding)
        {
            this.Data = data;
            this.MimeType = mimeType;
            this.FileNameExtension = fileNameExtension;
            this.Encoding = encoding;
        }

        public byte[] Data
        {
            get
            {
                return _data;
            }
            set
            {
                _data = value;
            }
        }

        public string MimeType
        {
            get
            {
                return _mimeType;
            }
            set
            {
                _mimeType = value;
            }
        }

        public string FileNameExtension
        {
            get
            {
                return _fileNameExtension;
            }
            set
            {
                _fileNameExtension = value;
            }
        }

        public string Encoding
        {
            get
            {
                return _encoding;
            }
            set
            {
                _encoding = value;
            }
        }
    }

    /// <summary>
    /// A collection of parameters controlling the process or report generation.
    /// </summary>
    public class ReportArgs
    {

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _controller;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _view;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _templateName;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _format;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _filterDetails;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _sortExpression;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private FieldFilter[] _filter;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _mimeType;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _fileNameExtension;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _encoding;

        public ReportArgs()
        {
            View = "grid1";
        }

        /// <summary>
        /// The name of the data controller
        /// </summary>
        public string Controller
        {
            get
            {
                return _controller;
            }
            set
            {
                _controller = value;
            }
        }

        /// <summary>
        /// The ID of the view. Optional.
        /// </summary>
        public string View
        {
            get
            {
                return _view;
            }
            set
            {
                _view = value;
            }
        }

        /// <summary>
        /// The name of a custom RDLC template. Optional.
        /// </summary>
        public string TemplateName
        {
            get
            {
                return _templateName;
            }
            set
            {
                _templateName = value;
            }
        }

        /// <summary>
        /// Report output format. Supported values are Pdf, Word, Excel, and Tiff. The default value is Pdf. Optional.
        /// </summary>
        public string Format
        {
            get
            {
                return _format;
            }
            set
            {
                _format = value;
            }
        }

        /// <summary>
        /// Specifies a user-friendly description of the filter. The description is displayed on the automatically produced reports below the report header. Optional.
        /// </summary>
        public string FilterDetails
        {
            get
            {
                return _filterDetails;
            }
            set
            {
                _filterDetails = value;
            }
        }

        /// <summary>
        /// Sort expression that must be applied to the dataset prior to the report generation. Optional.
        /// </summary>
        public string SortExpression
        {
            get
            {
                return _sortExpression;
            }
            set
            {
                _sortExpression = value;
            }
        }

        /// <summary>
        /// A filter expression that must be applied to the dataset prior to the report generation. Optional.
        /// </summary>
        public FieldFilter[] Filter
        {
            get
            {
                return _filter;
            }
            set
            {
                _filter = value;
            }
        }

        /// <summary>
        /// Specifies the MIME type of the report produced by Report.Execute() method.
        /// </summary>
        public string MimeType
        {
            get
            {
                return _mimeType;
            }
            set
            {
                _mimeType = value;
            }
        }

        /// <summary>
        /// Specifies the file name extension of the report produced by Report.Execute() method.
        /// </summary>
        public string FileNameExtension
        {
            get
            {
                return _fileNameExtension;
            }
            set
            {
                _fileNameExtension = value;
            }
        }

        /// <summary>
        /// Specifies the encoding of the report produced by Report.Execute() method.
        /// </summary>
        public string Encoding
        {
            get
            {
                return _encoding;
            }
            set
            {
                _encoding = value;
            }
        }
    }

    public class ReportBase : GenericHandlerBase, IHttpHandler, System.Web.SessionState.IRequiresSessionState
    {

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private ReportArgs _arguments;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private PageRequest _request;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private Stream _outputStream;

        private static Regex _validationKeyRegex = new Regex("/Blob.ashx\\?");

        protected ReportArgs Arguments
        {
            get
            {
                return _arguments;
            }
            set
            {
                _arguments = value;
            }
        }

        protected PageRequest Request
        {
            get
            {
                return _request;
            }
            set
            {
                _request = value;
            }
        }

        protected Stream OutputStream
        {
            get
            {
                return _outputStream;
            }
            set
            {
                _outputStream = value;
            }
        }

        bool IHttpHandler.IsReusable
        {
            get
            {
                return false;
            }
        }

        protected virtual string DefaultDeviceInfo
        {
            get
            {
                return "<DeviceInfo><EmbedFonts>True</EmbedFonts></DeviceInfo>";
            }
        }

        void IHttpHandler.ProcessRequest(HttpContext context)
        {
            var c = context.Request["c"];
            var q = context.Request["q"];
            var request = this.Request;
            if ((request == null) && (string.IsNullOrEmpty(c) || string.IsNullOrEmpty(q)))
                throw new Exception("Invalid report request.");
            // create a data table for report
            string templateName = null;
            string aa = null;
            string reportFormat = null;
            if (request == null)
            {
                request = JsonConvert.DeserializeObject<PageRequest>(q);
                templateName = context.Request.Form["a"];
                aa = context.Request["aa"];
            }
            else
            {
                templateName = this.Arguments.TemplateName;
                reportFormat = this.Arguments.Format;
                request.FilterDetails = this.Arguments.FilterDetails;
            }
            request.PageIndex = 0;
            request.PageSize = Int32.MaxValue;
            request.RequiresMetaData = true;
            // try to generate a report via a business rule
            ActionArgs args = null;
            if (!(string.IsNullOrEmpty(aa)))
            {
                args = JsonConvert.DeserializeObject<ActionArgs>(aa);
                var controller = ControllerFactory.CreateDataController();
                var result = controller.Execute(args.Controller, args.View, args);
                if (!(string.IsNullOrEmpty(result.NavigateUrl)))
                {
                    AppendDownloadTokenCookie();
                    context.Response.Redirect(result.NavigateUrl);
                }
                if (result.Canceled)
                {
                    AppendDownloadTokenCookie();
                    return;
                }
                result.RaiseExceptionIfErrors();
                // parse action data
                var actionData = new SortedDictionary<string, string>();
                ((DataControllerBase)(controller)).Config.ParseActionData(args.Path, actionData);
                var filter = new List<string>();
                foreach (var name in actionData.Keys)
                {
                    var v = actionData[name];
                    if (name.StartsWith("_"))
                    {
                        if (name == "_controller")
                            request.Controller = v;
                        if (name == "_view")
                            request.View = v;
                        if (name == "_sortExpression")
                            request.SortExpression = v;
                        if (name == "_count")
                            request.PageSize = Convert.ToInt32(v);
                        if (name == "_template")
                            templateName = v;
                    }
                    else
                    {
                        if (v == "@Arguments_SelectedValues")
                        {
                            if (args.SelectedValues.Length > 0)
                            {
                                var sb = new StringBuilder();
                                foreach (var key in args.SelectedValues)
                                {
                                    if (sb.Length > 0)
                                        sb.Append("$or$");
                                    sb.Append(key);
                                }
                                filter.Add(string.Format("{0}:$in${1}", name, sb.ToString()));
                            }
                            else
                                return;
                        }
                        else
                        {
                            if (Regex.IsMatch(v, "^(\'|\").+(\'|\")$"))
                                filter.Add(string.Format("{0}:={1}", name, v.Substring(1, (v.Length - 2))));
                            else
                            {
                                if (args.Values != null)
                                    foreach (var fvo in args.Values)
                                        if (fvo.Name == v)
                                            filter.Add(string.Format("{0}:={1}", name, fvo.Value));
                            }
                        }
                    }
                    request.Filter = filter.ToArray();
                }
            }
            // load report definition
            var reportTemplate = Controller.CreateReportInstance(null, templateName, request.Controller, request.View);
            var page = ControllerFactory.CreateDataController().GetPage(request.Controller, request.View, request);
            Export.ResolveManyToManyFields(page);
            var table = page.ToDataTable();
            // insert validation key
            reportTemplate = _validationKeyRegex.Replace(reportTemplate, string.Format("/Blob.ashx?_validationKey={0}&amp;", ApplicationServices.ValidationKey));
            // figure report output format
            if (this.Arguments == null)
            {
                var m = Regex.Match(c, "^(ReportAs|Report)(Pdf|Excel|Image|Word|)$");
                reportFormat = m.Groups[2].Value;
            }
            if (string.IsNullOrEmpty(reportFormat))
                reportFormat = "Pdf";
            // render a report
            var report = Render(request, table, reportTemplate, reportFormat);
            if (this.Arguments != null)
            {
                this.Arguments.MimeType = report.MimeType;
                this.Arguments.FileNameExtension = report.FileNameExtension;
                this.Arguments.Encoding = report.Encoding;
                this.OutputStream.Write(report.Data, 0, report.Data.Length);
            }
            else
            {
                // send report data to the client
                context.Response.Clear();
                context.Response.ContentType = report.MimeType;
                context.Response.AddHeader("Content-Length", report.Data.Length.ToString());
                AppendDownloadTokenCookie();
                var fileName = FormatFileName(context, request, report.FileNameExtension);
                if (string.IsNullOrEmpty(fileName))
                {
                    var reportTimeStamp = Regex.Replace(DateTime.Now.ToString("s"), "\\W", string.Empty);
                    fileName = string.Format("{0}_{1}_{2}.{3}", request.Controller, request.View, reportTimeStamp, report.FileNameExtension);
                    if (args != null)
                        fileName = GenerateOutputFileName(args, fileName);
                }
                context.Response.AddHeader("Content-Disposition", string.Format("attachment;filename={0}", fileName));
                context.Response.OutputStream.Write(report.Data, 0, report.Data.Length);
            }
        }

        protected virtual ReportData Render(PageRequest request, DataTable table, string reportTemplate, string reportFormat)
        {
            return null;
        }

        protected virtual string FormatFileName(HttpContext context, PageRequest request, string extension)
        {
            return null;
        }

        /// <summary>
        /// Generates a report using the default or custom report template with optional sort expression and filter applied to the dataset.
        /// </summary>
        /// <param name="args">A collection of parameters that control the report generation.</param>
        /// <returns>A binary array representing the report data.</returns>
        public static byte[] Execute(ReportArgs args)
        {
            var output = new MemoryStream();
            var reportHandler = ((ReportBase)(ApplicationServices.CreateInstance("MyCompany.Handlers.Report")));
            reportHandler.OutputStream = output;
            reportHandler.Arguments = args;
            var request = new PageRequest()
            {
                Controller = args.Controller,
                View = args.View,
                SortExpression = args.SortExpression
            };
            reportHandler.Request = request;
            if (args.Filter != null)
            {
                var dve = new DataViewExtender();
                dve.AssignStartupFilter(args.Filter);
                request.Filter = ((List<string>)(dve.Properties["StartupFilter"])).ToArray();
            }
            ((IHttpHandler)(reportHandler)).ProcessRequest(HttpContext.Current);
            // return report data
            output.Position = 0;
            var data = new byte[output.Length];
            output.Read(data, 0, data.Length);
            return data;
        }
    }
}
