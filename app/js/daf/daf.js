/*eslint eqeqeq: ["error", "smart"]*/
/*!
* Data Aquarium Framework - Core
* Copyright 2008-2021 Code On Time LLC; Licensed MIT; http://codeontime.com/license
*/

(function () {
    Type.registerNamespace("Web");

    var _window = window,
        $window = $(_window),
        $document = $(document),
        _web = _window.Web,
        _Sys = Sys,
        _Sys_Application = _Sys.Application,
        _Sys_StringBuilder = _Sys.StringBuilder,
        userScope = '',
        _serializer,
        sysBrowser = _Sys.Browser,
        _jsExpRegex = /\{([\s\S]+?)\}/,
        currentCulture = _Sys.CultureInfo.CurrentCulture,
        dateTimeFormat = currentCulture.dateTimeFormat,
        resources = _web.DataViewResources,
        resourcesData = Web.DataViewResources.Data,
        resourcesDataFilters = resourcesData.Filters,
        resourcesDataFiltersLabels = resourcesDataFilters.Labels,
        resourcesHeaderFilter = resources.HeaderFilter,
        resourcesModalPopup = resources.ModalPopup,
        resourcesPager = resources.Pager,
        resourcesMobile = resources.Mobile,
        resourcesFiles = resourcesMobile.Files,
        resourcesValidator = resources.Validator,
        resourcesActionsScopes = resources.Actions.Scopes,
        resourcesGrid = resources.Grid,
        resourcesODP = resources.ODP,
        resourcesEditor = resources.Editor,
        labelSearch = resourcesGrid.PerformAdvancedSearch,
        labelClear = resourcesDataFiltersLabels.Clear,
        labelNullValueInForms = resourcesData.NullValueInForms,
        labelNullValue = resourcesData.NullValue,
        labelAnd = resourcesDataFiltersLabels.And,
        resourcesWhenLastCommandBatchEdit = resourcesActionsScopes.Form.Update.WhenLastCommandName.BatchEdit,
        fieldPropertiesWithTrueDefault = ['AllowQBE', 'AllowSorting', 'FormatOnClient', 'HtmlEncode'],
        fieldPropertiesWithZeroDefault = ['Len', 'Rows', 'Columns', 'Search', 'ItemsPageSize', 'Aggregate', 'OnDemandStyle', 'TextMode', 'MaskType', 'AutoCompletePrefixLength', 'CategoryIndex'],
        getPagePropertiesWithEmptyArrayDefault = ['Fields', 'Views', 'Categories', 'ActionGroups', 'Filter'],
        keyboards = {},
        appClipboard,
        findDataView,
        appBaseUrl, appServicePath,
        _clipboard,

        _touch, _host, _odp, _geolocation, _locationWatchId, _storage, _scripts = {};

    function htmlTag(tagName, classNames, inner) {
        return '<' + tagName + (classNames ? ' class="' + classNames + '"' : '') + (inner && !inner.match(/^</) ? ' ' + inner : '') + '>' +
            (inner && inner.match(/^</) ? inner : '') +
            '</' + tagName + '>';
    }

    function div(classNames, inner) {
        return htmlTag('div', classNames, inner);
    }

    function span(classNames, inner) {
        return htmlTag('span', classNames, inner);
    }

    function $htmlTag(tagName, classNames, inner) {
        return $(htmlTag(tagName, classNames, inner));
    }

    function $p(classNames, inner) {
        return $htmlTag('p', classNames, inner);
    }

    function $div(classNames, inner) {
        return $htmlTag('div', classNames, inner);
    }

    function $span(classNames, inner) {
        return $htmlTag('span', classNames, inner);
    }

    function $a(classNames, inner) {
        return $htmlTag('a', classNames, inner);
    }

    function $i(classNames, inner) {
        return $htmlTag('i', classNames, inner);
    }

    function $li(classNames, inner) {
        return $htmlTag('li', classNames, inner);
    }

    function $ul(classNames, inner) {
        return $htmlTag('ul', classNames, inner);
    }

    function busy(isBusy) {
        if (_touch)
            _touch.busy(isBusy);
    }

    function createInvokeError(methodName, error, jqXHR, textStatus) {
        return (
            {
                get_statusCode: function () {
                    return jqXHR ? jqXHR.status : null;
                },
                get_timedOut: function () {
                    return false;
                },
                get_exceptionType: function () {
                    return textStatus || error && error.ExceptionType;
                },
                get_message: function () {
                    return error ? error.message || error.Message : jqXHR && jqXHR.message;
                },
                get_stackTrace: function () {
                    return error ? error.stack || error.StackTrace : '';
                }
            }
        );
    }

    function jsonStringify(obj) {
        return JSON.stringify(obj);
    }

    function isInstanceOfType(obj1, obj2) {
        return obj1.isInstanceOfType(obj2);
    }

    function configureDefaultProperties(f) {
        if (!f.Type)
            f.Type = 'String';
        if (f.Type === 'DataView' && !_touch)
            f.Hidden = true;
        // provide default values removed during compression
        configureDefaultValues(f, fieldPropertiesWithTrueDefault, true);
        configureDefaultValues(f, fieldPropertiesWithZeroDefault, 0);

        //if (isNullOrEmpty(field.HeaderText)) field.HeaderText = field.Label;
        //if (isNullOrEmpty(field.HeaderText)) field.HeaderText = field.Name;

        var headerText = f.HeaderText || f.Label || f.Name,
            tag = f.Tag,
            tagMatch = tag && tag.match(/survey-(form|data)+/);

        if (headerText === '$blank')
            headerText = '&nbsp;';
        f.HeaderText = headerText;

        if (tagMatch)
            f.Tag += ' input-type-' + tagMatch[0].replace('-', '');

        if (f.Items == null)
            f.Items = [];
    }

    function configureDefaultValues(obj, properties, defaultValue) {
        var i, propName;
        for (i = 0; i < properties.length; i++) {
            propName = properties[i];
            if (obj[propName] == null)
                obj[propName] = defaultValue;
        }
    }

    function iterateMenuItems(callback, items) {
        if (!items) {
            var itemObj = Web.Menu.Nodes,
                propName;
            for (propName in itemObj)
                items = itemObj[propName];
        }
        $(items).each(function () {
            var item = this;
            if (callback.apply(item) == false)
                return false;
            if (item.children)
                if (!iterateMenuItems(callback, item.children))
                    return false;
        });
        return true;
    }

    function hasAccessToMembership() {
        var result = false;
        iterateMenuItems(function () {
            if (this.url && this.url.match(/\/membership(\.aspx)?$/i)) {
                result = true;
                return false;
            }
        });
        return result;
    }

    function closeHoverMonitorInstance() {
        var monitor = _web.HoverMonitor,
            instance = monitor && monitor._instance;
        if (instance)
            instance.close();
    }

    function kiosk() {
        return _touch && _touch.kiosk();
    }

    function parseInteger(s) {
        return parseInt(s, 10);
    }

    function geolocationPostionChanged(position) {
        var coords = position.coords,
            wdvg = _app.Geo = { latitude: coords.latitude, longitude: coords.longitude, acquired: true },
            coordFieldValue = null, i = 0,
            geoQueue = _app.GeoQueue,
            dataView, field;
        while (i < geoQueue.length) {
            dataView = findDataView(geoQueue[i].dv);
            if (dataView == null || dataView._geoCookie !== geoQueue[i].cookie)
                geoQueue.splice(i, 1);
            else if (!dataView._busy()) {
                field = dataView.findField(geoQueue[i].field);
                if (field.tagged('modified-latitude', 'created-latitude'))
                    coordFieldValue = wdvg.latitude;
                else if (field.tagged('modified-longitude', 'created-longitude'))
                    coordFieldValue = wdvg.longitude;
                else
                    coordFieldValue = wdvg.latitude + ',' + wdvg.longitude;
                if (dataView.editing())
                    try {
                        if (_touch)
                            _app.input.execute({ dataView: dataView, values: [{ Name: field.Name, NewValue: coordFieldValue }], raiseCalculate: false });
                        else
                            dataView._updateCalculatedFields(result);
                    }
                    catch (ex) {
                        if (_touch)
                            _touch.notify('Unable to update geolocation.');
                    }
                i++;
            }
        }
        if (!geoQueue.length && _locationWatchId) {
            _geolocation.clearWatch(_locationWatchId);
            _locationWatchId = null;
        }
    }

    function injectNullValue(field, lov) {
        lov.splice(0, 0, [null, field.tagged('lookup-null-value-any') ? resourcesData.AnyValue : field.tagged('lookup-null-value-placeholder') ? field.Watermark : labelNullValueInForms]);
    }

    _web.DataViewMode = { View: 'View', Lookup: 'Lookup' };
    _web.DynamicExpressionScope = { Field: 0, ViewRowStyle: 1, CategoryVisibility: 2, DataFieldVisibility: 3, DefaultValues: 4, ReadOnly: 5, Rule: 6 };
    _web.AutoHideMode = { Nothing: 0, Self: 1, Container: 2 };
    _web.DynamicExpressionType = { RegularExpression: 0, ClientScript: 1, ServerExpression: 2, CSharp: 3, VisualBasic: 4, Any: 4 };
    _web.DataViewAggregates = ['None', 'Sum', 'Count', 'Avg', 'Max', 'Min'];
    _web.FieldSearchMode = { Default: 0, Required: 1, Suggested: 2, Allowed: 3, Forbidden: 4 };

    _Sys_StringBuilder.prototype.appendFormat = function (fmt, args) {
        this.append(String._toFormattedString(false, arguments));
    };

    var isNullOrEmpty = String.isNullOrEmpty = function (s) {
        return s == null || !s.length;
    };

    var isBlank = String.isBlank = function (s) {
        return s == null || typeof s == 'string' && s.match(_app._blankRegex) != null;
    };

    String._wordTrimRegex = /(\S{16})\S+/g;
    String._tagRegex = /<\/?\w.*?>/g;

    String.trimLongWords = function (s, maxLength) {
        if (s == null)
            return s;
        var re = this._wordTrimRegex;
        if (maxLength != null)
            re = new RegExp(String.format('(\\S{{{0}}})\\S+', maxLength), 'g');
        var result = s.replace(re, '$1...');
        if (s.match(String._tagRegex)) {
            var sb = new _Sys_StringBuilder();
            var iterator = String._tagRegex;
            var m = iterator.exec(s);
            var lastIndex = 0;
            while (m) {
                tag = m[0];
                if (m.index > 0)
                    sb.append(s.substring(lastIndex, m.index).replace(re, '$1...'));
                lastIndex = m.index + tag.length;
                sb.append(tag);
                m = iterator.exec(s);
            }
            if (lastIndex < s.length)
                sb.append(s.substring(lastIndex));
            result = sb.toString();

        }
        return result;
    };

    String.htmlEncode = function (s) {
        return typeof s == 'string' && s.match(_app._htmlTest) ? s : _app.htmlEncode(s);
    };

    String.isJavaScriptNull = function (s) {
        return s === '%js%null' || s === 'null';
    };

    String.jsNull = '%js%null';

    _web.DataView = function (element) {
        var that = this;
        _app.initializeBase(that, [element]);
        that._controller = null;
        that._viewId = null;
        that._servicePath = null;
        that._baseUrl = null;
        that._pageIndex = -1;
        that._pageSize = resourcesPager.PageSizes[0];
        that._sortExpression = null;
        that._filter = [];
        that._externalFilter = [];
        that._categories = null;
        that._fields = null;
        that._allFields = null;
        that._rows = null;
        that._totalRowCount = 0;
        that._firstPageButtonIndex = 0;
        that._pageCount = 0;
        that._views = [];
        that._actionGroups = [];
        that._selectedKey = [];
        that._selectedKeyFilter = [];
        that._lastCommandName = null;
        that._lastViewId = null;
        that._lookupField = null;
        that._filterFields = null;
        that._filterSource = null;
        that._mode = Web.DataViewMode.View;
        that._lookupPostBackExpression = null;
        that._domFilterSource = null;
        that._selectedKeyList = [];
        that._pageSizes = resourcesPager.PageSizes;
    };

    var _app = Web.DataView;
    _app.cache = {};
    _app.functions = {};

    _app.syncMap = {
        notify: function (controller) {
            var syncMap = this[controller],
                key
            if (syncMap)
                for (key in syncMap)
                    syncMap[key] = true;
        }
    };

    _app.rules = {};
    _window.$app = _window.$appfactory = _app;

    _app.html = {
        tag: htmlTag,
        div: div,
        span: span,
        $tag: $htmlTag,
        $p: $p,
        $div: $div,
        $span: $span,
        $a: $a,
        $i: $i,
        $li: $li,
        $ul: $ul
    };

    RegExp.escape = function (s) {
        return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    };

    _app._blankRegex = /^\s*$/;
    _app._fieldMapRegex = /(\w+)\s*=\s*(\w+)/g;
    _app._fieldFilterRegex = /([\w.,]+):([\s\S]*)/;
    _app._filterRegex = /(\*|~|\$\w+\$|=|~|>=?|<(=|>){0,1})([\s\S]*?)(\0|$)$/;
    _app._filterIteratorRegex = /(\*|~|\$\w+\$|=|~|>=?|<(=|>){0,1})([\s\S]*?)(\0|$)/g;
    _app._keepCapitalization = /^\$(month|quarter|true|false)/;
    _app._listRegex = /\$and\$|\$or\$/;
    _app._simpleListRegex = /\s*,\s*/;
    _app._htmlTest = /<\w+.*?>|&#?\w+;/;
    _app._numericTypeRegex = /^(Byte|Currency|Decimal|Double|Int\d+|Single|SByte|UInt\d+)$/;


    if (!Array.isArray)
        Array.isArray = function (arg) {
            return Object.prototype.toString.call(arg) === '[object Array]';
        };

    _app.cssToIcon = function (cssClass) {
        var icon = cssClass && cssClass.match(/glyphicon-([\w-]+)/);
        if (icon)
            return 'glyphicon ' + icon[0];
        return cssClass;
    };

    _app.toHexString = function (v) {
        if (v) {
            var hexValue = ['0x'];
            if (!Array.isArray(v))
                v = v.toString().split(_app._simpleListRegex);
            $(v).each(function () {
                hexValue.push(parseInt(this).toString(16));
            });

            v = hexValue.join('');
        }
        return v;
    };

    _app.online = function () { return navigator.onLine === true; };

    _app.htmlEncode = function (s) { if (s != null && typeof s != 'string') s = s.toString(); return s ? s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : s; };

    _app.htmlToText = function (html) {
        var converter = _app._htmlConverter;
        if (!converter)
            converter = _app._htmlConverter = $p();
        return converter.html(html.replace(/></g, '> <')).text();
    };

    _app.toAjaxData = function (data) {
        return _app.htmlEncode(jsonStringify(data));
    };

    _app.htmlAttributeEncode = function (s) { return s != null && typeof s == 'string' ? s.replace(/\x27/g, '&#39;').replace(/\x22/g, '&quot;') : s; };

    _app.pageVar = function (name, value) {
        var pathname = location.pathname;
        if (_host) {
            var m = pathname.match(/apps\/(.+?)\/(.+?)(\.html)?$/);
            if (m)
                pathname = m[2];
        }
        name = pathname.replace(/\W/g, '_').toLowerCase() + '_' + name;
        if (arguments.length === 1)
            return _app.userVar(name);
        else
            _app.userVar(name, value);
    };

    _app.sessionVar = function (name, value) {
        try {
            if (arguments.length === 1)
                return JSON.parse(sessionStorage.getItem(name));
            else
                sessionStorage.setItem(name, jsonStringify(value));
        }
        catch (ex) {
            // ignore errors
        }
    };

    _app.userVar = function (name, value) {
        if (!userScope)
            userScope = __settings.appInfo.replace(/\W/g, '_');
        if (!_host)
            name = userScope + '_' + name;
        if (arguments.length === 1) {
            try {
                value = _app.storage.get(name);//localStorage[name];
                if (value != null)
                    value = JSON.parse(value);
                return value;
            }
            catch (ex) {
                // do nothing
            }
            return null;
        }
        if (value == null)
            //localStorage.removeItem(name);
            _app.storage.remove(name);
        else
            try {
                //localStorage[name] = jsonStringify(value);
                _app.storage.set(name, jsonStringify(value));
            }
            catch (ex) {
                // ignore local storage errors
                // iOS Safari will raise an exception here if PRIVATE browsing mode is enabled.
            }
    };

    _app.isIE6 = sysBrowser.agent == sysBrowser.InternetExplorer && sysBrowser.version < 7;
    _app.agent = {};

    function getBoundingClientRect(elem) {
        if (elem instanceof jQuery)
            elem = elem[0];
        return elem ? elem.getBoundingClientRect() : { width: 0, height: 0 };
    }

    function elementAt(p) {
        var argList = arguments,
            argCount = argList.length;
        if (!argCount)
            p = _touch.lastTouch();
        else if (argCount === 2)
            p = { 'x': argList[0], 'y': argList[1] };
        return $(document.elementFromPoint(p.x, p.y));
    }

    _app.clientRect = getBoundingClientRect;
    _app.elementAt = elementAt;



    _app.getScript = function (url, options) {
        var callback,
            also = options.also,
            head,
            script,
            resourceElem,
            countDown = 1,
            isJavaScript,
            conditionalMinRegex = /\[min\]\./;

        function resolve() {
            countDown--;
            if (countDown <= 0) {
                script.forEach(function (func) {
                    func();
                });
                _scripts[url] = true;
            }
        }

        function resolveAlso() {
            countDown--;
            if (countDown <= 0)
                resolve();
        }

        callback = typeof options == 'function' ? options : options.then;

        if (!url.match(/\.(js|css)$/))
            url = url + '.' + _app.jsExt();
        if (url.match(conditionalMinRegex))
            url = _app.jsExt().match(/^js/) ? url.replace(conditionalMinRegex, '') : url.replace(conditionalMinRegex, 'min.');
        url = _app.resolveClientUrl(url);
        script = _scripts[url];
        if (script == null && $('script[src="' + url + '"]').length)
            script = _scripts[url] = true;
        if (script === true)
            callback();
        else if (script != null)
            script.push(callback);
        else {
            script = _scripts[url] = [callback];

            if (also) {
                if (!Array.isArray(also))
                    also = [also];
                if (!_app.agent.ie)
                    countDown += also.length;
                also.forEach(function (prerequisite) {
                    _app.getScript(prerequisite, resolveAlso);
                });
            }

            isJavaScript = url.match(/\.js(\?|$)/);
            head = document.head;
            if (head.append && !_app.host) {
                if (isJavaScript) {
                    resourceElem = document.createElement('script');
                    resourceElem.src = url;
                }
                else {
                    resourceElem = document.createElement('link');
                    resourceElem.href = url;
                    resourceElem.rel = 'stylesheet';
                }
                resourceElem.onload = resolve;
                head.append(resourceElem);
            }
            else
                if (isJavaScript)
                    $.ajax({
                        type: 'GET',
                        dataType: 'script',
                        cache: true,
                        url: url
                    })
                        .then(resolve);
                else
                    $htmlTag('link', '', 'href="' + url + '" rel="stylesheet" ').appendTo('head');
        }
    };

    _app.prototype = {
        get_controller: function () {
            return this._controller;
        },
        set_controller: function (value) {
            this._controller = value;
        },
        useCase: function (name) {
            return this.get_useCase() === name;
        },
        get_useCase: function () {
            return this._useCase;
        },
        set_useCase: function (value) {
            this._useCase = value;
        },
        get_survey: function () {
            return this._survey;
        },
        set_survey: function (value) {
            this._survey = value;
        },
        get_viewId: function () {
            var that = this,
                viewId = that._viewId,
                views = that._views;
            if (!viewId && views.length > 0)
                viewId = that._viewId = views[0].Id;
            return viewId || '';
        },
        set_viewId: function (value) {
            this._viewId = value;
        },
        get_newViewId: function () {
            return this._newViewId;
        },
        set_newViewId: function (value) {
            this._newViewId = value;
        },
        get_servicePath: function () {
            if (!appServicePath)
                appServicePath = _window.__servicePath;
            return this._servicePath || (typeof appServicePath == 'string' ? appServicePath : '');
        },
        set_servicePath: function set_servicePath(value) {
            this._servicePath = this.resolveClientUrl(value);
            if (!_app._servicePath) _app._servicePath = value;
        },
        get_baseUrl: function () {
            if (!appBaseUrl)
                appBaseUrl = _window.__baseUrl;
            return this._baseUrl || (typeof appBaseUrl == 'string' ? appBaseUrl : '');
        },
        set_baseUrl: function (value) {
            if (value === '~') value = '/';
            this._baseUrl = value;
            if (!_app._baseUrl) _app._baseUrl = value;
        },
        get_siteUrl: function () {
            var servicePath = this.get_servicePath();
            var m = servicePath.match(/(^.+?\/)\w+\/\w+\.asmx/);
            if (!m)
                m = servicePath.match(/(^.+?\/)appservices\/_invoke$/);
            return m ? m[1] : '';
        },
        resolveClientUrl: function (url) {
            return _app.resolveClientUrl(url, this.get_baseUrl());
        },
        get_hideExternalFilterFields: function () {
            return this._hideExternalFilterFields != false;
        },
        set_hideExternalFilterFields: function (value) {
            this._hideExternalFilterFields = value;
        },
        get_backOnCancel: function () {
            return this._backOnCancel == true;
        },
        set_backOnCancel: function (value) {
            this._backOnCancel = value;
        },
        get_confirmContext: function () {
            return this._confirmContext;
        },
        set_confirmContext: function (value) {
            this._confirmContext = value;
        },
        get_startPage: function () {
            return this._startPage;
        },
        set_startPage: function (value) {
            this._startPage = value;
        },
        get_startCommandName: function () {
            return this._startCommandName;
        },
        set_startCommandName: function (value) {
            this._startCommandName = value;
        },
        get_startCommandArgument: function () {
            return this._startCommandArgument;
        },
        set_startCommandArgument: function (value) {
            this._startCommandArgument = value;
        },
        get_exitModalStateCommands: function () {
            return this._exitModalStateCommands;
        },
        set_exitModalStateCommands: function (value) {
            this._exitModalStateCommands = value;
        },
        get_showActionBar: function () {
            var extension = this.extension();
            if (extension) {
                var options = extension.options();
                if (options.actionBar != null)
                    return options.actionBar == true;
            }
            return this._showActionBar != false;
        },
        set_showActionBar: function (value) {
            this._showActionBar = value;
        },
        get_showActionButtons: function () {
            var buttonLocation = this._showActionButtons;
            if (!buttonLocation) {
                buttonLocation = _touch ? 'Auto' : 'TopAndBottom';
                this._showActionButtons = buttonLocation;
            }
            return buttonLocation;
        },
        set_showActionButtons: function (value) {
            this._showActionButtons = value;
        },
        get_showSearchBar: function () {
            return this._showSearchBar == true && !(__tf != 4);
        },
        set_showSearchBar: function (value) {
            this._showSearchBar = value;
        },
        get_searchOnStart: function () {
            if (kiosk())
                this._searchOnStart = false;
            return this._searchOnStart === true;
        },
        set_searchOnStart: function (value) {
            this._searchOnStart = value;
            if (value) this.set_searchBarIsVisible(true);
        },
        get_searchBarIsVisible: function () {
            return this._searchBarIsVisible == true;
        },
        set_searchBarIsVisible: function (value) {
            this._searchBarIsVisible = value;
        },
        get_showModalForms: function () {
            return true;
        },
        set_showModalForms: function (value) {
        },
        get_showDescription: function () {
            var extension = this.extension();
            if (extension) {
                var options = extension.options();
                return options.description == true;
            }
            return this._showDescription != false;
        },
        set_showDescription: function (value) {
            this._showDescription = value;
        },
        get_showFirstLetters: function () {
            return this._showFirstLetters == true;
        },
        set_showFirstLetters: function (value) {
            this._showFirstLetters = value;
        },
        get_autoSelectFirstRow: function () {
            return this._autoSelectFirstRow == true;
        },
        set_autoSelectFirstRow: function (value) {
            this._autoSelectFirstRow = value;
        },
        get_autoHighlightFirstRow: function () {
            return this._autoHighlightFirstRow == true;
        },
        set_autoHighlightFirstRow: function (value) {
            this._autoHighlightFirstRow = value;
        },
        get_refreshInterval: function () {
            return this._refreshInterval;
        },
        set_refreshInterval: function (value) {
            this._refreshInterval = value;
        },
        get_showViewSelector: function () {
            return this._showViewSelector != false;
        },
        set_showViewSelector: function (value) {
            this._showViewSelector = value;
        },
        get_showPager: function () {
            var pagerLocation = this._showPager;
            if (pagerLocation == null || pagerLocation == true) {
                pagerLocation = 'Bottom';
                this._showPager = pagerLocation;
            }
            else if (pagerLocation == false)
                pagerLocation = 'None';
            return pagerLocation;
        },
        set_showPager: function (value) {
            this._showPager = value;
        },
        get_showPageSize: function () {
            return this._showPageSize != false;
        },
        set_showPageSize: function (value) {
            this._showPageSize = value;
        },
        get_selectionMode: function () {
            return this._selectionMode;
        },
        set_selectionMode: function (value) {
            this._selectionMode = value;
        },
        multiSelect: function (value) {
            var that = this,
                result = that._multiSelect,
                selectionMode;
            if (arguments.length) {
                that._multiSelect = value;
                if (_touch)
                    that.pageProp('selectionMode', value ? 'Multiple' : 'Single');
            }
            else {
                if (result == null) {
                    selectionMode = _touch && that.pageProp('selectionMode');
                    result = that._multiSelect = (selectionMode || that._selectionMode) == 'Multiple';
                }
                return result;
            }
        },
        //get_cookie: function () {
        //    if (!this._cookie)
        //        this._cookie = this._id + 'cookie';
        //    return this._cookie;
        //},
        get_pagerButtonCount: function (refresh) {
            if (!this._pagerButtonCount || refresh) {
                var buttonCount = resourcesPager.PageButtonCount;
                if (this.get_pageCount() > buttonCount) {
                    buttonCount = buttonCount - 3;
                    if (buttonCount < 5)
                        buttonCount = 5;
                }
                this._pagerButtonCount = buttonCount;
            }
            return this._pagerButtonCount;
        },
        get_pageIndex: function () {
            return this._pageIndex;
        },
        set_pageIndex: function (value) {
            this._pageIndex = value;
            if (value >= 0) {
                var buttonCount = this.get_pagerButtonCount();
                if (value >= this._firstPageButtonIndex + buttonCount)
                    this._firstPageButtonIndex = value;
                else if (value < this._firstPageButtonIndex) {
                    this._firstPageButtonIndex -= buttonCount;
                    if (value < this._firstPageButtonIndex)
                        this._firstPageButtonIndex = value;
                }
                if (this._firstPageButtonIndex < 0)
                    this._firstPageButtonIndex = 0;
                if (this.get_pageCount() - this._firstPageButtonIndex < buttonCount)
                    this._firstPageButtonIndex = this.get_pageCount() - buttonCount;
                if (this._firstPageButtonIndex < 0)
                    this._firstPageButtonIndex = 0;
            }
            if (value === -2)
                this._pageOffset = 0;
        },
        get_pageOffset: function () {
            if (!this.get_isDataSheet())
                return 0;
            return this._pageOffset == null ? 0 : this._pageOffset;
        },
        set_pageOffset: function (value) {
            this._pageOffset = value;

        },
        get_categoryTabIndex: function () {
            return this._categoryTabIndex;
        },
        set_categoryTabIndex: function (value) {
        },
        get_enabled: function () {
            return this._enabled == null ? true : this._enabled;
        },
        set_enabled: function (value) {
            this._enabled = value;
        },
        get_showInSummary: function () {
            return this._showInSummary;
        },
        set_showInSummary: function (value) {
            this._showInSummary = value;
        },
        get_summaryFieldCount: function () {
            return this._summaryFieldCount;
        },
        set_summaryFieldCount: function (value) {
            this._summaryFieldCount = value;
        },
        get_showLEVs: function () {
            return this._showLEVs;
        },
        set_showLEVs: function (value) {
            this._showLEVs = value;
        },
        get_tags: function () {
            return this._tag;
        },
        set_tags: function (value) {
            this._tag = value;
        },
        get_tag: function () {
            return this._tag;
        },
        set_tag: function (value) {
            this._tag = value;
            this._tagList = null;
        },
        get_pageSize: function () {
            return this._pageSize;
        },
        set_pageSize: function (value) {
            this._pagerSize = value;
            this._pageSize = value;
            this._pageOffset = 0;
            delete this._viewColumnSettings;
            if (Array.indexOf(this._pageSizes, value) === -1) {
                this._pageSizes = Array.clone(this._pageSizes);
                Array.insert(this._pageSizes, 0, value);
            }
            //        if (this._fields != null) {
            //            this.set_pageIndex(-2);
            //            this._loadPage();
            //        }
            if (this._fields != null)
                this.refreshData();
        },
        get_groupExpression: function () {
            return this._groupExpression;
        },
        set_groupExpression: function (value) {
            this._groupExpression = value;
            this._checkedSortGroup = false;
        },
        get_sortExpression: function () {
            var sort = this._sortExpression,
                sortBy,
                groupBy = this._groupExpression,
                i = 0,
                groupField, sortField;
            if (!this._checkedSortGroup && groupBy) {
                if (!sort)
                    sort = '';
                this._checkedSortGroup = true;
                groupBy = groupBy.trim().split(_app._simpleListRegex);
                sortBy = sort.trim().split(_app._simpleListRegex);
                while (i < groupBy.length) {
                    groupField = groupBy[i];
                    if (i < sortBy.length) {
                        sortField = sortBy[i].split(/\s+/);
                        if (groupField !== sortField[0])
                            sortBy.splice(i, 0, groupField);
                    }
                    else
                        sortBy.splice(i, 0, groupField);
                    i++;
                }
                sort = sortBy.join(',');
                if (sort.match(/,$/))
                    sort = sort.substring(0, sort.length - 1);
                this._sortExpression = sort;
            }
            return sort;
        },
        set_sortExpression: function (value) {
            this._checkedSortGroup = false;
            if (!value || !value.length)
                this._sortExpression = null;
            else {
                var expression = value.match(/^(\w+)\s*((asc|desc)|$)/i);
                if (expression && !expression[2].length)
                    if (isNullOrEmpty(this._sortExpression) || this._sortExpression.match(/^(\w+)\s*/)[1] !== expression[1])
                        this._sortExpression = value + ' asc';
                    else if (this._sortExpression.endsWith(' asc'))
                        this._sortExpression = value + ' desc';
                    else
                        this._sortExpression = value + ' asc';
                else
                    this._sortExpression = value;
            }
        },
        set_id: function (value) {
            if (!this._id)
                this._id = value;
        },
        //get_appId: function () {
        //    return this._id;
        //},
        //set_appId: function (value) {
        //    if (_touch)
        //        this._id = value;
        //},
        //get_appFilterSource: function () {
        //    return this._filterSource;
        //},
        //set_appFilterSource: function (value) {
        //    if (_touch)
        //        this._filterSource = value;
        //},
        get_filterSource: function () {
            return this._filterSource;
        },
        set_filterSource: function (value) {
            if (!this._filterSource)
                this._filterSource = value;
        },
        get_filterFields: function () {
            return this._filterFields;
        },
        set_filterFields: function (value) {
            this._filterFields = value;
        },
        get_visibleWhen: function () {
            return this._visibleWhen;
        },
        set_visibleWhen: function (value) {
            this._visibleWhen = value;
        },
        get_showQuickFind: function () {
            return this._showQuickFind != false;
        },
        get_quickFindText: function () {
            return isNullOrEmpty(this._quickFindText) ? resourcesGrid.QuickFindText : this._quickFindText;
        },
        set_quickFindText: function (value) {
            this._quickFindText = value;
        },
        get_quickFindElement: function () {
            return $get(this.get_id() + '_QuickFind');
        },
        set_showQuickFind: function (value) {
            this._showQuickFind = value;
        },
        get_showRowNumber: function () {
            return this._showRowNumber === true;
        },
        set_showRowNumber: function (value) {
            this._showRowNumber = value;
        },
        get_filter: function () {
            var that = this;
            if (that.get_lookupField() == null && (that.get_pageIndex() == -1 && !that._allFields || that._externalFilter.length > 0 && !that._filter.length)) {
                if (that.get_domFilterSource()) {
                    that._externalFilter = [];
                    var fieldNames = that.get_filterFields().split(_app._simpleListRegex),
                        fieldValues = that.get_domFilterSource().value.split(_app._simpleListRegex),
                        i;
                    for (i = 0; i < fieldNames.length; i++)
                        Array.add(that._externalFilter, { Name: fieldNames[i], Value: fieldValues[i] });
                }
                else {
                    var params = _app._commandLine.match(/\?([\s\S]+)/);
                    if (params && (that.get_filterSource() != 'None' && that.get_filterSource() == null) && !that.get_useCase()) {
                        that._externalFilter = [];
                        var iterator = /(\w+)=([\S\s]*?)(&|$)/g,
                            m = iterator.exec(params[1]);
                        while (m) {
                            if (m[1] != 'ReturnUrl') Array.add(that._externalFilter, { Name: m[1], Value: m[2].length == 0 ? String.jsNull : decodeURIComponent(m[2]) });
                            m = iterator.exec(params[1]);
                        }
                    }
                }
                that.applyExternalFilter(that.get_isModal() || (_touch || that.useCase('$app')) && that._filter);
            }
            else if (that.get_filterSource() == 'Context' && that._externalFilter.length > 0)
                that.applyExternalFilter(true);
            if (that._startupFilter) {
                if (that.readContext('disableStartFilter') != true) {
                    Array.addRange(that._filter, that._startupFilter);
                    that.writeContext('disableStartFilter', true);
                }
                that._startupFilter = null;
            }
            return that._filter;
        },
        set_filter: function (value) {
            this._filter = value;
        },
        get_startupFilter: function () {
            return this._startupFilter;
        },
        set_startupFilter: function (value) {
            this._startupFilter = value;
        },
        get_externalFilter: function () {
            return this._externalFilter;
        },
        set_externalFilter: function (value) {
            this._externalFilter = value ? value : [];
        },
        get_ditto: function () {
            return this._ditto;
        },
        set_ditto: function (value) {
            this._ditto = value;
        },
        get_modalAnchor: function () {
            return this._modalAnchor;
        },
        set_modalAnchor: function (value) {
            this._modalAnchor = value;
        },
        get_description: function () {
            return this._description;
        },
        set_description: function (value) {
            this._description = value;
        },
        get_isModal: function () {
            return this._modalPopup != null || this._isModal;
        },
        get_categories: function () {
            return this._categories;
        },
        get_fields: function () {
            return this._fields;
        },
        get_rows: function () {
            return this._rows;
        },
        data: function (type) {
            var that = this,
                result;

            function filterToData(dataView) {
                var data = {},
                    matchCount = 0,
                    filter = type === 'filter' ? dataView._filter : (type === 'combined' ? dataView.combinedFilter() : dataView._combinedFilter([]));
                if (filter)
                    filter.forEach(function (fd) {
                        var m = fd.match(/(.+?)\:(=|<>|>=|<=|>|<|(\$\w+\$))(.*?)\0?$/),
                            fieldName, field, operator, value;
                        if (m) {
                            fieldName = m[1];
                            operator = m[2];
                            value = m[4];
                            if (fieldName === '_match_' || fieldName === '_donotmatch_')
                                data['_Match' + (++matchCount).toString()] = (fieldName === '_match_' ? '$match' : '$donotmatch') + operator.substring(1, 4);
                            else {
                                field = dataView.findField(fieldName);
                                if (operator.match(/\$$/))
                                    operator = operator.substring(0, operator.length - 1);
                                if (matchCount > 0)
                                    fieldName = '_Match' + matchCount.toString() + '_' + fieldName;
                                if (operator.match(/^\$(month|quarter)\d+$/i)) {
                                    data[fieldName + '_op2'] = operator;
                                    data[fieldName + '_op'] = 'all-dates-in-period';
                                }
                                else
                                    data[fieldName + '_op'] = operator;
                                if (value) {
                                    value = value.split(/\$and\$|\$or\$/g);
                                    value.forEach(function (v, index) {
                                        value[index] = dataView.convertStringToFieldValue(field, v);
                                    });
                                    data[fieldName] = value[0];
                                    if (operator === '$between')
                                        data[fieldName + '_v2'] = value[1];
                                    else if (value.length > 1)
                                        data[fieldName] = value;
                                }
                            }
                        }
                        else if (fd.match(/^_quickfind_:~/))
                            data['QuickFind'] = JSON.parse(fd.substring(17));
                    });
                return data;
            }

            if (type === 'master') {
                var master = that.get_master();
                result = master ? master.data() : null;
            }
            else if (type === 'context') {
                var parentDataView = that.get_parentDataView();
                result = parentDataView ? parentDataView.data() : null;
            }
            else if (type && type.match(/^(filter|search|combined)$/))
                result = filterToData(that);
            else if (type === 'parameters') {
                var paramObj;
                $(that._searchParamValues || []).each(function () {
                    var fv = this;
                    if (fv.Modified) {
                        if (!paramObj)
                            paramObj = {};
                        paramObj[fv.Name.substring(11)] = fv.NewValue;
                    }
                });
                result = paramObj;
            }
            else if (type === 'survey') {
                result = that._survey;
                result = result ? result.context : {};
            }
            else
                result = that.survey('data', type === 'modified');
            return result;
        },
        row: function () {
            return this.survey('row');
        },
        values: function () {
            return this.survey('values');
        },
        survey: function (method, includeModified) {
            var dataView = this,
                result = dataView._survey,
                pendingUploads = dataView._pendingUploads;
            if (method === 'row') {
                result = dataView.editRow();
                if (pendingUploads)
                    pendingUploads.forEach(function (upload) {
                        result[dataView.findField(upload.fieldName).Index] = upload.files;
                    });
            }
            else if (method === 'data') {
                var row = dataView.row(),
                    obj = includeModified ? { _modified: {} } : {},
                    allFields = dataView._allFields,
                    originalRow = dataView._originalRow;
                allFields.forEach(function (f) {
                    var index = f.Index,
                        name = f.Name,
                        value;
                    if (!(name === 'sys_pk_' || name === 'Status' && index === allFields.length - 1)) {
                        value = obj[name] = row[index];
                        if (includeModified && originalRow && originalRow[index] !== value)
                            obj._modified[name] = originalRow[index];
                    }
                });
                result = obj;
            }
            else if (method === 'values')
                result = dataView._collectFieldValues();
            return result;
        },
        changed: function () {
            var that = this, i, odp = that.odp,
                unchangedRow = that._unchangedRow,
                editRow = that._editRow,
                pendingUploads = that._pendingUploads,
                result;
            if (arguments.length > 0 && arguments[0] === 'ignore') {
                result = that.changed() || odp && odp.root(that) && odp.is(':dirty');
                if (arguments.length === 1)
                    return !result || (that.tagged('discard-changes-prompt-none') || that._ignoreUnsavedChanges);
                else
                    that._ignoreUnsavedChanges = arguments[1];
            }
            else
                if (that.editing())
                    if (pendingUploads && pendingUploads.length)
                        result = true;
                    else if (unchangedRow && that.editing())
                        for (i = 0; i < unchangedRow.length; i++) {
                            if (editRow[i] !== unchangedRow[i]) {
                                result = true;
                                break;
                            }
                        }
            return result;
        },
        editRow: function () {
            var that = this,
                master,
                //extension,
                filter,
                row = that._editRow,
                originalRow, masterRow;
            if (!row) {
                if (that.inserting()) {
                    row = (that._newRow || []).slice(0);
                    $(that._externalFilter).each(function () {
                        var fv = this,
                            field;
                        if (fv) {
                            field = that.findField(fv.name || fv.Name);
                            if (field && !(field.IsPrimaryKey && field.ReadOnly) && row[field.Index] == null)
                                row[field.Index] = fv.name ? fv.value : fv.Value;
                        }
                    });
                    master = that.get_master();
                    if (master) {
                        masterRow = master.editRow();
                        filter = that.get_externalFilter();

                        $(filter).each(function (index) {
                            var v = this,
                                useValue = true,
                                f = that.findField(v.Name),
                                mf;
                            if (f) {
                                if (f.ItemsDataValueField) {
                                    mf = master.findField(f.ItemsDataValueField);
                                    if (mf) {
                                        useValue = false;
                                        row[f.Index] = masterRow[mf.Index];
                                    }
                                }
                                if (f.Index !== f.AliasIndex && f.ItemsDataTextField) {
                                    mf = master.findField(f.ItemsDataTextField);
                                    if (mf)
                                        row[f.AliasIndex] = masterRow[mf.Index];
                                }
                                if (useValue)
                                    row[f.Index] = that.convertStringToFieldValue(f, v.Value); //typeof v.Value == 'string' ? that.convertStringToFieldValue(f, v.Value) : v.Value;
                            }

                        });
                    }
                    originalRow = [];
                    $(row).each(function (index) {
                        originalRow[index] = that._survey ? row[index] : null;
                    });
                }
                else {
                    //extension = that.extension();
                    //row = extension && extension.commandRow ? extension.commandRow() : [];
                    //if (!row)
                    //    row = [];
                    row = that.commandRow() || [];
                    originalRow = row.slice(0);
                }
                row = row.slice(0);
                if (that.get_isForm())
                    that._editRow = row;
                that._originalRow = originalRow;
            }
            return row;
        },
        headerField: function () {
            var dataView = this;
            headerField = dataView._headerField;
            if (!headerField)
                $(dataView._fields).each(function () {
                    var f = this;
                    if (!f.Hidden && !f.OnDemand) {
                        headerField = f;
                        return false;
                    }
                });
            if (headerField)
                headerField = dataView._allFields[headerField.AliasIndex];
            return headerField;
        },
        context: function (options) {
            var that = this,
                dv = that._filterSource ? findDataView(that._filterSource) : that.get_parentDataView(that),
                row, obj = {};
            if (arguments.length) {
                if (dv.get_isForm()) {
                    if (dv._survey)
                        return dv.survey(options);
                    row = dv.editRow();
                }
                else
                    row = dv.get_selectedRow();
                if (options === 'row')
                    return row;
                $(dv._allFields).each(function () {
                    var f = this;
                    obj[f.Name] = row[f.Index];
                });
                return obj;
            }
            else
                return dv;
        },
        originalRow: function () {
            return this._originalRow;
        },
        get_selectedRow: function () {
            var that = this,
                extension = that.extension();
            if (extension)
                return _touch ? that.row() : that._selectedRow;
            return that._rows ? that._rows[that._selectedRowIndex != null ? that._selectedRowIndex : 0] : [];
        },
        get_pageCount: function () {
            return this._pageCount;
        },
        get_aggregates: function () {
            return this._aggregates;
        },
        get_views: function () {
            return this._views;
        },
        actionGroups: function (scopeList) {
            var that = this,
                result = [],
                groupList = that._actionGroups,
                i, j, k,
                group, action, newGroup,
                scope;
            if (typeof scopeList == 'string')
                scopeList = [scopeList];
            for (k = 0; k < scopeList.length; k++) {
                scope = scopeList[k];
                for (i = 0; i < groupList.length; i++) {
                    group = groupList[i];
                    newGroup = null;
                    if (group.Scope == scope || group.Id == scope) {
                        for (j = 0; j < group.Actions.length; j++) {
                            action = group.Actions[j];
                            if (that._isActionAvailable(action)) {
                                if (!newGroup)
                                    result.push(newGroup = { Scope: group.Scope, HeaderText: group.HeaderText, Flat: group.Flat, Id: group.Id, Actions: [] });
                                newGroup.Actions.push(action);
                            }
                        }
                    }
                }
            }
            return result;
        },
        actions: function (scope) {
            var groups = this.actionGroups(scope);
            return groups.length ? groups[0].Actions : null;
        },
        get_actionGroups: function (scope, all) {
            var groups = [];
            for (var i = 0; i < this._actionGroups.length; i++) {
                if (this._actionGroups[i].Scope == scope) {
                    var group = this._actionGroups[i];
                    var current = all ? group : null;
                    if (!all) {
                        for (var j = 0; j < group.Actions.length; j++) {
                            if (this._isActionAvailable(group.Actions[j])) {
                                current = this._actionGroups[i]
                                break;
                            }
                        }
                    }
                    if (current) Array.add(groups, current);
                }
            }
            return groups;
        },
        get_actions: function (scope, all) {
            var result = [];
            for (var i = 0; i < this._actionGroups.length; i++)
                if (this._actionGroups[i].Scope == scope) {
                    var ag = this._actionGroups[i];
                    if (all)
                        Array.addRange(result, ag.Actions);
                    else
                        return ag.Actions;
                }
            return result;
        },
        get_action: function (path) {
            var id = path.split(/\//);
            for (var i = 0; i < this._actionGroups.length; i++) {
                var ag = this._actionGroups[i];
                if (ag.Id == id[0])
                    for (var j = 0; j < ag.Actions.length; j++) {
                        var a = ag.Actions[j];
                        if (a.Id == id[1])
                            return a;
                    }
            }
            return null;
        },
        get_selectedKey: function () {
            return this._selectedKey;
        },
        set_selectedKey: function (value) {
            this._selectedKey = value;
        },
        get_selectedKeyFilter: function () {
            return this._selectedKeyFilter;
        },
        set_selectedKeyFilter: function (value) {
            this._selectedKeyFilter = value;
        },
        _get_selectedValueElement: function () {
            var result = this._selectedValueElement;
            if (!result) {
                result = this._selectedValueElement = $(String.format('#{0}_{1}_SelectedValue', this.get_id(), this.get_controller()));
                //return $get(String.format('{0}$SelectedValue', this.get_id()));
            }
            return result.length ? result[0] : null;
        },
        get_selectedValue: function () {
            var selectedValue = this.readContext('SelectedValue');
            if (selectedValue)
                return selectedValue;
            var sv = this._get_selectedValueElement();
            return sv ? sv.value : '';
        },
        set_selectedValue: function (value) {
            if (this._hasSearchAction) return;
            this.writeContext('SelectedValue', value.toString());
            var selectedValue = this._get_selectedValueElement();
            if (selectedValue)
                selectedValue.value = value != null ? value : '';
        },
        get_keyRef: function () {
            var key = this.get_selectedKey();
            if (!key) return null;
            var ref = '';
            for (var i = 0; i < this._keyFields.length; i++) {
                if (i > 0) ref += '&';
                ref = String.format('{0}{1}={2}', ref, this._keyFields[i].Name, key[i]);
            }
            return ref;
        },
        get_showIcons: function () {
            return this._icons != null && this._lookupField == null || this.get_showRowNumber();
        },
        get_showMultipleSelection: function () {
            return this.multiSelect() && this._hasKey();
        },
        get_sysColCount: function () {
            var count = 0;
            if (this.get_showIcons())
                count++;
            if (this.get_showMultipleSelection())
                count++;
            if (this.get_isDataSheet())
                count++;
            return count;
        },
        _createRowKey: function (index) {
            var r = typeof index == 'number' ? this._rows[index] : arguments[0],
                v = '',
                i, f, kv;
            for (i = 0; i < this._keyFields.length; i++) {
                f = this._keyFields[i];
                if (v.length > 0) v += ',';
                kv = r[f.Index];
                v += kv == null ? 'null' : kv.toString()
            }
            return v;
        },
        batchEdit: function (commandArgument, result) {
            var that = this,
                view = commandArgument || that._viewId;

            function enumerateCascadeParents(f, list) {
                var context = f.ContextFields,
                    m, matches = [], f2;
                if (context) {
                    while (m = _app._fieldMapRegex.exec(context))
                        matches.push(m);
                    $(matches).each(function () {
                        var m = this;
                        f2 = fieldMap[m[2]];
                        if (f2 && !f2._depends) {
                            f2._depends = true;
                            list.push(f2);
                            enumerateCascadeParents(f2, list);
                        }
                    });
                }
            }

            if (!result)
                _app.execute({
                    controller: that._controller,
                    view: view,
                    requiresMetadata: true,
                    requiresData: false
                    //,
                    //success2: function (result) {
                    //    that.batchEdit(view, result);
                    //}
                }).done(function (result) {
                    that.batchEdit(view, result);
                });
            else {
                var batchEditNotAllowed = [],
                    batchEditAllowed = [],
                    editFields = [],
                    fieldQuestions = [
                    ],
                    survey = {
                        text: that.get_view().Label,
                        text2: resourcesActionsScopes.Grid.BatchEdit.HeaderText,// + ' (' + that._selectedKeyList.length + ')',
                        parent: that._id,
                        controller: that._id + '_' + view + '_BatchEdit',
                        context: { controller: that._controller, view: view },
                        topics: [
                            {
                                description: String.format(resourcesMobile.ItemsSelectedMany, that._selectedKeyList.length) + '. ' + String.format(resources.Views.DefaultCategoryDescriptions.$DefaultEditDescription, that.get_view().Label),
                                questions: fieldQuestions
                            }
                        ],
                        options: {
                            discardChangesPrompt: false,
                            materialIcon: 'edit'
                        },
                        submit: 'batcheditsubmit.dataview.app',
                        submitText: resourcesWhenLastCommandBatchEdit.HeaderText
                    };
                // enumerate batch-editable fields
                $(result.fields).each(function () {
                    var f = this,
                        tag = f.Tag;
                    if (!f.Hidden && !_field_isReadOnly.call(f) && !f.OnDemand && f.Type !== 'DataView') {
                        editFields.push(f);
                        if (tag)
                            if (tag.match(/\bbatch\-edit\-disabled\b/))
                                batchEditNotAllowed.push(f);
                            else if (tag.match(/\bbatch\-edit\b/))
                                batchEditAllowed.push(f);
                    }
                });
                if (batchEditAllowed.length)
                    editFields = batchEditAllowed;
                else if (batchEditNotAllowed.length) {
                    var i = 0;
                    while (i < editFields.length)
                        if (batchEditNotAllowed.indexOf(editFields[i]) !== -1)
                            editFields.splice(i, 1);
                        else
                            i++;
                }

                // continue with the configuration of the survey
                if (editFields.length) {
                    // build out a cascading dependency map
                    var fieldMap = {},
                        dependencyMap = {};

                    $(editFields).each(function () {
                        var f = this;
                        fieldMap[f.Name] = f;
                    });



                    $(editFields.slice(0).reverse()).each(function () {
                        var f = this,
                            list;
                        if (f.ContextFields && !f._depends) {
                            list = dependencyMap[f.Name] = [];
                            enumerateCascadeParents(f, list);
                            list = list.reverse();
                        }
                    });
                    //var row = that.row();
                    // create questions for each field
                    $(editFields).each(function () {
                        var f = this,
                            //targetField = that.findField(f.Name),
                            allowNulls = f.AllowNulls === true,
                            fieldName = f.Name,
                            visibleWhen = '$row.' + fieldName + '_BatchEdit==true',
                            qcb = { name: fieldName + '_BatchEdit', type: 'bool', value: false, required: !_touch, text: f.HeaderText || f.Label, items: { style: 'CheckBox' }, options: { lookup: { autoAdvance: true } } },
                            q = {
                                name: fieldName, type: f.Type, len: f.Len, placeholder: allowNulls ? resourcesValidator.Optional : resourcesValidator.Required, text: false, columns: f.Columns, rows: f.Rows,
                                visibleWhen: visibleWhen, extended: { allowNulls: allowNulls },
                                format: f.DataFormatString, context: f.ContextFields, options: { clearOnHide: true }
                            },
                            itemsStyle = f.ItemsStyle,
                            items = {},
                            itemsDataController = f.ItemsDataController,
                            itemsTargetController = f.ItemsTargetController,
                            itemsDataTextField = f.ItemsDataTextField;
                        if (itemsStyle) {
                            items.style = itemsStyle;
                            if (itemsDataController) {
                                items.controller = itemsDataController;
                                items.view = f.ItemsDataView;
                                items.dataValueField = f.ItemsDataValueField;
                                items.dataTextField = itemsDataTextField;
                                items.newView = f.ItemsNewDataView;
                                items.targetController = itemsTargetController;
                            }
                            else {
                                items.list = [];
                                $(f.Items).each(function () {
                                    var item = this;
                                    items.list.push({ value: item[0], text: item[1] });
                                });
                            }
                            q.items = items;
                            if (f.AliasName)
                                $(result.fields).each(function () {
                                    var af = this;
                                    if (af.Name === f.AliasName) {
                                        qcb.text = af.Label || af.HeaderText;
                                        q.altText = qcb.text;
                                        return false;
                                    }
                                });
                        }
                        if (itemsStyle || f.Type === 'Boolean')
                            q.options.lookup = {
                                nullValue: false
                            };
                        if (f._depends) {
                            q.placeholder = qcb.text;
                            f._question = q;
                        }
                        else
                            fieldQuestions.push(qcb, q);
                        if (itemsTargetController)
                            fieldQuestions.push({
                                name: fieldName + '_BatchKeep', type: 'bool', value: true, text: false, required: true,
                                items: { style: 'DropDownList', list: [{ value: true, text: resourcesData.KeepOriginalSel }, { value: false, text: resourcesData.DeleteOriginalSel }] },
                                visibleWhen: visibleWhen + ' && $row.' + fieldName + '!=null', options: {
                                    lookup: { openOnTap: true }
                                }
                            });
                        else if (itemsDataController) {
                            var copyField = that._allFields[f.AliasIndex],
                                qItemsCopy = q.items.copy = [],
                                copyMap = f.Copy, copyInfo;
                            if (copyField && copyField !== f && copyField.isReadOnly()) {
                                fieldQuestions.push({ name: copyField.Name, type: copyField.Type, readOnly: true, visibleWhen: false, text: false });
                                qItemsCopy.push({ from: itemsDataTextField, to: copyField.Name });
                            }
                            if (copyMap) {
                                copyInfo = _app._fieldMapRegex.exec(copyMap);
                                while (copyInfo) {
                                    copyField = that.findField(copyInfo[1]);
                                    if (copyField) {
                                        fieldQuestions.push({ name: copyField.Name, type: copyField.Type, readOnly: copyField.isReadOnly(), visibleWhen: visibleWhen + ' && $row.' + fieldName + '!=null' });
                                        qItemsCopy.push({ from: copyInfo[2], to: copyInfo[1] });
                                    }
                                    copyInfo = _app._fieldMapRegex.exec(copyMap);
                                }
                            }
                        }
                        //if (targetField)
                        //    q.value = row[targetField.Index];
                    });
                    // extend fields with cascading depedencies
                    i = 1;
                    while (i < fieldQuestions.length) {
                        var q = fieldQuestions[i],
                            dependency = dependencyMap[q.name];
                        if (dependency) {
                            q.placeholder = fieldQuestions[i - 1].text;
                            q.text = false;
                            q.extended.dependency = dependency;
                            $(dependency).each(function () {
                                var q2 = this._question;
                                q2.visibleWhen = q.visibleWhen;
                                q2.text = '';
                                fieldQuestions.splice(i++, 0, q2);
                            });
                        }
                        i += 2;
                    }
                    // show the batch edit survey
                    _app.survey(survey);
                }
            }
        },
        delayedRefresh: function (refresh, delay) {
            if (!delay)
                delay = 1000;
            if (refresh) {
                delete this._delayedRefreshTimer;
                if (!(this._isBusy || _app._navigated || _Sys_Application._disposing))
                    this.refresh(true);
            }
            else {
                if (this._delayedRefreshTimer)
                    clearTimeout(this._delayedRefreshTimer);
                var self = this;
                this._delayedRefreshTimer = setTimeout(function () {
                    self.delayedRefresh(true);
                }, delay);
            }
        },
        get_view: function (id) {
            if (!id) id = this.get_viewId();
            if (!this._view || this._view.Id !== id) {
                for (var i = 0; i < this._views.length; i++)
                    if (this._views[i].Id === id) {
                        this._view = this._views[i];
                        break;
                    }
            }
            return this._view;
        },
        get_viewType: function (id) {
            var view = this.get_view(id);
            if (this._viewTypes) {
                var t = this._viewTypes[view ? view.Id : id];
                if (t != null)
                    return t;
            }
            return view ? view.Type : null;
        },
        get_isGrid: function (id) {
            var type = this.get_viewType(id);
            return type === 'Grid' || type === 'DataSheet'/* || type == 'Tree'*/;
        },
        get_isForm: function (id) {
            var type = this.get_viewType(id);
            return type === 'Form';
        },
        get_isDataSheet: function (id) {
            var type = this.get_viewType(id);
            if (__tf !== 4) return false;
            if (this._viewTypes) {
                var t = this._viewTypes[this.get_viewId()];
                if (t != null)
                    type = t;
            }
            return type === 'DataSheet';
        },
        /*get_isTree: function (id) {
        var type = this.get_viewType(id);
        return type == 'Tree' && __tf == 4;
        },*/
        get_isChart: function () {
            return this.get_viewType() === 'Chart';
        },
        get_lastViewId: function () {
            return this._lastViewId;
        },
        set_lastViewId: function (value) {
            this._lastViewId = value;
        },
        get_lastCommandName: function () {
            return this._lastCommandName;
        },
        set_lastCommandName: function (value) {
            this._lastCommandName = value;
            this._lastCommandArgument = null;
            $closeHovers();
        },
        get_lastCommandArgument: function () {
            return this._lastCommandArgument;
        },
        set_lastCommandArgument: function (value) {
            this._lastCommandArgument = value;
        },
        get_isEditing: function () {
            return this.editing();
        },
        editing: function () {
            var that = this,
                lastCommandName = that._lastCommandName,
                editing = that._editing;
            return editing == null && (lastCommandName === 'Edit' || lastCommandName === 'New' || /*lastCommandName == 'BatchEdit' || */lastCommandName === 'Duplicate') || editing === true;
        },
        get_isInserting: function () {
            return this.inserting();
        },
        inserting: function () {
            var lastCommandName = this._lastCommandName;
            return lastCommandName === 'New' || lastCommandName === 'Duplicate';
        },
        get_lookupField: function () {
            return this.get_mode() === Web.DataViewMode.View ? this._lookupField : this._fields[0];
        },
        set_lookupField: function (value) {
            this._lookupField = value;
        },
        get_lookupContext: function () {
            var that = this,
                lc = that._lookupContext,
                f = that._lookupInfo ? that._lookupInfo.field : that.get_lookupField();
            return lc ? lc : (f ? { 'FieldName': f.Name, 'Controller': f._dataView.get_controller(), 'View': f._dataView.get_viewId() } : null);
        },
        get_mode: function () {
            return this._mode;
        },
        set_mode: function (value) {
            this._mode = value;
        },
        get_lookupValue: function () {
            return this._lookupValue;
        },
        set_lookupValue: function (value) {
            this._lookupValue = value;
        },
        get_lookupText: function () {
            return this._lookupText;
        },
        set_lookupText: function (value) {
            this._lookupText = value;
        },
        get_lookupPostBackExpression: function () {
            return this._lookupPostBackExpression;
        },
        set_lookupPostBackExpression: function (value) {
            this._lookupPostBackExpression = value;
        },
        get_domFilterSource: function () {
            return this._domFilterSource;
        },
        set_domFilterSource: function (value) {
            this._domFilterSource = value;
        },
        get_showDetailsInListMode: function () {
            return this._showDetailsInListMode != false;
        },
        set_showDetailsInListMode: function (value) {
            this._showDetailsInListMode = value;
        },
        get_autoHide: function () {
            return !isNullOrEmpty(this.get_visibleWhen()) && this._autoHide == Web.AutoHideMode.Nothing ?
                Web.AutoHideMode.Self :
                this._autoHide == null ? Web.AutoHideMode.Nothing : this._autoHide;
        },
        set_autoHide: function (value) {
            this._autoHide = value;
        },
        //get_transaction: function () {
        //    return this._transaction;
        //},
        initialize: function () {
            _app.callBaseMethod(this, 'initialize');
            this._filterSourceSelectedHandler = Function.createDelegate(this, this._filterSourceSelected);
        },
        dispose: function () {
            var that = this,
                survey = that._survey,
                odp = that.odp;
            that._disposePendingUploads();
            if (!_touch && !_Sys_Application._disposing) {
                $(that._element).find('iframe').remove();
                that._detachBehaviors();
            }
            if (that._container || _touch) {
                var extension = this.extension();
                if (extension && extension.dispose)
                    extension.dispose();
            }
            that._wsRequest = null;
            that._stopInputListener();
            that._disposeModalPopup();
            that._disposeFieldFilter();
            if (!_touch && !that._api) {
                that._disposeSearchBarExtenders();
                that._disposeImport();
            }
            that._disposeFields();
            that._lookupField = null;
            that._parentDataView = null;
            that._bodyKeydownHandler = null;
            that._filterSourceSelectedHandler = null;
            that._restoreEmbeddedViews();
            delete that._container;
            that._cancelCallback = null;
            that._doneCallback = null;
            if (survey) {
                for (var key in survey)
                    if (typeof survey[key] == 'function')
                        survey[key] = null;
                that._survey = null;
            }
            clearTimeout(that._valueChangedTimeout);
            if (odp && odp._dataView === that) {
                odp._data = null;
                odp._log = null;
                odp._dataLoadedKeys = null;
            }
            _app.callBaseMethod(that, 'dispose');
        },
        get_master: function () {
            var filterSource = this.get_filterSource();
            return filterSource ? _app.findDataView(filterSource) : null;
        },
        tag: function (tag) {
            if (tag) {
                this._tag = tag + ' ' + (this._tag || '').replace(/,/g, ' ').trim();
                this._tagList = null;
            }
        },
        untag: function (tag) {
            var that = this;
            if (that._tag) {
                that.get_isTagged('');
                var tagList = that._tagList,
                    index = Array.indexOf(tagList, tag);
                if (index >= 0)
                    tagList.splice(index, 1);
                that._tag = tagList.join(' ');
            }
            that._tagList = null;
        },
        get_isTagged: function (tag) {
            var that = this,
                tagList = that._tagList,
                tagMap = {};
            if (!tagList) {
                tagList = that._tag;
                if (tagList) {
                    tagList = that._tagList = tagList.split(/\s+|,/).filter(function (t) {
                        return t in tagMap ? false : tagMap[t] = true;
                    });
                }
            }
            return tagList && tagList.indexOf(tag) !== -1;
        },
        tagged: function (tags) {
            var that = this,
                isRegExp = tags.ignoreCase != null;
            if (arguments.length === 1)
                return (isRegExp || tags.match(/\-$/)) ? (that._tag || '').match(isRegExp ? tags : typeof new RegExp(tags)) : that.get_isTagged(tags);
            for (var i = 0; i < tags.length; i++)
                if (that.get_isTagged(tags[i]))
                    return true;
            return false;
        },
        updated: function () {
            _app.callBaseMethod(this, 'updated');
            if (!this._controller) return;
            if (this.get_servicePath().startsWith('http'))
                this.set_baseUrl(this.get_siteUrl());
            var selectedValue = this.get_selectedValue();
            if (selectedValue.length > 0) {
                if (!_touch) {
                    this.set_autoHighlightFirstRow(false);
                    this.set_autoSelectFirstRow(false);
                }
                if (this.multiSelect())
                    this._selectedKeyList = selectedValue.split(';');
                else {
                    this._selectedKey = selectedValue.split(',');
                    this._pendingSelectedEvent = true;
                }
            }
            if (!this._container && !_touch) {
                this.get_element().innerHTML = '';
                this._container = document.createElement('div');
                this.get_element().appendChild(this._container);
                $(this._container).addClass('DataViewContainer');
                var elementId = this._element.id;
                var idMatch = elementId.split(/_/);
                _Sys.UI.DomElement.addCssClass(this._container, idMatch ? idMatch[idMatch.length - 1] : elementId);
                if (!this.get_showActionBar())
                    $(this._container).addClass('ActionBarHidden');
                if (!this.get_showDescription())
                    $(this._container).addClass('DescriptionHidden');
            }
            if (this.get_filterSource() && this.get_filterSource() !== 'Context') {
                var source = this.get_master();
                if (source) {
                    this._hasParent = true;
                    source.add_selected(this._filterSourceSelectedHandler);
                    //if (this.get_transaction() == 'Supported')
                    //    if (!isNullOrEmpty(source.get_transaction())) {
                    //        this.set_transaction(source.get_transaction() != 'Supported' ? source.get_transaction() : null);
                    //        this._forceVisible = this.get_transaction() && source.inserting();
                    //    }
                    if (source._pendingSelectedEvent && !_touch) {
                        this._source = source;
                        var self = this;
                        this._afterUpdateTimerId = setInterval(function () {
                            self._afterUpdate();
                        }, 250);
                    }
                    else if (!this._forceVisible)
                        this._hidden = true;
                }
                else {
                    source = $get(this.get_filterSource());
                    if (source) $addHandler(source, 'change', this._filterSourceSelectedHandler);
                    this.set_domFilterSource(source);
                }
                if (!this._externalFilter.length)
                    this._createExternalFilter();
                if (!this._filter.length)
                    if (!this._source) this.applyExternalFilter();
            }
            else {
                this._hidden = !this._evaluateVisibility();
                if (this._hidden)
                    this._updateLayoutContainerVisibility(false);
            }
            //if (this.get_transaction() == 'Supported')
            //    this.set_transaction(null);
            if (!_touch && this.get_modalAnchor() && !this.get_isModal())
                this._initializeModalPopup();
            if (source != null && this.get_autoHide() != Web.AutoHideMode.Nothing)
                this._updateLayoutContainerVisibility(false);
            //if (this.get_startCommandName() == 'UseTransaction') {
            //    this._usesTransaction = true;
            //    this.set_startCommandName(null);
            //}
            //if (this.get_startCommandName() == 'DetectTransaction')
            //    if (!this.get_transaction()) {
            //        if (source && isInstanceOfType(_app, source)) {
            //            source.remove_selected(this._filterSourceSelectedHandler);
            //            clearInterval(this._afterUpdateTimerId);
            //        }
            //        return;
            //    }
            //    else
            //        this.set_startCommandName(null);
            var commandLine = (_app.get_commandLine() || '').replace(/#.+?$/, ''),
                command = commandLine.match(/_commandName=(.+?)&_commandArgument=(.*?)(&|$)/);
            if (!command)
                command = commandLine.match(/_command=(.+?)&_argument=(.*?)(&|$)/);
            if (command && (isNullOrEmpty(this.get_startCommandName()) || __designer()) && !this.get_filterSource() && !this.get_isModal() && !this.get_lookupField()) {
                var tc = commandLine.match(/_controller=(\w+)/);
                var tv = commandLine.match(/_view=(\w+)/);
                if ((!tc || tc[1] === this.get_controller()) && (!tv || tv[1] === this.get_view())) {
                    this._trySecondCommand = !isNullOrEmpty(tc);
                    this.set_startCommandName(command[1]);
                    this.set_startCommandArgument(command[2]);
                    if (!isNullOrEmpty(this._viewId)) this._replaceTriggerViewId = this._viewId;
                    //this._skipRender = true;
                    this._skipTriggeredView = true;
                    var syncKey = commandLine.match(/\b_sync=(.+?)(&|$)/);
                    if (syncKey)
                        this._syncKey = syncKey[1].split(',');
                }
                else if (!this._filterSource) {
                    this._visibleWhen = 'false';
                    this._updateLayoutContainerVisibility(false);
                }
            }
            if (this.useCase('$app'))
                return;
            if (this.get_startCommandName()) {
                this.set_searchOnStart(false);
                this.set_lastCommandName(this.get_startCommandName());
                this.set_lastCommandArgument(this.get_startCommandArgument());
                if (this.get_startCommandName().match(/New|Edit|Select/))
                    this.set_viewId(this.get_startCommandArgument());
                this.set_startCommandName(null);
                this.set_startCommandArgument(null);
                this._rows = [];
                if (!_touch && !this._survey)
                    this._loadPage();

            }
            else
                this.loadPage();
            if (_touch)
                this.mobileUpdated();
        },
        _afterUpdate: function () {
            if (this._delayedLoading && this._source._pendingSelectedEvent || this._source._isBusy) return;
            clearInterval(this._afterUpdateTimerId);
            var source = this._source;
            this._source = null;
            this._filterSourceSelected(source, _Sys.EventArgs.Empty, true);
        },
        _updateLayoutContainerVisibility: function (visible) {
            var that = this;
            that._hidden = !visible;
            if (visible && that._hiddenEcho) {
                that._hiddenEcho = false;
                $('.app-echo[data-for="' + that._id + '"]').show();
            }
        },
        loadPage: function (showWait) {
        },
        goToPage: function (pageIndex, absolute) {
            if (this._isBusy) return;
            if (absolute)
                this._pageOffset = 0;
            //if (this.get_isDataSheet())
            //    delete this._viewColumnSettings;
            this.set_pageIndex(pageIndex);
            this._loadPage();
        },
        sort: function (sortExpression) {
            if (this._isBusy) return;
            this._clearCache();
            if (this.get_sortExpression() === sortExpression) sortExpression = '';
            this.set_sortExpression(sortExpression);
            if (this.get_selectedKey().length > 0) {
                this._saveViewVitals();
                this._sync();
            }
            else {
                this.set_pageIndex(0);
                this._loadPage();
            }
        },
        groupExpression: function () {
            var groupExpression = this.get_groupExpression();
            if (groupExpression)
                return groupExpression.trim().split(_app._simpleListRegex);
            return null;
        },
        groupBy: function () {
            var that = this;
            $(that.groupExpression()).each(function () {
                var f = that.findField(this);
                if (f)
                    f.GroupBy = true;
            });
        },
        applyFilterByIndex: function (fieldIndex, valueIndex) {
            if (valueIndex == -1)
                this.removeFromFilterByIndex(fieldIndex);
            else {
                var filterField = this._allFields[fieldIndex];
                var field = this.findFieldUnderAlias(filterField);
                this.applyFilter(filterField, valueIndex >= 0 ? '=' : null, valueIndex >= 0 ? field._listOfValues[valueIndex] : null);
            }
        },
        findFieldUnderAlias: function (aliasField) {
            if (typeof aliasField == 'string')
                aliasField = this.findField(aliasField);
            if (aliasField.Hidden)
                //for (var i = 0; i < this._allFields.length; i++)
                //    if (this._allFields[i].AliasIndex == aliasField.Index) return this._allFields[i];
                return this._allFields[aliasField.OriginalIndex];
            return aliasField;
        },
        removeFromFilterByIndex: function (index) {
            if (index === -1)
                this.removeQuickFind();
            else {
                field = this._allFields[index];
                this.removeFromFilter(field);
            }
            this.sync();
        },
        removeQuickFind: function () {
            var that = this;
            $(that._filter).each(function (index) {
                if (this.match(/^_quickfind_\:\~/))
                    that._filter.splice(index, 1);
            });
        },
        removeFromFilter: function (field) {
            if (typeof field != 'string')
                field = field.Name;
            for (var i = 0; i < this._filter.length; i++) {
                if (this._filter[i].match(/^(\w+):/)[1] === field) {
                    Array.removeAt(this._filter, i);
                    break;
                }
            }
        },
        clearFilter: function (force) {
            var that = this;
            for (var i = 0; i < that._allFields.length; i++) {
                var f = that._allFields[i];
                //var af = this.findFieldUnderAlias(f);
                if (that.filterOf(f) != null && !that.filterIsExternal(f.Name))
                    that.removeFromFilter(f);
            }
            if (force) {
                var qfe = that.get_quickFindElement();
                if (qfe != null) {
                    qfe.value = '';
                    that.quickFind();
                }
                else {
                    that.set_quickFindText(null);
                    that._executeQuickFind(null);
                }
            }
            that._searchParamValues = null;
            that._searchParamFilterStatus = null;
        },
        beginFilter: function () {
            this._filtering = true;
        },
        endFilter: function () {
            this._filtering = false;
            this.refreshData();
            //this.set_pageIndex(-2);
            //this._loadPage();
        },
        applyFilter: function (field, operator, value) {
            this._clearCache();
            this.removeFromFilter(field);
            if (operator == ':') {
                if (value) this._filter.push(field.Name + ':' + value);
            }
            else if (operator)
                this._filter.push((operator == '~' ? '_quickfind_' : field.Name) + ':' + operator + this.convertFieldValueToString(field, value));
            var keepFieldValues = (this._filter.length == 1 && this._filter[0].match(/(\w+):/)[1] == field.Name);
            field = this.findFieldUnderAlias(field);
            for (var i = 0; i < this._allFields.length; i++)
                if (!keepFieldValues || this._allFields[i].Name != field.Name)
                    this._allFields[i]._listOfValues = null;
            if (this._filtering != true)
                this._sync();
        },
        applyExternalFilter: function (preserveFilter) {
            if (!preserveFilter || !this._filter) this._filter = [];
            this._selectedRowIndex = null;
            for (var i = 0; i < this._externalFilter.length; i++) {
                var filterItem = this._externalFilter[i];
                if (preserveFilter) {
                    for (var j = 0; j < this._filter.length; j++) {
                        if (this._filter[j].startsWith(filterItem.Name + ':=')) {
                            Array.removeAt(this._filter, j);
                            break;
                        }
                    }
                }
                Array.add(this._filter, filterItem.Name + ':=' + filterItem.Value);
            }
        },
        applyFieldFilter: function (fieldIndex, func, values, defer) {
            if (fieldIndex == null)
                fieldIndex = this._filterFieldIndex;
            if (!func)
                func = this._filterFieldFunc;
            var field = this._allFields[fieldIndex];
            this.removeFromFilter(field);
            $(this._allFields).each(function () {
                this._listOfValues = null;
            });
            //var filter = field.Name + ':';
            var filter = String.format('{0}:', field.Name, field.Type);

            if (values && values[0] == resourcesHeaderFilter.EmptyValue)
                values[0] = String.jsNull;
            if (!values)
                filter += func + '$\0';
            else if (func == '$between')
                filter += '$between$' + this.convertFieldValueToString(field, values[0]) + '$and$' + this.convertFieldValueToString(field, values[1]) + '\0';
            else
                for (var i = 0; i < values.length; i++)
                    filter += func + (func.startsWith('$') ? '$' : '') + this.convertFieldValueToString(field, values[i]) + '\0';
            if (filter.indexOf('\0') > 0) Array.add(this._filter, filter);
            //        if (!defer) {
            //            this.set_pageIndex(-2);
            //            this._loadPage();
            //        }
            if (!defer)
                this.refreshData();
            this._forgetSelectedRow(true);
        },
        get_fieldFilter: function (field, extractFunction) {
            for (var i = 0; i < this._filter.length; i++) {
                var m = this._filter[i].match(/(\w+):(\*|\$\w+\$|=|~|>=?|<(=|>){0,1})([\s\S]*)/);
                if (m[1] == field.Name) {
                    if (extractFunction) {
                        var s = m[2];
                        return s.startsWith('$') ? s.substring(0, s.length - 1) : s;
                    }
                    else
                        return m[4];
                }
            }
            return null;
        },
        convertFieldValueToString: function (field, value) {
            //        if (field.Type == 'String')
            //            return value != null && typeof (value) != String ? value.toString() : value;
            //        else {
            //            if (value != null && typeof (value) == 'string')
            //                value = this.convertStringToFieldValue2(field, value);
            //            return String.format('%js%{0}',  _Sys.Serialization.JavaScriptSerializer.serialize(value));
            //        }
            if (typeof value == 'string' && (value.match(_app._listRegex) || value.startsWith('%js%')))
                return value;
            if (field.Type !== 'String' && value != null && typeof value == 'string')
                value = this.convertStringToFieldValue2(field, value);
            if (isInstanceOfType(Date, value))
                value = _app.stringifyDate(value/*, field*/);
            //value = new Date(value - value.getTimezoneOffset() * 60 * 1000);
            return String.format('%js%{0}', jsonStringify(value));
        },
        convertFieldValueToString2: function (field, value) {
            if (field.Type.startsWith('DateTime') && !isNullOrEmpty(field.DataFormatString)) {
                if (value == null)
                    return null;
                else
                    return String.localeFormat(field.DataFormatString, value);
            }
            else {
                if (field.Type === 'Boolean') {
                    if (value == null)
                        return null;
                    else
                        return value.toString();
                }
                else {
                    //if (field.Type == 'Decimal' || field.Type == 'Single')
                    //    return String.localeFormat('{0:N6}', value);
                    //else
                    return value.toString();
                }
            }
        },
        convertStringToFieldValue: function (field, value) {
            if (typeof value !== 'string') return value;
            if (value != null && value.startsWith('%js%')) {
                value = _serializer.deserialize(value.substring(4));
                if (_app.isISO8601DateString(value))
                    value = new Date(value);
                // if (Date.isInstanceOfType(value))
                //     value = new Date(value.getTime() + value.getTimezoneOffset() * 60 * 1000);
                return value;
            }
            else
                return this.convertStringToFieldValue2(field, value);
        },
        convertStringToFieldValue2: function (field, value) {
            if (value == null) return value;
            switch (field.Type) {
                case 'DateTime':
                    var d = field.DataFormatString && field.DataFormatString.length ? Date.parseLocale(value, field.DataFormatString.match(/\{0:([\s\S]*?)\}/)[1]) : Date.parse(value)
                    if (!isNaN(d) && d != null)
                        return d;
                    break;
                case 'SByte':
                case 'Byte':
                case 'Int16':
                case 'Int32':
                case 'UInt32':
                case 'Int64':
                case 'Single':
                case 'Double':
                case 'Decimal':
                case 'Currency':
                    var n = Number.parseLocale(value);
                    if (!isNaN(n))
                        return n;
                    break;
            }
            return value;
        },
        goToView: function (viewId) {
            if (!viewId && this._doneCallback) {
                this._doneCallback(this);
                return;
            }
            if (!isNullOrEmpty(this._replaceTriggerViewId) && this._replaceTriggerViewId == viewId) {
                if (this._skipTriggeredView) this._skipTriggeredView = false;
                location.replace(location.href)
                return;
            }
            var ditto = this._ditto && this._ditto.slice(0);
            this._clearCache(true);
            this._ditto = ditto;
            var lastFilter = this.get_filter();
            var lastGroup = this.get_view().Group;
            if (viewId === 'form')
                for (var i = 0; i < this.get_views().length; i++)
                    if (this.get_views()[i].Type === 'Form') {
                        viewId = this.get_views()[i].Id;
                        break;
                    }
            this._disposePendingUploads();
            this._detachBehaviors();
            if (!this.get_isForm() /*this.get_view().Type != 'Form'*/) {
                this._lastViewId = this.get_viewId();
                this._selectedRowIndex = 0;
            }
            var oldViewId = this.get_view().Id,
                viewChanged = oldViewId != viewId,
                wasForm,
                originalExtension = this.extension();
            if (viewChanged) {
                this._focusedFieldName = null;
                wasForm = this.get_isForm();
                if (!this.get_isGrid())
                    this.writeContext('vitals', null);
            }
            this.set_viewId(viewId);
            var v = this.get_view();
            if (v.Type !== 'Form') {
                this._lastViewId = viewId;
                this._restorePosition();
                if (viewChanged && wasForm && _touch)
                    originalExtension._dispose(true);
            }
            this.set_pageIndex(-1);
            var viewFilter = v.Type === 'Form' ? this.get_selectedKeyFilter() : (!isNullOrEmpty(lastGroup) && this.get_view().Group === lastGroup || !viewChanged ? lastFilter : []);
            if (this._requestedFilter) {
                viewFilter = this._requestedFilter;
                this._requestedFilter = null;
            }
            var viewSortExpression = viewChanged ? null : this.get_sortExpression();
            if (this._requestedSortExpression) {
                viewSortExpression = this._requestedSortExpression;
                this._requestedSortExpression = null;
            }
            this.set_filter(viewFilter);
            this.set_sortExpression(viewSortExpression);
            this._loadPage();
            this._raiseSelectedDelayed = true;
            if (viewChanged) {
                this._scrollIntoView = true;
                this._focusedCell = null;
            }
        },
        filterOf: function (field) {
            var that = this,
                header = that._allFields[field.AliasIndex].Name /* (!isNullOrEmpty(field.AliasName) ? field.AliasName : field.Name) */ + ':';
            for (var i = 0; i < that._filter.length; i++) {
                var s = that._filter[i];
                if (s.startsWith(header) && !s.match(':~'))
                    return that._filter[i].substr(header.length);
            }
            header = field.Name + ':';
            for (i = 0; i < that._filter.length; i++) {
                s = that._filter[i];
                if (s.startsWith(header) && !s.match(':~'))
                    return that._filter[i].substr(header.length);
            }
            return null;
        },
        findField: function (query) {
            return this._mapOfAllFields[query];
            //for (var i = 0; i < this._allFields.length; i++) {
            //    var field = this._allFields[i];
            //    if (field.Name == query) return field;
            //}
            //return null;
        },
        findCategory: function (query) {
            for (var i = 0; i < this._categories.length; i++) {
                var c = this._categories[i];
                if (c.Id === query) return c;
            }
            return null;
        },
        _isInInstantDetailsMode: function () {
            return location.href.match(_app.DetailsRegex);
        },
        _closeInstantDetails: function () {
            if (this._isInInstantDetailsMode()) {
                if (resources.Lookup.ShowDetailsInPopup) {
                    close();
                    return true;
                }
            }
            return false;
        },
        _confirm: function (context, confirmCallback) {
            var that = this,
                iterator = /(_(\w+))\s*=\s*(.+?)(\s*\r|;|\n|$)/gi,
                action = context.action,
                confirmation = action.Confirmation,
                result = true, values,
                m = iterator.exec(confirmation), name, value;
            if (m && !(__tf !== 4)) {
                var survey = null,
                    controller = null,
                    view = '',
                    commandName = 'New',
                    commandArgument = '';
                while (m) {
                    name = m[2];
                    value = m[3];
                    if (name === 'survey')
                        survey = value;
                    if (name === 'controller')
                        controller = value;
                    if (name === 'view')
                        view = value;
                    if (name === 'commandName')
                        commandName = value;
                    if (name === 'commandArgument')
                        commandArgument = value;
                    if (name === 'width')
                        context.MaxWidth = value;
                    if (name === 'title')
                        context.WindowTitle = value;
                    m = iterator.exec(confirmation);
                }

                var dataView = that.get_isModal() ? null : findDataView(controller, 'Controller'),
                    displayErrors = action.CausesValidation !== false;
                if (_touch)
                    _app.input.cancel(true);

                if (!_touch || _app.input.valid())
                    if (dataView && !dataView.get_isModal()) {
                        values = dataView._collectFieldValues();
                        result = dataView._validateFieldValues(values, displayErrors);
                        if (result) {
                            that._convertValuesToParameters(values);
                            that._paramValues = values;
                        }
                    }
                    else {
                        values = that._collectFieldValues();
                        var contextValues = context.Values = [],
                            servicePath = that.get_servicePath(),
                            i, fv, ditto,
                            searchParamValues = that._searchParamValues;
                        result = that._validateFieldValues(values, displayErrors);
                        if (result) {
                            for (i = 0; i < values.length; i++) {
                                fv = values[i];
                                Array.add(contextValues, { Name: 'Context_' + fv.Name, Value: fv.Modified ? fv.NewValue : fv.OldValue });
                            }
                            if (survey)
                                _app.survey({ controller: survey, parent: that._id, confirmContext: context });
                            else {
                                if (searchParamValues) {
                                    ditto = [];
                                    searchParamValues.forEach(function (fv) {
                                        ditto.push({ name: fv.Name.substring(11), value: fv.NewValue });
                                    });
                                }
                                dataView = _app.showModal(this, controller, view, commandName, commandArgument, appBaseUrl, servicePath, [],
                                    { confirmContext: context, showSearchBar: that.get_showSearchBar(), tag: 'discard-changes-prompt-none', ditto: ditto });
                            }
                            result = false;
                        }
                    }
            }
            else {
                confirmation = that._parseText(confirmation, that.get_currentRow());
                if (confirmCallback)
                    confirmCallback(confirmation);
                else if (!confirm(confirmation))
                    result = false;
            }
            return result;
        },
        executeAction: function (scope, actionIndex, rowIndex, groupIndex, confirmed, action) {
            if (this._isBusy) return;
            _app.hideMessage();
            if (!action) {
                var isLookup = this.get_lookupField() != null;
                var actions = isLookup && this._lookupActionProcessing() ? null : (scope === 'ActionBar' ? this.get_actionGroups(scope)[groupIndex].Actions : this.get_actions(scope));
                if (actionIndex < 0 && actions) {
                    for (var i = 0; i < actions.length; i++)
                        if (this._isActionAvailable(actions[i], rowIndex)) {
                            actionIndex = i;
                            break;
                        }
                    if (actionIndex < 0) return;
                }
                action = actions ? actions[actionIndex] : null;
            }
            if (action && !isNullOrEmpty(action.Confirmation)) {
                if (this.get_isGrid() && !this.get_isDataSheet() && this.get_lastCommandName() !== 'BatchEdit' && !isLookup)
                    this.executeRowCommand(rowIndex, 'Select');
                if (!confirmed && !this._confirm({ action: action, scope: scope, actionIndex: actionIndex, rowIndex: rowIndex, groupIndex: groupIndex }))
                    return;
            }
            var command = action ? action.CommandName : 'Select';
            var argument = action ? action.CommandArgument : null;
            var causesValidation = action ? action.CausesValidation : true;
            var path = action ? action.Path : null;
            this.executeRowCommand(rowIndex, command, argument, causesValidation, path);
        },
        delegateCommand: function (command, argument) {
            var that = this,
                isForm = that.get_isForm(),
                parent, parentDataViewId;
            if (_touch && (command.match(/New/) || command.match(/Select|Edit/) && argument && that._viewId !== argument || command === 'Select' && argument && that.editing()) && isForm) {
                parentDataViewId = that._parentDataViewId;
                if (parentDataViewId) {
                    parent = findDataView(parentDataViewId);
                    if (parent.get_isForm())
                        parent = that;
                }
                else
                    parent = that;
                if (parent && that._controller === parent._controller)
                    _touch.pageInfo(that).deleted = true;
                else
                    parent = null;
            }
            return parent;
        },
        executeRowCommand: function (rowIndex, command, argument, causesValidation, path) {
            var that = this,
                primaryDataView,
                extension,
                executeResult,
                args;

            function afterExecuteCommand() {
                if (command === 'ClientScript') {
                    if (!that._raiseSelectedDelayed)
                        setTimeout(function () {
                            that.refresh(true);
                        }, 10);
                }
                else if (command === 'Select' && argument == null && !that.get_isGrid())
                    that._render();
            }

            primaryDataView = that.delegateCommand(command, argument);
            if (primaryDataView && primaryDataView !== that)
                primaryDataView.executeRowCommand(rowIndex, command, argument, causesValidation, path);
            else {
                extension = that.extension();
                if (rowIndex != null && rowIndex >= 0) {
                    that._selectedRowIndex = rowIndex;
                    that._raiseSelectedDelayed = !(command === 'Select' && isNullOrEmpty(argument));
                    if (extension)
                        that._selectedRow = that._rows[rowIndex];
                    that._selectKeyByRowIndex(rowIndex);
                }
                args = { commandName: command, commandArgument: argument ? argument : '', path: path, causesValidation: causesValidation ? true : false };
                if (!_touch && that.get_isDataSheet() && command.match(/Select|New|Edit|Duplicate/) && that._rows.length > 0) {
                    if (extension != null && !_app.Extensions.active(extension))
                        _app.Extensions.active(extension, true);
                    else if (!that._get_focusedCell())
                        that._startInputListenerOnCell(0, 0);
                }
                executeResult = that.executeCommand(args);
                if (executeResult)
                    if (executeResult.then)
                        $.when(executeResult).then(afterExecuteCommand);
                    else
                        afterExecuteCommand();
            }
        },
        rowCommand: function (row, command, argument, causesValidation, path) {
            this._raiseSelectedDelayed = !(command === 'Select' && isNullOrEmpty(argument));
            this._selectKeyByRow(row);
            var args = { commandName: command, commandArgument: argument ? argument : '', path: path, causesValidation: causesValidation ? true : false };
            if (this.get_isDataSheet() && command.match(/Select|New|Edit|Duplicate/)) {
                var extension = this.extension();
                if (extension != null && !_app.Extensions.active(extension))
                    _app.Extensions.active(extension, true);
            }
            if (!this.executeCommand(args))
                return;
            if (command === 'ClientScript') {
                if (!this._raiseSelectedDelayed) {
                    var self = this;
                    setTimeout(function () {
                        self.refresh(true);
                    }, 10);
                }
            }
            else if (command === 'Select' && argument == null && !this.get_isGrid())
                this._render();
        },
        _applySelectionFilter: function (q) {
            if (this.multiSelect() && this._selectedKeyList.length > 0 && this._keyFields.length == 1) {
                q.Filter = Array.clone(q.Filter);
                Array.add(q.Filter, String.format('{0}:$in${1}', this._keyFields[0].Name, this._selectedKeyList.join('$or$')));
            }
        },
        get_appRootPath: function () {
            var servicePath = this.get_servicePath();
            if (typeof __cothost != 'undefined') {
                if (__cothost === 'DotNetNuke' && servicePath.match(/DesktopModules\//i))
                    return servicePath.replace(/Service\.asmx$/i, '');
                if (__cothost === 'SharePoint' && servicePath.match(/_layouts\//i))
                    return servicePath.replace(/Service\.asmx$/i, '');
            }
            return '~/';
        },
        executeReport: function (args) {
            this._cancelConfirmation();
            var downloadArgs = {
                target: '',
                action: this.resolveClientUrl(this.get_appRootPath() + 'Report.ashx'),
                request: this._createParams(true),
                command: args.commandName,
                argument: args.commandArgument
            },
                request = downloadArgs.request;
            request.Controller = this.get_controller();
            request.View = this.get_viewId();
            var commandArgument = args.commandArgument;
            if (!isNullOrEmpty(commandArgument)) {
                if (commandArgument.startsWith('_'))
                    downloadArgs.f.target = commandArgument;
                var a = commandArgument.split(_app._simpleListRegex);
                commandArgument = a[0];
                if (a.length == 3) {
                    request.Controller = a[1];
                    request.View = a[2];
                }
            }
            downloadArgs.argument = commandArgument;
            if (request.Filter.length > 0 && this.get_viewType() != "Form") {
                var sb = new _Sys_StringBuilder();
                if (this.useCase('$app'))
                    sb.append(this._filterDetailsText);
                else {
                    this._renderFilterDetails(sb, request.Filter);
                    var master = this.get_master();
                    if (master) {
                        var r = master.get_selectedRow();
                        for (var i = 0; i < master._allFields.length; i++) {
                            var field = master._allFields[i];
                            if (field.ShowInSummary && !field.OnDemand) {
                                field = master._allFields[field.AliasIndex];
                                if (!sb.isEmpty())
                                    sb.append(' ');
                                sb.appendFormat('{0} {1} {2}.', field.HeaderText, resourcesDataFiltersLabels.Equals, field.format(r[field.Index]));
                            }
                        }
                    }
                }
                request.FilterDetails = sb.toString();
            }
            if (this._viewMessages)
                request.FilterDetails = String.format('{0} {1}', this._viewMessages[this.get_viewId()], request.FilterDetails);
            if (request.FilterDetails)
                request.FilterDetails = request.FilterDetails.replace(/(<b class=\"String\">([\s\S]*?)<\/b>)/g, '"$2"').replace(/(&amp;)/g, '&').replace(/(<.+?>)|&nbsp;/g, '');
            if (request.FilterDetails && _touch)
                request.filterDetails = this.extension().filterStatus();
            this._applySelectionFilter(request);
            downloadArgs.actionArgs = this._createArguments(args);
            this._validateFieldValues(downloadArgs.actionArgs.Values, true);
            downloadArgs.actionArgs.ExternalFilter = request.ExternalFilter;
            this._showDownloadProgress();
            this._downloadFile(downloadArgs);
        },
        _downloadFile: function (args) {
            var form = this._get_dataRequestForm(),
                user = _app.AccountManager.current();
            form.target = args.target;
            form.action = args.action;
            $get('c', form).value = args.command;
            $get('a', form).value = args.argument;
            $get('q', form).value = jsonStringify(args.request);
            if (user && user.access_token)
                $get('t', form).value = user.access_token;
            if (args.actionArgs)
                $get('aa', form).value = _app.htmlEncode(jsonStringify(args.actionArgs));
            form.submit();
        },
        _get_dataRequestForm: function () {
            var f = $get('_dataRequest_form');
            if (!f) {
                f = document.createElement('form');
                f.id = '_dataRequest_form';
                f.method = 'post';
                f.innerHTML = '<input type="hidden" name="q" id="q"/><input type="hidden" name="aa" id="aa"/><input type="hidden" name="c" id="c"/><input type="hidden" name="a" id="a"/><input type="hidden" name="t" id="t"/>';
                document.body.appendChild(f);
            }
            return f;
        },
        _showDownloadProgress: function () {
            var that = this;
            that._busy(true);
            return that._onLoadComplete(that.get_id()).done(function () {
                that._stopWaiting = false;
                that._busy(false);
                //if (execute) // this will execute only in Classic UI
                //    that._onExecuteComplete(execute.result, execute.context);
            });
        },
        _onLoadComplete: function (id) {
            var d = $.Deferred(),
                that = this,
                downloadToken = 'APPFACTORYDOWNLOADTOKEN';
            document.cookie = String.format('{0}={1}; path=/', downloadToken, encodeURIComponent(id));
            var downloadInterval = setInterval(function () {
                if (!isNullOrEmpty(document.cookie)) {
                    var cookies = document.cookie.split(';');
                    for (var i = 0; i < cookies.length; i++) {
                        var cookie = cookies[i].trim();
                        if (cookie.startsWith(downloadToken)) {
                            var cookieValue = cookie.substring(downloadToken.length + 1).split(',');
                            if (cookieValue.length === 2 && cookieValue[0] === that.get_id() || that._stopWaiting) {
                                document.cookie = String.format('{0}=; expires={1}; path=/', downloadToken, new Date(0).toUTCString());
                                clearInterval(downloadInterval);
                                d.resolve();
                            }
                        }
                    }
                }
            }, 500);
            return d.promise();
        },
        isDirty: function () {
            var odp = this.odp;
            while (odp)
                if (odp.is(':dirty'))
                    return true;
                else
                    odp = odp._master;
            return false;
        },
        executeExport: function (args) {
            var downloadArgs = {
                target: args.commandName == 'ExportRss' ? '_blank' : '',
                action: this.resolveClientUrl(this.get_appRootPath() + 'Export.ashx'),
                command: args.commandName,
                argument: args.commandArgument,
                request: args
            }, params = this._createParams(true);
            this._applySelectionFilter(params);
            downloadArgs.request.Controller = this.get_controller();
            downloadArgs.request.View = this.get_viewId();
            downloadArgs.request.Filter = params.Filter;
            downloadArgs.request.SortExpression = params.SortExpression;
            this._downloadFile(downloadArgs);
        },
        _clearDynamicItems: function () {
            for (var i = 0; i < this._allFields.length; i++) {
                var f = this._allFields[i];
                if (f.DynamicItems) {
                    f.DynamicItems = null;
                    f.ItemCache = null;
                }
            }
        },
        _copyLookupValues: function (r, lf, nv, outputValues) {
            var values = outputValues || [], m;
            if (lf.Copy)
                while (m = _app._fieldMapRegex.exec(lf.Copy))
                    if (lf._dataView.findField(m[1])) {
                        if (m[2] == 'null')
                            Array.add(values, { 'name': m[1], 'value': null });
                        else
                            if (r) {
                                var f = this.findField(m[2]);
                                if (f) Array.add(values, { 'name': m[1], 'value': r[f.Index] });
                            }
                            else if (nv) {
                                for (var i = 0; i < nv.length; i++) {
                                    if (nv[i].Name == m[2]) {
                                        Array.add(values, { 'name': m[1], 'value': nv[i].NewValue });
                                        break;
                                    }
                                }
                            }
                    }
            if (outputValues) return;
            lf._dataView._skipFocus = true;
            lf._dataView.refresh(true, values);
            lf._dataView._focus();
            lf._dataView._skipFocus = false;
        },
        _copyExternalLookupValues: function () {
            if (this.get_filterSource() && this.get_filterSource() != 'Context') {
                var master = this.get_master();
                if (master) {
                    var ditto = [];
                    var filter = this.get_externalFilter();
                    for (var i = 0; i < filter.length; i++) {
                        var f = this.findField(filter[i].Name);
                        if (f && !isNullOrEmpty(f.Copy)) {
                            master._copyLookupValues(master.get_currentRow(), f, null, ditto);
                        }
                    }
                    this._ditto = ditto;
                }
            }
        },
        _processSelectedLookupValues: function () {
            var values = [];
            var labels = [];
            var lf = this.get_lookupField();
            var dataValueField = this.findField(lf.ItemsDataValueField);
            var dataTextField = this.findField(lf.ItemsDataTextField);
            var r = this.get_selectedRow();
            if (!dataValueField) {
                for (var i = 0; i < this._allFields.length; i++) {
                    if (this._allFields[i].IsPrimaryKey)
                        Array.add(values, r[this._allFields[i].Index]);
                }
            }
            else
                Array.add(values, r[dataValueField.Index]);
            if (!dataTextField) {
                for (i = 0; i < this.get_fields().length; i++) {
                    f = this.get_fields()[i];
                    if (!f.Hidden && f.Type === 'String') {
                        Array.add(labels, f.format(r[f.AliasIndex]));
                        break;
                    }
                }
                if (!labels.length) {
                    for (i = 0; i < values.length; i++) {
                        var f = this.get_fields()[i];
                        if (!f.Hidden) {
                            Array.add(labels, f.format(r[f.AliasIndex]));
                            break;
                        }
                    }
                }
            }
            else
                Array.add(labels, dataTextField.format(r[dataTextField.Index]));
            this._copyLookupValues(r, lf);
            lf._dataView.changeLookupValue(lf.Index, values.length === 1 ? values[0] : values, labels.join(';'));
        },
        _showModal: function (args) {
            var that = this,
                tag = that.get_tag(),
                lastViewId = that.get_lastViewId(),
                commandName = args.commandName,
                commandArgument = args.commandArgument,
                seeAllUseCase = that._useCase === 'seeAll',
                externalFilter = seeAllUseCase ? that._externalFilter : that.get_hasParent() || that._lookupInfo ? that._externalFilter : null,
                filter = seeAllUseCase && commandName === 'New' ? that._filter : that.get_selectedKeyFilter(),
                dataView;
            that.set_lastCommandName(null);
            that.set_lastCommandArgument(null);
            that._render();
            if (args.commandName === 'Duplicate')
                args.commandName = 'New';
            if (_touch && that.get_isGrid())
                if ((commandName === 'Edit' || commandName === 'New') && (!commandName || commandArgument === lastViewId))
                    tag = (tag || '') + ' view-type-inline-editor';
            dataView = _app.showModal(this, that.get_controller(), commandArgument, commandName, commandArgument, that.get_baseUrl(), that.get_servicePath(),
                externalFilter,
                {
                    filter: filter,
                    ditto: that.get_ditto(),
                    lastViewId: lastViewId, /*'transaction': that.get_transaction(),*/
                    filterSource: that.get_filterSource(),
                    filterFields: that.get_filterFields(),
                    showSearchBar: that.get_showSearchBar(),
                    tag: tag,
                    showActionButtons: that.get_showActionButtons()
                });
            that.set_ditto(null);
            that._savePosition();
            if (dataView && !dataView.inserting())
                dataView._position = that._position;
            that._restorePosition();
        },
        _savePosition: function () {
            if (!this.get_isForm()/*this.get_view().Type != 'Form'*/ && this._selectedRowIndex != null) {
                this._position = {
                    index: this._pageSize * this._pageIndex + this._selectedRowIndex,
                    count: this._totalRowCount,
                    filter: this.get_filter(),
                    sortExpression: this.get_sortExpression(),
                    key: Array.clone(this._selectedKey),
                    keyFilter: this._selectedKeyFilter,
                    active: false
                };
            }
        },
        _restorePosition: function () {
            if (this._position) {
                this._selectedKey = this._position.key;
                this._selectedKeyFilter = this._position.keyFilter;
                this._position = null;
            }
        },
        _advance: function (delta) {
            if (this._isBusy || !this._position || (delta == -1 & this._position.index == 0 || delta == 1 && this._position.index == this._position.count - 1)) return;
            this._position.index += delta;
            this._position.changing = true;
            this._position.changed = true;
            this._loadPage();
            this._position.changing = false;
        },
        discard: function () {
            this.tag('discard-changes-prompt-none');
        },
        cancel: function () {
            var that = this;
            if (that._inlineEditor)
                that._inlineEditorCanceled = true;
            if (that._cancelCallback)
                that._cancelCallback(this);
            else
                if (that._closeInstantDetails()) { }
                else if (that.endModalState('Cancel')) return;
                else if (that.get_backOnCancel() || !isNullOrEmpty(that._replaceTriggerViewId)) {
                    that.goBack(false);
                    setTimeout(function () {
                        location.replace(location.href);
                    }, 500);
                }
                else {
                    that.set_lastCommandName('Cancel');
                    that._pendingSelectedEvent = true;
                    if (that.get_isForm()/*that.get_view().Type == 'Form'*/ || that.inserting()) {
                        if (_touch)
                            location.replace(location.href);
                        else {
                            that._forceSync();
                            that.goToView(that._lastViewId);
                        }
                    }
                    else if (that._totalRowCount < 0)
                        that.goToPage(-1);
                    else {
                        that._clearDynamicItems();
                        that._render();
                        _body_performResize();
                    }
                }
        },
        _convertValuesToParameters: function (values) {
            var i = 0;
            while (i < values.length) {
                var fv = values[i];
                fv.ReadOnly = true;
                if (fv.Name.match('PrimaryKey'))
                    Array.removeAt(values, i);
                else {
                    fv.Name = 'Parameters_' + fv.Name;
                    i++;
                }
            }
        },
        _actionConfirmed: function (args) {
            var that = this,
                actionArgs = that._createArguments(args),
                argValues = actionArgs.Values,
                causesValidation = args.causesValidation,
                valid = that._validateFieldValues(argValues, causesValidation == null || causesValidation);
            if (valid) {
                var context = that.get_confirmContext(),
                    dataView = that.get_parentDataView(),
                    commandArgument = args.commandArgument,
                    childDataViewList = [];
                if (commandArgument) {
                    childDataViewList = commandArgument.split(_app._simpleListRegex);
                    childDataViewList.forEach(function (id, index) {
                        var dv = _app.find(id);
                        if (dv && dv._controller === id)
                            childDataViewList[index] = dv;
                    });
                }
                if (childDataViewList[0] && childDataViewList[0]._controller) {
                    $(argValues).each(function () {
                        this.Name = 'Parameters_' + this.Name;
                    });
                    childDataViewList.forEach(function (childDataView) {
                        childDataView._externalFilter = argValues;
                        childDataView.sync();
                    });
                }
                else if (context && dataView) {
                    var values = dataView._paramValues = actionArgs.Values;
                    that._convertValuesToParameters(values);
                    dataView._confirmDataViewId = that.get_id();
                    dataView._lookupActionProcessing(false);
                    dataView.executeAction(context.scope, context.actionIndex, context.rowIndex, context.groupIndex, true, context.action);
                    dataView._lookupActionProcessing(true);
                }
                else if (that._survey)
                    that.cancel();
            }
        },
        executeCommand: function (args) {
            var that = this,
                skipInvoke = !!that._skipInvoke,
                rules, handledByRule,
                actionPath = args.path,
                commandName = args.commandName,
                commandArgument = args.commandArgument;

            function executeAfterWait() {
                args._handled = true;
                that.executeCommand(args);
            }

            function triggerInlineEidtingMode(newRow) {
                $document.trigger($.Event('inlineeditingmode.dataview.app', { dataView: that, inlineEditing: true, editor: true, newRow: newRow }));
            }

            if (that._isBusy) return;
            if (!skipInvoke) {
                //if (rules) {
                //    if (commandName in rules) {
                //        rules = rules[commandName];
                //        if (commandArgument && commandArgument in rules)
                //            rules = rules[commandArgument];
                //    }
                //    else if (actionPath) {
                //        actionIDs = actionPath.split(/\//);
                //        if (actionIDs[0] in rules)
                //            rules = rules[actionIDs[0]];
                //        if (actionIDs.length > 1 && actionIDs[1] in rules)
                //            rules = rules[actionIDs[1]];
                //    }
                //}
                //if (typeof rules == 'function') {
                //    if (rules(that, args) === false)
                //        handledByRule = true;
                //}

                if (args._handled)
                    handledByRule = false; // an async resolve means that we shall proceed with the default execution path
                else {
                    handledByRule = executeExternalJavaScriptBusinessRule(that, args, true);
                    if (handledByRule && handledByRule.then) {
                        $.when(handledByRule).then(executeAfterWait);
                        return false; // handledByRule
                    }
                    if (!handledByRule) {
                        rules = new _businessRules(that);
                        rules.before(args);
                        if (rules.canceled()) {
                            rules.dispose();
                            handledByRule = true;
                        }
                        else if (rules._wait) {
                            $.when(rules._wait).then(executeAfterWait);
                            return false; //rules._wait;
                        }
                    }
                }
                if (handledByRule) {
                    that._valid = commandName === 'Calculate';
                    return that._valid;
                }
            }
            var persist = that._persist;
            if (persist && persist.command === commandName) {
                var persistValues = that.values();
                _app.ensureJSONCompatibility(persistValues);
                (persist.scope === 'user' ? _app.userVar : _app.sessionVar)('persist_' + that._controller + '_' + that._viewId, jsonStringify(persistValues));
            }
            if (commandName && commandName.match(/^(Report|Export)/)) {
                var serverActionErrorMessage;
                if (that.isDirty())
                    serverActionErrorMessage = resourcesODP.Save;
                else if (_odp.offline() && _odp.offline('status') !== 'synced')
                    serverActionErrorMessage = resourcesODP.SaveAndSync;
                else if (!_app.online())
                    serverActionErrorMessage = resourcesODP.OnlineRequired;
                if (serverActionErrorMessage) {
                    _touch.notify({ text: resourcesODP.UnableToExec + ' ' + serverActionErrorMessage, duration: 'long' });
                    return;
                }
            }

            switch (commandName) {
                case 'Select':
                case '':
                    that.set_lastCommandName(commandName);
                    that.set_lastCommandArgument(commandArgument);
                    if (that.get_lookupField() && commandArgument === '') that._processSelectedLookupValues();
                    else {
                        if (!isBlank(commandArgument)) {
                            that._savePosition();
                            if (that.get_showModalForms() && that.get_isForm(commandArgument) /*that.get_viewType(args.commandArgument) == 'Form'*/)
                                that._showModal(args);
                            else
                                that.goToView(commandArgument);
                        }
                        else
                            that._render();
                        if (__designer())
                            __designer_notifySelected(that);
                    }
                    break;
                case 'BatchEdit':
                    that.batchEdit(commandArgument);
                    break;
                case 'Edit':
                case 'New':
                case 'Duplicate':
                    if (!_touch) {
                        that._allowModalAutoSize();
                        that._fixHeightOfRow(false);
                        if (commandName === 'Edit') that._savePosition(); else that._restorePosition();
                    }
                    if (commandName === 'Duplicate') {
                        var r = that.get_selectedRow();
                        if (r) {
                            var dv = [];
                            for (i = 0; i < that._allFields.length; i++) {
                                var f = that._allFields[i];
                                if (!f.OnDemand)
                                    Array.add(dv, { 'name': f.Name, 'value': r[f.Index], duplicated: true });
                            }
                            that._ditto = dv;
                        }
                    }
                    if (_touch && commandName === 'Edit' && that.get_isGrid() && (!commandArgument || commandArgument === that.get_viewId()))
                        if (that.inlineEditing())
                            _touch.edit.activate();
                        else
                            triggerInlineEidtingMode();
                    else {
                        var fc = that._get_focusedCell(),
                            extension = that.extension();

                        if (commandName === 'New' || commandName === 'Duplicate') {
                            if (extension && extension.clearSelection)
                                extension.clearSelection(true, commandName);
                            else
                                that._forgetSelectedRow(false, fc);
                            if (_touch && that.get_isGrid() && (!commandArgument || commandArgument === that.get_viewId())) {
                                triggerInlineEidtingMode(true);
                                return;
                            }
                            else {
                                if (isNullOrEmpty(commandArgument))
                                    commandArgument = args.commandArgument = that.get_viewId();
                                if (commandName === 'New')
                                    that._copyExternalLookupValues();
                            }
                        }
                        var stateChanged = commandName === 'Edit' && commandArgument === that.get_viewId() && !that.editing();
                        that.set_lastCommandName(commandName);
                        that.set_lastCommandArgument(commandArgument);
                        that._clearDynamicItems();
                        if (!isBlank(commandArgument) && !stateChanged)
                            if (_touch || that.get_showModalForms() && that.get_isForm(commandArgument) && !that.get_isModal())
                                that._showModal(args);
                            else
                                that.goToView(commandArgument);
                        else {
                            if (extension && extension.stateChanged)
                                extension.stateChanged();
                            else {
                                if (that.get_isModal())
                                    that._container.style.height = '';
                                if (that.get_isDataSheet() && !that._pendingChars)
                                    that._startInputListenerOnCell(that._selectedRowIndex, fc == null ? 0 : fc.colIndex);
                                that._render();
                            }
                        }
                        if (__designer())
                            __designer_notifySelected(that);
                    }
                    break;
                case 'Navigate':
                    that.navigate(commandArgument);
                    break;
                case 'Cancel':
                    that.cancel();
                    break;
                case 'Confirm':
                    that._actionConfirmed(args);
                    break;
                case 'Back':
                    history.go(!isNullOrEmpty(commandArgument) ? parseInteger(commandArgument) : -1);
                    break;
                case 'Report':
                case 'ReportAsPdf':
                case 'ReportAsImage':
                case 'ReportAsExcel':
                case 'ReportAsWord':
                    that.executeReport(args);
                    break;
                case 'ExportCsv':
                case 'ExportRowset':
                case 'ExportRss':
                    that.executeExport(args);
                    break;
                case '_ViewDetails':
                    that._viewDetails(commandArgument);
                    break;
                case 'ClientScript':
                    closeHoverMonitorInstance();
                    eval(commandArgument);
                    break;
                case 'SelectModal':
                case 'EditModal':
                    that.set_lastCommandName(null);
                    that.set_lastCommandArgument(null);
                    that._render();
                    var modalCmd = commandName.match(/^(\w+)Modal$/);
                    //that.set_lastCommandName(modalCmd[1]);
                    //that.set_lastCommandArgument(args.commandArgument);
                    var modalArg = commandArgument.split(',');
                    var modalController = modalArg.length === 1 ? that.get_controller() : modalArg[0];
                    var modalView = modalArg.length === 1 ? commandArgument : modalArg[1];
                    var filter = [];
                    for (i = 0; i < that.get_selectedKey().length; i++)
                        Array.add(filter, { Name: that._keyFields[i].Name, Value: that.get_selectedKey()[i] });
                    var dataView = _app.showModal(that, modalController, modalView, modalCmd[1], modalView, that.get_baseUrl(), that.get_servicePath(), filter);
                    dataView._parentDataViewId = that.get_id();
                    break;
                case 'Import':
                    if (_touch)
                        _app.getScript('~/js/daf/daf-import', function () {
                            _app.import('upload', { dataView: that, view: commandArgument });
                        });
                    else
                        that._showImport(commandArgument);
                    break;
                case 'DataSheet':
                    that.writeContext('GridType', 'DataSheet');
                    that._forceFocusDataSheet = true;
                    that.changeViewType('DataSheet');
                    that.refreshAndResize();
                    break;
                case 'Grid':
                    that.writeContext('GridType', 'Grid');
                    that.changeViewType('Grid');
                    that.refreshAndResize();
                    break;
                /*            case 'Open':
                that.drillIn();
                break;*/
                case 'Status':
                    that._changeStatus(args);
                    break;
                case 'Search':
                    that._executeSearch(actionPath);
                    break;
                case 'None':
                    return true;
                case 'Upload':
                    _app.upload.multi.show(that, commandArgument);
                    break;
                default:
                    var view = null,
                        m = commandArgument.match(/^view:(.+)$/),
                        actionArgs;
                    if (commandName === 'Insert' && m) {
                        view = m[1];
                        Array.clear(that._selectedKey);
                        that.updateSummary();
                        that.set_lastCommandName('New');
                        that.set_lastCommandArgument(view);
                    }
                    actionArgs = that._createArguments(args, view);
                    that._valid = that._validateFieldValues(actionArgs.Values, args.causesValidation !== false/* args.causesValidation == null || args.causesValidation*/);
                    if (that._valid)
                        if (skipInvoke)
                            that._invokeArgs = that._valid ? actionArgs : that._validationError;
                        else {
                            that._execute(actionArgs);
                            skipInvoke = true;
                        }
                    break;
            }
            if (!skipInvoke) {
                rules.after(args);
                rules.dispose();
                return !rules.canceled();
            }
        },
        _forgetSelectedRow: function (notify, focusedCell) {
            if (!focusedCell)
                focusedCell = this._get_focusedCell();
            if (this.get_isDataSheet()) {
                if (focusedCell)
                    focusedCell.colIndex = 0;
            }
            this._lastSelectedRowIndex = !this._ignoreSelectedKey && this._selectedKey.length > 0 && this._rowIsSelected(this._selectedRowIndex) ? this._selectedRowIndex : -1;
            this._ignoreSelectedKey = false;
            Array.clear(this._selectedKey);
            this.updateSummary();
            if (notify)
                this.raiseSelected();
        },
        _changeStatus: function (args) {
            if (args.causesValidation) {
                var values = this._collectFieldValues();
                if (args.values)
                    values = Array.clone(args.values);
                if (!this._validateFieldValues(values, true))
                    return;
            }
            var statusField = this.findField('Status');
            if (!statusField) return;
            if (this.editing()) {
                var statusElem = this._get('_Item', statusField.Index);
                if (!statusElem) {
                    statusElem = document.createElement('input');
                    statusElem.type = 'hidden';
                    statusElem.id = String.format('{0}_Item{1}', this._id, statusField.Index);
                    this._container.appendChild(statusElem);
                }
                statusElem.value = args.commandArgument;
            }
            else {
                var row = this.get_selectedRow();
                row[statusField.Index] = args.commandArgument;
            }
            if (!_touch)
                this._updateVisibility();
        },
        _notifyDesigner: function (changed) {
            if (__designer() && changed) {
                var lastArgs = this._lastArgs;
                external.ExplorerNodeChanged(this.get_controller(), this.get_viewId(), lastArgs.CommandName, lastArgs.CommandArgument, jsonStringify(lastArgs.Values));
            }
        },
        goBack: function (changed) {
            _app._navigated = true;
            this._notifyDesigner(changed);
            var l = location;
            if (l.href.match(/_explorerNode=/))
                l.replace(l.href);
            else
                history.go(-1);
        },
        /*get_path: function () {
        var path = this.readContext('TreePath');
        if (!path) {
        path = [];
        Array.add(path, { 'text': Web.DataViewResources.Grid.RootNodeText, 'key': [], 'filter': [], 'quickFind': '' });
        this.writeContext('TreePath', path);
        }
        return path;
        },*/
        /*drillIn: function (index) {
        if (!this.get_isTree()) return;
        for (var i = 0; i < this._allFields.length; i++) {
        var recursiveField = this._allFields[i];
        if (recursiveField.ItemsDataController == this.get_controller()) {
        var path = this.get_path();
        if (!path)
        path = [];
        if (index != null) {
        var levelInfo = path[index];
        while (path.length - 1 > index)
        Array.removeAt(path, path.length - 1);
        this.set_selectedKeyFilter([]);
        this.set_quickFindText(levelInfo.quickFind);
        this.set_filter(levelInfo.filter);
        if (path.length == 0) {
        this.set_selectedKey([]);
        this.removeFromFilter(recursiveField);
        this.refreshData();
        }
        else {
        var key = levelInfo.key;
        this.applyFieldFilter(i, '=', key);
        this.set_selectedKey(key);
        this._syncKeyFilter();
        }
        this.raiseSelected();
        }
        else {
        var field = this._fields[0];
        var text = field.format(this.get_selectedRow()[field.Index]);
        levelInfo = path[path.length - 1];
        levelInfo.filter = this.get_filter();
        levelInfo.quickFind = this.get_quickFindText();
        Array.add(path, { 'text': text, 'key': this.get_selectedKey(), 'filter': [], 'quickFind': '' });
        this.set_filter([]);
        this.set_quickFindText(null);
        this.applyFieldFilter(i, '=', this.get_selectedKey());
        }
        this.writeContext('TreePath', path);
        break;
        }
        }
        },*/
        _viewDetails: function (fieldName) {
            var f = this.findField(fieldName);
            if (f) {
                var keyFieldName = f.Name;
                if (f.ItemsDataController == this.get_controller())
                    for (var i = 0; i < this._allFields.length; i++) {
                        if (this._allFields[i].IsPrimaryKey) {
                            keyFieldName = this._allFields[i].Name;
                            break;
                        }
                    }
                var contextFilter = this.get_contextFilter(f);
                if (__designer()) {
                    var link = String.format('{0}&{1}={2}', f.ItemsDataController, !isNullOrEmpty(f.ItemsDataValueField) ? f.ItemsDataValueField : keyFieldName, this.get_selectedRow()[f.Index]);
                    for (i = 0; i < contextFilter.length; i++) {
                        var filter = contextFilter[i];
                        link = String.format('{0}&{1}={2}', link, filter.Name, filter.Value);
                    }
                    link = this.resolveClientUrl(String.format('~/Details.{0}?l={1}', __designer() ? 'htm' : 'aspx', encodeURIComponent(link)));
                    location.href = link;
                    _app._navigated = false;
                }
                else {
                    filter = [{ 'Name': !isNullOrEmpty(f.ItemsDataValueField) ? f.ItemsDataValueField : keyFieldName, 'Value': this.fieldValue(f.Name) }];
                    Array.addRange(filter, contextFilter);
                    var dataView = _app.showModal(this, f.ItemsDataController, "editForm1", "Select", "editForm1", this.get_baseUrl(), this.get_servicePath(), filter, { useCase: 'ObjectRef' });
                    dataView.set_showSearchBar(this.get_showSearchBar());
                    dataView._parentDataViewId = this.get_id();
                    dataView._closeViewDetails = true;
                }

                //            for (i = 0; i < contextFilter.length; i++) {
                //                var filter = contextFilter[i];
                //                link = String.format('{0}&{1}={2}', link, filter.Name, filter.Value);

                //            }

                //            var link = String.format('{0}&{1}={2}', f.ItemsDataController, !isNullOrEmpty(f.ItemsDataValueField) ? f.ItemsDataValueField : keyFieldName, this.get_selectedRow()[f.Index]);
                //            var contextFilter = this.get_contextFilter(f);
                //            for (i = 0; i < contextFilter.length; i++) {
                //                var filter = contextFilter[i];
                //                link = String.format('{0}&{1}={2}', link, filter.Name, filter.Value);

                //            }



                //            link = this.resolveClientUrl(String.format('~/Details.{0}?l={1}', __designer() ? 'htm' : 'aspx', encodeURIComponent(link)));
                //            if (Web.DataViewResources.Lookup.ShowDetailsInPopup)
                //            //window.open(link, '_blank', 'scrollbars=yes,height=100,resizable=yes');
                //                this._navigate('_blank:' + link, 'scrollbars=yes,height=100,resizable=yes');
                //            else
                //                window.location.href = link;
                //            _app._navigated = false;
            }
        },
        changeViewType: function (type) {
            this.cancelDataSheet();
            if (!this._viewTypes)
                this._viewTypes = [];
            this._viewTypes[this.get_viewId()] = type;
            this._clearCache();
        },
        _parseLocation: function (url, row, values) {
            if (!row) row = this.get_selectedRow();
            if (!url) return null;
            url = this.resolveClientUrl(url);
            var iterator = /([\s\S]*?)\{(\w+)?\}/g;
            var formattedurl = '';
            var lastIndex = -1;
            var match = iterator.exec(url);
            while (match) {
                formattedurl += match[1];
                if (values && this._lastArgs) {
                    for (var i = 0; i < values.length; i++) {
                        var v = values[i];
                        if (v.Name == match[2]) {
                            formattedurl += this._lastArgs.CommandName.match(/Insert/i) ? v.NewValue : v.OldValue;
                            break;
                        }
                    }
                }
                else {
                    var field = match[2].match(/^\d+$/) ? this.get_fields()[parseInteger(match[2])] : this.findField(match[2]);
                    if (field) {
                        var fv = row[field.Index];
                        if (fv != null)
                            formattedurl += match.index == 0 ? fv : encodeURIComponent(fv);
                    }
                }
                lastIndex = iterator.lastIndex;
                match = iterator.exec(url);
            }
            if (lastIndex != -1) url = formattedurl + (lastIndex < url.length ? url.substr(lastIndex) : '');
            if (url.startsWith('?'))
                url = location.pathname + url;
            return url;
        },
        _parseText: function (text, row) {
            var that = this;
            if (!row) row = that.get_selectedRow();
            if (!text) return null;
            var parent = that.get_parentDataView(that),
                parentSelectedKeyList = parent._selectedKeyList,
                selectedCount = parentSelectedKeyList ? parentSelectedKeyList.length : 0;
            if (!selectedCount && parent._selectedKey && parent._selectedKey.length)
                selectedCount++;
            if (parentSelectedKeyList && Array.indexOf(parentSelectedKeyList, 'null') !== -1)
                selectedCount--;

            text = text.replace(/\{\$\s*count\}/gi, parent._totalRowCount);
            text = text.replace(/\{\$\s*selected\}/gi, selectedCount);
            var iterator = /([\s\S]*?)\{(\w+)?\}/g,
                formattedText = '',
                lastIndex = -1,
                match = iterator.exec(text);
            while (match) {
                formattedText += match[1];
                var field = match[2].match(/^\d+$/) ? that.get_fields()[parseInteger(match[2])] : that.findField(match[2]);
                if (field) {
                    field = that._allFields[field.AliasIndex];
                    var fv = row[field.Index];
                    if (fv != null) {
                        fv = field.format(fv);
                        //fv = fv.replace(/\'/g, '\\\'');
                        formattedText += fv;
                    }
                }
                lastIndex = iterator.lastIndex;
                match = iterator.exec(text);
            }
            if (lastIndex !== -1) text = formattedText + (lastIndex < text.length ? text.substr(lastIndex) : '');
            return text;
        },
        _disposePendingUploads: function () {
            $(this._pendingUploads).each(function () {
                this.files = null;
                this.form = null;
            });
            this._pendingUploads = null;
            $(this._container).find('.app-drop-box').each(function () {
                _app.upload('destroy', { container: this });
            });
        },
        navigate: function (location, values) {
            var targetView;
            this.set_selectedValue(this.get_selectedKey());
            closeHoverMonitorInstance();
            location = this._parseLocation(location, null, values);
            for (var i = 0; i < this.get_views().length; i++)
                if (this.get_views()[i].Id == location) {
                    targetView = this.get_views()[i];
                    break;
                }
            if (targetView)
                this.goToView(location);
            else
                this._navigate(location);
        },
        _navigate: function (location, features) {
            _app._navigated = true;
            var m = location.match(_app.LocationRegex),
                loc = m ? m[2] : location;
            if (typeof __dauh != 'undefined')
                if (m)
                    this.encodePermalink(m[2], m[1], features);
                else
                    this.encodePermalink(location);
            else {
                if (_touch && loc.indexOf('http') != -1 && (!m || m[1] == '_internal')) {
                    _app._navigated = false;
                    _touch.openExternalUrl(loc, false)();
                }
                else if (m) {
                    _app._navigated = false;
                    open(m[2], m[1], features ? features : '');
                }
                else
                    _window.location.href = location;
            }
        },
        get_contextFilter: function (field, values) {
            var contextFilter = [];
            if (!isNullOrEmpty(field.ContextFields)) {
                var contextValues = values ? values : this._collectFieldValues(true);
                var iterator = /(\w+)(\s*=\s*(.+?)){0,1}\s*(,|$)/g;
                var m = iterator.exec(field.ContextFields);
                while (m) {
                    var n = !isNullOrEmpty(m[3]) ? m[3] : m[1];
                    var m2 = n.match(/^\'(.+)\'$/);
                    if (!m2)
                        m2 = n.match(/^(\d+)$/);
                    if (m2) {
                        for (var i = 0; i < contextFilter.length; i++) {
                            if (contextFilter[i].Name == m[1]) {
                                contextFilter[i].Value += '\0=' + m2[1];
                                m2 = null;
                                break;
                            }
                        }
                        if (m2) Array.add(contextFilter, { Name: m[1], Value: m2[1], Literal: true });
                    }
                    else {
                        var f = this.findField(n);
                        if (f) {
                            for (i = 0; i < contextValues.length; i++) {
                                if (contextValues[i].Name == f.Name) {
                                    var v = contextValues[i];
                                    var fieldValue = v.Modified ? v.NewValue : v.OldValue;
                                    Array.add(contextFilter, { Name: m[1], Value: fieldValue });
                                    break;
                                }
                            }
                        }
                    }
                    m = iterator.exec(field.ContextFields);
                }
            }
            return contextFilter;
        },
        htmlEncode: function (field, s) { var f = this._allFields[field.AliasIndex]; return f.HtmlEncode ? (f.Type == 'String' ? _app.htmlEncode(s) : s) : s; },
        filterIsExternal: function (fieldName) {
            if (this._externalFilter.length == 0) return false;
            for (var i = 0; i < this._filter.length; i++) {
                var name = this._filter[i].match(/(\w+):/)[1];
                var found = false;
                if (!fieldName || fieldName == name)
                    for (var j = 0; j < this._externalFilter.length; j++)
                        if (this._externalFilter[j].Name == name) {
                            found = true;
                            break;
                        }
                if (!found) return false;
            }
            return true;
        },
        updateSummary: function () {
            // Classic UI
        },
        hasDetails: function () {
            var that = this,
                result = that._hasDetails;
            if (!result)
                $(that._allFields).each(function () {
                    if (this.Type === 'DataView') {
                        result = true;
                        return false;
                    }
                });
            return !that.odp && (!!result && !that._doneCallback);
        },
        get_hasDetails: function () {
            return !!this._hasDetails;
        },
        get_hasParent: function () {
            return this._hasParent === true;
        },
        //get_usesTransaction: function () {
        //    return this._usesTransaction == true;
        //},
        //get_inTransaction: function () {
        //    return this.get_transaction() != null;
        //},
        add_selected: function (handler) {
            var that = this;
            if (!that._dataViewFieldName)
                that._hasDetails = true;
            that.get_events().addHandler('selected', handler);
        },
        remove_selected: function (handler) {
            this.get_events().removeHandler('selected', handler);
        },
        raiseSelected: function (eventArgs) {
            if (_app._navigated) return;
            var pendingEdit = _touch ? _touch.edit._pending : null;
            if (pendingEdit && !(pendingEdit.direction === 'enter' || !pendingEdit.direction))
                return; // the selection will change - do not refresh.
            var handler = this.get_events().getHandler('selected');
            if (handler) handler(this, _Sys.EventArgs.Empty);
            if (!this.multiSelect())
                this.set_selectedValue(this.get_selectedKey());
        },
        add_executed: function (handler) {
            this.get_events().addHandler('executed', handler);
        },
        remove_executed: function (handler) {
            this.get_events().removeHandler('executed', handler);
        },
        raiseExecuted: function (eventArgs) {
            var handler = this.get_events().getHandler('executed');
            if (handler) handler(this, eventArgs);
        },
        _collectFieldValues: function () {
            var that = this,
                values = [],
                selectedRow,
                extension = that.extension();
            if (extension && extension.collect)
                values = extension.collect();
            else {
                selectedRow = that.get_selectedRow();
                if (selectedRow && selectedRow.length)
                    that._allFields.forEach(function (field, index) {
                        if (!field.OnDemand) {
                            var v = selectedRow[index],
                                fieldName = field.Name,
                                fv = { Name: fieldName },
                                add;
                            if (v === undefined)
                                v = null;
                            if (v != null) {
                                fv.OldValue = v;
                                add = true;
                            }
                            if (field.ReadOnly && (fieldName !== 'Status' || add)) {
                                fv.ReadOnly = true;
                                add = true;
                            }
                            if (add)
                                values.push(fv);
                        }

                    });
            }
            return values;
        },
        _enumerateExpressions: function (type, scope, target) {
            var l = [];
            if (this._expressions) {
                for (var i = 0; i < this._expressions.length; i++) {
                    var e = this._expressions[i];
                    if (e.Scope == scope && (type == Web.DynamicExpressionType.Any || e.Type == Web.DynamicExpressionType.RegularExpression) && e.Target == target)
                        Array.add(l, e);
                }
            }
            return l;
        },
        _prepareJavaScriptExpression: function (expression) {
            if (!expression._variables) {
                var vars = [],
                    re = /(\[(\w+)\])|(\$row\.(\w+))/gm,
                    m = re.exec(expression.Test);
                while (m) {
                    var fieldName = m[2] || m[4],
                        found = false;
                    for (var i = 0; i < vars.length; i++) {
                        if (vars[i].name == fieldName) {
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        var f = this.findField(fieldName);
                        if (f)
                            Array.add(vars, { 'name': fieldName, 'regex': new RegExp('(\\[' + fieldName + '\\])|(\\$row\\.' + fieldName + ')', 'g'), 'replace': String.format('this._javaScriptRowValue({0})', f.Index) });
                    }
                    m = re.exec(expression.Test);
                }
                expression._variables = vars;
                expression.Test = expression.Test.replace(/\[(\w+)\.(\w+)\]/gi, 'this.fieldValue(\'$2\',\'$1\')');
            }
        },
        _javaScriptRowValue: function (fieldIndex, source) {
            var that = this,
                v = that._javaScriptRow[fieldIndex],
                field, dataViewId, dataView, dataViewRow, selectedKey,
                result;
            field = that._allFields[fieldIndex];
            if (field.Type === 'DataView') {
                result = that._javaScriptValues[field.Name];
                if (!result) {
                    dataViewId = field._dataViewId;
                    if (dataViewId) {
                        result = { _ready: true, _selected: false };
                        dataView = findDataView(field._dataViewId);
                        selectedKey = dataView._selectedKey;
                        if (selectedKey.length) {
                            dataViewRow = dataView.commandRow();
                            if (dataViewRow && dataViewRow.length) {
                                dataView._allFields.forEach(function (f) {
                                    result[f.Name] = dataViewRow[f.Index];
                                });
                                result._selected = selectedKey[0] !== undefined;
                            }
                        }
                    }
                    else
                        result = { _ready: false, _selected: false };
                    that._javaScriptValues[field.Name] = result;
                }
            }
            else
                result = v;
            return result;
        },
        _evaluateJavaScriptExpressions: function (expressions, row, concatenateResult) {
            var that = this,
                result = concatenateResult ? '' : null,
                i, j, v, r,
                exp, script;
            for (i = 0; i < expressions.length; i++) {
                exp = expressions[i];
                if (exp.Type === Web.DynamicExpressionType.ClientScript) {
                    that._prepareJavaScriptExpression(exp);
                    try {
                        script = exp._script;
                        if (!script) {
                            script = exp.Test;
                            for (j = 0; j < exp._variables.length; j++) {
                                v = exp._variables[j];
                                script = script.replace(v.regex, v.replace);
                            }
                            exp._script = _app.functions[script];
                            if (!exp._script)
                                exp._script = _app.functions[script] = eval('(function(){return ' + script + '})');
                            if (exp._script == null)
                                exp._script = script;
                            else
                                script = exp._script;
                        }
                        if (script) {
                            that._javaScriptValues = {};
                            that._javaScriptRow = row;
                            that._javaScriptRowConvert = that.editing();
                            r = typeof script == 'string' ? eval(script) : script.call(this);
                            if (concatenateResult) {
                                if (r) {
                                    if (result == null) result = exp.Result;
                                    else result += ' ' + exp.Result;
                                }
                            }
                            else
                                return exp.Result == null ? r : exp.Result;
                        }
                    }
                    catch (ex) {
                        var errror = that._controller + '.' + that._viewId + '.' + exp.Target + ':\n"' + ex.message + '" in\n' + exp.Test;
                        if (_touch)
                            _touch.notify({ text: errror, duration: 'long' });
                        else
                            alert(errror);
                    }
                }
            }
            return result;
        },
        _validateFieldValueFormat: function (field, v) {
            var error = null,
                dataFormatString = field.DataFormatString,
                fieldType = field.Type,
                newValue = v.NewValue,
                originalNewValue = newValue;
            switch (fieldType) {
                case 'SByte':
                case 'Byte':
                case 'Int16':
                case 'Int32':
                case 'UInt32':
                case 'Int64':
                case 'Single':
                case 'Double':
                case 'Decimal':
                case 'Currency':
                    if (typeof newValue != 'number')
                        newValue = Number.tryParse(newValue);
                    if (/*String.format('{0}', newValue)*/isNaN(newValue) || newValue == null)
                        error = resourcesValidator.NumberIsExpected;
                    else {
                        if (newValue != null && fieldType.match(/int|byte/i))
                            newValue = Math.round(newValue);
                    }
                    break;
                case 'Boolean':
                    try {
                        newValue = isInstanceOfType(String, newValue) ? Boolean.parse(newValue) : newValue;
                    }
                    catch (e) {
                        error = resourcesValidator.BooleanIsExpected;
                    }
                    break;
                case 'Date':
                case 'DateTime':
                    //case 'DateTimeOffset':
                    if (typeof newValue == 'string') {
                        newValue = !isNullOrEmpty(dataFormatString) ? Date.parseLocale(newValue, dataFormatString.match(/\{0:([\s\S]*?)\}/)[1]) : Date.parse(newValue);
                        if (!newValue && field.DateFmtStr && field.TimeFmtStr)
                            newValue = Date.tryParseFuzzyDateTime(originalNewValue, dataFormatString);
                        if (!newValue)
                            newValue = Date.tryParseFuzzyDate(originalNewValue, dataFormatString);
                        if (!newValue && field.TimeFmtStr)
                            newValue = Date.tryParseFuzzyTime(originalNewValue);
                        if (!newValue && dataFormatString) {
                            newValue = Date.parse(originalNewValue);
                            newValue = isNaN(newValue) ? null : new Date(newValue);
                        }
                        if (!newValue)
                            error = resourcesValidator.DateIsExpected;
                    }
                    else if (isNaN(newValue.getTime()))
                        error = resourcesValidator.DateIsExpected;
                    break;
            }
            v.NewValue = newValue;
            return error;
        },
        validate: function (values) {
            for (var i = 0; i < values.length; i++)
                if (values[i].Error)
                    return false;
            return true;
        },
        _validateFieldValues: function (values, displayErrors, focusedCell) {
            var that = this,
                valid = true,
                sb = new _Sys_StringBuilder(),
                i,
                newValue, oldValue,
                v, field, error;
            for (i = 0; i < values.length; i++) {
                v = values[i];
                newValue = v.NewValue;
                oldValue = v.OldValue;
                field = this.findField(v.Name);
                if (!field || focusedCell && field.ColIndex !== focusedCell.colIndex) continue;
                error = null;
                if (field.ReadOnly && field.IsPrimaryKey) {
                    if (newValue == null && oldValue != null && !_touch)
                        v.NewValue = oldValue;
                }
                else if (v.Modified /*&& (typeof (__designerMode) == 'undefined' || !v.ReadOnly && !(field.ReadOnly && field.IsPrimaryKey))*/) {
                    // see if the field is blank
                    if (!field.AllowNulls && (!field.HasDefaultValue || resourcesValidator.EnforceRequiredFieldsWithDefaultValue)) {
                        if (isBlank(newValue) && !field.Hidden && !field.isReadOnly())
                            error = resourcesValidator.RequiredField;
                    }
                    // convert blank values to "null"
                    if (!error && isBlank(newValue))
                        v.NewValue = null;
                    // convert to the "typed" value
                    if (!error && v.NewValue != null && !field.IsMirror && (!field.Hidden || v.Modified)) {
                        var fieldError = this._validateFieldValueFormat(field, v);
                        if (!field.isReadOnly())
                            error = fieldError;
                    }
                    if (!error) {
                        var expressions = this._enumerateExpressions(Web.DynamicExpressionType.RegularExpression, Web.DynamicExpressionScope.Field, v.Name);
                        for (var j = 0; j < expressions.length; j++) {
                            var exp = expressions[j];
                            var s = v.NewValue ? v.NewValue : '';
                            try {
                                var re = new RegExp(exp.Test);
                                var m = re.exec(s);
                                if (exp.Result.match(/\$(\d|\'\`)/)) {
                                    if (m) v.NewValue = s.replace(re, exp.Result);
                                }
                                else {
                                    if (!m) error = error ? error += exp.Result : exp.Result;
                                }
                            }
                            catch (ex) {
                                // do nothing
                            }
                        }
                    }
                    // see if the value has been modified
                    v.Modified = field.Type.startsWith('DateTime') ? ((v.NewValue == null ? null : v.NewValue.toString()) != (v.OldValue == null ? null : v.OldValue.toString())) : v.NewValue != v.OldValue;
                    //if (field.Type.startsWith('DateTime')) {
                    //    v.OldValue = this.convertFieldValueToString(field, v.OldValue);
                    //    v.NewValue = this.convertFieldValueToString(field, v.NewValue);
                    //}
                }
                v.Error = error;
                // display/hide the error as needed
                if (_touch) {
                    if (error && displayErrors && valid)
                        if (!_touch || (that._inlineEditor || _app.input.visible(field))) {
                            this._focus(field.Name, error);
                            valid = false;
                        }
                        else if (_touch) {
                            error = null;
                            v.Error = null;
                        }
                }
                else {
                    var errorElement = $get(this.get_id() + '_Item' + field.Index + '_Error');
                    if (errorElement && displayErrors) {
                        // _Sys.UI.DomElement.setVisible(errorElement, error != null);
                        _Sys.UI.DomElement.setVisible(errorElement, false);
                        errorElement.innerHTML = error;
                        if (error != null && valid)
                            this._showFieldError(field, error);
                        var elem = errorElement.parentNode;
                        while (elem && elem.tagName != 'BODY') {
                            if (!$common.getVisible(elem)) {
                                errorElement = null;
                                break;
                            }
                            elem = elem.parentNode;
                        }
                    }
                    if (error && displayErrors) {
                        if (valid) {
                            var lastFocusedCell = this._lastFocusedCell;
                            if (lastFocusedCell) {
                                this._focusCell(-1, -1, false);
                                this._focusCell(lastFocusedCell.rowIndex, lastFocusedCell.colIndex, true);
                                this._lastFocusedCell = null;
                            }
                            this._focus(field.Name);

                        }
                        valid = false;
                        if (!errorElement) sb.append(_app.formatMessage('Attention', field.Label + ": " + error));
                    }
                }
            }
            if (valid && _app.upload())
                $(this._allFields).each(function () {
                    var f = this,
                        test;
                    if (f.OnDemand) {
                        test = _app.upload('validate', { container: findBlobContainer(that, f), dataViewId: that._id, fieldName: f.Name });
                        if (!f.AllowNulls && !test && displayErrors) {
                            valid = false;
                            error = resourcesValidator.Required;
                            if (_touch)
                                that._focus(f.Name, error);
                            else
                                sb.appendFormat('<b>{0}</b>: {1}', f.Label, error);
                            return false;
                        }
                    }
                });
            if (!displayErrors) valid = true;
            if (!valid)
                if (this._skipInvoke)
                    this._validationError = sb.toString();
                else
                    _app.showMessage(sb.toString());
            sb.clear();
            return valid;
        },
        _fieldIsInExternalFilter: function (field) {
            return this._findExternalFilterItem(field) != null;
        },
        _findExternalFilterItem: function (field) {
            for (var i = 0; i < this._externalFilter.length; i++) {
                var filterItem = this._externalFilter[i];
                if (field.Name.toLowerCase() === filterItem.Name.toLowerCase())
                    return filterItem;
            }
            return null;
        },
        _focus: function (fieldName, message) {
            if (this._skipFocus) return;
            this.extension().focus(fieldName, message);
        },
        _serverFocus: function (fieldName, message) {
            this._focus(fieldName, message);
            if (this.get_isDataSheet()) {
                this.refresh(true);
                this._focus(fieldName, message);
            }
        },
        _saveTabIndexes: function () {
        },
        _restoreTabIndexes: function () {
        },
        _selectKeyByRowIndex: function (rowIndex) {
            this._selectKeyByRow(this._rows[rowIndex]);
        },
        _selectKeyByRow: function (row) {
            if (!row) return;
            this._selectedRow = row;
            var oldKey = this._selectedKey;
            this._selectedKey = [];
            this._selectedKeyFilter = [];
            for (var i = 0; i < this._keyFields.length; i++) {
                var field = this._keyFields[i];
                Array.add(this._selectedKey, row[field.Index]);
                Array.add(this._selectedKeyFilter, field.Name + ':=' + this.convertFieldValueToString(field, row[field.Index]));
                if (oldKey && (oldKey.length < i || oldKey[i] != this._selectedKey[i])) oldKey = null;
            }
            this.updateSummary();
            if (!oldKey && !this._raiseSelectedDelayed) this.raiseSelected();
        },
        _showWait: function (force) {
        },
        _hideWait: function () {
        },
        _raisePopulateDynamicLookups: function () {
            var that = this;
            if (that._hasDynamicLookups && that.editing() && that._skipPopulateDynamicLookups !== true)
                if (that._survey)
                    _app.survey('populateItems', {
                        dataView: that, callback: function (populatedList) {
                            var result = { Values: [] };
                            $(that._allFields).each(function () {
                                var f = this,
                                    allow;
                                $(populatedList).each(function () {
                                    if (this.Name === f.Name) {
                                        allow = true;
                                        return false;
                                    }
                                });
                                if (f.ItemsAreDynamic && allow)
                                    result.Values.push({ Name: f.Name, NewValue: f.Items });
                            });
                            that._populateDynamicLookups(result);
                        }
                    });
                else
                    that.executeCommand({ 'commandName': 'PopulateDynamicLookups', 'commandArgument': '', 'causesValidation': false });
            that._skipPopulateDynamicLookups = false;
        },
        _raiseCalculate: function (field, triggerField) {
            this.executeCommand({ 'commandName': 'Calculate', 'commandArgument': field.Name, 'causesValidation': false, 'trigger': triggerField.Name });
        },
        get_currentRow: function () {
            //return this.inserting() ? (this._newRow ? this._newRow : []) : this.get_selectedRow();
            var that = this;
            return that.inserting() ?
                (_touch ? that.editRow() : (that._newRow ? that._newRow : [])) :
                that.get_selectedRow();
        },
        updateFieldValue: function (fieldName, value, scope) {
            var inputValue = { name: fieldName, value: value };
            if (scope === 'master') {
                var masterId = this._dataViewFieldOwnerId,
                    parentId = this._parentDataViewId,
                    page, pendingInputExecute;
                if (!masterId && parentId)
                    masterId = findDataView(parentId)._dataViewFieldOwnerId;
                if (masterId) {
                    page = $('#' + masterId);
                    if (!page.is('.ui-page-active')) {
                        pendingInputExecute = page.data('inputExecute');
                        if (pendingInputExecute)
                            pendingInputExecute.every(function (iv, index) {
                                var found = iv.name === fieldName;
                                if (found)
                                    pendingInputExecute.splice(index, 1);
                                return !found;
                            });
                        else {
                            pendingInputExecute = [];
                            page.data('inputExecute', pendingInputExecute);
                        }
                        pendingInputExecute.push(inputValue);
                        return;
                    }
                }
            }
            _app.input.execute({ values: inputValue });
        },
        fieldValue: function (fieldName, source) {
            var that = this,
                dataView, f, r, result = null,
                config;
            if (fieldName === '_wizard') {
                config = $('#' + that._id + ' [data-layout]').data('wizard-config');
                result = config ? config.active : 0;
            }
            else {
                dataView = !source || !source.length ? that : source.match(/^master$/i) ? that.get_master() : $find(source);
                if (dataView && dataView._allFields) {
                    f = dataView.findField(fieldName);
                    if (f) {
                        if (_touch)
                            r = dataView.editRow();
                        else {
                            r = dataView._clonedRow;
                            if (!r)
                                r = dataView._cloneChangedRow();
                        }
                        result = r ? r[f.Index] : null;
                    }
                }
            }
            return result;
        },
        _configure: function (row) {
            if (!this._requiresConfiguration) return;
            if (!row) row = this.get_currentRow();
            if (!row) return;
            for (var i = 0; i < this._allFields.length; i++) {
                var f = this._allFields[i];
                if (!isNullOrEmpty(f.Configuration)) {
                    var iterator = /\s*(\w+)=(\w+)\s*?($|\n)/g;
                    var m = iterator.exec(f.Configuration);
                    while (m) {
                        var sourceField = this.findField(m[2]);
                        if (sourceField) {
                            var v = row[sourceField.Index];
                            if (v) f[m[1]] = v;
                        }
                        m = iterator.exec(f.Configuration);
                    }
                }
            }
        },
        _focusQuickFind: function (force) {
            if (!this._quickFindFocused || force === true) {
                this._lostFocus = true;
                try {
                    _Sys.UI.DomElement.setFocus(this.get_quickFindElement());
                    //this.get_quickFindElement().select();
                    //this.get_quickFindElement().focus();
                }
                catch (ex) {
                    // do nothing
                }
                this._quickFindFocused = true;
            }
        },
        _restoreEmbeddedViews: function () {
            if (!this._embeddedViews) return;
            for (var i = 0; i < this._embeddedViews.length; i++) {
                var ev = this._embeddedViews[i];
                ev.parent.appendChild(ev.view._element);
                delete ev.parent;
                ev.view = null;
            }
            Array.clear(this._embeddedViews);
        },
        _incorporateEmbeddedViews: function () {
            if (!this._embeddedViews) return;
            for (var i = 0; i < this._embeddedViews.length; i++) {
                var ev = this._embeddedViews[i];
                var placeholder = $get('v_' + ev.view.get_id());
                var elem = ev.view._element;
                ev.parent = elem.parentNode;
                placeholder.appendChild(elem);
            }
        },
        raiseSelectedDelayed: function () {
            var that = this;
            if (that._raiseSelectedDelayed) {
                that._raiseSelectedDelayed = false;
                if (!_touch)
                    that.raiseSelected();
                that._forceChanged = false;
            }
        },
        refreshChildren: function () {
            this._fields.forEach(function (f) {
                var childDataViewId = f._dataViewId;
                if (f.Type === 'DataView' && $('#' + childDataViewId + '_echo').is(':visible'))
                    findDataView(childDataViewId).sync();
            });
        },
        _render: function (refreshExtension) {
            var that = this;
            try {
                if (refreshExtension)
                    that._refreshExtension();
                that.get_parentDataView(that).raiseSelectedDelayed();
            }
            catch (ex) {
                _touch.notify(ex);
            }
        },
        _appendModalPanel: function (elem) {
            var element = this.get_element();
            if (element)
                element.appendChild(elem);
        },
        _syncKeyFilter: function () {
            var key = this.get_selectedKey();
            if (key.length > 0 && this._selectedKeyFilter.length == 0) {
                for (var i = 0; i < this._keyFields.length; i++) {
                    var f = this._keyFields[i];
                    Array.add(this._selectedKeyFilter, f.Name + ':=' + this.convertFieldValueToString(f, key[i]));
                }
            }
        },
        _mergeRowUpdates: function (row) {
            if (this._lastCommandName == 'BatchEdit') {
                var batchEdit = this._batchEdit = [];
                var allFields = this._allFields;
                $(this._element).find('.BatchSelect input:checkbox:checked').each(function () {
                    var m = this.id.match(/BatchSelect(\d+)$/);
                    if (m) {
                        var f = allFields[parseInteger(m[1])];
                        Array.add(batchEdit, f.Name);
                    }
                });
            }
            this._originalRow = null;
            this._useLEVs(row);
            if (this.editing() && this._ditto) {
                this._originalRow = Array.clone(row);
                for (var i = 0; i < this._ditto.length; i++) {
                    var d = this._ditto[i];
                    var f = this.findField(d.name);
                    if (f && !(f.ReadOnly && f.IsPrimaryKey))
                        row[f.Index] = d.value;
                }
                delete this._ditto;
            }
            this._configure(row);
            this._mergedRow = row;
        },
        _removeRowUpdates: function () {
            var row = this._mergedRow;
            if (!row) return;
            if (this._originalRow) {
                for (var i = 0; i < this._originalRow.length; i++)
                    row[i] = this._originalRow[i];
            }
            this._mergedRow = null;
        },
        _refreshExtension: function () {
            var extension = this.extension();
            var lastExtension = this._lastExtension;
            if (extension != lastExtension) {
                if (lastExtension)
                    lastExtension.hide();
                if (extension)
                    extension.show();
                this._lastExtension = extension;
            }
            if (extension)
                extension.refresh();
        },
        _isActionMatched: function (action, ignoreScript) {
            var whenClientScript = action.WhenClientScript,
                clientScript = whenClientScript;
            if (typeof whenClientScript == 'string') {
                whenClientScript = whenClientScript.trim();
                if (whenClientScript) {
                    whenClientScript = _app.functions[whenClientScript];
                    if (!whenClientScript)
                        whenClientScript = _app.functions[clientScript] = action.WhenClientScript = eval('(function(){return ' + this._prepareJavaScriptExpressionEx(clientScript) + '})');
                }
            }
            var result =
                (!action.WhenViewRegex || action.WhenViewRegex.exec(this.get_viewId()) != null === action.WhenViewRegexResult) &&
                (!action.WhenTagRegex || action.WhenTagRegex.exec(this.get_tag()) != null === action.WhenTagRegexResult) &&
                (!action.WhenHRefRegex || action.WhenHRefRegex.exec(location.pathname) != null === action.WhenHRefRegexResult) &&
                (ignoreScript || !whenClientScript || !!whenClientScript.call(this));
            return result;
        },
        _isActionAvailable: function (action, rowIndex) {
            var that = this,
                commandName = action.CommandName,
                lastCommand = action.WhenLastCommandName || '',
                lastArgument = action.WhenLastCommandArgument || '',
                selectedKey = that._selectedKey,
                whenKeySelected = action.WhenKeySelected,
                available, editing;
            if (lastCommand === 'Any')
                lastCommand = that.get_lastCommandName() || '';
            available = !lastCommand.length || lastCommand === that.get_lastCommandName() && (!lastArgument.length || lastArgument === that.get_lastCommandArgument());
            if (available) {
                editing = that.editing();
                if (commandName === 'DataSheet')
                    return !editing && that.get_isGrid() && /*!that.get_isTree() &&*/that.get_viewType() !== 'DataSheet' && that._isActionMatched(action);
                else if (commandName === 'Grid')
                    return !editing && that.get_isGrid() && /*!that.get_isTree() &&*/that.get_viewType() !== 'Grid' && that._isActionMatched(action);
                else if (commandName === 'BatchEdit')
                    return that.get_showMultipleSelection() && that._selectedKeyList && that._selectedKeyList.length > 1 && that._isActionMatched(action);
                else if (editing) {
                    var isSelected = that._rowIsSelected(rowIndex == null ? that._selectedRowIndex : rowIndex);
                    if (isSelected)
                        return (lastCommand === 'New' || lastCommand === 'Edit' || lastCommand === 'BatchEdit' || lastCommand === 'Duplicate') && that._isActionMatched(action);
                    else if (!isSelected && rowIndex == null && (lastCommand === 'New' || lastCommand === 'Duplicate'))
                        return that._isActionMatched(action);
                    else
                        return !lastCommand.length && rowIndex != null && that._isActionMatched(action);
                }
            }
            return available && (!whenKeySelected || whenKeySelected && selectedKey && selectedKey.length > 0) && that._isActionMatched(action) && (commandName !== 'New' || that._hasKey());
        },
        _hasKey: function () { return this._keyFields && this._keyFields.length > 0; },
        _rowIsSelected: function (rowIndex) {
            var that = this,
                result = that._rowIsSelectedCached;
            if (result != null)
                return result;
            if (!that._hasKey()) return that.get_isModal() && that.get_isForm()/* this.get_view().Type == 'Form'*/;
            var row = that._rows[rowIndex];
            return that.rowIsSelected(row);
        },
        rowIsSelected: function (row) {
            var that = this,
                keyFields = that._keyFields,
                selectedKey = that._selectedKey;
            if (row && keyFields.length === selectedKey.length && keyFields.length) {
                if (row === that._mergedRow) return true;
                for (var j = 0; j < keyFields.length; j++) {
                    var field = keyFields[j],
                        v1 = selectedKey[j],
                        v2 = row[field.Index];
                    //if (v1 === 0) 
                    //    return false;
                    if (field.Type.startsWith('DateTime')) {
                        if (!(v1 || v2)) return false;
                        v1 = v1.toString();
                        v2 = v2.toString();
                    }
                    if (v1 != v2 && !(v2 == null && isNullOrEmpty(v1))) return false;
                }
                return true;
            }
            else
                return that._inlineEditor ? true : false;
        },
        rowIsTemplate: function (row) {
            if (!row)
                row = this.commandRow();
            var keyFields = this._keyFields,
                //selectedKey = this._selectedKey,
                result = true;
            if (row && row.length && keyFields.length)
                for (var j = 0; j < keyFields.length; j++) {
                    var field = keyFields[j];
                    if (row[field.Index] != null) {
                        result = false;
                        break;
                    }
                }
            else
                result = false;
            return result;
        },
        commandRow: function () {
            var extension = this.extension();
            return extension && extension.commandRow ? extension.commandRow() : null;
        },
        extension: function () {
            var result = null,
                that = this,
                wdve = _app.Extensions;
            if (wdve) {
                var viewType = that.get_viewType(),
                    altViewType = that._altViewType,
                    viewExtensions = that._extensions;
                if (viewExtensions == null)
                    viewExtensions = that._extensions = {};
                if (viewType && altViewType == null)
                    altViewType = that._altViewType = that.tagged('view-type-inline-editor') ? 'Form' : '';
                if (altViewType)
                    viewType = altViewType;
                result = viewExtensions[viewType];
                if (result == null) {
                    var extensionType = wdve ? wdve[viewType] : null;
                    result = that._extensions[viewType] = extensionType ? new extensionType(this) : 0;
                    if (result)
                        result.initialize();
                }
            }
            return result;
        },
        _attachBehaviors: function () {
        },
        _detachBehaviors: function () {
        },
        _lookupActionProcessing: function (enable) {
            if (enable != null)
                this._standardActionProcessing = !enable;
            return this._standardActionProcessing !== true;
        },
        search: function (args) {
            var dataView = this,
                argsFilter = args.filter,
                filter = [];

            function convertValue(v) {
                if (isInstanceOfType(Date, v))
                    v = new Date(v - v.getTimezoneOffset() * 60 * 1000);
                return String.format('%js%{0}', jsonStringify(v));
            }

            if (args) {
                if (args.sortExpression) {
                    dataView._sortExpression = args.sortExpression;
                    var vitals = dataView.readContext('vitals');
                    if (vitals)
                        vitals.SortExpression = args.sortExpression;
                }
                if (args._filter)
                    dataView._filter = args._filter.slice(0);
                if (argsFilter) {
                    if (!isInstanceOfType(Array, argsFilter)) {
                        var p, v;
                        for (p in argsFilter) {
                            v = argsFilter[p];
                            filter.push({ name: p, operator: isInstanceOfType(Array, v) ? 'in' : '', value: v });
                        }
                        argsFilter = filter;
                        filter = [];
                    }
                    $(argsFilter).each(function () {
                        var ff = this,
                            value = ff.value == null ? ff.values : ff.value,
                            op = ff.operator || '=',
                            sb;
                        // UnitPrice:$between$%js%10$and$%js%30
                        if (op.match(/\w/))
                            op = '$' + op + '$';
                        if (isInstanceOfType(Array, value)) {
                            sb = [];
                            $(value).each(function (index) {
                                if (index > 0)
                                    sb.push(op === '$between$' ? '$and$' : '$or$');
                                sb.push(convertValue(this));
                            });
                            value = sb.join('');
                        }
                        else
                            value = convertValue(value);
                        filter.push(String.format('{0}:{1}{2}', ff.name || ff.field, op, value));
                    });
                    dataView._filter = filter;
                }
                if (!args._init)
                    dataView.sync();
            }
            else {
                dataView._lookupActionProcessing(false);
                var result = dataView._hasSearchAction && dataView.executeActionInScope(['ActionBar', 'Form'], 'Search', null, -1);
                dataView._lookupActionProcessing(true);
                return result;
            }
        },
        _executeSearch: function (path) {
            var that = this,
                searchAction = that.get_action(path);
            if (searchAction && (!searchAction.Confirmation || !searchAction.Confirmation.match(/_controller\s*=/))) {
                var list = _Sys_Application.getComponents();
                for (var i = 0; i < list.length; i++) {
                    var dataView = list[i];
                    if (isInstanceOfType(_app, dataView) && dataView._hasSearchAction) {
                        var searchAction2 = dataView.get_action(dataView._hasSearchAction);
                        if (searchAction2 && searchAction2.Confirmation) {
                            var m = searchAction2.Confirmation.match(/_controller\s*=\s*(\w+)/);
                            if (m && m[1] === that._controller)
                                dataView.search();
                        }
                    }
                }
            }
            else {
                if (_touch) {
                    var searchParamDataView = _touch.dataView(),
                        searchParamData = searchParamDataView.data(),
                        fieldName, field, v,
                        searchFilterStatus = [];
                    for (fieldName in searchParamData) {
                        v = searchParamData[fieldName];
                        if (v != null) {
                            field = searchParamDataView.findField(fieldName);
                            if (field && (field.AliasIndex === field.Index && (!field.Hidden || field.OriginalIndex !== field.Index))) {
                                v = field.format(v);
                                searchFilterStatus.push(field.HeaderText + ': ' + v);
                            }
                        }
                    }
                    that._searchParamFilterStatus = searchFilterStatus.join('; ') + (searchFilterStatus.length ? '.' : '');
                }
                that._clearSelectedKey();
                that._cancelConfirmation();
                if (_touch)
                    that._syncKey = true;
                else
                    that.refreshAndResize();
            }

        },
        filterByFirstLetter: function (index) {
            var fieldName = this._firstLetters[0];
            var letter = this._firstLetters[index]
            this.applyFieldFilter(this.findField(fieldName).Index, "$beginswith", [letter]);
        },
        _renderFilterDetails: function (sb, currentFilter, includeBanner) {
            var bannerRendered = false,
                that = this,
                hint, firstDataView,
                deepSearchInfo = that.viewProp && that.viewProp('deepSearchInfo'),
                matchCount = 0,
                conditionCount,
                i;

            function compressMatchScope(scope) {
                var j = i + 1;
                while (j < currentFilter.length) {
                    if (currentFilter[j].match(/^(_match_|_donotmatch)/))
                        break;
                    j++;
                }
                if (j - i > 2)
                    return resourcesMobile[scope + 'PastTense'];
                else
                    if (scope.startsWith('DoNot'))
                        return resourcesMobile.DidNotMatch;
                    else
                        return resourcesMobile.Matched;
            }

            function compressValue(value, text, isSecondValue) {
                // remove time if 12:00AM or 11:59:59PM
                if (value.getHours)
                    if ((!value.getHours() && !value.getMinutes() && !value.getSeconds()) || (isSecondValue && value.getHours() === 23 && value.getMinutes() === 59 && value.getSeconds() === 59))
                        return String.format('{0:d}', value);
                return text;
            }

            //var checkRecursive = true;
            for (i = 0; i < currentFilter.length; i++) {
                var filter = currentFilter[i].match(_app._fieldFilterRegex),
                    isQuickFind = filter[1] === '_quickfind_',
                    field = isQuickFind ? that._fields[0] : that.findField(filter[1]),
                    scope;
                //var recursive = field && field.ItemsDataController == this.get_controller() && this.get_isTree() && checkRecursive;
                //if (recursive)
                //    checkRecursive = false;
                if (!field && filter[1].match(/\,/) && deepSearchInfo) {
                    if (conditionCount++ > 0)
                        sb.append('; ');
                    sb.append(deepSearchInfo[filter[1].replace(/\W/g, '_') + (matchCount - 1)]);
                    continue;
                }
                if (!field /*&& filter[1] != '_quickfind_'*/ || that._fieldIsInExternalFilter(field)/* || recursive*/) {
                    if (filter[1] === '_match_')
                        scope = 'Match';
                    else if (filter[1] === '_donotmatch_')
                        scope = 'DoNotMatch';
                    if (scope) {
                        if (filter[2] === '$all$')
                            scope += 'All';
                        else
                            scope += 'Any';
                        if (matchCount > 0)
                            sb.append('. ');
                        sb.append(compressMatchScope(scope));
                        sb.append(': ');
                        matchCount++;
                        conditionCount = 0;
                    }
                    continue;
                }
                if (!bannerRendered) {
                    if (includeBanner !== false)
                        sb.appendFormat('<a href="javascript:" onclick="$find(\'{0}\').clearFilter(true);return false" class="Close" tabindex="{3}" title="{2}">&nbsp;</a><span class="Details"><span class="Information">&nbsp;</span>{1} ', that.get_id(), resources.InfoBar.FilterApplied, resourcesModalPopup.Close, $nextTabIndex());
                    bannerRendered = true;
                }
                var aliasField = field,
                    m = _app._filterIteratorRegex.exec(filter[2]), //var m = filter[2].match(_app._filterRegex);
                    first = true;
                if (field && (!_touch || !(field.IsPrimaryKey && kiosk())))
                    aliasField = that._allFields[field.AliasIndex];
                while (m && (m[1].startsWith('~') || !(field.Index === field.AliasIndex && field.IsPrimaryKey && field.Hidden))) {
                    if (!first)
                        sb.append(', ');
                    else
                        sb.appendFormat('<span class="FilterElement" onclick="$find(\'{0}\').removeFromFilterByIndex({1})" title="{2}">', that.get_id(), isQuickFind ? -1 : field.Index, isQuickFind ? labelClear : _app.htmlAttributeEncode(String.format(resourcesHeaderFilter.ClearFilter, field.Label)));

                    if (m[1].startsWith('~')) {
                        sb.appendFormat(String.format('{0} <b class="String">{1}</b>', resources.InfoBar.QuickFind, that.convertStringToFieldValue(field, m[3])));
                        hint = _touch && that.viewProp('quickFindHint');
                        if (hint) {
                            hint = hint.split(';');
                            sb.append(' ' + resourcesMobile.In + ' ');

                            if (hint[0])
                                sb.append(that.get_view().Label);
                            else
                                firstDataView = true;
                            $(_touch._pages).each(function () {
                                var page = this,
                                    dv = page.dataView,
                                    hintIndex;
                                if (dv) {
                                    if (that._id === dv._filterSource) {
                                        hintIndex = hint.indexOf(dv._controller + '.' + dv._viewId + '.' + dv._filterFields);
                                        if (hintIndex !== -1) {
                                            if (firstDataView)
                                                firstDataView = false;
                                            else if (hintIndex === hint.length - 1)
                                                sb.append(' ' + labelAnd + ' ');
                                            else
                                                sb.append(', ');
                                            sb.append(dv.get_view() && dv.get_view().Label || page.text);
                                        }
                                    }
                                }

                            });
                            //sb.append('.');
                        }
                    }
                    else {
                        if (conditionCount++ > 0)
                            sb.append('; ');
                        sb.appendFormat('<span class="Highlight">{0}</span>', that._fieldNameHint && that._fieldNameHint[aliasField.Name] || aliasField.HeaderText);
                        var fd = _app.filterDef(resourcesDataFilters[field.FilterType].List, field.FilterType === 'Boolean' && m[3].length > 1 ? m[3] === '%js%true' ? '$true' : '$false' : m[1]);
                        if (!fd) {
                            switch (m[1]) {
                                case '=':
                                    sb.append(String.isJavaScriptNull(m[2]) ? resources.InfoBar.Empty : resources.InfoBar.EqualTo);
                                    break;
                                case '<':
                                    sb.append(resources.InfoBar.LessThan);
                                    break;
                                case '<=':
                                    sb.append(resources.InfoBar.LessThanOrEqual);
                                    break;
                                case '>':
                                    sb.append(resources.InfoBar.GreaterThan);
                                    break;
                                case '>=':
                                    sb.append(resources.InfoBar.GreaterThanOrEqual);
                                    break;
                                case '*':
                                    sb.append(m[2].startsWith('%') ? resources.InfoBar.Like : resources.InfoBar.StartsWith);
                                    break;
                            }
                            var item = that._findItemByValue(field, that.convertStringToFieldValue(field, m[3]));
                            var v = item == null ? m[3] : item[1];
                            if (String.isJavaScriptNull(m[3]) || isBlank(v))
                                v = resources.InfoBar.Empty;
                            else
                                v = that.convertStringToFieldValue(field, v);
                            sb.appendFormat('<b>{0}</b>', String.htmlEncode(v));
                        }
                        else if (fd.Prompt) {
                            sb.appendFormat(' {0} ', fd.Text.toLowerCase());
                            //item = m[1].match(/\$(in|notin|between)\$/) ? null : this._findItemByValue(field, this.convertStringToFieldValue(field, m[3]));
                            //v = m[3] : item[1];
                            v = m[3];
                            var values = v.split(_app._listRegex);
                            if (String.isJavaScriptNull(values[0])) values[0] = resources.InfoBar.Empty;
                            if (!String.isJavaScriptNull(m[2])) {
                                var vm = values[0].match(/^([\s\S]+?)\0?$/);
                                if (vm) values[0] = vm[1];
                                v = that.convertStringToFieldValue(field, values[0]);
                                item = that._findItemByValue(field, v);
                                sb.appendFormat('<b>{0}</b>', String.htmlEncode(item ? item[1] : compressValue(v, field.format(v))));
                                for (var j = 1; j < values.length; j++) {
                                    sb.appendFormat('{0} ', m[1] === '$between$' ? ' ' + labelAnd : ', ');
                                    v = that.convertStringToFieldValue(field, values[j]);
                                    if (v == null)
                                        v = resourcesHeaderFilter.EmptyValue;
                                    else {
                                        item = that._findItemByValue(field, v);
                                        v = item ? item[1] : compressValue(v, field.format(v), true);
                                    }
                                    sb.appendFormat('<b class="{1}">{0}</b>', String.htmlEncode(v));
                                    if (j > 5) {
                                        sb.append(', ..');
                                        break;
                                    }
                                }
                            }
                        }
                        else
                            sb.appendFormat(' {0} <b>{1}</b>', resourcesDataFiltersLabels.Equals, fd.Function.match(_app._keepCapitalization) ? fd.Text : fd.Text.toLowerCase());
                    }
                    m = _app._filterIteratorRegex.exec(filter[2]);
                    first = false;
                }
                if (!first && !matchCount && !that._fieldNameHint)
                    sb.append('.');
                sb.append('</span> ');
            }
            if (matchCount)
                sb.append('. ');
            sb.append('</span>');
        },
        _findItemByValue: function (field, value) {
            var lov = field.DynamicItems || field.Items,
                itemCache = field.ItemCache;
            if (!lov.length) return null;
            if (!itemCache) {
                itemCache = field.ItemCache = {};
                $(lov).each(function () {
                    var v = this;
                    itemCache[v[0]] = v;
                });
            }
            return field.ContextFields ? [value, value] : itemCache[value] || [null, this.get_isForm() || _touch ? labelNullValueInForms : labelNullValue];
        },
        refreshAndResize: function () {
            this.goToPage(-1);
        },
        refreshData: function () {
            var that = this;
            if (!that._busy()) {
                that._clearCache();
                that.set_pageIndex(-2);
                that._loadPage();
            }
        },
        _dittoCollectedValues: function (newValues, fieldToIgnore) {
            if (this.editing()) {
                var ignoreRegex = fieldToIgnore ? new RegExp(String.format('^{0}(Length|ContentType|FileName|FullFileName)?$', fieldToIgnore)) : null;
                var values = this._collectFieldValues(true);
                var ditto = [];
                for (var i = 0; i < values.length; i++) {
                    var v = values[i];
                    if (!ignoreRegex || !v.Name.match(ignoreRegex))
                        Array.add(ditto, { 'name': v.Name, 'value': v.Modified ? v.NewValue : v.OldValue });
                }
                if (newValues) {
                    for (i = 0; i < newValues.length; i++) {
                        v = newValues[i];
                        for (var j = 0; j < ditto.length; j++) {
                            var name = v.Name ? v.Name : v.name;
                            if (ditto[j].name === name) {
                                Array.removeAt(ditto, j);
                                break;
                            }
                        }
                        Array.add(ditto, v.Name ? { 'name': v.Name, 'value': v.NewValue } : v);
                    }
                }
                this._ditto = ditto;
            }
        },
        refresh: function (noFetch, newValues, fieldToIgnore) {
            var that = this;
            that._dittoCollectedValues(newValues, fieldToIgnore);
            that._lastSelectedCategoryTabIndex = that.get_categoryTabIndex();
            if (noFetch)
                that._render();
            else {
                if (_touch) {
                    var parentDataView = that.get_parentDataView(this);
                    if (parentDataView == that)
                        that.sync();
                    else
                        parentDataView._syncKey = parentDataView.get_selectedKey();
                }
                else {
                    that.goToView(that.get_viewId());
                    that._ditto = null;
                }
            }
        },
        //    _initContext: function () {
        //        if (this._context == null) {
        //            var c = $get('__COTSTATE'); // $get(this.get_id() + '$Context');//
        //            if (c && !isNullOrEmpty(c.value))
        //                this._context =  _Sys.Serialization.JavaScriptSerializer.deserialize(c.value);
        //            else
        //                this._context = {};
        //        }
        //    },
        //    _saveContext: function () {
        //        var c = $get('__COTSTATE'); // $get(this.get_id() + '$Context'); // 
        //        if (c)
        //            c.value =  _Sys.Serialization.JavaScriptSerializer.serialize(this._context);
        //    },
        session: function (name, value, viewId) {
            var that = this,
                pageSession = that._pageSession;
            if (!pageSession)
                pageSession = that._pageSession = {};
            name = /*'_session_' + this._id + '_' +*/ (viewId || that._viewId || 'grid1') + '_' + name;
            if (arguments.length === 1)
                return pageSession[name];// $(document).data(name);
            else
                //$(document).data(name, value);
                if (value != null)
                    pageSession[name] = value;
                else
                    delete pageSession[name];
        },
        sessionRemove: function (name) {
            var that = this,
                pageSession = that._pageSession,
                list = [], p;
            if (pageSession) {
                name = that._viewId + '_' + name;
                for (p in pageSession)
                    if (!p.indexOf(name))
                        list.push(p);
                list.forEach(function (name) {
                    delete pageSession[name];
                });
            }
        },
        readContext: function (name) {
            return this.session(name);
        },
        writeContext: function (name, value) {
            this.session(name, value);
        },
        _saveViewVitals: function () {
        },
        _restoreViewVitals: function (request) {
        },
        paramValue: function (name, value) {
            if (!this._paramValues)
                this._paramValues = [];
            this._paramValues.push({ Name: name, Value: value });
        },
        _useSearchParams: function (params) {
            var paramValues = this._paramValues;
            if (paramValues) {
                this._searchParamValues = paramValues;
                this._paramValues = null;
            }
            else
                paramValues = this._searchParamValues;
            if (paramValues) {
                var values = Array.clone(params.ExternalFilter);
                for (var i = 0; i < paramValues.length; i++) {
                    var v = paramValues[i];
                    Array.add(values, { Name: v.Name, Value: v.NewValue });
                }
                params.ExternalFilter = values;
            }
        },
        _forceSync: function () {
            var that = this,
                syncKey;
            if (that._skipSync || _touch && that.get_isForm())
                that._skipSync = false;
            else {
                syncKey = that.get_selectedKey();
                if (syncKey && syncKey.length)
                    that._syncKey = syncKey;
            }
        },
        sync: function (keyValues, refreshContext) {
            var that = this, i, row, f,
                rowFilter;
            that._clearCache();
            if (keyValues) {
                that._skipAutoSelect = true;
                if (kiosk())
                    rowFilter = [];
                if (!isInstanceOfType(Array, keyValues))
                    keyValues = [keyValues];
                row = [];
                for (i = 0; i < that._keyFields.length; i++) {
                    f = that._keyFields[i];
                    row[f.Index] = keyValues[i];
                    if (rowFilter)
                        rowFilter.push(f.Name + ':=%js%' + JSON.stringify(keyValues[i]));
                    else if (!that._syncFilter)
                        that.removeFromFilter(f);
                }
                if (rowFilter)
                    that.set_filter(rowFilter);
                that._raiseSelectedDelayed = true;
                that._pendingSelectedEvent = true;
                that._selectKeyByRow(row);
                if (that.multiSelect())
                    that._selectedKeyList = [keyValues.join(',').toString()];
                if (refreshContext)
                    that._requiresContextRefresh = true;
            }
            clearTimeout(that._syncTimeout);
            that._forceSync();
            that.refreshAndResize();
            that._synced = true;
        },
        _sync: function () {
            var that = this,
                settings = that._viewColumnSettings;
            that._viewColumnSettings = [];
            that.sync();
            that._viewColumnSettings = settings;
        },
        syncOnce: function (fieldName, immediately) {
            var dataView = this,
                field = dataView.findField(fieldName),
                dataViewToSync = field ? findDataView(field._dataViewId) : dataView,
                syncFilter = dataViewToSync._createParams().ExternalFilter;

            function doSync(immediately) {
                var ownerPage = $('#' + (dataViewToSync._dataViewFieldOwnerId || dataViewToSync._id));
                clearTimeout(dataViewToSync._syncTimeout);
                if (_touch.busy() || _touch.isInTransition() || (fieldName && !field || !dataViewToSync._fields) || !immediately || !ownerPage.is('.ui-page-active'))
                    dataViewToSync._syncTimeout = setTimeout(doSync, 100, true);
                else
                    dataViewToSync.sync();
            }

            //if (force || (!syncFilter.length || jsonStringify(syncFilter) !== dataViewToSync._syncEF)) {
            //    dataViewToSync._syncEF = jsonStringify(syncFilter);
            //    doSync(false);
            //}
            doSync(immediately);
        },
        combinedFilter: function () {
            return this._combinedFilter(this.get_filter());
        },
        dataSignature: function () {
            var filter = this.combinedFilter();
            return jsonStringify(filter);
        },
        _combinedFilter: function (filter) {
            var that = this,
                advancedSearchFilter;
            if (_touch && that.asearch('active')) {
                advancedSearchFilter = that.asearch('filter');
                if (advancedSearchFilter && advancedSearchFilter.length) {
                    $(filter).each(function () {
                        if (this.startsWith('_quickfind_')) {
                            filter.splice(filter.indexOf(this), 1);
                            return false;
                        }
                    });
                    filter = (filter || []).concat(advancedSearchFilter);
                }
            }
            return filter;
        },
        _createParams: function (filterByPosition) {
            var that = this,
                lc = that.get_lookupContext(),
                viewType = that.get_viewType(),
                extension = that.extension(),
                lookupInfo = that._lookupInfo,
                contextFilter,
                ownerDataView = findDataView(that._dataViewFieldOwnerId),
                ownerDataViewField,
                syncKey = that._syncKey;

            if (isNullOrEmpty(viewType))
                viewType = that.readContext('GridType');

            if (that.get_searchOnStart() && lookupInfo && lookupInfo.value != null)
                that.set_searchOnStart(false);

            if (ownerDataView) {
                ownerDataViewField = ownerDataView.findField(that._dataViewFieldName);
                if (ownerDataViewField && ownerDataViewField.ContextFields) {
                    var externalFilter = that.get_externalFilter(),
                        externalFilterMap = {},
                        values = ownerDataView.values();
                    $(externalFilter).each(function () {
                        var fv = this;
                        externalFilterMap[fv.Name] = fv;
                    });
                    ownerDataView._fields.forEach(function (f) {
                        if (f._dataViewId && f._dataViewId !== that._id) {
                            var dv = findDataView(f._dataViewId),
                                keyFields = dv._keyFields,
                                v = [],
                                data;
                            if (keyFields) {
                                data = dv.data();
                                keyFields.forEach(function (f) {
                                    v.push(data[f.Name]);
                                });
                            }
                            if (v.length < 2)
                                if (!v.length)
                                    v = null;
                                else
                                    v = v[0];
                            else
                                v = v.join();

                            values.push({ Name: f.Name, OldValue: v });
                        }
                    });
                    $(ownerDataView.get_contextFilter(ownerDataViewField, values)).each(function () {
                        var fv = this,
                            isNull = fv.Value == null,
                            efv = externalFilterMap[fv.Name];
                        if (efv)
                            if (isNull)
                                externalFilter.splice(externalFilter.indexOf(efv));
                            else
                                efv.Value = fv.Value;
                        else if (!isNull)
                            externalFilter.push(fv);
                        if (isNull)
                            that.removeFromFilter(fv.Name);
                    });
                    that.applyExternalFilter(true);
                }
            }

            var confirmContext = that.get_confirmContext(),
                api = that._api,
                params = {
                    PageIndex: that.get_pageIndex(), PageSize: that.get_pageSize(), PageOffset: that.get_pageOffset(), SortExpression: that.get_sortExpression(), GroupExpression: that.get_groupExpression(),
                    Filter: that._combinedFilter(that.get_filter()), ContextKey: that.get_id(), /*Cookie: that.get_cookie(),*/ FilterIsExternal: that._externalFilter.length > 0,
                    LookupContextFieldName: lc ? lc.FieldName : null, LookupContextController: lc ? lc.Controller : null, LookupContextView: lc ? lc.View : null,
                    LookupContext: lc, Inserting: that.inserting(), LastCommandName: that.get_lastCommandName(), LastCommandArgument: that.get_lastCommandArgument(),
                    /*SelectedValues: that.get_selectedValues(),*/ExternalFilter: that.get_externalFilter(),
                    DoesNotRequireData: that.get_searchOnStart(), LastView: that.get_lastViewId(), Tag: that.get_tag(), RequiresFirstLetters: that.get_showFirstLetters(),
                    ViewType: viewType, SupportsCaching: sysBrowser.agent != sysBrowser.InternetExplorer || sysBrowser.version > 7 || _host != null || _app.embedded,
                    SystemFilter: extension ? extension.systemFilter() : null, RequiresRowCount: that._requiresRowCount == true,
                    QuickFindHint: _touch ? that.viewProp('quickFindHint') : null, RequiresPivot: that._requiresPivot == true, PivotDefinitions: that._pivotDefinitions ? that._pivotDefinitions : null
                };
            if (api) {
                if (that._distinctValues)
                    params.Distinct = true;
                params.SupportsCaching = false;
                if (api.DoesNotRequireData)
                    params.DoesNotRequireData = true;
                params.MetadataFilter = api.metadataFilter;
                params.FieldFilter = api.fieldFilter;
                if (api.requiresAggregates == false)
                    params.DoesNotRequireAggregates = true;
                if (api.inserting)
                    params.Inserting = true;
            }
            if (that.tagged('inline-editing'))
                params.DoesNotRequireAggregates = true;

            if (confirmContext) {
                contextFilter = Array.clone(params.ExternalFilter);
                Array.addRange(contextFilter, confirmContext.Values);
                params.ExternalFilter = contextFilter;
            }
            that._useSearchParams(params);
            if (that._position) {
                if (that._position.changing) {
                    params.PageIndex = that._position.index;
                    params.PageSize = 1;
                    params.Filter = that._position.filter;
                    params.SortExpression = that._position.sortExpression;
                    params.RequiresMetaData = true;
                }
                if (filterByPosition)
                    params.Filter = that._selectedKeyFilter;
            }
            // assign syncKey and clear them up
            if (typeof syncKey != 'boolean')
                params.SyncKey = syncKey;
            if (that.useCase('$app'))
                params.RequiresMetaData = true;
            return params;
        },
        _createArguments: function (args, view, values) {
            var that = this,
                parentDataView,
                externalFilter;
            if (!values)
                values = that._collectFieldValues();
            if (!view)
                view = that.get_viewId();
            if (args.values)
                values = Array.clone(args.values);
            if (that._paramValues) {
                values = Array.clone(values);
                Array.addRange(values, that._paramValues);
                delete that._paramVlaues;
            }
            var argumentOwner = that._inlineEditor ? findDataView(that.session('targetDataView').id) : that,
                actionArgs = {
                    CommandName: args.commandName, CommandArgument: args.commandArgument, Path: args.path, LastCommandName: that.get_lastCommandName(), Values:
                        values, ContextKey: argumentOwner.get_id(), /*Cookie: that.get_cookie(), */Controller: that.get_controller(), View: view, LastView: argumentOwner.get_lastViewId(), Tag: argumentOwner.get_tag(), Trigger: args.trigger
                };
            actionArgs.Filter = argumentOwner._combinedFilter(argumentOwner.get_filter()); // that.get_filter(); 
            actionArgs.SortExpression = argumentOwner.get_sortExpression();
            actionArgs.GroupExpression = argumentOwner.get_groupExpression();
            actionArgs.SelectedValues = argumentOwner.get_selectedValues();
            externalFilter = actionArgs.ExternalFilter = Array.clone(argumentOwner.get_externalFilter());
            if (!externalFilter.length) {
                parentDataView = argumentOwner.get_parentDataView(argumentOwner);
                if (that !== parentDataView)
                    parentDataView._externalFilter.forEach(function (fv) {
                        externalFilter.push(fv);
                    });
            }
            if (args.commandName === 'PopulateDynamicLookups')
                for (var i = 0; i < that._allFields.length; i++) {
                    var contextFilter = that.get_contextFilter(that._allFields[i], values);
                    if (contextFilter.length > 0)
                        Array.addRange(actionArgs.ExternalFilter, contextFilter);
                }
            //actionArgs.SaveLEVs = that._allowLEVs == true;
            return actionArgs;
        },
        _loadPage: function () {
            var that = this,
                survey = that._survey,
                skipInvoke = that._skipInvoke;
            if (that._isBusy)
                that._cancelWSRequest();
            that._delayedLoading = false;
            if (that._source) return;
            if (that.get_mode() != Web.DataViewMode.View) {
                that._allFields = [_field_initMethods({ Index: 0, Label: '', DataFormatString: '', AliasIndex: 0, ItemsDataController: that.get_controller(), ItemsNewDataView: that.get_newViewId(), ItemsDataView: that.get_viewId(), _dataView: that, Behaviors: [] })];
                that._fields = that._allFields;
                that._render();
            }
            else {
                if (!skipInvoke) {
                    that._busy(true);
                    that._detachBehaviors();
                    that._showWait();
                }
                var r = that._createParams();
                if (skipInvoke)
                    that._invokeArgs = r;
                else {
                    that._restoreViewVitals(r);
                    var pageArgs = { controller: that.get_controller(), view: that.get_viewId(), request: r };
                    var rules = new _businessRules(that);
                    rules.before({ commandName: 'Select', commandArgument: pageArgs.view });
                    rules.dispose();

                    if (survey && survey.result) {
                        that._onGetPageComplete(survey.result, null);
                        survey.result = null;
                    }
                    else if (that._startPage) {
                        that._onGetPageComplete(that._startPage, null);
                        that._startPage = null;
                    }
                    else
                        that._invoke('GetPage', pageArgs, Function.createDelegate(that, that._onGetPageComplete));
                }
            }
        },
        _cancelWSRequest: function () {
            var webServiceRequest = this._wsRequest;
            if (webServiceRequest) {
                this._wsRequest = null;
                if (webServiceRequest.get_executor && !webServiceRequest.completed() && (!sysBrowser.agent == sysBrowser.InternetExplorer || sysBrowser.version > 9))
                    webServiceRequest.get_executor().abort();
            }
        },
        _invoke: function (methodName, params, onSuccess, userContext, onFailure) {
            var that = this,
                servicePath = that.get_servicePath(),
                ensureJSONCompatibility = _app.ensureJSONCompatibility,
                user = _app.AccountManager.current(),
                headers = {};

            if (user && user.access_token && methodName !== 'Login')
                headers['Authorization'] = 'Bearer ' + user.access_token;

            function continueLogout() {
                _app.logout(function () {
                    _app.alert(Web.MembershipResources.Bar.UserIdle, function () {
                        location.reload();
                    });
                });
            }

            function retry(error, response, method) {
                if (_app._navigated) return;
                var statusCode = error.get_statusCode();
                if (!statusCode) {
                    _app.confirm(resourcesData.ConnectionLost,
                        function () {
                            //that._wsRequest =  _Sys.Net.WebServiceProxy.invoke(servicePath, methodName, false, params, onSuccess,
                            //    retry, userContext);
                            that._invoke(methodName, params, onSuccess, userContext, onFailure);
                        },
                        function () {
                            that._onMethodFailed(error, response, method);
                        });
                }
                else if (statusCode === 401 && methodName !== 'Login') {

                    if (!user || !user.refresh_token)
                        continueLogout();
                    else
                        _app.refreshUserToken(user, function () {
                            that._invoke(methodName, params, onSuccess, userContext, onFailure);
                            //that._wsRequest =  _Sys.Net.WebServiceProxy.invoke(servicePath, methodName, false, params, onSuccess, retry, userContext);
                        }, continueLogout);
                }
                else if (statusCode > 0) {
                    // report error only if the status code is real (greater than zero) 
                    that._onMethodFailed(error, response, method);
                    if (onFailure)
                        onFailure();
                }
            }

            that._autoRefresh(true);

            if (params.args)
                ensureJSONCompatibility(params.args.Values);
            if (params.request && params.request.Filter)
                ensureJSONCompatibility(params.request.Filter);
            if (params.request && params.request.ExternalFilter)
                ensureJSONCompatibility(params.request.ExternalFilter);

            if (servicePath.match(/\.asmx/))
                that._wsRequest = _Sys.Net.WebServiceProxy.invoke(servicePath, methodName, false, params,
                    function (result, context, method) {
                        if (result && result.ExceptionType)
                            that._onMethodFailed(
                                createInvokeError(methodName, result),
                                //{
                                //// err.get_timedOut(), err.get_exceptionType(), err.get_message(), err.get_stackTrace()
                                //get_timedOut: function () {
                                //    return false;
                                //},
                                //get_exceptionType: function () {
                                //    return result.ExceptionType;
                                //},
                                //get_message: function () {
                                //    return result.Message;
                                //},
                                //get_stackTrace: function () {
                                //    return result.StackTrace;
                                //},
                                //get_statusCode: function () {
                                //    return "HSR";
                                //}
                                //},
                                null, userContext);
                        else
                            onSuccess(result, context, method);
                    },
                    retry, userContext);
            else
                _odp.invoke(that, {
                    url: servicePath + '/' + methodName,
                    method: 'POST',
                    cache: false,
                    dataType: 'text',
                    headers: headers,
                    data: params
                }).done(function (result) {
                    var resultIsString = typeof result === 'string';
                    if (_touch && methodName === 'GetPage' && resultIsString) {
                        if (that.tagged('system-replacegetpagetemplate')) {
                            var dv = that.get_parentDataView(that);
                            dv.session('getPageTemplate', result);
                        }
                        else if (!that.session('getPageTemplate'))
                            that.session('getPageTemplate', result);
                    }
                    var data = resultIsString ? _app.parseJSON(result, that._nativeDates) : result;
                    if (data && data.RedirectUrl)
                        location.href = data.RedirectUrl;
                    else if (data && data.ExceptionType)
                        that._onMethodFailed(
                            createInvokeError(methodName, data),
                            //{
                            //// err.get_timedOut(), err.get_exceptionType(), err.get_message(), err.get_stackTrace()
                            //get_timedOut: function () {
                            //    return false;
                            //},
                            //get_exceptionType: function () {
                            //    return data.ExceptionType;
                            //},
                            //get_message: function () {
                            //    return data.Message;
                            //},
                            //get_stackTrace: function () {
                            //    return data.StackTrace;
                            //},
                            //get_statusCode: function () {
                            //    return "HSR";
                            //}
                            //},
                            null, userContext);
                    else
                        onSuccess(data, userContext);
                }).fail(function (jqXHR, textStatus, error) {
                    retry(
                        createInvokeError(methodName, error, jqXHR, textStatus),
                        //{
                        //    get_statusCode: function () { return jqXHR.status; }, get_timedOut: function () { return false; }, get_exceptionType: function () { return textStatus; },
                        //    get_message: function () { return error.message || error.Message; },
                        //    get_stackTrace: function () { return error.stack || error.StackTrace; }
                        //},
                        jqXHR, methodName);
                });
        },
        _disposeFields: function () {
            if (this._allFields) {
                for (var i = 0; i < this._allFields.length; i++) {
                    var f = this._allFields[i];
                    f._dataView = null;
                    if (f._listOfValues) Array.clear(f._listOfValues);
                }
            }
        },
        _formatViewText: function (text, lowerCase, altText) {
            var vl = this._views.length > 0 ? this._views[0].Label : (this._view ? this._view.Label : '');
            return !isNullOrEmpty(text) ? String.format(text, lowerCase == true ? vl.toLowerCase() : vl) : altText;
        },
        _autoRefresh: function (stop) {
            var that = this,
                refreshInterval = that._refreshInterval;
            if (refreshInterval) {
                if (that._riTimeout) {
                    clearTimeout(that._riTimeout);
                    that._riTimeout = null;
                }
                if (!stop) {
                    that._riTimeout = setTimeout(function () {
                        if (!that.get_isForm())
                            if (_touch)
                                that.syncOnce();
                            else
                                that.sync();
                    }, refreshInterval * 1000);
                }
            }
        },
        _clearCache: function (reset) {
            var cachedPages = this._cachedPages,
                extension,
                resetEvent = $.Event('reset.dataview.app'),
                i, p;
            if (cachedPages) {
                for (i = 0; i < cachedPages.length; i++) {
                    p = cachedPages[i];
                    Array.clear(p.rows);
                    delete p.rows;
                }
                Array.clear(cachedPages);
                delete this._cachedPages;
            }
            extension = this.extension();
            if (extension)
                extension.reset(reset == null || reset === true);
            resetEvent.dataView = this;
            $document.trigger(resetEvent);

        },
        _supportsCaching: function (viewType) {
            return viewType === 'DataSheet' || viewType === 'Grid' && _touch;
        },
        _cacheResult: function (result) {
            var pageSize = result.PageSize;
            var doCaching = result.PageSize < result.Rows.length;
            var viewType = this.get_viewType();
            if (!doCaching && !viewType)
                viewType = this.readContext('GridType');
            if (!doCaching)
                doCaching = this._supportsCaching(viewType);
            if (!doCaching && !viewType && result.Views)
                for (var i = 0; i < result.Views.length; i++) {
                    var v = result.Views[i];
                    if (v.Id === result.View) {
                        doCaching = this._supportsCaching(v.Type);
                        break;
                    }
                }

            if (doCaching && result.SupportsCaching) {
                var rows = result.Rows;
                result.Rows = [];
                var cachedPages = this._cachedPages;
                if (!cachedPages)
                    cachedPages = this._cachedPages = [];
                var pageIndex = result.PageIndex;
                var startIndex = 0;
                var endIndex = pageSize - 1;
                if (pageIndex > 0)
                    if (rows.length <= pageSize * 2) {
                        startIndex = pageSize;
                        endIndex = rows.length - 1;
                    }
                    else {
                        startIndex += pageSize;
                        endIndex += pageSize;
                    }
                // copy the request page back to the result 
                var page = { index: pageIndex, rows: [] };
                for (i = startIndex; i <= endIndex; i++) {
                    var r = rows[i];
                    if (r) {
                        //Array.add(result.Rows, Array.clone(r));
                        result.Rows.push(r.slice(0));
                        //Array.add(page.rows, r);
                        page.rows.push(r);
                    }
                }
                // cache the previous page
                var prevPage = null;
                if (startIndex > 0) {
                    prevPage = { index: pageIndex - 1, rows: [] };
                    for (i = 0; i < startIndex; i++)
                        //Array.add(prevPage.rows, rows[i]);
                        prevPage.rows.push(rows[i]);
                }
                // cache the next page
                var nextPage = null;
                if (endIndex < rows.length - 1) {
                    nextPage = { index: pageIndex + 1, rows: [] };
                    for (i = endIndex + 1; i < rows.length; i++)
                        //Array.add(nextPage.rows, rows[i]);
                        nextPage.rows.push(rows[i]);
                }
                i = 0;
                while (i < cachedPages.length) {
                    var p = cachedPages[i];
                    if (page != null && p.index == page.index) {
                        cachedPages[i] = page;
                        page = null;
                    }
                    else if (prevPage != null && p.index == prevPage.index) {
                        cachedPages[i] = prevPage;
                        prevPage = null;
                    }
                    else if (nextPage != null && p.index == nextPage.index) {
                        cachedPages[i] = nextPage;
                        nextPage = null;
                    }
                    else
                        i++;
                }
                if (page || prevPage || nextPage) {
                    if (cachedPages.length > 100) {
                        cachedPages.splice(0, 3);
                        //Array.removeAt(cachedPages, 0);
                        //Array.removeAt(cachedPages, 0);
                        //Array.removeAt(cachedPages, 0);
                    }
                    if (page)
                        //Array.add(cachedPages, page);
                        cachedPages.push(page);
                    if (prevPage)
                        //Array.add(cachedPages, prevPage);
                        cachedPages.push(prevPage);
                    if (nextPage)
                        //Array.add(cachedPages, nextPage);
                        cachedPages.push(nextPage);
                }
            }
        },
        _onGetPageComplete: function (result) {
            var that = this,
                serverNewRow = result.NewRow,
                newRow = serverNewRow,
                resultFields = result.Fields || [],
                // _Sys_Services = _Sys.Services,
                // _Sys_Services_AuthenticationService = _Sys_Services && _Sys_Services.AuthenticationService,
                i, expressions;
            if (that._syncKey)
                that._syncKey = null;
            that._busy(false);
            if (that._completeCallback) {
                var completeCallback = that._completeCallback;
                that._completeCallback = null;
                completeCallback.call(this, result);
                that._completeConfig = null;
                return;
            }
            configureDefaultValues(result, getPagePropertiesWithEmptyArrayDefault, []);
            //if (_Sys_Services_AuthenticationService && _Sys_Services_AuthenticationService.get_isLoggedIn && _Sys_Services_AuthenticationService.get_isLoggedIn() && !result.IsAuthenticated) {
            //    //window.location.reload();
            //    location.replace(_app.unanchor(location.href));
            //    return;
            //}
            if (!that._fields)
                that._viewId = result.View;
            if (that._containerIsHidden) {
                _Sys.UI.DomElement.setVisible(that._container, true);
                that._containerIsHidden = false;
            }
            that.set_tag(result.Tag);
            if (result.FirstLetters !== '')
                that._firstLetters = result.FirstLetters ? result.FirstLetters.split(/,/) : null;
            var positionChanged = that._position && that._position.changed;
            that._cacheResult(result);
            if (that._pageIndex < 0 || positionChanged) {
                if (this._pageIndex === -1 || positionChanged) {
                    _businessRules.reset(that._controller);
                    that._disposeFields();
                    expressions = that._expressions = result.Expressions;
                    that._detachBehaviors();
                    that._allFields = resultFields;
                    that._mapOfAllFields = {};
                    that._fields = [];
                    var selectedKeyMap = [];
                    if (that._keyFields && this._selectedKey.length > 0) {
                        for (i = 0; i < that._keyFields.length; i++)
                            selectedKeyMap[i] = { 'name': this._keyFields[i].Name, 'value': that._selectedKey[i] };
                        that._selectedKey = [];
                    }
                    that._keyFields = [];
                    var hasStatusField = false,
                        hasMapFields = false,
                        mapFields = [],
                        keyMapFields = 0,
                        viewType;

                    $(result.Views).each(function () {
                        var v = this;
                        if (result.View === v.Id) {
                            v.HeaderText = result.ViewHeaderText;
                            if (that.tagged('view-type-inline-editor')) {
                                v.Type = 'Form';
                                v.HeaderText = null;
                                that._inlineEditor = true;
                                that.tag('modal-fit-content');
                            }
                            else
                                v.Layout = result.ViewLayout;
                            viewType = v.Type;
                        }
                        if (v.ShowInSelector == null)
                            v.ShowInSelector = true;
                    });
                    that._views = result.Views;

                    var hasPrimaryKey;
                    if (viewType === 'Form') {
                        for (i = 0; i < resultFields.length; i++)
                            if (resultFields[i].IsPrimaryKey) {
                                hasPrimaryKey = true;
                                break;
                            }
                        if (!hasPrimaryKey)
                            resultFields.push({ Name: 'sys_pk_', ReadOnly: true, Type: 'Int32', IsPrimaryKey: true, Hidden: true });
                    }

                    i = 0;
                    $(resultFields).each(function () {
                        var f = this;
                        that._mapOfAllFields[f.Name] = f;
                        f.OriginalIndex = f.Index = i++;
                        configureDefaultProperties(f);
                        if (f.Name === 'Status')
                            hasStatusField = true;
                    });

                    if (!hasStatusField)
                        that._mapOfAllFields['Status'] = resultFields[resultFields.length] = { 'Name': 'Status', 'ReadOnly': true, 'Type': 'String', 'AllowNulls': true, 'Hidden': true, 'Index': resultFields.length, '_system': true, HeaderText: resourcesODP.Status };

                    var displayFieldList = _app._commandLine.match(/\W_display=(.+?)(&|$)/),
                        field, fieldIndex,
                        filterSource,
                        fieldName;
                    for (i = 0; i < resultFields.length; i++) {
                        field = resultFields[i];
                        fieldIndex = field.Index;
                        fieldName = field.Name;
                        filterSource = field.DataViewFilterSource;
                        field.tagged = _field_tagged;
                        field.is = _field_is;
                        field.tag = _field_tag;
                        var fa = !isNullOrEmpty(field.AliasName) ? this.findField(field.AliasName) : null,
                            copyInfo, copyField;
                        field.AliasIndex = fa ? fa.Index : i;
                        if (fa)
                            fa.OriginalIndex = fieldIndex;
                        if (field.ItemsDataController && !field.ItemsTargetController) {
                            if (!field.AliasName && !field._autoAlias && /*field.Type != 'String' && */ field.ItemsDataValueField !== field.ItemsDataTextField && viewType === 'Form')
                                field._autoAlias = true;
                            if (field._autoAlias) {
                                var lookupFieldAutoAlias = { Name: fieldName + '_auto_alias_', ReadOnly: true, Type: 'String', Index: resultFields.length, Label: field.Label, AllowNulls: true, Items: [], htmlEncode: true, Hidden: true, OriginalIndex: fieldIndex };
                                configureDefaultProperties(lookupFieldAutoAlias);
                                lookupFieldAutoAlias.AliasIndex = lookupFieldAutoAlias.Index;
                                field.AliasIndex = lookupFieldAutoAlias.Index;
                                resultFields.push(lookupFieldAutoAlias);
                                that._mapOfAllFields[lookupFieldAutoAlias.Name] = lookupFieldAutoAlias;
                                if (field.Items && newRow) {
                                    var newVal = newRow[fieldIndex];
                                    if (newVal) $(field.Items).each(function (i, v) { if (v[0] == newVal) newRow[lookupFieldAutoAlias.Index] = v[1]; });
                                }
                            }
                        }
                        if (kiosk() && that._lookupInfo) {
                            var lookupInfoField = that._lookupInfo.field,
                                lookupInfoFieldCopy = lookupInfoField.Copy;
                            if (lookupInfoField.ItemsStyle !== 'Lookup') {
                                if (!(field.Name === lookupInfoField.ItemsDataTextField || lookupInfoFieldCopy && lookupInfoFieldCopy.match(new RegExp('=' + field.Name + '\\b'))))
                                    field.Hidden = true;
                            }
                        }
                        if ((!field.Hidden || displayFieldList) && that._fieldIsInExternalFilter(field) && that.get_hideExternalFilterFields()) {
                            var isHidden = field.Hidden;
                            //if (_app.touch && that.get_viewType() == 'Form')
                            //    field.TextMode = 4;
                            //else
                            field.Hidden = true;
                            if (field.Copy)
                                while (copyInfo = _app._fieldMapRegex.exec(field.Copy)) {
                                    copyField = this.findField(copyInfo[1]);
                                    if (copyField && copyField.ReadOnly)
                                        copyField.Hidden = true;
                                }
                            if (displayFieldList && Array.indexOfCaseInsensitive(displayFieldList[1].split(','), fieldName) != -1) {
                                if (!isHidden)
                                    field.Hidden = false;
                                if (this.inserting()) {
                                    var valueRegex = new RegExp(String.format('\\W{0}=(.*?)(&|$)', fieldName));
                                    var valueMatch = _app._commandLine.match(valueRegex);
                                    if (valueMatch) {
                                        if (!newRow)
                                            newRow = [];
                                        newRow[i] = decodeURIComponent(valueMatch[1]);
                                    }
                                }
                            }
                        }
                        if (filterSource && field.Type === 'DataView') {
                            var visExp,
                                viewId = result.View,
                                visExpTest = '!$row.' + filterSource + '._ready||$row.' + filterSource + '._selected';
                            if (!expressions)
                                expressions = this._expressions = [];
                            $(expressions).each(function () {
                                var exp = this;
                                if (exp.Scope === 3 && exp.Target === field.Name && exp.ViewId === viewId)
                                    visExp = exp;
                                return !!visExp;
                            });
                            if (visExp)
                                visExp.Test = visExpTest + '&&(' + visExp.Test + ')';
                            else
                                expressions.push({ Type: 1, Scope: 3, Target: fieldName, ViewId: viewId, Test: visExpTest });
                        }
                        field.Behaviors = [];
                        var persist = field.is('persist');
                        if (persist) {
                            field._persist = persist;
                            if (fieldIndex !== field.AliasIndex)
                                resultFields[field.AliasIndex]._persist = persist;
                        }
                    }
                    if (_app.newValues) {
                        if (!this._ditto)
                            this._ditto = [];
                        this._ditto = this._ditto.concat(_app.newValues);
                        _app.newValues = null;
                    }
                    if (newRow && this._ditto)
                        for (i = 0; i < resultFields.length; i++) {
                            field = resultFields[i];
                            if (newRow[i] != null)
                                for (var j = 0; j < this._ditto.length; j++)
                                    if (this._ditto[j].name === field.Name && !this._ditto[j].duplicated) {
                                        Array.removeAt(this._ditto, j);
                                        break;
                                    }
                        }
                    this._ignoreNewRow = true;
                    this._hasDynamicLookups = false;
                    this._requiresConfiguration = false;
                    var colIndex = 0;
                    for (i = 0; i < resultFields.length; i++) {
                        field = resultFields[i];
                        field._dataView = this;
                        if (!field.Hidden) Array.add(this._fields, field);
                        if (field.IsPrimaryKey) {
                            Array.add(this._keyFields, field);
                            for (j = 0; j < selectedKeyMap.length; j++) {
                                if (selectedKeyMap[j].name === field.Name) {
                                    Array.add(this._selectedKey, selectedKeyMap[j].value);
                                    break;
                                }
                            }
                        }
                        //if (isNullOrEmpty(field.HeaderText)) field.HeaderText = field.Label;
                        //if (isNullOrEmpty(field.HeaderText)) field.HeaderText = field.Name;
                        field.FilterType = 'Number';
                        switch (field.Type) {
                            case 'Time':
                            case 'String':
                                field.FilterType = 'Text';
                                break;
                            case 'Date':
                            case 'DateTime':
                            case 'DateTimeOffset':
                                field.FilterType = 'Date';
                                break;
                            case 'Boolean':
                                field.FilterType = 'Boolean';
                                break;
                        }
                        if (field.OnDemand) {
                            var blobFieldName = field.Name,
                                lengthField = that.findField(blobFieldName + 'Length') || that.findField(blobFieldName + 'LENGTH') || that.findField(blobFieldName + 'length') || that.findField('Length') || that.findField('LENGTH') || that.findField('length');
                            if (lengthField)
                                lengthField._smartSize = true;
                            if (!field.OnDemandStyle && !this.inserting()) {
                                if (!that._headerImageField)
                                    that._headerImageField = field;
                                if (field.tagged('header-image'))
                                    that._headerImageField = field;
                            }
                        }
                        var searchOptions = field.SearchOptions;
                        if (searchOptions)
                            searchOptions = searchOptions.replace(/\$quickfind(\w+)?\s*/gi, '');
                        if (!isBlank(searchOptions) && !(__tf != 4)) {
                            searchOptions = searchOptions.replace(/\s+/g, ',').split(/,/);
                            field.AllowAutoComplete = !Array.contains(searchOptions, '$disableautocomplete');
                            if (!field.AllowAutoComplete)
                                Array.remove(searchOptions, '$disableautocomplete');
                            field.AllowSamples = !Array.contains(searchOptions, '$disablesamples');
                            if (!field.AllowSamples)
                                Array.remove(searchOptions, '$disablesamples');
                            field.AllowMultipleValues = !Array.contains(searchOptions, '$disablemultiplevalues');
                            if (!field.AllowMultipleValues)
                                Array.remove(searchOptions, '$disablemultiplevalues');
                            field.AutoCompleteAnywhere = Array.contains(searchOptions, '$autocompleteanywhere');
                            if (field.AutoCompleteAnywhere) {
                                Array.remove(searchOptions, '$autocompleteanywhere');
                                resultFields[field.AliasIndex].AutoCompleteAnywhere = true;
                            }
                            j = 0;
                            var includeMissingOptions = false;
                            while (j < searchOptions.length) {
                                var so = searchOptions[j] = searchOptions[j].trim();
                                if (so === '*')
                                    includeMissingOptions = true;
                                if (so.length > 0 && so !== '*')
                                    j++;
                                else
                                    Array.removeAt(searchOptions, j);
                            }
                            if (includeMissingOptions && searchOptions.length > 0) {
                                var filterDef = resourcesDataFilters[field.FilterType];
                                this._enumerateMissingSearchOptions(searchOptions, filterDef.List);
                            }
                            if (Array.contains(searchOptions, '$in') && !Array.contains(searchOptions, '$notin'))
                                Array.add(searchOptions, '$notin');
                            field.SearchOptions = !searchOptions.length ? null : searchOptions;
                            // this line is for compatibility with legacy projects only
                            if (field.SearchOptions && _touch && field.OriginalIndex !== field.Index)
                                resultFields[field.OriginalIndex].SearchOptions = field.SearchOptions;
                        }
                        else
                            field.SearchOptions = null;
                        //field.format = _field_format;
                        //field.toColumns = _field_toColumns;
                        //field.isReadOnly = _field_isReadOnly;
                        //field.isNumber = _field_isNumber;
                        //field.lov = _field_lov;
                        //field.text = _field_text;
                        //field.trim = _field_trim;
                        //field.htmlEncode = _field_htmlEncode;
                        _field_initMethods(field);
                        _field_prepareDataFormatString(this, field);
                        var itemsStyle = field.ItemsStyle,
                            fieldItems = field.Items,
                            itemsDataController = field.ItemsDataController;
                        if (field.Type === 'Boolean') {
                            if (!fieldItems.length) {
                                fieldItems = field.Items = Array.clone(field.AllowNulls ? resourcesData.BooleanOptionalDefaultItems : resourcesData.BooleanDefaultItems);
                                if (!itemsStyle)
                                    itemsStyle = field.ItemsStyle = resourcesData.BooleanDefaultStyle;
                            }
                            else
                                $(fieldItems).each(function () {
                                    var v = this[0];
                                    if (typeof v == 'string')
                                        this[0] = v.length ? v === 'true' : null;
                                });
                        }
                        if (fieldItems && fieldItems.length > 0 && (field.AllowNulls && !field.ItemsTargetController || itemsStyle === 'DropDownList' && !itemsDataController) && !isNullOrEmpty(fieldItems[0][0]) && itemsStyle != 'CheckBoxList' && !field.tagged('lookup-null-value-none'))
                            //fieldItems.splice(0, 0, [null, field.tagged('lookup-null-value-any') ? resourcesData.AnyValue : field.tagged('lookup-null-value-placeholder') ? field.Watermark : labelNullValueInForms]);
                            injectNullValue(field, fieldItems);
                        if (itemsStyle) {
                            if (itemsStyle === 'Actions') {
                                itemsStyle = field.ItemsStyle = 'ListBox';
                                field._actionGroup = true;
                            }
                            if (field.ContextFields && itemsStyle !== 'Lookup' && itemsStyle !== 'AutoComplete' && itemsDataController) {
                                this._hasDynamicLookups = true;
                                field.ItemsAreDynamic = true;
                            }
                            else if (itemsStyle === 'UserNameLookup') {
                                field.ItemsStyle = 'Lookup';
                                field.ItemsDataController = 'aspnet_Membership';
                                field.ItemsDataTextField = 'UserUserName';
                                field.ItemsDataValueField = 'UserUserName';
                                field.ItemsValueSyncDisabled = true;
                                if (hasAccessToMembership())
                                    field.ItemsNewDataView = 'createForm1';
                                else {
                                    field.ItemsDataView = 'lookup';
                                    field.ItemsDataTextField = 'UserName';
                                    field.ItemsDataValueField = 'UserName';
                                    field.Tag = 'lookup-details-hidden';
                                }
                                //if (Web.Menu.findNode('/Membership.aspx'))
                                //    field.ItemsNewDataView = 'createForm1';
                            }
                            else if (itemsStyle === 'UserIdLookup') {
                                field.ItemsStyle = 'Lookup';
                                field.ItemsDataController = 'aspnet_Membership';
                                field.ItemsDataTextField = 'UserUserName';
                                field.ItemsDataValueField = 'UserId';
                                if (hasAccessToMembership())
                                    field.ItemsNewDataView = 'createForm1';
                                else {
                                    field.ItemsDataView = 'lookup';
                                    field.ItemsDataTextField = 'UserName';
                                    field.Tag = 'lookup-details-hidden';
                                }
                                //if (Web.Menu.findNode('/Membership.aspx'))
                                //    field.ItemsNewDataView = 'createForm1';
                            }
                            if (that._inlineEditor && _touch.pointer('mouse'))
                                if (itemsStyle === 'RadioButtonList' || itemsStyle === 'ListBox') {
                                    field.OriginalItemsStyle = itemsStyle;
                                    field.ItemsStyle = 'DropDownList';
                                }
                        }
                        if (!isNullOrEmpty(field.ToolTip))
                            field.ToolTip = _app.htmlAttributeEncode(field.ToolTip);
                        if (!field.Watermark && !field.AllowNulls && (!fieldItems || !fieldItems.length))
                            field.Watermark = resourcesValidator.Required;
                        if (!isNullOrEmpty(field.Configuration))
                            this._requiresConfiguration = true;
                        if (field.AllowLEV) this._allowLEVs = true;
                        if (field.TextMode === 2 && isNullOrEmpty(field.Editor)) {
                            if (!_touch)
                                if (_Sys.Extended.UI.HtmlEditorExtenderBehavior || typeof CKEDITOR != 'undefined')
                                    field.ClientEditor = 'Web$DataView$RichText';
                                else
                                    field.Editor = 'RichEditor';
                            field.HtmlEncode = false;
                        }

                        if (!_touch && field.Editor)
                            if (this._executeClientEditorFactories(field)) {
                                field.ClientEditor = field.Editor;
                                field.Editor = null;
                            }
                            else
                                field.EditorId = String.format('{0}_Item{1}', this.get_id(), field.Index);
                        field.ColIndex = !field.Hidden ? colIndex++ : -1;

                        var wdvg = _app.Geo;
                        if (field.tagged('header-text'))
                            that._headerField = field;
                        if (field.tagged('modified-', 'created-') && field.tagged('modified-latitude', 'modified-longitude', 'modified-coords', 'created-latitude', 'created-longitude', 'created-coords')) {
                            field._geocode = true;
                            var geoQueue = _app.GeoQueue;
                            _geolocation = _host ? _host.geolocation : navigator.geolocation;
                            if (_geolocation) {
                                if (!geoQueue)
                                    geoQueue = _app.GeoQueue = [];
                                if (!field.tagged('created-') || that.inserting()) {
                                    if (!that._geoCookie)
                                        that._geoCookie = new Date().getTime();
                                    geoQueue.push({ dv: that._id, field: field.Name, cookie: that._geoCookie });
                                }
                                field.TextMode = 4;
                                if (_locationWatchId == null)
                                    _locationWatchId = _geolocation.watchPosition(geolocationPostionChanged,
                                        function (error) {
                                            wdvg.error = error;
                                            wdvg.acquired = false;
                                        });
                            }
                        }
                        if (!hasMapFields)
                            if (field.tagged('map-') && !field.tagged('map-none'))
                                hasMapFields = true;
                            else {
                                var mf = field.Name.match(/\b(address|city|state|region|postal(.*?)code|zip(.*?)code|zip|country)\b/i);
                                if (mf && !field.tagged('map-none')) {
                                    mf = mf[1].toLowerCase();
                                    mapFields.push({ field: field, tag: mf });
                                    if (mf.match(/address|city/))
                                        keyMapFields++;
                                }
                            }
                    }
                    if (!that._fields.length) {
                        that._fields.push(resultFields[0]);
                        resultFields[0].Hidden = false;
                    }
                    this.untag('supports-view-style-map');
                    if (!hasMapFields && keyMapFields === 2) {
                        hasMapFields = true;
                        $(mapFields).each(function () {
                            this.field.tag('map-' + this.tag);
                            if (this.tag === 'address')
                                this.field.tag('action-location');
                        });
                    }
                    if (hasMapFields)
                        this.tag('supports-view-style-map');
                    if (result.LEVs) this._recordLEVs(result.LEVs);
                    //$(result.Views).each(function () {
                    //    var v = this;
                    //    if (result.View == v.Id) {
                    //        v.HeaderText = result.ViewHeaderText;
                    //        v.Layout = result.ViewLayout;
                    //    }
                    //    if (v.ShowInSelector == null)
                    //        v.ShowInSelector = true;
                    //});
                    //that._views = result.Views;
                    var viewTags = that.get_view().Tags;
                    if (viewTags)
                        that.tag(viewTags);
                    if (that.tagged('header-image-none'))
                        that._headerImageField = null;
                    var persistView = that.tagged(/\bpersist\-(session|user)-(\w+)\b/);
                    that._persist = persistView ? { scope: persistView[1], command: persistView[2] } : null;
                    that._view = null;
                    if (!this._lastViewId && !this.get_isForm()/* this.get_view().Type != 'Form'*/)
                        this._lastViewId = result.View;
                    that._actionGroups = result.ActionGroups ? result.ActionGroups : [];
                    that._statusBar = result.StatusBar;
                    var whenTest = /^(true|false)\:(.+)$/,
                        idCounter = 0;
                    that._actionColumn = null;
                    var dynamicActions = that._dynamicActions = {};
                    for (i = 0; i < this._actionGroups.length; i++) {
                        var ag = this._actionGroups[i];
                        ag.maxTextLength = 0;
                        ag.groupText = [];
                        //if (ag.Scope == 'Grid' && this.get_isTree())
                        //    Array.insert(ag.Actions, 0, { 'CommandName': 'Open' });
                        var agt = resourcesActionsScopes[ag.Scope];
                        if (agt && agt._Self) {
                            var ast = agt._Self[ag.HeaderText];
                            if (ast) ag.HeaderText = ast.HeaderText;
                        }
                        if (ag.Scope === 'ActionColumn')
                            this._actionColumn = !isNullOrEmpty(ag.HeaderText) ? ag.HeaderText : resourcesGrid.ActionColumnHeaderText;
                        if (!ag.Id)
                            ag.Id = 'auto' + idCounter++;
                        ag.CssClassEx = String.format('Actions-g-{0} ', ag.Id);
                        for (j = 0; j < ag.Actions.length; j++) {
                            var action = ag.Actions[j],
                                actionCommandName = action.CommandName || '';
                            if (!action.Id)
                                action.Id = 'auto' + idCounter++;
                            if (action.CausesValidation == null)
                                action.CausesValidation = true;
                            //if (actionCommandName == null)
                            //    actionCommandName = action.CommandName = '';
                            action.Path = String.format('{0}/{1}', ag.Id, action.Id);
                            var confirmation = action.Confirmation;
                            if (actionCommandName === 'Search') {
                                this._hasSearchAction = action.Path;
                                this._hasSearchShortcut = confirmation && confirmation.match(/_shortcut\s*=\s*true/);
                            }
                            action.CssClassEx = String.format('Actions-g-{0}-a-{1} ', ag.Id, action.Id);
                            if (agt && isNullOrEmpty(action.HeaderText)) {
                                var at = agt[actionCommandName];
                                if (at) {
                                    var at2;
                                    if (at.CommandArgument) {
                                        at2 = at.CommandArgument[action.CommandArgument];
                                        if (at2) at = at2;
                                    }
                                    if (at.WhenLastCommandName) {
                                        at2 = at.WhenLastCommandName[action.WhenLastCommandName];
                                        if (at2) at = at2;
                                    }
                                    if (at.Controller) {
                                        at2 = at.Controller[this._controller];
                                        if (at2) at = at2;
                                    }
                                    if (actionCommandName === 'Confirm' && that._confirmContext && that._confirmContext.action.CommandName === 'Search') {
                                        action.HeaderText = labelSearch;
                                        action.Key = 'Enter';
                                    }
                                    else
                                        action.HeaderText = at.HeaderText;
                                    action._autoHeaderText = true;
                                    if (!isNullOrEmpty(at.HeaderText) && at.HeaderText.indexOf('{') >= 0)
                                        action.HeaderText = at.VarMaxLen != null && result.Views[0].Label.length > at.VarMaxLen ? at.HeaderText2 : this._formatViewText(at.HeaderText);
                                    if (isNullOrEmpty(action.Description))
                                        action.Description = this._formatViewText(at.Description);
                                    if (isNullOrEmpty(confirmation))
                                        action.Confirmation = at.Confirmation;
                                    if (!action.Notify)
                                        action.Notify = at.Notify;
                                }
                                else
                                    action.HeaderText = actionCommandName;
                            }
                            if (isNullOrEmpty(action.WhenView))
                                action.WhenViewRegex = null;
                            else {
                                var m = whenTest.exec(action.WhenView);
                                action.WhenViewRegex = new RegExp(m ? m[2] : action.WhenView);
                                action.WhenViewRegexResult = m ? m[1] !== 'false' : true;
                            }
                            if (isNullOrEmpty(action.WhenTag))
                                action.WhenTagRegex = null;
                            else {
                                m = whenTest.exec(action.WhenTag);
                                action.WhenTagRegex = new RegExp(m ? m[2] : action.WhenTag);
                                action.WhenTagRegexResult = m ? m[1] !== 'false' : true;
                            }
                            if (isNullOrEmpty(action.WhenHRef))
                                action.WhenHRefRegex = null;
                            else {
                                m = whenTest.exec(action.WhenHRef);
                                action.WhenHRefRegex = new RegExp(m ? m[2] : action.WhenHRef);
                                action.WhenHRefRegexResult = m ? m[1] !== 'false' : true;
                            }
                            if (action.HeaderText) {
                                ag.maxTextLength = Math.max(action.HeaderText.length, ag.maxTextLength);
                                ag.groupText.push(action.HeaderText);
                            }
                            if (action.WhenClientScript) {
                                dynamicActions[ag.Scope] = 1;
                                dynamicActions[ag.Id] = 1;
                                dynamicActions[action.Path] = 1;
                            }
                        }
                    }
                    var numberOfColumns = 1;
                    var hasColumns = false;
                    var categories = this._categories = result.Categories;
                    this._tabs = [];
                    for (i = 0; i < categories.length; i++) {
                        var c = categories[i];
                        c.Index = i;
                        if (c.Tab == null)
                            c.Tab = '';
                        if (!isNullOrEmpty(c.Tab) && !Array.contains(this._tabs, c.Tab))
                            Array.add(this._tabs, c.Tab);
                        if (c.Flow === 'NewColumn') {
                            if (i > 0) numberOfColumns++;
                            hasColumns = true;
                        }
                        c.ColumnIndex = numberOfColumns - 1;
                        if (c.Id) {
                            var t = $get(String.format('{0}_{1}_{2}', result.Controller, result.View, c.Id));
                            if (t)
                                c.Template = t.innerHTML;
                        }
                        if (c.Floating && isNullOrEmpty(c.Template)) {
                            var sb = new _Sys_StringBuilder('<div class="FloatingCategoryHeader"></div>');
                            for (j = 0; j < this._allFields.length; j++) {
                                var f = this._allFields[j];
                                if (!f.Hidden && i === f.CategoryIndex)
                                    sb.appendFormat('<div class="FieldPlaceholder">{{{0}}}</div>', f.Name);
                            }
                            c.Template = sb.toString();
                        }
                    }
                    if (this._tabs.length > 0) {
                        for (i = 0; i < categories.length; i++) {
                            c = categories[i];
                            if (isNullOrEmpty(c.Tab)) {
                                if (!isNullOrEmpty(categories[0].Tab))
                                    c.Tab = categories[0].Tab;
                                else {
                                    c.Tab = resources.Form.GeneralTabText;
                                    if (this._tabs[0] !== resources.Form.GeneralTabText)
                                        Array.insert(this._tabs, 0, resources.Form.GeneralTabText);
                                }
                            }
                            c.ColumnIndex = 0;
                        }
                        if (this._lastSelectedCategoryTabIndex != null) {
                            var focusedFieldName = this._focusedFieldName;
                            this.set_categoryTabIndex(!(this._lastSelectedCategoryTabIndex >= 0) || focusedFieldName && focusedFieldName.startsWith('_Annotation_') ? this._tabs.length - 1 : 0);
                            delete this._lastSelectedCategoryTabIndex;
                        }
                        else
                            this.set_categoryTabIndex(0);
                        var iconDataView = this.get_parentDataView(this); // this._parentDataViewId ? _app.find(this._parentDataViewId) : this;
                        if (iconDataView._lastClickedIcon === 'Attachment')
                            this.set_categoryTabIndex(this._tabs.length - 1);
                        iconDataView._lastClickedIcon = null;
                        numberOfColumns = 1;
                    }
                    else
                        this.set_categoryTabIndex(-1);
                    if (!_touch)
                        this._numberOfColumns = hasColumns && !this._get_template() ? numberOfColumns : 0;
                }
                this._filter = result.Filter;
                this._sortExpression = result.SortExpression;
                this._groupExpression = result.GroupExpression;
                this._updatePageCount(result, positionChanged);
                var pagerButtonCount = this.get_pagerButtonCount(true);
                this._firstPageButtonIndex = Math.floor(result.PageIndex / pagerButtonCount) * pagerButtonCount;
                if (_odp) // for compatibiity with Project Designer
                    _odp.verify(that);
            }
            else if (this._requiresRowCount) {
                this._requiresRowCount = false;
                this._updatePageCount(result, false);
            }
            for (i = 0; i < resultFields.length; i++) {
                field = resultFields[i];
                var aliasField = resultFields[field.AliasIndex];
                if (field.AllowAutoComplete === false)
                    aliasField.AllowAutoComplete = false;
                if (field.AllowSamples === false)
                    aliasField.AllowSamples = false;
                if (field.AllowMultipleValues === false)
                    aliasField.AllowMultipleValues = false;
            }
            that._icons = result.Icons;
            if (!that.inserting()) {
                var identifySelectedRow = false;
                if (that._rows) {
                    if (!that._rows.length || !result.Rows.length)
                        delete that._viewColumnSettings;
                    for (i = 0; i < that._rows.length; i++)
                        Array.clear(that._rows[i]);
                    Array.clear(that._rows);
                    identifySelectedRow = that.get_isGrid();
                }
                that._rows = result.Rows;
                if (identifySelectedRow) {
                    that._selectedRowIndex = null;
                    for (i = 0; i < that._rows.length; i++)
                        if (that._rowIsSelected(i)) {
                            that._selectedRowIndex = i;
                            break;
                        }
                }
            }
            that._newRow = newRow = newRow ? newRow : [];
            if (result.Aggregates) that._aggregates = result.Aggregates;
            if (that.get_isForm()/* this.get_view().Type == 'Form'*/ && that._selectedRowIndex == null && that._totalRowCount > 0) {
                that._selectedRowIndex = 0;
                that._selectKeyByRowIndex(0);
            }

            if (positionChanged) {
                that._position.changed = true;
                that._selectKeyByRowIndex(0);
            }
            if (_touch) {
                var levRow, persistUser,
                    allFields = that._allFields,
                    viewPersist = that._persist,
                    viewPersistedValues,
                    persistedValue;
                if (that.inserting())
                    levRow = newRow;
                else if (that.editing())
                    levRow = that._rows[0];
                if (levRow)
                    for (i = 0; i < allFields.length; i++) {
                        field = allFields[i];
                        persist = field._persist;
                        if (persist && levRow[i] == null) {
                            if (!persistUser)
                                persistUser = (persist === 'user' ? _app.userVar : _app.sessionVar)('persistVars') || {};
                            persistedValue = levRow[i] = persistUser[field.Name];
                            if (persistedValue != null)
                                that._showClearAll = true;
                        }
                    }
                if (viewPersist) {
                    viewPersistedValues = (viewPersist.scope === 'user' ? _app.userVar : _app.sessionVar)('persist_' + that._controller + '_' + that._viewId);
                    if (viewPersistedValues) {
                        viewPersistedValues = _serializer.deserialize(viewPersistedValues);
                        $(viewPersistedValues).each(function () {
                            var fv = this,
                                field = that.findField(fv.Name);
                            if (field && fv.Modified && levRow[field.Index] == null) {
                                persistedValue = levRow[field.Index] = fv.NewValue;
                                if (persistedValue != null)
                                    that._showClearAll = true;
                            }
                        });
                    }
                }



                if (that.get_isGrid()) {
                    var syncMap = _app.syncMap[that._controller];
                    if (!syncMap)
                        syncMap = _app.syncMap[that._controller] = {};
                    syncMap[that._id + '_' + that._viewId] = false;
                    that._autoSelect();
                }
            }
            if (serverNewRow && that.odp)
                that.set_selectedKey(that.odp.key(that));
            that._render(true);
            if (!_touch) {
                if (that.get_lookupField())
                    that._adjustLookupSize();
                if (that._isInInstantDetailsMode()) {
                    var size = $common.getClientBounds();
                    var contentSize = $common.getContentSize(document.body);
                    resizeBy(0, contentSize.height - size.height);
                }
                that._saveViewVitals();
                if (that._pendingSelectedEvent) {
                    that._pendingSelectedEvent = false;
                    that.updateSummary();
                }
                that._registerFieldHeaderItems();
                _body_resize();
            }
            that._executeSecondCommand();
            that._autoRefresh();
            if (!_touch)
                that._autoSelect();
            if (!isNullOrEmpty(result.ClientScript))
                eval(result.ClientScript);
            //var rules = _app.rules[that._controller],
            //    afterCommandName = serverNewRow ? 'New' : 'Select',
            //    afterArgs = { commandName: afterCommandName, commandArgument: result.View, view: result.View };
            //if (rules) {
            //    rules = rules.after;
            //    if (rules) {
            //        rules = rules[afterCommandName];
            //        if (rules && typeof rules != 'function')
            //            rules = rules[afterArgs.commandArgument];
            //        if (typeof rules == 'function')
            //            if (rules(that, afterArgs) !== false)
            //                rules = null;
            //    }
            //}
            var rules,
                afterCommandName = serverNewRow ? 'New' : 'Select',
                afterArgs = { commandName: afterCommandName, commandArgument: result.View, view: result.View };
            if (!executeExternalJavaScriptBusinessRule(that, afterArgs)) {
                rules = new _businessRules(that);
                rules.after(afterArgs);
                rules.dispose();
            }
            if (serverNewRow && that.odp)
                that.raiseSelected();
        },
        _updatePageCount: function (result, positionChanged) {
            this._totalRowCount = result.TotalRowCount;
            if (this._position && this._position.count === -1)
                this._position.count = result.TotalRowCount;
            this._pageIndex = result.PageIndex;
            if (!positionChanged) {
                this._pageSize = result.PageSize;
                this._pageCount = Math.floor(result.TotalRowCount / result.PageSize);
                if (result.TotalRowCount % result.PageSize !== 0)
                    this._pageCount++;
            }
        },
        _autoSelect: function (rowIndex) {
            var that = this,
                commandName = null,
                commandArgument = null,
                tapAction,
                hideContainer = false,
                autoSelectInfo = that.tagged(/\bauto\-(highlight|select)\-first\-row(-(\w+))?/),
                selectKind = autoSelectInfo && autoSelectInfo[1],
                keepSelecting = autoSelectInfo && autoSelectInfo[3] === 'always';
            if (that._skipAutoSelect) {
                that._skipAutoSelect = false;
                selectKind = null;
            }
            if (that.get_autoHighlightFirstRow() || selectKind === 'highlight') {
                if (!keepSelecting)
                    that.set_autoHighlightFirstRow(false);
                commandName = 'Select';
                tapAction = 'highlight';
            }
            if (that.get_autoSelectFirstRow() || selectKind === 'select') {
                if (!keepSelecting)
                    that.set_autoSelectFirstRow(false);
                tapAction = 'select';
                var groups = that.get_actionGroups('Grid');
                if (groups.length > 0)
                    for (var i = 0; i < groups[0].Actions.length; i++) {
                        var a = groups[0].Actions[i];
                        if (a.CommandName) {
                            commandName = a.CommandName;
                            commandArgument = a.CommandArgument;
                            hideContainer = !isNullOrEmpty(commandArgument) & !that.get_showModalForms() && rowIndex == null;
                            break;
                        }
                    }
            }
            if (keepSelecting)
                that._checkedAutoSelect = false;
            if (commandName && that.get_viewType() != 'Form' && that._rows.length > 0) {
                if (hideContainer)
                    that._hideContainer();
                var extension = that.extension();
                if (extension)
                    extension._autoSelect = { row: that._rows[rowIndex || 0], action: tapAction };
                else
                    that.executeRowCommand(rowIndex || 0, commandName, commandArgument);
            }
            if (!that._tryFocusDataSheet || that._forceFocusDataSheet) {
                that._tryFocusDataSheet = true;
                if (that.get_isDataSheet() && !that.get_lookupField() & (!that.get_filterSource() || that._forceFocusDataSheet) && that._rows.length > 0 && !_touch)
                    that.executeRowCommand(that.get_selectedKey().length > 0 ? null : 0, 'Select');
                that._forceFocusDataSheet = false;
            }
        },
        _hideContainer: function () {
            this._containerIsHidden = true;
            this._container.style.display = 'none';
        },
        _enumerateMissingSearchOptions: function (searchOptions, filterList) {
            for (var i = 0; i < filterList.length; i++) {
                var fd = filterList[i];
                if (fd && !fd.Hidden)
                    if (fd.List)
                        this._enumerateExpressions(searchOptions, filterList);
                    else
                        if (!Array.contains(searchOptions, fd.Function))
                            Array.add(searchOptions, fd.Function);
            }
        },
        _executeSecondCommand: function (force) {
            if (force) {
                var m = _app._commandLine.match(/_commandName2=(\w+)(.*?_commandArgument2=(.*?)(&|$))?/);
                if (m)
                    this.executeActionInScope([this.get_viewType(), 'ActionBar'], m[1], m[3]);
            }
            else if (this._trySecondCommand) {
                this._trySecondCommand = false;
                if (this.get_viewType() != 'Form' || this._totalRowCount > 0) {
                    var self = this;
                    setTimeout(function () {
                        self._executeSecondCommand(true);
                    }, 50);
                }
            }
        },
        isDynamicAction: function (path) {
            return !!this._dynamicActions[path];
        },
        findAction: function (path) {
            if (path) {
                path = path.split(/\s*\\|\/\s*/g);
                var that = this,
                    groups = that._actionGroups, g,
                    actions, a,
                    groupId = path[0],
                    actionId = path[1],
                    i, j;

                for (i = 0; i < groups.length; i++) {
                    g = groups[i];
                    if (g.Id == groupId) {
                        actions = g.Actions;
                        for (j = 0; j < actions.length; j++) {
                            a = actions[j];
                            if (a.Id == actionId)
                                return a;
                        }
                    }
                }
            }
            return null;
        },
        _disposeFieldFilter: function () {
        },
        _stopInputListener: function () {
        },
        cancelDataSheet: function () {
        },
        _get_focusedCell: function () {
        },
        executeActionInScope: function (scopes, commandName, commandArgument, rowIndex, test) {
            if (rowIndex == null)
                rowIndex = this._selectedRowIndex;
            for (var j = 0; j < scopes.length; j++) {
                var scope = scopes[j];
                var actionGroups = this.get_actionGroups(scope);
                if (actionGroups)
                    for (var k = 0; k < actionGroups.length; k++) {
                        var actions = actionGroups[k].Actions;
                        if (actions) {
                            for (var i = 0; i < actions.length; i++) {
                                var action = actions[i];
                                if (action.CommandName == commandName && (isNullOrEmpty(commandArgument) || action.CommandArgument == commandArgument) && this._isActionAvailable(action, rowIndex)) {
                                    if (test != true)
                                        this.executeAction(scope, i, rowIndex, k);
                                    return true;
                                }
                            }
                        }
                    }
            }
            return false;
        },
        _allowModalAutoSize: function () {
            this._modalWidthFixed = false;
            this._modalAutoSized = false;
        },
        _disposeModalPopup: function () {
        },
        endModalState: function (commandName) {
            var parentDataView = this.get_parentDataView();
            function refreshParentDataView() {
                parentDataView.refresh();
            }
            if (this.get_isModal()) {
                var exitCommands = this.get_exitModalStateCommands();
                if (exitCommands) {
                    for (var i = 0; i < exitCommands.length; i++) {
                        if (commandName === exitCommands[i]) {
                            if (parentDataView) {
                                parentDataView._lookupIsActive = false;
                                parentDataView._skipClickEvent = true;
                            }
                            if (_touch)
                                _touch.endModalState(parentDataView, this);
                            else
                                this.dispose();
                            return true;
                        }
                    }
                }
            }
            if (parentDataView && !this.get_confirmContext())
                if (!_touch)
                    parentDataView.refresh();
            closeHoverMonitorInstance();
            return false;
        },
        _onMethodFailed: function (err, response, context) {
            var that = this,
                msg,
                viewId = that._viewId,
                exceptionType = err.get_exceptionType(),
                statusCode = err.get_statusCode(),
                stackTrace = err.get_stackTrace(),
                divider = '///';
            that._busy(false);
            if (_app._navigated) return;
            msg = [String.format('<pre style="word-wrap:break-word;white-space:pre-wrap;margin:0px">{0}\n{1}\ncomponent: {2}; controller: {3}', err.get_message(), divider, that._id, that._controller)];
            if (viewId)
                msg.push('; view: ' + viewId);
            if (statusCode)
                msg.push('; status: ' + statusCode);
            if (exceptionType)
                msg.push('; exception: ' + exceptionType);
            if (stackTrace)
                msg.push('\n' + divider, stackTrace);
            msg.push('</pre>');
            //_app.showMessage(String.format('<pre style="word-wrap:break-word;white-space:pre-wrap;margin:0px">Component: {4}\r\nController: {5}; View: {6}; Timed out: {0}; Status Code: {7};\r\nException: {1}\r\nMessage: {2}\r\nStack:\r\n{3}</pre>',
            //    err.get_timedOut(), err.get_exceptionType(), err.get_message(), err.get_stackTrace(), this.get_id(), this.get_controller(), this.get_viewId(), err.get_statusCode()));
            _app.showMessage(msg.join(''));
            $(this.get_element()).css('border', '1px red solid');
        },
        _createArgsForListOfValues: function (distinctFieldName) {
            var lc = this.get_lookupContext(),
                filter = this._searchBarVisibleIndex == null ? this.get_filter() : this._createSearchBarFilter(true),
                request = {
                    FieldName: distinctFieldName, Controller: this.get_controller(), View: this.get_viewId(),
                    Filter: this._combinedFilter(filter.length === 1 && filter[0].match(/(\w+):/)[1] === distinctFieldName ? null : filter),
                    ExternalFilter: this.get_externalFilter(),
                    LookupContextFieldName: lc ? lc.FieldName : null, LookupContextController: lc ? lc.Controller : null,
                    LookupContextView: lc ? lc.View : null, Tag: this.get_tag(),
                    QuickFindHint: _touch ? this.viewProp('quickFindHint') : null
                };
            this._useSearchParams(request);
            return { controller: this.get_controller(), view: this.get_viewId(), request: request };
        },
        _loadListOfValues: function (family, fieldName, distinctFieldName, callback) {
            this._busy(true);
            //var lc = this.get_lookupContext();
            //var filter = this.get_filter();
            this._invoke('GetListOfValues', this._createArgsForListOfValues(distinctFieldName), //{ controller: this.get_controller(), view: this.get_viewId(), request: { FieldName: distinctFieldName, Filter: filter.length == 1 && filter[0].match(/(\w+):/)[1] == distinctFieldName ? null : filter, LookupContextFieldName: lc ? lc.FieldName : null, LookupContextController: lc ? lc.Controller : null, LookupContextView: lc ? lc.View : null} },
                Function.createDelegate(this, this._onGetListOfValuesComplete), { 'family': family, 'fieldName': fieldName, callback: callback });
        },
        _onGetListOfValuesComplete: function (result, context) {
            this._busy(false);
            var field = this.findField(context.fieldName);
            field._listOfValues = result;
            if (result[result.length - 1] == null) {
                Array.insert(result, 0, result[result.length - 1]);
                Array.removeAt(result, result.length - 1);
            }
            if (context.callback)
                context.callback();
            else {
                if (this.get_isChart()) {
                    if (this.get_showViewSelector())
                        this._registerViewSelectorItems();
                    else
                        this._registerActionBarItems();
                    _web.HoverMonitor._instance._tempOpenDelay = 100;
                }
                else
                    this._registerFieldHeaderItems(Array.indexOf(this.get_fields(), field));
                $refreshHoverMenu(context.family);
                _app._resized = true;
            }
        },
        clipboard: function (method, options) {
            var that = this,
                test,
                pasteTooltip,
                keyMap;
            appClipboard.data();
            if (method === 'menu') {
                var items = [], menu = options.items;
                if (options.existingRow) { // existing row = true
                    if (that.clipboard('copy'))
                        items.push({ text: resourcesEditor.Copy, icon: 'material-icon-content_copy', /*toolbar2: false, */sidebar: false, context: that, callback: _app.clipboard.copy });
                    if (that.clipboard('cut'))
                        items.push({ text: resourcesEditor.Cut, icon: 'material-icon-content_cut', /*toolbar2: false, */sidebar: false, context: that, callback: _app.clipboard.cut });
                }
                if (that.clipboard('paste') || !menu.isRow && that.clipboard('viewpaste')) {
                    pasteTooltip = _clipboard.text + ' ' + resourcesMobile.From + ' ' + _clipboard.source;
                    items.push({ text: resourcesEditor.Paste, desc: pasteTooltip, tooltip: pasteTooltip, icon: 'material-icon-content_paste', /*toolbar2: false, */sidebar: false, context: that, callback: appClipboard.paste });
                }
                items.forEach(function (item, index) {
                    if (!index)
                        menu.push({});
                    menu.push(item);
                });
                return;
            }
            //if (method === 'actionbar') {
            //    if (that.clipboard('paste'))
            //        options.items.push({ text: resourcesEditor.Paste, tooltip: _clipboard.message + ' from ' + _clipboard.text, icon: 'material-icon-content_paste', /*toolbar2: false, */sidebar: false, context: that, callback: appClipboard.paste });
            //    return;
            //}
            if (method === 'paste' || method === 'drop') {
                appClipboard.data();
                var itemDrop = (method === 'drop' || !_clipboard.drag) && that.tagged(new RegExp('\\bitem\\-' + method + '\\-(.+?)(\\s|$)'));
                return itemDrop && _clipboard.controller === itemDrop[1];
            }
            if (method === 'viewpaste' || method === 'viewdrop') {
                appClipboard.data();
                method = method === 'viewdrop' ? 'drop' : 'paste';
                var itemDrop = (method === 'drop' || !_clipboard.drag) && that.tagged(new RegExp('\\bview\\-' + method + '\\-(.+?)(\\s|$)'));
                return itemDrop && _clipboard.controller === itemDrop[1];
            }
            if (method === 'copy')
                test = 'item-copy';
            if (method === 'cut')
                test = 'item-cut';
            if (method === 'drag')
                test = 'item-drag';
            if (test)
                return !!that.tagged(test);// && (!_clipboard.drag || method === 'drag');
            if (method === 'map') {
                var controller = that._controller,
                    row, link, item,
                    keyFields = that._keyFields;
                if (options) {
                    keyMap = options.map;
                    if (keyMap) {
                        link = options.link;
                        if (link) {
                            row = link.data('data-context').row;
                            item = link.parent();
                            // item.toggleClass('app-clipboard-cut', );
                            var key = [];
                            if (keyMap._cut || keyMap._drag)
                                keyFields.forEach(function (keyField) {
                                    key.push(row[keyField.Index]);
                                });
                            item.toggleClass('app-clipboard-cut', !!key.length && keyMap[key.join()] != null);
                        }
                        else {
                            var itemContainer = _touch.summary(that._id);
                            if (!itemContainer.length)
                                itemContainer = _touch.activePage();
                            itemContainer.find('.dv-item').each(function () {
                                that.clipboard('map', { map: keyMap, link: $(this).find('> .ui-btn') });
                            });
                        }
                    }
                }
                else if (_clipboard.controller === controller) {
                    keyMap = { _cut: _clipboard.cut, _drag: _clipboard.drag };
                    _clipboard.objects.forEach(function (obj) {
                        var key = [];
                        keyFields.forEach(function (keyField) {
                            key.push(obj[keyField.Name]);
                        });
                        keyMap[key.join()] = obj;
                    });
                }
                return keyMap;
            }
            if (method === 'clear') {
                keyMap = {};
                appClipboard.clear();
                method = 'changed';
            }
            if (method === 'changed') {
                keyMap = keyMap || that.clipboard('map');
                that.clipboard('map', { map: keyMap });
                $window.trigger('throttledresize');
            }
            else
                appClipboard.paste(method || that);
        },
        get_parentDataView: function (defaultParent) {
            var dataView = defaultParent;
            if (this._parentDataViewId)
                dataView = findDataView(this._parentDataViewId);
            return dataView;
        },
        get_selectedValues: function () {
            var that = this,
                dataView = that._useCase === 'seeAll' ? that : that.get_parentDataView(that),
                selection = dataView ? dataView.get_selectedValue() : [];
            selection = !selection.length ? [] : !dataView.multiSelect() ? [selection] : selection.split(';');
            if (Array.isArray(selection) && !selection.length) {
                selection = dataView.get_selectedKey().toString();
                selection = isNullOrEmpty(selection) ? null : [selection];
            }
            return selection;
        },
        _execute: function (args) {
            var that = this;
            that._busy(true);
            that._showWait();
            that._lastArgs = args;
            /*
            args.Filter = this.get_filter();
            args.SortExpression = this.get_sortExpression();
            args.SelectedValues = this.get_selectedValues();
            args.ExternalFilter = this.get_externalFilter();
            args.Transaction = this.get_transaction();
            if (!isNullOrEmpty(args.Transaction) && !this.get_isModal() && !this.get_filterSource() && args.CommandName.match(/Insert|Update|Delete/))
            args.Transaction += ':complete';
            args.SaveLEVs = this._allowLEVs == true;
            */
            that._invoke('Execute', { controller: args.Controller, view: args.View, args: args }, Function.createDelegate(that, that._onExecuteComplete));
        },
        _populateDynamicLookups: function (result) {
            var that = this, i, lov;
            for (i = 0; i < result.Values.length; i++) {
                var v = result.Values[i],
                    f = that.findField(v.Name);
                if (f) {
                    lov = f.DynamicItems = v.NewValue;
                    if (f.requiresDynamicNullItem && f.ItemsStyle.match(/^(ListBox|RadioButtonList|DropDownList)$/) && !f.ItemsTargetController)
                        //lov.splice(0, 0, [null, f.is('lookup-any-value') ? resourcesData.AnyValue : labelNullValueInForms]);
                        injectNullValue(f, lov);
                    f.Items = [];
                    f.ItemCache = null;
                }
            }
            if (_touch)
                //this.extension().afterPopulateDynamicLookups(result.Values);
                _app.input.execute({ dataView: that, values: result.Values, populateDynamicLookups: false });
            else {
                // desktop style of refreshing
                that._skipPopulateDynamicLookups = true;
                that.refresh(true);
                that._focus();
            }
        },
        _updateCalculatedFields: function (result) {
            this._displayActionErrors(result);
            var values = []
            for (var i = 0; i < result.Values.length; i++) {
                var v = result.Values[i];
                Array.add(values, { 'name': v.Name, 'value': v.NewValue });
            }
            this.refresh(true, values);
            //this._focus(values.length > 0 ? values[values.length - 1].name : null);
            this._focus();
        },
        _recordLEVs: function (values) {
        },
        _applyLEV: function (fieldIndex) {
        },
        _useLEVs: function (row) {
        },
        _notifyMaster: function () {
            var that = this, dv, field, fieldName;
            if (that.get_hasParent())
                if (_touch) {
                    dv = that;
                    fieldName = dv._dataViewFieldName
                    if (!(dv._filterSource && fieldName))
                        while (dv && !fieldName) {
                            dv = dv.get_parentDataView();
                            if (dv)
                                fieldName = dv._dataViewFieldName;
                        }
                    if (dv && fieldName) {
                        dv = findDataView(dv._filterSource);
                        field = dv.findField(fieldName);
                        if (field && field.CausesCalculate)
                            if (dv == _touch.dataView())
                                dv._raiseCalculate(field, field);
                            else
                                _touch.pageInfo(dv).calculate = fieldName;

                    }
                }
                else {
                    var m = findDataView(that.get_filterSource());
                    if (m) m._updateDynamicValues('controller:' + that.get_controller());
                }
        },
        _clearSelectedKey: function (delaySelected) {
            // this workaround compensates for "modal" lookups in mobile client.
            var dataView = this._lookupInfo ? this : this.get_parentDataView(this),
                extension,
                key = dataView._selectedKey,
                keyIndex;
            if (key && key.length) {
                keyIndex = dataView._selectedKeyList.indexOf(key.join(','));
                if (keyIndex !== -1)
                    dataView._selectedKeyList.splice(keyIndex, 1);
            }
            dataView._selectedKey = [];
            dataView._selectedKeyFilter = [];
            dataView._selectedRowIndex = null;
            dataView._position = null;
            if (delaySelected !== false)
                dataView._raiseSelectedDelayed = true;
            dataView._selectedRow = null;
        },
        _refreshSelectedKey: function (values, notify) {
            var that = this,
                dataView,
                selectedKey = [],
                selectedKeyFilter = [],
                field,
                i, j, v;
            if (!values.length && that._lastArgs)
                values = that._lastArgs.Values;
            for (i = 0; i < that._keyFields.length; i++) {
                field = that._keyFields[i];
                for (j = 0; j < values.length; j++) {
                    if (values[j].Name === field.Name) {
                        v = values[j];
                        if (v.NewValue == null) {
                            that._clearSelectedKey();
                            return;
                        }
                        Array.add(selectedKey, v.NewValue);
                        Array.add(selectedKeyFilter, field.Name + ':=' + that.convertFieldValueToString(field, v.NewValue));
                        break;
                    }
                }
            }
            dataView = _touch ? that.get_parentDataView(that) : that;
            if (!dataView.editing() || !_touch)
                if (selectedKey.length > 0) {
                    dataView._selectedKey = selectedKey;
                    dataView._selectedKeyFilter = selectedKeyFilter;
                    dataView._selectedKeyList = [selectedKey.join(',')];
                    dataView._raiseSelectedDelayed = true;
                }
                else
                    dataView._selectedKeyList = [];
        },
        _cancelConfirmation: function () {
            var that = this,
                confirmDataViewId = that._confirmDataViewId;
            if (confirmDataViewId) {
                var confirmView = findDataView(confirmDataViewId);
                if (confirmView) {
                    that._confirmDataViewId = null;
                    confirmView.cancel();
                }
            }
        },
        _findKeyValue: function (list) {
            var keyField = this._keyFields[0];
            for (var i = 0; i < list.length; i++) {
                var fv = list[i];
                if (keyField.Name === fv.Name)
                    return fv.Modified ? fv.NewValue : fv.OldValue;
            }
            return null;
        },
        uploadNextBlob: function (values, newValues, executeResult, executeContext) { // executeResult is provided only when BLOBs are uploaded without ODP 
            var that = this,
                result;

            function appIsBusy(busy) {
                if (executeResult)
                    if (_touch)
                        _touch.busy(busy);
                    else
                        that._busy(busy);
            }

            function stopWaitng() {
                // Do not put blob back into queue after failed upload or it will create an infinite loop of submission.
                // The blob will be abandoned since there is nothing the user can do about it. The row was either inserted or updated already.
                // The only option is to confirm to retry the upload, which will not be implemented for now.
                //pendingUploads.push(upload); -- do not remove the comment
                that._stopWaiting = true;
                appIsBusy(false);
            }

            var pendingUploads = that._pendingUploads;
            if (pendingUploads && pendingUploads.length > 0) {
                // select the first pending upload
                var upload = pendingUploads[0],
                    blobField, blobApiVersion = '1', blobUtilityFieldMarker;
                Array.removeAt(pendingUploads, 0);
                // update the key reference in the pending upload
                key = that._findKeyValue(newValues);
                if (key == null)
                    key = that._findKeyValue(values);
                if (upload.files) {
                    blobField = that.findField(upload.fieldName);
                    blobUtilityFieldMarker = 'name:' + blobField.Name;
                    that._allFields.forEach(function (f) {
                        if (f._blobField === blobUtilityFieldMarker)
                            blobApiVersion = '2';
                    });
                    if (blobField.Name.match(/_Annotation_Attachment/))
                        key = blobField._dataView._controller + ',' + blobField.Name + '|' + key;
                    appIsBusy(true);
                    result = _app.upload('execute', {
                        container: findBlobContainer(that, blobField),
                        files: upload.files,
                        field: blobField,
                        key: key,
                        apiVer: blobApiVersion
                    }).done(function () {
                        stopWaitng();
                        if (executeResult)
                            that._onExecuteComplete(executeResult, executeContext);
                    }).fail(stopWaitng);
                }
                //else
                //    upload.form.action = upload.form.action.replace(/=u\|&/, String.format('=u|{0}&', key));
                // start the pending upload
                //if (upload.form) {
                //    if (executeResult)
                //        that._pendingExecuteComplete = { result: executeResult, context: executeContext };
                //    that._showDownloadProgress();
                //    upload.form.submit();
                //}
            }
            return result;
        },
        _onExecuteComplete: function (result, context) {
            var that = this,
                isForm = that.get_isForm(),
                extension = that.extension(),
                lastArgs = that._lastArgs,
                originalValues = lastArgs.Values,
                lastCommandName = lastArgs.CommandName,
                lastCommandArgument = lastArgs.CommandArgument,
                resultValues = result.Values,
                errors = result.Errors,
                noErrors = !errors.length,
                parentDataView, key, mustContinue, navigatedAway,
                stopFlow = false,
                isCustom, i, mfv, rules,
                lastFocusedCell = that._lastFocusedCell,
                notification;

            that._busy(false);
            that._hideWait();

            if (noErrors) {
                i = resultValues.length - 1;
                while (i >= 0) {
                    mfv = resultValues[i];
                    if (mfv.Scope) {
                        resultValues.splice(i, 1);
                        that.updateFieldValue(mfv.Name, mfv.NewValue, mfv.Scope);
                    }
                    i--;
                }
            }

            if (noErrors && lastCommandName.match(/^(Insert|Update)$/) && that.uploadNextBlob(originalValues, resultValues, result, context))
                return;   // let the blobs of the master record to upload before we continue 

            if (_touch)
                notification = _touch.notify(that);

            if (lastCommandName === 'PopulateDynamicLookups') {
                that._populateDynamicLookups(result);
                return;
            }
            else if (lastCommandName === 'Calculate') {
                if (_touch)
                    //if (that.get_view().Layout)
                    if (noErrors)
                        _app.input.execute({ dataView: that, values: resultValues, raiseCalculate: false });
                    else
                        _touch.notify(errors);
                //else
                //    extension.afterCalculate(resultValues);
                else
                    that._updateCalculatedFields(result);
                if (result.ClientScript)
                    eval(result.ClientScript);
                if (that._pendingPopulate) {
                    that._pendingPopulate = false;
                    that._raisePopulateDynamicLookups();
                }
                return;
            }
            isCustom = lastCommandName === 'Custom';
            if (that._confirmDataViewId && _touch) {
                _touch.pageShown(function () {
                    that._onExecuteComplete(result, context);
                });
                that._syncKey = null;
                that._cancelConfirmation();
                return;
            }
            else
                that._cancelConfirmation();
            if (noErrors)
                if (_touch) {
                    _app.syncMap.notify(that._controller);
                    _app.syncMap.notify(that._syncWith);
                }
            var ev = { 'result': result, 'context': context, 'handled': false };
            that.raiseExecuted(ev);
            if (ev.handled) return;
            if (result.ClearSelection) {
                that._clearSelectedKey();
                that._selectedKeyList = [];
            }
            var existingRow = !lastCommandName.match(/Insert/);
            if (lastCommandName.match(/Delete/i) && result.RowsAffected > 0) {
                extension = that.get_parentDataView(that).extension();
                if (extension && extension.clearSelection)
                    extension.clearSelection(true);
                else
                    that._clearSelectedKey();
            }
            else
                if (lastCommandName.match(/Custom|SQL|Email/)) {
                    stopFlow = !isCustom && that.editing();
                    if (resultValues.length > 0) {
                        if (_touch)
                            //if (that.get_view().Layout)
                            _app.input.execute({ dataView: that, values: resultValues });
                        //else
                        //    extension.afterCalculate(resultValues);
                        else
                            that.refresh(true, resultValues);
                        if (isCustom && !result.ClientScript)
                            result.ClientScript = 'void(0)';
                        that._refreshSelectedKey(resultValues, noErrors);
                    }
                    else if (!stopFlow && lastCommandName === 'SQL') {
                        that._raiseSelectedDelayed = true;
                        that._forceChanged = true;
                    }
                }
                else
                    if (existingRow) {
                        for (i = 0; i < resultValues.length; i++) {
                            var v = resultValues[i],
                                field = that.findField(v.Name);
                            if (field)
                                that.get_currentRow()[field.Index] = v.NewValue;
                        }
                    }
                    else {
                        if (_touch) {
                            _app.input.execute({ dataView: that, values: resultValues });
                            if (isForm) {
                                // the parent data view does not have the command row yet - let's create one
                                parentDataView = that.get_parentDataView(null);
                                var parentCommandRow, editRow,
                                    parentExtension;
                                if (parentDataView && parentDataView !== that) {
                                    parentCommandRow = [];
                                    editRow = that.editRow();
                                    $(that._allFields).each(function () {
                                        var f = this,
                                            pf = parentDataView.findField(f.Name),
                                            v = editRow[f.Index];
                                        if (pf)
                                            parentCommandRow[pf.Index] = v;
                                    });
                                    parentExtension = parentDataView.extension();
                                    parentExtension._commandRow = parentCommandRow;
                                    if (parentDataView.get_isGrid())
                                        parentExtension.headerText(parentCommandRow);
                                }
                            }
                        }
                        that._refreshSelectedKey(resultValues, noErrors);
                    }

            function continueAfterScript(rules) {
                rules.dispose();
                if (that._continueAfterScript) {
                    if (result.NavigateUrl) {
                        result.NavigateUrl = that.resolveClientUrl(result.NavigateUrl);
                        navigatedAway = !mustContinue;
                        that.navigate(result.NavigateUrl, existingRow ? originalValues : resultValues);
                    }
                    if (!navigatedAway)
                        if (that._closeInstantDetails()) {
                            // do nothing
                        }
                        else if (that.endModalState(lastCommandName)) {
                            // do nothing
                        }
                        else if (that.get_backOnCancel() || !isNullOrEmpty(that._replaceTriggerViewId)) that.goBack(true);
                        else {
                            that._notifyDesigner(true);
                            if (notification != null)
                                _touch.notify(typeof notification == 'string' ? { text: notification, force: true } : notification);
                            var actions = that.get_actions(that._get_lastActionScope(), true),
                                a, dataView, i,
                                commandName, commandArgument;
                            for (i = 0; i < actions.length; i++) {
                                a = actions[i];
                                if (a.WhenLastCommandName === lastCommandName && (!a.WhenLastCommandArgument || a.WhenLastCommandArgument === lastCommandArgument) && that._isActionMatched(a)) {
                                    commandName = a.CommandName;
                                    commandArgument = a.CommandArgument;
                                    if (_touch)
                                        dataView = that.delegateCommand(commandName, commandArgument);
                                    if (!dataView)
                                        dataView = that;
                                    //executeNextAction();
                                    if (!a.WhenKeySelected || (dataView.get_selectedKey() || []).length) {
                                        dataView.set_lastCommandName(lastCommandName);
                                        dataView.set_lastCommandArgument(lastCommandArgument);
                                        dataView.executeCommand({ commandName: commandName, commandArgument: commandArgument, path: a.Path, causesValidation: a.CausesValidation, values: lastCommandName.match(/Insert|Custom/) ? originalValues : null });
                                        dataView._pendingSelectedEvent = commandName.match(/^(Edit|Select)/) != null;
                                        dataView._notifyMaster();
                                    }
                                    return;
                                }
                            }
                            if (!stopFlow)
                                if (_touch && lastCommandName === 'Update' && lastCommandArgument === 'SaveAndContinue') {
                                    //_touch.notify('saved - please continue');
                                    var pkFilter = {};
                                    that._keyFields.forEach(function (f, index) {
                                        pkFilter[f.Name] = that._selectedKey[index];
                                    });
                                    _app.execute({ controller: that._controller, view: that._viewId, filter: pkFilter, includeRawResponse: true }).then(function (result) {
                                        var editRow = that.editRow(),
                                            newOriginalRow = result.rawResponse.Rows[0],
                                            broardcast = {};
                                        if (newOriginalRow) {
                                            that._allFields.forEach(function (field, index) {
                                                if (editRow[index] !== newOriginalRow[index])
                                                    broardcast[field.Name] = newOriginalRow[index];
                                            });
                                            that._originalRow = newOriginalRow.slice();
                                            that._unchangedRow = newOriginalRow.slice();
                                            _app.input.execute({ values: broardcast });
                                            that.refreshChildren();
                                        }

                                    });
                                }
                                else {
                                    that._pendingSelectedEvent = lastCommandName.match(/Update|Custom|SQL/);
                                    that.set_lastCommandName(null);
                                    if (that.get_isModal() && (!that.get_isForm(that._lastViewId) || that._inlineEditor || that._closeViewDetails))
                                        that.endModalState('Cancel');
                                    else {
                                        if (_touch && that._viewId === that._lastViewId)
                                            _touch.syncWithOdp(_touch.dataView());
                                        if (_touch && isForm) {
                                            if (that._doneCallback)
                                                that._doneCallback(that);
                                            else
                                                location.replace(location.href);
                                        }
                                        else
                                            that.goToView(that._lastViewId);

                                    }
                                }
                        }
                    that._notifyMaster();
                }
                else if (_touch)
                    _touch.edit.sync({ reset: true });
            }

            function afterExecute() {
                rules = new _businessRules(that);
                rules.after(lastArgs);
                if (rules.canceled() || result.Canceled && !mustContinue && !lastCommandName.match(/Update|Insert|Delete/))
                    that._continueAfterScript = false;
                if (rules._wait)
                    $.when(rules._wait).done(function () {
                        continueAfterScript(rules);
                    });
                else
                    continueAfterScript(rules);
            }

            if (noErrors) {
                that._forceSync();
                parentDataView = that.get_parentDataView();
                if (parentDataView)
                    parentDataView._forceSync();
                that.tag(result.Tag);
                that._requestedFilter = result.Filter;
                that._requestedSortExpression = result.SortExpression;
                that._autoRefresh();
                if (that.multiSelect()) {
                    if (result.KeepSelection)
                        that._keepKeyList = true;
                    else {
                        that._selectedKeyList = [];
                        that.set_selectedValue('');
                    }
                }
                that._recordLEVs();
                that.updateSummary();
                that._continueAfterScript = true;
                if (result.ClientScript) {
                    that._continueAfterScript = false;
                    result.ClientScript = that.resolveClientUrl(result.ClientScript);
                    eval(result.ClientScript);
                    mustContinue = that._continueAfterScript;
                }
                that._lastFocusedCell = null;
                var executeResult = executeExternalJavaScriptBusinessRule(that, lastArgs);
                if (executeResult !== false)
                    if (executeResult && executeResult.then)
                        $.when(executeResult).then(afterExecute);
                    else
                        afterExecute();
            }
            else {
                if (lastFocusedCell) {
                    that._focusCell(-1, -1, false);
                    that._focusCell(lastFocusedCell.rowIndex, lastFocusedCell.colIndex, true);
                    that._lastFocusedCell = null;
                    that._saveAndNew = false;
                }
                if (result.ClientScript) {
                    result.ClientScript = that.resolveClientUrl(result.ClientScript);
                    eval(result.ClientScript);
                }
                that._displayActionErrors(result);
            }
        },
        _get_lastActionScope: function () {
            var path = this._lastArgs ? this._lastArgs.Path : null;
            if (path) {
                var m = path.match(/^(\w+)\//);
                if (m) {
                    var list = this._actionGroups;
                    for (var i = 0; i < list.length; i++) {
                        var ag = list[i];
                        if (ag.Id === m[1])
                            return ag.Scope;
                    }
                }
            }
            var viewType = this.get_viewType();
            if (viewType.match(/DataSheet|Tree/))
                viewType = 'Grid';
            return viewType;
        },
        _displayActionErrors: function (result) {
            if (!result.Errors.length) return;
            var sb = new _Sys_StringBuilder(), i;
            for (i = 0; i < result.Errors.length; i++)
                sb.append((i ? '\n' : '') + _app.formatMessage('Attention', result.Errors[i]));
            if (_touch)
                _touch.edit.sync({ reset: true });
            _app.showMessage(sb.toString());
            sb.clear();
        },
        _busy: function (isBusy) {
            var that = this,
                api = that._api;
            if (isBusy == null)
                return that._isBusy;
            if (api && api.background)
                return;
            that._isBusy = isBusy;
            var busyIndicator;
            if (_touch.toolbar().is(':visible')) {
                if (arguments.length)
                    _touch.busy(isBusy);
                clearTimeout(_app._busyIndicatorTimeout);
                busyIndicator = _app._busyIndicator;
                if (!busyIndicator) {
                    busyIndicator = _touch.indicator();
                    _app._busyCount = 0;
                }

                if (isBusy) {
                    if (!_app._busyCount) {
                        _app._busyTime = +new Date();
                        busyIndicator.removeClass('dataview-busy-indicator-done').css({ 'animation-duration': Math.max(1000, _touch.screen().width) / 1000 * 3000 + 'ms' });
                        busyIndicator.addClass('dataview-busy-indicator-animate');
                    }
                    _app._busyCount++;
                }
                else if (_app._busyCount) {
                    if (_app._busyCount === 1) {
                        if (+new Date() - _app._busyTime > 500) {
                            busyIndicator.toggleClass('dataview-busy-indicator-animate dataview-busy-indicator-done');
                            setTimeout(function () {
                                busyIndicator.removeClass('dataview-busy-indicator-done');
                            }, 1550);
                        }
                        else
                            busyIndicator.removeClass('dataview-busy-indicator-animate dataview-busy-indicator-done');
                    }
                    _app._busyCount--;
                }
                return;
            }
            else
                _touch.wait(isBusy);

        },
        _prepareJavaScriptExpressionEx: function (script) {
            return script.replace(/\[((\w+)\.)?(\w+)\]/g, 'this.fieldValue("$3","$2")')
                .replace(/\$row\.(\w+)/gm, 'this.fieldValue("$1")')
                .replace(/\$master\.(\w+)/gm, 'this.fieldValue("$1","master")');
        },
        _evaluateVisibility: function () {
            var script = this.get_visibleWhen();
            if (isNullOrEmpty(script))
                return true;
            script = this._prepareJavaScriptExpressionEx(script);
            return eval(script) != false;
        },
        _filterSourceSelected: function (sender, args, keepContext) {
            this._hidden = !this._evaluateVisibility();
            var vitals = this.readContext('vitals');
            if (vitals) {
                var i = 0;
                while (i < vitals.Filter.length) {
                    var filterExpression = vitals.Filter[i];
                    var filterFieldName = filterExpression.substring(0, filterExpression.indexOf(':'));
                    var isKey = false;
                    if (this._keyFields)
                        for (var j = 0; j < this._keyFields.length; j++)
                            if (this._keyFields[j].Name === filterFieldName) {
                                isKey = true;
                                break;
                            }
                    if (isKey)
                        Array.removeAt(vitals.Filter, i);
                    else
                        i++;
                }
                this.writeContext('vitals', vitals);
            }
            var oldValues = [];
            for (i = 0; i < this._externalFilter.length; i++) {
                Array.add(oldValues, this._externalFilter[i].Value);
                this._externalFilter[i].Value = null;
            }
            var forceHide = false,
                forceChanged = false;
            if (isInstanceOfType(_app, sender)) {
                //if (!isNullOrEmpty(this._transaction))
                //    this.set_transaction(sender.get_transaction());
                this._populateExternalViewFilter(sender);
                forceHide = !sender.get_showDetailsInListMode() && sender.get_isGrid()/*sender.get_viewType() == 'Grid'*/;
                if (sender._forceChanged)
                    forceChanged = true;
            }
            else if (this._externalFilter.length > 0)
                this._externalFilter[0].Value = sender.target.value;
            this.applyExternalFilter(_touch);
            var emptySourceFilter = true,
                sourceFilterChanged = false,
                v, p;
            for (i = 0; i < this._externalFilter.length; i++) {
                v = this._externalFilter[i].Value;
                if (v != null) emptySourceFilter = false;
                if (v != oldValues[i]) sourceFilterChanged = true;
            }
            if (this.get_autoHide() != Web.AutoHideMode.Nothing)
                this._updateLayoutContainerVisibility(!emptySourceFilter && !forceHide && !this._hidden);
            if (sourceFilterChanged || forceChanged) {
                if (!keepContext) {
                    var extension = this.extension();
                    this.set_pageIndex(-1);
                    if (extension && extension.currentPageIndex)
                        extension.currentPageIndex(null);
                }
                p = this._position;
                if (p) {
                    p.index = 0;
                    p.count = -1;
                    p.key = [];
                    p.keyFilter = [];
                    p.filter = this.get_filter();
                }
                if (!keepContext) {
                    this._selectedKey = [];
                    this._selectedKeyFilter = [];
                    this._selectedKeyList = [];
                }
                this._clearCache();
                this.loadPage();
            }
            this.raiseSelected();
            this.updateSummary();
        },
        _createExternalFilter: function () {
            var that = this,
                filterFields = that.get_filterFields(),
                filterFields, i;
            that._externalFilter = [];
            //var iterator = /(\w+)(,|$)/g;
            if (filterFields) {
                fieldNames = filterFields.split(_app._simpleListRegex);
                for (i = 0; i < fieldNames.length; i++)
                    that._externalFilter.push({ Name: fieldNames[i], Value: null });
            }
        },
        _populateExternalViewFilter: function (view) {
            if (!(view._selectedKey && view._keyFields && view._selectedKey.length == view._keyFields.length)) return;
            for (var i = 0; i < this._externalFilter.length; i++) {
                var filterItem = this._externalFilter[i];
                var found = false;
                for (var j = 0; j < view._keyFields.length; j++) {
                    var field = view._keyFields[j];
                    if (filterItem.Name == field.Name) {
                        filterItem.Value = view.convertFieldValueToString(field, view._selectedKey[j]);
                        found = true;
                        break;
                    }
                }
                if (!found && this.get_controller() != view.get_controller()) {
                    var row = view.get_selectedRow();
                    if (row && row.length)
                        for (j = 0; j < view._allFields.length; j++) {
                            field = view._allFields[j];
                            if (filterItem.Name == field.Name) {
                                filterItem.Value = view.convertFieldValueToString(field, row[view._allFields[j].Index]);
                                found = true;
                                break;
                            }
                        }
                }
                if (!found && view._selectedKey.length >= i)
                    filterItem.Value = view._selectedKey[i];
            }
        },
        _cloneChangedRow: function () {
            if (this.editing()) {
                var values = this._collectFieldValues();
                var selectedRow = this.get_currentRow();
                var row = selectedRow ? Array.clone(selectedRow) : null;
                //var designer = __designer();
                for (var i = 0; i < values.length; i++) {
                    var v = values[i];
                    var f = this.findField(v.Name);
                    if (f/* && !f.ReadOnly*/)
                        row[f.Index] = v.Modified && 'NewValue' in v ? v.NewValue : v.OldValue;
                }
                return row;
            }
            else
                return this.get_selectedRow();
        },
        get_statusBar: function () {
            var that = this,
                statusBar = that._statusBar || that._statusBarAuto;
            if (!statusBar && that._isWizard && !that.tagged('status-bar-disabled'))
                statusBar = that._statusBarAuto = that._controller + '.' + that._viewId + '._wizard: 0\n' + resourcesHeaderFilter.Loading + '>\n';
            return statusBar;
        },
        statusBar: function () {
            var statusBar = this.get_statusBar(),
                smb;
            if (!isNullOrEmpty(statusBar)) {
                var iterator = /((\w+)\.)?((\w+)\.)?(\w+):\s*(.+?)\s*\n\s*(((.+?)\s*>\s*)+)/g,
                    m = iterator.exec(statusBar);
                while (m) {
                    var v = this.fieldValue(m[5]);
                    if (v == null) v = 'null';
                    if ((m[6] == v || m[6] == '*') && (isNullOrEmpty(m[2]) || m[2] == this.get_controller()) && (isNullOrEmpty(m[3]) || m[4] == this.get_viewId())) {
                        iterator = /(\[)?\s*(.+?)\s*(\])?\s*>\s*/g;
                        var segmentList = [];
                        var m2 = iterator.exec(m[7]);
                        while (m2) {
                            Array.add(segmentList, { 'Text': m2[2], 'Current': m2[1] == '[' && m2[3] == ']' });
                            m2 = iterator.exec(m[7]);
                        }
                        if (segmentList.length > 0 && !(__tf != 4)) {
                            smb = new _Sys_StringBuilder('<ul class="StatusBar">');
                            var past = false;
                            var future = true;
                            for (var i = 0; i < segmentList.length; i++)
                                if (segmentList[i].Current) {
                                    past = true;
                                    future = false;
                                    break;
                                }

                            for (i = 0; i < segmentList.length; i++) {
                                var segment = segmentList[i];
                                var age = segment.Current ? 'Current' : (past ? 'Past' : (future ? 'Future' : ''));

                                var nextSegment = i < segmentList.length - 1 ? segmentList[i + 1] : null;
                                var transition = '';
                                if (nextSegment) {
                                    if (nextSegment.Current)
                                        transition = age + 'ToCurrent';
                                    else if (segment.Current)
                                        if (nextSegment.Current)
                                            transition = age + 'ToCurrent';
                                        else
                                            transition = age + 'ToFuture';
                                }

                                if (segment.Current) {
                                    past = false;
                                    future = true;
                                }
                                smb.appendFormat('<li class="Segment {1}{2}{3} {4}"><span class="Outer"><span class="Inner"><span class="Self">{0}</span></span></span></li>', _app.htmlEncode(segment.Text), age, i == 0 ? ' First' : '', i == segmentList.length - 1 ? ' Last' : '', transition);
                            }
                            smb.append('</ul>');
                        }
                        break;
                    }
                    m = iterator.exec(statusBar);
                }
            }
            return smb ? smb.toString() : null;
        },
        _updateDynamicValues: function (field) {
            var that = this,
                done = false,
                allFields = that._allFields,
                fieldName = field && field.Name ? field.Name : field;
            if (field && field.CausesCalculate) {
                if (!that.editing()) {
                    that.refresh();
                    return true;
                }
                that._raiseCalculate(field, field);
                done = true;
            }
            else
                for (var i = 0; i < allFields.length; i++) {
                    var f = allFields[i];
                    var hasContextFields = !isNullOrEmpty(f.ContextFields);
                    if (hasContextFields) {
                        var iterator = /\s*([\w\:]+)\s*(=\s*(\w+)\s*)?(,|$)/g;
                        var m = iterator.exec(f.ContextFields);
                        while (m) {
                            if (f.ItemsAreDynamic && (field == null || m[3] == /*field.Name*/fieldName)) {
                                if (!that.editing()) {
                                    that.refresh();
                                    return true;
                                }
                                that._raisePopulateDynamicLookups();
                                done = true;
                            }
                            //else if (f.Calculated && m[1] == /*field.Name*/fieldName) {
                            //    if (!that.editing()) {
                            //        that.refresh();
                            //        return true;
                            //    }
                            //    that._raiseCalculate(f, field);
                            //    done = true;
                            //}
                            else if ((f.Calculated || f.CausesCalculate) && m[1] == /*field.Name*/fieldName || m[1] == field || 'controller:' + m[1] == field) {
                                if (_touch) {
                                    that.extension().notify(field);
                                    return;
                                }
                                else {
                                    if (!that.editing()) {
                                        that.refresh();
                                        return true;
                                    }
                                    that._raiseCalculate(f, field);
                                    done = true;
                                }
                            }
                            if (done) break;
                            m = iterator.exec(f.ContextFields);
                        }
                        if (done) break;
                    }
                }
            return done;
        },
        _enumerateContextFieldValues: function (field, values, map, row) {
            var that = this,
                fieldName = field.Name, m, listedFields,
                itemsDataController = field.ItemsDataController,
                allFields = that._allFields,
                i, f, contextFields, iterator;
            for (i = 0; i < allFields.length; i++) {
                f = allFields[i];
                contextFields = f.ContextFields;
                if (contextFields && !map[i] && (f.ItemsStyle || f.Type == 'DataView')) {
                    iterator = /\s*(\w+)\s*(=\s*(\w+)\s*)?(,|$)/g;
                    m = iterator.exec(contextFields);
                    while (m) {
                        if (m[3] == fieldName) {
                            var dependentItemsDataController = f.ItemsDataController,
                                requiresReset = !(itemsDataController && dependentItemsDataController) || itemsDataController != dependentItemsDataController;
                            map[i] = true;
                            if (!listedFields) {
                                listedFields = {};
                                $(values).each(function () {
                                    listedFields[this.name || this.Name] = true;
                                });
                            }
                            if (!listedFields[f.Name])
                                values.push({ 'name': f.Name, 'value': !requiresReset && row ? row[f.Index] : null });
                            var aliasField = allFields[f.AliasIndex];
                            if (aliasField != f && !listedFields[aliasField.Name])
                                values.push({ 'name': aliasField.Name, 'value': !requiresReset && row ? row[aliasField.Index] : null });
                            var copy = f.Copy,
                                m2;
                            if (copy && requiresReset)
                                while (m2 = _app._fieldMapRegex.exec(copy))
                                    if (!listedFields[m2[1]])
                                        values.push({ 'name': m2[1], 'value': null });
                            if (!f.skipPopulate) {
                                f.DynamicItems = null;
                                f.ItemCache = null;
                            }
                            that._enumerateContextFieldValues(f, values, map, row);
                        }
                        m = iterator.exec(contextFields);
                    }
                }
            }
        },
        _executeQuickFind: function (qry) {
            this._forceSync();
            for (var i = 0; i < this._allFields.length; i++)
                this._allFields[i]._listOfValues = null;
            this.removeQuickFind();
            for (i = 0; i < this._allFields.length; i++) {
                var f = this._allFields[i];
                if (!f.Hidden) {
                    f = this._allFields[f.AliasIndex];
                    if (isNullOrEmpty(qry)) {
                        //this.removeFromFilter(f);
                        this.refreshData();
                        //                    this.set_pageIndex(-2);
                        //                    this._loadPage();
                    }
                    else
                        this.applyFilter(f, '~', qry);
                    break;
                }
            }
            //this._forgetSelectedRow(true);
        },
        quickFind: function (sample) {
            var q = (isNullOrEmpty(sample) ? this.get_quickFindElement().value : sample).match(/^\s*(.*?)\s*$/);
            var qry = q[1] === resourcesGrid.QuickFindText ? '' : q[1];
            this.set_quickFindText(qry);
            this._executeQuickFind(qry);
            this._lostFocus = false;
        },
        encodePermalink: function (link, target, features) {
            _Sys.Net.WebServiceProxy.invoke(this.get_servicePath(), 'EncodePermalink', false, { 'link': link, 'rooted': false }, Function.createDelegate(this, this._encodePermalink_Success), Function.createDelegate(this, this._onMethodFailed), { 'target': target, 'features': features });
        },
        _encodePermalink_Success: function (result, context) {
            if (context.target || context.features)
                open(result, context.target, context.features)
            else
                location.href = result;
        },
        showViewMessage: function (message) {
            _touch.notify({ text: message, force: true });
        },
        hideViewMessage: function () {
            var elem = this._get('$HeaderText');
            if (elem != null) {
                var view = this.get_view();
                var text = view.OriginalHeaderText;
                if (!text) return;
                view.HeaderText = text;
                elem.innerHTML = this._formatViewText(resources.Views.DefaultDescriptions[text], true, text);
                this._viewMessages[view.Id] = null;
            }
        }
    };

    _app.registerClass('Web.DataView', _Sys.UI.Behavior);

    _app.hideMessage = function () { _app.showMessage(); };

    _app.formatMessage = function (type, message) { return String.format('<table cellpadding="0" cellspacing="0" ><tr><td class="{0}" valign="top">&nbsp;</td><td class="Message">{1}</td></tr></table>', type, message); };

    _app.showMessage = function (message) {
        _touch.notify({ text: message, force: true, duration: 'medium' });
    };

    _app.unanchor = function (href) {
        var m = href.match(/^(.+?)#.*$/);
        return m ? m[1] : href;
    };

    function validateDate(date) {
        return date && date.getTimezoneOffset && !isNaN(+date);
    }

    _app.ensureJSONProperties = ['OldValue', 'NewValue', 'Value'];
    _app.ensureJSONCompatibility = function (values) {
        $(values).each(function () {
            var v = this;
            $(_app.ensureJSONProperties).each(function () {
                var p = this;
                if (v[p]) {
                    if (v[p].getTimezoneOffset)
                        v[p] = _app.stringifyDate(v[p]);
                    //else if (typeof(v[p]) == 'string')
                    //    v[p] = _app.htmlEncode(v[p]);
                }
            });
        });

    };

    _app.stringifyDate = function (d) {
        if (!validateDate(d))
            return d;

        //if (field.Type == "DateTimeOffset") {
        //    var offset = -d.getTimezoneOffset(),
        //        sym = offset >= 0 ? '+' : '-';
        //    return String.format('{0}-{1}-{2}T{3}:{4}:{5}{6}{7}:{8}',
        //        d.getFullYear(), pad(d.getMonth() + 1), pad(d.getDate()), pad(d.getHours()), pad(d.getMinutes()), pad(d.getSeconds()), sym, pad(offset / 60), pad(offset % 60));
        //}

        //else
        //    return String.format('{0}-{1}-{2}T{3}:{4}:{5}',
        //        d.getFullYear(), pad(d.getMonth() + 1), pad(d.getDate()), pad(d.getHours()), pad(d.getMinutes()), pad(d.getSeconds()));
        var convert = dateTimeFormat.Calendar.convert;
        if (convert) {
            var nd = convert.toGregorian(d.getFullYear(), d.getMonth(), d.getDate());
            if (nd) {
                nd.setHours(d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
                d = nd;
            }
        }
        if (Date._localTimeEnabled())
            return d.toISOString();
        return String.format('{0}-{1:d2}-{2:d2}T{3:d2}:{4:d2}:{5:d2}.{6:d3}',
            d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
    };

    _app.isISO8601DateString = function (value) {
        return typeof value == 'string' && value.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    };

    _app.csv = {
        delimiter: ',',
        toString: function (ar) {
            ar.forEach(function (v, index) {
                if (v == null)
                    v = '';
                else {
                    v = v.toString();
                    var quotes;
                    if (v.match(/\"/)) {
                        quotes = true;
                        v = v.replace(/\"/g, '""');
                    }
                    else if (v.match(/(\r|\n|,)/))
                        quotes = true;
                    if (quotes)
                        v = '"' + v + '"';
                }
                ar[index] = v;

            });
            return ar.join(',');
        },
        toArray: function (s) {
            return _app.csv.toData(s)[0];
        },
        toData: function (s) {
            var delimiter = _app.csv.delimiter,
                data = [[]],
                arrMatches = null,
                d, v,
                pattern = new RegExp(
                    // Delimiters.
                    '(\\' + delimiter + '|\\r?\\n|\\r|^)' +
                    // Quoted fields.
                    '(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|' +
                    // Standard fields.
                    '([^\"\\' + delimiter + '\\r\\n]*))', 'gi');

            // Keep looping over the regular expression matches
            // until we can no longer find a match.
            if (s != null && s.length)
                while (arrMatches = pattern.exec(s)) {
                    // Get the delimiter that was found.
                    d = arrMatches[1];

                    // Check to see if the given delimiter has a length
                    // (is not the start of string) and if it matches
                    // field delimiter. If id does not, then we know
                    // that this delimiter is a row delimiter.
                    if (d.length && d !== delimiter)
                        // Since we have reached a new row of data,
                        // add an empty row to our data array.
                        data.push([]);

                    // Now that we have our delimiter out of the way,
                    // let's check to see which kind of value we
                    // captured (quoted or unquoted).
                    if (arrMatches[2])
                        // We found a quoted value. When we capture
                        // this value, unescape any double quotes.
                        v = arrMatches[2].replace(
                            new RegExp("\"\"", "g"),
                            "\""
                        );
                    else
                        // We found a non-quoted value.
                        v = arrMatches[3];

                    // Now that we have our value string, let's add
                    // it to the data array.
                    data[data.length - 1].push(v);
                }
            return data;
        }
    };

    _app.addon = function (type, method, args) {
        return $.ajax({
            url: appServicePath + '/Addon',
            data: jsonStringify({ type: type, method: method, args: args }),
            processData: false,
            method: 'POST',
            cache: false
        });
    };

    _app.resolveClientUrl = function (url, baseUrl) {
        if (!baseUrl)
            baseUrl = this._baseUrl || (typeof appBaseUrl == 'string' ? appBaseUrl : '');
        return url ? url.replace(/~\x2f/g, baseUrl) : null;
    };

    _app.jsExt = function () {
        var extension = 'min.js';
        $('script').each(function () {
            // appservices/combined-8.9.16.341.en-us.js?_touch
            var m = ($(this).attr('src') || '').match(/\/(combined-(\d+\.\d+\.\d+\.\d+).+?|daf)\.js\?(.+)/);
            if (m) {
                if (m[1] === 'daf')
                    extension = 'js?' + m[3];
                else
                    extension += '?' + m[2]
                return false;
            }
        });
        return extension;
    };

    _app.execute = function (args) {
        if (!args)
            args = {};
        var batchMode = !!args.batch,
            argsResponse = args.response,
            from,
            fromField;
        if (!batchMode) {
            from = args.from || args.in || (_touch && !args.controller ? _touch.dataView() : null);
            if (!from && !args.controller)
                from = _touch.dataView();
            if (from) {
                if (typeof from == 'string') {
                    args.as = from;
                    fromField = _touch.dataView().findField(from);
                    if (fromField)
                        from = fromField;
                }
                from = from._dataViewId || from;
                if (typeof from == 'string')
                    from = findDataView(from);
                if (!from)
                    throw new Error('Invalid arguments.');
                args.controller = from._controller;
                args.view = from._viewId;
                args.externalFilter = from._externalFilter;
                if (!args.sort)
                    args.sort = from.get_sortExpression();
                args.odp = from.odp;
                if (from.get_isForm()) {
                    args._filter = from._filter;
                    args.requiresNewRow = from.inserting();
                }
            }
        }
        if (args.done)
            args.success = args.done;
        if (args.fail)
            args.error = args.fail;
        var placeholder = $('<p>'),
            externalFilter = args.externalFilter,
            dataView = $create(Web.DataView, {
                controller: args.controller, viewId: args.view || 'grid1',
                servicePath: args.url || (typeof appServicePath == 'string' ? appServicePath : ''), baseUrl: (typeof appBaseUrl == 'string' ? appBaseUrl : ''), useCase: '$app', tags: args.tags,
                externalFilter: externalFilter, filterSource: args.filterSource || (externalFilter && externalFilter.length ? 'External' : null)
            }, null, null, placeholder.get(0)),
            sync = args.sync,
            api = {},
            fieldName,
            requiresNewRow = args.requiresNewRow,
            deferred = $.Deferred(),
            argsValues = args.values,
            //argsIn = args.in,
            argsOdp = args.odp;
        dataView._nativeDates = args.nativeDates;
        dataView._api = api;

        //if (argsIn) {
        //    argsOdp = _odp.get();
        //    while (argsOdp) {
        //        if (argsOdp._dataView._controller === argsIn)
        //            break;
        //        argsOdp = argsOdp._master;
        //    }
        //}
        dataView.odp = argsOdp === false ? false : argsOdp === true ? _odp.get() : argsOdp;
        if (sync)
            dataView._syncKey = Array.isArray(sync) ? sync : [sync];
        if (args.requiresData === false)
            api.DoesNotRequireData = true;
        if (args.background)
            api.background = true;
        api.requiresAggregates = args.requiresAggregates === true;
        api.metadataFilter = args.metadataFilter || ['fields'];
        if (args.fieldFilter)
            api.fieldFilter = args.fieldFilter;

        function cleanup() {
            dataView.dispose();
            placeholder.remove();
        }

        function done() {
            if (!argsResponse)
                dataView._busy(false);
        }

        function resolve(r) {
            if (args.success)
                args.success(r);
            else
                deferred.resolve(r);

        }

        dataView._onMethodFailed = function (error, response, method) {
            done();
            if (args.error)
                args.error(error, response);
            else
                deferred.reject(error, response);
            cleanup();
        };

        dataView._onGetPageComplete = function (result) {
            if (!batchMode)
                done();
            var r = { totalRowCount: result.TotalRowCount, pageIndex: result.PageIndex, pageSize: result.PageSize },
                rows = r[args.as || result.Controller] = [],
                requiresFormatting = args.format,
                pk = [], fieldMap = {},
                letters = result.FirstLetters;
            $(result.Fields).each(function (index) {
                var f = this;
                if (f.IsPrimaryKey)
                    pk.push(f);
                configureDefaultProperties(f);
                f.OriginalIndex = f.AliasIndex = f.Index = index;
                fieldMap[f.Name] = f;
            });
            $(result.Fields).each(function () {
                var f = this,
                    af;
                if (f.AliasName) {
                    af = fieldMap[f.AliasName];
                    if (af) {
                        f.AliasIndex = af.Index;
                        af.OriginalIndex = f.Index;
                    }
                }
            });
            //if (requiresFormatting)
            $(result.Fields).each(function () {
                var f = this;
                _field_prepareDataFormatString(dataView, f);
                //_field_initMethods(f); // the only important methods are: _field_format and _field_toColumns
                f.format = _field_format;
            });
            r.primaryKey = pk;
            r.fields = result.Fields;
            r.map = fieldMap;
            if (requiresNewRow)
                result.Rows = [result.NewRow];
            $(result.Rows).each(function () {
                var dataRow = this,
                    newRow = {};
                rows.push(newRow);
                $(result.Fields).each(function (index) {
                    var f = this,
                        v = dataRow[index];
                    if (requiresFormatting && f.DataFormatString && f.FormatOnClient) {
                        if (f.Type.match(/^Date/) && typeof v == 'string')
                            v = Date.fromUTCString(v);
                        v = f.format(v);
                    }
                    newRow[f.Name] = v;
                });
            });
            if (letters) {
                letters = letters.split(',');
                r.letters = { list: letters.slice(1), field: letters[0] };
            }
            if (this._requiresPivot) {
                r.Pivots = {};
                $(result.Pivots).each(function () {
                    r.Pivots[this.Name] = this;
                });
            }
            if (args.includeRawResponse || batchMode)
                r.rawResponse = result;
            if (batchMode)
                return r;
            resolve(r);
            cleanup();
        };

        if (argsResponse) {
            dataView._onGetPageComplete(argsResponse);
            return;
        }
        //dataView._pendingExecuteComplete = {};
        dataView._onExecuteComplete = function (result) {
            var batchMode = !!args.batch;
            if (_touch && dataView.odp)
                _touch.syncWithOdp(_touch.dataView());
            if (!batchMode)
                done();
            var r = result ?
                {
                    rowsAffected: result.RowsAffected,
                    canceled: result.Canceled,
                    clientScript: result.ClientScript,
                    navigateUrl: result.NavigateUrl,
                    errors: result.Errors
                } :
                {},
                obj = r[args.as || args.controller] = {};

            if (argsValues)
                if (Array.isArray(argsValues))
                    $(argsValues).each(function () {
                        var v = this;
                        obj[v.name || v.field] = 'newValue' in v ? v.newValue : 'oldValue' in v ? v.oldValue : v.value;
                    });
                else
                    for (var n in argsValues)
                        obj[n] = argsValues[n];

            if (result)
                $(result.Values).each(function () {
                    var v = this;
                    obj[this.Name] = 'NewValue' in v ? v.NewValue : v.Value;
                });
            //if (args.includeRawResponse || batchMode)
            r.rawResponse = result;
            if (batchMode)
                return r;
            resolve(r);
            cleanup();
        };

        if (args.batch) {
            dataView._busy(true);
            var selectBatch = [],
                executeBatch = [];
            $(args.batch).each(function () {
                var r = this,
                    batchRequest,
                    select = !r.command || r.command === 'Select';
                r.skipInvoke = true;
                if (select) {
                    if (r.pageIndex == null)
                        r.pageIndex = 0;
                    if (r.pageSize == null)
                        r.pageSize = 100;
                }
                batchRequest = _app.execute(r);
                if (select) {
                    batchRequest.Controller = r.controller;
                    batchRequest.View = r.view;
                    selectBatch.push(batchRequest);
                }
                else
                    executeBatch.push(batchRequest);
            });
            if (selectBatch.length)
                dataView._invoke('GetPageList', { requests: selectBatch }, function (result) {
                    done();
                    if (args.success) {
                        $(result).each(function (index) {
                            var r = this;
                            result[index] = dataView._onGetPageComplete(r);
                        });
                        args.success(result);
                    }
                    cleanup();
                }, null);
            if (executeBatch.length)
                dataView._invoke('ExecuteList', { requests: executeBatch }, function (result) {
                    done();
                    if (args.success) {
                        $(result).each(function (index) {
                            var r = this;
                            args.controller = executeBatch[index].Controller;
                            result[index] = dataView._onExecuteComplete(r);
                        });
                        args.success(result);
                    }
                    cleanup();
                }, null);
            return;
        }

        dataView._collectFieldValues = function () {
            var values = [],
                row;
            if (Array.isArray(argsValues))
                $(argsValues).each(function () {
                    var v = this,
                        oldValue,
                        newValue;
                    if ('Name' in v)
                        values.push(v);
                    else {
                        oldValue = _app.stringifyDate('oldValue' in v ? v.oldValue : v.value);
                        newValue = _app.stringifyDate('newValue' in v ? v.newValue : oldValue);
                        values.push({
                            Name: v.name || v.field,
                            NewValue: newValue,
                            OldValue: oldValue,
                            Modified: typeof v.modified != 'undefined' ? v.modified === true : oldValue != newValue,
                            ReadOnly: v.readOnly === true
                        });
                    }
                });
            else
                for (var fname in argsValues)
                    values.push({
                        Name: fname,
                        NewValue: argsValues[fname],
                        OldValue: null,
                        Modified: true,
                        ReadOnly: false
                    });
            if (from) {
                row = from.row();
                from._keyFields.forEach(function (f) {
                    var exists;
                    values.every(function (fv) {
                        exists = fv.Name === f.Name;
                        return !exists;
                    });
                    if (!exists)
                        values.push({ Name: f.Name, OldValue: row[f.Index] });
                });
            }
            return values;
        };

        dataView._validateFieldValues = function () {
            return true;
        };
        if (args.pageIndex != null)
            dataView._pageIndex = args.pageIndex;
        if (args.pageSize == null)
            args.pageSize = 100;
        if (args.sort)
            args.sortExpression = args.sort;
        dataView._pageSize = args.pageSize;
        if (args.selectedValues)
            dataView.SelectedValues = args.selectedValues;
        if (args.selectedKeys) {
            dataView.multiSelect(true);
            dataView.set_selectedValue(args.selectedKeys.join(';'));
        }
        if (args.lastCommand)
            dataView.set_lastCommandName(args.lastCommand);
        if (args.lastCommandArgument)
            dataView.set_lastCommandArgument(args.lastCommandArgument);
        if (requiresNewRow)
            api.inserting = true;
        args._init = true;
        dataView.search(args);
        if (args._filter)
            dataView._filter = args._filter;
        dataView._filterDetailsText = args.filterDetails;
        if (!args.command)
            args.command = 'Select';
        if (args.command === 'Pivot') {
            args.command = 'Select';
            dataView._requiresPivot = true;
            if (args.pivotDefinitions) {
                for (fieldName in args.pivotDefinitions) {
                    if (args.pivotDefinitions[fieldName].length > 0)
                        dataView._pivotDefinitions += ';' + fieldName + "=" + args.pivotDefinitions[fieldName].join();
                }
            }
        }
        if (args.requiresRowCount)
            dataView._requiresRowCount = true;
        if (args.letters)
            dataView._showFirstLetters = true;
        dataView._lookupContext = args.lookupContext;
        if (args.distinct)
            dataView._distinctValues = true;
        var skipInvoke = args.skipInvoke;
        if (skipInvoke)
            dataView._skipInvoke = true;

        function doExecute() {
            if (args.command === 'Select')
                dataView._loadPage();
            else {
                if (dataView.odp && from) {
                    dataView.get_isForm = function () { return true; };
                    dataView._parentDataViewId = from._id;
                    _odp.verify(dataView);
                }
                dataView.executeCommand({ commandName: args.command, commandArgument: args.argument || '', causesValidation: false, trigger: args.trigger });
            }
        }

        if (!skipInvoke && dataView.odp)
            setTimeout(doExecute, 48);
        else
            doExecute();

        if (skipInvoke) {
            cleanup();
            return dataView._invokeArgs;
        }
        return deferred.promise();
    };

    _app.ifThisThenThat = function () {
        var iftttList = _app._ifttt,
            list = arguments,
            listLength = list.length,
            i, ift, interval;
        if (listLength === 1 && typeof list[0] == 'number')
            interval = list[0];
        else if (listLength && typeof list[0] == 'boolean')
            interval = list[0] ? 5000 : 0;
        else if (listLength && typeof list[0] == 'string')
            $document.trigger('ifttt.app', list[0]);
        else {
            if (!iftttList)
                iftttList = _app._ifttt = [];
            for (i = 0; i < listLength; i++) {
                ift = list[i];
                if (typeof ift == 'function')
                    ift = { execute: ift, background: true };
                if (!ift.id)
                    ift.id = 'activity' + iftttList.length;
                iftttList.push(ift);
            }
            return iftttList;
        }
        if (interval != null)
            _app.ifThisThenThat._interval = interval;
    };

    _app.data = function (args) {
        var controller = args.d.Controller,
            id = args.id;
        _app.execute({
            format: args.format,
            response: args.d,
            controller: controller,
            success: function (result) {
                var dataObj = result[controller];
                delete result[controller];
                result.controller = controller;
                dataObj._metadata = result;
                dataObj._metadata.id = id;
                _app.data[id] = dataObj;
                var list = _app.data.objects;
                if (!list)
                    list = _app.data.objects = [];
                list.push(dataObj);
            }
        });
    };

    _app.dataBind = function (content, context) {
        if (_app.data.objects) {
            content.find('[data-control]').addBack('[data-control]').each(function () {
                var control = $(this),
                    processed = control.data('processed');

                if (!processed) {
                    control.data('processed', true);
                    var type = control.data('control'),
                        source = control.data('source'),
                        fieldName = control.data('field'),
                        topContext = context[context.length - 1];

                    if (type === 'form') {
                        var newContext = context.concat([_app.data[source]]);
                        control.children().each(function () {
                            _app.dataBind($(this), newContext);
                        });
                    }
                    else if (type === "repeater") {
                        if (source)
                            topContext = _app.data[source];
                        control.removeAttr('data-control data-source');
                        var template = control[0].innerHTML;
                        control.empty();
                        $(topContext).each(function () {
                            var newContext = context.slice(0),
                                element = $(template).appendTo(control);
                            newContext.push(this);
                            _app.dataBind(element, newContext);
                        });
                        // repeat control
                    }
                    else if (fieldName) {
                        switch (type) {
                            case 'label':
                                // find metadata
                                var i, it;
                                for (i = context.length; i--; i >= 0) {
                                    it = context[i];
                                    if (it._metadata) {
                                        $(it._metadata.fields).each(function () {
                                            if (this.Name === fieldName) {
                                                control.text(this.Label);
                                                return false;
                                            }
                                        });
                                        break;
                                    }
                                }
                                break;
                            case 'field':
                                if ($.isArray(topContext)) {
                                    topContext = topContext[0];
                                }
                                var val = topContext && topContext[fieldName];
                                if (val == null)
                                    control.text('');
                                else
                                    control.text(val);
                                break;
                        }
                    }
                }
            });
        }
    };

    findDataView = _app.findDataView = function (id) {
        return id && id._controller ? id : _app.find(id, 'Id');
    };

    appClipboard = _app.clipboard = {
        _options: function (options) {
            if (!options)
                options = _touch.dataView();
            if (options._controller)
                options = { dataView: options };
            return options;
        },
        data: function (options) {
            var result;
            if (options) {
                result = _clipboard;
                _clipboard = options;
                $window.trigger('throttledresize');
            }
            else {
                if (_clipboard == null) {
                    _clipboard = _app.userVar('clipboard');
                    if (_clipboard == null)
                        _clipboard = {};
                }
                result = _clipboard;
            }
            return result;
        },
        cut: function (options) {
            options = appClipboard._options(options);
            options.cut = true;
            return _app.clipboard.copy(options);
        },
        copy: function (options) {
            options = appClipboard._options(options);
            var dataView = options.dataView,
                objects = [],
                text = [],
                keyFields = dataView._keyFields,
                selectedKeyList = dataView.get_selectedValues().slice(),
                deferred = $.Deferred(),
                saveEditRow;
            if (dataView.get_isForm()) {
                objects.push(dataView.data());
                text.push($('#' + dataView._id + ' .app-page-header h1').first().text());
            }
            else {
                saveEditRow = dataView._editRow;
                dataView._cachedPages.every(function (p) {
                    p.rows.every(function (r) {
                        selectedKeyList.every(function (key, selectedKeyIndex) {
                            key = key.split(',');
                            var match = 0;
                            keyFields.forEach(function (pk, index) {
                                if (r[pk.Index].toString() === key[index])
                                    match++;
                            });
                            match = match === keyFields.length;
                            if (match) {
                                dataView._editRow = r;
                                objects.push(dataView.data());
                                selectedKeyList.splice(selectedKeyIndex, 1);
                                if (text.length < 3)
                                    text.push(dataView.extension().headerText(r, false));
                            }
                            return !match;
                        });
                        return selectedKeyList.length;
                    });
                    return selectedKeyList.length;
                });
                dataView._editRow = saveEditRow;
            }
            if (objects.length > 3)
                text.push('+' + (objects.length - 3));
            text = text.join(', ');
            _clipboard = {
                controller: dataView._controller, view: dataView._viewId, id: dataView._id, objects: objects,
                cut: options.cut, drag: options.drag,
                text: text, source: dataView.get_view().Label
            };
            if (!options.drag && _touch.settings('clipboard.scope') !== 'local')
                _app.userVar('clipboard', _clipboard);
            if (!options.drag)
                _touch.notify({ text: /*'"' + (cut ? resourcesEditor.Cut : resourcesEditor.Copy) + ': ' + */text, force: true });

            dataView.clipboard('changed');

            deferred.resolve(_clipboard);
            return deferred.promise(); // This is the "future" stub. May need to pull records from the server.
        },
        paste: function (options) {
            appClipboard.data();
            options = appClipboard._options(options);
            var controller = _clipboard.controller,
                dataView = options.dataView,
                saveEditRow = dataView._editRow,
                callback = options.callback,
                masterDataView,
                targetObject,
                masterRow,
                log = [],
                dragging = _clipboard.drag,
                commandName = dragging ? 'DragDrop' : _clipboard.cut ? 'CutPaste' : 'CopyPaste',
                ignoreRow = dataView.clipboard(dragging ? 'viewdrop' : 'viewpaste'),
                rules, handledByRule;

            function executePaste() {
                masterDataView = dataView.get_master();
                dataView._editRow = ignoreRow ? [] : (options.row || saveEditRow);
                targetObject = dataView.data();
                dataView._editRow = saveEditRow;

                // populute the master key fields if there is no selected item in the target of paste/drop
                if ((!dataView.get_selectedValues() || ignoreRow) && masterDataView && dataView._filterFields) {
                    masterRow = masterDataView.row();
                    dataView._filterFields.split(_app._simpleListRegex).forEach(function (filterField, index) {
                        var masterKeyField = masterDataView._keyFields[index];
                        if (masterKeyField)
                            targetObject[filterField] = masterRow[masterKeyField.Index];
                    });
                }
                _clipboard.objects.forEach(function (sourceObject, index) {
                    var args,
                        values = [],
                        fieldName;
                    for (fieldName in targetObject)
                        values.push({ Name: fieldName, OldValue: targetObject[fieldName] });
                    for (fieldName in sourceObject)
                        values.push({ Name: controller + '_' + fieldName, OldValue: sourceObject[fieldName] });
                    args = dataView._createArguments({ commandName: commandName, commandArgument: controller }, null, values);
                    args.Sequence = 0;
                    log.push({ controller: args.Controller, view: args.View, args: args });
                });
                if (!_clipboard.drag)
                    _touch.notify({ text: _clipboard.text, force: true });
                $.ajax({
                    url: __servicePath + '/commit',
                    method: 'POST',
                    authorize: true,
                    cache: false,
                    //dataType: 'text',
                    //processData: false,
                    data: jsonStringify({ log: log })
                }).done(function (result) {
                    result = result.d;
                    var sourceDataView = findDataView(_clipboard.id),
                        syncSource = sourceDataView && sourceDataView.get_isGrid() && sourceDataView._controller === _clipboard.controller && sourceDataView._viewId === _clipboard.view;

                    options.result = result;
                    handledByRule = executeExternalJavaScriptBusinessRule(dataView, options);
                    if (!handledByRule) {
                        rules = new _businessRules(dataView);
                        rules.after(options);
                        if (rules.canceled()) {
                            rules.dispose();
                            handledByRule = true;
                        }
                    }
                    if (!handledByRule)
                        if (result.Success) {
                            dataView.sync();
                            if (syncSource)
                                sourceDataView.sync();
                        }
                        else
                            _touch.notify({ text: result.Errors.join('\n'), force: true });
                    if (callback)
                        callback();
                });
            }

            if (!controller)
                return;

            if (dataView._busy() || _touch.busy()) {
                setTimeout(appClipboard.paste(options), 100);
                return;
            }

            options.commandName = commandName;
            options.commandArgument = controller;

            if (!handledByRule)
                if (options._handled)
                    handledByRule = false; // an async resolve means that we shall proceed with the default execution path
                else {
                    handledByRule = executeExternalJavaScriptBusinessRule(dataView, options, true);
                    if (handledByRule && handledByRule.then) {
                        $.when(handledByRule).then(executePaste);
                        return false; // handledByRule
                    }
                    if (!handledByRule) {
                        rules = new _businessRules(dataView);
                        rules.before(options);
                        if (rules.canceled()) {
                            rules.dispose();
                            handledByRule = true;
                        }
                        else if (rules._wait) {
                            $.when(rules._wait).then(executePaste);
                            return false; //rules._wait;
                        }
                    }
                }
            if (handledByRule)
                return false;

            executePaste();
        },
        clear: function () {
            if (!_clipboard.drag)
                _app.userVar('clipboard', null);
            _clipboard = {};
        }
    };

    _app.parseMap = function (map, callback) {
        if (typeof map != 'string' && map != null)
            map = map.items ? map.items.copy : map.copy || map.Copy;
        if (map) {
            var re = _app._fieldMapRegex,
                m = re.exec(map);
            while (m) {
                callback(m[1], m[2]); // callback(to, from)
                m = re.exec(map);
            }
        }
    };

    function toRect(obj) {
        if (obj.left == null && obj.x == null)
            obj = getBoundingClientRect(obj);
        if (obj.right == null)
            obj = { left: obj.x, top: obj.y, right: obj.x, bottom: obj.y };
        return obj;
    }

    _app.intersect = function (r1, r2) {
        r1 = toRect(r1);
        r2 = toRect(r2);
        var r1IsLeftOfR2 = r1.right < r2.left,
            r1IsRightOfR2 = r1.left > r2.right,
            r1IsAboveR2 = r1.top > r2.bottom,
            r1IsBelowR2 = r1.bottom < r2.top;
        return !(r1IsLeftOfR2 || r1IsRightOfR2 || r1IsAboveR2 || r1IsBelowR2);
    };

    _app.find = function (id, propertyName) {
        var cid,
            i, c, searchById = arguments.length === 1 || propertyName === 'Id',
            application = _Sys_Application,
            list;
        if (!id)
            return null;
        if (searchById) {
            c = application._components[id];
            if (propertyName === 'Id')
                return c;
        }
        if (!c) {
            list = application.getComponents();
            cid = '_' + id;
            for (i = 0; i < list.length; i++) {
                c = list[i];
                if (propertyName) {
                    if (isInstanceOfType(_app, c) && (propertyName === 'Controller' && c._controller === id || propertyName === 'Tag' && c.get_isTagged(id)))
                        return c;
                }
                else
                    if (isInstanceOfType(_app, c) && c._id.endsWith(cid))
                        return c;
            }
            if (searchById)
                c = _app.find(id, 'Controller');
        }
        return c;
    };

    _app.confirm = function (message, trueCallback, falseCallback) {
        var promise = $.Deferred();
        if (_window.confirm(message)) {
            if (trueCallback)
                trueCallback();
            else
                promise.resolve();
        }
        else if (falseCallback)
            falseCallback();
        else
            promise.reject();
        return promise;
    };

    _app.alert = function (message, callback) {
        var promise = $.Deferred();
        _window.alert(message);
        if (callback)
            callback();
        else
            promise.resolve();
        return promise;
    };

    _app.eval = function (text) {
        if (text) {
            var m = text.match(_jsExpRegex);
            while (m) {
                text = text.substring(0, m.index) + eval(m[1]) + text.substring(m.index + m[0].length);
                m = text.match(_jsExpRegex);
            }
        }
        return text;
    };

    _app.showModal = function (parent/*anchor*/, controller, view, startCommandName, startCommandArgument, baseUrl, servicePath, filter, properties) {
        var parentIsDataView = isInstanceOfType(_app, parent),
            propertiesSurvey = properties ? properties.survey : null,
            anchor = parent;
        if (!_touch) {
            if (parentIsDataView && parent._container)
                anchor = parent._container.getElementsByTagName('a')[0];
            if (!anchor) {
                var links = document.getElementsByTagName('a', 'input', 'button');
                for (var i = links.length - 1; i >= 0; i--) {
                    if (links[i].tabIndex >= 0) {
                        anchor = links[i];
                        break;
                    }
                }
            }
            if (anchor == null) {
                alert('Cannot find an anchor for a modal popup.');
                return;
            }
            closeHoverMonitorInstance();
        }
        if (_touch) {
            if (_touch.busy())
                return;
            _touch.modalDataView();
        }
        if (!baseUrl) baseUrl = _app._baseUrl;
        if (!servicePath) servicePath = _app._servicePath;
        var placeholder = this._placeholder = document.createElement('div'),
            loweredController = propertiesSurvey && propertiesSurvey.id || controller.toLowerCase().replace(/\_+/g, '-'),
            id = loweredController,
            instanceIndex = 1;
        while (_Sys_Application._components[id])
            id = loweredController + (instanceIndex++);

        placeholder.id = String.format('{0}_{1}_Placeholder{2}', controller, view, _Sys_Application.getComponents().length);
        if (parentIsDataView)
            parent._appendModalPanel(placeholder);
        else
            document.body.appendChild(placeholder);
        placeholder.className = 'ModalPlaceholder FixedDialog EmptyModalDialog';
        var survey,
            params = {
                id: id/*controller + '_ModalDataView' + applicationComponentCount*/, baseUrl: baseUrl, servicePath: servicePath,
                controller: controller, viewId: view, showActionBar: false, modalAnchor: anchor, startCommandName: startCommandName, startCommandArgument: startCommandArgument,
                exitModalStateCommands: ['Cancel'], externalFilter: filter
            };

        if (properties) {
            if (!properties.useCase) {
                properties.useCase = _app._defaultUseCase;
                _app._defaultUseCase = null;
            }
            params.filter = properties.filter;
            params.ditto = properties.ditto;
            params.lastViewId = properties.lastViewId;
            //params.transaction = properties.transaction;
            params.filterSource = properties.filterSource;
            params.filterFields = properties.filterFields;
            params.confirmContext = properties.confirmContext;
            params.showSearchBar = properties.showSearchBar;
            params.useCase = properties.useCase;
            params.tag = properties.tag;
            params.showActionButtons = properties.showActionButtons;
            survey = params.survey = propertiesSurvey;
        }
        var dataView = $create(Web.DataView, params, null, null, placeholder),
            dataText = parentIsDataView ? parent._dataText : null,
            surveyText2;
        if (parentIsDataView) {
            var parentId = parent._id,
                parentExternalFilter = parent._externalFilter;

            if (_touch && _touch.pageInfo(parent._id).deleted) {
                parentId = parent._parentDataViewId;
                if (parentExternalFilter && parentExternalFilter.length)
                    dataView._externalFilter = parentExternalFilter;
            }
            dataView._parentDataViewId = parentId;
            dataView._hasDetails = parent._hasDetails;
        }
        if (_touch && dataText) {
            var pageInfo = _touch.pageInfo(dataView._id);
            pageInfo.headerText = dataText;
            pageInfo.headerTextLocked = true;

        }
        if (_touch)
            _touch._dataText = null;

        if (survey) {
            surveyText2 = survey.text2;
            if (surveyText2 && typeof surveyText2 == 'function')
                surveyText2 = survey.text2 = surveyText2.call(dataView);
            if (survey.text && typeof survey.text == 'function')
                survey.text = survey.text.call(dataView);
            if (!survey.text && surveyText2) {
                survey.text = surveyText2;
                surveyText2 = survey.text2 = null;
            }
            if (surveyText2)
                if (_touch)
                    survey.text = [survey.text, surveyText2];
                else
                    survey.text += ' - ' + surveyText2;
            //else
            //    survey.text = survey.text;

            if (survey.description) {
                dataView.set_showDescription(true);
                dataView.set_description(survey.description);
            }
            survey.compiled = function (result) {
                if (_touch) {
                    survey.result = result;
                    if (survey.show !== false)
                        _touch.modalDataView(params.id, true);
                }
                else
                    dataView._onGetPageComplete(result);
            };
            _app.survey('compile', survey)
        }
        else
            if (_touch)
                _touch.modalDataView(params.id, true);
        return dataView;
    };

    _app.alert = function (message, callback) {
        alert(message);
        if (callback)
            callback();
    };

    //_app.isSaaS = function () {
    //    var that = this;
    //    if (that._isSaaS == null) {
    //        that._isSaaS = false;
    //        $('script').each(function () {
    //            if (this.src.match(/\/factory(.*?)\.js/))
    //                that._isSaaS = true;
    //        });
    //    }
    //    return that._isSaaS;
    //}

    _app._resizeInterval = null;
    _app._resizing = false;
    _app._resized = false;
    _app._customInputElements = [];

    _app.contentFrameworks = {
        bootstrap: {
            hasSelectors: [
                { name: 'navbar-fixed-top', selector: '.navbar-fixed-top' },
                { name: 'navbar-fixed-bottom', selector: '.navbar-fixed-bottom' },
                { name: 'navbar-static-top', selector: '.navbar-static-top' },
                { name: 'footer', selector: 'footer' }
            ],
            footer: { selector: 'footer,.footer', content: { html: '<footer><div class="container"></div></footer>', selector: '.container' } },
            fixedTop: { selector: '.navbar-fixed-top' },
            fixedBottom: { selector: '.navbar-fixed-bottom' }
        }
    };

    _app.filterDef = function (filterDefs, func) {
        if (func.endsWith('$')) func = func.substring(0, func.length - 1);
        for (var i = 0; i < filterDefs.length; i++) {
            var fd = filterDefs[i];
            if (fd) {
                if (fd.List) {
                    var result = _app.filterDef(fd.List, func);
                    if (result) return result;
                }
                else if (fd.Function == func)
                    return fd;
            }
        }
        return null;
    };


    _app._invoke = function (methodName, args, success, error) {
        var placeholder = $('<p>'),
            dataView = $create(Web.DataView, { servicePath: appServicePath, baseUrl: appBaseUrl, useCase: '$app' }, null, null, placeholder.get(0));
        dataView._busy(true);
        dataView._invoke(methodName, args, function (result) {
            dataView._busy(false);
            if (success)
                success(result);
            dataView.dispose();
            placeholder.remove();
        }, null, error);
    };

    _app.callWithFeedback = function (link, callback) {
        if (_touch)
            _touch.callWithFeedback(link, callback);
        else
            callback();
    };

    _app.sizeToText = sizeToText;

    _app.cms = {
        contentTypes: {
            'sys/api': {
                survey: 'cms/api/api-wizard',
                text: 'API Registration'
            },
            'sys/rules/': {
                survey: 'cms/rules/rule-wizard',
                text: 'Business Rule'
            },
            'sys/saas': {
                survey: 'cms/oauth/oauth-wizard',
                text: 'Open Authentication Registration'
            }
        },
        edit: function (row) {
            if (_touch) {
                var path = row.Path;
                for (var pathTest in cmsContentTypes)
                    if (path && path.startsWith(pathTest)) {
                        _app.survey({
                            controller: cmsContentTypes[pathTest].survey,
                            context: row
                        });
                        return true;
                    }
            }
        },
        new: function () {
            if (_touch)
                _app.survey({
                    controller: 'cms/new',
                    context: {}
                });
        },
        items: function () {
            var list = [{ value: '$custom', text: '(custom)' }];
            for (var k in cmsContentTypes)
                list.push({ value: cmsContentTypes[k].survey, text: cmsContentTypes[k].text });
            return list;
        }
    };
    var cmsContentTypes = _app.cms.contentTypes;

    _app.userName = function () {
        return __settings.appInfo.split('|')[1];
    };

    _app.userId = function () {
        return __settings.appInfo.split('|')[2];
    };

    _app.loggedIn = function () {
        return !!_app.userName();
    };

    $document.on('otpauth.app', function (e) {
        var args = e.args;
        _app.getScript('~/js/daf/daf-otpauth', function () {
            _app.otpauth[args.otpauth].login(args);
        });
    });

    _app.login = function (username, password, createPersistentCookie, success, error) {
        if (password == null && _touch && _touch.settings('membership.disableLoginPassword'))
            password = 'password';
        if (_touch && _touch.settings('ui.state.clear') === 'always') {
            _app.storage.clearUIState();
            try {
                if (sessionStorage)
                    sessionStorage['_clearUIState'] = true;
            }
            catch (ex) { }
        }
        _app._invoke('Login', { username: username, password: password, createPersistentCookie: _app.AccountManager.enabled() ? false : createPersistentCookie }, function (result) {
            if (result && result != 'false') {
                if (result != "true") {
                    if (password && !password.match(/(.+?:.+?;){2,}/)) {
                        result.callback = { success: success, error: error };
                        result.password = password;
                        result.createPersistentCookie = createPersistentCookie;
                    }
                    if (result.event) {
                        $document.trigger($.Event(result.event, { args: result }));
                        success = false;
                    }
                    else if (result.alert) {
                        _app.alert(result.alert);
                        success = false;
                    }
                    else if (result.notify) {
                        _touch.notify({ text: result.notify, force: true });
                        success = false;
                    }
                    else {
                        if (!createPersistentCookie)
                            result.session = true;
                        _app.AccountManager.set(result);
                    }
                    //if (createPersistentCookie)
                    //    _app.AccountManager.set(result);
                    //else
                    //    _app.AccountManager.remove(username, true);
                }
                if (success)
                    success(result);
            }
            else
                if (error)
                    error(result);
        });
    };

    function updateUserObj(user, result) {
        if (user.Handler)
            result.Handler = user.Handler;
        if (user.session)
            result.session = user.session;
        return result;
    }

    _app.switchUser = function (user, success, error) {
        _app._invoke(
            'Login',
            { username: user.name, password: 'token:' + user.refresh_token, createPersistentCookie: false },
            function (result) {
                if (result) {
                    if (result != "true")
                        _app.AccountManager.set(updateUserObj(user, result));
                    if (success)
                        success(result);
                }
                else
                    if (error)
                        error();
            });
    };

    _app.refreshUserToken = function (user, success, error) {
        _app._invoke(
            'Login',
            { username: user.name, password: 'token:' + user.refresh_token, createPersistentCookie: false },
            function (result) {
                if (result) {
                    if (typeof result == "object")
                        _app.AccountManager.set(updateUserObj(user, result));
                    if (success)
                        success(result);
                }
                else
                    if (error)
                        error();
            });
    };

    _app.logout = function (callback) {
        _app.AccountManager.remove(_app.userName());
        _app._invoke('Logout', {}, function () {
            if (callback)
                callback();
        });
    };

    _app.roles = function (callback) {
        _app._invoke('Roles', {}, function (result) {
            if (callback)
                callback(result);
        });
    };

    _app.configureFramework = function (framework, pageContent, callback) {
        $(_app.contentFrameworks[framework]).each(function () {
            var fw = this;
            $(fw.hasSelectors).each(function () {
                if (pageContent.find(this.selector).length)
                    pageContent.addClass('has-' + this.name);
            });
            if (fw.footer && !pageContent.find(fw.footer.container).find(fw.footer.selector).length)
                $(fw.footer.content.html).appendTo(pageContent).find(fw.footer.content.selector).append($('#PageFooterBar,footer small').html());
            if (callback)
                callback(fw);
        });
    };

    function findSelectedMenuNode(nodes) {
        var result = null;
        $(nodes).each(function () {
            var n = this;
            if (n.selected) {
                result = n;
                return false;
            }
            else if (n.children) {
                result = findSelectedMenuNode(n.children);
                if (result)
                    return false;
            }
        });
        return result;
    }

    function buildSiteMap(parent, nodes) {
        $(nodes).each(function () {
            var n = this,
                href = n.url,
                target,
                hrefParts,
                li = $('<li/>').appendTo(parent),
                a;
            if (href) {
                hrefParts = href.match(/^(_\w+):(.+)$/);
                if (hrefParts) {
                    href = hrefParts[2];
                    target = hrefParts[1];
                }
                a = $('<a/>').attr({ href: href, title: n.description, target: target });
            }
            else
                a = $('<span/>');
            a.appendTo(li).text(n.title);
            if (n.children) {
                buildSiteMap($('<ul/>').appendTo(li), n.children);
            }
        });
    }

    _app._contentFactories = {
        'site-map': function (container) {
            var startFromCurrentNode = container.attr('data-start-from-current-node') === 'true',
                menu = Web.Menu,
                nodes = menu.Nodes[menu.MainMenuId],
                currentNode = findSelectedMenuNode(nodes),
                ul = $('<ul class="SiteMapPlaceholder"/>').appendTo(container);
            buildSiteMap(ul, startFromCurrentNode ? currentNode.children : nodes);
        }
    };

    _app.get_commandLine = function () {
        var commandLine = _app._commandLine;
        if (!commandLine) {
            if (typeof __dacl != 'undefined')
                commandLine = __dacl;
            if (!commandLine) {
                commandLine = typeof Web.Membership != 'undefined' && Web.Membership._instance ? Web.Membership._instance.get_commandLine() : null;
                commandLine = !commandLine ? location.href : location.pathname + '?' + commandLine;
            }
            _app._commandLine = _app.unanchor(commandLine);
        }
        return commandLine;
    };

    _app._parse = function () {
        _touch = _app.touch;
        _host = _app.host;
        _odp = _app.odp;
        appBaseUrl = _window.__baseUrl;
        appServicePath = _window.__servicePath;
        if (this._parsed) return;
        this._parsed = true;
        $('div[data-controller]').each(function () {
            var extender = $(this);
            var controller = extender.attr('data-controller');
            if (controller) {
                var id = extender.attr('id');
                if (!id)
                    id = controller;
                var args = { id: id, controller: controller, baseUrl: appBaseUrl, servicePath: appServicePath, showSearchBar: true };
                var properties = [
                    { name: 'autoHide', aliases: ['nothing', 'self', 'container'], values: [0, 1, 2] },
                    { name: 'autoSelectFirstRow', type: 'bool' },
                    { name: 'autoHighlightFirstRow', type: 'bool' },
                    { name: 'filterSource' },
                    { name: 'filterFields' },
                    { name: 'pageSize', type: 'int' },
                    { name: 'refreshInterval', type: 'int' },
                    { name: 'searchByFirstLetter', type: 'bool', propName: 'showFirstLetters' },
                    { name: 'searchOnStart', type: 'bool' },
                    { name: 'selectionMode', aliases: ['single', 'multiple'], values: ['Single', 'Multiple'] },
                    { name: 'showActionBar', type: 'bool' },
                    { name: 'showActionButtons', aliases: ['', 'none', 'top', 'bottom', 'top-and-bottom'], values: ['Auto', 'None', 'Top', 'Bottom', 'TopAndBottom'] },
                    { name: 'showDetailsInListMode', type: 'bool' },
                    { name: 'showDescription', type: 'bool' },
                    { name: 'showInSummary', type: 'bool' },
                    { name: 'showModalForms', type: 'bool' },
                    { name: 'showQuickFind', type: 'bool' },
                    { name: 'showPageSize', type: 'bool' },
                    { name: 'showPager', aliases: ['none', 'top', 'bottom', 'top-and-bottom'], values: ['None', 'Top', 'Bottom', 'TopAndBottom'] },
                    { name: 'showRowNumber', type: 'bool' },
                    { name: 'showSearchBar', type: 'bool' },
                    { name: 'showViewSelector', type: 'bool' },
                    { name: 'startCommandName' },
                    { name: 'startCommandArgument' },
                    { name: 'summaryFieldCount', type: 'int' },
                    { name: 'tag' },
                    { name: 'tags' },
                    { name: 'view', propName: 'viewId' },
                    { name: 'visibleWhen' }
                ];
                $(properties).each(function () {
                    var prop = this,
                        v = extender.attr('data-' + prop.name.replace(/([A-Z])/g, '-$1'));
                    if (v) {
                        if (prop.aliases)
                            v = prop.values[Array.indexOf(prop.aliases, v.toString().toLowerCase())];
                        if (prop.type === 'bool')
                            v = v === 'true';
                        if (prop.type === 'int')
                            v = parseInteger(v);
                        args[prop.propName || prop.name] = v;
                    }
                });
                extender.attr('id', null);
                $create(Web.DataView, args, null, null, this);
            }
        });
    };

    _app.DetailsRegex = /\/Details\.aspx\?/i;
    _app.LocationRegex = /^(_.+?):(.+)$/;
    _app.LEVs = [];
    _app.Editors = [];
    _app.EditorFactories = {};


    _app.dateFormatStrings = {
        '{0:g}': dateTimeFormat.ShortDatePattern + ' ' + dateTimeFormat.ShortTimePattern,
        '{0:G}': dateTimeFormat.ShortDatePattern + ' ' + dateTimeFormat.LongTimePattern,
        '{0:f}': dateTimeFormat.LongDatePattern + ' ' + dateTimeFormat.ShortTimePattern,
        '{0:u}': dateTimeFormat.SortableDateTimePattern,
        '{0:U}': dateTimeFormat.UniversalSortableDateTimePattern
    };

    _field_prepareDataFormatString = function (dataView, field) {
        if (field.DataFormatString && field.DataFormatString.indexOf('{') === -1) field.DataFormatString = '{0:' + field.DataFormatString + '}';
        if (field.DataFormatString) field.DataFormatString = dataView.resolveClientUrl(field.DataFormatString);
        if (field.Type.startsWith('Date')) {
            if (!field.DataFormatString) field.DataFormatString = '{0:d}';
            else {
                var m = field.DataFormatString.match(/{0:(g)}/i),
                    fmt;
                if (m) {
                    field.DateFmtStr = '{0:' + dateTimeFormat.ShortDatePattern + '}';
                    field.TimeFmtStr = '{0:' + (m[1] === 'g' ? dateTimeFormat.ShortTimePattern : dateTimeFormat.LongTimePattern) + '}';
                }
                fmt = _app.dateFormatStrings[field.DataFormatString];
                if (fmt) field.DataFormatString = '{0:' + fmt + '}';
                if (field.DateFmtStr)
                    field.DataFmtStr = field.DataFormatString;
            }
        }
    };

    _app._tagTests = {};
    _isTagged = _app.is = function (tags, test) {
        var re, m, result = false, v;
        if (tags) {
            re = _app._tagTests[test];
            if (!re) {
                re = new RegExp('(^|\\s|,)' + RegExp.escape(test) + '(-(\\w+))?\\b');
                _app._tagTests[test] = re;
            }
            m = tags.match(re);
            if (m) {
                v = m[3];
                if (v == null)
                    result = true;
                else if (v != 'none')
                    result = v;
            }
        }
        return result;
    };

    function _field_initMethods(field) {
        // , format: _field_format, toColumns: _field_toColumns, isReadOnly: _field_isReadOnly, isNumber: _field_isNumber, lov: _field_lov 
        field.format = _field_format;
        field.toColumns = _field_toColumns;
        field.isReadOnly = _field_isReadOnly;
        field.isNumber = _field_isNumber;
        field.lov = _field_lov;
        field.text = _field_text;
        field.trim = _field_trim;
        field.htmlEncode = _field_htmlEncode;
    }

    _field_is = function (test) {
        return _isTagged(this.Tag, test);
    };

    _field_tagged = function (test) {
        var tag = this.Tag,
            index,
            t, number = '',
            argList = arguments;
        if (tag) {
            if (argList.length === 1 && test.ignoreCase != null)
                return (tag || '').match(test);

            //if (argList.length == 1 && Object.prototype.toString.call(argList[0]) == '[object Array]')
            //    argList = argList[0];
            for (var i = 0; i < argList.length; i++) {
                t = argList[i];
                index = tag.indexOf(t);
                if (index >= 0) {
                    i = index + t.length;
                    while (i < tag.length) {
                        var m = tag[i].match(/\d/);
                        if (m)
                            number += tag[i++];
                        else
                            break;
                    }
                    _app.tagSuffix = number;
                    return true;
                }
            }
        }
        return false;
    };

    _field_tag = function (t) {
        this.Tag = (this.Tag || '') + ',' + t;
    };

    _field_lov = function (kind) {
        var that = this,
            itemsDataController = that.ItemsDataController;
        if (kind === 'dynamic')
            return !!itemsDataController;
        if (kind === 'static')
            return !itemsDataController && !!that.ItemsStyle;
        return that.Items;
    };

    _field_toColumns = function () {
        var field = this,
            columns = field.Columns;
        if (columns === 0 && field.Type === 'String')
            columns = Math.floor(field.Len);
        if (field.ItemsTargetController && !columns)
            columns = 80;
        else if (columns > 80)
            columns = 80;
        else if (!columns)
            if (field.Type === 'String') {
                columns = field.Rows > 1 ? 80 : 30;
                if (field.Len > 0 && field.Len < columns)
                    columns = field.Len;
            }
            else
                columns = 7;
        if (field.Type.match(/^Date/) && columns < 20)
            columns = field.DataFormatString === 'd' || field.DataFormatString === '{0:d}' ? 10 : columns;
        else if (field.Type === 'Guid' && columns < 36)
            columns = 36;
        return columns;
    };

    _field_format = function (v) {
        var that = this,
            formatOnClient = that.FormatOnClient,
            dataFormatString = that.DataFormatString,
            result;
        try {
            if (v != null && that.Type === 'TimeSpan' && dataFormatString && formatOnClient && typeof v == 'string')
                v = Date.tryParseFuzzyTime(v, false);

            if (v == null)
                result = 'null';
            else {
                //if (that._smartSize && !dataFormatString)
                //    result = fileSizeToText(v);
                //else
                result = formatOnClient && !isNullOrEmpty(dataFormatString) ? String.localeFormat(dataFormatString, v) : v.toString();
            }
            return result;
        }
        catch (e) { throw new Error(String.format('\nField: {0}\nData Format String: {1}\n{2}', that.Name, dataFormatString, e.message)); }
    };

    _field_isReadOnly = function () {
        return this.TextMode === 4 || this.ReadOnly;
    };

    _field_isNumber = function () {
        //return Array.indexOf(['SByte', 'Byte', 'Int16', 'Int32', 'UInt32', 'Int64', 'Single', 'Double', 'Decimal', 'Currency'], this.Type);
        return this.Type.match(_app.numericTypeRegex);
    };

    _field_htmlEncode = function () {
        return this.HtmlEncode && this.TextMode !== 2;
    };

    _field_trim = function (v) {
        var that = this;
        if (that.Type === 'String' && v != null && v.length > resourcesData.MaxReadOnlyStringLen && !(that.TextMode === 3 || that.TextMode === 2 || !that.HtmlEncode && v.match(/<\/?\w+>/)))
            v = v.substring(0, resourcesData.MaxReadOnlyStringLen) + '...';
        //if (v && that.TextMode == 3)
        //    v = v.replace(/(\r?\n)/g, '<br/>');
        return v;
    };

    _field_text = function (v, trim) {
        var that = this,
            s, valueList,
            isCheckBoxList = that.ItemsStyle === 'CheckBoxList',
            dataView = that._dataView,
            item,
            nullValue = labelNullValueInForms,
            fieldItems = that.DynamicItems || that.Items;
        if (!fieldItems.length)
            if (isBlank(v))
                s = nullValue;
            else {
                if (that.Type === 'Byte[]' && !that.OnDemand)
                    s = _app.toHexString(v);
                else
                    s = that.format(v);
            }
        else if (that.ItemsDataController) {
            s = [];
            if (v && typeof v !== 'string')
                v = v.toString();
            if (that.ItemsTargetController || isCheckBoxList) {
                valueList = (v || '').split(',');
                $(fieldItems).each(function () {
                    var item = this;
                    if (valueList.indexOf((item[0] || '').toString()) !== -1)
                        s.push(item[1]);
                });
            }
            else
                $((v || '').split(',')).each(function () {
                    var item = dataView._findItemByValue(that, this);
                    if (item)
                        s.push(item[1]);
                });
            s = !s.length ? nullValue : s.join(', ');
        }
        else {
            if (v == null)
                s = nullValue;
            else if (isCheckBoxList) {
                s = [];
                $(v.toString().split(/,/g)).each(function () {
                    var item = dataView._findItemByValue(that, this);
                    if (item)
                        s.push(item[1]);
                });
                s = s.join(', ');
            }
            else {
                item = dataView._findItemByValue(that, v);
                s = item ? item[1] : v.toString();
            }
        }
        if (that.TextMode === 1) s = '**********';
        if (trim !== false)
            s = that.trim(s);
        return s;
    };

    Array.indexOfCaseInsensitive = function (list, value) {
        value = value.toLowerCase();
        for (var i = 0; i < list.length; i++)
            if (list[i].toLowerCase() == value)
                return i;
        return -1;
    };

    Number.tryParse = function (s, fmt) {
        if (typeof s != 'string') return null;
        if (isNullOrEmpty(s)) return null;
        var n = Number.parseLocale(s);
        if (isNaN(n)) {
            var nf = currentCulture.numberFormat;
            if (!nf._simplifyRegex)
                nf._simplifyRegex = new RegExp(String.format('({0}|\\{1})', nf.CurrencySymbol.replace(/(\W)/g, "\\$1"), nf.CurrencyGroupSeparator), 'gi');
            var isNegative = s.match(/\(/) != null;
            s = s.replace(nf._simplifyRegex, '').replace(/\(|\)/g, '');
            s = s.replace(nf.CurrencyDecimalSeparator, nf.NumberDecimalSeparator);
            n = Number.parseLocale(s)
            if (isNaN(n)) {
                n = Number.parseLocale(s.replace(nf.PercentSymbol, ''));
                if (!isNaN(n))
                    n /= 100;
            }
        }
        if (!isNaN(n)) {
            if (isNegative)
                n *= -1;
            return n;
        }
        return null;
    };

    Date.tryParseFuzzyDate = function (s, dataFormatString) {
        if (isNullOrEmpty(s)) return null;
        s = s.trim();
        var d = Date.parseLocale(s, dateTimeFormat.ShortDatePattern);
        if (d == null)
            d = Date.parseLocale(s, dateTimeFormat.LongDatePattern);
        if (d == null && !isNullOrEmpty(dataFormatString)) {
            var dfsm = dataFormatString.match(/\{0:([\s\S]*?)\}/);
            if (dfsm)
                d = Date.parseLocale(s, dfsm[1]);
        }
        if (d)
            return d;
        // month or day name
        d = new Date();
        var m = s.match(/^(\w+)$/);
        if (m) {
            var index = Array.indexOfCaseInsensitive(dateTimeFormat.DayNames, m[1]);
            if (index === -1)
                index = Array.indexOfCaseInsensitive(dateTimeFormat.AbbreviatedDayNames, m[1]);
            if (index === -1)
                index = Array.indexOfCaseInsensitive(dateTimeFormat.ShortestDayNames, m[1]);
            if (index >= 0) {
                while (d.getDay() != index)
                    d.setDate(d.getDate() + 1);
                return d;
            }
        }
        // month and day
        m = s.match(/^(\w+|\d+)[^\w\d]*(\w+|\d+)$/);
        if (m) {
            var month = m[1];
            var day = m[2];
            if (month.match(/\d+/)) {
                month = day;
                day = m[1];
            }
            m = day.match(/\d+/);
            day = m ? m[0] : 1;
            index = Array.indexOfCaseInsensitive(dateTimeFormat.MonthNames, month);
            if (index == -1)
                index = Array.indexOfCaseInsensitive(dateTimeFormat.AbbreviatedMonthNames, month);
            if (index >= 0) {
                d.setDate(1);
                while (d.getMonth() != index)
                    d.setMonth(d.getMonth() + 1);
                d.setDate(day);
                return d;
            }
        }
        // try converting numbers
        m = s.match(/^(\d\d?)(\D*(\d\d?))?(\D*(\d\d\d?\d?))?$/);
        if (!m) return null;
        try {
            if (!dateTimeFormat.LogicalYearPosition) {
                var ami = dateTimeFormat.ShortDatePattern.indexOf('m');
                if (ami < 0)
                    ami = dateTimeFormat.ShortDatePattern.indexOf('M');
                var adi = dateTimeFormat.ShortDatePattern.indexOf('d');
                if (adi < 0)
                    adi = dateTimeFormat.ShortDatePattern.indexOf('D');
                dateTimeFormat.LogicalYearPosition = 5;
                dateTimeFormat.LogicalMonthPosition = ami < adi ? 1 : 3;
                dateTimeFormat.LogicalDayPosition = ami < adi ? 3 : 1;
            }
            var dy = m[dateTimeFormat.LogicalYearPosition];
            // find year
            if (isNullOrEmpty(dy))
                dy = d.getFullYear();
            else
                dy = Number.parseLocale(dy);
            if (!isNaN(dy) && dy < 50)
                dy += !dateTimeFormat.Calendar.convert ? 2000 : 1400;
            // find month
            var dm = m[dateTimeFormat.LogicalMonthPosition];
            if (isNullOrEmpty(dm))
                dm = d.getMonth();
            else {
                dm = Number.parseLocale(dm);
                dm--;
            }
            // find day
            var dd = m[dateTimeFormat.LogicalDayPosition];
            if (isNullOrEmpty(dd))
                dd = d.getDate();
            else
                dd = Number.parseLocale(dd);
            d = new Date(dy, dm, dd);
            if (isNaN(d.getTime()))
                return null;
        }
        catch (err) {
            return null;
        }
        return d;
    };

    Date.tryParseFuzzyTime = function (s, autoAdjustHours) {
        if (isNullOrEmpty(s)) return null;
        s = s.trim();
        var d = null;
        var m = s.match(/^(\d\d?)(\D*(\d\d?))?(\s*(\w+))?$/);
        if (!m)
            m = s.match(/^(\d\d?)(\D*(\d\d?))?(\D*(\d\d?))?(\D*(\d+))?(\s*([\S\s]+))?$/);
        if (m) {
            d = new Date();
            var hh = m[1];
            var mm = m[3] || '0';
            var ss = m.length === 10 ? m[5] : '0' || '0';
            var ms = m.length === 10 ? m[7] : '0' || '0';
            var ampm = m[m.length - 1];
            if (!isNullOrEmpty(hh)) {
                hh = Number.parseLocale(hh);
                if (!isNullOrEmpty(ampm))
                    if (ampm.toLowerCase() === dateTimeFormat.PMDesignator.toLowerCase()) {
                        if (hh !== 12)
                            hh += 12;
                    }
                    else {
                        if (hh === 12)
                            hh = 0;
                    }
                else
                    if (autoAdjustHours !== false && !isNullOrEmpty(dateTimeFormat.PMDesignator) && dateTimeFormat.ShortTimePattern.indexOf('tt') > 0 && new Date().getHours() >= 12)
                        hh += 12;
                d.setHours(hh);
            }

            if (!isNullOrEmpty(mm))
                d.setMinutes(Number.parseLocale(mm));
            d.setSeconds(!isNullOrEmpty(ss) ? Number.parseLocale(ss) : 0);
            d.setMilliseconds(!isNullOrEmpty(ms) ? Number.parseLocale(ms) : 0);
        }
        return d;
    };

    Date.tryParseFuzzyDateTime = function (s, dataFormatString) {
        s = s.trim();
        var m = s.match(/([^\s]+)\s+(.+)/);
        if (m) {
            // see if second part is am/pm
            if (!isNullOrEmpty(dateTimeFormat.AMDesignator) && (m[2].toLowerCase() == dateTimeFormat.AMDesignator.toLowerCase() || m[2].toLowerCase() == dateTimeFormat.PMDesignator.toLowerCase()))
                return Date.tryParseFuzzyTime(s);

            var date = Date.tryParseFuzzyDate(m[1], dataFormatString);
            var time = Date.tryParseFuzzyTime(m[2], true);
            if (!date && !time)
                return null;
            else if (date && !time)
                return date;
            else if (!date && time)
                return time;
            else {
                time.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                return time;
            }
        }
        return null;
    };

    Date._localTimeEnabled = function () {
        var that = this,
            useLocalTime = that._lte;
        if (typeof useLocalTime !== 'boolean')
            useLocalTime = that._lte = _touch ? _touch.settings('dates.localTime.enabled') === true : false;
        return useLocalTime === true;
    };

    Date._jsonRegex = new RegExp(/(\d{4})\-(\d{2})\-(\d{2})T(\d{2})\:(\d{2})\:(\d{2})\.(\d{3})(Z)?/);
    Date.fromUTCString = function (s) {
        if (Date._localTimeEnabled())
            return new Date(s.match(/z$/i) ? s : s + 'Z');
        var m = Date._jsonRegex.exec(s),
            d;
        if (m)
            d = new Date(parseInteger(m[1]), parseInteger(m[2]) - 1, parseInteger(m[3]), parseInteger(m[4]), parseInteger(m[5]), parseInteger(m[6]), parseInteger(m[7]));
        //var offset = d.getTimezoneOffset();
        //d.setMinutes(d.getMinutes() + offset);
        return d;
    };

    _app._dateRegex = /\"(\d{4}\-\d{2}\-\d{2}T\d{2}\:\d{2}\:\d{2}\.\d{3})Z?\"/g;

    function deserializeControllerJson(data, nativeDates) {
        return nativeDates !== false ? data.replace(_app._dateRegex, 'Date.fromUTCString("$1")') : data;
    }

    _app.parseJSON = function (result, nativeDates) {
        return result ?
            nativeDates === false || !result.match(_app._dateRegex) ?
                JSON.parse(result).d :
                eval('(' + deserializeControllerJson(result, nativeDates) + ')').d :
            null;
    };

    _app.serializer = _serializer = {
        serialize: jsonStringify,
        deserialize: function (data, secure) {
            try {
                return data == null ?
                    null :
                    data.match(_app._dateRegex) ?
                        eval('(' + deserializeControllerJson(data) + ')') :
                        JSON.parse(data);
            }
            catch (er) {
                throw Error.argument('data', _Sys.Res.cannotDeserializeInvalidJson);
            }
        }
    };

    if (_Sys.Serialization)
        _Sys.Serialization.JavaScriptSerializer.deserialize = _serializer.deserialize;

    Date.$addDays = function (d, delta) {
        return d ? new Date(d.setDate(d.getDate() + delta)) : d;
    };

    Date.$now = function () {
        return new Date();
    };

    Date.$today = function () {
        var d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
    };

    Date.$endOfDay = function () {
        var d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
    };

    Date.$within = function (d, delta) {
        return d ? d < Date.$addDays(Date.$today(), delta) && d >= Date.$today() : false;
    };

    Date.$pastDue = function (d1, d2) {
        if (d2 == null)
            d2 = new Date();
        if (!d2.getHours())
            d2 = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate(), 23, 59, 59);
        if (d1 == null) d1 = new Date();
        return d1 > d2;
    };

    Date.prototype.getFullYearText = function () {
        if (dateTimeFormat.Calendar.convert)
            return (dateTimeFormat.Calendar.convert.fromGregorian(this) || [this.getFullYear()])[0];
        return this.getFullYear();
    };

    _window.__designer = function () {
        return typeof __designerMode != 'undefined';
    };

    _window.__evalEvent = function (eventName) {
        var script = this.getAttribute('on' + eventName + '2');
        if (isNullOrEmpty(script))
            return true;
        var returnResult = true;
        script = script.replace(/(^|;)return /g, ';returnResult=');
        eval(script);
        return returnResult;
    };

    function executeExternalJavaScriptBusinessRule(dataView, args, beforePhase) {
        var result,
            commandName = args.commandName || args.CommandName,
            commandArgument = args.commandArgument || args.CommandArgument,
            actionPath = args.path || args.Path || '',
            actionIDs,
            rules = _app.rules[dataView._controller];
        if (rules) {
            if (!beforePhase)
                rules = rules.after;
            if (rules) {
                if (commandName in rules) {
                    rules = rules[commandName];
                    if (commandArgument && commandArgument in rules)
                        rules = rules[commandArgument];
                }
                else if (actionPath) {
                    actionIDs = actionPath.split(/\//);
                    if (actionIDs[0] in rules)
                        rules = rules[actionIDs[0]];
                    if (actionIDs.length > 1 && actionIDs[1] in rules)
                        rules = rules[actionIDs[1]];
                }
                if (typeof rules == 'function') {
                    if (beforePhase && dataView.editing()) {
                        var actionArgs = dataView._createArguments(args);
                        dataView._validateFieldValues(actionArgs.Values, args.causesValidation, false);
                        if (commandName !== 'Calculate' && !dataView.validate(actionArgs.Values))
                            return false;
                    }
                    result = rules(dataView, args);
                }
                if (result === false)
                    result = true; // the rule does not require additional processing
            }
        }
        return result;
    }

    function compileBusinessRule(script) {
        var compiledScript = [],
            index = 0,
            iterator = /\$(row|master|context)\s*\.\s*(\w+)(\s*=(=|(\s*([\S\s]+?)\s*;)))?/gm,
            m,
            scope, fieldName, expression;
        while (m = iterator.exec(script)) {
            scope = m[1];
            fieldName = m[2];
            expression = m[6];
            compiledScript.push(script.substr(index, m.index - index));
            if (scope === 'row')
                scope = null;
            if (expression)
                compiledScript.push(String.format('_this.updateFieldValue("{0}",{1},"{2}");', fieldName, compileBusinessRule(expression), scope));
            else {
                compiledScript.push(String.format('_this.fieldValue("{0}"{1})', fieldName, scope ? (',"' + scope + '"') : ''));
                if (m[4] === '=')
                    compiledScript.push('==');
            }
            index = m.index + m[0].length;
            //m = iterator.exec(script);
        }
        if (index < script.length)
            compiledScript.push(script.substr(index));
        compiledScript = compiledScript.join('').replace(/\$(row|master|context)/g, '_this.dataView().data("$1")');
        return compiledScript;
    }

    var _businessRules = _web.BusinessRules = function (dataView) {
        this._dataView = dataView;
        this.result = new Web.BusinessRules.Result(this);
    };

    _businessRules.reset = function (controller) {
        if (typeof controller != 'string')
            controller = controller._controller;
        var rules = controllerBusinessRules[controller];
        if (rules) {
            rules.forEach(function (ruleName) {
                delete _businessRules[ruleName];
            });
            rules.splice(0);
        }
    };

    var controllerBusinessRules = _businessRules._controllers = {};

    _businessRules.prototype = {
        canceled: function () {
            return this._canceled === true;
        },
        trigger: function () {
            return this._args.trigger;
        },
        dispose: function () {
            this.reset(null);
            this._wait = null;
            this._dataView = null;
            this.result._rules = null;
        },
        reset: function (args) {
            this._actionArgs = null;
            this._args = args;
        },
        _initialize: function () {
            if (!this._actionArgs) {
                var dataView = this._dataView;
                this._actionArgs = dataView._createArguments(this._args, null);
                if (dataView.editing()) {
                    dataView._validateFieldValues(this._actionArgs.Values, /*this._args.causesValidation == null || */this._args.causesValidation, false);
                    this._valid = dataView.validate(this._actionArgs.Values);
                }
            }
        },
        process: function (phase) {
            var that = this,
                dataView = that._dataView,
                args = that._args,
                // Server-bound events are derived from dataView._lastArgs property of the last command in onExecuteComplate. 
                // Therefore we are testing for CommandName and CommandArgument as well.
                commandName = args.commandName || args.CommandName,
                commandArgument = args.commandArgument || args.CommandArgument;
            if (commandName === 'Calculate' && dataView._lookupIsActive) {
                that.preventDefault();
                return;
            }

            var wdvg = _app.Geo,
                newValues;
            if (wdvg && wdvg.acquired && (commandName.match(/New|Edit/) || commandName.match(/Update|Insert/) && phase === 'Before')) {
                var fields = this._dataView._fields;
                for (var i = 0; i < fields.length; i++) {
                    var f = fields[i];
                    if (f._geocode && !f.readOnly) {
                        if (f.tagged('modified-latitude') || f.tagged('created-latitude') && commandName.match(/New|Insert/))
                            that.updateFieldValue(f.Name, wdvg.latitude === -1 ? null : wdvg.latitude);
                        else if (f.tagged('modified-longitude') || f.tagged('created-longitude') && commandName.match(/New|Insert/))
                            that.updateFieldValue(f.Name, wdvg.longitude === -1 ? null : wdvg.longitude);
                        else if (f.tagged('modified-coords') || f.tagged('created-coords') && commandName.match(/New|Insert/))
                            that.updateFieldValue(f.Name, wdvg.latitude === -1 ? null : String.format('{0},{1}', wdvg.latitude, wdvg.longitude));
                    }
                }

                newValues = that._newValues;
                if (newValues)
                    if (_touch) {
                        // avoid refreshing unchnaged values
                        var row = dataView.editRow(),
                            field, fv;
                        i = 0;
                        while (i < newValues.length) {
                            fv = newValues[i];
                            field = dataView.findField(fv.Name);
                            if (field && row[field.Index] === fv.NewValue)
                                newValues.splice(i, 1);
                            else
                                i++;
                        }
                        if (newValues.length)
                            _app.input.execute({ dataView: dataView, values: newValues });
                    }
                    else
                        dataView._updateCalculatedFields({ 'Errors': [], 'Values': newValues });
                that._newValues = null;
            }

            var expressions = dataView._expressions,
                controllerName = dataView._controller;
            if (!expressions || !expressions.length)
                return;
            if (!that._rules) {
                that._rules = [];
                var ruleIndex = 0;
                for (i = 0; i < expressions.length; i++) {
                    var exp = expressions[i], m;
                    if (exp.Type === Web.DynamicExpressionType.ClientScript && exp.Scope === Web.DynamicExpressionScope.Rule) {
                        m = exp.Result.match(/^<id>(.+?)<\/id><command>(.+?)<\/command><argument>(.*?)<\/argument><view>(.*?)<\/view><phase>(.*?)<\/phase><js>([\s\S]+?)<\/js>$/);
                        if (m) {
                            var ruleFuncName = String.format('{0}_Rule_{1}', controllerName, m[1] ? m[1] : ruleIndex),
                                ruleName = 'Web.BusinessRules.' + ruleFuncName,
                                ruleFunc = _businessRules[ruleFuncName];// eval(String.format('typeof {0} !="undefined"?{0}:null', ruleName));
                            if (!ruleFunc)
                                try {
                                    ruleFunc = eval(that._parseRule(ruleName, m[6]));
                                    if (!controllerBusinessRules[controllerName])
                                        controllerBusinessRules[controllerName] = [];
                                    controllerBusinessRules[controllerName].push(ruleFuncName);
                                }
                                catch (error) {
                                    _app.alert(String.format('{0}\n\ncommand: "{1}"\nargument: "{1}"\nview: "{3}"\nphase: "{4}"\n\n{5}', error.message, m[2], m[3] || 'n/a', m[4] || 'n/a', m[5], (m[6] || '').trim()));
                                }
                            Array.add(that._rules, { 'commandName': m[2], 'commandArgument': m[3], 'view': m[4], 'phase': m[5], 'script': ruleFunc });
                        }
                    }
                }
            }
            for (i = 0; i < that._rules.length; i++) {
                var r = that._rules[i];
                if (r.phase !== phase)
                    continue;
                var skip = false;
                if (!isNullOrEmpty(r.view)) {
                    var viewId = dataView.get_viewId();
                    if (!(r.view === viewId || viewId.match(new RegExp(r.view))))
                        skip = true;
                }
                if (!isNullOrEmpty(r.commandName))
                    if (!(r.commandName === commandName || commandName.match(new RegExp(r.commandName))))
                        skip = true;
                if (!isNullOrEmpty(r.commandArgument))
                    if (!(r.commandArgument === commandArgument || commandArgument && commandArgument.match(new RegExp(r.commandArgument))))
                        skip = true;
                if (!skip) {
                    if (args.causesValidation) { // we are ignoring args.CausesValidation in "after" phase after server-bound actions since there is no need for validation
                        that._initialize();
                        if (!that._valid) {
                            that.preventDefault();
                            break;
                        }
                    }
                    //if (r.commandName != 'New' || this._dataView.get_isForm())
                    r.script.call(that);
                    if (that.canceled())
                        break;
                }
            }
            if (that._newValues) {
                if (_touch)
                    //if (dataView.get_view().Layout)
                    _app.input.execute({ dataView: dataView, values: that._newValues, raiseCalculate: commandName !== 'Calculate' });
                //else
                //    dataView.extension().afterCalculate(that._newValues);
                else
                    dataView._updateCalculatedFields({ 'Errors': [], 'Values': that._newValues });
                that._newValues = null;
                that._pendingFocus();
            }
            else if (that.canceled() && dataView.get_isDataSheet()) {
                dataView._updateCalculatedFields({ 'Errors': [], 'Values': [] });
                that._pendingFocus();
            }
        },
        _pendingFocus: function () {
            var that = this;
            if (that._focusFieldName) {
                that._dataView._focus(that._focusFieldName, that._focusMessage);
                that._focusFieldName = null;
            }
        },
        before: function (args) {
            var that = this;
            that.reset(args);
            that.process('Before');
            if (!that.canceled())
                that.process('Execute');
        },
        after: function (args) {
            if (this._dataView._isBusy)
                return;
            this.reset(args);
            this.process('After');
        },
        _parseRule: function (ruleName, script) {
            script = compileBusinessRule(script);
            var extendedScript = new _Sys_StringBuilder();
            extendedScript.appendFormat('{0}=function(){{\nvar _this=this;\n', ruleName);
            var iterator = /([\s\S]*?)(\[(\w+)(\.(\w+))?\](\s*=([^=][\s\S]+?);)?)/g;
            this._parseScript(extendedScript, iterator, script);
            script = extendedScript.toString();
            extendedScript.clear();
            this._parseScript(extendedScript, iterator, script);
            extendedScript.append('\n}');
            return extendedScript.toString();
        },
        _parseScript: function (sb, iterator, script) {
            var lastIndex = -1,
                m, fieldName, scope, field;
            while (m = iterator.exec(script)) {
                sb.append(m[1]);
                fieldName = m[3];
                scope = m[5];
                if (m[1].match(/\w$/))
                    sb.append(m[2]);
                else if (fieldName.match(/^master$/i)) {
                    sb.appendFormat('_this.fieldValue(\'{0}\',\'Master\')', scope);
                }
                else {
                    field = this._dataView.findField(fieldName);
                    if (!isNullOrEmpty(m[7]))
                        sb.appendFormat('_this.updateFieldValue(\'{0}\',{1})', fieldName, m[7]);
                    else
                        sb.appendFormat('_this.fieldValue(\'{0}\',\'{1}\')', fieldName, scope);
                    //                if (field)
                    //                    if (!isNullOrEmpty(m[7]))
                    //                        sb.appendFormat('this.updateFieldValue(\'{0}\',{1});', fieldName, m[7]);
                    //                    else
                    //                        sb.appendFormat('this.fieldValue(\'{0}\',\'{1}\')', fieldName, scope);
                    //                else
                    //                    sb.append(m[2]);
                }
                lastIndex = iterator.lastIndex;
                //m = iterator.exec(script);
            }
            if (lastIndex !== -1)
                sb.append(lastIndex < script.length ? script.substr(lastIndex) : '');
            else
                sb.append(script);

        },
        preventDefault: function () {
            this._canceled = true;
            this._dataView._raiseSelectedDelayed = false;
            this._dataView._pendingSelectedEvent = false;

        },
        validateInput: function () {
            this._initialize();
            return this._valid == true;
        },
        dataView: function () {
            return this._dataView;
        },
        odp: function (method) {
            var odp = this._dataView.odp,
                result = odp;
            if (method) {
                result = false;
                if (odp)
                    result = odp.is(method);
            }
            return result;
        },
        busy: function () {
            return this._dataView._busy();
        },
        arguments: function () {
            this._initialize();
            return this._actionArgs;
        },
        selectFieldValueObject: function (fieldName) {
            this._initialize();
            var values = this._actionArgs.Values,
                newValue, oldValue;
            for (var i = 0; i < values.length; i++) {
                var v = values[i];
                if (fieldName === v.Name) {
                    //newValue = v.NewValue;
                    //oldValue = v.OldValue;
                    //if (newValue != null && newValue.getTimezoneOffset)
                    //    v.NewValue = new Date(newValue + newValue.getTimezoneOffset() * 60 * 1000);
                    //if (oldValue != null && oldValue.getTimezoneOffset)
                    //    v.OldValue = new Date(oldValue + oldValue.getTimezoneOffset() * 60 * 1000);

                    return v;
                }
            }
            if (this._dataView.findField(fieldName))
                return { Name: fieldName, Value: null };
            return null;
        },
        selectFieldValue: function (fieldName) {
            var v = this.selectFieldValueObject(fieldName);
            if (v) {
                if (v.Modified)
                    return v.NewValue;
                return v.OldValue;
            }
            return null;
        },
        fieldValue: function (fieldName, type) {
            if (type === 'Master' || type === 'master') {
                var masterDataView = this._dataView.get_master();
                return masterDataView ? masterDataView.fieldValue(fieldName) : null;
            }
            if (type === 'context') {
                var parentDataView = this._dataView.get_parentDataView();
                return parentDataView ? parentDataView.fieldValue(fieldName) : null;
            }
            if (!type || type === 'Value')
                return this.selectFieldValue(fieldName);
            var v = this.selectFieldValueObject(fieldName);
            if (!v)
                this._unknownField(fieldName);
            switch (type) {
                case 'NewValue':
                    return v.NewValue;
                case 'OldValue':
                    return v.OldValue;
                case 'Modified':
                    return v.Modified;
                case 'ReadOnly':
                    return v.ReadOnly;
                case 'Error':
                    return v.Error;
                default:
                    return v.OldValue;
            }
        },
        updateFieldValue: function (fieldName, value, scope) {
            var that = this;
            if (scope === 'master')
                that._dataView.updateFieldValue(fieldName, value, scope);
            else {
                var v = that.selectFieldValueObject(fieldName);
                if (v) {
                    v.NewValue = value;
                    v.Modified = true;
                    var newValues = that._newValues;
                    if (!newValues)
                        newValues = that._newValues = [];
                    for (var i = 0; i < newValues.length; i++)
                        if (newValues[i].Name === fieldName) {
                            Array.removeAt(newValues, i);
                            break;
                        }
                    Array.add(newValues, v);
                }
                else
                    that._unknownField(fieldName);
            }
        },
        property: function (name, value) {
            name = 'Rules$' + name;
            if (arguments.length === 1)
                return this._dataView.readContext(name);
            else
                this._dataView.writeContext(name, value);
        },
        _unknownField: function (fieldName) {
            throw new Error(String.format('Unknown field "{0}" is not defined in  /controllers/{1}/views/{2}.', fieldName, this._dataView._controller, this._dataView._viewId));
        },
        wait: function (promise) {
            this._wait = promise;
            return promise;
        }
    };

    _businessRules.Result = function (rules) {
        this._rules = rules;
    };

    _businessRules.Result.prototype = {
        focus: function (fieldName, fmt, args) {
            var message = null;
            if (arguments.length > 1) {
                var newArguments = Array.clone(arguments);
                Array.removeAt(newArguments, 0);
                message = String._toFormattedString(true, newArguments);
            }
            var rules = this._rules;
            var dataView = rules._dataView;
            if (!_touch) {
                rules._focusFieldName = fieldName;
                rules._focusMessage = message;
            }
            setTimeout(function () {
                dataView._focus(fieldName, message);
            });
        },
        showMessage: function (fmt, args) {
            _app.showMessage(String._toFormattedString(true, arguments));
        },
        showViewMessage: function (fmt, args) {
            this._rules._dataView.showViewMessage(String._toFormattedString(true, arguments));
        },
        showAlert: function (fmt, args) {
            alert(String._toFormattedString(true, arguments));
        },
        confirm: function (fmt, args) {
            return confirm(String._toFormattedString(true, arguments));
        },
        refresh: function (fetch) {
            this._rules._dataView(fetch == true);
        },
        refreshChildren: function () {
            this._rules._dataView.refreshChildren();
        }
    };

    // uploading of binary data

    var uploadSupport = {
        fileReader: typeof FileReader != 'undefined',
        formData: !!window.FormData,
        progress: 'upload' in new XMLHttpRequest,
        dragAndDrop: 'draggable' in document.createElement('span')
    };

    function filesSelected(dataView, fieldName, files) {
        var pendingUploads = dataView._pendingUploads,
            found,
            file,
            fileResult = { Values: [], Errors: [] },
            fileResultValues = fileResult.Values;
        if (!pendingUploads)
            pendingUploads = dataView._pendingUploads = [];
        $(pendingUploads).each(function (index) {
            var upload = this;
            if (upload.fieldName === fieldName) {
                found = true;
                upload.layers = null; // remove the drawing from the upload
                if (files)
                    upload.files = files;
                else {
                    upload.files = null;
                    pendingUploads.splice(index, 1);
                }
                return false;
            }
        });
        if (!found && files)
            pendingUploads.push({ fieldName: fieldName, files: files });

        if (files)
            file = files[0];

        function updateUtilityField(kind, value, prefixWithFieldName) {
            var names = _app.blobFields[kind], f, i, field;
            for (i = 0; i < names.length; i++) {
                f = dataView.findField((prefixWithFieldName && fieldName || '') + names[i]);
                if (f) {
                    field = f;
                    break;
                }
            }
            if (field) {
                fileResultValues.push({ Name: field.Name, NewValue: value });
                field._blobField = kind + ':' + fieldName;
            }
            else if (prefixWithFieldName)
                updateUtilityField(kind, value);
        }
        // file name
        updateUtilityField('name', file ? file.name : null, true);
        // content type
        updateUtilityField('type', file ? file.type : null, true);
        // length
        updateUtilityField('size', file ? file.size : null, true);
        if (fileResultValues.length)
            if (_touch) {
                _app.input.execute({ dataView: dataView, values: fileResultValues });
                _app.input.focus({ fieldName: fieldName });
            }
            else
                dataView._updateCalculatedFields(fileResult);
    }

    _app.filterOpValueRequired = function (op) {
        return !!op.match(/^(=|<>|<|>|<=|>=|(\$(between|in|notin|beginswith|doesnotbeginwith|contains|doesnotcontain|endswith|doesnotendwith)))$/);
    };

    // causes the web view to save a text file in UTF-8 format
    _app.saveFile = function saveFile(name, data, type) {
        var blob = new Blob(["\ufeff", data], { type: type || (_app.agent.ie ? 'data:attachment/text' : 'text/plain') });
        blob.name = name;
        _app.saveBlob(blob);
    };

    _app.saveBlob = function (blob) {
        if (typeof blob === 'string') {
            var blobRequest = new XMLHttpRequest();
            blobRequest.open('GET', _app.resolveClientUrl(blob), true);
            blobRequest.responseType = 'blob';
            blobRequest.onload = function (e) {
                var currentTarget = e.currentTarget,
                    blob = currentTarget.response,
                    contentDisposition = currentTarget.getResponseHeader('Content-Disposition'),
                    fileName = contentDisposition && contentDisposition.match(/filename=(.+?)(;|$)/);
                if (fileName)
                    blob.name = fileName[1];
                _app.saveBlob(blob);
            };
            blobRequest.send();
        }
        else if (navigator.msSaveBlob)
            navigator.msSaveBlob(blob, blob.name);
        else {
            var dataUrl = URL.createObjectURL(blob),
                a = $a(''/*, 'style="display:none;"'*/);//.appendTo('body');
            a.attr({ download: blob.name || ('file.' + (blob.type || '/dat').split(/\//)[1]), href: dataUrl })[0].click();
            //a.remove();
            URL.revokeObjectURL(dataUrl);
        }
    };

    _app.dataUrlToBlob = function (url) {
        var byteString,
            mimeString,
            byteArray, i;
        if (url.split(',')[0].indexOf('base64') >= 0)
            byteString = atob(url.split(',')[1]);
        else
            byteString = unescape(url.split(',')[1]);
        mimeString = url.split(',')[0].split(':')[1].split(';')[0];
        byteArray = new Uint8Array(byteString.length);
        for (i = 0; i < byteString.length; i++)
            byteArray[i] = byteString.charCodeAt(i);
        return new Blob([byteArray], { type: mimeString });
    };

    function findBlobContainer(dataView, blobField) {
        return $(_touch ? _touch.page(dataView._id) : dataView._container).find('.drop-box-' + blobField.Index);
    }

    function sizeToText(size) {
        if (size == null)
            return '';
        var format,
            suffix;
        if (size > 1024) {
            if (size > 1000000) {
                if (size > 10000000)
                    if (size > 100000000)
                        format = '{0:N0}';
                    else
                        format = '{0:N1}';
                else
                    format = '{0:N2}';
                size /= 1048576;
                suffix = resourcesFiles.MB;
            }
            else {
                if (size > 10240)
                    if (size > 102400)
                        format = '{0:N0}';
                    else
                        format = '{0:N1}';
                else
                    format = '{0:N2}';
                size /= 1024;
                suffix = resourcesFiles.KB;
            }
        }
        else {
            format = '{0}';
            suffix = resourcesFiles.Bytes;
        }
        return String.format(format, size) + ' ' + suffix;
    }

    _app.blobFields = {
        name: ['FileName', 'FILENAME', 'FILE_NAME', 'filename', 'file_name'],
        type: ['ContentType', 'CONTENTTYPE', 'CONTENT_TYPE', 'contenttype', 'content_type'],
        size: ['Length', 'LENGTH', 'length']
    };

    _app.upload = function (method, options) {
        if (!arguments.length || !uploadSupport.formData)
            return uploadSupport.formData;

        var field = options.field,
            container = $(options.container),
            dataViewId = field ? field._dataView._id : options.dataViewId,
            fieldName = field ? field.Name : options.fieldName,
            clickEvent = _touch ? 'vclick' : 'click';

        switch (method) {
            case 'create':
                initialize();
                break;
            case 'destroy':
                destroy();
                break;
            case 'execute':
                return uploadFiles();
            case 'resize':
                var screenWidth = container.data('screen-width');
                if (_touch || screenWidth == null || screenWidth !== $window.width()) {
                    if (container.is(':visible'))
                        container.data('screen-width', $window.width());
                    resizeSignature();
                }
                break;
            case 'validate':
                return validate();
            case 'capture':
                var files = options.files;
                if (!files.length)
                    files = [files];
                captureFiles(files);
                break;
        }

        function resizeSignature() {
            var ratio = _window.devicePixelRatio || 1,
                canvas = container.find('canvas'),
                w, ctx;
            if (canvas.length) {
                w = canvas.width();
                canvas.height(Math.ceil(w * .5));
                canvas = canvas[0];
                canvas.width = canvas.offsetWidth * ratio;
                canvas.height = canvas.offsetHeight * ratio;

                ctx = canvas.getContext("2d");
                ctx.scale(ratio, ratio);
                container.data('signature').clear();
                container.addClass('app-empty');
                ctx.fillStyle = '#ccc';
                ctx.font = "20pt Arial";
                ctx.textAlign = 'center';
                ctx.fillText(resourcesFiles.Sign, w / 2, canvas.height / 2 + 10);
            }
        }

        function validate() {
            var dv = findDataView(dataViewId),
                blobField = dv.findField(fieldName),
                signature = container.data('signature'),
                row = _touch ? dv.commandRow() : dv.get_currentRow(),
                v = row && row[blobField.Index],
                result = v != null && !v.toString().match(/^null\|/),
                signed;
            if (container.is('.app-signature')) {
                signed = !signature.isEmpty();
                result = result || signed;
                filesSelected(dv, fieldName, signed ? _app.dataUrlToBlob(signature.toDataURL('image/png', 1)) : null);
            }
            else
                result = result || container.find('div').length > 0;
            return result;
        }

        function toDropText() {
            var multiple = options.multiple;
            return _touch && !_touch.desktop() ? multiple ? resourcesFiles.TapMany : resourcesFiles.Tap : multiple ? resourcesFiles.ClickMany : resourcesFiles.Click;
        }

        function addDropText(container, text) {
            $span('app-drop-text').appendTo(container).text(text);
        }

        function configureEmpty() {
            //if (uploadSupport.dragAndDrop && (!_touch || _touch.desktop()))
            //    addDropText(container, toDropText());
            //else
            //    container.text(toDropText());
            addDropText(container.empty().addClass('app-drop-box app-empty').attr('title', toDropText()), toDropText());
        }

        function configureClear(hasValue, files) {
            if (container.is('.app-had-blob'))
                container.addClass('app-had-file');
            if (container.is('.app-clearing')) {
                addDropText(container.empty(), resourcesFiles.Cleared);
                container.parent().find('img').css('opacity', .3);
            }
            else if (hasValue) {
                var clearButton;
                if (_touch)
                    _touch.icon('material-icon-delete', clearButton = $span('app-clear ui-btn ui-btn-icon-notext'));
                else
                    clearButton = $a('app-clear').addClass('ui-icon-trash').text(resourcesFiles.Clear);
                clearButton.appendTo(container).attr('title', resourcesFiles.Clear);
                if (_touch && !_app.input.elementToField(container).tagged('image-editor-none') && (!files || files.length === 1 && files[0].type.match(/^image/)))
                    _touch.icon('material-icon-' + (_app.agent.ie ? 'tune' : 'draw'), $span('app-draw ui-btn ui-btn-icon-notext').appendTo(container).attr('title', resources.Draw.Draw));
            }
            else
                addDropText(container.css('min-height', ''), toDropText());
        }

        //function saveLastFocusedField() {
        //    if (_touch)
        //        $('.ui-page-active').data('last-focused-field', fieldName);
        //}

        function initialize() {
            if (!container.is('.app-drop-box')) {
                configureEmpty();

                var dataView = findDataView(dataViewId),
                    field = dataView.findField(fieldName),
                    row = dataView.editRow(),
                    value = row[field.Index],
                    hadValue = value && !value.match(/null\|/);

                if (field.OnDemandStyle === 2) {
                    container.empty().attr('title', resourcesFiles.Sign);
                    var canvas = $htmlTag('canvas').width('100%').appendTo(container).get(0);
                    container.addClass('app-signature').data('signature', new SignaturePad(canvas, {
                        backgroundColor: 'white', onEnd: function () {
                            container.removeClass('app-empty');
                        }
                    }));
                    // ui-btn-icon-notext ui-icon-delete
                    $(_touch ? $span('material-icon app-icon app-clear') : $a('app-clear ui-btn ui-btn-inline ui-corner-all')).insertAfter(container).text(_touch ? 'delete' : resourcesFiles.Clear).attr('title', resourcesFiles.Clear)
                        .on(clickEvent, function (e) {
                            if (container.data('signature').isEmpty()) {
                                if (_touch)
                                    _touch.activeLink();
                                return;
                            }
                            container.addClass('app-dragging');
                            if (_touch)
                                _touch.saveLastFocusedField(fieldName);
                            _app.confirm(resourcesFiles.ClearConfirm).then(function () {
                                container.removeClass('app-dragging').addClass('app-empty').focus();
                                resizeSignature();
                                if (dataViewId) {
                                    var dataView = findDataView(dataViewId);
                                    filesSelected(dataView, fieldName, null);
                                }
                                if (options.change)
                                    options.change();
                            }).fail(function () {
                                container.removeClass('app-dragging').focus();
                            });
                        });
                    if (!_touch)
                        resizeSignature();
                }
                else {
                    if (hadValue) {
                        container.addClass('app-had-blob');
                        configureClear(hadValue);
                    }
                    var input = $htmlTag('input', null, 'type="file"').insertAfter(container).hide().on('change', function (e) {
                        var files = this.files;
                        if (files.length > 0)
                            captureFiles(files);
                    });
                    if (options.multiple)
                        input.attr('multiple', '');
                    container.on('dragenter dragover', function (e) {
                        if (e.originalEvent.dataTransfer.files.length)
                            container.addClass('app-dragging');
                        else
                            e.originalEvent.preventDefault();
                        return false;
                    }).on('dragend dragleave', function (e) {
                        container.removeClass('app-dragging');
                        return false;
                    }).on('drop', function (e) {
                        container.removeClass('app-dragging');
                        e.preventDefault();
                        var files = e.originalEvent.dataTransfer.files,
                            field;
                        if (files.length && !container.is('.app-uploading')) {
                            if (_touch) {
                                field = _app.input.elementToField(container);
                                _app.input.focus({ field: field.Name/* container.closest('[data-field]').data('field') */ });
                                if (field.tagged('image-user-defined-none'))
                                    return;
                            }
                            captureFiles(files);
                        }
                    }).on(clickEvent, function (e) {
                        if (_touch)
                            _touch.saveLastFocusedField(fieldName);
                        if (!container.is('.app-uploading'))
                            var target = $(e.target);
                        if (target.closest('.app-draw').length)
                            _app.input.methods.blob.draw(container);
                        else if (target.closest('.app-clear').length) {
                            container.addClass('app-dragging');
                            _app.confirm(container.find('div').map(function () { return $(this).text() }).get().join(', ') + '\n\n' + resourcesFiles.ClearConfirm, function () {
                                container.removeClass('app-dragging').focus();
                                configureEmpty();
                                container.next().val('');
                                if (dataViewId) {
                                    var dataView = findDataView(dataViewId),
                                        files = null;
                                    if (hadValue) {
                                        files = [new Blob()];
                                        container.addClass('app-clearing');
                                    }
                                    filesSelected(dataView, fieldName, files);
                                }
                                if (options.change)
                                    options.change();
                                if (hadValue)
                                    configureClear(hadValue);
                                return false;
                            },
                                function () {
                                    container.removeClass('app-dragging').focus();
                                });
                        }
                        else
                            try {
                                if (_touch) {
                                    _app.input.blur();
                                    if (_app.input.elementToField(container).tagged('image-user-defined-none')) {
                                        _app.input.of(target).find('.app-draw').trigger(clickEvent)
                                        return false;
                                    }
                                }
                                container.next()[0].click();//.trigger('click');
                            }
                            catch (ex) {
                                // W10 throws "Operation aborted" exception in WebView when user cancels file selector.
                                // using .trigger('click') will make jquery 2.2.4 inoperable
                            }
                        return false;
                    });
                }
            }
        }

        function destroy() {
            options.change = null;
            if (container.is('.app-signature')) {
                container.removeData().find('canvas').off();
                container.next().off().remove();
            }
            else
                container.off().addClass('app-drop-box-destroyed').next().off().remove();
        }

        function preProcessImage(files, index, options) {
            if (index >= files.length)
                captureFiles(files, true);
            else {
                var width = options.width,
                    height = options.height,
                    targetWidth = width,
                    targetHeight = height,
                    background = options.background,
                    small = options.small,
                    large = options.large,
                    file = files[index],
                    reader = new FileReader();
                reader.onload = function (e) {
                    var rawImage = new Image();
                    rawImage.onload = function () {
                        var rawImageWidth = rawImage.width,
                            rawImageHeight = rawImage.height,
                            rejectSmall = small === 'reject',
                            rejectLarge = large === 'reject';
                        if (rejectSmall && (rawImageWidth < width && rawImageHeight < height) ||
                            rejectLarge && (rawImageWidth > width && rawImageHeight > height))
                            files.splice(index, 1);
                        else if (rejectSmall && rejectLarge)
                            index++; // do not transform - the file size matches the spec
                        else {
                            if (rawImageWidth >= rawImageHeight) {
                                if (rawImageWidth > width) {
                                    height = width * rawImageHeight / rawImageWidth;
                                    if (large === 'cover') {
                                        width *= targetHeight / height;
                                        height = targetHeight;
                                        if (width < targetWidth) {
                                            height *= targetWidth / width;
                                            width = targetWidth;
                                        }
                                    }
                                    else if (height > targetHeight) {
                                        width *= targetHeight / height;
                                        height = targetHeight;
                                    }
                                }
                                else {
                                    width = rawImageWidth;
                                    height = rawImageHeight;
                                }
                            }
                            else {
                                if (rawImageHeight > height) {
                                    width = height * rawImageWidth / rawImageHeight;
                                    if (large === 'cover') {
                                        height *= targetWidth / width;
                                        width = targetWidth;
                                        if (height < targetHeight) {
                                            width *= targetHeight / height;
                                            height = targetWidth;
                                        }
                                    }
                                    else if (width > targetWidth) {
                                        height *= targetWidth / width;
                                        width = targetWidth;
                                    }
                                }
                                else {
                                    height = rawImageHeight;
                                    width = rawImageWidth;
                                }
                            }
                            width = Math.floor(width);
                            height = Math.floor(height);
                            var oc = rawImage,
                                octx,
                                currentWidth = width,
                                currentHeight = height;
                            if (width !== rawImageWidth || height !== rawImageHeight)
                                if (rawImageWidth * .5 * .5 < width) {
                                    currentWidth = rawImageWidth;
                                    currentHeight = rawImageHeight;
                                }
                                else {
                                    // gradually reduce the source image in 2 iterations or more
                                    oc = $htmlTag('canvas')[0];
                                    octx = oc.getContext('2d');
                                    currentWidth = Math.floor(rawImageWidth * .5);
                                    currentHeight = Math.floor(rawImageHeight * .5);
                                    oc.width = currentWidth;
                                    oc.height = currentHeight;
                                    octx.drawImage(rawImage, 0, 0, currentWidth, currentHeight);

                                    // draw the image on the same canvas while gradually reducing its size
                                    while (currentWidth * .5 > width) {
                                        currentWidth = Math.floor(currentWidth * .5);
                                        currentHeight = Math.floor(currentHeight * .5);
                                        octx.drawImage(oc, 0, 0, currentWidth * 2, currentHeight * 2, 0, 0, currentWidth, currentHeight);
                                    }
                                }

                            // draw the final image
                            if (large === 'clip') {
                                targetWidth = Math.min(width, targetWidth);
                                targetHeight = Math.min(height, targetHeight);
                            }
                            var canvas = $htmlTag('canvas')[0],
                                ctx = canvas.getContext('2d');
                            canvas.width = targetWidth;
                            canvas.height = targetHeight;
                            if (targetWidth !== width || targetHeight !== height) {
                                ctx.beginPath();
                                ctx.rect(0, 0, targetWidth, targetHeight)
                                var fillStyle = ctx.fillStyle;
                                ctx.fillStyle = background;
                                if (fillStyle === ctx.fillStyle)
                                    ctx.fillStyle = '#' + background;
                                ctx.fill();
                            }
                            ctx.drawImage(oc, 0, 0, currentWidth, currentHeight, Math.floor(targetWidth - width) / 2, Math.floor(targetHeight - height) / 2, width, height);

                            //$htmlTag('img').css({ 'position': 'absolute', 'z-index': 100000 }).appendTo('body').attr('src', canvas.toDataURL());
                            var fileFormat = options.format,
                                blob = _app.dataUrlToBlob(canvas.toDataURL('image/' + fileFormat, options.quality)),
                                fileName = file.name.match(/^(.+?)(\..+)?$/);
                            fileName = fileName[1];
                            blob.name = fileName + '.' + fileFormat;
                            blob.lastModified = file.lastModified;
                            blob.lastModifiedDate = file.lastModifiedDate;
                            blob.quality = options.quality;
                            files[index++] = blob;
                            preProcessImage(files, index, options);
                        }
                    }
                    rawImage.src = e.target.result;
                };
                reader.readAsDataURL(file);
            };
        }


        function captureFiles(files, skipPreProcessing) {
            if (!options.multiple && files.length > 1)
                files = [files[0]];

            var imageFiles = 0,
                dv = findDataView(dataViewId),
                field = dv.findField(fieldName),
                processImageSize,
                processImageBackground,
                processImageSmall,
                processImageLarge,
                processImageFormat,
                processImageQuality,
                modalHeight,
                newFiles, i, f,
                isEmpty = !files.length;
            if (!skipPreProcessing) {
                processImageSize = field.tagged(/\bimage\-size\-(\d+)x(\d+)\b/);
                if (processImageSize) {
                    newFiles = [];
                    for (i = 0; i < files.length; i++) {
                        f = files[i];
                        if (f.type.match(/^image\//))
                            newFiles.push(f);
                    }
                    if (newFiles.length) {
                        processImageSmall = field.tagged(/\bimage\-small\-(\w+)\b/)
                        processImageLarge = field.tagged(/\bimage\-large\-(\w+)\b/)
                        processImageFormat = field.tagged(/\bimage\-format\-(\w+)\b/)
                        processImageQuality = field.tagged(/\bimage\-quality\-(\d+)\b/)
                        processImageBackground = field.tagged(/\bimage\-background\-(\w+)\b/)
                        preProcessImage(newFiles, 0, {
                            width: parseInt(processImageSize[1]),
                            height: parseInt(processImageSize[2]),
                            background: processImageBackground ? processImageBackground[1] : 'fff',
                            large: processImageLarge ? processImageLarge[1] : 'fit',
                            small: processImageSmall ? processImageSmall[1] : 'center',
                            format: processImageFormat ? processImageFormat[1] : 'png',
                            quality: Math.min(1, (processImageQuality ? processImageQuality[1] : 100) / 100)
                        });
                    }
                    return;
                }
            }


            modalHeight = dv && !_touch && dv.get_isModal() ? $(dv._container).height() : 0;
            if (!container.is(':empty'))
                container.css('min-height', container.height());
            container.find('img div').off();
            container.empty().toggleClass('app-empty', isEmpty);
            $(files).each(function (index) {
                var file = this,
                    fileNumber = files.length > 1 ? (index + 1).toString() + '. ' : '',
                    size = sizeToText(file.size),
                    fileInfo = $div().appendTo(container).text(fileNumber + file.name + ' - ' + size);
                if (uploadSupport.fileReader && file.type.match(/^image\//i)) {
                    imageFiles++;
                    var reader = new FileReader();
                    reader._fileInfo = fileInfo;
                    reader.onload = function (event) {
                        $htmlTag('img', '', 'draggable="false"').attr('src', event.target.result).insertAfter(this._fileInfo).one('load', function () {
                            if (options.change)
                                options.change();
                        });
                        this._fileInfo = null;
                        if (--imageFiles === 0) {
                            container.css('min-height', '');
                            if (modalHeight)
                                $(dv._container).height(modalHeight);
                            if (_touch) {
                                _touch.syncEmbeddedViews();
                                _touch.summary('fetch');
                            }
                        }
                    };
                    reader.readAsDataURL(file);
                }
                if (!imageFiles) {
                    container.css('min-height', '');
                    if (options.change)
                        options.change();
                }
            });
            if (!isEmpty)
                container.removeClass('app-clearing');
            configureClear(!isEmpty, files);
            if (field.tagged('image-user-defined-none'))
                container.removeAttr('title');
            if (dv && !isEmpty)
                filesSelected(dv, fieldName, files);
        }

        function uploadFiles() {
            var progress = $htmlTag('progress', null, 'max="100"');
            options.container.addClass('app-uploading');
            progress.val(0).insertBefore(options.container.contents().first());
            options.progress = function (e) {
                if (e.lengthComputable) {
                    var complete = e.loaded / e.total * 100 | 0;
                    progress.val(complete);
                }
            };
            return _odp.upload(options).done(function () {
                options.container.removeClass('app-uploading');
            }).fail(function () {
                options.container.removeClass('app-uploading');
                progress.remove();
            });
        }
    };

    _app.upload.multi = {
        show: function (dataView, commandArgument) {
            _odp.getControllers(dataView._controller).then(function (controllers) {
                var controller = controllers[0],
                    view;
                if (!commandArgument)
                    commandArgument = 'createForm1';
                controller.views.forEach(function (v) {
                    if (v.id === commandArgument)
                        view = v;
                });
                if (view && _touch) {
                    _touch.whenPageShown(function () {
                        $('.ui-page-active input:file').trigger('click');
                    });
                    _app.survey({
                        text: view.label,
                        text2: resourcesActionsScopes.ActionBar.Upload.HeaderText,
                        context: { id: dataView._id, controller: controller, view: view },
                        controller: 'multi_file_upload',
                        topics: [
                            {
                                wrap: true,
                                questions: [
                                    { name: 'files', text: false, type: 'blob', multiple: true }
                                ]
                            }
                        ],
                        options: {
                            materialIcon: 'upload',
                            discardChangesPrompt: false,
                            modal: {
                                fitContent: true,
                                max: 'xs',
                                always: true,
                                autoGrow: true
                            }
                        },
                        submitText: resourcesMobile.Submit,
                        submit: 'multifileupload.app'
                    });
                }

            });
        },
        send: function (options) {
            var files = options.files,
                index = options.index++,
                sendContext = options.context,
                f, values = sendContext || {},
                controllerName = options.controller,
                externalFilter = [],
                nameVal;


            function finished(message) {
                _touch.busy(false);
                _touch.notify(message ? { text: message, force: true, duration: 'long' } : false);
                _app.find(options.id).sync(options.sync, true);
            }

            if (index < files.length) {
                _touch.busy(true);
                f = files[index];
                _touch.notify({ text: String.format(resourcesMobile.Sync.Uploading, f.name), duration: 60000, force: true });
                if (options.name) {
                    nameVal = f.name;
                    if (nameVal.length > options.nameLen) {
                        nameVal = nameVal.match(/^(.+?)(\..+)$/);
                        nameVal = nameVal[1].substring(0, options.nameLen - nameVal[2].length) + nameVal[2];
                    }
                    values[options.name] = nameVal;
                }
                if (options.type)
                    values[options.type] = f.type;
                if (options.size)
                    values[options.size] = f.size;
                if (sendContext)
                    for (var key in sendContext)
                        externalFilter.push({ Name: key, Value: sendContext[key] });
                _app.execute({ controller: controllerName, view: options.view, command: 'Insert', values: values, externalFilter: externalFilter }).then(function (result) {
                    if (result.errors.length)
                        finished(result.errors.join('\n'));
                    else {
                        var key = result[controllerName][options.key];
                        if (key == null && options.name === options.key)
                            key = f.name;
                        if (!options.sync)
                            options.sync = key;
                        _odp.uploadFile({ apiVer: 2, key: key, handler: options.handler, file: f }).then(function () {
                            _app.upload.multi.send(options);
                        }).fail(function () {
                            finished();
                        });
                    }
                }).fail(function () {
                    finished();
                });

            }
            else
                finished();
        }
    };

    $document.on('multifileupload.app', function (e) {
        var surveyDataView = e.dataView,
            data = surveyDataView.data(),
            context = surveyDataView.survey().context,
            controller = context.controller,
            view = context.view,
            dataViewId = context.id,
            dataView = _app.find(dataViewId),
            blobField, nameField, nameLen,
            fields = [],
            files = data.files,
            contextValues = {};

        function findUtilityField(kind, prefixWithFieldName) {
            var names = _app.blobFields[kind], f, i, field;
            for (i = 0; i < names.length; i++) {
                f = controller._map.fields[(prefixWithFieldName && blobField.name || '') + names[i]];
                if (f) {
                    field = f.name;
                    break;
                }
            }
            if (!field && prefixWithFieldName)
                field = findUtilityField(kind);
            if (kind === 'name' && field)
                nameLen = field.length;
            return field;
        }

        view.categories.forEach(function (c) {
            c.dataFields.forEach(function (df) {
                var f = controller._map.fields[df.fieldName];
                if (f.onDemand && !blobField)
                    blobField = f;
                if (f.type === 'String' && !f.hidden && !nameField) {
                    nameField = f.name;
                    nameLen = f.length;
                }
                fields.push(f);
            });
        });
        if (blobField && files) {
            dataView._externalFilter.forEach(function (fv) {
                var fieldName = fv.Name;
                contextValues[fieldName] = fv.Literal ? fv.Value : dataView.convertStringToFieldValue(dataView.findField(fieldName), fv.Value);
            });
            _touch.pageShown(function () {
                _app.upload.multi.send({
                    id: dataViewId, controller: controller.name, view: view.Id,
                    files: files, blob: blobField.name, handler: blobField.onDemandHandler, index: 0, context: contextValues,
                    name: findUtilityField('name', true) || nameField, nameLen: nameLen, type: findUtilityField('type', true), size: findUtilityField('size', true), key: controller.key[0].name
                });
            });

        }
    });

    _app.uploadFileAjax = function (options) {
        var formData = new FormData(),
            names = options.names,
            files = options.files;

        if (!('length' in files))
            files = [files];

        $(files).each(function (index) {
            var f = this;
            if (f.size)
                if (names)
                    formData.append('file', f, names[index]);
                else
                    formData.append('file', f);
            else
                formData.append('file', f, '_delete_');
        });
        return $.ajax({
            url: options.url,
            method: 'POST',
            processData: false,
            data: formData,
            processData: false,
            contentType: false,
            xhr: function () {
                var xhr = new _window.XMLHttpRequest();
                if (options.progress)
                    xhr.upload.addEventListener("progress", options.progress, false);
                return xhr;
            }
        });
    };

    function prettyText(s, capitalize) {
        if (s.match(new RegExp('[' + Unicode.Ll + ']')) && s.match(new RegExp('[' + Unicode.Lu + ']'))) {
            s = s.split(/(?:(\d+))/).join(' ');
            var iterator = new RegExp('[' + Unicode.Lu + ']+', 'g'),
                result = [], i = 0,
                m = iterator.exec(s);
            while (m) {
                result.push(s.substr(i, m.index - i));
                result.push(' ', m[0]);
                i = m.index + m[0].length;
                m = iterator.exec(s);
            }
            result.push(s.substr(i));
            s = result.join('');
        }
        s = s.replace(/[_\s]+/g, ' ').trim();
        if (capitalize)
            s = s.charAt(0).toUpperCase() + s.slice(1);
        return s;
    }

    _app.safeHtml = function (html) {
        if (html != null)
            html = html.replace(/<\/?script([\s\S]*?)\/?>/gi, '')
        return html;
    };

    _app.prettyText = prettyText;

    _app.surveyLibrary = {};

    _app.surveyFailedToLoad = {};

    _app.action = function (options) {
        if (_touch)
            _touch.executeInContext(options.icon, options.text, options.path);
    };

    /*
    * Survey API
    */

    // .replace(/([A-Z])/g, '-(1)')

    _app.toTags = function (value, prefix) {
        if (!prefix)
            prefix = '';
        if (value != null) {
            if (typeof value == 'boolean')
                return value ? prefix : prefix + '-none';
            if (prefix)
                prefix = prefix + '-';
            if (typeof value == 'string' || typeof value == 'number')
                return prefix + value;
            var tagList = [];
            for (var k in value) {
                var result = _app.toTags(value[k], prefix + k);
                if (result)
                    tagList.push(result);
            }
            return tagList.join(' ').replace(/([A-Z])/g, '-$1').toLowerCase();
        }
        return prefix;
    };

    _app.read = function (obj, selector) {
        var path = selector.split(/\./g),
            count = path.length, name,
            current = obj, i;
        for (i = 0; i < count; i++) {
            name = path[i];
            if (i == count - 1)
                return current[name];
            else if (current[name] != null)
                current = current[name];
            else
                return null;
        }
        return null;
    };

    _app.survey = function (method, options) {
        if (typeof method != 'string') {
            options = arguments[0];
            method = 'show';
        }
        var originalControllerName = options.controller || 'survey',
            controller = originalControllerName.replace(/\W/g, '_'),
            tags,
            values = options.values || options.data, data, dataKey;
        if (method === 'show' && values) {
            if (Array.isArray(values)) {
                options.data = data = {};
                values.forEach(function (fv) {
                    data[fv.field] = 'newValue' in fv ? fv.newValue : ('oldValue' in fv ? fv.oldValue : fv.value);
                });
            }
            else {
                data = values;
                values = [];
                for (dataKey in data)
                    values.push({ name: dataKey, value: data[dataKey] });
            }
            if (!options.context)
                options.context = {};
            options.context._initVals = values;
            options.context._initData = data;
        }
        options.external = !(options.topics || options.questions);
        //if (options.options)
        //    optionsToTags(options);

        function optionsToTags(def) {
            tags = def.tags || def.options && _app.toTags(def.options) || '';
            if (!def.text)
                tags += ' page-header-none ';
            def.tags = tags;
        }

        function toUrl(name) {
            return _app.find(options.parent).get_baseUrl() + (name.match(/\//) ? name : ('/js/surveys/') + name);
        }

        function show(result) {

            function doShow() {
                showCompiled(survey);
                if (survey.cache === false)
                    _app.surveyLibrary[controller] = null;
            }

            try {
                //eval('$app.surveyDef=' + result);
                //var survey = $app.surveyDef;
                //$app.surveyDef = null;
                survey = eval(result);

                var layoutUrl = survey.layout || '';

                if (layoutUrl.match(/(#ref|\.html)$/i)) {
                    busy(true);
                    // load the survey from the server
                    $.ajax({
                        url: toUrl(layoutUrl == '#ref' ? (originalControllerName + '.html') : layoutUrl),
                        dataType: 'text',
                        cache: false
                    }).done(function (result) {
                        busy(false);
                        survey.layout = result;
                        doShow();
                    }).fail(function () {
                        busy(false);
                        if (typeof options.create == 'function')
                            options.create();
                        else
                            _app.alert('Unable to load survey layout for ' + controller + ' from the server.');
                    });
                }
                else
                    doShow();
            }
            catch (ex) {
                _app.alert('The definiton of ' + controller + ' survey is invalid.\n\n' + ex.message + '\n\n' + (_window.location.host.match(/\localhost\b/) ? _app.htmlEncode(ex.stack) : ''));
            }
        }

        function ensureTopics(survey) {
            if (!survey.topics && survey.questions) {
                survey.topics = [{ questions: survey.questions }];
                survey.questions = null;
            }
        }

        function showCompiled(survey) {
            ensureTopics(survey);
            var parentId = options.parent,
                dataView = findDataView(parentId);
            survey.controller = controller;
            survey.baseUrl = dataView ? dataView.get_baseUrl() : appBaseUrl;
            survey.servicePath = dataView ? dataView.get_servicePath() : appServicePath;
            survey.confirmContext = options.confirmContext;
            survey.showSearchBar = true;//dataView.get_showSearchBar();
            survey.parent = parentId;
            survey.context = options.context;
            if (options.options) {
                if (!survey.options)
                    survey.options = {};
                for (var key in options.options)
                    if (survey.options[key] == null)
                        survey.options[key] = options.options[key];
            }

            if (!survey.submit)
                survey.submit = options.submit;
            if (!survey.submitText)
                survey.submitText = options.submitText;
            if (!survey.cancel)
                survey.cancel = options.cancel;
            if (!survey.init)
                survey.init = options.init;
            if (!survey.calculate)
                survey.calculate = options.calculate;
            _app.showModal(dataView, controller, 'form1', 'New', '', survey.baseUrl, survey.servicePath, [],
                { confirmContext: options.confirmContext, showSearchBar: survey.showSearchBar, survey: survey, tags: survey.tags });
        }

        function createRule(list, funcName, func, commandName, commandArgument, phase, argument) {
            var s = 'function(){var r=this,dv=r.dataView(),s=dv.survey(),e=$.Event("' + (typeof func == 'string' ? func : funcName) +
                '",{rules:r,dataView:dv,survey:s' + (argument != null ? (',argument:' + jsonStringify(argument)) : '') + '});' +
                (typeof func == 'string' ? '$(document).trigger(e);' : ('s.' + funcName + '(e);')) +
                (commandName === 'Calculate' ? '' : 'if(e.isDefaultPrevented())') + 'r.preventDefault();}',
                m = s.match(/^function\s*\(\)\s*\{([\s\S]+?)\}\s*$/);
            if (!commandArgument)
                commandArgument = '';
            list.push({
                "Scope": 6, "Target": null, "Type": 1, "Test": null,
                "Result": "\u003cid\u003er" + list.length + "\u003c/id\u003e\u003ccommand\u003e" + commandName + "\u003c/command\u003e\u003cargument\u003e" + commandArgument + "\u003c/argument\u003e\u003cview\u003eform1\u003c/view\u003e\u003cphase\u003e" + phase + "\u003c/phase\u003e\u003cjs\u003e" + m[1] + "\u003c/js\u003e",
                "ViewId": 'form1'
            });
        }


        function iterate(topics, parent, depth, topicCallback, questionCallback) {
            $(topics).each(function () {
                var t = this;
                if (topicCallback)
                    topicCallback(t, parent);
                $(t.questions).each(function () {
                    var q = this;
                    if (questionCallback)
                        questionCallback(q, t, parent, depth);
                });
                if (t.topics)
                    iterate(t.topics, t, depth + 1, topicCallback, questionCallback);
            });
        }

        function populateItems(list, fields, row, callback) {
            var batch = [], batchList = [], unresolvedBatch = [], clearedList = [];
            // scan the list to ensure that DataValueField and DataTextField are defined
            $(list).each(function (index) {
                var f = this;
                if (!f.ItemsDataValueField)
                    f.ItemsDataValueField = _app.cache[f.ItemsDataController + '_' + f.ItemsDataView + '_DataValueField'];
                if (!f.ItemsDataTextField)
                    f.ItemsDataTextField = _app.cache[f.ItemsDataController + '_' + f.ItemsDataView + '_DataTextField'];
                if (!f.ItemsDataValueField || !f.ItemsDataTextField) {
                    unresolvedBatch.push({
                        controller: f.ItemsDataController,
                        view: f.ItemsDataView,
                        requiresData: false,
                        metadataFilter: ['fields'],
                        _fieldIndex: index
                    });
                }
            });
            if (unresolvedBatch.length) {
                busy(true);
                _app.execute({
                    batch: unresolvedBatch,
                    success: function (result) {
                        $(result).each(function (index) {
                            var f = list[unresolvedBatch[index]._fieldIndex],
                                r = this.rawResponse;
                            if (!f.ItemsDataValueField)
                                $(r.Fields).each(function () {
                                    var f2 = this;
                                    if (f2.IsPrimaryKey) {
                                        f.ItemsDataValueField = f2.Name;
                                        _app.cache[f.ItemsDataController + '_' + f.ItemsDataView + '_DataValueField'] = f2.Name;
                                        return false;
                                    }
                                });
                            if (!f.ItemsDataTextField) {
                                f.ItemsDataTextField = r.Fields[0].Name;
                                _app.cache[f.ItemsDataController + '_' + f.ItemsDataView + '_DataTextField'] = f.ItemsDataTextField;
                            }
                        });
                        populateItems(list, fields, row, callback);
                    },
                    error: function (error) {
                        busy(false);
                    }
                });
                return;
            }
            // request item values
            $(list).each(function () {
                var f = this, m,
                    dataView = f._dataView,
                    fieldFilter = [f.ItemsDataValueField, f.ItemsDataTextField],
                    copy = f.Copy,
                    contextFields = f.ContextFields,
                    selectRequest = {
                        controller: f.ItemsDataController,
                        view: f.ItemsDataView,
                        sortExpression: f.ItemsDataTextField,
                        fieldFilter: fieldFilter,
                        metadataFilter: ['fields'],
                        pageSize: 1000,
                        distinct: _app.is(f.Tag, 'lookup-distinct')// !!(f.Tag && f.Tag.match(/\blookup-distinct(?!-none)/))
                    };
                if (copy)
                    while (m = _app._fieldMapRegex.exec(copy))
                        fieldFilter.push(m[2]);
                if (contextFields) {
                    //if (!row)
                    //    row = dataView.survey('row');
                    var filter = [],
                        contextField;
                    while (m = _app._fieldMapRegex.exec(contextFields)) {
                        if (dataView)
                            contextField = dataView.findField(m[2]);
                        else
                            $(fields).each(function () {
                                var f = this;
                                if (f.Name == m[2]) {
                                    contextField = f;
                                    return false;
                                }
                            });
                        var fieldValue = row[contextField.Index],
                            cascadingDependency = !dependsOn(contextField, f);
                        if (/*f.ItemsDataController != contextField.ItemsDataController && */cascadingDependency || fieldValue != null)
                            if (fieldValue == null && cascadingDependency) {
                                f.Items = [];
                                clearedList.push(f);
                            }
                            else if (contextField.ItemsTargetController || contextField.ItemsStyle === 'CheckBoxList') {
                                var list = _app.csv.toArray(fieldValue);
                                if (list.length <= 1)
                                    filter.push({ field: m[1], value: list[0] });
                                else
                                    filter.push({ field: m[1], operator: 'in', values: list });
                            }
                            else
                                filter.push({ field: m[1], value: fieldValue });
                    }
                    if (filter.length)
                        selectRequest.filter = filter;
                }
                if (!f.skipPopulate && clearedList.indexOf(f) == -1) {
                    batch.push(selectRequest);
                    batchList.push(f);
                }

            });
            if (batch.length) {
                busy(true);
                _app.execute({
                    batch: batch,
                    done: function (result) {
                        busy(false);
                        $(batchList).each(function (index) {
                            var f = this,
                                r = batch[index],
                                p = result[index].rawResponse,
                                pageFieldMap = {};
                            $(p.Fields).each(function (index) {
                                pageFieldMap[this.Name] = index;
                            });
                            f.Items = [];
                            $(p.Rows).each(function () {
                                var row = this,
                                    item = [], i;
                                for (i = 0; i < r.fieldFilter.length; i++)
                                    item.push(row[pageFieldMap[r.fieldFilter[i]]]);
                                if (pageFieldMap['group_count_'] != null)
                                    item.push(row[pageFieldMap['group_count_']]);
                                f.Items.push(item);
                            });
                        });
                        if (callback)
                            callback(batchList.concat(clearedList));
                    },
                    fail: function () {
                        busy(false);
                    }
                });
            }
            else if (callback && clearedList.length)
                callback(batchList);
        }

        function refresh(callback) {
            var dataView = _touch.dataView(),
                extension = dataView.extension();
            options.compiled = function (result) {
                var form = extension._disposeForm();
                dataView._views[0].Layout = options.layout;
                // replace layout
                var newForm = _touch.createLayout(dataView, _touch.calcWidth(form.parent()));
                newForm = newForm.insertAfter(form);
                _touch.prepareLayout(dataView, result.NewRow, newForm);
                form.remove();
                // refresh internal elements
                extension._skipRefresh = true;
                dataView._pageIndex = -1;
                dataView._editRow = null;
                dataView._onGetPageComplete(result, null);
                extension._skipRefresh = false;
                // state has changed
                extension.stateChanged(false);
                if (callback)
                    callback(newForm);
            };
            compile();
        }

        function register(data, callback) {
            var _survey = _app.survey;
            if (!_survey.registrations)
                _survey.registrations = {};
            var result = _survey.registrations[data] != true;
            _survey.registrations[data] = true;
            if (result && callback)
                callback();
            return result;
        }

        function dependsOn(childField, masterField) {
            var contextFields = childField.ContextFields,// var iterator = /\s*(\w+)\s*(=\s*(\w+)\s*)?(,|$)/g;
                test = new RegExp('=\\s*' + masterField.Name + '\\s*(,|$)');
            return !!(contextFields && contextFields.match(test));

        }

        function toSurveyExpression(expr, type) {
            if (!type)
                type = 'string';
            var result = expr,
                func;
            if (typeof expr != type) {
                var expressions = options._expr;
                if (!expressions)
                    expressions = options._expr = [];
                func = expr;
                if (typeof func != 'function')
                    func = function () {
                        return expr;
                    };
                result = 'this._survey._expr[' + expressions.length + '].call(this)';
                expressions.push(func);
            }
            return result;
        }

        function compile() {
            var requiresItems = [],
                fieldMap = {}, fieldIndex = 0,
                context = options.context,
                initData = context && context._initData,
                result = {
                    Controller: controller, View: 'form1',
                    TotalRowCount: -1,
                    Fields: [
                        { "Name": "sys_pk_", "Type": "Int32", "Label": "", "IsPrimaryKey": true, "ReadOnly": true, "Hidden": true, "AllowNulls": true, "Columns": 20 }
                    ],
                    Views: [{ Id: 'form1', Label: options.text, Type: 'Form' }],
                    ViewHeaderText: options.description,
                    ViewLayout: options.layout,
                    Expressions: [
                    ],
                    //SupportsCaching: true, IsAuthenticated: true,
                    ActionGroups: [
                        {
                            Scope: 'Form', Id: 'form',
                            Actions: [
                                //{ 'Id': 'a3', 'CommandName': 'Confirm', 'WhenLastCommandName': 'Edit' },
                                //{ 'Id': 'a4', 'CommandName': 'Cancel', 'WhenLastCommandName': 'Edit' },
                                //{ 'Id': 'a5', 'CommandName': 'Edit' }
                            ]
                        }
                    ],
                    Categories: [],
                    NewRow: [1],
                    Rows: []
                },
                buttons = options.actions || options.buttons;

            function addDynamicExpression(scope, target, test) {
                result.Expressions.push({ Scope: scope, Target: target, Test: test, Type: 1, ViewId: 'form1' });
            }

            if (options.submit) {
                var submitKey = options.submitKey;
                result.ActionGroups[0].Actions.push({ Id: 'submit', CommandName: 'Confirm', WhenLastCommandName: 'New', HeaderText: options.submitText, Confirmation: options.submitConfirmation, Key: submitKey === false ? null : (submitKey || 'Enter'), CssClass: options.submitIcon });
            }
            if (options.cancel != false)
                result.ActionGroups[0].Actions.push({ Id: 'a2', CommandName: 'Cancel', WhenLastCommandName: 'New' });

            ensureTopics(options);
            var index = 0;
            iterate(options.topics, null, 0, function (topic, parent, depth) {
                var categoryIndex = result.Categories.length,
                    categoryVisibleWhen = topic.visibleWhen,
                    category = {
                        "Id": "c" + categoryIndex, "Index": categoryIndex,
                        HeaderText: topic.text, Description: topic.description,
                        Wizard: topic.wizard,
                        Flow: topic.flow == 'newColumn' || (index == 0) ? 'NewColumn' : (topic.flow == 'newRow' ? 'NewRow' : ''),
                        Wrap: topic.wrap != null ? topic.wrap : null,
                        Floating: !!topic.floating,
                        Collapsed: topic.collapsed == true,
                        Tab: topic.tab
                    };
                if (categoryVisibleWhen != null)
                    addDynamicExpression(2, category.Id, toSurveyExpression(categoryVisibleWhen));
                if (depth > 0)
                    category.Depth = depth;
                result.Categories.push(category);
                topic._categoryIndex = categoryIndex;
                index++;

            }, function (fd, topic, parent, depth) {
                var fdType = fd.type || 'String',
                    fdFormat = fd.format || fd.dataFormatString,
                    fdMode = fd.mode,
                    fdColumns = fd.columns,
                    fdRows = fd.rows,
                    fdOptions = fd.options,
                    fdTags = fdOptions ? _app.toTags(fdOptions) : fd.tags,
                    items = fd.items,
                    itemsStyle,
                    itemsController,
                    itemsTargetController,
                    fdValue = fd.value,
                    fdContext = fd.context,
                    fdName = fd.name,
                    fdVisibleWhen = fd.visibleWhen,
                    fdReadOnlyWhen = fd.readOnlyWhen,
                    fdTooltip = fd.tooltip,
                    fdLabel = fd.label,
                    fdText = fdLabel == null ? fd.text : fdLabel,
                    f = {
                        Name: fdName, HtmlEncode: true,
                        AllowNulls: fd.required != true,
                        Label: fdText === false ? '&nbsp;' : fdText || prettyText(fd.name),
                        Hidden: fd.hidden == true,
                        CausesCalculate: fd.causesCalculate == true
                    };
                if (!fdName) return;
                if (initData)
                    if (fdName in initData)
                        fdValue = initData[fdName];
                    else if ('value' in fd) {
                        initData[fdName] = fdValue;
                        context._initVals.push({ field: fdName, value: fdValue });
                    }
                if (fd.causesCalculate)
                    f.CausesCalculate = true;
                switch (fdType.toLowerCase()) {
                    case 'text':
                    case 'string':
                        fdType = 'String';
                        break;
                    case 'date':
                        fdType = 'DateTime';
                        if (!fdFormat) {
                            fdFormat = 'd';
                            if (fdColumns == null)
                                fdColumns = 10;
                        }
                        break;
                    case 'datetime':
                        fdType = 'DateTime';
                        if (fdColumns == null)
                            fdColumns = 20;
                        break;
                    case 'time':
                        fdType = 'DateTime';
                        if (!fdFormat) {
                            fdFormat = 't';
                            if (fdColumns == null)
                                fdColumns = 8;
                        }
                        break;
                    case 'number':
                        fdType = 'Double';
                        break;
                    case 'int':
                        fdType = 'Int32';
                        break;
                    case 'bool':
                    case 'Boolean':
                        fdType = 'Boolean';
                        if (!items && fd.required) {
                            items = { style: 'CheckBox' };
                            if (fdValue == null)
                                fdValue = false;
                        }
                        break;
                    case 'money':
                        fdType = 'Currency';
                        break;
                    case 'memo':
                        fdType = 'String';
                        if (fdRows == null)
                            fdRows = 5;
                        break;
                    case 'blob':
                        //var x = {
                        //    "Name": "Picture",
                        //    "Type": "Byte[]",
                        //    "Label": "Picture",
                        //    "AllowQBE": false,
                        //    "AllowSorting": false,
                        //    "SourceFields": "CategoryID",
                        //    "AllowNulls": true,
                        //    "Columns": 15,
                        //    "OnDemand": true,
                        //    "OnDemandHandler": "CategoriesPicture",
                        //    "ShowInSummary": true
                        //};
                        fdType = 'Byte[]';
                        f.OnDemand = true;
                        f.Multiple = fd.multiple;
                        break;
                }
                f.Type = fdType;
                if (fdType === 'String')
                    f.Len = fd.length || 100;
                if (fdType === 'DateTime' && !fdFormat)
                    fdFormat = 'g';
                if (fdType === 'Currency' && !fdFormat)
                    fdFormat = 'c';
                if (fdFormat)
                    if (typeof fdFormat == 'string')
                        f.DataFormatString = fdFormat;
                    else {
                        var fmt = fdFormat.DataFormatString;
                        if (fmt) {
                            f.DataFormatString = fmt;
                            if (fdType === 'DateTime') {
                                f.TimeFmtStr = fdFormat.TimeFmtStr;
                                f.DateFmtStr = fdFormat.DateFmtStr;
                            }
                        }
                        delete fd.format;
                    }
                if (fdColumns)
                    f.Columns = fdColumns;
                if (fdRows) {
                    f.Rows = fdRows;
                    if (fdType === 'String' && fdRows > 1)
                        f.Len = 0;
                }
                if (fd.placeholder)
                    f.Watermark = fd.placeholder;
                if (fdTags)
                    f.Tag = typeof fdTags == 'string' ? fdTags : fdTags.join(',');
                if (fdContext) {
                    if (typeof fdContext != 'string') {
                        fdContext.forEach(function (s, index) {
                            if (!s.match(/=/))
                                fdContext[index] = s + '=' + s;
                        });
                        fdContext = fdContext.join(',');
                    }
                    f.ContextFields = fdContext;
                }
                if (fd.htmlEncode === false)
                    f.HtmlEncode = false;

                if (fdMode)
                    f.TextMode = ['password', 'rtf', 'note', 'static'].indexOf(fdMode) + 1;

                if (options.readOnly || fd.readOnly && typeof fd.readOnly != 'function')
                    f.ReadOnly = true;

                if (!f.Hidden)
                    f.CategoryIndex = topic._categoryIndex;
                if (fd.extended)
                    f.Extended = fd.extended;
                if (fd.altText)
                    f.AltHeaderText = fd.altText;
                if (fd.footer)
                    f.FooterText = fd.footer;
                if (fdTooltip)
                    f.ToolTip = fdTooltip;
                if (fd.htmlEncode == false)
                    f.HtmlEncode = false;

                var filter = items && items.filter;
                if (filter) {
                    if (typeof filter != 'string') {
                        filter = [];
                        $(items.filter).each(function () {
                            var filterInfo = this;
                            filter.push(filterInfo.match + '=' + filterInfo.to);
                        });
                        filter = filter.join(',');
                    }
                    f.ContextFields = filter;
                }

                if (items) {
                    //var itemsList = items.values || items.list;
                    itemsController = items.controller;
                    itemsStyle = items.style || (items.list || !itemsController ? 'DropDownList' : 'Lookup');
                    f.Items = [];
                    if (_isTagged(fdTags, 'lookup-auto-complete-anywhere'))
                        f.SearchOptions = '$autocompleteanywhere';
                    if (itemsStyle === 'Lookup' && _isTagged(fdTags, 'lookup-distinct'))
                        itemsStyle = 'AutoComplete';
                    if (itemsStyle.match(/AutoComplete|Lookup|DropDown/) && _isTagged(fdTags, 'lookup-multiple')) {
                        f.ItemsTargetController = '_basket';
                        if (itemsStyle === 'AutoComplete' && fdValue != null) {
                            if (items.dataValueField === items.dataTextField) {
                                if (typeof fdValue == 'string')
                                    fdValue = _app.csv.toArray(fdValue);
                                $(fdValue).each(function () {
                                    var v = this;
                                    f.Items.push([v, v, null]);
                                });
                            }
                            else
                                requiresItems.push(f);
                        }
                    }
                    itemsTargetController = items.targetController;
                    if (itemsTargetController)
                        f.ItemsTargetController = itemsTargetController;
                    if (fdValue != null && (f.ItemsTargetController || itemsStyle === 'CheckBoxList')) {
                        if (Array.isArray(fdValue))
                            fdValue = _app.csv.toString(fdValue);
                        else if (typeof fdValue != 'string')
                            fdValue = fdValue.toString();
                    }
                    //if (_app.read(fd, 'options.lookup.distinct'))
                    //    f.DistinctValues = true;
                    if (items.list) {
                        $(items.list).each(function () {
                            var item = this, v = item.value, t = item.text, c = item.count,
                                newItem = [v, t == null ? v : t];
                            if (c != null)
                                newItem.push(c);
                            f.Items.push(newItem);
                        });
                    }
                    else if (itemsController) {
                        f.ItemsDataController = itemsController;
                        f.ItemsDataView = items.view || 'grid1',
                            f.ItemsDataValueField = items.dataValueField;
                        f.ItemsDataTextField = items.dataTextField;
                        f.ItemsNewDataView = items.newView;
                        if (!itemsStyle.match(/AutoComplete|Lookup/))
                            requiresItems.push(f);
                        if (items.dataValueField !== items.dataTextField)
                            f._autoAlias = true;
                    }
                    f.ItemsStyle = itemsStyle;
                    if (items.disabled)
                        f.ItemsStyle = null;

                    var copy = items.copy;
                    if (copy) {
                        if (typeof copy != 'string') {
                            copy = [];
                            $(items.copy).each(function (index) {
                                var copyInfo = this;
                                copy.push(copyInfo.to + '=' + copyInfo.from);
                                if (copyInfo.from === items.dataTextField) {
                                    f.AliasName = copyInfo.to;
                                    f._autoAlias = false;
                                }
                            });
                            copy = copy.join('\n');
                        }
                        f.Copy = copy;
                    }
                }
                if (fdVisibleWhen != null)
                    //result.Expressions.push({ Scope: 3, Target: fd.name, Test: fdVisibleWhen, Type: 1, ViewId: 'form1' });
                    addDynamicExpression(3, fdName, toSurveyExpression(fdVisibleWhen));
                if (fdReadOnlyWhen != null)
                    //result.Expressions.push({ Scope: 5, Target: fd.name, Test: fdReadOnlyWhen, Type: 1, ViewId: 'form1' });
                    addDynamicExpression(5, fdName, toSurveyExpression(fdReadOnlyWhen), 5);
                result.Fields.push(f);
                fieldMap[f.Name] = f;
                if (typeof fdValue != 'function')
                    result.NewRow[result.Fields.length - 1] = fdValue;
            });

            result.Fields.forEach(function (f) {
                var contextFields = f.ContextFields;
                f.Index = fieldIndex++;
                if (contextFields)
                    $(contextFields.split(_app._simpleListRegex)).each(function () {
                        var cm = this.split(_app._fieldMapRegex),
                            cf = cm ? fieldMap[cm[2]] : null;
                        if (cf && cf.ItemsDataController === f.ItemsDataController) {
                            f.requiresDynamicNullItem = true;
                            return false;
                        }
                    });
            });

            if (options.init)
                createRule(result.Expressions, 'init', options.init, 'New', 'form1', 'After');
            if (options.submit)
                createRule(result.Expressions, 'submit', options.submit, 'Confirm', null, 'Before');
            if (options.cancel)
                createRule(result.Expressions, 'cancel', options.cancel, 'Cancel', null, 'Before');
            if (options.calculate)
                createRule(result.Expressions, 'calculate', options.calculate, 'Calculate', null, 'Execute');

            // create actions and matching business rules from buttons
            if (buttons) {
                var actionGroupMap = { form: result.ActionGroups[0] },
                    positionBefore = 0;
                options._handlers = {};
                buttons.forEach(function (btn, index) {
                    var scope = btn.scope,
                        group, action,
                        btnWhen = btn.when,
                        btnClick = btn.click || btn.execute,
                        btnId = btn.id || ('b' + index),
                        btnText = btn.text,
                        btnPosition = btn.position,
                        actions;
                    if (!scope)
                        scope = 'form';
                    group = actionGroupMap[scope];
                    if (btnText)
                        action = { Id: btnId, CommandName: btnId, WhenLastCommandName: 'New', HeaderText: btnText, Key: btn.key, CausesValidation: btn.causesValidation };
                    else
                        action = { Id: 'div' + group.Actions.length, WhenLastCommandName: 'New' };
                    if (btn.icon)
                        action.CssClass = btn.icon;
                    if (btnWhen)
                        action.WhenClientScript = typeof btnWhen == 'function' ? btnWhen :
                            function () {
                                var e = $.Event(btnWhen, { dataView: this, argument: btn.argument });
                                $document.trigger(e);
                                return !e.isDefaultPrevented();
                            };
                    if (!group) {
                        group = { Scope: scope[0].toUpperCase() + scope.substring(1), Id: scope, Actions: [] };
                        result.ActionGroups.push(group);
                        actionGroupMap[scope] = group;
                    }
                    actions = group.Actions;
                    if (scope === 'form' && btnPosition !== 'after')
                        if (btnPosition === 'before')
                            actions.splice(positionBefore++, 0, action);
                        else
                            actions.splice(actions.length - 1, 0, action);
                    else
                        actions.push(action);
                    if (btnClick) {
                        if (typeof btnClick == 'function')
                            options._handlers[btnId] = function (e) {
                                e.preventDefault();
                                btnClick.call(e.dataView, e);
                            };
                        createRule(result.Expressions, '_handlers.' + btnId, btnClick, btnId, null, 'Execute', btn.argument);
                    }
                });
            }
            optionsToTags(options);
            result.Tag = (options.tags || '') + ' ignore-unsaved-changes';
            if (result.Fields.length === 1)
                result.Fields[0].Hidden = false;
            var compileCallback = options.compiled;
            if (compileCallback) {
                if (requiresItems.length)
                    populateItems(requiresItems, result.Fields, result.NewRow, function () {
                        compileCallback(result);
                    });
                else
                    compileCallback(result);
                options.compiled = null;
            }
            return result;
        }

        function failedToLoad(result) {
            busy(false);
            var create = options.create;
            if (create)
                if (typeof create == 'string')
                    $document.trigger($.Event(create, { survey: options }));
                else
                    create.call(options);
            else
                _app.alert('Unable to load survey ' + controller + ' from the server.');
        }

        if (method === 'show')
            if (options.external) {
                var survey = _app.surveyLibrary[controller];
                if (survey)
                    show(survey);
                else {
                    busy(true);
                    var dataView = findDataView(options.parent);
                    // load the survey from the server

                    if (options.tryLoad === false || _app.surveyFailedToLoad[controller])
                        failedToLoad({});
                    else
                        $.ajax({
                            //url:  toUrl(originalControllerName + '.js'),// dataView.get_baseUrl() + '/scripts/surveys/' + originalControllerName + '.js',
                            //dataType: 'text',
                            //cache: false
                            url: appServicePath + '/GetSurvey',
                            data: jsonStringify({ name: originalControllerName }),
                            processData: false,
                            method: 'POST',
                            cache: false
                        }).done(function (result) {
                            busy(false);
                            result = result.d;
                            if (typeof result == 'string') {
                                _app.surveyLibrary[controller] = result;
                                show(result);
                            }
                            else {
                                failedToLoad(result);
                                _app.surveyFailedToLoad[controller] = true;
                            }
                        }).fail(failedToLoad);
                }
            }
            else
                showCompiled(options);
        else if (method === 'compile')
            // produce an emulation of the server response for a controller and call GetPageComplete with the result
            return compile();
        else if (method === 'populateItems') {
            var fieldWithContext = [];
            dataView = options.dataView;
            $(dataView._allFields).each(function () {
                var f = this;
                if (f.ItemsAreDynamic && f.ContextFields && !f.skipPopulate)
                    fieldWithContext.push(f);
            });
            if (fieldWithContext.length)
                populateItems(fieldWithContext, dataView._allFields, dataView.row(), options.callback);
        }
        else if (method === 'refresh')
            refresh(arguments[2]);
        else if (method === 'register')
            return register(arguments[1], arguments[2]);
        else
            _app.alert('Unsupported survey method: ' + method);
    };

    //
    // Virtual keyboard stub
    // 

    _app.keyboard = function () {
        var argList = arguments;
        if (argList.length)
            keyboards[argList[0]] = argList[1];
        return keyboards;
    };

    //
    // Survey: Batch Edit 
    // 

    $document.on('beforetouchinit.app', function () {
        _touch = _app.touch;
        _odp = _app.odp;
    }).on('batcheditsubmit.dataview.app', function (e) {
        var rules = e.rules;
        if (rules.busy()) {
            rules.preventDefault();
            return;
        }
        var dataView = rules.dataView(),
            row = dataView.row(),
            surveyContext = dataView.survey().context,
            values = [],
            focusField;
        $(dataView._allFields).each(function () {
            var f = this,
                fname = f.Name,
                fieldName = fname.match(/^(.+?)\_Batch(Edit|Keep)$/),
                bf, bfExtended, bfCopy, dependency, v;
            if (fieldName && f.Type === 'Boolean') {
                bf = dataView.findField(fname);
                if (bf && row[bf.Index]) {
                    if (fieldName[2] === 'Keep') {
                        if (values.length && values[values.length - 1].newValue != null)
                            values.push({ name: fname, value: true });
                    }
                    else {
                        bf = dataView.findField(fieldName[1]);
                        if (bf)
                            v = row[bf.Index];
                        bfExtended = bf.Extended;
                        bfCopy = bf.Copy;
                        if (bfCopy) {
                            var copy = _app._fieldMapRegex.exec(bfCopy);
                            while (copy) {
                                copy = dataView.findField(copy[1]);
                                values.push({ name: copy.Name, newValue: row[copy.Index], readOnly: copy.isReadOnly() });
                                copy = _app._fieldMapRegex.exec(bfCopy);
                            }
                        }

                        if (bfExtended && !bfExtended.allowNulls && v == null) {
                            focusField = bf;
                            return false;
                        }
                        else {
                            dependency = bfExtended.dependency;
                            if (dependency) {
                                $(dependency).each(function () {
                                    var fi = this,
                                        pf = dataView.findField(fi.Name),
                                        pv = row[pf.Index];
                                    if (v == null & pv != null) {
                                        focusField = bf;
                                        return false;
                                    }
                                    values.push({ name: pf.Name, newValue: pv });
                                });
                            }
                            if (focusField)
                                return false;
                            values.push({ name: bf.Name, newValue: v });
                        }
                    }
                }
            }
        });
        rules.preventDefault();
        if (focusField)
            rules.result.focus(focusField.Name, resourcesValidator.RequiredField);
        else if (values.length) {
            busy(true);
            var parentDataView = dataView.get_parentDataView();
            $(parentDataView._keyFields).each(function () {
                var pk = this;
                values.push({ name: pk.Name });
            });
            _app.confirm(resourcesWhenLastCommandBatchEdit.Confirmation).then(function () {
                _app.execute({
                    controller: surveyContext.controller, view: surveyContext.view, command: 'Update', lastCommand: 'BatchEdit',
                    values: values, selectedKeys: parentDataView._selectedKeyList,
                    error: function () {
                        busy(false);
                    }
                }).done(function (result) {
                    busy(false);

                    function clearSelectionInParentDataView() {
                        parentDataView._clearSelectedKey();
                        parentDataView._selectedKeyList = [];
                        parentDataView.sync();
                    }

                    if (_touch) {
                        _touch.pageShown(function () {
                            //parentDataView._keepKeyList = true; -- multiple requests where to unselect the checkboxes.
                            _touch.notify(String.format(resourcesMobile.BatchEdited, result.rowsAffected));
                            clearSelectionInParentDataView();
                        });
                        dataView.cancel();
                    }
                    else {
                        dataView.cancel();
                        parentDataView.set_selectedValue('');
                        clearSelectionInParentDataView();
                    }
                });
            });
        }
    });

    if (typeof Sys !== 'undefined') _Sys_Application.notifyScriptLoaded();

    /*!
    * Signature Pad v1.3.5
    * https://github.com/szimek/signature_pad
    *
    * Copyright 2015 Szymon Nowak
    * Released under the MIT license
    *
    * The main idea and some parts of the code (e.g. drawing variable width Bézier curve) are taken from:
    * http://corner.squareup.com/2012/07/smoother-signatures.html
    *
    * Implementation of interpolation using cubic Bézier curves is taken from:
    * http://benknowscode.wordpress.com/2012/09/14/path-interpolation-using-cubic-bezier-and-control-point-estimation-in-javascript
    *
    * Algorithm for approximated length of a Bézier curve is taken from:
    * http://www.lemoda.net/maths/bezier-length/index.html
    *
    */
    _window.SignaturePad = (function (document) {

        var SignaturePad = function (canvas, options) {
            var self = this,
                opts = options || {};

            self.velocityFilterWeight = opts.velocityFilterWeight || 0.7;
            self.minWidth = opts.minWidth || 0.5;
            self.maxWidth = opts.maxWidth || 2.5;
            self.dotSize = opts.dotSize || function () {
                return (self.minWidth + self.maxWidth) / 2;
            };
            self.penColor = opts.penColor || "black";
            self.backgroundColor = opts.backgroundColor || "rgba(0,0,0,0)";
            self.onEnd = opts.onEnd;
            self.onBegin = opts.onBegin;

            self._canvas = canvas;
            self._ctx = canvas.getContext("2d");
            self.clear();

            self._handleMouseEvents();
            self._handleTouchEvents();
        };

        SignaturePad.prototype.clear = function () {
            var ctx = this._ctx,
                canvas = this._canvas;

            ctx.fillStyle = this.backgroundColor;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            this._reset();
        };

        SignaturePad.prototype.toDataURL = function (imageType, quality) {
            var canvas = this._canvas;
            return canvas.toDataURL.apply(canvas, arguments);
        };

        SignaturePad.prototype.fromDataURL = function (dataUrl) {
            var self = this,
                image = new Image(),
                ratio = _window.devicePixelRatio || 1,
                width = self._canvas.width / ratio,
                height = self._canvas.height / ratio;

            self._reset();
            image.src = dataUrl;
            image.onload = function () {
                self._ctx.drawImage(image, 0, 0, width, height);
            };
            self._isEmpty = false;
        };

        SignaturePad.prototype._strokeUpdate = function (event) {
            var point = this._createPoint(event);
            this._addPoint(point);
        };

        SignaturePad.prototype._strokeBegin = function (event) {
            var ctx = this._ctx,
                canvas = this._canvas;

            // clear the canvas to remove "Sign Here" watermark - Code On Time
            if (this._isEmpty) {
                ctx.fillStyle = this.backgroundColor;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = this.penColor;
            }

            this._reset();
            this._strokeUpdate(event);
            if (typeof this.onBegin == 'function') {
                this.onBegin(event);
            }
        };

        SignaturePad.prototype._strokeDraw = function (point) {
            var ctx = this._ctx,
                dotSize = typeof this.dotSize == 'function' ? this.dotSize() : this.dotSize;

            ctx.beginPath();
            this._drawPoint(point.x, point.y, dotSize);
            ctx.closePath();
            ctx.fill();
        };

        SignaturePad.prototype._strokeEnd = function (event) {
            var canDrawCurve = this.points.length > 2,
                point = this.points[0];

            if (!canDrawCurve && point) {
                this._strokeDraw(point);
            }
            if (typeof this.onEnd === 'function') {
                this.onEnd(event);
            }
        };

        SignaturePad.prototype._handleMouseEvents = function () {
            var self = this,
                canvas = $(self._canvas);
            self._mouseButtonDown = false;

            // using jQuery for event handling to simplify cleanup of resources - Code On Time

            canvas.on("mousedown", function (event) {
                event = event.originalEvent;
                if (event.which === 1) {
                    self._mouseButtonDown = true;
                    self._strokeBegin(event);
                }
            });

            canvas.on("mousemove", function (event) {
                event = event.originalEvent;
                if (self._mouseButtonDown) {
                    self._strokeUpdate(event);
                }
            });

            $document.on("mouseup", function (event) {
                event = event.originalEvent;
                if (event.which === 1 && self._mouseButtonDown) {
                    self._mouseButtonDown = false;
                    self._strokeEnd(event);
                }
            });
        };

        SignaturePad.prototype._handleTouchEvents = function () {
            var self = this,
                canvas = $(self._canvas);

            // Pass touch events to canvas element on mobile IE.
            self._canvas.style.msTouchAction = 'none';

            // using jQuery for event handling to simplify cleanup of resources - Code On Time

            canvas.on("touchstart", function (event) {
                event = event.originalEvent;
                var touch = event.changedTouches[0];
                self._strokeBegin(touch);
            });

            canvas.on("touchmove", function (event) {
                event = event.originalEvent;
                // Prevent scrolling.
                event.preventDefault();

                var touch = event.changedTouches[0];
                self._strokeUpdate(touch);
            });

            $document.on("touchend", function (event) {
                event = event.originalEvent;
                var wasCanvasTouched = event.target === self._canvas;
                if (wasCanvasTouched) {
                    self._strokeEnd(event);
                }
            });
        };

        SignaturePad.prototype.isEmpty = function () {
            return this._isEmpty;
        };

        SignaturePad.prototype._reset = function () {
            this.points = [];
            this._lastVelocity = 0;
            this._lastWidth = (this.minWidth + this.maxWidth) / 2;
            this._isEmpty = true;
            this._ctx.fillStyle = this.penColor;
        };

        SignaturePad.prototype._createPoint = function (event) {
            var rect = this._canvas.getBoundingClientRect();
            return new Point(
                event.clientX - rect.left,
                event.clientY - rect.top
            );
        };

        SignaturePad.prototype._addPoint = function (point) {
            var points = this.points,
                c2, c3,
                curve, tmp;

            points.push(point);

            if (points.length > 2) {
                // To reduce the initial lag make it work with 3 points
                // by copying the first point to the beginning.
                if (points.length === 3) points.unshift(points[0]);

                tmp = this._calculateCurveControlPoints(points[0], points[1], points[2]);
                c2 = tmp.c2;
                tmp = this._calculateCurveControlPoints(points[1], points[2], points[3]);
                c3 = tmp.c1;
                curve = new Bezier(points[1], c2, c3, points[2]);
                this._addCurve(curve);

                // Remove the first element from the list,
                // so that we always have no more than 4 points in points array.
                points.shift();
            }
        };

        SignaturePad.prototype._calculateCurveControlPoints = function (s1, s2, s3) {
            var dx1 = s1.x - s2.x, dy1 = s1.y - s2.y,
                dx2 = s2.x - s3.x, dy2 = s2.y - s3.y,

                m1 = { x: (s1.x + s2.x) / 2.0, y: (s1.y + s2.y) / 2.0 },
                m2 = { x: (s2.x + s3.x) / 2.0, y: (s2.y + s3.y) / 2.0 },

                l1 = Math.sqrt(dx1 * dx1 + dy1 * dy1),
                l2 = Math.sqrt(dx2 * dx2 + dy2 * dy2),

                dxm = (m1.x - m2.x),
                dym = (m1.y - m2.y),

                k = l2 / (l1 + l2),
                cm = { x: m2.x + dxm * k, y: m2.y + dym * k },

                tx = s2.x - cm.x,
                ty = s2.y - cm.y;

            return {
                c1: new Point(m1.x + tx, m1.y + ty),
                c2: new Point(m2.x + tx, m2.y + ty)
            };
        };

        SignaturePad.prototype._addCurve = function (curve) {
            var startPoint = curve.startPoint,
                endPoint = curve.endPoint,
                velocity, newWidth;

            velocity = endPoint.velocityFrom(startPoint);
            velocity = this.velocityFilterWeight * velocity
                + (1 - this.velocityFilterWeight) * this._lastVelocity;

            newWidth = this._strokeWidth(velocity);
            this._drawCurve(curve, this._lastWidth, newWidth);

            this._lastVelocity = velocity;
            this._lastWidth = newWidth;
        };

        SignaturePad.prototype._drawPoint = function (x, y, size) {
            var ctx = this._ctx;

            ctx.moveTo(x, y);
            ctx.arc(x, y, size, 0, 2 * Math.PI, false);
            this._isEmpty = false;
        };

        SignaturePad.prototype._drawCurve = function (curve, startWidth, endWidth) {
            var ctx = this._ctx,
                widthDelta = endWidth - startWidth,
                drawSteps, width, i, t, tt, ttt, u, uu, uuu, x, y;

            drawSteps = Math.floor(curve.length());
            ctx.beginPath();
            for (i = 0; i < drawSteps; i++) {
                // Calculate the Bezier (x, y) coordinate for this step.
                t = i / drawSteps;
                tt = t * t;
                ttt = tt * t;
                u = 1 - t;
                uu = u * u;
                uuu = uu * u;

                x = uuu * curve.startPoint.x;
                x += 3 * uu * t * curve.control1.x;
                x += 3 * u * tt * curve.control2.x;
                x += ttt * curve.endPoint.x;

                y = uuu * curve.startPoint.y;
                y += 3 * uu * t * curve.control1.y;
                y += 3 * u * tt * curve.control2.y;
                y += ttt * curve.endPoint.y;

                width = startWidth + ttt * widthDelta;
                this._drawPoint(x, y, width);
            }
            ctx.closePath();
            ctx.fill();
        };

        SignaturePad.prototype._strokeWidth = function (velocity) {
            return Math.max(this.maxWidth / (velocity + 1), this.minWidth);
        };


        var Point = function (x, y, time) {
            this.x = x;
            this.y = y;
            this.time = time || new Date().getTime();
        };

        Point.prototype.velocityFrom = function (start) {
            return (this.time !== start.time) ? this.distanceTo(start) / (this.time - start.time) : 1;
        };

        Point.prototype.distanceTo = function (start) {
            return Math.sqrt(Math.pow(this.x - start.x, 2) + Math.pow(this.y - start.y, 2));
        };

        var Bezier = function (startPoint, control1, control2, endPoint) {
            this.startPoint = startPoint;
            this.control1 = control1;
            this.control2 = control2;
            this.endPoint = endPoint;
        };

        // Returns approximated length.
        Bezier.prototype.length = function () {
            var steps = 10,
                length = 0,
                i, t, cx, cy, px, py, xdiff, ydiff;

            for (i = 0; i <= steps; i++) {
                t = i / steps;
                cx = this._point(t, this.startPoint.x, this.control1.x, this.control2.x, this.endPoint.x);
                cy = this._point(t, this.startPoint.y, this.control1.y, this.control2.y, this.endPoint.y);
                if (i > 0) {
                    xdiff = cx - px;
                    ydiff = cy - py;
                    length += Math.sqrt(xdiff * xdiff + ydiff * ydiff);
                }
                px = cx;
                py = cy;
            }
            return length;
        };

        Bezier.prototype._point = function (t, start, c1, c2, end) {
            return start * (1.0 - t) * (1.0 - t) * (1.0 - t)
                + 3.0 * c1 * (1.0 - t) * (1.0 - t) * t
                + 3.0 * c2 * (1.0 - t) * t * t
                + end * t * t * t;
        };

        return SignaturePad;
    })(document);

    _app.storage = {
        instance: function (type) {
            if (arguments.length) {
                if (type === 'avatars' || type === 'identities')
                    return _window.localStorage;
                if (type === 'session' || type === 'local')
                    _storage = _window[type + 'Storage'];
                if (type === 'default')
                    _storage = null;
            }
            if (!_storage)
                _storage = _window[((_touch ? _touch.settings('ui.state.storage') : '') || 'local') + 'Storage']; // use the "local" storage by default
            return _storage;
        },
        clearUIState: function () {
            if (!_host) {
                _app.storage.instance('default'); // ensure the default storage
                var userScope = __settings.appInfo.replace(/\W/g, '_') + '_',
                    propertiesToRemove = [],
                    propName, propSuffix;
                for (propName in _storage)
                    if (propName.indexOf(userScope) === 0) {
                        propSuffix = propName.substring(userScope.length);
                        if (propSuffix.length && !!propSuffix.match(/\_/)) // retain the global user preferences such as "minisidebar"
                            propertiesToRemove.push(propName);
                    }
                try {
                    propertiesToRemove.forEach(function (propName) {
                        _storage.removeItem(propName)
                    });
                    appClipboard.clear();
                }
                catch (ex) {
                    // ignore all exceptions
                }
            }
        },
        set: function (name, value) {
            var ls = this.instance(name);
            if (ls)
                try {
                    if (name.match(/\*$/)) {
                        name = name.substring(0, name.length - 1);
                        var keyList = [], key, k, v;
                        for (key in ls)
                            if (key.indexOf(name) == 0)
                                keyList.push(key);
                        value = JSON.parse(value);
                        keyList.forEach(function (key) {
                            for (k in value)
                                if (key.endsWith('_' + k)) {
                                    v = value[k];
                                    if (v == null)
                                        ls.removeItem(key);
                                    else
                                        ls[key] = v;
                                    break;
                                }
                        });
                    }
                    else if (value == null)
                        ls.removeItem(name);
                    else
                        ls[name] = value;
                } catch (ex) {
                    // nothing
                }
        },
        get: function (name) {
            var ls = this.instance(name);
            if (ls)
                try {
                    return ls[name];
                }
                catch (ex) {
                    return null;
                }
            else
                return null;
        },
        remove: function (name) {
            this.set(name, null);
        },
        lock: function () {
        },
        unlock: function () {
        }
    };

    // account manager
    _app.AccountManager = {
        enabled: function () {
            return _touch && _touch.settings('membership.enabled') !== false && _touch.settings('membership.accountManager.enabled') !== false;
        },
        current: function () {
            if (this.enabled()) {
                var ids = this.list(true);
                return ids[$app.userName()];
            }
        },
        session: function (user) {
            try {
                if (arguments.length === 1) {
                    if (user != null)
                        sessionStorage.setItem('AccountManager_Id', jsonStringify(user));
                    else
                        sessionStorage.removeItem('AccountManager_Id');
                }
                else {
                    var id = sessionStorage.getItem('AccountManager_Id');
                    if (id)
                        return JSON.parse(id);
                }
            }
            catch (ex) {
                // nothing
            }
            return null;
        },
        set: function (user) {
            if (user.UserName) // ensure compatiblity with *.aspx projects serialization of UserTicket
                user = { name: user.UserName, email: user.Email, access_token: user.AccessToken, refresh_token: user.RefreshToken, picture: user.Picture, claims: user.Claims }
            var that = this,
                userName = user.name,
                userPicture = user.picture,
                avatars;
            if (!_host) {
                avatars = _app.storage.get('avatars');
                that._avatar = avatars = avatars ? JSON.parse(avatars) : {};
                if (userPicture)
                    avatars[userName] = userPicture;
                else
                    delete avatars[userName];
                _app.storage.set('avatars', jsonStringify(avatars));
            }

            delete user.picture;

            if (that.enabled()) {
                var identities = that.list();
                if (user.session) {
                    delete identities[userName];
                    delete identities._lastUser;
                    that.session(user);
                }
                else {
                    identities[userName] = user;
                    identities._lastUser = userName;
                }
                _app.storage.set('identities', jsonStringify(identities));
            }
        },
        count: function () {
            var list = this.list(),
                count = 0;
            for (var k in list)
                if (k !== '_lastUser')
                    count++;

            return count;
        },
        list: function (includeSession) {
            if (_touch) {
                var identities = _app.storage.get('identities');
                identities = identities ? JSON.parse(identities) : {};
                if (includeSession) {
                    var session = this.session();
                    if (session)
                        identities[session.name] = session;
                }
                return identities;
            }
            return {};
        },
        remove: function (username, forget) {
            if (_touch) {
                var identities = this.list();
                if (identities.hasOwnProperty(username))
                    if (forget)
                        delete identities[username];
                    else {
                        identities[username].access_token = null;
                        identities[username].refresh_token = null;
                    }
                else
                    this.session(null);
                delete identities._lastUser;
                //_window.localStorage.setItem('identities', jsonStringify(identities));
                _app.storage.set('identities', jsonStringify(identities));
            }
        },
        avatar: function (user, icon) {
            var that = this,
                userAvatar,
                avatars = that._avatars,
                userProfileAvatars;
            if (!avatars) {
                userProfileAvatars = _app.storage.get('avatars');//storage['userProfilePictures'];
                avatars = that._avatars = userProfileAvatars ? JSON.parse(userProfileAvatars) : {};
            }
            if (that._oldAvatars != avatars) {  // eslint-disable-line  
                that._oldAvatars = avatars;
                $(document).trigger('useravatarchanged.app');
            }
            if (avatars)
                userAvatar = avatars[user];
            if (userAvatar && icon)
                icon.css('background-image', 'url("' + userAvatar + '")').parent().addClass('app-has-avatar-with-picture');
            return userAvatar;
        }
    };
})();
