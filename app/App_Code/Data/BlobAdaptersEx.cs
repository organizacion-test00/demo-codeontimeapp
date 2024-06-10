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
    public partial class S3BlobAdapter : S3BlobAdapterBase
    {

        public S3BlobAdapter(string controller, BlobAdapterArguments arguments) :
                base(controller, arguments)
        {
        }
    }

    public class S3BlobAdapterBase : BlobAdapter
    {

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _accessKeyID;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _secretAccessKey;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _bucket;

        public S3BlobAdapterBase(string controller, BlobAdapterArguments arguments) :
                base(controller, arguments)
        {
        }

        public virtual string AccessKeyID
        {
            get
            {
                return _accessKeyID;
            }
            set
            {
                _accessKeyID = value;
            }
        }

        public virtual string SecretAccessKey
        {
            get
            {
                return _secretAccessKey;
            }
            set
            {
                _secretAccessKey = value;
            }
        }

        public virtual string Bucket
        {
            get
            {
                return _bucket;
            }
            set
            {
                _bucket = value;
            }
        }

        protected override void Initialize()
        {
            base.Initialize();
            if (Arguments.ContainsKey("access-key-id"))
                AccessKeyID = Arguments["access-key-id"];
            if (Arguments.ContainsKey("secret-access-key"))
                SecretAccessKey = Arguments["secret-access-key"];
            if (Arguments.ContainsKey("bucket"))
                Bucket = Arguments["bucket"];
        }

        public override Stream ReadBlob(string keyValue)
        {
            var extendedPath = KeyValueToPath(keyValue);
            var httpVerb = "GET";
            var d = DateTime.UtcNow;
            var canonicalizedAmzHeaders = ("x-amz-date:" + d.ToString("R", CultureInfo.InvariantCulture));
            var canonicalizedResource = string.Format("/{0}/{1}", this.Bucket, extendedPath);
            var stringToSign = string.Format("{0}\n\n\n\n{1}\n{2}", httpVerb, canonicalizedAmzHeaders, canonicalizedResource);
            var authorization = CreateAuthorizationHeaderForS3(stringToSign);
            var uri = new Uri((("http://" + this.Bucket)
                            + (".s3.amazonaws.com/" + extendedPath)));
            var request = ((HttpWebRequest)(WebRequest.Create(uri)));
            request.Method = httpVerb;
            request.Headers.Add("x-amz-date", d.ToString("R", CultureInfo.InvariantCulture));
            request.Headers.Add("Authorization", authorization);
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
            var extendedPath = KeyValueToPath(keyValue);
            var stream = file.InputStream;
            var blobLength = ((int)(stream.Length));
            var blobContent = new byte[blobLength];
            stream.Read(blobContent, 0, blobLength);
            var httpVerb = "PUT";
            var d = DateTime.UtcNow;
            var canonicalizedAmzHeaders = ("x-amz-date:" + d.ToString("R", CultureInfo.InvariantCulture));
            var canonicalizedResource = string.Format("/{0}/{1}", this.Bucket, extendedPath);
            var stringToSign = string.Format("{0}\n\n\n\n{1}\n{2}", httpVerb, canonicalizedAmzHeaders, canonicalizedResource);
            var authorization = CreateAuthorizationHeaderForS3(stringToSign);
            var uri = new Uri((("http://" + this.Bucket)
                            + (".s3.amazonaws.com/" + extendedPath)));
            var request = ((HttpWebRequest)(WebRequest.Create(uri)));
            request.Method = httpVerb;
            request.ContentLength = blobLength;
            request.Headers.Add("x-amz-date", d.ToString("R", CultureInfo.InvariantCulture));
            request.Headers.Add("Authorization", authorization);
            try
            {
                using (var requestStream = request.GetRequestStream())
                {
                    var bufferSize = (1024 * 64);
                    var offset = 0;
                    while (offset < blobLength)
                    {
                        var bytesToWrite = (blobLength - offset);
                        if ((offset + bufferSize) < blobLength)
                            bytesToWrite = bufferSize;
                        requestStream.Write(blobContent, offset, bytesToWrite);
                        offset = (offset + bytesToWrite);
                    }
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

        protected virtual string CreateAuthorizationHeaderForS3(string canonicalizedString)
        {
            var ae = new UTF8Encoding();
            var signature = new HMACSHA1()
            {
                Key = ae.GetBytes(this.SecretAccessKey)
            };
            var bytes = ae.GetBytes(canonicalizedString);
            var moreBytes = signature.ComputeHash(bytes);
            var encodedCanonical = Convert.ToBase64String(moreBytes);
            return string.Format(CultureInfo.InvariantCulture, "{0} {1}:{2}", "AWS", this.AccessKeyID, encodedCanonical);
        }
    }
}
