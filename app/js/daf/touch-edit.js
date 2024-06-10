/*eslint eqeqeq: ["error", "smart"]*/
/*!
* Data Aquarium Framework - Data Editor for Touch UI
* Copyright 2018-2021 Code On Time LLC; Licensed MIT; http://codeontime.com/license
*/

(function () {
    var _app = $app,
        _touch = _app.touch,
        _input = _app.input,
        _edit,
        fnVisible = _touch.fnVisible,
        resources = Web.DataViewResources,
        resourcesMobile = resources.Mobile,
        resourcesModalPopup = resources.ModalPopup,
        labelReadOnly = resourcesMobile.ReadOnly,
        getBoundingClientRect = _app.clientRect,
        elementAt = _app.elementAt,
        //_focusFrameTimeout, 
        _keyboardActivateTimeout,
        findDataView = _app.findDataView,
        findScrollable = _touch.scrollable,
        findActivePage = _touch.activePage;

    function notify(text) {
        _touch.notify({ text: text, force: true });
    }

    function toReadOnlyWarning(field) {
        return String.format(labelReadOnly, typeof field == 'string' ? field : field.HeaderText);
    }

    function hasSiblingItem(elem, location) {
        var item = elem.closest('.dv-item');
        if (location === 'above')
            return item.prev('.dv-item').length > 0;
        var next = item.next('.dv-item');
        return next.length > 0 && !next.find('.ui-btn').is('.app-calculated,.dv-action-see-all');
    }

    function isMobileEditor() {
        return _touch.settings('ui.inlineEditing.position') === 'top' || _touch.pointer('touch');
    }

    function restoreFocusFrame(editorDataView, status) {
        var targetDataView = editorDataView.session('targetDataView'),
            targetElem, rowStatus;
        if (targetDataView) {
            targetElem = targetDataView.elem;
            rowStatus = targetElem.closest('.dv-item').find('.app-row-status').removeClass('app-row-status-pending app-row-status-error');
            if (status)
                rowStatus.addClass('app-row-status-' + status);
            _edit.sync({ dataView: targetDataView.id, elem: targetElem, force: true, scrollIntoView: true });
        }
    }

    //function showfocusFrameOnSummaryView(dataView, scrollable) {
    //    if (dataView._dataViewFieldName) {
    //        scrollable.find('.app-focus[data-input="dataview"]').removeClass('app-focus');
    //        scrollable.find('.app-field-' + dataView._dataViewFieldName).addClass('app-focus');
    //    }
    //}

    function triggerTap(elem, force) {
        _touch.lastTouch(false);
        if (!elem.is('.app-selected') || force) {
            if (elem.length)
                _touch.tapping(true);
            elem.trigger($.Event('vclick', { ctrlKey: true }));
        }
        _touch.lastTouch(true);
    }

    function triggerTapOnNewRow(dataView) {
        var dataViewId = dataView._id,
            newItemLink = $('#' + dataViewId + ',[data-for="' + dataViewId + '"]').find('.app-row-status-new').closest('.ui-btn');
        triggerTap(newItemLink, true);
        return !!newItemLink.length;
    }

    function eventToKeyCode(e) {
        return e.keyCode || e.which;
    }

    function _edit_activate() {
        if (!_input.barcode(':input'))
            _edit.activate(); // do not activate in the "keydown" handler
    }

    _app.prototype.inlineEditing = function (value, persist) {
        var that = this,
            enabled;
        if (!that._inlineEditingChecked) {
            that._inlineEditingChecked = true;
            if (that.tagged('inline-editing-option-none')) {
                if (that.tagged('inline-editing') || that.tagged('inline-editing-when-pointer') && !_touch.pointer('touch'))
                    that.tag('inline-editing-mode');
            }
            else {
                // inline editing is controller by the user
                enabled = that.pageProp('inlineEditing');
                if (enabled != null)
                    that.inlineEditing(enabled);
                else {
                    if (that.tagged('inline-editing') && !that._lookupInfo) // lookups always ignore inline editing even when specified
                        that.tag('inline-editing-mode');
                }
            }
        }
        if (arguments.length) {
            if (value)
                that.tag('inline-editing-mode');
            else
                that.untag('inline-editing-mode');
            if (persist !== false)
                that.pageProp('inlineEditing', value);
        }
        else
            return !!that.tagged('inline-editing-mode');
    };

    function elemToFieldName(elem) {
        var fieldName;
        if (elem.length) {
            fieldName = elem.attr('class').match(/\bapp-field-(\S+)\b/);
            if (fieldName)
                fieldName = fieldName[1];
        }
        return fieldName;
    }

    function inlineFields(dataView) {
        var fields = [];
        dataView._fields.forEach(function (f) {
            var fieldName = f.Name;
            if (f.Type !== 'DataView' && !f.isReadOnly())
                fields.push(fieldName);
        });
        return fields;
    }

    function scrollGridTo(dataView, scrollLeft) {
        _touch.scrollGrid(dataView, scrollLeft);
    }

    function scrollGridHorizontally(dataView, elem) {
        var grid = elem.closest('.app-grid');
        if (grid.length) {
            var availWidth = dataView.session('grid-avail-width'),
                dataItem = elem.closest('.dv-item'),
                maxScroll = Math.ceil(availWidth - availWidth * (getBoundingClientRect(dataItem).width/*.width()*/ / availWidth)),
                scrollLeft = dataView.session('scroll-left') || 0,
                originalScrollLeft = scrollLeft,
                lastFixedField = dataItem.find('.app-frozen').last(),
                frameRect = getBoundingClientRect(_edit.frame()),
                frameRectRight = frameRect.right,
                dataItemRect = getBoundingClientRect(dataItem),
                dataItemRectRight = dataItemRect.right,
                lastFixedFieldRect = lastFixedField.length ? getBoundingClientRect(lastFixedField) : getBoundingClientRect(dataItem.find('.app-frozen-spacer'));
            if (_touch.pointer('mouse'))
                dataItemRectRight -= 6; // reduce by the width of the VScrollBar
            if (frameRectRight > dataItemRectRight)
                // scroll right
                scrollLeft = Math.min(frameRectRight - dataItemRectRight + scrollLeft + 16, maxScroll);
            else if (lastFixedFieldRect && lastFixedFieldRect.right > frameRect.left) {
                if (!elem.is('.app-frozen'))
                    scrollLeft = Math.max(scrollLeft - (lastFixedFieldRect.right - frameRect.left) - 16, 0);
            }
            else if (dataItemRect.left > frameRect.left)
                scrollLeft = Math.max(scrollLeft - (dataItemRect.left - frameRect.left) - 16, 0);
            if (originalScrollLeft !== scrollLeft) {
                scrollGridTo(dataView, scrollLeft);
                return true;
            }
        }
    }

    function isFieldReadOnly(field) {
        var readOnly = field.isReadOnly();
        if (readOnly) {
            _input._buffer = null;
            //_touch.notify({ text: String.format(labelReadOnly, field.HeaderText), force: true });
            notify(toReadOnlyWarning(field));
            //var dataView = mobile.dataView();
            //_input.focus(dataView._allFields[ _edit.field());
            _input.focus({ lastFocused: true });
        }
        return readOnly;
    }

    _edit = _touch.edit = {
        instance: function () {
            var dataView = _touch.dataView();
            return dataView && dataView._inlineEditor ? dataView : null;
        },
        frame: function (value) {
            var frame = _edit._frame;
            if (value === false) {
                if (frame)
                    frame.remove();
                _edit._frame = null;
            }
            if (value === ':visible')
                return frame && frame[0].style.visibility !== 'hidden' && frame.parent().length > 0;
            if (value === ':active')
                return frame && frame[0].style.visibility !== 'hidden' && frame.closest('.ui-page-active').length > 0;
            if (value === 'show') {
                if (frame) {
                    frame.css({ visibility: '', display: '' });
                    //frame[0].style.visibility = '';
                    //frame[0].style.display = '';
                    _edit.sync({ scrollIntoView: false });
                }
            }
            else if (value === 'hide') {
                if (frame)
                    frame[0].style.visibility = 'hidden';
            }
            else if (!frame)
                frame = _edit._frame = _app.html.$span('app-focus-frame');
            return frame;
        },
        field: function (fieldName) {
            if (arguments.length)
                return _edit._fieldName == fieldName;
            return _edit._fieldName;
        },
        dataView: function () {
            var dataView;
            if (_edit.frame(':visible'))
                dataView = findDataView(_edit._dataViewId);
            return dataView;
        },
        fieldElem: function (dataView) {
            if (!arguments.length)
                dataView = _edit.dataView();
            var fieldElem, fieldName,
                pageInfo, containerSelector;
            if (dataView) {
                fieldName = dataView.session('dataEditor').fieldName;
                pageInfo = _touch.pageInfo();
                containerSelector = '>';
                if (!pageInfo || pageInfo.id !== dataView._id)
                    containerSelector = '.app-echo[data-for="' + dataView._id + '"]';
                fieldElem = findScrollable().find(containerSelector + ' .app-listview .app-selected .app-field-' + fieldName).filter(fnVisible);
            }
            return fieldElem;
        },
        dataItem: function (elem) {
            var fieldElem = elem || _edit.fieldElem();
            return fieldElem ? fieldElem.closest('.dv-item') : null;
        },
        detach: function (options) {
            if (!_edit._moving)
                if ((!arguments.length || (options === true || _edit._dataViewId === options)) && !_edit._active) {
                    var frame = _edit._frame;
                    if (frame) {
                        frame.css('visibility', 'hidden');
                        if (options === true) {
                            frame.closest('.ui-page').find('.app-field-is-selected').removeClass('app-field-is-selected app-field-is-selected2');
                            frame.remove();
                        }
                    }
                }
        },
        sync: function (options) {
            var exit,
                pending = _edit._pending;
            if (!exit && options && options.reset && pending) {
                var editorDataViewId = pending.editor,
                    editorDataView = findDataView(editorDataViewId);
                $('#' + editorDataViewId).removeClass('app-page-inlineeditor-inactive');
                _edit._pending = null;
                restoreFocusFrame(editorDataView, 'error');
                _input.focus({ lastFocused: true });
                exit = true;
            }
            if (_edit._pending || _app.dragMan._active)
                exit = true;
            if (exit) return;
            if (!options)
                options = {};
            var originalElem = options.elem,
                elem = originalElem,
                scrollable;// = _touch.scrollable(elem);
            //if (!elem || !elem.length)
            //    elem = scrollable;
            var dv = options.dataView || _edit._dataViewId,
                dataView = dv ? (typeof dv === 'string' ? findDataView(dv) : dv) : _touch.toDataView(elem),
                editorOptions,
                fieldName = options.fieldName;
            if (dataView && dataView.inlineEditing()) {
                if (dataView.get_isForm() && !_edit.instance())
                    _edit.detach();
                else {
                    if (_touch.isInTransition()) {
                        _edit._lastSyncOptions = options;
                        return;
                    }
                    editorOptions = dataView.session('dataEditor') || {};
                    var fieldElem, fieldData,
                        listview;
                    if (elem && elem.is('.app-field')) {
                        if (!fieldName)
                            fieldName = elemToFieldName(elem);
                        listview = elem = elem.closest('.app-listview');
                    }
                    else {
                        scrollable = _touch.scrollable(elem);
                        if (_touch.dataView() === dataView)
                            listview = elem = scrollable.find('.app-listview');
                        else
                            listview = elem = scrollable.find('.app-echo[data-for="' + dataView._id + '"]').find('.app-listview');
                        listview = listview.first();
                    }
                    if (!fieldName)
                        fieldName = editorOptions.fieldName;
                    if (!fieldName && dataView._allFields)
                        fieldName = dataView._allFields[dataView._fields[0].AliasIndex].Name;
                    if (fieldName) {
                        if (originalElem && originalElem.is('.app-field-' + fieldName))
                            fieldElem = originalElem;
                        else
                            fieldElem = elem.find('.dv-item .ui-btn.app-selected .app-field' + (fieldName ? ('-' + fieldName) : '')).filter(fnVisible).first();
                        if (!fieldElem.length) {
                            fieldName = dataView._allFields[dataView._fields[0].AliasIndex].Name;
                            fieldElem = elem.find('.dv-item .ui-btn.app-selected .app-field' + (fieldName ? ('-' + fieldName) : '')).filter(fnVisible).first();
                        }
                        if (fieldElem.length && (elem.closest('.ui-page-active').length || options.force)) {
                            if (!scrollable)
                                scrollable = _touch.scrollable(fieldElem);
                            if (!fieldName)
                                fieldName = elemToFieldName(fieldElem);
                            if (fieldName) {
                                dataView.session('dataEditor', { fieldName: fieldName });
                                fieldData = fieldElem.find('.app-field-data').last();
                                if (!fieldData.length)
                                    fieldData = fieldElem;
                                var rect = getBoundingClientRect(fieldData),
                                    scrollableOffset = getBoundingClientRect(scrollable),//.offset(),
                                    isFirstRow, dataItem,
                                    frame = _edit.frame(),
                                    oldDataViewId = _edit._dataViewId;
                                if (oldDataViewId !== dataView._id) {
                                    _edit._dataViewId = dataView._id;
                                    if (oldDataViewId)
                                        _touch.summary(oldDataViewId).find('.app-field-is-selected').removeClass('app-field-is-selected app-field-is-selected2');
                                }
                                if (!frame.parent().is(scrollable)) {
                                    frame.appendTo(scrollable);
                                    //showfocusFrameOnSummaryView(dataView, scrollable);
                                }
                                //if (frame.css('visibility') == 'hidden') {
                                //    fieldData.closest('.ui-page').removeData('last-focused-field');
                                //    showfocusFrameOnSummaryView(dataView, scrollable);
                                //}
                                if (options.force !== true && options.ignoreOtherInputs !== true && $(document.activeElement).closest('[data-input]').length) // do not grab focus if there is an active [data-input] with focus
                                    return;
                                if (fieldData.is('.app-field-type-bool')) {
                                    var parentHeight = fieldData.parent().height();
                                    rect = { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
                                    rect.top = rect.top - (parentHeight - rect.height) / 2;
                                    rect.height = parentHeight;
                                }
                                frame.css({ visibility: '', display: '' });
                                frame.css({
                                    /*zIndex: fieldData.css('z-index'), */left: rect.left - scrollableOffset.left /*+ scrollable.scrollLeft()*/ - 1,
                                    top: Math.round(rect.top - scrollableOffset.top + scrollable.scrollTop()), width: rect.width + 2, height: Math.round(rect.height)
                                });
                                if (options.scrollIntoView && scrollGridHorizontally(dataView, fieldElem)) {
                                    options.scrollIntoView = false;
                                    _edit.sync(options);
                                    return;
                                }
                                if (listview.is('.app-grid')) {
                                    dataItem = fieldData.closest('.dv-item');
                                    isFirstRow = !dataItem.prev().is('.dv-item');
                                    var gridHeader = listview.find('.app-grid-header'),
                                        gridHeader2 = _touch.dataView() === dataView ? scrollable.closest('.ui-page').find('.dv-heading .app-grid-header') : $(),
                                        gridHeader3 = _touch.stickyHeaderBar(scrollable),
                                        selectedColumn1 = gridHeader.find('.app-field-is-selected'),
                                        selectedColumn2 = gridHeader2.find('.app-field-is-selected'),
                                        selectedColumn3 = gridHeader3.find('.app-field-is-selected'),
                                        fieldSelector;
                                    if (!selectedColumn1.length && !selectedColumn2.length ||
                                        selectedColumn1.length && (selectedColumn1.attr('data-field-name') !== fieldName || isFirstRow && selectedColumn1.is('.app-field-is-selected2') || !isFirstRow && !selectedColumn1.is('.app-field-is-selected2')) ||
                                        selectedColumn2.length && (selectedColumn2.attr('data-field-name') !== fieldName || isFirstRow && selectedColumn2.is('.app-field-is-selected2') || !isFirstRow && !selectedColumn2.is('.app-field-is-selected2')) ||
                                        selectedColumn3.length && (selectedColumn3.attr('data-field-name') !== fieldName || isFirstRow && selectedColumn2.is('.app-field-is-selected2') || !isFirstRow && !selectedColumn3.is('.app-field-is-selected2'))) {
                                        selectedColumn1.removeClass('app-field-is-selected app-field-is-selected2');
                                        selectedColumn2.removeClass('app-field-is-selected app-field-is-selected2');
                                        selectedColumn3.removeClass('app-field-is-selected app-field-is-selected2');
                                        fieldSelector = '[data-field-name="' + fieldName + '"]';
                                        gridHeader.find(fieldSelector).addClass('app-field-is-selected').toggleClass('app-field-is-selected2', !isFirstRow);
                                        gridHeader2.find(fieldSelector).addClass('app-field-is-selected').toggleClass('app-field-is-selected2', !isFirstRow);
                                        gridHeader3.find(fieldSelector).addClass('app-field-is-selected').toggleClass('app-field-is-selected2', !isFirstRow);
                                    }
                                }
                                // if (_touch.lastTouch())
                                if (options.scrollIntoView !== false)
                                    _touch.makeVisible(_edit.frame(), scrollable, dataItem);
                                else {
                                    var listViewRect = getBoundingClientRect(dataItem.closest('.app-listview')),
                                        frameRect = getBoundingClientRect(frame),
                                        spacer = dataItem.find('.app-frozen-spacer'),
                                        spacerRect = getBoundingClientRect(spacer);
                                    if (frameRect.left > listViewRect.right)
                                        frame.css('display', 'none');
                                    else if (frameRect.right > listViewRect.right)
                                        frame.css('width', frameRect.width - (frameRect.right - listViewRect.right));
                                    if (spacer.length && !dataItem.find('.app-field-' + fieldName).is('.app-frozen'))
                                        if (frameRect.right < spacerRect.right)
                                            frame.css('display', 'none');
                                        else if (frameRect.left < spacerRect.right)
                                            frame.css({ left: spacerRect.right + 1, width: frameRect.right - (spacerRect.right + 1) });
                                }
                                if (!$('.app-data-input').length)
                                    scrollable.focus();
                                if (options.allowToggle && _touch.lastTouch() != null && fieldElem.is('.app-field-type-bool') && _touch.touched(fieldElem.find('i')) && !_touch.busy())
                                    _edit.toggleBool(fieldElem);
                            }
                        }
                    }
                }
            }
        },
        scrollIntoView: function (elem) {
            _touch.makeVisible(_edit.dataItem(elem));
        },
        showField: function (editorDataView, fieldName, container) {
            _app.touch.edit.sync({ reset: true });
            if (fieldName != _edit._fieldName) {
                var targetDataView = editorDataView.session('targetDataView'),
                    elem = targetDataView.elem,
                    dv = findDataView(targetDataView.id);
                _edit._fieldName = fieldName;
                _input.evaluate({
                    dataView: editorDataView, row: editorDataView.editRow(), fields: [],
                    container: container || findScrollable().find('[data-input-container="' + editorDataView._id + '"]'), resize: true
                });
                //var originalFieldName = _edit._fieldName,
                //    originalElem = targetDataView.elem;
                elem = elem.closest('.dv-item').find('.app-field-' + dv._allFields[dv.findField(fieldName).AliasIndex].Name).filter(fnVisible);
                targetDataView.elem = elem;
                _edit.sync({ dataView: targetDataView.id, elem: elem, scrollIntoView: true, force: true });
                _touch.resetPageHeight();
            }
        },
        toSyncKey: function (dataView) {
            var pending = _edit._pending;
            if (pending && pending.dataViewId === dataView._id && pending.syncKey)
                return pending.syncKey;
            return dataView._syncKey;
        },
        moveInput: function (e) {
            var editorDataView = _touch.dataView(),
                inlineFields = editorDataView._inlineFields,
                availableFields = editorDataView._availableFields, visibleFields,
                fieldName = _edit.field(), forcedFieldName, fieldIndex, rowStatus, syncKey,
                direction = e.direction || 'enter'; // Ctrl + Enter on non-lookup will have no direction

            if (_touch.pointer('touch'))
                direction = direction === 'down' ? 'right' : direction === 'up' ? 'left' : direction;

            $(document.activeElement).blur();
            if (_input.valid()) {

                var targetDataView = editorDataView.session('targetDataView'),
                    elem = targetDataView.elem,
                    dv = findDataView(targetDataView.id),
                    isNewRow = elem.closest('.dv-item-new').length > 0;
                if (!availableFields) {
                    availableFields = editorDataView._availableFields = [];
                    visibleFields = [];
                    elem.closest('.dv-item').find('.app-field').filter(fnVisible).each(function (fieldElem) {
                        var that = this,
                            field = that.className.match(/\bapp\-field\-(.+?)\b/);
                        if (field) {
                            field = field[1];
                            field = dv.findFieldUnderAlias(field);
                            if (field) {
                                field = field.Name;
                                if (inlineFields.indexOf(field) !== -1)
                                    availableFields.push(field);
                            }
                        }
                    });
                }
                fieldIndex = availableFields.indexOf(fieldName);
                if (direction === 'right') {
                    fieldIndex++;
                    if (fieldIndex > availableFields.length - 1) {
                        if (hasSiblingItem(elem, 'below') || isNewRow) {
                            fieldIndex = 0;
                        }
                        else
                            fieldIndex = availableFields.length - 1;
                        if (!isNewRow) {
                            //scrollGridTo(dv, 0);
                            //fieldIndex = 0;
                            //_edit.showField(editorDataView, availableFields[0]);
                        }
                        direction = 'down';
                    }
                }
                else if (direction === 'left') {
                    fieldIndex--;
                    if (fieldIndex < 0) {
                        if (hasSiblingItem(elem, 'above'))
                            fieldIndex = availableFields.length - 1;
                        else
                            fieldIndex = 0;
                        direction = 'up';
                    }
                }
                else if (typeof direction !== 'string') {
                    fieldIndex = -1;
                    // move to the field related to the specified element
                    var directionElem = direction.closest('.app-field'),
                        directionFieldName = elemToFieldName(directionElem),
                        directionField;
                    if (directionFieldName) {
                        directionField = dv.findFieldUnderAlias(directionFieldName);
                        if (directionField) {
                            fieldIndex = availableFields.indexOf(directionField.Name);
                            // decide if the row needs to be posted
                            var targetItem = targetDataView.elem.closest('.dv-item'),
                                directionItem = directionElem.closest('.dv-item');
                            if (targetItem.is(directionItem)) {
                                if (isFieldReadOnly(directionField))
                                    fieldIndex = -1;
                                else {
                                    direction = 'field';
                                }
                            }
                            else {
                                direction = directionElem;
                                forcedFieldName = directionField.Name;
                            }
                        }
                    }
                }
                fieldName = availableFields[fieldIndex] || forcedFieldName;
                if (fieldName) {
                    if (direction === 'right' || direction === 'left' || direction === 'field') {
                        _edit.showField(editorDataView, fieldName);
                        _input.focus({ fieldName: fieldName });
                    }
                    else {
                        if (direction === 'down' || direction === 'up') {
                            targetItem = elem.closest('.dv-item');
                            if (direction === 'down')
                                targetItem = targetItem.next();
                            else
                                targetItem = targetItem.prev();
                            targetItem = targetItem.find('.ui-btn');
                            if (!isNewRow && !targetItem.is('.app-calculated') && targetItem.is(':visible')) {
                                var newDirection = targetItem.find('.app-field-' + fieldName);
                                if (newDirection.length)
                                    direction = newDirection;
                            }
                            else if (isNewRow) {
                                var prevItem = elem.closest('.dv-item').prev().find('.ui-btn'),
                                    prevDataContext = prevItem.length ? prevItem.data('data-context') : null,
                                    i, keyFields;
                                if (fieldIndex !== 0) {
                                    fieldName = availableFields[0];
                                    scrollGridTo(dv, 0);
                                    _edit.showField(editorDataView, fieldName);
                                }
                                if (prevDataContext) {
                                    //prevItem.addClass('.app-selected-hidden');
                                    direction = prevDataContext.row;
                                    syncKey = [];
                                    keyFields = dv._keyFields;
                                    for (i = 0; i < keyFields.length; i++)
                                        syncKey.push(direction[keyFields[i].Index]);
                                }
                                direction = 'new';
                            }
                            else
                                direction = 'enter';
                        }
                        // post or cancel the current record and move to the specified direction and field
                        findActivePage().addClass('app-page-inlineeditor-inactive');
                        if (typeof direction !== 'string' && !Array.isArray(direction)) {
                            _edit.sync({ dataView: dv, elem: direction, force: true, scrollIntoView: true });
                            direction = direction.closest('.ui-btn').data('dataContext');
                            if (direction)
                                direction = direction.row;
                        }
                        var pending = _edit._pending = {
                            editor: editorDataView._id,
                            pageId: _edit.frame().closest('.ui-page').attr('id'),
                            dataViewId: targetDataView.id,
                            action: editorDataView.changed() ? 'post' : 'cancel',
                            field: dv._allFields[dv.findField(fieldName).AliasIndex].Name,
                            originalField: fieldName,
                            direction: direction, syncKey: syncKey
                        };
                        rowStatus = targetDataView.elem.closest('.dv-item').find('.app-row-status');//.attr('class', 'app-row-status');
                        if (pending.action === 'cancel') {
                            pending.syncKey = null;
                            _touch.goBack();
                        }
                        else {
                            rowStatus.addClass('app-row-status-pending');
                            // post - execute the default action in the context of inline editor "form" view
                            _touch.executeInContext();
                        }
                    }
                }
            }
            e.preventDefault();
        },
        syncKey: function (dataView) {
            var pending = _edit._pending;
            return pending && dataView._id === pending.dataViewId ? pending.syncKey : null;
        },
        _broadcastValues: function (editorDataView, values) {
            var targetDataView = editorDataView.session('targetDataView');
            if (!targetDataView)
                return;
            var targetElem = targetDataView.elem,
                item = targetElem.closest('.dv-item'),
                isGrid = item.closest('.app-grid').length > 0;
            values.forEach(function (fv) {
                var field = editorDataView.findField(fv.name || fv.Name),
                    newValue = fv.name ? ('newValue' in fv ? fv.newValue : fv.value) : ('NewValue' in fv ? fv.NewValue : fv.Value),
                    t;
                if (field) {
                    item.find('.app-field-' + field.Name).filter(fnVisible).each(function () {
                        var elem = $(this),
                            fieldData,
                            undoData = elem.data('inline-undo');
                        if (undoData == null)
                            elem.data('inline-undo', { html: elem.html(), isNull: elem.closest('.app-null').length > 0 });
                        t = field.text(newValue);
                        fieldData = elem.find('.app-field-data');
                        if (!fieldData.length)
                            fieldData = elem;
                        //if (isGrid)
                        //    elem.toggleClass('app-null', newValue == null);
                        //else
                        //    if (newValue == null && !fieldData.parent().is('.app-null'))
                        //        fieldData.wrap('<span class="app-null"/>');
                        //    else if (newValue != null && fieldData.parent().is('.app-null'))
                        //        fieldData.unwrap('.app-null');
                        fieldData.toggleClass('app-null', newValue == null);
                        var checkBox = fieldData.find('.material-icon-check-box,.material-icon-check-box-outline-blank');
                        if (checkBox.length && !newValue)
                            checkBox.text('check_box_outline_blank').addClass('material-icon-check-box-outline-blank').removeClass('material-icon-check-box');
                        else if (checkBox.length && newValue)
                            checkBox.text('check_box').addClass('material-icon-check-box').removeClass('material-icon-check-box-outline-blank');
                        else
                            if (field.htmlEncode())
                                fieldData.text(t);
                            else
                                fieldData.html(t);
                    });
                }
            });
            _edit.sync({ dataView: findDataView(targetDataView.id), elem: targetElem, force: true, scrollIntoView: true });
            item.find('.app-row-status:not(.app-row-status-new)').addClass('app-row-status-edit');
        },
        undo: function (dataView) {
            // undo inline editor 
            if (!dataView)
                dataView = _touch.dataView();
            var targetDataView = dataView.session('targetDataView'),
                item = targetDataView.elem.closest('.dv-item');
            item.find('.app-field').each(function () {
                var fieldElem = $(this),
                    undo = fieldElem.data('inline-undo');
                if (undo != null) {
                    fieldElem.removeData('inline-undo');
                    fieldElem.html(undo.html);
                    if (!fieldElem.find('.app-field-data').length)
                        fieldElem.toggleClass('app-null', undo.isNull);
                }
            });
            item.find('.app-row-status').removeClass('app-row-status-edit');
            _edit.sync({ dataView: _edit._dataViewId, elem: targetDataView.elem, force: true });
        },
        commit: function (e) {
            var pending = _edit._pending,
                eventType,
                pageId, scrollable,
                action, fieldName,
                direction;

            function moveAsDirected() {
                var moveDown = direction === 'down',
                    stayPut = !direction || direction === 'enter',
                    goToNew = direction === 'new',
                    dataView = findDataView(pending.dataViewId),
                    fieldElem, listview, foundMatch;

                if (action === 'post' && dataView._busy())
                    return;
                _edit._pending = null;

                if (direction === 'new')
                    direction = new Array(dataView._allFields.length);
                if (direction === 'up' || moveDown || stayPut) {
                    _edit.sync({ dataView: dataView, fieldName: fieldName, scrollIntoView: true });
                    if (!stayPut)
                        scrollable.trigger($.Event('keydown', { keyCode: moveDown ? 40 : 38 }));
                    if (_edit._fieldName !== pending.originalField || stayPut)
                        _edit.sync({ dataView: dataView, fieldName: fieldName, scrollIntoView: true });
                }
                else if (direction && Array.isArray(direction)) {
                    dataView.session('dataEditor').fieldName = fieldName;
                    fieldElem = _edit.fieldElem(dataView);
                    listview = $(fieldElem).closest('.app-listview');
                    listview.find('.dv-item .ui-btn').each(function () {
                        var link = $(this),
                            dataContext = link.data('data-context'),
                            row, same, i, keyFields, keyFieldIndex;
                        if (dataContext) {
                            row = dataContext.row;
                            if (row) {
                                // compare direction with the row
                                same = true;
                                keyFields = dataView._keyFields;
                                for (i = 0; i < keyFields.length; i++) {
                                    keyFieldIndex = keyFields[i].Index;
                                    if (direction[keyFieldIndex] != row[keyFieldIndex]) {
                                        same = false;
                                        break;
                                    }
                                }
                                if (same) {
                                    if (pending.syncKey && !goToNew) {
                                        link.addClass('app-selected');
                                        triggerTap(link, true); // clear selection from the synced item
                                        var nextItem = link.parent().nextAll('.dv-item-new');
                                        triggerTap(nextItem.find('.ui-btn'), true); // tap on the next "new template" item instead
                                        _touch.stickyHeaderBar().hide();
                                        _touch.stickyHeader();
                                    }
                                    else
                                        triggerTap(link.removeClass('app-selected'));
                                    foundMatch = true;
                                    return false;
                                }
                            }
                        }
                    });
                    if (!foundMatch && goToNew) {
                        var echo = _touch.summary(listview);
                        if (echo.length) {
                            _touch.lastTouch(false);
                            echo.find('.dv-action-see-all .app-btn-next').trigger($.Event('vclick', { feedback: false }));
                            _touch.lastTouch(true);
                            triggerTap(echo.find('.app-listview .dv-item-new .ui-btn'));
                        }
                    }
                }
                scrollable.focus();
            }

            if (pending) {
                pageId = findActivePage().attr('id');
                if (pending.pageId === pageId) {
                    scrollable = findScrollable();
                    action = pending.action;
                    direction = pending.direction;
                    eventType = e.type;
                    fieldName = pending.field;

                    if (action === 'cancel' && eventType === 'pagereadycomplete') {
                        moveAsDirected();
                    }
                    else if (action === 'post' && eventType === 'dataviewrefresh')
                        moveAsDirected();
                    else
                        return;
                }
            }
        },
        move: function (options) {
            if (_edit._moving)
                return true;
            _edit._moving = true;
            if (typeof options === 'string')
                options = { direction: options };
            var direction = options.direction,
                originalEvent = options.originalEvent,
                shiftKey = originalEvent.shiftKey,
                ctrlKey = originalEvent.ctrlKey,
                metaKey = originalEvent.metaKey,
                dataView = _edit.dataView(),
                fieldElem = _edit.fieldElem(dataView),
                result, handleUpDown, isGrid, movingDown, dataItem, nextDataItem, nextPrev;

            function syncFieldElem() {
                if (!(fieldElem instanceof jQuery))
                    fieldElem = $(fieldElem);
                _touch.tooltip(false);
                _edit.sync({ dataView: dataView, elem: fieldElem, scrollIntoView: isGrid });
                if (!handleUpDown)
                    fieldElem = null;
            }
            switch (direction) {
                case 'pageup':
                case 'pagedown':
                    summaryView = findScrollable().focus().find('.app-focus[data-input="dataview"]');
                    if (summaryView.length) {
                        _edit.frame('hide');
                        _touch.summary(summaryView).find('.dv-action-see-all .app-btn-' + (direction === 'pageup' ? 'prev' : 'next') + ':not(.app-btn-disabled)').trigger($.Event('vclick', { feedback: false }));
                        _edit.sync();
                        result = true;
                    }
                    _edit._moving = false;
                    return result;
            }

            if (fieldElem) {
                var listview = fieldElem.closest('.app-listview'),
                    summaryView = listview.closest('.app-echo'), nextItemLink,
                    fieldElements = fieldElem.closest('.dv-item').find('.app-field').filter(fnVisible),
                    fieldElemIndex;
                isGrid = listview.is('.app-grid');
                fieldElements.each(function (index) {
                    if ($(this).is(fieldElem)) {
                        fieldElemIndex = index;
                        return false;
                    }
                });

                if (shiftKey)
                    switch (direction) {
                        case 'enter':
                            direction = 'up';
                            break;
                    }
                if (!ctrlKey && direction === 'enter')
                    direction = 'down';
                handleUpDown = summaryView.length > 0 && !ctrlKey;
                if (direction === 'tab') {
                    if (shiftKey) {
                        if (!fieldElemIndex) {
                            // select the last element and let the handler of the page wrapper to move the cursor up
                            if (hasSiblingItem(fieldElem, 'above')) {
                                fieldElem = fieldElements[fieldElements.length - 1];
                                syncFieldElem();
                                if (handleUpDown)
                                    direction = 'up';
                            }
                            else if (handleUpDown)
                                direction = 'up';
                        }
                        else
                            direction = 'left';
                    }
                    else
                        if (fieldElemIndex === fieldElements.length - 1) {
                            // select the first element and let the handler of the page wrapper to move the cursor down
                            if (hasSiblingItem(fieldElem, 'below')) {
                                fieldElem = fieldElements[0];
                                syncFieldElem();
                                if (handleUpDown)
                                    direction = 'down';
                                scrollGridTo(dataView, 0);
                            }
                            else if (handleUpDown)
                                direction = 'down';
                        }
                        else
                            direction = 'right';
                }

                switch (direction) {
                    case 'right':
                        fieldElem = fieldElements[fieldElemIndex + 1];
                        if (isGrid || !fieldElem)
                            result = true; // do not allow the wrapper to scroll the fullscreen screen since the frame is already positioned
                        break;
                    case 'left':
                        fieldElem = fieldElements[fieldElemIndex - 1];
                        if (!fieldElem)
                            result = true;
                        break;
                    case 'home':
                        if (ctrlKey || metaKey) {
                            if (!summaryView.length)
                                _touch.scrollable(fieldElem).scrollTop(0).closest('.ui-page').find('.app-bar-heading').hide();
                            dataItem = fieldElem.closest('.app-listview').find('.dv-item .ui-btn:not(.app-calculated)').first();
                            if (!dataItem.is('.app-selected'))
                                triggerTap(dataItem);
                            originalEvent.preventDefault();
                            fieldElem = null;
                        }
                        else {
                            fieldElem = fieldElements[0];
                            scrollGridTo(dataView, 0);
                        }
                        _touch.fetchOnDemand();
                        break;
                    case 'end':
                        if (ctrlKey || metaKey) {
                            if (!summaryView.length) {
                                var scrollable = _touch.scrollable(fieldElem);
                                if (scrollable.length)
                                    scrollable.scrollTop(scrollable[0].scrollHeight);
                            }
                            dataItem = fieldElem.closest('.app-listview').find('.dv-item .ui-btn:not(.app-calculated)').last();
                            if (!dataItem.is('.app-selected'))
                                triggerTap(dataItem);
                            originalEvent.preventDefault();
                            fieldElem = null;
                        }
                        else
                            fieldElem = fieldElements[fieldElements.length - 1];
                        if (ctrlKey)
                            _touch.fetchOnDemand();
                        break;
                    case 'down':
                    case 'up':
                        movingDown = direction === 'down';
                        if (handleUpDown) {
                            dataItem = fieldElem.closest('.dv-item');
                            nextDataItem = (movingDown ? dataItem.next() : dataItem.prev()).find('.ui-btn');
                            if (nextDataItem.length && !nextDataItem.is('.app-calculated,.dv-action-see-all') && !nextDataItem.parent().is('.app-hidden')) {
                                triggerTap(nextDataItem);
                                _edit.scrollIntoView();
                            }
                            else {
                                // there are two see-all footers, one of which is invisible
                                nextPrev = summaryView.find('.dv-action-see-all').filter(fnVisible).find('.app-btn-' + (movingDown ? 'next' : 'prev'));
                                if (nextPrev.length && !nextPrev.is('.app-btn-disabled')) {
                                    summaryView.data('auto-highlight', movingDown ? 'first' : 'last');
                                    nextPrev.trigger($.Event('vclick', { feedback: false }));
                                }
                                else {
                                    _edit._moving = false;
                                    if (eventToKeyCode(originalEvent) != 38 && eventToKeyCode(originalEvent) != 40)
                                        _input.move($('#' + summaryView.data('for') + '_ph'), direction);
                                }
                            }
                            fieldElem = null;
                            result = true;
                        }
                        else
                            fieldElem = null;
                        break;
                    case 'enter':
                        if (fieldElem.closest('.ui-page').is('.ui-page-active')) {
                            _touch.lastTouch(false);
                            _edit._dataItemSelect = false;
                            fieldElem.trigger('vclick');
                            _edit._dataItemSelect = true;
                            _touch.lastTouch(true);
                            result = true;
                        }
                        else
                            fieldElem = null;
                        break;
                    default:
                        fieldElem = null;
                }
                if (fieldElem) {
                    syncFieldElem();
                    result = true;
                }
            }
            else if ((direction === 'tab' || direction === 'down' || direction === 'up') && !dataView) {
                movingDown = direction === 'down' || direction === 'tab' && !shiftKey;
                summaryView = _touch.summary(findScrollable().find('.app-focus[data-input="dataview"]'));
                if (summaryView.length) {
                    dataView = findDataView(summaryView.data('for'));
                    dataItem = summaryView.find('.app-listview .dv-item .app-selected').parent();
                    var inlineEditing = dataView.inlineEditing(),
                        selectedItemInSummary;
                    if ((inlineEditing || !dataItem.length) && movingDown) {
                        // set focus on the first item in summary view (both standard and inline editing modes)
                        selectedItemInSummary = summaryView.find('.dv-item:not(.app-calculated)').first().find('.app-field').filter(fnVisible).first();
                        if (selectedItemInSummary.length && (eventToKeyCode(originalEvent) === 40 || !summaryView.data('skip-item-focus')))
                            triggerTap(selectedItemInSummary);
                        else
                            _input.move($('#' + summaryView.data('for') + '_ph'), shiftKey ? 'up' : 'down');
                    }
                    else if (!inlineEditing) {
                        // move up/down in a summary view without inline editing.
                        if (direction === 'tab')
                            _input.move($('#' + summaryView.data('for') + '_ph'), movingDown ? 'down' : 'up');
                        else {
                            nextDataItem = (movingDown ? dataItem.next() : dataItem.prev()).find('.ui-btn');
                            if (nextDataItem.length && !nextDataItem.is('.app-calculated,.dv-action-see-all') && !nextDataItem.parent().is('.app-hidden')) {
                                _touch.makeVisible(nextDataItem);
                                triggerTap(nextDataItem);
                            }
                            else {
                                nextPrev = summaryView.find('.dv-action-see-all').filter(fnVisible).find('.app-btn-' + (movingDown ? 'next' : 'prev'));
                                if (nextPrev.length && !nextPrev.is('.app-btn-disabled')) {
                                    //dataItem.closest('.app-listview').css({ 'transform': 'scale(.85)'});
                                    summaryView.data('auto-highlight', movingDown ? 'first' : 'last');
                                    nextPrev.trigger($.Event('vclick', { feedback: false }));
                                }
                                else
                                    _input.move($('#' + summaryView.data('for') + '_ph'), movingDown ? 'down' : 'up');
                            }
                        }
                    }
                    else
                        _input.move($('#' + summaryView.data('for') + '_ph'), 'up');
                    result = true;
                }
            }
            _edit._moving = false;
            if (direction === 'space' && dataView && dataView.multiSelect()) {
                var checkBox = _edit.dataItem().find('.app-btn-check'),
                    link = checkBox.closest('.ui-btn'),
                    hideEditor = checkBox.is('.app-btn-check-selected') && dataView._selectedKeyList.length == 1;
                checkBox.trigger('vclick');
                if (hideEditor)
                    _edit.detach();
                else if (!link.is('.app-selected'))
                    _edit.scrollIntoView(link.closest('.app-listview').find('.ui-btn.app-selected'));
                result = true;
            }
            // this will set focus on the first input in the form
            if (!result && direction === 'tab' && !$(document.activeElement).closest('[data-input]').length) //{
                //var dataView = _touch.dataView();
                _input.focus({ container: findScrollable() });
            //}
            return result;
        },
        supports: function (dataView, command) {
            // ensure that Edit/null or Edit/grid1 is available
            var context = [],
                allow = false,
                viewId = dataView._viewId;
            if (command === 'New') {
                context = dataView.actionGroups('Grid');
                if (context.length)
                    context[0].Actions.every(function (a) {
                        var commandArgument = a.CommandArgument;
                        if (a.CommandName === command && (!commandArgument || commandArgument === viewId))
                            allow = true;
                        return !allow;
                    });
            }
            else {

                _touch.contextScope(dataView._id);
                _touch.navContext(context);
                _touch.contextScope(null);
                context.every(function (item) {
                    var commandArgument = item.argument;
                    if ((item.command === command) && (!commandArgument || commandArgument === viewId))
                        allow = true;
                    return !allow;
                });
            }
            return allow;
        },
        toggleBool: function (elem, dataView) {
            if (_touch.busy())
                return;
            if (!dataView)
                dataView = _edit.dataView();
            var fieldName = elemToFieldName(elem),
                field = dataView.findFieldUnderAlias(fieldName),
                row = dataView.row(),
                items = field.Items,
                boolValue = row[field.Index],
                allowEdit = !field.isReadOnly() && _edit.supports(dataView, 'Edit'),
                newBoolValue = items[items.length - (boolValue === items[items.length - 1][0] ? 2 : 1)][0];

            if (allowEdit) {
                newBoolValue = allowEdit ? items[items.length - (boolValue === items[items.length - 1][0] ? 2 : 1)][0] : boolValue;

                elem.removeClass('material-icon-check-box-outline-blank material-icon-check-box')
                    .addClass('material-icon-check-box' + newBoolValue ? '' : '-outline-blank')
                    .find('i').text('check_box' + (newBoolValue ? '' : '_outline_blank'));

                _app.execute({ command: 'Update', in: dataView, values: [{ field: field.Name, value: boolValue, newValue: newBoolValue }] }).then(function (result) {
                    dataView.sync();
                    notify(result.errors);
                });
            }
            else
                notify(toReadOnlyWarning(field));
        },
        clearField: function (elem, dataView) {
            if (_touch.busy())
                return;
            if (!dataView)
                dataView = _edit.dataView();
            if (!elem)
                elem = _edit.fieldElem(dataView);
            var fieldName = elemToFieldName(elem),
                field = dataView.findFieldUnderAlias(fieldName),
                readOnly = field.isReadOnly() || !_edit.supports(dataView, 'Edit'),
                allowEdit = !readOnly && field.AllowNulls,
                newValue = null,
                values = [],
                copy,
                iterator = _app._fieldMapRegex,
                m,
                row = dataView.row(),
                fieldsToClear = [field];

            if (allowEdit) {

                if (field.Index !== field.AliasIndex)
                    fieldsToClear.push(dataView._allFields[field.AliasIndex]);
                copy = field.Copy;
                if (copy) {
                    m = iterator.exec(copy);
                    while (m) {
                        field = dataView.findField(m[1]);
                        if (field)
                            fieldsToClear.push(field);
                        m = iterator.exec(copy);
                    }
                }

                fieldsToClear.forEach(function (f) {
                    newValue = null;
                    var fieldElem = elem.closest('.dv-item').find('.app-field-' + f.Name);
                    if (fieldElem.is('.app-field-type-bool')) {
                        fieldElem.find('i').val('check_box_outline_blank');
                        if (!f.AllowNulls)
                            newValue = false;
                    }
                    else
                        fieldElem.text(resources.Data.NullValueInForms);
                    if (newValue == null)
                        fieldElem.addClass('app-null');


                    values.push({ field: f.Name, value: row[f.Index], newValue: newValue });
                });

                _app.execute({ command: 'Update', in: dataView, values: values }).then(function (result) {
                    dataView.sync();
                    notify(result.errors);
                });
            }
            else
                notify(readOnly ? toReadOnlyWarning(field) : resources.Validator.Required);
        },
        activate: function (options) {
            if (_edit._pending || _touch.busy() || _touch.isInTransition()) return;

            $('.app-bar-notify:not(.app-hidden').data('cancel', false).trigger('vclick');

            _edit._activateInterval = null;
            _touch.fetchOnDemand();
            var dataView = _edit.dataView(),
                fieldElem, fieldName, dataItem, dataContext,
                toggleValue = options && options.toggle,
                result = false;
            if (dataView && !_edit._active && dataView.inlineEditing()) {
                fieldElem = _edit.fieldElem(dataView);
                if (!fieldElem.length) return result;
                fieldName = elemToFieldName(fieldElem);
                var field = dataView.findFieldUnderAlias(fieldName),
                    saveTags = dataView.get_tag(),
                    commandName,
                    isReadOnly = isFieldReadOnly(field);
                if (!isReadOnly) {
                    var allowEdit = _edit.supports(dataView, 'Edit');
                    if (allowEdit)
                        commandName = 'Edit';
                    else if (_edit.supports(dataView, 'New')) {
                        allowEdit = dataView.rowIsTemplate(dataView.extension().commandRow());
                        commandName = 'New';
                    }
                }
                if (allowEdit) {
                    if (toggleValue && allowEdit && field.Type === 'Boolean') {
                        _edit.toggleBool(fieldElem);
                        return;
                    }
                    // activate inline editor
                    _edit._fieldName = field.Name;
                    _edit._active = true;
                    _edit._elem = fieldElem;
                    dataView._tagList = null;
                    /*
                    options: {
                        modal: {
                            fitContent: true,
                            always: true,
                            title: false,
                            tapOut: true,
                            dock: 'top',
                            background: elem.closest('.app-echo').length ? '' : 'transparent'
                        },
                        actionButtons: false,
                        contentStub: false,
                        transition: false
                    },
                    */
                    dataItem = fieldElem.closest('.dv-item');


                    dataItem.find('.app-row-status:not(.app-row-status-new)').addClass('app-row-status-edit');
                    //var fitContent = dataView.tagged('modal-fit-content');
                    dataView._tag = (saveTags || '') +
                        ' transition-none action-buttons-none content-stub-none page-header-none' +
                        ' modal-always modal-title-none modal-tap-out modal-dock-top modal-auto-grow' +
                        ' modal-background-transparent' +
                        ' modal-max-xs';

                    // prepare a template GetPage response
                    dataContext = dataItem.find('.ui-btn').data('data-context');
                    if (dataContext && (commandName !== 'New' || !dataView.tagged('optimistic-default-values-none'))) {
                        var getPageTemplate = _app.parseJSON(dataView.session('getPageTemplate'));
                        if (getPageTemplate) {
                            // verify that statis lookup items are present
                            var staticLookupItemsAreAvailable = true,
                                hasContextDepdenciesInLookups;
                            getPageTemplate.Fields.every(function (f) {
                                var itemsStyle = f.ItemsStyle;
                                if (itemsStyle && (itemsStyle.match(/DropDownList|ListBox|RadioButtonList/) && (f.Items == null || !f.Items.length) || f.ItemsTargetController)) {
                                    staticLookupItemsAreAvailable = false;
                                    if (f.ContextFields)
                                        hasContextDepdenciesInLookups = true; // cached response cannot be used when static lookups have context dependencies
                                }
                                return staticLookupItemsAreAvailable;
                            });
                            if (!hasContextDepdenciesInLookups)
                                if (staticLookupItemsAreAvailable) {
                                    // produce a response
                                    if (commandName === 'New') {
                                        getPageTemplate.Rows = [];
                                        getPageTemplate.NewRow = dataContext.row;
                                        getPageTemplate.Inserting = true;
                                        // make background call and propagate default values to the inline editor if the target of editing is the same view.
                                        var controller = dataView._controller;
                                        if (!dataView.odp)
                                            _app.execute({ controller: controller, view: dataView._viewId, requiresNewRow: true, background: true }).done(function (r) {
                                                var obj = r[controller][0],
                                                    values = [], fieldName, fieldValue;
                                                if (obj)
                                                    for (fieldName in obj) {
                                                        fieldValue = obj[fieldName];
                                                        if (fieldValue != null)
                                                            values.push({ name: fieldName, value: fieldValue });
                                                    }

                                                function broadcast() {
                                                    _input.execute({ values: values });
                                                }

                                                if (values.length) {
                                                    if (_touch.isInTransition())
                                                        _touch.whenPageShown(broadcast);
                                                    else
                                                        broadcast();
                                                }
                                            });
                                    }
                                    else
                                        getPageTemplate.Rows = [dataContext.row];
                                    getPageTemplate.Tag = (getPageTemplate.Tag || '') + dataView._tag + ' view-type-inline-editor';
                                    getPageTemplate.SupportsCaching = false;
                                    _app.odp.response('GetPage', getPageTemplate);
                                }
                                else
                                    dataView._tag += ' system-replacegetpagetemplate';
                        }
                    }
                    if (commandName === 'New') {
                        dataView._copyExternalLookupValues();
                        var ditto = dataView._ditto;
                        if (ditto && ditto.length)
                            _edit._ditto = ditto.slice(0);
                    }
                    dataView._showModal({ commandName: commandName, commandArgument: dataView.get_viewId() });
                    dataView._tagList = null;
                    dataView._tag = saveTags;
                    result = true;
                }
                else {
                    _input._buffer = null;
                    var headerField = dataView.headerField(),
                        row = dataView.extension().commandRow(),
                        text = dataView.get_view().Label;
                    if (headerField && row)
                        headerFieldValue = row[headerField.Index];
                    if (headerFieldValue)
                        text = headerField.format(headerFieldValue);
                    //_touch.notify(String.format(labelReadOnly, text));
                    if (!isReadOnly)
                        notify(toReadOnlyWarning(text));
                }
            }
            return result;
        },
        expandBy: function (textInput, delta) {
            var overlayPage = textInput.closest('.app-page-inlineeditor-overlay'),
                scrollable, overlayWidth, overlayRect,
                targetDataView, targetScrollable, targetScrollableRect, result = false,
                frameRect;
            if (overlayPage.length) {
                targetDataView = _touch.dataView().session('targetDataView');
                targetScrollable = targetDataView.elem.closest('.app-wrapper');
                targetScrollableRect = getBoundingClientRect(targetScrollable);

                scrollable = overlayPage.find('.app-wrapper');
                scrollableRect = getBoundingClientRect(scrollable);
                overlayWidth = Math.min(scrollable.width() + delta + 3, Math.min(800, targetScrollableRect.width * .75));
                frameRect = getBoundingClientRect(_edit.frame());
                overlayWidth = Math.ceil(Math.max(overlayWidth, frameRect.width));

                scrollable.css({ minWidth: overlayWidth, maxWidth: overlayWidth });
                overlayPage.css({ minWidth: overlayWidth, maxWidth: overlayWidth }).data('overlay', { w: overlayWidth, f: textInput.closest('[data-field]').data('field') });
                overlayRect = getBoundingClientRect(overlayPage);


                if (overlayRect.right > targetScrollableRect.right)
                    overlayPage.css('left', targetScrollableRect.right - overlayRect.width - 3 - 8);
                // textInput.css('width', newInputWidth);
                //$(inputElement).css('background-color', 'red');
                result = true;
            }
            return result;
        },
        form: function (dataView) {
            var layout = [];
            layout.push(
                '<div data-layout="form" data-layout-size="xs" class="app-form-inlineeditor">' +
                '<div data-container="simple" data-wrap="true" data-density="relaxed">' +
                '<i class="app-icon material-icon material-icon-arrow-back" title="' + resourcesModalPopup.CancelButton + '">arrow_back</i>' +
                '<i class="app-icon material-icon material-icon-more app-btn-more" title="' + resourcesMobile.More + '"></i>'
            );
            dataView._fields.forEach(function (f) {
                var fieldName = f.Name;
                if (f.Type !== 'DataView')
                    layout.push(
                        '<div data-container="row" data-visible-when="$app.touch.edit.field(\'' + fieldName + '\')">' +
                        '<div class="app-form-inlineeditor-label"><span data-control="label" data-field="' + fieldName + '"><span class="app-control-inner"></span></span></div>' +
                        '<span data-control="field" data-field="' + fieldName + '" data-auto-expand="true"><span class="app-control-inner"></span></span>' +
                        '</div>');
            });
            layout.push(
                '</div>' +
                '</div>');
            return layout.join('\n');

        },
        position: function (page) {
            var changePosition = !isMobileEditor(),
                scrollable = page.find('.app-wrapper'),
                editor = scrollable.find('.app-form-inlineeditor'),
                fieldName = _edit.field(),
                dataInput = editor.find('[data-control="field"][data-field="' + fieldName + '"]'),
                inputMethod = dataInput.data('input') || '',
                overlayDisplayMode = !inputMethod.match(/blob|checkboxlist/);

            page.addClass('app-page-inlineeditor').toggleClass('app-custom-density-disabled', changePosition).removeClass('app-page-inlineeditor-overlay');
            if (changePosition) {
                page.data('trackPosition', false);
                var dataView = _touch.pageInfo(page.attr('id')).dataView,
                    targetDataView = dataView.session('targetDataView'),
                    fieldElem = targetDataView ? targetDataView.elem : _edit._elem,
                    fieldData,
                    elemRect, x, y, elemScrollableRect,
                    width, height, isGrid,
                    field;
                if (overlayDisplayMode) {
                    field = dataView.findField(fieldName);
                    if (field.ItemsTargetController)
                        overlayDisplayMode = false;
                }
                if (overlayDisplayMode) {
                    var overlay = page.addClass('app-page-inlineeditor-overlay').toggleClass('app-page-inlineeditor-textalignright', fieldElem.css('text-align') === 'right').data('overlay'),
                        positioned = page.data('positioned');
                    overlay = overlay && overlay.f === _edit.field() ? overlay : null;
                    isGrid = fieldElem.closest('.app-grid').length > 0;
                    if (isGrid)
                        page.addClass('app-page-inlineeditor-gridstyle');
                    fieldData = fieldElem.find('.app-field-data');
                    if (fieldData.length)
                        fieldElem = fieldData;
                    elemRect = getBoundingClientRect(fieldElem);
                    if (fieldElem.is('.app-field-type-bool'))
                        elemRect = getBoundingClientRect(_edit._frame);
                    page.css({ maxHeight: '', minHeight: '', height: '', width: '', minWidth: '', maxWidth: '' });
                    width = overlay != null ? overlay.w : elemRect.width + 2;
                    height = Math.round(elemRect.height);
                    x = Math.round(elemRect.left) - 1;
                    y = Math.round(elemRect.top);
                    elemScrollableRect = getBoundingClientRect(_touch.scrollable(fieldElem));
                    if (x + width - 1 > elemScrollableRect.right)
                        width = elemScrollableRect.right - x - 6 - 3; // - scrollbar - outline
                    page.css({ left: x, top: y, maxHeight: height, minHeight: height, height: height, Width: width, minWidth: width, maxWidth: width });
                    scrollable.css({ maxHeight: height, minHeight: height, height: height, width: width, minWidth: width, maxWidth: width });
                    if (!positioned) {
                        // If the editor is activated on the input with the button (lookup, dropdown, autocomplete) 
                        // then it will be positioned incorrectly since the form has not been configured as overlay yet.
                        // Redraw the input to correct the position of the button.
                        page.data('positioned', true);
                        var button = $('.ui-page-active [data-field="' + fieldName + '"] .app-data-input-button'),
                            fakeInner;
                        if (button.length) {
                            fakeInner = $('<span class="app-control-inner">w</span>').appendTo(button.parent());
                            button.css({ top: (fakeInner.outerHeight() - button.outerHeight()) / 2, marginTop: '' });
                            fakeInner.remove();
                        }
                    }
                }
                else {
                    _touch.resetPageHeight(page);
                    if (fieldElem) {
                        var frameRect = getBoundingClientRect(fieldElem),
                            pageRect = getBoundingClientRect(page),
                            pageLeft = pageRect.left,
                            pageTop = pageRect.top,
                            screen = _touch.screen();
                        if (pageRect.height + frameRect.bottom + 8 < screen.height)
                            pageTop = frameRect.bottom + 8;
                        else if (frameRect.top - 8 - pageRect.height > 0)
                            pageTop = frameRect.top - 8 - pageRect.height;
                        pageLeft = frameRect.left - 4; // (the width of standard outline is 3) + (1 pixel gap) 
                        if (pageLeft + pageRect.width - 1 > screen.width)
                            pageLeft = screen.width - 4 - pageRect.width;
                    }
                    if (pageRect.top !== pageTop || pageRect.left !== pageLeft)
                        page.css({ left: pageLeft, top: pageTop });
                }
                page.data('trackPosition', true);
            }
            else
                _touch.resetPageHeight(page);
        }
    };

    $(document).on('dataitemselect.dataview.app', function (e) {
        if (e.namespace === 'app.dataview' && _edit._dataItemSelect !== false) {
            var p = _touch.lastTouch(),
                elem, fieldElem, dataItemElem,
                dataView = e.dataView;
            if (dataView.inlineEditing()) {
                if (p) {
                    elem = elementAt();
                    fieldElem = elem.closest('.app-field');
                    if (!fieldElem.length && dataView.extension().viewStyle() === 'Grid') {
                        //var elemRect = elem[0].getBoundingClientRect();
                        //fieldElem = $(document.elementFromPoint(p.x, elemRect.top + Math.floor(elemRect.height / 2)));
                        //if (!fieldElem.is('.app-field'))
                        //    fieldElem = $(null);
                        elem.find('.app-field').filter(fnVisible).each(function () {
                            var el = this,
                                elRect = getBoundingClientRect(el);
                            if (p.x < elRect.left || elRect.left <= p.x && p.x <= elRect.right) {
                                fieldElem = $(el);
                                return false;
                            }
                        });
                    }
                    if (!fieldElem.length) {
                        dataItemElem = elem.closest('.dv-item');
                        if (dataItemElem.length) {
                            fieldName = (dataView.session('dataEditor') || {}).fieldName;
                            if (fieldName)
                                fieldElem = dataItemElem.find('.app-field-' + fieldName);
                        }
                        if (!fieldElem.length)
                            fieldElem = dataItemElem.find('.app-field').first();
                    }
                    if (!fieldElem.length)
                        fieldElem = null;
                }
                //if (e.action != 'select')
                _edit.sync({ dataView: dataView, elem: fieldElem, scrollIntoView: true, ignoreOtherInputs: true, allowToggle: true });
                if (e.action === 'select' && dataView.extension()._autoSelect)
                    setTimeout(_touch.executeInContext);
                e.preventDefault();
            }
        }
    }).on('resizing.app', function (e) {
        if (e.namespace === 'app')
            _edit.detach();
    })/*.on('gridresized.app', function (e) {
        // TODO: this even is trigger when grid is resized (page resized, "fit to width", column resized)
        // Refactor this handler in "grid 2.0" based on scroller
        if (e.namespace == 'app' && !_touch.isInTransition())
            _edit.sync({ scrollIntoView: false });
    })*/.on('clear.dataview.app', function (e) {
        _edit.detach();
    }).on('keyboardnavigation.app', function (e) {
        var originalEvent = e.originalEvent,
            direction = e.direction;
        if (e.namespace === 'app' && !_edit._active) {
            if (direction === 'edit') {
                if (_edit.activate())
                    return false;
            }
            else if (direction === 'space' && _edit.frame(':active') && _edit.fieldElem().is('.app-field-type-bool')) {
                _edit.toggleBool(_edit.fieldElem());
                return false;
            }
            else if (_edit.frame(':active') && _edit.move({ direction: direction, originalEvent: originalEvent }))
                return false;
        }
    }).on('keyboardpreview.app', function (e) {
        if (_edit.frame(':active')) {
            var originalEvent = e.originalEvent,
                key = originalEvent.key || '';
            if ((key.length === 1 || key.match(/Backspace|Del|Delete/)) && !(originalEvent.ctrlKey || originalEvent.altKey || originalEvent.metaKey)) {
                clearTimeout(_keyboardActivateTimeout);
                if (!_input.barcode(':input'))
                    if (key.match(/Del|Delete/))
                        _edit.clearField();
                    else {
                        _input._buffer = key;
                        e.preventDefault();
                        _keyboardActivateTimeout = setTimeout(_edit_activate, 32); // this is generally slower the the speed of barcode scan
                    }
            }
        }
    }).on('showcontextmenu.app', function (e) {
        var fieldElem = _edit.fieldElem(),
            originalEvent = e.originalEvent,
            summaryView,
            result;

        function performVClick(elem) {
            _touch.lastTouch(false);
            elem.trigger('vclick');
            _touch.lastTouch(true);
            result = false;
        }

        if (fieldElem) {
            summaryView = fieldElem.closest('.app-echo');
            if (originalEvent.shiftKey && summaryView.length)
                performVClick(summaryView.find('.app-echo-toolbar .app-btn-more'));
            else if (originalEvent.ctrlKey)
                performVClick(fieldElem.closest('.dv-item').find('.app-btn-more'));
        }
        else if (originalEvent.ctrlKey) {
            var scrollableRect = getBoundingClientRect(findScrollable());
            findActivePage('.app-listview .app-selected .app-btn-more').filter(fnVisible).each(function () {
                var btnRect = getBoundingClientRect(this);
                if (btnRect.top > scrollableRect.top && btnRect.top < scrollableRect.bottom) {
                    performVClick($(this));
                    return false;
                }
            });
        }
        return result;
    }).on('mousedown', '.app-focus-frame', function (e) {
        _touch.clearHtmlSelection();

    }).on('vclick', '.app-focus-frame', function (e) {
        if (e.type === 'vclick') {
            //clearTimeout(_focusFrameTimeout);
            var elem = _edit.fieldElem(),
                valueIsBool = elem.is('.app-field-type-bool');
            if (_touch.pointer('touch'))
                setTimeout(_edit.activate, 0, { toggle: valueIsBool });
            else if (valueIsBool && _touch.touched(elem.find('i')))
                setTimeout(_edit.toggleBool, 0, elem);
        }
    }).on('contextmenu taphold', '.app-focus-frame', function (e) {
        _edit.frame().hide();
        var elem = elementAt();
        _edit.frame().show();
        elem.trigger('contextmenu');
        return false;
    }).on('dblclick', '.app-focus-frame', function (e) {
        //clearTimeout(_focusFrameTimeout);
        if (_touch.pointer('mouse'))
            setTimeout(_edit.activate, 0, { toggle: true });

    }).on('generatelayout.dataview.app', function (e) {
        if (e.dataView._inlineEditor)
            e.layout = _edit.form(e.dataView);
    }).on('pagepositionchanged.app', function (e) {
        _edit.position(e.page);
    }).on('pagereadycomplete.app', function (e) {
        var editorDataView = _edit.instance(),
            editElem = _edit._elem, //ditto;
            newRowObj, newValues, fieldName, fieldValue;
        if (editorDataView) {
            _edit.position(e.page);
            _edit._active = true;
            if (e.reverse)
                restoreFocusFrame(editorDataView);
            else {
                if (editElem) {
                    var dv = findDataView(editorDataView._parentDataViewId);
                    editorDataView._inlineFields = inlineFields(dv);
                    editorDataView.session('targetDataView', { id: dv._id, elem: editElem });
                    _edit._elem = null;
                    // broadcast any default values to the row
                    if (editorDataView.inserting() && !editorDataView._newRowBroadcasted) {
                        editorDataView._newRowBroadcasted = true;
                        newRowObj = editorDataView.data();
                        newValues = [];
                        for (fieldName in newRowObj) {
                            fieldValue = newRowObj[fieldName];
                            if (fieldValue != null)
                                newValues.push({ name: fieldName, value: fieldValue });
                        }
                        if (newValues.length) {
                            _edit._broadcastValues(editorDataView, newValues);
                            _edit.position(e.page);
                        }
                    }
                    //// broadcast any "copied" fields into the new row
                    //ditto = _edit._ditto;
                    //_edit._ditto = null;
                    //if (ditto) {
                    //    _edit._broadcastValues(editorDataView, ditto);
                    //    _edit.position(e.page);
                    //}
                }
                else
                    restoreFocusFrame(editorDataView);
            }
        }
        else
            _edit._active = false;
        var options = _edit._lastSyncOptions;
        if (options) {
            _edit._lastSyncOptions = null;
            _edit.sync(options);
        }
        _edit.commit(e);
    }).on('dataviewrefresh.app', function (e) {
        _edit.commit(e);
        var dataView = e.dataView,
            inlineEditor = dataView.session('inlineEditor'),
            autoNewRow;
        if (inlineEditor != null) {
            autoNewRow = dataView._autoNewRow;
            dataView.gridChanged();
            _touch.stickyHeaderBar().hide();
            _touch.stickyHeader();
            dataView.session('inlineEditor', null);
            if (inlineEditor) {
                if (autoNewRow) {
                    triggerTapOnNewRow(dataView);
                    dataView._autoNewRow = false;
                }
                else
                    _edit_activate();
            }
        }

    }).on('datainputbroadcast.app', function (e) {
        var dataView = e.dataView;
        if (dataView._inlineEditor)
            _edit._broadcastValues(dataView, e.values);
    }).on('datainputmove.app', function (e) {
        if (_edit.frame(':visible')) {
            var editorDataView = _touch.dataView(),
                fieldElem, elem, m;
            if (editorDataView && editorDataView._inlineEditor) {
                elem = e.direction;
                if (elem && typeof elem !== 'string') {
                    if (elem.closest('.app-focus-frame').length) {
                        setTimeout(function () {
                            _input.focus({ lastFocused: true });
                        });
                        return false;
                    }
                    fieldElem = elem.closest('.app-field');
                    if (!fieldElem.length) {
                        // try locating the closest app-field
                        var lastTouch = _touch.lastTouch();
                        if (lastTouch && elem.closest('.app-grid').length)
                            elem.closest('.dv-item').find('.app-field').filter(fnVisible).each(function () {
                                var r = getBoundingClientRect(this);
                                if (lastTouch.x < r.left || r.left <= lastTouch.x && lastTouch.x <= r.right) {
                                    fieldElem = $(this);
                                    return false;
                                }
                            });
                        else if (!elem.closest('.app-listview').length) {
                            // we are going in the direction of [data-input] in the form
                            m = (elem.attr('class') || '').match(/\bapp\-field\-(\w+)\b/);
                            if (m && m[1] !== _edit.field()) {
                                fieldElem = editorDataView.session('targetDataView').elem.closest('.dv-item').find('.' + m[0]);
                                if (fieldElem.length)
                                    _edit.field(m[1]);
                            }
                        }
                    }
                    if (fieldElem.length) {
                        e.direction = fieldElem;
                        // make sure that the fieldElem belongs to the same app-listview as the one that is being edited
                        var targetDataView = editorDataView.session('targetDataView');
                        if (!fieldElem.closest('.app-listview').is(targetDataView.elem.closest('.app-listview')))
                            return;
                    }
                    else
                        return;
                }
                if (!e.fromDataInput)
                    e.fromDataInput = _touch.pageInfo().scrollable.find('[data-input][data-field="' + _edit.field() + '"]');
                _edit.moveInput(e);
            }
        }
    }).on('dataviewignorechanges.app', function (e) {
        var dataView = e.dataView;
        if (dataView._inlineEditor)
            _edit.undo(dataView);
    }).on('inlineeditingmode.dataview.app', function (e) {
        var dataView = e.dataView,
            extension = dataView.extension(),
            row = extension.commandRow(),
            inlineEditing = e.inlineEditing,
            scrollable, pageInfo,
            link,
            newRow = e.newRow;
        if (inlineEditing) {
            scrollable = findScrollable();
            pageInfo = _touch.pageInfo();
            if (pageInfo && pageInfo.dataView === dataView)
                link = scrollable.find('.app-listview .dv-item .ui-btn').first();
            else
                link = scrollable.find('.app-echo[data-for="' + dataView._id + '"] .app-listview .dv-item .ui-btn').first();
            _touch.lastTouch(false);
            if (newRow) {
                if (triggerTapOnNewRow(dataView)) {
                    return;
                }
            }
            else
                if (row)
                    extension.tap(row, 'highlight');
                else
                    triggerTap(link);
            _touch.lastTouch(true);

            if (extension.viewStyle().match(/(Grid|List|Cards)/)) {
                if (!dataView.inlineEditing())
                    dataView.inlineEditing(inlineEditing, !e.editor);

                var frame = _edit.frame();
                _edit.sync({ dataView: dataView, elem: link.find('app-field-' + dataView._fields[0].Name) });
                if (!newRow)
                    _touch.makeVisible(frame);
                dataView.session('inlineEditor', e.editor);
            }
        }
        else {
            dataView.inlineEditing(inlineEditing);
            _edit.detach();
        }
        _touch.scrollGrid(dataView, true);
        if (newRow) {
            dataView._autoNewRow = true;
            extension.pageIndex(Math.ceil(dataView._totalRowCount / dataView._pageSize) - 1);
            extension._reset = true;
            extension.refresh();
        }
        else
            dataView.sync();
    }).on('vclick', '.app-form-inlineeditor [data-container="simple"] .material-icon', function (e) {
        var target = $(e.target);
        if (target.is('.material-icon-arrow-back'))
            history.go(-1);
        else
            $(document).trigger($.Event('keydown', { keyCode: 121, shiftKey: true }));
        return false;
    });

})();