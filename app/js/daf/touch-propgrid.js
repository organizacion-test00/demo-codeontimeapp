/*eslint eqeqeq: ["error", "smart"]*/
/*!
* Touch UI - Property Grid
* Copyright 2021 Code On Time LLC; Licensed MIT; http://codeontime.com/license
*/

(function () {
    var _app = $app,
        _input = _app.input,
        _touch = _app.touch,
        $document = $(document),
        resources = Web.DataViewResources,
        booleanDefaultItems = resources.Data.BooleanDefaultItems,
        getBoundingClientRect = _app.clientRect,
        // core variables
        booleanValues = [{ value: true, text: booleanDefaultItems[1][1] }, { value: false, text: booleanDefaultItems[0][1] }],
        propSetMap = {},
        _propCollapsed,
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

    function propCollapsed(name, value) {
        if (!_propCollapsed)
            _propCollapsed = _app.userVar('propCollapsed') || {};
        if (arguments.length === 2) {
            if (value === null)
                delete _propCollapsed[name];
            else
                _propCollapsed[name] = value;
            _app.userVar('propCollapsed', _propCollapsed);
        }
        else
            return _propCollapsed[name];
    }

    function enumerateCatProperties(parentDef) {
        var catPropNames = [],
            propList = parentDef.properties;
        for (var propName in propList) {
            var propDef = propList[propName];
            propDef.parent = parentDef;
            if (!propDef.name)
                propDef.name = propName;
            if (!propDef.text)
                propDef.text = _app.prettyText(propName, true);
            if (!propDef.type)
                propDef.type = 'text';
            if (propDef.type === 'text' && !('length' in propDef))
                propDef.length = 255;
            if (propDef.type === 'bool') {
                if (!propDef.style)
                    propDef.style = 'DropDownList';
            }
            if (propDef.values && !propDef.style)
                propDef.style = 'DropDownList';
            if (propDef.style && !('required' in propDef))
                propDef.required = true;
            if (propDef.type === 'bool' && propDef.style === 'DropDownList' && propDef.required)
                propDef.values = booleanValues;

            catPropNames.push(propName);
            if (propDef.properties)
                enumerateCatProperties(propDef);
        }
        propList._names = catPropNames.sort();
    }

    _touch.propSet = function (propSet) {
        if (propSet._registed)
            return;
        for (var catName in propSet) {
            var catDef = propSet[catName],
                scope = catDef.scope,
                scopeDef = propSetMap[scope];
            if (!scopeDef)
                scopeDef = propSetMap[scope] = { _names: [] };
            scopeDef[catName] = catDef;
            scopeDef._names.push(catName);
            if (!catDef.name)
                catDef.name = catName;
            if (!catDef.text)
                catDef.text = _app.prettyText(catName, true);
            enumerateCatProperties(catDef);
        }
        propSet._registed = true;
    };

    function targetToValues(target) {
        var data = {};
        data.flow = target.flow || 'merge';
        return data;
    }

    _touch._propGrid = function (method, options) {
        var propSet = options.propSet,
            use = options.use,
            questions = [],
            layoutOfCategories = [],
            layoutOfProps = [],
            categoryList = [],
            categoryMap = {},
            error,
            isCollapsedCat;

        if (!options.context)
            options.context = 'generic';

        if (typeof use == 'string')
            use = use.split(/\s*,\s*/);

        function layout(s) {
            var argList = arguments,
                offset = 1,
                target = arguments[0],
                i,
                line = [];
            if (argList.length === 1 || argList.length > 1 && !(argList[0] === 'categories' || argList[0] === 'props')) {
                offset = 0;
                target = 'all';
            }
            for (i = offset; i < argList.length; i++)
                line.push(argList[i]);

            line = line.join('');

            if (target === 'categories' || target === 'all')
                layoutOfCategories.push(line);
            if (target === 'props' || target === 'all')
                layoutOfProps.push(line);
        }

        function question(catDef, propDef, prefix, depth, collapsedParent) {
            var q = {
                name: (prefix ? prefix + '_' : '') + propDef.name, type: propDef.type, text: propDef.text, options: {}
            };
            if (propDef.required)
                q.required = true;
            if (propDef.style) {
                q.items = { style: propDef.style };
                if (propDef.values) {
                    q.items.list = [];
                    propDef.values.forEach(function (v) {
                        if (typeof v == 'string')
                            v = { value: v, text: _app.prettyText(v, true) };
                        q.items.list.push(v);
                    });
                }
                if (propDef.style === 'DropDownList') {
                    if (q.required)
                        q.options.lookup = { nullValue: false };
                    //if (!q.options.lookup)
                    //    q.options.lookup = {};
                    //q.options.lookup.openOnTap = true;
                }
            }

            var isCollapsedProp = false;
            if (propDef.properties) {
                isCollapsedProp = propCollapsed(catDef.scope + '$' + q.name);
                if (isCollapsedProp == null)
                    isCollapsedProp = true;
            }

            questions.push(q);
            var propClasses = [];
            if (isCollapsedCat)
                propClasses.push('app-collapsed-cat');
            if (propDef.properties)
                propClasses.push('app-complex');
            if (isCollapsedProp)
                propClasses.push('app-collapsed');
            if (collapsedParent)
                propClasses.push('app-collapsed-prop')
            layout('<div data-container="row" ',
                'data-property="', q.name, '"',
                'data-category-name="', catDef.name, '" ',
                'data-scope="', catDef.scope, '" ',
                propClasses.length ? 'class="' + propClasses.join(' ') + '" ' : '',
                depth ? 'data-depth="' + depth + '"' : '',
                '>');
            layout('<span data-draggable="propgrid-divider"></span>');
            layout('<span data-control="label" data-field="', q.name, '">', q.name, '</span>');
            //if (!propDef.properties)
            layout('<span data-control="field" data-field="', q.name, '"', propDef.style === 'DropDownList' && false ? ' data-select-on-focus="false"' : '', '>[', q.name, ']</span>');
            if (propDef.properties)
                layout('<span class="app-toggle"></span>');
            layout('</div>');
            if (propDef.properties)
                propDef.properties._names.forEach(function (propName) {
                    var childPropDef = propDef.properties[propName];
                    question(catDef, childPropDef, q.name, depth + 1, isCollapsedProp || collapsedParent)
                });
        }

        if (propSet) {
            if (!Array.isArray(propSet))
                propSet = [propSet];
            propSet.forEach(function (propSet) {
                _touch.propSet(propSet);
            });
        }

        use.forEach(function (name) {
            var propSet = propSetMap[name];
            if (!propSet)
                error = 'Unknown property set ' + name;
            else {
                categoryList = categoryList.concat(propSet._names);
                for (var catName in propSet)
                    categoryMap[catName] = propSet[catName];
            }
        });
        if (error) {
            _touch.notify(error);
            return;
        }

        // Generate "Categorized" layout
        layout('<div data-layout="form" data-layout-size="tn">');
        layout('<div data-container="simple">');

        categoryList.sort().forEach(function (catName) {
            var c = categoryMap[catName];
            isCollapsedCat = propCollapsed(c.scope + '$' + c.name);
            layout('<div data-container="row" ',
                'data-category="', catName, '" ',
                'data-scope="', c.scope, '" ',
                'class="', isCollapsedCat ? 'app-collapsed' : '', '"',
                '>');
            layout('<span class="app-toggle"></span>');
            layout('<span class="app-cat-text">', _app.htmlEncode(c.text), '</span>');
            layout('</div>');
            c.properties._names.forEach(function (propName) {
                var p = c.properties[propName];
                question(c, p, '', 0, false);
            });

        });

        // emtpy data row to create a separator line
        layout('<div data-container="row">');
        layout('</div>');

        layout('</div>'); // data-container="simple"
        layout('</div>'); // data-layout="form"

        // generate "Alphabetical" layout


        // show the grid of properties

        _app.survey({
            context: options,
            values: targetToValues(options.target),
            questions: questions,
            options: {
                modal: {
                    dock: options.location || 'right',
                    max: 'xxs',
                    gap: false,
                    tapOut: true,
                    background: 'transparent',
                    title: false
                },
                actionButtons: false,
                discardChangesPrompt: false,
                className: 'app-propgrid'
            },
            layout: layoutOfCategories.join('\n'),
            init: 'propgridinit.app'
        });


        return;
        /// 
        _app.survey({
            values: {
                flow: 'row',
                jumbo: false,
                spacing: false,
                icon: 'history'
            },
            questions: [
                //{ name: "q", type: "number" },
                {
                    name: 'flow', text: 'Flow', required: true,
                    items: {
                        list: [
                            { value: 'column', text: 'Column' },
                            { value: 'row', text: 'Row' }
                        ]
                    }
                },
                {
                    name: 'jumbo', text: 'Jumbo', type: 'bool', required: true,
                    items: {
                        style: 'DropDownList'
                    }
                },
                {
                    name: 'spacing', text: 'Spacing', type: 'bool', required: true,
                    items2: {
                        style: 'DropDownList'
                    }
                },
                {
                    name: 'icon', text: 'Icon'
                }
            ],
            options: {
                modal: {
                    always: true,
                    dock: options.location || 'right',
                    max: 'xxs',
                    gap: false,
                    tapOut: true,
                    background: 'transparent',
                    title: false
                },
                actionButtons: false,
                discardChangesPrompt: false
            }
        });
    };

    // UI event handlers

    function updatePropGridLayout() {
        var controls = [];
        _touch.activePage('[data-layout]').data('rootNodes')[0].children.forEach(function (c) {
            if (!c.ready)
                controls.push(c);

        });
        if (controls.length)
            _touch.layout({ controls: controls });
    }

    function startVerticalResizing(collapsed) {
        var scrollable = _touch.scrollable();
        scrollable.find('.app-stub').css('height', getBoundingClientRect(scrollable).height);
    }

    function finishVerticalResizing() {
        var scrollable = _touch.scrollable(),
            scrollableRect = getBoundingClientRect(scrollable),
            stub = scrollable.find('.app-stub'),
            stubRect = getBoundingClientRect(stub);
        if (_app.intersect(scrollableRect, stubRect))
            stub.css('height', scrollableRect.bottom - stubRect.top + 1);
        else
            stub.css('height', '');
        //_touch.resetPageHeight();
    }

    function complexPropertyClick(e) {
        var property = $(this).closest('[data-property]'),
            complexPropNamePrefix = property.data('property') + '_', // prefix of the complex property 
            isCollapsed = !property.is('.app-collapsed'),
            propElem = property.next(),
            collapsedChild = [];
        startVerticalResizing(isCollapsed);
        propCollapsed(property.data('scope') + '$' + property.data('property'), isCollapsed == true ? null : isCollapsed);
        property.toggleClass('app-collapsed', isCollapsed);
        while (propElem.length && (propElem.data('property') || '').startsWith(complexPropNamePrefix)) {
            if (propElem.is('.app-collapsed'))
                collapsedChild.push(propElem.data('property'));
            if (isCollapsed)
                propElem.addClass('app-collapsed-prop');
            else {
                var expandedPropertyName = propElem.data('property'),
                    skipExpand = false;
                collapsedChild.forEach(function (collapsedName) {
                    if (expandedPropertyName.startsWith(collapsedName) && expandedPropertyName.length > collapsedName.length)
                        skipExpand = true;
                });
                if (!skipExpand)
                    propElem.removeClass('app-collapsed-prop');
            }
            propElem = propElem.next();
        }
        if (!isCollapsed)
            updatePropGridLayout();
        _touch.hasFocus(property.find('[data-control="field"]'));
        finishVerticalResizing();
        return false;
    }

    function selectCategory(cat) {
        _touch.scrollIntoView(cat);
        _touch.activePage('.app-has-focus').removeClass('app-has-focus');
        cat.addClass('app-has-focus');
        _touch.activePage().removeData('last-focused-field');
        var catDef = toCatDef(cat);
        updateInfoPane(catDef.text, catDef.description, false);

    }

    function updateInfoPane(title, text, help) {
        var infoPane = _touch.activePage().data('infoPane');
        infoPane.find('.app-text').text(title);
        infoPane.find('.app-description').html(text || '');
        infoPane.find('.app-help').css('display', help ? '' : 'none');
    }

    function toCatDef(elem) {
        var catElem = elem.closest('[data-property]'),
            name,
            scope;
        if (!catElem.length)
            catElem = elem.closest('[data-category]');
        scope = catElem.data('scope');
        name = catElem.data('category-name') || catElem.data('category');
        return propSetMap[scope][name];
    }

    function toPropDef(elem) {
        var catDef = toCatDef(elem),
            property = elem.closest('[data-property]'),
            name = (property.data('property') || ''),
            propDef = catDef;
        name.split(/_/).forEach(n =>
            propDef = propDef.properties[n]
        );
        return propDef;
    }

    function propGridDef() {
        return _touch.dataView().data('survey');
    }

    // event handlers

    $document
        .on('vclick', '.app-propgrid [data-category]', function (e) {
            var cat = $(this),
                categoryName = cat.data('category'),
                isCollapsed = !cat.is('.app-collapsed'),
                propElem = cat.next();
            selectCategory(cat);
            startVerticalResizing(isCollapsed);
            if ($(e.target).is('.app-toggle') || _touch.dblClick(cat)) {
                propCollapsed(cat.data('scope') + '$' + categoryName, isCollapsed === false ? null : isCollapsed);
                cat.toggleClass('app-collapsed', isCollapsed);
                while (propElem.length && propElem.data('category-name') === categoryName) {
                    propElem.toggleClass('app-collapsed-cat', isCollapsed);
                    propElem = propElem.next();
                }
                if (!isCollapsed)
                    updatePropGridLayout();
            }
            finishVerticalResizing(isCollapsed);
            return false;
        })
        .on('vclick', '.app-propgrid [data-property].app-complex .app-toggle', complexPropertyClick)
        .on('vdblclick', '.app-propgrid [data-property].app-complex [data-control="label"]', complexPropertyClick)
        .on('vdblclick', '.app-propgrid [data-property] [data-control="label"]', function (e) {
            var that = $(this),
                field = _input.elementToField(that);
            if (field && field.ItemsStyle === 'DropDownList') {
                setTimeout(function () {
                    $('.app-data-input').blur();
                    _touch.hasFocus(that);
                    _touch.scrollable('focus');
                }, 150);
            }
        })
        .on('datainputfocus.app', '.app-propgrid', function (e) {
            var fieldName = e.dataInput.data('field'),
                context = propGridDef().context,
                propDef = toPropDef(e.dataInput),
                parentPropDef = propDef.parent,
                propPath = [propDef.text];
            while (parentPropDef) {
                if (parentPropDef.parent)
                    propPath.splice(0, 0, parentPropDef.text);
                parentPropDef = parentPropDef.parent;
            }
            _app.userVar('PropGrid.LastSelected', context + '$' + fieldName);
            updateInfoPane(propPath.join(' / '), propDef.description, true);
        })
        .on('datainputlabel.app', '.app-propgrid [data-control="label"]', function (e) {
            var property = e.dataInput.closest('[data-property]');
            if (property.length) {
                propertyScope = property.data('scope');
                _touch.hasFocus(property.find('[data-control="field"]'));
                _touch.scrollIntoView($(this));
                _touch.saveLastFocusedField(property.data('property'));
                if (e.dblClick && !property.is('.app-complex')) {
                    // Let the focus to be set on the input. 
                    // This will also enable the cycling of the data - input="dropdownlist" values.
                }
                else
                    return false;
            }
        })
        .on('scrollablepageready.app', '.app-propgrid', function (e) {
            //    if (!e.reverse) {
            //        var propGridLastSelected = _app.userVar('PropGrid.LastSelected');
            //        if (propGridLastSelected) {
            //            propGridLastSelected = propGridLastSelected.split(/\$/);
            //            if (e.scrollable.find('[data-layout]').data('context') === propGridLastSelected[0]) {
            //                property = _touch.activePage('[data-property="' + propGridLastSelected[1] + '"]:visible');
            //                property.find('[data-control="label"]').trigger('vclick');
            //            }
            //        }
            //    }
        })
        .on('pageautofocus.app', '.app-propgrid', function (e) {
            // prevent the default autofocus
            if (!e.reverse)
                return false;
        })
        .on('datainputmove.app', '.app-propgrid .app-wrapper', function (e) {
            // always the the focus on the data-control="label" when Tab or Shift+Tab is pressed
            if (e.direction.match(/left|right/) || e.direction === 'down' && e.keyCode === 13) {
                var textInput = e.textInput,
                    focusedElem = textInput.closest('[data-property]');
                if (focusedElem.length) {
                    setTimeout(function () {
                        textInput.blur();
                        _touch.scrollIntoView(focusedElem);
                        _touch.hasFocus(focusedElem.find('[data-control="field"]'));
                        _touch.scrollable('focus');
                    });
                    return false;
                }
            }
            else
                return false;
        })
        .on('keyboardnavigation.app', '.app-propgrid .app-wrapper', function (e) {
            var direction = e.direction,
                textInput = $('.app-data-input'),
                focusedElem;
            if (!textInput.length) {
                focusedElem = _touch.activePage('[data-control="label"].app-has-focus,[data-container="row"][data-category].app-has-focus');
                if (direction.match(/^(up|down|left|right|enter|tab|end|home|edit)$/)) {
                    if (direction == 'end')
                        focusedElem = _touch.activePage('[data-control="label"]:visible,[data-container="row"][data-category]:visible').last();
                    if (!focusedElem.length)
                        direction = 'home';
                    if (!focusedElem.length || direction === 'home')
                        focusedElem = _touch.activePage('[data-control="label"]:visible,[data-container="row"][data-category]:visible').first();
                    if (!focusedElem)
                        return;
                    focusedElem = focusedElem.closest('[data-container="row"]');
                    // handle "edit"
                    if (direction === 'edit')
                        if (!focusedElem.is('[data-category]')) {
                            _input.focus({ field: focusedElem.data('property') });
                            return false;
                        }
                    // handle "tab"
                    if (direction === 'tab') {
                        if (focusedElem.is('[data-category]'))
                            direction = e.originalEvent.shiftKey ? 'up' : 'down';
                        else {
                            _input.focus({ field: focusedElem.data('property') });
                            return false;
                        }
                    }
                    // handle "enter"
                    if (direction === 'enter')
                        if (focusedElem.is('.app-complex,[data-category]')) {
                            if (focusedElem.is('.app-collapsed')) {
                                direction = 'right';
                            }
                            else
                                direction = 'left';
                        }
                        else
                            return false;
                    // handle "left"
                    if (direction === 'left') {
                        direction = 'up';
                        if (focusedElem.is('.app-complex')) {
                            if (!focusedElem.is('.app-collapsed')) {
                                complexPropertyClick.apply(focusedElem[0], {});
                                return false;
                            }
                        }
                        else if (focusedElem.is('[data-category]')) {
                            if (!focusedElem.is('.app-collapsed')) {
                                focusedElem.find('.app-toggle').trigger('vclick');
                                return false
                            }
                        }
                    }
                    // handle "right"
                    if (direction === 'right') {
                        direction = 'down';
                        if (focusedElem.is('.app-complex')) {
                            if (focusedElem.is('.app-collapsed')) {
                                complexPropertyClick.apply(focusedElem[0], {});
                                return false;
                            }
                        }
                        else if (focusedElem.is('[data-category]')) {
                            if (focusedElem.is('.app-collapsed')) {
                                focusedElem.find('.app-toggle').trigger('vclick');
                                return false
                            }
                        }
                    }
                    // go "up" or "down"
                    if (direction === 'up' || direction === 'down')
                        focusedElem = direction === 'up' ? focusedElem.prevAll('[data-container="row"]:visible') : focusedElem.nextAll('[data-container="row"]:visible');
                    focusedElem = focusedElem.first();
                    if (focusedElem.length) {
                        if (focusedElem.is('[data-category]'))
                            selectCategory(focusedElem);
                        else if (focusedElem.is('[data-property]')) {
                            focusedElem = focusedElem.find('[data-control="field"]');
                            _touch.hasFocus(focusedElem);
                            _touch.saveLastFocusedField(focusedElem);
                            focusedElem.closest('[data-container="row"]');
                        }
                        _touch.scrollIntoView(focusedElem);
                    }
                    return false;
                }
            }
        })
        .on('keyboardpreview.app', '.app-propgrid .app-wrapper', function (e) {
            var activeElement = $(document.activeElement);
            if (e.originalEvent.key === 'F1' && $(this).find('[data-control="label"].app-has-focus').length) {
                _touch.activePage('.app-infopane .app-help').trigger('mousedown');
                return false;
            }
            else if (!activeElement.is(':input')) {
                activeElement = $(this).find('[data-control="label"].app-has-focus');
                if (activeElement.length) {
                    var originalEvent = e.originalEvent,
                        key = originalEvent.key || '',
                        fieldName = activeElement.data('field');
                    if (key.length === 1 && !originalEvent.ctrlKey || key.match(/Backspace|Del|Delete/)) {
                        if (key.length > 1)
                            _input.execute({ values: [{ field: fieldName, value: null }] });
                        else
                            _input._buffer = key;
                        e.preventDefault();
                        _input.focus({ field: fieldName });
                    }
                }
            }
        })
        .on('paste', function (e) {
            var activeElement = $(document.activeElement);
            if (!activeElement.is(':input') && _touch.activePage().is('.app-propgrid')) {
                activeElement = $(this).find('[data-control="label"].app-has-focus');
                if (activeElement.length) {
                    var fieldName = activeElement.data('field'),
                        text = e.originalEvent.clipboardData.getData('text/plain');
                    //_input.execute({ values: [{ field: fieldName, value: text }] });
                    _input._buffer = text;
                    _input.focus({ fieldName: fieldName });
                    return false;
                }
            }
        })
        .on('propgridinit.app', function (e) {
            var activePage = _touch.activePage(),
                header = _touch.bar('create', { type: 'header', page: activePage }),
                footer = _touch.bar('create', { type: 'footer', page: activePage }),
                toolbar = $div('app-toolbar').appendTo(header),
                infoPane = $div('app-infopane').appendTo(footer),
                paneTitle = $div('app-title').appendTo(infoPane);
            $span('app-text').appendTo(paneTitle);
            $div('app-description').appendTo(infoPane);
            if (propGridDef().helpUrl)
                _touch.icon('material-icon-help_outline', paneTitle).addClass('app-help').attr({ title: Web.MembershipResources.Bar.HelpLink, 'data-tooltip-location': 'above' }).hide();
            //$i('app-svg-icon app-svg-sortascending').appendTo(paneTitle);
            //$i('app-svg-icon app-svg-categorizedview').appendTo(paneTitle);
            var categorizedButton = $span('app-btn app-btn-categorized').appendTo(toolbar).toggleClass('app-selected', true).attr('title', 'Categorized');
            _touch.icon('material-icon-category', categorizedButton);
            var alphabeticalButton = $span('app-btn app-btn-alphabetical').appendTo(toolbar).toggleClass('app-selected', false).attr('title', 'Alphabetical');
            _touch.icon('material-icon-sort_by_alpha', alphabeticalButton);
            _touch.bar('show', header);
            _touch.bar('show', infoPane);
            activePage.data('infoPane', infoPane);
            // scroll the last selected property into view
            var propGridLastSelected = _app.userVar('PropGrid.LastSelected');
            if (propGridLastSelected) {
                propGridLastSelected = propGridLastSelected.split(/\$/);
                if (propGridDef().context === propGridLastSelected[0]) {
                    property = activePage.find('[data-property="' + propGridLastSelected[1] + '"]:visible');
                    property.find('[data-control="label"]').trigger('vclick');
                }
            }
        })
        .on('mousedown pointerdown touchstart', '.app-propgrid .app-infopane .app-help', function (e) {
            var propDef = toPropDef(_touch.activePage('[data-property] .app-has-focus')),
                helpUrl = propGridDef().helpUrl,
                url = [];
            if (propDef && helpUrl) {
                if (!helpUrl.endsWith('/'))
                    helpUrl = helpUrl += '/';
                while (propDef) {
                    if (propDef.parent) {
                        url.splice(0, 0, propDef.name)
                        if (propDef.parent.parent)
                            url.splice(0, 0, '.');
                        propDef = propDef.parent;
                    }
                    else {
                        url.splice(0, 0, propDef.scope, '/');
                        break;
                    }
                }
                url.splice(0, 0, helpUrl);
                url = url.join('').toLowerCase();
                //_touch.notify({ text: url, force: true });
                window.open(url, 'propgridhelp_' + propGridDef().context.replace(/\W/g, '_'));
            }
            return false;
        });

})();