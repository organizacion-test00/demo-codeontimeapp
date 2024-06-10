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
    public enum DataFieldMaskType
    {

        None,

        Date,

        Number,

        Time,

        DateTime,
    }

    public enum DataFieldAggregate
    {

        None,

        Sum,

        Count,

        Average,

        Max,

        Min,
    }

    public enum OnDemandDisplayStyle
    {

        Thumbnail,

        Link,

        Signature,
    }

    public enum TextInputMode
    {

        Text,

        Password,

        RichText,

        Note,

        Static,
    }

    public enum FieldSearchMode
    {

        Default,

        Required,

        Suggested,

        Allowed,

        Forbidden,
    }

    public class DataField
    {

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _name;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _aliasName;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _tag;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _type;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private int _len;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _label;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _isPrimaryKey;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _readOnly;

        private string _defaultValue;

        private string _headerText;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _footerText;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _toolTip;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _watermark;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _hidden;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _allowQBE;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _allowSorting;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _allowLEV;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _dataFormatString;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _copy;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _hyperlinkFormatString;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _formatOnClient;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _sourceFields;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private int _categoryIndex;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _allowNulls;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private int _columns;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private int _rows;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _onDemand;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private FieldSearchMode _search;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _searchOptions;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _itemsDataController;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _itemsDataView;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _itemsDataValueField;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _itemsDataTextField;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _itemsStyle;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private int _itemsPageSize;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _itemsNewDataView;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _itemsTargetController;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _itemsLetters;

        private List<object[]> _items;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private DataFieldAggregate _aggregate;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _onDemandHandler;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private OnDemandDisplayStyle _onDemandStyle;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private TextInputMode _textMode;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private DataFieldMaskType _maskType;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _mask;

        private string _contextFields;

        private string _selectExpression;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _formula;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _showInSummary;

        private bool _isMirror;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _htmlEncode;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private int _autoCompletePrefixLength;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _calculated;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _causesCalculate;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _isVirtual;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _configuration;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _editor;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _autoSelect;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _searchOnStart;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _itemsDescription;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _dataViewController;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _dataViewId;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _dataViewFilterSource;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _dataViewFilterFields;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _dataViewShowInSummary;

        private bool _dataViewShowActionBar = true;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _dataViewShowActionButtons;

        private bool _dataViewShowDescription = true;

        private bool _dataViewShowViewSelector = true;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _dataViewShowModalForms;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _dataViewSearchByFirstLetter;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _dataViewSearchOnStart;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private int _dataViewPageSize;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _dataViewMultiSelect;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _dataViewShowPager;

        private bool _dataViewShowPageSize = true;

        private bool _dataViewShowSearchBar = true;

        private bool _dataViewShowQuickFind = true;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _dataViewShowRowNumber;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _dataViewAutoSelectFirstRow;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _dataViewAutoHighlightFirstRow;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private int _dataViewRefreshInterval;

        public DataField()
        {
            _items = new List<object[]>();
            _formatOnClient = true;
        }

        public DataField(XPathNavigator field, IXmlNamespaceResolver nm) :
                this()
        {
            this._name = field.GetAttribute("name", string.Empty);
            this._type = field.GetAttribute("type", string.Empty);
            var l = field.GetAttribute("length", string.Empty);
            if (!(string.IsNullOrEmpty(l)))
                _len = Convert.ToInt32(l);
            this._label = field.GetAttribute("label", string.Empty);
            this._isPrimaryKey = (field.GetAttribute("isPrimaryKey", string.Empty) == "true");
            this._readOnly = (field.GetAttribute("readOnly", string.Empty) == "true");
            this._onDemand = (field.GetAttribute("onDemand", string.Empty) == "true");
            this._defaultValue = field.GetAttribute("default", string.Empty);
            this._allowNulls = !((field.GetAttribute("allowNulls", string.Empty) == "false"));
            this._hidden = (field.GetAttribute("hidden", string.Empty) == "true");
            this._allowQBE = !((field.GetAttribute("allowQBE", string.Empty) == "false"));
            this._allowLEV = (field.GetAttribute("allowLEV", string.Empty) == "true");
            this._allowSorting = !((field.GetAttribute("allowSorting", string.Empty) == "false"));
            this._sourceFields = field.GetAttribute("sourceFields", string.Empty);
            var onDemandStyle = field.GetAttribute("onDemandStyle", string.Empty);
            if (onDemandStyle == "Link")
                this._onDemandStyle = OnDemandDisplayStyle.Link;
            else
            {
                if (onDemandStyle == "Signature")
                    this._onDemandStyle = OnDemandDisplayStyle.Signature;
            }
            this._onDemandHandler = field.GetAttribute("onDemandHandler", string.Empty);
            this._contextFields = field.GetAttribute("contextFields", string.Empty);
            this._selectExpression = field.GetAttribute("select", string.Empty);
            var computed = (field.GetAttribute("computed", string.Empty) == "true");
            if (computed)
            {
                _formula = ((string)(field.Evaluate("string(self::c:field/c:formula)", nm)));
                if (string.IsNullOrEmpty(_formula))
                    _formula = "null";
            }
            this._showInSummary = (field.GetAttribute("showInSummary", string.Empty) == "true");
            this._htmlEncode = !((field.GetAttribute("htmlEncode", string.Empty) == "false"));
            this._calculated = (field.GetAttribute("calculated", string.Empty) == "true");
            this._causesCalculate = (field.GetAttribute("causesCalculate", string.Empty) == "true");
            this._isVirtual = (field.GetAttribute("isVirtual", string.Empty) == "true");
            this._configuration = ((string)(field.Evaluate("string(self::c:field/c:configuration)", nm)));
            this._dataFormatString = field.GetAttribute("dataFormatString", string.Empty);
            _formatOnClient = !((field.GetAttribute("formatOnClient", string.Empty) == "false"));
            var editor = field.GetAttribute("editor", string.Empty);
            if (!(string.IsNullOrEmpty(editor)))
                _editor = editor;
            var itemsNav = field.SelectSingleNode("c:items", nm);
            if (itemsNav != null)
            {
                this.ItemsDataController = itemsNav.GetAttribute("dataController", string.Empty);
                this.ItemsTargetController = itemsNav.GetAttribute("targetController", string.Empty);
            }
            var dataViewNav = field.SelectSingleNode("c:dataView", nm);
            if (dataViewNav != null)
            {
                this.DataViewController = dataViewNav.GetAttribute("controller", string.Empty);
                this.DataViewId = dataViewNav.GetAttribute("view", string.Empty);
                this.DataViewFilterSource = dataViewNav.GetAttribute("filterSource", string.Empty);
                this.DataViewFilterFields = dataViewNav.GetAttribute("filterFields", string.Empty);
                _allowQBE = true;
                _allowSorting = true;
                _len = 0;
                _columns = 0;
                _htmlEncode = true;
            }
        }

        public DataField(XPathNavigator field, IXmlNamespaceResolver nm, bool hidden) :
                this(field, nm)
        {
            this._hidden = hidden;
        }

        public DataField(DataField field) :
                this()
        {
            this._isMirror = true;
            this._name = (field.Name + "_Mirror");
            this._type = field.Type;
            this._len = field.Len;
            this._label = field.Label;
            this._readOnly = true;
            this._allowNulls = field.AllowNulls;
            this._allowQBE = field.AllowQBE;
            this._allowSorting = field.AllowSorting;
            this._allowLEV = field.AllowLEV;
            this._dataFormatString = field.DataFormatString;
            this._aggregate = field.Aggregate;
            if (!(this._dataFormatString.Contains("{")))
                this._dataFormatString = string.Format("{{0:{0}}}", this._dataFormatString);
            field._aliasName = this._name;
            this.FormatOnClient = false;
            field.FormatOnClient = true;
            field.DataFormatString = string.Empty;
            this._hidden = true;
        }

        public string Name
        {
            get
            {
                return _name;
            }
            set
            {
                _name = value;
            }
        }

        public string AliasName
        {
            get
            {
                return _aliasName;
            }
            set
            {
                _aliasName = value;
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

        public string Type
        {
            get
            {
                return _type;
            }
            set
            {
                _type = value;
            }
        }

        public int Len
        {
            get
            {
                return _len;
            }
            set
            {
                _len = value;
            }
        }

        public string Label
        {
            get
            {
                return _label;
            }
            set
            {
                _label = value;
            }
        }

        public bool IsPrimaryKey
        {
            get
            {
                return _isPrimaryKey;
            }
            set
            {
                _isPrimaryKey = value;
            }
        }

        public bool ReadOnly
        {
            get
            {
                return _readOnly;
            }
            set
            {
                _readOnly = value;
            }
        }

        public string DefaultValue
        {
            get
            {
                return _defaultValue;
            }
        }

        public bool HasDefaultValue
        {
            get
            {
                return !(string.IsNullOrEmpty(_defaultValue));
            }
        }

        public string HeaderText
        {
            get
            {
                return _headerText;
            }
            set
            {
                _headerText = value;
                if (!(string.IsNullOrEmpty(value)) && string.IsNullOrEmpty(_label))
                    _label = value;
            }
        }

        public string FooterText
        {
            get
            {
                return _footerText;
            }
            set
            {
                _footerText = value;
            }
        }

        public string ToolTip
        {
            get
            {
                return _toolTip;
            }
            set
            {
                _toolTip = value;
            }
        }

        public string Watermark
        {
            get
            {
                return _watermark;
            }
            set
            {
                _watermark = value;
            }
        }

        public bool Hidden
        {
            get
            {
                return _hidden;
            }
            set
            {
                _hidden = value;
            }
        }

        public bool AllowQBE
        {
            get
            {
                return _allowQBE;
            }
            set
            {
                _allowQBE = value;
            }
        }

        public bool AllowSorting
        {
            get
            {
                return _allowSorting;
            }
            set
            {
                _allowSorting = value;
            }
        }

        public bool AllowLEV
        {
            get
            {
                return _allowLEV;
            }
            set
            {
                _allowLEV = value;
            }
        }

        public string DataFormatString
        {
            get
            {
                return _dataFormatString;
            }
            set
            {
                _dataFormatString = value;
            }
        }

        public string Copy
        {
            get
            {
                return _copy;
            }
            set
            {
                _copy = value;
            }
        }

        public string HyperlinkFormatString
        {
            get
            {
                return _hyperlinkFormatString;
            }
            set
            {
                _hyperlinkFormatString = value;
            }
        }

        public bool FormatOnClient
        {
            get
            {
                return _formatOnClient;
            }
            set
            {
                _formatOnClient = value;
            }
        }

        public string SourceFields
        {
            get
            {
                return _sourceFields;
            }
            set
            {
                _sourceFields = value;
            }
        }

        public int CategoryIndex
        {
            get
            {
                return _categoryIndex;
            }
            set
            {
                _categoryIndex = value;
            }
        }

        public bool AllowNulls
        {
            get
            {
                return _allowNulls;
            }
            set
            {
                _allowNulls = value;
            }
        }

        public int Columns
        {
            get
            {
                return _columns;
            }
            set
            {
                _columns = value;
            }
        }

        public int Rows
        {
            get
            {
                return _rows;
            }
            set
            {
                _rows = value;
            }
        }

        public bool OnDemand
        {
            get
            {
                return _onDemand;
            }
            set
            {
                _onDemand = value;
            }
        }

        public FieldSearchMode Search
        {
            get
            {
                return _search;
            }
            set
            {
                _search = value;
            }
        }

        public virtual string SearchOptions
        {
            get
            {
                return _searchOptions;
            }
            set
            {
                _searchOptions = value;
            }
        }

        public string ItemsDataController
        {
            get
            {
                return _itemsDataController;
            }
            set
            {
                _itemsDataController = value;
            }
        }

        public string ItemsDataView
        {
            get
            {
                return _itemsDataView;
            }
            set
            {
                _itemsDataView = value;
            }
        }

        public string ItemsDataValueField
        {
            get
            {
                return _itemsDataValueField;
            }
            set
            {
                _itemsDataValueField = value;
            }
        }

        public string ItemsDataTextField
        {
            get
            {
                return _itemsDataTextField;
            }
            set
            {
                _itemsDataTextField = value;
            }
        }

        public string ItemsStyle
        {
            get
            {
                return _itemsStyle;
            }
            set
            {
                _itemsStyle = value;
            }
        }

        public int ItemsPageSize
        {
            get
            {
                return _itemsPageSize;
            }
            set
            {
                _itemsPageSize = value;
            }
        }

        public string ItemsNewDataView
        {
            get
            {
                return _itemsNewDataView;
            }
            set
            {
                _itemsNewDataView = value;
            }
        }

        public string ItemsTargetController
        {
            get
            {
                return _itemsTargetController;
            }
            set
            {
                _itemsTargetController = value;
            }
        }

        public bool ItemsLetters
        {
            get
            {
                return _itemsLetters;
            }
            set
            {
                _itemsLetters = value;
            }
        }

        public List<object[]> Items
        {
            get
            {
                return _items;
            }
        }

        public DataFieldAggregate Aggregate
        {
            get
            {
                return _aggregate;
            }
            set
            {
                _aggregate = value;
            }
        }

        public string OnDemandHandler
        {
            get
            {
                return _onDemandHandler;
            }
            set
            {
                _onDemandHandler = value;
            }
        }

        public OnDemandDisplayStyle OnDemandStyle
        {
            get
            {
                return _onDemandStyle;
            }
            set
            {
                _onDemandStyle = value;
            }
        }

        public TextInputMode TextMode
        {
            get
            {
                return _textMode;
            }
            set
            {
                _textMode = value;
            }
        }

        public DataFieldMaskType MaskType
        {
            get
            {
                return _maskType;
            }
            set
            {
                _maskType = value;
            }
        }

        public string Mask
        {
            get
            {
                return _mask;
            }
            set
            {
                _mask = value;
            }
        }

        public string ContextFields
        {
            get
            {
                return _contextFields;
            }
        }

        public string Formula
        {
            get
            {
                return _formula;
            }
            set
            {
                _formula = value;
            }
        }

        public bool ShowInSummary
        {
            get
            {
                return _showInSummary;
            }
            set
            {
                _showInSummary = value;
            }
        }

        public bool IsMirror
        {
            get
            {
                return _isMirror;
            }
        }

        public bool HtmlEncode
        {
            get
            {
                return _htmlEncode;
            }
            set
            {
                _htmlEncode = value;
            }
        }

        public int AutoCompletePrefixLength
        {
            get
            {
                return _autoCompletePrefixLength;
            }
            set
            {
                _autoCompletePrefixLength = value;
            }
        }

        public bool Calculated
        {
            get
            {
                return _calculated;
            }
            set
            {
                _calculated = value;
            }
        }

        public bool CausesCalculate
        {
            get
            {
                return _causesCalculate;
            }
            set
            {
                _causesCalculate = value;
            }
        }

        public bool IsVirtual
        {
            get
            {
                return _isVirtual;
            }
            set
            {
                _isVirtual = value;
            }
        }

        public string Configuration
        {
            get
            {
                return _configuration;
            }
            set
            {
                _configuration = value;
            }
        }

        public string Editor
        {
            get
            {
                return _editor;
            }
            set
            {
                _editor = value;
            }
        }

        public bool AutoSelect
        {
            get
            {
                return _autoSelect;
            }
            set
            {
                _autoSelect = value;
            }
        }

        public bool SearchOnStart
        {
            get
            {
                return _searchOnStart;
            }
            set
            {
                _searchOnStart = value;
            }
        }

        public string ItemsDescription
        {
            get
            {
                return _itemsDescription;
            }
            set
            {
                _itemsDescription = value;
            }
        }

        public string DataViewController
        {
            get
            {
                return _dataViewController;
            }
            set
            {
                _dataViewController = value;
            }
        }

        public string DataViewId
        {
            get
            {
                return _dataViewId;
            }
            set
            {
                _dataViewId = value;
            }
        }

        public string DataViewFilterSource
        {
            get
            {
                return _dataViewFilterSource;
            }
            set
            {
                _dataViewFilterSource = value;
            }
        }

        public string DataViewFilterFields
        {
            get
            {
                return _dataViewFilterFields;
            }
            set
            {
                _dataViewFilterFields = value;
            }
        }

        public bool DataViewShowInSummary
        {
            get
            {
                return _dataViewShowInSummary;
            }
            set
            {
                _dataViewShowInSummary = value;
            }
        }

        public bool DataViewShowActionBar
        {
            get
            {
                return _dataViewShowActionBar;
            }
            set
            {
                _dataViewShowActionBar = value;
            }
        }

        public string DataViewShowActionButtons
        {
            get
            {
                return _dataViewShowActionButtons;
            }
            set
            {
                _dataViewShowActionButtons = value;
            }
        }

        public bool DataViewShowDescription
        {
            get
            {
                return _dataViewShowDescription;
            }
            set
            {
                _dataViewShowDescription = value;
            }
        }

        public bool DataViewShowViewSelector
        {
            get
            {
                return _dataViewShowViewSelector;
            }
            set
            {
                _dataViewShowViewSelector = value;
            }
        }

        public bool DataViewShowModalForms
        {
            get
            {
                return _dataViewShowModalForms;
            }
            set
            {
                _dataViewShowModalForms = value;
            }
        }

        public bool DataViewSearchByFirstLetter
        {
            get
            {
                return _dataViewSearchByFirstLetter;
            }
            set
            {
                _dataViewSearchByFirstLetter = value;
            }
        }

        public bool DataViewSearchOnStart
        {
            get
            {
                return _dataViewSearchOnStart;
            }
            set
            {
                _dataViewSearchOnStart = value;
            }
        }

        public int DataViewPageSize
        {
            get
            {
                return _dataViewPageSize;
            }
            set
            {
                _dataViewPageSize = value;
            }
        }

        public bool DataViewMultiSelect
        {
            get
            {
                return _dataViewMultiSelect;
            }
            set
            {
                _dataViewMultiSelect = value;
            }
        }

        public string DataViewShowPager
        {
            get
            {
                return _dataViewShowPager;
            }
            set
            {
                _dataViewShowPager = value;
            }
        }

        public bool DataViewShowPageSize
        {
            get
            {
                return _dataViewShowPageSize;
            }
            set
            {
                _dataViewShowPageSize = value;
            }
        }

        public bool DataViewShowSearchBar
        {
            get
            {
                return _dataViewShowSearchBar;
            }
            set
            {
                _dataViewShowSearchBar = value;
            }
        }

        public bool DataViewShowQuickFind
        {
            get
            {
                return _dataViewShowQuickFind;
            }
            set
            {
                _dataViewShowQuickFind = value;
            }
        }

        public bool DataViewShowRowNumber
        {
            get
            {
                return _dataViewShowRowNumber;
            }
            set
            {
                _dataViewShowRowNumber = value;
            }
        }

        public bool DataViewAutoSelectFirstRow
        {
            get
            {
                return _dataViewAutoSelectFirstRow;
            }
            set
            {
                _dataViewAutoSelectFirstRow = value;
            }
        }

        public bool DataViewAutoHighlightFirstRow
        {
            get
            {
                return _dataViewAutoHighlightFirstRow;
            }
            set
            {
                _dataViewAutoHighlightFirstRow = value;
            }
        }

        public int DataViewRefreshInterval
        {
            get
            {
                return _dataViewRefreshInterval;
            }
            set
            {
                _dataViewRefreshInterval = value;
            }
        }

        public string SelectExpression()
        {
            return _selectExpression;
        }

        public void NormalizeDataFormatString()
        {
            if (!(string.IsNullOrEmpty(_dataFormatString)))
            {
                var fmt = _dataFormatString;
                if (!(fmt.Contains("{")))
                    _dataFormatString = string.Format("{{0:{0}}}", fmt);
            }
            else
            {
                if (_type == "DateTime")
                    _dataFormatString = "{0:d}";
            }
        }

        public string ExpressionName()
        {
            if (IsMirror)
                return Name.Substring(0, (Name.Length - "_Mirror".Length));
            return Name;
        }

        public bool SupportsStaticItems()
        {
            return (!(string.IsNullOrEmpty(ItemsDataController)) && !(((ItemsStyle == "AutoComplete") || (ItemsStyle == "Lookup"))));
        }

        public bool IsMatchedByName(string sample)
        {
            var headerText = this.HeaderText;
            if (string.IsNullOrEmpty(headerText))
                headerText = this.Label;
            if (string.IsNullOrEmpty(headerText))
                headerText = this.Name;
            headerText = headerText.Replace(" ", string.Empty);
            return headerText.StartsWith(sample.Replace(" ", string.Empty), StringComparison.CurrentCultureIgnoreCase);
        }

        public override string ToString()
        {
            if (!(string.IsNullOrEmpty(Formula)))
                return string.Format("{0} as {1}; SQL: {2}", Name, Type, Formula);
            else
                return string.Format("{0} as {1}", Name, Type);
        }

        public bool IsTagged(string tag)
        {
            if (string.IsNullOrEmpty(this.Tag))
                return false;
            return this.Tag.Contains(tag);
        }
    }
}
