/*eslint eqeqeq: ["error", "smart"]*/
/*!
* Data Aquarium Framework - Import 
* Copyright 2021 Code On Time LLC; Licensed MIT; http://codeontime.com/license
*/

(function () {
    var _app = $app,
        _touch = _app.touch,
        maxBatchSize = _touch.settings('import.batchSize') || 10,
        resources = Web.DataViewResources,
        resourcesData = resources.Data,
        resourcesMobile = resources.Mobile,
        resourcesImport = resourcesMobile.Import,
        resourcesActions = resources.Actions,
        labelNoRecords = resourcesData.NoRecords,
        labelValidatorRequired = resources.Validator.Required,
        //utilities
        whenPageShown = _touch.whenPageShown,
        whenPageCanceled = _touch.whenPageCanceled,
        findDataView = _app.findDataView;

    function isBusy() {
        var a = arguments;
        if (a.length)
            _touch.busy(a[0]);
        else
            return _touch.busy();
    }

    function timeNow() {
        return new Date().getTime();
    }

    function getExtension(fileName) {
        return fileName.match(/\.(\w+)$/)[1].toLowerCase();
    }

    _app.import = function (method, options) {


        function toError(item) {
            // index: state.index, type: 'submit', command: 'Insert', values: values 
            var errors = _app.import.state.queues.errors,
                row = options.data[item.index - 1], k,
                ar;
            if (!errors.length) {
                ar = [resourcesMobile.Line, resourcesMobile.Error];
                for (k in row)
                    ar.push(k);
                errors.push(_app.csv.toString(ar));
            }
            ar = [item.index + 1, item.error];
            for (k in row)
                ar.push(row[k]);

            errors.push(_app.csv.toString(ar));
        }

        function findColumnValue(columnName, field) {
            var data, i,
                list = options.data,
                dataFormatString = field.DataFormatString;
            for (i = 0; i < Math.min(list.length, 100); i++) {
                data = list[i];
                if (data)
                    data = data[columnName];
                if (data) break;
            }
            if (data && field.Type.match(/^Date/) && typeof data == 'number')
                data = dataFormatString ? String.format(dataFormatString, excelDateToJavaScriptDate(data)) : data.toString();
            return data;
        }

        function fixdata(data) {
            var o = "", l = 0, w = 10240;
            for (; l < data.byteLength / w; ++l) o += String.fromCharCode.apply(null, new Uint8Array(data.slice(l * w, l * w + w)));
            o += String.fromCharCode.apply(null, new Uint8Array(data.slice(l * w)));
            return o;
        }

        function nextColumn(col) {
            var lastLetter = col[col.length - 1];
            if (lastLetter == 'Z') {
                if (col.length - 1 > 0)
                    col = nextColumn(col.substring(0, col.length - 1)) + 'A';
                else
                    col = 'AA';
            }
            else
                col = col.substring(0, col.length - 1) + String.fromCharCode(col.charCodeAt(col.length - 1) + 1);
            return col;
        }

        function ImportError(message) {
            this.message = message;
        }

        function upload() {
            var dataView = options.dataView,
                view = options.view;
            //parentDataView = dataView.get_parentDataView();
            //whenPageShown(iyf);
            _app.survey({
                text: dataView.get_view().Label,
                text2: resourcesActions.Scopes.ActionBar.Import.HeaderText,
                parent: dataView._id,
                context: { id: dataView._id, controller: dataView._controller, view: view },
                controller: 'import_from_file',
                topics: [
                    {
                        description: resourcesImport.SelectFile,
                        wrap: true,
                        questions: [
                            { name: 'file', text: false, type: 'blob' }
                        ]
                    }
                ],
                options: {
                    materialIcon: 'publish',
                    discardChangesPrompt: false,
                    modal: {
                        fitContent: true,
                        max: 'xs',
                        always: true
                    }
                },
                submitText: resourcesMobile.Submit,
                submit: function (e) {
                    var dataView = e.dataView,
                        data = dataView.data(),
                        importContext = dataView.survey().context;


                    function focusOnFile() {
                        if (!isTouchPointer)
                            inputFocus({ fieldName: 'file' });
                    }

                    if (!data.file) {
                        e.preventDefault();
                        _app.alert(resourcesMobile.Files[isTouchPointer ? 'Tap' : 'Drop'], focusOnFile);
                    }
                    else {
                        if (!_app.import('supports', { name: data.file[0].name })) {
                            e.preventDefault();
                            _app.alert(String.format(resourcesImport.NotSupported, data.file[0].name), focusOnFile);
                        }
                        else
                            // continue to close the Submit Import File window until the previous page is displayed
                            whenPageShown(function () {
                                _app.import('parse', {
                                    file: data.file[0], callback: function (objArray) {
                                        _app.import('map', { data: objArray, name: data.file[0].name, context: importContext });
                                    }
                                });
                            });
                    }
                }
            });
        }

        function parse() {
            try {
                var rawData = reader.result,
                    fileData;
                if (getExtension(options.file.name) === 'csv')
                    fileData = $.csv.toObjects(rawData);
                else {
                    fileData = [];
                    var arr = fixdata(rawData),
                        w = XLSX.read(btoa(arr), { type: 'base64' });
                    var ws = w.Sheets[w.SheetNames[0]],
                        wsRef = ws['!ref'], // A1:K80 - example of !ref
                        wsRefInfo = wsRef ? wsRef.match(/(([A-Z]+)(\d+))\:(([A-Z]+)(\d+))/) : null,
                        firstCol, lastCol, col,
                        firstRow, lasRow, row,
                        columns = [],
                        dictionary = [];

                    if (!wsRefInfo)
                        throw new ImportError(labelNoRecords);
                    firstCol = wsRefInfo[2];
                    lastCol = wsRefInfo[5];
                    firstRow = parseInt(wsRefInfo[3]);
                    lastRow = parseInt(wsRefInfo[6]);
                    if (firstRow < lastRow) {
                        row = firstRow + 1;
                        // create a dictionary of column names
                        col = firstCol;
                        while (col != lastCol) {
                            columns.push(col);
                            col = nextColumn(col);
                        }
                        columns.push(col);

                        // create a dictionary of field names
                        columns.forEach(function (col) {
                            var cell = ws[col + firstRow];
                            dictionary.push(cell ? cell.v : null);
                        });
                        while (row <= lastRow) {
                            var obj = {};
                            fileData.push(obj);
                            columns.forEach(function (col, index) {
                                var cell = ws[col + row],
                                    name = dictionary[index];
                                if (name)
                                    obj[name] = cell ? cell.v : null;
                            });
                            row++;
                        }
                    }
                }

                if (fileData.length) {
                    isBusy(false);
                    if (options.callback)
                        options.callback(fileData);
                }
                else
                    throw new ImportError(labelNoRecords);
            }
            catch (ex) {
                isBusy(false);
                _app.alert(ex.message);
            }
        }

        function map(metadata) {
            var context = options.context;
            if (!arguments.length) {
                _app.execute({
                    controller: context.controller, view: context.view || 'createForm1', requiresData: false, success: function (result) {
                        map(result);
                    }
                });
                return;
            }
            var dataView = findDataView(context.id),
                filterFields = (dataView._filterFields || '').split(','),
                fields = metadata.fields,
                loweredImportColumns = [], importColumns = [], columnName, notMappedFields = [],
                viewLabel = dataView.get_view().Label,
                questions = [], questionMap = {};
            for (columnName in options.data[0]) {
                loweredImportColumns.push(columnName.toLowerCase());
                importColumns.push(columnName);
            }
            context.importColumns = importColumns.slice(0);

            // try exact match to the header text or field name
            fields.forEach(function (field) {
                var originalField = field;
                field = fields[field.AliasIndex];
                if (!originalField.Hidden && !field.OnDemand && !originalField.ReadOnly && originalField.Type !== 'DataView') {
                    //field = dataView._allFields[field.AliasIndex];
                    var name = field.Name,
                        text = field.HeaderText,
                        q = {
                            name: name, text: text, causesCalculate: true,
                            items: { style: 'DropDownList', list: [{ value: null, text: resourcesImport.NotMatched }] },
                            value: null, columns: 30, placeholder: resourcesImport.NotMatched, required: !field.AllowNulls && !field.HasDefaultValue
                        },
                        colIndex = loweredImportColumns.indexOf(text.toLowerCase()),
                        filterFieldsIndex = filterFields.indexOf(originalField.Name);
                    if (filterFieldsIndex !== -1) {
                        if (filterFieldsIndex > 0)
                            return;
                        delete q.items;
                        var contextDataView = dataView.context(),
                            headerField = contextDataView.headerField(),
                            contextObj = dataView.context('data');
                        q.value = headerField ? headerField.format(contextObj[headerField.Name]) : nullValueInForms;
                        q.readOnly = true;
                        context.masterKey = [];
                        filterFields.forEach(function (fieldName) {
                            context.masterKey.push({ field: fieldName, newValue: contextObj[originalField.ItemsDataValueField || fieldName], modified: true });
                        });

                    }
                    else {
                        if (colIndex === -1)
                            colIndex = loweredImportColumns.indexOf(name.toLowerCase());
                        if (colIndex === -1)
                            notMappedFields.push(field);
                        else {
                            name = importColumns[colIndex];
                            q.value = name;
                            q.items.list.push({ value: name, text: name });
                            loweredImportColumns.splice(colIndex, 1);
                            importColumns.splice(colIndex, 1);
                        }
                    }
                    questions.push(q);
                    questionMap[q.name] = q;
                }
            });

            function doMatchColumn(f, matchedColumn) {
                var q = questionMap[f.Name];
                q.value = matchedColumn;
                q.items.list.push({ value: matchedColumn, text: matchedColumn });
                importColumns.splice(importColumns.indexOf(matchedColumn), 1);
            }

            function isPartialMatch(s1, s2) {
                return s1.toLowerCase().indexOf(s2.toLowerCase()) !== -1;
            }

            if (notMappedFields.length) {
                // partial mapping of columns to field headers and names
                var i = 0, matchedField, matchedColumn;
                while (i < importColumns.length) {
                    matchedColumn = importColumns[i];
                    matchedField = null;
                    $(notMappedFields).each(function (index) {
                        var f = this;
                        if (isPartialMatch(f.HeaderText, matchedColumn) || isPartialMatch(f.Name, matchedColumn)) {
                            matchedField = f;
                            notMappedFields.splice(index, 1);
                            return false;
                        }
                    });
                    if (matchedField)
                        doMatchColumn(matchedField, matchedColumn);
                    else
                        i++;
                }
                if (notMappedFields.length) {
                    // partial mapping of field headers and names to columns
                    notMappedFields.forEach(function (f) {
                        matchedColumn = null;
                        $(importColumns).each(function () {
                            var c = this;
                            if (c.indexOf(f.HeaderText) !== -1 || c.indexOf(f.Name) !== -1) {
                                matchedColumn = c.toString(); // indexOf will not work correctly otherwise
                                return false;
                            }
                        });
                        if (matchedColumn)
                            doMatchColumn(f, matchedColumn)
                    });
                }
            }

            // Add the remaining unmatched import columns to each question
            questions.forEach(function (q) {
                importColumns.forEach(function (c) {
                    if (q.items)
                        q.items.list.push({ value: c, text: c });
                });
                var value = q.value,
                    field;
                if (value) {
                    field = metadata.map[q.name];
                    q.footer = findColumnValue(value, field);
                }
            });

            context.availableColumns = importColumns;
            context.metadata = metadata;

            _app.survey({
                controller: 'import_map',
                text: viewLabel,
                text2: resourcesActions.Scopes.ActionBar.Import.HeaderText,
                description: String.format(resourcesImport.FileStats, options.data.length, options.name),
                questions: questions,
                options: {
                    modal: {
                        max: 'xs',
                        fitContent: true,
                        always: true
                    },
                    ///discardChangesPrompt: false,
                    materialIcon: 'settings_input_component'
                },
                context: context,
                submit: function (e) {
                    var dataView = e.dataView;
                    options.fieldMap = dataView.data();
                    for (var k in options.fieldMap) {
                        var f = dataView.findField(k);
                        if (!f || f.ReadOnly)
                            delete options.fieldMap[k];
                    }
                    dataView.discard();
                    whenPageShown(function () {
                        whenPageShown(function () {
                            var pageInfo = _touch.pageInfo();
                            whenPageCanceled(function () {
                                if (!pageInfo._canceled)
                                    pageInfo.dataView.survey().cancel();
                            });
                            executeImportStep('init');
                        });
                        _app.survey({
                            controller: 'import_status',
                            options: {
                                modal: {
                                    max: 'xxs',
                                    fitContent: true,
                                    always: true,
                                    buttons: {
                                        more: false,
                                        fullscreen: false
                                    }
                                },
                                contentStub: false
                            },
                            questions: [],
                            layout: String.format('<div style="padding:1em"><div>{0} <b>{1}</b> {2} <b>{3}</b>...</div><div class="app-import-status">&nbsp;<br/>&nbsp;<br/>&nbsp;<br/>&nbsp;</div></div>', resourcesImport.Importing, options.name, resourcesImport.Into, viewLabel),
                            submit: false,
                            cancel: function () {
                                _app.import.state = null;
                            }
                        });
                    });
                },
                submitText: resourcesImport.StartImport,
                calculate: function (e) {
                    var dataView = e.dataView,
                        fields = dataView._fields,
                        //triggeredBy = e.rules.arguments().Trigger,
                        survey = dataView.survey(),
                        context = survey.context,
                        availableColumns = context.importColumns.slice(0),
                        data = dataView.data();

                    fields.forEach(function (f) {
                        if (f.ReadOnly) return;
                        var mappedColumn = data[f.Name],
                            footer = f.FooterText;
                        if (mappedColumn != null) {
                            availableColumns.splice(availableColumns.indexOf(mappedColumn), 1);
                            f.FooterText = findColumnValue(mappedColumn, metadata.map[f.Name]);
                        }
                        else
                            f.FooterText = null;
                        if (footer !== f.FooterText)
                            //setTimeout(function () {
                            //    _app.input.execute({ values: { name: f.Name, value: data[f.Name] } });
                            //});
                            setTimeout(_app.input.execute, 0, { values: { name: f.Name, value: data[f.Name] } });
                    });

                    fields.forEach(function (f) {
                        if (f.ReadOnly) return;
                        var items = f.Items,
                            mappedColumn = data[f.Name];
                        f.ItemCache = null;
                        items.splice(1);
                        if (mappedColumn != null)
                            items.push([mappedColumn, mappedColumn]);
                        availableColumns.forEach(function (col) {
                            items.push([col, col]);
                        });
                    });

                }
            });
        }

        function excelDateToJavaScriptDate(serial) {
            // http://stackoverflow.com/questions/16229494/converting-excel-date-serial-number-to-date-using-javascript
            var utc_days = Math.floor(serial - 25569);
            var utc_value = utc_days * 86400;
            var date_info = new Date(utc_value * 1000);

            var fractional_day = serial - Math.floor(serial) + 0.0000001;

            var total_seconds = Math.floor(86400 * fractional_day);

            var seconds = total_seconds % 60;

            total_seconds -= seconds;

            var hours = Math.floor(total_seconds / (60 * 60));
            var minutes = Math.floor(total_seconds / 60) % 60;

            var serialized = String.format('{0:d4}-{1:d2}-{2:d2}T{3:d2}:{4:d2}:{5:d2}.000Z', date_info.getUTCFullYear(), date_info.getUTCMonth() + 1, date_info.getUTCDate(), hours, minutes, seconds);
            return Date.fromUTCString(serialized);

        }

        function fail(error) {
            var state = _app.import.state;
            state.busy = false;
            state.mode = 'error';
            state.error = error.get_message();
        }

        function executeImportStep() {
            var state = _app.import.state;

            function performResolveRequests() {
                // resolve lookups that have their values figures by other server requests in the same batch 
                resolveRequests.forEach(function (r) {
                    var lookup = queues.lookup[r._ilc.lookupIndex],
                        lookupCacheValue = state.lookupCache[r._ilc.entryKey][r.filter[0].value];
                    if (lookupCacheValue.v != null)
                        lookup.values[r._ilc.valueIndex].newValue = lookupCacheValue.v;
                });
                for (var i = startLookupIndex; i <= endLookupIndex; i++) {
                    var lookup = queues.lookup[i];
                    if (lookup.error)
                        toError(lookup);
                    else
                        queues.submit.push(lookup);
                }
            }

            if (arguments[0] === 'init') {
                _app.import.state = state = options;
                var metadata = state.context.metadata,
                    fields = state.fields = {},
                    fieldMap = state.fieldMap,
                    columnMap = state.columnMap = {};
                // create column mapping
                for (var k in fieldMap) {
                    var columnName = fieldMap[k];
                    if (columnName)
                        columnMap[columnName] = k;
                }
                // process metadata
                state.duplicate = { test: [], accept: [] };
                metadata.fields.forEach(function (f) {
                    fields[f.Name] = f;
                    var tag = f.Tag;
                    if (tag) {
                        if (tag.match(/\bimport-duplicate-test\b/))
                            state.duplicate.test.push(metadata.fields[f.AliasIndex]);
                        if (tag.match(/\bimport-duplicate-accept\b/))
                            state.duplicate.accept.push(f.Name);
                    }
                });
                // setup queues
                state.status = _touch.activePage('.app-import-status');
                state.dataView = findDataView(state.context.id);
                state.index = 0;
                state.count = 0;
                state.lookupCache = {};
                state.queues = {
                    lookup: [],     // lookups waiting to be resolved
                    nextLookup: 0,  // index of the next lookup to be processed
                    test: [],       // duplicate testing
                    submit: [],     // ready to be send out
                    errors: []      // the list of failed rows
                };
                state.started = timeNow();
                state.mode = 'scan';
            }
            else if (state) {
                var queues = state.queues,
                    started = timeNow(),
                    data = state.data,
                    importController = state.context.controller,
                    importView = state.context.view;
                // perform one iteration of data scan 
                if (state.mode === 'scan') {
                    var columnMap = state.columnMap,
                        obj;
                    if (data.length) {
                        //message = 'Scanning records...';
                        while (state.index < data.length) {
                            obj = data[state.index++];
                            var values = [],
                                k, f, fieldName, fieldValue,
                                lookupField, lookupRequests = [], args, errors = [], testFilter = [],
                                duplicateTest = state.duplicate.test;
                            for (k in columnMap) {
                                fieldValue = obj[k];
                                f = state.fields[columnMap[k]];
                                if (f && options.fieldMap[f.Name] === k) {
                                    fieldName = f.Name;
                                    lookupField = f.OriginalIndex !== f.Index ? state.fields[state.context.metadata.fields[f.OriginalIndex].Name] : null;
                                    if (fieldValue == null) {
                                        if (lookupField)
                                            f = lookupField;
                                        values.push({ field: f.Name, newValue: fieldValue, modified: true });
                                        if (duplicateTest.indexOf(f) !== -1)
                                            errors.push(fieldName + ': ' + labelValidatorRequired);

                                    }
                                    else {
                                        if (lookupField) {
                                            fieldName = lookupField.Name;
                                            if (fieldValue === '')
                                                fieldValue = null;
                                            else {
                                                var lookupController = lookupField.ItemsDataController,
                                                    lookupView = lookupField.ItemsDataView,
                                                    lookupDataTextField = lookupField.ItemsDataTextField,
                                                    lookupDataValueField = lookupField.ItemsDataValueField,
                                                    lookupEntryKey = lookupController + '_' + lookupView + '_' + lookupDataValueField + '_' + lookupDataTextField,
                                                    lookupCacheEntry = state.lookupCache[lookupEntryKey],
                                                    lookupCacheValue, lookupRequestDef;
                                                if (!lookupCacheEntry)
                                                    lookupCacheEntry = state.lookupCache[lookupEntryKey] = {};
                                                lookupCacheValue = lookupCacheEntry[fieldValue];
                                                if (lookupCacheValue && lookupCacheValue.v != null)
                                                    fieldValue = lookupCacheValue.v;
                                                else if (lookupDataValueField) {
                                                    args = { controller: lookupController, view: lookupView, filter: [{ field: lookupDataTextField, value: fieldValue }] };
                                                    args.fieldFilter = [lookupDataValueField, lookupDataTextField];
                                                    lookupRequestDef = { valueIndex: values.length, args: args, entryKey: lookupEntryKey };
                                                    lookupRequests.push(lookupRequestDef);
                                                    if (lookupCacheValue)
                                                        lookupRequestDef.resolve = true;
                                                    else
                                                        lookupCacheValue = lookupCacheEntry[fieldValue] = { v: null };
                                                    fieldValue = null;
                                                }
                                            }
                                        }
                                        else {
                                            if (fieldValue === '')
                                                fieldValue = null;
                                            else {
                                                if (typeof fieldValue == 'number' && f.Type.match(/^Date/))
                                                    fieldValue = excelDateToJavaScriptDate(fieldValue);
                                                else if (typeof fieldValue == 'string' && fieldValue && f.Type !== 'String') {
                                                    var fv = { NewValue: fieldValue },
                                                        error = state.dataView._validateFieldValueFormat(state.fields[fieldName], fv);
                                                    if (error)
                                                        errors.push(f.HeaderText + ': ' + error);
                                                    else {
                                                        fieldValue = fv.NewValue;
                                                        if (typeof fieldValue == 'number' && f.Type.match(/^Date/))
                                                            fieldValue = new Date(fieldValue);
                                                    }
                                                }
                                            }
                                        }
                                        values.push({ field: fieldName, newValue: fieldValue, modified: true });
                                        if (duplicateTest.indexOf(f) !== -1)
                                            testFilter.push({ field: f.Name, value: obj[k] });
                                    }
                                }
                            }
                            var masterKey = state.context.masterKey,
                                item = { index: state.index, type: 'submit', command: 'Insert', values: values };
                            if (masterKey)
                                masterKey.forEach(function (fv) {
                                    values.push(fv);
                                });
                            if (errors.length) {
                                item.error = errors.join('\n');
                                toError(item);
                            }
                            else if (testFilter.length) {
                                if (lookupRequests.length)
                                    item.requests = lookupRequests;
                                item.filter = testFilter;
                                queues.test.push(item);
                            }
                            else if (lookupRequests.length) {
                                item.type = 'lookup';
                                item.requests = lookupRequests;
                                queues.lookup.push(item);
                            }
                            else
                                queues.submit.push(item);
                            if (timeNow() - started > 8)
                                break;
                        }
                    }
                    state.mode = 'send';
                }
                else
                    // perform one iteration of import/lookup 
                    if (state.mode === 'send') {
                        if (!state.busy) {
                            if (queues.submit.length) {
                                // submit insert/update commands
                                state.busy = true;
                                var insertRequests = [], noValuesCount = 0;
                                $(queues.submit).each(function (index) {
                                    if (index >= maxBatchSize) return false;
                                    var r = this, i, values = [], fv, hasValues;
                                    for (i = 0; i < r.values.length; i++) {
                                        fv = r.values[i];
                                        if (fv) {
                                            values.push(fv);
                                            if (fv.newValue != null)
                                                hasValues = true;
                                        }
                                    }
                                    if (hasValues)
                                        insertRequests.push({ command: r.command, controller: importController, view: importView, values: values, _src: r }); // submit request context
                                    else
                                        noValuesCount++;
                                });
                                queues.submit.splice(0, insertRequests.length + noValuesCount);
                                state.count += noValuesCount;
                                if (insertRequests.length) {
                                    state.message = resourcesImport.InsertingRecords;
                                    _app.execute({
                                        batch: insertRequests,
                                        done: function (result) {
                                            var state = _app.import.state;
                                            state.busy = false;
                                            state.count += insertRequests.length;
                                            insertRequests.forEach(function (ir, index) {
                                                var r = result[index];
                                                if (r.errors.length) {
                                                    ir._src.error = r.errors.join('\n');
                                                    toError(ir._src);
                                                }
                                            });
                                        },
                                        fail: fail
                                    });
                                }
                                else
                                    state.busy = false;
                            }
                            else if (queues.test.length) {
                                // test for duplicates
                                state.busy = true;
                                state.message = resourcesImport.TestingRecords;
                                var testRequests = [],
                                    accept = state.duplicate.accept;
                                $(queues.test).each(function (index) {
                                    if (index >= maxBatchSize) return false;
                                    var r = this;
                                    testRequests.push({ controller: importController, view: importView, filter: r.filter, requiresRowCount: false, fieldFilter: ['_pk_only'], _trc: r }); // _trc = test request context
                                });
                                queues.test.splice(0, testRequests.length);
                                _app.execute({
                                    batch: testRequests,
                                    done: function (result) {
                                        var state = _app.import.state;
                                        state.busy = false;
                                        result.forEach(function (r, index) {
                                            var data = r[importController],
                                                test = testRequests[index]._trc;
                                            if (!data.length)
                                                if (test.requests) {
                                                    test.requests.forEach(function (r) {
                                                        r.resolve = false; // do not resolve previously cashed lookups here
                                                    });
                                                    queues.lookup.push(test);
                                                }
                                                else
                                                    queues.submit.push(test);
                                            else if (accept.length)
                                                if (data.length === 1) {
                                                    test.command = 'Update';
                                                    var values = test.values, pk, vCount = 0;
                                                    values.forEach(function (fv, index) {
                                                        if (accept.indexOf(fv.field) === -1)
                                                            values[index] = null;
                                                        else
                                                            vCount++;
                                                    });
                                                    if (vCount) {
                                                        var lookupRequests = test.requests;
                                                        for (pk in data[0])
                                                            values.push({ field: pk, oldValue: data[0][pk], modified: false });
                                                        if (lookupRequests) {
                                                            var i = 0;
                                                            while (i < lookupRequests.length) {
                                                                var lr = lookupRequests[i];
                                                                lr.resolve = false; // do not resolve previously cashed lookups here
                                                                if (values[lr.valueIndex])
                                                                    i++;
                                                                else
                                                                    lookupRequests.splice(i, 1);
                                                            }
                                                        }
                                                        if (lookupRequests && lookupRequests.length)
                                                            queues.lookup.push(test);
                                                        else
                                                            queues.submit.push(test);
                                                    }
                                                }
                                                else {
                                                    test.error = resourcesImport.Duplicates + ': ' + data.length;
                                                    toError(test);
                                                }
                                        });
                                    }
                                });
                            }
                            else if (queues.nextLookup < queues.lookup.length) {
                                // resolve lookup values
                                state.busy = true;
                                lookupRequests = [];
                                var resolveRequests = [],
                                    startLookupIndex = queues.nextLookup,
                                    endLookupIndex,
                                    lookupIndex,
                                    processedLookupCount = 10;
                                while (processedLookupCount-- > 0) {
                                    lookupIndex = queues.nextLookup++;
                                    queues.lookup[lookupIndex].requests.forEach(function (r) {
                                        r.args._ilc = { lookupIndex: lookupIndex, valueIndex: r.valueIndex, entryKey: r.entryKey }; // "_ilc" = "import lookup context"
                                        if (r.resolve)
                                            resolveRequests.push(r.args);
                                        else
                                            lookupRequests.push(r.args);
                                    });
                                    if (lookupIndex === queues.lookup.length - 1)
                                        break;
                                }
                                endLookupIndex = queues.nextLookup - 1;
                                state.message = resourcesImport.ResolvingReferences;

                                if (lookupRequests.length)
                                    _app.execute({
                                        batch: lookupRequests,
                                        done: function (result) {
                                            var state = _app.import.state,
                                                queues = state.queues;
                                            state.busy = false;
                                            result.forEach(function (r, index) {
                                                var lr = lookupRequests[index],
                                                    obj = r[lr.controller],
                                                    lookupIndex = lr._ilc.lookupIndex,
                                                    lookup = queues.lookup[lookupIndex],
                                                    lookupCacheValue = state.lookupCache[lr._ilc.entryKey][lr.filter[0].value];
                                                if (obj && obj.length)
                                                    lookupCacheValue.v = lookup.values[lr._ilc.valueIndex].newValue = obj[0][r.primaryKey[0].Name];
                                                else
                                                    lookup.error = String.format('{0}: {1} = "{2}"', resourcesMobile.DidNotMatch, r.map[lr.filter[0].field].Label, lr.filter[0].value);
                                            });
                                            performResolveRequests();
                                        },
                                        fail: fail
                                    });
                                else {
                                    state.busy = false;
                                    performResolveRequests();
                                }
                            }
                            else if (queues.test.length) {
                                state.mode = 'done';
                            }
                            // stop making server calls and keep scanning if there is more data to process
                            if (state.index < data.length)
                                state.mode = 'scan';
                            else if (!queues.submit.length && queues.nextLookup >= queues.lookup.length && !queues.test.length && !state.busy)
                                state.mode = 'done';
                        }
                    }
                    else if (state.mode === 'error') {
                        message = state.error;
                    }
                // update status and continue processing
                var nt = timeNow(),
                    t = new Date(timeNow() - state.started);
                state.status.html(String.format('{0:N1}% {1}<br/>{2}...<br/>{3}: {4}<br/>{5}: {6}',
                    state.count / data.length * 100, resourcesImport.Complete, state.message || resourcesImport.TestingRecords, resourcesImport.Expected,
                    t < 60000 ? resourcesMobile.Dates.InAMin : _touch.toSmartDate(new Date(nt + Math.round(t / (state.count || 1) * (data.length - state.count)))),
                    resourcesImport.Remaining, data.length - state.count));
                if (state.mode === 'done') {
                    _touch.pageInfo()._canceled = true;
                    var dataView = state.dataView;
                    _touch.goBack(function () {
                        if (queues.errors.length)
                            _app.saveFile('errors_' + options.name + '.csv', queues.errors.join('\r\n'), 'text/csv');
                        setTimeout(function () {
                            _app.alert(String.format('{0} <b>{1}</b> {2} <b>{3}</b>.', resourcesImport.Done, options.name, resourcesImport.Into, dataView.get_view().Label), function () {
                                _touch.sync(options.context.id);
                            });
                        });
                    });
                    state = null;
                }
            }
            if (state && state.mode !== 'error')
                setTimeout(executeImportStep, 32);
        }


        // dispatch the method 
        if (method === 'upload')
            upload();
        else if (method === 'supports') {
            extension = options.name.match(/\.(\w+)$/);
            return extension && !!extension[1].match(/^(csv|xlsx|xls)/i);
        }
        else if (method === 'parse') {
            isBusy(true);
            $('.app-glass-pane').addClass('app-glass-pane-reject');
            //$('<span>Loading...</span>').appendTo(); ^^^
            var reader = new FileReader(),
                f = options.file;
            if (getExtension(f.name) === 'csv')
                reader.readAsText(f);
            else
                reader.readAsArrayBuffer(f);
            reader.onload = function () {
                try {
                    if ($.csv)
                        parse();
                    else
                        $.getScript(__baseUrl + 'js/lib/import.min.js', parse);
                }
                catch (er) {
                    isBusy(false);
                    _app.alert(er.message);
                }
            };
            reader.onerror = function (er) {
                isBusy(false);
                _app.alert(er.message);
            };
        }
        else if (method === 'map')
            map();
    };

})();