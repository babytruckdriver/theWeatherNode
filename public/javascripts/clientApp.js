/*jslint indent:8, devel:true, browser:true, vars:true*/
/*global jQuery, $, Handlebars*/

//Esta es otra forma de escribir '$(document).ready()'
jQuery(function ($) {
        "use strict";

        //La variable informa si hay una petición Ajax en proceso
        var ajaxInProgress = false,
                ENTER_KEY = 13;

        //Objeto contenedor de utilidades. Aquí podría ir el esqueleto de la llamada vía Ajax
        //Estas funciones, si su uso es lo suficientemente común, podrían ir en un archivo '.js' a parte.
        var util = {
                getDiaSemana: function (numDia) {
                        var dias = [{short: "D", complete: "Domingo"},
                                        {short: "L", complete: "Lunes"},
                                        {short: "M", complete: "Martes"},
                                        {short: "X", complete: "Miércoles"},
                                        {short: "J", complete: "Jueves"},
                                        {short: "V", complete: "Viernes"},
                                        {short: "S", complete: "Sábado"}];
                        return dias[numDia];
                }
        };

        var App = {
                init: function () {
                        //Poner el foco en el primer campo de entrada visible
                        $("body").find("input[type=text]:visible:first").focus();
                        this.cacheElements();
                        this.bindEvents();
                },
                cacheElements: function () {
                        this.forecastTemplate = Handlebars.compile($('#forecast-template').html());
                        this.weatherNode = $("#weatherNode");
                        this.condicionesActuales = this.weatherNode.find("#condicionesActuales");
                        this.temperatura = this.condicionesActuales.find(".temperatura");
                        this.estado = this.condicionesActuales.find(".estado");
                        this.localidadTemperatura = this.condicionesActuales.find(".localidad-temperatura");
                        this.imagenActual = this.condicionesActuales.find(".imagen-actual");
                        this.cuerpo = this.weatherNode.find(".cuerpo");
                        this.localidad = this.cuerpo.find("#localidad");
                        this.indicadorAjaxEnCurso = this.cuerpo.find("#indicadorAjaxEnCurso");
                        this.btoGetWeatherInfo = this.cuerpo.find("#getWeatherInfo");
                        this.forecastContainer = this.cuerpo.find("#forecast-container");
                        this.cabeceras = this.forecastContainer.find(".cabecera");
                        this.validacionesContainer = this.cuerpo.find("#validaciones-container");
                        this.errorContainer = this.cuerpo.find("#error-container");
                        this.txtLocalidad = this.cuerpo.find(".localidad");
                },
                bindEvents: function () {
                        //Al clicar el botón se consulta el tiempo para la localidad indicada
                        this.btoGetWeatherInfo.on("click", this.eventWeatherInfo.bind(this));
                        this.localidad.on("keyup", this.eventLocalidad.bind(this));
                        //Al clicar en el campo de entrada quitar la alerta visual de error por campo vacío
                        this.localidad.on("click", function (event) {
                                $(event.target).removeClass("error-input");
                        });
                },

                /* Métodos utilizados desde 'bindEvents' */

                eventWeatherInfo: function () {
                        //Validaciones sobre los campos de entrada
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
                        //Al comenzar a teclear en el campo de entrada quitar la alerta visual de error por campo vacío
                        this.localidad.removeClass("error-input");

                        //Si la tecla pulsada es un 'Intro' lanzar el evento 'click' del botón
                        if (event.keyCode === ENTER_KEY) {
                                this.btoGetWeatherInfo.click();
                                return true;
                        }

                        //Se utiliza 'event.target' en vez de 'this', ya que este en vez de hacer referencia al objeto
                        //que ha lanzado el evento hace referenci al objeto App porque se ha invocado así: '.bind(this)'?
                        this.txtLocalidad.text($(event.target).val());

                        //Si el campo está vacío
                        if (!$(event.target).val()) {
                                this.txtLocalidad.text("...");
                        }

                        //Si se han introducido más de 3 caracteres se procede a buscar localidades
                        //que coincidan con esos caracteres
                        //FUTURE Descomentar cuando se sepa qué hacer con la lista de localidades devueltas
                        /*if ($(this).val().length >= 4) {
                        getLocalidades(this);
                        }*/
                },
                //Muestra mensajes de validación
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

                //Maneja los errores de la petición Ajax
                //err = { cod, desc }
                errorHandle: function (err) {
                        //La información meteorológica anteriormente cargada se oculta, además de los errores que se estén ya mostrando
                        this.forecastContainer.hide();
                        this.condicionesActuales.hide();
                        this.errorContainer.hide();

                        var errorMsg = err.statusText + "\n Error " + err.status;

                        this.errorContainer.html(errorMsg);
                        this.errorContainer.slideDown(200).delay(3000).slideUp(2000);
                },
                //Recupera la información meteorológica para la localización introducida
                getWeatherInfo: function () {
                        //Si no hay una petición Ajax en curso se realiza una
                        if (!ajaxInProgress) {
                                //URL del servicio RESTful del Backend de la aplicación
                                var targetUrl = "/forecast";

                                //Objecto con los datos de entrada de la petición
                                var datos = {
                                        formato: "json",
                                        localidad: this.localidad.val(),
                                        numDias: 4
                                };

                                ajaxInProgress = true;
                                this.indicadorAjaxEnCurso.show();

                                //Se quiere utilizar 'this' dentro de una función [complete] de un objeto, pero la función tendrá como 'this' el objeto en el que fué creada
                                //por lo que guardo el 'this' actual en una variable alcanzable desde dentro de la función llamada 'that'
                                var that = this;

                                //Configuración y llamada al servicio RESTful vía Ajax
                                $.ajax({
                                        url: targetUrl,
                                        data: datos,
                                        type: "GET",
                                        dataType: "json",
                                        cache: false,
                                        contentType: "application/x-www-form-urlencoded; charset=UTF-8", //por defecto
                                        //En el contexto de una invocación Ajax, 'this' no se refiere al objeto contenedor sino a la propia llamada. Por eso 'bind(this)'
                                        success: this.printWeather.bind(this),
                                        error: this.errorHandle.bind(this),
                                        //Función que se ejecuta sin importar el resultado de la petición Ajax
                                        //TODO He comprobado que si se produce una excepción en la función 'success' la función 'complete' no se ejecuta. Investigar.
                                        complete: function () {
                                                ajaxInProgress = false;
                                                that.indicadorAjaxEnCurso.hide();
                                        }
                                });
                        }// End if
                },
                //Función que ejecuta en caso de que la petición Ajax 'getWeatherInfo' haya sido exitosa
                //Muestra en pantalla la información meteorológica
                printWeather: function (json) {
                        //Si no se ha producido ningún error al tratar el objeto JSON en el Backend
                        if (json.ok) {
                                //Si la respuesta no contiene errores
                                if (json.info.data.error === undefined) {
                                        //Carga del tiempo actual
                                        var temperatura = this.temperatura.text(json.info.data.current_condition[0].temp_C + "Cº");
                                        this.estado.text(json.info.data.current_condition[0].weatherDesc[0].value);
                                        $(temperatura[0]).closest("div").show();
                                        this.localidadTemperatura.text(json.info.data.request[0].query);

                                        //FUTURE utilizar los siguientes datos referentes al tiempo actual
                                        /*$("#cloud-cover").text(json.info.data.current_condition[0].cloudcover + "%");
                                        $("#precipitacion").text(json.info.data.current_condition[0].precipMM + "mm");
                                        $("#velocidad-viento").text(json.info.data.current_condition[0].windspeedKmph + "Km/h");*/

                                        //Carga de la imagen asociada al tiempo actual
                                        this.imagenActual.attr("src", json.info.data.current_condition[0].weatherIconUrl[0].value);



                                        //Presentación de la previsión meteorológica (diferentes de temperatura actual)
                                        var jsonForecast = json.info.data.weather;

                                        if (jsonForecast !== undefined) {
                                                //Se quiere utilizar 'this' dentro del bucle, pero los bucles crean sus propios 'this'
                                                //por lo que guardo el 'this' actual en una variable alcanzable desde dentro del bucle llamada 'that'
                                                var that = this;
                                                this.forecastContainer.empty();

                                                $.each(jsonForecast, function (key, value) {

                                                        //Mostrar fecha en formato Español/España
                                                        var date = new Date(value.date);
                                                        var day = date.getDate();
                                                        var month = date.getMonth() + 1;
                                                        var year = date.getFullYear();

                                                        var fechaFormateada = util.getDiaSemana(date.getDay()).complete + " " + day + "/" + month + "/" + year;
                                                        var hoy = new Date();

                                                        if ((hoy.getDate() === day) && (hoy.getMonth() + 1 === month) && (hoy.getFullYear() === year)) {
                                                                fechaFormateada = "Hoy";
                                                        }

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

                                        //Animación para la presentación del listado de datos y la imagen
                                        if (this.forecastContainer.is(":visible")) {
                                                this.forecastContainer.slideUp(200).delay(200).slideDown(1000);
                                                this.condicionesActuales.hide().slideDown("1000");
                                        } else {
                                                this.forecastContainer.slideDown(1000);
                                                this.condicionesActuales.hide().slideDown("1000");
                                        }
                                } else {
                                        //Se pasa el error a la función manejadora de errores
                                        this.errorHandle({statusText: json.info.data.error[0].msg, status: 200});
                                }
                        } else {
                                this.errorHandle({statusText: "Ha ocurrido un problema al recuperar la información.", status: 500});
                        }
                }
                //Busca las posibles localizaciones según el critério de búsqueda utilizado
               /* getLocalidades: function (localidad) {
                    //FUTURE Si con una consulta no ha encontrado nada no llamar de nuevo al servicio hasta que la consulta se modifique.
                    //Ej: 'casavo' no encuentra nada. 'casavoo' no buscarlo poque no va a encontrar nada tampoco.
                    //Actualización: Estudiar el comportamiento del servicio, porque creo que no funciona como describo arriba

                    if (!app.ajaxInProgress) {
                        var targetUrl = "/location";

                        //Objecto con los datos de entrada de la petición
                        var datos = {
                            formato: "json",
                            localidad: $(localidad).val()
                        };

                        app.ajaxInProgress = true;
                        $("#indicadorAjaxEnCurso").show();
                        setTimeout(1000);
                        //Configuración y llamada al servicio RESTful vía Ajax
                        $.ajax({
                            url: targetUrl,
                            data: datos,
                            type: "GET",
                            dataType: "json",
                            cache: false,
                            contentType: "application/x-www-form-urlencoded; charset=UTF-8", //por defecto
                            success: printLocationHelper,
                            error: errorHandle,
                            //Función que se ejecuta sin importar el resultado de la petición Ajax
                            //TODO He comprobado que si se produce una excepción en la función 'success' la función 'complete' no se ejecuta. Investigar.
                            complete: function () {
                                console.log("Petición Ajax realizada.");
                                this.ajaxInProgress = false;
                                $("#indicadorAjaxEnCurso").hide();
                            }
                        });
                    }
                },

                //Muestra las posibles localizaciones según el critério de búsqueda utilizado
                printLocationHelper: function(json) {
                    //Si no se ha producido ningún error al tratar el objeto JSON en el Backend
                    if (json.ok) {
                        //Si la respuesta no contiene errores
                        if (json.info.data == undefined) {
                            //FUTURE hacer algo con los resultados obtenidos de buscar localidades según se va escribiendo
                            //json.info.search_api.result[0].areaName[0].value);
                        } else {
                            //No se encuentran localidades con los datoa introducidos.
                            //Este error no se maneja (ni muestra)
                        }
                    } else {
                        //Ha habido algún problema en el servidor.
                        //Este error no se maneja (ni muestra)
                    }
                }*/
        };

        App.init();

});
