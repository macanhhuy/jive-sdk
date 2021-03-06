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

var jive = require('../../api');

var task = function( _runnable, _interval ) {
    if ( !_runnable ) {
        throw 'A runnable function is required!';
    }

    return {
        'handler' : _runnable,
        'interval' : _interval
    };
};

exports.build = function(handler, interval) {
    return new task( handler, interval );
};

exports.schedule = function( task, scheduler ) {
    var eventID = jive.util.guid();
    var context = { 'eventListener' : '__jive_system_tasks' };
    var interval = task['interval'];
    jive.events.addDefinitionEventListener( eventID, '__jive_system_tasks', task['handler']);
    scheduler.schedule(eventID, context, interval);
};
