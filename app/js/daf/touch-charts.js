/*eslint eqeqeq: ["error", "smart"]*/
/*!
* Data Aquarium Framework - Charts for Touch UI
* Copyright 2008-2021 Code On Time LLC; Licensed MIT; http://codeontime.com/license
*/
(function () {
    var $body = $('body'),
        $window = $(window),
        _app = $app,
        _touch = _app.touch,
        findActivePage = _touch.activePage,
        findScrollable = _touch.scrollable,
        findDataView = _app.findDataView,
        vibrate = _touch.vibrate,
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

    function calendarDataView() {
        return findActivePage().is('.app-reading-pane-detail') ? findDataView(activeDataView()._parentDataViewId) : activeDataView();
    }

    function toScrollable(dataView) {
        return _touch.pageInfo(dataView).scrollable;
    }

    (function () {

        var loadedPackages = {},
            resources = Web.DataViewResources.Presenters.Charts,
            resourcesMobile = Web.DataViewResources.Mobile;

        function isPieChart(chartType) {
            return chartType.match(/pie|donut/i);
        }

        // loads a package and calls back when ready
        function loadPackage(packages, callback, module, version) {
            if (!module)
                module = 'visualization';
            if (!version)
                version = '1';
            var key = module + version + (typeof packages == 'string' ? packages : packages.join('-')),
                packageInfo = loadedPackages[key];
            if (packageInfo && packageInfo.loaded)
                callback();
            else {
                if (packageInfo && !packageInfo.loaded)
                    packageInfo.callbacks.push(callback);
                else {
                    _touch.busyIndicator(true);
                    packageInfo = loadedPackages[key] = {
                        loaded: false, callbacks: [callback]
                    };
                    //google.load(module, version, {
                    //    packages: packages, callback: function () {
                    //        $app.touch.busyIndicator(false);
                    //        packageInfo.loaded = true;
                    //        $(packageInfo.callbacks).each(function () {
                    //            this();
                    //        });
                    //    }
                    //});
                    google.charts.load('current', {
                        packages: [packages], mapsApiKey: _touch.mapsApiKey(), callback: function () {
                            _touch.busyIndicator(false);
                            packageInfo.loaded = true;
                            $(packageInfo.callbacks).each(function () {
                                this();
                            });
                        }
                    });
                }
            }
        }

        // draw a table of data and a mini chart
        function drawData(pivot, placeholder) {
            var headerRow = $div('app-chart-headerbar').appendTo(placeholder),
                miniChart = $div('app-chart-mini"').appendTo(headerRow).attr('title', resources.ShowChart),
                titleText = pivot.Properties["title"] || pivot.Title,
                title = $span('app-chart-header').appendTo(headerRow),
                data = $div('app-chart-data app-scrollable').appendTo(placeholder),
                table = $htmlTag('table').appendTo(data),
                isHeaderRow = true,
                showMiniChart = !pivot.ChartType.match(/map|table/);
            if (!showMiniChart)
                miniChart.hide();
            placeholder.closest('.app-chart').addClass('app-chart-has-data');
            pivot.ShowData = true;

            loadPackage('corechart', function () {
                var dataTable = google.visualization.arrayToDataTable(pivot.ChartData),
                    rows = dataTable.getNumberOfRows(),
                    cols = dataTable.getNumberOfColumns(),
                    rowElem = $htmlTag('tr').appendTo(table),
                    row,
                    col,
                    data,
                    cell;
                title.text(titleText.substring(0, 1).toUpperCase() + titleText.substring(1));
                applyFormat(pivot, dataTable);
                // render header
                for (col = 0; col < cols; col++) {
                    data = dataTable.getColumnLabel(col); //pivot.Data[0][col];
                    cell = $htmlTag('th').appendTo(rowElem);
                    if (data != null)
                        cell.text(data).attr('title', data);
                }

                // render data
                for (row = 0; row < rows; row++) {
                    rowElem = $htmlTag('tr').appendTo(table);
                    for (col = 0; col < cols; col++) {
                        data = dataTable.getFormattedValue(row, col),
                            cell = $htmlTag('td').appendTo(rowElem);
                        if (data != null)
                            cell.text(data == "0" ? '' : data).attr('title', data);
                    }
                }
                if (showMiniChart)
                    drawChart(pivot, miniChart);
            });

            // calculate data size
            data.height(Math.floor(placeholder.height() - headerRow.outerHeight(true)));
            data.width(placeholder.width());
        }

        // draw chart in the placeholder
        function drawChart(pivot, placeholder) {
            var visualization = visualizations[pivot.ChartType];
            if (visualization)
                visualization(pivot, placeholder);
        }

        // initialize default options
        function chartOptions(pivot, selector, options) {
            var isPie = isPieChart(pivot.ChartType),
                titleText = pivot.Properties["title"] || pivot.Title;
            if (!options)
                options = {};
            if (!options.legend)
                options.legend = {};
            if (!options.hAxis)
                options.hAxis = {};
            if (!options.vAxis)
                options.vAxis = {};
            if (!options.chartArea)
                options.chartArea = {};
            if (!options.tooltip)
                options.tooltip = {};
            // place background colors here
            options.title = titleText.charAt(0).toUpperCase() + titleText.slice(1);
            options.width = Math.floor(selector.width()) - 1;
            options.height = Math.floor(selector.height()) - 1;
            options.tooltip.trigger = 'focus';
            // hide legend if only one column
            if (pivot.ChartData[0].length <= 2) {
                if (!isPie)
                    options.legend.position = 'none';
                if (isPie)
                    pivot.Properties["maximize"] = true;
            }
            if (isPie)
                options.sliceVisibilityThreshold = 0;
            // custom properties
            for (var property in pivot.Properties) {
                if (pivot.Properties.hasOwnProperty(property)) {
                    var value = pivot.Properties[property];
                    switch (property) {
                        case "crosshair":
                            options["crosshair"] = {
                                orientation: value == 0 ? "both" : value,
                                trigger: 'both'
                            };
                            break;
                        case "maximize":
                            if (!isPie) {
                                options.titlePosition = 'in';
                                options.chartArea.width = '100%'; // 90%
                                options.chartArea.height = '100%'; // 90%
                                if (!options.legend.position)
                                    options.legend.position = 'in';
                            }
                            else {
                                options.chartArea.top = '15%';
                                options.chartArea.width = '80%';
                                options.chartArea.height = '80%';
                            }
                            options.axisTitlesPosition = 'in';
                            options.hAxis.textPosition = 'in';
                            options.vAxis.textPosition = 'in';
                            break;
                        case "haxistitle":
                            options.hAxis.title = value;
                            break;
                        case "vaxistitle":
                            options.vAxis.title = value;
                            break;
                        case "haxisformat":
                            options.hAxis.format = value;
                            break;
                        case "vaxisformat":
                            options.vAxis.format = value;
                            break;
                        case "region": // geo chart properties
                            options.region = value;
                            break;
                        case "displaymode":
                            options.displayMode = value;
                            break;
                        case "resolution":
                            options.resolution = value;
                            break;
                        case "curve": // line chart properties
                            options.curveType = "function";
                            break;
                        case "explorer":
                            options.explorer = {};
                            break;
                        case "maptype": // map chart properties
                            options.mapType = value;
                            break;
                        case "enablescrollwheel":
                            options.enableScrollWheel = true;
                            break;
                        case "usemaptypecontrol":
                            options.useMapTypeControl = true;
                            break;
                        case "pointshape": // misc
                            options.pointShape = value;
                            break;
                        case "pointsize":
                            options.pointSize = value;
                            break;
                        case "orientation":
                            options.orientation = value;
                            break;
                        case "animation":
                            options.animation = { startup: true, duration: 500, easing: 'out' };
                            break;
                        case "colors":
                            var colors = value.split(',');
                            for (var i in colors)
                                colors[i] = colors[i].trim();
                            options.colors = colors;
                            break;
                    }
                }
            }
            if (pivot.ShowData) {
                options.legend.position = 'none';
                options.axisTitlesPosition = 'none';
                options.height = '100%';
                options.titlePosition = 'none';
                options.chartArea.top = '0';
                options.chartArea.width = '100%';
                options.chartArea.height = '100%';
                options.enableInteractivity = false;
            }
            //if (pivot.ChartType == 'geo')
            //  options.backgroundColor = '#fff';
            if ($('body').hasClass('app-theme-dark')) {
                options.backgroundColor = '#111';
                options.hAxis.textStyle = {
                    color: 'white'
                };
                options.hAxis.gridlines = {
                    color: '#333'
                };
                options.vAxis.textStyle = {
                    color: 'white'
                };
                options.vAxis.gridlines = {
                    color: '#333'
                };
                options.legend.textStyle = {
                    color: '#999'
                };
                options.legend.scrollArrows = {
                    activeColor: '#fff', inactiveColor: '#777'
                };
                options.legend.pagingTextStyle = {
                    color: '#999'
                };
                options.titleTextStyle = { color: 'white' };
                if (isPie)
                    options.pieSliceBorderColor = '#111';

            }
            return options;
        }

        // apply format strings specified in the pivot.Formats property
        function applyFormat(pivot, dataTable) {
            var valueFieldCount = pivot.ValueFieldNames.length;
            for (name in pivot.Formats) {
                var format = pivot.Formats[name],
                    matches = /(\w+)(\d)/.exec(name),
                    fieldName = matches[1],
                    fieldIndex = matches[2],
                    columnIndex = pivot.ValueFieldNames.indexOf(fieldName, fieldIndex),
                    formatter;
                if (columnIndex == -1 || !format)
                    continue;

                switch (format.toLowerCase()) {
                    case "c":
                        format = "\u00A400.00";
                        break;
                    case "d":
                        format = "00.00";
                        break;
                    case "e":
                        format = "0.######E+000";
                        break;
                    case "f":
                        format = "00.00";
                        break;
                    case "n":
                        format = "00.00";
                        break;
                    case "p":
                        format = "%";
                        break;
                    case "x":
                        format = "00.00";
                        break;
                }

                // specifies ICU decimal format http://icu-project.org/apiref/icu4c/classDecimalFormat.html#_details
                // TODO check for type
                formatter = new google.visualization.NumberFormat({
                    pattern: format
                });

                for (var i = columnIndex + 1; i < pivot.Data[0].length; i = i + valueFieldCount) {
                    formatter.format(dataTable, i);
                }
            }
        }

        // initialize event handlers and draw the chart
        function draw(pivot, selector, chart, options) {
            var data = google.visualization.arrayToDataTable(pivot.ChartData),
                isGeo = pivot.ChartType.match(/geo/i);

            function attachSelectAction() {
                //chart.setAction({
                //    id: 'filter',
                //    text: resourcesMobile.Filter,
                //    action: function () {
                //        var selection = chart.getSelection(),
                //            col, row,
                //            values = [];
                //        if (selection) {
                //            selection = selection[0]
                //            if (selection.column) {
                //                col = selection.column;
                //            }
                //            else {
                //                row = selection.row + 1;
                //                values.push(pivot.ChartData[row][0]);
                //                $(pivot.ChartData).each(function (index) {
                //                    if (index > 0 && index != row)
                //                        values.push(this[0]);
                //                });
                //                touch.configureFilter({ mode: 'field', field: pivot.RowFieldNames[0], scope: null, values: values });
                //            }
                //        }
                //    }
                //});
            }

            // format 
            applyFormat(pivot, data);

            if (!_touch.desktop() && !isGeo)
                attachSelectAction();
            if (pivot.Properties["animation"] && !isGeo && pivot.ChartType != 'map')
                chart.draw(null, options);
            chart.draw(data, options);

            if (_touch.desktop() && !isGeo) {
                google.visualization.events.addListener(chart, 'select', function () {
                    if (options.tooltip.trigger == 'focus') {
                        options.tooltip.trigger = 'selection';
                        var selection = chart.getSelection();
                        attachSelectAction();
                        chart.draw(data, options);
                        chart.setSelection(selection);
                        return false;
                    }
                });
                google.visualization.events.addListener(chart, 'click', function (event) {
                    if (!event.targetID.match(/^action/) && options.tooltip.trigger == 'selection') {
                        options.tooltip.trigger = 'focus';
                        chart.removeAction('filter');
                        chart.removeAction('exclude');
                        chart.setSelection(null);
                        chart.draw(data, options);
                    }
                });
            }
        }


        $(document).on('resizing.app', function () {
            findActivePage('.app-chart-inner').children().hide();
        }).on('searching.app', function (event) {
            var dataViewId = event.dataView._id;
            $('#' + dataViewId + '.ui-page .app-wrapper > [data-presenter="Charts"] .app-chart-inner, .app-echo[data-for="' + dataViewId + '"] .app-chart-inner').children().hide();
        })
            .on('vclick', '.app-chart', function (event) {

                function showChart() {
                    delete config.ShowData;
                    dataView.viewProp('chartsConfig', chartsConfig);

                    var pivot = target.closest('.app-chart-list').parent().data('pivots')["pivot" + pivotID],
                        inner = target.closest('.app-chart').find('.app-chart-inner');
                    inner.empty();

                    // reset state 
                    inner.closest('.app-chart').removeClass('app-chart-has-data');
                    pivot.ShowData = false;

                    drawChart(pivot, inner);
                }

                var target = $(event.target);
                var echo = target.closest('.app-echo'),
                    dataView = echo.length ? _app.find(echo.attr('data-for')) : calendarDataView(),
                    dataContext = target.closest('.app-chart').data('data-context');
                if (!dataView || !dataContext)
                    return;

                var pivotID = dataContext.Id,
                    chartsConfig = dataView.viewProp('chartsConfig'),
                    config = chartsConfig && chartsConfig[pivotID],
                    isSidebar = $body.is('.app-has-sidebar-left') && !$body.is('.app-has-minisidebar-left'),
                    windowWidthEm = $window.width() / parseFloat($body.css("font-size")),
                    med = (isSidebar && windowWidthEm >= 50) || (!isSidebar && windowWidthEm >= 40),
                    large = (isSidebar && windowWidthEm >= 85) || (!isSidebar && windowWidthEm >= 62),
                    currentSize = config.size ? config.size : 'small',
                    items = [];

                if (target.is('.app-btn-more') && !_app.mobile.busy()) {
                    _app.mobile.callWithFeedback(target.closest('.ui-btn'), function () {

                        if (currentSize == 'large' && !large)
                            currentSize = 'medium';
                        if (currentSize == 'medium' && !med)
                            currentSize = 'small';

                        // show data
                        var pivot = target.closest('.app-chart-list').parent().data('pivots')["pivot" + pivotID];
                        if (!pivot.ChartType.match(/map|table/)) {
                            if (config.ShowData)
                                items.push({
                                    text: resources.ShowChart,
                                    icon: 'chart',
                                    callback: showChart
                                });
                            else
                                items.push({
                                    text: resources.ShowData,
                                    icon: 'grid',
                                    callback: function () {
                                        config.ShowData = true;
                                        dataView.viewProp('chartsConfig', chartsConfig);

                                        var inner = target.closest('.app-chart').find('.app-chart-inner');
                                        inner.empty();
                                        drawData(pivot, inner);
                                    }
                                });
                        }

                        if (target.closest('.app-chart-list').find('.app-chart').length > 1) {
                            // add sizing options
                            items.push({
                                text: resources.Sizes.Label
                            });
                            items.push({ // small
                                text: resources.Sizes.Small,
                                icon: currentSize == 'small' ? 'check' : '',
                                callback: function () {
                                    delete config.size;
                                    config.resized = true;
                                    dataView.viewProp('chartsConfig', chartsConfig);
                                    _touch.presenter('show', {
                                        name: 'Charts', id: dataView._id, container: target.closest('.app-wrapper')
                                    });
                                }
                            });
                            if (med) // medium
                                items.push({
                                    text: resources.Sizes.Medium,
                                    icon: currentSize == 'medium' ? 'check' : '',
                                    callback: function () {
                                        config.size = 'medium';
                                        config.resized = true;
                                        dataView.viewProp('chartsConfig', chartsConfig);
                                        _touch.presenter('show', {
                                            name: 'Charts', id: dataView._id, container: target.closest('.app-wrapper')
                                        });
                                    }
                                });
                            if (large) // large
                                items.push({
                                    text: resources.Sizes.Large,
                                    icon: currentSize == 'large' ? 'check' : '',
                                    callback: function () {
                                        config.size = 'large';
                                        config.resized = true;
                                        dataView.viewProp('chartsConfig', chartsConfig);
                                        _touch.presenter('show', {
                                            name: 'Charts', id: dataView._id, container: target.closest('.app-wrapper')
                                        });
                                    }
                                });
                        }
                        else
                            items.push({
                                text: resources.Sizes.Auto,
                                icon: 'check',
                                callback: function () { }
                            });

                        items.push({
                            text: resourcesMobile.Filter
                        });
                        if (dataContext.ColumnFieldNames && dataContext.ColumnFieldNames.length)
                            items.push(
                                {
                                    // TODO: must provide a dataView._id for "scope" when called for echo
                                    text: dataView.findField(dataContext.ColumnFieldNames[0]).HeaderText,
                                    icon: 'material-icon-filter-list',
                                    callback: function () {
                                        _touch.configureFilter({
                                            field: dataContext.ColumnFieldNames[0], scope: dataView._id, mode: 'field'
                                        });
                                    }
                                });


                        if (dataContext.RowFieldNames && dataContext.RowFieldNames.length)
                            items.push(
                                {
                                    // TODO: must provide a dataView._id for "scope" when called for echo
                                    text: dataView.findField(dataContext.RowFieldNames[0]).HeaderText,
                                    icon: 'material-icon-filter-list',
                                    callback: function () {
                                        _touch.configureFilter({
                                            field: dataContext.RowFieldNames[0], scope: dataView._id, mode: 'field'
                                        });
                                    }
                                });


                        _touch.listPopup({
                            anchor: target.closest('a'),
                            iconPos: 'right',
                            items: items
                        });
                    });
                    return false;
                }
                else if (target.closest('.app-chart-mini').length) {
                    showChart();
                    return false;
                }
            })

            ;

        var visualizations = {
            area: function (pivot, selector) {
                loadPackage('corechart', function () {
                    var options = chartOptions(pivot, selector),
                        chart = new google.visualization.AreaChart($(selector).get(0));
                    draw(pivot, selector, chart, options);
                });
            },
            areastacked: function (pivot, selector) {
                loadPackage('corechart', function () {
                    var options = chartOptions(pivot, selector, {
                        isStacked: true
                    }),
                        chart = new google.visualization.AreaChart($(selector).get(0));
                    draw(pivot, selector, chart, options);
                });
            },
            bar: function (pivot, selector) {
                loadPackage('corechart', function () {
                    var options = chartOptions(pivot, selector),
                        chart = new google.visualization.BarChart($(selector).get(0));
                    draw(pivot, selector, chart, options);
                });
            },
            barstacked: function (pivot, selector) {
                loadPackage('corechart', function () {
                    var options = chartOptions(pivot, selector, {
                        isStacked: true
                    }),
                        chart = new google.visualization.BarChart($(selector).get(0));
                    draw(pivot, selector, chart, options);
                });
            },
            column: function (pivot, selector) {
                loadPackage('corechart', function () {
                    var options = chartOptions(pivot, selector),
                        chart = new google.visualization.ColumnChart($(selector).get(0));
                    draw(pivot, selector, chart, options);
                });
            },
            columnstacked: function (pivot, selector) {
                loadPackage('corechart', function () {
                    var options = chartOptions(pivot, selector, { isStacked: true }),
                        chart = new google.visualization.ColumnChart($(selector).get(0));
                    draw(pivot, selector, chart, options);
                });
            },
            candlestick: function (pivot, selector) {
                loadPackage('corechart', function () {
                    var options = chartOptions(pivot, selector),
                        chart = new google.visualization.CandlestickChart($(selector).get(0));
                    draw(pivot, selector, chart, options);
                });
            },
            donut: function (pivot, selector) {
                loadPackage('corechart', function () {
                    var options = chartOptions(pivot, selector, {
                        pieHole: 0.4, backgroundColor: 'transparent'
                    }),
                        chart = new google.visualization.PieChart($(selector).get(0));
                    draw(pivot, selector, chart, options);
                });
            },
            geo: function (pivot, selector) {
                loadPackage('geochart', function () {
                    var options = chartOptions(pivot, selector, {
                        backgroundColor: 'transparent'
                    }),
                        chart = new google.visualization.GeoChart($(selector).get(0));
                    draw(pivot, selector, chart, options);
                });
            },
            map: function (pivot, selector) {
                loadPackage('map', function () {
                    var options = chartOptions(pivot, selector, {
                        showTip: true
                    }),
                        chart = new google.visualization.Map($(selector).get(0));
                    draw(pivot, selector, chart, options);
                });
            },
            line: function (pivot, selector) {
                loadPackage('corechart', function () {
                    var options = chartOptions(pivot, selector, {
                        showTip: true
                    }),
                        chart = new google.visualization.LineChart($(selector).get(0));
                    draw(pivot, selector, chart, options);
                });
            },
            pie: function (pivot, selector) {
                loadPackage('corechart', function () {
                    var options = chartOptions(pivot, selector, {
                        title: pivot.Title, backgroundColor: 'transparent'
                    }),
                        chart = new google.visualization.PieChart($(selector).get(0));
                    draw(pivot, selector, chart, options);
                });
            },
            pie3d: function (pivot, selector) {
                loadPackage('corechart', function () {
                    var options = chartOptions(pivot, selector, {
                        backgroundColor: 'transparent',
                        is3D: true
                    }),
                        chart = new google.visualization.PieChart($(selector).get(0));
                    draw(pivot, selector, chart, options);
                });
            },
            scatter: function (pivot, selector) {
                loadPackage('corechart', function () {
                    var options = chartOptions(pivot, selector),
                        chart = new google.visualization.ScatterChart($(selector).get(0));
                    draw(pivot, selector, chart, options);
                });
            },
            table: function (pivot, selector) {
                loadPackage('table', function () {
                    var options = chartOptions(pivot, selector),
                        chart = new google.visualization.Table($(selector).get(0));
                    draw(pivot, selector, chart, options);
                });
            }
        };

        // presenter implementation
        _touch.presenter('register', {
            name: 'Charts',
            icon: function () { return 'chart'; },
            text: function () {
                return resources.Text;
            },
            supports: function (dataView) {
                var isSupported = false;
                $(dataView._fields).each(function () {
                    if (this.Tag && this.Tag.indexOf("pivot") != -1) {
                        isSupported = true;
                        return false;
                    }
                });
                //dataView.AutoPivots = null;
                // calculate auto pivots
                if (isSupported)
                    dataView.AutoPivots = null;
                else {
                    if (dataView.AutoPivots && $.isEmptyObject(dataView.AutoPivots))
                        return true;
                    else {
                        dataView.AutoPivots = {};
                        var pivotCount = 1,
                            firstField = dataView._fields[0].Label,
                            lookups = [],
                            lookupCount = 0,
                            lookupChartCount = 0,
                            lookupChartTypes = ['pie3d', 'column', 'donut', 'bar'],
                            dates = [],
                            dateCount = 0,
                            dateChartCount = 0,
                            dateChartTypes = ['line', 'column', 'area'],
                            lookupAndDateChartCount = 0,
                            lookupAndDateChartTypes = ['columnstacked-top5', 'area-top7', 'column-top5', 'barstacked-top5'],
                            currency = [],
                            groupExpressions = dataView.groupExpression(),
                            hasMap = false,
                            getNextLookupChart = function () { return lookupChartTypes[lookupChartCount++ % lookupChartTypes.length]; },
                            getNextDateChart = function () { return dateChartTypes[dateChartCount++ % dateChartTypes.length]; },
                            getNextLookupAndDateChart = function () { return lookupAndDateChartTypes[lookupAndDateChartCount++ % lookupAndDateChartTypes.length]; };


                        // enumerate fields
                        $(dataView._fields).each(function () {
                            var field = this;
                            dataView.AutoPivots[field.Name] = [];
                            // lookup
                            if (field.ItemsDataController || field.AliasName)
                                lookups.push(field.Name);
                            //// group
                            //if (groupExpressions && groupExpressions[0] == field.Name)
                            //    lookups.splice(0, 0, field.Name);
                            // date
                            if (field.Type == "DateTime")
                                dates.push(field.Name);
                            // currency
                            if (field.DataFormatString == "c")
                                currency.push(field.Name);

                            if (groupExpressions && groupExpressions[0] == (field.AliasName || field.Name))
                                dataView.AutoPivots[field.Name].push('pivot' + pivotCount++ + "-row1-top10-sortdescbyvalue-" + (field.Type == 'String' ? 'pie-other' : 'column'));
                        });

                        $(lookups).each(function () {
                            if (pivotCount > 9 || !dates[dateCount])
                                return false;

                            var lookup = this,
                                date = dates[dateCount];

                            dataView.AutoPivots[lookups[lookupCount++ % lookups.length]].push('pivot' + pivotCount + '-col1-sortdescbyvalue-' + getNextLookupAndDateChart());
                            dataView.AutoPivots[dates[dateCount++ % dates.length]].push('pivot' + pivotCount++ + '-row1-date-all-hideblank');
                        });

                        lookupCount = 0;
                        dateCount = 0;

                        // create auto pivots
                        $(dataView._fields).each(function () {
                            // max # of pivots
                            if (pivotCount > 9)
                                return false;

                            var field = this,
                                name = field.Name;

                            if (field.IsPrimaryKey)
                                return true;

                            if (field.ItemsDataController || field.AliasName) {
                                dataView.AutoPivots[name].push('pivot' + pivotCount++ + "-row1-top10-other-sortdescbyvalue-" + getNextLookupChart());
                            }
                            switch (field.Type) {
                                case "Int16":
                                case "Int32":
                                case "Int64":
                                case "Single":
                                case "Double":
                                case "Decimal":
                                    if (lookups.length != 0 && !(field.ItemsDataController || field.AliasName)) {
                                        var valueMode = 'sum', chartType = getNextLookupChart();
                                        if (name.match(/salary/i))
                                            valueMode = 'avg';
                                        else if (name.match(/total/i))
                                            valueMode = 'sum';
                                        else if (field.DataFormatString == '{0:c}' || name.match(/price|discount/i)) {
                                            valueMode = 'avg';
                                            while (isPieChart(chartType))
                                                chartType = getNextLookupChart();
                                        }
                                        if (isPieChart(chartType))
                                            valueMode = 'sum';
                                        dataView.AutoPivots[name].push('pivot' + pivotCount + '-val1-' + valueMode + '-' + chartType);
                                        dataView.AutoPivots[lookups[lookupCount++ % lookups.length]].push('pivot' + pivotCount++ + '-row1-top7-other-sortdescbyvalue');
                                    }
                                    break;
                                case "DateTime":
                                    if (name.match(/birth|hire/i))
                                        dataView.AutoPivots[name].push('pivot' + pivotCount++ + '-row1-month-all-pie3d');
                                    else
                                        dataView.AutoPivots[name].push('pivot' + pivotCount++ + '-row1-' + getNextDateChart() + '-date-all-hideblank');
                                    break;
                                case "String":
                                    if (!hasMap) {
                                        if (name.match(/country/i))
                                            dataView.AutoPivots[name].push('pivot' + pivotCount++ + '-row1-geo');
                                    }
                                    break;
                            }
                        });



                        if (pivotCount > 1)
                            isSupported = true;
                    }
                }
                return isSupported;
            },
            show: function (options) {
                var dataView = _app.find(options.id),
                    chartList = options.container.find('.app-chart-list'),
                    pivots = options.container.data('pivots'),
                    chartsConfig = dataView.viewProp('chartsConfig') || {
                    };

                // show an empty list with refresh and clear filter buttons. If (showDataWarning), shows warning about too many records
                function renderEmptyList(showDataWarning) {
                    emptyChartList();
                    var listview = $ul('app-listview app-grid').appendTo(chartList);

                    if (!showDataWarning) {
                        var refreshLink = $('<li data-icon="refresh"><a href="#app-refresh" class="ui-btn ui-icon-refresh ui-btn-icon-left"><p/></a></li>').appendTo(listview).find('a');
                        refreshLink.attr('title', Web.DataViewResources.Pager.Refresh).find('p').text(Web.DataViewResources.Data.NoRecords);

                        if (dataView._filter && dataView._filter.length && !dataView.filterIsExternal()) {
                            var clearFilterLink = $('<li data-icon="filter" class="ui-last-child"><a href="#app-clear-filter" class="ui-btn ui-icon-filter ui-btn-icon-left"><p/></a></li>').appendTo(listview).find('a');
                            clearFilterLink.attr('title', resourcesMobile.ClearFilter).find('p').text(resourcesMobile.ClearFilter);
                        }
                    }
                    else {
                        var filterLink = $('<li data-icon="filter" class="ui-last-child"><a href="#app-filter" class="ui-btn ui-icon-filter ui-btn-icon-left"><p/></a></li>').appendTo(listview).find('a'),
                            dataWarning = String.format(resources.DataWarning, __settings.maxPivotRowCount);
                        filterLink.attr('title', resourcesMobile.Filter).find('p').text(dataWarning);
                    }
                    listview.listview();
                }

                function emptyChartList() {
                    chartList.find('.app-chart').each(function () {
                        $(this).removeData();
                    });
                    chartList.empty();
                }

                // translate all words in each pivot
                function translate(pivots) {
                    // pivots
                    for (pivot in pivots) {
                        // translate data
                        $(pivots[pivot].Data).each(function () {
                            var row = this,
                                i = 0;
                            while (i < row.length) {
                                row[i] = translateWord(row[i]);
                                i++;
                            }
                        });

                        // translate label
                        pivots[pivot].Title = translateWord(pivots[pivot].Title);

                        // convert nulls to 0
                        pivots[pivot].ChartData = JSON.parse(JSON.stringify(pivots[pivot].Data));
                        $(pivots[pivot].ChartData).each(function () {
                            var pivot = this;
                            var row = this,
                                i = 0;
                            for (i = 0; i < row.length; i++) {
                                if (row[i] == null)
                                    row[i] = 0;
                            }
                        });
                    }
                }

                // translate a word
                function translateWord(word) {
                    if (!word || !isNaN(word) || isFinite(word))
                        return word;

                    var matches = word.match(/\$(\S+)/g);

                    $(matches).each(function () {
                        var wordWithoutNum = this.replace(/\d*/g, ''),
                            match = wordWithoutNum.replace(/[$\d]*/g, ''),
                            replacement = resources.ChartLabels[match];
                        if (replacement) {
                            if (match.match(/Quarter|Week/))
                                replacement = replacement.substring(0, 1);
                            word = word.replace(wordWithoutNum, replacement);
                        }
                        else if (match == 'CurrentViewLabel')
                            word = word.replace(wordWithoutNum, dataView._view.Label);
                        if (match == 'Other')
                            word.isOther = true;
                    });
                    return word;
                }

                function render() {
                    _touch.registerAPI('Charts', renderWithApi);
                }

                function renderWithApi() {
                    var w,
                        h,
                        maxHeight,
                        pivot,
                        pivotName,
                        chartContainers = [],
                        chartIndex = 0,
                        scrollable = chartList.closest('.app-wrapper'),
                        instruction,
                        numberOfPivots = 0,
                        numberOfColumns = 1,
                        testCharts,
                        oldCharts = chartList.find('.app-chart'),
                        resizedPlaceholder,
                        closestPlaceholder,
                        hasLargerChart = false;
                    if (oldCharts.length > 0) {
                        var scrollableTop = scrollable.scrollTop();
                        $(oldCharts).each(function () {
                            var chart = $(this);
                            if (chart.position().top > 0) {
                                chartsConfig[chart.data('data-context').Id].lastScrollPosition = true;
                                return false;
                            }
                        });
                    }
                    emptyChartList();
                    $('<div class="app-chart"><span class="app-chart-inner"/></div><div class="app-chart"><span class="app-chart-inner"/></div><div class="app-chart"><span class="app-chart-inner"/></div>').appendTo(chartList);
                    testCharts = chartList.find('.app-chart');
                    if ($(testCharts[0]).offset().left < $(testCharts[1]).offset().left)
                        numberOfColumns++;
                    if ($(testCharts[1]).offset().left < $(testCharts[2]).offset().left)
                        numberOfColumns++;
                    testCharts.remove();
                    chartList.empty();
                    // count number of valid pivots
                    for (pivotName in pivots) {
                        pivot = pivots[pivotName];
                        if (!pivot.ChartType || pivot.RecordCount == 0)
                            continue;
                        else {
                            // check if there's a larger chart
                            if (!hasLargerChart) {
                                if (pivot.Properties["medium"] || pivot.Properties["large"])
                                    hasLargerChart = true;
                                else if (chartsConfig) {
                                    config = chartsConfig[pivot.Id];
                                    if (config && config.size && config.size.match(/medium|large/))
                                        hasLargerChart = true;
                                }
                            }
                            numberOfPivots++;
                        }
                    }
                    if (numberOfPivots == 1)
                        hasLargerChart = true;
                    // calculate pivot size
                    for (pivotName in pivots) {
                        pivot = pivots[pivotName],
                            placeholder = $div('app-chart').data('data-context', pivot),
                            inner = $span('app-chart-inner').appendTo(placeholder),
                            moreBtn = $('<a class="ui-btn"><span class="app-btn-more">&nbsp;</span></a>').appendTo(placeholder).attr('title', resources.More);

                        if (!pivot.ChartType || pivot.RecordCount == 0)
                            continue;

                        placeholder.appendTo(chartList);

                        if (!w) {
                            maxHeight = scrollable.height(); // 90 - height of promo-filler
                            //if (hasLargerChart)
                            //    maxHeight -= 90;
                            instruction = scrollable.find('.app-presenter-instruction:visible');
                            if (instruction.length)
                                maxHeight -= instruction.outerHeight();
                            maxHeight = Math.floor(maxHeight);
                            w = inner.width();
                            if (numberOfColumns == 3)
                                h = numberOfPivots <= 3 ? Math.min(maxHeight, w * 1.33) : Math.min(w * .66, Math.max(maxHeight / 3, w * .5)) - 1;
                            else if (numberOfColumns == 2)
                                h = numberOfPivots <= 4 ? Math.max(maxHeight / 2, w * .5) : w * .66;
                            else
                                h = maxHeight * .66;
                            if (hasLargerChart && numberOfPivots <= 3)
                                h = maxHeight * .5;
                            if (h > maxHeight) {
                                h = w * .66;
                                if (h > maxHeight)
                                    h = maxHeight;
                            }
                            h = Math.floor(h);
                        }

                        var thisH = h;

                        // get configured height
                        config = chartsConfig[pivot.Id];
                        if (!config)
                            config = chartsConfig[pivot.Id] = {};

                        // read tags
                        if (!config.size) {
                            if (pivot.Properties["small"] != null)
                                delete config.size;
                            else if (pivot.Properties["medium"] != null)
                                config.size = "medium";
                            else if (pivot.Properties["large"] != null)
                                config.size = "large";
                        }

                        // set height
                        if (config.size) {
                            if (config.size == "medium") {
                                if (numberOfPivots > 2)
                                    thisH = h * 2 + 1;
                                placeholder.addClass('app-chart-medium');
                            }
                            else if (config.size == "large") {
                                thisH = maxHeight;
                                placeholder.addClass('app-chart-large');
                            }
                        }

                        // single pivot will always be full screen
                        if (numberOfPivots == 1) {
                            placeholder.addClass('app-chart-large');
                            thisH = maxHeight;
                        }

                        // scroll to
                        if (config.resized) {
                            resizedPlaceholder = placeholder;
                            delete config.resized;
                        }
                        else if (config.lastScrollPosition) {
                            closestPlaceholder = placeholder;
                            delete config.lastScrollPosition;
                        }

                        // ShowData 
                        if (config.ShowData || pivot.ChartType == "table")
                            pivot.ShowData = true;
                        else if (pivot.ShowData)
                            pivot.ShowData = false;

                        // ensure min height
                        if (thisH < 150)
                            thisH = 150;
                        chartContainers.push(inner.height(thisH));
                    }
                    $div('app-clear-fix').appendTo(chartList);
                    setTimeout(function () {
                        for (pivotName in pivots) {
                            pivot = pivots[pivotName];

                            if (!pivot.ChartType || pivot.RecordCount == 0)
                                continue;

                            // validate pivot formats
                            for (var f in pivot.Formats) {
                                var val = pivot.Formats[f],
                                    result = f.match(/(\w+)(\d+)/),
                                    fieldName = result[1],
                                    field = dataView.findField(fieldName);

                                if (field.AliasName) {
                                    delete pivot.Formats[f];
                                    pivot.Formats[field.AliasName + result[2]] = val;
                                }
                            }

                            // draw table with chart in corner.
                            if (pivot.ShowData) {
                                drawData(pivot, $(chartContainers[chartIndex++]));
                            }
                            else
                                drawChart(pivot, chartContainers[chartIndex++]);
                        }
                    }, 10);

                    if (numberOfPivots == 0)
                        renderEmptyList(false);

                    if (chartList.closest('.app-echo').length == 0)
                        $div('app-promo-filler').appendTo(chartList);


                    dataView.viewProp('chartsConfig', chartsConfig);

                    _touch.resetPageHeight();
                    _touch.syncEmbeddedViews(scrollable);
                    if (_touch.pointer('mouse'))
                        scrollable.trigger('scroll');

                    if (numberOfPivots > 1)
                        if (resizedPlaceholder || closestPlaceholder) {
                            var scrollToPlaceholder = resizedPlaceholder || closestPlaceholder,
                                placeholderHeight = scrollToPlaceholder.outerHeight(),
                                space = (scrollable.height() - placeholderHeight) / 2,
                                newScrollTop = scrollToPlaceholder.offset().top - scrollable.offset().top - space;
                            //if (newScrollTop > placeholderHeight / 3)
                            _touch.scroll(scrollable, newScrollTop);
                        }

                }

                if (chartList.length == 0)
                    chartList = $div('app-chart-list').appendTo(options.container);

                if (options.reset || pivots && dataView.dataSignature() != options.container.data('signature'))
                    pivots = null;

                if (dataView._totalRowCount > __settings.maxPivotRowCount) {
                    renderEmptyList(true);
                    return;
                }

                if (!pivots || pivots.length == 0) {
                    chartList.find('.app-chart-inner').children().hide();
                    _app.execute({
                        controller: dataView._controller,
                        command: 'Pivot',
                        pivotDefinitions: dataView.AutoPivots,
                        view: dataView._viewId,
                        _filter: dataView.combinedFilter(),
                        sort: '',
                        tags: dataView.get_tags(),
                        success: function (result) {
                            pivots = result.Pivots;
                            translate(pivots);
                            options.container.data('signature', dataView.dataSignature());
                            options.container.data('pivots', pivots);
                            render();
                        },
                        error: function (error) {
                            _app.alert(String.format('{0}\n{1}', error.get_message(), error.get_stackTrace()));
                        }
                    });
                }
                else
                    render();
            },
            hide: function (options) {
            },
            dispose: function (options) {
                options.container.removeData('pivots signature');
                options.container.find('app-chart').each(function () {
                    $(this).removeData();
                });
            }
        });
    })();
    (function () {

        var resources = Web.DataViewResources,
            resourcesPager = resources.Pager,
            resourcesHeaderFilter = resources.HeaderFilter,
            resourcesCalendar = resources.Presenters.Calendar,
            resourcesMobile = resources.Mobile,
            dtf = Sys.CultureInfo.CurrentCulture.dateTimeFormat,
            currentDate = new Date(),
            currentDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()),
            currentYear = currentDate.getFullYear(),
            currentMonth = currentDate.getMonth(),
            tagRegex = /calendar(\d+)?-([a-zA-Z]+)(:['"]?([a-zA-Z]+)['"]?)?(\d+)?/g,
            pivotRegex = /^(\d+), (\d+), (\d+)(, (.*))?$/,
            isScrolling,
            scrollStopTimeout,
            scrollStopCallback,
            dragScrollVertTimeout,
            dragScrollHorizTimeout,
            shiftViewTimeout,
            pluginLoadDataTimeout,
            drawTimeTimeout,
            dragScrollTimeout,
            loadColorLegendTimeout,
            saveColorsTimeout,
            dropTimeTimeout,
            updatePluginTimeout,
            //updateHeaderTimeout,
            drawTimeInterval,
            animationSpeed = 500,
            timeoutSpeed = 100,
            weekTimeWidth = 66,
            dayScrollEventCount = 0,
            dayAndWeekHeight = 1060,
            modeDrawDistance = {
                year: 2,
                month: 2,
                week: 7,
                day: 1, // in weeks
                agenda: 1
            },
            modeMaxRender = {
                year: 5,
                month: 5,
                week: 21,
                day: 2, // in weeks
                agenda: 90
            },
            eventMinLength = 30, // in minutes
            agendaPageSize = 30,
            maxColorCount = 23,
            maxLegendVisible = 5,
            dtfDayOfWeek = [], // to get proper day # by culture - dtfDayOfWeek[date.getDay()]
            dayOfWeekDtf = [], // to get the proper day name - dtf.DayNames[dayOfWeekDtf[day]]
            //skipClick,
            //draggedCalendarEvent,
            miniCalendarHeaderFormat = '<a class="ui-btn app-month-picker" title="{0}, {1}">{2}, {3}</a>',
            monthMoreFormat = '+{0} <span class="app-month-more">' + resourcesMobile.More.toLowerCase() + '</span>';

        // init dtf conversion
        for (var i = 0; i < 7; i++) {
            dtfDayOfWeek[i] = (7 + i - dtf.FirstDayOfWeek) % 7;
            dayOfWeekDtf[i] = (i + dtf.FirstDayOfWeek) % 7;
        }

        // check if point is touch or mouse
        function validateDate(date) {
            return date && typeof date != 'string' && !(isNaN(+date) || date < new Date(1753, 0) || date > new Date(9999, 0));
        }

        function appendClearFix(placeholder) {
            $div('app-clear-fix').appendTo(placeholder);
        }

        function startDrawTime() {
            if (drawTimeTimeout)
                return;
            var now = new Date();
            drawTimeTimeout = setTimeout(function () {
                drawTimeInterval = setInterval(drawTime, 1000 * 60);
            }, (60 - now.getSeconds()) * 1000);
        }

        // recalculates and moves current time lines on the screen
        // use mode = find to find the correct top
        function drawTime(date, mode, callback) {
            if (!date && $('.app-calendar.app-has-time-prompt').length)
                return;

            var now = date || new Date(),
                nowText = getClockTime(now),
                timeCols = $('.app-calendar-time'),
                timeLines,
                times = timeCols.find('div.app-current-time'),
                height = dayAndWeekHeight - (dayAndWeekHeight / 25),
                nowTime = now.getTime(),
                minutes = now.getMinutes(),
                startDayTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(),
                ms = nowTime - startDayTime,
                hours = timeCols.find('li span'),
                minute = now.getMinutes(),
                difference = 5 * (3000 / dayAndWeekHeight);

            if (mode && minutes != 0)
                nowText = ':' + minutes;

            if (!mode)
                timeLines = $('.app-calendar-weekview .current-time-line, .app-calendar-dayview .current-time-line');
            else if (mode == 'week') {
                $('.app-calendar').addClass('app-has-time-prompt');
                timeLines = timeCols.closest('.ui-page').find('.app-calendar-weekview .current-time-line');
            }
            else
                timeLines = $('.app-calendar-dayview .current-time-line');

            var fraction = ms / 86400000, // milliseconds in a day
                top = height * fraction;
            if (mode == 'find')
                drawTime();
            else if (times.first().css('top') != top + 'px')
                _touch.callInAnimationFrame(function () {

                    if (nowText != '') {
                        // hide covered hours
                        hours.removeClass('time-hidden');
                        if (minute < difference)
                            hours.filter('span[data-cal-hour="' + now.getHours() + '"]').addClass('time-hidden');
                        else if (minute > (60 - difference))
                            hours.filter('span[data-cal-hour="' + (now.getHours() + 1) + '"]').addClass('time-hidden');

                        times.text(nowText);
                    }

                    times.css('top', top);
                    timeLines.css('top', top).data('date', now);

                    if (callback)
                        callback(top);
                });
            return top;
        }

        function getClockTime(now, addSpace, brief) {
            if (!now)
                return '';
            var hour = now.getHours(),
                minute = now.getMinutes(),
                second = now.getSeconds(),
                pmDesignator = dtf.PMDesignator,
                amDesignator = dtf.AMDesignator,
                ap = hour < 12 ? (brief ? '' : amDesignator) : (brief ? pmDesignator.substring(0, 1) : pmDesignator);
            if (hour > 12 && (amDesignator || pmDesignator)) {
                hour = hour - 12;
            }
            if (addSpace && hour < 10 && hour != 0)
                hour = '0' + hour;
            if (hour == 0)
                hour = (pmDesignator || amDesignator) ? 12 : 0;
            if (minute < 10)
                minute = "0" + minute;
            if (!brief && ap)
                ap = ' ' + ap;

            return brief && minute == '00' ? String.format('{0}{1}', hour, ap) : String.format('{0}:{1}{2}', hour, minute, ap);
        }

        function setDateFraction(date, hour, frac) {
            var precision = _touch.settings('calendar.drag.precision') || 15,
                fraction = precision / 60,
                halfFraction = fraction / 2,
                count = 60 / precision,
                i;
            for (i = 0; i < count; i++)
                if (frac < fraction * (i + 1) - halfFraction)
                    return date.setHours(hour, precision * i);
            return date.setHours(hour, 60);
        }

        function isToday(testDate) {
            return testDate.getDate() == currentDate.getDate() && testDate.getMonth() == currentMonth && testDate.getFullYear() == currentYear;
        }

        function isSameDay(a, b) {
            return a.getDate() == b.getDate() && a.getMonth() == b.getMonth() && a.getFullYear() == b.getFullYear();
        }

        // gets the first placeholder visible on the screen
        function getFirstVisiblePlaceholder(placeholders) {
            var first;
            placeholders.each(function () {
                first = $(this);
                firstLeft = first.position().left;
                if (firstLeft > 0 || firstLeft * -1 < first.width() / 2)
                    return false;
            });
            return first;
        }

        var Cache = function (calendar) {
            this.calendar = calendar;
            this.data = {
                day: {
                }, month: {}, year: {}, agenda: {}
            };
        };

        Cache.prototype = {
            select: function (start) {

                var mode = this.calendar.mode,
                    date = new Date(start),
                    month,
                    days = 1;
                if (mode == "week")
                    mode = "day";
                else if (mode == "agenda")
                    return this.data[mode][start];
                var year = this.data[mode][date.getFullYear()];

                // get year
                if (!year)
                    return null;
                if (mode == 'year')
                    return year;

                // get month
                month = year[date.getMonth()];
                if (!month)
                    return null;
                if (mode == 'month')
                    return month;

                // get day/week
                return month[date.getDate()];
            },
            insert: function (start, rows) {
                var testDate = new Date(start),
                    dataView = this.dataView,
                    activeField = this.calendar.activeCalendar.date,
                    mode = this.calendar.mode,
                    days = mode == 'week' ? 7 : 1;
                if (mode == "week")
                    mode = "day";
                else if (mode == "agenda") {
                    if (start < 0)
                        rows.reverse();
                    this.data[mode][start] = rows;
                    return;
                }

                switch (mode) {
                    case 'year':
                        this.data[mode][start.getFullYear()] = {
                        };
                        break;
                    case 'month':
                        var year = this.data[mode][start.getFullYear()];
                        if (!year)
                            year = this.data[mode][start.getFullYear()] = {
                            };
                        year[start.getMonth()] = {};
                        break;
                    case 'day':
                        var test = new Date(start);
                        for (i = 0; i < days; i++) {
                            var year = this.data[mode][test.getFullYear()];
                            if (!year)
                                year = this.data[mode][test.getFullYear()] = {};
                            var month = year[test.getMonth()];
                            if (!month)
                                month = year[test.getMonth()] = {};
                            month[test.getDate()] = { rows: [], count: 0 };
                            test.setDate(test.getDate() + 1);
                        }
                        break;
                }

                for (var rowNum in rows) {
                    var row = rows[rowNum],
                        value = pivotRegex.exec(row[0]);
                    if (!value) {
                        //alert("Error with: " + row[0]);
                        continue;
                    }
                    var date = new Date(value[1], parseInt(value[2]) - 1, value[3] || value[2]),
                        year = this.data[mode][date.getFullYear()];
                    if (!year)
                        year = this.data[mode][date.getFullYear()] = {};
                    var month = year[date.getMonth()];
                    if (!month)
                        month = year[date.getMonth()] = {};
                    var day = month[date.getDate()];
                    if (!day)
                        day = month[date.getDate()] = { rows: [], count: 0 };
                    if (mode == 'year') {
                        day.count = row[1];
                    }
                    else {
                        $(row[1]).each(function () {
                            if (this.length == 5)
                                day.rows.push(this);
                        });
                        day.count += row[2];
                    }
                }
            },
            // clears the cached data and reloads data in the visible view
            clear: function () {
                this.data = { day: {}, month: {}, year: {}, agenda: {} };

            },
            clearAgenda: function () {
                this.data.agenda = {};
            }
        };

        // get data view's combined filter with specified additional between
        function getDateFilter(dataView, startField, endField, start, end, excluded) {
            //var startName = startField.Name,
            //    endName = endField ? endField.Name : '',
            //    lastMatchIndex = -1,
            //    removeIndices = [],
            //    newFilter = dataView.combinedFilter().filter(function (f, i) {
            //        if (f.startsWith("_match"))
            //            lastMatchIndex = i;
            //        if (f.startsWith(startName) || (endField && f.startsWith(endName))) {
            //            if (lastMatchIndex != -1)
            //                removeIndices[lastMatchIndex] = i;
            //            else
            //                return false;
            //        }
            //        return true;
            //    }),
            //    start = dataView.convertFieldValueToString(startField, start),
            //    end = dataView.convertFieldValueToString(startField, end),
            //    betweenFilter = String.format('{0}:$between${1}$and${2}', startName, start, end),
            //    startLTE = String.format('{0}:<={1}', startName),
            //    startGTE = String.format('{0}:>={1}', startName),
            //    endLTE = String.format('{0}:<={1}', endName),
            //    endGTE = String.format('{0}:>={1}', endName);
            //for (var s in removeIndices)
            //    if (removeIndices.hasOwnProperty(s))
            //        newFilter.splice(removeIndices[s], parseInt[s]);
            //if (!endField)
            //    newFilter.push(betweenFilter);
            //else 
            //    newFilter.push(
            //        "_match_:$all$", betweenFilter,
            //        "_match_:$all$", startLTE, endGTE,
            //        "_match_:$all$", startLTE, endGTE);

            var dateString1 = dataView.convertFieldValueToString(startField, start),
                dateString2 = end && dataView.convertFieldValueToString(startField, end),
                dateFilter;

            if (start == null)
                dateFilter = String.format('{0}:<{1}', startField.Name, dateString2);
            else if (end == null)
                dateFilter = String.format('{0}:>={1}', startField.Name, dateString1);
            else
                dateFilter = String.format('{0}:$between${1}$and${2}', startField.Name, dateString1, dateString2);

            if (start && (isNaN(start.getTime())) || (end && isNaN(end.getTime()))) {
                if (console && console.log)
                    console.log('Error forming date filter: Date is NaN');
                return [];
            }

            var startName = startField.Name,
                endName = endField ? endField.Name : '',
                filter = dataView.get_filter().filter(function (f) { return f.indexOf(startName) !== 0 && (!endName || f.indexOf(endName) !== 0); });
            newFilter = dataView._combinedFilter([dateFilter].concat(filter));

            return newFilter;
        }

        // reads block attributes and returns Date object
        function getDateOfBlock(placeholder) {
            var year = placeholder.attr('data-cal-year'),
                month = placeholder.attr('data-cal-month'),
                day = placeholder.attr('data-cal-day');
            return new Date(year, month ? month : 0, day ? day : 1);
        }

        function getTimeOfBlock(placeholder, date) {
            var hours = placeholder.attr('data-cal-h'),
                minutes = placeholder.attr('data-cal-m'),
                seconds = placeholder.attr('data-cal-s'),
                ms = placeholder.attr('data-cal-ms');
            date.setHours(hours, minutes, seconds, ms);
        }

        function setTimeOfBlock(placeholder, date) {
            placeholder
                .attr('data-cal-h', date.getHours())
                .attr('data-cal-m', date.getMinutes())
                .attr('data-cal-s', date.getSeconds())
                .attr('data-cal-ms', date.getMilliseconds());
        }

        // sets Date attributes to block
        function setDateOfBlock(placeholder, date) {
            placeholder.attr('data-cal-year', date.getFullYear()).attr('data-cal-month', date.getMonth()).attr('data-cal-day', date.getDate());
        }

        // get object containing date info for formatting
        function getTimeString(date) {

            var result = {
                hour: date.getHours(),
                minute: date.getMinutes(),
                ampm: ''
            },
                usesAMPM = !!dtf.AMDesignator.length;

            if (usesAMPM) {
                // calc hour
                if (result.hour >= 12)
                    result.ampm = dtf.PMDesignator;
                else
                    result.ampm = dtf.AMDesignator;

                if (result.hour > 12)
                    result.hour -= 12;

                if (result.hour == 0)
                    result.hour = 12;
            }

            if (result.hour < 10)
                result.hour = ' ' + result.hour;
            else
                result.hour = result.hour.toString();

            if (result.minute < 10)
                result.minute = '0' + result.minute;
            else
                result.minute = result.minute.toString();

            return result;
        }

        // creates month table string
        function createMonthTableBody(year, month, forMiniCalendar) {
            var body = '',
                testDate = new Date(year, month, 1),
                dayOfWeek = dtfDayOfWeek[testDate.getDay()],
                endDate = new Date(year, month + 1, 1),
                endDay = dtfDayOfWeek[endDate.getDay()],
                currentRow = '',
                rowCount = 0,
                isCurrentMonth = false,
                drawnTdCount = 0,
                maxTdCount = 42;

            // set the end date
            if (endDay != 0)
                endDate.setDate(endDate.getDate() + (6 - endDay) + 1);

            // set the start date
            if (dayOfWeek != 0)
                testDate.setDate(testDate.getDate() - dayOfWeek);

            // render this month
            while (drawnTdCount < maxTdCount) {
                dayOfWeek = dtfDayOfWeek[testDate.getDay()];
                if (dayOfWeek == 0) {
                    if (currentRow)
                        body += currentRow + '</tr>';
                    rowCount++;
                    currentRow = '<tr>';
                }
                currentRow += '<td';
                var testMonth = testDate.getMonth();
                if (testMonth == month || forMiniCalendar) {
                    if (forMiniCalendar && testMonth != month) {

                        if (!(month == 11 && testMonth == 0) && ((month == 0 && testMonth == 11) || testMonth < month))
                            currentRow += ' class="app-prev-month"';
                        else
                            currentRow += ' class="app-next-month"';
                    }
                    else if (currentDay.setHours(0, 0, 0, 0) == testDate.setHours(0, 0, 0, 0))
                        currentRow += ' class="app-current-day"';
                    if (forMiniCalendar)
                        currentRow += String.format(' data-cal-year="{0}" data-cal-month="{1}" data-cal-day="{2}"', testDate.getFullYear(), testDate.getMonth(), testDate.getDate());
                    currentRow += String.format('>{0}', testDate.getDate());
                }
                else
                    currentRow += '>&nbsp;';

                currentRow += '</td>';
                testDate.setDate(testDate.getDate() + 1);
                drawnTdCount++;
                if (!forMiniCalendar)
                    if (testDate >= endDate)
                        break;
            }
            body += currentRow;
            // flesh out rows
            while (rowCount < 6) {
                rowCount++;
                body += '<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>';
            }
            return body + '';
        }

        // find tab and click
        function clickOnCalendarTab(_, link) {
            findActivePage('.app-tabs .ui-btn').each(function () {
                var tab = $(this);
                if (tab.attr('data-text') == link.text()) {
                    tab.trigger('vclick');
                    return false;
                }
            });
        }

        // finds the correct tab link
        function findTab(header, text) {
            var tabs = header.find('.app-tabs a'),
                link;

            tabs.each(function () {
                var tab = $(this);
                if (tab.attr('data-text') == text) {
                    link = tab;
                    return false;
                }
            });
            return link;
        }

        // reads in the calendar tags
        function composeCalendars(dataView) {
            var isChild = dataView.get_hasParent(),
                filterFields = dataView.get_filterFields(),
                autoCalendars = [],
                calendars = [],
                firstString,
                firstLookup, secondLookup,
                firstDate,
                i;

            $(dataView._allFields).each(function () {
                var field = this;

                // check for tags
                if (field.Tag) {
                    var tags = field.Tag.split(' '),
                        length = tags.length;
                    for (i = 0; i < length; i++) {
                        match = tagRegex.exec(tags[i]);
                        if (match != null) {
                            var id = match[1] ? parseInt(match[1]) : 0,
                                prop = match[2],
                                val = match[4],
                                calendar = calendars[id];

                            if (prop == 'disabled')
                                break;

                            //if (field.AliasName)
                            //    field = dataView.findField(field.AliasName);

                            if (!calendar)
                                calendars[id] = (calendar = {});

                            switch (prop) {
                                case "date":
                                    calendar.date = field;
                                    break;
                                default:
                                    calendar[prop] = val || field;
                                    break;
                            }
                        }
                        tagRegex.lastIndex = 0; // reset regex
                    }
                }

                if ((field.ItemsDataController || field.AliasName) && field.ItemsStyle != 'CheckBoxList') {
                    if (!isChild || field.Name != filterFields) {
                        if (!firstLookup)
                            firstLookup = field;
                        else if (!secondLookup)
                            secondLookup = field;
                    }
                }

                if (!firstString && field.Type == 'String')
                    firstString = field;

                // auto create tags
                if (field.Type == "DateTime" || field.Type == "Date") {
                    if (!field.tagged('calendar-disabled')) {
                        if (!firstDate)
                            firstDate = field;
                        i = 0;
                        while (autoCalendars[i])
                            i++;
                        autoCalendars[i] = {
                            date: field,
                            name: field.Label
                        };
                    }
                }
            });

            if ($.isEmptyObject(calendars))
                calendars = autoCalendars;

            // verify properties
            $(calendars).each(function () {
                var calendar = this;

                if (!calendar.text && firstString)
                    calendar.text = firstString;

                if (!calendar.date && firstDate)
                    calendar.date = firstDate;

                if (!calendar.name)
                    calendar.name = calendar.date.Label;

                if (firstLookup && !calendar.color) {
                    if (firstString && secondLookup && firstString == firstLookup)
                        calendar.color = secondLookup;
                    else
                        calendar.color = firstLookup;
                }

                var cachedColorMap = calendar.color ? dataView.viewProp('calendarColorMap-' + calendar.color.Name) : null;
                calendar.colorMap = new ColorMap(dataView, calendar, cachedColorMap);
            });

            return calendars;
        }

        function fetchCalendarData(scrollable, afterResize) {

            var dataView = calendarDataView(),
                calendar = dataView && dataView.calendar/*,
                viewStyle = dataView && dataView.extension().viewStyle*/;

            if (!calendar) return;

            if (!scrollable)
                scrollable = calendar.scrollable();
            var presenter = scrollable.find('.app-presenter[data-presenter="calendar"]'),
                header = presenter.data('cal-header'),
                //footer = presenter.data('cal-footer'),
                viewClass = calendar.viewClassName(), // '.app-calendar-' + calendar.mode + ',view',
                view = presenter.find(viewClass);

            // execute
            if (afterResize) {
                calendar.preventNavigate = true;
                calendar.getViewHandler().resize(view, header, null, true);
            }
            if (scrollStopCallback)
                scrollStopCallback();
            calendar.updateHeader(header);
            calendar.loadData(view);
            CalendarControl('refresh', {
                container: _touch.sidebar().find('.app-calendar-plugin')
            });

        }

        $(document)
            // global scroll handler
            .on('scrollstart.app', function (e) {
                if (e.namespace == 'app')
                    isScrolling = true;
            })

            .on('scroll.app scrollstop.app resized.app', function (e) {
                if (e.namespace != 'app') return;
                isScrolling = false;
                var target = $(e.relatedTarget),
                    resized = e.type == 'resized',
                    dataView = resized ? calendarDataView() : findDataView(target.closest('.ui-page').attr('id')),
                    calendar = dataView && dataView.calendar,
                    view,
                    viewStyle = dataView && dataView.extension().viewStyle(),
                    scrollable = findScrollable(target);

                if (!dataView || viewStyle != 'calendar' || !calendar)
                    return;

                var isDayWeek = calendar.mode.match(/day|week/);

                if (resized) {
                    view = calendar.getVisibleView();
                    if (isDayWeek && view)
                        view.removeClass('app-has-current-day');
                    //var scrollable = calendar.scrollable(),
                    //    presenter = scrollable.find('div[data-presenter="calendar"]'),
                    //    header = presenter.data('cal-header'),
                    //    view = calendar.getVisibleView(),
                    //    badgeRect = header.find('.app-calendar-badge')[0].getClientBoundingRect(),
                    //    todayRect = header.find('.app-calendar-today')[0].getClientBoundingRect(),
                    //    tabs = header.find('.app-tabs'),
                    //    tabsRect = tabs[0].getClientBoundingRect();
                    //if (isDayWeek) {
                    //    if (view)
                    //        view.removeClass('app-has-current-day');
                    //    //if (header)
                    //    //    header.find('.app-week-header ul, .app-day-header ul').css('visibility', 'hidden');
                    //}

                    //tabs.css('visibility', header.width() < 768 ? 'hidden' : 'visible');
                }

                // handle scroll stop
                clearTimeout(scrollStopTimeout);
                scrollStopTimeout = setTimeout(function () {
                    // show/hide heading
                    if (!isScrolling && (resized || !isDayWeek)) {
                        fetchCalendarData(null, resized);
                    }
                }, 200);

            })

            // tabs handler
            .on('more.app', function (event) {
                var target = $(event.target),
                    echo = target.closest('.app-echo'),
                    dataView = echo.length ? _app.find(echo.attr('data-for')) : calendarDataView(),
                    scrollable = findScrollable(),
                    calendar = scrollable.find('.app-calendar'),
                    isMore = event.type == 'more',
                    isViewSelector = event.type == 'viewselector';

                if (!dataView || !calendar.length || !calendar.is(':visible'))
                    return;

                var viewStyle = dataView.extension().viewStyle();
                if (viewStyle != 'calendar')
                    return;

                var config = dataView.viewProp('calendarConfig'),
                    mode = config.mode,
                    tabs = scrollable.parent().find('.app-bar-calendar .app-tabs'),
                    dayItem = { text: resourcesCalendar.Day, icon: mode == 'day' ? 'check' : false, callback: clickOnCalendarTab },
                    weekItem = { text: resourcesCalendar.Week, icon: mode == 'week' ? 'check' : false, callback: clickOnCalendarTab },
                    monthItem = { text: resourcesCalendar.Month, icon: mode == 'month' ? 'check' : false, callback: clickOnCalendarTab },
                    yearItem = { text: resourcesCalendar.Year, icon: mode == 'year' ? 'check' : false, callback: clickOnCalendarTab },
                    agendaItem = { text: resourcesCalendar.Agenda, icon: mode == 'agenda' ? 'check' : false, callback: clickOnCalendarTab };

                if (isMore && event.panel[0].id == 'app-panel-view-options')
                    event.items.splice(event.items.length, 0, {}, dayItem, weekItem, monthItem, yearItem, agendaItem);
                else if (isViewSelector && tabs.css('visibility') == 'hidden')
                    event.items.splice(0, 0, dayItem, weekItem, monthItem, yearItem, agendaItem, {});
            })

            .on('vclick contextmenu', '.app-calendar,.app-bar-calendar', function (event) {
                var target = $(event.target),
                    targetEvent = target.closest('.app-event'),
                    eventType = event.type,
                    echo = target.closest('.app-echo'),
                    dataView = echo.length ? _app.find(echo.attr('data-for')) : calendarDataView(),
                    calendar = dataView.calendar,
                    scrollable = toScrollable(dataView),
                    presenter = scrollable.find('.app-presenter[data-presenter="calendar"]'),
                    button = target.closest('.ui-btn'),
                    parent = target.parent(),
                    hour = target.attr("data-cal-hour"),
                    lastTouch = _touch.lastTouch();

                if (targetEvent.length)
                    target = targetEvent;

                if (!dataView || !dataView.calendar)
                    return;

                if (eventType === 'contextmenu' && target.closest('.ui-page').is('.app-reading-pane-master') && !findActivePage().is('.app-reading-pane-master')) {
                    _touch.invokeInTargetPage(function () {
                        target.trigger('contextmenu');
                    });
                    return false;
                }

                isLookup = dataView._lookupInfo;

                if (target.closest('.app-tabs ul').length > 0)
                    return;

                if (!button.length)
                    button = target.find('.ui-btn');

                // scope to correct target
                if (target.is('ul') && !!parent.attr('data-cal-day')) {
                    target = parent;
                }
                else if (parent.is('.app-event'))
                    target = parent;
                else if (target.is('.app-tabs')) {
                    return false;
                    // handle 8 pixel inaccuracy
                    //var btns = target.find('.ui-btn'),
                    //    x = lastTouch && lastTouch.x || event.clientX,
                    //    result = false;
                    //btns.each(function () {
                    //    var btn = $(this),
                    //        left = btn.offset().left;
                    //    if ((left - 8) <= x && x <= (left + btn.outerWidth() + 8)) {
                    //        btn.trigger('vclick');
                    //        result = true;
                    //        return false;
                    //    }
                    //});
                    //if (result)
                    //    return false;
                }

                // validate permitted events
                //if (eventType == 'taphold' && !target.is('.app-event'))
                //    return;
                if ((eventType == 'contextmenu') && (!target.is('td,.app-event') && hour == null))
                    return false;

                var dataContext = target.data('data-context')/*,
                    dataMoreContext = target.data('data-more-context')*/;
                if (target.is('.dv-load-at-top, .dv-load-at-bottom, .app-btn-next, .app-btn-prev')) {
                    var blocks = calendar.getBlocks(scrollable),
                        testDate,
                        year,
                        maxRender = echo.length ? 0 : modeMaxRender[calendar.mode],
                        handler = calendar.views[calendar.mode];


                    // TODO what is this?
                    //if ($app.touch.desktop())
                    //    $app.touch.stopScrolling(target);

                    // load at top
                    if (target.is('.dv-load-at-top, .app-btn-prev')) {
                        // remove excessive blocks
                        if (blocks.length > maxRender) {
                            if (calendar.mode == "agenda")
                                handler.removeData(scrollable.find('.app-calendar-agendaview'), handler.maxPage);
                            else
                                blocks.slice(maxRender).remove();
                        }

                        var firstPlaceholder = blocks.first(),
                            newPlaceholder,
                            addedHeight = 0,
                            year = Number(firstPlaceholder.data('cal-year')),
                            month = firstPlaceholder.data('cal-month') != null ? Number(firstPlaceholder.data('cal-month')) : 1,
                            oldScrollTop = scrollable.scrollTop(),
                            topGap = target.outerHeight(true) - scrollable.find('.app-presenter-instruction').outerHeight(true), //-scrollable.find('.app-presenter-instruction').outerHeight(true),//-target.height() - 3, // target.height();// (target.outerHeight(true) + scrollable.find('.app-presenter-instruction').outerHeight(true)); //
                            newContent = [];
                        testDate = getDateOfBlock(firstPlaceholder);

                        // add blocks to beginning
                        for (var drawCount = 0; drawCount < modeDrawDistance[calendar.mode]; drawCount++) {
                            switch (calendar.mode) {
                                case "month":
                                    testDate.setMonth(testDate.getMonth() - 1, 1);
                                    newPlaceholder = handler.drawMonth(testDate);
                                    break;
                                case "year":
                                    testDate.setFullYear(year - 1);
                                    year = testDate.getFullYear();
                                    newPlaceholder = handler.drawYear(testDate);
                                    topGap += -6; // negative margin
                                    break;
                                case "agenda":
                                    target.text(resourcesHeaderFilter.Loading);
                                    handler.loadData(scrollable.find('.app-calendar-agendaview'), null, handler.minPage - 1);
                                    break;
                            }
                            if (newPlaceholder) {
                                newPlaceholder.insertBefore(firstPlaceholder);
                                firstPlaceholder = newPlaceholder;
                                //addedHeight += newPlaceholder.outerHeight(true);
                                newContent.push(newPlaceholder);
                            }
                        }
                        handler.resize(calendar.getVisibleView());
                        $(newContent).each(function () {
                            addedHeight += $(this).outerHeight(true);
                        });
                        if (addedHeight)
                            _touch.scroll(scrollable, Math.ceil(oldScrollTop + addedHeight + topGap));
                    }
                    // load at bottom
                    else {
                        var lastPlaceholder = blocks.last(),
                            newPlaceholder,
                            year = Number(lastPlaceholder.data('cal-year')),
                            month = lastPlaceholder.data('cal-month') != null ? Number(lastPlaceholder.data('cal-month')) : 1,
                            testDate = new Date(year, month, 1);

                        // remove excessive years
                        if (blocks.length > maxRender) {
                            if (calendar.mode == 'agenda')
                                handler.removeData(scrollable.find('.app-calendar-agendaview'), handler.minPage);
                            else {
                                blocks.slice(0, blocks.length - maxRender).remove();
                                var height = 0;
                                blocks.each(function () {
                                    height += $(this).height();
                                });
                                _touch.scroll(scrollable, height - 1);
                            }
                        }

                        // add blocks to end
                        for (drawCount = 0; drawCount < modeDrawDistance[calendar.mode]; drawCount++) {
                            switch (calendar.mode) {
                                case "month":
                                    testDate.setMonth(testDate.getMonth() + 1, 1);
                                    newPlaceholder = handler.drawMonth(testDate);
                                    break;
                                case "year":
                                    testDate.setFullYear(year + 1);
                                    year = testDate.getFullYear();
                                    newPlaceholder = handler.drawYear(testDate);
                                    break;
                                case "agenda":
                                    target.text(resourcesHeaderFilter.Loading);
                                    handler.loadData(scrollable.find('.app-calendar-agendaview'), null, handler.maxPage + 1);
                                    break;
                            }
                            if (newPlaceholder) {
                                newPlaceholder.insertAfter(lastPlaceholder);
                                lastPlaceholder = newPlaceholder;
                            }
                        }
                        handler.resize(calendar.getVisibleView());
                    }

                    return false;
                }
                // clicked on event
                else if (dataContext) {
                    calendar.selectEvent(dataContext, target, event);
                    //event.preventDefault();
                    return false;
                }

                // show event list in day/week
                else if (target.is('.app-event-more')) {
                    if (!calendar.hasKeyFields())
                        return false;

                    var date = getDateOfBlock(target.closest('.app-calendar-day')),
                        data = target.data('data-more-context');
                    calendar.showEventList(date, data, target, event);
                }

                // show event list in month
                else if (target.closest('.app-calendar-month-more').length) {
                    if (!calendar.hasKeyFields())
                        return false;

                    var moreBtn = target.closest('.app-calendar-month-more'),
                        td = target.closest('td'),
                        visibleEvents = td.find('.app-event'),
                        visibleEventIDs = [],
                        month = target.closest('.app-calendar-month'),
                        day = td.attr('data-cal-day'),
                        startDate = getDateOfBlock(month);
                    startDate.setDate(day);

                    visibleEvents.each(function () {
                        var event = $(this),
                            row = event.data('data-context');
                        visibleEventIDs.push(row[0]);
                    });

                    function showPopup(data, date) {
                        data = data.filter(function (event) {
                            return visibleEventIDs.indexOf(event[0]) == -1;
                        });

                        calendar.showEventList(startDate, data, target, event);
                    }

                    // show more items in list
                    moreBtn.addClass('ui-btn-active');
                    _touch.callWithFeedback(td, function () {
                        moreBtn.removeClass('ui-btn-active');

                        var data = td.data('data-more-context');
                        if (!data) {

                            // fetch and parse data
                            calendar.requestData({
                                mode: 'daylist',
                                date: startDate,
                                success: function (result) {
                                    if (result.Pivots.pivot0 && result.Pivots.pivot0.Data[1]) {
                                        data = result.Pivots.pivot0.Data[1][1];

                                        td.data('data-more-context', data);
                                        showPopup(data);
                                    }
                                }
                            });
                        }
                        else
                            showPopup(data);
                    });
                }
                // day header to scroll to day
                else if (target.closest('.app-day-header').length) {
                    if (target.is('ul'))
                        return;

                    var view = presenter.find('.app-calendar-dayview'),
                        header = button.closest('.app-day-header');
                    //footer = presenter.data('cal-footer');

                    _touch.callWithFeedback(button, function () {
                        //var outer = presenter.data('cal-footer').find('.app-scroll-outer'),
                        var parent = button.closest('li'),
                            date = getDateOfBlock(parent),
                            year = date.getFullYear(),
                            month = date.getMonth(),
                            day = date.getDate(),
                            column = calendar.getBlockByDate(view, date, 'day'),
                            left = parseInt(view.css('marginLeft'), 10) - column.position().left;
                        if (column.length)
                            calendar.views.day._scroll(view, header, left * -1, null/*footer*/, true);
                    });
                    return false;
                }
                // week header click to open day
                else if (target.closest('.app-week-header').length) {
                    if (target.is('ul'))
                        return;

                    _touch.callWithFeedback(button, function () {
                        var link = findTab(target.closest('.app-bar-calendar'), resourcesCalendar.Day),
                            date = getDateOfBlock(button.closest('li'));
                        calendar.navigateDate = date;
                        if (link)
                            link.trigger('vclick');
                    });
                    return false;
                }
                // buttons
                else if (target.is('.ui-btn') || target.closest('.ui-btn').length) {
                    // go to today
                    if (button.is('.app-calendar-today,.app-calendar-next,.app-calendar-prev')) {
                        _touch.callWithFeedback(button, function () {
                            if (scrollable.length > 0) {

                                var goNext = button.is('.app-calendar-next'),
                                    goPrev = button.is('.app-calendar-prev'),
                                    mode = 'today';

                                if (goNext)
                                    mode = 'next';
                                else if (goPrev)
                                    mode = 'prev';

                                calendar.scrollView(mode);
                            }
                        });
                        return false;
                    }
                    // show badge menu
                    else if (button.is('.app-calendar-badge')) {
                        var config = dataView.viewProp('calendarConfig'),
                            mode = config.mode,
                            tabs = scrollable.parent().find('.app-bar-calendar .app-tabs');

                        if (tabs.css('visibility') == 'hidden') {
                            // open popup
                            _touch.callWithFeedback(button, function () {
                                _touch.listPopup({
                                    anchor: button,
                                    iconPos: 'left',
                                    items: calendar.getSupportedViews(dataView).map(function (v) {
                                        return {
                                            text: v.text,
                                            icon: mode == v.value ? 'check' : false,
                                            callback: clickOnCalendarTab
                                        }
                                    })
                                });
                            });
                        }
                        else {
                            _touch.callWithFeedback(button, function () {
                                _touch.listPopup({
                                    anchor: button,
                                    items: [{ text: button.attr('data-cal-value'), callback: function () { } }]
                                });
                            });
                        }
                    }
                    //go to month 
                    else if (button.is('.app-calendar-month-header')) {
                        date = null;
                        header = presenter.data('cal-header');
                        var link = findTab(header, resourcesCalendar.Month);

                        switch (calendar.mode) {
                            case 'year':
                                var year = target.closest('.app-calendar-year').attr('data-cal-year'),
                                    month = target.closest('.app-calendar-month').attr('data-cal-month');
                                date = new Date(year, month);
                                break;
                            case 'agenda':
                                date = getDateOfBlock(button);
                                break;
                        }
                        if (date) {
                            calendar.navigateDate = date;
                            _touch.callWithFeedback(button, function () {
                                if (link)
                                    link.trigger('vclick');
                            });
                            return false;
                        }
                    }
                    else if (button.parent().attr('data-cal-day') || target.is('h2')) {
                        if (calendar.mode == "month") {
                            if (target.is('td'))
                                return;
                            var header = presenter.data('cal-header'),
                                month = target.closest('.app-calendar-month'),
                                link = findTab(header, resourcesCalendar.Day);
                            date = getDateOfBlock(month);
                            date.setDate(button.parent().attr('data-cal-day'));
                            calendar.navigateDate = date;
                            _touch.callWithFeedback(button, function () {
                                if (link)
                                    link.trigger('vclick');
                            });
                            return false;
                        }
                        else if (calendar.mode == 'agenda' && !echo.length) {
                            date = getDateOfBlock(target.closest('li'));
                            if (date) {
                                var header = presenter.data('cal-header'),
                                    link = findTab(header, resourcesCalendar.Day);
                                calendar.navigateDate = date;
                                _touch.callWithFeedback(button, function () {
                                    if (link)
                                        link.trigger('vclick');
                                });
                            }
                        }
                    }
                }
                // table click
                else if (target.is('td') || (target.is('div') && hour != null)) {
                    if (calendar.mode == "year") {
                        if (target.height() < 20 && _touch.pointer('mouse'))
                            target.closest('.app-calendar-month').find('.app-calendar-month-header').trigger('vclick');
                        else {
                            day = parseInt(target.text(), 10);
                            if (!day)
                                return;
                            var year = target.closest('.app-calendar-year').attr('data-cal-year'),
                                month = target.closest('.app-calendar-month').attr('data-cal-month'),
                                header = presenter.data('cal-header'),
                                link = findTab(header, resourcesCalendar.Day);
                            calendar.navigateDate = new Date(year, month, day);
                            target.addClass('ui-btn-active');
                            _touch.callWithFeedback(target, function () {
                                if (link)
                                    link.trigger('vclick');
                                target.removeClass('ui-btn-active');
                            });
                        }
                        return false;
                    }
                    // trigger "New" action
                    else {
                        config = calendar.activeCalendar;
                        date = null;
                        var lastTouch = _touch.lastTouch(),
                            newActions = calendar.getActionsByName('New'),
                            endDate,
                            hasEnd = !!config.end,
                            isMonth = calendar.mode == 'month',
                            preview;

                        if (!newActions.length)
                            return false;

                        if (isMonth) {
                            day = target.attr('data-cal-day');
                            var month = target.closest('div.app-calendar-month');
                            if (!day)
                                return false;
                            date = getDateOfBlock(month);
                            date.setDate(day);

                            if (hasEnd) {
                                endDate = new Date(date);
                                endDate.setMinutes(endDate.getMinutes() + 60);
                            }
                        }
                        else { // mode == day || week
                            day = target.closest('div.app-calendar-day');
                            var dayList = day.find('.app-calendar-eventlist'),
                                y = lastTouch.y - target.offset().top,
                                height = target.height(),
                                frac = y / height;
                            date = getDateOfBlock(day);
                            setDateFraction(date, hour, frac);

                            if (hasEnd) {
                                endDate = new Date(date);
                                endDate.setMinutes(endDate.getMinutes() + 60);
                            }

                            preview = calendar.drawEvent([null, date, endDate, null, ' '], null).removeClass('app-event-color-0').addClass('app-event-new');

                            if (hasEnd)
                                preview.height(dayAndWeekHeight / 25);

                            var top = drawTime(date, 'find');
                            preview.css('top', top + 22).appendTo(dayList);
                        }

                        if (!date)
                            return;

                        newActions.forEach(function (action) {
                            var oldCallback = action.callback,
                                context = {
                                    action: {
                                        action: action,
                                        argument: action.argument,
                                        dataViewId: dataView._id,
                                        row: null
                                    }
                                };
                            action.CommandName = action.command;
                            action.callback = function () {
                                _app.newValues = [{
                                    name: config.date.Name, value: date
                                }];
                                if (hasEnd)
                                    _app.newValues.push({
                                        name: config.end.Name, value: endDate
                                    });
                                oldCallback(context);
                            };
                        });

                        var options = {
                            iconPos: 'left',
                            items: newActions,
                            title: String.localeFormat('{0:' + dtf.LongDatePattern + '} {0:' + dtf.ShortTimePattern + '}', date),
                            afterclose: function () {
                                if (preview)
                                    preview.remove();
                            }
                        };

                        if (isMonth)
                            options.anchor = target;
                        else {
                            options.x = lastTouch.x; // event.pageX;
                            options.y = lastTouch.y; // event.pageY;
                            options.arrow = 'b,t,l,r';
                        }

                        // open popup
                        _touch.listPopup(options);
                        return false;
                    }
                }
                if (eventType === 'contextmenu')
                    return false;
            })
            // clear selection
            .on('clear.dataview.app', function (event) {
                var dataView = event.dataView,
                    calendar = dataView.calendar;
                if (calendar)
                    $('#' + dataView._id).find('.app-calendar-selected').removeClass('app-calendar-selected');
            })
            // refresh the data if the filter has changed
            .on('reset.dataview.app', function (event) {
                var dataView = event.dataView;

                if (!dataView)
                    return;

                var calendar = dataView.calendar,
                    //viewStyle = dataView && dataView.extension() && dataView.extension().viewStyle(),
                    plugin = dataView.calendarPlugin;

                if (calendar) {
                    calendar.clear();
                    calendar.activeCalendar.colorMap.clearFilter();

                    //if (viewStyle != 'calendar') {
                    //    // clear filter
                    //    calendar.gridFilter = dataView.get_filter();
                    //    dataView.removeFromFilter(calendar.activeCalendar.date);
                    //}
                    //else {
                    //    // restore filter
                    //    if (calendar.gridFilter)
                    //        dataView.set_filter(calendar.gridFilter);
                    //}
                }

                if (plugin) {
                    var viewType = dataView && dataView.get_viewType(dataView._id),
                        master = dataView.get_master();

                    // skip child view refresh
                    if (master && !dataView.get_selectedKey().length)
                        return;

                    if (viewType && viewType == 'Grid') {
                        if (!plugin.filtering) {
                            plugin.clearCache();
                            _touch.stickyHeaderBar().hide();
                        }
                    }
                }
            })

            // show or hide the calendar plugin depending on active dataView
            .on('pageready.app', function (event) {
                //if (event.dataView)
                refreshCalendar(event.dataView);
            })

            .on('sidebarstatechanged.app', function () {
                var dataView = _touch.contextDataView();
                if (dataView) {
                    if ($('#' + dataView._id).is('.app-reading-pane-detail'))
                        dataView = _app.find(dataView._parentDataViewId);
                    refreshCalendar(dataView);
                }
            });

        function refreshCalendar(dataView) {
            var viewType = dataView && dataView.get_viewType(dataView._id),
                sidebar = _touch.sidebar();

            if (!dataView || (viewType != 'Grid' && !$('.app-reading-pane-detail:not(.app-hidden)').length)) {
                detachPlugin(sidebar);
                return;
            }

            if (!supportsCalendar(dataView))
                return;

            else if (viewType && viewType == 'Grid') {
                if (dataView.calendar)
                    dataView.calendar.loadData(dataView.calendar.getVisibleView());
                if (dataView.calendarPlugin) {
                    if (__settings.bars.left.mini || _touch.pageInfo(dataView).page.is('.app-page-modal'))
                        detachPlugin(sidebar);
                    else
                        dataView.calendarPlugin.attach(sidebar);
                }
            }
        }


        /* Dragging: app-calendar */
        var calendarDragManager = {
            options: {
                dataView: true
            },
            start: function (drag) {
                drag.dir = 'horizontal';
                var calendar = drag.dataView.calendar,
                    handler = calendar.getViewHandler();

                this._calendar = calendar;
                this._handler = handler;
                if (handler._scroll) {

                    var view = calendar.getVisibleView(),
                        presenter = view.closest('.app-presenter'),
                        header = presenter.data('cal-header').find('.app-' + calendar.mode + '-header');
                    //footer = presenter.data('cal-footer');

                    this._calView = view;
                    this._calHeader = header;
                    //this._calFooter = footer.css('visibility', 'hidden');
                    this._startMarginLeft = parseInt(view.css('margin-left'), 10);
                }

                this._startX = drag.x;
                this.scrollingAnimationFrame = null;

            },
            move: function (drag) {
                var that = this;
                if (that._startMarginLeft != null) {
                    var target = drag.target,
                        diffX = drag.x - that._startX,
                        newMarginLeft = that._startMarginLeft + diffX;

                    that.scrollingAnimationCallback = function () {
                        //skipClick = true;
                        that._handler._scroll(that._calView, that._calHeader, -newMarginLeft, null/*that._calFooter*/);

                        if (that.scrollingAnimationCallback != null)
                            that.scrollingAnimationFrame = requestAnimationFrame(that.scrollingAnimationCallback);
                    };

                    if (that.scrollingAnimationFrame == null)
                        that.scrollingAnimationFrame = requestAnimationFrame(that.scrollingAnimationCallback);

                }
            },
            end: function (drag) {
                this.scrollingAnimationCallback = null;
                //if (this._calFooter)
                //    this._calFooter.css('visibility', '');
            },
            taphold: function (drag) {
                var target = $(document.elementFromPoint(drag.x, drag.y));
                target.trigger('contextmenu');
            },
            cancel: function (drag) {
                this.scrollingAnimationCallback = null;
                //if (this._calFooter)
                //    this._calFooter.css('visibility', '');
            }
        };

        _app.dragMan['calendar'] = calendarDragManager;
        _app.dragMan['calendar-bar-week'] = calendarDragManager;
        _app.dragMan['calendar-bar-day'] = calendarDragManager;

        var eventDragManager = {
            options: {
                dataView: true
            },
            start: function (drag) {
                drag.dir = 'all';
                var dataView = drag.dataView,
                    target = drag.target,
                    calendar = dataView.calendar,
                    scrollable = calendar.scrollable(),
                    appEvent = target.closest('.app-event'),
                    isDragHandle = target.is('.app-event-handle'),
                    context = appEvent.data('data-context'),
                    appEventPos = appEvent.position();

                if (context) {
                    this._element = appEvent;
                    this._oldHeight = appEvent.height(true);
                    this._oldTop = appEventPos.top;
                    this._context = context;
                    this._startX = drag.x;
                    this._startY = drag.y;
                    this._mode = 'move';
                    this._hasMoved = false;
                    this._hasScrolled = false;

                    // enable preview event element;
                    if (calendar.mode.match(/day|week/)) {
                        var instruction = scrollable.find('.app-presenter-instruction');

                        this._diffY = instruction.height() - appEventPos.top;

                        if (isDragHandle) {
                            this._mode = 'resize';
                            this._diffY -= target.position().top;
                            //skipClick = true;
                        }
                    }
                    else { // month
                        this._placeholder = $span('', 'style="display:none"').insertAfter(appEvent);
                    }
                }
                _touch.stickyHeaderBar().hide().addClass('app-disabled');
            },
            move: function (drag) {
                //$body.css('pointer-events', '');
                var that = this,
                    dataView = drag.dataView,
                    calendar = dataView && dataView.calendar,
                    target = drag.target,
                    dropTarget = $(drag.dropTarget),
                    startDate = this._context[1],
                    scrollable = calendar.scrollable(),
                    preview = this._element;

                if (!this._hasMoved) {
                    this._hasMoved = true;
                    this._element.addClass('app-event-preview');
                }
                switch (calendar.mode) {
                    case 'day':
                    case 'week':
                        dropTarget = dropTarget.closest('.app-calendar-day,.current-time-line');
                        if (dropTarget.length) {
                            canDrag = true;

                            var date = dropTarget.is('.current-time-line') ? dropTarget.data('date') : getDateOfBlock(dropTarget),
                                pageY = drag.y - this._startY - this._diffY,
                                hourHeight = dayAndWeekHeight / 25,
                                hourPos = pageY / hourHeight,
                                scrollablePos = scrollable.offset();
                            // page when reaching left/right
                            if (!dragScrollHorizTimeout) {
                                var distLeft = drag.x - scrollablePos.left - 60,
                                    distRight = scrollable.width() - distLeft - 60,
                                    doLoad = distLeft < 30 || distRight < 30;

                                if (distLeft < 30)
                                    calendar.scrollView('prev');
                                else if (distRight < 30)
                                    calendar.scrollView('next');

                                if (doLoad) {
                                    this._hasScrolled = true;
                                    dragScrollHorizTimeout = setTimeout(function () {
                                        dragScrollHorizTimeout = null;
                                    }, 1000);
                                }
                            }

                            // scroll when reaching top/bottom
                            if (!dragScrollVertTimeout)
                                dragScrollVertTimeout = setTimeout(function () {
                                    dragScrollVertTimeout = null;
                                    var scrollTop = scrollable.scrollTop(),
                                        distFromTop = drag.y - scrollablePos.top,
                                        distFromBottom = scrollable.height() - distFromTop,
                                        diff;
                                    // scroll up/down
                                    if (distFromTop < 20) {
                                        diff = (20 - distFromTop);
                                        if (scrollTop < diff)
                                            return;
                                        that._diffY += diff;
                                        _touch.scroll(scrollable, scrollable.scrollTop() - diff);
                                    }
                                    else if (distFromBottom < 20) {
                                        diff = (20 + distFromBottom);
                                        if (scrollTop >= scrollable[0].scrollHeight - scrollable.height() - diff)
                                            return;
                                        that._diffY -= diff;
                                        _touch.scroll(scrollable, scrollable.scrollTop() + diff);
                                    }
                                }, 20);

                            // calculate time and position preview
                            if (hourPos > 23.75)
                                hourPos = 23.75;
                            else if (hourPos < 0)
                                hourPos = 0;
                            var hour = Math.floor(hourPos),
                                frac = hourPos - hour;
                            if (hour != null) {
                                setDateFraction(date, hour, frac);

                                if (!this._previewDate || date.getTime() != this._previewDate.getTime()) {
                                    var drawTimeMode = calendar.mode == 'week' ? 'week' : 'find',
                                        top = drawTime(date, drawTimeMode) + 22,
                                        view = calendar.getVisibleView(scrollable),
                                        dayColumn = calendar.getBlockByDate(view, date);

                                    if (dayColumn.length) {
                                        // calculate date
                                        var start = this._context[1],
                                            end = this._context[2],
                                            minEnd = new Date(start),
                                            timeText,
                                            longTimeText;
                                        minEnd.setMinutes(minEnd.getMinutes() + 30);
                                        // dragging the handle
                                        if (this._mode == 'resize') {
                                            date.setFullYear(start.getFullYear(), start.getMonth(), start.getDate());
                                            if (date < minEnd)
                                                date = minEnd;
                                            timeText = getClockTime(start, false) + ' - ' + getClockTime(date, false);
                                            longTimeText = getClockTime(start, false) + ' - ' + getClockTime(date, false);

                                            preview.css('height', getEventHeight(start.getTime(), date.getTime()));
                                        }
                                        // dragging the event
                                        else {
                                            timeText = getClockTime(date, false, true);
                                            longTimeText = getClockTime(date);

                                            if (end) {
                                                var difference = end.getTime() - start.getTime(),
                                                    newEnd = new Date(date.getTime() + difference);
                                                timeText += ' - ' + getClockTime(newEnd, false);
                                                longTimeText += ' - ' + getClockTime(newEnd, false);
                                            }

                                            preview.css('top', top);
                                            preview.appendTo(dayColumn.find('.app-calendar-eventlist'));
                                        }

                                        preview.find('.app-event-time').text(timeText);
                                        preview.find('.app-event-time-long').text(longTimeText);
                                        this._previewDate = date;
                                    }
                                }

                            }
                        }
                        break;
                    case 'month':
                        var dayCell = dropTarget.closest('td'),
                            month = dayCell.closest('.app-calendar-month'),
                            newDate = getDateOfBlock(month),
                            day = dayCell.attr('data-cal-day');

                        if (day) {
                            newDate.setDate(day);
                            var newDayList = dayCell.find('ul');
                            if (newDayList.length && (!this._previewDate || newDate.getTime() != this._previewDate.getTime())) {
                                this._previewDate = newDate;
                                preview.appendTo(newDayList);
                            }
                        }

                        // scroll up/down
                        var distFromTop = drag.y - scrollable.position().top,
                            distFromBottom = scrollable.height() - distFromTop;
                        if (!dragScrollTimeout)
                            dragScrollTimeout = setTimeout(function () {
                                dragScrollTimeout = null;
                                var scrollTop = scrollable.scrollTop();
                                if (_touch.desktop()) {
                                    if (distFromTop < 20)
                                        _touch.scroll(scrollable, scrollable.scrollTop() - (20 - distFromTop));
                                    else if (distFromBottom < 20)
                                        _touch.scroll(scrollable, scrollable.scrollTop() + (20 + distFromBottom));
                                }
                            }, 20);
                        break;
                    case 'year':
                    case 'agenda':
                        return;
                }
            },
            end: function (drag) {
                var target = drag.target,
                    dataView = drag.dataView,
                    calendar = dataView && dataView.calendar,
                    scrollable = calendar.scrollable();

                if (!dataView._keyFields.length)
                    return;

                var config = calendar && calendar.activeCalendar,
                    context = this._context,
                    oldStart = context[1],
                    newStart,
                    oldEnd = context[2],
                    newEnd,
                    dropTarget = $(drag.dropTarget);

                switch (calendar.mode) {
                    case 'day':
                    case 'week':
                        dropTarget = dropTarget.closest('.app-calendar-day,.current-time-line');

                        if (dropTarget.length) {
                            newStart = dropTarget.is('.current-time-line') ? dropTarget.data('date') : getDateOfBlock(dropTarget);
                            var pageY = drag.y - this._startY - this._diffY,
                                hourHeight = dayAndWeekHeight / 25,
                                hourPos = pageY / hourHeight;
                            if (hourPos > 23.75)
                                hourPos = 23.75;
                            else if (hourPos < 0)
                                hourPos = 0;
                            var hour = Math.floor(hourPos),
                                frac = hourPos - hour;

                            setDateFraction(newStart, hour, frac);

                            if (this._mode == 'resize') {
                                newStart.setFullYear(oldStart.getFullYear(), oldStart.getMonth(), oldStart.getDate());
                                newEnd = newStart;
                                newStart = oldStart;

                                var minEnd = new Date(oldStart);
                                minEnd.setMinutes(minEnd.getMinutes() + 30);
                                if (newEnd < minEnd)
                                    newEnd = minEnd;
                            }
                        }
                        break;
                    case 'month':
                        var dayCell = $(event.target).closest('td'),
                            month = dayCell.closest('.app-calendar-month');

                        if (month.length) {
                            newStart = new Date(oldStart);
                            newStart.setYear(month.attr('data-cal-year'));
                            newStart.setMonth(month.attr('data-cal-month'));
                            newStart.setDate(dayCell.attr('data-cal-day'));
                            if (newStart.getDate() == oldStart.getDate() && newStart.getMonth() == oldStart.getMonth())
                                newStart = null;
                        }
                        this._placeholder.remove();
                        break;
                    case 'year':
                    case 'agenda':
                        return;
                }

                if (newStart) {

                    var keyField = dataView._keyFields[0].Name,
                        values = [
                            { field: keyField, value: context[0] },
                            { field: config.date.Name, oldValue: oldStart, newValue: newStart }
                        ];

                    // shift end time by old/new start difference
                    if (oldEnd || newEnd) {
                        if (!newEnd) {
                            var difference = oldEnd.getTime() - oldStart.getTime();
                            newEnd = new Date(newStart.getTime() + difference);
                        }
                        values.push({
                            field: config.end.Name, oldValue: oldEnd, newValue: newEnd
                        });
                    }

                    // stop event
                    calendar.preventNavigate = true;

                    // execute
                    _app.execute({
                        command: 'Update',
                        controller: dataView._controller,
                        view: dataView._viewId,
                        values: values,
                        success: function (args) {
                            if (args.errors.length > 0)
                                _app.alert(args.errors[0]);
                            calendar.lastScrollTop = scrollable.scrollTop();
                            var detailPane = $('.app-reading-pane-detail:not(.app-hidden)'),
                                dataViewId = detailPane.attr('id'),
                                inputValues = [], detailData,
                                detailDataView,
                                fv, field, i;
                            if (detailPane.length && target.closest('.app-reading-pane-master').length) {
                                detailDataView = findDataView(dataViewId);
                                detailData = detailDataView.data();
                                // make sure that the detail pane record is matched to the event and update the fields if that is the case
                                if (detailData[values[0].field] === values[0].value) {
                                    for (i = 1; i < values.length; i++)
                                        inputValues.push({ name: values[i].field, value: values[i].newValue });
                                    _app.input.execute({
                                        dataView: detailDataView,
                                        container: detailPane.find('[data-input-container="' + dataViewId + '"]'),
                                        values: inputValues
                                    });
                                    if (detailDataView.editing())
                                        for (i = 1; i < values.length; i++) {
                                            fv = values[i];
                                            field = detailDataView.findField(fv.field);
                                            if (field)
                                                detailDataView._unchangedRow[field.Index] = fv.newValue;
                                        }
                                }
                            }
                            dataView.sync();
                        },
                        error: function (error) {
                            _app.alert(String.format('{0}', error.get_message()));
                        }
                    });
                }
                $('.app-calendar').removeClass('app-has-time-prompt');
                setTimeout(drawTime, timeoutSpeed * 2);
            },
            cancel: function (drag) {
                var target = drag.target,
                    elem = this._element,
                    calendar = drag.dataView.calendar;

                if (this._hasMoved)
                    elem.removeClass('app-event-preview');

                if (calendar.mode != 'month' && Math.abs(drag.x - this._startX) < 5)
                    //target.trigger('vclick');
                    return;



                if (calendar.mode.match(/day|week/)) {
                    var origColumn = calendar.getBlockByDate(calendar.getVisibleView(), this._context[1]);
                    if (origColumn.length)
                        elem.appendTo(origColumn.find('ul'));
                    else
                        elem.remove();
                }
                else { // month
                    if (this._hasMoved)
                        elem.insertAfter(this._placeholder);
                    this._placeholder.remove();
                }

                $('.app-calendar').removeClass('app-has-time-prompt');
                setTimeout(drawTime, timeoutSpeed * 2);
                var oldHeight = this._oldHeight;// - parseFloat(elem.css('padding-top')) - parseFloat(elem.css('padding-bottom'));

                elem.css({ height: oldHeight, top: this._oldTop });
                _touch.stickyHeaderBar().removeClass('app-disabled');
                calendar.preventNavigate = true;
            },
            taphold: function (drag) {
                var target = $(document.elementFromPoint(drag.x, drag.y));
                target.trigger('contextmenu');
            }
        };

        _app.dragMan['calendar-event'] = eventDragManager;
        _app.dragMan['calendar-event-handle'] = eventDragManager;

        var Calendar = function (dataView, calendars) {
            var that = this,
                config = dataView.viewProp('calendarConfig') || {};
            that.dataView = dataView;

            if (!config.mode) {
                if (dataView.tagged('calendar-day'))
                    config.mode = 'day';
                else if (dataView.tagged('calendar-week'))
                    config.mode = 'week';
                else if (dataView.tagged('calendar-month'))
                    config.mode = 'month';
                else if (dataView.tagged('calendar-year'))
                    config.mode = 'year';
                else if (dataView.tagged('calendar-agenda'))
                    config.mode = 'agenda';
                else
                    config.mode = $(document).width() < 768 ? 'day' : 'week';
            }
            that.mode = config.mode;
            that.calendars = calendars;
            if (config.activeCalendar)
                $(calendars).each(function () {
                    if (this.name == config.activeCalendar) {
                        that.activeCalendar = this;
                        return false;
                    }
                });
            if (!that.activeCalendar)
                that.activeCalendar = calendars[Object.keys(calendars)[0]];
            that.cache = new Cache(that);
            that.views = {
                day: new Day(that),
                week: new Week(that),
                month: new Month(that),
                year: new Year(that),
                agenda: new Agenda(that)
            };
            //if (!dataView.viewProp('calendarConfig'))
            dataView.viewProp('calendarConfig', config);
        };

        Calendar.prototype = {
            scrollable: function () {
                var that = this,
                    scrollable = that._scrollable;
                if (!scrollable)
                    scrollable = that._scrollable = $('#' + this.dataView._id + ' .app-wrapper');
                return scrollable;
            },
            viewClassName: function () {
                return String.format('.app-calendar-{0}view', this.mode);
            },
            getSupportedViews: function (dataView) {
                var views = [];
                if (!dataView.tagged('calendar-day-disabled'))
                    views.push({ value: 'day', text: resourcesCalendar.Day });
                if (!dataView.tagged('calendar-week-disabled'))
                    views.push({ value: 'week', text: resourcesCalendar.Week });
                if (!dataView.tagged('calendar-month-disabled'))
                    views.push({ value: 'month', text: resourcesCalendar.Month });
                if (!dataView.tagged('calendar-year-disabled'))
                    views.push({ value: 'year', text: resourcesCalendar.Year });
                if (!dataView.tagged('calendar-agenda-disabled'))
                    views.push({ value: 'agenda', text: resourcesCalendar.Agenda });
                return views;
            },
            show: function (options) {
                var that = this,
                    dataView = this.dataView,
                    presenterContainer = options.container,
                    isEcho = presenterContainer.closest('.app-echo').length > 0,
                    calendar = presenterContainer.find('.app-calendar'),
                    scrollable = presenterContainer.closest('.app-wrapper'),
                    calendars = this.calendars,
                    config = dataView.viewProp('calendarConfig'),
                    colorMap = this.activeCalendar.colorMap,
                    header,
                    navigateBlock;

                if ($.isEmptyObject(calendars))
                    return;

                if (!isEcho && this.lastScrollTop && scrollable.scrollTop() == 0)
                    _touch.scroll(scrollable, this.lastScrollTop);

                if (isEcho) {
                    this.mode = config.mode = 'agenda';
                    this.echoMaxHeight = options.maxHeight;
                    dataView.viewProp('calendarConfig', config);
                }
                else if (config.mode)
                    this.mode = config.mode;
                var viewHandler = this.getViewHandler();

                // get selected record date
                if (!this.navigateDate && !this.preventNavigate) {
                    var row = dataView.extension().commandRow();
                    if (row && this.activeCalendar.date) {
                        this.enhancePrecision = true;
                        this.navigateDate = row[this.activeCalendar.date.Index];
                    }

                    if (!this.navigateDate)
                        this.navigateDate = new Date();
                }


                if (calendar.length > 0) {
                    // calendar exists, show it
                    var view = presenterContainer.find('.app-calendar > div:visible');
                    if (!isEcho) {
                        header = presenterContainer.data('cal-header');
                        //footer = presenterContainer.data('cal-footer');

                        viewHandler.showHeaderAndFooter(header, null);
                        //_touch.tabs('fit', { container: header });
                        _touch.bar('show', header);

                        colorMap.show();

                        if (view.is(that.viewClassName())) {
                            if (this.navigateDate && !this.preventNavigate) {
                                navigateBlock = this.getBlockByDate(view, this.navigateDate);
                                // if found, scroll to
                                if (navigateBlock && navigateBlock.length && !isEcho) {
                                    this.scroll({
                                        view: view, enhancePrecision: true
                                    });
                                    return;
                                }
                                this.animate = false;
                            }
                        }
                        else
                            view.hide();
                    }


                }
                else {

                    // first time setup 
                    calendar = $div('app-calendar', 'data-draggable="calendar"').appendTo(presenterContainer);

                    if (!isEcho) {
                        // create a tab bar in the fixed header
                        header = $div('app-bar-calendar').appendTo(_touch.bar('create', { type: 'header', page: presenterContainer }));

                        // create tabs in the tab bar
                        var calendarControls = $div('app-calendar-controls').appendTo(header),
                            tabs = $div('app-tabs').appendTo(calendarControls);
                        // create "current year/year+month" indicator in the tab bar
                        $div('app-calendar-badge ui-btn').appendTo(calendarControls);


                        _touch.tabs('create', {
                            container: tabs,
                            tabs: that.getSupportedViews(dataView).map(function (v) {
                                return {
                                    text: v.text,
                                    value: v.value,
                                    active: v.value == that.mode
                                };
                            }),
                            change: function (tab) {
                                var oldMode = that.mode,
                                    mostVisibleBlock = that.getMostVisibleBlock(scrollable, oldMode),
                                    mostVisibleDate = mostVisibleBlock && getDateOfBlock(mostVisibleBlock),
                                    useOldDate = false,
                                    config = dataView.viewProp('calendarConfig'),
                                    plugin = dataView.calendarPlugin;
                                config.mode = tab.value;
                                dataView.viewProp('calendarConfig', config);
                                // preserve month/day
                                if (!that.navigateDate) {
                                    if (that.lastDate)
                                        switch (oldMode) {
                                            case 'year':
                                                if (that.lastDate.getFullYear() == mostVisibleDate.getFullYear())
                                                    useOldDate = true;
                                                break;
                                            case 'month':
                                                if (that.lastDate.getFullYear() == mostVisibleDate.getFullYear() && that.lastDate.getMonth() == mostVisibleDate.getMonth())
                                                    useOldDate = true;
                                                break;
                                        }
                                    that.navigateDate = useOldDate ? that.lastDate : mostVisibleDate;
                                    that.enhancePrecision = true;
                                }
                                if (oldMode.match(/week|day/))
                                    that.lastDayScrollTop = scrollable.scrollTop();
                                options.container = options.container.closest('.app-wrapper');
                                if (!isEcho)
                                    scrollable.focus().find('.app-stub').addClass('app-hidden');

                                if (that.navigateDate && isNaN(that.navigateDate.getTime())) {
                                    alert('navigate date is NaN');
                                    that.navigateDate = new Date();
                                }
                                _touch.presenter('show', options);
                                that.updateHeader(header);
                                CalendarControl('refresh', {
                                    container: _touch.sidebar().find('.app-calendar-plugin')
                                });
                                setTimeout(function () {
                                    _touch.fetchOnDemand();
                                    fetchCalendarData(scrollable);
                                }, 200);
                            },
                            restoreScrolling: false,
                            stickyHeader: true
                        });
                        // save calendar header for future reference
                        presenterContainer.data('cal-header', header);
                        //setTimeout(function () {

                        //    if (header.width() < 768)
                        //        tabs.css('visibility', 'hidden');
                        //});

                        // create Previous and Next buttons
                        $a('ui-btn ui-btn-icon-notext ui-icon-carat-l ui-corner-all app-calendar-prev').attr('title', resourcesPager.Previous).appendTo(calendarControls);
                        $a('ui-btn ui-btn-icon-notext ui-icon-carat-r ui-corner-all app-calendar-next').attr('title', resourcesPager.Next).appendTo(calendarControls);
                        // create "Today" button
                        $a('ui-btn ui-btn-icon-notext ui-icon-calendar ui-corner-all app-calendar-today').attr('title', resourcesCalendar.Today).appendTo(calendarControls);

                        startDrawTime();
                    }
                }


                if (this.activeCalendar.end)
                    calendar.addClass('app-calendar-has-end-time');
                else
                    calendar.removeClass('app-calendar-has-end-time');

                var viewClass = String.format('app-calendar-{0}view', this.mode),
                    headerClass = String.format('.app-{0}-header', this.mode),
                    view = calendar.find('.' + viewClass),
                    viewHeader = isEcho ? null : header.find(headerClass);

                if (this.navigateDate && !this.preventNavigate)
                    navigateBlock = this.getBlockByDate(view, this.navigateDate);

                if (view.length > 0 && (this.preventNavigate || (this.navigateDate && navigateBlock && navigateBlock.length))) {
                    ///
                    // Show View
                    ///
                    if (!view.is(':visible'))
                        view.fadeIn('fast');
                    viewHandler.resize(view, viewHeader, null);
                }
                else {
                    ///
                    // Draw View
                    ///
                    view = viewHandler.draw(calendar, this.navigateDate);
                }

                if (!isEcho) {
                    // refresh the bar that owns the header for the calendar
                    _touch.bar('show', header);
                    that.updateHeader(header);
                }
                this.resetVars();
            },
            scroll: function (options) {
                if (!options.view)
                    options.view = this.getVisibleView();
                if (options.preventNavigate == null)
                    options.preventNavigate = this.preventNavigate;
                if (options.enhancePrecision == null)
                    options.enhancePrecision = this.enhancePrecision;
                if (options.animate == null)
                    options.animate = this.animate;
                if (options.date == null)
                    options.date = this.navigateDate;
                this.getViewHandler().scroll(options);
                this.resetVars();
            },
            hide: function (options) {
                var dataView = activeDataView(),
                    viewStyle = dataView && dataView.extension().viewStyle(),
                    scrollable = this.scrollable();

                if (scrollable)
                    this.lastScrollTop = scrollable.scrollTop();

                // skip hide/show sequence
                if (viewStyle == "calendar")
                    return;

                var header = options.container.data('cal-header'),
                    //footer = options.container.data('cal-footer'),
                    sidebar = _touch.sidebar();
                if (header)
                    _touch.bar('hide', header);
                //if (footer)
                //    $app.touch.bar('hide', footer);
                CalendarControl('refresh', {
                    container: sidebar.find('.app-calendar-plugin')
                });
                this.activeCalendar.colorMap.hide();
            },
            dispose: function (options) {
                // dispose header
                var header = options.container.data('cal-header'),
                    dataView = this.dataView;
                if (header) {
                    header.off();
                    _touch.tabs('destroy', {
                        container: header
                    });
                    _touch.bar('remove', header);
                }
                // dispose footer
                //var footer = options.container.data('cal-footer');
                //if (footer) {
                //    footer.off();
                //    $app.touch.bar('remove', footer);
                //}
                // clear data references
                options.container.removeData();
                // stop timeouts
                clearInterval(drawTimeInterval);
                // clear cache
                this.cache.clear(options.container);
                dataView.calendar.activeCalendar.colorMap.clearFilter();

                // delete references
                for (var view in this.views)
                    this.views[view].calendar = null;
                dataView.calendar = null;
                dataView.calendarPlugin.calendar = null;
                dataView.calendarPlugin.dataView = null;
                dataView.calendarPlugin = null;
                this.dataView = null;
                this._scrollable = null;
            },
            selectEvent: function (context, target, event) {
                var eventType = event.type,
                    ctrlKey = event.ctrlKey,
                    lastTouch = _touch.lastTouch(),
                    scrollable = this.scrollable(),
                    calendar = this,
                    dataView = calendar.dataView,
                    isLookup = dataView._lookupInfo,
                    isEcho = target.closest('.app-echo').length;

                if (!this.hasKeyFields())
                    return;

                var keyField = this.dataView._keyFields[0],
                    key = this.getCurrentKey(),
                    contextKey = this.mode !== 'agenda' && !isEcho ? context[0] : context[keyField.Index],
                    echo = $('#' + dataView._id + '_echo');


                function handleClick(selected) {
                    var //isClicked = target.is('.app-calendar-selected'),
                        pageInfo = _touch.pageInfo(dataView._id);
                    if (!isEcho)
                        pageInfo.echoChanged = true;
                    if (eventType == 'vclick' && ctrlKey) {
                        // handle taphold
                        if (selected) {
                            target.removeClass('app-calendar-selected');
                            dataView.extension().clearSelection();
                        }
                        _touch.refreshEchoToolbarWithDelay(dataView, echo);
                    }
                    else if (eventType == 'contextmenu') {
                        // show context menu
                        _touch.contextScope(dataView._id);
                        _touch.rowContext(target, {
                            x: lastTouch.x, y: lastTouch.y, arrow: false
                        });
                        _touch.contextScope(null);
                        _touch.refreshEchoToolbarWithDelay(dataView, echo);
                    }
                    else {
                        _touch.contextScope(dataView._id);
                        _touch.executeInContext();
                        //var context = [],
                        //    selectAction;
                        //$app.mobile.navContext(context, false);
                        //$(context).each(function () {
                        //    var action = this;
                        //    if (action.callback && !action.system) {
                        //        selectAction = action;
                        //        return false;
                        //    }
                        //});
                        //if (selectAction)
                        //    selectAction.callback(selectAction.context);
                        //else
                        //    touch.cardPopup({
                        //        anchor: target,
                        //        x: x,
                        //        y: y,
                        //        dataView: dataView
                        //    });
                        _touch.contextScope(null);
                    }
                }

                function selectRow(row) {
                    dataView.extension().tap({
                        row: row
                    }, isLookup ? 'select' : 'none');
                    // deselect
                    scrollable.find('.app-calendar-selected').removeClass('app-calendar-selected');
                    echo.find('.app-calendar-selected').removeClass('app-calendar-selected');

                    function findSelectEvent(event) {
                        var context = event.data('data-context');
                        if (context && context[keyField.Index] == contextKey) {
                            event.addClass('app-calendar-selected');
                            return false;
                        }
                    }

                    // select in view
                    if (isEcho)
                        scrollable.find(calendar.viewClassName() + ' .app-event').each(function () {
                            findSelectEvent($(this));
                        });

                    else
                        target.closest('.app-event, .app-calendar-month-more').addClass('app-calendar-selected');

                    // select in echo
                    if (echo.length)
                        echo.find('.app-event').each(function () {
                            findSelectEvent($(this));
                        });

                    if (!isLookup) {
                        //dataView.raiseSelected();
                        //touch.pageInfo(dataView._id).echoChanged = true;
                        handleClick(false);
                        _touch.refreshEchoToolbarWithDelay(dataView, echo);
                    }
                }

                if (dataView._keyFields.length == 1) {
                    //if (draggedCalendarEvent) return;
                    _touch.clearHtmlSelection();
                    if (key != null && contextKey == key)
                        handleClick(true);
                    else {
                        if (calendar.mode == "agenda") {
                            selectRow(context);
                        }
                        else
                            _app.execute({
                                controller: dataView._controller,
                                view: dataView._viewId,
                                filter: [{ field: keyField.Name, operator: '=', value: context[0] }],
                                includeRawResponse: true,
                                sort: '',
                                success: function (result) {
                                    //if (draggedCalendarEvent) return;
                                    selectRow(result.rawResponse.Rows[0]);
                                },
                                error: function (error) {
                                    _app.alert(String.format('{0}', error.get_message()));
                                }
                            });
                    }
                    target.addClass('ui-btn-active');
                    _touch.callWithFeedback(target, function () {
                        target.removeClass('ui-btn-active');
                    });
                }
            },
            showEventList: function (startDate, data, target, event) {
                var calendar = this,
                    key = calendar.getCurrentKey(),
                    items = [];
                // foreach row, add list item
                data.forEach(function (row) {
                    var id = row[0],
                        start = row[1],
                        end = row[2],
                        text = row[4];
                    items.push({
                        text: calendar.getEventTitle(start, end, text, ''),
                        color: calendar.activeCalendar.colorMap.color(row[3]),
                        visible: id == key ? true : false,
                        callback: function () {
                            calendar.selectEvent(row, target, event);
                        }
                    });
                });

                // show list popup
                _touch.listPopup({
                    title: String.localeFormat('{0:' + dtf.LongDatePattern + '}', startDate),
                    anchor: target,
                    iconPos: 'left',
                    items: items
                });
            },
            getViews: function () {
                return $('#' + this.dataView._id).find('.app-wrapper .app-presenter[data-presenter="calendar"] > div.app-calendar > div');
            },
            getVisibleView: function () {
                return this.scrollable().find('.app-presenter[data-presenter="calendar"] > div.app-calendar > div.app-calendar-' + this.mode + 'view');
                //return this.scrollable().find('.app-presenter[data-presenter="calendar"] > div.app-calendar > div:visible');
            },
            getViewHandler: function () {
                return this.views[this.mode];
            },
            // reset this variables
            resetVars: function () {
                this.preventNavigate = null;
                this.lastDate = this.navigateDate;
                this.navigateDate = null;
                this.enhancePrecision = null;
                this.animate = null;
            },
            clear: function (emptyView) {
                var visibleView = this.getVisibleView();

                // clear data
                this.cache.clear();

                for (var mode in this.views)
                    this.views[mode].clear(mode == this.mode ? emptyView : false);

                // reload data
                if (visibleView && visibleView.length) {
                    this.loadData(visibleView);
                    if (this.dataView.calendarPlugin)
                        this.dataView.calendarPlugin.clearCache();
                }
            },
            // draws a column for day and week views
            drawDayColumns: function (startDate, distance, showTime) {
                var grid = '',
                    testDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());

                for (var day = 0; day < distance; day++) {
                    var dayBlock = '<div'
                        + ' data-cal-year="' + testDate.getFullYear() + '"'
                        + ' data-cal-month="' + testDate.getMonth() + '"'
                        + ' data-cal-day="' + testDate.getDate() + '" class="app-calendar-day';

                    if (isToday(testDate))
                        dayBlock += ' current-day-column';
                    if (dtfDayOfWeek[testDate.getDay()] == 6)
                        dayBlock += ' endofweek';

                    dayBlock += '">';
                    var innerHTML = '';

                    if (showTime)
                        innerHTML += this.drawTimeColumn(startDate);

                    innerHTML += '<div data-cal-hour="0"></div><div data-cal-hour="0"></div>' +
                        '<div data-cal-hour="1"></div><div data-cal-hour="2"></div>' +
                        '<div data-cal-hour="3"></div><div data-cal-hour="4"></div>' +
                        '<div data-cal-hour="5"></div><div data-cal-hour="6"></div>' +
                        '<div data-cal-hour="7"></div><div data-cal-hour="8"></div>' +
                        '<div data-cal-hour="9"></div><div data-cal-hour="10"></div>' +
                        '<div data-cal-hour="11"></div><div data-cal-hour="12"></div>' +
                        '<div data-cal-hour="13"></div><div data-cal-hour="14"></div>' +
                        '<div data-cal-hour="15"></div><div data-cal-hour="16"></div>' +
                        '<div data-cal-hour="17"></div><div data-cal-hour="18"></div>' +
                        '<div data-cal-hour="19"></div><div data-cal-hour="20"></div>' +
                        '<div data-cal-hour="21"></div><div data-cal-hour="22"></div>' +
                        '<div data-cal-hour="23"></div><div data-cal-hour="0"></div>' +
                        '<ul class="app-calendar-eventlist"></ul><div class="app-clear-fix"></div>';

                    dayBlock += innerHTML + '</div>';

                    grid += dayBlock;

                    testDate.setDate(testDate.getDate() + 1);
                }
                return grid;
            },
            // draws a horizontally scrollable day headers for day and week
            drawDayHeaders: function (startDate, distance) {
                var dayHeaderList = '',
                    testDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
                for (var i = 0; i < distance; i++) {
                    var day = dtfDayOfWeek[testDate.getDay()],
                        dayName = dtf.DayNames[testDate.getDay()],
                        abbrDayName = dtf.AbbreviatedDayNames[testDate.getDay()];

                    dayHeaderList += '<li '
                        + ' data-cal-year="' + testDate.getFullYear() + '"'
                        + ' data-cal-month="' + testDate.getMonth() + '"'
                        + ' data-cal-day="' + testDate.getDate() + '" class="';
                    if (day == 0)
                        dayHeaderList += ' first-day-of-week';
                    if (day == 6)
                        dayHeaderList += ' last-day-of-week';
                    dayHeaderList += '"><a class="ui-btn" title="' + dayName + '"><span class="letter-day">' + abbrDayName.substring(0, 1)
                        + '</span><span class="abbr-day">' + abbrDayName
                        + '</span><span class="full-day">' + dayName + '</span>&nbsp;<div';

                    if (isToday(testDate))
                        dayHeaderList += ' class="app-current-day"';
                    dayHeaderList += '>' + testDate.getDate() + '</div></a></li>';

                    // increment day
                    testDate.setDate(testDate.getDate() + 1);
                }
                return dayHeaderList;
            },
            // draws a vertical colunn of time from 12am-12am
            drawTimeColumn: function (startDate) {
                var timeCol = '<div class="app-calendar-time"><ul>',
                    timeStr,
                    usesAMPM = !!dtf.AMDesignator.length;

                for (var hour = 0; hour <= 24; hour++) {
                    if (usesAMPM) {
                        if (hour == 12)
                            timeStr = resourcesCalendar.Noon;
                        else {
                            var hourStr = hour % 12,
                                designator = hour < 12 ? dtf.AMDesignator : dtf.PMDesignator;
                            if (hour == 0 || hour == 24) {
                                hourStr = 12;
                                designator = dtf.AMDesignator;
                            }
                            timeStr = String.format('{0} {1}', hourStr, designator);
                        }
                    }
                    else
                        timeStr = hour == 24 ? 0 : hour;
                    timeCol += '<li><span data-cal-hour="' + hour + '">' + timeStr + '</span></li>';
                }

                return timeCol += '</ul><div class="app-current-time"></div></div>';
            },
            // get columns or rows of current view
            getBlocks: function (scrollable) {
                return this.getViewHandler().getBlocks();
            },
            // gets the first FULLY visible column or row on screen
            getMostVisibleBlock: function (scrollable) {
                if (!scrollable)
                    scrollable = this.scrollable();
                var firstVisibleBlock,
                    threshold = scrollable.height() / 2,
                    blocks = $(this.getBlocks(scrollable));
                switch (this.mode) {
                    case "day":
                    case "week":
                        // find horizontal block
                        blocks.each(function () {
                            var block = $(this);
                            if (!firstVisibleBlock)
                                firstVisibleBlock = block;
                            if (block.position().left > block.width() / 2)
                                return false;
                            firstVisibleBlock = block;
                        });
                        if (this.mode == "week")
                            while (firstVisibleBlock && firstVisibleBlock.length && firstVisibleBlock.position().left + firstVisibleBlock.width() <= weekTimeWidth) {
                                var next = firstVisibleBlock.next();
                                firstVisibleBlock = next;
                            }
                        break;
                    case "year":
                    case "month":
                    case "agenda":
                        // find first visible vertical block
                        blocks.each(function () {
                            var block = $(this);
                            firstVisibleBlock = block;
                            if (block.offset().top + block.height() > threshold)
                                return false;
                        });
                        break;
                }
                return firstVisibleBlock;
            },
            // gets the first visible column or row on screen
            getFirstVisibleBlock: function (scrollable) {
                if (!scrollable)
                    scrollable = this.scrollable();
                var headerHeight = _touch.stickyHeaderBar().outerHeight() + scrollable.offset().top, // TODO
                    blocks = $(this.getBlocks(scrollable)),
                    firstVisibleBlock = blocks.eq(0),
                    blockWidth = firstVisibleBlock.width(),
                    view = this.getVisibleView(),
                    viewMargin = parseInt(view.css('marginLeft'), 10);
                switch (this.mode) {
                    case "day":
                    case "week":
                        // find horizontal block
                        var i = Math.floor(-viewMargin / blockWidth);
                        firstVisibleBlock = blocks.eq(i);

                        if (firstVisibleBlock && firstVisibleBlock.length && firstVisibleBlock.position().left < 0) {
                            var next = blocks.eq(i + 1);
                            if (next.length)
                                firstVisibleBlock = next;
                        }
                        break;
                    case "month":
                    case "year":
                    case "agenda":
                        // find first visible vertical block
                        blocks.each(function () {
                            var block = $(this);
                            if (block.offset().top > headerHeight)
                                return false;
                            firstVisibleBlock = block;
                        });
                        break;
                }
                return firstVisibleBlock;
            },
            // gets the last visible column or row on screen
            getLastVisibleBlock: function (scrollable) {
                var firstVisibleBlock,
                    viewHeight = scrollable.height() + scrollable.position().top,
                    viewWidth = scrollable.width(),
                    blocks = $(this.getBlocks(scrollable));
                switch (this.mode) {
                    case "day":
                    case "week":
                        // find horizontal block
                        blocks.each(function () {
                            var block = $(this);
                            if (!firstVisibleBlock)
                                firstVisibleBlock = block;
                            if (block.position().left >= viewWidth)
                                return false;
                            firstVisibleBlock = block;
                        });
                        break;
                    case "month":
                    case "year":
                    case "agenda":
                        // find first visible vertical block
                        blocks.each(function () {
                            var block = $(this);
                            if (!firstVisibleBlock)
                                firstVisibleBlock = block;
                            if (block.offset().top > viewHeight)
                                return false;
                            firstVisibleBlock = block;
                        });
                        break;
                }
                return firstVisibleBlock;
            },
            // finds an element by the date
            getBlockByDate: function (view, date) {
                var year = date.getFullYear(),
                    month = date.getMonth(),
                    day = date.getDate();

                if (!view || !view.length)
                    return null;

                switch (this.mode) {
                    case 'year':
                        return view.find(String.format('.app-calendar-year[data-cal-year="{0}"]', year));
                    case 'month':
                        return view.find(String.format('.app-calendar-month[data-cal-year="{0}"][data-cal-month="{1}"]', year, month));
                    case 'week':
                    case 'day':
                        return view.find(String.format('.app-calendar-day[data-cal-year="{0}"][data-cal-month="{1}"][data-cal-day="{2}"]', year, month, day));
                    case 'agenda':
                        return view.find(String.format('li[data-cal-year="{0}"][data-cal-month="{1}"][data-cal-day="{2}"] ul', year, month, day));
                }
            },
            // set width and scrollLeft of scroller
            // footer = app-scroll-inner
            resizeScroller: function (view, footer, width) {
                return;
                //outer.scrollLeft(scrollLeft).data('resizing', true);
                //var outer = footer.find('.app-scroll-outer'),
                //                    scrollLeft = parseInt(view.css('marginLeft'), 10) * -1;
                //if (width)
                //    outer.find('.app-scroll-inner').css('width', width);
            },
            // refreshes the header depending on most visible column or row
            updateHeader: function (header) {
                if (!header)
                    return;
                var that = this,
                    scrollable = that.scrollable(),
                    mode = that.mode,
                    appTabs = header.find('.app-tabs'),
                    today = header.find('.app-calendar-today'),
                    tabVisible,
                    topPlaceholder = that.getFirstVisibleBlock(scrollable),
                    todayRect, headerRect, tabMargin;
                if (!topPlaceholder)
                    return;

                headerRect = header[0].getBoundingClientRect();
                todayRect = today[0].getBoundingClientRect();
                tabMargin = headerRect.right - todayRect.left + 20;
                appTabs.css({
                    minWidth: 0,
                    marginLeft: tabMargin,
                    marginRight: 0,
                    width: headerRect.width - 2 * tabMargin
                });

                _touch.tabs('fit', { page: findActivePage(scrollable) });
                tabVisible = !appTabs.find('.app-tab-more').length;
                appTabs.css('visibility', tabVisible ? '' : 'hidden');
                //tabLeft = appTabs.find('ul')[0].getBoundingClientRect().left;

                var badge = header.find('.app-calendar-badge').toggleClass('app-has-droparrow', !tabVisible),
                    date = getDateOfBlock(topPlaceholder),
                    year = date.getFullYearText(),
                    month = date.getMonth(),
                    day = date.getDay(),
                    dayNum = date.getDate(),
                    monthName = dtf.MonthNames[month],
                    abbrMonthName = dtf.AbbreviatedMonthNames[month],
                    space = tabVisible ? tabMargin : todayRect.left - headerRect.left - 20,
                    index = 1,
                    badges = [];

                if (day.toString() != 'NaN') {
                    switch (mode) {
                        case 'year':
                            badges = ['<b>' + year + '</b>&nbsp;'];

                            // hide same date header
                            var topHeader = topPlaceholder.find('h1');

                            if (!topHeader.is('app-in-header')) {
                                scrollable.find('.app-calendar-yearview .app-calendar-year h1.app-in-header').removeClass('app-in-header');
                                topHeader.addClass('app-in-header');
                            }
                            break;
                        case 'month':
                            badges = [
                                String.format('<b>{0}</b> {1}', monthName, year),
                                String.format('<b>{0}</b> {1}', abbrMonthName, year),
                                String.format('<b>{0}</b>', monthName),
                                String.format('<b>{0}</b>', abbrMonthName)
                            ];

                            // hide same date header
                            var topHeader = topPlaceholder.find('h1.app-calendar-month-header');

                            if (!topHeader.is('app-in-header')) {
                                scrollable.find('.app-calendar-monthview .app-calendar-month h1.app-calendar-month-header.app-in-header').removeClass('app-in-header');
                                topHeader.addClass('app-in-header');
                            }
                            break;
                        case 'week':
                            var lastPlaceholder = that.getLastVisibleBlock(scrollable),
                                lastDate = lastPlaceholder ? getDateOfBlock(lastPlaceholder) : new Date(),
                                lastYear = lastDate.getFullYearText(),
                                lastMonth = lastDate.getMonth(),
                                lastDayNum = lastDate.getDate(),
                                sameMonth = month == lastMonth,
                                sameYear = year == lastYear,
                                lastMonthName = dtf.MonthNames[lastMonth],
                                lastAbbrMonthName = dtf.AbbreviatedMonthNames[lastMonth];
                            if (!lastPlaceholder)
                                return;

                            badges.push(
                                String.format('<b>{0} {1}</b>{2} - <b>{3}{4}</b>, {5}', monthName, dayNum, sameYear ? '' : ', ' + year, sameMonth ? '' : lastMonthName + ' ', lastDayNum, lastYear),
                                String.format('<b>{0} {1}</b>{2} - <b>{3}{4}</b>, {5}', abbrMonthName, dayNum, sameYear ? '' : ', ' + year, sameMonth ? '' : lastAbbrMonthName + ' ', lastDayNum, lastYear)
                            );

                            if (!sameYear)
                                badges.push(
                                    String.format('<b>{0} {1}</b>, {2} - <b>{3} {4}</b>', monthName, dayNum, year, lastMonthName, lastDayNum),
                                    String.format('<b>{0} {1}</b>, {2} - <b>{3} {4}</b>', abbrMonthName, dayNum, year, lastAbbrMonthName, lastDayNum),
                                    String.format('<b>{0} {1}</b>, {2}', monthName, dayNum, year),
                                    String.format('<b>{0} {1}</b>, {2}', abbrMonthName, dayNum, year)
                                );
                            else
                                badges.push(
                                    String.format('<b>{0} {1}</b> - {2}{3}', monthName, dayNum, sameMonth ? '' : lastMonthName + ' ', lastDayNum),
                                    String.format('<b>{0} {1}</b> - {2}{3}', abbrMonthName, dayNum, sameMonth ? '' : lastAbbrMonthName + ' ', lastDayNum),
                                    String.format('<b>{0} {1}</b>, {2}', monthName, dayNum, year),
                                    String.format('<b>{0} {1}</b>, {2}', abbrMonthName, dayNum, year)
                                );
                            break;
                        case 'agenda':
                        case 'day':
                            var dayName = dtf.DayNames[dayOfWeekDtf[day]],
                                dayNameReplaceRegex = new RegExp(dayName + '(.?) ', 'i'),
                                dayNameNum = String.format('{0:' + dtf.MonthDayPattern + '}', date),
                                dayNameBoldRegex = new RegExp(dayNameNum, 'i'),
                                longDate = String.localeFormat('{0:' + dtf.LongDatePattern + '}', date).replace(dayNameBoldRegex, '<b>' + dayNameNum + '</b>'),
                                longDateWithoutDayOfWeek = longDate.replace(dayNameReplaceRegex, '');

                            badges = [
                                longDate,
                                longDateWithoutDayOfWeek,
                                longDateWithoutDayOfWeek.replace(dtf.MonthGenitiveNames[date.getMonth()], dtf.AbbreviatedMonthGenitiveNames[date.getMonth()])];
                            if (date.getFullYear() == new Date().getFullYear())
                                badges.push('<b>' + dayNameNum + '</b>', String.format('<b> {0:' + dtf.MonthDayPattern.replace(/M+/, 'MMM') + '}</b>', date));
                            badges.push(date.toLocaleDateString());
                            break;
                    }

                    if (badges[0]) {
                        var title = badges[0].replace(/<\/?b>|&nbsp;/g, '');
                        badge.html(badges[0]).attr('title', title).attr('data-cal-value', title);
                    }

                    while (badge[0].clientWidth > space) {
                        var nextBadge = badges[index];
                        if (!nextBadge)
                            break;
                        badge.html(nextBadge);
                        index++;
                    }
                }

                if (tabVisible && badge[0].getBoundingClientRect().right > appTabs.find('ul').offset().left - 8) {
                    appTabs.css('visibility', 'hidden');
                    badge.addClass('app-has-droparrow');
                }
            },
            // scrolls day or week view in one screen increment (slideleft/right)
            scrollView: function (direction) {
                var scrollable = this.scrollable(),
                    dataView = this.dataView,
                    view = this.getVisibleView(),
                    date,
                    increment = (direction == 'next' ? 1 : -1);


                if (direction != 'today')
                    date = this.getViewHandler().getNextDate(view, increment);
                else
                    date = new Date();


                var target = this.getBlockByDate(view, date);
                if (!target.length) {

                    // reload view
                    this.navigateDate = date;
                    _touch.presenter('show', {
                        id: this.dataView._id, name: 'calendar', container: scrollable
                    });
                }
                else
                    // scroll to item
                    this.scroll({
                        date: date, animate: true, view: view
                    });
            },
            // trigger data loading for visible blocks in the view
            loadData: function (view) {
                var that = this,
                    viewStyle = that.dataView.extension().viewStyle();
                if (this.mode == 'agenda')
                    that.activeCalendar.colorMap.load(true);
                if (!view.is(':visible') || this.mode == "agenda" || viewStyle != 'calendar')
                    return;
                var scrollable = view.closest('.app-wrapper'),
                    block = that.getFirstVisibleBlock(scrollable),
                    endBlock = that.getLastVisibleBlock(scrollable);
                if (block.length && endBlock.length)
                    that.loadDataInBlock(view, block, endBlock);
            },
            // loads data in the block and continues for next visible block
            loadDataInBlock: function (view, block, endBlock) {
                var that = this,
                    nextBlock = block.next(':not(.current-time-line)'),
                    mode = that.mode;
                if (block[0] == endBlock[0] || !nextBlock.length)
                    nextBlock = null;

                if (this.loadingData || that.mode == "agenda")
                    return;

                function next() {
                    if (nextBlock)
                        that.loadDataInBlock(view, nextBlock, endBlock);
                    else
                        that.activeCalendar.colorMap.load(true);
                }

                // already loaded
                if (block.hasClass('data-loaded')) {
                    next();
                }
                // load the data
                else {
                    // skip load if block not visible
                    if (!that.blockIsVisible(view, block)) {
                        next();
                        return;
                    }

                    var date = getDateOfBlock(block),
                        data = this.cache.select(date);

                    // select from database
                    if (!data) {
                        this.requestData({
                            mode: mode,
                            date: date,
                            success: function (result) {
                                that.cache.insert(date, result.Pivots.pivot0.Data.slice(1));

                                callback = function () {
                                    // check if block is still visible
                                    if (that.blockIsVisible(view, block)) {

                                        // clear data from block
                                        switch (mode) {
                                            case "day":
                                                block.find('td > ul').empty();
                                                break;
                                            case "week":
                                                block.find('td > ul').empty();
                                                break;
                                            case "month":
                                                block.find('td > ul').empty();
                                                break;
                                            case "year":
                                                block.find('td.app-has-data').removeClass('app-has-data');
                                                break;
                                            case "agenda":
                                                return;
                                        }

                                        // render data
                                        block.addClass('data-loaded');
                                        data = that.cache.select(date);
                                        if (!$.isEmptyObject(data)) {
                                            that.views[mode].addData(view, date, data);
                                        }
                                        next();
                                    }
                                    scrollStopCallback = null;
                                };

                                if (isScrolling && !mode.match(/day|week/))
                                    scrollStopCallback = callback;
                                else
                                    callback();
                            }
                        });
                    }
                    else {
                        // render data
                        if (!$.isEmptyObject(data)) {
                            this.getViewHandler().addData(view, date, data);
                        }
                        this.loadingData = false;
                        block.addClass('data-loaded');

                        next();
                    }
                }
            },
            /* executes a pivot request with the specified options
            * 
            * REQUIRED
            * options.success(result) = function called on success
            *
            * OPTION
            * options.pivots = the pivot definitions
            * options.date = the start date
            * options.end = the end date
            * 
            * OPTIONAL
            * options.mode = the mode to create
            * options.date = the start date
            */
            requestData: function (options) {
                var that = this,
                    config = that.activeCalendar,
                    executeOptions = {
                        controller: that.dataView._controller,
                        command: options.mode == 'agenda' ? 'Select' : 'Pivot',
                        view: that.dataView._viewId,
                        sort: config.date.Name,
                        tags: that.dataView.get_tags(),
                        fieldFilter: [config.date.Name],
                        success: function (result) {
                            that.loadingData = false;
                            options.success(result);
                        },
                        error: function (error) {
                            that.loadingData = false;
                            _app.alert(String.format('{0}', error.get_message()));
                        }
                    };

                if (config.text) {
                    executeOptions.fieldFilter.push(config.text.Name);
                    if (config.text.AliasIndex != 0) {
                        executeOptions.fieldFilter.push(that.dataView._allFields[config.text.AliasIndex].Name);
                    }
                }
                if (config.color) {
                    executeOptions.fieldFilter.push(config.color.Name);
                    if (config.color.AliasIndex != 0) {
                        executeOptions.fieldFilter.push(that.dataView._allFields[config.color.AliasIndex].Name);
                    }
                }
                if (config.end)
                    executeOptions.fieldFilter.push(config.end.Name);

                if (options.mode) {
                    config = that.activeCalendar;
                    var date = options.date,
                        endDate = new Date(date),
                        calendarPivots = {},
                        datePivots = calendarPivots[config.date.Name] = [
                            'calendar-date',
                            'pivot-val2-count',
                            'pivot-row1-year',
                            'pivot-row2-month-raw',
                            'pivot-row3-day'],
                        textPivots = calendarPivots[config.text.Name],
                        colorPivots = config.color ? calendarPivots[config.color.Name] : null;
                    if (config.end)
                        calendarPivots[config.end.Name] = ['calendar-end'];
                    if (!textPivots)
                        textPivots = calendarPivots[config.text.Name] = ['calendar-text'];
                    if (config.color && !colorPivots)
                        colorPivots = calendarPivots[config.color.Name] = ['calendar-color'];

                    // form filter and pivot
                    switch (options.mode) {
                        case 'daylist':
                            endDate.setDate(endDate.getDate() + 1);
                            datePivots.push('pivot-val1-calendar-first100');
                            break;
                        case 'day':
                            endDate.setDate(endDate.getDate() + 1);
                            datePivots.push('pivot-row4-halfhour');
                            datePivots.push('pivot-val1-calendar');
                            break;
                        case 'week':
                            endDate.setDate(endDate.getDate() + 7);
                            datePivots.push('pivot-row3-day', 'pivot-row4-halfhour');
                            datePivots.push('pivot-val1-calendar');
                            break;
                        case 'month':
                            endDate.setMonth(endDate.getMonth() + 1);
                            datePivots.push('pivot-row3-day');
                            datePivots.push('pivot-val1-calendar-first5');
                            break;
                        case 'year':
                            endDate.setYear(endDate.getFullYear() + 1);
                            datePivots.push('pivot-row3-day');
                            break;
                        case 'agenda':
                            break;
                    }
                    endDate.setSeconds(-1);
                    executeOptions.pivotDefinitions = calendarPivots;
                    executeOptions._filter = getDateFilter(that.dataView, config.date, null, date, endDate);
                }
                else if (options.pivots && options.date && options.end) {
                    executeOptions.pivotDefinitions = options.pivots;
                    executeOptions._filter = getDateFilter(that.dataView, config.date, null, options.date, options.end);
                }

                that.loadingData = true;
                _app.execute(executeOptions);
            },
            blockIsVisible: function (view, block) {
                if (!view.is(':visible'))
                    return false;
                var scrollable = view.closest('.app-wrapper');
                if (this.mode.match(/month|year/)) {
                    var scrollTop = scrollable.offset().top,
                        scrollBottom = scrollTop + scrollable.height(),
                        blockTop = block.offset().top,
                        blockBottom = blockTop + block.height(),

                        topVisible = blockTop <= scrollBottom && blockTop >= scrollTop,
                        bottomVisible = blockBottom >= scrollTop && blockBottom <= scrollBottom,
                        topAboveBottomBelow = blockTop <= scrollTop && blockBottom >= scrollBottom;

                    return topVisible || bottomVisible || topAboveBottomBelow;
                }
                else if (this.mode.match(/day|week/)) {
                    var pageLeft = 0,
                        pageRight = scrollable.width(),
                        left = block.position().left,
                        right = left + block.width();
                    //return (left >= pageLeft && left <= pageRight) || (right >= pageLeft && right <= pageRight);
                    return (right >= pageLeft && left <= pageRight);
                }
                else
                    return true;
            },
            hasKeyFields: function () {
                return this.dataView._keyFields.length > 0;
            },
            getCurrentKey: function () {
                if (!this.hasKeyFields())
                    return null;
                var keyField = this.dataView._keyFields[0],
                    row = this.dataView.extension().commandRow();
                return row ? row[keyField.Index] : null;
            },
            // render title text
            getEventTitle: function (date, end, text, color) {
                var title = getClockTime(date, true);

                if (end) //&& isSameDay(date, end))
                    title += '-' + getClockTime(end, true);
                title += '\n' + (text ? text : resources.Data.NullValueInForms);
                if (this.activeCalendar.color && color != '')
                    title += '\n' + (color ? color : resources.Data.NullValueInForms);
                return title;
            },
            getActionsByName: function (command) {
                var that = this,
                    context = [],
                    foundActions = [];
                // get the New command
                _touch.navContext(context);
                context.forEach(function (action) {
                    if (action.command === command && (command !== 'New' || action.argument !== that.dataView._viewId))
                        foundActions.push(action);
                });
                return foundActions;
            },
            drawDayData: function (list, date, data, key) {
                var that = this,
                    rows = data.rows;
                if (rows)
                    rows.forEach(function (event) {
                        var li = that.drawEvent(event, key);
                        li.appendTo(list);
                    });
                this.resizeDayData(list.find('li'));
            },
            drawEvent: function (context, key) {
                var that = this,
                    id = context[0],
                    date = context[1],
                    end = context[2],
                    color = context[3],
                    text = context[4],
                    timeText = getClockTime(date, false, true),
                    longTimeText = getClockTime(date);

                if (end) {
                    timeText += '-' + getClockTime(end, false, true);
                    longTimeText += ' - ' + getClockTime(end);
                }

                var drawText = String.format('<div class="app-event-data"><span class="app-event-time">{0}</span> {1} <div class="app-event-time-long">{2}</div></div>',
                    timeText, text ? text : resources.Data.NullValueInForms, longTimeText),
                    li = $li('app-event').data('data-context', context),
                    title = that.getEventTitle(date, end, text, color),
                    colorClass = that.activeCalendar.colorMap.className(color);

                // enable drag
                if (/*_touch.desktop() && */!this.dataView.get_isTagged('calendar-drag-disabled')) {
                    li.attr('data-draggable', 'calendar-event');
                    if (that.activeCalendar.end)
                        drawText += '<div class="app-event-handle ui-icon-dots" data-draggable="calendar-event-handle"></div>';
                }

                // show selection
                if (key && key == id)
                    li.addClass('app-calendar-selected');

                if (end)
                    li.addClass('app-event-has-end-time');

                li.addClass(colorClass);
                li.html(drawText);
                li.attr('title', title);

                return li;
            },
            resizeDayData: function (eventElements) {

                // initialize eventList
                var eventList = [],
                    sameTimeEventList = [],
                    stack = [],
                    scale = dayAndWeekHeight / 25,
                    dayWidth = eventElements.first().closest('.app-calendar-day').width() - (this.mode == "day" ? 150 : 10),
                    maxDepth = this.mode == 'day' ? 10 : 4;

                eventElements.each(function () {
                    var eventElement = $(this);
                    if (eventElement.is('.app-event-more')) {
                        eventElement.remove();
                        return;
                    }
                    var data = eventElement.data('data-context'),
                        startDate = data[1],
                        endDate = data[2];
                    if (!endDate || endDate.getTime() < startDate.getTime()) {
                        endDate = new Date(startDate);
                        endDate.setMinutes(endDate.getMinutes() + eventMinLength);
                    }
                    else if (endDate.getDate() != startDate.getDate())
                        endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 23, 59, 59);
                    eventList.push({
                        element: eventElement,
                        data: data,
                        start: startDate.getTime(),
                        end: endDate.getTime(),
                        depth: 1,
                        width: 0
                    });
                });

                // sort by start date
                eventList.sort(function (a, b) {
                    if (a.start != b.start)
                        return a.start > b.start ? 1 : -1;
                    else if (a.end != b.end)
                        return a.end < b.end ? 1 : -1;
                    else
                        return 0;
                });

                // iterate through events
                var lastEvent,
                    lastEvents = [],
                    lastMore,
                    depth = 0;
                eventList.forEach(function (event) {

                    lastEvent = stack.pop();
                    // determine position
                    while (lastEvent) {

                        // last event over
                        if (lastEvent.end <= event.start) {
                            lastEvent = stack.pop();
                            if (!lastEvent) {
                                lastEvents.forEach(function (e) {
                                    e.width = depth;
                                });
                                depth = 0;
                                lastEvents = [];
                            }
                        }
                        // overlap
                        else {
                            stack.push(lastEvent);
                            break;
                        }
                    }

                    function addToStack() {
                        event.depth = stack.length + 1;
                        if (event.depth > depth)
                            depth = event.depth;
                        stack.push(event);
                        lastEvents.push(event);
                    }


                    if (stack.length >= maxDepth) {
                        if (!lastMore) {
                            lastMore = event;
                            lastMore.collapsedEvents = [event.data];
                            addToStack();
                        }
                        else {
                            event.collapsed = true;
                            lastMore.collapsedEvents.push(event.data);
                        }
                    }
                    else {
                        lastMore = null;
                        addToStack();
                    }
                });

                lastEvents.forEach(function (e) {
                    e.width = depth;
                });


                eventList.forEach(function (event) {

                    // hide event
                    if (event.collapsed) {
                        event.element.hide();
                    }

                    // regular display
                    else {
                        var elem = event.element,
                            start = event.data[1],
                            end = event.data[2],
                            top = scale * (start.getHours() + (start.getMinutes() / 60)) + 22,
                            height = getEventHeight(event.start, event.end),
                            width = dayWidth / event.width,
                            marginLeft = dayWidth * (event.depth - 1) / event.width;
                        if (event.depth != event.width)
                            width *= 1.3;

                        if (event.collapsedEvents && event.collapsedEvents.length > 1) {
                            elem.hide();

                            var text = '+' + event.collapsedEvents.length + ' ' + resources.Mobile.More;
                            elem = $li('app-event app-event-more ui-icon-dots').appendTo(elem.closest('ul'))
                                .html(text).attr('title', text)
                                .data('data-more-context', event.collapsedEvents);
                        }

                        var cssOptions = {
                            'top': top,
                            'z-index': event.depth + 2, // add 2 to ensure that timeline is below the event
                            'marginLeft': marginLeft + 'px',
                            'width': width - 3 + 'px'
                        };
                        // set height if end time
                        if (end) {
                            cssOptions['height'] = height;
                        }

                        // set default css
                        elem.css(cssOptions);

                    }
                });
            }
        };

        // gets the appropriate event height 
        function getEventHeight(start, end) {
            return (end - start) / 3600000 * (dayAndWeekHeight / 25);
        }

        var Day = function (calendar) {
            this.calendar = calendar;
        };

        Day.prototype = {
            // render a new Day presentation
            draw: function (container, startDate) {
                container.find('.app-calendar-dayview').remove();
                var view = $div('app-calendar-dayview').appendTo(container),
                    isEcho = view.closest('.app-echo').length > 0,
                    presenter = view.closest('.app-presenter'),
                    scrollable = view.closest('.app-wrapper'),
                    header = presenter.data('cal-header'),
                    //footer = isEcho ? null : presenter.data('cal-footer'),
                    distance = isEcho ? 1 : modeDrawDistance.day * 7,
                    //backDistance = (modeDrawDistance.day - 1) / 2 * 7,
                    testDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()),
                    grid = '<div class="app-calendar-day-grid"><div class="current-time-line"><div class="dot"></div></div>';

                // set to beginning of week
                testDate.setDate(testDate.getDate() - dtfDayOfWeek[testDate.getDay()]);


                // add day headers
                header.find('.app-day-header').remove();
                var dayHeaders = $div('app-day-header app-calendar-header', 'data-draggable="calendar-bar-day"').appendTo(header),
                    dayHeaderList = $('<ul> ' + this.calendar.drawDayHeaders(testDate, distance) + ' </ul>').appendTo(dayHeaders);
                appendClearFix(dayHeaders);

                // draw columns
                grid += this.calendar.drawDayColumns(testDate, distance, true);

                grid += '</div>';
                view.html(grid).find('.app-calendar-day').hide();

                // position elements
                this.resize(view, dayHeaders, null);
                this.scroll({
                    view: view, date: startDate, enhancePrecision: true
                });
                return view;
            },
            showHeaderAndFooter: function (header, footer) {
                header.find('.app-day-header').show();
                header.find('.app-week-header').hide();
                header.find('.app-month-header').hide();

                //$app.touch.bar('show', footer);

                this.calendar.lastDayScrollTop = this.calendar.scrollable().scrollTop();
            },
            // Resize the Day presentation
            // view = app-calendar-dayview
            // header = app-day-header
            // footer = app-scroll-inner
            resize: function (view, header, footer) {
                if (!header.is('.app-day-header'))
                    header = header.find('.app-day-header');
                var isEcho = view.closest('.app-echo').length > 0,
                    grid = view.find('.app-calendar-day-grid'),
                    gridItems = view.find('.app-calendar-day'),
                    headerItems = header.find('li'),
                    scrollable = this.calendar.scrollable(),
                    fullWidth = scrollable.outerWidth(),
                    itemWidth = Math.floor(fullWidth / 7),
                    gridWidth = gridItems.length * fullWidth,

                    // check for restore position
                    navigating = this.calendar.navigateDate && !this.calendar.preventNavigate,
                    firstVisibleItem, firstVisibleHeader, oldLeft, oldHeaderLeft, oldMargin, oldHeaderMargin;

                if (!navigating) {
                    firstVisibleItem = getFirstVisiblePlaceholder(gridItems);
                    firstVisibleHeader = isEcho ? null : getFirstVisiblePlaceholder(headerItems);
                    oldLeft = firstVisibleItem.position().left;
                    oldHeaderLeft = isEcho ? 0 : firstVisibleHeader.position().left;
                    oldMargin = parseInt(view.css('marginLeft'), 10) * -1;
                    oldHeaderMargin = isEcho ? 0 : parseInt(header.css('marginLeft'), 10) * -1;
                }

                // set sizes
                grid.width(gridWidth);
                header.width(headerItems.width() * headerItems.length);
                headerItems.closest('ul').css('visibility', '');
                headerItems.width(itemWidth);
                gridItems.width(fullWidth).fadeIn('fast');

                // set height
                view.height(dayAndWeekHeight);

                // restore scroll
                if (!isEcho) {
                    if (navigating)
                        this.scroll({ view: view, date: this.calendar.navigateDate });
                    else {
                        var newLeft = firstVisibleItem.position().left,
                            newHeaderLeft = firstVisibleHeader.position().left,
                            diff = oldLeft - newLeft,
                            diffHeader = Math.floor(oldHeaderLeft - newHeaderLeft);

                        if (diffHeader != 0)
                            header.css('marginLeft', (oldHeaderMargin * -1) + diffHeader);

                        this._scroll(view, header, oldMargin - diff, null);
                    }

                    //if (footer != null)
                    //    this.calendar.resizeScroller(view, footer, gridWidth);
                }
                // ensure timeline is correct
                drawTime();
                this.resizeData(view);
            },
            scroll: function (options) {
                var that = this,
                    calendar = that.calendar,
                    row = calendar.dataView.extension().commandRow(),
                    scrollable = calendar.scrollable(),
                    view = options.view,
                    animate = options.animate,
                    presenter = view.closest('.app-presenter'),
                    header = presenter.data('cal-header').find('.app-day-header'),
                    //footer = presenter.data('cal-footer'),
                    date = options.date,
                    scrollTo = calendar.getBlockByDate(view, date);

                if (scrollTo.length) {
                    var marginLeft = parseInt(view.css('marginLeft'), 10),
                        distance = scrollTo.position().left;
                    that._scroll(view, header, distance - marginLeft, null, animate);
                }

                // set scroll top
                if (options.enhancePrecision) {
                    var top;
                    if (row) {
                        var rowDate = row[calendar.activeCalendar.date.Index];
                        top = drawTime(rowDate, 'find');
                    }
                    else if (!(date.getHours() == 0 && date.getMinutes() == 0 && date.getSeconds() == 0 && date.getMilliseconds() == 0))
                        top = drawTime(date, 'find');
                    else
                        top = calendar.lastDayScrollTop || drawTime();
                    _touch.scroll(scrollable, top);
                }
            },
            // scroll the presentation to the specified positive distance
            // Enable animate to bounce to distance
            _scroll: function (view, header, distance, footer, animate) {

                if (!_touch.animate())
                    animate = false;

                var oldMarginLeft = parseInt(view.css('marginLeft'), 10),
                    distanceNeg = distance * -1,
                    timeout,
                    that = this,
                    grid = view.find('.app-calendar-day-grid');

                view.removeClass('app-has-current-day');

                dayScrollEventCount++;
                // bounce to distance
                if (animate == true) {
                    view.animate({ marginLeft: distanceNeg }, animationSpeed,
                        function () {
                            that._scroll(view, header, distance, null);
                        });
                    return;
                }
                // regular scroll
                view.css('marginLeft', distanceNeg);


                var scrollToHeader = this.updateDayHeader(view, header);
                // delayed bounce
                clearTimeout(shiftViewTimeout);
                shiftViewTimeout = setTimeout(function () {
                    var columns = view.find('.app-calendar-day'),
                        firstVisibleCol = getFirstVisiblePlaceholder(columns),
                        colWidth = columns.width(),
                        diff = distance % colWidth,
                        date,
                        drawDistance = modeDrawDistance.day * 7,
                        maxRender = modeMaxRender.day * 7,
                        oldLeft;
                    // scroll to next day if single event
                    if (dayScrollEventCount == 1 && diff != 0) {
                        // going left
                        if (distanceNeg > oldMarginLeft) {
                            diff = diff * -1;
                            firstVisibleCol = firstVisibleCol.prev();
                            if (firstVisibleCol.is('.current-time-line'))
                                firstVisibleCol = firstVisibleCol.prev();
                        }
                        // going right
                        else {
                            diff = colWidth - diff;
                            firstVisibleCol = firstVisibleCol.next();
                            if (firstVisibleCol.is('.current-time-line'))
                                firstVisibleCol = firstVisibleCol.next();
                        }
                        scrollToHeader = that.updateDayHeader(view, header, firstVisibleCol);
                    }
                    // normalize difference
                    else {
                        if (diff > colWidth / 2)
                            diff = colWidth - diff;
                        else
                            diff = diff * -1;
                    }

                    var rounded = distanceNeg - diff,
                        roundedNeg = rounded * -1,
                        firstVisibleColumn,
                        removedHeadersWidth;

                    // draw day at left
                    if (distance < colWidth) {
                        // draw at left
                        firstVisibleColumn = columns.first();
                        oldLeft = firstVisibleColumn.position().left;
                        date = getDateOfBlock(firstVisibleColumn);
                        date.setDate(date.getDate() - drawDistance);

                        $(that.calendar.drawDayColumns(date, drawDistance, true)).width(colWidth).prependTo(grid);
                        $(that.calendar.drawDayHeaders(date, drawDistance)).width(colWidth / 7).prependTo(header.find('ul'));

                        // remove extra columns
                        columns = view.find('.app-calendar-day');
                        //var headerLi = header.find('li');
                        if (columns.length > maxRender) {
                            columns.slice(maxRender, columns.length).remove();
                            header.find('li').slice(maxRender, columns.length).remove();
                        }

                        // shift and reset
                        view.css('marginLeft', (firstVisibleColumn.position().left - oldLeft) * -1);
                        header.css('marginLeft', scrollToHeader.position().left * -1);
                        //if (footer)
                        //    that.resize(view, header, footer);
                    }

                    // draw days at right
                    else if (distance > columns.width() * (columns.length - 2)) {
                        // draw at right
                        firstVisibleColumn = columns.last();
                        oldLeft = firstVisibleColumn.position().left;
                        date = getDateOfBlock(firstVisibleColumn);
                        date.setDate(date.getDate() + 1);

                        $(that.calendar.drawDayColumns(date, drawDistance, true)).width(colWidth).appendTo(grid);
                        $(that.calendar.drawDayHeaders(date, drawDistance)).width(colWidth / 7).appendTo(header.find('ul'));

                        // remove extra columns
                        var totalDayCount = columns.length + drawDistance,
                            removedColumnsWidth = 0;
                        removedHeadersWidth = 0;
                        if (totalDayCount > maxRender) {
                            var removedColumns = columns.slice(0, totalDayCount - maxRender),
                                removedHeaders = header.find('li').slice(0, totalDayCount - maxRender);
                            removedColumnsWidth = removedColumns.width() * removedColumns.length;
                            removedHeadersWidth = removedHeaders.width() * removedHeaders.length;
                            removedColumns.remove();
                            removedHeaders.remove();
                        }

                        view.css('marginLeft', parseInt(view.css('marginLeft'), 10) + removedColumnsWidth - diff);
                        header.css('marginLeft', parseInt(header.css('marginLeft'), 10) + removedHeadersWidth);
                        //if (footer)
                        //    that.resize(view, header, footer);
                    }
                    else {

                        function setScroller() {
                            //if (footer && footer.length && footer.scrollLeft() != roundedNeg) {
                            //    that.calendar.resizeScroller(view, footer);
                            //footer.find('.app-scroll-outer').scrollLeft(roundedNeg).data('resizing', true);
                            //}
                            that.calendar.updateHeader(header.closest('.app-bar-calendar'));
                        }

                        if (diff != 0)
                            view.animate({ marginLeft: rounded }, { duration: animationSpeed, done: setScroller });
                        else
                            setScroller();

                    }
                    if (firstVisibleCol.is('.current-day-column'))
                        view.addClass('app-has-current-day');
                    fetchCalendarData();
                    dayScrollEventCount = 0;
                }, 250);
            },
            updateDayHeader: function (view, header, focusColumn) {
                var columns = view.find('.app-calendar-day'),
                    firstVisibleCol = (focusColumn && focusColumn.length) ? focusColumn : getFirstVisiblePlaceholder(columns),
                    cDate = getDateOfBlock(firstVisibleCol),
                    firstVisibleHeader = getFirstVisiblePlaceholder(header.find('ul li')),
                    hDate = getDateOfBlock(firstVisibleHeader),
                    scrollToHeader = firstVisibleHeader;

                // highlight visible day
                header.find('li .visible-day').removeClass('visible-day');
                var visibleDayHeader = header.find(String.format('li[data-cal-year="{0}"][data-cal-month="{1}"][data-cal-day="{2}"] > a > div', cDate.getFullYear(), cDate.getMonth(), cDate.getDate()));
                visibleDayHeader.addClass('visible-day');

                // set to beginning of week
                cDate.setDate(cDate.getDate() - dtfDayOfWeek[cDate.getDay()]);
                hDate.setDate(hDate.getDate() - dtfDayOfWeek[hDate.getDay()]);

                if (hDate.getTime() != cDate.getTime()) {
                    // scroll header
                    scrollToHeader = header.find(String.format('li[data-cal-year="{0}"][data-cal-month="{1}"][data-cal-day="{2}"]', cDate.getFullYear(), cDate.getMonth(), cDate.getDate()));
                    if (scrollToHeader.length) {
                        var oldHeaderMarginLeft = parseInt(header.css('marginLeft'), 10),
                            marginLeft = oldHeaderMarginLeft - scrollToHeader.position().left;
                        header.css('marginLeft', marginLeft);
                    }
                }
                // update header badge
                this.calendar.updateHeader(header.closest('.app-bar-calendar'));
                return scrollToHeader;
            },
            // adds data to the specified date
            addData: function (view, date, data) {
                var dayBlock = this.calendar.getBlockByDate(view, date, 'day'),
                    dayList = dayBlock.find('ul.app-calendar-eventlist'),
                    keyField = this.calendar.dataView._keyFields[0],
                    row = this.calendar.dataView.extension().commandRow(),
                    key = row ? row[keyField.Index] : null;

                dayList.empty();

                if (typeof data != 'boolean')
                    this.calendar.drawDayData(dayList, date, data, key);
            },
            // properly aligns the data in each day
            resizeData: function (view) {
                var calendar = this.calendar,
                    days = view.find('.app-calendar-day');
                days.each(function () {
                    var day = $(this),
                        events = day.find('li.app-event:not(.app-event-preview)');
                    if (events.length)
                        calendar.resizeDayData(events);
                });
            },
            clear: function (emptyView) {
                var scrollable = this.calendar.scrollable(),
                    view = scrollable.find('.app-calendar-dayview');

                if (view.length) {
                    var blocks = view.find('div.app-calendar-day.data-loaded');

                    blocks.removeClass('data-loaded').removeData('calendar-colors');
                    if (emptyView)
                        blocks.find('.app-event').remove();
                }
            },
            getNextDate: function (view, increment) {
                var visible = this.calendar.getMostVisibleBlock(),
                    date = getDateOfBlock(visible);
                date.setDate(date.getDate() + increment);
                return date;
            },
            getBlocks: function () {
                return this.calendar.scrollable().find('.app-calendar-dayview > .app-calendar-day-grid > .app-calendar-day');
            }
        };

        var Week = function (calendar) {
            this.calendar = calendar;
        };

        Week.prototype = {
            draw: function (container, startDate) {
                startDate.setDate(startDate.getDate() - dtfDayOfWeek[startDate.getDay()]);
                container.find('.app-calendar-weekview').remove();
                var view = $div('app-calendar-weekview').appendTo(container),
                    calendar = this.calendar,
                    isEcho = view.closest('.app-echo').length > 0,
                    distance = isEcho ? 7 : modeDrawDistance.week,
                    presenter = view.closest('.app-presenter'),
                    scrollable = view.closest('.app-wrapper'),
                    header = presenter.data('cal-header'),
                    //footer = presenter.data('cal-footer'),
                    testDate = new Date(startDate.getTime());

                testDate.setDate(testDate.getDate() - distance);

                // add day headers
                header.find('.app-week-header').remove();
                var dayHeaders = $div('app-week-header app-calendar-header', 'data-draggable="calendar-bar-week"').appendTo(header),
                    dayHeaderList = $('<ul>' + calendar.drawDayHeaders(testDate, distance * 3) + '</ul>').appendTo(dayHeaders);
                appendClearFix(dayHeaders);

                // add grid
                var gridText = '<div class="app-calendar-week-grid"><div class="current-time-line"><div class="dot"></div></div>';

                // add columnsm
                gridText += calendar.drawTimeColumn(testDate);
                gridText += calendar.drawDayColumns(testDate, distance * 3, false);
                gridText += '</div>';
                view.html(gridText);
                var grid = view.find('.app-calendar-week-grid').hide();

                // position elements
                this.resize(view, dayHeaders, null);
                this.scroll({ view: view, date: startDate, enhancePrecision: true });
                this.validateCurrentDay(view, grid);
                drawTime();
                return view;
            },
            showHeaderAndFooter: function (header, footer) {
                header.find('.app-day-header').hide();
                header.find('.app-week-header').show();
                header.find('.app-month-header').hide();

                //$app.touch.bar('show', footer);

                this.calendar.lastDayScrollTop = this.calendar.scrollable().scrollTop();
            },
            _timelineDot: function (view, show) {
                var scrollable = this.calendar.scrollable(),
                    grid = view.find('.app-calendar-week-grid'),
                    currentDay,
                    timelineDot = grid.find('.current-time-line .dot'),
                    newMarginLeft,
                    tlw;
                if (show) {
                    tlw = timelineDot.show().width();
                    currentDay = grid.find('.current-day-column');
                    if (currentDay.length) {
                        //timelineDot.css('marginLeft', oldMargin + currentDay.position().left - 70);
                        newMarginLeft = currentDay.offset().left - scrollable.offset().left - tlw / 2 + parseInt(grid.css('margin-left'));
                        if (newMarginLeft + tlw < scrollable.width() - tlw * 3)
                            setTimeout(function () {
                                timelineDot.css('marginLeft', newMarginLeft).show();
                            });
                        else
                            timelineDot.hide();
                    }
                }
                else
                    timelineDot.hide();
            },
            resize: function (view, header, footer) {
                if (!header.is('.app-week-header'))
                    header = header.find('.app-week-header');
                var isEcho = view.closest('.app-echo').length > 0,
                    grid = view.find('.app-calendar-week-grid'),
                    gridItems = view.find('.app-calendar-week-grid > div:not(.current-time-line):not(.app-calendar-time) > div'),
                    headerItems = header.find('li'),
                    scrollable = this.calendar.scrollable(),
                    fullWidth = scrollable[0].scrollWidth - weekTimeWidth,
                    itemWidth = Math.floor(fullWidth / 7),
                    gridWidth = itemWidth * (headerItems.length + 1) + weekTimeWidth,
                    firstVisibleItem = getFirstVisiblePlaceholder(headerItems),
                    oldLeft = isEcho ? 0 : firstVisibleItem.position().left,
                    oldMargin = isEcho ? 0 : parseInt(header.css('marginLeft'), 10) * -1;

                // set width of items
                headerItems.width(itemWidth);
                headerItems.closest('ul').css('visibility', '');
                gridItems.width(itemWidth);
                grid.width(gridWidth).fadeIn('fast');

                // set height
                view.height(dayAndWeekHeight);

                if (!isEcho) {
                    var newLeft = firstVisibleItem.position().left,
                        diff = oldLeft - newLeft,
                        newPosition = oldMargin - diff;

                    // set position of current day dot
                    this._timelineDot(view, true);

                    // scroll to old position
                    //if (diff != 0)
                    this._scroll(view, header, oldMargin - diff, null);

                    //if (diff != 0) {
                    //    view.css('marginLeft', newPosition * -1);
                    //    header.css('marginLeft', newPosition * -1);
                    //}
                    //if (footer != null)
                    //    this.calendar.resizeScroller(view, footer, gridWidth);

                    this.resizeData(view);
                }
                drawTime();
            },
            scroll: function (options) {
                options.date.setDate(options.date.getDate() - dtfDayOfWeek[options.date.getDay()]);
                var that = this,
                    calendar = that.calendar,
                    view = options.view,
                    animate = options.animate,
                    date = options.date,
                    row = calendar.dataView.extension().commandRow(),
                    presenter = view.closest('.app-presenter'),
                    scrollable = calendar.scrollable(),
                    header = presenter.data('cal-header').find('.app-week-header'),
                    //footer = presenter.data('cal-footer'),
                    scrollTo = calendar.getBlockByDate(view, date);

                if (scrollTo.length) {
                    var marginLeft = parseInt(view.css('marginLeft'), 10),
                        distance = scrollTo.position().left - weekTimeWidth;
                    that._scroll(view, header, distance - marginLeft, null, animate);
                }

                // set scroll top
                if (options.enhancePrecision) {
                    var top;
                    if (row) {
                        var rowDate = row[calendar.activeCalendar.date.Index];
                        top = drawTime(rowDate, 'find');
                    }
                    else if (!(date.getHours() == 0 && date.getMinutes() == 0 && date.getSeconds() == 0 && date.getMilliseconds() == 0))
                        top = drawTime(date, 'find');
                    else
                        top = calendar.lastDayScrollTop || drawTime();
                    _touch.scroll(scrollable, top);
                }

            },
            _scroll: function (view, header, distance, footer, animate) {
                if (!_touch.animate())
                    animate = false;
                var that = this,
                    calendar = that.calendar,
                    scrollable = calendar.scrollable(),
                    pageWidth = scrollable.width(),
                    grid = view.find('.app-calendar-week-grid'),
                    columns = grid.find('.app-calendar-day'),
                    calHeader = header.closest('.app-bar-calendar'),
                    lastColumn = columns.last(),
                    lastColumnWidth = lastColumn.width(),
                    maxDistance = lastColumn.position().left - weekTimeWidth + lastColumnWidth,
                    scrolled = false,
                    firstHeader = header.find('li:first-of-type'),
                    firstDate = getDateOfBlock(firstHeader),
                    cellWidth = firstHeader.width() + 2,
                    maxRender = modeMaxRender.week,
                    drawDistance = modeDrawDistance.week,
                    addedWidth = lastColumnWidth * drawDistance;

                // update header badge
                that._timelineDot(view, false);
                calendar.updateHeader(calHeader);

                function shiftView() {
                    calendar.updateHeader(calHeader);
                    if (!scrolled) {
                        // draw day at left
                        if (distance < cellWidth)
                            loadAtLeft();

                        // draw days at right
                        else if (lastColumn.position().left < pageWidth)
                            loadAtRight();

                        else
                            that.validateCurrentDay(view, grid);
                    }
                    //if (footer && footer.length && footer.scrollLeft() != distance)
                    //    calendar.resizeScroller(view, footer);
                    fetchCalendarData(scrollable);
                    that._timelineDot(view, true);
                }

                // swaps the replacee with the replacer data, events, and date
                function swapColumns(replacee, replacer, colDate) {
                    var dateNum = colDate.getDate();

                    replacee
                        .attr('data-cal-year', colDate.getFullYear()).attr('data-cal-month', colDate.getMonth()).attr('data-cal-day', dateNum)
                        .data('calendar-colors', replacer.data('calendar-colors'))
                        .find('ul').empty().append(replacer.find('ul li'));
                    replacee[0].className = replacer[0].className;
                }

                // reconfigures a column with the colDate, clears data and events
                function cleanColumn(col, colDate) {
                    var dateNum = colDate.getDate();

                    col.attr('data-cal-year', colDate.getFullYear()).attr('data-cal-month', colDate.getMonth()).attr('data-cal-day', dateNum);
                    col.data('calendar-colors', null);
                    col.find('ul').empty().removeClass('data-loaded');
                    col[0].className = 'app-calendar-day';
                    if (isToday(colDate))
                        col.addClass('current-day-column');
                }

                function loadAtLeft() {
                    // draw at left
                    scrolled = true;
                    var firstVisibleColumn = columns.first(),
                        timeLine = grid.find('.current-time-line'),
                        date = getDateOfBlock(firstVisibleColumn),
                        dataToPosition = false;
                    date.setDate(date.getDate() - drawDistance);


                    // scroll headers
                    var headers = header.find('li'),
                        week1 = columns.slice(0, 7),
                        week2 = columns.slice(7, 14),
                        week3 = columns.slice(14, 21),
                        testDate = new Date(date);

                    headers.each(function () {
                        var item = $(this),
                            dateNum = item.find('a div'),
                            testDateNum = testDate.getDate();
                        dateNum.text(testDateNum);
                        item.attr('data-cal-year', testDate.getFullYear()).attr('data-cal-month', testDate.getMonth()).attr('data-cal-day', testDateNum);

                        if (isToday(testDate))
                            dateNum.addClass('app-current-day');
                        else
                            dateNum.removeClass('app-current-day');

                        testDate.setDate(testDateNum + 1);
                    });

                    // scroll days
                    testDate = getDateOfBlock(week2.first());
                    week3.each(function (index) {
                        swapColumns($(this), week2.eq(index), testDate);
                        testDate.setDate(testDate.getDate() + 1);
                    });


                    testDate = getDateOfBlock(week1.first());
                    week2.each(function (index) {
                        swapColumns($(this), week1.eq(index), testDate);
                        testDate.setDate(testDate.getDate() + 1);
                    });

                    testDate = date;
                    week1.each(function (index) {
                        cleanColumn($(this), testDate);

                        // try to load data
                        var data = calendar.cache.select(testDate);

                        if (data) {
                            that.addData(view, testDate, data);
                            dataToPosition = true;
                        }

                        testDate.setDate(testDate.getDate() + 1);
                    });


                    that.validateCurrentDay(view, grid);
                    //// shift and reset
                    if (dataToPosition)
                        that.resizeData(view);
                    distance -= addedWidth;
                    if (distance > 0)
                        distance = 0;
                    view.css('marginLeft', distance);
                    header.css('marginLeft', distance);
                    return addedWidth;
                }

                function loadAtRight() {
                    // draw at right
                    scrolled = true;
                    var firstVisibleColumn = columns.first(),
                        timeLine = grid.find('.current-time-line'),
                        date = getDateOfBlock(firstVisibleColumn),
                        dataToPosition = false;
                    date.setDate(date.getDate() + drawDistance);


                    // scroll headers
                    var headers = header.find('li'),
                        week1 = columns.slice(0, 7),
                        week2 = columns.slice(7, 14),
                        week3 = columns.slice(14, 21),
                        testDate = new Date(date);

                    headers.each(function () {
                        var item = $(this),
                            dateNum = item.find('a div'),
                            testDateNum = testDate.getDate();
                        dateNum.text(testDateNum);
                        item.attr('data-cal-year', testDate.getFullYear()).attr('data-cal-month', testDate.getMonth()).attr('data-cal-day', testDateNum);

                        if (isToday(testDate))
                            dateNum.addClass('app-current-day');
                        else
                            dateNum.removeClass('app-current-day');

                        testDate.setDate(testDateNum + 1);
                    });


                    // scroll days
                    testDate = getDateOfBlock(week2.first());
                    week1.each(function (index) {
                        swapColumns($(this), week2.eq(index), testDate);
                        testDate.setDate(testDate.getDate() + 1);
                    });


                    testDate = getDateOfBlock(week3.first());
                    week2.each(function (index) {
                        swapColumns($(this), week3.eq(index), testDate);
                        testDate.setDate(testDate.getDate() + 1);
                    });

                    testDate = getDateOfBlock(week3.last());
                    testDate.setDate(testDate.getDate() + 1);
                    week3.each(function (index) {
                        cleanColumn($(this), testDate);

                        // try to load data
                        var data = calendar.cache.select(testDate);

                        if (data) {
                            that.addData(view, testDate, data);
                            dataToPosition = true;
                        }

                        testDate.setDate(testDate.getDate() + 1);
                    });

                    that.validateCurrentDay(view, grid);


                    distance -= addedWidth;
                    if (dataToPosition)
                        that.resizeData(view);
                    if (distance > 0)
                        distance *= -1;
                    view.css('marginLeft', distance);
                    header.css('marginLeft', distance);
                    return addedWidth;
                }

                if (animate == true) {

                    //// passed the rightmost column
                    //if (distance > maxDistance)
                    //    distance -= loadAtRight();

                    //    // passed the leftmost column
                    //else if (distance < 0)
                    //    distance += loadAtLeft();

                    var diff = distance % lastColumnWidth,
                        rounded = distance * -1 + (diff > lastColumnWidth / 2 ? diff - lastColumnWidth : diff);
                    header.animate({
                        marginLeft: rounded
                    }, animationSpeed);
                    view.animate({
                        marginLeft: rounded
                    }, animationSpeed, function () {
                        setTimeout(function () {
                            shiftView();
                        });
                    });
                }
                else {
                    var distanceNeg = distance * -1;
                    header.css('marginLeft', distanceNeg);
                    view.css('marginLeft', distanceNeg);

                    // delayed bounce
                    clearTimeout(shiftViewTimeout);
                    shiftViewTimeout = setTimeout(shiftView, 250);
                }

            },
            // adds data to the specified date
            addData: function (view, date, data) {
                var keyField = this.calendar.dataView._keyFields[0],
                    row = this.calendar.dataView.extension().commandRow(),
                    key = row ? row[keyField.Index] : null;

                var dayBlock = this.calendar.getBlockByDate(view, date, 'day'),
                    dayList = dayBlock.find('ul.app-calendar-eventlist');

                dayList.empty();

                dayList.data('calendar-event-count', data.count || 0);
                this.calendar.drawDayData(dayList, date, data, key);
            },
            resizeData: function (view) {
                var calendar = this.calendar,
                    days = view.find('.app-calendar-day');
                days.each(function () {
                    var day = $(this),
                        events = day.find('li.app-event:not(.app-event-preview)');
                    if (events.length)
                        calendar.resizeDayData(events);
                });
            },
            clear: function (emptyView) {
                var scrollable = this.calendar.scrollable(),
                    view = scrollable.find('.app-calendar-weekview');

                if (view.length) {
                    var blocks = view.find('div.app-calendar-day.data-loaded');

                    blocks.removeClass('data-loaded').removeData('calendar-colors');
                    if (emptyView)
                        blocks.find('.app-event').remove();
                }
            },
            validateCurrentDay: function (view, grid) {
                if (!view.is('.app-has-current-day')) {
                    if (grid.find('.current-day-column').length)
                        view.addClass('app-has-current-day');
                }
                else if (!grid.find('.current-day-column').length)
                    view.removeClass('app-has-current-day');
            },
            getNextDate: function (view, increment) {
                var visible = this.calendar.getMostVisibleBlock(),
                    date = getDateOfBlock(visible);
                var day = dtfDayOfWeek[date.getDay()];
                if (day == 0)
                    date.setDate(date.getDate() + increment * 7);
                else
                    date.setDate(date.getDate() + (increment == -1 ? day * -1 : 7 - day));
                return date;
            },
            getBlocks: function () {
                var scrollable = this.calendar.scrollable();
                return scrollable.find('.app-calendar-weekview > .app-calendar-week-grid > .app-calendar-day');
            }
        };

        var Month = function (calendar) {
            this.calendar = calendar;
        };

        Month.prototype = {
            draw: function (container, startDate) {
                container.find('.app-calendar-monthview').remove();
                var view = $div('app-calendar-monthview').hide().appendTo(container),
                    isEcho = view.closest('.app-echo').length > 0,
                    scrollable = view.closest('.app-presenter'),
                    header = scrollable.data('cal-header'),
                    distance = isEcho ? 0 : modeDrawDistance.month,
                    startMonth = startDate.getMonth(),
                    testDate = new Date(startDate.getFullYear(), startMonth, 1),
                    activeMonth,
                    i;
                testDate.setMonth(testDate.getMonth() - distance);
                activeMonth = testDate.getMonth();

                // add week headers
                header.find('.app-month-header').remove();
                var dayHeaders = $div('app-month-header app-calendar-header'),
                    dayHeaderList = $ul().appendTo(dayHeaders);
                for (i = 0; i < 7; i++) {
                    var day = dayOfWeekDtf[i],
                        dayName = dtf.DayNames[day],
                        abbrDayName = dtf.AbbreviatedDayNames[day],
                        li = $('<li><span class="letter-day">' + abbrDayName.substring(0, 1) + '</span>'
                            + '<span class="abbr-day">' + abbrDayName + '</span>'
                            + '<span class="full-day">' + dayName + '</span>'
                            + '</li').attr('title', dayName);

                    if (day == 0 || day == 6)
                        li.addClass('app-calendar-weekend');

                    li.appendTo(dayHeaderList);
                }
                appendClearFix(dayHeaders);
                dayHeaders.appendTo(header);
                _touch.bar('show', header);

                view.fadeIn('fast');

                // add load at top button
                var loadAtTopBlock = $div('app-calendar-load-at-top').appendTo(view);
                $a('dv-load-at-top ui-btn').appendTo(loadAtTopBlock).text(resourcesHeaderFilter.Loading);
                if (isEcho)
                    loadAtTopBlock.hide();

                // draw months
                for (i = distance * -1; i <= distance; i++) {
                    this.drawMonth(testDate).appendTo(view);
                    testDate.setMonth(activeMonth + 1);
                    activeMonth = testDate.getMonth();
                }

                this.resize(view);

                // add load at bottom button
                var loadAtBottomBlock = $div('app-calendar-load-at-bottom').appendTo(view);
                $a('dv-load-at-bottom ui-btn').appendTo(loadAtBottomBlock).text(resourcesHeaderFilter.Loading);
                if (isEcho)
                    loadAtBottomBlock.hide();

                this.scroll({
                    date: startDate,
                    view: view
                });
                return view;
            },
            showHeaderAndFooter: function (header, footer) {
                header.find('.app-day-header').hide();
                header.find('.app-week-header').hide();
                header.find('.app-month-header').show();

                //$app.touch.bar('hide', footer);
            },
            // reset all lists
            resize: function (view, header, footer, resetVisible) {
                var scrollable = view.closest('.app-wrapper'),
                    months = view.find('.app-calendar-month'),
                    tables = months.find('table'),
                    height = scrollable.height() - months.first().find('.app-calendar-month-header').outerHeight();
                if (resetVisible)
                    months.removeClass('data-loaded');
                tables.height(height);
                tables.each(function () {
                    var table = $(this),
                        rows = table.find('tr');
                    rows.height(height / rows.length);
                });
                if (this.calendar.navigateDate && !this.calendar.preventNavigate)
                    this.scroll({
                        view: view, date: this.calendar.navigateDate
                    });
            },
            scroll: function (options) {
                var that = this,
                    //date = options.date,
                    calendar = that.calendar,
                    scrollToPlaceholder = calendar.getBlockByDate(options.view, options.date);
                if (!scrollToPlaceholder)
                    return;

                var scrollable = calendar.scrollable(),
                    presenter = options.view.closest('div.app-presenter'),
                    //header = presenter.data('cal-header'),
                    monthHeader = scrollToPlaceholder.find('.app-calendar-month-header'),
                    instruction = scrollable.find('.app-presenter-instruction'),
                    newScrollTop = monthHeader.offset().top - scrollable.offset().top + monthHeader.outerHeight(true) - instruction.outerHeight(true) + scrollable.scrollTop(),
                    complete = function () {
                        _touch.fetchOnDemand();
                        fetchCalendarData(scrollable);
                    };

                if (options.animate)
                    _touch.animatedScroll(scrollable, newScrollTop, complete);
                else {
                    _touch.scroll(scrollable, newScrollTop);
                    complete();
                }
            },
            clear: function (emptyView) {
                var scrollable = this.calendar.scrollable(),
                    view = scrollable.find('.app-calendar-monthview');

                if (view.length) {
                    var blocks = view.find('div.app-calendar-month.data-loaded');

                    blocks.removeClass('data-loaded').removeData('calendar-colors');
                    if (emptyView)
                        blocks.find('.app-event').remove();
                }
            },
            // creates a single month block
            drawMonth: function (testDate) {
                var activeMonth = testDate.getMonth(),
                    monthName = dtf.MonthNames[activeMonth],
                    monthBlock = $div('app-calendar-month')
                        .attr('data-cal-year', testDate.getFullYear()).attr('data-cal-month', activeMonth),
                    monthHeader = $htmlTag('h1', 'app-calendar-month-header').appendTo(monthBlock),
                    monthTable = $htmlTag('table').appendTo(monthBlock);

                if (activeMonth == 0)
                    monthHeader.text(String.format('{0} {1}', monthName, testDate.getFullYearText()));
                else
                    monthHeader.text(monthName);

                var monthDate = new Date(testDate.getFullYear(), testDate.getMonth(), 1),
                    dayOfWeek = dtfDayOfWeek[monthDate.getDay()],
                    endDate = new Date(testDate.getFullYear(), testDate.getMonth() + 1, 1),
                    endDay = dtfDayOfWeek[endDate.getDay()],
                    currentRow;

                // set the end date
                if (endDay != 0)
                    endDate.setDate(endDate.getDate() + (6 - endDay) + 1);

                // set the start date
                if (dayOfWeek != 0)
                    monthDate.setDate(monthDate.getDate() - dayOfWeek);

                // render this month
                while (monthDate < endDate) {
                    var dateDay = monthDate.getDay();
                    dayOfWeek = dtfDayOfWeek[dateDay];
                    if (dayOfWeek == 0)
                        currentRow = $htmlTag('tr').appendTo(monthTable);
                    var cell = $htmlTag('td').appendTo(currentRow);
                    if (dateDay == 0 || dateDay == 6)
                        cell.addClass('app-calendar-weekend');
                    if (monthDate.getMonth() == testDate.getMonth()) {
                        cell.html('&nbsp;');
                        cell.attr('data-cal-day', monthDate.getDate());
                        var day = $a('ui-btn').appendTo(cell),
                            span = $span().text(monthDate.getDate()).appendTo(day),
                            dataList = $ul().appendTo(cell),
                            more = $li('app-calendar-month-more').appendTo(dataList);
                        if (currentDay.setHours(0, 0, 0, 0) == monthDate.setHours(0, 0, 0, 0))
                            span.addClass("app-current-day");
                    }

                    else
                        cell.html('&nbsp;');
                    monthDate.setDate(monthDate.getDate() + 1);
                }
                return monthBlock;
            },
            // adds data to the specified date
            addData: function (view, date, data) {
                var calendar = this.calendar,
                    monthBlock = calendar.getBlockByDate(view, date, 'month'),
                    dataView = calendar.dataView,
                    keyField = dataView._keyFields[0],
                    config = calendar.activeCalendar,
                    row = calendar.dataView.extension().commandRow(),
                    key = row ? row[keyField.Index] : null,
                    keyDay = row ? row[config.date.Index] : null,
                    monthTdHeight,
                    showMore;

                // calculate td height
                var td = monthBlock.find('td').first(),
                    button = monthBlock.find('td > a').first(),
                    lists = monthBlock.find('ul');

                lists.hide();
                monthTdHeight = td.outerHeight() - button.height();
                lists.show();

                for (var day in data) {
                    var dayData = data[day],
                        dayCount = dayData.count,
                        dayDate = null,
                        dayList = monthBlock.find('td[data-cal-day="' + day + '"] ul'),
                        num = 0,
                        selectedRecord,
                        more = $li('app-calendar-month-more');
                    showMore = false;

                    dayList.empty().data('calendar-event-count', dayCount);
                    while (num < 5) {
                        var row = dayData.rows[num];

                        if (!row)
                            break;

                        date = row[1];
                        var id = row[0],
                            end = row[2],
                            color = row[3],
                            text = row[4],
                            timeText = getClockTime(date, false, true);

                        if (end)
                            timeText += '-' + getClockTime(end, false, true);

                        var drawText = String.format('<span class="app-event-time">{0}</span> {1}', timeText, text ? text : resources.Data.NullValueInForms),
                            li = $li('app-event').data('data-context', row),
                            title = calendar.getEventTitle(date, end, text, color),
                            colorClass = calendar.activeCalendar.colorMap.className(color);

                        if (!dataView.get_isTagged('calendar-drag-disabled'))
                            li.attr('data-draggable', 'calendar-event');

                        // determine whether to show time 

                        if (!dayDate)
                            dayDate = date;

                        // show selection
                        if (key && key == id) {
                            li.addClass('app-calendar-selected');
                            selectedRecord = li;
                        }

                        li.addClass(colorClass);
                        li.html(drawText);
                        li.attr('title', title);
                        li.appendTo(dayList);
                        num++;
                        if (dayList.height() > monthTdHeight && dayCount != 1) {
                            li.remove();
                            showMore = true;
                            num--;
                            break;
                        }
                    }

                    if (showMore || num < dayData.count) {
                        more.appendTo(dayList);
                        if (showMore) {
                            var prev = more.prev();
                            if (prev.length) {
                                more.prev().remove();
                                num--;
                            }
                        }
                        more.html(String.format(monthMoreFormat, dayCount - num));

                        // show selected record inside more
                        if (key && keyDay)
                            if (keyDay.getDate() == dayDate.getDate() && keyDay.getMonth() == dayDate.getMonth() && keyDay.getFullYear() == dayDate.getFullYear())
                                if (!selectedRecord || (selectedRecord && !selectedRecord.is(':visible')))
                                    more.addClass('app-calendar-selected');
                    }
                }
            },
            getNextDate: function (view, increment) {
                var calendar = this.calendar,
                    visible = calendar.getMostVisibleBlock(),
                    date = getDateOfBlock(visible);
                date.setMonth(date.getMonth() + increment, 1);

                // validate next block
                var view = calendar.getVisibleView(),
                    block = calendar.getBlockByDate(view, date);

                if (!block.length) {
                    if (increment == 1)
                        view.find('.dv-load-at-bottom').trigger('vclick');
                    else
                        view.find('.dv-load-at-top').trigger('vclick');
                }
                return date;
            },
            getBlocks: function () {
                var scrollable = this.calendar.scrollable();
                return scrollable.find('.app-calendar-monthview > .app-calendar-month');
            }
        };

        var Year = function (calendar) {
            this.calendar = calendar;
        };

        Year.prototype = {
            draw: function (container, startDate) {
                container.find('.app-calendar-yearview').remove();
                var view = $div('app-calendar-yearview').hide().appendTo(container),
                    isEcho = view.closest('.app-echo').length > 0,
                    distance = isEcho ? 0 : modeDrawDistance.year,
                    startYear = startDate.getFullYear();
                // add load at top button
                var loadAtTopBlock = $div('app-calendar-load-at-top').appendTo(view);
                $a('dv-load-at-top ui-btn').appendTo(loadAtTopBlock).text(resourcesHeaderFilter.Loading);
                if (isEcho)
                    loadAtTopBlock.hide();

                for (var year = startYear - distance; year <= startYear + distance; year++)
                    this.drawYear(new Date(year, 0)).appendTo(view);
                view.fadeIn('fast');

                // add load at bottom button
                var loadAtBottomBlock = $div('app-calendar-load-at-bottom').appendTo(view);
                $a('dv-load-at-bottom ui-btn').appendTo(loadAtBottomBlock).text(resourcesHeaderFilter.Loading);

                if (isEcho)
                    loadAtBottomBlock.hide();

                this.scroll({
                    view: view, date: startDate
                });
                return view;
            },
            showHeaderAndFooter: function (header, footer) {
                header.find('.app-day-header').hide();
                header.find('.app-week-header').hide();
                header.find('.app-month-header').hide();
                //$app.touch.bar('hide', footer);
            },
            // draws a single year block
            drawYear: function (date) {
                var year = date.getFullYear(),
                    yearBlock = '<div class="app-calendar-year" data-cal-year="' + year + '"><h1>' + date.getFullYearText() + '</h1>';
                for (var month = 0; month <= 11; month++) {
                    var monthName = dtf.AbbreviatedMonthNames[month].toUpperCase(),
                        monthBlock = '<div class="app-calendar-month" data-cal-month="'
                            + month + '"><div class="app-calendar-month-title"><a class="ui-btn app-calendar-month-header">'
                            + monthName + '</a></div><table><thead>';

                    for (var day = 0; day < 7; day++) {
                        monthBlock += '<th>' + dtf.ShortestDayNames[dayOfWeekDtf[day]].substr(0, 1) + '</th>';
                    }
                    monthBlock += '</thead><tbody>';

                    monthBlock += createMonthTableBody(year, month);
                    yearBlock += monthBlock + '</tbody></table></div>';
                }
                yearBlock += '<div class="app-clear-fix"></div></div>';

                // preload data
                var block = $(yearBlock),
                    data = this.calendar.cache.select(date);
                if (data)
                    this.addData(null, date, data, block.addClass('data-loaded'));
                return block;
            },
            // adds data to the specified date
            addData: function (view, date, data, block) {
                var calendar = this.calendar,
                    yearBlock = block || calendar.getBlockByDate(view, date, 'year');
                yearBlock.find('td.app-has-data').removeClass('app-has-data').attr('title', null);
                for (var month in data) {
                    var monthData = data[month],
                        monthBlock = yearBlock.find('div[data-cal-month="' + month + '"]');
                    monthBlock.find('td').each(function () {
                        var td = $(this),
                            day = td.text();
                        if (day.trim().length) {
                            var dayData = monthData[day];
                            if (dayData && dayData.count)
                                td.addClass('app-has-data').attr('title', String.format('{0} ({1})', calendar.activeCalendar.date.Label, dayData.count)); // dayData.length
                        }
                    });
                }
            },
            scroll: function (options) {
                var that = this,
                    date = options.date,
                    calendar = that.calendar,
                    scrollable = calendar.scrollable(),
                    presenter = options.view.closest('div.app-presenter'),
                    header = presenter.data('cal-header'),
                    scrollToPlaceholder = calendar.getBlockByDate(options.view, options.date);

                if (!scrollToPlaceholder)
                    return;
                scrollToPlaceholder = scrollToPlaceholder.find('div.app-calendar-month[data-cal-month="' + date.getMonth() + '"]');

                var instruction = scrollable.find('.app-presenter-instruction'),
                    newScrollTop = scrollToPlaceholder.offset().top + scrollable.scrollTop() - scrollable.offset().top - instruction.outerHeight();

                function complete() {
                    _touch.fetchOnDemand();
                    calendar.updateHeader(header);
                    fetchCalendarData(scrollable);
                }

                if (options.animate)
                    _touch.animatedScroll(scrollable, newScrollTop, complete);
                else {
                    _touch.scroll(scrollable, newScrollTop);
                    complete();
                }
            },
            clear: function (emptyView) {
                var scrollable = this.calendar.scrollable(),
                    view = scrollable.find('.app-calendar-yearview');

                if (view.length) {
                    var blocks = view.find('div.app-calendar-year.data-loaded');

                    blocks.removeClass('data-loaded').removeData('calendar-colors');
                    if (emptyView)
                        blocks.find('.app-has-data').removeClass('app-has-data').attr('title', null);
                }
            },
            resize: function (view, header, footer) {
                if (this.calendar.navigateDate)
                    this.scroll({
                        view: view, date: this.calendar.navigateDate
                    });
            },
            getNextDate: function (view, increment) {
                var calendar = this.calendar,
                    visible = calendar.getMostVisibleBlock(),
                    date = getDateOfBlock(visible);
                date.setYear(date.getFullYear() + increment);

                // try to scroll to next block
                var view = calendar.getVisibleView(),
                    block = calendar.getBlockByDate(view, date);

                if (!block.length) {
                    if (increment == 1)
                        view.find('.dv-load-at-bottom').trigger('vclick');
                    else
                        view.find('.dv-load-at-top').trigger('vclick');
                }
                return date;
            },
            getBlocks: function () {
                var scrollable = this.calendar.scrollable();
                return scrollable.find('.app-calendar-yearview > .app-calendar-year');
            }
        };

        var Agenda = function (calendar) {
            this.calendar = calendar;
        };

        Agenda.prototype = {
            draw: function (container, startDate) {
                var view = container.find('.app-calendar-agendaview');

                if (!view.length)
                    view = $div('app-calendar-agendaview').appendTo(container);

                var that = this,
                    calendar = this.calendar,
                    config = calendar.activeCalendar,
                    dataView = calendar.dataView,
                    isEcho = view.closest('.app-echo').length > 0,
                    date = new Date(startDate),
                    list = view.find('.app-calendar-agenda-list'),
                    listWasVisible = list.length && view.is('.data-loaded'),
                    scrollable = view.closest('.app-wrapper'),
                    instruction = scrollable.find('.app-presenter-instruction'),
                    loadAtTopBlock = view.find('.app-calendar-load-at-top'),
                    loadAtBottomBlock = view.find('.app-calendar-load-at-bottom'),
                    stub;
                //footer = view.find('.app-echo-footer');

                // hide instruction bar to prevent blink
                if (!isEcho)
                    instruction.css('visibility', 'hidden');
                else
                    view.height(calendar.echoMaxHeight);

                if (!listWasVisible) {

                    // draw list
                    if (!list.length)
                        list = $ul('app-calendar-agenda-list').hide().appendTo(view);

                    // add load at top/bottom button
                    if (!isEcho) {
                        if (!loadAtTopBlock.length) {
                            loadAtTopBlock = $div('app-calendar-load-at-top').hide().prependTo(view);
                            $a('dv-load-at-top ui-btn').text(resourcesHeaderFilter.Loading).appendTo(loadAtTopBlock);
                        }
                        if (!loadAtBottomBlock.length) {
                            loadAtBottomBlock = $div('app-calendar-load-at-bottom').hide().appendTo(view);
                            $a('dv-load-at-bottom ui-bt').text(resourcesHeaderFilter.Loading).appendTo(loadAtBottomBlock);
                        }
                    }
                    // add footer
                    //else
                    //    if (!footer.length)
                    //        footer = $('<div class="app-echo-footer"><div class="app-echo-container-see-all"><a class="ui-btn-icon-left ui-btn ui-icon-carat-r dv-action-see-all"/></div></div>').hide().appendTo(view);
                }

                calendar.cache.clearAgenda();
                that.minPage = 0;
                that.maxPage = 0;
                that.todayLoaded = false;
                that.lastDate = date;

                that.loadData(view, date, 0, function (next, nextCount) {
                    that.loadData(view, date, -1, function (prev, lastCount) {

                        list.empty();

                        // join pages
                        var pages = { '0': next['0'], '-1': prev['-1'] },

                            // render data
                            visibleCounts = that.drawData(view, date, pages),

                            // get data
                            nextPage = that.calendar.cache.select(1),
                            prevPage = that.calendar.cache.select(-2);

                        // show view
                        list.show();
                        view.fadeIn('fast').css('height', '');

                        if (!isEcho) {
                            instruction.css('visibility', '');
                            if (!nextPage || nextPage.length != 0)
                                loadAtBottomBlock.show();

                            if (!prevPage || prevPage.length != 0)
                                loadAtTopBlock.show();

                            that.scroll({ view: view, date: startDate });
                        }
                        else {
                            var prevIndex = visibleCounts[0],
                                nextIndex = visibleCounts[1],
                                total = nextCount + lastCount,
                                countVisible = prevIndex + nextIndex,
                                startIndex = lastCount - prevIndex + 1,
                                endIndex = startIndex + countVisible - 1;

                            if (countVisible != total) {
                                var seeAll = footer.find('.dv-action-see-all');
                                seeAll.empty();
                                footer.show();
                                $span('app-btn-see-all').appendTo(seeAll).text(resourcesMobile.SeeAll).attr('title', resourcesMobile.SeeAll);
                                $span('app-info').appendTo(seeAll)
                                    .attr({ 'data-start-index': startIndex, 'data-end-index': endIndex })
                                    .html(String.format(resourcesPager.ShowingItems, startIndex, endIndex, total));
                            }
                        }
                    });
                });
                return view;
            },
            showHeaderAndFooter: function (header, footer) {
                header.find('.app-day-header').hide();
                header.find('.app-week-header').hide();
                header.find('.app-month-header').hide();
                //$app.touch.bar('hide', footer);
            },
            getNextDate: function (view, increment) {
                var scrollable = this.calendar.scrollable(),
                    scrollTop = scrollable.scrollTop(),
                    visible = this.calendar.getFirstVisibleBlock(scrollable),
                    firstDate = view.find('.app-calendar-agenda-list li:not(.app-calendar-month-header)').first();

                // click next page if necessary
                if (getDateOfBlock(visible).getTime() == getDateOfBlock(firstDate).getTime()) {
                    var loadTop = view.find('.dv-load-at-top');
                    if (loadTop.is(':visible'))
                        loadTop.trigger('vclick');
                }
                else if (increment == 1 && scrollTop + scrollable.height() > scrollable[0].scrollHeight - 20) {
                    var loadBottom = view.find('.dv-load-at-bottom');
                    if (loadBottom.is(':visible'))
                        loadBottom.trigger('vclick');
                }

                var next = increment == 1 ? visible.next() : visible.prev();

                if (next.is('.app-calendar-month-header'))
                    next = increment == 1 ? next.next() : next.prev();

                if (next.length)
                    return getDateOfBlock(next);
                else
                    return getDateOfBlock(visible);
            },
            scroll: function (options) {
                var calendar = this.calendar,
                    view = options.view || calendar.getVisibleView(),
                    date = options.date;

                // redraw view if stale
                if (!view.hasClass('data-loaded')) {
                    this.draw(view.closest('.app-calendar'), date);
                    return;
                }

                var scrollable = calendar.scrollable(),
                    presenter = view.closest('.app-presenter'),
                    header = presenter.data('cal-header'),
                    scrollTo = calendar.getBlockByDate(view, date),
                    firstBlock = this.getBlocks().first(),
                    firstDate = getDateOfBlock(firstBlock),
                    instruction = scrollable.find('.app-presenter-instruction');

                if (!scrollTo.length) {
                    scrollTo = firstBlock;
                    // find correct block
                    while (scrollTo.length && getDateOfBlock(scrollTo) <= date) {
                        scrollTo = scrollTo.next();
                        if (scrollTo.is('.app-calendar-month-header'))
                            scrollTo = scrollTo.next();
                    }
                }
                else
                    scrollTo = scrollTo.closest('.app-agenda-day-list');

                if (scrollTo.length) {

                    var newScrollTop = 0,
                        complete = function () {
                            _touch.fetchOnDemand();
                            fetchCalendarData(scrollable);
                        };

                    if (!isSameDay(date, firstDate))
                        newScrollTop = scrollable.scrollTop() + scrollTo.offset().top - scrollable.offset().top - instruction.height();

                    if (options.animate)
                        _touch.animatedScroll(scrollable, newScrollTop, complete);
                    else {
                        _touch.scroll(scrollable, newScrollTop);
                        complete();
                    }
                }

            },
            resize: function (view, header, footer) {
                if (this.calendar.navigateDate)
                    this.scroll({ view: view, date: this.calendar.navigateDate });
            },
            clear: function (view) {
                if (!view)
                    view = this.calendar.getViews().filter('.app-calendar-agendaview');
                view.removeClass('data-loaded');
                view.find('.app-calendar-load-at-top, .app-calendar-load-at-bottom').hide();
                this.todayLoaded = false;
                this.calendar.cache.clearAgenda();
            },
            // loads data into view
            // returns added height
            loadData: function (view, date, page, dataCallback) {
                if (!date)
                    date = this.lastDate;
                var that = this,
                    calendar = that.calendar,
                    config = calendar.activeCalendar,
                    dataView = calendar.dataView,
                    isEcho = view.closest('.app-echo').length > 0,
                    list = view.find('.app-calendar-agenda-list'),
                    isBackSearch = page < 0,
                    sort = config.date.Name + (isBackSearch ? ' desc' : ' asc'),
                    pages = {},
                    pageIndex = page >= 0 ? page : Math.abs(page) - 1;
                // save 
                if (page > that.maxPage)
                    that.maxPage = page;
                else if (page < that.minPage)
                    that.minPage = page;

                var data = calendar.cache.select(page);

                if (!data) {
                    calendar.loadingData = true;
                    _app.execute({
                        controller: dataView._controller,
                        view: dataView._viewId,
                        command: 'Select',
                        _filter: !isBackSearch ? getDateFilter(dataView, config.date, config.end, date, null) : getDateFilter(dataView, config.date, config.end, null, date),
                        sort: sort,
                        pageSize: agendaPageSize * 2,
                        pageIndex: pageIndex / 2,
                        requiresRowCount: true,
                        tags: dataView.get_tags(),
                        includeRawResponse: true,
                        success: function (result) {
                            calendar.loadingData = false;
                            var results = result.rawResponse.Rows,
                                isLastPage = result.totalRowCount <= (pageIndex + 1) * agendaPageSize * 2;

                            if (calendar.mode != 'agenda')
                                return;

                            var page1 = results.splice(0, agendaPageSize),
                                page2 = results;

                            if (!isBackSearch) {
                                calendar.cache.insert(page, page1);
                                calendar.cache.insert(page + 1, page2);
                                // no more records
                                if (isLastPage)
                                    calendar.cache.insert(page + 2, []);
                            }
                            else {
                                page1.reverse();
                                page2.reverse();
                                calendar.cache.insert(page, page1);
                                calendar.cache.insert(page - 1, page2);
                                if (isLastPage)
                                    calendar.cache.insert(page - 2, []);
                            }
                            pages[page] = page1;

                            if (dataCallback)
                                dataCallback(pages, result.totalRowCount);
                            else
                                that.drawData(view, date, pages, result.totalRowCount);
                        },
                        error: function (error) {
                            calendar.loadingData = false;
                            _app.alert(String.format('{0}', error.get_message()));
                        }
                    });
                }
                else {
                    pages[page] = data;
                    if (dataCallback)
                        dataCallback(pages);
                    else
                        that.drawData(view, date, pages);
                }
            },
            drawData: function (view, date, pages) {
                var that = this,
                    calendar = that.calendar,
                    list = view.find('.app-calendar-agenda-list'),
                    scrollable = calendar.scrollable(),
                    isEcho = view.closest('.app-echo').length > 0,
                    config = calendar.activeCalendar,
                    dataView = calendar.dataView,
                    startName = config.date.Index,
                    textName = config.text.Index,
                    colorName = config.color && config.color.Index,
                    endName = config.end && config.end.Index,
                    keyField = calendar.dataView._keyFields[0],
                    commandRow = calendar.dataView.extension().commandRow(),
                    key = commandRow ? commandRow[keyField.Index] : null,
                    mostVisible = calendar.getMostVisibleBlock(),
                    oldTop = mostVisible ? mostVisible.position().top : 0,
                    alias;

                if (config.text.AliasName && config.text.AliasName.length) {
                    alias = dataView.findField(config.text.AliasName);
                    if (alias)
                        textName = alias.Index;
                }
                if (config.color && config.color.AliasName && config.color.AliasName.length) {
                    alias = dataView.findField(config.color.AliasName);
                    if (alias)
                        colorName = alias.Index;
                }

                function drawRow(row, reverse) {
                    var id = keyField && row[keyField.Index],
                        start = row[startName],
                        text = row[textName],
                        end = endName !== undefined && row[endName],
                        color = colorName !== undefined && row[colorName],
                        colorClass = config.colorMap.className(color),
                        dayList = that.getDayList(list, start, reverse ? 'prepend' : 'append'),
                        li = $li().attr('data-cal-page', page),
                        timeSpan = $span('app-event-time').appendTo(li),
                        timeSpanText = getClockTime(start),
                        div = $div('app-event').text(text ? text : resources.Data.NullValueInForms).data('data-context', row).appendTo(li);

                    div.attr('title', calendar.getEventTitle(start, end, text, color)).addClass(colorClass);

                    // show selection
                    if (key && key == id)
                        div.addClass('app-calendar-selected');

                    // show time
                    if (end)
                        timeSpanText += ' - ' + getClockTime(end);
                    timeSpan.text(timeSpanText);
                    $div('app-event-time').text(timeSpanText).appendTo(div);


                    if (reverse)
                        li.prependTo(dayList);
                    else
                        li.appendTo(dayList);

                    return li;
                }

                // echo rendering mode
                if (isEcho) {
                    var next = that.calendar.cache.select(0),
                        prev = that.calendar.cache.select(-1),
                        prevKey = prev.length && prev[0][keyField.Name],
                        nextIndex = 0,
                        prevIndex = 0,
                        useNext = true,
                        first = true,
                        maxHeight = calendar.echoMaxHeight,// - view.find('.app-echo-footer').height(),
                        length = next.length + prev.length,
                        count = 0,
                        firstLi, firstYear, eventToRemove;


                    while ((list.outerHeight(true) < maxHeight || count < 3) && count < length) {

                        if (next.length <= nextIndex) {
                            useNext = false;
                        }
                        if (prev.length <= prevIndex) {
                            if (next.length <= nextIndex)
                                break;
                            useNext = true;
                            first = false;
                        }
                        var row = useNext && !first ? next[nextIndex++] : prev[prevIndex++];

                        if (row) {
                            count++;
                            drawRow(row, !useNext);
                        }
                        else {
                            if (useNext)
                                nextIndex--;
                            else
                                prevIndex--;
                            useNext = false;
                        }
                        if (first)
                            first = false;
                    }

                    // add current time line
                    that.validateToday(list, list.children(), date);

                    // add year header
                    firstLi = list.find('.app-agenda-day-list:first');
                    firstYear = firstLi.attr('data-cal-year');
                    if (firstLi.length && firstYear != new Date().getFullYear().toString())
                        $htmlTag('h1').appendTo($('<li class="app-calendar-month-header" data-cal-year="' + firstYear + '" data-cal-month="' + firstLi.attr('data-cal-month') + '"/>').insertBefore(firstLi)).text(firstYear);

                    // remove extra events
                    firstLi = list.find('li.app-agenda-day-list').first();
                    var useLast = false,
                        inner = firstLi.find('li').first();
                    while (list.outerHeight(true) > maxHeight && count > 3) {

                        var context = inner.find('.app-event').data('data-context'),
                            contextKey = context && context[keyField.Index];
                        if (key && (contextKey == key || contextKey == prevKey)) {
                            useLast = true;
                        }
                        else {

                            inner.remove();
                            count--;

                            // remove empty days
                            if (firstLi.find('li').length == 0) {
                                firstLi.remove();
                                if (useLast)
                                    nextIndex--;
                                else
                                    prevIndex--;
                            }
                        }

                        if (!useLast) {
                            firstLi = list.find('li.app-agenda-day-list').first();
                            inner = firstLi.find('li').first();
                        }
                        else {
                            firstLi = list.find('li.app-agenda-day-list').last();
                            inner = firstLi.find('li').last();
                        }

                    }

                    return [prevIndex, nextIndex];
                }

                else {
                    for (var page in pages) {
                        var data = pages[page],
                            reverse = page < 0;

                        // hide load-at-top/bottom, no more records
                        if (data.length < agendaPageSize) {
                            var prev = view.find('.app-calendar-load-at-top'),
                                next = view.find('.app-calendar-load-at-bottom');

                            if (!reverse)
                                next.hide();
                            else
                                prev.hide();
                        }

                        if (data.length > 0)
                            for (var rowNum in data)
                                drawRow(data[rowNum], reverse);
                    }


                    // ensure headers
                    var blocks = calendar.getBlocks(),
                        handledHeaders = [],
                        thisYear = currentDate.getFullYear();
                    blocks.each(function () {
                        var day = $(this),
                            year = day.attr('data-cal-year'),
                            month = day.attr('data-cal-month'),
                            key = year + '-' + month;

                        if (handledHeaders[key])
                            return true;

                        monthHeader = view.find(String.format('li.app-calendar-month-header[data-cal-year="{0}"][data-cal-month="{1}"]', year, month));
                        if (!monthHeader.length) {
                            monthHeader = $(String.format('<li class="app-calendar-month-header ui-btn" data-cal-year="{0}" data-cal-month="{1}"><h1>{2}</h1></li>', year, month, dtf.MonthNames[month])).insertBefore(day);
                            if (year != thisYear)
                                monthHeader.find('h1').text(dtf.MonthNames[month] + ' ' + year);
                        }

                        var prev = day.prev();
                        while (prev.length) {
                            if (prev.attr('data-cal-year') != year || prev.attr('data-cal-month') != month) {
                                monthHeader.insertBefore(prev.next());
                                break;
                            }
                            prev = prev.prev();
                        }

                        handledHeaders[key] = true;
                    });

                    that.validateToday(list, blocks, date);
                    view.addClass('data-loaded');

                    // set scroll position
                    if (mostVisible && reverse)
                        _touch.scroll(scrollable, mostVisible.position().top - oldTop);
                }
            },
            validateToday: function (list, blocks, date) {
                // ensure today 
                if (!this.todayLoaded) {
                    var first = blocks.first(),
                        firstDate = first.length ? getDateOfBlock(first) : date,
                        last = blocks.last(),
                        lastDate = last.length ? getDateOfBlock(last) : date,
                        inRange = firstDate < currentDay && currentDay < lastDate,
                        prevEvent, eventAfterTimeLine;

                    if (inRange || isToday(date)) {
                        this.todayLoaded = true;

                        var today = this.getDayList(list, currentDay, 'search');

                        if (today.find('.app-time-line-container').length)
                            return;

                        var todayRow = today.parents('li[data-cal-year]'),
                            now = new Date(),
                            timeLineLi = $li('app-time-line-container').appendTo(today),
                            calendar = this.calendar,
                            calendarFieldIndex = calendar.dataView.findField(calendar.activeCalendar.date.Name).Index;
                        $span('app-event-time').text(getClockTime(now)).appendTo(timeLineLi);
                        timeLine = $('<div class="current-time-line"><div class="dot">&nbsp;</div></div>').appendTo(timeLineLi);
                        todayRow.addClass('app-has-current-day');
                        prevEvent = timeLineLi.prev();
                        while (prevEvent.length) {
                            var event = prevEvent.find('.app-event'),
                                context = event.data('data-context');
                            if (context && context[calendarFieldIndex] > now)
                                eventAfterTimeLine = prevEvent;
                            else
                                break;
                            prevEvent = prevEvent.prev();
                        }
                        if (eventAfterTimeLine)
                            timeLineLi.insertBefore(eventAfterTimeLine);
                    }
                }
            },
            removeData: function (view, page) {

                // remove page
                view.find('.app-calendar-agenda-list li[data-cal-page="' + page + '"]').remove();

                // restore pager
                if (page == this.maxPage) {
                    view.find('.app-calendar-load-at-bottom .ui-btn').addClass('dv-load-at-bottom').text(resourcesHeaderFilter.Loading).show();
                    this.maxPage--;
                }
                else if (page == this.minPage) {
                    view.find('.app-calendar-load-at-top .ui-btn').addClass('dv-load-at-top').text(resourcesHeaderFilter.Loading).show();
                    this.minPage++;
                }

                this.removeEmptyRows(view);
            },
            getDayList: function (list, date, insertMode) {
                var dayList = this.calendar.getBlockByDate(list, date);
                if (!dayList.length) {
                    var listLi = $li('app-agenda-day-list')
                        .attr('data-cal-year', date.getFullYear())
                        .attr('data-cal-month', date.getMonth())
                        .attr('data-cal-day', date.getDate()),
                        dayName = dtf.AbbreviatedDayNames[date.getDay()],
                        dayHeader = $(String.format('<h2 class="ui-btn">'
                            + '<span class="app-calendar-daynumbig">{2}</span>'
                            + '<span class="app-calendar-dayname">{0}</span> '
                            + '<span class="app-calendar-monthname">{1}</span> '
                            + '<span class="app-calendar-daynum">{2}</span></h2>', dayName, dtf.AbbreviatedMonthNames[date.getMonth()], date.getDate())).appendTo(listLi).attr('title', String.format('{0:' + dtf.LongDatePattern + '}', date)),
                        dayDiv = $div('app-calendar-day').appendTo(listLi),
                        yesterday = new Date(),
                        tomorrow = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    tomorrow.setDate(yesterday.getDate() + 1);

                    if (isToday(date))
                        listLi.addClass('app-calendar-agenda-today');
                    else if (isSameDay(date, yesterday))
                        listLi.addClass('app-calendar-agenda-yesterday');
                    else if (isSameDay(date, tomorrow))
                        listLi.addClass('app-calendar-agenda-tomorrow');


                    if (insertMode == 'prepend')
                        listLi.prependTo(list);
                    else if (insertMode == 'append')
                        listLi.appendTo(list);
                    else {
                        var block = list.find('li[data-cal-year]:first'),
                            lastBlock,
                            blockDate,
                            inserted = false;
                        while (block.length) {
                            blockDate = getDateOfBlock(block);
                            if (date < blockDate) {
                                listLi.insertBefore(block);
                                inserted = true;
                                break;
                            }
                            lastBlock = block;
                            block = block.next();
                        }
                        if (!inserted)
                            listLi.appendTo(list);
                    }

                    // create day list
                    dayList = $ul().appendTo(dayDiv);
                    appendClearFix(listLi);
                }
                return dayList;
            },
            removeEmptyRows: function (view) {
                view.find('.app-calendar-agenda-list > li').each(function () {
                    var block = $(this),
                        isHeader = block.is('.app-calendar-month-header'),
                        date = getDateOfBlock(block);

                    if (isHeader) {
                        var monthBlocks = view.find(String.format('li[data-cal-year="{0}"][data-cal-month="{1}"][data-cal-day]', date.getFullYear(), date.getMonth()));
                        if (monthBlocks.length == 0)
                            block.remove();
                    }
                    else {
                        var events = block.find('ul .app-event');
                        if (events.length == 0)
                            block.remove();
                    }
                });
            },
            getBlocks: function () {
                var scrollable = this.calendar.scrollable();
                return scrollable.find('.app-calendar-agendaview > .app-calendar-agenda-list > li:not(.app-calendar-month-header)');
            }
        };

        // detects if the current view supports calendar
        function supportsCalendar(dataView) {
            if (dataView.calendar)
                return true;

            if (dataView._keyFields.length > 1)
                return false;

            var calendars = composeCalendars(dataView),
                autoCalendars = [],
                doesSupport = false,
                sidebar = _touch.sidebar();

            // examples of tags
            // calendar1-start
            // calendar1-end
            // calendar1-text
            // calendar1-name:"My Calendar"
            // calendar1-color

            if ($.isEmptyObject(calendars))
                return false;
            else {
                dataView.calendar = new Calendar(dataView, calendars);
                if (!dataView.calendarPlugin)
                    dataView.calendarPlugin = new CalendarPlugin(dataView, calendars);
                return true;
            }
        }

        _touch.presenter('register', {
            name: 'calendar',
            icon: function () {
                return 'calendar';
            },
            text: function () {
                return resourcesCalendar.Text;
            },
            supports: supportsCalendar,
            show: function (options) {
                var dataView = _app.find(options.id);
                if (dataView && dataView.calendar)
                    dataView.calendar.show(options);

            },
            hide: function (options) {
                var dataView = activeDataView();
                if (dataView && dataView.calendar)
                    dataView.calendar.hide(options);
            },
            dispose: function (options) {
                var dataView = activeDataView();
                if (dataView && dataView.calendar) {
                    dataView.calendar.dispose(options);
                    delete dataView.calendar;
                }
            }

        });

        function scaleTransition(from, to, hiddenCallback, afterCallback) {
            from.css({ transform: '', opacity: 1 }).addClass('app-scale');
            setTimeout(function () {
                var timeout = setTimeout(function () {
                    from.off('transitionend', out);
                    out();
                }, 500);

                function out() {
                    clearTimeout(timeout);
                    from.hide();
                    if (hiddenCallback)
                        hiddenCallback();
                    to.removeClass('app-scale').show().css({ transform: 'scale(0.75)', opacity: 0 });
                    setTimeout(function () {

                        timeout = setTimeout(function () {
                            to.off('transitionend', fin);
                        }, 500);

                        function fin() {
                            to.removeClass('app-scale');
                            if (afterCallback)
                                afterCallback();
                        }

                        to
                            .addClass('app-scale')
                            .one('transitionend', fin)
                            .css({ transform: 'scale(1)', opacity: 1 });
                    });
                    return false;
                }

                from.one('transitionend', out).css({ transform: 'scale(0.75)', opacity: 0 });
            });
        }

        var CalendarInput = _touch.CalendarInput = (function (method, options) {
            if (CalendarInput.ignoreShow) {
                CalendarInput.ignoreShow = false;
                return false;
            }
            if (!options)
                options = {};
            if (!options.container)
                options.container = $body.find('.app-calendar-plugin-container');

            var input = options.input,
                outerContainer = options.container,
                inputContainer = options.inputContainer || (outerContainer && outerContainer.data('data-input')) || (input && input.closest('[data-input]')),
                field = options.field = options.field || (inputContainer && _app.input.elementToField(inputContainer)),
                dataView = options.dataView = options.dataView || (field && field._dataView),
                fieldName = field && field.Name,
                kioskOnTop = _touch.kiosk('ontop'),
                isPopup = _touch.pointer('touch') || kioskOnTop || options.modal;

            // return true if preventDefault()
            function attach() {
                if (field.tagged('calendar-input-disabled'))
                    return false;

                // configure vars
                var wrapper = inputContainer.closest('.app-wrapper'),
                    cover = $body.find('.app-calendar-cover');

                if (!outerContainer.length) {
                    outerContainer = options.container = $div('app-calendar-plugin-container app-data-input-helper').hide().appendTo($body);
                    $div('ui-btn ui-btn-icon-notext app-calendar-btn-close material-icon').appendTo(outerContainer).attr('title', resources.ModalPopup.Close);
                }
                if (!cover.length)
                    cover = $div('app-calendar-cover', 'style="display:none"').appendTo($body);
                outerContainer.data('data-input', inputContainer);

                // configure options
                var isTimeFormat = field.DataFormatString == '{0:t}' || field.DataFormatString == '{0:T}';
                options.showTime = !!(field.TimeFmtStr || isTimeFormat);
                options.hideDate = isTimeFormat;
                if (field.tagged('calendar-input-future')) {
                    options.limitStart = new Date();
                    options.limitStart.setHours(0, 0, 0, 0);
                }

                // get date
                if (!validateDate(options.date)) {
                    if (input && input.length)
                        options.date = dataView.convertStringToFieldValue(field, input.val());
                    if (!validateDate(options.date))
                        options.date = new Date();
                }
                outerContainer.data('select-date', options.date);

                if (outerContainer.is('.app-hidden')) return;

                options.onselect = function (options) {
                    options.date.setSeconds(0, 0);

                    var monthContainer = options.target.closest('.app-month-container');
                    if (monthContainer.length) {
                        setDateOfBlock(monthContainer, options.date);
                        monthContainer.find('.app-selected').removeClass('app-selected');
                        findDayCell(outerContainer, options.date).addClass('app-selected');
                        vibrate();
                    }

                    outerContainer.data('select-date', options.date);

                    if (!outerContainer.find('.app-calendar-action-bar:visible').length) {
                        // update field
                        var field = options.dataView.findField(fieldName);
                        if (field) {
                            setInput(options.dataView, field, input, options.date);

                            if (options.endField) {
                                // shift focus to end field
                                if (!field.TimeFmtStr || (options.oldTimeMode == 'Minute' && options.target.closest('.app-time-selector').length)) {
                                    setTimeout(function () {
                                        input.blur();
                                        _app.input.execute({ dataView: dataView, values: [{ name: options.endField, value: options.date }] });
                                        setTimeout(function () {
                                            wrapper.find(String.format('[data-field="{0}"]', options.endField)).first().trigger('vclick');
                                        }, 10);
                                    }, 250);
                                }
                            }
                            //else if (!touchPointer && input.parent().length)
                            //    input.trigger('input').focus();
                        }
                        // hide input when final selection
                        if (!options.mode && !outerContainer.find('.app-time-container:visible').length) {
                            CalendarInput.ignoreShow = true;
                            hide();
                        }
                    }
                };
                options.onrefresh = function (options) {
                    options.monthContainer.find('.app-selected').removeClass('app-selected');
                    var date = options.container.data('select-date') || options.date;
                    if (validateDate(date))
                        findDayCell(options.monthContainer, date).addClass('app-selected');
                };
                options.attachCallbacks = true;

                // add handlers
                if (input)
                    input.attr('data-datepicker-attached', true);
                $body.on('mousedown', calendarBodyClick);

                CalendarControl('attach', configureOptions(options));
            }

            function focus(skipTouchCheck) {

                if (!options.modal)
                    if (isPopup && !skipTouchCheck) {
                        $('.app-data-input').blur();
                        setTimeout(focus, 300, true);
                        return true;
                    }

                var cover = $body.find('.app-calendar-cover'),
                    top,
                    left,
                    screen = _touch.screen(),
                    screenWidth = screen.width,
                    screenHeight = screen.height,
                    center = screenWidth <= 480 && screenHeight <= 480 || kioskOnTop,
                    modal = isPopup || center,
                    isExtraSmallScreen = _touch.toWidth('xs') >= screenWidth,
                    isVertical = isExtraSmallScreen && screenWidth < screenHeight;


                if (options.date)
                    outerContainer.data('select-date', options.date);

                outerContainer.toggleClass('app-calendar-wide', !isVertical);
                outerContainer.toggleClass('app-calendar-comfortable', !isVertical && !isExtraSmallScreen);

                outerContainer.toggleClass('app-calendar-show-bar', modal);

                var containerHeight = outerContainer.outerHeight(),
                    containerWidth = outerContainer.outerWidth(),
                    inputPos = inputContainer.offset();

                if (!center) {

                    left = inputPos.left;
                    // check right
                    if (left + containerWidth >= + screenWidth + screen.left - 1)
                        left = screenWidth + screen.left - containerWidth - 10; // shadow

                    // place above input
                    if (isPopup) {
                        top = inputPos.top - containerHeight;
                        if (top < screen.top) {
                            // below
                            top = inputPos.top + inputContainer.outerHeight();
                            if (top + containerHeight > screenHeight + screen.top)
                                center = modal = true;
                        }
                    }
                    else {
                        // place below input
                        top = inputPos.top + inputContainer.outerHeight() + 12;
                        if (top + containerHeight > screenHeight + screen.top) {
                            // position above
                            top -= containerHeight + inputContainer.outerHeight() + 14;
                            if (top < screen.top) {
                                center = modal = isPopup = true;
                                outerContainer.addClass('app-calendar-show-bar');
                            }
                        }
                    }
                }

                outerContainer.toggleClass('app-calendar-show-bar', modal);
                if (modal) {
                    if (!isPopup) {
                        CalendarInput.ignoreHide = true;
                        $('.app-data-input').blur();
                    }
                    cover.show();
                }
                else
                    cover.hide();

                if (center) {
                    // center of screen
                    top = screen.top + (screenHeight - containerHeight) / 2;
                    left = screen.left + (screenWidth - containerWidth) / 2;
                    //if (options.field)
                    //    _touch.notify({ text: options.field.HeaderText, force: true});
                }

                outerContainer.css({ top: top, left: left });

                if (kioskOnTop)
                    outerContainer.fadeIn('fast');
                else
                    outerContainer.show();

                return modal;
            }

            function calendarBodyClick(event) {
                var target = $(event.target);
                if (!target.closest('.app-input-text, .app-calendar-plugin-container, [data-field="' + fieldName + '"]').length) {
                    // detach
                    $body.off('mousedown', calendarBodyClick);
                    CalendarInput('hide', { container: outerContainer });
                }
            }

            function setInput(dataView, field, input, date) {
                var valid = validateDate(date);
                if (!valid && !field.AllowNulls)
                    date = new Date();
                if (isPopup || !input || input.parent().length == 0) {
                    _app.input.execute({ dataView: dataView, values: [{ name: field.Name, value: date }] });
                    if (!isPopup)
                        setTimeout(function () {
                            CalendarInput.ignoreShow = true;
                            _app.input.focus({ dataView: dataView, fieldName: field.Name });
                        }, 50);
                }
                else {
                    var newValue = field.format(date),
                        placeholder = input.data('placeholder');
                    input.val(newValue);//.trigger('keyup');
                    if (!isPopup)
                        input.focus()[0].setSelectionRange(newValue.length, newValue.length)
                    if (placeholder)
                        placeholder.css('display', 'none');
                    input.closest('[data-control]').find('.app-control-inner').text(newValue).removeData('last-smart-text');
                }
            }

            function hide() {
                if (CalendarInput.ignoreHide)
                    CalendarInput.ignoreHide = false;
                else {
                    findActivePage('.app-control-inner .app-cursor').remove();
                    outerContainer.hide();//.removeData('select-date');
                    $('.app-calendar-cover').hide();
                    $body.off('mousedown', calendarBodyClick);
                    if (input)
                        input.select();
                }
            }

            function configureOptions(o) {
                o.renderTime = true;
                o.excludeKeyFieldsFromFilter = true;
                o.queryData = function (field, fieldName) {
                    if (field && field.tagged('calendar-input-data-none'))
                        return false;
                    if (field && field.Name != fieldName || !field && fieldName)
                        return false;
                    return true;
                };
                o.limitStart = false;
                // detect date range
                if (field) {
                    var calendars = (dataView.calendar && dataView.calendar.calendars) || composeCalendars(dataView),
                        calLength = calendars.length;
                    for (var i = 0; i < calLength; i++) {
                        var cal = calendars[i];
                        if (cal.end) {
                            if (field.Name == cal.date.Name) {
                                options.endField = cal.end.Name;
                            }
                            else if (field.Name == cal.end.Name) {
                                options.startField = cal.date.Name;
                                var row = dataView.editRow();
                                options.limitStart = new Date(row[cal.date.Index]);
                                options.limitStart.setHours(0, 0, 0, 0);
                            }
                        }
                    }
                }

                return o;
            }

            switch (method) {
                case 'setInput':
                    setInput(options.dataView, field, input, options.date);
                    break;
                case 'clear':
                    setInput(options.dataView, field, input);
                    break;
                case 'hide':
                case 'escape':
                    hide();
                    break;
                //case 'escape':
                //    hide();
                //    if (options.container.is('.app-calendar-show-bar')) {
                //        CalendarInput.ignoreShow = true;
                //        _app.input.focus({ fieldName: options.field.Name });
                //    }
                //    break;
                case 'focus':
                    focus();
                    break;
                case 'activate':
                    if (isPopup || $window.width() <= 640 && $window.height() <= 640) {
                        attach();
                        return focus();
                    }
                    return false;
                case 'attach':
                    return attach();
                default:
                    return CalendarControl(method, configureOptions(options));
            }
        });
        CalendarInput.ignoreHide = false;

        $(document)
            .on('focus', '.app-data-input[data-datepicker-attached]', function (e) {
                var input = $(e.target);
                setTimeout(function () {
                    if (input.closest('.app-has-focus').length)
                        CalendarInput('focus', { input: input });
                }, 32);
            })
            .on('input', '.app-data-input[data-datepicker-attached]', function (e) {
                var input = $(e.target),
                    field = _app.input.eventToField(e), dv, d,
                    outerContainer = $body.find('.app-calendar-plugin-container');
                if (field) {
                    dv = field._dataView;
                    d = getInputDate(field, input.val());

                    if (validateDate(d)) {
                        outerContainer.data('select-date', d);
                        CalendarInput('setDate', {
                            input: input,
                            date: d,
                            dataView: dv,
                            container: outerContainer,
                            showTime: !!field.TimeFmtStr
                        });
                    }
                }
            })
            .on('remove.input.app', '.app-data-input[data-datepicker-attached]', function (e) {
                CalendarInput('hide');
            });


        function findDayCell(table, date) {
            return table.find(String.format('td[data-cal-month="{0}"][data-cal-day="{1}"]:not(.app-day-hidden)', date.getMonth(), date.getDate()));
        }

        function findMonthByDate(monthContainer, date) {
            return monthContainer.find(String.format('.app-scroll-column > div[data-cal-year="{0}"][data-cal-month="{1}"]', date.getFullYear(), date.getMonth()));
        }

        function getInputDate(field, dateStr) {
            var fv = { NewValue: dateStr };
            field._dataView._validateFieldValueFormat(field, fv, true)
            return fv.NewValue;
        }

        var CalendarControl = (function (method, options) {
            var outerContainer = options.container;
            if (outerContainer.is('.app-calendar-plugin'))
                outerContainer = outerContainer.parent();

            var container = outerContainer.find('.app-calendar-plugin'),
                monthContainer = container.find('.app-month-container'),
                selectorContainer = container.find('.app-date-selector-container'),
                timeContainer = outerContainer.find('.app-time-container'),
                actionBar = outerContainer.find('.app-calendar-action-bar'),
                oldMode = outerContainer.data('calendar-mode'),
                mode = options.mode != undefined ? options.mode : oldMode || '',
                oldTimeMode = outerContainer.data('calendar-time-mode'),
                timeMode = options.timeMode || oldTimeMode || 'Hour',
                showMonths = outerContainer.data('calendar-show-months') || options.months || 1,
                dataView = options.dataView || activeDataView(),
                cache = dataView.session('calendar-input-cache') || {},
                oldField = outerContainer.data('calendar-field'),
                field = options.field || oldField || getActiveCalendar().date,
                oldLimitStart = outerContainer.data('calendar-limit-start'),
                limitStart = options.limitStart === undefined ? oldLimitStart : options.limitStart,
                showTime = options.showTime,
                drawDate = new Date(options.date);

            if (!drawDate || !validateDate(drawDate)) {
                drawDate = getDateOfBlock(monthContainer);
                if (showTime)
                    getTimeOfBlock(timeContainer, drawDate);
            }

            if (mode != oldMode)
                outerContainer.data('calendar-mode', mode);
            if (timeMode != oldTimeMode)
                outerContainer.data('calendar-time-mode', timeMode);
            if (oldLimitStart != limitStart)
                outerContainer.data('calendar-limit-start', limitStart);
            if (oldField != field)
                outerContainer.data('calendar-field', field);
            if (options.months)
                outerContainer.data('calendar-show-months', options.months);


            function getActiveCalendar() {
                if (dataView.calendar)
                    return dataView.calendar.activeCalendar;
                return composeCalendars(dataView)[0];
            }

            function getMonthHeader(date) {
                return [
                    dtf.MonthNames[date.getMonth()] + ' ' + date.getFullYearText(),
                    dtf.AbbreviatedMonthNames[date.getMonth()] + ' ' + date.getFullYearText()
                ];
            }

            function getDate() {
                var d = getDateOfBlock(monthContainer);
                if (container.closest('.app-calendar-show-time').length)
                    getTimeOfBlock(timeContainer, d);
                return d;
            }

            function drawMonth(month, drawDate, doDrawHeader) {
                month.empty();
                var bodyText = '<table><thead>';

                // render subheader
                if (doDrawHeader) {
                    var subheader = $div().appendTo(month),
                        labels = getMonthHeader(drawDate);
                    subheader.text(labels[0]);
                    if (subheader[0].scrollWidth > subheader.innerWidth())
                        subheader.text(labels[1]);
                }

                for (var day = 0; day < 7; day++) {
                    var dayDtf = dayOfWeekDtf[day],
                        shortest = dtf.ShortestDayNames[dayDtf],
                        full = dtf.DayNames[dayDtf];
                    bodyText += '<th title="' + full + '">' + shortest + '</th>';
                }
                bodyText += '</thead><tbody>' + createMonthTableBody(drawDate.getFullYear(), drawDate.getMonth(), true) + '</tbody></table>';
                var table = $(bodyText).appendTo(month);

                if (!month.is('.app-first-month'))
                    table.find('td.app-prev-month').addClass('app-day-hidden');
                if (!month.is('.app-last-month'))
                    table.find('td.app-next-month').addClass('app-day-hidden');

                // hide empty rows
                table.find('tr').filter(function () {
                    return !$(this).find('td:not(.app-day-hidden), th').length;
                }).addClass('app-week-hidden');

                var currentDay = table.find('td.app-current-day');
                if (currentDay.length)
                    currentDay.html('<span class="app-current-day">' + currentDay.text() + '</span>');

                setDateOfBlock(month, drawDate);
            }

            function loadDataInMonth(month, date, data) {
                var keyValueRegex = /(\d+), (\d+)/;
                $(data).each(function () {
                    var val = this[1],
                        key = this[0];
                    if (val && val != 0) {
                        if (key.indexOf(', ') < 0)
                            key = key + ', ' + key;
                        var keyValues = keyValueRegex.exec(key);
                        if (keyValues) {
                            var monthN = parseInt(keyValues[1], 10) - 1,
                                day = keyValues[2],
                                dataDate = new Date(date.getFullYear(), monthN, day),
                                cell = findDayCell(month, dataDate);
                            cell.addClass('app-has-data').attr('title', String.format('{0} ({1})', field.Label, val));
                        }
                    }
                });
            }

            function refreshClock(timeContainer, drawDate, timeMode) {
                var time = new Date(drawDate);
                setTimeOfBlock(timeContainer, time);
                //getTimeOfBlock(timeContainer, time);
                var hourSelector = timeContainer.find('.app-hour-selector').hide(),
                    minuteSelector = timeContainer.find('.app-minute-selector').hide(),
                    minutes = minuteSelector.find('li'),
                    timeToShow = getTimeString(time),
                    hour = timeContainer.find('.app-time-hour'),
                    minute = timeContainer.find('.app-time-minute'),
                    ampm = timeContainer.find('.app-time-ampm'),
                    hand = timeContainer.find('.app-time-hand').removeClass('app-inner-ring app-dot'),
                    deg = 0,
                    is24hour = dtf.AMDesignator == '';

                hour.text(timeToShow.hour);
                minute.text(timeToShow.minute);

                timeContainer.find('.app-cal-selected').removeClass('app-cal-selected');
                switch (timeMode) {
                    case 'Hour':
                        hour.addClass('app-cal-selected');
                        hourSelector.show();
                        var hourT = drawDate.getHours();
                        if (!is24hour) {
                            if (hourT >= 12)
                                hourT -= 12;
                        }
                        else {
                            if (hourT < 12)
                                hand.addClass('app-inner-ring');
                        }
                        deg = hourT / 12 * 360;

                        // get hour
                        var hours = hourSelector.find('li');
                        hours.eq(hourT).addClass('app-cal-selected');
                        break;
                    case 'Minute':
                        minute.addClass('app-cal-selected');
                        minuteSelector.show();
                        var mins = drawDate.getMinutes();
                        deg = mins / 60 * 360;

                        if (mins % 5 != 0) {
                            hand.addClass('app-dot');
                        }
                        else {
                            minutes.eq(mins / 5).addClass('app-cal-selected');
                        }
                        break;
                }
                if (deg > 360)
                    deg -= 360;
                hand.css('transform', 'rotate(' + deg + 'deg)');

                // highlight AM/PM
                if (!is24hour) {
                    var spans = ampm.find('span');
                    spans.eq(timeToShow.ampm == dtf.AMDesignator ? 0 : 1).addClass('app-cal-selected');
                }
            }

            function refresh() {
                var monthContainerInner = monthContainer.find('.app-scroll-inner'),
                    months = monthContainer.find('.app-scroll-column > div'),
                    firstDate = getDateOfBlock(months.eq(showMonths)),
                    viewingDate = getDate(),
                    dateMonth = drawDate.getMonth(),
                    header = container.find('.app-calendar-plugin-header div'),
                    selectorContainerInner = selectorContainer.find('.app-scroll-inner'),
                    tempDate = new Date(drawDate),
                    reloadData = options.reloadData;

                if (isNaN(firstDate.getTime())) {
                    firstDate = new Date(drawDate);
                    firstDate.setMonth(firstDate.getMonth() - showMonths, 1);
                }

                // draw first header
                // update calendar
                switch (mode) {
                    case '':

                        // set up header
                        header.html(String.format(miniCalendarHeaderFormat,
                            dtf.MonthNames[drawDate.getMonth()], drawDate.getFullYearText(),
                            dtf.MonthNames[drawDate.getMonth()], drawDate.getFullYearText()));
                        var headerLink = header.find('a'),
                            linkWidth = headerLink.first().outerWidth() + headerLink.eq(2).outerWidth();

                        // abbr header
                        if (linkWidth > header.innerWidth() - 60)
                            header.html(String.format(miniCalendarHeaderFormat,
                                dtf.MonthNames[tempDate.getMonth()], drawDate.getFullYearText(),
                                dtf.AbbreviatedMonthNames[tempDate.getMonth()], drawDate.getFullYearText()));

                        if (drawDate.getFullYear() != firstDate.getFullYear() || drawDate.getMonth() != firstDate.getMonth()) {
                            reloadData = true;

                            tempDate.setMonth(tempDate.getMonth() - showMonths, 1);
                            months.each(function (i) {
                                var month = $(this);
                                drawMonth(month, tempDate, !month.is('.app-first-month'));
                                tempDate.setMonth(tempDate.getMonth() + 1);
                            });
                        }

                        // grey unselectable days
                        if (limitStart || options.limitEnd)
                            months.each(function () {
                                var month = $(this),
                                    localDate = getDateOfBlock(month);
                                month.find('td').filter(function () {
                                    var d = new Date(localDate),
                                        el = $(this);
                                    d.setMonth(el.closest('[data-cal-month]').attr('data-cal-month'), el.attr('data-cal-day'));
                                    if (el.is('.app-prev-month'))
                                        d.setMonth(localDate.getMonth() - 1);
                                    else if (el.is('.app-next-month'))
                                        d.setMonth(localDate.getMonth() + 1);

                                    if (limitStart && d < limitStart)
                                        return true;
                                    else if (options.limitEnd && d > options.limitEnd)
                                        return true;
                                    return false;
                                }).addClass('app-day-unselectable');
                            });
                        else
                            months.find('.app-day-unselectable').removeClass('app-day-unselectable');


                        function afterRender() {
                            monthContainerInner.css('marginLeft', '');
                        }

                        if (oldMode && oldMode != '')
                            scaleTransition(selectorContainer, monthContainer, null, afterRender);
                        else
                            afterRender();

                        // set hieght
                        setTimeout(function () {
                            var h = monthContainer.height();
                            if (h > 0) {
                                monthContainer.height(h);
                                selectorContainer.height(h);
                            }
                        });
                        break;
                    case 'selectmonth':
                        header.html(String.format('<a class="ui-btn app-year-picker">{0}</a>', tempDate.getFullYearText()));
                        tempDate.setFullYear(tempDate.getFullYear() - 1);
                        var monthHeight = Math.floor(monthContainer.height() / 3) - 10,
                            renderMonth = function () {
                                selectorContainer.find('.app-scroll-column').each(function () {
                                    var column = $(this).empty();
                                    setDateOfBlock(column, tempDate);
                                    for (var i = 0; i < 12; i++) {
                                        var mon = $(String.format('<div class="app-select-month ui-btn" data-cal-month="{0}" title="{2}">{1}</div>', i, dtf.AbbreviatedMonthNames[i], dtf.MonthNames[i]))
                                            .css({ height: monthHeight, lineHeight: monthHeight + 'px' })
                                            .appendTo(column);
                                        if (viewingDate.getMonth() == i && viewingDate.getFullYear() == tempDate.getFullYear())
                                            mon.addClass('app-selected');
                                    }
                                    appendClearFix(column);
                                    tempDate.setFullYear(tempDate.getFullYear() + 1);
                                });
                                selectorContainerInner.css('marginLeft', '');
                            };

                        if (!oldMode || oldMode == '')
                            scaleTransition(monthContainer, selectorContainer, renderMonth);
                        else if (oldMode == 'selectyear')
                            scaleTransition(selectorContainer, selectorContainer, renderMonth);
                        else
                            renderMonth();

                        break;
                    case 'selectyear':
                        var fromYear = tempDate.getFullYearText();
                        tempDate.setFullYear(tempDate.getFullYear() - 12);
                        var monthHeight = Math.floor(monthContainer.height() / 3) - 10,
                            renderYear = function () {
                                selectorContainer.find('.app-scroll-column').each(function () {
                                    var column = $(this).empty(),
                                        yearLink;
                                    setDateOfBlock(column, tempDate);
                                    for (var i = 0; i < 12; i++) {
                                        yearLink = $(String.format('<div class="app-select-year ui-btn" data-cal-year="{0}">{1}</div>', tempDate.getFullYear(), tempDate.getFullYearText()))
                                            .css({ height: monthHeight, lineHeight: monthHeight + 'px' })
                                            .appendTo(column);

                                        if (tempDate.getFullYear() == viewingDate.getFullYear())
                                            yearLink.addClass('app-selected');

                                        tempDate.setFullYear(tempDate.getFullYear() + 1);
                                    }
                                    appendClearFix(column);
                                });
                                selectorContainerInner.css('marginLeft', -container.width());
                            };

                        header.html(String.format('<a class="ui-btn app-year-range">{0} - {1}</span>', fromYear, fromYear + 11));

                        if (oldMode != 'selectyear')
                            scaleTransition(selectorContainer, selectorContainer, renderYear);
                        else
                            renderYear();

                        break;
                }

                // render time control
                if (showTime)
                    refreshClock(timeContainer, drawDate, timeMode);

                // trigger refresh callback
                var onrefreshcallback = outerContainer.data('calendar-onrefresh'),
                    activePageId = findActivePage().attr('id'),
                    activeFieldName = field && field.Name;

                if (onrefreshcallback)
                    onrefreshcallback({
                        container: outerContainer,
                        monthContainer: monthContainer,
                        selectorContainer: selectorContainer,
                        timeContainer: timeContainer,
                        dataView: dataView,
                        mode: mode,
                        date: viewingDate,
                        startField: options.startField,
                        endField: options.endField
                    });


                function asyncRequestContextHasChanged(field, activeFieldName) {
                    if (!outerContainer.is(':visible'))
                        return true;
                    if (findActivePage().attr('id') !== activePageId)
                        return true;
                    if (options.queryData && !options.queryData(field, activeFieldName))
                        return true;
                    return false;
                }

                // get values in month
                if (reloadData && !options.hideDate && !dataView._survey && field.AllowQBE &&
                    !(dataView._keyFields.length === 1 && dataView._keyFields[0].Name === 'sys_pk_') && (options.container.is('.ui-panel-inner') || _touch.settings('dates.calendar.countEvents') || field.tagged('calendar-count-events'))) {

                    // load from cache
                    var queryDate = new Date(drawDate.getFullYear(), drawDate.getMonth()),
                        key = String.format('{0}-{1}', queryDate.getFullYear(), dateMonth),
                        fieldCache = cache[field.Name],
                        scrollColumn = monthContainer.find('.app-scroll-column').eq(1);

                    scrollColumn.find('.app-has-data').removeClass('app-has-data').attr('title', '');

                    if (!fieldCache)
                        fieldCache = cache[field.Name] = {};

                    var data = fieldCache[key];

                    if (data)
                        loadDataInMonth(scrollColumn, queryDate, data);
                    else {
                        clearTimeout(pluginLoadDataTimeout);
                        pluginLoadDataTimeout = setTimeout(function () {
                            if (asyncRequestContextHasChanged(field, activeFieldName))
                                return;
                            // select data
                            var fieldFilter = [activeFieldName],
                                startDate = new Date(queryDate),
                                startDayOfWeek = dtfDayOfWeek[startDate.getDay()],
                                endDate,
                                calendarPivots = {},
                                keyFieldNames = dataView._keyFields.map(function (f) { return f.Name; });

                            if (startDayOfWeek != 0)
                                startDate.setDate(startDate.getDate() - startDayOfWeek);

                            endDate = new Date(startDate);
                            endDate.setDate(endDate.getDate() + 7 + (35 * showMonths));

                            endDate.setSeconds(-1);

                            calendarPivots[field.Name] = ["pivot-row1-month-raw", "pivot-row2-day"];

                            _app.execute({
                                controller: dataView._controller,
                                command: 'Pivot',
                                view: dataView._viewId,
                                _filter: getDateFilter(dataView, field, null, startDate, endDate, keyFieldNames),
                                fieldFilter: fieldFilter,
                                sort: '',
                                pivotDefinitions: calendarPivots,
                                tags: dataView.get_tags(),
                                success: function (result) {
                                    var p = result.Pivots.pivot0;
                                    if (!p)
                                        return;
                                    data = fieldCache[key] = result.Pivots.pivot0.Data.slice(1);
                                    dataView.session('calendar-input-cache', cache);
                                    if (!asyncRequestContextHasChanged(field, activeFieldName))
                                        loadDataInMonth(scrollColumn, queryDate, data);
                                },
                                error: function (error) {
                                    _app.alert(String.format('{0}', error.get_message()));
                                }
                            });
                        }, 300);
                    }
                }
                return container;
            }

            function attach() {
                var createContainer = !container.length;

                // create mini calendar
                if (createContainer) {

                    container = $div('app-calendar-plugin').prependTo(outerContainer);
                    var header = $('<div class="app-calendar-plugin-header"><div>&nbsp;</div></div>').appendTo(container),
                        startDate = new Date(drawDate);
                    $a('app-calendar-plugin-loadleft ui-btn ui-btn-corner-all ui-btn-icon-notext ui-icon-carat-l').attr('title', resources.Pager.Previous).prependTo(header);
                    $a('app-calendar-plugin-loadright ui-btn ui-btn-corner-all ui-btn-icon-notext ui-icon-carat-r').attr('title', resources.Pager.Next).appendTo(header);

                    monthContainer = $div('app-month-container', 'data-draggable="calendar-mini"').appendTo(container);

                    var monthContainerInner = $div('app-scroll-inner').appendTo(monthContainer),
                        beforeMonths = $div('app-scroll-column').appendTo(monthContainerInner),
                        duringMonths = $div('app-scroll-column').appendTo(monthContainerInner),
                        afterMonths = $div('app-scroll-column').appendTo(monthContainerInner);

                    selectorContainer = $div('app-date-selector-container', 'data-draggable="calendar-mini" style="display:none"').appendTo(container);
                    $('<div class="app-scroll-inner"><div class="app-scroll-column"></div><div class="app-scroll-column"></div><div class="app-scroll-column"></div></div>').appendTo(selectorContainer);

                    if (options.renderTime) {
                        timeContainer = $('<div class="app-time-container">'
                            + '<div class="app-time-header"><span class="app-time-hour app-cal-selected">12</span>:<span class="app-time-minute">00</span> <span class="app-time-ampm"></span></div> '
                            + '<div class="app-time-selector" data-draggable="calendar-mini-hand">'
                            + '<div class="app-hour-selector"><ul class="app-hour-list">'
                            + (dtf.AMDesignator == ''
                                ? '<li>00</li><li>1</li><li>2</li><li>3</li><li>4</li><li>5</li><li>6</li><li>7</li><li>8</li><li>9</li><li>10</li><li>11</li>'
                                + '<li>12</li><li>13</li><li>14</li><li>15</li><li>16</li><li>17</li><li>18</li><li>19</li><li>20</li><li>21</li><li>22</li><li>23</li>'
                                : '<li>12</li><li>1</li><li>2</li><li>3</li><li>4</li><li>5</li><li>6</li><li>7</li><li>8</li><li>9</li><li>10</li><li>11</li>')
                            + '</ul></div>'
                            + '<div class="app-minute-selector" style="display: none"><ul class="app-minute-list">'
                            + '<li>00</li><li>05</li><li>10</li><li>15</li><li>20</li><li>25</li><li>30</li><li>35</li><li>40</li><li>45</li><li>50</li><li>55</li>'
                            + '</ul></div>'
                            + '<span class="app-time-hand app-transition"><span></span></span>'
                            + '</div></div>').appendTo(outerContainer);
                        var timeSelector = timeContainer.find('.app-time-selector'),
                            ampm = timeContainer.find('.app-time-ampm'),
                            d = timeSelector.height() / 2,
                            h2 = d * 0.815,
                            h2Odd = dtf.AMDesignator == '' ? d * 0.55 : h2,
                            hours = timeContainer.find('.app-hour-list li'),
                            minutes = timeContainer.find('.app-minute-list li'),
                            numHours = dtf.AMDesignator ? 12 : 24,
                            a;

                        // position hours
                        for (var i = 0; i < numHours; i++) {
                            a = i / 12 * 360 / 57.2958 - Math.PI / 2;
                            var h = i >= 12 ? h2 : h2Odd;

                            hours.eq(i).css({
                                top: d + h * Math.sin(a),
                                left: d + h * Math.cos(a)
                            });
                        }

                        // position min
                        for (var i = 0; i < 12; i++) {
                            a = i / 12 * 360 / 57.2958 - Math.PI / 2;

                            minutes.eq(i).css({
                                top: d + h2 * Math.sin(a),
                                left: d + h2 * Math.cos(a)
                            });
                        }

                        if (dtf.AMDesignator)
                            ampm.html('<span>' + dtf.AMDesignator + '</span><br/><span>' + dtf.PMDesignator + '</span>');
                        else
                            ampm.hide();

                    }
                    // append action bar
                    if (!options.hideActionBar) {
                        var actionBarButtons = [
                            '<a class="ui-btn ui-corner-all ui-mini ui-btn-inline app-calendar-btn-ok">' + resources.ModalPopup.OkButton + '</a>',
                            '<a class="ui-btn ui-corner-all ui-mini ui-btn-inline app-calendar-btn-cancel">' + resources.ModalPopup.CancelButton + '</a>',
                            '<a class="ui-btn ui-corner-all ui-mini ui-btn-inline app-calendar-btn-clear"></a>'];
                        if (_touch.settings('ui.actions.reverse') == true)
                            actionBarButtons.reverse();
                        actionBar = $('<div class="app-calendar-action-bar">' + actionBarButtons.join('') + '</div>').appendTo(outerContainer);
                    }

                    drawDate.setMonth(drawDate.getMonth() - showMonths, 1);

                    // draw month
                    var drawMonths = function (elem) {
                        for (var i = 0; i < showMonths; i++) {
                            var month = $div().appendTo(elem);
                            if (i == 0)
                                month.addClass('app-first-month');
                            if (i == showMonths - 1)
                                month.addClass('app-last-month');
                            drawDate.setMonth(drawDate.getMonth() + 1);
                        }
                    };

                    drawMonths(beforeMonths);
                    drawMonths(duringMonths);
                    drawMonths(afterMonths);
                    appendClearFix(monthContainerInner);

                    drawDate = startDate;
                }
                outerContainer.find('.app-calendar-btn-clear').text(field.AllowNulls ? resourcesMobile.LookupClearAction : resourcesCalendar.Today);

                if (showTime)
                    outerContainer.addClass('app-calendar-show-time');
                else
                    outerContainer.removeClass('app-calendar-show-time');

                if (options.hideDate)
                    outerContainer.addClass('app-calendar-hide-date');
                else
                    outerContainer.removeClass('app-calendar-hide-date');

                setDateOfBlock(monthContainer, drawDate);
                setTimeOfBlock(timeContainer, drawDate);

                // attach callbacks
                if (options.attachCallbacks || createContainer) {
                    if (options.onrefresh)
                        outerContainer.data('calendar-onrefresh', options.onrefresh);
                    if (options.onselect)
                        outerContainer.data('calendar-onselect', options.onselect);
                    outerContainer.data('calendar-show-months', showMonths);
                    mode = '';
                    outerContainer.data('calendar-mode', mode);
                    timeMode = 'Hour';
                    outerContainer.data('calendar-time-mode', timeMode);
                }
                options.reloadData = true;
                refresh();
                return container;
            }

            function setDate() {
                var drawDate = options.date,
                    target;

                if (mode == '') {
                    target = findMonthByDate(monthContainer, drawDate);
                    setDateOfBlock(monthContainer, drawDate);
                }
                else if (mode == 'selectmonth') {
                    target = selectorContainer.find('.app-scroll-column[data-cal-year="' + drawDate.getFullYear() + '"]');
                    setDateOfBlock(selectorContainer, drawDate);
                }
                else if (mode == 'selectyear') {
                    target = selectorContainer.find('.app-scroll-column .app-select-year[data-cal-year="' + drawDate.getFullYear() + '"]').parent();
                    setDateOfBlock(selectorContainer, drawDate);
                }

                if (target.length && mode == oldMode) {
                    var inner = target.closest('.app-scroll-inner'),
                        left = target.position().left,
                        oldMargin = parseInt(inner.css('marginLeft'), 10),
                        newMargin = oldMargin - left;
                    if (Math.abs(newMargin - oldMargin) < 5)
                        refresh();
                    else
                        inner.stop().animate({ marginLeft: oldMargin - left }, refresh);
                }
                else
                    refresh();
            }


            function click() {
                var event = options.event,
                    target = options.target,
                    onselectcallback = outerContainer.data('calendar-onselect'),
                    date = options.date,
                    day = target && target.closest('td');

                if (day && day.length) {
                    date = mode == '' ? getDateOfBlock(monthContainer) : getDateOfBlock(selectorContainer);
                    if (day)
                        date.setFullYear(parseInt(day.attr('data-cal-year'), 10), parseInt(day.attr('data-cal-month'), 10), parseInt(day.attr('data-cal-day'), 10));

                    if (container.closest('.app-calendar-show-time').length)
                        getTimeOfBlock(timeContainer, date);
                }

                if (onselectcallback) {
                    onselectcallback({
                        container: container,
                        monthContainer: monthContainer,
                        selectorContainer: selectorContainer,
                        target: target,
                        event: event,
                        dataView: dataView,
                        mode: mode,
                        timeMode: timeMode,
                        oldTimeMode: oldTimeMode,
                        showTime: showTime,
                        date: date,
                        startField: options.startField,
                        endField: options.endField
                    });
                }
                else {
                    if (target.closest('.app-month-container').length) {
                        monthContainer.find('.app-selected').removeClass('app-selected');
                        findDayCell(monthContainer, date).addClass('app-selected');
                    }
                }

                options.date = drawDate = date;
                refreshClock(timeContainer, date, timeMode);
                //setDate();
            }

            function clearCache() {
                dataView.session('calendar-input-cache', null);
                cache = {};
                options.reloadData = true;
                refresh();
            }

            function destroy() {
                dataView.session('calendar-input-cache', null);
                container.removeData();
                cache = null;
                outerContainer.remove();
            }

            var result;
            switch (method) {
                case 'attach':
                    result = attach();
                    break;
                case 'destroy':
                    result = destroy();
                    break;
                case 'refresh':
                    result = refresh();
                    break;
                case 'setDate':
                    result = setDate();
                    break;
                case 'getDate':
                    result = getDate();
                    break;
                case 'click':
                    result = click();
                    break;
                case 'clearCache':
                    result = clearCache();
                    break;
                default:
                    _app.alert('Attempted to run CalendarControl("' + method + '").');
            }
            return result;
        });

        // calendar sidebar plugin
        var CalendarPlugin = function (dataView, calendars) {
            this.dataView = dataView;
            this.calendar = dataView.calendar;
            this.calendars = calendars;
        };

        CalendarPlugin.prototype = {
            attach: function (sidebar) {

                var dataView = this.dataView,
                    that = this;

                if (!this.calendar)
                    this.calendar = this.dataView.calendar;

                if (dataView.get_isTagged('calendar-mini-disabled'))
                    return;
                else if (dataView.get_isTagged('calendar-mini-twomonths'))
                    this.showMonths = 2;

                var drawDate = this.calendar ? this.calendar.navigateDate || this.calendar.lastDate : null,
                    activeCalendar = dataView.calendar.activeCalendar || dataView.calendar.calendars[Object.keys(dataView.calendar.calendars)[0]],
                    activeField = activeCalendar.date,
                    row = dataView.extension().commandRow();

                drawDate = row ? new Date(row[activeField.Index]) : null;
                if (!drawDate || isNaN(drawDate.getTime()))
                    drawDate = new Date();


                var calendarExisted = sidebar.find('.app-calendar-plugin').length > 0,
                    calendar = CalendarControl('attach', {
                        dataView: this.dataView,
                        container: sidebar.find('.ui-panel-inner'),
                        date: drawDate,
                        months: this.showMonths,
                        mode: '',
                        hideActionBar: true,
                        onselect: function (options) {
                            var target = options.target,
                                container = options.container,
                                dataView = options.dataView,
                                mode = options.mode,
                                date = options.date;

                            var table = target.closest('table'),
                                row = target.closest('tr'),
                                selectedRow = container.find('tr.app-selected'),
                                selectedDay = container.find('td.app-selected'),
                                rowSelected = row.hasClass('app-selected'),
                                daySelected = target.hasClass('app-selected'),
                                scrollable = toScrollable(dataView), //findScrollable('.app-wrapper'),
                                calendarView = scrollable.find('.app-calendar'),
                                filterOperation = '',
                                calendarActive = calendarView.length && calendarView.is(':visible'),
                                calendarConfig = dataView.calendar;

                            var highlight = target,
                                newMode;

                            if (!calendarActive) {
                                if (!selectedDay.length || target.is('.app-selected')) {
                                    if (!selectedRow.length || !rowSelected) {
                                        // filter by week when no selection
                                        date.setDate(date.getDate() - dtfDayOfWeek[date.getDay()]);
                                        var endDate = new Date(date);
                                        endDate.setDate(date.getDate() + 7);
                                        endDate.setSeconds(-1);
                                        filterOperation = '$between$';
                                        highlight = row;
                                    }
                                    else
                                        // filter day when week selected
                                        filterOperation = '=';
                                }
                                else
                                    // filter day
                                    filterOperation = '=';
                            }
                            else {
                                switch (calendarConfig.mode) {
                                    case 'year':
                                        newMode = 'Month';
                                        highlight = table.find('tbody tr').filter(function () {
                                            return $(this).find('td.app-next-month, td.app-prev-month, th').length < 7;
                                        });
                                        break;
                                    case 'month':
                                        if (rowSelected) {
                                            newMode = 'Week';
                                            highlight = row;
                                        }
                                        else {
                                            newMode = 'Month';
                                            highlight = table.find('tbody tr').filter(function () {
                                                return $(this).find('td.app-next-month, td.app-prev-month, th').length < 7;
                                            });
                                        }
                                        break;
                                    case 'week':
                                        if (rowSelected)
                                            newMode = 'Day';
                                        else {
                                            newMode = 'Week';
                                            highlight = row;
                                        }
                                        break;
                                    case 'day':
                                        if (daySelected) {
                                            newMode = 'Week';
                                            highlight = row;
                                        }
                                        else {
                                            newMode = 'Day';
                                        }
                                        break;
                                    case 'agenda':
                                        newMode = 'Agenda';
                                        calendarConfig.animate = true;
                                        calendarConfig.enhancePrecision = true;
                                        break;
                                }
                                if (newMode == 'Week')
                                    date.setDate(date.getDate() - dtfDayOfWeek[date.getDay()]);
                            }

                            selectedRow.add(selectedDay).removeClass('app-selected');
                            highlight.addClass('ui-btn-active app-selected');
                            setTimeout(function () {
                                highlight.removeClass('ui-btn-active');
                                // synchronize calendar view
                                if (calendarActive) {
                                    dataView.calendar.navigateDate = new Date(date);
                                    if (newMode.toLowerCase() == calendarConfig.mode)
                                        _touch.presenter('show', {
                                            id: dataView._id, name: 'calendar', container: scrollable
                                        });
                                    else {
                                        var link = findTab(scrollable.parent().find('.app-bar-header .app-bar-calendar'), resourcesCalendar[newMode]);
                                        if (link)
                                            link.trigger('vclick');
                                    }
                                    CalendarControl('refresh', {
                                        container: container,
                                        dataView: dataView
                                    });
                                }
                                // apply filter to view
                                else
                                    that.filter(filterOperation, date, endDate);
                            }, timeoutSpeed);
                        },
                        onrefresh: function (options) {

                            var container = options.container,
                                monthContainer = options.monthContainer,
                                months = monthContainer.find('.app-scroll-column > div'),
                                selectorContainer = options.selectorContainer,
                                dataView = options.dataView,
                                mode = options.mode,
                                date = options.date;

                            var fieldSelector = container.find('.app-calendar-plugin-fieldselector'),
                                activeField = that.getActiveCalendar().date,
                                fieldLabel = activeField.Label,
                                filterIndicator = fieldSelector.find('.app-icon');


                            var filter = dataView._filter,
                                scrollable = toScrollable(dataView),// findScrollable('.app-wrapper'),
                                calendarView = scrollable.find('.app-calendar'),
                                calendarActive = calendarView.length && calendarView.is(':visible'),
                                calendarConfig = dataView.calendar;

                            fieldSelector.find('.text').text(fieldLabel);

                            // show active date in calendar view
                            clearTimeout(updatePluginTimeout);
                            updatePluginTimeout = setTimeout(function () {
                                filterIndicator.css('opacity', '0');
                                that.filtered = false;
                                if (calendarActive) {
                                    if (container.is(':visible')) {
                                        months.find('.app-selected').removeClass('app-selected');
                                        var calendar = dataView.calendar,
                                            visible = calendar.getMostVisibleBlock(scrollable);
                                        if (!visible)
                                            return;
                                        var mostVisibleDate = getDateOfBlock(visible),
                                            month = findMonthByDate(monthContainer, mostVisibleDate);
                                        if (!month || !month.length)
                                            return;

                                        switch (calendar.mode) {
                                            case 'year':
                                            case 'month':
                                                month.find('table tr').filter(function () {
                                                    return $(this).find('td.app-next-month, td.app-prev-month, th').length < 7;
                                                }).addClass('app-selected');
                                                break;
                                            case 'week':
                                                findDayCell(month, mostVisibleDate).parent().addClass('app-selected');
                                                break;
                                            case 'day':
                                                findDayCell(month, mostVisibleDate).addClass('app-selected');
                                                break;
                                        }
                                    }
                                }
                                // show filter
                                else {
                                    months.find('.app-selected').removeClass('app-selected');
                                    if (filter.length) {
                                        // find the filter in calendar and mark as filtered
                                        $(filter).each(function () {
                                            var fil = this;
                                            if (fil.startsWith(activeField.Name)) {
                                                var res = /(\w+):(=|\$between\$)(%js%"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z?)")/.exec(fil);
                                                if (!res)
                                                    return false;

                                                filterIndicator.css('opacity', '1');
                                                that.filtered = true;

                                                var startDate = dataView.convertStringToFieldValue(activeField, res[3]),
                                                    startMonth = findMonthByDate(monthContainer, startDate),
                                                    endDate = new Date(startDate),
                                                    daySelect = res[2] == '=';
                                                endDate.setDate(startDate.getDate() + (daySelect ? 1 : 7));
                                                endDate.setSeconds(-1);

                                                var endMonth = findMonthByDate(monthContainer, endDate);
                                                if (!startMonth.length && !endMonth.length)
                                                    return true;

                                                var td = findDayCell(monthContainer, startDate).add(findDayCell(monthContainer, endDate));

                                                if (td && td.length) {
                                                    if (daySelect)
                                                        td.addClass('app-selected');
                                                    else
                                                        td.parent().addClass('app-selected');
                                                }
                                                return false;
                                            }
                                        });
                                    }
                                }
                            }, 450);
                        }
                    });

                calendar.addClass('app-show-request').removeClass('app-hide-request');

                if (!calendarExisted) {
                    $('<a class="ui-btn ui-btn-icon-none app-has-droparrow app-calendar-plugin-fieldselector"><span class="app-icon material-icon" style="opacity:0">filter_list</span><span class="text">' + activeField.Label + '</span></a>').appendTo(calendar);
                    var colorLegend = $('<div class="app-calendar-color-legend"><p class="app-item-desc app-item-desc-before"></p><ol></ol></div>').attr('data-calendar-for', activeCalendar.name).appendTo(calendar).hide(),
                        legendToggle = $a('ui-btn ui-btn-icon-none app-has-droparrow app-legend-toggle').appendTo(colorLegend);
                    $p('app-item-desc app-item-desc-after').appendTo(colorLegend);

                    $span('app-see-more').text(resources.Mobile.More).appendTo(legendToggle);
                    $span('app-see-less').text(resourcesCalendar.Less).appendTo(legendToggle);

                    calendar.on('show.sidebar.app', function () {
                        var monthContainer = calendar.find('.app-month-container');
                        if (monthContainer.length)
                            monthContainer.find('.app-scroll-inner').css('marginLeft', '');
                    });
                }
                return calendar;
            },
            refresh: function () {
                CalendarControl('refresh', {
                    container: _touch.sidebar().find('.app-calendar-plugin'),
                    dataView: this.dataView
                });
            },
            getActiveCalendar: function () {
                return this.calendar ? this.calendar.activeCalendar : this.calendars[Object.keys(this.calendars)[0]];
            },
            clearCache: function () {
                CalendarControl('clearCache', {
                    container: _touch.sidebar().find('.app-calendar-plugin'),
                    dataView: this.dataView
                });
            },
            filterWithoutField: function (filter) {
                var name = this.getActiveCalendar().date.Name;
                return filter.filter(function (f) {
                    return !f.startsWith(name);
                }).join('');
            },
            filter: function (filterOperation, date, endDate) {
                var that = this,
                    dataView = that.dataView,
                    activeField = that.getActiveCalendar().date;
                // apply filter to view
                dataView.extension()._instructed = false;
                that.filtering = true;
                switch (filterOperation) {
                    case '=':
                        dataView.applyFieldFilter(activeField.Index, '=', [date]);
                        break;
                    case '$between$':
                        dataView.applyFieldFilter(activeField.Index, '$between', [date, endDate]);
                        break;
                    case 'clear':
                        dataView.removeFromFilter(activeField);
                        dataView.sync();
                        break;
                }
                that.filtering = false;


                var calendarPlugin = CalendarControl('refresh', {
                    container: _touch.sidebar().find('.ui-panel-inner'),
                    dataView: this.dataView
                });
            }
        };

        function detachPlugin(sidebar) {
            if (!sidebar)
                sidebar = _touch.sidebar();
            sidebar.find('.app-calendar-plugin').addClass('app-hide-request');
        }

        $(document)
            .on('vclick', '.app-calendar-color-legend', function (e) {
                var target = $(e.target),
                    sidebar = _touch.sidebar();
                // handle color filter
                if (target.is('.app-calendar-color-legend ol li, .app-calendar-color-legend ol li span')) {
                    e = target.is('.app-event') ? target : target.find('.app-event');
                    var dataView = activeDataView(),
                        calendar = dataView.calendar,
                        colorMap = calendar.activeCalendar.colorMap,
                        visibleColors = colorMap.getVisibleColors().map(function (x) {
                            return colorMap.color(x).toString();
                        }),
                        //$body = $('body'),
                        colorClass = e.attr('class').match(/app-event-color-(\w+)/),
                        bodyColorClass = $body.attr('class').match(/app-event-filter-color-(\w+)/),
                        oldColorVisible = true;

                    if (colorClass) {
                        var color = colorClass[1],
                            newColorClass = 'app-event-filter-color-' + color,
                            bodySameColor = $body.is('.' + newColorClass);

                        if (bodyColorClass) {
                            var oldColor = bodyColorClass[1];
                            oldColorVisible = visibleColors.indexOf(oldColor) != -1;

                        }

                        colorMap.clearFilter();

                        if (!bodySameColor && oldColorVisible) {
                            // set filter
                            $body.addClass('app-event-filter ' + newColorClass);


                            var scrollable = calendar.scrollable(),
                                firstVisible = calendar.getFirstVisibleBlock(scrollable),
                                lastVisible = calendar.getLastVisibleBlock(scrollable),
                                scrollTop = scrollable.position().top,
                                scrollBottom = scrollTop + scrollable.height(),
                                lastVisibleTop,
                                firstVisibleBottom,
                                done = false,
                                isVisible = false;

                            do {
                                var events = (calendar.mode === 'agenda' ? firstVisible.parent() : firstVisible).find('.app-event.app-event-color-' + color);
                                events.each(function () {
                                    var event = $(this),
                                        eventTop = event.offset().top;

                                    if (eventTop < scrollTop) {
                                        if (calendar.mode == 'month' || !lastVisibleTop || lastVisibleTop.offset().top < eventTop)
                                            lastVisibleTop = event;
                                    }
                                    else if (eventTop + event.height() > scrollBottom) {
                                        firstVisibleBottom = event;
                                        done = true;
                                        return false;
                                    }
                                    else {
                                        isVisible = true;
                                        done = true;
                                        return false;
                                    }
                                });
                                firstVisible = firstVisible.next();
                            } while (!done && firstVisible != lastVisible && firstVisible.length);

                            if (!isVisible && (firstVisibleBottom || lastVisibleTop)) {
                                var stp = firstVisibleBottom || lastVisibleTop,
                                    newScrollTop;
                                switch (calendar.mode) {
                                    case 'day':
                                    case 'week':
                                        var context = stp.data('data-context');
                                        if (context) {
                                            var date = context[1];
                                            newScrollTop = drawTime(date, 'find');
                                        }
                                        break;
                                    case 'month':
                                    case 'agenda':
                                        newScrollTop = scrollable.scrollTop() + stp.offset().top - scrollable.position().top + (stp.height() - scrollable.height()) / 2;
                                        break;
                                }
                                if (newScrollTop != null)
                                    _touch.animatedScroll(scrollable, newScrollTop);
                            }
                        }
                    }
                    return false;
                }

                // handle see more/see less
                else if (target.is('.app-legend-toggle, .app-see-more, .app-see-less')) {
                    _touch.callWithFeedback(target, function () {
                        sidebar.find('.app-calendar-color-legend').toggleClass('app-see-all');
                    });
                    return false;
                }
            })

            .on('vclick', '.app-calendar-plugin-fieldselector', function (event) {

                var originalTarget = $(event.target),
                    target = originalTarget,
                    button = target.closest('.app-calendar-plugin-fieldselector'),
                    dataView = activeDataView(),
                    that = dataView.calendarPlugin,
                    calendar = target.closest('.app-calendar-plugin'),
                    mode = calendar.data('calendar-mode'),
                    container = calendar.find('.app-month-container'),
                    selectorContainer = calendar.find('.app-date-selector-container'),
                    table = target.closest('table'),
                    items = [];

                // clear filter button
                if (that.filtered)
                    items.push({
                        text: resourcesMobile.ClearFilter,
                        icon: 'material-icon-clear',
                        callback: function () {
                            that.filter('clear');
                        }
                    }, {});

                // add fields
                $(that.calendars).each(function () {
                    var calendarConfig = this,
                        field = calendarConfig.date,
                        activeField = that.getActiveCalendar().date;
                    items.push({
                        text: field.Label,
                        icon: field == activeField ? 'check' : '',
                        callback: function () {
                            dataView.calendar.preventNavigate = true;
                            if (activeField == field)
                                return;
                            dataView.removeFromFilter(activeField);
                            that.calendar.activeCalendar.colorMap.clearFilter();
                            that.calendar.activeCalendar = calendarConfig;
                            var config = dataView.viewProp('calendarConfig');
                            config.activeCalendar = calendarConfig.name;
                            dataView.viewProp('calendarConfig', config);
                            that.calendar.clear(true);
                            dataView.sync();
                        }
                    });
                });

                // today button
                items.push({}, {
                    text: resourcesCalendar.Today,
                    icon: 'material-icon-event',
                    callback: function () {
                        CalendarControl('setDate', {
                            container: container.closest('.ui-panel-inner'),
                            date: new Date(),
                            dataView: dataView,
                            reloadData: true
                        });
                    }
                });

                // sync button
                var scrollable = findScrollable('.app-wrapper'),
                    calendarView = scrollable.find('.app-calendar'),
                    calendarActive = calendarView.length && calendarView.is(':visible'),
                    syncDate,
                    label = resourcesCalendar.Sync;

                if (calendarActive) {
                    var block = dataView.calendar.getMostVisibleBlock(scrollable);
                    syncDate = getDateOfBlock(block);
                }
                else {
                    var row = dataView.extension().commandRow();
                    if (row)
                        syncDate = new Date(row[that.getActiveCalendar().date.Index]);
                }
                if (syncDate && !isNaN(syncDate.getTime())) {
                    label = String.format('{0} {1}', dtf.MonthNames[syncDate.getMonth()], syncDate.getFullYearText());
                    items.push({
                        text: label,
                        icon: 'recycle',
                        callback: function () {
                            CalendarControl('setDate', {
                                container: container.closest('.ui-panel-inner'),
                                date: syncDate,
                                dataView: dataView
                            });
                        }
                    });
                }

                // popup
                _touch.callWithFeedback(button, function () {
                    _touch.listPopup({
                        anchor: button,
                        iconPos: 'left',
                        items: items
                    });
                });
                return false;
            })

            .on('touchmove', '.app-calendar-plugin, .app-calendar-plugin-container', function (event) {
                if ($(event.target).closest('[data-draggable]').length == 0) {
                    event.preventDefault();
                    return false;
                }
            })

            .on('vclick mousedown', '.app-calendar-plugin, .app-calendar-plugin-container', function (event) {
                event.preventDefault();
                //if (skipClick) {
                //    skipClick = false;
                //    return false;
                //}
                if (event.type == 'mousedown')
                    return false;

                var originalTarget = $(event.target),
                    target = originalTarget,
                    dataView = activeDataView(),
                    outerContainer = target.closest('.app-calendar-plugin').parent();

                if (!outerContainer.length)
                    outerContainer = target.closest('.app-calendar-plugin-container');

                var mode = outerContainer.data('calendar-mode'),
                    container = outerContainer.find('.app-month-container'),
                    selectorContainer = outerContainer.find('.app-date-selector-container'),
                    timeContainer = outerContainer.find('.app-time-container'),
                    table = target.closest('table'),
                    showMonths = outerContainer.data('calendar-show-months'),
                    timeSelector = timeContainer.find('.app-time-selector'),
                    hand = timeSelector.find('.app-time-hand'),
                    date;

                if (mode == '') {
                    // use first month if no month found
                    if (!table.length)
                        date = getDateOfBlock(container);
                    else
                        date = getDateOfBlock(table.parent());
                }
                else
                    date = getDateOfBlock(selectorContainer);


                if (timeContainer.length)
                    getTimeOfBlock(timeContainer, date);

                if (target.is('span.app-current-day'))
                    originalTarget = target = target.closest('td');

                if (target.is('td')) {
                    if (target.is('.app-day-unselectable'))
                        return;
                    if (container.is(':animated'))
                        return;
                    CalendarControl('click', {
                        container: outerContainer,
                        dataView: dataView,
                        target: target,
                        event: event
                    });
                }
                // handle left/right buttons
                else if (target.is('.app-calendar-plugin-loadleft,.app-calendar-plugin-loadright')) {
                    var isLeft = target.is('.app-calendar-plugin-loadleft');

                    // set date
                    if (mode == '') {
                        if (isLeft)
                            date.setMonth(date.getMonth() - showMonths, 1);
                        else
                            date.setMonth(date.getMonth() + showMonths, 1);

                        // refresh
                        _touch.callWithFeedback(target, function () {
                            CalendarControl('setDate', {
                                container: outerContainer,
                                date: date,
                                dataView: dataView
                            });
                        });
                    }
                    else if (mode == 'selectmonth') {
                        _touch.callWithFeedback(target, function () {
                            date.setFullYear(date.getFullYear() + (isLeft ? -1 : 1));
                            CalendarControl('setDate', {
                                container: outerContainer,
                                date: date,
                                dataView: dataView
                            });
                        });
                    }
                    else if (mode == 'selectyear') {
                        _touch.callWithFeedback(target, function () {
                            date.setFullYear(date.getFullYear() + (isLeft ? -12 : 12));
                            CalendarControl('setDate', {
                                container: outerContainer,
                                date: date,
                                dataView: dataView
                            });
                        });
                    }
                }
                // handle date picker
                else if (target.is('.app-month-picker')) {
                    _touch.callWithFeedback(target, function () {
                        CalendarControl('setDate', {
                            container: outerContainer,
                            date: date,
                            mode: 'selectmonth',
                            dataView: dataView
                        });
                    });
                }
                else if (target.is('.app-year-picker')) {
                    if (mode != 'selectyear') {
                        date.setFullYear(date.getFullYear() - 5);
                        _touch.callWithFeedback(target, function () {
                            CalendarControl('setDate', {
                                container: outerContainer,
                                date: date,
                                mode: 'selectyear',
                                dataView: dataView
                            });
                        });
                    }
                    else
                        target.removeClass('ui-btn-active');
                }

                // switch date
                else if (target.is('.app-select-month')) {
                    _touch.callWithFeedback(target, function () {
                        date.setMonth(parseInt(target.attr('data-cal-month'), 10));
                        CalendarControl('setDate', {
                            container: outerContainer,
                            date: date,
                            mode: '',
                            reloadData: true,
                            dataView: dataView
                        });
                    });
                }
                else if (target.is('.app-select-year')) {
                    _touch.callWithFeedback(target, function () {
                        date.setFullYear(parseInt(target.attr('data-cal-year'), 10));
                        CalendarControl('setDate', {
                            container: outerContainer,
                            date: date,
                            mode: 'selectmonth',
                            dataView: dataView
                        });
                    });
                }
                // Time Control
                else if (target.is('.app-time-hour')) {
                    _touch.callWithFeedback(target);
                    hand.removeClass('app-transition');
                    CalendarControl('refresh', {
                        container: outerContainer,
                        timeMode: 'Hour',
                        showTime: true,
                        dataView: dataView
                    });
                    setTimeout(function () { hand.addClass('app-transition'); });
                    vibrate();
                }
                else if (target.is('.app-time-minute')) {
                    _touch.callWithFeedback(target);
                    hand.removeClass('app-transition');
                    CalendarControl('refresh', {
                        container: outerContainer,
                        timeMode: 'Minute',
                        showTime: true,
                        dataView: dataView
                    });
                    setTimeout(function () { hand.addClass('app-transition'); });
                    vibrate();
                }
                /*else if (target.is('.app-time-second')) {
                touch.callWithFeedback(target);
                CalendarControl('refresh', {
                container: outerContainer,
                timeMode: 'Second',
                showTime: true,
                dataView: dataView
                });
                }*/
                else if (target.closest('.app-time-ampm').length) {
                    date = outerContainer.data('select-date') || date;
                    var hours = date.getHours();
                    date.setHours(hours + (hours < 12 ? 12 : -12));
                    setTimeOfBlock(timeContainer, date);
                    _touch.callWithFeedback(target);
                    CalendarControl('click', {
                        container: outerContainer,
                        dataView: dataView,
                        target: target,
                        event: event,
                        date: date,
                        showTime: true
                    });
                    vibrate();
                }
                else if (target.closest('.app-time-selector').length) {
                    date = outerContainer.data('select-date') || date;
                    var is24hour = dtf.AMDesignator == '',
                        timeSelectorPos = timeSelector.offset(),
                        timeMode = outerContainer.data('calendar-time-mode'),
                        height = timeSelector.height() / 2,
                        lastTouch = _touch.lastTouch() || { x: event.pageX, y: event.pageY },
                        x = lastTouch.x - (height + timeSelectorPos.left),
                        y = lastTouch.y - (height + timeSelectorPos.top),
                        dist = !is24hour ? 0 : Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2)),
                        angle = Math.atan2(y, x) + Math.PI / 2;

                    if (angle < 0)
                        angle += Math.PI * 2;
                    angle /= Math.PI * 2;

                    if (isNaN(angle)) {
                        console.log('angle is NaN');
                        return;
                    }
                    vibrate();

                    switch (timeMode) {
                        case 'Hour':
                            var hours = Math.round(angle * 12);
                            if (!is24hour) {
                                if (hours == 12)
                                    hours = 0;
                                if (date.getHours() >= 12)
                                    hours += 12;
                            }
                            else {
                                var outerRing = dist > height / 1.5;
                                if (outerRing)
                                    hours += 12;
                                if (hours == 24)
                                    hours = 12;
                                else if (hours == 12 && !outerRing)
                                    hours = 0;
                            }
                            date.setHours(hours);
                            setTimeOfBlock(timeContainer, date);
                            CalendarControl('click', {
                                container: outerContainer,
                                dataView: dataView,
                                target: target,
                                event: event,
                                date: date,
                                showTime: true,
                                getDateFromInput: true
                            });
                            hand.one('transitionend', function () {
                                hand.removeClass('app-transition');
                                CalendarControl('click', {
                                    container: outerContainer,
                                    dataView: dataView,
                                    target: target,
                                    event: event,
                                    date: date,
                                    showTime: true,
                                    timeMode: 'Minute',
                                    getDateFromInput: true
                                });
                                hand.addClass('app-transition');
                            });
                            break;
                        case 'Minute':
                            var min = Math.round(angle * 60) % 60,
                                diff = Math.abs(date.getMinutes() - min);

                            if (diff >= 5) {
                                var change = min % 5;
                                if (change > 2)
                                    min += 5 - change;
                                else
                                    min -= change;
                            }
                            if (min >= 60)
                                min = 0;
                            date.setMinutes(min);
                            CalendarControl('click', {
                                container: outerContainer,
                                dataView: dataView,
                                target: target,
                                event: event,
                                date: date,
                                showTime: true,
                                getDateFromInput: true
                            });
                            break;
                    }
                }
                else if (target.is('.app-calendar-btn-ok')) {
                    date = outerContainer.data('select-date');
                    _touch.callWithFeedback(target, function () {
                        CalendarInput('setInput', {
                            dataView: dataView,
                            container: outerContainer,
                            date: date,
                            modal: true
                        });
                        CalendarInput('hide', { container: outerContainer });
                    });
                }
                else if (target.is('.app-calendar-btn-cancel')) {
                    _touch.callWithFeedback(target, function () {
                        CalendarInput('hide', { container: outerContainer });
                    });
                }
                else if (target.is('.app-calendar-btn-clear')) {
                    _touch.callWithFeedback(target, function () {
                        CalendarInput('clear', {
                            dataView: dataView,
                            container: outerContainer,
                            modal: true
                        });
                        CalendarInput('hide', { container: outerContainer });
                    });
                }
                else if (target.is('.app-calendar-btn-close')) {
                    _touch.callWithFeedback(target, function () {
                        CalendarInput('hide', { container: outerContainer });
                    });
                }
                return false;
            })

            .on('touchstart mousedown pointerdown', '.app-calendar-cover', function (event) {
                event.preventDefault();
                CalendarInput('hide');
                return false;
            })
            .on('beforeactivatedatetime.input.app beforeactivatedate.input.app', '[data-input]', function (e) {
                if (e.namespace == 'app.input') {
                    var options = { inputContainer: $(e.target) };
                    options.field = _app.input.elementToField(options.inputContainer);
                    options.date = e.value.inputValueRaw;
                    options.dataView = options.field._dataView;
                    if (CalendarInput('activate', options))
                        e.preventDefault();
                }
            })

            .on('beforefocus.input.app', '[data-input][data-type="date"],[data-input][data-type="datetime"]', function (e) {
                var options = { input: e.inputElement };
                options.inputContainer = $(e.target);
                options.field = _app.input.elementToField(options.inputContainer);
                options.dataView = options.field._dataView;
                CalendarInput('attach', options);
            })

            .on('cancel.input.app', '[data-input][data-type="date"],[data-input][data-type="datetime"]', function (e) {
                // handler "Escape" pressed in the input - hide the visible calendar
                if ($('.app-data-input-helper').is(':visible')) {
                    $('.app-data-input-helper').hide();
                    e.preventDefault();
                }
            })
            .on('help.input.app', '[data-input][data-type="date"],[data-input][data-type="datetime"]', function (e) {
                // handler "Ctrl+Space" or "Ctrl+Down"  pressed in the input - show the visible calendar
                e.inputElement.blur();
                _app.input.focus({ lastFocused: true });
                return false;
            });



        /* Dragging: app-calendar-plugin */
        _app.dragMan['calendar-mini'] = {
            start: function (drag) {
                drag.dir = drag.target.closest('.ui-panel').length ? 'horizontal' : 'all';
                this._startX = drag.x;
                this._maxMargin = -drag.target.width() * 2;
                this._inner = drag.target.find('.app-scroll-inner').stop();
                this._originalMarginLeft = parseInt(this._inner.css('margin-left') || 0, 10);
                this._cancelMarginLeft = this._originalMarginLeft;
                this._startTime = +new Date();
            },
            move: function (drag) {
                var newMargin = this._originalMarginLeft + drag.x - this._startX;
                if (newMargin < 0 && newMargin > this._maxMargin) {
                    this._inner.css('marginLeft', newMargin);
                }
                else {
                    this._startX = drag.x;
                    this._originalMarginLeft = parseInt(this._inner.css('margin-left') || 0, 10);
                }
            },
            end: function (drag) {
                // complete scroll
                var isFlick = new Date() - this._startTime < 200;
                if (isFlick && Math.abs(this._startX - drag.x) < 10) {
                    this._inner.css('margin-left', this._originalMarginLeft);
                    return; // probably was a click
                }
                var container = drag.target.closest('.app-calendar-plugin'),
                    outerContainer = container.parent(),
                    mode = outerContainer.data('calendar-mode'),
                    showTime = outerContainer.hasClass('app-calendar-show-time');
                columns = this._inner.find('.app-scroll-column'),
                    columnIndex = 0;

                if (isFlick) {
                    if (!drag.swipeRight)
                        columnIndex = 2;
                }
                else {
                    // closest column
                    var cWidth = columns.first().width(),
                        left = -parseInt(this._inner.css('marginLeft'), 10);
                    columnIndex = Math.round(left / cWidth);
                }

                var column = columns.eq(columnIndex),
                    date = getDateOfBlock(mode == '' ? column.children(":first") : column);

                if (showTime)
                    getTimeOfBlock(outerContainer.find('.app-time-container'), date);

                CalendarControl('setDate', {
                    container: outerContainer,
                    date: date
                });

                //skipClick = true;
                //setTimeout(function () {
                //    skipClick = false;
                //}, 250);
            },
            cancel: function (drag) {
                this._inner.animate({
                    marginLeft: this._cancelMarginLeft
                });
            }
        };

        _app.dragMan['calendar-mini-hand'] = {
            start: function (drag) {
                drag.dir = 'all';
                this._startX = drag.x;
                this._startY = drag.y;
                drag._timeSelector = drag.target.closest('.app-time-selector');
                drag._outerContainer = drag._timeSelector.closest('.app-calendar-plugin-container');
                drag._hand = drag._timeSelector.find('.app-time-hand').removeClass('app-transition');
                drag._timeSelectorPos = drag._timeSelector.offset();
                drag._timeMode = drag._outerContainer.data('calendar-time-mode');
                drag._height = drag._timeSelector.height() / 2;
                drag._is24hour = dtf.AMDesignator == '';
                drag._date = drag._outerContainer.data('select-date');
                drag._isPM = !drag._is24hour && drag._date.getHours() >= 12;
            },
            move: function (drag) {
                var x = drag.x - (drag._height + drag._timeSelectorPos.left),
                    y = drag.y - (drag._height + drag._timeSelectorPos.top),
                    dist = !drag._is24hour ? 0 : Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2)),
                    angle = Math.atan2(y, x) + Math.PI / 2;

                if (angle < 0)
                    angle += Math.PI * 2;
                angle /= Math.PI * 2;
                switch (drag._timeMode) {
                    case 'Hour':
                        var hours = Math.round(angle * 12);
                        if (!drag._is24hour) {
                            if (hours == 12)
                                hours = 0;
                            if (drag._isPM)
                                hours += 12;
                        }
                        else {
                            var outerRing = dist > drag._height / 1.5;
                            if (outerRing)
                                hours += 12;
                            if (hours == 24)
                                hours = 12;
                            else if (hours == 12 && !outerRing)
                                hours = 0;
                        }
                        drag._date.setHours(hours);
                        break;
                    case 'Minute':
                        var min = Math.round(angle * 60);
                        if (min == 60)
                            min = 0;
                        drag._date.setMinutes(min);
                        break;
                }

                CalendarControl('click', {
                    container: drag._outerContainer,
                    date: drag._date,
                    target: drag.target,
                    showTime: true
                });
            },
            end: function (drag) {
                drag._hand.addClass('app-transition');
                vibrate();
            },
            cancel: function (drag) {
                drag._hand.addClass('app-transition');
            }
        };

        var ColorMap = function (dataView, calendar, map) {
            if (!map)
                map = { 'null': 0 };
            var that = this,
                colorFiled = calendar.color,
                getColorMapEvent;
            that.dataView = dataView;
            that.calendar = calendar;
            that.count = 0;
            if (colorFiled) {
                getColorMapEvent = $.Event('getcolormap.calendar.app', { dataView: dataView, colorField: colorFiled, colorMap: map });
                $(document).trigger(getColorMapEvent);
                map = getColorMapEvent.colorMap;
            }
            for (var item in map)
                if (map.hasOwnProperty(item) && typeof map[item] == 'number')
                    that.count++;
            that.map = map;
        };

        ColorMap.prototype = {
            color: function (value) {
                //if (value == null)
                //    return 0;
                var that = this,
                    color = this.map[value];
                if (typeof color == 'undefined') {
                    color = this.map[value] = 1 + this.count % maxColorCount;
                    this.count++;
                    if (that.calendar.color) {
                        clearTimeout(saveColorsTimeout);
                        saveColorsTimeout = setTimeout(function () {
                            that.dataView.viewProp('calendarColorMap-' + that.calendar.color.Name, that.map);
                            that.dataView.calendarPlugin.refresh(false, true);
                        }, 1000);
                    }
                }
                return color;
            },
            className: function (value) {
                return 'app-event-color-' + this.color(value);
            },
            // display the color legend and calculate colors
            load: function (reload) {
                var that = this;
                clearTimeout(loadColorLegendTimeout);
                loadColorLegendTimeout = setTimeout(function () {
                    var sidebar = _touch.sidebar(),
                        colorLegend = sidebar.find('.app-calendar-color-legend'),
                        toggleLegend = sidebar.find('a.app-legend-toggle'),
                        list = colorLegend.find('ol'),
                        config = that.calendar,
                        colorField = config ? config.color : null;

                    if (!config || !colorField || !sidebar.is(':visible')) {
                        if (colorLegend.length)
                            that.hide();
                        return;
                    }

                    var label = colorField.Label,
                        count = 0,
                        lastVal;

                    if (reload || list.is(':empty') || config.name != colorLegend.attr('data-calendar-for')) {

                        // find all used colors
                        var firstBlock = that.dataView.calendar.getFirstVisibleBlock(),
                            colors = that.getVisibleColors(),
                            currentColors = colorLegend.data('calendar-colors') || [];

                        if (!firstBlock || (!firstBlock.hasClass('data-loaded') && that.dataView.calendar.mode != 'agenda'))
                            return;

                        // stop if the colors are the same as displayed
                        if (colors.length == currentColors.length && colors.join('') == currentColors.join(''))
                            return;
                        colorLegend.data('calendar-colors', colors);

                        list.empty();
                        colors.forEach(function (val, index) {
                            var cssClass = that.className(val),
                                text = val || resources.Data.NullValueInForms;
                            if (colorField.Items)
                                colorField.Items.forEach(function (kvp) {
                                    if (kvp[0] == val) {
                                        text = kvp[1];
                                        return false;
                                    }
                                });
                            if (cssClass) {
                                var li = $li().text(text),
                                    span = $span('app-event').addClass(cssClass).appendTo(li);
                                if (count++ >= maxLegendVisible)
                                    li.addClass('app-hidden');
                                li.appendTo(list);
                            }
                            lastVal = val;
                        });

                        colorLegend.attr('data-calendar-for', config.name);

                        if (colorField.AliasName && colorField.AliasName.length) {
                            var alias = that.dataView.findField(colorField.AliasName);
                            if (alias)
                                label = alias.Label;
                        }

                        colorLegend.find('.app-item-desc').text(label);

                        if (count <= maxLegendVisible)
                            toggleLegend.addClass('app-hidden');
                        else
                            toggleLegend.removeClass('app-hidden');

                        if (count == 0 || !config.color)
                            colorLegend.addClass('app-hidden');
                        else
                            colorLegend.removeClass('app-hidden');
                        that.show();
                    }
                }, 450);
            },
            show: function () {
                var sidebar = _touch.sidebar();
                if (!sidebar.is(':visible') || this.dataView.calendar.mode == 'year')
                    return;
                var legend = sidebar.find('.app-calendar-color-legend'),
                    activePage = this.dataView.calendar.scrollable(),
                    calendar = activePage.find('.app-calendar'),
                    legendHidden = !legend.is(':visible');
                if (!legend.is('.app-hidden') && calendar.is(':visible') && legend.find('ol li').length) {
                    if (legendHidden)
                        legend.show();
                }
                else
                    this.hide();
            },
            hide: function () {
                var sidebar = _touch.sidebar(),
                    legend = sidebar.find('.app-calendar-color-legend');
                legend.hide();
            },
            getVisibleColors: function () {
                var colors = [],
                    calendar = this.dataView.calendar,
                    scrollable = calendar.scrollable(),
                    firstBlock = calendar.getFirstVisibleBlock(scrollable),
                    lastBlock = calendar.getLastVisibleBlock(scrollable),
                    isAgenda = calendar.mode == "agenda",
                    calendarColor = calendar.activeCalendar.color,
                    index = isAgenda ? calendar.dataView.findField(calendarColor.AliasName || calendarColor.Name).Index : 3;

                if (calendar.mode != 'year')
                    while (firstBlock && firstBlock.length) {
                        var blockColors = firstBlock.data('calendar-colors');

                        if (!blockColors && (firstBlock.hasClass('data-loaded') || isAgenda)) {
                            blockColors = [];
                            var date = getDateOfBlock(firstBlock),
                                data;

                            // do not use data from cache
                            if (isAgenda) {
                                var events = firstBlock.parent().find('.app-event');
                                events.each(function () {
                                    var data = $(this).data('data-context'),
                                        color = data[index];
                                    if (blockColors.indexOf(color) == -1)
                                        blockColors.push(color);
                                });
                            }
                            else {
                                data = calendar.cache.select(date);
                                for (var day in data) {
                                    var rows = data[day].rows || data.rows;
                                    for (var row in rows) {
                                        var color = rows[row][index];
                                        if (blockColors.indexOf(color) == -1)
                                            blockColors.push(color);
                                    }
                                    if (calendar.mode.match(/day|week/))
                                        break;
                                }
                            }

                            firstBlock.data('calendar-colors', blockColors);
                        }

                        if (blockColors)
                            blockColors.forEach(function (val) {
                                if (colors.indexOf(val) == -1)
                                    colors.push(val);
                            });

                        if (firstBlock[0] == lastBlock[0])
                            break;
                        firstBlock = firstBlock.next();
                    }
                return colors.sort();
            },
            clearFilter: function () {
                var colors = ['app-event-filter'],
                    map = this.map;
                for (var propName in map)
                    colors.push('app-event-filter-color-' + map[propName]);
                $body.removeClass(colors.join(' '));
            }
        };
    })();

})();