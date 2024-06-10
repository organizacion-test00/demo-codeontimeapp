/*!
* Data Aquarium Framework - Resources
* Copyright 2008-2021 Code On Time LLC; Licensed MIT; http://codeontime.com/license
*/
(function () {
    Type.registerNamespace('Web');

    var _dvr = Web.DataViewResources = {};

    _dvr.Common = {
        WaitHtml: '<div class="Wait"></div>'
    };

    _dvr.Pager = {
        ItemsPerPage: 'Items per page: ',
        PageSizes: [10, 15, 20, 25],
        ShowingItems: 'Showing \u003cb\u003e{0}\u003c/b\u003e-\u003cb\u003e{1}\u003c/b\u003e of \u003cb\u003e{2}\u003c/b\u003e items',
        SelectionInfo: ' (<b>{0}</b> selected)',
        Refresh: 'Refresh',
        Next: 'Next »',
        Previous: '« Previous',
        Page: 'Page',
        PageButtonCount: 10
    };

    _dvr.ActionBar = {
        View: 'View'
    };

    _dvr.ModalPopup = {
        Close: 'Close',
        MaxWidth: 800,
        MaxHeight: 600,
        OkButton: 'OK',
        CancelButton: 'Cancel',
        SaveButton: 'Save',
        SaveAndNewButton: 'Save and New'
    };

    _dvr.Menu = {
        SiteActions: 'Site Actions',
        SeeAlso: 'See Also',
        Summary: 'Summary',
        Tasks: 'Tasks',
        About: 'About'
    };

    _dvr.HeaderFilter = {
        GenericSortAscending: 'Smallest on Top',
        GenericSortDescending: 'Largest on Top',
        StringSortAscending: 'Ascending',
        StringSortDescending: 'Descending',
        DateSortAscending: 'Earliest on Top',
        DateSortDescending: 'Latest on Top',
        EmptyValue: '(Empty)',
        BlankValue: '(Blank)',
        Loading: 'Loading...',
        ClearFilter: 'Clear Filter from {0}',
        SortBy: 'Sort by {0}',
        MaxSampleTextLen: 80,
        CustomFilterOption: 'Filter...'
    };

    _dvr.InfoBar = {
        FilterApplied: 'A filter has been applied.',
        ValueIs: ' <span class="Highlight">{0}</span> ',
        Or: ' or ',
        And: ' and ',
        EqualTo: 'is equal to ',
        LessThan: 'is less than ',
        LessThanOrEqual: 'is less than or equal to ',
        GreaterThan: 'is greater than ',
        GreaterThanOrEqual: 'is greater than or equal to ',
        Like: 'is like ',
        StartsWith: 'starts with ',
        Empty: 'empty',
        QuickFind: ' Any field contains '
    };

    _dvr.Lookup = {
        SelectToolTip: 'Select {0}',
        ClearToolTip: 'Clear {0}',
        NewToolTip: 'New {0}',
        SelectLink: '(select)',
        ShowActionBar: true,
        DetailsToolTip: 'View details for {0}',
        ShowDetailsInPopup: true,
        GenericNewToolTip: 'Create New',
        AddItem: 'Add Item'
    };

    _dvr.Validator = {
        Required: 'Required',
        RequiredField: 'This field is required.',
        EnforceRequiredFieldsWithDefaultValue: false,
        NumberIsExpected: 'A number is expected.',
        BooleanIsExpected: 'A logical value is expected.',
        DateIsExpected: 'A date is expected.',
        Optional: 'Optional'
    };

    var _mn = Sys.CultureInfo.CurrentCulture.dateTimeFormat.MonthNames;

    _dvr.Data = {
        ConnectionLost: 'The network connection has been lost. Try again?',
        AnyValue: '(any)',
        NullValue: '<span class="NA">n/a</span>',
        NullValueInForms: 'N/A',
        BooleanDefaultStyle: 'DropDownList',
        BooleanOptionalDefaultItems: [[null, 'N/A'], [false, 'No'], [true, 'Yes']],
        BooleanDefaultItems: [[false, 'No'], [true, 'Yes']],
        MaxReadOnlyStringLen: 600,
        NoRecords: 'No records found.',
        BlobHandler: 'Blob.ashx',
        BlobDownloadLink: 'download',
        BlobDownloadLinkReadOnly: '<span style="color:gray;">download</span>',
        BlobDownloadHint: 'Click here to download the original file.',
        BlobDownloadOriginalHint: 'Tap image to download the original file.',
        BatchUpdate: 'update',
        NoteEditLabel: 'edit',
        NoteDeleteLabel: 'delete',
        NoteDeleteConfirm: 'Delete?',
        UseLEV: 'Paste \"{0}\"',
        DiscardChanges: 'Discard changes?',
        KeepOriginalSel: 'keep original selection',
        DeleteOriginalSel: 'delete original selection',
        Import: {
            UploadInstruction: 'Please select the file to upload. The file must be in \u003cb\u003eCSV\u003c/b\u003e, \u003cb\u003eXLS\u003c/b\u003e, or \u003cb\u003eXLSX\u003c/b\u003e format.',
            DownloadTemplate: 'Download import file template.',
            Uploading: 'Your file is being uploaded to the server. Please wait...',
            MappingInstruction: 'There are \u003cb\u003e{0}\u003c/b\u003e record(s) in the file \u003cb\u003e{1}\u003c/b\u003e ready to be processed.\u003cbr/\u003ePlease map the import fields from data file to the application fields and click \u003ci\u003eImport\u003c/i\u003e to start processing.',
            StartButton: 'Import',
            AutoDetect: '(auto detect)',
            Processing: 'Import file processing has been initiated. The imported data records will become available upon successful processing. You may need to refresh the relevant views/pages to see the imported records.',
            Email: 'Send the import log to the following email addresses (optional)',
            EmailNotSpecified: 'Recipient of the import log has not been specified. Proceed anyway?'
        },
        Filters: {
            Labels: {
                And: 'and',
                Or: 'or',
                Equals: 'equals',
                Clear: 'Clear',
                SelectAll: '(Select All)',
                Includes: 'includes',
                FilterToolTip: 'Change'
            },
            Number: {
                Text: 'Number Filters',
                Kind: 'Number',
                List: [
                    { Function: '=', Text: 'Equals', Prompt: true },
                    { Function: '<>', Text: 'Does Not Equal', Prompt: true },
                    { Function: '<', Text: 'Less Than', Prompt: true },
                    { Function: '>', Text: 'Greater Than', Prompt: true },
                    { Function: '<=', Text: 'Less Than Or Equal', Prompt: true },
                    { Function: '>=', Text: 'Greater Than Or Equal', Prompt: true },
                    { Function: '$between', Text: 'Between', Prompt: true },
                    { Function: '$in', Text: 'Includes', Prompt: true, Hidden: true },
                    { Function: '$notin', Text: 'Does Not Include', Prompt: true, Hidden: true },
                    { Function: '$isnotempty', Text: 'Not Empty' },
                    { Function: '$isempty', Text: 'Empty' }
                ]
            },
            Text: {
                Text: 'Text Filters',
                Kind: 'Text',
                List: [
                    { Function: '=', Text: 'Equals', Prompt: true },
                    { Function: '<>', Text: 'Does Not Equal', Prompt: true },
                    { Function: '$beginswith', Text: 'Begins With', Prompt: true },
                    { Function: '$doesnotbeginwith', Text: 'Does Not Begin With', Prompt: true },
                    { Function: '$contains', Text: 'Contains', Prompt: true },
                    { Function: '$doesnotcontain', Text: 'Does Not Contain', Prompt: true },
                    { Function: '$endswith', Text: 'Ends With', Prompt: true },
                    { Function: '$doesnotendwith', Text: 'Does Not End With', Prompt: true },
                    { Function: '$in', Text: 'Includes', Prompt: true, Hidden: true },
                    { Function: '$notin', Text: 'Does Not Include', Prompt: true, Hidden: true },
                    { Function: '$isnotempty', Text: 'Not Empty' },
                    { Function: '$isempty', Text: 'Empty' }
                ]
            },
            Boolean: {
                Text: 'Logical Filters',
                Kind: 'Logical',
                List: [
                    { Function: '$true', Text: 'Yes' },
                    { Function: '$false', Text: 'No' },
                    { Function: '$isnotempty', Text: 'Not Empty' },
                    { Function: '$isempty', Text: 'Empty' }
                ]
            },
            Date: {
                Text: 'Date Filters',
                Kind: 'Date',
                List: [
                    { Function: '=', Text: 'Equals', Prompt: true },
                    { Function: '<>', Text: 'Does Not Equal', Prompt: true },
                    { Function: '<', Text: 'Before', Prompt: true },
                    { Function: '>', Text: 'After', Prompt: true },
                    { Function: '<=', Text: 'On or Before', Prompt: true },
                    { Function: '>=', Text: 'On or After', Prompt: true },
                    { Function: '$between', Text: 'Between', Prompt: true },
                    { Function: '$in', Text: 'Includes', Prompt: true, Hidden: true },
                    { Function: '$notin', Text: 'Does Not Include', Prompt: true, Hidden: true },
                    { Function: '$isnotempty', Text: 'Not Empty' },
                    { Function: '$isempty', Text: 'Empty' },
                    null,
                    { Function: '$tomorrow', Text: 'Tomorrow' },
                    { Function: '$today', Text: 'Today' },
                    { Function: '$yesterday', Text: 'Yesterday' },
                    null,
                    { Function: '$nextweek', Text: 'Next Week' },
                    { Function: '$thisweek', Text: 'This Week' },
                    { Function: '$lastweek', Text: 'Last Week' },
                    null,
                    { Function: '$nextmonth', Text: 'Next Month' },
                    { Function: '$thismonth', Text: 'This Month' },
                    { Function: '$lastmonth', Text: 'Last Month' },
                    null,
                    { Function: '$nextquarter', Text: 'Next Quarter' },
                    { Function: '$thisquarter', Text: 'This Quarter' },
                    { Function: '$lastquarter', Text: 'Last Quarter' },
                    null,
                    { Function: '$nextyear', Text: 'Next Year' },
                    { Function: '$thisyear', Text: 'This Year' },
                    { Function: '$yeartodate', Text: 'Year to Date' },
                    { Function: '$lastyear', Text: 'Last Year' },
                    null,
                    { Function: '$past', Text: 'Past' },
                    { Function: '$future', Text: 'Future' },
                    null,
                    {
                        Text: 'All Dates in the Period',
                        List: [
                            { Function: '$quarter1', Text: 'Quarter 1' },
                            { Function: '$quarter2', Text: 'Quarter 2' },
                            { Function: '$quarter3', Text: 'Quarter 3' },
                            { Function: '$quarter4', Text: 'Quarter 4' },
                            null,
                            { Function: '$month1', Text: _mn[0] },
                            { Function: '$month2', Text: _mn[1] },
                            { Function: '$month3', Text: _mn[2] },
                            { Function: '$month4', Text: _mn[3] },
                            { Function: '$month5', Text: _mn[4] },
                            { Function: '$month6', Text: _mn[5] },
                            { Function: '$month7', Text: _mn[6] },
                            { Function: '$month8', Text: _mn[7] },
                            { Function: '$month9', Text: _mn[8] },
                            { Function: '$month10', Text: _mn[9] },
                            { Function: '$month11', Text: _mn[10] },
                            { Function: '$month12', Text: _mn[11] }
                        ]
                    }
                ]
            }
        }
    };


    _dvr.Form = {
        ShowActionBar: true,
        ShowCalendarButton: true,
        RequiredFieldMarker: '<span class="Required">*</span>',
        RequiredFiledMarkerFootnote: '* - indicates a required field',
        SingleButtonRowFieldLimit: 7,
        GeneralTabText: 'General',
        Minimize: 'Collapse',
        Maximize: 'Expand'
    };

    _dvr.Grid = {
        InPlaceEditContextMenuEnabled: true,
        QuickFindText: 'Quick Find',
        QuickFindToolTip: 'Type to search the records and press Enter',
        ShowAdvancedSearch: 'Show Advanced Search',
        VisibleSearchBarFields: 3,
        DeleteSearchBarField: '(delete)',
        //AddSearchBarField: 'More Search Fields',
        HideAdvancedSearch: 'Hide Advanced Search',
        PerformAdvancedSearch: 'Search',
        ResetAdvancedSearch: 'Reset',
        NewRowLink: 'Click here to create a new record.',
        RootNodeText: 'Top Level',
        FlatTreeToggle: 'Switch to Hierarchy',
        HierarchyTreeModeToggle: 'Switch to Flat List',
        AddConditionText: 'Add search condition',
        AddCondition: 'Add Condition',
        RemoveCondition: 'Remove Condition',
        ActionColumnHeaderText: 'Actions',
        Aggregates: {
            None: { FmtStr: '', ToolTip: '' },
            Sum: { FmtStr: 'Total: {0}', ToolTip: 'Total of {0}' },
            Count: { FmtStr: 'Count: {0}', ToolTip: 'Count of {0}' },
            Avg: { FmtStr: 'Avg: {0}', ToolTip: 'Average of {0}' },
            Max: { FmtStr: 'Max: {0}', ToolTip: 'Maximum of {0}' },
            Min: { FmtStr: 'Min: {0}', ToolTip: 'Minimum of {0}' }
        },
        Freeze: 'Freeze',
        Unfreeze: 'Unfreeze'
    };

    _dvr.Views = {
        DefaultDescriptions: {
            '$DefaultGridViewDescription': 'This is a list of {0}.',
            '$DefaultEditViewDescription': 'Please review {0} information below. Press Edit to change this record, press Delete to delete the record, or press Cancel/Close to return back.',
            '$DefaultCreateViewDescription': 'Please fill this form and press Save button to create a new {0} record. Press Cancel to return to the previous screen.'
        },
        DefaultCategoryDescriptions: {
            '$DefaultEditDescription': 'These are the fields of the {0} record that can be edited.',
            '$DefaultNewDescription': 'Complete the form. Make sure to enter all required fields.',
            '$DefaultReferenceDescription': 'Additional details about {0} are provided in the reference information section.'
        }
    };

    _dvr.Actions = {
        Scopes: {
            'Grid': {
                'Select': {
                    HeaderText: 'Select'
                },
                'Edit': {
                    HeaderText: 'Edit'
                },
                'Delete': {
                    HeaderText: 'Delete',
                    Confirmation: 'Delete?',
                    Notify: '{$selected} deleted'
                },
                'Duplicate': {
                    HeaderText: 'Duplicate'
                },
                'New': {
                    HeaderText: 'New'
                },
                'BatchEdit': {
                    HeaderText: 'Batch Edit'
                    //                    ,CommandArgument: {
                    //                        'editForm1': {
                    //                            HeaderText: 'Batch Edit (Form)'
                    //                        }
                    //                    }
                },
                'Open': {
                    HeaderText: 'Open'
                }
            },
            'Form': {
                'Edit': {
                    HeaderText: 'Edit'
                },
                'Delete': {
                    HeaderText: 'Delete',
                    Confirmation: 'Delete?',
                    Notify: '{$selected} deleted'
                },
                'Cancel': {
                    HeaderText: 'Close',
                    WhenLastCommandName: {
                        'Duplicate': {
                            HeaderText: 'Cancel'
                        },
                        'Edit': {
                            HeaderText: 'Cancel'
                        },
                        'New': {
                            HeaderText: 'Cancel'
                        }

                    }
                },
                'Update': {
                    HeaderText: 'OK',
                    Notify: 'Saved - {0}',
                    CommandArgument: {
                        'Save': {
                            HeaderText: 'Save',
                            Notify: 'Saved - {0}'
                        },
                        'SaveAndContinue': {
                            HeaderText: 'Save and Continue',
                            Notify: 'Saved - {0}'
                        }
                    },
                    WhenLastCommandName: {
                        'BatchEdit': {
                            HeaderText: 'Update Selection',
                            Confirmation: 'Update?',
                            Notify: 'Saved - {0}'
                        }
                    }
                },
                'Insert': {
                    HeaderText: 'OK',
                    Notify: 'Saved - {0}',
                    CommandArgument: {
                        'Save': {
                            HeaderText: 'Save',
                            Notify: 'Saved - {0}'
                        },
                        'SaveAndNew': {
                            HeaderText: 'Save and New',
                            Notify: 'Saved - {0}'
                        }
                    }
                },
                'Confirm': {
                    HeaderText: 'OK'
                },
                'Navigate': {
                    Controller: {
                        'SiteContent': {
                            HeaderText: 'Add System Identity'
                        }
                    }
                }
            },
            'ActionBar': {
                _Self: {
                    'Actions': {
                        HeaderText: 'Actions'
                    },
                    'Report': {
                        HeaderText: 'Report'
                    },
                    'Record': {
                        HeaderText: 'Record'
                    }
                },
                'New': {
                    HeaderText: 'New {0}',
                    Description: 'Create a new {0} record.',
                    HeaderText2: 'New',
                    VarMaxLen: 15
                },
                'Edit': {
                    HeaderText: 'Edit'
                },
                'Delete': {
                    HeaderText: 'Delete',
                    Confirmation: 'Delete?',
                    Notify: '{$selected} deleted'
                },
                'ExportCsv': {
                    HeaderText: 'Download',
                    Description: 'Download items in CSV format.'
                },
                'ExportRowset': {
                    HeaderText: 'Export to Spreadsheet',
                    Description: 'Analyze items with spreadsheet\u003cbr/\u003eapplication.'
                },
                'ExportRss': {
                    HeaderText: 'View RSS Feed',
                    Description: 'Syndicate items with an RSS reader.'
                },
                'Import': {
                    HeaderText: 'Import From File',
                    Description: 'Upload a CSV, XLS, or XLSX file\u003cbr/\u003eto import records.'
                },
                'Update': {
                    HeaderText: 'Save',
                    Description: 'Save changes to the database.',
                    Notify: 'Saved - {0}'
                },
                'Insert': {
                    HeaderText: 'Save',
                    Description: 'Save new record to the database.',
                    Notify: 'Saved - {0}'
                },
                'Cancel': {
                    HeaderText: 'Cancel',
                    WhenLastCommandName: {
                        'Edit': {
                            HeaderText: 'Cancel',
                            Description: 'Cancel all record changes.'
                        },
                        'New': {
                            HeaderText: 'Cancel',
                            Description: 'Cancel new record.'
                        }
                    }
                },
                'Report': {
                    HeaderText: 'Report',
                    Description: 'Render a report in PDF format'
                },
                'ReportAsPdf': {
                    HeaderText: 'PDF Document',
                    Description: 'View items as Adobe PDF document.\u003cbr/\u003eRequires a compatible reader.'
                },
                'ReportAsImage': {
                    HeaderText: 'Multipage Image',
                    Description: 'View items as a multipage TIFF image.'
                },
                'ReportAsExcel': {
                    HeaderText: 'Spreadsheet',
                    Description: 'View items in a formatted\u003cbr/\u003eMicrosoft Excel spreadsheet.'
                },
                'ReportAsWord': {
                    HeaderText: 'Microsoft Word',
                    Description: 'View items in a formatted\u003cbr/\u003eMicrosoft Word document.'
                },
                'DataSheet': {
                    HeaderText: 'Show in Data Sheet',
                    Description: 'Display items using a data sheet\u003cbr/\u003eformat.'
                },
                'Grid': {
                    HeaderText: 'Show in Standard View',
                    Description: 'Display items in the standard\u003cbr/\u003elist format.'
                },
                'Tree': {
                    HeaderText: 'Show Hierarchy',
                    Description: 'Display hierarchical relationships.'
                },
                'Search': {
                    HeaderText: 'Search',
                    Description: 'Search {0}'
                },
                'Upload': {
                    HeaderText: 'Upload',
                    Description: 'Upload multiple files.'
                }
            },
            'Row': {
                'Update': {
                    HeaderText: 'Save',
                    Notify: 'Saved - {0}',
                    WhenLastCommandName: {
                        'BatchEdit': {
                            HeaderText: 'Update Selection',
                            Confirmation: 'Update?'
                        }
                    }
                },
                'Insert': {
                    HeaderText: 'Insert',
                    Notify: 'Saved - {0}'
                },
                'Cancel': {
                    HeaderText: 'Cancel'
                }
            },
            'ActionColumn': {
                'Edit': {
                    HeaderText: 'Edit'
                },
                'Delete': {
                    HeaderText: 'Delete',
                    Confirmation: 'Delete?',
                    Notify: '{$selected} deleted'
                }
            }
        }
    };

    _dvr.Editor = {
        Undo: 'Undo',
        Redo: 'Redo',
        Bold: 'Bold',
        Italic: 'Italic',
        Underline: 'Underline',
        Strikethrough: 'Strike Through',
        Subscript: 'Sub Script',
        Superscript: 'Super Script',
        JustifyLeft: 'Justify Left',
        JustifyCenter: 'Justify Center',
        JustifyRight: 'Justify Right',
        JustifyFull: 'Justify Full',
        InsertOrderedList: 'Insert Ordered List',
        InsertUnorderedList: 'Insert Unordered List',
        CreateLink: 'Create Link',
        UnLink: 'Unlink',
        RemoveFormat: 'Remove Format',
        SelectAll: 'Select All',
        UnSelect: 'Unselect',
        Delete: 'Delete',
        Cut: 'Cut',
        Copy: 'Copy',
        Paste: 'Paste',
        BackColor: 'Back Color',
        ForeColor: 'Fore Color',
        FontName: 'Font Name',
        FontSize: 'Font Size',
        Indent: 'Indent',
        Outdent: 'Outdent',
        InsertHorizontalRule: 'Insert Horizontal Rule',
        HorizontalSeparator: 'Separator',
        Format: 'Format',
        FormatBlock: {
            p: 'Paragraph',
            blockquote: 'Quotation',
            h1: 'Heading 1',
            h2: 'Heading 2',
            h3: 'Heading 3',
            h4: 'Heading 4',
            h5: 'Heading 5',
            h6: 'Heading 6'
        },
        Rtf: {
            editor: 'Fullscreen'
        }
    };

    _dvr.Draw = {
        Draw: 'Draw',
        Pen: 'Pen',
        Highlighter: 'Highlighter',
        Blur: 'Blur',
        Eraser: 'Eraser'
    };

    _dvr.Mobile = {
        UpOneLevel: 'Up One Level',
        Back: 'Back',
        BatchEdited: '{0} updated',
        Sort: 'Sort',
        Sorted: 'Sorted',
        SortedDefault: 'Default sort order.',
        SortByField: 'Select a field to change the sort order of \u003cb\u003e{0}\u003c/b\u003e.',
        SortByOptions: 'Select the sort order of \u003cb\u003e{0}\u003c/b\u003e by the field \u003cb\u003e{1}\u003c/b\u003e in the list of options below.',
        DefaultOption: 'Default',
        Auto: 'Auto',
        Filter: 'Filter',
        List: 'List',
        Cards: 'Cards',
        Grid: 'Grid',
        Map: 'Map',
        Calendar: 'Calendar',
        ZoomIn: 'Zoom in',
        ZoomOut: 'Zoom out',
        Directions: 'Directions',
        AlternativeView: 'Select an alternative view of data.',
        PresentationStyle: 'Select a data presentation style.',
        LookupViewAction: 'View',
        LookupSelectAction: 'Select',
        LookupClearAction: 'Clear',
        LookupNewAction: 'New',
        LookupInstruction: 'Please select \u003cb\u003e{0}\u003c/b\u003e in the list. ',
        LookupOriginalSelection: 'The original selection is \u003cb\u003e\"{0}\"\u003c/b\u003e. ',
        EmptyContext: 'Actions are not available.',
        Favorites: 'Favorites',
        History: 'History',
        FilterSiteMap: 'Filter site map...',
        ResumeLookup: 'Resume Lookup',
        ResumeEntering: 'Resume Entering',
        ResumeEditing: 'Resume Editing',
        ResumeBrowsing: 'Resume Browsing',
        ResumeViewing: 'Resume Viewing',
        Menu: 'Menu',
        Home: 'Home',
        Settings: 'Settings',
        Sidebar: 'Sidebar',
        Landscape: 'Landscape',
        Portrait: 'Portrait',
        Never: 'Never',
        Always: 'Always',
        ShowSystemButtons: 'Show System Buttons',
        OnHover: 'On Hover',
        ButtonShapes: 'Button Shapes',
        PromoteActions: 'Promote Actions',
        ConfirmReload: 'Reload?',
        ClearText: 'Clear',
        SeeAll: 'See All',
        More: 'More',
        TouchUINotSupported: 'Touch UI is not supported in this browser.',
        ShowingItemsInfo: 'Showing {0} items.',
        FilterByField: 'Select a field to apply a filter to \u003cb\u003e{0}\u003c/b\u003e.',
        Apply: 'Apply',
        FilterByOptions: 'Select one or more options in the list below and press \u003cb\u003e{2}\u003c/b\u003e to filter \u003cb\u003e{0}\u003c/b\u003e by the field \u003cb\u003e{1}\u003c/b\u003e.',
        Suggestions: 'Suggestions',
        UnSelect: 'Unselect',
        AdvancedSearch: 'Advanced Search',
        QuickFindScope: 'Search in...',
        QuickFindDescription: 'Search in {0}',
        AddMatchingGroup: 'Add matching group',
        MatchAll: 'Match all conditions',
        MatchAny: 'Match any conditions',
        DoNotMatchAll: 'Do not match all conditions',
        DoNotMatchAny: 'Do not match any conditions',
        MatchAllPastTense: 'Matched all conditions',
        MatchAnyPastTense: 'Matched any conditions',
        DoNotMatchAllPastTense: 'Did not match all conditions',
        DoNotMatchAnyPastTense: 'Did not match any conditions',
        In: 'in',
        Recent: 'Recent',
        Matched: 'Matched',
        DidNotMatch: 'Did not match',
        ClearFilter: 'Clear Filter',
        ResetSearchConfirm: 'Reset search conditions?',
        FilterCleared: 'Cleared all filters.',
        AdvancedSearchInstruction: 'Enter conditions that must be matched and press search button.',
        Refreshed: 'Refreshed',
        Group: 'Group',
        Grouped: 'Grouped',
        UnGrouped: 'Grouping has been removed',
        GroupedBy: 'Grouped by',
        GroupByField: 'Select a field to group \u003cb\u003e{0}\u003c/b\u003e.',
        Show: 'Show',
        Hide: 'Hide',
        None: 'None',
        Next: 'Next',
        Prev: 'Prev',
        FitToWidth: 'Fit To Width',
        MultiSelection: 'Multi Selection',
        InlineEditing: 'Inline Editing',
        ItemsSelectedOne: '{0} item selected',
        ItemsSelectedMany: '{0} items selected',
        TypeToSearch: 'Type to Search',
        NoMatches: 'No matches.',
        ShowingItemsRange: 'Showing {0} of {1} items',
        Finish: 'Finish',
        ShowOptions: 'Show Options',
        ConfirmContinue: 'Continue?',
        AddAccount: 'Add Account',
        Fullscreen: 'Fullscreen',
        ExitFullscreen: 'Exit Fullscreen',
        Apps: 'Apps',
        Forget: 'Forget',
        ManageAccounts: 'Manage Accounts',
        SignedOut: 'Signed Out',
        Submit: 'Submit',
        Error: 'Error',
        Line: 'Line',
        Download: 'Download',
        Orientation: 'Orientation',
        Device: 'Device',
        ShowMore: 'Show More',
        ShowLess: 'Show Less',
        WithSpecifiedFilters: 'With Specified Filters',
        WithSelectedValues5: 'With Selected Values (Top 5)',
        WithSelectedValues10: 'With Selected Values (Top 10)',
        ReadOnly: '{0} is read-only.',
        ScanToConfirm: 'Please scan again to confirm.',
        Reading: 'Reading...',
        ReadingPane: 'Reading Pane',
        AutoOpenNextItem: 'Auto-open next item',
        From: 'from',
        Verify: 'Verify',
        Enable: 'Enable',
        Generate: 'Generate',
        Wait: 'Please wait...',
        InlineCommands: {
            List: {
                Select: 'Select Item',
                Edit: 'Edit Item',
                New: 'New Item',
                Duplicate: 'Duplicate Item',
            },
            Grid: {
                Select: 'Select Row',
                Edit: 'Edit Row',
                New: 'New Row',
                Duplicate: 'Duplicate Row',
            }
        },
        DisplayDensity: {
            Label: 'Display Density',
            List: {
                Tiny: 'Tiny',
                Condensed: 'Condensed',
                Compact: 'Compact',
                Comfortable: 'Comfortable'
            }
        },
        Files: {
            KB: 'KB',
            MB: 'MB',
            Bytes: 'bytes',
            Drop: 'Drop a file here',
            DropMany: 'Drop files here',
            Tap: 'Tap to select a file',
            TapMany: 'Tap to select files',
            Click: 'Click to select a file',
            ClickMany: 'Click to select files',
            Clear: 'Clear',
            ClearConfirm: 'Clear?',
            Sign: 'Sign here',
            Cleared: 'Value will be cleared on save'
        },
        Import: {
            SelectFile: 'Select a data file in CSV, XLS, or XLSX format.',
            NotSupported: 'Data format of \"{0}\" is not supported.',
            NotMatched: '(not matched)',
            FileStats: 'There are \u003cb\u003e{0}\u003c/b\u003e records in the file \u003cb\u003e{1}\u003c/b\u003e ready to be processed. Please match the field names.',
            Importing: 'Importing',
            Into: 'into',
            StartImport: 'Start Import',
            InsertingRecords: 'Inserting records',
            TestingRecords: 'Testing records',
            ResolvingReferences: 'Resolving references',
            Complete: 'complete',
            Expected: 'Expected to complete',
            Remaining: 'Remaining',
            Done: 'Completed importing',
            Duplicates: 'Duplicates'
        },
        Themes: {
            Label: 'Theme',
            Accent: 'Accent',
            List: {
                None: 'None',
                Light: 'Light',
                Dark: 'Dark',
                Aquarium: 'Aquarium',
                Azure: 'Azure',
                Belltown: 'Belltown',
                Berry: 'Berry',
                Bittersweet: 'Bittersweet',
                Cay: 'Cay',
                Citrus: 'Citrus',
                Classic: 'Classic',
                Construct: 'Construct',
                Convention: 'Convention',
                DarkKnight: 'Dark Knight',
                Felt: 'Felt',
                Graham: 'Graham',
                Granite: 'Granite',
                Grapello: 'Grapello',
                Gravity: 'Gravity',
                Lacquer: 'Lacquer',
                Laminate: 'Laminate',
                Lichen: 'Lichen',
                Mission: 'Mission',
                Modern: 'Modern',
                ModernRose: 'Modern Rose',
                Municipal: 'Municipal',
                Petal: 'Petal',
                Pinnate: 'Pinnate',
                Plastic: 'Plastic',
                Ricasso: 'Ricasso',
                Simple: 'Simple',
                Social: 'Social',
                Summer: 'Summer',
                Vantage: 'Vantage',
                Verdant: 'Verdant',
                Viewpoint: 'Viewpoint',
                WhiteSmoke: 'White Smoke',
                Yoshi: 'Yoshi'
            }
        },
        Transitions: {
            Label: 'Transitions',
            List: {
                none: 'None',
                slide: 'Slide',
                fade: 'Fade',
                pop: 'Pop',
                flip: 'Flip',
                turn: 'Turn',
                flow: 'Flow',
                slideup: 'Slide Up',
                slidedown: 'Slide Down'
            }
        },
        LabelsInList: {
            Label: 'Labels In List',
            List: {
                DisplayedAbove: 'Displayed Above',
                DisplayedBelow: 'Displayed Below'
            }
        },
        InitialListMode: {
            Label: 'Initial List Mode',
            List: {
                SeeAll: 'See All',
                Summary: 'Summary'
            }
        },
        Dates: {
            SmartDates: 'Smart Dates',
            Yesterday: 'Yesterday',
            Last: 'Last',
            Today: 'Today',
            OneHour: 'an hour ago',
            MinAgo: '{0} min ago',
            AMinAgo: 'a minute ago',
            InHour: 'in an hour',
            InMin: 'in {0} min',
            InAMin: 'in a minute',
            Now: 'Now',
            JustNow: 'Just now',
            Tomorrow: 'Tomorrow',
            Next: 'Next'
        },
        Sync: {
            Uploading: 'Uploading {0}...'
        },
        Develop: {
            Tools: 'Developer Tools',
            Explorer: 'Project Explorer',
            FormLayout: 'Form Layout',
            FormLayoutInstr: 'Select screen sizes to be included in the layout.'
        },
        Keyboard: {
            TelHints: {
                Key1: ' ',
                Key2: 'abc',
                Key3: 'def',
                Key4: 'ghi',
                Key5: 'jkl',
                Key6: 'mno',
                Key7: 'pqrs',
                Key8: 'tuv',
                Key9: 'wxyz'
            }
        }
    };

    _dvr.ODP = {
        Initializing: 'Initializing...',
        Status: 'Status',
        Sync: 'Synchronize',
        Synced: 'Synchronized',
        SyncLong: 'Synchronize to upload changes.',
        SyncLast: 'Last Sync',
        Committing: 'Uploading transactions...',
        SyncUploadingFiles: 'Uploading {0} ...',
        SyncUploadFailed: 'Failed to upload {0} files.',
        UploadingFiles: 'Uploading {0} files...',
        UploadFailed: 'Failed to upload files.',
        Pending: 'Pending Changes',
        DownloadingData: 'Downloading data for {0}...',
        DownloadingBlob: 'Downloading binary data for {0}...',
        UnableToExec: 'Unable to execute.',
        UnableToProcess: 'Unable to process transactions.',
        UnableToSave: 'Unable to save changes.',
        UnableToDelete: 'Unable to delete. {1} dependent items in {0}.',
        Save: 'Please save all changes.',
        SaveAndSync: 'Save all changes and choose the Synchronize option in the context menu.',
        OnlineRequired: 'Online connection is required.',
        OfflineState: 'You are working in offline mode.',
        InvalidResponse: 'Invalid response from the server.',
        ReconRequired: 'Reconciliation is required',
        ReconTxDelete: 'Delete this change from the log?',
        ReconTxDeleted: 'Deleted first pending transaction in the log.',
        NotRefreshed: 'Data has not been refreshed.',
        LastRefresh: 'Last refresh: {0}.',
        ServerUnavailable: 'Application server is not available.',
        Refresh: 'Refresh Data',
        RefreshLast: 'Data Refreshed',
        RefreshData: 'Refresh Data',
        Done: 'Done.'
    };

    _dvr.Device = {
        Exit: 'Exit',
        DeviceLoginPrompt: 'Please log in to authorize access on this device.'
    };

    _dvr.TwoFA = {
        Text: '2-Factor Authentication',
        AuthenticatorApp: 'Authenticator App',
        VerificationCode: 'Verification Code',
        Method: 'Method',
        TrustThisDevice: 'Trust this device',
        Consent: 'Consent',
        EnterPassword: 'Enter your password',
        Messages: {
            InvalidVerificationCode: 'Invalid verification code.',
            InvalidPassword: 'Invalid password.',
            EnterCode: 'Please enter the {0}-digit verification code.',
            YourCode: '000000 is your {0} verification code.',
            DisableQuestion: 'Disable two-factor authenticaton?',
            Enabled: '2-Factor Authentication has been enabled.',
            Disabled: '2-Factor Authentication has been disabled.',
            Changed: '2-Factor Authentication has been changed.'
        },
        BackupCode: {
            Text: 'Backup Code',
            Placeholder: 'one-time code',
            Footer: 'If you are unable to provide the verification code, then enter the backup code instead.'
        },
        Actions: {
            GetVerificationCode: 'Get Verification Code'
        },
        VerifyVia: {
            email: 'The verification code will be delivered via email.',
            sms: 'The verification code will be delivered via text message.',
            call: 'I will receive an automated call on my phone.',
            app: 'I will use an authenticator app to get the verification code.'
        },
        Setup: {
            Consent: 'I will enter a verification code after the successful sign in.',
            Methods: 'Verification Methods',
            AppConfigScanQrCode: 'I have an authenticator app on a mobile device.',
            AppConfigEnterSetupKey: 'I can\u0027t scan the QR code.',
            AppConfigInstallApp: 'I need help installing authenticator app.',
            ScanQrCode: 'Scan the QR code in the app',
            EnterSetupKey: 'Enter the setup key in the app',
            ScanAppQrCode: 'Scan the QR code with the camera',
            BackupCodes: {
                Text: 'Backup Codes',
                Footer: 'The one-time use backup codes will let you to sign in if you are unable to provide a verification code.'
            }
        },
        GetCode: {
            call: 'Call me at',
            sms: 'Text me at',
            email: 'Email me to',
            dial: 'I will call'
        },
        CodeSent: {
            call: 'Call was placed to',
            sms: 'Text message was sent to',
            email: 'Email was sent to'
        }
    };

    _dvr.Presenters = {
        Charts: {
            Text: 'Charts',
            DataWarning: 'The maximum number of items to process is {0:d}. Please apply a filter to reduce the number of items.',
            ShowData: 'Show Data',
            ShowChart: 'Show Chart',
            Sizes: {
                Label: 'Size',
                Small: 'Small',
                Medium: 'Medium',
                Large: 'Large'
            },
            ChartLabels: {
                By: 'by',
                Top: 'top',
                Other: 'Other',
                Blank: 'Blank',
                GrandTotals: 'Grand Totals',
                CountOf: 'Count of',
                SumOf: 'Total of',
                AvgOf: 'Average of',
                MinOf: 'Minimum of',
                MaxOf: 'Maximum of',
                Quarter: 'Quarter',
                Week: 'Week'
            }
        },
        Calendar: {
            Text: 'Calendar',
            Today: 'Today',
            Noon: 'Noon',
            Year: 'Year',
            Month: 'Month',
            Week: 'Week',
            Day: 'Day',
            Agenda: 'Agenda',
            Sync: 'Sync',
            Less: 'Less'
        }
    };

    // membership resources

    var _mr = Web.MembershipResources = {};

    _mr.Bar = {
        LoginLink: 'Login',
        LoginText: ' to this website',
        HelpLink: 'Help',
        UserName: 'User Name:',
        Password: 'Password:',
        RememberMe: 'Remember me next time',
        ForgotPassword: 'Forgot your password?',
        SignUp: 'Sign up now',
        LoginButton: 'Login',
        MyAccount: 'My Account',
        LogoutLink: 'Logout',
        HelpCloseButton: 'Close',
        HelpFullScreenButton: 'Full Screen',
        UserIdle: 'Are you still there? Please login again.',
        History: 'History',
        Permalink: 'Permalink',
        AddToFavorites: 'Add to Favorites',
        RotateHistory: 'Rotate',
        Welcome: 'Welcome <b>{0}</b>, Today is {1:D}',
        ChangeLanguageToolTip: 'Change your language',
        PermalinkToolTip: 'Create a permanent link for selected record',
        HistoryToolTip: 'View history of previously selected records',
        AutoDetectLanguageOption: 'Auto Detect'
    };

    _mr.Messages = {
        InvalidUserNameAndPassword: 'Your user name and password are not valid.',
        BlankUserName: 'User name cannot be blank.',
        BlankPassword: 'Password cannot be blank.',
        PermalinkUnavailable: 'Permalink is not available. Please select a record.',
        HistoryUnavailable: 'History is not available.'
    };

    _mr.Manager = {
        UsersTab: 'Users',
        RolesTab: 'Roles',
        UsersInRole: 'Users in Role'
    };

    if (typeof Sys !== 'undefined') Sys.Application.notifyScriptLoaded();
})();