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
        ItemsPerPage: 'Artículos por página:',
        PageSizes: [10, 15, 20, 25],
        ShowingItems: 'Mostrando \u003cb\u003e{0}\u003c/b\u003e-\u003cb\u003e{1}\u003c/b\u003e de \u003cb\u003e{2}\u003c/b\u003e artículos en total',
        SelectionInfo: ' (<b>{0}</b> selected)',
        Refresh: 'Refrescar',
        Next: 'Siguiente »',
        Previous: '« Anterior',
        Page: 'Página',
        PageButtonCount: 10
    };

    _dvr.ActionBar = {
        View: 'Ver'
    };

    _dvr.ModalPopup = {
        Close: 'Cerrar',
        MaxWidth: 800,
        MaxHeight: 600,
        OkButton: 'Aceptar',
        CancelButton: 'Cancelar',
        SaveButton: 'Ahorrar',
        SaveAndNewButton: 'Guardar y Nuevo'
    };

    _dvr.Menu = {
        SiteActions: 'Acciones',
        SeeAlso: 'Datos Relacionados',
        Summary: 'Resumen',
        Tasks: 'Tareas',
        About: 'Esta Página'
    };

    _dvr.HeaderFilter = {
        GenericSortAscending: 'Ascendente',
        GenericSortDescending: 'Descendente',
        StringSortAscending: 'Ascendente',
        StringSortDescending: 'Descendente',
        DateSortAscending: 'Ascendente',
        DateSortDescending: 'Descendente',
        EmptyValue: '(Vacío)',
        BlankValue: '(En blanco)',
        Loading: 'Cargando ...',
        ClearFilter: 'Borrar filtro de {0}',
        SortBy: 'Ordenar por {0}',
        MaxSampleTextLen: 80,
        CustomFilterOption: 'Filtro ...'
    };

    _dvr.InfoBar = {
        FilterApplied: 'Se ha aplicado un filtro.',
        ValueIs: ' <span class="Highlight">{0}</span> ',
        Or: ' o ',
        And: ' y ',
        EqualTo: 'es igual a ',
        LessThan: 'es menor que ',
        LessThanOrEqual: 'es menor o igual a ',
        GreaterThan: 'es mayor que ',
        GreaterThanOrEqual: 'es mayor o igual a ',
        Like: 'es como ',
        StartsWith: 'comienza con ',
        Empty: 'vacío',
        QuickFind: ' Cualquier campo contiene '
    };

    _dvr.Lookup = {
        SelectToolTip: 'Seleccione {0}',
        ClearToolTip: 'Borrar {0}',
        NewToolTip: 'Agregar {0}',
        SelectLink: '(Seleccionar)',
        ShowActionBar: true,
        DetailsToolTip: 'Ver detalles de \u003cb\u003e{0}\u003c/b\u003e',
        ShowDetailsInPopup: true,
        GenericNewToolTip: 'Agregar',
        AddItem: 'Añadir artículo'
    };

    _dvr.Validator = {
        Required: 'Necesario',
        RequiredField: 'Este campo es obligatorio.',
        EnforceRequiredFieldsWithDefaultValue: false,
        NumberIsExpected: 'Se requiere un número.',
        BooleanIsExpected: 'Se requiere un valor lógico.',
        DateIsExpected: 'Se espera una fecha.',
        Optional: 'Opcional'
    };

    var _mn = Sys.CultureInfo.CurrentCulture.dateTimeFormat.MonthNames;

    _dvr.Data = {
        ConnectionLost: 'La conexión de red se ha perdido. Inténtelo de nuevo?',
        AnyValue: '(alguna)',
        NullValue: '<span class="NA">n/a</span>',
        NullValueInForms: 'N/A',
        BooleanDefaultStyle: 'DropDownList',
        BooleanOptionalDefaultItems: [[null, 'N/A'], [false, 'No'], [true, 'Sí']],
        BooleanDefaultItems: [[false, 'No'], [true, 'Sí']],
        MaxReadOnlyStringLen: 600,
        NoRecords: 'No se han encontrado.',
        BlobHandler: 'Blob.ashx',
        BlobDownloadLink: 'descargar',
        BlobDownloadLinkReadOnly: '<span style="color:gray;">descargar</span>',
        BlobDownloadHint: 'Haga clic aquí para descargar el archivo original.',
        BlobDownloadOriginalHint: 'Toca la imagen para descargar el archivo original.',
        BatchUpdate: 'actualización',
        NoteEditLabel: 'editar',
        NoteDeleteLabel: 'borrar',
        NoteDeleteConfirm: '¿Borrar?',
        UseLEV: 'Pega \"{0}\"',
        DiscardChanges: '¿Descartar los cambios?',
        KeepOriginalSel: 'mantener la selección original',
        DeleteOriginalSel: 'eliminar selección original',
        Import: {
            UploadInstruction: 'Por favor, seleccione el archivo a subir. El archivo debe estar en formato \u003cb\u003eCSV\u003c/b\u003e, \u003cb\u003eXLS\u003c/b\u003e o \u003cb\u003eXLSX\u003c/b\u003e.',
            DownloadTemplate: 'Descargar plantilla de importación de archivos.',
            Uploading: 'Su archivo está siendo cargado en el servidor. Por favor espere ...',
            MappingInstruction: 'Hay \u003cb\u003e{0}\u003c/b\u003e (s) registro(s) en el archivo \u003cb\u003e{1}\u003c/b\u003e listo(s) para ser procesados.\u003cbr/\u003ePor favor asigne los campos de importación del archivo de datos a los campos correspondientes en la aplicación y haga clic en \u003ci\u003eImportar\u003c/i\u003e para iniciar el procesamiento.',
            StartButton: 'Importación',
            AutoDetect: '(Detección automática)',
            Processing: 'El proceso de importación de archivos se ha iniciado. El registro de importación de datos estará disponible tras el procesamiento exitoso. Es posible que tenga que actualizar los puntos de vista o las páginas relevantes para ver los registros importados.',
            Email: 'Enviar registro de importación a los siguientes correos electrónicos (opcional)',
            EmailNotSpecified: 'Destinatario del registro de importación no ha sido especificado. Continuar de todos modos?'
        },
        Filters: {
            Labels: {
                And: 'y',
                Or: 'o',
                Equals: 'es igual a',
                Clear: 'Borrar',
                SelectAll: '(Seleccionar todo)',
                Includes: 'incluye',
                FilterToolTip: 'Cambio'
            },
            Number: {
                Text: 'Filtros de números',
                Kind: 'Número',
                List: [
                    { Function: '=', Text: 'Es igual a', Prompt: true },
                    { Function: '<>', Text: 'No es igual a', Prompt: true },
                    { Function: '<', Text: 'Menor que', Prompt: true },
                    { Function: '>', Text: 'Mayor que', Prompt: true },
                    { Function: '<=', Text: 'Menor o igual que', Prompt: true },
                    { Function: '>=', Text: 'Mayor o igual que', Prompt: true },
                    { Function: '$between', Text: 'Entre', Prompt: true },
                    { Function: '$in', Text: 'Incluye', Prompt: true, Hidden: true },
                    { Function: '$notin', Text: 'No incluye', Prompt: true, Hidden: true },
                    { Function: '$isnotempty', Text: 'No Empty' },
                    { Function: '$isempty', Text: 'Vacío' }
                ]
            },
            Text: {
                Text: 'Filtros de texto',
                Kind: 'Texto',
                List: [
                    { Function: '=', Text: 'Es igual a', Prompt: true },
                    { Function: '<>', Text: 'No es igual a', Prompt: true },
                    { Function: '$beginswith', Text: 'Comienza con', Prompt: true },
                    { Function: '$doesnotbeginwith', Text: 'No comienza con', Prompt: true },
                    { Function: '$contains', Text: 'Contiene', Prompt: true },
                    { Function: '$doesnotcontain', Text: 'No contiene', Prompt: true },
                    { Function: '$endswith', Text: 'Termina con', Prompt: true },
                    { Function: '$doesnotendwith', Text: 'No termina con', Prompt: true },
                    { Function: '$in', Text: 'Incluye', Prompt: true, Hidden: true },
                    { Function: '$notin', Text: 'No incluye', Prompt: true, Hidden: true },
                    { Function: '$isnotempty', Text: 'No Empty' },
                    { Function: '$isempty', Text: 'Vacío' }
                ]
            },
            Boolean: {
                Text: 'Filtros de lógica',
                Kind: 'Lógico',
                List: [
                    { Function: '$true', Text: 'Sí' },
                    { Function: '$false', Text: 'No' },
                    { Function: '$isnotempty', Text: 'No Empty' },
                    { Function: '$isempty', Text: 'Vacío' }
                ]
            },
            Date: {
                Text: 'Filtros de fecha',
                Kind: 'Fecha',
                List: [
                    { Function: '=', Text: 'Es igual a', Prompt: true },
                    { Function: '<>', Text: 'No es igual a', Prompt: true },
                    { Function: '<', Text: 'Antes de', Prompt: true },
                    { Function: '>', Text: 'Después de', Prompt: true },
                    { Function: '<=', Text: 'El o antes', Prompt: true },
                    { Function: '>=', Text: 'El o después', Prompt: true },
                    { Function: '$between', Text: 'Entre', Prompt: true },
                    { Function: '$in', Text: 'Incluye', Prompt: true, Hidden: true },
                    { Function: '$notin', Text: 'No incluye', Prompt: true, Hidden: true },
                    { Function: '$isnotempty', Text: 'No Empty' },
                    { Function: '$isempty', Text: 'Vacío' },
                    null,
                    { Function: '$tomorrow', Text: 'Mañana' },
                    { Function: '$today', Text: 'Hoy' },
                    { Function: '$yesterday', Text: 'Ayer' },
                    null,
                    { Function: '$nextweek', Text: 'La próxima semana' },
                    { Function: '$thisweek', Text: 'Esta Semana' },
                    { Function: '$lastweek', Text: 'Semana pasada' },
                    null,
                    { Function: '$nextmonth', Text: 'El próximo mes' },
                    { Function: '$thismonth', Text: 'Este Mes' },
                    { Function: '$lastmonth', Text: 'Mes pasado' },
                    null,
                    { Function: '$nextquarter', Text: 'El próximo trimestre' },
                    { Function: '$thisquarter', Text: 'Este Trimestre' },
                    { Function: '$lastquarter', Text: 'Último trimestre' },
                    null,
                    { Function: '$nextyear', Text: 'El próximo año' },
                    { Function: '$thisyear', Text: 'Este Año' },
                    { Function: '$yeartodate', Text: 'Año a la Fecha' },
                    { Function: '$lastyear', Text: 'El año pasado' },
                    null,
                    { Function: '$past', Text: 'Pasado' },
                    { Function: '$future', Text: 'Futuro' },
                    null,
                    {
                        Text: 'Todas las fechas en el período',
                        List: [
                            { Function: '$quarter1', Text: '1er trimestre' },
                            { Function: '$quarter2', Text: '2do trimestre' },
                            { Function: '$quarter3', Text: '3er trimestre' },
                            { Function: '$quarter4', Text: '4to trimestre' },
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
        RequiredFiledMarkerFootnote: '* - indica un campo obligatorio',
        SingleButtonRowFieldLimit: 7,
        GeneralTabText: 'General',
        Minimize: 'Minimizar',
        Maximize: 'Maximizar'
    };

    _dvr.Grid = {
        InPlaceEditContextMenuEnabled: true,
        QuickFindText: 'Búsqueda Rápida',
        QuickFindToolTip: 'Escriba lo que usted quiera buscar y pulse Enter',
        ShowAdvancedSearch: 'Mostrar Búsqueda Avanzada',
        VisibleSearchBarFields: 3,
        DeleteSearchBarField: '(Borrar)',
        //AddSearchBarField: 'Más campos de búsqueda',
        HideAdvancedSearch: 'Ocultar Búsqueda Avanzada',
        PerformAdvancedSearch: 'Búsqueda',
        ResetAdvancedSearch: 'Resetear',
        NewRowLink: 'Haga clic aquí para agregar un registro nuevo.',
        RootNodeText: 'Nivel superior',
        FlatTreeToggle: 'Cambiar a Jerarquía',
        HierarchyTreeModeToggle: 'Cambiar a Lista simple',
        AddConditionText: 'Añadir condición de búsqueda',
        AddCondition: 'Agregar condición',
        RemoveCondition: 'Quitar condición',
        ActionColumnHeaderText: 'Acciones',
        Aggregates: {
            None: { FmtStr: '', ToolTip: '' },
            Sum: { FmtStr: 'Suma: {0}', ToolTip: 'Suma de {0}' },
            Count: { FmtStr: 'Conteo: {0}', ToolTip: 'Conteo de {0}' },
            Avg: { FmtStr: 'Promedio: {0}', ToolTip: 'Promedio de {0}' },
            Max: { FmtStr: 'Max: {0}', ToolTip: 'Máximo de {0}' },
            Min: { FmtStr: 'Min: {0}', ToolTip: 'Mínimo de {0}' }
        },
        Freeze: 'Congelar',
        Unfreeze: 'Descongelar'
    };

    _dvr.Views = {
        DefaultDescriptions: {
            '$DefaultGridViewDescription': 'Esta es la lista de \u003cb\u003e{0}\u003c/b\u003e.',
            '$DefaultEditViewDescription': 'Por favor revise la información de \u003cb\u003e{0}\u003c/b\u003e a continuación. Haga clic en \u003cb\u003eEditar\u003c/b\u003e para cambiar este registro, haga clic en \u003cb\u003eBorrar\u003c/b\u003e para eliminar el registro, o haga clic en \u003cb\u003eCancelar/Cerrar\u003c/b\u003e para volver a la página anterior.',
            '$DefaultCreateViewDescription': 'Por favor, llene este formato y haga clic en el botón \u003cb\u003eAceptar\u003c/b\u003e para crear un registro nuevo de \u003cb\u003e{0}\u003c/b\u003e. Haga clic en \u003cb\u003eCancelar\u003c/b\u003e para volver a la pantalla anterior.'
        },
        DefaultCategoryDescriptions: {
            '$DefaultEditDescription': 'Estos son los campos del registro de \u003cb\u003e{0}\u003c/b\u003e que se pueden editar.',
            '$DefaultNewDescription': 'Llene el formato a continuación. Asegúrese de entrar todos los campos obligatorios.',
            '$DefaultReferenceDescription': 'La sección de información de referencia muestra detalles adicionales de \u003cb\u003e{0}\u003c/b\u003e.'
        }
    };

    _dvr.Actions = {
        Scopes: {
            'Grid': {
                'Select': {
                    HeaderText: 'Seleccionar'
                },
                'Edit': {
                    HeaderText: 'Editar'
                },
                'Delete': {
                    HeaderText: 'Borrar',
                    Confirmation: '¿Borrar?',
                    Notify: '{$ selected} eliminado'
                },
                'Duplicate': {
                    HeaderText: 'Duplicar'
                },
                'New': {
                    HeaderText: 'Agregar'
                },
                'BatchEdit': {
                    HeaderText: 'Edición por lotes'
                    //                    ,CommandArgument: {
                    //                        'editForm1': {
                    //                            HeaderText: 'Edición por lotes (formato)'
                    //                        }
                    //                    }
                },
                'Open': {
                    HeaderText: 'Abrir'
                }
            },
            'Form': {
                'Edit': {
                    HeaderText: 'Editar'
                },
                'Delete': {
                    HeaderText: 'Borrar',
                    Confirmation: '¿Borrar?',
                    Notify: '{$ selected} eliminado'
                },
                'Cancel': {
                    HeaderText: 'Cancelar',
                    WhenLastCommandName: {
                        'Duplicate': {
                            HeaderText: 'Cancelar'
                        },
                        'Edit': {
                            HeaderText: 'Cancelar'
                        },
                        'New': {
                            HeaderText: 'Cancelar'
                        }

                    }
                },
                'Update': {
                    HeaderText: 'Aceptar',
                    Notify: 'Salvado - {0}',
                    CommandArgument: {
                        'Save': {
                            HeaderText: 'Ahorrar',
                            Notify: 'Salvado - {0}'
                        },
                        'SaveAndContinue': {
                            HeaderText: 'Guardar y continuar',
                            Notify: 'Salvado - {0}'
                        }
                    },
                    WhenLastCommandName: {
                        'BatchEdit': {
                            HeaderText: 'Actualización de la Selección',
                            Confirmation: '¿Actualizar?',
                            Notify: 'Salvado - {0}'
                        }
                    }
                },
                'Insert': {
                    HeaderText: 'Aceptar',
                    Notify: 'Salvado - {0}',
                    CommandArgument: {
                        'Save': {
                            HeaderText: 'Ahorrar',
                            Notify: 'Salvado - {0}'
                        },
                        'SaveAndNew': {
                            HeaderText: 'Guardar y Nuevo',
                            Notify: 'Salvado - {0}'
                        }
                    }
                },
                'Confirm': {
                    HeaderText: 'Aceptar'
                },
                'Navigate': {
                    Controller: {
                        'SiteContent': {
                            HeaderText: 'Añadir Sistema de Identidad'
                        }
                    }
                }
            },
            'ActionBar': {
                _Self: {
                    'Actions': {
                        HeaderText: 'Acciones'
                    },
                    'Report': {
                        HeaderText: 'Reporte'
                    },
                    'Record': {
                        HeaderText: 'Registro'
                    }
                },
                'New': {
                    HeaderText: 'Agregar {0}',
                    Description: 'Crear un registro nuevo de {0}.',
                    HeaderText2: 'Agregar',
                    VarMaxLen: 15
                },
                'Edit': {
                    HeaderText: 'Editar'
                },
                'Delete': {
                    HeaderText: 'Borrar',
                    Confirmation: '¿Borrar?',
                    Notify: '{$ selected} eliminado'
                },
                'ExportCsv': {
                    HeaderText: 'Descargar',
                    Description: 'Descargar elementos en formato CSV.'
                },
                'ExportRowset': {
                    HeaderText: 'Exportar a hoja de cálculo',
                    Description: 'Analizar los elementos con una aplicación\u003cbr/\u003ede hoja de cálculo.'
                },
                'ExportRss': {
                    HeaderText: 'Exportar a RSS',
                    Description: 'Distribuir los elementos con un lector de RSS.'
                },
                'Import': {
                    HeaderText: 'Importar desde archivo',
                    Description: 'Subir un archivo CSV, XLS, XLSX con registros para\u003cbr/\u003eimportar.'
                },
                'Update': {
                    HeaderText: 'Guardar',
                    Description: 'Guardar los cambios en la base de datos.',
                    Notify: 'Salvado - {0}'
                },
                'Insert': {
                    HeaderText: 'Guardar',
                    Description: 'Guardar nuevo registro a la base de datos.',
                    Notify: 'Salvado - {0}'
                },
                'Cancel': {
                    HeaderText: 'Cancelar',
                    WhenLastCommandName: {
                        'Edit': {
                            HeaderText: 'Cancelar',
                            Description: 'Cancelar todos los cambios de registro.'
                        },
                        'New': {
                            HeaderText: 'Cancelar',
                            Description: 'Cancelar nuevo registro.'
                        }
                    }
                },
                'Report': {
                    HeaderText: 'Reporte',
                    Description: 'Generar un reporte en formato PDF'
                },
                'ReportAsPdf': {
                    HeaderText: 'Documento PDF',
                    Description: 'Ver artículos como documento de Adobe PDF.\u003cbr/\u003eVa a necesitar un lector compatible.'
                },
                'ReportAsImage': {
                    HeaderText: 'Imagen de varias páginas',
                    Description: 'Ver artículos como una imagen TIFF de varias páginas.'
                },
                'ReportAsExcel': {
                    HeaderText: 'Hoja de cálculo',
                    Description: 'Ver los elementos en una hoja de cálculo en formato \u003cbr/\u003ede Microsoft Excel.'
                },
                'ReportAsWord': {
                    HeaderText: 'Microsoft Word',
                    Description: 'Ver los elementos en un documento fromateado \u003cbr/\u003een Microsoft Word.'
                },
                'DataSheet': {
                    HeaderText: 'Mostrar la hoja de cálculo',
                    Description: 'Elementos de la pantalla utilizando un formato de hoja de cálculo.'
                },
                'Grid': {
                    HeaderText: 'Mostrar en vista estándar',
                    Description: 'Elementos de la pantalla en formato de tabla\u003cbr/\u003eestándar.'
                },
                'Tree': {
                    HeaderText: 'Mostrar la Jerarquía',
                    Description: 'Mostrar las relaciones jerárquicas.'
                },
                'Search': {
                    HeaderText: 'Búsqueda',
                    Description: 'Búsqueda {0}'
                },
                'Upload': {
                    HeaderText: 'Subir',
                    Description: 'Sube varios archivos.'
                }
            },
            'Row': {
                'Update': {
                    HeaderText: 'Grabar',
                    Notify: 'Salvado - {0}',
                    WhenLastCommandName: {
                        'BatchEdit': {
                            HeaderText: 'Actualización de la Selección',
                            Confirmation: '¿Actualizar?'
                        }
                    }
                },
                'Insert': {
                    HeaderText: 'Insertar',
                    Notify: 'Salvado - {0}'
                },
                'Cancel': {
                    HeaderText: 'Cancelar'
                }
            },
            'ActionColumn': {
                'Edit': {
                    HeaderText: 'Editar'
                },
                'Delete': {
                    HeaderText: 'Borrar',
                    Confirmation: '¿Borrar?',
                    Notify: '{$ selected} eliminado'
                }
            }
        }
    };

    _dvr.Editor = {
        Undo: 'Deshacer',
        Redo: 'Rehacer',
        Bold: 'Audaz',
        Italic: 'Itálico',
        Underline: 'Subrayar',
        Strikethrough: 'Tachado',
        Subscript: 'Sub Guión',
        Superscript: 'Súper Guión',
        JustifyLeft: 'Justificar a la izquierda',
        JustifyCenter: 'Justificar Center',
        JustifyRight: 'Justificar a la derecha',
        JustifyFull: 'Justificar completa',
        InsertOrderedList: 'Inserte lista ordenada',
        InsertUnorderedList: 'Insertar Lista sin ordenar',
        CreateLink: 'Crear vínculo',
        UnLink: 'Desvincular',
        RemoveFormat: 'Eliminar el formato',
        SelectAll: 'Seleccionar todo',
        UnSelect: 'Anular la selección',
        Delete: 'Borrar',
        Cut: 'Cortar',
        Copy: 'Copie',
        Paste: 'Pegar',
        BackColor: 'Color de fondo',
        ForeColor: 'Color Fore',
        FontName: 'Nombre de la fuente',
        FontSize: 'Tamaño de la letra',
        Indent: 'Sangrar',
        Outdent: 'Anular sangría',
        InsertHorizontalRule: 'Insertar regla horizontal',
        HorizontalSeparator: 'Separador',
        Format: 'Formato',
        FormatBlock: {
            p: 'Párrafo',
            blockquote: 'Cotización',
            h1: 'Rúbrica 1',
            h2: 'Rúbrica 2',
            h3: 'Rúbrica 3',
            h4: 'Rúbrica 4',
            h5: 'Rúbrica 5',
            h6: 'Rúbrica 6'
        },
        Rtf: {
            editor: 'Pantalla completa'
        }
    };

    _dvr.Draw = {
        Draw: 'Dibujar',
        Pen: 'Lápiz',
        Highlighter: 'Resaltador',
        Blur: 'Difuminar',
        Eraser: 'Borrador'
    };

    _dvr.Mobile = {
        UpOneLevel: 'Subir un nivel',
        Back: 'Retorno',
        BatchEdited: '{0} actualizado',
        Sort: 'Ordenar',
        Sorted: 'Ordenado',
        SortedDefault: 'Orden de clasificación predeterminado',
        SortByField: 'Seleccionar un campo para cambiar el orden de clasificación de \u003cb\u003e{0}\u003c/b\u003e.',
        SortByOptions: 'Seleccione el orden de clasificación de \u003cb\u003e{0}\u003c/b\u003e por el campo \u003cb\u003e{1}\u003c/b\u003e en la siguiente lista de opciones.',
        DefaultOption: 'Patrón',
        Auto: 'Auto',
        Filter: 'Filtro',
        List: 'Lista',
        Cards: 'Tarjetas',
        Grid: 'Cuadrícula',
        Map: 'Mapa',
        Calendar: 'Calendario',
        ZoomIn: 'Zoom in',
        ZoomOut: 'Alejamiento',
        Directions: 'Instrucciones',
        AlternativeView: 'Seleccione una visión alternativa de los datos.',
        PresentationStyle: 'Seleccione un estilo de presentación de los datos.',
        LookupViewAction: 'Ver',
        LookupSelectAction: 'Seleccionar',
        LookupClearAction: 'Borrar',
        LookupNewAction: 'Agregar',
        LookupInstruction: 'Por favor seleccione \u003cb\u003e{0}\u003c/b\u003e en la lista.',
        LookupOriginalSelection: 'La selección original es \u003cb\u003e \u0026quot;{0}\u0026quot; \u003c/b\u003e.',
        EmptyContext: 'Las acciones no están disponibles.',
        Favorites: 'Favoritos',
        History: 'Historia',
        FilterSiteMap: 'Mapa del sitio filtro ...',
        ResumeLookup: 'Reanudar la búsqueda',
        ResumeEntering: 'Reanudar Introducción',
        ResumeEditing: 'Reanudar edición',
        ResumeBrowsing: 'Reanudar navegación',
        ResumeViewing: 'Reanudar la visualización',
        Menu: 'Menú',
        Home: 'Casa',
        Settings: 'Configuración',
        Sidebar: 'Sidebar',
        Landscape: 'Paisaje',
        Portrait: 'Retrato',
        Never: 'Nunca',
        Always: 'Siempre',
        ShowSystemButtons: 'Mostrar botones del sistema',
        OnHover: 'en la libración',
        ButtonShapes: 'Formas de los botones',
        PromoteActions: 'Promover acciones',
        ConfirmReload: 'Actualizar?',
        ClearText: 'Borrar Text',
        SeeAll: 'Ver Todos',
        More: 'Más',
        TouchUINotSupported: 'Touch UI no se admite en este navegador.',
        ShowingItemsInfo: 'Mostrando {0} artículos.',
        FilterByField: 'Seleccione un campo para aplicar un filtro a \u003cb\u003e{0}\u003c/b\u003e.',
        Apply: 'Aplicar',
        FilterByOptions: 'Seleccione una o varias opciones en la siguiente lista y pulse \u003cb\u003e{2}\u003c/b\u003e para filtrar \u003cb\u003e{0}\u003c/b\u003e por el campo \u003cb\u003e{1}\u003c/b\u003e.',
        Suggestions: 'Sugerencias',
        UnSelect: 'Anular la selección',
        AdvancedSearch: 'Búsqueda Avanzada',
        QuickFindScope: 'Buscar en ...',
        QuickFindDescription: 'Busca en {0}',
        AddMatchingGroup: 'Añadir grupo a juego',
        MatchAll: 'Coincidir con todas las condiciones',
        MatchAny: 'Coincide cualquier condiciones',
        DoNotMatchAll: 'No coinciden todas las condiciones',
        DoNotMatchAny: 'No se han encontrado condiciones',
        MatchAllPastTense: 'Igualados todas las condiciones',
        MatchAnyPastTense: 'Emparejado cualquier condición',
        DoNotMatchAllPastTense: 'No se han encontrado todas las condiciones',
        DoNotMatchAnyPastTense: 'No se han encontrado condiciones',
        In: 'en',
        Recent: 'Reciente',
        Matched: 'Igualados',
        DidNotMatch: 'No se han encontrado',
        ClearFilter: 'Borrar filtro',
        ResetSearchConfirm: 'Restablecer las condiciones de búsqueda?',
        FilterCleared: 'Se borraron todos los filtros.',
        AdvancedSearchInstruction: 'Introduzca condiciones que deben ser igualados y pulse el botón de búsqueda.',
        Refreshed: 'Refrescado',
        Group: 'Grupo',
        Grouped: 'Agrupado',
        UnGrouped: 'Agrupación ha sido eliminada',
        GroupedBy: 'División por',
        GroupByField: 'Seleccione un campo de grupo \u003cb\u003e{0}\u003c/b\u003e.',
        Show: 'Espectáculo',
        Hide: 'Esconder',
        None: 'Ninguno',
        Next: 'próximo',
        Prev: 'Anterior',
        FitToWidth: 'Ajustar al ancho',
        MultiSelection: 'Selección de múltiples',
        InlineEditing: 'Edición en línea',
        ItemsSelectedOne: '{0} Elemento seleccionado',
        ItemsSelectedMany: '{0} elementos seleccionados',
        TypeToSearch: 'Escribe para buscar',
        NoMatches: 'No hay coincidencias.',
        ShowingItemsRange: 'Mostrando {0} {1} de artículos',
        Finish: 'Terminar',
        ShowOptions: 'Mostrar opciones',
        ConfirmContinue: '¿Continuar?',
        AddAccount: 'Añadir cuenta',
        Fullscreen: 'Pantalla completa',
        ExitFullscreen: 'Salir de pantalla completa',
        Apps: 'aplicaciones',
        Forget: 'Olvidar',
        ManageAccounts: 'Cuentas de administración',
        SignedOut: 'Cerró sesión',
        Submit: 'Enviar',
        Error: 'Error',
        Line: 'Línea',
        Download: 'Descargar',
        Orientation: 'Orientación',
        Device: 'Dispositivo',
        ShowMore: 'Mostrar más',
        ShowLess: 'Muestra menos',
        WithSpecifiedFilters: 'Con filtros especificados',
        WithSelectedValues5: 'Con Valores Seleccionados (Top 5)',
        WithSelectedValues10: 'Con Valores Seleccionados (Top 10)',
        ReadOnly: '{0} es de solo lectura.',
        ScanToConfirm: 'Por favor, escanee nuevamente para confirmar.',
        Reading: 'Leyendo...',
        ReadingPane: 'Panel de lectura',
        AutoOpenNextItem: 'Abrir automáticamente el siguiente elemento',
        From: 'de',
        Verify: 'Verificar',
        Enable: 'Habilitar',
        Generate: 'Generar',
        Wait: 'Espere por favor...',
        InlineCommands: {
            List: {
                Select: 'Seleccione un artículo',
                Edit: 'Editar elemento',
                New: 'Nuevo artículo',
                Duplicate: 'Artículo duplicado',
            },
            Grid: {
                Select: 'Seleccionar fila',
                Edit: 'Editar fila',
                New: 'Nueva fila',
                Duplicate: 'Fila duplicada',
            }
        },
        DisplayDensity: {
            Label: 'Display Density',
            List: {
                Tiny: 'Minúsculo',
                Condensed: 'Condensado',
                Compact: 'Compacto',
                Comfortable: 'Cómodo'
            }
        },
        Files: {
            KB: 'KB',
            MB: 'KB',
            Bytes: 'bytes',
            Drop: 'Caída de un archivo aquí',
            DropMany: 'Suelte archivos aquí',
            Tap: 'Toque para seleccionar un archivo',
            TapMany: 'Pulse para seleccionar archivos',
            Click: 'Haga clic para seleccionar un archivo',
            ClickMany: 'Haga clic para seleccionar los archivos',
            Clear: 'Claro',
            ClearConfirm: 'Claro?',
            Sign: 'Regístrate aquí',
            Cleared: 'El valor se borrará al guardar'
        },
        Import: {
            SelectFile: 'Seleccione un archivo de datos en formato CSV, XLS o XLSX.',
            NotSupported: 'Formato de datos de \u0026quot;{0}\u0026quot; no es compatible.',
            NotMatched: '(no coinciden)',
            FileStats: 'Existen registros \u003cb\u003e{0}\u003c/b\u003e en el archivo \u003cb\u003e{1}\u003c/b\u003e lista para ser procesada. Por favor coincidir con los nombres de los campos.',
            Importing: 'Importador',
            Into: 'dentro',
            StartImport: 'Iniciar importación',
            InsertingRecords: 'Inserción de registros',
            TestingRecords: 'registros de las pruebas',
            ResolvingReferences: 'resolver las referencias',
            Complete: 'completar',
            Expected: 'Se espera que completar',
            Remaining: 'Se espera que completar',
            Done: 'importación completado',
            Duplicates: 'duplicados'
        },
        Themes: {
            Label: 'Tema',
            Accent: 'Acento',
            List: {
                None: 'Ninguna',
                Light: 'Luz',
                Dark: 'Oscuro',
                Aquarium: 'Acuario',
                Azure: 'Azur',
                Belltown: 'Belltown',
                Berry: 'Baya',
                Bittersweet: 'Agridulce',
                Cay: 'Cay',
                Citrus: 'Agrios',
                Classic: 'Clásico',
                Construct: 'Construir',
                Convention: 'Convención',
                DarkKnight: 'Dark Knight',
                Felt: 'Sentido',
                Graham: 'Graham',
                Granite: 'Granito',
                Grapello: 'Grapello',
                Gravity: 'Gravedad',
                Lacquer: 'Laca',
                Laminate: 'Laminado',
                Lichen: 'Liquen',
                Mission: 'Misión',
                Modern: 'Moderno',
                ModernRose: 'Rose Modern',
                Municipal: 'Municipal',
                Petal: 'Pétalo',
                Pinnate: 'Pinada',
                Plastic: 'Plástico',
                Ricasso: 'Ricasso',
                Simple: 'Simple',
                Social: 'Social',
                Summer: 'Verano',
                Vantage: 'Ventaja',
                Verdant: 'Verde',
                Viewpoint: 'Punto de vista',
                WhiteSmoke: 'Humo Blanco',
                Yoshi: 'Yoshi'
            }
        },
        Transitions: {
            Label: 'Transiciones',
            List: {
                none: 'Ninguno',
                slide: 'Diapositiva',
                fade: 'Descolorarse',
                pop: 'Música pop',
                flip: 'Capirotazo',
                turn: 'Turno',
                flow: 'Flujo',
                slideup: 'Deslizar arriba',
                slidedown: 'Deslice hacia abajo'
            }
        },
        LabelsInList: {
            Label: 'Etiquetas en la lista',
            List: {
                DisplayedAbove: 'Aparece por encima de',
                DisplayedBelow: 'Se muestran a continuación'
            }
        },
        InitialListMode: {
            Label: 'Modo Lista Inicial',
            List: {
                SeeAll: 'Ver Todos',
                Summary: 'Resumen'
            }
        },
        Dates: {
            SmartDates: 'Fechas inteligentes',
            Yesterday: 'ayer',
            Last: 'Último',
            Today: 'hoy',
            OneHour: 'hace una hora',
            MinAgo: 'Hace {0} min',
            AMinAgo: 'hace un minuto',
            InHour: 'dentro de una hora',
            InMin: 'en {0} min',
            InAMin: 'en un minuto',
            Now: 'ahora',
            JustNow: 'Justo ahora',
            Tomorrow: 'mañana',
            Next: 'Siguiente'
        },
        Sync: {
            Uploading: 'Subiendo {0}...'
        },
        Develop: {
            Tools: 'Herramientas de desarrollo',
            Explorer: 'Explorador de proyectos',
            FormLayout: 'Diseño del formulario',
            FormLayoutInstr: 'Seleccione los tamaños de pantalla que se incluirán en el diseño.'
        },
        Keyboard: {
            TelHints: {
                Key1: ' ',
                Key2: 'a B C',
                Key3: 'def',
                Key4: 'ghi',
                Key5: 'jkl',
                Key6: 'mno',
                Key7: 'pqrs',
                Key8: 'tuv',
                Key9: 'W x Y Z'
            }
        }
    };

    _dvr.ODP = {
        Initializing: 'Inicializando ...',
        Status: 'Estado',
        Sync: 'Sincronizar',
        Synced: 'Sincronizado',
        SyncLong: 'Sincronizar para cargar cambios.',
        SyncLast: 'Última sincronización',
        Committing: 'Subiendo transacciones ...',
        SyncUploadingFiles: 'Subiendo {0} ...',
        SyncUploadFailed: 'Error al cargar {0} archivos.',
        UploadingFiles: 'Subiendo {0} archivos ...',
        UploadFailed: 'Error al cargar archivos.',
        Pending: 'Cambios pendientes',
        DownloadingData: 'Descargando datos para {0}...',
        DownloadingBlob: 'Descargando datos binarios para {0}...',
        UnableToExec: 'Imposible ejecutar.',
        UnableToProcess: 'Incapaz de procesar transacciones.',
        UnableToSave: 'No se pueden guardar los cambios.',
        UnableToDelete: 'No se puede eliminar. {1} elementos dependientes en {0}.',
        Save: 'Por favor guarde todos los cambios.',
        SaveAndSync: 'Guarde todos los cambios y elija la opción Sincronizar en el menú contextual.',
        OnlineRequired: 'Se requiere conexión en línea.',
        OfflineState: 'Estás trabajando en modo fuera de línea.',
        InvalidResponse: 'Respuesta no válida del servidor.',
        ReconRequired: 'Se requiere reconciliación',
        ReconTxDelete: '¿Eliminar este cambio del registro?',
        ReconTxDeleted: 'Primera transacción pendiente eliminada en el registro.',
        NotRefreshed: 'Los datos no se han actualizado.',
        LastRefresh: 'Última actualización: {0}.',
        ServerUnavailable: 'El servidor de aplicaciones no está disponible.',
        Refresh: 'Actualizar datos',
        RefreshLast: 'Datos actualizados',
        RefreshData: 'Actualizar datos',
        Done: 'Hecho.'
    };

    _dvr.Device = {
        Exit: 'Salida',
        DeviceLoginPrompt: 'Inicie sesión para autorizar el acceso en este dispositivo.'
    };

    _dvr.TwoFA = {
        Text: 'Autenticación de 2 factores',
        AuthenticatorApp: 'Aplicación Authenticator',
        VerificationCode: 'Código de verificación',
        Method: 'Método',
        TrustThisDevice: 'Confía en este dispositivo',
        Consent: 'Consentimiento',
        EnterPassword: 'Ingresa tu contraseña',
        Messages: {
            InvalidVerificationCode: 'Código de verificación invalido.',
            InvalidPassword: 'Contraseña invalida.',
            EnterCode: 'Ingrese el código de verificación de {0} dígitos.',
            YourCode: '000000 es su código de verificación {0}.',
            DisableQuestion: '¿Deshabilitar la autenticación de dos factores?',
            Enabled: 'Se ha habilitado la autenticación de 2 factores.',
            Disabled: 'Se ha desactivado la autenticación de 2 factores.',
            Changed: 'Se ha cambiado la autenticación de 2 factores.'
        },
        BackupCode: {
            Text: 'Código de respaldo',
            Placeholder: 'código de una sola vez',
            Footer: 'Si no puede proporcionar el código de verificación, ingrese el código de respaldo.'
        },
        Actions: {
            GetVerificationCode: 'Obtener código de verificación'
        },
        VerifyVia: {
            email: 'El código de verificación se enviará por correo electrónico.',
            sms: 'El código de verificación se enviará por mensaje de texto.',
            call: 'Recibiré una llamada automática en mi teléfono.',
            app: 'Usaré una aplicación de autenticación para obtener el código de verificación.'
        },
        Setup: {
            Consent: 'Ingresaré un código de verificación después de iniciar sesión correctamente.',
            Methods: 'Métodos de verificación',
            AppConfigScanQrCode: 'Tengo una aplicación de autenticación en un dispositivo móvil.',
            AppConfigEnterSetupKey: 'No puedo escanear el código QR.',
            AppConfigInstallApp: 'Necesito ayuda para instalar la aplicación de autenticación.',
            ScanQrCode: 'Escanea el código QR en la aplicación',
            EnterSetupKey: 'Ingrese la clave de configuración en la aplicación',
            ScanAppQrCode: 'Escanea el código QR con la cámara',
            BackupCodes: {
                Text: 'Códigos de respaldo',
                Footer: 'Los códigos de seguridad de un solo uso le permitirán iniciar sesión si no puede proporcionar un código de verificación.'
            }
        },
        GetCode: {
            call: 'Llámame a',
            sms: 'Envíame un mensaje de texto al',
            email: 'Envíeme un correo electrónico a',
            dial: 'llamaré'
        },
        CodeSent: {
            call: 'Se hizo una llamada a',
            sms: 'Se envió un mensaje de texto a',
            email: 'El correo electrónico fue enviado a'
        }
    };

    _dvr.Presenters = {
        Charts: {
            Text: 'Gráficas',
            DataWarning: 'El número máximo de elementos de proceso es {0: d}. Haga clic aquí para filtrar el resultado.',
            ShowData: 'Mostrar datos',
            ShowChart: 'Mostrar gráfico',
            Sizes: {
                Label: 'Tamaño',
                Small: 'Pequeño',
                Medium: 'Medio',
                Large: 'Grande'
            },
            ChartLabels: {
                By: 'por',
                Top: 'superior',
                Other: 'Otro',
                Blank: 'En blanco',
                GrandTotals: 'Grandes totales',
                CountOf: 'Conde de',
                SumOf: 'Suma de',
                AvgOf: 'Promedio de',
                MinOf: 'Mínimo de',
                MaxOf: 'Máximo de',
                Quarter: 'Trimestre',
                Week: 'Semana'
            }
        },
        Calendar: {
            Text: 'Calendario',
            Today: 'Hoy',
            Noon: 'Mediodía',
            Year: 'Año',
            Month: 'Mes',
            Week: 'Semana',
            Day: 'Día',
            Agenda: 'Orden del día',
            Sync: 'Sincronización',
            Less: 'Menos'
        }
    };

    // membership resources

    var _mr = Web.MembershipResources = {};

    _mr.Bar = {
        LoginLink: 'Ingresar',
        LoginText: ' a este sitio web',
        HelpLink: 'Ayuda',
        UserName: 'Nombre de usuario:',
        Password: 'Contraseña:',
        RememberMe: 'Recordarme la próxima vez',
        ForgotPassword: '¿Olvidó su contraseña?',
        SignUp: 'Regístrese ahora',
        LoginButton: 'Ingresar',
        MyAccount: 'Mi Cuenta',
        LogoutLink: 'Cerrar sesión',
        HelpCloseButton: 'Cerrar',
        HelpFullScreenButton: 'Pantalla completa',
        UserIdle: '¿Todavía está ahí? Por favor, ingrese de nuevo.',
        History: 'Historia',
        Permalink: 'Enlace permanente',
        AddToFavorites: 'Agregar a mis favoritos',
        RotateHistory: 'Girar',
        Welcome: 'Hola <b>{0}</b>, Hoy es {1:D}',
        ChangeLanguageToolTip: 'Cambiar la lengua',
        PermalinkToolTip: 'Crear un enlace permanente de registro seleccionado',
        HistoryToolTip: 'Ver la historia de los registros previamente seleccionados',
        AutoDetectLanguageOption: 'Auto Detect'
    };

    _mr.Messages = {
        InvalidUserNameAndPassword: 'Su nombre de usuario y contraseña no son válidos.',
        BlankUserName: 'El nombre de usuario no puede estar en blanco.',
        BlankPassword: 'La contraseña no puede estar en blanco.',
        PermalinkUnavailable: 'El enlace permanente no está disponible. Por favor, seleccione un registro.',
        HistoryUnavailable: 'La historia no está disponible.'
    };

    _mr.Manager = {
        UsersTab: 'Usuarios',
        RolesTab: 'Funciones',
        UsersInRole: 'Usuarios en Papel'
    };

    if (typeof Sys !== 'undefined') Sys.Application.notifyScriptLoaded();
})();