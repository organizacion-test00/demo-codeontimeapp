/*eslint eqeqeq: ["error", "smart"]*/
/*!
* Data Aquarium Framework - Search 
* Copyright 2021 Code On Time LLC; Licensed MIT; http://codeontime.com/license
*/

(function () {
    var _app = $app,
        _touch = _app.touch,
        $document = $(document),
        resources = Web.DataViewResources,
        resourcesData = resources.Data,
        resourcesDataFilters = resourcesData.Filters,
        resourcesMobile = resources.Mobile,
        resourcesGrid = resources.Grid,
        labelSearch = resourcesGrid.PerformAdvancedSearch,
        labelValidatorRequired = resources.Validator.Required,
        feedbackDelay = 34,
        //utilities
        whenPageShown = _touch.whenPageShown,
        whenPageCanceled = _touch.whenPageCanceled,
        findActivePage = _touch.activePage,
        findDataView = _app.findDataView,
        // html utilities
        htmlUtilities = _app.html,
        htmlTag = htmlUtilities.tag,
        div = htmlUtilities.div,
        span = htmlUtilities.span,
        $htmlTag = htmlUtilities.$tag,
        $p = htmlUtilities.$p,
        $div = htmlUtilities.$div,
        $span = htmlUtilities.$span,
        $a = htmlUtilities.$a,
        $i = htmlUtilities.$i,
        $li = htmlUtilities.$li,
        $ul = htmlUtilities.$ul;

    function activeDataView() {
        return _touch.dataView();
    }

    function resetPageHeight() {
        _touch.resetPageHeight();
    }

    function quickFind(dataView, query) {
        dataView.extension().quickFind(query);
    }

    function notifyDataFilterChanged(dataView) {
        var text = dataView.extension().filterStatus(true, false);
        touch.notify({ dataView: dataView, text: text || resourcesMobile.FilterCleared });
    }


    // ------------------------------------
    // Advanced Search API event handlers
    // ------------------------------------

    $document.on('searchperform.dataview.app', function (e) {
        var dataView = e.dataView,
            survey = e.survey,
            filterBy = survey.context.field,
            searchOnStart = survey.context.start,
            data = dataView.data(),
            quickFind = data.QuickFind,
            searchInDataView = survey.context.id,
            args;
        if ('QuickFind' in data) {
            var selectedSuggestion = findActivePage('li.app-selected').attr('data-text');
            if (selectedSuggestion != null) {
                var complexParam = quickFind ? quickFind.match(/(\"?(\S+)\:)\S*/) : null;
                data.QuickFind = complexParam ? ('"' + complexParam[2] + ':' + selectedSuggestion.substring(1)) : selectedSuggestion;
            }
        }
        args = _app._search('parse', { id: searchInDataView, data: data, field: filterBy, showErrors: true });
        if (!args.errors.length) {
            _touch.pageInfo(dataView)._canceled = true;
            _touch.transitions(false);
            _touch.settings('ui.transitions.style', 'none');
            whenPageShown(function () {
                _touch.transitions(true);
                _app._search('execute', args);
            });
        }
        else
            e.preventDefault();
    }).on('searchgenerate.dataview.app', function (e) {
        _app._search('generate', { id: e.survey.context.id, survey: e.survey });
    }).on('searchreset.dataview.app', function (e) {
        _app.confirm(resourcesMobile.ResetSearchConfirm, function () {
            _app._search('reset', { id: e.survey.context.id });
        });
        return false;
    }).on('searchcalculate.dataview.app', function (e) {
        var trigger = e.rules.trigger(),
            triggerMatch,
            dataView = e.dataView,
            survey = e.survey,
            data = dataView.data(),
            field, fieldName, fieldValue, searchInDataView,
            newValue = data[trigger];
        if (trigger) {
            // toggle basket mode for a question when operation is $in or $notin
            if (trigger.match(/_op$/)) {
                fieldName = trigger.substring(0, trigger.length - 3); // remove "_op"
                fieldValue = data[fieldName];
                field = dataView.findField(fieldName);
                if (field) {
                    var itemsTargetController = field.ItemsTargetController,
                        targetControllerChanged,
                        itemsStyle = field.ItemsStyle,
                        styleChanged;
                    if (field.lov('static'))
                        field.ItemsStyle = field.Extended.itemsStyle;
                    else
                        field.ItemsStyle = newValue && newValue.match(/^(=|<>|\$in|\$notin)$/) && field.FilterType === 'Text' && field.Extended.autoComplete !== false ? 'AutoComplete' : null;
                    field.ItemsTargetController = (newValue === '$in' || newValue === '$notin') ? '_basket' : null;
                    targetControllerChanged = field.ItemsTargetController !== itemsTargetController;
                    styleChanged = field.ItemsStyle !== itemsStyle;
                    if (targetControllerChanged) {
                        fieldValue = data[fieldName];
                        if (itemsTargetController) {
                            field.Items = [];
                            if (fieldValue != null) {
                                fieldValue = _app.csv.toArray(fieldValue);
                                if (fieldValue.length)
                                    fieldValue = fieldValue[0];
                            }
                        }
                        else if (fieldValue != null) {
                            field.Items = [[fieldValue, fieldValue]];
                            if (field.is('lookup-distinct'))
                                field.Items[0].push(null);
                        }
                    }
                    if (styleChanged || targetControllerChanged)
                        _app.input.execute({ values: { name: fieldName, value: fieldValue } });
                }
                return;
            }
            searchInDataView = survey.context.id;
            // add condition to match
            triggerMatch = trigger.match(/^_Match(\d+)_addCondition$/);
            if (triggerMatch)
                //setTimeout(function () {
                //    _app._search('addCondition', { id: searchInDataView, match: parseInt(triggerMatch[1]), condition: data[trigger] });
                //});
                setTimeout(_app._search, 0, 'addCondition', { id: searchInDataView, match: parseInt(triggerMatch[1]), condition: data[trigger] });
            // change match filter type
            triggerMatch = trigger.match(/^_Match(\d+)(_filters)?$/);
            if (triggerMatch) {
                var index = parseInt(triggerMatch[1]);
                //setTimeout(function () {
                //    _app._search('changeMatch', { id: searchInDataView, match: index, type: data['_Match' + index], filters: data['_Match' + index + '_filters'] });
                //});
                setTimeout(_app._search, 0, 'changeMatch', { id: searchInDataView, match: index, type: data['_Match' + index], filters: data['_Match' + index + '_filters'] });
            }
            // add a match
            if (trigger === '_Match_addGroup')
                //setTimeout(function () {
                //    _app._search('addGroup', { id: searchInDataView, type: data[trigger] });
                //});
                setTimeout(_app._search, 0, 'addGroup', { id: searchInDataView, type: data[trigger] });
        }
    }).on('quickfindshow.dataview.app', function (e) {
        _app._search('toggle', e.survey.context.id);
        return false;
    }).on('quickfindautocomplete.dataview.app', function (e) {
        var inputData = e.inputData;
        _app._search('autoComplete', { id: activeDataView().survey().context.id, dataInput: _app.input.of(inputData.input/*.closest('[data-input]')*/), value: inputData.value, keyboard: inputData.keyboard });
    }).on('vclick', '.app-bar-history', function (e) {
        var li = $(e.target).closest('li'),
            t = li.data('text');
        if (t != null) {
            $(document.activeElement).blur();
            li.closest('ul').find('.app-selected').removeClass('app-selected');
            li.addClass('app-selected');
            setTimeout(_app.action, feedbackDelay, { path: 'form/submit' });
        }
        return false;
    }).on('populateexternalfilter.dataview.app', function (e) {
        // expand external filter when advanced search is perform in a child dataview.
        var dataView = activeDataView(),
            survey = dataView.survey(),
            context;
        if (survey) {
            context = survey.context;
            if (context && context.id === survey.parent) {
                dataView = findDataView(context.id);
                if (dataView)
                    (dataView._externalFilter || '').forEach(function (fv) {
                        e.externalFilter.push(fv);
                    });
            }
        }
    });

    function doCustomSearch(dataView) {
        var searchActionPath = dataView._hasSearchAction,
            context = [], oldScope,
            saveTotalRowCount = dataView._totalRowCount,
            searchItem;

        if (searchActionPath) {
            dataView._totalRowCount = 0;
            oldScope = _touch.contextScope();
            _touch.contextScope(dataView);
            _touch.navContext(context);
            _touch.contextScope(oldScope);
            dataView._totalRowCount = saveTotalRowCount;
            context.every(function (item) {
                if (item.path === searchActionPath)
                    searchItem = item;
                return searchItem == null;
            });
            if (searchItem) {
                if (dataView.get_searchOnStart()) {
                    dataView.set_searchOnStart(false);
                    dataView._requiresContextRefresh = true;
                }
                controllerActionCallback(searchItem.context);
                return true;
            }
        }
    }

    _app._search = function (method, options) {

        // Sample Search Model
        //var sampleModel = [
        //    {
        //        type: '$matchany',
        //        fields: [
        //            { field: 'field1', operator: '=', value: 48 },
        //            { field: 'field2', operator: '$contains' },
        //            { field: 'field3', operator: '$isblank' }
        //        ]
        //    },
        //    {
        //        type: '$matchall',
        //        matches: [
        //            { field: 'field1', operator: '=', value: 48 },
        //            { field: 'field2', operator: '$contains' },
        //            { field: 'field3', operator: '$isblank' }
        //        ]
        //    }
        //];

        var mode, newMode,
            dataView;
        if (!method || typeof method != 'string')
            method = 'show';
        // identify the data view in the argument
        if (!options)
            dataView = _touch.contextDataView();
        else if (typeof options == 'string')
            dataView = findDataView(options);
        else if (options._controller)
            dataView = options;
        else
            dataView = findDataView(options.id);
        if (dataView && doCustomSearch(dataView)) return;

        function maxWidth() {
            return _touch.density() === 12 || _touch.screen().width < 480 ? 'xs' : '';
        }

        function createMatchField(match, f) {
            var searchOptions = f._dataView._allFields[f.OriginalIndex].SearchOptions,
                mf = { field: f.Name, operator: searchOptions ? searchOptions[0] : '=' };
            match.fields.push(mf);
        }

        function canSearch(f) {
            return f.is('search-mode') !== 'forbidden' && !f.OnDemand && f.AllowQBE !== false && f.Type !== 'DataView';
        }

        function enumerateAvailableFields(match) {
            var allFields = dataView._allFields,
                matchFields = match.fields,
                matchAvailable = match.available;
            // ensure that we have some conditions if search mode is not specified for any of the fields
            if (!matchFields.length)
                $(dataView._fields).each(function () {
                    var f = this;
                    if (canSearch(f)) {
                        f = allFields[f.AliasIndex];
                        if (matchFields.length === 3)
                            return false;
                        else
                            createMatchField(match, f);
                    }
                });
            // enumerate unused searchable or unhidden fields
            var matchFieldMap = {};
            matchFields.forEach(function (mf) {
                matchFieldMap[mf.field] = true;
            });
            allFields.forEach(function (f) {
                var searchMode = f.is('search-mode'), fieldName;
                if (searchMode && searchMode !== 'forbidden' || !searchMode && !f.Hidden && canSearch(f)) {
                    f = allFields[f.AliasIndex];
                    fieldName = f.Name;
                    if (!matchFieldMap[fieldName] && matchAvailable.indexOf(fieldName === -1))
                        match.available.push(fieldName);
                }
            });
        }

        function generateMatch(filterBy, id, type) {
            var match = { id: id, type: type || '$matchall', filters: '$showfilters', fields: [], available: [] },
                matchMap,
                filterByField = filterBy ? dataView._allFields[dataView.findField(filterBy).AliasIndex] : null;

            dataView._allFields.forEach(function (f) {
                var searchMode = f.is('search-mode');
                if (filterBy && filterByField == f || !filterBy && (searchMode === 'required' || searchMode === 'suggested') && canSearch(f)) {
                    f = f._dataView._allFields[f.AliasIndex];
                    createMatchField(match, f);
                }
            });
            if (!filterBy)
                enumerateAvailableFields(match);
            return match;
        }

        function generateModel(data, filterBy) {
            var model = [],
                matchCount = 1,
                match, matchName = '_Match1', condition,
                matchType = data[matchName],
                allFields = dataView._allFields;
            if (filterBy)
                model.push(generateMatch(filterBy, 1));
            else {
                if (matchType)
                    while (matchType) {
                        match = { id: matchCount, type: matchType, filters: '$showfilters', fields: [], available: [] };
                        var matchFieldMap = {}, fieldName;
                        allFields.forEach(function (f) {
                            if (canSearch(f)) {
                                f = allFields[f.AliasIndex];
                                fieldName = f.Name;
                                condition = data['_Match' + matchCount + '_' + fieldName + '_op'];
                                if (condition && !matchFieldMap[fieldName]) {
                                    match.fields.push({ field: fieldName, operator: condition });
                                    matchFieldMap[fieldName] = true;
                                }
                            }
                        });
                        enumerateAvailableFields(match);
                        model.push(match);
                        matchType = data['_Match' + (++matchCount).toString()];
                    }
                else
                    model.push(generateMatch(null, 1));
            }
            return model;
        }

        function parse() {
            var allFields = dataView._allFields,
                data = options.data,
                filterBy = options.field,
                result = { id: options.id, data: data, field: filterBy, start: options.start, filter: [], find: data.QuickFind, errors: [] },
                resultFilter = result.filter,
                matches = [], conditions = [], n, lastMatchGroup;
            for (n in data)
                if (n.match(/^_match\d+$/i))
                    matches.push(n);
                else
                    conditions.push(n);
            if (!matches.length)
                matches.push('');

            // TODO: detect QuickFind request and copy it to the result.find property

            matches.forEach(function (matchGroup, groupIndex) {
                var test = new RegExp('^(' + (matchGroup ? matchGroup + '_' : '') + '.+?)_op$'),
                    matchType = data[matchGroup] || '$matchall';

                if (!matchGroup && !filterBy)
                    // inject "implied" equal operations into "data" for field values when match groups are not detected
                    allFields.forEach(function (f) {
                        f = allFields[f.AliasIndex];
                        var fieldName = f.Name;
                        if (data[fieldName] != null && data[fieldName + '_op'] == null)
                            data[fieldName + '_op'] = '=';
                    });

                conditions.forEach(function (condition) {
                    var m = condition.match(test), op, opName, opCount = 1, v, v2,
                        requiresValues, fieldName, conditionName, field;
                    if (m) {
                        opName = m[0];
                        while (data[opName] != null) {
                            op = data[opName];
                            opName = m[0] + (++opCount).toString();
                        }
                        if (op) {
                            requiresValues = _app.filterOpValueRequired(op);// op.match(/^(=|<>|<|>|<=|>=|(\$(between|in|notin|beginswith|doesnotbeginwith|contains|doesnotcontain|endswith|doesnotendwith)))$/);
                            conditionName = m[1];
                            v = data[conditionName];
                            v2 = data[conditionName + '_v2'];
                            fieldName = matchGroup ? conditionName.substring(matchGroup.length + 1) : conditionName;
                            field = dataView.findField(fieldName);
                            // analyze variables and create a filter condition
                            if (field && (!filterBy || allFields[field.OriginalIndex].Name == filterBy) && (!requiresValues || (v != null || v2 != null))) {
                                if (requiresValues) {
                                    if (op === '$between') {
                                        if (v == null) {
                                            op = '<=';
                                            v = v2;
                                        }
                                        else if (v2 == null)
                                            op = '>=';
                                        else if (v2 < v)
                                            v2 = [v, v = v2][0];
                                    }
                                    else
                                        if (v == null)
                                            v = v2;

                                    if (op === '$in' || op === '$notin') {
                                        v = _app.csv.toArray(v.toString());
                                        v.forEach(function (s, index) {
                                            v[index] = dataView.convertFieldValueToString(field, s)
                                        });
                                        v = v.join('$or$');
                                    }
                                    else {
                                        v = dataView.convertFieldValueToString(field, v);
                                        if (op === '$between')
                                            v = v + '$and$' + dataView.convertFieldValueToString(field, v2);
                                    }
                                }
                                else
                                    v = '';
                                if (op.match(/^\$/))
                                    op += '$';
                                if (lastMatchGroup != matchGroup) {
                                    if (!filterBy) {
                                        var matchTypeInfo = matchType.match(/(match|donotmatch)(all|any)/);
                                        if (matchTypeInfo)
                                            resultFilter.push('_' + matchTypeInfo[1] + '_:$' + matchTypeInfo[2] + '$')
                                    }
                                    lastMatchGroup = matchGroup;
                                }
                                resultFilter.push(field.Name + ':' + op + v);
                            }
                        }
                    }
                });

            });
            if (!filterBy) {
                var searchDataView = activeDataView();
                if (searchDataView != dataView)
                    searchDataView._allFields.forEach(function (f) {
                        if (f.Extended && f.Extended.required) {
                            var op = data[f.Name + '_op'];
                            if (op && _app.filterOpValueRequired(op) && data[f.Name] == null)
                                result.errors.push({ field: f.Name, error: labelValidatorRequired });
                        }
                    });
            }

            if (options.showErrors && result.errors.length)
                inputFocus({ fieldName: result.errors[0].field, message: result.errors[0].error });
            return result;
        }

        function execute() {
            var dataViewId = options.id,
                //dataView = findDataView(dataViewId),
                data = options.data,
                start = options.start,
                filterBy = options.field,
                newFilter = options.filter;

            // TODO: process "filter" argument here
            if (filterBy) {
                dataView.removeFromFilter(dataView._allFields[dataView.findField(filterBy).AliasIndex]);
                newFilter.forEach(function (filterText) {
                    dataView._filter.push(filterText);
                });
                _touch.dataFilter(dataView);
            }
            else {
                if (!options.keepFilter)
                    dataView.clearFilter();
                newFilter = newFilter.length ? newFilter : null;
                dataView.asearch('filter', newFilter);
                dataView.asearch('active', newFilter != null);
                if ('QuickFind' in data) {
                    var query = data.QuickFind;
                    if (query == null && start)
                        _touch.sync(dataViewId);
                    else
                        quickFind(dataView, query);
                    notifyDataFilterChanged(dataView);
                }
                else
                    _touch.dataFilter(dataView);
            }
        }

        function addCondition() {
            var searchDataView = activeDataView(),
                context = searchDataView.survey().context,
                newSurvey = JSON.parse(context.base),
                model = context.model,
                match = model[options.match - 1];
            // add new field condition in the match
            match.available.splice(match.available.indexOf(options.condition), 1);
            createMatchField(match, dataView.findField(options.condition));
            // generate survey
            options.survey = newSurvey;
            generate(model, searchDataView.data());
            // refresh the current survey dataview
            _app.survey('refresh', newSurvey, function (newForm) {
                resetPageHeight();
                if (!_touch.pointer('touch')) {
                    var fieldToFocus = '_Match' + options.match + '_' + options.condition;
                    if (!searchDataView.findField(fieldToFocus))
                        fieldToFocus += '_op'
                    newForm.find('[data-control="label"][data-field="' + fieldToFocus + '"]').trigger('vclick');
                    //_input._refocus(false); // prevent refocus of the addCondition or addMatch input
                }
            });
        }

        function addGroup() {
            var searchDataView = activeDataView(),
                context = searchDataView.survey().context,
                newSurvey = JSON.parse(context.base),
                model = context.model;
            // add new match of the specified type to the model
            model.push(generateMatch(null, model.length + 1, options.type));
            // generate survey
            options.survey = newSurvey;
            generate(model, searchDataView.data());
            // refresh the current survey dataview
            _app.survey('refresh', newSurvey, function (newForm) {
                resetPageHeight();
                focusMatch(newForm, model.length);
            });
        }

        function enumerateFieldsForTopValues() {
            var list = [],
                allFields = dataView._allFields;
            allFields.forEach(function (f) {
                if (f.is('search-option-top-values'))
                    list.push(f);
            });
            if (!list.length)
                allFields.forEach(function (f) {
                    var aliasField = allFields[f.AliasIndex];
                    if (f.ItemsDataController && list.length < 3 && aliasField.Type == 'String' && !(f.AllowAutoComplete == false || f.AllowMultipleValues == false))
                        list.push(aliasField);
                });
            return list;
        }

        function changeMatch() {
            var searchDataView = activeDataView(),
                context = searchDataView.survey().context,
                newSurvey = JSON.parse(context.base),
                model = context.model,
                match = model[options.match - 1],
                showFilters = options.filters, n, data;
            match.type = options.type;
            // reset context for auto-complete fields based all/any type of matching
            match.fields.forEach(function (cf) {
                var f = searchDataView.findField('_Match' + match.id + '_' + cf.field);
                if (f.Extended && f.Extended.context) {
                    f.ContextFields = match.type.match(/any/) ? null : f.Extended.context;
                    f._dataView.sessionRemove(lovKey(f)/*f.Name + '_listOfValues_'*/);
                }
            });
            // restracture the fields of the match to reflect the condition filter type (standard or top 5/10)
            if (showFilters && showFilters != match.filters) {
                match.filters = showFilters;
                data = searchDataView.data();
                // clear match data
                for (var n2 in data) {
                    if (n2.startsWith('_Match' + match.id + '_'))
                        delete data[n2];
                }
                delete data['_Match' + match.id];
                // restructure the fields of the match
                if (showFilters === '$showfilters') {
                    var newMatch = generateMatch();
                    match.fields = newMatch.fields;
                }
                else {
                    match.fields = [];
                    enumerateFieldsForTopValues().forEach(function (f) {
                        match.fields.push({ field: f.Name, operator: '$in' });
                    });
                }
                // generate survey
                options.survey = newSurvey;
                generate(model, data);
                // refresh the current survey dataview
                _app.survey('refresh', newSurvey, function (newForm) {
                    resetPageHeight();
                    focusMatch(newForm, match.id);
                });
            }
        }

        function focusMatch(newForm, id) {
            if (!_touch.pointer('touch'))
                newForm.find('[data-field="_Match' + id + '"]').closest('[data-container]').next().find('[data-control="label"]').first().trigger('vclick');
        }

        function reset() {
            var context = activeDataView().survey().context,
                newSurvey = JSON.parse(context.base);
            // generate survey
            options.survey = newSurvey;
            generate(context.model = [generateMatch(null, 1)], {});
            // refresh the current survey dataview
            _app.survey('refresh', newSurvey, function (newForm) {
                resetPageHeight();
                focusMatch(newForm, 1);
            });
        }

        function generate(model, data) {
            var survey = options.survey,
                surveyContext = survey.context,
                allFields = dataView._allFields,
                fieldsForTopValues = enumerateFieldsForTopValues(),
                filterBy = surveyContext.field,
                filterByOp, filterByVal,
                layout = [],
                questions = [],
                defaultModel;
            if (!data)
                data = dataView.data(filterBy ? 'filter' : 'search');

            if (!surveyContext.base)
                surveyContext.base = JSON.stringify(survey);
            if (!model) {
                model = generateModel(data, filterBy);
                if (!filterBy) {
                    defaultModel = generateModel({})[0];
                    model.forEach(function (m) {
                        var defaultFields = defaultModel.fields.slice(0),
                            missingFields = [];
                        m.fields.forEach(function (modelField) {
                            var missing = true,
                                i, j;
                            for (i = 0; i < defaultFields.length; i++)
                                if (defaultFields[i].field === modelField.field) {
                                    defaultFields[i] = modelField;
                                    missing = false;
                                    break;
                                }
                            if (missing)
                                missingFields.push(modelField);
                        });
                        for (i = 0; i < missingFields.length; i++)
                            for (j = 0; j < defaultModel.available.length; j++)
                                if (defaultModel.available[j] == missingFields[i].field) {
                                    defaultFields.push(missingFields[i]);
                                    break;
                                }
                        m.fields = defaultFields;
                        for (i = 0; i < defaultFields.length; i++) {
                            j = m.available.indexOf(defaultFields[i].field);
                            if (j >= 0)
                                m.available.splice(j, 1);
                        }
                    });
                }
            }
            surveyContext.model = model;

            // convert $in and $notin to "=" for Numeric and Data types
            if (filterBy) {
                filterByOp = data[filterBy + '_op'];
                filterByVal = data[filterBy];
                if (filterBy && (filterByOp === '$in' || filterByOp === '$notin') && dataView.findField(filterBy).FilterType !== 'Text') {
                    data[filterBy + '_op'] = '=';
                    data[filterBy] = filterByVal instanceof Array ? filterByVal[0] : filterByVal;
                }
            }

            layout.push('<div data-layout="form" data-layout-size="tn">');
            layout.push('<div data-container="' + (filterBy ? 'simple' : 'collapsible') + '" data-wrap="false" data-header-text="none">');


            model.forEach(function (match) {
                var matchPrefix = filterBy ? '' : '_Match' + match.id,
                    matchFilters = match.filters;

                // match controls

                if (!filterBy) {

                    layout.push('<div data-container="row" style="padding:1em">');
                    layout.push('<span data-control="field" data-field="' + matchPrefix + '" data-size="auto" style="font-weight:bold;">[_Match]</span>');
                    if (fieldsForTopValues.length)
                        layout.push('<span data-control="field" data-field="' + matchPrefix + '_filters" data-size="auto" style="text-transform:lowercase">[_Match_Filters]</span>');
                    layout.push('</div>');

                    questions.push({
                        name: matchPrefix, required: true, value: data[matchPrefix] || match.type, text: false, placeholder: 'add matching group', causesCalculate: true,
                        items: {
                            list: [
                                { value: '$matchall', text: resourcesMobile.MatchAll },
                                { value: '$matchany', text: resourcesMobile.MatchAny },
                                { value: '$donotmatchall', text: resourcesMobile.DoNotMatchAll },
                                { value: '$donotmatchany', text: resourcesMobile.DoNotMatchAny }
                            ]
                        },
                        options: {
                            lookup: {
                                openOnTap: true,
                                nullValue: false
                            }
                        }
                    });
                    if (fieldsForTopValues.length)
                        questions.push({
                            name: matchPrefix + '_filters', required: true, value: data[matchPrefix + '_filters'] || match.filters, text: false, placeholder: 'filters', causesCalculate: true,
                            items: {
                                list: [
                                    { value: '$showfilters', text: resourcesMobile.WithSpecifiedFilters },
                                    { value: '$showtop5', text: resourcesMobile.WithSelectedValues5 },
                                    { value: '$showtop10', text: resourcesMobile.WithSelectedValues10 }
                                ]
                            },
                            options: {
                                lookup: {
                                    openOnTap: true,
                                    nullValue: false
                                }
                            }
                        });
                }

                // questions included in the match
                match.fields.forEach(function (mf, index) {
                    var f = dataView.findField(mf.field),
                        originalField = allFields[f.OriginalIndex],
                        fieldName = f.Name,
                        filterType = f.FilterType,
                        dataType = filterType.toLowerCase(),
                        isBoolean = dataType === 'boolean',
                        filterConfig = resourcesDataFilters[filterType],
                        qName = matchPrefix ? (matchPrefix + '_' + fieldName) : fieldName,
                        mfOperator = data[qName + '_op'] || mf.operator,
                        q = {
                            name: qName, type: dataType, text: f.HeaderText, placeholder: filterConfig.Kind.toLowerCase(), format: f,
                            value: data[qName], extended: { required: allFields[f.OriginalIndex].is('search-mode') === 'required' },
                            visibleWhen: '[' + (dataType === 'date' ? '"=","<>","<",">","<=",">=","$between","$in","$notin"' : '"$isnotempty","$isempty"') + '].indexOf( $row.' + qName + '_op) ' + (dataType == 'date' ? '!' : '=') + '= -1'
                        },
                        q_v2,
                        q_op = {
                            name: qName + '_op', text: f.HeaderText, required: true, items: { list: [] },
                            value: mfOperator,
                            causesCalculate: true,
                            options: {
                                openOnTap: true,
                                lookup: {
                                    autoCompleteAnywhere: true,
                                    nullValue: false,
                                    autoAdvance: 'row'
                                }
                            }
                        },
                        q_op2,
                        isStaticLov = f.lov('static');

                    if (matchFilters === '$showfilters') {
                        layout.push('<div data-container="row" style="padding-left:3em">');
                        layout.push(String.format('<span data-control="label" data-field="{0}" data-size="' + (filterBy ? 'fit' : 'auto') + '">{1}</span>', qName + (isBoolean ? '_op' : ''), f.HeaderText));
                        layout.push(String.format('<span data-control="field" data-field="{0}_op" data-size="auto" style="text-transform:lowercase">{0}_op</span>', qName));
                        if (!isBoolean)
                            layout.push(String.format('<span data-control="field" data-field="{0}" data-size="auto" data-focus="true" data-visibility="f:{0}">[{0}]</span>', qName));
                        if (dataType === 'date')
                            layout.push(String.format('<span data-control="field" data-field="{0}_op2" data-size="auto" data-focus="true" data-visibility="f:{0}_op2">{0}_op</span>', qName));
                        if (!isBoolean && !f.lov('static'))
                            layout.push(String.format('<span data-control="text" data-visibility="f:{0}_v2">{1}</span><span data-control="field" data-field="{0}_v2" data-size="auto" data-visibility="f:{0}_v2">[{0}]</span>', qName, resourcesDataFilters.Labels.And));
                        layout.push('</div>');

                    }
                    else {
                        if (!index)
                            layout.push('<div data-container="row" style="padding-left:3em">');
                        layout.push('<span style="display:inline-block;vertical-align:top">');
                        layout.push(String.format('<span data-control="label" data-field="{0}" data-size="auto">{1}</span>', qName, f.HeaderText));
                        layout.push(String.format('<span data-control="field" data-field="{0}" data-size="auto" data-focus="true" data-visibility="f:{0}">[{0}]</span>', qName));
                        layout.push('</span>');
                        if (index === match.fields.length - 1)
                            layout.push('</div>');
                    }

                    // create op and op2 inputs

                    function enumerateFunctions(filterConfig, qOp) {
                        var funcCount = 0,
                            requiresSeparator,
                            list = qOp.items.list;
                        filterConfig.List.forEach(function (filterDef) {
                            if (!filterDef)
                                requiresSeparator = true;
                            else {
                                var filterFunc = filterDef.Function,
                                    searchOptions = originalField.SearchOptions;
                                if (filterFunc) {
                                    if ((!searchOptions || searchOptions.indexOf(filterFunc) !== -1) && (dataType === 'text' && !(originalField.AllowAutoComplete === false || originalField.AllowMultipleValues === false) || !filterFunc.match(/^\$(in|notin)$/))) {
                                        if (requiresSeparator) {
                                            list.push({ value: '$separator' });
                                            requiresSeparator = false;
                                        }
                                        if (!isStaticLov || ['=', '<>', '$isnotempty', '$isempty', '$true', '$false'].indexOf(filterFunc) !== -1) {
                                            list.push({ value: filterFunc, text: filterDef.Text });
                                            funcCount++;
                                        }
                                    }
                                }
                                else if (filterDef.List) {
                                    q_op2 = {
                                        name: qName + '_op2', text: f.HeaderText, value: data[qName + '_op2'],
                                        items: { list: [] }, placeholder: filterConfig.Text.toLowerCase(),
                                        options: {
                                            openOnTap: true,
                                            lookup: {
                                                autoCompleteAnywhere: true,
                                                nullValue: false
                                            },
                                            clearOnHide: true
                                        },
                                        visibleWhen: '$row.' + qName + '_op=="all-dates-in-period"'
                                    }
                                    if (enumerateFunctions(filterDef, q_op2))
                                        list.push({ value: 'all-dates-in-period', text: filterDef.Text });
                                }
                            }
                        });
                        return funcCount;
                    }

                    enumerateFunctions(filterConfig, q_op);
                    questions.push(q_op);
                    if (q_op2)
                        questions.push(q_op2);

                    // additional configuration of the condition questions based on the type of the data type.

                    if (dataType === 'date')
                        q.options = {
                            smartDatesDisabled: true,
                            clearOnHide: true
                        };

                    if (dataType === 'text') {
                        var allowAutoComplete = originalField.AllowAutoComplete !== false,
                            lookupAllowed = mfOperator.match(/^(=|<>|\$in|\$notin)$/) != null && allowAutoComplete;
                        q.items = {
                            controller: dataView._controller,
                            view: dataView._viewId,
                            dataValueField: fieldName,
                            dataTextField: fieldName,
                            style: lookupAllowed ? 'AutoComplete' : null,
                            disabled: !lookupAllowed
                        };
                        q.context = [];
                        match.fields.forEach(function (cf) {
                            if (mf != cf)
                                q.context.push(String.format('{1}={0}_{1}', matchPrefix, cf.field));
                        });
                        q.extended.context = q.context.join(',');
                        if (!allowAutoComplete)
                            q.extended.autoComplete = false;
                        if (match.type.match(/any/))
                            q.context = null;

                        if (filterBy) {
                            q.extended.filter = dataView.get_filter();
                            q.extended.search = dataView._combinedFilter([]);
                        }

                        q.options = {
                            lookup: {
                                distinct: (dataView._fields[0] != f /*index > 0*/ || f.is('search-sample-distinct') || !!allFields[f.OriginalIndex].ItemsStyle) && !f.is('search-sample-all'),
                                acceptAnyValue: true,
                                multiple: (data[qName] instanceof Array) || !!mfOperator.match(/\$(in|notin)/),
                                autoCompleteAnywhere: lookupAllowed && originalField.AutoCompleteAnywhere === true
                            },
                            clearOnHide: true
                        };
                    }
                    if (dataType === 'number') {
                        q.options = {
                            clearOnHide: true
                        };
                    }

                    if (isBoolean) {
                        q_op.required = false;
                        q_op.options.lookup.autoCompleteAnywhere = false;
                        q_op.items.list.splice(0, 0, { value: null, text: resourcesData.AnyValue });
                        q_op.placeholder = filterConfig.Kind.toLowerCase();
                    }
                    else {
                        questions.push(q);
                        if (f.lov('static')) {
                            var staticItemsStyle = f.ItemsStyle;
                            q.extended.itemsStyle = staticItemsStyle;
                            q.placeholder = resourcesDataFilters['Text'].Kind.toLowerCase();
                            q.items = {
                                style: staticItemsStyle,
                                list: []
                            };
                            f.Items.forEach(function (item) {
                                q.items.list.push({ value: item[0], text: item[1] });
                            });
                            //q.items = {
                            //    controller: dataView._controller,
                            //    view: dataView._viewId,
                            //    dataValueField: fieldName,
                            //    dataTextField: fieldName,
                            //    style: 'DropDownList'
                            //}
                            q.options.lookup = {
                                nullValue: false,
                                openOnTap: true
                            }
                        }
                        else {
                            q_v2 = {
                                name: qName + '_v2', type: dataType, text: f.HeaderText, format: f, placeholder: filterConfig.Kind.toLowerCase(),
                                visibleWhen: '$row.' + qName + '_op=="$between"', value: data[qName + '_v2'],
                                options: {
                                    smartDatesDisabled: true,
                                    clearOnHide: true
                                }
                            };
                            questions.push(q_v2);
                        }
                    }

                    if (matchFilters !== '$showfilters' && q.items && q.options) {
                        q.items.style = 'CheckBoxList';
                        q.options.lookup = {
                            distinct: true,
                            nullValue: 'any',
                            top: parseInt(matchFilters.substring('$showtop'.length))
                        };
                    }
                });

                // "add condition" controls
                if (!filterBy && match.available.length && matchFilters === '$showfilters') {
                    layout.push('<div data-container="row" style="padding-left:3em">');
                    layout.push('<span data-control="field" data-field="' + matchPrefix + '_addCondition" data-size="auto">[_AddCondition]</span>');
                    layout.push('</div>');
                    var qAddCondition = {
                        name: matchPrefix + '_addCondition', text: false, placeholder: resourcesGrid.AddConditionText.toLowerCase(), causesCalculate: true, //required: true, value: '$addcondition',
                        items: { list: [] },
                        options: {
                            lookup: {
                                nullValue: false,
                                openOnTap: true,
                                autoCompleteAnywhere: true
                            }
                        }
                    };
                    match.available.forEach(function (fieldName) {
                        var f = dataView.findField(fieldName);
                        f = allFields[f.AliasIndex];
                        qAddCondition.items.list.push({ value: f.Name, text: f.HeaderText });
                    });
                    questions.push(qAddCondition);
                }
            });

            // "add matching group" controls
            if (!filterBy) {
                layout.push('<div data-container="row" style="padding:1em">');
                layout.push('<span data-control="field" data-field="_Match_addGroup" data-size="auto">[_addGroup]</span>');
                layout.push('</div>');

                questions.push({
                    name: '_Match_addGroup', text: false, placeholder: resourcesMobile.AddMatchingGroup.toLowerCase(), causesCalculate: true,
                    items: {
                        list: [
                            { value: '$matchall', text: resourcesMobile.MatchAll },
                            { value: '$matchany', text: resourcesMobile.MatchAny },
                            { value: '$donotmatchall', text: resourcesMobile.DoNotMatchAll },
                            { value: '$donotmatchany', text: resourcesMobile.DoNotMatchAny }
                        ]
                    },
                    options: {
                        lookup: {
                            nullValue: false,
                            openOnTap: true
                        }
                    }
                });
            }

            layout.push('</div>'); // collapsible
            layout.push('</div>'); // form

            survey.questions = questions;
            survey.layout = layout.join('\r\n');

            if (!survey.options)
                survey.options = {
                    discardChangesPrompt: false,
                    modal: {
                        always: true,
                        max: maxWidth(),
                        fitContent: true,
                        dock: 'top',
                        autoGrow: true
                    },
                    materialIcon: 'search'
                };

            if (filterBy) {
                survey.submitText = resourcesMobile.Apply;
                var surveyOptions = survey.options;
                surveyOptions.modal = {
                    always: true,
                    max: 'xxs',
                    fitContent: true,
                    autoGrow: true
                };
                //surveyOptions.contentStub = false;
                surveyOptions.materialIcon = 'filter-list';
                survey.text2 = 'Filter';
                survey.text = dataView.get_view().Label;
            }
            else {
                if (!survey.text) {
                    survey.text = dataView.get_view().Label;
                    survey.text2 = resourcesMobile.AdvancedSearch;
                }
                var actions = survey.actions;
                if (!actions)
                    actions = survey.actions = [];
                actions.push(
                    {
                        id: 'resetSearch',
                        text: resourcesGrid.ResetAdvancedSearch,
                        icon: 'material-icon-clear-all',
                        execute: 'searchreset.dataview.app',
                        key: 'Ctrl+R'
                    });
                if (dataView.get_showQuickFind() !== false)
                    actions.push({}, {
                        id: 'showQuickFind',
                        position: 'after',
                        //icon: 'material-icon-keyboard-return',
                        //scope: 'context',
                        text: resourcesMobile.ShowLess,// resourcesGrid.HideAdvancedSearch,
                        execute: 'quickfindshow.dataview.app'
                    });
            }
            return survey;
        }

        function quickFindAutoComplete() {
            var qry = options.value || '',
                complexParamIterator = /(\"?(\S+)\:)\S*/g,
                paramMatch = complexParamIterator.exec(qry),
                paramDef, paramFirstFieldName,
                searchData, dataItems, searchDataChanged,
                qryIsBlank = qry == '',
                qryRegex = qryIsBlank ? null : new RegExp(RegExp.escape(qry.toString()), 'i'),
                qryStartsRegex = qryIsBlank ? null : new RegExp('^' + RegExp.escape(qry.toString()), 'i'),
                history = dataView.viewProp('quickFindHistory') || [], list,
                dataInput = options.dataInput,
                searchRow = dataInput.closest('[data-container="row"]'),
                historyRow = searchRow.next(),
                ul, maxItemCount = 6, suggestedCount = maxItemCount,
                fieldNameFilters = [],
                hintList = [], keyboard = options.keyboard,
                allFields = dataView._allFields;

            dataInput.closest('.app-bar-search').toggleClass('app-null', qryIsBlank).find('input');

            list = [];
            if (keyboard)
                history.forEach(function (t) {
                    if (!qryRegex || t.toString().match(qryRegex))
                        list.push(t);
                });
            else
                list = history.splice(qryIsBlank ? 0 : 1);
            if (qry) {
                while (paramMatch) {
                    paramDef = paramMatch[1];
                    if (fieldNameFilters.indexOf(paramMatch[2]) == -1)
                        fieldNameFilters.push(paramMatch[2]);
                    paramMatch = complexParamIterator.exec(qry);
                }
                if (fieldNameFilters.length) {
                    fieldNameFilters.forEach(function (sample) {
                        var hint = [], reducedSample = sample.replace(/\s/g, '').toLowerCase();
                        allFields.forEach(function (f) {
                            var aliasField = allFields[f.AliasIndex],
                                headerText = aliasField.HeaderText || aliasField.Label || ''
                            if (f.AllowQBE && !f.Hidden && headerText.replace(/\s/g, '').toLowerCase().startsWith(reducedSample)) {
                                hint.push('"' + headerText + '"');
                                if (!paramFirstFieldName)
                                    paramFirstFieldName = aliasField.Name;
                            }
                        });
                        if (hint.length)
                            hintList.push('"' + sample + ':" = ' + hint.join(', '));
                    });
                }
                if (paramDef) {
                    qry = qry.substring(paramDef.length);
                    qryRegex = qry.length ? new RegExp(RegExp.escape(qry.toString()), 'i') : null;
                    qryStartsRegex = qry.length ? new RegExp('^' + RegExp.escape(qry.toString()), 'i') : null;
                }
            }
            if (list.length < maxItemCount && qryRegex && !dataView.tagged('search-suggestions-none') && keyboard) {
                suggestedCount = list.length;
                searchData = dataView.viewProp('searchData');
                if (!searchData)
                    searchData = {};
                if (!dataInput.data('scannedDataItems')) {
                    dataItems = $('#' + dataView._id).find('li.dv-item a');
                    if (!dataItems.length)
                        dataItems = $('[data-for="' + dataView._id + '"]').find('li.dv-item a');
                    dataItems.each(function () {
                        var item = $(this),
                            dataContext = item.data('data-context');
                        if (dataContext)
                            dataView._fields.forEach(function (f) {
                                var fieldValueList;
                                f = allFields[f.AliasIndex];
                                if (f.AllowQBE && f.Type == 'String') {
                                    if (!fieldValueList) {
                                        fieldValueList = searchData[f.Name];
                                        if (!fieldValueList)
                                            searchData[f.Name] = fieldValueList = [];
                                    }
                                    var v = dataContext.row[f.Index], t;
                                    if (v != null) {
                                        t = f.format(v)
                                        if (fieldValueList.indexOf(t) == -1) {
                                            fieldValueList.push(t);
                                            searchDataChanged = true;
                                        }
                                    }
                                }
                            });
                    });
                    if (searchDataChanged)
                        dataInput.data('scannedDataItems', true);
                    dataView.viewProp('searchData', searchData);
                }
                //$(searchDataList).each(function () {
                //    var t = this.toString();
                //    if (t.match(qryRegex) && list.indexOf(t) == -1 && list.indexOf('"' + t + '"') == -1)
                //        list.push(t);
                //    if (list.length == maxItemCount) return false;
                //});
                var startsWithList = [], containsList = [], resultIndex = 0;
                for (var fieldName in searchData)
                    if (fieldName != '_list' && (!paramFirstFieldName || fieldName == paramFirstFieldName)) {
                        searchData[fieldName].forEach(function (t) {
                            if (t.match(qryStartsRegex) && startsWithList.indexOf(t) == -1 && startsWithList.indexOf('"' + t + '"') == -1)
                                startsWithList.push(t);
                        });
                    }
                startsWithList.sort();
                if (startsWithList.length < maxItemCount) {
                    for (var fieldName in searchData)
                        if (fieldName != '_list' && (!paramFirstFieldName || fieldName == paramFirstFieldName)) {
                            searchData[fieldName].forEach(function (t) {
                                if (t.match(qryRegex) && containsList.indexOf(t) == -1 && containsList.indexOf('"' + t + '"') == -1)
                                    containsList.push(t);
                            });
                        }
                    containsList.sort();
                }
                containsList = startsWithList.concat(containsList);
                while (resultIndex < containsList.length && list.length < maxItemCount) {
                    var sample = containsList[resultIndex++];
                    if (list.indexOf(sample) == -1)
                        list.push(sample);
                }
            }

            if (list.length || hintList.length) {
                if (!historyRow.is('.app-bar-history'))
                    historyRow = $div('app-bar-history', 'data-container="row"').insertAfter(searchRow);
                historyRow.show().empty();
                ul = $ul().appendTo(historyRow);
                if (hintList.length)
                    $li('app-hint').text(hintList.join('; ')).appendTo(ul);
                $(list).each(function (index) {
                    if (index == maxItemCount) return false;
                    var t = this,
                        isSearchItem = index >= suggestedCount,
                        m = qryRegex ? t.match(qryRegex) : null,
                        li = $li().attr('data-text', isSearchItem ? ('"' + t + '"') : t).appendTo(ul);
                    if (m) {
                        $span().appendTo(li).text(t.substring(0, m.index));
                        $('<b/>').appendTo(li).text(t.substring(m.index, m.index + qry.length));
                        $span().appendTo(li).text(t.substring(m.index + qry.length));
                    }
                    else
                        li.text(t);
                    $i('app-icon material-icon').appendTo(li).text(isSearchItem ? 'search' : 'history');
                });
                resetPageHeight();
            }
            else if (historyRow.length) {
                historyRow.remove();
                resetPageHeight();
            }
        }

        // -------------------------------------
        // identify search mode
        // -------------------------------------
        if (method == 'mode')
            //mode = dataView.viewProp('searchMode');
            //return mode || 'quickfind';
            return dataView.asearch('mode');
        // -------------------------------------
        // toggle search mode
        // -------------------------------------
        if (method == 'toggle') {
            mode = _app._search('mode', dataView);
            if (mode == 'quickfind')
                mode = 'advanced';
            else
                mode = 'quickfind';
            // assign mode and continue running in that mode
            //dataView.viewProp('searchMode', mode);
            dataView.asearch('mode', mode);
            //pageTransitions(false);
            //$settings('ui.transitions.style', 'none');
            //whenPageShown(function () {
            //    pageTransitions(true);
            //});
        }
        // -------------------------------------
        // try locating possible search targets
        // -------------------------------------
        if (method == 'enumerate') {
            var context = [],
                searchCallback,
                scrollable = _touch.scrollable(findActivePage()),
                scrollableOffset = scrollable.offset();

            // find every echo in the visible range
            scrollable.find('.app-echo').each(function () {
                var echo = $(this),
                    dataView = findDataView(echo.attr('data-for')),
                    totalRowCount = dataView._totalRowCount,
                    echoOffset = echo.offset(),
                    currentView = dataView.get_view();
                // note that the first echo on the summary page has negative margin that equals 49. The wrapper starts at 50. Therefore we need ">= scrollableOffset.top - 1"
                if (totalRowCount != -1 && echoOffset.top >= scrollableOffset.top - 1 && echoOffset.top <= scrollableOffset.top + scrollable.height() - 1 && currentView)
                    context.push({
                        text: currentView.Label, icon: 'search', desc: _app.htmlToText(dataView.extension().instruction(false)), count: totalRowCount, callback: function () {
                            _touch.summary('focus', dataView);
                            _app._search('show', dataView);
                        }
                    });
            });
            if (context.length) {
                searchCallback = function () {
                    if (context.length === 1)
                        context[0].callback();
                    else {
                        context.splice(0, 0, { text: labelSearch });
                        showContextPanel(context, '#app-panel-search-menu', { position: 'right' });
                    }
                };
            }
            if (!searchCallback) {
                // try locating search in  the current context
                _touch.navContext(context);
                $(context).each(function () {
                    var item = this;
                    if (item.icon == 'search') {
                        searchCallback = function () {
                            item.callback(item.context);
                        };
                        return false;
                    }

                });
            }
            if (searchCallback)
                setTimeout(searchCallback);
            return;// searchCallback != null;
        }
        // ------------------------------------------
        // handle various methods of Search API
        // -----------------------------------------
        if (method === 'generate')
            _app.survey('show', generate());
        if (method === 'parse')
            return parse();
        if (method === 'execute') {
            if (!options.filter)
                options = search('parse', options);
            execute(options);
        }
        if (method === 'addCondition')
            addCondition();
        if (method === 'changeMatch')
            changeMatch();
        if (method === 'addGroup')
            addGroup();
        if (method === 'reset')
            reset();
        if (method === 'autoComplete')
            quickFindAutoComplete();
        if (!(method === 'show' || method === 'toggle')) return;



        // ------------------------------------------
        // search the explicitly specified data view
        // -----------------------------------------
        var searchOnStart = dataView.get_searchOnStart(),
            activePage = findActivePage();
        if (searchOnStart) {
            dataView._totalRowCount = 0;
            if (findActivePage().attr('id') !== dataView._id)
                _touch.summary('refreshToolbar', dataView);//echoRefreshToolbar(dataView);
            else
                _touch.refreshContext(false, 0);
            //dataView._totalRowCount = -1;
            dataView._requiresContextRefresh = true;
            dataView.set_searchOnStart(false);
        }
        mode = dataView.asearch('mode');// dataView.viewProp('searchMode') || 'quickfind';
        if (!options) options = {};
        var activeSearchView = _touch.contextDataView(),
            surveyContext = { id: dataView._id, start: searchOnStart, search: true, field: options.field };
        if (activeSearchView && activeSearchView != dataView && _app.read(activeSearchView, '_survey.context.search')) {
            _touch.pageInfo().deleted = true;
            surveyContext = activeSearchView.survey().context;
            searchOnStart = surveyContext.start;
        }

        if (searchOnStart) {
            if (method !== 'toggle') {
                newMode = dataView.tagged('search-on-start-simple') ? 'quickfind' : 'advanced';
                if (mode !== newMode)
                    //dataView.viewProp('searchMode', newMode);
                    dataView.asearch('mode', newMode);
                mode = newMode;
            }
            whenPageShown(function () {
                var pageInfo = _touch.pageInfo(),
                    survey = pageInfo.dataView.survey(),
                    context = survey && survey.context;
                whenPageCanceled(function () {
                    if (context && !pageInfo._canceled)
                        _touch.sync(context.id);
                });
            });
        }

        if (mode === 'advanced' || options.field /*|| searchOnStart && mode == 'advanced' && method != 'toggle'*/) {
            var survey = {
                controller: dataView._controller + '._search',
                parent: dataView._id,
                context: surveyContext,
                dynamic: false
            };
            survey.submit = 'searchperform.dataview.app';
            survey.submitText = labelSearch;
            survey.submitIcon = 'material-icon-search';
            survey.create = 'searchgenerate.dataview.app';
            survey.calculate = 'searchcalculate.dataview.app';
            survey.tryLoad = !surveyContext.field;
            _app.survey(survey);
        }
        else {
            var quickFindValue = dataView.extension().quickFind();
            if (quickFindValue === '')
                quickFindValue = null;
            whenPageShown(function () {
                _app._search('autoComplete', { id: dataView._id, dataInput: findActivePage().find('[data-field="QuickFind"]'), value: quickFindValue });
            });
            _app.survey({
                parent: dataView._id,
                controller: dataView._id + '-' + 'quickfind',
                context: surveyContext,
                topics: [
                    {
                        questions: [{ name: 'QuickFind', text: false, placeholder: String.format(resourcesMobile.QuickFindDescription, dataView.get_view().Label), value: quickFindValue }]
                    }
                ],
                options: {
                    modal: {
                        fitContent: true,
                        always: true,
                        max: activePage.is('.app-page-modal') && !activePage.is('.app-page-modal-dock') ? '' : maxWidth(),
                        title: false,
                        tapOut: true,
                        dock: 'top'
                    },
                    actionButtons: false,
                    discardChangesPrompt: false,
                    contentStub: false
                },
                layout: '<div class="app-container-search" data-container="simple" data-header-text="none" data-wrap="true">' +
                    '<div data-container="row" class="app-bar-search' + (quickFindValue == null ? ' app-null' : '') + '" data-density="' + (_touch.pointer('touch') ? 'comfortable' : 'relaxed') + '"><i class="app-icon material-icon material-icon-search" title="' + labelSearch + '">search</i>' +
                    '<span data-control="field" data-field="QuickFind" data-notify="quickfindautocomplete.dataview.app">[Query]</span>' +
                    '<i class="app-icon material-icon material-icon-cancel" title="' + resourcesMobile.ClearText + '">cancel</i><i class="app-icon material-icon material-icon-more app-btn-more" title="' + resourcesMobile.ShowMore + '"></i></div>' +
                    '</div>',
                submitText: 'Search',
                submit: 'searchperform.dataview.app'
            });
        }
    };

})();