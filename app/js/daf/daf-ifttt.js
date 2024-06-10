/*eslint eqeqeq: ["error", "smart"]*/
/*!
* Data Aquarium Framework - If This Then That + Kiosk UI
* Copyright 2021-2020 Code On Time LLC; Licensed MIT; http://codeontime.com/license
*/

(function () {
    var app,
        _app = $app,
        _touch, _input,
        kiosk,
        appDeferred,
        execState,
        execSpeed = 16,
        execTimer,
        $body = $('body'),
        $document = $(document),
        $window = $(window),
        transitionsStyle,
        runKioskAutomationOnHomePage,
        iftttTimeout,
        resizeTimeout,
        _started,
        _kiosk, _display, _displayContent,
        displayBreakpoint,
        logicalWidthArray,
        restoreFocusTimeout,
        resources = Web.DataViewResources,
        resourcesMobile = resources.Mobile,
        resourcesPager = resources.Pager,
        resourcesForm = resources.Form,
        getBoundingClientRect = _app.clientRect,
        elementAt = _app.elementAt,
        labelNullValueInForms = resources.Data.NullValueInForms,
        breakpointRegex = /^(tn|xxs|xs|sm|md|lg|xl|xxl)?(_)?(tn|xxs|xs|sm|md|lg|xl|xxl)?$/, // 'tn', 'xxs', 'xs', 'sm', 'md', 'lg', 'xl', 'xxl'
        mappedExceptions = ['selector', 'value', 'regex', 'inSelector', 'inRegex', 'qualifier', '_extended'],
        systemDisplayProperties = ['as', 'background', 'border', 'hero', 'icon'], // this array can be used to extend the future complex "system" properties such "image" or "html" when a literal value is not enough
        dataViewChangeMonitor = [],
        layoutGridInfo, // defaul CSS configuration { w:71, g: 8} // width and gap
        $settings,
        numPadText,
        numPadKeyTests = [],
        _displayFlow = 0, // index of the the display flow object
        _displayState = {},
        findDataView = _app.findDataView,
        appBtnSync = { exec: appBtnSync_Exec },
        appBtnScan = { icon: 'line_weight', tooltip: 'Scan', transform: 'rotate(270deg)', exec: appBtnScan_Exec },
        displayFlowDataViewId,
        // html utilities
        htmlUtilities = _app.html,
        htmlTag = htmlUtilities.tag,
        $htmlTag = htmlUtilities.$tag,
        $div = htmlUtilities.$div,
        span = htmlUtilities.span,
        $span = htmlUtilities.$span,
        $i = htmlUtilities.$i;


    standardNumPadButtons = [
        [
            { key: '7' },
            { key: '8' },
            { key: '9' },
            { key: 'BackSpace', icon: 'backspace', dark: true }
        ],
        [
            { key: '4' },
            { key: '5' },
            { key: '6' },
            { key: 'PlusMinus', text: String.fromCharCode(0xb1), dark: true }
        ],
        [
            { key: '3' },
            { key: '2' },
            { key: '1' },
            { key: '*', dark: true }

        ],
        [
            { key: '0', width: 2 },
            {
                key: function () { return Sys.CultureInfo.CurrentCulture.numberFormat.NumberDecimalSeparator; },
                test: function (text) { return !text.match(/(\.|\.\d+)$/) }
            },
            { key: 'abc', font: '1em', dark: true }
        ],
        [
            { key: 'Enter', icon: 'keyboard_return', accent: true }
        ]
    ];

    function displayState(config, name, value) {
        var id = config.id,
            result;
        if (!id)
            id = config.id = 'flow' + _displayFlow++;
        name = id + '_' + name;
        if (arguments.length < 3)
            result = _displayState[name];
        else
            result = _displayState[name] = value;
        return result;
    }

    function displayStateInit(config, name, defaultValue) {
        var value = displayState(config, name);
        if (value == null) {
            value = defaultValue;
            displayState(config, name, value);
        }
        return value;
    }

    function notify(text, force, duration) {
        _touch.notify(arguments.length > 1 ? { text: text, force: force, duration: duration } : text);
    }


    function appIsBusy() {
        return _touch.busy() || _touch.isInTransition();
    }

    function findActivePage() {
        return _touch.activePage() || $();
    }

    function isReadingBarcodes(strictCheck) {
        // UI Automation treats any keyboard input as barcode. There is not need to check for speed of keys being pressed.
        // TODO: remove this method if it proves to be redundant in the future.
        return false; //_input.barcode(':input');//strictCheck ? _input.barcode(':input') : false;
    }

    function barcodeInputAlways(state) {
        _input.barcode(':always', state);
    }

    function isKioskOnTop() {
        return _kiosk && !_kiosk.nextAll('.ui-page-active').length;
    }

    function uiAutomation(state) {
        if (arguments.length)
            if (state) {
                barcodeInputAlways(!_kiosk || isKioskOnTop());
                if (execState && execState.input['barcode'])
                    $(document.activeElement).blur();
                if (_input.valid()) {
                    if (!transitionsStyle)
                        transitionsStyle = $settings('ui.transitions.style');
                    $settings('ui.transitions.style', 'none');
                    //                $('.app-data-input-helper').hide(); // hide the calendar popup
                    $body.addClass('app-ui-automation');
                    findActivePage().addClass('app-ui-automation-root');
                }
            }
            else {
                barcodeInputAlways(isKioskOnTop());
                $('.app-ui-automation,.app-ui-automation-root').removeClass('app-ui-automation app-ui-automation-root');
                if (_input.barcode(':peek') == null)
                    _touch.resetUI();
                $settings('ui.transitions.style', transitionsStyle);
            }
        else
            return $body.is('.app-ui-automation');
    }

    function enableSystemUI(state) {
        if (state === true) {
            $body.addClass('app-ui-automation-system');
            $settings('ui.transitions.style', transitionsStyle);
        }
        else {
            $body.removeClass('app-ui-automation-system');
            $settings('ui.transitions.style', 'none');
        }
    }

    function disableSystemUIAndEnableBarcodeInputInKiosk() {
        enableSystemUI();
        if (_kiosk)
            barcodeInputAlways(true);
    }

    function uiAutomationSettings(selector, value) {
        selector = 'ui.automation.' + selector;
        return $settings.apply(this, arguments);
    }

    function iftttDone(error) {
        if (error)
            app.error(error);
        if (appDeferred)
            appDeferred.resolve();
    }

    function iftttFail() {
        if (appDeferred)
            appDeferred.reject();
    }

    function objectToPrettyString(obj) {
        return JSON.stringify(obj).replace(/","/g, '", "');
    }

    function toSelectorRegex(selector) {
        return new RegExp(RegExp.escape(selector).replace(/\\\+/g, '.+?'), 'i');
    }

    function normalizeOptions(options, args, maximumNumberOfArguments) {
        var argsLength = args && args.length,
            value;
        if (options && options._extended)
            return options;
        if (argsLength === 1 && typeof options == 'object' && !('selector' in options)) {
            if (!options._extended)
                options._extended = {};
            for (var propName in options)
                if (mappedExceptions.indexOf(propName) < 0) {
                    options.selector = propName;
                    value = options[propName];
                    if (value instanceof ActivityContext)
                        options[propName] = value = value.unwrap();
                    if (!options._extended.mapped) {
                        options.value = value;
                        options._extended.mapped = true;
                    }
                }
        }
        if (options == null)
            options = '';
        if (typeof options == 'string')
            options = { selector: options, _extended: {} };
        var selector = options.regex;
        if (!selector) {
            selector = options.selector;
            if (selector == null)
                selector = '';
            if (!(selector instanceof RegExp)) {
                selector = selector.toString();
                if (selector != null && selector.match(/^@/)) {
                    selector = selector.substring(1);
                    options.identifier = selector;
                }
                else
                    selector = toSelectorRegex(selector);
            }
            options.regex = selector;
        }
        if (args) {
            if (argsLength > 1) {
                value = args[1];
                if (value instanceof ActivityContext)
                    value = args[1] = value.unwrap();
                options.value = value;
                if (maximumNumberOfArguments === 2)
                    options.in = value;
            }
            if (argsLength > 2)
                options.in = args[2];
        }
        if (options.in) {
            var inOptions = { selector: options.in };
            inOptions = normalizeOptions(inOptions);
            if (inOptions.identifier)
                options.inIdentifier = inOptions.identifier;
            else
                options.inRegex = inOptions.regex;
        }
        return options;
    }

    function toSearchSurveyPrincipal(dataView) {
        var survey = dataView && dataView._survey,
            context = survey && survey.context;
        if (context && typeof context == 'object' && 'model' in context && 'search' in context)
            dataView = _app.find(context.id);
        return dataView;
    }

    function appDataView() {
        var dataView = _kiosk && !uiAutomation() ? findDataView(_kiosk.prevAll('.ui-page-active,.ui-page').first().attr('id')) : _touch.dataView(),
            echo, pageInfo;
        if (_kiosk && !uiAutomation())
            if (_kiosk.prevAll('.ui-page-active').length)
                dataView = _touch.dataView();
            else
                dataView = findDataView(_kiosk.prevAll('.ui-page:first').attr('id'));
        else
            dataView = _touch.dataView();
        if (!dataView) {
            echo = $('#Main .app-echo:first');
            if (echo.length)
                dataView = findDataView(echo.data('for'));
        }
        if (!dataView) {
            pageInfo = _touch.pageInfo(displayFlowDataViewId);
            $app.survey({
                controller: pageInfo.id,
                id: pageInfo.id,
                show: false,
                questions: [{ name: 'text' }],
                cancel: false
            });
            dataView = pageInfo.dataView = _app.findDataView(pageInfo.id);
            if (!pageInfo.page)
                pageInfo.page = $('.ui-page-active');
            pageInfo.initialized = false;
            if (dataView)
                _touch.pageInit(dataView._id);
        }
        return dataView;
    }

    function optionsToDataView2(options) {
        var dataView = appDataView(),
            field;
        if (dataView) {
            // use the principal dataview if the search survey is active for context operation
            dataView = toSearchSurveyPrincipal(dataView);
            if (options.in) {
                if (options.inIdentifier)
                    field = dataView.findField(options.inIdentifier);
                else
                    dataView._allFields.every(function (f) {
                        if (f.HeaderText.match(options.inRegex))
                            field = f;
                        return !field;
                    });
                if (field)
                    dataView = _app.find(field._dataViewId);
                else
                    dataView = null;
            }
        }
        return dataView;
    }

    function invokeWithDataViewWhenReady(dataView, deferred, wait, callback) {
        if (dataView._allFields && !(dataView._busy() || isReadingBarcodes()))
            invokeWithDataView(dataView, deferred, wait, callback);
        else
            setTimeout(invokeWithDataViewWhenReady, 16 * 2, dataView, deferred, wait, callback);
    }

    function invokeWithDataView(dataView, deferred, wait, callback) {
        if (wait) {
            if (callback(dataView, deferred) !== false) {
                if (execState.error)
                    deferred.reject();
                else
                    setTimeout(app._wait, execSpeed, deferred);
            }
        }
        else {
            var result = callback(dataView, deferred);
            if (!(result && result.then))
                if (result)
                    deferred.resolve(result);
                else
                    deferred.reject();
        }
    }

    function optionsToDataView(options, deferred, wait, callback) {
        var dataView = appDataView(),
            scrollIntoView,
            field;

        if (dataView) {
            // use the principal dataview if the search survey is active for context operation
            dataView = toSearchSurveyPrincipal(dataView);
            if (options.in) {
                if (options.inIdentifier)
                    field = dataView.findField(options.inIdentifier);
                else
                    dataView._allFields.every(function (f) {
                        if (f.HeaderText.match(options.inRegex))
                            field = f;
                        return !field;
                    });
                if (field) {
                    dataView = _app.find(field._dataViewId);
                    scrollIntoView = !dataView._allFields || dataView._busy();
                }
                else
                    dataView = null;
            }
        }
        if (callback)
            if (scrollIntoView) {
                _input.focus({ field: field });
                invokeWithDataViewWhenReady(dataView, deferred, wait, callback);
            }
            else
                invokeWithDataView(dataView, deferred, wait, callback);
        return dataView;
    }

    function optionsToField(options, dataView) {
        var result,
            identifier = options.identifier;
        if (!dataView)
            dataView = optionsToDataView2(options);
        if (dataView)
            if (identifier)
                result = dataView.findField(identifier);
            else
                dataView._allFields.every(function (f) {
                    if (f.HeaderText.match(options.regex))
                        result = f;
                    return !result;
                });
        return result;
    }

    function optionsToFilter(options, methodName) {
        var filter = {},
            field,
            propName,
            badFields = [];
        if (options._extended.mapped) {
            for (propName in options)
                if (mappedExceptions.indexOf(propName) < 0) {
                    field = optionsToField(normalizeOptions({ selector: propName, in: options.in }));
                    if (field)
                        filter[field.Name] = options[propName];
                    else
                        badFields.push(propName);
                }
        }
        else {
            field = optionsToField(options);
            if (field)
                filter[field.Name] = options.value;
            else
                badFields.push(options.selector);
        }
        if (badFields.length) {
            app.error(methodName + ': "' + badFields.join('", "') + '" not found.');
            iftttDone(false);
            filter = null;
        }
        return filter;
    }


    function findItemInContextOf(dataView, options, context) {
        var result,
            saveScope = _touch.contextScope(),
            identifier = options.identifier,
            isGrid;
        if (dataView) {
            isGrid = !dataView.get_isForm();
            // enumerate context items
            if (!context)
                context = [];
            if (!context.length) {
                _touch.contextScope(dataView);
                _touch.navContext(context);
                _touch.contextScope(saveScope);
            }
            // find item in context
            context.every(function (item) {
                var text = item.text;
                if (identifier != null && item.path === identifier || text && (!item.system || options.system) &&
                    !(item.command === 'New' && isGrid && (item.argument === dataView._viewId || !item.argument)) &&
                    !(item.command === 'Edit' && isGrid && (item.argument === dataView._viewId || !item.argument)) &&
                    text.match(options.regex))
                    result = item;
                return !result;
            });
        }
        return result;
    }

    function syncDataView(dataView, data, filter, extended) {
        var syncKey = [],
            rowFilter = [],
            propName,
            field;
        if (extended.method === 'filter') {
            syncKey = null;
            for (propName in filter) {
                field = dataView.findField(propName);
                if (field)
                    rowFilter.push(field.Name + ':=%js%' + JSON.stringify(filter[propName]));
            }
        }
        else
            dataView._allFields.forEach(function (f) {
                if (f.IsPrimaryKey) {
                    syncKey.push(data[f.Name]);
                    rowFilter.push(f.Name + ':=%js%' + JSON.stringify(data[f.Name]));
                }
            });
        if (extended.filter && !_display) {
            dataView._syncFilter = true;
            dataView.set_filter(rowFilter);
        }
        dataView.sync(syncKey);
        dataView._syncFilter = false;
    }

    //
    // ActivityContext class allows inspecting the state of the Touch UI application
    // 

    function ActivityContext(parent) {
        this._deferred = $.Deferred();
        this._pending = parent ? parent._pending.slice() : [];
    }

    ActivityContext.prototype = {
        deferred: function (method, args) {
            var that = this,
                deferred = that._deferred;
            if (method && method.match(/^:/)) {
                method = method.substring(1);
                return deferred.state() === method;
            }
            else if (method === 'resolve') {
                deferred.resolve(args);
                that._resolvedArgs = args;
            }
            else if (method === 'reject')
                deferred.reject(args);
            else if (method === 'pending')
                that._deferred = $.Deferred();
            else
                return deferred;
        },
        _generic: function (options, callback, args) {
            var that = this,
                andNot = that._andNot,
                result;
            if (!that.deferred(':rejected')) {
                //that.deferred('pending');
                that = new ActivityContext(that);
                options = normalizeOptions(options, args);
                result = callback(options, that);
                if (result && result.then)
                    that.pending(result);
                else {
                    if (andNot) {
                        result = !result;
                        that._andNot = false;
                    }
                    if (result)
                        that.deferred('resolve', result);
                    else
                        that.deferred('reject', options);
                }
            }
            return that;
        },
        pending: function (promise) {
            if (arguments.length)
                this._pending.push(promise);
            else
                return this._pending;
        },
        not: function () {
            var that = this;
            that._andNot = true;
            return that;
        },
        page: function (options) {
            return this._generic(options, function (options) {
                var currentNode = Web.Menu.currentNode,
                    identifier = options.identifier,
                    title,
                    result;
                if (currentNode) {
                    title = currentNode.title;
                    if (identifier) {
                        if (currentNode.url === _app.resolveClientUrl(identifier))
                            result = true;
                    }
                    else if (title != null)
                        try {
                            result = title.match(options.regex);
                        }
                        catch (ex) {
                            // ignore exception
                        }
                }
                else
                    if (typeof identifier == 'string')
                        return location.pathname === _app.resolveClientUrl(identifier);
                return result;
            });
        },
        controller: function (options) {
            return this._generic(options, function (options) {
                var result,
                    identifier = options.identifier,
                    dataView = optionsToDataView2(options);
                if (dataView)
                    if (identifier)
                        result = dataView._controller === identifier;
                    else
                        result = dataView.get_view().Label.match(options.regex);
                return result;
            });
        },
        view: function (options) {
            return this._generic(options, function (options) {
                var result,
                    identifier = options.identifier,
                    dataView = optionsToDataView2(options),
                    selector = options.selector;
                if (dataView)
                    if (identifier)
                        result = dataView._viewId === identifier;
                    else if (selector.match(/^:/))
                        result = dataView.extension().viewStyle().toLowerCase() === selector.substring(1).toLowerCase();
                    else
                        result = dataView.get_view().Label.match(options.regex);
                return result;
            });
        },
        form: function () {
            return this.view(':form');
        },
        list: function () {
            return this.not().form();
        },
        field: function (options) {
            return this._generic(options, function (options) {
                return optionsToField(options);
            });
        },
        action: function (options) {
            options = normalizeOptions(options, arguments, 2);
            var andNot = this._andNot;
            return this._generic(options, function (options, activity) {
                var deferred = activity.deferred();
                optionsToDataView(options, deferred, false, function (dataView, deferred) {
                    var result = findItemInContextOf(dataView, options);
                    if (andNot)
                        result = !result;
                    return result == null ? false : result;
                });
                return deferred.promise();
            });
        },
        input: function (options, test) {
            if (options != null)
                if (arguments.length < 2)
                    test = options.test;
                else
                    options.test = test;
            if (test && !(test instanceof RegExp) && typeof test != 'function')
                test = new RegExp(RegExp.escape(test), 'i');
            return this._generic(options, function (options) {
                var result;
                var selector = options.selector;
                if (selector === '')
                    for (var propName in execState.input) {
                        selector = propName;
                        break;
                    }
                if (execState) {
                    result = execState.input[selector];
                    if (test)
                        if (typeof test == 'function')
                            result = test(result);
                        else if (result != null && typeof result == 'string')
                            result = result.match(test);
                }
                return result;
            });
        },
        barcode: function (options) {
            var inputOptions = { selector: 'barcode' };
            if (arguments.length > 0)
                inputOptions.test = options;
            return this.input(inputOptions);
        },
        display: function (options) {
            return this._generic({}, function () {
                if (typeof options == 'string')
                    options = { id: options };
                return _display != null && options === _display.data('display');
            });
        },
        reading: function (options) {
            return this.not().editing(options);
        },
        editing: function (options) {
            return this._generic(options, function (options) {
                var dataView = _touch.dataView();
                return dataView && dataView._id !== '-confirm' && dataView.get_isForm() && dataView.editing();
            });
        },
        inserting: function (options) {
            return this._generic(options, function (options) {
                var dataView = _touch.dataView();
                return dataView && dataView._id !== '-confirm' && dataView.get_isForm() && dataView.inserting();
            });
        },
        val: function (options, test) {
            var that = this,
                requiresTest;
            if (options != null)
                if (arguments.length < 2) {
                    requiresTest = typeof options == 'object' && 'test' in options;
                    test = options.test;
                }
                else {
                    options.test = test;
                    requiresTest = true;
                }
            return that._generic(options, function (options) {
                var result,
                    field = optionsToField(options),
                    data;
                if (field) {
                    data = field._dataView.data();
                    result = data[field.Name];
                    if (requiresTest) {
                        if (test instanceof RegExp) {
                            if (result != null)
                                result = result.toString().match(test);
                        }
                        else if (test == null)
                            result = result == null;
                        else if (typeof test == 'function')
                            result = test(result);
                        else
                            retult = result === test;
                    }
                }
                return result;
            });
        },
        row: function (options, value, target) {
            var andNot = this._andNot;
            return this._generic(options, function (options, activity) {
                var deferred = activity.deferred();
                optionsToDataView(options, deferred, false, function (dataView, deferred) {
                    var filter = {},
                        existingData;
                    if (dataView) {
                        filter = optionsToFilter(options, 'context:row');
                        if (!filter)
                            return false;

                        existingData = execState.input[JSON.stringify(filter)];
                        if (existingData)
                            return existingData;
                        else {
                            _app.execute({
                                controller: dataView._controller,
                                view: dataView._viewId,
                                externalFilter: dataView.get_externalFilter(),
                                filter: filter,
                                odp: true
                            }).done(function (executeResult) {
                                var data = executeResult[dataView._controller],
                                    qualifier = options._extended.mapped ? options.qualifier : options.selector,
                                    propName,
                                    result;
                                qualifier = qualifier ? qualifier += '.' : '';
                                if (data && data.length) {
                                    data = data[0];
                                    execState.input[JSON.stringify(filter)] = data;
                                    for (propName in data)
                                        execState.input[qualifier + propName] = data[propName];
                                    result = data;
                                }
                                if (andNot)
                                    result = !result;
                                if (result)
                                    deferred.resolve(data);
                                else
                                    deferred.reject();
                            }).fail(function (err) {
                                app.error('context.row: ' + err.get_message() + '\n' + objectToPrettyString(options));
                                iftttDone(false); // stop automation and report the error
                            });
                        }
                    }
                    else {
                        app.error('context.row: Data view ' + (options.in || '') + ' is not found.');
                        iftttFail(false); // stop automation and report the error
                    }
                    return deferred;
                });
                return deferred;
            }, arguments);
        },
        confirm: function (options) {

            return this._generic(options, function (options, activity) {
                var deferred = activity.deferred(),
                    message = options.selector,
                    lastBarcode = execState.context.barcode().unwrap();
                if (lastBarcode)
                    message += '\r\n' + resourcesMobile.ScanToConfirm;

                function scanToConfirm(e) {
                    var confirmed = e.text === lastBarcode;
                    setTimeout(function () {
                        if (confirmed)
                            _app.action({ path: 'form/submit' });
                        else
                            history.go(-1);
                    });
                    return false;
                }

                $document.on('barcodebefore.app', scanToConfirm);
                enableSystemUI(true);
                _touch.whenPageShown(disableSystemUIAndEnableBarcodeInputInKiosk);

                _app.confirm(message).then(function () {
                    $document.off('barcodebefore.app', scanToConfirm);
                    deferred.resolve();
                }).fail(function () {
                    $document.off('barcodebefore.app', scanToConfirm);
                    deferred.reject();
                });
                return deferred;
            });
        },
        key: function (options) {
            if (typeof options == 'string')
                options = { in: options };
            return this._generic(options, function (options) {
                var result,
                    dataView = optionsToDataView2(options),
                    key;
                if (dataView) {
                    key = dataView.get_selectedKey();
                    if (key.length)
                        if (key.length === 1)
                            result = key[0];
                        else
                            result = key;
                }
                return result;
            });
        },
        unwrap: function () {
            var deferred = this.deferred();
            //, result;
            //if (deferred.state() !== 'resolved')
            //    return null;

            //$.when(synced, deferred).then(function (v) {
            //    result = v;
            //});
            //return result;

            return deferred.state() === 'resolved' ? this._resolvedArgs : deferred;
        },
        toString: function () {
            return this.unwrap();
        }
    };

    //
    // ActivityApp class allows controlling the Touch UI application
    // 

    app = {
        if: function () {
            execState.ifResult = null;

            var result = true,
                deferred = $.Deferred(),
                pending = [];

            function resolve() {
                execState.context._andNot = null;
                execState.ifResult = true;
                deferred.resolve();
            }

            function reject() {
                execState.ifResult = false;
                deferred.reject();
            }

            for (var i = 0; i < arguments.length; i++) {
                var test = arguments[i];
                if (test instanceof ActivityContext) {
                    if (test.deferred(':rejected')) {
                        result = false;
                        break;
                    }
                    //else if (test.deferred(':pending'))
                    //    pending.push(test.deferred());
                    else {
                        var testPending = test.pending();
                        if (testPending.length)
                            pending = pending.concat(testPending);
                    }
                }
                else if (test && test.promise)
                    pending.push(test);
                else if (typeof test == 'function') {
                    var funcResult = test();
                    if (funcResult && funcResult.promise)
                        pending.push(funcResult);
                    else if (!funcResult) {
                        result = false;
                        break;
                    }
                }
                else if (!test) {
                    result = false;
                    break;
                }
            }
            if (result)
                if (pending.length)
                    $.when.apply($, pending).then(function () {
                        for (var i = 0; i < pending.length; i++) {
                            if (pending[i].state() !== 'resolved') {
                                result = false;
                                break;
                            }
                        }
                        if (result)
                            resolve();
                        else
                            reject();
                    }).fail(function () {
                        reject();
                    });
                else
                    resolve();
            else
                reject();
            return deferred.promise();
        },
        resolve: function () {
            iftttDone();
            return $.when(true);
        },
        reject: function () {
            iftttFail();
            return $.when(true);
        },
        discard: function (options) {
            var rootId = $('.app-ui-automation-root').attr('id');
            execState.error = options;
            execState.discarding = true;
            return app._exec(function (deferred) {

                function goBack() {
                    var dataView = _touch.dataView(),
                        parentDataViewId;
                    if (dataView) {
                        if (dataView._id === rootId) {
                            kioskChanged({ dataView: dataView });
                            execState.discarding = false;
                            deferred.resolve();
                            if (appDeferred)
                                appDeferred.resolve();
                        }
                        else {
                            parentDataViewId = dataView._parentDataViewId;
                            if (parentDataViewId)
                                kioskChanged({ dataView: findDataView(parentDataViewId) });
                            if (dataView.get_isForm())
                                dataView.tag('discard-changes-prompt-none');
                            _touch.goBack(goBack);
                        }
                    }
                    else
                        deferred.resolve();
                }

                goBack();
                return false;
            });
        },
        notify: function (options, duration) {
            if (options instanceof ActivityContext)
                options = options.unwrap();
            if (typeof options != 'object')
                options = { text: options, force: true, duration: duration };
            return app._exec(function () {
                notify(options);
            });
        },
        _wait: function (options) {
            if (options.resolve)
                options = { deferred: options, attempts: 0 };
            var deferred = options.deferred,
                readingBarcodes = isReadingBarcodes();
            if (appIsBusy() || readingBarcodes) {
                if (readingBarcodes && !options.notified) {
                    if (execState.confirmed)
                        execState.confirmed = false;
                    else if (_input.barcode().length) {
                        notify(resourcesMobile.Reading, true, 30000);
                        options.notified = true;
                    }
                }
                options.attempts++;
                setTimeout(app._wait, execSpeed, options);
            }
            else {
                if (options.notified)
                    notify(false);
                try {
                    deferred.resolve();
                }
                catch (ex) {
                    iftttDone(ex);
                }
            }
        },
        _exec: function (callback) {
            var deferred = $.Deferred(),
                options = arguments.length > 1 && arguments[0];
            if (options)
                optionsToDataView(options, deferred, true, arguments[1]);
            else if (callback(deferred) !== false)
                if (execState.error)
                    deferred.reject();
                else
                    setTimeout(app._wait, execSpeed, deferred);
            return deferred.promise();
        },
        error: function (options) {
            if (arguments.length) {
                if (typeof options == 'object' && options.message)
                    options = options.message + '\n' + options.stack;
                if (typeof options == 'string')
                    options = { error: options };
                if (execState)
                    execState.error = options.error;
            }
            else
                return execState.error;
        },
        action: function (options, target) {
            options = normalizeOptions(options, arguments, 2);
            return app._exec(options, function (dataView) {
                var item = findItemInContextOf(dataView, options),
                    callback = item && item.callback;
                if (callback)
                    callback(item.context);
                else
                    app.error('app.action: "' + options.selector + '" is not available in the context' + (options.in ? ' "' + options.in + '"' : '') + '.');
            });
        },
        _countBarcodes: function (barcode) {
            var result = 1,
                queue;
            if (barcode != null) {
                if (barcode instanceof ActivityContext)
                    barcode = barcode.unwrap();
                queue = _input.barcode();
                i = 0;
                while (i < queue.length && queue[i++] === barcode)
                    result++;
                queue.splice(0, result - 1);
            }
            return result;
        },
        inc: function (options, barcode) {
            options = normalizeOptions(options);
            var field = optionsToField(options),
                data, v,
                method = options._method || 'inc';
            if (field) {
                data = field._dataView.data();
                options = field.Name;
                v = data[options];
                if (v == null)
                    v = 0;
                v += app._countBarcodes(barcode) * (method === 'inc' ? 1 : -1);
                return app.val(options, v);
            }
            else
                app.error('app.' + method + ': Failed to change ' + objectToPrettyString(options));
        },
        dec: function (options, barcode) {
            arguments[0] = options = normalizeOptions(options);
            options._method = 'dec';
            return app.inc.apply(app, arguments);
        },
        val: function (options, value) {
            options = normalizeOptions(options, arguments);
            delete options.in;
            return app._exec(function (deferred) {
                var field = optionsToField(options), field2,
                    dataView,
                    inputValues = [],
                    badFields = [],
                    lookupMap = {},
                    pendingLookup = [];

                function ExtendLookupInfo(lookupInfo, targetField, sourceField) {
                    lookupInfo.map[targetField] = sourceField;
                    lookupInfo.reverseMap[sourceField] = targetField;
                    lookupMap[targetField] = lookupInfo;
                }

                function broadcastValues(resolve) {
                    _input.execute(inputValues);
                    if (resolve !== false)
                        deferred.resolve(inputValues);
                }

                if (field) {
                    dataView = field._dataView;
                    if (options._extended.mapped) {
                        for (var propName in options) {
                            if (mappedExceptions.indexOf(propName) < 0) {
                                field2 = optionsToField(normalizeOptions({ selector: propName }));
                                if (field2)
                                    inputValues.push({ field: field2, value: options[propName] });
                                else
                                    badFields.push('"' + propName + '"');
                            }
                        }
                    }
                    else
                        inputValues.push({ field: field, value: options.value });
                    // resolve ActivityContext values
                    inputValues.forEach(function (fv) {
                        if (fv.value instanceof ActivityContext)
                            $.when(fv.value.deferred()).done(function (newValue) {
                                fv.value = newValue;
                            });
                    });
                    if (!badFields.length) {
                        // enumerate lookup info
                        dataView._allFields.forEach(function (f) {
                            if (f.ItemsStyle && f.ItemsDataController) {
                                var lookupInfo = { field: f, map: {}, reverseMap: {} },
                                    copy = f.Copy, m,
                                    iterator = _app._fieldMapRegex;
                                ExtendLookupInfo(lookupInfo, f.Name, f.ItemsDataValueField);
                                ExtendLookupInfo(lookupInfo, dataView._allFields[f.AliasIndex].Name, f.ItemsDataTextField);
                                if (copy) {
                                    m = iterator.exec(copy);
                                    while (m) {
                                        ExtendLookupInfo(lookupInfo, m[1], m[2]);
                                        m = iterator.exec(copy);
                                    }
                                }
                            }
                        });
                        // initiate reverse data lookup 
                        inputValues.forEach(function (fv) {
                            var lookupInfo = lookupMap[fv.field.Name],
                                field, itemsDataController, itemsDataView, filter = {},
                                lookupArgs, lookupArgsString;
                            if (lookupInfo && !lookupInfo.pending) {
                                field = lookupInfo.field;
                                itemsDataController = field.ItemsDataController;
                                ItemsDataView = field.ItemsDataView;
                                inputValues.forEach(function (fv2) {
                                    if (lookupMap[fv2.field.Name] === lookupInfo)
                                        filter[lookupInfo.map[fv2.field.Name]] = fv2.value;
                                });

                                lookupArgs = {
                                    controller: itemsDataController,
                                    filter: filter,
                                    odp: true
                                };
                                if (itemsDataView)
                                    lookupArgs.view = itemsDataView;

                                lookupArgsString = objectToPrettyString(lookupArgs);

                                lookupInfo.pending = _app.execute(lookupArgs).done(function (result) {
                                    var data = result[itemsDataController],
                                        source;
                                    if (data && data.length)
                                        for (source in lookupInfo.reverseMap)
                                            inputValues.push({ field: lookupInfo.reverseMap[source], value: data[0][source] });
                                    else {
                                        app.error('app.val: failed to lookup \n' + lookupArgsString);
                                        deferred.reject(inputValues);
                                    }

                                });
                                pendingLookup.push(lookupInfo.pending);
                            }
                        });

                        if (pendingLookup.length) {
                            $.when.apply($, pendingLookup).done(broadcastValues).fail(function (error) {
                                inputValues.forEach(function (fv) {
                                    var name = fv.field.Name;
                                    if (name)
                                        fv.field = name;
                                });
                                app.error('app.val: failed to lookup - ' + error.get_message() + '\n' + objectToPrettyString(inputValues));
                                deferred.reject(inputValues);
                            });
                            return false;
                        }
                        else
                            broadcastValues(false);
                    }
                }
                else
                    badFields.push('"' + options.selector + '"');
                if (badFields.length)
                    app.error('app.val: ' + badFields.join(', ') + ' not found.');
            });
        },
        focus: function (options, message) {
            options = normalizeOptions(options);
            if (arguments.length > 1)
                options.message = message;
            else
                message = options.message;
            return app._exec(function (deferred) {
                var field = optionsToField(options);
                if (field) {
                    field = field._dataView._allFields[field.OriginalIndex];
                    if (field.Type !== 'DataView')
                        enableSystemUI(true);
                    _input.focus({ field: field, message: message });
                    enableSystemUI();
                }
                else
                    app.error('app.focus: field ' + options.selector + ' not found.');
            });
        },
        confirm: function (message) {
            var lastBarcode = execState.context.barcode().unwrap(),
                confirmed,
                queue;

            if (lastBarcode) {
                queue = _input.barcode();
                if (queue.length) {
                    confirmed = true;
                    while (queue[0] === lastBarcode)
                        queue.splice(0, 1);
                }
            }
            return app._exec(function (deferred) {
                if (confirmed)
                    return true;

                function scanToConfirm(e) {
                    var confirmed = e.text === lastBarcode;
                    execState.confirmed = true;
                    setTimeout(function () {
                        if (!_touch.isInTransition())
                            if (confirmed)
                                _app.action({ path: 'form/submit' });
                            else
                                history.go(-1);
                    });
                    return false;
                }

                enableSystemUI(true);
                _touch.whenPageShown(disableSystemUIAndEnableBarcodeInputInKiosk);

                if (lastBarcode) {
                    $document.on('barcodebefore.app', scanToConfirm);
                    message += '\n\n' + resourcesMobile.ScanToConfirm;
                }

                _app.confirm(message)
                    .then(function () {
                        $document.off('barcodebefore.app', scanToConfirm);
                        deferred.resolve(message);
                    })
                    .fail(function () {
                        $document.off('barcodebefore.app', scanToConfirm);
                        app.resolve();
                        deferred.reject(message);
                    });
                return false;
            });
        },
        row: function (options, value, target) {
            options = normalizeOptions(options, arguments);
            return app._exec(function (deferred) {
                var extended = options._extended,
                    methodName = extended.method || 'row',
                    isFilterMethod = methodName === 'filter',
                    filter = optionsToFilter(options, methodName),
                    dataView,
                    dataViewFieldName,
                    filterString, data;

                function focusDataViewField() {
                    _input.focus({ field: dataViewFieldName });
                }

                if (!filter)
                    return false;
                filterString = JSON.stringify(filter);
                data = execState.input[filterString];
                if (!data && isFilterMethod)
                    data = {};
                if (data) {
                    dataView = optionsToDataView2(options);
                    if (dataView) {
                        syncDataView(dataView, data, filter, extended);
                        dataViewFieldName = dataView._dataViewFieldName;
                        if (dataViewFieldName)
                            if (dataView._busy())
                                $document.one('dataviewrefresh.app', focusDataViewField);
                            else
                                focusDataViewField();
                    }
                    return dataView;
                }
                else
                    app.error('app.' + methodName + ': This method requires a data row in the input.\n Specify \'app.if(context.row(' + filterString + '))\' in the activity. Use the same filter when invoking \'' + methodName + '\' method.');
            });
        },
        rowFilter: function (options, value, target) {
            options = normalizeOptions(options, arguments);
            options._extended.method = 'rowFilter';
            options._extended.filter = true;
            return this.row(options);
        },
        filter: function (options, value, target) {
            options = normalizeOptions(options, arguments);
            options._extended.method = 'filter';
            options._extended.filter = true;
            return this.row(options);
        },
        input: function (options, value) {
            var props = options;
            if (props == null)
                props = {};
            if (typeof options != 'object') {
                props = {};
                props[options] = value;
            }
            for (var key in props) {
                var v = props[key];
                execState.input[key] = v;
                if (key === 'numpad' && _kiosk)
                    setNumPadText(v);
            }
        },
        display: function (options) {
            var deferred = $.Deferred();

            function resolve() {
                deferred.resolve();
            }

            function reject(error) {
                app.error('app.display: ' + error);
                deferred.reject();
            }

            if (arguments.length) {
                if (_display && options === _display.data('display'))
                    if (_display.is(':visible'))
                        resolve();
                    else
                        _display.fadeIn('fast', resolve);
                else {
                    var error,
                        isVisible = _kiosk != null;
                    if (uiAutomationSettings('kiosk.enabled') !== false) {
                        _touch.kiosk(true);
                        _display.empty().data('display', options);
                        error = kioskDisplay(options);
                        if (isVisible) {
                            _display.hide();
                            _display.fadeIn('fast');
                        }
                        else {
                            _kiosk.hide();
                            _kiosk.fadeIn('fast');
                        }
                        if (error)
                            reject(error);
                        else
                            resolve();
                    }
                    else
                        resolve();
                }
            }
            else
                reject('Missing display configuration.');
            return deferred.promise();
        },
        page: function (options) {
            var identifier = options.identifier,
                result;

            function findNode(nodes) {
                nodes.every(function (n) {
                    var title = n.title;
                    if (identifier) {
                        if (n.url === _app.resolveClientUrl(identifier))
                            result = n;
                    }
                    else if (title != null)
                        try {
                            if (title.match(options.regex))
                                result = n;
                        }
                        catch (ex) {
                            // ignore exception
                        }
                    if (!result && n.children)
                        findNode(n.children)
                    return !result;
                });
            }
            options = normalizeOptions(options);
            identifier = options.identifier;
            findNode(Web.Menu.nodes);
            if (result && result.url)
                location.href = result.url;
            return result;
        }
    };

    function kioskInit() {
        var userName = $app.userName(),
            userAvatar = $span('app-avatar').attr('data-title', userName).appendTo(_kiosk),
            currentNode = Web.Menu.currentNode,
            copyright = uiAutomationSettings('kiosk.copyright'),
            logo,
            buttonAnchor, buttonRight;

        logo = $span('app-logo').appendTo(_kiosk).html(_touch.appName());
        if (currentNode)
            //_touch.icon('material-icon-chevron-right', $span('app-page-title').appendTo(logo.attr('data-title', currentNode.description)).text(currentNode.title));
            $span('app-page-title').appendTo(logo.attr('data-title', currentNode.description)).text(currentNode.title);

        $span('app-btn-menu ui-btn ui-btn-icon-notext ui-btn-left ui-icon-bars"').appendTo(_kiosk).attr('data-title', resourcesMobile.Menu);
        buttonAnchor = $span('app-btn-context ui-btn ui-btn-icon-notext ui-btn-left ui-icon-bars"').appendTo(_kiosk).attr('data-title', resourcesMobile.More);


        _app.AccountManager.avatar(userName, $i('app-icon-avatar').text(_touch.initials(_app.userName())).appendTo(userAvatar));
        if (_app.userName())
            buttonAnchor = userAvatar;
        else {
            userAvatar.hide();
            if (!$body.data('public'))
                $span('app-login ui-btn').appendTo(_kiosk).attr('data-title', Web.MembershipResources.Bar.LoginLink);
        }


        _display = $div('app-display').appendTo(_kiosk);
        if (copyright !== false)
            $div('app-copyright app-acc-footer').appendTo(_kiosk.addClass('app-has-copyright')).html(copyright || $('#PageFooterBar,footer small').html());
        buttonRight = _kiosk.width() - buttonAnchor.offset().left - 28;
        for (var i = 1; i < 3; i++) {
            buttonRight += 50;
            $span('ui-btn ui-btn-icon-notext ui-btn-left app-btn app-btn' + i, htmlTag('i', 'app-icon material-icon')).css('right', buttonRight).appendTo(_kiosk).hide();
        }
    }

    //function kioskInitAppButtons() {
    //    var buttonAnchor = _kiosk.find('.app-avatar,.app-btn-context');
    //    buttonRight = buttonAnchor.first().offset().left;
    //    _kiosk.find('> .app-btn').each(function (index) {
    //        buttonRight -= 50;
    //        $(this).css.left
    //    });
    //}

    function kioskResize(doResize) {
        if (_display)
            if (doResize === true) {
                var displayConfig = _display.data('config'),
                    dummyList;
                if (navigator.userAgent.match(/Edge/))
                    dummyList = $('.app-kiosk > .ui-btn,.app-kiosk > .app-logo').hide();
                resizeKioskForVirtualScreen();
                _display.empty();
                kioskDisplay(displayConfig);
                if (dummyList)
                    dummyList.show();
            }
            else {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(kioskResize, 200, true);
            }
    }

    function kioskChanged(e) {
        if (_display) {
            if (e) {
                var id = e.dataView._id,
                    index = dataViewChangeMonitor.indexOf(id);
                if (index === -1)
                    dataViewChangeMonitor.push(e.dataView._id);
                setTimeout(kioskChanged); // exit the external event handler 
            }
            else {
                if (appIsBusy()/* || isReadingBarcodes()*/)
                    setTimeout(kioskChanged, execSpeed);
                else if (dataViewChangeMonitor.length)
                    kioskBind();
            }
        }
    }

    function _expandCollapse_format(v) {
        return '&nbsp;<i class="app-icon material-icon" aria-hidden="true">expand_' + (v ? 'less' : 'more') + '</i >';
    }

    function _expandCollapse_toColumns() {
        return 8;
    }

    function _lineNumber_format(v) {
        return v.toString();
    }

    function _lineNumber_toColumns() {
        return this._config.columns || 8;
    }

    function _data_binding(data, dataView) {
        if (data) {
            data._dataView = dataView;
            data.val = dataView ? _data_val : null;
        }
    }

    function _data_val(selector) {
        var data = this,
            dataView = data._dataView,
            regex,
            propName;
        if (selector)
            if (selector.match(/^@/))
                selector = selector.substring(1);
            else
                regex = selector instanceof RegExp ? selector : toSelectorRegex(selector);
        dataView._allFields.every(function (f) {
            if (regex && f.HeaderText.match(regex) || f.Name === selector)
                propName = f.Name;
            return !propName;
        });
        return data[propName];
    }

    function configIsList(config) {
        var inDataView = config._inDataView;
        return config._hasFields && !inDataView.get_isForm() && config._count > 1;
    }

    function getScrollbarInfo(element) {
        return { width: element[0].offsetWidth - element[0].clientWidth + 1, height: element[0].offsetHeight - element[0].clientHeight + 1 };
    }

    function createContainerContent(container, height) {
        var autoSize = height === 'fill',
            content;
        if (height != null) {
            content = $div('app-container-content').attr('tabindex', 0).appendTo(container.toggleClass('app-container-autosize', autoSize));
            content.css({
                'margin-right': content[0].clientWidth - content[0].offsetWidth - 1 - parseInt(container.css('paddingRight')),
                'height': !autoSize && height !== false ? height : null
            });
        }
        return content;
    }

    function isButton(displayObj) {
        var perform = displayObj.perform;
        return 'barcode' in displayObj || (perform && (typeof perform == 'function' || perform.show || perform.hide || typeof perform.pick == 'string'));
    }


    function numPad(displayObj) {
        var html = [],
            buttons = uiAutomationSettings('numPad.buttons'),
            label = displayObj.label;
        if (!buttons) {
            buttons = standardNumPadButtons;
            if (displayObj.compact) {
                buttons = JSON.parse(JSON.stringify(buttons));
                buttons[1][3] = buttons[3][2];
                buttons[2][3] = buttons[4][0];
                buttons[2][3].tall = true;
                buttons.splice(buttons.length - 1);
            }
        }
        html.push('<div class="app-numpad">');
        if (label)
            html.push('<div class="app-label">' + _app.htmlEncode(label) + '</div>');
        // html.push('<div class="app-text app-null"><span class="app-value"/><i class="app-icon material-icon" aria-hidden="true" title="' + resourcesMobile.ClearText + '" data-key="Clear">clear</i></span></div>');
        html.push('<div class="app-text app-null"><span class="app-value"></span><i class="app-icon material-icon" aria-hidden="true" title="' + resourcesMobile.ClearText + '" data-key="Clear">clear</i></div>');
        buttons.forEach(function (buttonRow) {
            var width = 0,
                isTallRow;
            buttonRow.forEach(function (btn) {
                width += btn.width || 1;
                if (btn.tall)
                    isTallRow = true;
            });
            html.push('<div class="app-row' + (isTallRow ? ' app-tall' : '') + '">');
            buttonRow.forEach(function (btn) {
                var icon = btn.icon,
                    fontSize = btn.font,
                    btnKey = btn.key,
                    btnTest = btn.test;
                if (typeof btnKey == 'function')
                    btnKey = btnKey();
                if (btnTest)
                    numPadKeyTests.push(btnTest);
                html.push('<span class="app-btn app-feedback' + (btn.accent ? ' app-accent' : '') + (btn.dark ? ' app-dark' : '') + (btn.tall ? ' app-tall' : '') +
                    '" style="width:' + (btn.width || 1) / width * 100 + '%;' + (fontSize ? 'font-size:' + fontSize + ';' : '') + '"' +
                    ' data-key="' + btnKey + '"' +
                    (btnTest ? ' data-test="' + (numPadKeyTests.length - 1) + '"' : '') +
                    '>');
                html.push(icon ? '<i class="app-icon material-icon" aria-hidden="true">' + icon + '</i>' : btn.text || btnKey);
                html.push('</span>');
            });
            html.push('</div>');
        });
        html.push('</div>');
        return html.join('');
    }

    // display flow API

    _app.display = function (options) {

        function flowChanged() {
            var saveScrollTop = wrapper.scrollTop(),
                restoreScrollTop = (lastBreakpoint != null || lastWindowHeight != null) && saveScrollTop > 0,
                centerContainer, centerContainerIndex, centerContainerDelta;
            if (restoreScrollTop) {
                centerContainer = elementAt(
                    wrapper.offset().left + wrapper.width() / 2,
                    wrapper.offset().top + 32
                ).closest('.app-container,.app-row-container,.app-sticky-hero-container').first();
                if (centerContainer.length) {
                    if (!centerContainer.is('.app-container'))
                        centerContainer = centerContainer.find('.app-container').first();
                    if (centerContainer.length) {
                        centerContainerIndex = centerContainer.attr('data-index');
                        centerContainerDelta = centerContainer.offset().top - wrapper.offset().top;
                    }
                }
            }
            var selectedContainers = [],
                cutContainers = [];
            pageContent.find('.app-container-selected').each(function () {
                selectedContainers.push($(this).attr('data-index'));
            });
            pageContent.find('.app-container-cut').each(function () {
                cutContainers.push($(this).attr('data-index'));
            });
            displayFlow(options.flow, wrapper, pageContent.empty(), null, _touch.toWidth(logicalWidthArray[displayBreakpoint]));
            if (restoreScrollTop) {
                if (centerContainerIndex) {
                    centerContainer = pageContent.find('.app-container[data-index="' + centerContainerIndex + '"]');
                    if (centerContainer.length) {
                        wrapper.scrollTop(centerContainer.offset().top - wrapper.offset().top - centerContainerDelta);
                        restoreScrollTop = false;
                    }
                }
                if (restoreScrollTop)
                    wrapper.scrollTop(saveScrollTop);
            }
            containerContentAutoSize(wrapper, pageContent, true);
            selectedContainers.forEach(function (index) {
                pageContent.find('.app-container[data-index="' + index + '"]').addClass('app-container-selected');
            });
            cutContainers.forEach(function (index) {
                pageContent.find('.app-container[data-index="' + index + '"]').addClass('app-container-cut');
            });
            if (selectedContainers.length)
                _app.display.designer.selectionChanged();
        }

        if (!arguments.length) {
            options = [
                {
                    flow: 'row',
                    content: '.app-page-content > *'
                }
            ];
        }

        if (options === 'designer')
            _app.getScript('~/js/daf/touch-flow', function () {
                _app.display.designer.attach();
            });
        else if (Array.isArray(options))
            $document.one('displayflow.app', function (e) {
                if (typeof options == 'string')
                    options = [{ content: options }];
                var page = e.page,
                    wrapper = e.content,
                    contentMap = {},
                    flowDef = { flow: options };
                displayFlowDataViewId = page.attr('id');
                options.forEach(function (displayObj) {
                    var content = displayObj.content,
                        html, content;
                    if (content != null) {
                        displayObj.isContent = true;
                        if (content.match(/^(#|\.)[\w-]+/)) {
                            html = contentMap[content];
                            if (html == null) {
                                html = [];
                                page.find(content).each(function () {
                                    html.push(this.innerHTML);
                                });
                                //if (physicalPage.is(page))
                                //    content.remove()
                                html = contentMap[content] = html.join('');
                            }
                            displayObj.content = html;
                        }
                    }
                    if (displayObj.hero)
                        flowDef.trackHeight = true;
                });
                var content = wrapper.data('displayFlow', flowDef).find('.app-page-content').addClass('app-display-flow');
                if (content.attr('data-editable'))
                    wrapper.data('originalFlow', JSON.stringify(options));
            });
        else {
            var wrapper = $(options),
                pageContent,
                logicalWidth,
                windowHeight = _touch.screen().height,
                lastBreakpoint, lastWindowHeight,
                newFlow;
            options = options.data('displayFlow');
            if (options/* && !(uiAutomation() && appIsBusy())*/) {
                logicalWidth = _touch.toWidth(wrapper.width());
                pageContent = wrapper.find('.app-page-content');
                displayBreakpoint = Math.min(logicalWidthArray.indexOf($body.data('content-width') || _touch.settings('ui.content.width') || 'xl'), logicalWidthArray.indexOf(logicalWidth));
                newFlow = arguments[1];
                if (Array.isArray(newFlow)) {
                    options.flow = JSON.parse(JSON.stringify(newFlow));
                    options.trackHeight = false;
                    newFlow.every(function (displayObj) {
                        var hero = displayObj.hero;
                        if (hero)
                            options.trackHeight = true;
                        return !hero;
                    });
                }
                else {
                    lastBreakpoint = options.breakpoint;
                    lastWindowHeight = options.lastHeight;
                }
                if (lastBreakpoint !== displayBreakpoint || lastWindowHeight !== windowHeight) {
                    options.breakpoint = displayBreakpoint;
                    options.lastHeight = windowHeight;
                    flowChanged();
                }
            }
        }
    };

    _app.display.as = {
        code: {
            render: function (displayObj, flowAs, container) {
                var sourceCode = displayObj.content,
                    editorSourceCode,
                    gutter,
                    lines = [], i,
                    gutter,
                    gutterRect,
                    caption,
                    codeTypeMap = {
                        html: 'HTML',
                        js: 'JavaScript',
                        javascript: 'JavaScript',
                        css: 'CSS',
                        xml: 'XML',
                        'c#': 'C#',
                        csharp: 'C#',
                        vb: 'Visual Basic',
                        visualbasic: 'Visual Basic'
                    };
                if (typeof flowAs == 'string')
                    flowAs = { type: flowAs };
                caption = $div('app-caption').appendTo(container);
                $span('app-type').text(codeTypeMap[flowAs.type] || flowAs.type).appendTo(caption);
                if (displayObj._header1)
                    $span('app-text').text(displayObj._header1).appendTo(caption);
                $(sourceCode).appendTo(container.addClass('app-render-as-code'))

                var code = container.find('code').first(),
                    editor,
                    mode = flowAs.type;
                if (mode.match(/javascript/i))
                    mode = "text/javascript";
                else if (mode.match(/c#|csharp/i))
                    mode = 'text/x-csharp';
                else if (mode.match(/html/i))
                    mode = {
                        name: "htmlmixed",
                        scriptTypes: [{
                            matches: /\/x-handlebars-template|\/x-mustache/i,
                            mode: null
                        }/*,
                            {
                                matches: /(text|application)\/(x-)?vb(a|script)/i,
                                mode: "vbscript"
                                }*/
                        ]
                    };
                editorSourceCode = code.text(); // get the source code without encoding
                if (typeof CodeMirror == 'undefined') {
                    for (i = 1; i <= (sourceCode.match(/\n/g) || '').length + 1; i++)
                        lines.push('<div class="app-line">' + i + '</div>');
                    gutter = $div('app-gutter').html(lines.join('')).appendTo(code);
                    gutter.width(gutter.width() + 1);
                    gutterRect = getBoundingClientRect(gutter);
                    code.css('padding-left', Math.floor(gutterRect.width) + 4);
                    //caption.css('padding-left', Math.floor(gutterRect.width) + 4);
                }
                //return;
                _app.getScript('~/js/lib/codemirror.min.js', {
                    also: '~/js/lib/codemirror.min.css',
                    then: function () {
                        caption.detach();
                        editor = $div().appendTo(container.empty());
                        caption.insertBefore(editor);
                        CodeMirror(editor[0], {
                            lineNumbers: true,
                            tabSize: 4,
                            matchBrackets: true,
                            readOnly: true,
                            mode: mode,
                            scrollbarStyle: null,
                            value: editorSourceCode
                        });
                    }
                });
            }
        }
    };

    function displayFlow(displayConfig, display, displayContent, scrollbarInfo, rowWidth) {
        var error;
        if (!display.data('created')) {
            display.data('created', new Date());
            displayConfig.forEach(function (config) {
                delete config._lastResult;
            });
        }

        // reset breakpoint properties
        configIterator(displayConfig, function (displayGroup) {
            alterDisplayObject(displayGroup);
            configIterator(displayGroup, function (displayObj) {
                alterDisplayObject(displayObj);
            }, false);
        }, false);

        var dataView = appDataView(),
            currentContainer = displayContent,
            currentRow, currentRowParent, currentTabHeader, currentTab, currentTabText, currentTabContent,
            currentHero, currentHeroId, currentHeroDef,
            displayHeight = display.height();

        function heroComplete() {
            if (currentHeroId) {
                var hero = currentHero.parent(),
                    stickyHeroContainer,
                    heroHeight = hero.outerHeight(),
                    isFullHeight = heroHeight <= displayHeight && !_app.agent.ie,
                    icon = hero.find('h1>.material-icon,h2>.material-icon,h3>.material-icon,h4>.material-icon,h5>.material-icon,h6>.material-icon').first(),
                    iconDef = currentHeroDef.icon,
                    iconSize;
                if (isFullHeight) {
                    if (!hero.is('.app-align-top,.app-align-bottom'))
                        hero.addClass('app-align-center');
                    heroHeight = displayHeight - (heroHeight - currentHero.outerHeight(true));
                    hero.height(heroHeight);
                }
                currentHeroId = null;
                if (iconDef !== false) {
                    iconSize = Math.min(hero.width(), hero.height());
                    if (typeof iconDef == 'string')
                        $i('material-icon').text(iconDef).insertBefore(currentHero).css({ 'transform': 'scale(' + iconSize / 24 + ')', right: iconSize / 2 });
                    else if (icon.length)
                        icon = icon.clone().insertBefore(currentHero).css('transform', 'scale(' + iconSize * .6 / 24 + ')');
                }
                if (isFullHeight && currentHeroDef.sticky) {
                    stickyHeroContainer = $div('app-sticky-hero-container').insertBefore(hero);
                    hero.appendTo(stickyHeroContainer).addClass('app-spacing-none app-hero-sticky')
                        .find('.app-hero-content').appendTo(
                            $div('app-hero')
                                .toggleClass('app-spacing-none', currentHeroDef.spacing === false)
                                .height(heroHeight).appendTo(stickyHeroContainer)
                        );
                }
            }
        }

        // update the layout of dislay configuration
        configUpdateLayout(displayConfig, display);
        displayConfig.forEach(function (config, index) {
            var inSelector = config.in,
                inDataView,
                background = config.background,
                hasFluidBackground = background && background.fluid,
                isFluid = config.fluid,
                isJumbo = config.jumbo,
                heroDef = config.hero,
                heroId,
                heroBackground;

            if (heroDef != null) {
                heroDef = typeof heroDef == 'object' ? heroDef : { id: heroDef };
                if (!('id' in heroDef))
                    heroDef.id = true;
            }

            // find the container for this data view
            if (inSelector) {
                inSelector = optionsToField(normalizeOptions({ in: inSelector }));
                if (inSelector) {
                    inDataView = inSelector._dataView; //
                    config._inDataView = inDataView;
                }
                else
                    error = 'Invalid DataView field "' + config.in + '".';
            }
            else {
                inDataView = dataView;
                config._inDataView = dataView;
            }


            if (config.hidden)
                return;

            config._count = config.count || 10;

            // create display configuration containers with display objects
            if (config._newRow) {
                currentRowParent = hasFluidBackground ? $div('app-row-container').appendTo(displayContent) : displayContent;
                currentRow = $div('app-row').appendTo(currentRowParent);
                if (heroDef) {
                    heroId = heroDef.id;
                    heroBackground = heroDef.background;
                    if (heroId === true || heroId !== currentHeroId) {
                        heroComplete();
                        currentHeroDef = heroDef;
                        currentHeroId = heroId;
                        currentHero = $div('app-hero-content').appendTo(
                            $div('app-hero')
                                .toggleClass('app-spacing-none', heroDef.spacing === false)
                                .css('background-color', heroBackground ? heroBackground.color : null)
                                .appendTo(displayContent));
                        if (heroDef.align === 'top')
                            currentHero.parent().addClass('app-align-top');
                        if (heroDef.align === 'bottom')
                            currentHero.parent().addClass('app-align-bottom');
                    }
                    currentRow.appendTo(currentHero);
                    currentRowParent = currentHero;
                    if (heroBackground)
                        currentHero.parent().addClass('app-has-background').toggleClass('app-background-accent', heroBackground.accent === true);
                }
                else
                    heroComplete();
                if (rowWidth && !isFluid)
                    currentRow.css({ maxWidth: rowWidth, minWidth: rowWidth, marginLeft: 'auto', marginRight: 'auto' });
                if (isJumbo)
                    (hasFluidBackground && !heroDef ? currentRowParent : currentRow).addClass('app-jumbo').toggleClass('app-spacing-none', config.spacing === false);
                if (background)
                    (hasFluidBackground && !heroDef ? currentRowParent : currentRow).addClass('app-has-background').toggleClass('app-background-accent', background.accent === true).css('background-color', background.color);
            }
            if (config._newCol) {
                currentContainer = $div('app-column').appendTo(currentRow);//setWidth(div('app-column'), config._width).appendTo(currentRow);
                var containerWidth = config._width,
                    singleColumnRowWidth;
                if (config.isContent && rowWidth && containerWidth < 1 && config._newRow && (index === displayConfig.length - 1 || displayConfig[index + 1]._newRow)) {
                    singleColumnRowWidth = rowWidth * containerWidth;// - (currentRow.outerWidth() - currentRow.width());
                    if (config.fluid)
                        setWidth(currentRow, containerWidth).css({ marginLeft: 'auto', marginRight: 'auto' });
                    else
                        currentRow.css({ width: singleColumnRowWidth, minWidth: singleColumnRowWidth, maxWidth: singleColumnRowWidth });
                    setWidth(currentContainer, 1);
                }
                else
                    setWidth(currentContainer, containerWidth);
                if (!config._newRow && background)
                    currentContainer.addClass('app-has-background').toggleClass('app-background-accent', background.accent === true).css('background-color', background.color);
            }
            var appendTo = config.append ? currentContainer.find('.app-container:last') : null,
                container = appendTo ?
                    appendTo.length ? appendTo : currentContainer :
                    $div('app-container').attr('data-index', index).appendTo(currentContainer).data(config).toggleClass('app-spacing-none', config.spacing === false),
                content,
                containerHeader,
                configTab = config.tab,
                configLabel = configTab || config.label,
                headerText,
                height = config.height;

            if (config.readOnly && !appendTo)
                container.attr('data-read-only', 'true');

            // create the container tab/label
            if (configTab) {
                if (currentTabHeader)
                    containerHeader = currentTabHeader;
            }
            else {
                currentTabHeader = null;
                currentTabText = null;
            }
            if (configLabel != null) {
                if (!containerHeader)
                    containerHeader = $div('app-header').appendTo(container);
                if (configTab != null && configTab === currentTab && currentTabText) {
                    headerText = currentTabText;
                    currentTabContent = currentTabText.data('tab');
                }
                else {
                    headerText = $div('app-text').text(configLabel).data('config', config).appendTo(containerHeader);
                    if (configTab != null) {
                        currentTabContent = [];
                        currentTabText = headerText.data('tab', currentTabContent);
                    }
                }
                if (configTab != null) {
                    currentTab = configTab;
                    currentTabHeader = containerHeader.addClass('app-tabset');
                    currentTabText = headerText;
                    currentTabContent.push(container);
                }
            }
            // create display objects
            if (inDataView) {
                var items = [],
                    prevDisplayObj;
                configIterator(config, function (displayObj, name) {
                    var propType = displayObj.type,
                        field, isFieldOrExpression,
                        htmlContent;
                    //if (typeof displayObj == 'function')
                    //    displayObj = config[name] = displayObj.length > 1 ? { ifThisThenThat: displayObj } : { expression: displayObj };
                    if (displayObj.expression) {
                        config._hasFields = true;
                        isFieldOrExpression = true;
                    }
                    else if (!isButton(displayObj))
                        if (name === 'numpad')
                            htmlContent = numPad(displayObj);
                        else if (name === '#') {
                            if (!('tall' in displayObj))
                                displayObj.tall = prevDisplayObj ? prevDisplayObj.tall : true;
                            displayObj.field = { Name: '#', HeaderText: '#', Type: 'Int32', _config: displayObj, format: _lineNumber_format, toColumns: _lineNumber_toColumns };
                            isFieldOrExpression = true;
                        }
                        else if (name === '>') {
                            //if (!('tall' in displayObj))
                            displayObj.tall = prevDisplayObj ? prevDisplayObj.tall : true;
                            displayObj.field = { Name: '>', Type: 'Boolean', HtmlEncode: false, _config: displayObj, format: _expandCollapse_format, toColumns: _expandCollapse_toColumns };
                            displayObj.label = false;
                            isFieldOrExpression = true;
                        }
                        else {
                            field = propType === 'field' || !propType ? optionsToField(normalizeOptions(displayObj.clone || name), inDataView) : null;
                            if (field) {
                                displayObj.field = inDataView._allFields[field.AliasIndex];
                                config._hasFields = true;
                                isFieldOrExpression = true;
                            }

                            //if (!contextItem && !field) {
                            //    error = 'Unkown selector "' + propName + '" in ' + inDataView._id + '.';
                            //    break;
                            //}
                        }
                    if (displayObj.dense)
                        displayObj.density = 'condensed';
                    displayObj._label = displayObj.label != null ? displayObj.label : field ? field.HeaderText : name;
                    items.push({
                        html: htmlContent ? htmlContent :
                            '<div data-type="' +
                            (isFieldOrExpression ? 'field' : 'button') + '" data-name="' + name + '"' + (field ? ' data-field="' + field.Name + '"' : '') + '>' +
                            (isFieldOrExpression ? span('app-label') + span('app-value') : span('app-button app-feedback', span('app-text'))) +
                            '</div>',
                        obj: displayObj
                    });
                    prevDisplayObj = displayObj;
                });
                if (config._propCount) {
                    config._items = items;
                    if (configIsList(config)) {
                        var totalColumns = 0,
                            gridObjects = [],
                            columns,
                            headerRow;
                        configIterator(config, function (displayObj, name, index) {
                            var field = displayObj.field;
                            if (displayObj.flow && !(!index && displayObj.flow === 'row') || !field)
                                return false;
                            else {
                                displayObj._grid = true;
                                if (name === '>') {
                                    config.expand = true;
                                    config._expanded = displayStateInit(config, 'expanded', {});
                                }
                                //if (displayObj._label === false)
                                //    displayObj._label = displayObj.field ? displayObj.field.HeaderText : name;
                                gridObjects.push(displayObj);
                                columns = field.toColumns();
                                displayObj._columns = columns;
                                totalColumns += columns;
                            }
                        });
                        if (totalColumns) {
                            headerRow = $div('app-row-header').appendTo(container);
                            gridObjects.forEach(function (displayObj) {
                                var field = displayObj.field,
                                    label = displayObj._label;
                                displayObj._width = displayObj._columns / totalColumns;
                                $span('app-text').appendTo(setWidth($span('app-column-header'), displayObj._width).appendTo(headerRow)
                                    .attr('data-name', field.Name)
                                    .attr('data-type', field.Type)
                                    .toggleClass('app-field-type-numeric', field.Type.match(_app._numericTypeRegex) != null)
                                ).text(label !== false ? label : '');
                            });
                        }
                        configUpdateLayout(config, headerRow || container);
                        createContainerContent(container, height || false);
                        if (config.letters)
                            $div('app-letters').data('config', config).appendTo(container.addClass('app-has-letters'));
                        //content = div('app-container-content').attr('tabindex', 0).appendTo(container);
                        //content.css({
                        //    'margin-right': content[0].clientWidth - content[0].offsetWidth - 1,
                        //    'height': height != null && height !== 'fill' ? height : null
                        //});
                    }
                    else {
                        if (height != null) {
                            content = createContainerContent(container, height);
                            //content = div('app-container-content').attr('tabindex', 0).appendTo(container);
                            //content.css({
                            //    'margin-right': content[0].clientWidth - content[0].offsetWidth - 1,
                            //    'height': height != null && height !== 'fill' ? height : null
                            //});
                        }
                        else {
                            content = container;
                            if (appendTo) {
                                content = container.find('.app-container-content');
                                if (!content.length)
                                    content = container;
                            }
                        }
                        configUpdateLayout(config, content);
                        displayItemsInContainer(config, content);
                    }
                }
                else {
                    if (appendTo) {
                        content = container.find('.app-container-content');
                        if (content.length)
                            container = content;
                        container = $div().appendTo(container);
                    }
                    if (config.isContent) {
                        container = createContainerContent(container, config.height) || container;
                        var flowAs = config.as,
                            rendererImplementation,
                            rendererName;
                        parseContent(config)
                        container.css({ 'color': config.color, 'text-align': config.align });
                        if (flowAs) {
                            if (typeof flowAs == 'string')
                                if (flowAs.match(/c#|csharp|vb|visualbasic|html|javascript|json/i))
                                    flowAs = { code: flowAs };
                            for (rendererName in flowAs) {
                                rendererImplementation = _app.display.as[rendererName];
                                if (rendererImplementation)
                                    rendererImplementation.render(config, flowAs[rendererName], container);
                            }
                        }
                        else
                            $(config.content).appendTo(container);
                    }
                    else {
                        var gapImage = config.image,
                            gapContent = config.content,
                            gapColor = gapImage != null || gapContent != null ? false : (config.gapColor || uiAutomationSettings('kiosk.gapColor')),
                            gapAccent = gapColor !== false && config.gapAccent,
                            density = config.dense ? 'condensed' : config.density,
                            gap = config._gap = container.addClass('app-gap')
                                .toggleClass('app-accent', config.gapAccent === true)
                                .toggleClass('app-gap-bkg', gapColor === true)
                                .css({
                                    'height': gapImage || gapContent ? '' : config._vertGap ? '100%' : kioskGapSize(config),
                                    'background-color': gapAccent || gapColor === false ? null : config.gapColor || gapColor
                                });
                        if (gapImage)
                            gapContent = $('<img/>').appendTo(gap).attr('src', _app.resolveClientUrl(config.image));
                        else if (gapContent != null) {
                            if (!gapContent.match(/^\s*<\w+/))
                                gapContent = '<div class="app-html">' + gapContent + '</div>';
                            gapContent = $(gapContent).appendTo(gap);
                            if (!parseInt(gapContent.css('font-size')))
                                gapContent.addClass('app-html');
                            if (density)
                                gapContent.addClass('app-density-' + density);
                        }
                        if (gapContent) {
                            if (!scrollbarInfo)
                                scrollbarInfo = getScrollbarInfo(displayContent);
                            gapContent.css({ 'max-width': config.fluid ? null : container.width(), 'max-height': displayContent.height() - scrollbarInfo.height });
                        }
                    }
                }

            }
            return !error;
        });
        heroComplete();
    }

    function parseContent(config) {
        var content = config.content,
            icon = config.icon,
            code,
            m, sb, startIndex,
            codeHeaderIterator;
        // inject icons in the headers
        if (!config._parsed) {
            config._parsed = true;
            if (icon) {
                if (typeof icon == 'string')
                    icon = { header: icon };
                if (typeof icon == 'object') {
                    if (icon.header)
                        content = content.replace(/(<h1.*?>)/i, '$1<i class="material-icon">' + icon.header + '</i>');
                    if (icon.subheader)
                        content = content.replace(/(<h[2-6].*?>)/i, '$1<i class="material-icon">' + icon.subheader + '</i>');
                }
            }
            // trim the code and extract h1-h6 elements into the config
            code = content.match(/<code>([\s\S]+?)<\/code>/);
            if (code) {
                content = content.substring(0, code.index) + '<code>' + code[1].trim() + '</code>' + content.substring(code.index + code[0].length);
                sb = [];
                startIndex = 0;
                codeHeaderIterator = /<h(\d)>([\s\S]+?)<\/h\d>/gi;
                var m = codeHeaderIterator.exec(content);
                while (m) {
                    sb.push(content.substring(startIndex, m.index));
                    startIndex = m.index + m[0].length;
                    config['_header' + m[1]] = m[2];
                    m = codeHeaderIterator.exec(content);
                }
                sb.push(content.substring(startIndex));
                content = sb.join('').trim();
            }
            config.content = content;
        }
        return content;
    }

    function kioskDisplay(options) {
        var error;
        if (!arguments.length || typeof options != 'string' && !options.length)
            return '[Invalid display]';
        if (_display.data('config') !== options)
            _display.removeData('created');
        _display.data('config', options);

        _displayContent = $div('app-display-content app-display-flow').attr('tabindex', 0).appendTo(_display);

        if (typeof options == 'string')
            options = { other: options };
        else if (Array.isArray(options))
            options = { other: options };

        _display.css({ width: '', height: '', left: '', 'margin-left': '', display: '' });


        var logicalWidth = _touch.toWidth(_display.width()),
            logicalWidthIndex = logicalWidthArray.indexOf(logicalWidth),
            displayConfig;
        displayBreakpoint = logicalWidthIndex;
        while (logicalWidthIndex >= 0) {
            displayConfig = options[logicalWidthArray[logicalWidthIndex]];
            if (displayConfig)
                break;
            else {
                displayConfig = null;
                logicalWidthIndex--;
            }
        }
        if (!displayConfig)
            displayConfig = options['other'];
        var physicalWidth = Math.min(Math.max(_kiosk.width(), _touch.toWidth(logicalWidth)), uiAutomationSettings('kiosk.maxWidth') || _touch.toWidth('xxl')),
            scrollbarInfo = getScrollbarInfo(_displayContent);

        _display.css({ width: physicalWidth, height: _display.height(), left: '50%', 'margin-left': -physicalWidth / 2 + 1 });
        _displayContent.css('width', physicalWidth + scrollbarInfo.width/* displayContent[0].offsetWidth - displayContent[0].clientWidth + 1*/);
        _displayContent.css('height', _display.height() + scrollbarInfo.height/* displayContent[0].offsetHeight - displayContent[0].clientHeight + 1*/);

        if (typeof displayConfig == 'string')
            $div('app-content app-text').appendTo(_displayContent).html(displayConfig);
        else
            error = displayFlow(displayConfig, _display, _displayContent, scrollbarInfo);
        if (!error) {
            kioskFocus();
            dataViewChangeMonitor.splice(0);
            kioskBind(false);
            //if (_displayContent.width() > _kiosk.width())
            //    _displayContent.find('> .app-row > .app-full-width').each(function () {
            //        var fullWidthColumn = $(this);
            //    });

            _display.find('.app-tabset .app-text:first').each(function () {
                var tab = $(this),
                    tabList = tab.parent().find('.app-text'),
                    selectedTab = displayStateInit(tab.data('config'), 'selectedTab', 0);
                $(tabList[selectedTab < tabList.length ? selectedTab : 0]).trigger('vclick');
            });
            containerContentAutoSize();
            scrollSelectedItemIntoView();
        }
        return error;
    }

    function containerContentAutoSize(display, displayContent, force) {
        if (!display)
            display = _display;
        if (!displayContent)
            displayContent = _displayContent;
        var autoSizeList = displayContent.find('.app-container-autosize:not(.app-hidden)'),
            displayBottom,
            lastDisplayItem,
            contentIsEmpty,
            minFillHeight = 96; // 8 x 1rem = 8 x 16px = 96px
        if (autoSizeList.length) {
            autoSizeList.each(function () {
                var container = $(this),
                    content = container.show().find('.app-container-content'),
                    column,
                    lastColumnItem,
                    gapBetweenLastColumnItemAndItsBottom,
                    gapBetweenLastItemAndBottomOfDisplay,
                    fixedHeight;
                if ((!content.data('sized') || force) && !content.is('.app-hidden')) {
                    contentIsEmpty = content.height('').is(':empty');
                    if (contentIsEmpty) {
                        if (!container.data('altered'))
                            container.data('altered', true).css({ 'padding-top': 0, 'padding-bottom': 0 });
                        container.show();
                    }
                    if (displayBottom == null) {
                        displayBottom = display.offset().top + display.height();
                        lastDisplayItem = displayContent.children().last();
                    }
                    content.data('sized', true)
                    column = container.parent();
                    lastColumnItem = column.children().filter(':visible').last();
                    gapBetweenLastColumnItemAndItsBottom = column.offset().top + column.height() - (lastColumnItem.offset().top + lastColumnItem.outerHeight(true));
                    gapBetweenLastItemAndBottomOfDisplay = displayBottom - (lastDisplayItem.offset().top + lastDisplayItem.outerHeight(true));
                    fixedHeight = content.height() + gapBetweenLastItemAndBottomOfDisplay + gapBetweenLastColumnItemAndItsBottom;
                    if (contentIsEmpty) {
                        minFillHeight = -1;
                        fixedHeight = Math.max(fixedHeight, container.height(), 0);
                        if (fixedHeight)
                            container.show();
                        else
                            container.hide();
                    }
                    if (fixedHeight > minFillHeight)
                        content.height(fixedHeight);
                }
            });
        }
    }

    function alterDisplayObject(config) {
        var alter = config.alter,
            rootAlter = alter,
            altAlter,
            breakpointMatch,
            propName,
            m, from, to,
            remove, restore, propValue,
            privatePropertyExceptions = ['_lastResult', '_parsed', '_header1', '_header2'],
            privateProperties = [];
        // enumerate and delete all private proprties in the display configuration
        for (propName in config)
            if (propName.match(/^_/) && privatePropertyExceptions.indexOf(propName) < 0)
                privateProperties.push(propName);
        privateProperties.forEach(function (propName) {
            delete config[propName];
        });
        if (alter) {
            remove = rootAlter.remove || {};
            for (propName in remove)
                delete config[propName];
            restore = rootAlter.restore || {};
            for (propName in restore)
                config[propName] = restore[propName];
            altAlter = alter.portrait;
            if (altAlter && _display.width() < _display.height())
                alter = altAlter;
            else {
                altAlter = alter.landscape;
                if (altAlter && _display.width() > _display.height())
                    alter = altAlter;
            }
            for (propName in alter) {
                m = propName.match(breakpointRegex);
                if (m) {
                    from = logicalWidthArray.indexOf(m[1] || logicalWidthArray[0]);
                    to = logicalWidthArray.indexOf(m[3] || logicalWidthArray[logicalWidthArray.length - 1]);
                    if (from <= displayBreakpoint && displayBreakpoint <= to) {
                        breakpointMatch = alter[propName];
                        for (propName in breakpointMatch) {
                            if (propName in config)
                                restore[propName] = config[propName];
                            else
                                remove[propName] = true;
                            propValue = breakpointMatch[propName];
                            if (propValue == null)
                                delete config[propName];
                            else
                                config[propName] = propValue;
                        }
                        rootAlter.remove = remove;
                        rootAlter.restore = restore;
                        break;
                    }
                }
            }
        }
    }

    function kioskGapSize(config) {
        var size = config.gapSize,
            gapSize = size != null ? size : uiAutomationSettings('kiosk.gapSize');
        return gapSize == null ? _display ? 12 : 16 : gapSize;
    }

    function isGap(displayObj) {
        return !displayObj._propCount && displayObj.content == null && displayObj.image == null;
    }

    function configUpdateLayout(config, container) {
        var rows = [],
            r, c,
            availWidth = container.width(),
            lastDisplayObj,
            hasColumns;
        // map rows and columns
        configIterator(config, function (displayObj) {
            var configIsArray = Array.isArray(config) && typeof config == 'object';
            if (configIsArray)
                configIterator(displayObj);
            var flow = displayObj.flow;
            if (!displayObj._grid) {
                if (flow === 'row' || !r) {
                    if (configIsArray && (flow === 'column' || flow === 'row' && (!lastDisplayObj || lastDisplayObj.flow === 'row' && isGap(lastDisplayObj)))) {
                        if (isGap(displayObj)) {
                            if (displayObj.width == null)
                                displayObj.width = kioskGapSize(displayObj);
                            else
                                displayObj._keepWidth = true;
                            displayObj._vertGap = true;
                        }
                    }
                    r = [];
                    c = [];
                    rows.push(r);
                    r.push(c);
                }
                else if (flow === 'column') {
                    hasColumns = true;
                    c = [];
                    r.push(c);
                    if (isGap(displayObj) && configIsArray) {
                        if (displayObj.width == null)
                            displayObj.width = kioskGapSize(displayObj);
                        displayObj._vertGap = true;
                    }
                }
                c.push(displayObj);
                if (!flow && displayObj._propCount && lastDisplayObj && isGap(lastDisplayObj) && lastDisplayObj._vertGap) {
                    if (lastDisplayObj._keepWidth)
                        delete lastDisplayObj.width;
                    delete lastDisplayObj._vertGap;
                }
            }
            lastDisplayObj = displayObj;
        });
        // calculate the width of columns 
        //if (hasColumns)
        rows.forEach(function (r) {
            var fixedWidth = 0,
                autoWidthColCount = 0,
                r0c0 = r[0][0];
            if (r.length === 1 && r[0].length === 1 && (isGap(r0c0) || !hasColumns)) {
                delete r0c0._vertGap;
                if (!r0c0._keepWidth && !r0c0.isContent)
                    delete r0c0.width;
                r0c0._width = 1;
                r0c0._newCol = true;
                r0c0._newRow = true;
            }
            else
                r.forEach(function (c, colIndex) {
                    var w = c[0].width;
                    if (w != null && w !== 'auto') {
                        if (typeof w == 'string')
                            if (w.match(/%$/))
                                w = parseFloat(w) / 100;
                            else if (w.match(/^\d+x$/)) {
                                if (!layoutGridInfo) {
                                    var tempContainer = $('<div class="app-container"><div data-type="button"><div class="app-button app-no-text"></div></div></div>').appendTo(_displayContent),
                                        tempButton = tempContainer.find('.app-button');
                                    layoutGridInfo = { w: tempButton.width(), g: parseInt(tempButton.css('margin-left')) };
                                    tempContainer.remove();
                                }
                                w = parseInt(w) * (layoutGridInfo.w + layoutGridInfo.g) + layoutGridInfo.g;
                            }
                            else
                                w = parseInt(w);
                        c[0]._width = w = w <= 1 && c[0].width !== 1 ? w : w / availWidth;
                        fixedWidth += w;
                    }
                    else {
                        autoWidthColCount++;
                        c[0]._width = null;
                    }
                    if (r.length > 1 || rows.length > 1) {
                        if (!colIndex)
                            c[0]._newRow = true;
                        // if (r.length > 1)
                        c[0]._newCol = true;
                    }
                });
            if (autoWidthColCount)
                r.forEach(function (c) {
                    if (c[0]._width == null)
                        c[0]._width = (1 - fixedWidth) / autoWidthColCount;
                });

        });
    }

    function setWidth(elem, width) {
        width = width != null ? width * 100 + '%' : '';
        elem.toggleClass('app-full-width', width === '100%');
        return elem.css({ width: width, minWidth: width, maxWidth: width });
    }

    function toPropValue(prop, data) {
        if (typeof prop == 'function')
            prop = prop(data);
        return prop;
    }

    function displayItemsInContainer(config, container) {
        var items = config._items,
            currentContainer = container,
            tallColumnCount = 0,
            currentRow,
            dataRowCount = 0, hasFieldsInRow;
        items.forEach(function (item) {
            var displayObj = item.obj,
                html = item.html,
                elem,
                isGridColumn = displayObj._grid,
                dark = displayObj.darkest ? .75 : displayObj.dark,
                width = displayObj._width,
                newRow = displayObj._newRow,
                rowMargin = 0;

            if (newRow || !currentRow && isGridColumn) {
                hasFieldsInRow = false;
                currentContainer = currentRow = $div('app-row').toggleClass('app-collapsed', config.expand && dataRowCount > 0).appendTo(container);
                if (newRow && tallColumnCount--) {
                    while (tallColumnCount >= 0)
                        rowMargin += items[tallColumnCount--].obj._width;
                    currentRow.css('margin-left', rowMargin * 100 + '%');
                }
            }
            if (displayObj.field && !hasFieldsInRow) {
                hasFieldsInRow = true;
                dataRowCount++;
            }

            if (displayObj._newCol)
                currentContainer = setWidth($div('app-column'), width).appendTo(currentRow || container);
            if (isGridColumn || displayObj._label === false)
                html = html.replace(span('app-label'), '');
            elem = displayObj.item = $(html).appendTo(currentContainer);
            if (isGridColumn) {
                elem.toggleClass('app-field-type-numeric', displayObj.field.Type.match(_app._numericTypeRegex) != null);
                if (displayObj.tall)
                    tallColumnCount++;

            }
            if (dark != null) {
                if (dark === true)
                    dark = .5;
                toggleTransparency(elem.find('.app-button'), 1 - dark);
            }
            if (isButton(displayObj))
                elem.find('.app-button').data('obj', displayObj);
            // DEBUG
            //if (displayObj.compact || displayObj.compact2)
            //    elem.data('text', '-162*5.1-96-16.32*74').find('.app-value').text('-162*5.1-96-16.32*74');
            // END DEBUG
        });
    }

    function configIterator(config, callback, hideHidden) {
        var propName,
            displayObj,
            result,
            index = 0;
        for (propName in config)
            if (systemDisplayProperties.indexOf(propName) === -1 && !propName.match(/^_/) && propName !== 'alter') {
                displayObj = config[propName];
                if (typeof displayObj == 'function')
                    displayObj = config[propName] = { expression: displayObj };//{ ifThisThenThat: displayObj };
                if (displayObj != null && typeof displayObj == 'object' && ((!displayObj.hidden || displayObj.visible) || hideHidden === false)) {
                    result = callback ? callback(displayObj, propName, index++) : ++index;
                    if (result === false)
                        return;
                }
            }
        if (config._propCount == null)
            config._propCount = index;
    }

    function configBind(config, contextMap, data) {
        var inDataView = config._inDataView,
            isForm = inDataView.get_isForm(),
            context;
        configIterator(config, function (displayObj, name) {
            var field = displayObj.field,
                expression = displayObj.expression,
                button, buttonText, buttonChecked,
                item = displayObj.item,
                genericPropItem = item,
                contextItem,
                icon,
                tooltip = displayObj.tooltip,
                isGridColumn,
                width;
            if ((field || expression) && data) {
                var value = expression ? expression.apply(data, [data]) : data[field.Name],
                    valueIsNull = value == null,
                    text, hasText = displayObj.text !== false,
                    //label = displayObj.label != null ? displayObj.label : field ? field.HeaderText : name,
                    label = displayObj._label,
                    labelIsHidden = !isGridColumn && label === false,
                    encode = field ? field.HtmlEncode : true,
                    itemValue = item.find('.app-value'),
                    itemLabel = item.find('.app-label');
                if (valueIsNull)
                    text = labelNullValueInForms;
                else if (value.getMonth && $settings('ui.smartDates')) {
                    text = _touch.toSmartDate(value);
                    itemValue.attr({
                        'data-smart-type': field ? field.Type : 'DateTime',
                        'data-smart-value': JSON.stringify(value),
                        'data-title': field ? field.format(value) : String.format('{0:' + $app.dateFormatStrings['{0:g}'] + '}', value)
                    });
                }
                else if (field)
                    text = field.format(value);
                else
                    text = value.toString();
                if (encode)
                    itemValue.text(text);
                else
                    itemValue.html(text);
                isGridColumn = displayObj._grid;
                itemValue
                    .toggleClass('app-medium', displayObj.medium === true || displayObj.mediumValue === true)
                    .toggleClass('app-large', displayObj.large === true || displayObj.largeValue === true)
                    .toggleClass('app-accent', displayObj.accent === true || displayObj.accentValue === true)
                    .toggleClass('app-nowrap', !isGridColumn && displayObj.wrap === false)
                    .css('color', toPropValue(displayObj.colorValue, data));
                width = displayObj._width;
                if (width && isGridColumn)
                    setWidth(item.addClass('app-cell').toggleClass('app-nowrap', displayObj.wrap === false), width);
                else
                    itemLabel.text(label)
                        .toggleClass('app-medium', displayObj.medium === true || displayObj.mediumLabel === true)
                        .toggleClass('app-large', displayObj.large === true || displayObj.largeLabel === true)
                        .toggleClass('app-accent', displayObj.accent === true || displayObj.accentLabel === true)
                        .css('color', toPropValue(displayObj.colorLabel, data));
                item
                    .toggleClass('app-label-hidden', labelIsHidden)
                    .toggleClass('app-null', valueIsNull)
                    .toggleClass('app-medium', displayObj.medium === true || displayObj.mediumValue === true || displayObj.mediumLabel === true)
                    .toggleClass('app-large', displayObj.large === true || displayObj.largeValue === true || displayObj.largeLabel === true);
                if (labelIsHidden && field || tooltip != null)
                    item.attr('data-title', tooltip != null ? tooltip : field.HeaderText);
                if (displayObj.density)
                    item.addClass('app-density-' + displayObj.density);
                if (displayObj.align)
                    item.addClass('app-align-' + displayObj.align);

                if (field && field.Name === '>')
                    itemValue.attr('data-title', value ? resourcesForm.Minimize : resourcesForm.Maximize);

                if (field && isForm)
                    item.css('display', $('#' + config._inDataView._id + ' [data-field="' + inDataView._allFields[field.OriginalIndex].Name + '"]').is(':visible') ? '' : 'none');
            }
            else {
                genericPropItem = button = item.find('.app-button');
                buttonText = button.find('.app-text');
                buttonChecked = displayState(displayObj, 'checked');
                if (hasText)
                    text = displayObj.text;
                if (text == null)
                    text = name;
                if (isButton(displayObj))
                    buttonText.text(text);
                else {
                    context = contextMap[inDataView._id];
                    if (!context)
                        contextMap[inDataView._id] = context = [];
                    contextItem = findItemInContextOf(inDataView, normalizeOptions(name), context);
                    if (contextItem) {
                        button.show().data({ obj: displayObj, contextItem: contextItem });
                        text = contextItem.text;
                        tooltip = contextItem.tooltip;
                        buttonText.text(text);
                    }
                    else
                        button.hide();
                }
                if (tooltip == null)
                    tooltip = text;
                icon = displayObj.icon || (contextItem ? contextItem.icon : null);
                button.find('i').remove();
                if (icon)
                    _touch.icon(icon, button);
                button
                    .toggleClass('app-no-icon', icon === false || icon == null)
                    .toggleClass('app-wide', displayObj.wide === true);
                if (buttonChecked === true || typeof buttonChecked == 'function' && !!buttonChecked(data))
                    _touch.icon('material-icon-check-circle', button).addClass('app-checked');
                //.toggleClass('app-narrow', displayObj.narrow === true);
                if (displayObj.text === false) {
                    button.addClass('app-no-text');
                    text = null;
                }
                if (tooltip !== text)
                    button.attr('data-title', tooltip);
            }
            genericPropItem.css({ 'background-color': toPropValue(displayObj.colorBackground, data), color: toPropValue(displayObj.color, data) })
            if (displayObj.when)
                item.css('display', data && displayObj.when(data) ? '' : 'none');

        });
    }

    function objToPK(config, obj) {
        var row = [],
            key = [],
            pkValue;
        config._lastResult.primaryKey.forEach(function (pkField) {
            pkValue = obj[pkField.Name];
            row[pkField.Index] = pkValue;
            key.push(pkValue);
        });
        return { row: row, key: key }
    }

    function configBindDataView(config, container, result) {
        config._lastResult = result;
        var inDataView = config._inDataView,
            contextMap = {},
            hasSelection,
            content = container.find('.app-container-content').empty(),
            footer,
            pageIndex = result.pageIndex,
            pageSize = result.pageSize,
            totalRowCount = result.totalRowCount,
            expanded = config._expanded,
            item, itemIsExpanded,
            letters = result.letters,
            letterBuilder = [],
            beginsWith = displayState(config, 'beginsWithLetter');
        result.list.forEach(function (obj, index) {
            obj['#'] = pageIndex * pageSize + index + 1;
            item = $div('app-item app-feedback').appendTo(content).data({ id: inDataView._id, obj: obj, config: config });
            displayItemsInContainer(config, item);

            var pk = objToPK(config, obj);
            if (expanded) {
                itemIsExpanded = expanded[pk.key.toString()] === true;
                obj['>'] = itemIsExpanded;
                if (!itemIsExpanded)
                    item.addClass('app-collapsed');
            }

            _data_binding(obj, inDataView);
            configBind(config, contextMap, obj);
            _data_binding(obj);

            if (!hasSelection) {
                if (config._inDataView.rowIsSelected(pk.row)) {
                    hasSelection = true;
                    item.addClass('app-selected');
                }
            }
        });
        if (pageSize < totalRowCount) {
            footer = $div('app-row-pager').appendTo(content).data('config', config);
            _touch.icon('material-icon-navigate-before', $span('app-btn app-feedback app-prev').appendTo(footer).attr('data-title', resourcesPager.Previous).toggleClass('app-disabled', !pageIndex));
            _touch.icon('material-icon-navigate-next', $span('app-btn app-feedback app-next').appendTo(footer).attr('data-title', resourcesPager.Next).toggleClass('app-disabled', pageIndex === Math.ceil(totalRowCount / pageSize) - 1));
            $span('app-info').appendTo(footer).html(String.format(resourcesPager.ShowingItems, pageIndex * pageSize + 1, Math.min(totalRowCount, (pageIndex + 1) * pageSize), totalRowCount));
        }
        scrollSelectedItemIntoView(content);
        if (config.letters && letters) {
            letters.list.forEach(function (l) {
                letterBuilder.push('<span title="' + l + '"' + (beginsWith === l ? ' class="app-selected"' : '') + '>' + l + '</span> ');
            });
            container.find('.app-letters').html(letterBuilder.join('')).data('letters', letters);
        }
    }

    function scrollSelectedItemIntoView(content) {
        if (!content)
            $('.app-display .app-row-header+.app-container-content').each(function () {
                scrollSelectedItemIntoView($(this));
            });
        else {
            var selected = content.find('.app-selected'),
                contentRect,
                selectedRect;
            if (selected.length) {
                selectedRect = getBoundingClientRect(selected);
                contentRect = getBoundingClientRect(content);
                if (selectedRect.top < contentRect.top || selectedRect.bottom > contentRect.bottom)
                    content.scrollTop(selectedRect.top - contentRect.top + content.scrollTop() - (contentRect.height - selectedRect.height) / 2);
            }
        }
    }

    function configRefreshDataView(config, container, pageIndex) {
        var inDataView = config._inDataView,
            letters = config.letters,
            beginsWithFilter,
            doSync = pageIndex == null,
            loadOnStart = config.loadOnStart;
        if (loadOnStart === false)
            delete config.loadOnStart;
        pageIndex = pageIndex || 0;
        if (letters)
            beginsWithFilter = displayState(config, 'beginsWithFilter');
        _app.execute({
            from: inDataView, as: 'list',
            pageSize: config._count,
            pageIndex: pageIndex,
            requiresRowCount: true,
            _filter: beginsWithFilter ? [beginsWithFilter] : null,
            sync: doSync ? inDataView._selectedKey : null,
            requiresData: loadOnStart == null,
            letters: letters && pageIndex === 0
        }).then(
            function (result) {
                configBindDataView(config, container, result);
            });
    }

    function kioskBind(autoSize) {
        var displayConfig = _display.data('config'),
            dataMap = {},
            visibilityMap = {},
            contextMap = {},
            lastDisplayChild,
            lastDisplayChildTop;
        if (typeof displayConfig == 'string') return;

        lastDisplayChild = _displayContent.children().last();
        if (lastDisplayChild)
            lastDisplayChildTop = lastDisplayChild.offset().top;

        displayConfig.forEach(function (config, index) {
            var inDataView = config._inDataView,
                changesDetected = dataViewChangeMonitor.length,
                container = container = _display.find('.app-container[data-index="' + index + '"]'),
                dataViewId = inDataView._dataViewFieldOwnerId || inDataView._id,
                isDataViewVisibile = visibilityMap[inDataView._id];

            if (isDataViewVisibile == null)
                isDataViewVisibile = visibilityMap[dataViewId] = $('#' + dataViewId + '.ui-page-active').length > 0 || !kiosk('ontop');
            if (!isDataViewVisibile)
                return;


            if (!changesDetected || dataViewChangeMonitor.indexOf(inDataView._id) >= 0)
                if (configIsList(config)) {
                    // dataview field
                    var dataViewResultSet = config._lastResult;
                    if (config.loadOnStart === false && !config.letters)
                        delete config.loadOnStart;
                    else if (!changesDetected && dataViewResultSet)
                        configBindDataView(config, container, dataViewResultSet);
                    else
                        configRefreshDataView(config, container);
                }
                else {
                    var data = dataMap[inDataView._id];
                    if (data === undefined)
                        data = dataMap[inDataView._id] = inDataView.data();
                    data = inDataView.commandRow() ? data : null;
                    if (config._hasFields)
                        container.css('display', data ? '' : 'none');
                    _data_binding(data, inDataView);
                    configBind(config, contextMap, data);
                    _data_binding(data);
                }
        });
        dataViewChangeMonitor.splice(0);
        if (lastDisplayChildTop !== lastDisplayChild.offset().top && autoSize !== false)
            containerContentAutoSize();
    }

    function toggleTransparency(elem, transparency) {
        var color = elem.css('background-color').match(/^rgba?\((\d+,\s*\d+,\s*\d+)/);
        if (color)
            elem.css('background-color', typeof transparency == 'number' ? 'rgba(' + color[1] + ',' + transparency + ')' : 'rgb(' + color[1] + ')');
    }

    function kioskFocus() {
        if (_displayContent)
            _displayContent.focus();
    }

    function resizeKioskForVirtualScreen() {
        var screen = _touch.screen();
        if (screen.isVirtual)
            _kiosk.css({ left: screen.left, top: screen.top, width: screen.width, height: screen.height });
    }

    kiosk = function () {
        var args = arguments,
            result, pageInfo,
            method = args[0];
        if (args.length && uiAutomationSettings('kiosk.enabled') !== false) {
            var show = method,
                transparency = typeof show == 'number' && show > 0 && show <= 1 ? show : false,
                created, density,
                activePage;
            if (transparency !== false)
                show = true;
            if (typeof show == 'boolean') {
                if (method) {
                    if (!_kiosk) {
                        barcodeInputAlways(true);
                        created = true;
                        _kiosk = $div('app-kiosk').attr('tabindex', 0).toggleClass('app-fullscreen', uiAutomationSettings('kiosk.fullscreen') === true);
                        resizeKioskForVirtualScreen();

                        density = uiAutomationSettings('kiosk.density');
                        if (density)
                            _kiosk.addClass('app-density-' + density);
                        activePage = findActivePage();
                        if (activePage.length)
                            _kiosk.insertAfter(activePage);
                        else
                            _kiosk.appendTo($body);
                        kioskInit();
                        $body.addClass('app-is-kiosk');
                    }
                    if (transparency !== false) {
                        //kioskColor = _kiosk.css('background-color').match(/^rgb\((.+)?\)$/);
                        //if (kioskColor)
                        //    _kiosk.css('background-color', 'rgba(' + kioskColor[1] + ',' + transparency + ')');
                        toggleTransparency(_kiosk, transparency);
                    }
                    kioskFocus();
                    if (_started && created && !uiAutomation())
                        ifThisThenThat({ runOnce: true });
                }
                else if (_kiosk) {
                    barcodeInputAlways(false);
                    _kiosk.remove();
                    _kiosk = null;
                    _display = null;
                    _displayContent = null;
                    _displayId = null;
                    $body.removeClass('app-is-kiosk');
                    _touch.resetUI();
                    $('.ui-page-active .app-wrapper').focus();
                    _input.focus({ lastFocused: true });
                }
            }
            else if (typeof method == 'string')
                if (_kiosk) {
                    if (method === 'get')
                        return !runKioskAutomationOnHomePage || $body.is('.app-ui-automation:not(.app-ui-automation-system)') ? _kiosk : null;
                    if (method === 'ontop')
                        return isKioskOnTop();
                    if (method === 'focus') {
                        result = isKioskOnTop(); // _kiosk && !_kiosk.nextAll('.ui-page-active').length
                        if (!result) {
                            pageInfo = _touch.pageInfo();
                            if (pageInfo && pageInfo.home)
                                result = true;
                        }
                        if (result)
                            kioskFocus();
                    }
                    else if (method === 'refresh')
                        refreshAppButtons();
                }
        }
        if (result == null)
            result = _kiosk != null;
        return result;
    };

    function exit(success) {
        appDeferred = null;
        var error = app.error(),
            message = error,
            barcode,
            runOnce = execState.runOnce;
        if (message)
            success = false;
        else
            success = typeof success == 'boolean' ? success : true;
        if (execState.input['barcode'] != null) {
            if (!success) {
                barcode = execState.input['barcode'];
                if (message)
                    message = barcode + ' > ' + message;
                else
                    message = barcode;
            }
        }
        execState = null;
        if (message != null)
            notify(message, true, error ? 30000 : null);
        uiAutomation(false);
        _input.barcode(true); // continue processing of barcodes
        if (!_input.barcode().length)
            if (!runOnce)
                ifThisThenThat({ runOnce: true });
            else {
                clearTimeout(restoreFocusTimeout);
                if (_touch.kiosk())
                    _touch.kiosk('focus');
                else
                    restoreFocusTimeout = setTimeout(_input.focus, 200, { lastFocused: true });
            }
    }

    function next() {
        if (execState.error) {
            if (appIsBusy() || execState.discarding)
                setTimeout(next, execSpeed);
            else
                exit();
            return false;
        }
        else {
            execState.index++;
            return true;
            //    var timeNow = new Date().getTime();
            //    if (timeNow - execTimer > 16 && false) {
            //        execTimer = timeNow;
            //        setTimeout(execute, execSpeed);
            //    }
            //    else
            //        execute();
        }
    }

    function execute(options) {
        var ifttt = _app.ifThisThenThat(),
            activity,
            wait, activeDataView,
            id;

        //function cancelInlineEditingMode() {
        //    $document.one('inlineeditingmode.dataview.app', function () {
        //        setTimeout(execute, execSpeed, options);
        //    });
        //    _touch.inlineEditing(activeDataView._parentDataViewId || activeDataView._id, false);
        //}

        if (options) {
            if (execState && !ifttt.length)
                return;
            activeDataView = _touch.dataView();
            id = options.id;
            wait = appIsBusy();
            if (toSearchSurveyPrincipal(activeDataView) !== activeDataView) {
                if (isReadingBarcodes(true)) {
                    wait = true;
                    if (!options._notified) {
                        notify(resourcesMobile.Reading, true, 30000);
                        options._notified = true;
                    }
                }
                else if (options.input.barcode) {
                    notify(false);
                    // history.go(-1);
                    _touch.goBack();
                    wait = true;
                }
            }

            // If inline editor is active then cancel it. 
            // Prodceed with UI automation thereafter.

            if (activeDataView)
                if (activeDataView._inlineEditor) {
                    if (isReadingBarcodes(true))
                        wait = true;
                    else {
                        activeDataView.tag('discard-changes-prompt-none');
                        _touch.goBack(function () {
                            setTimeout(execute, execSpeed, options);
                        });
                        return;
                    }
                }

            if (wait) {
                setTimeout(execute, execSpeed, options);
                return;
            }
            execState = options;
            if (id)
                ifttt.every(function (ift, index) {
                    if (ift.id === id)
                        execState.index = index;
                    return execState.index == null;
                });
            if (execState.index == null) {
                execTimer = new Date().getTime();
                execState.index = 0;
            }
            uiAutomation(true);
        }
        else if (!execState)
            return;
        if (!appDeferred) {
            appDeferred = $.Deferred();
            $.when(appDeferred)
                .then(exit);
        }
        //    .fail(function () {
        //        if (execState.error)
        //            next();
        //    });
        while (execState.index < ifttt.length) {
            activity = ifttt[execState.index];
            if (activity.background || id && activity.id === id) {
                try {
                    execState.context = new ActivityContext();
                    var activityPromise = activity.execute(app, execState.context).done(iftttDone);//.fail(iftttFail);
                    if (execState.ifResult === false) {
                        if (!next())
                            break;
                    }
                    else if (execState.ifResult == null) {
                        activityPromise.fail(function () {
                            if (next())
                                execute();
                            else
                                exit(false);
                        });
                        break;
                    }
                    else {
                        break;
                    }

                }
                catch (ex) {
                    iftttDone(ex);
                    break;
                }
            }
            else
                if (!next())
                    break;
        }
        if (execState && execState.index >= ifttt.length) {
            exit(false);
            ifThisThenThat();
        }
    }

    function ifThisThenThat(options) {
        if (!options)
            options = {};
        var run = options.id || options.input || options.runOnce,
            repeatInterval = _app.ifThisThenThat._interval,
            testNumber;
        if (!options.input)
            options.input = {};
        if (!('numpad' in options)) {
            numPadText = formulaToText(numPadText);
            options.input['numpad'] = numPadText;
            if (!String.isNullOrEmpty(numPadText)) {
                testNumber = parseFloat(numPadText);
                options.input['numpad.number'] = isNaN(testNumber) ? null : testNumber;
                options.input['numpad.date'] = Date.tryParseFuzzyDate(numPadText);
                options.input['numpad.time'] = Date.tryParseFuzzyTime(numPadText);
            }
        }
        clearTimeout(iftttTimeout);
        if (run)
            if (appIsBusy() || execState)
                iftttTimeout = setTimeout(ifThisThenThat, 96 /*16 * 6*/, options);
            else
                iftttTimeout = setTimeout(execute, options.interval || 0, options);
        else if (repeatInterval) {
            options.interval = repeatInterval;
            if (repeatInterval)
                ifThisThenThat(options);
        }
        //else {
        //    options.once = true;
        //    ifThisThenThat(options);
        //}
    }

    $document.on('beforetouchinit.app', function () {
        _touch = _app.touch;
        _input = _app.input;
        _touch.kiosk = kiosk;
        $settings = _touch.settings;
        logicalWidthArray = _touch.toWidth();
        if (_touch && uiAutomationSettings('enabled') === true)
            iftttInitialize();
    });

    function appBtnSync_Exec() {
        var icon = _app.odp.offline('icon'),
            context = [],
            i, option, found;
        _touch.navContext(context);
        if (icon)
            for (i = 0; i < context.length; i++) {
                option = context[i];
                if (option.icon === icon) {
                    found = true;
                    break;
                }
            }
        if (found)
            option.callback(option.context);
        else
            _app.alert(resources.ODP.SaveAndSync);
    }

    function appBtnScan_Exec() {
        notify('Not supported.')
    }

    function refreshAppButtons() {
        var appButtons = [],
            appBtn;
        if (_app.odp.offline()) {
            appBtnSync.icon = _app.odp.offline('icon') || 'material-icon-cloud';
            appBtnSync.tooltip = _app.odp.offline('tooltip');
            appButtons.push(appBtnSync);
        }
        if (_app.host)
            appButtons.push(appBtnScan);
        _kiosk.find('> .app-btn').each(function (index) {
            var btn = $(this),
                btnDef = appButtons[index];
            if (index < appButtons.length) {
                btn.data('btn', btnDef).show().attr('data-title', btnDef.tooltip).find('i').css('transform', btnDef.transform || '').text(btnDef.icon.replace('material-icon-', '').replace('-', '_'));
                appBtn = btn;
            }
            else
                btn.hide();
        });
        if (appBtn)
            _kiosk.find('.app-logo').css('right', _kiosk.width() - appBtn.offset().left);
    }

    function iftttInitialize() {
        $document.one('touchinit.app', function () {
            if ($body.data('kiosk'))
                uiAutomationSettings('kiosk.enabled', true);
            _touch.kiosk(uiAutomationSettings('kiosk.enabled'));
        }).on('pagereadycomplete.app', function () {
            if (_kiosk)
                if (runKioskAutomationOnHomePage) {
                    var pageInfo = _touch.pageInfo();
                    if ((!pageInfo || pageInfo.home) && !execState)
                        $document.trigger('ifttt.app');
                    else
                        barcodeInputAlways(isKioskOnTop());
                }
                else {
                    kioskDisplay('');
                    runKioskAutomationOnHomePage = true;
                }
            else
                runKioskAutomationOnHomePage = true;
        }).on('barcode.app', function (e) {
            if (!e.isDefaultPrevented() && _app.ifThisThenThat().length) {
                if (execState)
                    _input.barcode().push(e.text);
                else
                    ifThisThenThat({ input: { barcode: e.text } });
                return false;
            }
        }).on('ifttt.app', function (e, ifThis) {
            var activityId = e.ifThis || ifThis;
            ifThisThenThat({ id: activityId, runOnce: activityId == null });
            //if (!_app.userName() && !location.href.match(/\bReturnUrl=/) && kiosk() && !_started)
            //    _touch.showAccountManager(null, true);
            _started = true;
        }).on('vclick', '.app-kiosk .app-avatar', function () {
            setTimeout(function () {
                $('.app-bar-toolbar .app-avatar').trigger('vclick');
            });
            return false;
        }).on('vclick', '.app-kiosk .app-btn-context', function () {
            setTimeout(function () {
                $('.app-bar-toolbar .app-btn-context').trigger('vclick');
            });
            return false;
        }).on('vclick', '.app-kiosk .app-logo', function () {
            setTimeout(function () {
                $('.app-bar-toolbar .app-btn-menu').trigger('vclick');
            });
            return false;
        }).on('vclick', '.app-kiosk .app-login', function () {
            _touch.showAccountManager(null, true);
            return false;
        }).on('vclick', '.app-kiosk .app-button', function () {
            var button = $(this);
            if (!appIsBusy() && !uiAutomation()) {
                _touch.callWithFeedback(button);
                setTimeout(buttonPressed, 0, button);
            }
            return false;
        }).on('vclick', '.app-kiosk .app-numpad .app-btn, .app-kiosk .app-numpad .app-text i', function () {
            var button = $(this);
            if (!appIsBusy() && !uiAutomation()) {
                _touch.callWithFeedback(button);
                setTimeout(numPadButtonPressed, 0, button);
            }
            return false;
        }).on('vclick', '.app-kiosk .app-item', function (e) {
            var item = $(this),
                expandCollapse = $(e.target).closest('[data-name=">"]'),
                config, obj, isExpanded, toggleButton;
            if (expandCollapse.length) {
                config = item.data('config');
                obj = item.data('obj');
                isExpanded = !obj['>'];
                obj['>'] = isExpanded;
                config._expanded[objToPK(config, obj).key.toString()] = isExpanded;
                item.toggleClass('app-collapsed', !isExpanded);
                toggleButton = expandCollapse.find('.app-value');
                toggleButton.find('i').text('expand_' + (isExpanded ? 'less' : 'more'));
                _touch.toggleTooltip(toggleButton, isExpanded);
            }
            else {
                _touch.callWithFeedback(item);
                if (!appIsBusy() && !uiAutomation())
                    if (item.is('.app-selected'))
                        scrollSelectedItemIntoView(item.parent());
                    else
                        setTimeout(itemPressed, 0, item);
            }
            return false;
        }).on('vclick', '.app-kiosk .app-tabset .app-text', function () {
            var selected = $(this),
                tabs = selected.parent().find('.app-text'),
                tabList = [selected.addClass('app-selected')],
                prevTabs = selected.prevAll('.app-text'),
                masterTab = prevTabs.length ? prevTabs.last() : selected;
            tabs.each(function (index) {
                var tab = $(this);
                if (tab.is(selected))
                    displayState(masterTab.data('config'), 'selectedTab', index);
                else
                    tabList.push(tab.removeClass('app-selected'));
            });
            tabList.forEach(function (tab, tabIndex) {
                var isFirstTab = !tab.prev().length;
                tab.data('tab').forEach(function (container, containerIndex) {
                    var content = isFirstTab && !containerIndex ? tab.parent().nextAll() : container;
                    content.toggleClass('app-hidden', !!tabIndex);
                });

            });
            containerContentAutoSize();
            //scrollSelectedItemIntoView();
            return false;
        }).on('vclick', '.app-row-pager .app-btn', function () {
            var button = $(this);
            if (!appIsBusy() && !uiAutomation() && !button.is('.app-disabled')) {
                _touch.callWithFeedback(button);
                setTimeout(navButtonPressed, 0, button);
            }
            return false;
        }).on('vclick', '.app-kiosk .app-letters span', function () {
            var letter = $(this),
                letterTrack = letter.parent(),
                config = letterTrack.data('config'),
                letters = letterTrack.data('letters'),
                beginsWith,
                lastBeginsWith = displayState(config, 'beginsWithLetter'),
                dataView = config._inDataView,
                fieldName = letters.field;
            letterTrack.find('.app-selected').removeClass('app-selected');
            letter.addClass('app-selected');
            if (dataView) {
                beginsWith = letter.text();
                if (beginsWith === lastBeginsWith)
                    beginsWith = null;
                displayState(config, 'beginsWithFilter', beginsWith == null ? null : fieldName + ':$beginswith$%js%' + JSON.stringify(beginsWith));
                displayState(config, 'beginsWithLetter', beginsWith);
                dataView.removeFromFilter(fieldName);
                if (beginsWith == null)
                    dataView.sync();
                else
                    dataView.applyFilter(dataView.findField(fieldName), '$beginswith$', beginsWith);
            }
            return false;
        }).on('vclick', '.app-kiosk > .app-btn', function (e) {
            var btn = $(this).data('btn');
            setTimeout(btn.exec);
            return false;
        }).on('dataviewrefresh.app datainputbroadcast.app', kioskChanged
        ).on('themechanged.app', kioskResize
        ).on('useravatarchanged.app', function () {
            if (_kiosk)
                _app.AccountManager.avatar(_app.userName(), _kiosk.find('> .app-avatar i'));
        });

        $window.on('throttledresize', kioskResize);
    }

    function itemPressed(item) {
        item.parent().find('.app-item').removeClass('app-selected');
        item.addClass('app-selected');
        syncDataView(findDataView(item.data('id')), item.data('obj'), {}, {});
    }

    function findDisplayObject(name) {
        var result;
        configIterator(_display.data('config'), function (displayBlock) {
            configIterator(displayBlock, function (testObj, testName) {
                if (testName === name) {
                    result = testObj;
                    return false;
                }
            }, false);
            if (result)
                return false;
        }, false);
        return result
    }

    function buttonPressed(button) {
        var displayObj = button.data('obj'),
            contextItem = button.data('contextItem'),
            barcode = displayObj.barcode,
            perform = displayObj.perform,
            hasPeformed,
            performPick, performShow, performHide,
            targetDisplayObj;
        if (contextItem)
            contextItem.callback(contextItem.context);
        else {
            if (perform)
                if (typeof perform == 'function')
                    perform(displayObj);
                else {
                    performPick = perform.pick;
                    performShow = perform.show;
                    performHide = perform.hide;
                    if (performPick) {
                        var pickField = optionsToField(normalizeOptions({ selector: performPick })),
                            inputField,
                            isDate,
                            inputButton,
                            modalPage;
                        if (pickField) {
                            isDate = pickField.Type.match(/^Date/);
                            pickField = pickField._dataView._allFields[pickField.OriginalIndex];
                            if (pickField.ItemsStyle || isDate) {
                                hasPeformed = true;
                                _input.focus({ field: pickField });
                                inputField = $('.ui-page-active [data-field="' + pickField.Name + '"]');
                                inputButton = inputField.find('.app-data-input-button');
                                if (isDate) {
                                    modalPage = _touch.pageInfo(pickField._dataView).page.addClass('app-page-modal-above-kiosk');
                                    inputField.trigger('vclick');
                                    setTimeout(notify, 0, displayObj._label || pickField.HeaderText, true);
                                    setTimeout(function () {
                                        modalPage.removeClass('app-page-modal-above-kiosk');
                                    }, 200);
                                }
                                else if (inputButton.length)
                                    inputButton.trigger('vclick');
                                else
                                    _input.methods.lookup.click($.Event('vclick', { target: inputField }));
                            }
                        }
                        if (!hasPeformed)
                            notify('pick: ' + performPick, true);
                    }
                    if (!hasPeformed && performShow) {
                        targetDisplayObj = findDisplayObject(performShow);
                        if (targetDisplayObj && !targetDisplayObj.visible) {
                            targetDisplayObj.visible = true;
                            displayState(displayObj, 'checked', performHide != null ? true : null);
                            kioskResize(true);
                            hasPeformed = true;
                        }
                    }
                    if (!hasPeformed && performHide) {
                        targetDisplayObj = findDisplayObject(performHide);
                        if (targetDisplayObj && targetDisplayObj.visible) {
                            targetDisplayObj.visible = false;
                            displayState(displayObj, 'checked', performShow != null ? false : null);
                            kioskResize(true);
                            hasPeformed = true;
                        }
                    }

                }
            if (barcode != null)
                _input.barcode(barcode);
        }
    }

    function navButtonPressed(button) {
        var pager = button.closest('.app-row-pager'),
            container = button.closest('.app-container'),
            config = pager.data('config'),
            pageIndex = config._lastResult.pageIndex;
        configRefreshDataView(config, container, button.is('.app-next') ? ++pageIndex : --pageIndex);
    }

    function numPadButtonPressed(button) {
        button = $(button);
        var numPad = button.closest('.app-numpad'),
            key = button.data('key'),
            keyTestIndex = button.data('test'),
            text = numPad.data('text'),
            numPadKeyEvent,
            textLength, lastChar;
        if (text == null)
            text = '';
        numPadKeyEvent = $.Event('numpadkey.app', { numPad: numPad, key: key, text: text }),
            $document.trigger(numPadKeyEvent);
        if (!numPadKeyEvent.isDefaultPrevented()) {
            key = numPadKeyEvent.key;
            text = numPadKeyEvent.text;
            textLength = text.length;
            if (key === 'BackSpace') {
                if (text.length)
                    text = text.substring(0, textLength - 1);
            }
            else if (key === 'Enter') {
                if (textLength)
                    if (text !== formulaToText(text))
                        text = formulaToText(text);
                    else {
                        _input.barcode(text);
                        text = '';
                    }
            }
            else if (key === 'PlusMinus')
                if (textLength < 1)
                    text = '-';
                else {
                    lastChar = text[textLength - 1];
                    if (text.match(/\W$/))
                        text = text.substring(0, textLength - 1) + (lastChar === '+' ? '-' : '+');
                    else
                        text += '+';
                }
            else if (key === '*') {
                if (textLength) {
                    if (text.match(/\W$/))
                        text = text.substring(0, textLength - 1) + '*';
                    else
                        text += '*';
                }
            }
            else if (key === 'abc') {
                // TODO - show text input survey
            }
            else if (key === 'Clear')
                text = '';
            else if (key != null && (keyTestIndex == null || numPadKeyTests[keyTestIndex](text)))
                text += key;
            setNumPadText(text);
        }
    }

    function formulaToText(text) {
        var termResult = 0, termRegex = /((-|\+).+?)(-|\+|$)/, term, termMult,
            factorResult, factorRegex = /(\*(.+?))(\*|$)/, factor;
        if (!String.isNullOrEmpty(text) && text.substring(1).match(/(-|\+|\*)/)) {
            if (!text.match(/^(-|\+)/))
                text = '+' + text;
            term = text.match(termRegex);
            while (term) {
                factorResult = 1;
                term = term[1];
                text = text.substring(term.length);
                termMult = term[0] === '+' ? 1 : -1;
                term = term.substring(1);
                if (!term.match(/^\*/))
                    term = '*' + term;
                factor = term.match(factorRegex);
                while (factor) {
                    factor = factor[1];
                    term = term.substring(factor.length)
                    factor = factor.substring(1);
                    factorResult *= Number.parseLocale(factor);
                    factor = term.match(factorRegex);
                }
                termResult += termMult * factorResult;
                term = text.match(termRegex);
            }
            text = termResult.toString();
        }
        return text;
    }

    function setNumPadText(text) {
        if (text == null)
            text = '';
        numPadText = text.toString();
        _displayContent.find('.app-numpad').data('text', numPadText).find('.app-text').toggleClass('app-null', !numPadText.length).find('.app-value').text(numPadText);
    }

})();