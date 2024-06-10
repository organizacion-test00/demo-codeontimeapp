using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Collections.Generic;
using System.Configuration;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using System.Web;
using System.Web.UI;
using System.Xml.XPath;
using System.Drawing.Drawing2D;
using Newtonsoft.Json.Linq;
using MyCompany.Data;
using MyCompany.Services;

namespace MyCompany.Handlers
{
    public class TemporaryFileStream : FileStream
    {

        public TemporaryFileStream() :
                base(Path.GetTempFileName(), FileMode.Create)
        {
        }

        public override void Close()
        {
            base.Close();
            File.Delete(Name);
        }
    }

    public class VirtualPostedFile : HttpPostedFileBase
    {

        private HttpPostedFile _file;

        private Stream _inputStream;

        public VirtualPostedFile()
        {
            if (!Blob.DirectAccessMode)
                _file = HttpContext.Current.Request.Files[0];
        }

        public override int ContentLength
        {
            get
            {
                if (_file != null)
                    return _file.ContentLength;
                return Blob.BinaryData.Length;
            }
        }

        public override Stream InputStream
        {
            get
            {
                if (_inputStream == null)
                {
                    if (_file != null)
                        _inputStream = _file.InputStream;
                    else
                        _inputStream = new MemoryStream(Blob.BinaryData);
                }
                return _inputStream;
            }
        }

        public override string ContentType
        {
            get
            {
                if (_file != null)
                    return _file.ContentType;
                return ((string)(HttpContext.Current.Items["BlobHandlerInfo_ContentType"]));
            }
        }

        public override string FileName
        {
            get
            {
                if (_file != null)
                    return _file.FileName;
                return ((string)(HttpContext.Current.Items["BlobHandlerInfo_FileName"]));
            }
        }

        public override void SaveAs(string filename)
        {
            if (_file != null)
                _file.SaveAs(filename);
            else
            {
                using (var input = InputStream)
                {
                    using (var output = new FileStream(filename, FileMode.OpenOrCreate))
                        input.CopyTo(output);
                }
            }
        }
    }

    public enum BlobMode
    {

        Thumbnail,

        Original,

        Upload,
    }

    public class BlobHandlerInfo
    {

        private string _key;

        private string _tableName;

        private string _fieldName;

        private string[] _keyFieldNames;

        private string _text;

        private string _contentType;

        private string _dataController;

        private string _controllerFieldName;

        public BlobHandlerInfo()
        {
        }

        public BlobHandlerInfo(string key, string tableName, string fieldName, string[] keyFieldNames, string text, string contentType) :
                this(key, tableName, fieldName, keyFieldNames, text, contentType, string.Empty, string.Empty)
        {
        }

        public BlobHandlerInfo(string key, string tableName, string fieldName, string[] keyFieldNames, string text, string contentType, string dataController, string controllerFieldName)
        {
            this.Key = key;
            this.TableName = tableName;
            this.FieldName = fieldName;
            this.KeyFieldNames = keyFieldNames;
            this.Text = text;
            this._contentType = contentType;
            this.DataController = dataController;
            this.ControllerFieldName = controllerFieldName;
        }

        public virtual string Key
        {
            get
            {
                return _key;
            }
            set
            {
                _key = value;
            }
        }

        protected string this[string name]
        {
            get
            {
                return ((string)(HttpContext.Current.Items[("BlobHandlerInfo_" + name)]));
            }
            set
            {
                HttpContext.Current.Items[("BlobHandlerInfo_" + name)] = value;
            }
        }

        public virtual string TableName
        {
            get
            {
                return _tableName;
            }
            set
            {
                _tableName = value;
            }
        }

        public virtual string FieldName
        {
            get
            {
                return _fieldName;
            }
            set
            {
                _fieldName = value;
            }
        }

        public virtual string[] KeyFieldNames
        {
            get
            {
                return _keyFieldNames;
            }
            set
            {
                _keyFieldNames = value;
            }
        }

        public virtual string Text
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

        public virtual string Error
        {
            get
            {
                return this["Error"];
            }
            set
            {
                this["Error"] = value;
            }
        }

        public virtual string FileName
        {
            get
            {
                return this["FileName"];
            }
            set
            {
                this["FileName"] = value;
            }
        }

        public virtual string ContentType
        {
            get
            {
                var s = this["ContentType"];
                if (string.IsNullOrEmpty(s))
                    s = this._contentType;
                return s;
            }
            set
            {
                this["ContentType"] = value;
            }
        }

        public virtual string DataController
        {
            get
            {
                return _dataController;
            }
            set
            {
                _dataController = value;
            }
        }

        public virtual string UploadDownloadViewName
        {
            get
            {
                return Controller.GetUpdateView(DataController);
            }
        }

        public virtual string ControllerFieldName
        {
            get
            {
                return _controllerFieldName;
            }
            set
            {
                _controllerFieldName = value;
            }
        }

        public static BlobHandlerInfo Current
        {
            get
            {
                var d = ((BlobHandlerInfo)(HttpContext.Current.Items["BlobHandlerInfo_Current"]));
                if (d == null)
                    foreach (string key in HttpContext.Current.Request.QueryString.Keys)
                        if (!(string.IsNullOrEmpty(key)) && BlobFactory.Handlers.ContainsKey(key))
                        {
                            d = BlobFactory.Handlers[key];
                            HttpContext.Current.Items["BlobHandlerInfo_Current"] = d;
                            break;
                        }
                return d;
            }
        }

        public BlobMode Mode
        {
            get
            {
                if (Value.StartsWith("u|"))
                    return BlobMode.Upload;
                if (Value.StartsWith("t|"))
                    return BlobMode.Thumbnail;
                else
                    return BlobMode.Original;
            }
        }

        public bool AllowCaching
        {
            get
            {
                return ((Mode == BlobMode.Thumbnail) || ((Mode == BlobMode.Original) && MaxWidth.HasValue));
            }
        }

        public int? MaxWidth
        {
            get
            {
                var m = Regex.Match(Value, "^(\\w{2,3})\\|");
                var size = m.Groups[1].Value;
                if (size == "tn")
                    return 280;
                if (size == "xxs")
                    return 320;
                if (size == "xs")
                    return 480;
                if (size == "sm")
                    return 576;
                if (size == "md")
                    return 768;
                if (size == "lg")
                    return 992;
                if (size == "xl")
                    return 200;
                if (size == "xxl")
                    return 1366;
                return null;
            }
        }

        public string Value
        {
            get
            {
                var v = this["Value"];
                if (string.IsNullOrEmpty(v))
                    v = HttpContext.Current.Request.QueryString[Key];
                return v;
            }
        }

        public string Reference
        {
            get
            {
                var s = Value.Replace("|", "_");
                return s.Substring(1);
            }
        }

        public virtual string ContentTypeField
        {
            get
            {
                var fieldName = this[(ControllerFieldName + "_ContentTypeField")];
                if (!(string.IsNullOrEmpty(fieldName)))
                    return fieldName;
                return (ControllerFieldName + "ContentType");
            }
            set
            {
                this[(ControllerFieldName + "_ContentTypeField")] = value;
            }
        }

        public virtual string FileNameField
        {
            get
            {
                var fieldName = this[(ControllerFieldName + "_FileNameField")];
                if (!(string.IsNullOrEmpty(fieldName)))
                    return fieldName;
                return (_controllerFieldName + "FileName");
            }
            set
            {
                this[(ControllerFieldName + "_FileNameField")] = value;
            }
        }

        public virtual string LengthField
        {
            get
            {
                var fieldName = this[(ControllerFieldName + "_LengthField")];
                if (!(string.IsNullOrEmpty(fieldName)))
                    return fieldName;
                return (_controllerFieldName + "Length");
            }
            set
            {
                this[(ControllerFieldName + "_LengthField")] = value;
            }
        }

        public virtual bool SaveFile(HttpContext context)
        {
            return this.SaveFile(context, null, null);
        }

        public virtual bool SaveFile(HttpContext context, BlobAdapter ba, string keyValue)
        {
            if (context.Request.Files.Count != 1 && !Blob.DirectAccessMode)
                return false;
            try
            {
                if ((BlobHandlerInfo.Current != null) && BlobHandlerInfo.Current.ProcessUploadViaBusinessRule(ba))
                    return true;
                if (ba == null)
                {
                    using (var updateBlob = BlobFactory.CreateBlobUpdateStatement())
                        return (updateBlob.ExecuteNonQuery() == 1);
                }
                else
                {
                    var file = new VirtualPostedFile();
                    if (file.ContentLength.Equals(0))
                        return true;
                    return ba.WriteBlob(file, keyValue);
                }
            }
            catch (Exception err)
            {
                Error = err.Message;
                return false;
            }
        }

        public List<string> CreateKeyValues()
        {
            var keyValues = new List<string>();
            keyValues.Add(Value.Split('|')[1]);
            return keyValues;
        }

        private List<FieldValue> CreateActionValues(Stream stream, string contentType, string fileName, int contentLength)
        {
            var deleting = (((contentType == "application/octet-stream") && (contentLength == 0)) && (string.IsNullOrEmpty(fileName) || (fileName == "_delete_")));
            var keyValues = CreateKeyValues();
            var keyValueIndex = 0;
            var actionValues = new List<FieldValue>();
            var config = Controller.CreateConfigurationInstance(typeof(Controller), DataController);
            var keyFieldIterator = config.Select("/c:dataController/c:fields/c:field[@isPrimaryKey=\'true\']");
            while (keyFieldIterator.MoveNext())
            {
                var v = new FieldValue(keyFieldIterator.Current.GetAttribute("name", string.Empty));
                if (keyValueIndex < keyValues.Count)
                {
                    v.OldValue = keyValues[keyValueIndex];
                    v.Modified = false;
                    keyValueIndex++;
                }
                actionValues.Add(v);
            }
            if (stream != null)
            {
                var lengthFieldNav = config.SelectSingleNode("/c:dataController/c:fields/c:field[@name=\'{0}\']", this.LengthField);
                if (lengthFieldNav == null)
                    lengthFieldNav = config.SelectSingleNode("/c:dataController/c:fields/c:field[@name=\'{0}Length\' or @name=\'{0}LENGTH\']", ControllerFieldName);
                if (lengthFieldNav == null)
                    lengthFieldNav = config.SelectSingleNode("/c:dataController/c:fields/c:field[@name=\'Length\' or @name=\'LENGTH\']", ControllerFieldName);
                if (lengthFieldNav != null)
                {
                    var fieldName = lengthFieldNav.GetAttribute("name", string.Empty);
                    if (fieldName != this.LengthField)
                        this.LengthField = fieldName;
                    actionValues.Add(new FieldValue(fieldName, contentLength));
                    if (deleting)
                        ClearLastFieldValue(actionValues);
                }
                var contentTypeFieldNav = config.SelectSingleNode("/c:dataController/c:fields/c:field[@name=\'{0}\']", this.ContentTypeField);
                if (contentTypeFieldNav == null)
                    contentTypeFieldNav = config.SelectSingleNode("/c:dataController/c:fields/c:field[@name=\'{0}ContentType\' or @name=\'{0}CONTENTTYP" +
                            "E\']", ControllerFieldName);
                if (contentTypeFieldNav == null)
                    contentTypeFieldNav = config.SelectSingleNode("/c:dataController/c:fields/c:field[@name=\'ContentType\' or @name=\'CONTENTTYPE\']", ControllerFieldName);
                if (contentTypeFieldNav != null)
                {
                    var fieldName = contentTypeFieldNav.GetAttribute("name", string.Empty);
                    if (fieldName != this.ContentTypeField)
                        this.ContentTypeField = fieldName;
                    actionValues.Add(new FieldValue(fieldName, contentType));
                    if (deleting)
                        ClearLastFieldValue(actionValues);
                }
                var fileNameFieldNav = config.SelectSingleNode("/c:dataController/c:fields/c:field[@name=\'{0}\']", this.FileNameField);
                if (fileNameFieldNav == null)
                    fileNameFieldNav = config.SelectSingleNode("/c:dataController/c:fields/c:field[@name=\'{0}FileName\' or @name=\'{0}FILENAME\']", ControllerFieldName);
                if (fileNameFieldNav == null)
                    fileNameFieldNav = config.SelectSingleNode("/c:dataController/c:fields/c:field[@name=\'FileName\' or @name=\'FILENAME\']", ControllerFieldName);
                if (fileNameFieldNav != null)
                {
                    var fieldName = fileNameFieldNav.GetAttribute("name", string.Empty);
                    if (fieldName != this.FileNameField)
                        this.FileNameField = fieldName;
                    actionValues.Add(new FieldValue(fieldName, Path.GetFileName(fileName)));
                    if (deleting)
                        ClearLastFieldValue(actionValues);
                }
                actionValues.Add(new FieldValue(ControllerFieldName, stream));
            }
            return actionValues;
        }

        private void ClearLastFieldValue(List<FieldValue> values)
        {
            var v = values[(values.Count - 1)];
            v.NewValue = null;
            v.Modified = true;
        }

        private bool ProcessUploadViaBusinessRule(BlobAdapter ba)
        {
            var file = new VirtualPostedFile();
            var actionValues = CreateActionValues(file.InputStream, file.ContentType, file.FileName, file.ContentLength);
            if ((ba != null) && !Blob.DirectAccessMode)
                foreach (var fvo in actionValues)
                    ba.ValidateFieldValue(fvo);
            // try process uploading via a business rule
            var args = new ActionArgs()
            {
                Controller = DataController,
                View = UploadDownloadViewName,
                CommandName = "UploadFile",
                CommandArgument = ControllerFieldName,
                Values = actionValues.ToArray()
            };
            var r = Blob.CreateDataController().Execute(DataController, UploadDownloadViewName, args);
            var supportsContentType = false;
            var supportsFileName = false;
            DetectSupportForSpecialFields(actionValues, out supportsContentType, out supportsFileName);
            var canceled = r.Canceled;
            if (canceled && !((supportsContentType || supportsFileName)))
                return true;
            // update Content Type and Length
            args.LastCommandName = "Edit";
            args.CommandName = "Update";
            args.CommandArgument = UploadDownloadViewName;
            actionValues.RemoveAt((actionValues.Count - 1));
            if (HttpContext.Current.Request.Url.ToString().EndsWith("&_v=2"))
                foreach (var v in actionValues)
                    if (v.Name == FileNameField)
                    {
                        actionValues.Remove(v);
                        break;
                    }
            args.Values = actionValues.ToArray();
            args.IgnoreBusinessRules = true;
            r = Blob.CreateDataController().Execute(DataController, UploadDownloadViewName, args);
            return canceled;
        }

        public virtual void LoadFile(Stream stream)
        {
            if ((BlobHandlerInfo.Current != null) && BlobHandlerInfo.Current.ProcessDownloadViaBusinessRule(stream))
                return;
            using (var getBlob = BlobFactory.CreateBlobSelectStatement())
                if (getBlob.Read())
                {
                    var v = getBlob[0];
                    if (!(DBNull.Value.Equals(v)))
                    {
                        if (typeof(string).Equals(getBlob.Reader.GetFieldType(0)))
                        {
                            var stringData = Encoding.Default.GetBytes(((string)(v)));
                            stream.Write(stringData, 0, stringData.Length);
                        }
                        else
                        {
                            var data = ((byte[])(v));
                            stream.Write(data, 0, data.Length);
                        }
                    }
                }
        }

        private void DetectSupportForSpecialFields(List<FieldValue> values, out bool supportsContentType, out bool supportsFileName)
        {
            supportsContentType = false;
            supportsFileName = false;
            foreach (var v in values)
                if (v.Name.Equals(ContentTypeField, StringComparison.OrdinalIgnoreCase))
                    supportsContentType = true;
                else
                {
                    if (v.Name.Equals(FileNameField, StringComparison.OrdinalIgnoreCase))
                        supportsFileName = true;
                }
        }

        public bool ProcessDownloadViaBusinessRule(Stream stream)
        {
            var supportsContentType = false;
            var supportsFileName = false;
            var actionValues = CreateActionValues(stream, null, null, 0);
            DetectSupportForSpecialFields(actionValues, out supportsContentType, out supportsFileName);
            // try processing download via a business rule
            var args = new ActionArgs()
            {
                Controller = DataController,
                CommandName = "DownloadFile",
                CommandArgument = ControllerFieldName,
                Values = actionValues.ToArray()
            };
            var r = Blob.CreateDataController().Execute(DataController, UploadDownloadViewName, args);
            foreach (var v in r.Values)
                if (v.Name.Equals(ContentTypeField, StringComparison.OrdinalIgnoreCase))
                    Current.ContentType = Convert.ToString(v.Value);
                else
                {
                    if (v.Name.Equals(FileNameField, StringComparison.OrdinalIgnoreCase))
                        Current.FileName = Convert.ToString(v.Value);
                }
            // see if we still need to retrieve the content type or the file name from the database
            var needsContentType = string.IsNullOrEmpty(Current.ContentType);
            var needsFileName = string.IsNullOrEmpty(Current.FileName);
            if ((needsContentType && supportsContentType) || (needsFileName && supportsFileName))
            {
                actionValues = CreateActionValues(null, null, null, 0);
                var filter = new List<string>();
                foreach (var v in actionValues)
                    filter.Add(string.Format("{0}:={1}", v.Name, v.Value));
                var request = new PageRequest()
                {
                    Controller = DataController,
                    View = UploadDownloadViewName,
                    PageSize = 1,
                    RequiresMetaData = true,
                    Filter = filter.ToArray(),
                    MetadataFilter = new string[] {
                        "fields"}
                };
                var page = Blob.CreateDataController().GetPage(request.Controller, request.View, request);
                if (page.Rows.Count == 1)
                {
                    var row = page.Rows[0];
                    if (supportsContentType)
                        Current.ContentType = Convert.ToString(page.SelectFieldValue(ContentTypeField, row));
                    if (supportsFileName)
                        Current.FileName = Convert.ToString(page.SelectFieldValue(FileNameField, row));
                }
            }
            return r.Canceled;
        }
    }

    public partial class BlobFactory
    {

        public static SortedDictionary<string, BlobHandlerInfo> Handlers = new SortedDictionary<string, BlobHandlerInfo>();

        public static void RegisterHandler(string key, string tableName, string fieldName, string[] keyFieldNames, string text, string contentType)
        {
            Handlers.Add(key, new BlobHandlerInfo(key, tableName, fieldName, keyFieldNames, text, contentType));
        }

        public static void RegisterHandler(string key, string tableName, string fieldName, string[] keyFieldNames, string text, string dataController, string controllerFieldName)
        {
            Handlers.Add(key, new BlobHandlerInfo(key, tableName, fieldName, keyFieldNames, text, string.Empty, dataController, controllerFieldName));
        }

        public static SqlStatement CreateBlobSelectStatement()
        {
            var handler = BlobHandlerInfo.Current;
            if (handler != null)
            {
                var parameterMarker = SqlStatement.GetParameterMarker(string.Empty);
                var keyValues = handler.CreateKeyValues();
                var sb = new StringBuilder();
                sb.AppendFormat("select {0} from {1} where ", handler.FieldName, handler.TableName);
                for (var i = 0; (i < handler.KeyFieldNames.Length); i++)
                {
                    if (i > 0)
                        sb.Append(" and ");
                    sb.AppendFormat("{0}={1}p{2}", handler.KeyFieldNames[i], parameterMarker, i);
                }
                var getBlob = new SqlText(sb.ToString());
                for (var j = 0; (j < handler.KeyFieldNames.Length); j++)
                    getBlob.AddParameter(string.Format("{0}p{1}", parameterMarker, j), getBlob.StringToValue(keyValues[j]));
                return getBlob;
            }
            return null;
        }

        public static SqlStatement CreateBlobUpdateStatement()
        {
            var handler = BlobHandlerInfo.Current;
            if (handler != null)
            {
                var parameterMarker = SqlStatement.GetParameterMarker(string.Empty);
                var keyValues = handler.CreateKeyValues();
                var file = new VirtualPostedFile();
                var sb = new StringBuilder();
                sb.AppendFormat("update {0} set {1} = ", handler.TableName, handler.FieldName);
                if (file.ContentLength == 0)
                    sb.Append("null");
                else
                    sb.AppendFormat("{0}blob", parameterMarker);
                sb.Append(" where ");
                for (var i = 0; (i < handler.KeyFieldNames.Length); i++)
                {
                    if (i > 0)
                        sb.Append(" and ");
                    sb.AppendFormat("{0}={1}p{2}", handler.KeyFieldNames[i], parameterMarker, i);
                }
                var updateBlob = new SqlText(sb.ToString());
                if (file.ContentLength > 0)
                {
                    var data = new byte[file.ContentLength];
                    file.InputStream.Read(data, 0, data.Length);
                    updateBlob.AddParameter((parameterMarker + "blob"), data);
                }
                for (var j = 0; (j < handler.KeyFieldNames.Length); j++)
                    updateBlob.AddParameter(string.Format("{0}p{1}", parameterMarker, j), updateBlob.StringToValue(keyValues[j]));
                return updateBlob;
            }
            return null;
        }
    }

    public class Blob : GenericHandlerBase, IHttpHandler, System.Web.SessionState.IRequiresSessionState
    {

        public const int ThumbnailCacheTimeout = 5;

        public static SortedDictionary<Guid, string> ImageFormats;

        public static SortedDictionary<int, RotateFlipType> JpegOrientationRotateFlips;

        static Blob()
        {
            ImageFormats = new SortedDictionary<Guid, string>();
            ImageFormats.Add(ImageFormat.Bmp.Guid, "image/bmp");
            ImageFormats.Add(ImageFormat.Emf.Guid, "image/emf");
            ImageFormats.Add(ImageFormat.Exif.Guid, "image/bmp");
            ImageFormats.Add(ImageFormat.Gif.Guid, "image/gif");
            ImageFormats.Add(ImageFormat.Jpeg.Guid, "image/jpeg");
            ImageFormats.Add(ImageFormat.Png.Guid, "image/png");
            ImageFormats.Add(ImageFormat.Tiff.Guid, "image/tiff");
            ImageFormats.Add(ImageFormat.Wmf.Guid, "image/Wmf");
            JpegOrientationRotateFlips = new SortedDictionary<int, RotateFlipType>();
            JpegOrientationRotateFlips.Add(1, RotateFlipType.RotateNoneFlipNone);
            JpegOrientationRotateFlips.Add(2, RotateFlipType.RotateNoneFlipX);
            JpegOrientationRotateFlips.Add(3, RotateFlipType.Rotate180FlipNone);
            JpegOrientationRotateFlips.Add(4, RotateFlipType.Rotate180FlipX);
            JpegOrientationRotateFlips.Add(5, RotateFlipType.Rotate90FlipX);
            JpegOrientationRotateFlips.Add(6, RotateFlipType.Rotate90FlipNone);
            JpegOrientationRotateFlips.Add(7, RotateFlipType.Rotate270FlipX);
            JpegOrientationRotateFlips.Add(8, RotateFlipType.Rotate270FlipNone);
        }

        bool IHttpHandler.IsReusable
        {
            get
            {
                return false;
            }
        }

        public static bool DirectAccessMode
        {
            get
            {
                return (BinaryData != null);
            }
        }

        public static byte[] BinaryData
        {
            get
            {
                var o = HttpContext.Current.Items["BlobHandlerInfo_Data"];
                if (o == null)
                    return null;
                return ((byte[])(o));
            }
            set
            {
                HttpContext.Current.Items["BlobHandlerInfo_Data"] = value;
            }
        }

        void IHttpHandler.ProcessRequest(HttpContext context)
        {
            var handler = BlobHandlerInfo.Current;
            if (handler == null)
                throw new HttpException(404, string.Empty);
            BlobAdapter ba = null;
            if (handler.DataController != null)
                ba = BlobAdapterFactory.Create(handler.DataController, handler.FieldName.Replace("\"", string.Empty));
            if (ba != null)
            {
                handler.ContentTypeField = ba.ContentTypeField;
                handler.FileNameField = ba.FileNameField;
                handler.LengthField = ba.LengthField;
            }
            var val = handler.Value.Split('|')[1];
            if (!(ApplicationServicesBase.Create().ValidateBlobAccess(context, handler, ba, val)))
            {
                context.Response.StatusCode = 403;
                return;
            }
            if (((handler.Mode == BlobMode.Original) || (context.Request.HttpMethod == "POST")) && !Blob.DirectAccessMode)
                AppendDownloadTokenCookie();
            if (handler.Mode == BlobMode.Upload)
            {
                var success = handler.SaveFile(context, ba, val);
                if (!ApplicationServices.IsTouchClient)
                    RenderUploader(context, handler, success);
                else
                {
                    if (!success)
                        throw new HttpException(500, handler.Error);
                }
            }
            else
            {
                if (Blob.DirectAccessMode)
                {
                    Stream stream = null;
                    if (ba == null)
                    {
                        stream = new MemoryStream();
                        handler.LoadFile(stream);
                    }
                    else
                        stream = ba.ReadBlob(val);
                    stream.Position = 0;
                    var data = new byte[stream.Length];
                    stream.Read(data, 0, data.Length);
                    stream.Close();
                    Blob.BinaryData = data;
                    return;
                }
                else
                {
                    if (ba == null)
                    {
                        using (var stream = new TemporaryFileStream())
                        {
                            handler.LoadFile(stream);
                            CopyToOutput(context, stream, handler);
                        }
                    }
                    else
                    {
                        Stream stream = null;
                        if (handler.Mode.Equals(BlobMode.Thumbnail))
                        {
                            var contentType = ba.ReadContentType(val);
                            if (string.IsNullOrEmpty(contentType) || !(contentType.StartsWith("image/")))
                                stream = new MemoryStream();
                        }
                        if (stream == null)
                            stream = ba.ReadBlob(val);
                        handler.ProcessDownloadViaBusinessRule(stream);
                        CopyToOutput(context, stream, handler);
                        if (stream != null)
                            stream.Close();
                    }
                }
            }
            var request = context.Request;
            var requireCaching = (request.IsSecureConnection && ((request.Browser.Browser == "IE") && (request.Browser.MajorVersion < 9)));
            if (!requireCaching && !handler.AllowCaching)
                context.Response.Cache.SetCacheability(HttpCacheability.NoCache);
        }

        public static IDataController CreateDataController()
        {
            var controller = ControllerFactory.CreateDataController();
            if (DirectAccessMode)
                ((DataControllerBase)(controller)).AllowPublicAccess = true;
            return controller;
        }

        public static byte[] Read(string key)
        {
            var keyInfo = key.Split(new char[] {
                        '='});
            return Blob.Read(keyInfo[0], keyInfo[1]);
        }

        public static byte[] Read(string blobHandler, object keyValue)
        {
            var v = keyValue.ToString();
            if (!(v.StartsWith("o|")))
                v = ("o|" + v);
            var context = HttpContext.Current;
            context.Items["BlobHandlerInfo_Current"] = BlobFactory.Handlers[blobHandler];
            context.Items["BlobHandlerInfo_Value"] = v;
            BinaryData = new byte[0];
            ((IHttpHandler)(new Blob())).ProcessRequest(context);
            var result = BinaryData;
            BinaryData = null;
            context.Items.Remove("BlobHandlerInfo_Current");
            context.Items.Remove("BlobHandlerInfo_Value");
            return result;
        }

        public static void Write(string blobHandler, object keyValue, string fileName, string contentType, byte[] data)
        {
            var context = HttpContext.Current;
            context.Items["BlobHandlerInfo_Current"] = BlobFactory.Handlers[blobHandler];
            context.Items["BlobHandlerInfo_FileName"] = fileName;
            context.Items["BlobHandlerInfo_ContentType"] = contentType;
            context.Items["BlobHandlerInfo_Value"] = ("u|" + keyValue.ToString());
            BinaryData = data;
            ((IHttpHandler)(new Blob())).ProcessRequest(context);
            BinaryData = null;
            context.Items.Remove("BlobHandlerInfo_Current");
            context.Items.Remove("BlobHandlerInfo_FileName");
            context.Items.Remove("BlobHandlerInfo_ContentType");
            context.Items.Remove("BlobHandlerInfo_Value");
        }

        public static ImageCodecInfo ImageFormatToEncoder(ImageFormat format)
        {
            foreach (var codec in ImageCodecInfo.GetImageDecoders())
                if (codec.FormatID == format.Guid)
                    return codec;
            return null;
        }

        private void CopyToOutput(HttpContext context, Stream stream, BlobHandlerInfo handler)
        {
            var offset = 0;
            stream.Position = offset;
            byte[] buffer = null;
            Image img = null;
            var streamLength = stream.Length;
            // attempt to auto-detect content type as an image
            var contentType = handler.ContentType;
            if ((string.IsNullOrEmpty(contentType) || contentType.StartsWith("image/")) && (stream.Length > 0))
                try
                {
                    img = Image.FromStream(stream);
                    if (img.RawFormat.Equals(ImageFormat.Jpeg))
                        foreach (var p in img.PropertyItems)
                            if ((p.Id == 274) && (p.Type == 3))
                            {
                                var orientation = BitConverter.ToUInt16(p.Value, 0);
                                RotateFlipType flipType;
                                JpegOrientationRotateFlips.TryGetValue(orientation, out flipType);
                                if (flipType != RotateFlipType.RotateNoneFlipNone)
                                {
                                    img.RotateFlip(flipType);
                                    img.RemovePropertyItem(p.Id);
                                    stream = new MemoryStream();
                                    var saveParams = new EncoderParameters();
                                    saveParams.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, ((uint)(93)));
                                    img.Save(stream, ImageFormatToEncoder(ImageFormat.Jpeg), saveParams);
                                    streamLength = stream.Length;
                                    contentType = "image/jpg";
                                    break;
                                }
                            }
                }
                catch (Exception)
                {
                    try
                    {
                        // Correction for Northwind database image format
                        offset = 78;
                        stream.Position = offset;
                        buffer = new byte[(streamLength - offset)];
                        stream.Read(buffer, 0, buffer.Length);
                        img = Image.FromStream(new MemoryStream(buffer, 0, buffer.Length));
                        streamLength = (streamLength - offset);
                    }
                    catch (Exception ex)
                    {
                        offset = 0;
                        context.Trace.Write(ex.ToString());
                    }
                }
            // send an original or a thumbnail to the output
            if (handler.AllowCaching)
            {
                // draw a thumbnail
                var thumbWidth = 92;
                var thumbHeight = 64;
                var crop = !(context.Request.RawUrl.Contains("_nocrop"));
                if (ApplicationServices.IsTouchClient)
                {
                    thumbWidth = 80;
                    thumbHeight = 80;
                    var settings = ((JObject)(ApplicationServices.Create().DefaultSettings["ui"]["thumbnail"]));
                    if (settings != null)
                    {
                        if (settings["width"] != null)
                            thumbWidth = ((int)(settings["width"]));
                        if (settings["height"] != null)
                            thumbHeight = ((int)(settings["height"]));
                        if (settings["crop"] != null)
                            crop = ((bool)(settings["crop"]));
                    }
                }
                if ((img != null) && (handler.Mode == BlobMode.Original))
                {
                    thumbWidth = handler.MaxWidth.Value;
                    thumbHeight = Convert.ToInt32((img.Height
                                    * (thumbWidth / Convert.ToDouble(img.Width))));
                    crop = !(context.Request.RawUrl.Contains("_nocrop"));
                }
                var thumbnail = new Bitmap(thumbWidth, thumbHeight);
                var g = Graphics.FromImage(thumbnail);
                var r = new Rectangle(0, 0, thumbWidth, thumbHeight);
                g.FillRectangle(Brushes.Transparent, r);
                if (img != null)
                {
                    if (!handler.MaxWidth.HasValue)
                    {
                        var thumbnailAspect = (Convert.ToDouble(r.Height) / Convert.ToDouble(r.Width));
                        if ((img.Width < r.Width) && (img.Height < r.Height))
                        {
                            r.Width = img.Width;
                            r.Height = img.Height;
                        }
                        else
                        {
                            if (img.Width > img.Height)
                            {
                                r.Height = Convert.ToInt32((Convert.ToDouble(r.Width) * thumbnailAspect));
                                r.Width = Convert.ToInt32((Convert.ToDouble(r.Height)
                                                * (Convert.ToDouble(img.Width) / Convert.ToDouble(img.Height))));
                            }
                            else
                            {
                                if (img.Height > img.Width)
                                {
                                    thumbnailAspect = (Convert.ToDouble(r.Width) / Convert.ToDouble(r.Height));
                                    r.Width = Convert.ToInt32((Convert.ToDouble(r.Height) * thumbnailAspect));
                                    r.Height = Convert.ToInt32((Convert.ToDouble(r.Width)
                                                    * (Convert.ToDouble(img.Height) / Convert.ToDouble(img.Width))));
                                }
                                else
                                {
                                    r.Width = Convert.ToInt32((Convert.ToDouble(img.Height) * thumbnailAspect));
                                    r.Height = r.Width;
                                }
                            }
                        }
                    }
                    var aspect = (Convert.ToDouble(thumbnail.Width) / r.Width);
                    if (r.Width <= r.Height)
                        aspect = (Convert.ToDouble(thumbnail.Height) / r.Height);
                    if (!handler.MaxWidth.HasValue)
                    {
                        if (aspect > 1)
                            aspect = 1;
                        r.Width = Convert.ToInt32((Convert.ToDouble(r.Width) * aspect));
                        r.Height = Convert.ToInt32((Convert.ToDouble(r.Height) * aspect));
                    }
                    if (crop)
                    {
                        if (r.Width > r.Height)
                            r.Inflate((r.Width - r.Height), Convert.ToInt32((Convert.ToDouble((r.Width - r.Height)) * aspect)));
                        else
                            r.Inflate(Convert.ToInt32((Convert.ToDouble((r.Height - r.Width)) * aspect)), (r.Height - r.Width));
                    }
                    r.Location = new Point(((thumbnail.Width - r.Width)
                                    / 2), ((thumbnail.Height - r.Height)
                                    / 2));
                    g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                    g.DrawImage(img, r);
                }
                else
                {
                    g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.AntiAliasGridFit;
                    var f = new Font("Arial", ((float)(7.5D)));
                    var text = handler.FileName;
                    if (string.IsNullOrEmpty(text))
                        text = handler.Text;
                    else
                    {
                        text = Path.GetExtension(text);
                        if (text.StartsWith(".") && (text.Length > 1))
                        {
                            text = text.Substring(1).ToLower();
                            f = new Font("Arial", ((float)(12)), FontStyle.Bold);
                        }
                    }
                    g.FillRectangle(Brushes.White, r);
                    g.DrawString(text, f, Brushes.Black, r);
                }
                // produce thumbnail data
                var ts = new MemoryStream();
                if (handler.MaxWidth.HasValue)
                {
                    var encoderParams = new EncoderParameters(1);
                    encoderParams.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, Convert.ToInt64(90));
                    thumbnail.Save(ts, ImageFormatToEncoder(ImageFormat.Jpeg), encoderParams);
                }
                else
                    thumbnail.Save(ts, ImageFormat.Png);
                ts.Flush();
                ts.Position = 0;
                var td = new byte[ts.Length];
                ts.Read(td, 0, td.Length);
                ts.Close();
                // Send thumbnail to the output
                context.Response.AddHeader("Content-Length", td.Length.ToString());
                context.Response.ContentType = "image/png";
                context.Response.OutputStream.Write(td, 0, td.Length);
                if ((img == null) && !handler.AllowCaching)
                    context.Response.Cache.SetCacheability(HttpCacheability.NoCache);
                else
                {
                    context.Response.Cache.SetCacheability(HttpCacheability.Public);
                    context.Response.Cache.SetExpires(DateTime.Now.AddMinutes(Blob.ThumbnailCacheTimeout));
                }
            }
            else
            {
                if ((img != null) && string.IsNullOrEmpty(contentType))
                    contentType = ImageFormats[img.RawFormat.Guid];
                if (string.IsNullOrEmpty(contentType))
                    contentType = "application/octet-stream";
                var fileName = handler.FileName;
                if (string.IsNullOrEmpty(fileName))
                    fileName = string.Format("{0}{1}.{2}", handler.Key, handler.Reference, contentType.Substring((contentType.IndexOf("/") + 1)));
                context.Response.ContentType = contentType;
                context.Response.AddHeader("Content-Disposition", ("filename=" + HttpUtility.UrlEncode(fileName)));
                context.Response.AddHeader("Content-Length", streamLength.ToString());
                if (stream.Length == 0)
                {
                    context.Response.StatusCode = 404;
                    return;
                }
                stream.Position = offset;
                buffer = new byte[(1024 * 32)];
                var bytesRead = stream.Read(buffer, 0, buffer.Length);
                while (bytesRead > 0)
                {
                    context.Response.OutputStream.Write(buffer, 0, bytesRead);
                    offset = (offset + bytesRead);
                    bytesRead = stream.Read(buffer, 0, buffer.Length);
                }
            }
        }

        private void RenderUploader(HttpContext context, BlobHandlerInfo handler, bool uploadSuccess)
        {
            var writer = new HtmlTextWriter(context.Response.Output);
            writer.WriteLine("<!DOCTYPE html PUBLIC \\\"-//W3C//DTD XHTML 1.0 Transitional//EN\\\" \\\"http://www.w3." +
                    "org/TR/xhtml1/DTD/xhtml1-transitional.dtd\\\">");
            writer.AddAttribute("xmlns", "http://www.w3.org/1999/xhtml");
            writer.RenderBeginTag(HtmlTextWriterTag.Html);
            // head
            writer.RenderBeginTag(HtmlTextWriterTag.Head);
            writer.RenderBeginTag(HtmlTextWriterTag.Title);
            writer.Write("Uploader");
            writer.RenderEndTag();
            writer.AddAttribute(HtmlTextWriterAttribute.Type, "text/javascript");
            writer.RenderBeginTag(HtmlTextWriterTag.Script);
            var script = @"

function ShowUploadControls() {
    document.getElementById('UploadControlsPanel').style.display ='block';
    document.getElementById('StartUploadPanel').style.display = 'none';
    document.getElementById('FileUpload').focus();
}
function Owner() {
    var m = window.location.href.match(/owner=(.+?)&/);
    return m ? parent.$find(m[1]) : null;
}
function StartUpload(msg) {
    if (msg && !window.confirm(msg)) return;
    if (parent && parent.window.Web) {
        var m = window.location.href.match(/&index=(\d+)$/);
        if (m) Owner()._showUploadProgress(m[1], document.forms[0]);
    }
}
function UploadSuccess(key, message) {
    if (!Owner().get_isInserting())
        if (parent && parent.window.Web) {
            parent.Web.DataView.showMessage(message);
            Owner().refresh(false,null,'FIELD_NAME');
        }
        else
            alert('Success');
}";
            writer.WriteLine(script.Replace("FIELD_NAME", string.Format("^({0}|{1}|{2})?$", handler.ContentTypeField, handler.FileNameField, handler.LengthField)));
            writer.RenderEndTag();
            writer.AddAttribute(HtmlTextWriterAttribute.Type, "text/css");
            writer.RenderBeginTag(HtmlTextWriterTag.Style);
            writer.WriteLine("body{font-family:tahoma;font-size:8.5pt;margin:4px;background-color:white;}");
            writer.WriteLine("input{font-family:tahoma;font-size:8.5pt;}");
            writer.WriteLine("input.FileUpload{padding:3px}");
            writer.RenderEndTag();
            writer.RenderEndTag();
            // body
            string message = null;
            if (uploadSuccess)
            {
                if (HttpContext.Current.Request.Files[0].ContentLength > 0)
                    message = string.Format(Localizer.Replace("BlobUploded", "<b>Confirmation:</b> {0} has been uploaded successfully. <b>It may take up to {1}" +
                                " minutes for the thumbnail to reflect the uploaded content.</b>"), handler.Text.ToLower(), Blob.ThumbnailCacheTimeout);
                else
                    message = string.Format(Localizer.Replace("BlobCleared", "<b>Confirmation:</b> {0} has been cleared."), handler.Text.ToLower());
            }
            else
            {
                if (!(string.IsNullOrEmpty(handler.Error)))
                    message = string.Format(Localizer.Replace("BlobUploadError", "<b>Error:</b> failed to upload {0}. {1}"), handler.Text.ToLower(), BusinessRules.JavaScriptString(handler.Error));
            }
            if (!(string.IsNullOrEmpty(message)))
                writer.AddAttribute("onload", string.Format("UploadSuccess(\'{0}={1}\', \'{2}\')", handler.Key, handler.Value.Replace("u|", "t|"), BusinessRules.JavaScriptString(message)));
            writer.RenderBeginTag(HtmlTextWriterTag.Body);
            // form
            writer.AddAttribute(HtmlTextWriterAttribute.Name, "form1");
            writer.AddAttribute("method", "post");
            writer.AddAttribute("action", context.Request.RawUrl);
            writer.AddAttribute(HtmlTextWriterAttribute.Id, "form1");
            writer.AddAttribute("enctype", "multipart/form-data");
            writer.RenderBeginTag(HtmlTextWriterTag.Form);
            writer.RenderBeginTag(HtmlTextWriterTag.Div);
            // begin "start upload" controls
            writer.AddAttribute(HtmlTextWriterAttribute.Id, "StartUploadPanel");
            writer.RenderBeginTag(HtmlTextWriterTag.Div);
            writer.Write(Localizer.Replace("BlobUploadLinkPart1", "Click"));
            writer.Write(" ");
            writer.AddAttribute(HtmlTextWriterAttribute.Href, "#");
            writer.AddAttribute(HtmlTextWriterAttribute.Onclick, "ShowUploadControls();return false");
            writer.RenderBeginTag(HtmlTextWriterTag.A);
            writer.Write(Localizer.Replace("BlobUploadLinkPart2", "here"));
            writer.RenderEndTag();
            writer.Write(" ");
            writer.Write(Localizer.Replace("BlobUploadLinkPart3", "to upload or clear {0} file."), handler.Text.ToLower());
            // end of "start upload" controls
            writer.RenderEndTag();
            // begin "upload controls"
            writer.AddAttribute(HtmlTextWriterAttribute.Id, "UploadControlsPanel");
            writer.AddAttribute(HtmlTextWriterAttribute.Style, "display:none");
            writer.RenderBeginTag(HtmlTextWriterTag.Div);
            // "FileUpload" input
            writer.AddAttribute(HtmlTextWriterAttribute.Type, "File");
            writer.AddAttribute(HtmlTextWriterAttribute.Name, "FileUpload");
            writer.AddAttribute(HtmlTextWriterAttribute.Id, "FileUpload");
            writer.AddAttribute(HtmlTextWriterAttribute.Class, "FileUpload");
            writer.AddAttribute(HtmlTextWriterAttribute.Onchange, "StartUpload()");
            writer.RenderBeginTag(HtmlTextWriterTag.Input);
            writer.RenderEndTag();
            // "FileClear" input
            if (!((context.Request.QueryString[handler.Key] == "u|")))
            {
                writer.AddAttribute(HtmlTextWriterAttribute.Type, "button");
                writer.AddAttribute(HtmlTextWriterAttribute.Id, "FileClear");
                writer.AddAttribute(HtmlTextWriterAttribute.Class, "FileClear");
                writer.AddAttribute(HtmlTextWriterAttribute.Onclick, string.Format("StartUpload(\'{0}\')", BusinessRules.JavaScriptString(Localizer.Replace("BlobClearConfirm", "Clear?"))));
                writer.AddAttribute(HtmlTextWriterAttribute.Value, Localizer.Replace("BlobClearText", "Clear"));
                writer.RenderBeginTag(HtmlTextWriterTag.Input);
                writer.RenderEndTag();
            }
            // end of "upload controls"
            writer.RenderEndTag();
            // close "div"
            writer.RenderEndTag();
            // close "form"
            writer.RenderEndTag();
            // close "body"
            writer.RenderEndTag();
            // close "html"
            writer.RenderEndTag();
            writer.Close();
        }

        public static Image ResizeImage(Image image, int width, int height)
        {
            try
            {
                var destRect = new Rectangle(0, 0, width, height);
                var destImage = new Bitmap(width, height);
                destImage.SetResolution(image.HorizontalResolution, image.VerticalResolution);
                using (var g = Graphics.FromImage(destImage))
                {
                    g.CompositingMode = CompositingMode.SourceCopy;
                    g.CompositingQuality = CompositingQuality.HighQuality;
                    g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    g.SmoothingMode = SmoothingMode.HighQuality;
                    g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                    using (var wrap = new ImageAttributes())
                    {
                        wrap.SetWrapMode(WrapMode.TileFlipXY);
                        g.DrawImage(image, destRect, 0, 0, image.Width, image.Height, GraphicsUnit.Pixel, wrap);
                    }
                }
                return destImage;
            }
            catch (Exception)
            {
                return image;
            }
        }
    }

    public class BlobAdapterArguments : SortedDictionary<string, string>
    {
    }

    public class BlobAdapterFactoryBase
    {

        public static Regex ArgumentParserRegex = new Regex("^\\s*(?\'ArgumentName\'[\\w\\-]+)\\s*:\\s*(?\'ArgumentValue\'[\\s\\S]+?)\\s*$", (RegexOptions.Multiline | RegexOptions.IgnoreCase));

        protected virtual BlobAdapterArguments ParseAdapterConfig(string fieldName, string config)
        {
            var capture = false;
            var args = new BlobAdapterArguments();
            var m = ArgumentParserRegex.Match(config);
            while (m.Success)
            {
                var name = m.Groups["ArgumentName"].Value.ToLower();
                var value = m.Groups["ArgumentValue"].Value;
                if (name.Equals("field"))
                    capture = (fieldName == value);
                if (capture)
                    args[name] = value;
                m = m.NextMatch();
            }
            return args;
        }

        protected virtual BlobAdapter CreateFromConfig(string controller, string fieldName, string adapterConfig)
        {
            if (!(adapterConfig.Contains(fieldName)))
                return null;
            var arguments = ParseAdapterConfig(fieldName, adapterConfig);
            if (arguments.Count.Equals(0))
                return null;
            ProcessArguments(controller, fieldName, arguments);
            try
            {
                var storageSystem = arguments["storage-system"].ToLower();
                if (storageSystem == "file")
                    return new FileSystemBlobAdapter(controller, arguments);
                if (storageSystem == "azure")
                    return new AzureBlobAdapter(controller, arguments);
                if (storageSystem == "s3")
                    return new S3BlobAdapter(controller, arguments);
            }
            catch (Exception)
            {
            }
            return null;
        }

        void ProcessArguments(string controller, string fieldName, BlobAdapterArguments args)
        {
            var config = ConfigurationManager.AppSettings[string.Format("{0}{1}BlobAdapter", controller, fieldName)];
            var storageSystem = args["storage-system"].ToLower();
            if (!(string.IsNullOrEmpty(config)))
            {
                var configArgs = config.Split(new char[] {
                            ';'}, StringSplitOptions.RemoveEmptyEntries);
                foreach (var arg in configArgs)
                {
                    var parts = arg.Split(new char[] {
                                ':',
                                '='}, 2);
                    if (parts.Length == 2)
                        args[parts[0].Trim().ToLower()] = parts[1].Trim();
                }
            }
            var replacements = new SortedDictionary<string, string>();
            foreach (var key in args.Keys)
            {
                var value = args[key];
                if (value.StartsWith("$"))
                    replacements[key] = ConfigurationManager.AppSettings[value.Substring(1)];
                else
                {
                    if (key == "storage-system")
                        storageSystem = value.ToLower();
                }
            }
            if (storageSystem != "file")
            {
                var keyName = "key";
                var settingName = "AzureBlobStorageKey";
                if (storageSystem == "s3")
                {
                    keyName = "access-key";
                    settingName = "AmazonS3StorageKey";
                }
                if (!(replacements.ContainsKey(keyName)))
                {
                    replacements[keyName] = ConfigurationManager.AppSettings["BlobStorageKey"];
                    if (string.IsNullOrEmpty(replacements[keyName]))
                        replacements[keyName] = ConfigurationManager.AppSettings[settingName];
                }
            }
            foreach (var replacement in replacements)
                if (!(string.IsNullOrEmpty(replacement.Value)))
                    args[replacement.Key] = replacement.Value;
        }

        protected static string ReadConfig(string controller)
        {
            var config = DataControllerBase.CreateConfigurationInstance(typeof(BlobAdapter), controller);
            return ((string)(config.Evaluate("string(/c:dataController/c:blobAdapterConfig)"))).Trim();
        }

        public static BlobAdapter Create(string controller, string fieldName)
        {
            var adapterConfig = ReadConfig(controller);
            if (string.IsNullOrEmpty(adapterConfig))
                return null;
            var factory = new BlobAdapterFactory();
            return factory.CreateFromConfig(controller, fieldName, adapterConfig);
        }

        public static void InitializeRow(ViewPage page, object[] row)
        {
            var adapterConfig = ReadConfig(page.Controller);
            if (string.IsNullOrEmpty(adapterConfig))
                return;
            var factory = new BlobAdapterFactory();
            var blobFieldIndex = 0;
            foreach (var field in page.Fields)
            {
                if (field.OnDemand)
                {
                    var ba = factory.CreateFromConfig(page.Controller, field.Name, adapterConfig);
                    if (ba != null)
                    {
                        object pk = null;
                        var primaryKeyFieldIndex = 0;
                        foreach (var keyField in page.Fields)
                        {
                            if (keyField.IsPrimaryKey)
                            {
                                pk = row[primaryKeyFieldIndex];
                                if ((pk != null) && (pk is byte[]))
                                    pk = new Guid(((byte[])(pk)));
                                break;
                            }
                            primaryKeyFieldIndex++;
                        }
                        var utilityFieldIndex = 0;
                        var fileName = string.Empty;
                        var contentType = string.Empty;
                        var length = -1;
                        foreach (var utilityField in page.Fields)
                        {
                            if (utilityField.Name == ba.FileNameField)
                                fileName = Convert.ToString(row[utilityFieldIndex]);
                            else
                            {
                                if (utilityField.Name == ba.ContentTypeField)
                                    contentType = Convert.ToString(row[utilityFieldIndex]);
                                else
                                {
                                    if (utilityField.Name == ba.LengthField)
                                        length = Convert.ToInt32(row[utilityFieldIndex]);
                                }
                            }
                            utilityFieldIndex++;
                        }
                        if (length != 0 && (!(string.IsNullOrEmpty(fileName)) || !(string.IsNullOrEmpty(contentType))))
                            row[blobFieldIndex] = pk.ToString();
                    }
                }
                blobFieldIndex++;
            }
        }
    }

    public partial class BlobAdapterFactory : BlobAdapterFactoryBase
    {
    }

    public class BlobAdapter
    {

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _controller;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _fieldName;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private BlobAdapterArguments _arguments;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _pathTemplate;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _contentTypeField;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _lengthField;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _fileNameField;

        protected ViewPage _page;

        protected string _keyValue;

        public BlobAdapter(string controller, BlobAdapterArguments arguments)
        {
            this.Controller = controller;
            this.Arguments = arguments;
            Initialize();
        }

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

        public string FieldName
        {
            get
            {
                return _fieldName;
            }
            set
            {
                _fieldName = value;
            }
        }

        public BlobAdapterArguments Arguments
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

        public string PathTemplate
        {
            get
            {
                return _pathTemplate;
            }
            set
            {
                _pathTemplate = value;
            }
        }

        public string ContentTypeField
        {
            get
            {
                return _contentTypeField;
            }
            set
            {
                _contentTypeField = value;
            }
        }

        public string LengthField
        {
            get
            {
                return _lengthField;
            }
            set
            {
                _lengthField = value;
            }
        }

        public string FileNameField
        {
            get
            {
                return _fileNameField;
            }
            set
            {
                _fileNameField = value;
            }
        }

        public virtual bool IsPublic
        {
            get
            {
                return false;
            }
        }

        protected virtual void Initialize()
        {
            this.FieldName = Arguments["field"];
            string s = null;
            if (Arguments.TryGetValue("path-template", out s))
                this.PathTemplate = s;
            if (Arguments.TryGetValue("content-type-field", out s))
                this.ContentTypeField = s;
            else
                this.ContentTypeField = (FieldName + "ContentType");
            if (Arguments.TryGetValue("length-field", out s))
                this.LengthField = s;
            else
                this.LengthField = (FieldName + "Length");
            if (Arguments.TryGetValue("file-name-field", out s))
                this.FileNameField = s;
            else
                this.FileNameField = (FieldName + "FileName");
        }

        public virtual Stream ReadBlob(string keyValue)
        {
            return null;
        }

        public virtual bool WriteBlob(HttpPostedFileBase file, string keyValue)
        {
            return false;
        }

        public virtual ViewPage SelectViewPageByKey(string keyValue)
        {
            var config = DataControllerBase.CreateConfigurationInstance(typeof(BlobAdapter), this.Controller);
            var keyField = ((string)(config.Evaluate("string(/c:dataController/c:fields/c:field[@isPrimaryKey=\'true\']/@name)")));
            var request = new PageRequest()
            {
                Controller = Controller,
                View = DataControllerBase.GetSelectView(Controller),
                Filter = new string[] {
                    string.Format("{0}:={1}", keyField, keyValue)},
                RequiresMetaData = true,
                PageSize = 1
            };
            var page = Blob.CreateDataController().GetPage(request.Controller, request.View, request);
            return page;
        }

        public virtual void CopyData(Stream input, Stream output)
        {
            var buffer = new byte[(16 * 1024)];
            int bytesRead;
            var readNext = true;
            while (readNext)
            {
                bytesRead = input.Read(buffer, 0, buffer.Length);
                output.Write(buffer, 0, bytesRead);
                if (bytesRead == 0)
                    readNext = false;
            }
        }

        public string KeyValueToPath(string keyValue)
        {
            var extendedPath = ExtendPathTemplate(keyValue);
            if (extendedPath.StartsWith("/"))
                extendedPath = extendedPath.Substring(1);
            return extendedPath;
        }

        public virtual string ExtendPathTemplate(string keyValue)
        {
            return ExtendPathTemplate(PathTemplate, keyValue);
        }

        public virtual string ExtendPathTemplate(string template, string keyValue)
        {
            if (string.IsNullOrEmpty(template) || !(template.Contains("{")))
                return keyValue;
            _keyValue = keyValue;
            var extendedPath = Regex.Replace(template, "\\{(\\$?\\w+)\\}", DoReplaceFieldNameInTemplate);
            if (extendedPath.StartsWith("~"))
            {
                extendedPath = extendedPath.Substring(1);
                if (extendedPath.StartsWith("\\"))
                    extendedPath = extendedPath.Substring(1);
                extendedPath = Path.Combine(HttpRuntime.AppDomainAppPath, extendedPath);
            }
            return extendedPath;
        }

        protected virtual string DoReplaceFieldNameInTemplate(Match m)
        {
            if (this._page == null)
                this._page = SelectViewPageByKey(this._keyValue);
            var fieldIndex = 0;
            var targetFieldName = m.Groups[1].Value;
            var fieldName = targetFieldName;
            var requiresProcessing = fieldName.StartsWith("$");
            if (requiresProcessing)
                fieldName = this.FileNameField;
            foreach (var df in this._page.Fields)
            {
                if (df.Name == fieldName)
                {
                    var v = Convert.ToString(this._page.Rows[0][fieldIndex]);
                    if (requiresProcessing)
                    {
                        if (targetFieldName.Equals("$Extension", StringComparison.OrdinalIgnoreCase))
                        {
                            var extension = Path.GetExtension(v);
                            if (extension.StartsWith("."))
                                extension = extension.Substring(1);
                            return extension;
                        }
                        if (targetFieldName.Equals("$FileNameWithoutExtension", StringComparison.OrdinalIgnoreCase))
                            return Path.GetFileNameWithoutExtension(v);
                    }
                    return v;
                }
                fieldIndex++;
            }
            return string.Empty;
        }

        public virtual void ValidateFieldValue(FieldValue fvo)
        {
            if ((fvo.Name == FileNameField) && fvo.Modified)
            {
                var newValue = Convert.ToString(fvo.NewValue);
                if (!(string.IsNullOrEmpty(newValue)))
                    fvo.NewValue = Regex.Replace(newValue, "[^\\w\\.]", "-");
            }
        }

        public virtual string ReadContentType(string keyValue)
        {
            return ExtendPathTemplate(string.Format("{{{0}}}", ContentTypeField), keyValue);
        }
    }
}
