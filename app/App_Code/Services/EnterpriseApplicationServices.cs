using System;
using System.Collections.Generic;
using System.Linq;
using System.Globalization;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using System.Web;
using System.Web.Routing;
using System.IO;
using System.Xml;
using System.Xml.XPath;
using Newtonsoft.Json.Linq;
using MyCompany.Data;

namespace MyCompany.Services
{
    public partial class EnterpriseApplicationServices : EnterpriseApplicationServicesBase
    {
    }

    public class EnterpriseApplicationServicesBase : ApplicationServicesBase
    {

        public static Regex AppServicesRegex = new Regex("/appservices/(?\'Controller\'\\w+?)(/|$)", RegexOptions.IgnoreCase);

        public static Regex DynamicResourceRegex = new Regex("(\\.js$|^_(invoke|authenticate)$)", RegexOptions.IgnoreCase);

        public static Regex DynamicWebResourceRegex = new Regex("\\.(js|css)$", RegexOptions.IgnoreCase);

        public override void RegisterServices()
        {
            RegisterREST();
            base.RegisterServices();
            ServicePointManager.SecurityProtocol = (ServicePointManager.SecurityProtocol | SecurityProtocolType.Tls12);
            OAuthHandlerFactoryBase.Handlers.Add("facebook", typeof(FacebookOAuthHandler));
            OAuthHandlerFactoryBase.Handlers.Add("google", typeof(GoogleOAuthHandler));
            OAuthHandlerFactoryBase.Handlers.Add("msgraph", typeof(MSGraphOAuthHandler));
            OAuthHandlerFactoryBase.Handlers.Add("linkedin", typeof(LinkedInOAuthHandler));
            OAuthHandlerFactoryBase.Handlers.Add("windowslive", typeof(WindowsLiveOAuthHandler));
            OAuthHandlerFactoryBase.Handlers.Add("sharepoint", typeof(SharePointOAuthHandler));
            OAuthHandlerFactoryBase.Handlers.Add("identityserver", typeof(IdentityServerOAuthHandler));
        }

        public virtual void RegisterREST()
        {
            var routes = RouteTable.Routes;
            routes.RouteExistingFiles = true;
            GenericRoute.Map(routes, new RepresentationalStateTransfer(), "appservices/{Controller}/{Segment1}/{Segment2}/{Segment3}/{Segment4}");
            GenericRoute.Map(routes, new RepresentationalStateTransfer(), "appservices/{Controller}/{Segment1}/{Segment2}/{Segment3}");
            GenericRoute.Map(routes, new RepresentationalStateTransfer(), "appservices/{Controller}/{Segment1}/{Segment2}");
            GenericRoute.Map(routes, new RepresentationalStateTransfer(), "appservices/{Controller}/{Segment1}");
            GenericRoute.Map(routes, new RepresentationalStateTransfer(), "appservices/{Controller}");
        }

        public override bool RequiresAuthentication(HttpRequest request)
        {
            var result = base.RequiresAuthentication(request);
            if (result)
                return true;
            var m = AppServicesRegex.Match(request.Path);
            if (m.Success)
            {
                ControllerConfiguration config = null;
                try
                {
                    var controllerName = m.Groups["Controller"].Value;
                    if ((controllerName == "_authenticate") || (controllerName == "saas"))
                        return false;
                    if (!(DynamicResourceRegex.IsMatch(controllerName)))
                        config = DataControllerBase.CreateConfigurationInstance(GetType(), controllerName);
                }
                catch (Exception)
                {
                }
                if (config == null)
                    return !(DynamicWebResourceRegex.IsMatch(request.Path));
                return RequiresRESTAuthentication(request, config);
            }
            return false;
        }

        public virtual bool RequiresRESTAuthentication(HttpRequest request, ControllerConfiguration config)
        {
            return UriRestConfig.RequiresAuthentication(request, config);
        }
    }

    public class ScheduleStatus
    {

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _schedule;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _exceptions;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _success;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private DateTime _nextTestDate;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _expired;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _precision;

        /// The definition of the schedule.
        public virtual string Schedule
        {
            get
            {
                return _schedule;
            }
            set
            {
                _schedule = value;
            }
        }

        /// The defintion of excepetions to the schedule. Exceptions are expressed as another schedule.
        public virtual string Exceptions
        {
            get
            {
                return _exceptions;
            }
            set
            {
                _exceptions = value;
            }
        }

        /// True if the schedule is valid at this time.
        public virtual bool Success
        {
            get
            {
                return _success;
            }
            set
            {
                _success = value;
            }
        }

        /// The next date and time when the schedule is invalid.
        public virtual DateTime NextTestDate
        {
            get
            {
                return _nextTestDate;
            }
            set
            {
                _nextTestDate = value;
            }
        }

        /// True if the schedule has expired. For internal use only.
        public virtual bool Expired
        {
            get
            {
                return _expired;
            }
            set
            {
                _expired = value;
            }
        }

        /// The precision of the schedule. For internal use only.
        public virtual string Precision
        {
            get
            {
                return _precision;
            }
            set
            {
                _precision = value;
            }
        }
    }

    public partial class Scheduler : SchedulerBase
    {
    }

    public class SchedulerBase
    {

        public static Regex NodeMatchRegex = new Regex("(?\'Depth\'\\++)\\s*(?\'NodeType\'\\S+)\\s*(?\'Properties\'[^\\+]*)");

        public static Regex PropertyMatchRegex = new Regex("\\s*(?\'Name\'[a-zA-Z]*)\\s*[:=]?\\s*(?\'Value\'.+?)(\\n|;|$)");

        private static string[] _nodeTypes = new string[] {
                "yearly",
                "monthly",
                "weekly",
                "daily",
                "once"};

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private DateTime _testDate;

        public virtual DateTime TestDate
        {
            get
            {
                return _testDate;
            }
            set
            {
                _testDate = value;
            }
        }

        public virtual bool UsePreciseProbe
        {
            get
            {
                return false;
            }
        }

        /// Check if a free form text schedule is valid now.
        public static ScheduleStatus Test(string schedule)
        {
            return Test(schedule, null, DateTime.Now);
        }

        /// Check if a free form text schedule is valid on the testDate.
        public static ScheduleStatus Test(string schedule, DateTime testDate)
        {
            return Test(schedule, null, testDate);
        }

        /// Check if a free form text schedule with exceptions is valid now.
        public static ScheduleStatus Test(string schedule, string exceptions)
        {
            return Test(schedule, exceptions, DateTime.Now);
        }

        /// Check if a free form text schedule with exceptions is valid on the testDate.
        public static ScheduleStatus Test(string schedule, string exceptions, DateTime testDate)
        {
            var s = new Scheduler()
            {
                TestDate = testDate
            };
            var status = s.CheckSchedule(schedule, exceptions);
            status.Schedule = schedule;
            status.Exceptions = exceptions;
            return status;
        }

        public virtual ScheduleStatus CheckSchedule(string schedule)
        {
            return CheckSchedule(StringToXml(schedule), null);
        }

        public virtual ScheduleStatus CheckSchedule(string schedule, string exceptions)
        {
            return CheckSchedule(StringToXml(schedule), StringToXml(exceptions));
        }

        /// Check an XML schedule.
        public virtual ScheduleStatus CheckSchedule(Stream schedule)
        {
            return CheckSchedule(schedule, null);
        }

        /// Check an XML schedule with exceptions.
        public virtual ScheduleStatus CheckSchedule(Stream schedule, Stream exceptions)
        {
            var sched = new ScheduleStatus()
            {
                Precision = string.Empty
            };
            var xSched = new ScheduleStatus()
            {
                Precision = string.Empty
            };
            XPathNavigator nav = null;
            XPathNavigator xNav = null;
            if ((schedule == null) || schedule.Equals(Stream.Null))
                sched.Success = true;
            else
            {
                var doc = new XPathDocument(schedule);
                nav = doc.CreateNavigator();
                if (!(nav.MoveToChild(XPathNodeType.Element)) || nav.Name != "schedule")
                    sched.Success = true;
                else
                    CheckNode(nav, DateTime.Now, ref sched);
            }
            if ((exceptions != null) && !(exceptions.Equals(Stream.Null)))
            {
                var xDoc = new XPathDocument(exceptions);
                xNav = xDoc.CreateNavigator();
                if (!(xNav.MoveToChild(XPathNodeType.Element)) || xNav.Name != "schedule")
                    xSched.Success = true;
                else
                    CheckNode(xNav, DateTime.Now, ref xSched);
            }
            if (xSched.Success)
                sched.Success = false;
            if (UsePreciseProbe)
                sched = ProbeScheduleExact(nav, xNav, sched, xSched);
            else
                sched = ProbeSchedule(nav, xNav, sched, xSched);
            return sched;
        }

        /// Converts plain text schedule format into XML stream.
        private Stream StringToXml(string text)
        {
            if (string.IsNullOrEmpty(text))
                return null;
            // check for shorthand "start"
            var testDate = DateTime.Now;
            if (DateTime.TryParse(text, out testDate))
                string.Format("+once start: {0}", text);
            // compose XML document
            var doc = new XmlDocument();
            var dec = doc.CreateXmlDeclaration("1.0", null, null);
            doc.AppendChild(dec);
            var schedule = doc.CreateNode(XmlNodeType.Element, "schedule", null);
            doc.AppendChild(schedule);
            // configure nodes
            var nodes = NodeMatchRegex.Matches(text);
            var lastNode = schedule;
            var lastDepth = 0;
            foreach (Match node in nodes)
            {
                var nodeType = node.Groups["NodeType"].Value;
                var depth = node.Groups["Depth"].Value.Length;
                var properties = node.Groups["Properties"].Value;
                if (_nodeTypes.Contains(nodeType))
                {
                    var newNode = doc.CreateNode(XmlNodeType.Element, nodeType, null);
                    var propertyMatches = PropertyMatchRegex.Matches(node.Groups["Properties"].Value);
                    // populate attributes
                    foreach (Match property in propertyMatches)
                    {
                        var name = property.Groups["Name"].Value.Trim();
                        var val = property.Groups["Value"].Value.Trim();
                        // group value
                        if (string.IsNullOrEmpty(name))
                            name = "value";
                        var attr = doc.CreateAttribute(name);
                        attr.Value = val;
                        newNode.Attributes.Append(attr);
                    }
                    // insert node
                    if (depth > lastDepth)
                        lastNode.AppendChild(newNode);
                    else
                    {
                        if (depth < lastDepth)
                        {
                            while (lastNode.Name != "schedule" && lastNode.Name != nodeType)
                                lastNode = lastNode.ParentNode;
                            if (lastNode.Name == nodeType)
                                lastNode = lastNode.ParentNode;
                            lastNode.AppendChild(newNode);
                        }
                        else
                            lastNode.ParentNode.AppendChild(newNode);
                    }
                    lastNode = newNode;
                    lastDepth = depth;
                }
            }
            // save and return
            var stream = new MemoryStream();
            doc.Save(stream);
            stream.Position = 0;
            return stream;
        }

        /// Checks the current navigator if the current nodes define an active schedule. An empty schedule will set Match to true.
        private bool CheckNode(XPathNavigator nav, DateTime checkDate, ref ScheduleStatus sched)
        {
            if (nav == null)
                return false;
            sched.Precision = nav.Name;
            if (!(nav.MoveToFirstChild()))
            {
                // no schedule limitation
                sched.Success = true;
                return true;
            }
            while (true)
            {
                // ignore comments
                if (!(nav.NodeType.Equals(XPathNodeType.Comment)))
                {
                    var name = nav.Name;
                    if (name == "once")
                    {
                        if (CheckInterval(nav, checkDate))
                            sched.Success = true;
                    }
                    else
                    {
                        if (CheckInterval(nav, checkDate))
                        {
                            var value = nav.GetAttribute("value", string.Empty);
                            var every = nav.GetAttribute("every", string.Empty);
                            var check = 0;
                            if (name == "yearly")
                                check = checkDate.Year;
                            else
                            {
                                if (name == "monthly")
                                    check = checkDate.Month;
                                else
                                {
                                    if (name == "weekly")
                                        check = GetWeekOfMonth(checkDate);
                                    else
                                    {
                                        if (name == "daily")
                                            check = ((int)(checkDate.DayOfWeek));
                                    }
                                }
                            }
                            if (CheckNumberInterval(value, check, every))
                                CheckNode(nav, checkDate, ref sched);
                        }
                    }
                    // found a match
                    if (sched.Expired || sched.Success)
                        break;
                }
                // no more nodes
                if (!(nav.MoveToNext()))
                    break;
            }
            return sched.Success;
        }

        /// Checks to see if a series of comma-separated numbers and/or dash-separated intervals contain a specific number
        private bool CheckNumberInterval(string interval, int number, string every)
        {
            if (string.IsNullOrEmpty(interval))
                return true;
            // process numbers and number ranges
            var strings = interval.Split(',');
            var numbers = new List<int>();
            foreach (var s in strings)
                if (s.Contains('-'))
                {
                    var intervalString = s.Split('-');
                    var interval1 = Convert.ToInt32(intervalString[0]);
                    var interval2 = Convert.ToInt32(intervalString[1]);
                    for (var i = interval1; (i <= interval2); i++)
                        numbers.Add(i);
                }
                else
                {
                    if (!(string.IsNullOrEmpty(s)))
                        numbers.Add(Convert.ToInt32(s));
                }
            numbers.Sort();
            // check if "every" used
            var everyNum = 1;
            if (!(string.IsNullOrEmpty(every)))
                everyNum = Convert.ToInt32(every);
            if (everyNum > 1)
            {
                // if "every" is greater than available numbers
                if (everyNum >= numbers.Count)
                    return numbers.First().Equals(number);
                var allNumbers = new List<int>(numbers);
                numbers.Clear();
                for (var i = 0; (i <= (allNumbers.Count / everyNum)); i++)
                    numbers.Add(allNumbers.ElementAt((i * everyNum)));
            }
            return numbers.Contains(number);
        }

        /// Checks to see if the current node's start and end attributes are valid.
        private bool CheckInterval(XPathNavigator nav, DateTime checkDate)
        {
            var startDate = checkDate;
            var endDate = checkDate;
            if (!(DateTime.TryParse(nav.GetAttribute("start", string.Empty), out startDate)))
                startDate = StartOfDay(TestDate);
            if (!(DateTime.TryParse(nav.GetAttribute("end", string.Empty), out endDate)))
                endDate = DateTime.MaxValue;
            if (!(((startDate <= checkDate) && (checkDate <= endDate))))
                return false;
            return true;
        }

        private ScheduleStatus ProbeSchedule(XPathNavigator document, XPathNavigator exceptionsDocument, ScheduleStatus schedule, ScheduleStatus exceptionsSchedule)
        {
            var testSched = new ScheduleStatus();
            var testExceptionSched = new ScheduleStatus();
            var nextDate = DateTime.Now;
            var initialState = schedule.Success;
            for (var probeCount = 0; (probeCount <= 30); probeCount++)
            {
                nextDate = nextDate.AddSeconds(1);
                // reset variables
                testSched.Success = false;
                testSched.Expired = false;
                document.MoveToRoot();
                document.MoveToFirstChild();
                if (exceptionsDocument != null)
                {
                    exceptionsDocument.MoveToRoot();
                    exceptionsDocument.MoveToFirstChild();
                    testExceptionSched.Success = false;
                    testExceptionSched.Expired = false;
                }
                var valid = (CheckNode(document, nextDate, ref testSched) && ((exceptionsDocument == null) || !(CheckNode(exceptionsDocument, nextDate, ref testExceptionSched))));
                if (valid != initialState)
                    return schedule;
                schedule.NextTestDate = nextDate;
            }
            return schedule;
        }

        private ScheduleStatus ProbeScheduleExact(XPathNavigator document, XPathNavigator exceptionsDocument, ScheduleStatus schedule, ScheduleStatus exceptionsSchedule)
        {
            var testSched = new ScheduleStatus();
            var testExceptionSched = new ScheduleStatus();
            var sign = 1;
            var nextDate = DateTime.Now;
            var initialState = schedule.Success;
            var jump = 0;
            if (schedule.Precision.Equals("daily") || exceptionsSchedule.Precision.Equals("daily"))
                jump = (6 * 60);
            else
            {
                if (schedule.Precision.Equals("weekly") || exceptionsSchedule.Precision.Equals("weekly"))
                    jump = (72 * 60);
                else
                {
                    if (schedule.Precision.Equals("monthly") || exceptionsSchedule.Precision.Equals("monthly"))
                        jump = (360 * 60);
                    else
                    {
                        if (schedule.Precision.Equals("yearly") || exceptionsSchedule.Precision.Equals("yearly"))
                            jump = ((720 * 6)
                                        * 60);
                        else
                            jump = (6 * 60);
                    }
                }
            }
            for (var probeCount = 1; (probeCount <= 20); probeCount++)
            {
                // reset variables
                testSched.Success = false;
                testSched.Expired = false;
                document.MoveToRoot();
                document.MoveToFirstChild();
                if (exceptionsDocument != null)
                {
                    exceptionsDocument.MoveToRoot();
                    exceptionsDocument.MoveToFirstChild();
                    testExceptionSched.Success = false;
                    testExceptionSched.Expired = false;
                }
                // set next date to check
                nextDate = nextDate.AddMinutes((jump * sign));
                var valid = (CheckNode(document, nextDate, ref testSched) && ((exceptionsDocument == null) || !(CheckNode(exceptionsDocument, nextDate, ref testExceptionSched))));
                if (valid == initialState)
                    sign = 1;
                else
                    sign = -1;
                // keep moving forward and expand jump if no border found, otherwise narrow jump
                if (sign == -1)
                    jump = (jump / 2);
                else
                {
                    jump = (jump * 2);
                    probeCount--;
                }
                if (jump < 5)
                    jump++;
                // no border found
                if (nextDate > DateTime.Now.AddYears(5))
                    break;
            }
            schedule.NextTestDate = nextDate.AddMinutes((jump * -1));
            return schedule;
        }

        private int GetWeekOfMonth(DateTime date)
        {
            var beginningOfMonth = new DateTime(date.Year, date.Month, 1);
            while (!((date.Date.AddDays(1).DayOfWeek == CultureInfo.CurrentCulture.DateTimeFormat.FirstDayOfWeek)))
                date = date.AddDays(1);
            return (((int)((((double)(date.Subtract(beginningOfMonth).TotalDays)) / 7))) + 1);
        }

        private DateTime StartOfDay(DateTime date)
        {
            return new DateTime(date.Year, date.Month, date.Day, 0, 0, 0, 0);
        }

        private DateTime EndOfDay(DateTime date)
        {
            return new DateTime(date.Year, date.Month, date.Day, 23, 59, 59, 999);
        }
    }

    public partial class AutoFillGeocode : AutoFillGeocodeBase
    {
    }

    public class AutoFillGeocodeBase : AutoFillAddress
    {

        protected override string CreateRequestUrl(BusinessRulesBase rules, JObject autofill)
        {
            var pb = new List<string>();
            // latitude
            var lat = ((string)(autofill["latitude"]));
            if (!(string.IsNullOrEmpty(lat)))
                pb.Add(lat);
            // longitude
            var lng = ((string)(autofill["longitude"]));
            if (!(string.IsNullOrEmpty(lng)))
                pb.Add(lng);
            return string.Format("https://maps.googleapis.com/maps/api/geocode/json?latlng={0}&key={1}", HttpUtility.UrlEncode(string.Join(",", pb.ToArray()).Replace(" ", "+")), ApplicationServicesBase.Settings("server.geocoding.google.key"));
        }
    }

    public partial class AutoFillAddress : AutoFillAddressBase
    {

        static AutoFillAddress()
        {
            Formats["address1_AU"] = "{street_number} {route} {when /^\\\\d/ in subpremise then #}{subpremise}";
            Formats["address1_CA"] = "{street_number} {route} {when /^\\\\d/ in subpremise then #}{subpremise}";
            Formats["address1_DE"] = "{route}{when /./ in street_number then  }{street_number}{when /./ in subpremise t" +
                "hen , }{when /./ in subpremise then subpremise}";
            Formats["address1_GB"] = "{street_number} {route} {when /^\\\\d/ in subpremise then #}{subpremise}";
            Formats["address1_US"] = "{street_number} {route} {when /^\\d/ in subpremise then #}{subpremise}";
            Formats["address1"] = "{route}{when /./ in street_number then , }{street_number}{when /./ in subpremise " +
                "then , }{when /./ in subpremise then subpremise}";
            Formats["city"] = "{postal_town,sublocality,neighborhood,locality}";
            Formats["postalcode"] = "{postal_code}{when /./ in postal_code_suffix then -}{when /./ in postal_code_suff" +
                "ix then postal_code_suffix}";
            Formats["region_ES"] = "{administrative_area_level_1_long,administrative_area_level_2_long}";
            Formats["region_IT"] = "{administrative_area_level_2,administrative_area_level_1}";
            Formats["region"] = "{administrative_area_level_1,administrative_area_level_2}";
            Formats["country"] = "{country_long}";
        }
    }

    public class AutoFillAddressBase : AutoFill
    {

        public static SortedDictionary<string, string> Formats = new SortedDictionary<string, string>();

        protected virtual string CreateRequestUrl(BusinessRulesBase rules, JObject autofill)
        {
            var components = new List<string>();
            var pb = new List<string>();
            // address 1
            var addr1 = ((string)(autofill["address1"]));
            if (!(string.IsNullOrEmpty(addr1)))
                pb.Add(addr1);
            // city
            var city = ((string)(autofill["city"]));
            if (!(string.IsNullOrEmpty(city)))
                pb.Add(city);
            // region
            var region = ((string)(autofill["region"]));
            if (!(string.IsNullOrEmpty(region)))
                pb.Add(region);
            // postalcode
            var postalCode = ((string)(autofill["postalcode"]));
            if (string.IsNullOrEmpty(postalCode))
                postalCode = ((string)(autofill.GetValue("componentpostalcode", StringComparison.OrdinalIgnoreCase)));
            if (!(string.IsNullOrEmpty(postalCode)))
                components.Add(("postal_code:" + postalCode));
            // country
            var country = ((string)(autofill["country"]));
            if (!(string.IsNullOrEmpty(country)))
            {
                if ((country.Length > 2) && (!(string.IsNullOrEmpty(postalCode)) || !(string.IsNullOrEmpty(region))))
                {
                    var allCultures = CultureInfo.GetCultures(CultureTypes.SpecificCultures);
                    foreach (var ci in allCultures)
                    {
                        var ri = new RegionInfo(ci.LCID);
                        if (ri.EnglishName.Equals(country, StringComparison.CurrentCultureIgnoreCase) || ri.NativeName.Equals(country, StringComparison.CurrentCultureIgnoreCase))
                        {
                            country = ri.TwoLetterISORegionName;
                            break;
                        }
                    }
                }
                if (country.Length == 2)
                    components.Add(("country:" + country));
                else
                    pb.Add(country);
            }
            var requestUrl = string.Format("https://maps.googleapis.com/maps/api/geocode/json?address={0}&key={1}", HttpUtility.UrlEncode(string.Join(",", pb.ToArray()).Replace(" ", "+")), ApplicationServicesBase.Settings("server.geocoding.google.key"));
            if (components.Count > 0)
                requestUrl = string.Format("{0}&components={1}", requestUrl, HttpUtility.UrlEncode(string.Join("|", components.ToArray()).Replace(" ", "+")));
            return requestUrl;
        }

        protected override bool Supports(JObject autofill)
        {
            var enabled = ApplicationServicesBase.Settings("server.geocoding.google.address");
            return ((enabled == null) || ((bool)(enabled)));
        }

        protected override JToken Process(BusinessRulesBase rules, JObject autofill)
        {
            var requestUrl = CreateRequestUrl(rules, autofill);
            var outputAddressList = new JArray();
            using (var client = new WebClient())
            {
                client.Headers["Accept-Language"] = Language();
                var addressJson = JObject.Parse(Encoding.UTF8.GetString(client.DownloadData(requestUrl)));
                var addressList = ((JArray)(addressJson["results"]));
                foreach (JToken address in addressList)
                {
                    var componentList = address["address_components"];
                    var addressComponents = new JObject();
                    foreach (var component in componentList)
                    {
                        var types = ((string[])(component["types"].ToObject(typeof(string[]))));
                        var shortName = ((string)(component["short_name"]));
                        var longName = ((string)(component["long_name"]));
                        foreach (var componentType in types)
                            if (componentType != "political")
                            {
                                addressComponents[componentType] = shortName;
                                addressComponents[(componentType + "_long")] = longName;
                            }
                    }
                    var normalizedAddressComponents = new JObject();
                    foreach (var p in addressComponents)
                        normalizedAddressComponents[p.Key.Replace("_", string.Empty)] = p.Value;
                    outputAddressList.Add(new JObject(new JProperty("name", address["formatted_address"]), new JProperty("address1", Format("address1", addressComponents)), new JProperty("address2", Format("address2", addressComponents, ((string)(autofill["address2"])))), new JProperty("address3", Format("address3", addressComponents, ((string)(autofill["address3"])))), new JProperty("city", Format("city", addressComponents)), new JProperty("region", Format("region", addressComponents)), new JProperty("postalcode", Format("postalcode", addressComponents)), new JProperty("country", Format("country", addressComponents)), new JProperty("type", address["types"][0]), new JProperty("latitude", address["geometry"]["location"]["lat"]), new JProperty("longitude", address["geometry"]["location"]["lng"]), new JProperty("components", normalizedAddressComponents), new JProperty("rawAddress", address)));
                }
            }
            try
            {
                ConfirmResult(rules, outputAddressList);
            }
            catch (Exception)
            {
                // do nothing
            }
            return outputAddressList;
        }

        protected virtual string ToComponentValue(JObject components, string expression)
        {
            var m = Regex.Match(expression, "\\b(\\w+?)\\b");
            while (m.Success)
            {
                var v = ((string)(components[m.Groups[1].Value]));
                if (v != null)
                    return v;
                m = m.NextMatch();
            }
            return null;
        }

        protected virtual string Format(string type, JObject components)
        {
            return Format(type, components, string.Empty);
        }

        protected virtual string Format(string type, JObject components, string defaultValue)
        {
            var s = string.Empty;
            var country = ((string)(components["country"]));
            if (!(Formats.TryGetValue((type
                            + ("_" + country)), out s)))
            {
                if (!(Formats.TryGetValue(type, out s)))
                    return defaultValue;
            }
            while (true)
            {
                var m = Regex.Match(s, "\\{(.+?)\\}");
                if (m.Success)
                {
                    var name = m.Groups[1].Value;
                    string v = null;
                    var ift = Regex.Match(name, "^when\\s\\/(?\'RegEx\'.+?)/\\sin\\s(?\'Component\'.+?)\\s+then\\s(?\'Result\'.+)$");
                    if (ift.Success)
                    {
                        var componentValue = ToComponentValue(components, ift.Groups["Component"].Value);
                        if (componentValue != null)
                        {
                            var test = new Regex(ift.Groups["RegEx"].Value, RegexOptions.IgnoreCase);
                            if (test.IsMatch(componentValue))
                            {
                                v = ToComponentValue(components, ift.Groups["Result"].Value);
                                if (v == null)
                                    v = ift.Groups["Result"].Value;
                            }
                        }
                    }
                    else
                        v = ToComponentValue(components, name);
                    if (v == null)
                        v = string.Empty;
                    s = (s.Substring(0, m.Index)
                                + (v + s.Substring((m.Index + m.Length))));
                }
                else
                    break;
            }
            return s.Trim();
        }

        protected virtual void ConfirmResult(BusinessRulesBase rules, JArray addresses)
        {
            foreach (JToken address in addresses)
                if (((string)(address["components"]["country"])) == "US")
                {
                    // try enhancing address by verifying it with USPS
                    var serialNo = ((string)(ApplicationServicesBase.Settings("server.geocoding.usps.serialNo")));
                    var userName = ((string)(ApplicationServicesBase.Settings("server.geocoding.usps.userName")));
                    var password = ((string)(ApplicationServicesBase.Settings("server.geocoding.usps.password")));
                    var address1 = ((string)(address["address1"]));
                    if (!(string.IsNullOrEmpty(userName)) && !(string.IsNullOrEmpty(address1)))
                    {
                        var uspsRequest = new StringBuilder("<VERIFYADDRESS><COMMAND>ZIP1</COMMAND>");
                        uspsRequest.AppendFormat("<SERIALNO>{0}</SERIALNO>", serialNo);
                        uspsRequest.AppendFormat("<USER>{0}</USER>", userName);
                        uspsRequest.AppendFormat("<PASSWORD>{0}</PASSWORD>", password);
                        uspsRequest.Append("<ADDRESS0></ADDRESS0>");
                        uspsRequest.AppendFormat("<ADDRESS1>{0}</ADDRESS1>", address1);
                        uspsRequest.AppendFormat("<ADDRESS2>{0}</ADDRESS2>", address["address2"]);
                        uspsRequest.AppendFormat("<ADDRESS3>{0},{1},{2}</ADDRESS3>", address["city"], address["region"], address["postalcode"]);
                        uspsRequest.Append("</VERIFYADDRESS>");
                        using (var client = new WebClient())
                        {
                            var uspsResponseText = client.DownloadString(("http://www.dial-a-zip.com/XML-Dial-A-ZIP/DAZService.asmx/MethodZIPValidate?input=" +
                                    "" + HttpUtility.UrlEncode(uspsRequest.ToString())));
                            var uspsResponse = new XPathDocument(new StringReader(uspsResponseText)).CreateNavigator().SelectSingleNode("/Dial-A-ZIP_Response");
                            if (uspsResponse != null)
                            {
                                address["address1"] = uspsResponse.SelectSingleNode("AddrLine1").Value;
                                address["address2"] = uspsResponse.SelectSingleNode("AddrLine2").Value;
                                address["city"] = uspsResponse.SelectSingleNode("City").Value;
                                address["region"] = uspsResponse.SelectSingleNode("State").Value;
                                address["postalcode"] = (uspsResponse.SelectSingleNode("ZIP5").Value
                                            + ("-" + uspsResponse.SelectSingleNode("Plus4").Value));
                                address["components"]["postalcode"] = uspsResponse.SelectSingleNode("ZIP5").Value;
                                address["components"]["postalcodesuffix"] = uspsResponse.SelectSingleNode("Plus4").Value;
                                address["country"] = address["country"].ToString().ToUpper();
                            }
                        }
                    }
                }
        }
    }

    public class AutoFill
    {

        public static SortedDictionary<string, AutoFill> Handlers = new SortedDictionary<string, AutoFill>();

        static AutoFill()
        {
            Handlers["address"] = new AutoFillAddress();
            Handlers["geocode"] = new AutoFillGeocode();
            Handlers["map"] = new AutoFillMap();
        }

        public static void Evaluate(BusinessRulesBase rules)
        {
            var args = rules.Arguments;
            if ((args.CommandName == "AutoFill") && !(string.IsNullOrEmpty(rules.View)))
            {
                var autofill = JObject.Parse(args.Trigger);
                AutoFill handler = null;
                if (Handlers.TryGetValue(((string)(autofill["autofill"])), out handler) && handler.Supports(autofill))
                {
                    var result = handler.Process(rules, autofill);
                    rules.Result.Values.Add(new FieldValue("AutoFill", result.ToString()));
                }
            }
        }

        protected virtual JToken Process(BusinessRulesBase rules, JObject autoFill)
        {
            return null;
        }

        protected virtual bool Supports(JObject autofill)
        {
            return true;
        }

        protected virtual string Language()
        {
            return CultureInfo.CurrentUICulture.Name;
        }
    }

    public partial class AutoFillMap : AutoFillMapBase
    {
    }

    public class AutoFillMapBase : AutoFill
    {

        protected virtual string ToSize(BusinessRulesBase rules, JObject autofill)
        {
            var width = 0;
            if (autofill.Property("width") != null)
                width = ((int)(autofill["width"]));
            if (width < 180)
                width = 180;
            var height = 0;
            if (autofill.Property("height") != null)
                height = ((int)(autofill["height"]));
            if (height < 180)
                height = 180;
            return string.Format("{0}x{1}", width, height);
        }

        protected virtual string ToMapType(BusinessRulesBase rules, JObject autofill)
        {
            var mapType = ((string)(autofill["mapType"]));
            if (string.IsNullOrEmpty(mapType))
                mapType = "roadmap";
            return mapType;
        }

        protected virtual string ToScale(BusinessRulesBase rules, JObject autofill)
        {
            var scale = ((string)(autofill["scale"]));
            if (string.IsNullOrEmpty(scale))
                scale = "1";
            return scale;
        }

        protected virtual string ToZoom(BusinessRulesBase rules, JObject autofill)
        {
            var zoom = ((string)(autofill["zoom"]));
            if (string.IsNullOrEmpty(zoom))
                zoom = "16";
            return zoom;
        }

        protected virtual string ToMarkerSize(BusinessRulesBase rules, JObject autofill)
        {
            var size = ((string)(autofill["markerSize"]));
            if (string.IsNullOrEmpty(size))
                size = "mid";
            return size;
        }

        protected virtual string ToMarkerColor(BusinessRulesBase rules, JObject autofill)
        {
            var color = ((string)(autofill["markerColor"]));
            if (string.IsNullOrEmpty(color))
                color = "red";
            return color;
        }

        protected virtual string ToMarkerList(BusinessRulesBase rules, JObject autofill)
        {
            // try lat & lng
            var lat = ((string)(autofill["latitude"]));
            var lng = ((string)(autofill["longitude"]));
            if (!(string.IsNullOrEmpty(lat)) && !(string.IsNullOrEmpty(lng)))
                return string.Format("{0},{1}", lat, lng);
            else
            {
                var mb = new List<string>();
                // address 1
                var addr1 = ((string)(autofill["address1"]));
                if (!(string.IsNullOrEmpty(addr1)))
                    mb.Add(addr1);
                // city
                var city = ((string)(autofill["city"]));
                if (!(string.IsNullOrEmpty(city)))
                    mb.Add(city);
                // region
                var region = ((string)(autofill["region"]));
                if (!(string.IsNullOrEmpty(region)))
                    mb.Add(region);
                // postalcode
                var postalCode = ((string)(autofill["postalcode"]));
                if (string.IsNullOrEmpty(postalCode))
                    postalCode = ((string)(autofill.GetValue("componentpostalcode", StringComparison.OrdinalIgnoreCase)));
                if (!(string.IsNullOrEmpty(postalCode)))
                    mb.Add(postalCode);
                // country
                var country = ((string)(autofill["country"]));
                if (!(string.IsNullOrEmpty(country)))
                    mb.Add(country);
                return string.Join(",", mb.ToArray()).Replace(" ", "+");
            }
        }

        protected virtual string ToMarkers(BusinessRulesBase rules, JObject autofill)
        {
            // size:mid|color:red|San Francisco,CA|Oakland,CA|San Jose,CA
            return HttpUtility.UrlEncode(string.Format("size:{0}|color:{1}|{2}", ToMarkerSize(rules, autofill), ToMarkerColor(rules, autofill), ToMarkerList(rules, autofill)));
        }

        protected virtual string CreateRequestUrl(BusinessRulesBase rules, JObject autofill)
        {
            // size=512x512&maptype=roadma&markers=size:mid|color:red|San Francisco,CA|Oakland,CA|San Jose,CA&key=737dk343kjfld83lkjfdlk
            return string.Format("https://maps.googleapis.com/maps/api/staticmap?size={0}&scale={1}&maptype={2}&zoo" +
                    "m={3}&markers={4}&key={5}", ToSize(rules, autofill), ToScale(rules, autofill), ToMapType(rules, autofill), ToZoom(rules, autofill), ToMarkers(rules, autofill), ApplicationServicesBase.Settings("server.geocoding.google.key"));
        }

        protected override bool Supports(JObject autofill)
        {
            var enabled = ApplicationServicesBase.Settings("server.geocoding.google.map");
            return ((enabled == null) || ((bool)(enabled)));
        }

        protected override JToken Process(BusinessRulesBase rules, JObject autofill)
        {
            var requestUrl = CreateRequestUrl(rules, autofill);
            var result = new JObject();
            using (var client = new WebClient())
            {
                client.Headers["Accept-Language"] = Language();
                var data = Convert.ToBase64String(client.DownloadData(requestUrl));
                var contentType = client.ResponseHeaders[HttpResponseHeader.ContentType];
                if (contentType.StartsWith("image"))
                {
                    result["image"] = data;
                    result["contentType"] = contentType;
                }
            }
            return result;
        }
    }
}
