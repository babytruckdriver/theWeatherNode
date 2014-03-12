/*jslint indent:8, devel:true, browser:true, vars:true*/
/*global jQuery, $, Handlebars*/

// Esta es la forma más habitual de escribir '$(document).ready()'
jQuery(function ($) {
        "use strict";

        // ajaxInProgress: La variable informa si hay una petición Ajax en proceso
        var     ajaxInProgress = false,
                ENTER_KEY = 13;

        // Tipos de llamadas Ajax y tiempo de cacheo de respuestas
        // FUTURE: Estas variables se utilizarán cuando haya diferentes tipos de peticiones Ajax. Por el momento solo hay una
        var     FORECAST_CALL = 0,
                LOCALIDAD_CALL = 1;

        // Objeto contenedor de utilidades.
        // Estas funciones, si su uso es lo suficientemente común, podrían ir en un archivo '.js' a parte.
        var util = {
                getDiaSemana: function (numDia) {
                        var dias = [    {short: "D", complete: "Domingo"},
                                        {short: "L", complete: "Lunes"},
                                        {short: "M", complete: "Martes"},
                                        {short: "X", complete: "Miércoles"},
                                        {short: "J", complete: "Jueves"},
                                        {short: "V", complete: "Viernes"},
                                        {short: "S", complete: "Sábado"}
                                        ];
                        return dias[numDia];
                },

                // Cachea respuestas de servidor en LocalStorage (HTML5)
                // Funcionalidad para el cacheo de respuestas Ajax
                cache: {
                        CACHE_MINUTES: 5, //0 significa 'sin caché'
                        setResponse: function (key, obj) {

                                // Si no existe el objecto lo crea.
                                if (!localStorage.getItem(key)) {

                                        // En 'localStorage' se almacena la serialización de un objeto (toString), por lo que lo serializa antes para que se almacene correctamente (JSON.stringify)
                                        localStorage.setItem(key, JSON.stringify(obj));
                                }
                        },
                        getResponse: function (key) {
                                var     antiguedadCache,
                                        objStored = localStorage.getItem(key);

                                // Retorna el objeto solo si existe y no es más antigo que CACHE_MINUTES
                                // En caso de ser antiguo lo borra
                                if (objStored) {
                                        objStored = JSON.parse(objStored);
                                        antiguedadCache = (Date.now() - new Date(objStored.date).getTime()) / 60000;
                                        if (antiguedadCache <= this.CACHE_MINUTES) {
                                                return objStored;
                                        } else {
                                                localStorage.removeItem(key);

                                                // Cada vez que caduque una respuesta hacer un barrido en busca de más respuestas caducadas
                                                this.deleteObsoleteResponses();
                                        }
                                }
                                return undefined;
                        },

                        // Recorre las propiedades de localStorage y borra las que están caducadas según CACHE_MINUTES
                        deleteObsoleteResponses: function () {
                                var key, antiguedadCache, obj;
                                for (key in localStorage) {
                                        if (typeof localStorage[key] !== "function" && localStorage.hasOwnProperty(key)) {
                                                obj = JSON.parse(localStorage.getItem(key));
                                                antiguedadCache = (Date.now() - new Date(obj.date).getTime()) / 60000;
                                                if (antiguedadCache > this.CACHE_MINUTES) {
                                                        localStorage.removeItem(key);
                                                }
                                        }
                                }
                        }
                },

                // Se modifica la URL con la localidad consultada con el fin de que el enlace pueda ser almacenado como marcador/favorito
                // La misma función (pushState), además, genera historial
                historyHandler: function (newHash) {
                        var hash = window.location.hash;
                        if (!hash || (hash === "#")) {
                                window.history.pushState(null, "The Weathernode", "#/" + newHash);
                        } else {

                                // Si se está consultando la misma localidad (o se ha recargado la página -F5-) no se desea guardar en historial
                                if (hash.slice(2) !== newHash) {

                                        // NOTE: He obserbado que según el PC (mismo navegador) las URLs con espacios se codifican con %20 o no.
                                        // Esto es un problema, porque el método 'replace' no encuntra la cadena si tiene %20.
                                        // La solución es utilizar el método 'encodeURIComponent', pero si no lleva %20 tampoco lo encuentra
                                        // Estar atento...
                                        window.history.pushState(null, "The Weathernode", hash.replace(hash.slice(2), newHash));
                                }
                        }
                }
        };

        var App = {
                init: function () {

                        // Poner el foco en el primer campo de entrada visible
                        $("body").find("input[type=text]:visible:first").focus();
                        this.cacheElements();
                        this.bindEvents();
                        this.route();
                },
                cacheElements: function () {
                        this.window = $(window);
                        this.forecastTemplate = Handlebars.compile($('#forecast-template').html());
                        this.weatherNode = $("#weatherNode");
                        this.condicionesActuales = this.weatherNode.find("#condicionesActuales");
                        this.cuerpo = this.weatherNode.find(".cuerpo");
                        this.temperatura = this.condicionesActuales.find(".temperatura");
                        this.estado = this.condicionesActuales.find(".estado");
                        this.localidadTemperatura = this.condicionesActuales.find(".localidad-temperatura");
                        this.imagenActual = this.condicionesActuales.find(".imagen-actual");
                        this.localidad = this.cuerpo.find("#localidad");
                        this.indicadorAjaxEnCurso = this.cuerpo.find("#indicadorAjaxEnCurso");
                        this.btoGetWeatherInfo = this.cuerpo.find("#getWeatherInfo");
                        this.forecastContainer = this.cuerpo.find("#forecast-container");
                        this.validacionesContainer = this.cuerpo.find("#validaciones-container");
                        this.errorContainer = this.cuerpo.find("#error-container");
                        this.txtLocalidad = this.cuerpo.find(".localidad");
                },
                bindEvents: function () {

                        // Al clicar el botón se consulta el tiempo para la localidad indicada
                        this.btoGetWeatherInfo.on("click", this.eventWeatherInfo.bind(this));
                        this.btoGetWeatherInfo.on("mouseover", this.eventMuestraBuscar.bind(this));
                        this.localidad.on("click", this.eventMuestraBuscar.bind(this));
                        this.localidad.on("keyup", this.eventLocalidad.bind(this));

                        this.window.on("hashchange", this.route.bind(this));

                        // Acciones a ejecutar cuando una petición Ajax comienza y/o termina
                        var that = this;
                        $(document).on("ajaxStart", function () {
                                ajaxInProgress = true;
                                that.indicadorAjaxEnCurso.show();
                        });
                        $(document).on("ajaxStop", function () {
                                ajaxInProgress = false;
                                that.indicadorAjaxEnCurso.hide();
                        });

                        $(document).on("keypress", function (e) {
                                var $selectedRow = $(".filaSel");
                                console.log(">>" + $selectedRow.text());
                                //TODO: if($selectedRow !== undefined)
                                switch (e.keyCode) {
                                        case 38: {
                                                console.log("Subo...");
                                                console.log(">Anterior>" + $selectedRow.prev().text());
                                                //TODO: Mover el ratón X pixels hacia arriba
                                                $selectedRow.prev().mouseover();

                                                break;
                                        }
                                        case 40: {
                                                console.log("Bajo...");
                                                console.log(">Siguiente>" + $selectedRow.next().text());
                                                //TODO: Mover el ratón X pixels hacia abajo
                                                $selectedRow.next().mouseover();

                                                break;
                                        }
                                }
                        });

                        $(".fila").on("mouseover", function () {
                                console.log("^^" + $(this).text());
                                $(this).siblings().removeClass("filaSel");
                                $(this).toggleClass("filaSel");
                        });
                },
                route: function (e) {
                        var hash = window.location.hash.slice(2);

                        // Si en la URL se informa una localidad buscar directamente la previsión sobre la misma. Ej: /#/madrid
                        if (hash.length) {
                                this.localidad.val(hash);
                                this.txtLocalidad.text(hash);
                                this.btoGetWeatherInfo.click();
                        } else if (this.localidad.val()) {

                                //Si está relleno el input de localidad y no hay hash es porque se ha pulsado -F5-, así que se resetea la aplicación y se refresca la página
                                this.localidad.val("");
                                this.txtLocalidad.text("...");
                                window.location.reload();
                        }
                },

                /*
                Métodos utilizados desde 'bindEvents'
                */

                // Muestra mensajes de validación
                muestraValidaciones: function (arrValidaciones) {

                        //La información meteorológica anteriormente cargada se esconde
                        this.forecastContainer.hide();
                        this.condicionesActuales.hide();

                        this.validacionesContainer.html("<span class='centrado'>" + arrValidaciones[0] + "<span>");

                        if (this.validacionesContainer.is(":visible")) {
                                this.validacionesContainer.slideUp(200).delay(200).slideDown(200);
                        } else {
                                this.validacionesContainer.slideDown(200);
                        }
                },

                // Maneja los errores de la petición Ajax
                // err = { cod, desc }
                errorHandle: function (err) {
                        // La información meteorológica anteriormente cargada se oculta, además de los errores que se estén ya mostrando
                        this.forecastContainer.hide();
                        this.condicionesActuales.hide();
                        this.errorContainer.hide();

                        var errorMsg = err.statusText + "\n Error " + err.status;

                        this.errorContainer.html(errorMsg);
                        this.errorContainer.slideDown(200).delay(5000).slideUp(2000);
                },
                eventWeatherInfo: function () {

                        // Validaciones sobre los campos de entrada
                        var erroresEntrada = false;
                        if (!this.localidad.val()) {
                                this.muestraValidaciones(["Es necesario especificar una localidad"]);
                                this.localidad.focus().addClass("error-input");
                                erroresEntrada = true;
                        }

                        if (!erroresEntrada) {
                                this.validacionesContainer.hide();
                                this.getWeatherInfo();
                        }
                },
                eventLocalidad: function (event) {

                        // Al comenzar a teclear en el campo de entrada quitar la alerta visual de error por campo vacío
                        this.localidad.removeClass("error-input");

                        // Si la tecla pulsada es un 'Intro' lanzar el evento 'click' del botón
                        if (event.keyCode === ENTER_KEY) {
                                this.btoGetWeatherInfo.click();
                                return true;
                        }

                        // Se utiliza 'event.target' en vez de 'this', ya que este en vez de hacer referencia al objeto
                        // que ha lanzado el evento hace referenci al objeto App porque se ha invocado así: '.bind(this)'?
                        this.txtLocalidad.text($(event.target).val());

                        // Si el campo está vacío
                        if (!$(event.target).val()) {
                                this.txtLocalidad.text("...");
                        }

                        // Si se han introducido más de 3 caracteres se procede a buscar localidades
                        // que coincidan con esos caracteres
                        // FUTURE Descomentar cuando se sepa qué hacer con la lista de localidades devueltas
                        /*
                        if ($(this).val().length >= 4) {
                        getLocalidades(this);
                        }*/
                },

                eventMuestraBuscar: function (event) {

                        // Al clicar en el campo de entrada quitar la alerta visual de error por campo vacío
                        $(event.target).removeClass("error-input");
                        this.localidad.select();
                        this.localidad.css("width", "100%");
                },

                // Recupera la información meteorológica para la localización introducida
                getWeatherInfo: function () {
                        // Si no hay una petición Ajax en curso se realiza una
                        if (!ajaxInProgress) {
                                var     key = this.localidad.val().trim().toUpperCase(),
                                        cachedObj = util.cache.getResponse(key);

                                // Si existe una respuesta cacheada para la misma localidad utilizar los datos cacheados
                                // Si la respuesta cacheada sí existe pero no está vigente (es antigua), util.cache no habrá devuelvo respuesta
                                if (cachedObj) {
                                        this.printWeather(cachedObj.response);
                                        return false;
                                }

                                // URL del servicio RESTful del Backend de la aplicación
                                var targetUrl = "/forecast";

                                // Objecto con los datos de entrada de la petición
                                var datos = {
                                        formato: "json",
                                        localidad: this.localidad.val(),
                                        numDias: 4
                                };

                                // NOTE: Se quiere utilizar 'this' dentro de una función [complete] de un objeto, pero la función tendrá como 'this' el objeto en el que fué creada
                                // por lo que guardo el 'this' actual en una variable alcanzable desde dentro de la función llamada 'that'
                                var that = this;

                                // Configuración y llamada al servicio RESTful vía Ajax
                                $.ajax({
                                        url: targetUrl,
                                        data: datos,
                                        type: "GET",
                                        dataType: "json",
                                        cache: false,
                                        contentType: "application/x-www-form-urlencoded; charset=UTF-8", // por defecto
                                        // En el contexto de una invocación Ajax, 'this' no se refiere al objeto contenedor sino a la propia llamada. Por eso 'bind(this)'
                                        success: this.printWeather.bind(this),
                                        error: this.errorHandle.bind(this),
                                        // Función que se ejecuta sin importar el resultado de la petición Ajax
                                        // CHANGES He comprobado que si se produce una excepción en la función 'success' la función 'complete' no se ejecuta.
                                        complete: function () {
                                        }
                                });
                        } // End if
                },

                // Función que ejecuta en caso de que la petición Ajax 'getWeatherInfo' haya sido exitosa
                // Muestra en pantalla la información meteorológica
                printWeather: function (json) {

                        // Si no se ha producido ningún error al tratar el objeto JSON en el Backend
                        if (json.ok) {

                                // Si la respuesta no contiene errores
                                if (json.info.data.error === undefined) {

                                        //Actualizar hash e historial
                                        util.historyHandler(this.localidad.val().trim().toLocaleLowerCase());

                                        // Cachear la respuesta del servidor (los errores no se cachean, solo las respuestas válidas)
                                        // Si la respuesta ya está cacheada y está vigente (no es antigua) esta nos e cacheará. Esta funcionalidad se implementa en util.cache
                                        var key = this.localidad.val().trim().toUpperCase();
                                        util.cache.setResponse(key, {
                                                type: FORECAST_CALL,
                                                date: Date(),
                                                response: json
                                        });

                                        // Carga del tiempo actual
                                        this.temperatura.text(json.info.data.current_condition[0].temp_C + "Cº");
                                        this.estado.text(json.info.data.current_condition[0].weatherDesc[0].value);
                                        $(this.temperatura).closest("div").show();
                                        this.localidadTemperatura.text(json.info.data.request[0].query);

                                        // FUTURE utilizar los siguientes datos referentes al tiempo actual
                                        /*
                                        $("#cloud-cover").text(json.info.data.current_condition[0].cloudcover + "%");
                                        $("#precipitacion").text(json.info.data.current_condition[0].precipMM + "mm");
                                        $("#velocidad-viento").text(json.info.data.current_condition[0].windspeedKmph + "Km/h");
                                        */

                                        // Carga de la imagen asociada al tiempo actual
                                        this.imagenActual.attr("src", json.info.data.current_condition[0].weatherIconUrl[0].value);

                                        // Presentación de la previsión meteorológica (diferentes de temperatura actual)
                                        var jsonForecast = json.info.data.weather;

                                        if (jsonForecast !== undefined) {

                                                // Se quiere utilizar 'this' dentro del bucle, pero los bucles crean sus propios 'this'
                                                // por lo que guardo el 'this' actual en una variable alcanzable desde dentro del bucle llamada 'that'
                                                var that = this;
                                                this.forecastContainer.empty();

                                                $.each(jsonForecast, function (key, value) {

                                                        // Mostrar fecha en formato Español/España
                                                        var date = new Date(value.date);
                                                        var day = date.getDate();
                                                        var month = date.getMonth() + 1;
                                                        var year = date.getFullYear();

                                                        var fechaFormateada = util.getDiaSemana(date.getDay()).complete + " " + day + "/" + month + "/" + year;
                                                        var hoy = new Date();

                                                        if ((hoy.getDate() === day) && (hoy.getMonth() + 1 === month) && (hoy.getFullYear() === year)) {
                                                                fechaFormateada = "Hoy";
                                                        }

                                                        // Creo objeto de configuración de entrada para la plantilla Handlebars 'forecastTemplate'
                                                        var forecast = {
                                                                imagen: value.weatherIconUrl[0].value,
                                                                cabecera: fechaFormateada,
                                                                temperatura: value.tempMaxC + "/" + value.tempMinC + "Cº Max/min",
                                                                estado: value.weatherDesc[0].value,
                                                                precipitacion: value.precipMM + "mm",
                                                                velocidadViento: value.windspeedKmph + "Km/h"
                                                        };
                                                        that.forecastContainer.append(that.forecastTemplate(forecast));
                                                });

                                                this.forecastContainer.append("<div class='clear'></div>");
                                        }

                                        // Animación para la presentación del listado de datos y la imagen
                                        if (this.forecastContainer.is(":visible")) {
                                                this.forecastContainer.slideUp(200).delay(200).slideDown(1000);
                                                this.condicionesActuales.hide().slideDown("1000");
                                        } else {
                                                this.forecastContainer.slideDown(1000);
                                                this.condicionesActuales.hide().slideDown("1000");
                                        }
                                } else {
                                        // Se pasa el error a la función manejadora de errores
                                        this.errorHandle({statusText: json.info.data.error[0].msg, status: 200});
                                }
                        } else {
                                this.errorHandle({statusText: "Ha ocurrido un problema al recuperar la información.", status: 500});
                        }
                }

        };

        App.init();
});
