/**
 * Module dependencies.
 */

var express = require('express'),
    //routes = require('./routes'),
    Document,
    http = require("http");

var app = express();

// Configuration

app.configure(function () {
    app.set('views', __dirname + '/views');
    app.set('view engine', 'jade');
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(app.router);
    app.use(express.static(__dirname + '/public'));
});

app.configure('development', function () {
    app.use(express.logger());
    app.use(express.errorHandler({
        dumpExceptions: true,
        showStack: true
    }));
});

app.configure('production', function () {
    app.use(express.logger());
    app.use(express.errorHandler());
});

// Routes

app.get('/', function (req, res) {
    console.log("Aplicación iniciada correctamente.");

    //Para usar HTML estandar en vez de JADE
    res.sendfile ('views/index.html', {root:__dirname});
});



app.get('/forecast.:formato?', function (req, res) {
    console.log("Petición /forecast con parámetro localidad=" + req.param("localidad"));

    //Llamada al servicio Web 'local weather' de 'World Weather Online' (RESTFUL)
    var url = "http://api.worldweatheronline.com/free/v1/weather.ashx";
    var key = "4g6yp8teksrqzy6rfykh6c24";
    
    //Objeto donde centralizar todos los datos de entrada de la petición
    var frontRequestData = {
        format: req.param("formato"),
        q: req.param("localidad"), //localidad
        num_of_days: req.param("numDias"),
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
    http.get(endPoint , function (response) {
        var ok = true;
        response.setEncoding('utf-8');
        var statusCode = response.statusCode;
        console.log("Got response status code: " + response.statusCode);
        
        if (statusCode !== 200) {
            //TODO Aunque se retorna al llamante este objeto también salta el evento on("data"), aunque no llega a enviar su objeto. Investigar.
            console.log("Error en la llamada al servicio. No se ha devuelto código 200.");
            ok = false;
            res.json({ok: ok, cod: statusCode});             
        }
        
        //Escuchador del evento 'data' de la respuesta
        response.on("data", function(chunk) {
            //Si el objeto 'chunk' no es un JSON correcto la función 'parse' fallará (try catch)
            var jsonString = chunk.toString();
            var json = jsonString;
            try {
                json = JSON.parse(jsonString);
            }
            catch(e) {
                ok = false;
                console.log("Se ha producido un error: " + e.message);
                json = {ok: ok, cod: 500};   
            }
            
            res.json({ok: ok, info: json}); 
        });        
    //Escuchador del evento 'error' de la request
    }).on('error', function (e) {
        console.log("Got error: " + e.message);
        ok = false;
        res.json({ok: ok, cod: 500}); 
    });

});


app.get('/location', function (req, res) {
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

    //TODO Cachear respuesta (la información del servicio se actualiza cada 3,4 horas)
    //Realiza conexión con el servicio Web
    http.get(endPoint, function (response) {
        var ok = true;
        response.setEncoding('utf-8');
        var statusCode = response.statusCode;
        console.log("Got response status code: " + response.statusCode);
        
        if (statusCode !== 200) {
            //TODO Aunque se retorna al llamante este objeto también salta el evento on("data"), aunque no llega a enviar su objeto. Investigar.
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
    
});

app.listen(3000, function () {
    //TODO conseguir extrar el puerto de 'app'. get("port") no funciona...
    console.log("Express server listening on port %s in %s mode", app.get("port"),  app.settings.env);
});
