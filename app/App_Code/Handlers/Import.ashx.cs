using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Collections.Generic;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using System.Web;
using System.Web.UI;
using MyCompany.Data;

namespace MyCompany.Handlers
{
    public class Import : GenericHandlerBase, IHttpHandler, System.Web.SessionState.IRequiresSessionState
    {

        bool IHttpHandler.IsReusable
        {
            get
            {
                return false;
            }
        }

        void IHttpHandler.ProcessRequest(HttpContext context)
        {
            var parentId = context.Request.Params["parentId"];
            var controller = context.Request.Params["controller"];
            var view = context.Request.Params["view"];
            if (string.IsNullOrEmpty(parentId) || (string.IsNullOrEmpty(controller) || string.IsNullOrEmpty(view)))
                throw new HttpException(404, string.Empty);
            string methodName = null;
            string data = null;
            var errors = new StringBuilder();
            if (context.Request.HttpMethod == "GET")
                methodName = "_initImportUpload";
            else
            {
                if ((context.Request.HttpMethod == "POST") && (context.Request.Files.Count > 0))
                {
                    methodName = "_finishImportUpload";
                    string tempFileName = null;
                    try
                    {
                        // save file to the temporary folder
                        var fileName = context.Request.Files[0].FileName;
                        var extension = Path.GetExtension(fileName).ToLower();
                        tempFileName = Path.Combine(ImportProcessor.SharedTempPath, (Guid.NewGuid().ToString() + extension));
                        context.Request.Files[0].SaveAs(tempFileName);
                        // return response to the client
                        var ip = ImportProcessorFactory.Create(tempFileName);
                        var numberOfRecords = ip.CountRecords(tempFileName);
                        var availableImportFields = ip.CreateListOfAvailableFields(controller, view);
                        var fieldMap = ip.CreateInitialFieldMap(tempFileName, controller, view);
                        data = string.Format(@"<form>
<input id=""NumberOfRecords"" type=""hidden"" value=""{0}""/>
<input id=""AvailableImportFields"" type=""hidden"" value=""{1}""/>
<input id=""FieldMap"" type=""hidden"" value=""{2}""/><input id=""FileName"" type=""hidden"" value=""{3}""/>
</form>", numberOfRecords, HttpUtility.HtmlAttributeEncode(availableImportFields), HttpUtility.HtmlAttributeEncode(fieldMap), Path.GetFileName(tempFileName));
                    }
                    catch (Exception error)
                    {
                        while (error != null)
                        {
                            errors.AppendLine(error.Message);
                            error = error.InnerException;
                        }
                        data = string.Format("<form><input type=\"hidden\" id=\"Errors\" value=\"{0}\"/>", HttpUtility.HtmlAttributeEncode(errors.ToString()));
                        try
                        {
                            if (File.Exists(tempFileName))
                                File.Delete(tempFileName);
                        }
                        finally
                        {
                            // release resources here
                        }
                    }
                }
                else
                    throw new HttpException(404, string.Empty);
            }
            // format response and send it to the client
            var responseTemplate = @"<!DOCTYPE html PUBLIC ""-//W3C//DTD XHTML 1.0 Transitional//EN"" ""http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"">
<html xmlns=""http://www.w3.org/1999/xhtml""><head></head><body onload=""if (parent && parent.window.$find)parent.window.$find('{0}').{1}(document)"">{2}</body></html>";
            context.Response.ContentType = "text/html";
            context.Response.Write(string.Format(responseTemplate, parentId, methodName, data));
        }
    }
}
