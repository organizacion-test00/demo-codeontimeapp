/*eslint eqeqeq: ["error", "smart"]*/
/*!
* Data Aquarium Framework - Touch UI Input & Keyboards
* Copyright 2021 Code On Time LLC; Licensed MIT; http://codeontime.com/license
*/

(function () {
    var _app = $app,
        _input = _app.input,
        _touch = _app.touch,
        $document = $(document),
        $window = $(window),
        $body = $('body'),
        getBoundingClientRect = _app.clientRect,
        elementAt = _app.elementAt,
        resources = Web.DataViewResources,
        resouresKeyboardHints = resources.Mobile.Keyboard.TelHints,
        currentCulture = Sys.CultureInfo.CurrentCulture,
        numberFormat = currentCulture.numberFormat,
        decimalSeparator = numberFormat.NumberDecimalSeparator,
        findActivePage = _touch.activePage,
        keyboards = _app.keyboard(),
        keyDragManager,
        contentScrollAnimation,
        lastTouch,
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

    //
    // register the standard keyboards
    // 

    keyboards.number = [
        [
            { key: '1' },
            { key: '2' },
            { key: '3' },
            { key: '-' }
        ],
        [
            { key: '4' },
            { key: '5' },
            { key: '6' },
            { key: ' ', icon: 'space_bar' }
        ],
        [
            { key: '7' },
            { key: '8' },
            { key: '9' },
            { key: 'Backspace', icon: 'backspace' }
        ],
        [
            { key: function () { return numberFormat.NumberGroupSeparator; } },
            { key: '0' },
            { key: function () { return decimalSeparator; } },
            { key: 'Enter', icon: 'keyboard_return', accent: true }
        ]
    ];

    keyboards.pin = [
        //[
        //    { key: 'Paste' }
        //],
        [
            { key: '1', hint: resouresKeyboardHints.Key1 }, // <space>
            { key: '2', hint: resouresKeyboardHints.Key2 }, // abc
            { key: '3', hint: resouresKeyboardHints.Key3 }, // def
        ],
        [
            { key: '4', hint: resouresKeyboardHints.Key4 }, // ghi
            { key: '5', hint: resouresKeyboardHints.Key5 }, // jkl
            { key: '6', hint: resouresKeyboardHints.Key6 }, // mno
        ],
        [
            { key: '7', hint: resouresKeyboardHints.Key7 }, // pqrs
            { key: '8', hint: resouresKeyboardHints.Key8 }, // tuv
            { key: '9', hint: resouresKeyboardHints.Key9 }, // wxyz
        ],
        [
            { key: 'Backspace', icon: 'backspace' },
            { key: '0', hint: true },
            { key: 'Enter', icon: 'keyboard_tab', accent: true, hint: true }
        ]
    ];

    keyboards.tel = [
        [
            { key: '1', hint: resouresKeyboardHints.Key1 }, // <space>
            { key: '2', hint: resouresKeyboardHints.Key2 }, // abc
            { key: '3', hint: resouresKeyboardHints.Key3 }, // def
            { key: '-' }
        ],
        [
            { key: '4', hint: resouresKeyboardHints.Key4 }, // ghi
            { key: '5', hint: resouresKeyboardHints.Key5 }, // jkl
            { key: '6', hint: resouresKeyboardHints.Key6 }, // mno
            { key: ' ', icon: 'space_bar' }
        ],
        [
            { key: '7', hint: resouresKeyboardHints.Key7 }, // pqrs
            { key: '8', hint: resouresKeyboardHints.Key8 }, // tuv
            { key: '9', hint: resouresKeyboardHints.Key9 }, // wxyz
            { key: 'Backspace', icon: 'backspace' }
        ],
        [
            { key: '*', alt: 'tel_alt', text: '* #', hint: true },
            { key: '0+', hint: true },
            { key: '.' },
            { key: 'Enter', icon: 'keyboard_return', accent: true }
        ]
    ];

    keyboards.tel_alt = [
        [
            { key: '(' },
            { key: '/' },
            { key: ')' },
            { key: '-' }
        ],
        [
            { key: 'N' },
            /// TODO: replace with the refrence to the daf-resources
            { key: ',', text: 'Pause' },
            { key: ',' },
            { key: ' ', icon: 'space_bar' }
        ],
        [
            { key: '*' },
            /// TODO: replace with the refrence to the daf-resources
            { key: ';', text: 'Wait' },
            { key: '#' },
            { key: 'Backspace', icon: 'backspace' }
        ],
        [
            { key: '1', alt: 'tel', text: '123' },
            { key: '+' },
            { key: '.' },
            { key: 'Enter', icon: 'keyboard_return', accent: true }
        ]
    ];

    // override the method defined in $app.keyboard

    _app.keyboard = function () {
        var argList = arguments;
        if (argList.length)
            keyboards[argList[0]] = argList[1];
        return keyboards;
    };

    function getKeyboard(type, force) {
        var autoDrop = type && type.match(/^(.+?)\-auto$/),
            keyboard,
            html, rowIndex, keyIndex,
            row, keyInfo, icon, key, hint, text, alt;
        if (!force)
            if (autoDrop)
                type = autoDrop[1];
            else if (keyboardSettings('touchOnly') !== false && !_touch.pointer('touch') || type && keyboardSettings(type + '.enabled') === false)
                return null;

        keyboard = keyboards[type];
        if (keyboard) {
            html = keyboard._html;
            if (!html) {
                keyboard._type = type;
                html = ['<div class="app-keyboard" type="', type, '">'];
                for (rowIndex = 0; rowIndex < keyboard.length; rowIndex++) {
                    row = keyboard[rowIndex];
                    html.push('<div class="app-row">');
                    for (keyIndex = 0; keyIndex < row.length; keyIndex++) {
                        keyInfo = row[keyIndex];
                        key = keyInfo.key || '';
                        macro = keyInfo.macro,
                            hint = keyInfo.hint;
                        alt = keyInfo.alt;
                        text = keyInfo.text;
                        if (typeof key == 'function')
                            key = key();
                        icon = keyInfo.icon;
                        html.push(
                            '<span data-draggable="keyboard-key" class="app-key ',
                            keyInfo.accent ? ' app-accent' : '',
                            hint ? ' app-has-hint' : '',
                            key.length === 1 && !hint || alt ? ' app-simple' : '',
                            '" data-key="',
                            key, '"',
                            alt ? ' data-alt="' + alt + '"' : '',
                            macro ? ' data-macro="' + macro + '"' : '',
                            ' style="',
                            'width:', 100 / row.length, '%',
                            '">',
                            icon ? '<i class="material-icon">' + icon + '</i>' : '',
                            icon ? '' : '<span class="app-text', text ? ' app-text-small' : '', '">' + (text ? text : key) + '</span>',
                            hint ? '<span class="app-hint">' + (typeof hint == 'string' ? hint : '&nbsp;') + '</span>' : '',
                            '</span>'); // app-key

                    }
                    html.push('</div>'); // app-row
                }
                // create a control row visible when the page is attached to the bottom
                html.push('<div class="app-row app-row-controls"><span data-draggable="keyboard-key" class="app-key" data-key="Escape" style="width:', 100 / keyboard[0].length, '%"><i class="material-icon">expand_more</i></span></div>');
                html.push('</div>'); // app-keyboard
                keyboard._html = html.join('');
            }
        }
        return keyboard;
    }

    function activateKeyboard(e) {
        var dataInput = $(e.target),
            type = dataInput.data('type'),
            keyboard;
        // TODO: remove "&& false" in production
        keyboard = getKeyboard(type);
        if (keyboard && !_touch.pointer('pen')) {
            type = keyboard._type;
            _input.keyboard(function () {
                showVirtualKeyboard(
                    'kbd-' + type,
                    keyboard._html,
                    {
                        input: dataInput,
                        inputPage: findActivePage().data({ 'last-focused-field': null }),
                        inputValue: e.inputValue,
                        inputValueRaw: e.inputValueRaw,
                        inputDataType: e.inputDataType,
                        inputMaxLength: e.inputMaxLength,
                        placeholder: e.placeholder,
                        inline: _touch.dataView()._inlineEditor,
                        format: e.inputFormat,
                        type: type
                    });
            });
            return false;
        }
    }

    //function charToHtml(char) {
    //    return char === ' ' ? '&nbsp;' : char;
    //}

    function stringToHtml(s) {
        return s + '<span class="app-cursor">|</span>';
        // replace the handling of chars - kerning make it impossible to make "true" text presentation.
        //var vHtml = [], i, char;
        //for (i = 0; i < s.length; i++) {
        //    char = s.charAt(i);
        //    vHtml.push('<span class="app-char" data-char="', char, '">', charToHtml(char), '</span>');
        //}
        //vHtml.push('<span class="app-cursor">|</span>');
        //return vHtml.join('');
    }

    function keyboardPage() {
        return $('.app-modal-keyboard');
    }

    function isSlidingKeyboard(kbdPage) {
        return (kbdPage || keyboardPage()).is('.app-modal-keyboard-bottom');
    }

    function keyboardSettings(option) {
        return _touch.settings('ui.keyboard.' + option);
    }

    function enhanceKeyboardPresentation() {
        var keyHints = findActivePage('.app-keyboard .app-key .app-hint'),
            maxHintWidth = 0, maxKeyInnerWidth = 0, keyWidth;
        //_touch.scrollable('refresh');
        // update the width and alignment of hints
        keyHints.each(function () {
            var hint = $(this),
                r = getBoundingClientRect(hint),
                text = hint.prev(),
                w = r.width,
                keyInnerWidth = Math.ceil(r.left - getBoundingClientRect(text).left);
            if (w > maxHintWidth)
                maxHintWidth = Math.ceil(w);
            if (keyInnerWidth > maxKeyInnerWidth && text.text().length === 1)
                maxKeyInnerWidth = keyInnerWidth;
        });
        if (maxHintWidth) {
            keyWidth = keyHints.first().parent().width();
            keyHints.each(function () {
                $(this).width(maxHintWidth).prev().css('margin-left', (keyWidth - maxKeyInnerWidth - maxHintWidth) / 2);
            });
        }
    }

    function screenResized() {
        enhanceKeyboardPresentation();
        glassPaneScroller('sync');
    }

    function glassPaneScroller(options) {
        var glassPane = $('.app-page-modal-glass-pane'),
            inner = glassPane.find('.app-inner'),
            context,
            inputScrollable;
        if (options === true) {
            if (!inner.length)
                $div('app-inner-scroller').appendTo($div('app-inner').appendTo(glassPane).css('right', -_touch.scrollable('scrollbar').width));
            glassPaneScroller('sync');
        }
        else if (options === false)
            inner.remove();
        else {//if (_touch.pointer('touch')) {
            // TODO: consider making the content scrolling possibly only with touch
            context = keyboardContext();
            if (context && !context.inline) {
                inputScrollable = _touch.scrollable(context.inputPage);
                inner.find('.app-inner-scroller').height(inputScrollable[0].scrollHeight - inputScrollable.height() + $window.height());
                inner.data('target', inputScrollable)
                    .off('scroll', glassPaneScrollerInner_scroll)
                    .scrollTop(inputScrollable.scrollTop())
                    .on('scroll', glassPaneScrollerInner_scroll);
            }
        }
    }

    function glassPaneScrollerInner_scroll(e) {
        var inner = $(this);
        cancelAnimationFrame(contentScrollAnimation);
        contentScrollAnimation = requestAnimationFrame(function () {
            inner.data('target').scrollTop(inner.scrollTop());
        });
    }

    function scrollInputIntoView(kbdPage, input, allowPagePositioning) {
        var inputScrollable = _touch.scrollable(input),
            inputRect = getBoundingClientRect(input),
            kbdRect = getBoundingClientRect(kbdPage),
            inputScrollableRect = getBoundingClientRect(inputScrollable),
            scrollTop = inputScrollable.scrollTop();
        if (inputRect.top < inputScrollableRect.top) {
            inputScrollable.scrollTop(scrollTop - (inputScrollableRect.top - inputRect.top + 12));
            inputRect = getBoundingClientRect(input);
            if (inputRect.bottom > kbdRect.top)
                inputScrollable.scrollTop(inputScrollable.scrollTop() - (kbdRect.bottom - inputRect.top + 4));
        }
        else if (isSlidingKeyboard(kbdPage)) {
            // see if the keyboard is covering the input and scroll upward
            if (inputRect.bottom > kbdRect.top)
                inputScrollable.scrollTop(scrollTop + (inputRect.top - kbdRect.top + inputRect.height + 12));
        }
        else {
            if (inputScrollableRect.top > inputRect.top) {
                inputScrollable.scrollTop(scrollTop - (inputScrollableRect.top - inputRect.top) - 12);
                if (allowPagePositioning)
                    _touch.resetPageHeight(kbdPage);
            }
            else if (inputScrollableRect.bottom < inputRect.bottom) {
                inputScrollable.scrollTop(scrollTop + (inputRect.bottom - inputScrollableRect.bottom) + 12);
                if (allowPagePositioning)
                    _touch.resetPageHeight(kbdPage);
            }
            else if (kbdRect.top <= inputRect.top && inputRect.top <= kbdRect.bottom) {
                // This will execute only for the floating keyboard that covers the input due to "off-screen" position of the "below" or "above" placement in getKeyboardRect.
                // The floating keyboard is aligned with the bottom of the screen and we are scrolling the input wrapper in the upward direction.
                inputScrollable.scrollTop(scrollTop + (inputRect.bottom - kbdRect.top) + 12);
                inputRect = getBoundingClientRect(input);
                if (inputRect.bottom > kbdRect.top && inputRect.bottom < kbdRect.bottom)
                    inputScrollable.scrollTop(inputScrollable.scrollTop() - (kbdRect.bottom - inputRect.top + 4));
            }
        }
    }

    function attachVirtualKeyboard(context) {
        var input = _touch.hasFocus(context.input),
            inputPage = context.inputPage,
            inner = input.find('.app-control-inner'),
            v = context.value,
            html,
            kbdPage = keyboardPage(),
            kbdStub,
            isInTransition;

        function keyboardShown() {
            kbdPage.css({ transform: '', transition: '' });
            $body.addClass('app-has-keyboard');
            if (!isInTransition)
                _touch.isInTransition(false);
            _touch.scrollable('focus');
        }

        beforeFocusEvent = $.Event('beforefocus.keyboard.app', {
            keyboardPage: kbdPage,
            inputPage: inputPage,
            context: context,
            input: input
        });
        input.trigger(beforeFocusEvent);

        enhanceKeyboardPresentation();
        // replace the data input inner with the character sequence with the cursor
        if (!input.find('.app-cursor').length)
            input.data('originalHtml', inner.html());
        if (context.inputValueRaw == null && context.placeholder)
            html = '<span class="app-cursor">|</span><span class="app-placeholder">' + _app.htmlEncode(context.placeholder) + '</span>';
        else
            html = stringToHtml(v);
        inner.html(html);
        // create a keyboard stub
        kbdStub = inputPage.find('.app-stub-keyboard');
        if (!kbdStub.length)
            kbdStub = $div('app-stub-keyboard').insertAfter(input.closest('[data-layout]'));
        kbdStub.height(context.inline ? 0 : Math.max(kbdStub.height(), kbdPage.outerHeight()));
        scrollInputIntoView(kbdPage, input, true);
        // 
        // TODO - Sometimes the glass pane is not placed below the virtual keyboard in arrangeModalPages() and needs to be moved.
        // TODO - What is up with that?
        //
        $('.app-page-modal-glass-pane').insertBefore(kbdPage);
        glassPaneScroller(true);
        // do nothing if another keyboard was previously visible
        if (inputPage.data('keepKbdOpen')) {
            inputPage.removeData('keepKbdOpen');
            $body.addClass('app-has-keyboard');
        }
        else {
            isInTransition = _touch.isInTransition();
            _touch.isInTransition(true);
            // animate the keyboard appearance if the page is not visible
            kbdPage.css('visibility', '');
            if (isSlidingKeyboard(kbdPage) && !$body.is('.app-has-keyboard')) {
                kbdPage.css('transform', 'translate3d(0,100%,0)').one('transitionend', keyboardShown);
                setTimeout(function () {
                    kbdPage.css('transition', 'transform 150ms ease-out');
                    setTimeout(function () {
                        kbdPage.css('transform', '')
                    });
                });

            }
            else {
                //kbdPage.hide();
                //setTimeout(function () {
                //    kbdPage.fadeIn(100, keyboardShown);
                //});

                // **************************************
                // transition with the modified origin
                // **************************************
                //var inputRect = getBoundingClientRect(input),
                //    kbdRect = getBoundingClientRect(kbdPage);
                //kbdPage.css({ transform: 'scale(.5)', transformOrigin2: (inputRect.left - kbdRect.left > 4 ? 'right' : 'left') + ' ' + (inputRect.top > kbdRect.top ? 'bottom' : 'top') }).one('transitionend', keyboardShown);

                kbdPage.css('transform', 'scale(.75)').one('transitionend', keyboardShown);
                setTimeout(function () {
                    kbdPage.css('transition', 'transform 150ms ease-out');
                    setTimeout(function () {
                        kbdPage.css('transform', '')
                    });
                });
            }
            //else
            //   keyboardShown(); //$body.addClass('app-has-keyboard');
        }
    }

    function detachVirtualKeyboard(context) {
        var value = context.value,
            setValueEvent,
            input = context.input,
            inputPage = context.inputPage,
            inner,
            originalHtml,
            moveDir = context.shift ? 'up' : 'down',
            moveToNextInput = context.enter || context.tab,
            inlineEditor = context.inline,
            knownFieldName;

        function keyboardClosed() {
            $body.removeClass('app-has-keyboard');
            glassPaneScroller(false);
            keyboardPage().css('visibility', 'hidden'); // permanently hide the keyboard so it will not be visible if the user is navigating forward
            inputPage.find('.app-stub-keyboard').remove();
            _touch.scrollable('refresh'); // update the scrollbars
            if (!focusNextField())
                $document.trigger('keyboardclosed.app');
        }

        function focusNextField() {
            if (moveToNextInput && !_touch.isInTransition())
                if (inlineEditor)
                    setTimeout(_input.move, 0, input, moveDir === 'down' ? 'right' : 'left', 8);
                else if (knownFieldName)
                    setTimeout(_input.focus, 0, { fieldName: moveToNextInput });
                else
                    setTimeout(_input.move, 0, input, moveDir, 13);
            return moveToNextInput;
        }

        $window.off('throttledresize', screenResized).off('blur', windowBlur).off('focus', windowFocus);
        $document.off('keydown', keydownListener);

        context.shift = context.tab = context.enter = false;
        if (value != context.inputValue) {
            setValueEvent = _input.triggerSetValue(context.input, value, context.inputValue);
            if (!setValueEvent.inputValid) {
                //moveToNextInput = false;
                _touch.vibrate();
                _input.valid(true); // reset the "valid" state of the form
                _touch.notify({ text: setValueEvent.inputError, force: true });
                showVirtualKeyboard(null, null, context);
                return;
            }
        }
        else {
            inner = input.find('.app-control-inner');
            originalHtml = input.data('originalHtml');
            input.removeData('originalHtml')
            inner.html(originalHtml);
        }

        _touch.hasFocus(input, false);

        // if there is a keyboard for the next input then do not close the keyboard and proceed.
        if (moveToNextInput && !inlineEditor) {
            knownFieldName = typeof moveToNextInput == 'string';
            var nextInput = knownFieldName ? findActivePage('[data-control="field"][data-field="' + moveToNextInput + '"]').first() : _input.move(input, moveDir, 13, null, true),
                nextKbd = getKeyboard($(nextInput).data('type'));
            if (nextKbd) {
                if (keyboardPage().data('mini'))
                    $body.removeClass('app-has-keyboard')
                else {
                    inputPage.data('keepKbdOpen', true);
                    if (input.is(nextInput) && !isSlidingKeyboard())
                        _touch.whenPageShown(function () {
                            hideKeyboard(minimizeKeyboard);
                        });
                }
                focusNextField();
                return;
            }
        }

        hideKeyboard(keyboardClosed);
    }

    function hideKeyboard(callback) {
        // animate the keyboard appearance
        var kbdPage = keyboardPage();

        function keyboardHidden() {
            kbdPage.css({ transform: '', transition: '' });
            callback();
        }

        if (isSlidingKeyboard() && !kbdPage.data('mini')) {
            // the keyboard moves beyond the bottom edge of the screen
            kbdPage.css({ transition: 'transform 100ms ease-in' }).one('transitionend', keyboardHidden);
            setTimeout(function () {
                kbdPage.css('transform', 'translate3d(0, 100%,0)')
            });
        }
        else
            kbdPage.fadeOut(100, keyboardHidden);
    }

    function showVirtualKeyboard(type, layout, context) {
        _touch.whenPageShown(function () {
            attachVirtualKeyboard(context);
            $window.on('throttledresize', screenResized);
            $document.on('keydown', keydownListener);
            _touch.whenPageShown(function () {
                _touch.stickyHeaderBar().hide();
                setTimeout(detachVirtualKeyboard, 0, context);
            });
        });
        $window.on('blur', windowBlur).on('focus', windowFocus);
        if (type) {
            context.value = context.inputValue;
            //if (navigator.clipboard)
            //    navigator.clipboard.readText().then(function (clipText) {

            //    });
            _app.survey({
                controller: type,
                context: context,
                topics: [{ questions: { name: 'k' } }],
                options: {
                    modal: {
                        fitContent: true, // Force the "fitted" form to displayed on top of the parent form.
                        always: true,
                        max: _touch.toWidth('tn'),
                        title: false,
                        tapOut: true,
                        dock: 'top',
                        background: {
                            transparent: true,
                            clear: findActivePage().is('.app-reading-pane-master,.app-reading-pane-detail')
                        },
                        keyboard: true
                    },
                    transition: false,
                    actionButtons: false,
                    discardChangesPrompt: false,
                    contentStub: false,
                    trackContent: true // the page is resized when the modal pages re-arranged

                },
                layout: layout
            });
        }
        else
            changeHistory(1);
    }

    function getKeyboardPageRect(e) {
        var rect = e.rect,
            page = rect.page,
            dataView = rect.dataView,
            input, inputRect,
            keyboardElem,
            positionAtBottom,
            context,
            screen,
            kbdElem;
        if (dataView && dataView.tagged('modal-keyboard')) {
            context = dataView.data('survey');
            input = context.input;
            if (input.parent().length) {
                inputRect = getBoundingClientRect(input);
                if (!inputRect.width)
                    return;

                screen = _touch.screen();
                positionAtBottom = screen.width < _touch.toWidth('sm');
                keyboardElem = page.toggleClass('app-modal-keyboard-bottom', positionAtBottom).find('.app-keyboard');
                rect.height = keyboardElem.length ? keyboardElem.outerHeight() : 1;
                if (positionAtBottom) {
                    rect.left = screen.left;
                    rect.width = screen.width;
                    rect.height = keyboardElem.outerHeight();
                    rect.right = screen.right;
                    //rect.bottom = '';
                    rect.top = screen.top + screen.height - rect.height;
                }
                else {
                    rect.left = inputRect.left;
                    kbdElem = page.find('.app-keyboard');
                    if (kbdElem.length)
                        rect.left += $body.is('.app-input-focus-outline') ? -2 : parseFloat(kbdElem.css('padding-left')) - 1; //parseFloat(page.css('border-left-width'));
                    rect.top = inputRect.bottom + 12;
                    rect.width = keyboardSettings(context.type + '.width') || 360;
                    // repositon the keyboard if needed
                    if (rect.top + rect.height - 1 > screen.top + screen.height - 1)
                        rect.top = inputRect.top - rect.height - 5;
                    if (rect.left + rect.width - 1 > screen.left + screen.width - 1)
                        rect.left = screen.left + screen.width - 1 - rect.width;
                    // if the keyboard is off the screen then move it to the bottom of the screen
                    if (rect.top < screen.top || rect.top + rect.height - 1 > screen.top + screen.height - 1) {
                        rect.bottom = screen.top + screen.height - 1;
                        rect.top = rect.bottom - rect.height + 1;
                    }
                }
            }
            return false;
        }
    }

    function keyboardContext() {
        var dataView = _touch.dataView(),
            survey = dataView && dataView._survey;
        return survey ? survey.context : null;
    }

    function keyboardInputValue(updateInput) {
        var value = [],
            context = keyboardContext(),
            input = context.input,
            inner,
            placeholder = context.placeholder,
            isNull;
        input.find('.app-control-inner').contents().each(function () {
            var node = $(this);
            if (!node.is('.app-cursor,.app-placeholder'))
                value.push(node.text());
        });
        value = value.join('');
        isNull = !value.length;
        input.toggleClass('app-null', isNull);
        if (updateInput && placeholder)
            if (isNull) {
                inner = input.find('.app-control-inner');
                if (!inner.find('.app-placeholder').length)
                    $span('app-placeholder').text(placeholder).appendTo(inner);
            }
            else
                input.find('.app-control-inner .app-placeholder').remove();
        if (updateInput && context.change)
            setTimeout(function () {
                context.change({ input: input, value: value, keyboardPage: findActivePage(), inputPage: context.inputPage, context: context });
            });
        return value;
    }

    keyDragManager = _app.dragMan['keyboard-key'] = {
        start: function (drag) {
            var target = drag.target;
            if (!String.isNullOrEmpty(target.attr('data-key'))) {
                drag.dir = 'all';
                target.addClass('app-dragging');
                //_touch.vibrate(1);

            }
            else
                drag.cancel = true;
        },
        move: function (drag) {

        },
        end: function (drag) {
            this.cancel(drag);
        },
        cancel: function (drag) {
            if (!drag.moved || elementAt().closest('.app-dragging').length)
                this._insert(drag, 0);
            drag.target.removeClass('app-dragging');
        },
        taphold: function (drag) {
            var result = this._insert(drag, 1);
            if (result !== false)
                drag.ignore = true;
            return result;
        },
        _insert: function (drag, keyIndex) {
            if (!drag.ignore) {
                // TODO - play a haptic feedback here
                var context = keyboardContext(),
                    input = context.input,
                    inputMaxLength = context.inputMaxLength,
                    target = drag.target,
                    key = target.attr('data-key'),
                    macro = target.attr('data-macro'),
                    alt = target.attr('data-alt'),
                    altKeyboard,
                    char,
                    kbdPage = findActivePage();
                if (alt && !keyIndex) {
                    altKeyboard = getKeyboard(alt, true);
                    findActivePage('[data-layout]').html(altKeyboard._html);
                    enhanceKeyboardPresentation();
                    _touch.resetPageHeight();
                }
                else if (macro) {
                    if (macro === '$clear')
                        setText(input, null, 'before');
                    else
                        input.find('.app-control-inner').html(stringToHtml(macro));
                    context.value = keyboardInputValue(true);
                    scrollInputIntoView(kbdPage, input);
                    return false;
                }
                else if (key === 'Backspace') {
                    setText(input, '', 'before');
                    context.value = keyboardInputValue(true);
                    scrollInputIntoView(kbdPage, input);
                    return false;
                }
                else if (key === 'Enter') {
                    context.enter = true;
                    changeHistory();
                }
                else if (key === 'Escape') {
                    if (kbdPage.data('mini'))
                        changeHistory();
                    else
                        hideKeyboard(minimizeKeyboard);
                }
                else if (key === 'Paste') {
                    _touch.notify({ text: 'paste' });
                }
                else if (!keyIndex || key.length > 1) {
                    if (!inputMaxLength || context.value.length < inputMaxLength) {
                        key = key.charAt(Math.min(key.length - 1, keyIndex));
                        setText(input, key, 'before');
                        context.value = keyboardInputValue(true);
                        scrollInputIntoView(kbdPage, input);
                    }
                }
                else
                    return false;
            }
        }
    };

    function setText(input, fragment, where) {
        var inner = input.find('.app-control-inner'),
            textContents = inner.contents(),
            textNode = textContents[where === 'before' ? 0 : 2],
            newText,
            kbdType, keyboard, dataFormatString;
        if (!textNode || textNode.nodeType !== 3) {
            textNode = $(document.createTextNode(''));
            if (where === 'before')
                textNode.insertBefore(input.find('.app-cursor'));
            else
                textNode.appendTo(inner);
            textNode = textNode[0];
        }
        newText = textNode.nodeValue;
        if (newText == null)
            newText = '';
        if (fragment == null)
            newText = null;
        else if (!fragment.length)
            newText = newText.substring(0, newText.length - 1);
        else if (fragment != ' ' || !newText.endsWith(' '))
            newText += fragment;
        kbdType = input.data('type');
        keyboard = keyboards[kbdType];
        if (kbdType === 'number' && keyboard && keyboardSettings(kbdType + '.format')) {
            dataFormatString = keyboardContext().format;
            if (dataFormatString) {
                var sample = String.localeFormat(dataFormatString, 0.0),
                    decimalSeparatorIndex = sample.indexOf(decimalSeparator),
                    decimalPlaces;
                newText = newText.replace(/\D/g, '');
                if (decimalSeparatorIndex >= 0) {
                    decimalPlaces = sample.length - decimalSeparatorIndex - 1;
                    if (fragment === decimalSeparator) {
                        newText += decimalSeparator;
                        while (decimalPlaces--)
                            newText += '0';
                    }
                    else {
                        if (newText.length < decimalPlaces + 2)
                            newText = '0' + newText;
                        newText = newText.substring(0, newText.length - decimalPlaces) + decimalSeparator + newText.substring(newText.length - decimalPlaces);
                    }
                }
                newText = Number.parseLocale(newText);
                newText = newText == 0 && fragment !== decimalSeparator ? fragment === '0' ? '0' : '' : String.localeFormat(dataFormatString, newText);
            }
        }
        textNode.nodeValue = newText;

    }

    function minimizeKeyboard() {
        keyboardPage().data('mini', true).css('visibility', 'hidden');
        keyboardContext().inputPage.find('.app-stub-keyboard').height(0);
    }

    function changeHistory(steps) {
        _touch.isInTransition(true);
        history.go(steps || -1)
    }

    function keydownListener(e) {

        var kbd = $(this),
            keyName = e.key,
            key,
            context = keyboardContext();

        function findKey() {
            return kbd.find('[data-key] .app-text').filter(function () {
                return $(this).text().toLowerCase().startsWith(keyName.toLowerCase());
            }).first().parent()
        }

        if (!context || _touch.isInTransition())
            return false;

        key = findKey();
        if (!key.length)
            key = kbd.find('[data-key="' + keyName + '"]');
        if (!key.length && keyName.length === 1) {
            var altKey = findActivePage('[data-alt]');
            if (altKey.length) {
                keyDragManager._insert({ target: altKey }, 0);
                key = findKey();
                if (!key.length || key.is('[data-alt]'))
                    keyDragManager._insert({ target: findActivePage('[data-alt]') }, 0)
            }
        }
        if (key.length && !e.ctrlKey && !e.altKey) {
            key.addClass('app-dragging');
            keyDragManager._insert({ target: key }, 0);
            clearTimeout(key.data('timeout'));
            key.data('timeout', setTimeout(function () {
                key.removeClass('app-dragging');
            }, 150));
            return false;
        }
        else if (keyName == 'ArrowDown' && e.altKey) {
            if (keyboardPage().data('mini')) {
                context.enter = context.input.data('field');
                changeHistory();
            }
            else
                hideKeyboard(minimizeKeyboard);
            return false;
        }
        else if (keyName.match(/Tab|Arrow(Up|Down)/)) {
            context.tab = true;
            context.shift = e.shiftKey || keyName === 'ArrowUp';
            changeHistory();
            return false;
        }
    }

    function activateCalendar(e) {
        if (_touch.pointer('touch')/* || true*/) {
            var target = $(e.target),
                field = _app.input.elementToField(target),
                dataView = field._dataView,
                v = dataView.editRow()[field.Index],
                options = { inputContainer: target, field: field, dataView: dataView, modal: true, date: v },
                cursor = target.find('.app-cursor'),
                inner;

            if (!field.tagged('calendar-input-disabled')) {
                _input.keyboard(function () {
                    _touch.CalendarInput('attach', options);
                    _touch.CalendarInput('focus', options);
                    if (!cursor.length) {
                        inner = target.find('.app-control-inner');
                        cursor = $span('app-cursor').text('|');
                        if (field.Watermark && v == null)
                            cursor.insertBefore(inner.contents());
                        else
                            cursor.appendTo(inner);
                    }
                    _touch.tooltip(false);
                    findActivePage().removeData('lastFocusedField');
                });
                return false;
            }
        }
        e.dataType = null;
    }

    function windowBlur() {
        if (!keyboardPage().data('mini'))
            hideKeyboard(minimizeKeyboard);
    }

    function windowFocus() {
        if (keyboardPage().data('mini')) {
            var context = keyboardContext();
            context.enter = context.input.data('field');
            changeHistory();
        }
    }

    $document
        .on('getpagerect.app', getKeyboardPageRect)
        .on('showvalue.input.app', '[data-type]', activateKeyboard)
        .on('showvalue.input.app', '[data-type="datetime"],[data-type="date"]', activateCalendar)
        .on('touchstart pointerdown mousedown', '.app-page-modal-glass-pane .app-inner', function (e) {
            lastTouch = _touch.lastTouch();
        })
        .on('vclick', '.app-page-modal-glass-pane .app-inner', function (e) {
            var glassPane,
                modalBackground,
                x = e.pageX,
                y = e.pageY,
                elem, dataInput,
                context, inputPage;
            if (Math.abs(lastTouch.x - x) < 11 && Math.abs(lastTouch.y - y) < 11) {
                glassPane = $(this).parent().css('visibility', 'hidden');
                modalBackground = $('.app-page-modal-background').css('visibility', 'hidden');
                elem = elementAt(x, y);
                dataInput = elem.closest('[data-field]');
                modalBackground.css('visibility', '');
                glassPane.css('visibility', '');
                if (dataInput.length) {
                    context = keyboardContext();
                    inputPage = context.inputPage;
                    if (dataInput.closest('.ui-page').is(inputPage))
                        context.enter = dataInput.data('field'); // move the keyboard to the touched data field
                }
                else if (keyboardPage().data('mini') || keyboardPage().is('.app-modal-keyboard-bottom'))
                    $document.one('keyboardclosed.app', function () {
                        _touch.invokeInTargetPage(function () {
                            elem.trigger('vclick');
                        });
                    });
                changeHistory();
            }
            return false;
        });

})();