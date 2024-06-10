using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Web;
using System.Security.Cryptography;
using System.Globalization;
using System.Data;
using System.Data.Common;
using System.Linq;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using MyCompany.Data;
using MyCompany.Handlers;

namespace MyCompany.Data
{
    public partial class FileSystemBlobAdapter : FileSystemBlobAdapterBase
    {

        public FileSystemBlobAdapter(string controller, BlobAdapterArguments arguments) :
                base(controller, arguments)
        {
        }
    }

    public class FileSystemBlobAdapterBase : BlobAdapter
    {

        public FileSystemBlobAdapterBase(string controller, BlobAdapterArguments arguments) :
                base(controller, arguments)
        {
        }

        public override Stream ReadBlob(string keyValue)
        {
            var fileName = ExtendPathTemplate(keyValue);
            return File.OpenRead(fileName);
        }

        public override bool WriteBlob(HttpPostedFileBase file, string keyValue)
        {
            var fileName = ExtendPathTemplate(keyValue);
            var directoryName = Path.GetDirectoryName(fileName);
            if (!(Directory.Exists(directoryName)))
                Directory.CreateDirectory(directoryName);
            var stream = file.InputStream;
            file.SaveAs(fileName);
            return true;
        }

        public override void ValidateFieldValue(FieldValue fv)
        {
        }
    }

    public partial class AzureBlobAdapter : AzureBlobAdapterBase
    {

        public AzureBlobAdapter(string controller, BlobAdapterArguments arguments) :
                base(controller, arguments)
        {
        }
    }

    public class AzureBlobAdapterBase : BlobAdapter
    {

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _account;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _key;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _container;

        public AzureBlobAdapterBase(string controller, BlobAdapterArguments arguments) :
                base(controller, arguments)
        {
        }

        public virtual string Account
        {
            get
            {
                return _account;
            }
            set
            {
                _account = value;
            }
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

        public virtual string Container
        {
            get
            {
                return _container;
            }
            set
            {
                _container = value;
            }
        }

        protected override void Initialize()
        {
            base.Initialize();
            if (Arguments.ContainsKey("account"))
                Account = Arguments["account"];
            if (Arguments.ContainsKey("key"))
                Key = Arguments["key"];
            if (Arguments.ContainsKey("container"))
                Container = Arguments["container"];
        }

        public override Stream ReadBlob(string keyValue)
        {
            var urlPath = string.Format("{0}/{1}", this.Container, KeyValueToPath(keyValue));
            var requestMethod = "GET";
            var storageServiceVersion = "2015-12-11";
            var blobType = "BlockBlob";
            var dateInRfc1123Format = DateTime.UtcNow.ToString("R", CultureInfo.InvariantCulture);
            var canonicalizedHeaders = string.Format("x-ms-blob-type:{0}\nx-ms-date:{1}\nx-ms-version:{2}", blobType, dateInRfc1123Format, storageServiceVersion);
            var canonicalizedResource = string.Format("/{0}/{1}", this.Account, urlPath);
            var blobLength = "";
            var stringToSign = string.Format("{0}\n\n\n{1}\n\n\n\n\n\n\n\n\n{2}\n{3}", requestMethod, blobLength, canonicalizedHeaders, canonicalizedResource);
            var authorizationHeader = CreateAuthorizationHeaderForAzure(stringToSign);
            var uri = new Uri((("https://" + this.Account)
                            + (".blob.core.windows.net/" + urlPath)));
            var request = ((HttpWebRequest)(WebRequest.Create(uri)));
            request.Method = requestMethod;
            request.Headers.Add("x-ms-blob-type", blobType);
            request.Headers.Add("x-ms-date", dateInRfc1123Format);
            request.Headers.Add("x-ms-version", storageServiceVersion);
            request.Headers.Add("Authorization", authorizationHeader);
            try
            {
                var stream = new TemporaryFileStream();
                using (var response = ((HttpWebResponse)(request.GetResponse())))
                {
                    using (var dataStream = response.GetResponseStream())
                        CopyData(dataStream, stream);
                }
                return stream;
            }
            catch (Exception e)
            {
                var message = e.Message;
                return null;
            }
        }

        public override bool WriteBlob(HttpPostedFileBase file, string keyValue)
        {
            var requestMethod = "PUT";
            var urlPath = string.Format("{0}/{1}", this.Container, KeyValueToPath(keyValue));
            var storageServiceVersion = "2015-12-11";
            var dateInRfc1123Format = DateTime.UtcNow.ToString("R", CultureInfo.InvariantCulture);
            var stream = file.InputStream;
            var utf8Encoding = new UTF8Encoding();
            var blobLength = ((int)(stream.Length));
            var blobContent = new byte[blobLength];
            stream.Read(blobContent, 0, blobLength);
            var blobType = "BlockBlob";
            var canonicalizedHeaders = string.Format("x-ms-blob-type:{0}\nx-ms-date:{1}\nx-ms-version:{2}", blobType, dateInRfc1123Format, storageServiceVersion);
            var canonicalizedResource = string.Format("/{0}/{1}", this.Account, urlPath);
            var stringToSign = string.Format("{0}\n\n\n{1}\n\n{4}\n\n\n\n\n\n\n{2}\n{3}", requestMethod, blobLength, canonicalizedHeaders, canonicalizedResource, file.ContentType);
            var authorizationHeader = CreateAuthorizationHeaderForAzure(stringToSign);
            var uri = new Uri((("https://" + this.Account)
                            + (".blob.core.windows.net/" + urlPath)));
            var request = ((HttpWebRequest)(WebRequest.Create(uri)));
            request.Method = requestMethod;
            request.Headers.Add("x-ms-blob-type", blobType);
            request.Headers.Add("x-ms-date", dateInRfc1123Format);
            request.Headers.Add("x-ms-version", storageServiceVersion);
            request.Headers.Add("Authorization", authorizationHeader);
            request.ContentLength = blobLength;
            request.ContentType = file.ContentType;
            try
            {
                var bufferSize = (1024 * 64);
                var offset = 0;
                using (var requestStream = request.GetRequestStream())
                    while (offset < blobLength)
                    {
                        var bytesToWrite = (blobLength - offset);
                        if ((offset + bufferSize) < blobLength)
                            bytesToWrite = bufferSize;
                        requestStream.Write(blobContent, offset, bytesToWrite);
                        offset = (offset + bytesToWrite);
                    }
                using (var response = ((HttpWebResponse)(request.GetResponse())))
                {
                    var ETag = response.Headers["ETag"];
                    if (((response.StatusCode == HttpStatusCode.OK) || (response.StatusCode == HttpStatusCode.Accepted)) || (response.StatusCode == HttpStatusCode.Created))
                        return true;
                }
            }
            catch (WebException webEx)
            {
                if (webEx != null)
                {
                    var resp = webEx.Response;
                    if (resp != null)
                    {
                        using (var sr = new StreamReader(resp.GetResponseStream(), true))
                            throw new Exception(sr.ReadToEnd());
                    }
                }
            }
            return false;
        }

        protected string CreateAuthorizationHeaderForAzure(string canonicalizedString)
        {
            var signature = string.Empty;
            var storageKey = Convert.FromBase64String(this.Key);
            using (var hmacSha256 = new HMACSHA256(storageKey))
            {
                var dataToHmac = System.Text.Encoding.UTF8.GetBytes(canonicalizedString);
                signature = Convert.ToBase64String(hmacSha256.ComputeHash(dataToHmac));
            }
            var authorizationHeader = string.Format(CultureInfo.InvariantCulture, "{0} {1}:{2}", "SharedKey", this.Account, signature);
            return authorizationHeader;
        }
    }
}
