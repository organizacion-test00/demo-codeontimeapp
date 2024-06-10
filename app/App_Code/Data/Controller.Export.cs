using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Configuration;
using System.Data;
using System.Data.Common;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Transactions;
using System.Xml;
using System.Xml.XPath;
using System.Xml.Xsl;
using System.Web;
using System.Web.Caching;
using System.Web.Configuration;
using System.Web.Security;

namespace MyCompany.Data
{
    public partial class DataControllerBase
    {

        public const int MaximumRssItems = 200;

        private static SortedDictionary<string, string> _rowsetTypeMap;

        public static SortedDictionary<string, string> RowsetTypeMap
        {
            get
            {
                return _rowsetTypeMap;
            }
        }

        public virtual void ExportDataAsRowset(ViewPage page, DbDataReader reader, StreamWriter writer, string scope)
        {
            var fields = new List<DataField>();
            foreach (var field in page.Fields)
                if (!((field.Hidden || (field.OnDemand || (field.Type == "DataView")))) && !(fields.Contains(field)))
                {
                    var aliasField = field;
                    if (!(string.IsNullOrEmpty(field.AliasName)))
                        aliasField = page.FindField(field.AliasName);
                    fields.Add(aliasField);
                }
            var s = "uuid:BDC6E3F0-6DA3-11d1-A2A3-00AA00C14882";
            var dt = "uuid:C2F41010-65B3-11d1-A29F-00AA00C14882";
            var rs = "urn:schemas-microsoft-com:rowset";
            var z = "#RowsetSchema";
            var output = ((XmlWriter)(HttpContext.Current.Items["Export_XmlWriter"]));
            if (output == null)
            {
                var settings = new XmlWriterSettings()
                {
                    CloseOutput = false
                };
                output = XmlWriter.Create(writer, settings);
                HttpContext.Current.Items["Export_XmlWriter"] = output;
            }
            if ((scope == "all") || (scope == "start"))
            {
                output.WriteStartDocument();
                output.WriteStartElement("xml");
                output.WriteAttributeString("xmlns", "s", null, s);
                output.WriteAttributeString("xmlns", "dt", null, dt);
                output.WriteAttributeString("xmlns", "rs", null, rs);
                output.WriteAttributeString("xmlns", "z", null, z);
                // declare rowset schema
                output.WriteStartElement("Schema", s);
                output.WriteAttributeString("id", "RowsetSchema");
                output.WriteStartElement("ElementType", s);
                output.WriteAttributeString("name", "row");
                output.WriteAttributeString("content", "eltOnly");
                output.WriteAttributeString("CommandTimeout", rs, "60");
                var number = 1;
                foreach (var field in fields)
                {
                    output.WriteStartElement("AttributeType", s);
                    output.WriteAttributeString("name", field.Name);
                    output.WriteAttributeString("number", rs, number.ToString());
                    output.WriteAttributeString("nullable", rs, "true");
                    output.WriteAttributeString("name", rs, field.Label);
                    output.WriteStartElement("datatype", s);
                    var type = RowsetTypeMap[field.Type];
                    string dbType = null;
                    if ("{0:c}".Equals(field.DataFormatString, StringComparison.CurrentCultureIgnoreCase))
                        dbType = "currency";
                    else
                    {
                        if (!(string.IsNullOrEmpty(field.DataFormatString)) && field.Type != "DateTime")
                            type = "string";
                    }
                    output.WriteAttributeString("type", dt, type);
                    output.WriteAttributeString("dbtype", rs, dbType);
                    output.WriteEndElement();
                    output.WriteEndElement();
                    number++;
                }
                output.WriteStartElement("extends", s);
                output.WriteAttributeString("type", "rs:rowbase");
                output.WriteEndElement();
                output.WriteEndElement();
                output.WriteEndElement();
                output.WriteStartElement("data", rs);
            }
            // output rowset data
            while (reader.Read())
            {
                output.WriteStartElement("row", z);
                foreach (var field in fields)
                {
                    var v = reader[field.Name];
                    if (!(DBNull.Value.Equals(v)))
                    {
                        if (!(string.IsNullOrEmpty(field.DataFormatString)) && !(((field.DataFormatString == "{0:d}") || (field.DataFormatString == "{0:c}"))))
                            output.WriteAttributeString(field.Name, string.Format(field.DataFormatString, v));
                        else
                        {
                            if (field.Type == "DateTime")
                                output.WriteAttributeString(field.Name, ((DateTime)(v)).ToString("s"));
                            else
                                output.WriteAttributeString(field.Name, v.ToString());
                        }
                    }
                }
                output.WriteEndElement();
            }
            if ((scope == "all") || (scope == "end"))
            {
                output.WriteEndElement();
                output.WriteEndElement();
                output.WriteEndDocument();
                output.Close();
                HttpContext.Current.Items.Remove("Export_XmlWriter");
            }
        }

        public virtual void ExportDataAsRss(ViewPage page, DbDataReader reader, StreamWriter writer, string scope)
        {
            var appPath = Regex.Replace(HttpContext.Current.Request.Url.AbsoluteUri, "^(.+)Export.ashx.+$", "$1", RegexOptions.IgnoreCase);
            var settings = new XmlWriterSettings()
            {
                CloseOutput = false
            };
            var output = XmlWriter.Create(writer, settings);
            output.WriteStartDocument();
            output.WriteStartElement("rss");
            output.WriteAttributeString("version", "2.0");
            output.WriteStartElement("channel");
            output.WriteElementString("title", ((string)(_view.Evaluate("string(concat(/c:dataController/@label, \' | \',  @label))", Resolver))));
            output.WriteElementString("lastBuildDate", DateTime.Now.ToString("r"));
            output.WriteElementString("language", System.Threading.Thread.CurrentThread.CurrentCulture.Name.ToLower());
            var rowCount = 0;
            while ((rowCount < MaximumRssItems) && reader.Read())
            {
                output.WriteStartElement("item");
                var hasTitle = false;
                var hasPubDate = false;
                var desc = new StringBuilder();
                for (var i = 0; (i < page.Fields.Count); i++)
                {
                    var field = page.Fields[i];
                    if (!field.Hidden && field.Type != "DataView")
                    {
                        if (!(string.IsNullOrEmpty(field.AliasName)))
                            field = page.FindField(field.AliasName);
                        var text = string.Empty;
                        var v = reader[field.Name];
                        if (!(DBNull.Value.Equals(v)))
                        {
                            if (!(string.IsNullOrEmpty(field.DataFormatString)))
                                text = string.Format(field.DataFormatString, v);
                            else
                                text = Convert.ToString(v);
                        }
                        if (!hasPubDate && (field.Type == "DateTime"))
                        {
                            hasPubDate = true;
                            if (!(string.IsNullOrEmpty(text)))
                                output.WriteElementString("pubDate", ((DateTime)(reader[field.Name])).ToString("r"));
                        }
                        if (!hasTitle)
                        {
                            hasTitle = true;
                            output.WriteElementString("title", text);
                            var link = new StringBuilder();
                            link.Append(_config.Evaluate("string(/c:dataController/@name)"));
                            foreach (var pkf in page.Fields)
                                if (pkf.IsPrimaryKey)
                                    link.Append(string.Format("&{0}={1}", pkf.Name, reader[pkf.Name]));
                            var itemGuid = string.Format("{0}Details.aspx?l={1}", appPath, HttpUtility.UrlEncode(Convert.ToBase64String(Encoding.Default.GetBytes(link.ToString()))));
                            output.WriteElementString("link", itemGuid);
                            output.WriteElementString("guid", itemGuid);
                        }
                        else
                        {
                            if (!(string.IsNullOrEmpty(field.OnDemandHandler)) && (field.OnDemandStyle == OnDemandDisplayStyle.Thumbnail))
                            {
                                if (text.Equals("1"))
                                {
                                    desc.AppendFormat("{0}:<br /><img src=\"{1}Blob.ashx?{2}=t", HttpUtility.HtmlEncode(field.Label), appPath, field.OnDemandHandler);
                                    foreach (var f in page.Fields)
                                        if (f.IsPrimaryKey)
                                        {
                                            desc.Append("|");
                                            desc.Append(reader[f.Name]);
                                        }
                                    desc.Append("\" style=\"width:92px;height:71px;\"/><br />");
                                }
                            }
                            else
                                desc.AppendFormat("{0}: {1}<br />", HttpUtility.HtmlEncode(field.Label), HttpUtility.HtmlEncode(text));
                        }
                    }
                }
                output.WriteStartElement("description");
                output.WriteCData(string.Format("<span style=\\\"font-size:small;\\\">{0}</span>", desc.ToString()));
                output.WriteEndElement();
                output.WriteEndElement();
                rowCount++;
            }
            output.WriteEndElement();
            output.WriteEndElement();
            output.WriteEndDocument();
            output.Close();
        }

        public virtual void ExportDataAsCsv(ViewPage page, DbDataReader reader, StreamWriter writer, string scope)
        {
            var firstField = true;
            if ((scope == "all") || (scope == "start"))
            {
                for (var i = 0; (i < page.Fields.Count); i++)
                {
                    var field = page.Fields[i];
                    if (!field.Hidden && (field.Type != "DataView"))
                    {
                        if (firstField)
                            firstField = false;
                        else
                            writer.Write(System.Globalization.CultureInfo.CurrentCulture.TextInfo.ListSeparator);
                        if (!(string.IsNullOrEmpty(field.AliasName)))
                            field = page.FindField(field.AliasName);
                        writer.Write("\"{0}\"", field.Label.Replace("\"", "\"\""));
                    }
                    field.NormalizeDataFormatString();
                }
                writer.WriteLine();
            }
            while (reader.Read())
            {
                firstField = true;
                for (var j = 0; (j < page.Fields.Count); j++)
                {
                    var field = page.Fields[j];
                    if (!field.Hidden && (field.Type != "DataView"))
                    {
                        if (firstField)
                            firstField = false;
                        else
                            writer.Write(System.Globalization.CultureInfo.CurrentCulture.TextInfo.ListSeparator);
                        if (!(string.IsNullOrEmpty(field.AliasName)))
                            field = page.FindField(field.AliasName);
                        var text = string.Empty;
                        var v = reader[field.Name];
                        if (!(DBNull.Value.Equals(v)))
                        {
                            if (!(string.IsNullOrEmpty(field.DataFormatString)))
                                text = string.Format(field.DataFormatString, v);
                            else
                                text = Convert.ToString(v);
                            writer.Write("\"{0}\"", text.Replace("\"", "\"\""));
                        }
                        else
                            writer.Write("\"\"");
                    }
                }
                writer.WriteLine();
            }
        }
    }
}
