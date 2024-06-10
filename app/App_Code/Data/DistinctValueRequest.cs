using System;
using System.Web;

namespace MyCompany.Data
{
    public partial class DistinctValueRequest : DistinctValueRequestBase
    {
    }

    public class DistinctValueRequestBase
    {

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _tag;

        private string _fieldName;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string[] _filter;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private FieldValue[] _externalFilter;

        private string _lookupContextController;

        private string _lookupContextView;

        private string _lookupContextFieldName;

        private string _controller;

        private string _view;

        private int _maximumValueCount;

        private bool _allowFieldInFilter;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _quickFindHint;

        public DistinctValueRequestBase()
        {
            if (Current == null)
                HttpContext.Current.Items["DistinctValueRequest_Current"] = this;
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

        public string LookupContextController
        {
            get
            {
                return _lookupContextController;
            }
            set
            {
                _lookupContextController = value;
            }
        }

        public string LookupContextView
        {
            get
            {
                return _lookupContextView;
            }
            set
            {
                _lookupContextView = value;
            }
        }

        public string LookupContextFieldName
        {
            get
            {
                return _lookupContextFieldName;
            }
            set
            {
                _lookupContextFieldName = value;
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
                _controller = value;
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
                _view = value;
            }
        }

        public static DistinctValueRequest Current
        {
            get
            {
                return ((DistinctValueRequest)(HttpContext.Current.Items["DistinctValueRequest_Current"]));
            }
        }

        public virtual int MaximumValueCount
        {
            get
            {
                if (_maximumValueCount <= 0)
                    return DataControllerBase.MaximumDistinctValues;
                return _maximumValueCount;
            }
            set
            {
                _maximumValueCount = value;
            }
        }

        public bool AllowFieldInFilter
        {
            get
            {
                return _allowFieldInFilter;
            }
            set
            {
                _allowFieldInFilter = value;
            }
        }

        public string QuickFindHint
        {
            get
            {
                return _quickFindHint;
            }
            set
            {
                _quickFindHint = value;
            }
        }
    }
}
