/*
 * Copyright 2013 Jive Software
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

var jive = require('jive-sdk');
var util = require('util');

exports.route = function(req, res) {
    var conf = jive.service.options;
    res.render('action.html', { host: conf.clientUrl + ':' + conf.port });
};

exports.jenkinsProxy = {
    'verb' : 'get',
    'path' : '/proxy',
    'route': function(req,res) {

        var urlParts = require('url').parse(req.url, true).query;
        var urlToProxy = urlParts['proxiedUrl'];

        var options = {
            rejectUnauthorized: false
        };

        jive.util.buildRequest( urlToProxy + 'api/json', 'GET', null, null, options).then( function(response) {
            res.writeHead(200);
            res.end( JSON.stringify(response.entity, null, 4));
        });

    }
};