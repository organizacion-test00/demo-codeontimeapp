/*eslint eqeqeq: ["error", "smart"]*/
/*!
* Data Aquarium Framework - Display Flow for Touch UI
* Copyright 2021 Code On Time LLC; Licensed MIT; http://codeontime.com/license
*/

(function () {
    var _app = $app,
        _touch = _app.touch,
        _designer,
        resourcesMobile = Web.DataViewResources.Mobile,
        $document = $(document),
        resizing, pendingSelectionChanged,
        designerToolbars,
        getBoundingClientRect = _app.clientRect,
        findScrollable = _touch.scrollable,
        log = [],
        copy = [],
        pageFlow,
        displayFlowPropSet,
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

    function cloneObject(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    function toConfig(elem) {
        return findScrollable(elem).data('displayFlow');
    }

    function toDisplayObj(container) {
        container = $(container);
        var index = container.data('index'),
            config = toConfig(container);
        return config.flow[index];
    }

    function notify(text) {
        _touch.notify({ force: true, text: text });
    }

    function flowRoot() {
        return _touch.activePage('.app-display-flow-designer');
    }

    function flowFind(selector) {
        if (!arguments.length)
            selector = '.app-container';
        return typeof selector == 'number' ?
            flowFind('.app-container[data-index="' + selector + '"]') :
            _touch.activePage('.app-display-flow-designer ' + selector);
    }

    function flowSelection() {
        return flowFind('.app-container-selected');
    }

    function flowCutout() {
        return flowFind('.app-container-cut')
    }

    function makeVisible(selection, fullView) {
        selection = selection.first();
        if (selection.length) {
            var screen = _touch.screen(),
                screenRect = { left: screen.left, top: screen.top, right: screen.left + screen.width - 1, bottom: screen.top + screen.height - 1 }
            if (!fullView) {
                if (_app.intersect(getBoundingClientRect(selection), screenRect))
                    return;
            }
            _touch.makeVisible(selection.first(), null, null, null, null, selection.is('.app-container') ? designerToolbars.outerHeight : null);
        }
        return selection;
    }

    function activeTextInput() {
        var activeElement = $(document.activeElement);
        return activeElement.is(':input') ? activeElement : null;
    }

    function blurTextInput() {
        var input = activeTextInput();
        if (input) {
            input.blur();
            findScrollable().focus();
            return true;
        }
    }

    function notifySelectionChanged() {
        var count = flowSelection().length;
        _designer.selectionChanged();
        if (count > 1)
            notify(String.format(resourcesMobile.ItemsSelectedMany, count));
        else
            notify(false);
    }

    _designer = _app.display.designer = {
        attach: function () {
            var scrollable = findScrollable();
            if (!pageFlow)
                pageFlow = JSON.parse(scrollable.data('originalFlow'));
            _touch.activePage('.app-display-flow').addClass('app-display-flow-designer');
        },
        selectionChanged: function () {
            var config = toConfig();
            if (config)
                $document.trigger($.Event('displaydesignerselectionchanged.app', { flow: config.flow, selection: flowSelection() }));
        },
        saveState: function (selection) {
            if (log.position != null)
                log.splice(log.position);
            if (!selection) {
                selection = [];
                flowSelection().each(function () {
                    selection.push($(this).data('index'));
                });
            }
            log.push({ selection: selection, time: new Date(), flow: JSON.stringify(pageFlow) });
            delete log.position;
        },
        undo: function () {
            if (log.length) {
                if (log.position == null) {
                    _designer.saveState();
                    log.position = log.length - 1;
                }
                if (log.position)
                    _designer.restorePageFlow(log[--log.position])
            }
        },
        redo: function () {
            if (log.position >= 0 && log.position < log.length - 1)
                _designer.restorePageFlow(log[++log.position]);
        },
        restorePageFlow: function (state) {
            pageFlow = JSON.parse(state.flow);
            flowSelection().removeClass('app-container-selected');
            flowCutout().removeClass('app-container-cut');
            _designer.refreshPageFlow(state.selection);
        },
        refreshPageFlow: function (selection) {
            _app.display(findScrollable(), pageFlow);
            if (selection != null && !Array.isArray(selection))
                selection = [selection];
            if (selection && selection.length) {
                selection.forEach(function (index) {
                    flowFind(index).addClass('app-container-selected');
                });
                makeVisible(flowFind(selection[0]));
            }
            designer_selectionChanged();
        },
        cut: function () {
            copy = [];
            flowCutout().removeClass('app-container-cut');
            var cutout = flowSelection().addClass('app-container-cut').removeClass('app-container-selected');
            designer_selectionChanged();
            notify(cutout.length > 1 ?
                String.format('Select a container and paste {0} items before or after.', cutout.length) :
                'Select a container and paste the item before or after.'
            );
        },
        copy: function () {
            copy = [];
            flowCutout().removeClass('app-container-cut');
            var selection = flowSelection().each(function () {
                copy.push(cloneObject(pageFlow[$(this).data('index')]));
            });
            notify(String.format('Copied {0} items.', selection.length));
            designer_selectionChanged();
        },
        paste: function (after) {
            var selection = flowSelection(),
                containersToInsert = [],
                containersToRemove = [],
                startIndex = selection.first().data('index'),
                endIndex = selection.last().data('index'),
                targetContainer, targetIndex,
                stateSelection,
                doCopy = copy.length;

            if (!doCopy && (selection.first().is('.app-container-cut') || !flowCutout().length)) {
                notify('Paste is not allowed here.');
                return;
            }

            if (!doCopy) {
                stateSelection = [];
                flowCutout().each(function () {
                    stateSelection.push($(this).data('index'));
                });
            }
            _designer.saveState(stateSelection);
            targetContainer = pageFlow[after ? endIndex : startIndex];
            if (doCopy)
                containersToInsert = cloneObject(copy);
            else {
                flowCutout()
                    .each(function () {
                        var index = $(this).data('index');
                        containersToInsert.push(pageFlow[index]);
                        containersToRemove.push(index);
                    })
                    .removeClass('app-container-cut');
                containersToRemove.reverse().forEach(function (index) {
                    pageFlow.splice(index, 1);
                });
            }
            targetIndex = pageFlow.indexOf(targetContainer);
            containersToInsert.reverse().forEach(function (displayObj) {
                pageFlow.splice(targetIndex + (after ? 1 : 0), 0, displayObj);
            });
            selection.removeClass('app-container-selected');
            _app.display(findScrollable(), pageFlow);
            _designer.refreshPageFlow();
            if (after)
                targetIndex++;
            endIndex = targetIndex + containersToInsert.length - 1
            makeVisible(flowFind(targetIndex));
            while (targetIndex <= endIndex)
                flowFind(targetIndex++).addClass('app-container-selected');
            designer_selectionChanged();
        },
        pasteAfter: function () {
            _designer.paste(true);
        },
        pasteBefore: function () {
            _designer.paste();
        },
        delete: function () {
            var selection = flowSelection(),
                startIndex = selection.first().data('index');
            _designer.saveState();
            pageFlow.splice(startIndex, selection.length);
            if (startIndex == pageFlow.length - 1)
                srartIndex--;
            _designer.refreshPageFlow(startIndex);
        },
        flow: function () {
            var selection = flowSelection(),
                selectedIndex = selection.data('index'),
                displayObj = pageFlow[selectedIndex],
                button = findChangeFlowButton(),
                buttonRect;

            function changeObjectFlow(direction) {
                _designer.saveState();
                if (direction === 'merge')
                    delete displayObj.flow;
                else
                    displayObj.flow = direction;
                _designer.refreshPageFlow(selectedIndex);
            }

            makeVisible(flowFind(selectedIndex));
            buttonRect = getBoundingClientRect(button);

            _touch.listPopup({
                anchor: button,
                x: buttonRect.left + buttonRect.width / 2,
                y: buttonRect.bottom,
                y2: buttonRect.top,
                items: [
                    { text: 'Flow as Row', icon: 'material-icon-arrow-downward', focus: displayObj.flow === 'row', context: 'row', callback: changeObjectFlow },
                    { text: 'Merge With Flow', icon: 'material-icon-call-merge', rotate: 180, focus: (displayObj.flow || 'merge') === 'merge', context: 'merge', callback: changeObjectFlow },
                    { text: 'Flow as Column', icon: 'material-icon-arrow-forward', focus: displayObj.flow === 'column', context: 'column', callback: changeObjectFlow }
                ]
            });
        },
        flowRow: function () {
            _designer.flow();
        },
        flowColumn: function () {
            _designer.flow();
        },
        flowMerge: function () {
            _designer.flow();
        },
        settings: function () {
            var selection = flowSelection().first(),
                selectedIndex = selection.data('index'),
                displayObj = pageFlow[selectedIndex],
                scopes = [];
            // analyze the displayObj and enlist the property scopes
            scopes.push('display.flow');
            scopes.push('display.appearance');
            scopes.push('appbuilder.settings');
            _touch.propGrid('show', {
                target: displayObj,
                propSet: displayFlowPropSet,
                use: scopes,
                context: 'display-flow',
                helpUrl: 'https://codeontime.com/docs',
                location: (getBoundingClientRect(selection).left >= _touch.screen().left + _touch.screen().width / 2) ? 'left' : 'right'
            });
        }
    };


    $document.on('mousedown vclick', '.app-display-flow-designer .app-container', function (e) {
        var container = $(this),
            containerIndex = container.data('index'),
            displayObj = toDisplayObj(container),
            selection, startIndex, endIndex,
            selectAllCut;
        if (displayObj && !displayObj.readOnly) {
            if (e.type === 'mousedown')
                if (_touch.pointer('touch'))
                    return;
                else
                    $.touch.skipMouseEnd = true;
            if (container.is('.app-container-selected') && !e.ctrlKey && !e.shiftKey && flowSelection().length === 1)
                return;
            if (e.ctrlKey)
                container.toggleClass('app-container-selected', !container.is('.app-container-selected'));
            else {
                if (e.shiftKey) {
                    //_touch.clearHtmlSelection();
                    selection = flowSelection();
                    if (selection.length) {
                        startIndex = selection.first().data('index');
                        endIndex = selection.last().data('index');
                        if (containerIndex < startIndex)
                            startIndex = containerIndex;
                        else
                            endIndex = containerIndex;
                    }
                }
                else if (container.is('.app-container-cut') && !flowFind('.app-container-cut.app-container-selected').length) {
                    selectAllCut = true;
                }
                else
                    startIndex = endIndex = containerIndex;
                flowSelection().removeClass('app-container-selected');
                if (selectAllCut)
                    flowCutout().addClass('app-container-selected');
                else if (startIndex === endIndex)
                    container.addClass('app-container-selected');
                else
                    flowFind().each(function () {
                        var c = $(this),
                            cIndex = c.data('index')
                        if (startIndex <= cIndex && cIndex <= endIndex)
                            c.addClass('app-container-selected');
                    });
            }
            notifySelectionChanged();
            return false;
        }
        else
            notify('This display object is read-only.');
    }).on('vclick', 'article', function (e) {
        var selectedContainers = flowSelection().removeClass('app-container-selected app-container-cut');
        if (selectedContainers.length) {
            _designer.selectionChanged();
            notify(false);
            flowFind().css('padding-top', '');
            //_touch.notify({ force: true, text: String.format(resourcesMobile.ItemsSelectedMany, 0) });
        }
    }).on('keydown', '.app-wrapper', function (e) {
        if (!flowRoot().length)
            return;

        var selection = flowSelection(),
            key = e.key,
            shiftKey = e.shiftKey,
            ctrlKey = e.ctrlKey,
            cutout = flowCutout(),
            focusOnSelected, scrollableRect,
            selectedIndex;

        // Undo (Ctrl+Z) - force undo when the CodeMirror has focus
        if (key === 'z' && ctrlKey) {
            setTimeout(_designer.undo());
            return false;
        }
        // Undo (Ctrl+Y) - force redo when the CodeMirror has focus
        if (key === 'y' && ctrlKey) {
            _designer.redo();
            return false;
        }

        if (selection.length || key === 'Tab') {
            if (key === 'Tab') {
                if (selection.length) {
                    focusOnSelected = true;
                    scrollableRect = getBoundingClientRect(findScrollable());
                    selection.each(function () {
                        var r = getBoundingClientRect(this);
                        if (scrollableRect.top < r.bottom && r.top < scrollableRect.bottom)
                            focusOnSelected = false;
                        return focusOnSelected;
                    })
                    if (focusOnSelected) {
                        makeVisible(selection.first())
                        return false;
                    }
                    selection.removeClass('app-container-selected');
                }
                else {
                    if (cutout.length)
                        selection = cutout.first();
                    else
                        selection = shiftKey ? flowFind().first() : flowFind().last();
                }
                if (shiftKey)
                    selection = selection.first();
                else
                    selection = selection.last();
                selectedIndex = selection.data('index');
                if (shiftKey)
                    selectedIndex--;
                else
                    selectedIndex++;
                selection = flowFind(selectedIndex);
                if (!selection.length)
                    if (selectedIndex >= 0)
                        selection = flowFind().first();
                    else
                        selection = flowFind().last();
                selection.addClass('app-container-selected');
                designer_selectionChanged();
                makeVisible(selection);
                return false;
            }
            else if (key === 'Escape') {
                if (!blurTextInput()) {
                    if (cutout.length && cutout.first().is('.app-container-selected'))
                        makeVisible(cutout.removeClass('app-container-cut'));
                    else
                        makeVisible(selection.removeClass('app-container-selected'));
                    designer_selectionChanged();
                }
                return false;
            }
            //else if (key.toLowerCase() === 'x' && ctrlKey) {
            //    blurTextInput();
            //    setTimeout(_designer.cut());
            //    return false;
            //}
            //else if (key.toLowerCase() === 'v' && ctrlKey) {
            //    setTimeout(shiftKey ? _designer.pasteAfter : _designer.pasteBefore);
            //    return false;
            //}
            else if (key.match(/^Arrow(Down|Up|Left|Right)$/) && !activeTextInput()) {
                if (shiftKey) {
                    if (key.match(/^Arrow(Down|Right)$/))
                        makeVisible(flowFind(selection = selection.last().data('index') + 1).addClass('app-container-selected'));
                    else
                        makeVisible(flowFind(selection = selection.first().data('index') - 1).addClass('app-container-selected'));
                    notifySelectionChanged();
                    return false;
                }
                else if (ctrlKey && selection.length > 1) {
                    if (key.match(/^Arrow(Down|Right)$/)) {
                        selection.first().removeClass('app-container-selected');
                        makeVisible(flowSelection().first());
                    }
                    else {
                        selection.last().removeClass('app-container-selected');
                        makeVisible(flowSelection().last());
                    }
                    notifySelectionChanged();
                    return false;
                }
                else if (e.altKey && key === 'ArrowDown' && selection.length === 1) {
                    triggerChangeFlow();
                    return false;
                }
            }
        }
        else if (key === 'Escape' && !selection.length && cutout.length) {
            {
                cutout.addClass('app-container-selected');
                designer_selectionChanged();
                makeVisible(cutout);
                return false;
            }
        }
    }).on('displaydesignerselectionchanged.app', function (e) {
        if (resizing) {
            $document.one('resized.app', designer_selectionChanged);
            pendingSelectionChanged = true;
        }
        else
            designer_selectionChanged();
    }).on('resizing.app', function () {
        if (designerToolbars) {
            designerToolbars.top.hide();
            designerToolbars.bottom.hide();
        }
        resizing = true;
    }).on('resized.app', function () {
        if (!pendingSelectionChanged)
            designer_selectionChanged(); // respond to the width changes that are not causing the workflow since the visual breakpoint has not been triggered
        resizing = false;
    }).on('vclick', '.app-display-flow-toolbar .app-btn', function (e) {
        var that = $(this),
            methodName = toolbarButtonToDesignerMethod(that);
        if (!_designer[methodName])
            notify(methodName);
        else
            _designer[methodName](that);
        return false;
    }).on('context.app', function (e) {
        var flow = findScrollable().data('displayFlow'),
            buttonIndex = 4,
            hasCut, hasBefore;

        if (flow) {
            e.context.splice(0, 0,
                { text: 'Display Flow' },
                { text: 'Undo', icon: 'material-icon-undo', toolbar: false, disabled: !log.length || log.position === 0, callback: _designer.undo, shortcut: 'Ctrl+Z' },
                { text: 'Redo', icon: 'material-icon-redo', toolbar: false, disabled: log.position == null || log.position > log.length - 2, callback: _designer.redo, shortcut: 'Ctrl+Y' },
                {}, {}
            );
            if (designerToolbars && designerToolbars.top.is(':visible')) {
                $.merge(designerToolbars.top, designerToolbars.bottom).find('.app-btn:visible').each(function (index) {
                    var button = $(this),
                        methodName = toolbarButtonToDesignerMethod(button),
                        icon = button.find('.app-icon'),
                        text = icon.data('title'),
                        shortcut = text.match(/\((.+?)\)/),
                        iconName = icon.text(),
                        callback = _designer[methodName];
                    if (methodName.match(/^flow\-/))
                        callback = triggerChangeFlow;
                    if (shortcut)
                        text = text.substring(0, shortcut.index - 1);
                    if (methodName !== 'drag') {
                        if (methodName.match(/^(cut|copy)$/) && !hasCut) {
                            e.context.splice(buttonIndex++, 0, {});
                            hasCut = true;
                        }
                        if (methodName.match(/Before/) && !hasBefore) {
                            e.context.splice(buttonIndex++, 0, {});
                            hasBefore = true;
                        }
                        e.context.splice(buttonIndex++, 0, {
                            text: text,
                            icon: 'material-icon-' + iconName,
                            shortcut: shortcut ? shortcut[1] : null,
                            toolbar: false,
                            callback: callback || function () { },
                            disabled: !callback
                        });
                    }
                });
            }
        }
    });

    function findChangeFlowButton() {
        return designerToolbars.top.find('.app-btn-flow-row:visible,.app-btn-flow-column:visible,.app-btn-flow-merge:visible');
    }

    function triggerChangeFlow() {
        findChangeFlowButton().trigger('vclick');
    }

    function toolbarButton(location, name, icon) {
        var iconElem,
            toolbar,
            tooltips = {
                'drag': 'Drag',
                'settings': 'Settings (F4)',
                'edit': 'Edit (F2)',
                'cut': 'Cut (Ctrl+X)',
                'delete': 'Delete (Del)',
                'copy': 'Copy (Ctrl+C)',
                'insert-before': 'Insert Before',
                'insert-after': 'Insert After',
                'paste-before': 'Paste Before (Ctrl+V)',
                'paste-after': 'Paste After (Ctrl+Shift+V)',
                'flow-row': 'Flow as Row',
                'flow-column': 'Flow as Column',
                'flow-merge': 'Merge With Flow'
            };
        toolbar = location === 'top' ? designerToolbars.top : designerToolbars.bottom;
        if (toolbar.is(':empty'))
            $span('app-btn-separator').appendTo(toolbar);
        icon = icon || name;
        iconElem = _touch.icon('material-icon-' + icon, $span('app-btn app-btn-' + name).appendTo(toolbar)).attr('data-title', tooltips[name]);
        //if (location === 'top')
        //    iconElem.attr('data-tooltip-location', 'above');
        if (icon.match(/call_(merge)/))
            iconElem.css('transform', 'rotate(180deg)');
        $span('app-btn-separator').appendTo(toolbar);
    }

    function toggleToolbarButton(name, state, toolbar) {
        if (designerToolbars)
            if (toolbar)
                toolbar.find('.app-btn-' + name).toggleClass('app-hidden', !state);
            else {
                toggleToolbarButton(name, state, designerToolbars.top);
                toggleToolbarButton(name, state, designerToolbars.bottom);
            }
    }

    function designer_selectionChanged() {
        pendingSelectionChanged = false;

        var selection = flowSelection(),
            article = flowRoot(),
            firstSelected = selection.first(),
            scrollable = findScrollable(),
            scrollableRect = getBoundingClientRect(scrollable),
            scrollTop = scrollable.scrollTop(),
            topContainerRect, bottomContainerRect,
            topToolbarRect, bottomToolbarRect, topHorizOffset, bottomHorizOffset,
            canPaste, canEdit,
            screen = _touch.screen(),
            displayObj;
        if (selection.length) {
            if (!designerToolbars) {
                designerToolbars = {
                    'top': $div('app-display-flow-toolbar app-display-flow-toolbar-top').appendTo(scrollable),
                    'bottom': $div('app-display-flow-toolbar app-display-flow-toolbar-bottom').appendTo(scrollable)
                };
                // top buttons
                toolbarButton('top', 'drag', 'drag_indicator');
                toolbarButton('top', 'flow-row', 'arrow_downward');
                toolbarButton('top', 'flow-column', 'arrow_forward');
                toolbarButton('top', 'flow-merge', 'call_merge');
                toolbarButton('top', 'settings');
                toolbarButton('top', 'edit');
                toolbarButton('top', 'cut', 'content_cut');
                toolbarButton('top', 'copy', 'content_copy');
                toolbarButton('top', 'delete', 'delete_outline');
                toolbarButton('top', 'insert-before', 'add');
                toolbarButton('top', 'paste-before', 'content_paste');

                designerToolbars.height = getBoundingClientRect(designerToolbars.top).height;
                designerToolbars.margin = 3;
                designerToolbars.outerHeight = designerToolbars.height + designerToolbars.margin;
                // bottom buttons
                toolbarButton('bottom', 'drag', 'drag_indicator');
                toolbarButton('bottom', 'insert-after', 'add');
                toolbarButton('bottom', 'paste-after', 'content_paste');
            }
            if (scrollTop + getBoundingClientRect(firstSelected).top - designerToolbars.outerHeight <= scrollableRect.top)
                article.css('padding-top', designerToolbars.outerHeight);
            else if (parseInt(article[0].style.paddingTop || '0')) {
                if (scrollTop + getBoundingClientRect(firstSelected).top - designerToolbars.outerHeight * 2 > scrollableRect.top) {
                    scrollable.scrollTop(scrollTop - designerToolbars.outerHeight);
                    article.css('padding-top', '');
                    setTimeout(designer_selectionChanged, 32);
                    return;
                }
            }
            // change the state of the buttons
            canPaste = !selection.first().is('.app-container-cut') && flowCutout().length || copy.length;
            toggleToolbarButton('paste-before', canPaste);
            toggleToolbarButton('paste-after', canPaste);
            toggleToolbarButton('cut', selection.filter(':not(.app-container-cut)').length);
            canEdit = selection.length === 1;
            toggleToolbarButton('edit', canEdit);
            toggleToolbarButton('settings', canEdit);

            if (selection.length === 1)
                displayObj = pageFlow[firstSelected.data('index')];
            toggleToolbarButton('flow-row', displayObj && displayObj.flow === 'row');
            toggleToolbarButton('flow-column', displayObj && displayObj.flow === 'column');
            toggleToolbarButton('flow-merge', displayObj && (displayObj.flow || 'merge') === 'merge');

            // position the toolbars
            topContainerRect = getBoundingClientRect(selection);
            topToolbarRect = getBoundingClientRect(designerToolbars.top.show());
            topHorizOffset = topToolbarRect.width > topContainerRect.width ? Math.floor((topToolbarRect.width - topContainerRect.width) / 2) : 0;
            bottomContainerRect = getBoundingClientRect($(selection[selection.length - 1]).show());
            bottomToolbarRect = getBoundingClientRect(designerToolbars.bottom.show());
            bottomHorizOffset = topHorizOffset ? Math.floor((bottomToolbarRect.width - bottomContainerRect.width) / 2) : 0;

            designerToolbars.top.data('selection', selection).css({
                'left': Math.max(0, topContainerRect.left - 2 - screen.left - topHorizOffset),
                'top': topContainerRect.top - topToolbarRect.height - designerToolbars.margin + scrollTop - scrollableRect.top
            });
            designerToolbars.bottom.css({
                'left': Math.max(0, bottomContainerRect.left - 2 - screen.left - bottomHorizOffset),
                'top': bottomContainerRect.bottom + designerToolbars.margin + scrollTop - scrollableRect.top
            });
        }
        else {
            if (designerToolbars) {
                flowRoot().css('padding-top', '');
                designerToolbars.top.hide();
                designerToolbars.bottom.hide();
            }
        }
        findScrollable().focus();
        // force the context to be enumerated in order to refresh the available keyboard shortcuts
        var context = [];
        _touch.navContext(context);
    }

    function toolbarButtonToDesignerMethod(button) {
        var name = button.attr('class').match(/\bapp-btn-([\w\-]+)/)[1],
            i = name.indexOf('-');
        while (i > 0) {
            name = name.substring(0, i) + name.charAt(i + 1).toUpperCase() + name.substring(i + 2);
            i = name.indexOf('-');
        }
        return name;
    }

    window.addEventListener('beforeunload', function (e) {
        if (log.length && !(log.position === 0)) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    /*
     *  Display Flow Properties
     */

    displayFlowPropSet = {
        'displayFlow': {
            scope: 'display.flow',
            description: 'Defines the flow and style of the rendering.',
            properties: {
                'flow': {
                    values: [
                        { value: 'row', text: 'Flow as Row' },
                        { value: 'merge', text: 'Merge With Flow' },
                        { value: 'column', text: 'Flow as Column' }
                    ]
                },
                'jumbo': {
                    type: 'bool',
                    style: 'DropDownList'
                },
                'spacing': {
                    type: 'bool'
                },
                'icon': {
                    length: 50
                },
                'background': {
                    properties: {
                        'fluid': {
                            type: 'bool'
                        },
                        'accent': {
                            type: 'bool'
                        }
                    }
                },
                'hero': {
                    properties: {
                        'about': {}, // debugging the collapsing of complex props
                        'id': {},
                        'background': {
                            properties: {
                                'url': {

                                },
                                'accent': {
                                    type: 'bool'
                                },
                                'sticky': {
                                    type: 'bool'
                                }
                            }
                        }
                    }
                }
            }
        },
        'appearance': {
            scope: 'display.appearance',
            description: 'Specify the visual aspects of the element.',
            properties: {
                'hello': {
                    description: 'This is the test property. It has a long description that will not fit into the default height. '
                },
                'world': {
                    type: 'bool',
                    description: 'The world is full of wonders! How do we know it?'
                }
            }
        },
        // ***********************************************
        // "simulation of ~/touch-settings.json groups
        // ***********************************************
        'presentation': {
            scope: 'appbuilder.settings',
            descripton: 'Visual aspects of the app.',
            properties: {
                'splash': {
                    description: '',
                    properties: {
                        'enabled': {
                            type: 'bool'
                        }
                    }
                },
                'ui': {
                    text: 'User Interface',
                    description: '',
                    properties: {
                        'native': {
                            type: 'bool'
                        },
                        'menu': {
                            properties: {
                                'apps': {
                                    text: '"Apps" Button',
                                    properties: {
                                        'location': {
                                            values: ['none', 'toolbar', 'sidebar']
                                        }
                                    }
                                },
                                'location': {
                                    values: ['toolbar', 'sidebar']
                                }
                            }
                        },
                        'themes': {
                            properties: {
                                'icons': {
                                    values: ['filled', 'outlined', 'sharp', 'rounded']
                                }
                            }
                        },
                        'keyboard': {
                            properties: {
                                'touchOnly': {
                                    type: 'bool'
                                },
                                'number': {
                                    properties: {
                                        'enabled': {
                                            type: 'bool'
                                        },
                                        'width': {
                                            type: 'number'
                                        }
                                    }
                                },
                                'tel': {
                                    properties: {
                                        'enabled': {
                                            type: 'bool'
                                        },
                                        'width': {
                                            type: 'number'
                                        }
                                    }
                                }
                            }
                        },
                        'inlineEditing': {
                            properties: {
                                'enabled': {
                                    type: 'bool'
                                },
                                'position': {
                                    values: ['auto', 'top', 'inline']
                                }
                            }
                        },
                        'grid': {
                            properties: {
                                lines: {
                                    properties: {
                                        'horizontal': {
                                            type: 'bool'
                                        },
                                        'vertical': {
                                            type: 'bool'
                                        }
                                    }
                                }
                            }
                        },
                        'readingPane': {
                            properties: {
                                'enabled': {
                                    type: 'bool'
                                },
                                'background': {

                                },
                                'detail': {
                                    properties: {
                                        'actionIcons': {
                                            type: 'bool'
                                        }
                                    }
                                }
                            }
                        },
                        'settings': {
                            text: 'Settings',
                            description: 'Configuration of the Settings menu in the user interface of the app.',
                            properties: {
                                'enabled': {
                                    type: 'bool',
                                    description: 'Specifies if the Settings option is avaialble in the user interface of the app.'
                                },
                                'options': {
                                    description: 'Sepcifies the configuraton options available to the end user in the Settings menu of the app.',
                                    properties: {
                                        'sidebar': {
                                            type: 'bool',
                                            description: 'Specifies if the Sidebar option is visibile in the Settings menu of the app.'
                                        },
                                        'displayDensity': {
                                            type: 'bool',
                                            description: 'Specifies if the Display Density option is visibile in the Settings menu of the app.'
                                        },
                                        'theme': {
                                            type: 'bool'
                                        },
                                        'transitions': {
                                            type: 'bool'
                                        },
                                        'labelsInList': {
                                            type: 'bool'
                                        },
                                        'showSystemButtons': {
                                            type: 'bool'
                                        },
                                        'promoteActions': {
                                            type: 'bool'
                                        },
                                        'smartDates': {
                                            type: 'bool'
                                        },
                                        'initialListMode': {
                                            type: 'bool'
                                        }
                                    }
                                }
                            }
                        },

                    }
                }
            }
        },
        'clientApp': {
            scope: 'appbuilder.settings',
            description: 'Configuration properties of the app running on the end user device.',
            properties: {
                'appName': {
                    description: 'The name of this app.'
                },
                'barcode': {
                    properties: {
                        'enabled': {
                            type: 'bool'
                        }
                    }
                },
                'dates': {
                    text: 'Dates',
                    properties: {
                        'localTime': {
                            properties: {
                                'enabled': {
                                    type: 'bool'
                                }
                            }
                        }
                    }
                },

            }
        },
        'serverApp': {
            scope: 'appbuilder.settings',
            properties: {
                'server': {
                    properties: {
                        'rest': {
                            text: 'REST',
                            properties: {
                                'enabled': {
                                    type: 'bool'
                                },
                                'key': {

                                },
                                'accessTokenDuration': {
                                    type: 'number'
                                },
                                'refreshTokenDuration': {
                                    type: 'number'
                                }
                            }
                        },
                        'geocoding': {
                            description: 'Geocoding makes possible real-time verification of postal addresses and conversion of addresses into latitude and longitude.',
                            properties: {
                                'google': {
                                    description: 'Geocoding configuration options for Google Maps API. Enables verification of the postal addresses and optional conversion into geo locations. *** The valid Goole Maps API key is required to perform Geocoding requests. Sign into your Google management console to get the key.',
                                    properties: {
                                        'key': {
                                            description: 'A valid Goole Maps API key is required to perform geocoding requests. Sign into your Google management console to get a key.'
                                        },
                                        'address': {
                                            type: 'bool',
                                            description: 'Specifies if the automatic address verification with Google Maps API is enabled.'
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    };


})();