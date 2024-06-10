using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Data.Common;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml;
using System.Xml.XPath;
using System.Web;
using System.Web.Caching;
using System.Web.Configuration;
using System.Web.Security;

namespace MyCompany.Data
{
    public class ActionArgs
    {

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private int? _sequence;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private DateTime? _date;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _ignoreBusinessRules;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _tag;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _commandName;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _commandArgument;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _lastCommandName;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _contextKey;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _path;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _controller;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _view;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _lastView;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private FieldValue[] _values;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string[] _filter;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _sortExpression;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _groupExpression;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string[] _selectedValues;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private FieldValue[] _externalFilter;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _saveLEVs;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _trigger;

        public ActionArgs()
        {
            if ((HttpContext.Current != null) && (Current == null))
                HttpContext.Current.Items["ActionArgs_Current"] = this;
        }

        public int? Sequence
        {
            get
            {
                return _sequence;
            }
            set
            {
                _sequence = value;
            }
        }

        public DateTime? Date
        {
            get
            {
                return _date;
            }
            set
            {
                _date = value;
            }
        }

        public bool IgnoreBusinessRules
        {
            get
            {
                return _ignoreBusinessRules;
            }
            set
            {
                _ignoreBusinessRules = value;
            }
        }

        public string Tag
        {
            get
            {
                return _tag;
            }
            set
            {
                _tag = value;
            }
        }

        public string CommandName
        {
            get
            {
                return _commandName;
            }
            set
            {
                _commandName = ControllerUtilities.ValidateName(value);
            }
        }

        public string CommandArgument
        {
            get
            {
                return _commandArgument;
            }
            set
            {
                _commandArgument = ControllerUtilities.ValidateName(value);
            }
        }

        public string LastCommandName
        {
            get
            {
                return _lastCommandName;
            }
            set
            {
                _lastCommandName = ControllerUtilities.ValidateName(value);
            }
        }

        public string ContextKey
        {
            get
            {
                return _contextKey;
            }
            set
            {
                _contextKey = value;
            }
        }

        public string Path
        {
            get
            {
                return _path;
            }
            set
            {
                _path = value;
            }
        }

        public string Controller
        {
            get
            {
                return _controller;
            }
            set
            {
                _controller = ControllerUtilities.ValidateName(value);
            }
        }

        public string View
        {
            get
            {
                return _view;
            }
            set
            {
                _view = ControllerUtilities.ValidateName(value);
            }
        }

        public string LastView
        {
            get
            {
                return _lastView;
            }
            set
            {
                _lastView = ControllerUtilities.ValidateName(value);
            }
        }

        public FieldValue[] Values
        {
            get
            {
                return _values;
            }
            set
            {
                _values = value;
            }
        }

        public string[] Filter
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

        public string GroupExpression
        {
            get
            {
                return _groupExpression;
            }
            set
            {
                _groupExpression = value;
            }
        }

        public CommandConfigurationType SqlCommandType
        {
            get
            {
                var commandType = CommandConfigurationType.None;
                if (CommandName.Equals("update", StringComparison.OrdinalIgnoreCase))
                    commandType = CommandConfigurationType.Update;
                else
                {
                    if (CommandName.Equals("insert", StringComparison.OrdinalIgnoreCase))
                        commandType = CommandConfigurationType.Insert;
                    else
                    {
                        if (CommandName.Equals("delete", StringComparison.OrdinalIgnoreCase))
                            commandType = CommandConfigurationType.Delete;
                    }
                }
                return commandType;
            }
        }

        public bool IsBatchEditOrDelete
        {
            get
            {
                return (((LastCommandName == "BatchEdit") && (CommandName == "Update")) || ((CommandName == "Delete") && (SelectedValues.Length > 1)));
            }
        }

        public string[] SelectedValues
        {
            get
            {
                if (_selectedValues == null)
                    _selectedValues = new string[0];
                return _selectedValues;
            }
            set
            {
                _selectedValues = value;
            }
        }

        public FieldValue[] ExternalFilter
        {
            get
            {
                return _externalFilter;
            }
            set
            {
                _externalFilter = value;
            }
        }

        public bool SaveLEVs
        {
            get
            {
                return _saveLEVs;
            }
            set
            {
                _saveLEVs = value;
            }
        }

        public static ActionArgs Current
        {
            get
            {
                return ((ActionArgs)(HttpContext.Current.Items["ActionArgs_Current"]));
            }
        }

        /// <summary>
        /// The name of the field that has triggered the 'Calculate' action.
        /// </summary>
        public string Trigger
        {
            get
            {
                return _trigger;
            }
            set
            {
                _trigger = value;
            }
        }

        public FieldValue this[string name]
        {
            get
            {
                return SelectFieldValueObject(name);
            }
        }

        public static void Forget()
        {
            HttpContext.Current.Items["ActionArgs_Current"] = null;
        }

        public FieldValue SelectFieldValueObject(string name)
        {
            if (Values != null)
                foreach (var v in Values)
                    if (v.Name.Equals(name, StringComparison.OrdinalIgnoreCase))
                        return v;
            return null;
        }

        public T ToObject<T>()

        {
            var objectType = typeof(T);
            var theObject = ((T)(objectType.Assembly.CreateInstance(objectType.FullName)));
            foreach (var v in Values)
                v.AssignTo(theObject);
            return theObject;
        }

        public void AddValue(params FieldValue[] values)
        {
            var newValues = new List<FieldValue>(Values);
            foreach (var fvo in values)
                newValues.Add(fvo);
            Values = newValues.ToArray();
        }
    }
}
