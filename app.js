/*jslint indent:8, devel:true, node:true, vars: true*/
/*global console*/

/**
 * Module dependencies.
 */

"use strict";

/**
 * Module dependencies.
 */

var express = require('express');
//var routes = require('./routes');
var http = require('http');
var path = require('path');

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
        app.use(express.errorHandler());
}


// Métodos y objetos de uso común


//Función que serializa los atributos de 'this' en formato 'queryString' ( &nomAttr=valor&... ).
//Uso:  -Ejecutar la función 'app.stringify'haciendo 'apply' y pasándole el "this" sobre el que actuar (un objeto con datos): app.stringify.apply(data)
//      -También se puede asociar la función 'stringify' de 'app' al objeto que necesite hacer uso de ella: data.stringify = app.stringify -> data.stringify()
app.stringify = function () {
        var name, result = "";
        //La función acepta 'this' con funciones, pero no las tiene en cuenta
        for (name in this) {
                if (typeof this[name] !== "function" && this.hasOwnProperty(name)) {
                        result += "&" + name + "=" + this[name];
                }
        }
        return result;
};


// Routes


app.get('/', function (req, res) {
        console.log("Aplicación iniciada correctamente.");

        //Para usar HTML estandar en vez de JADE
        res.sendfile('views/index.html', {root: __dirname});
});

app.get('/forecast.:formato?', function (req, res) {
        console.log("Petición /forecast con parámetro localidad=" + req.param("localidad"));

        //Llamada al servicio Web 'local weather' de 'World Weather Online' (RESTFUL)
        var url = "http://api.worldweatheronline.com/free/v1/weather.ashx";
        var key = "4g6yp8teksrqzy6rfykh6c24";

        //Datos de entrada de la petición agrupados en un objeto
        var data = {
                format: req.param("formato"),
                q: encodeURIComponent(req.param("localidad")), //Codificación de los espcios: %20. Ej: San%20Fernando%20de%20henares
                num_of_days: req.param("numDias")
        };
        //Añadimos al objeto 'data' la función 'app.stringify' que trabaja sobre 'this'
        data.stringify = app.stringify;

        //Configurando el enPoint
        var endPoint = url + "?key=" + key;
        endPoint += data.stringify();

        console.log("Final EndPoint: " + endPoint);

        //Conexión al Servicio Web externo vía proxy
        var username = 'essamu';
        var password = '00==AAaa00==AAaa';
        var host = "10.43.21.27";
        var auth = 'Basic ' + new Buffer(username + ':' + password).toString('base64');

        var options = {
                host: host,
                port: 8080,
                path: endPoint,
                authorization: auth,
                headers: {
                        Host: 'api.worldweatheronline.com'
                }
        };

        //TODO Cachear respuesta (la información del servicio se actualiza cada 3,4 horas)
        //Realiza conexión con el servicio Web
        http.get(options, function (response) {
                var ok = true;
                response.setEncoding('utf-8');
                var statusCode = response.statusCode;

                var output = "";
                console.log("Got response status code: " + response.statusCode);

                if (statusCode !== 200) {
                        //TODO Aunque se retorna al llamante este objeto también salta el evento on("data"), aunque no llega a enviar su objeto. Investigar.
                        console.log("Error en la llamada al servicio. No se ha devuelto código 200.");
                        ok = false;
                        res.json({ok: ok, cod: statusCode});
                }

                //Escuchador del evento 'data' de la respuesta
                response.on("data", function (chunk) {
                        //Se añade al objeto a devolver los datos que va devolviendo el servicio
                        output += chunk.toString();
                });

                response.on('end', function () {
                        //Cuando la conexión ha terminado (el servicio ha enviado todos los datos), se convierte la respuesta a JSON
                        //Si 'output' no es un JSON correcto la función 'parse' fallará (try catch)
                        var json = "";
                        try {
                                json = JSON.parse(output);
                        } catch (e) {
                                ok = false;
                                console.log("Se ha producido un error: " + e.message);
                                json = {ok: ok, cod: 500};
                        }

                        res.json({ok: ok, info: json});
                        //onResult(res.statusCode, obj);
                });
        //Escuchador del evento 'error' de la request
        }).on('error', function (e) {
                console.log("Got error: " + e.message);
                var ok = false;
                res.json({ok: ok, cod: 500});
        });

});

//FUTURE: Consulta las localidades que corresponden a una cadena dada
/*app.get('/location', function (req, res) {
    console.log("Petición /localizacion.");

    //Llamada al servicio Web 'location search' de 'World Weather Online' (RESTFUL)
    var url = "http://api.worldweatheronline.com/free/v1/search.ashx";
    var key = "4g6yp8teksrqzy6rfykh6c24";
    
    //Objeto donde centralizar todos los datos de entrada de la petición
    var frontRequestData = {
        format: req.param("formato"),
        query: req.param("localidad"), //location
        popular: "no", //Si solo busca en localizaciones populares, como ciudades grandes
        //Función que serializa en formato QueryString los atributos del objeto
        stringify: function () {
            var name, result = "";
            for (name in this) {
                if (typeof this[name] !== "function" && this.hasOwnProperty(name)) {
                    result += "&" + name + "=" + this[name];
                }
            }
            return result;
        }
    };

    //Configurando el enPoint
    var endPoint = url + "?key=" + key;
    endPoint += frontRequestData.stringify();

    console.log("Final EndPoint: " + endPoint);

    //T O D O  Cachear respuesta (la información del servicio se actualiza cada 3,4 horas)
    //Realiza conexión con el servicio Web
    http.get(endPoint, function (response) {
        var ok = true;
        response.setEncoding('utf-8');
        var statusCode = response.statusCode;
        console.log("Got response status code: " + response.statusCode);
        
        if (statusCode !== 200) {
            //T O D O Aunque se retorna al llamante este objeto también salta el evento on("data"), aunque no llega a enviar su objeto. Investigar.
            console.log("Error en la llamada al servicio. No se ha devuelto código 200.");
            ok = false;
            res.json(ok, {error: "Se ha producido un error."});             
        }
        
        //Escuchador del evento 'data' de la respuesta
        response.on("data", function(chunk) {
            //Si el objeto 'chunk' no es un JSON correcto la función 'parse' fallará (try catch)
            var jsonString = chunk.toString();
            var json = jsonString;//"";
            try {
                json = JSON.parse(jsonString);
            }
            catch(e) {
                ok = false;
                console.log("Se ha producido un error: " + e.message);
                json = {error: "Se ha producido un error."};   
            }
            
            res.json({ok: ok, info: json}); 
        });        
    //Escuchador del evento 'error' de la request
    }).on('error', function (e) {
        console.log("Got error: " + e.message);
        ok = false;
        res.json(ok, {error: "Se ha producido un error."}); 
    });
    
});*/

app.listen(3000, function () {
        //TODO conseguir extrar el puerto de 'app'. get("port") no funciona...
        console.log("Express server listening on port %s in %s mode", app.get("port"),  app.settings.env);
});
