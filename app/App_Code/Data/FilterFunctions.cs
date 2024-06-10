using System;
using System.Collections.Generic;
using System.Data.Common;
using System.Linq;
using System.Text.RegularExpressions;
using System.Web;
using System.Web.Caching;
using System.Web.Security;
using System.Text;
using System.Globalization;

namespace MyCompany.Data
{
    public class FilterFunctions
    {

        public static SortedDictionary<string, FilterFunctionBase> All = new SortedDictionary<string, FilterFunctionBase>();

        private DbCommand _command;

        private string _filter;

        private SelectClauseDictionary _expressions;

        static FilterFunctions()
        {
            All.Add("username", new UserNameFilterFunction());
            All.Add("userid", new UserIdFilterFunction());
            All.Add("external", new ExternalFilterFunction());
            All.Add("beginswith", new TextMatchingFilterFunction("{0}%"));
            All.Add("doesnotbeginwith", new NegativeTextMatchingFilterFunction("{0}%"));
            All.Add("contains", new TextMatchingFilterFunction("%{0}%"));
            All.Add("doesnotcontain", new NegativeTextMatchingFilterFunction("%{0}%"));
            All.Add("endswith", new TextMatchingFilterFunction("%{0}"));
            All.Add("doesnotendwith", new NegativeTextMatchingFilterFunction("%{0}"));
            All.Add("between", new BetweenFilterFunction());
            All.Add("in", new InFilterFunction());
            All.Add("notin", new NotInFilterFunction());
            All.Add("month1", new DateRangeFilterFunction(1));
            All.Add("month2", new DateRangeFilterFunction(2));
            All.Add("month3", new DateRangeFilterFunction(3));
            All.Add("month4", new DateRangeFilterFunction(4));
            All.Add("month5", new DateRangeFilterFunction(5));
            All.Add("month6", new DateRangeFilterFunction(6));
            All.Add("month7", new DateRangeFilterFunction(7));
            All.Add("month8", new DateRangeFilterFunction(8));
            All.Add("month9", new DateRangeFilterFunction(9));
            All.Add("month10", new DateRangeFilterFunction(10));
            All.Add("month11", new DateRangeFilterFunction(11));
            All.Add("month12", new DateRangeFilterFunction(12));
            All.Add("thismonth", new ThisMonthFilterFunction(0));
            All.Add("nextmonth", new ThisMonthFilterFunction(1));
            All.Add("lastmonth", new ThisMonthFilterFunction(-1));
            All.Add("quarter1", new QuarterFilterFunction(1));
            All.Add("quarter2", new QuarterFilterFunction(2));
            All.Add("quarter3", new QuarterFilterFunction(3));
            All.Add("quarter4", new QuarterFilterFunction(4));
            All.Add("thisquarter", new ThisQuarterFilterFunction(0));
            All.Add("lastquarter", new ThisQuarterFilterFunction(-1));
            All.Add("nextquarter", new ThisQuarterFilterFunction(1));
            All.Add("thisyear", new ThisYearFilterFunction(0));
            All.Add("lastyear", new ThisYearFilterFunction(-1));
            All.Add("nextyear", new ThisYearFilterFunction(1));
            All.Add("yeartodate", new YearToDateFilterFunction());
            All.Add("thisweek", new ThisWeekFilterFunction(0));
            All.Add("lastweek", new ThisWeekFilterFunction(-1));
            All.Add("nextweek", new ThisWeekFilterFunction(1));
            All.Add("today", new TodayFilterFunction(0));
            All.Add("yesterday", new TodayFilterFunction(-1));
            All.Add("tomorrow", new TodayFilterFunction(1));
            All.Add("past", new PastFilterFunction());
            All.Add("future", new FutureFilterFunction());
            All.Add("true", new TrueFilterFunction());
            All.Add("false", new FalseFilterFunction());
            All.Add("isempty", new IsEmptyFilterFunction());
            All.Add("isnotempty", new IsNotEmptyFilterFunction());
        }

        public FilterFunctions(DbCommand command, SelectClauseDictionary expressions, string filter)
        {
            this._command = command;
            this._filter = filter;
            this._expressions = expressions;
        }

        public static string Replace(DbCommand command, SelectClauseDictionary expressions, string filter)
        {
            var functions = new FilterFunctions(command, expressions, filter);
            return functions.ToString();
        }

        public override string ToString()
        {
            var filter = Regex.Replace(this._filter, "\\$((?\'Name\'\\w+)\\s*\\((?\'Arguments\'[\\s\\S]*?)\\)\\s*)", DoReplaceFunctions);
            return filter;
        }

        private string DoReplaceFunctions(Match m)
        {
            return string.Format("({0})", All[m.Groups["Name"].Value.ToLower()].ExpandWith(_command, _expressions, m.Groups["Arguments"].Value));
        }
    }

    public class FilterFunctionBase
    {

        public FilterFunctionBase()
        {
        }

        public virtual int YearsBack
        {
            get
            {
                return 5;
            }
        }

        public virtual int YearsForward
        {
            get
            {
                return 1;
            }
        }

        public virtual string ExpandWith(DbCommand command, SelectClauseDictionary expressions, string arguments)
        {
            return string.Empty;
        }

        protected DbParameter CreateParameter(DbCommand command)
        {
            var p = command.CreateParameter();
            var marker = SqlStatement.ConvertTypeToParameterMarker(p.GetType());
            p.ParameterName = ((marker + "p")
                        + command.Parameters.Count.ToString());
            command.Parameters.Add(p);
            return p;
        }

        public string FirstArgument(string arguments)
        {
            var m = Regex.Match(arguments, "^\\s*(\\w+)\\s*(,|\\$comma\\$)?");
            return m.Groups[1].Value;
        }

        protected string ExtractArgument(string arguments, int index)
        {
            var m = Regex.Match(arguments, "^\\s*(\\w+)\\s*(,|\\$comma\\$)\\s*([\\s\\S]*?)\\s*$");
            var s = m.Groups[3].Value;
            if (m.Groups[2].Value == "$comma$")
                s = Encoding.UTF8.GetString(Convert.FromBase64String(s));
            m = Regex.Match(s, "^([\\s\\S]*?)\\$and\\$([\\s\\S]*?)$");
            if (m.Success)
                return m.Groups[index].Value;
            return s;
        }

        public string SecondArgument(string arguments)
        {
            return ExtractArgument(arguments, 1);
        }

        public string ThirdArgument(string arguments)
        {
            return ExtractArgument(arguments, 2);
        }
    }

    public class UserNameFilterFunction : FilterFunctionBase
    {

        public override string ExpandWith(DbCommand command, SelectClauseDictionary expressions, string arguments)
        {
            var p = CreateParameter(command);
            p.Value = HttpContext.Current.User.Identity.Name;
            if (string.IsNullOrEmpty(arguments))
                return p.ParameterName;
            return string.Format("{0}={1}", arguments, p.ParameterName);
        }
    }

    public class UserIdFilterFunction : FilterFunctionBase
    {

        public override string ExpandWith(DbCommand command, SelectClauseDictionary expressions, string arguments)
        {
            var p = CreateParameter(command);
            p.Value = Membership.GetUser().ProviderUserKey;
            if (string.IsNullOrEmpty(arguments))
                return p.ParameterName;
            return string.Format("{0}={1}", arguments, p.ParameterName);
        }
    }

    public class TextMatchingFilterFunction : FilterFunctionBase
    {

        private string _pattern;

        public TextMatchingFilterFunction(string pattern)
        {
            this._pattern = pattern;
        }

        public override string ExpandWith(DbCommand command, SelectClauseDictionary expressions, string arguments)
        {
            var p = CreateParameter(command);
            p.Value = string.Format(_pattern, SqlStatement.EscapePattern(command, Convert.ToString(Controller.StringToValue(SecondArgument(arguments)))));
            return string.Format("{0} like {1}", expressions[FirstArgument(arguments)], p.ParameterName);
        }
    }

    public class NegativeTextMatchingFilterFunction : TextMatchingFilterFunction
    {

        public NegativeTextMatchingFilterFunction(string pattern) :
                base(pattern)
        {
        }

        public override string ExpandWith(DbCommand command, SelectClauseDictionary expressions, string arguments)
        {
            return string.Format("not({0})", base.ExpandWith(command, expressions, arguments));
        }
    }

    public class BetweenFilterFunction : FilterFunctionBase
    {

        public override string ExpandWith(DbCommand command, SelectClauseDictionary expressions, string arguments)
        {
            var p = CreateParameter(command);
            p.Value = Controller.StringToValue(SecondArgument(arguments));
            var p2 = CreateParameter(command);
            p2.Value = Controller.StringToValue(ThirdArgument(arguments));
            if (expressions.ContainsKey("_DataView_RowFilter_"))
                return string.Format("{0} >= {1} and {0} <= {2}", expressions[FirstArgument(arguments)], p.ParameterName, p2.ParameterName);
            else
                return string.Format("{0} between {1} and {2}", expressions[FirstArgument(arguments)], p.ParameterName, p2.ParameterName);
        }
    }

    public class InFilterFunction : FilterFunctionBase
    {

        public override string ExpandWith(DbCommand command, SelectClauseDictionary expressions, string arguments)
        {
            var fieldExpression = expressions[FirstArgument(arguments)];
            var sb = new StringBuilder(fieldExpression);
            sb.Append(" in (");
            var list = SecondArgument(arguments).Split(new string[] {
                        "$or$"}, StringSplitOptions.RemoveEmptyEntries);
            var hasNull = false;
            var hasValues = false;
            foreach (var v in list)
                if (Controller.StringIsNull(v))
                    hasNull = true;
                else
                {
                    if (hasValues)
                        sb.Append(",");
                    else
                        hasValues = true;
                    var p = CreateParameter(command);
                    p.Value = Controller.StringToValue(v);
                    sb.Append(p.ParameterName);
                }
            sb.Append(")");
            if (hasNull)
            {
                if (hasValues)
                    return string.Format("({0} is null) or ({1})", fieldExpression, sb.ToString());
                else
                    return string.Format("{0} is null", fieldExpression);
            }
            else
                return sb.ToString();
        }
    }

    public class NotInFilterFunction : InFilterFunction
    {

        public override string ExpandWith(DbCommand command, SelectClauseDictionary expressions, string arguments)
        {
            var list = SecondArgument(arguments).Split(new string[] {
                        "$or$"}, StringSplitOptions.RemoveEmptyEntries);
            var filter = string.Format("not({0})", base.ExpandWith(command, expressions, arguments));
            if (Array.IndexOf(list, "null") == -1)
                filter = string.Format("({0}) or {1} is null", filter, expressions[FirstArgument(arguments)]);
            return filter;
        }
    }

    public partial class DateRangeFilterFunction : FilterFunctionBase
    {

        private int _month;

        private int _startYear;

        private int _endYear;

        public DateRangeFilterFunction(int month) :
                this(month, -1, -1)
        {
        }

        public DateRangeFilterFunction() :
                this(0, 0, 0)
        {
        }

        public DateRangeFilterFunction(int month, int startYear, int endYear)
        {
            this._month = month;
            if (startYear == -1)
                startYear = YearsBack;
            this._startYear = startYear;
            if (endYear == -1)
                endYear = YearsForward;
            this._endYear = endYear;
        }

        public int Month
        {
            get
            {
                return _month;
            }
        }

        public override string ExpandWith(DbCommand command, SelectClauseDictionary expressions, string arguments)
        {
            var sb = new StringBuilder();
            var currentYear = DateTime.Today.Year;
            for (var i = (currentYear - _startYear); (i <= (currentYear + _endYear)); i++)
            {
                var p = CreateParameter(command);
                var p2 = CreateParameter(command);
                DateTime startDate;
                DateTime endDate;
                AssignRange(i, out startDate, out endDate);
                p.Value = startDate;
                p2.Value = endDate;
                if (sb.Length > 0)
                    sb.Append("or");
                if (expressions.ContainsKey("_DataView_RowFilter_"))
                    sb.AppendFormat("({0} >= {1} and {0} <= {2})", expressions[FirstArgument(arguments)], p.ParameterName, p2.ParameterName);
                else
                    sb.AppendFormat("({0} between {1} and {2})", expressions[FirstArgument(arguments)], p.ParameterName, p2.ParameterName);
            }
            return sb.ToString();
        }

        protected virtual void AssignRange(int year, out DateTime startDate, out DateTime endDate)
        {
            startDate = new DateTime(year, Month, 1);
            endDate = startDate.AddMonths(1).AddSeconds(-1);
        }
    }

    public class ThisMonthFilterFunction : DateRangeFilterFunction
    {

        private int _deltaMonth;

        public ThisMonthFilterFunction(int deltaMonth)
        {
            this._deltaMonth = deltaMonth;
        }

        protected override void AssignRange(int year, out DateTime startDate, out DateTime endDate)
        {
            startDate = new DateTime(year, DateTime.Today.Month, 1).AddMonths(_deltaMonth);
            endDate = startDate.AddMonths(1).AddSeconds(-1);
        }
    }

    public class QuarterFilterFunction : DateRangeFilterFunction
    {

        public QuarterFilterFunction(int quarter) :
                base((((quarter - 1)
                                * 3)
                                + 1))
        {
        }

        protected override void AssignRange(int year, out DateTime startDate, out DateTime endDate)
        {
            startDate = new DateTime(year, Month, 1);
            endDate = startDate.AddMonths(3).AddSeconds(-1);
        }
    }

    public class ThisQuarterFilterFunction : DateRangeFilterFunction
    {

        private int _deltaQuarter;

        public ThisQuarterFilterFunction(int deltaQuarter)
        {
            this._deltaQuarter = deltaQuarter;
        }

        protected override void AssignRange(int year, out DateTime startDate, out DateTime endDate)
        {
            var month = DateTime.Today.Month;
            while (!(((month % 3) == 1)))
                month = (month - 1);
            startDate = new DateTime(year, month, 1).AddMonths((_deltaQuarter * 3));
            endDate = startDate.AddMonths(3).AddSeconds(-1);
        }
    }

    public class ThisYearFilterFunction : DateRangeFilterFunction
    {

        private int _deltaYear;

        public ThisYearFilterFunction(int deltaYear)
        {
            this._deltaYear = deltaYear;
        }

        protected override void AssignRange(int year, out DateTime startDate, out DateTime endDate)
        {
            startDate = new DateTime(DateTime.Today.Year, 1, 1).AddYears(_deltaYear);
            endDate = startDate.AddMonths(12).AddSeconds(-1);
        }
    }

    public class YearToDateFilterFunction : DateRangeFilterFunction
    {

        protected override void AssignRange(int year, out DateTime startDate, out DateTime endDate)
        {
            startDate = new DateTime(DateTime.Today.Year, 1, 1);
            endDate = DateTime.Today.AddDays(1).AddSeconds(-1);
        }
    }

    public class ThisWeekFilterFunction : DateRangeFilterFunction
    {

        private int _deltaWeek;

        public ThisWeekFilterFunction(int deltaWeek)
        {
            this._deltaWeek = deltaWeek;
        }

        protected override void AssignRange(int year, out DateTime startDate, out DateTime endDate)
        {
            startDate = DateTime.Today;
            while (startDate.DayOfWeek != CultureInfo.CurrentUICulture.DateTimeFormat.FirstDayOfWeek)
                startDate = startDate.AddDays(-1);
            startDate = startDate.AddDays((7 * _deltaWeek));
            endDate = startDate.AddDays(7).AddSeconds(-1);
        }
    }

    public class TodayFilterFunction : DateRangeFilterFunction
    {

        private int _deltaDays;

        public TodayFilterFunction(int deltaDays)
        {
            this._deltaDays = deltaDays;
        }

        protected override void AssignRange(int year, out DateTime startDate, out DateTime endDate)
        {
            startDate = DateTime.Today.AddDays(_deltaDays);
            endDate = startDate.AddDays(1).AddSeconds(-1);
        }
    }

    public class PastFilterFunction : FilterFunctionBase
    {

        public override string ExpandWith(DbCommand command, SelectClauseDictionary expressions, string arguments)
        {
            var p = CreateParameter(command);
            p.Value = DateTime.Now;
            return string.Format("{0}<{1}", expressions[FirstArgument(arguments)], p.ParameterName);
        }
    }

    public class FutureFilterFunction : FilterFunctionBase
    {

        public override string ExpandWith(DbCommand command, SelectClauseDictionary expressions, string arguments)
        {
            var p = CreateParameter(command);
            p.Value = DateTime.Now;
            return string.Format("{0}<{1}", p.ParameterName, expressions[FirstArgument(arguments)]);
        }
    }

    public class TrueFilterFunction : FilterFunctionBase
    {

        public override string ExpandWith(DbCommand command, SelectClauseDictionary expressions, string arguments)
        {
            var p = CreateParameter(command);
            p.Value = true;
            return string.Format("{0}={1}", expressions[FirstArgument(arguments)], p.ParameterName);
        }
    }

    public class FalseFilterFunction : FilterFunctionBase
    {

        public override string ExpandWith(DbCommand command, SelectClauseDictionary expressions, string arguments)
        {
            var p = CreateParameter(command);
            p.Value = false;
            return string.Format("{0}={1}", expressions[FirstArgument(arguments)], p.ParameterName);
        }
    }

    public class IsEmptyFilterFunction : FilterFunctionBase
    {

        public override string ExpandWith(DbCommand command, SelectClauseDictionary expressions, string arguments)
        {
            return string.Format("{0} is null", expressions[FirstArgument(arguments)]);
        }
    }

    public class IsNotEmptyFilterFunction : FilterFunctionBase
    {

        public override string ExpandWith(DbCommand command, SelectClauseDictionary expressions, string arguments)
        {
            return string.Format("{0} is not null", expressions[FirstArgument(arguments)]);
        }
    }

    public class ExternalFilterFunction : FilterFunctionBase
    {

        public override string ExpandWith(DbCommand command, SelectClauseDictionary expressions, string arguments)
        {
            var p = CreateParameter(command);
            p.Value = DBNull.Value;
            if (PageRequest.Current != null)
            {
                var parameterName = Regex.Match(arguments, "\\w+").Value;
                foreach (var v in PageRequest.Current.ExternalFilter)
                    if (v.Name.Equals(parameterName, StringComparison.InvariantCultureIgnoreCase))
                    {
                        p.Value = v.Value;
                        break;
                    }
            }
            return p.ParameterName;
        }
    }
}
