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

var fs = require('fs-extra');
var q = require('q');
var path = require('path');
var jive = require('../api');
var _ = require("underscore");

/**
 * jive-sdk create -type
 */

var argv = require('optimist').argv;

var validCommands = ['create','help','list', 'createExtension'];
var groups = ['tiles', "apps", 'services', 'storages', 'cartridges'];

var styles = [];
var examples = [];
var groupedExamples = {};
_.each(groups, function(group) { groupedExamples[group] = [] });


function validate(options) {
    var err = [];

    if ( validCommands.indexOf(options['cmd']) < 0 ) {
        err.push('Invalid comamnd ' + options['cmd'] + ', must be one of ' + validCommands );
    }

    if ( options['cmd'] === 'create' ) {
        if ( styles.concat(examples).indexOf(options['subject']) < 0 &&  options['subject']  != 'all' ) {
            if ( options['subject'] ) {
                err.push('Invalid item ' + options['subject'] + ', must be one of ' + styles.concat(examples) + ", or 'all'.");
            } else {
                err.push('You must create one of ' + styles.concat(examples) + ", or 'all'.");
            }
        }
    }

    if ( options.cmd === 'list' ) {
        if( options.subject ) {
            if(groups.indexOf( options.subject ) == -1) {
                err.push('Invalid list type ' + options.subject + ', must be one of ' + groups + ", empty, or 'all'");
            }
        }
    }

    return err;
}

var conditionalMkdir = function(target, force) {
    return jive.util.fsexists(target).then( function(exists) {
        if ( !exists || force ) {
            return jive.util.fsmkdir(target);
        } else {
            console.log(target,'already exists, skipping');
            return q.fcall(function(){});
        }
    });
};

function mergeRecursive(original, newcommer) {

    for (var p in newcommer) {
        try {
            if ( newcommer[p].constructor==Object ) {
                original[p] = mergeRecursive(original[p], newcommer[p]);

            } else {
                if ( !original[p] )
                    original[p] = newcommer[p];
            }

        } catch(e) {
            original[p] = newcommer[p];

        }
    }
    return original;
}

function processExample(target, example, name, force) {
    console.log('Preparing example ', name, target );

    var customName = name !== example;
    var tilePrefix = customName ? name  + '_' : '';

    var root = __dirname;
    var uniqueUUID = jive.util.guid();

    var processSubRootFolder = function( sourceSubRoot, targetSubRoot, doSubstitutions ){
        return jive.util.fsexists(targetSubRoot).then( function(exists) {
            return !exists ? jive.util.fsmkdir(targetSubRoot) : q.resolve();
        }).then( function() {
            if ( sourceSubRoot.indexOf("public") > -1 ) {
                return jive.util.recursiveCopy(sourceSubRoot, targetSubRoot, force, !doSubstitutions ? undefined : {
                    'TILE_PREFIX': tilePrefix,
                    'TILE_NAME_BASE' : name,
                    'TILE_NAME': name,
                    'GENERATED_UUID' : uniqueUUID,
                    'host': '{{{host}}}'
                } );
            } else {
                return jive.util.fsreaddir(sourceSubRoot).then( function(subDirs) {
                    var promises = [];
                    if ( subDirs && subDirs['forEach'] ) {
                        subDirs.forEach(function(subDir) {
                            var sourceSubRootEntry = sourceSubRoot + '/' + subDir;
                            var tileName;
                            if ( customName ) {
                                tileName = subDirs.length > 1 ? name + '_' + subDir : name;
                            } else {
                                tileName = subDir;
                            }

                            var targetSubRootEntry =
                                targetSubRoot + '/' + tileName;

                            var substitutions = !doSubstitutions ? undefined : {
                                'TILE_PREFIX': tilePrefix,
                                'TILE_NAME_BASE' : name,
                                'TILE_NAME': tileName,
                                'GENERATED_UUID' : uniqueUUID,
                                'host': '{{{host}}}'
                            };
                            promises.push(
                               jive.util.recursiveCopy(sourceSubRootEntry, targetSubRootEntry, force, substitutions )
                            );
                        });
                    }
                    return q.all(promises);
                });
            }
        });
    };

    var processSubRootFile = function(sourceSubRoot, targetSubRoot, baseSubstitutions, force) {
        return jive.util.fsexists(targetSubRoot).then(function (exists) {
            if (!exists || force === 'true') {
                return jive.util.fsTemplateCopy(sourceSubRoot, targetSubRoot, baseSubstitutions);
            } else {
                if (!force) {
                    // it exists, but force is not specified; try to merge if .json object
                    var extension = path.extname(sourceSubRoot);
                    if (extension && extension.toLowerCase() === '.json') {
                        return jive.util.fsreadJson(targetSubRoot).then(function (originJson) {
                            return jive.util.fsreadJson(sourceSubRoot).then(function (incomingJson) {
                                var mergedTxt = JSON.stringify(mergeRecursive(originJson, incomingJson), null, 4);
                                return jive.util.fsTemplateWrite(mergedTxt, targetSubRoot, baseSubstitutions);
                            });
                        });
                    }
                }

                return q.resolve();
            }
        });
    };

    var baseSubstitutions = {
        'TILE_PREFIX': tilePrefix,
        'TILE_NAME_BASE': name,
        'host': '{{{host}}}'
    };

    return jive.util.recursiveCopy(root + '/base', target, force, baseSubstitutions).then( function() {
        var promises = [];
        var sourceRootDir = root + '/examples/' + example;
            return jive.util.fsreaddir(sourceRootDir).then( function(subDirs) {
            subDirs.forEach(function(subDir) {
                var sourceSubRoot = sourceRootDir + '/' + subDir;
                var targetSubRoot = target + '/' + subDir;
                promises.push( jive.util.fsisdir(sourceSubRoot).then( function(isDir) {
                    if ( isDir ) {
                        var doSubstitutions = subDir != 'cartridges';   // don't do substitutions on cartridges
                        return processSubRootFolder( sourceSubRoot, targetSubRoot, doSubstitutions );
                    } else {
                        return processSubRootFile( sourceSubRoot, targetSubRoot, baseSubstitutions, force );
                    }
                }) );
            });
            return q.all(promises);
        });
    })
}

function processDefinition(target, type, name, style, force) {

    console.log('Preparing', type == 'all' ? '' : type,
        '"' + name + '"',
        (type !== 'activity' ? 'of style ' + style : ''));

    var root = __dirname;

    var substitutions = {
        'TILE_NAME': name,
        'TILE_STYLE': style,
        'host': '{{{host}}}'
    };

    var promises = [];

    // copy base
    promises.push(
        jive.util.recursiveCopy(root + '/base', target, force, substitutions )
    );

    promises.push(
        conditionalMkdir(target + '/tiles/' + name, force)
    );

    // copy definition
    promises.push(
        jive.util.recursiveCopy(root + '/definition', target + '/tiles/' + name,    force )
    );

    // copy style
    promises.push(
        jive.util.recursiveCopy(
            root + '/styles' + '/' + style,
            target + '/tiles/' + name,
            force, substitutions )
    );

    return q.all(promises);
}

function listDirectory(dirName, dirPath, excludes) {
    console.log('\nContents of ' + dirName + ' directory (', dirPath, '):\n' );

    return q.nfcall(fs.readdir, dirPath ).then(function(dirContents){
        dirContents.forEach(function(item) {
            if ( !excludes || excludes.indexOf(item) < 0 ) {
                console.log(item);
            }
        });
    })
}

function finish(target) {
    var definitionsDir = target + '/tiles';
    var appsDir = target + '/apps';
    var servicesDir = target + '/services';
    var storagesDir = target + '/storages';
    var cartridgesDir = target + '/cartridges';

    var configurationFile =  target + '/jiveclientconfiguration.json';

    console.log('\n... Done!\n');

    // tiles
    jive.util.fsexists(definitionsDir).then( function(exists) {
        if ( exists ) {
            return listDirectory('tiles', definitionsDir, ['templates.json', 'package.json'] );
        } else {
            return q.resolve(true);
        }
    }).then( function() {
        return jive.util.fsexists( appsDir ).then( function(exists) {
            if ( exists ) {
                return listDirectory('apps', appsDir);

            } else {
                return q.resolve();
            }
        });
    }).then( function() {
        return jive.util.fsexists( cartridgesDir ).then( function(exists) {
            if ( exists ) {
                return listDirectory('cartridges', cartridgesDir);

            } else {
                return q.resolve();
            }
        });
    }).then( function() {
        return jive.util.fsexists( servicesDir ).then( function(exists) {
            if ( exists ) {
                return listDirectory('services', servicesDir);

            } else {
                return q.resolve();
            }
        });
    }).then( function() {
        return jive.util.fsexists( storagesDir ).then( function(exists) {
            if ( exists ) {
                return listDirectory('storages', storagesDir);

            } else {
                return q.resolve();
            }
        });
    }).then( function() {
        console.log("\nThings you should do now, if you haven't done them already.");
        console.log();
        console.log('(1) Install dependent modules:');
        console.log('   npm update ');
        console.log('(2) Don\'t forget to edit', configurationFile, 'to specify your clientID, ' +
            'clientSecret, clientUrl, and other important setup options!');
        console.log();
        console.log('When done, run your service:');
        console.log();
        console.log('   node app.js');
        console.log();
    });
}

function doStyle( options ) {
    var force = options['force'];
    var target = options['target'] || process.cwd();

    var style =  options['subject'];
    var name = options['name'] || 'sample' + style;
    var type = style == 'activity' ? 'activity' : style;
    processDefinition(target, type, name, style, force).then( function() {
        finish(target);
    });
}

function doExample( options ) {
    var force = options['force'];
    var target = options['target'] || process.cwd();

    var example =  options['subject'];
    var name = options['name'] ? options['name'] : example;
    processExample(target, example, name, force).then( function() {
        finish(target);
    });
}

function doAll( options ) {
    var force = options['force'];
    var target = options['target'] || process.cwd();

    var promises = [];
    styles.forEach( function(style) {
        var name = 'sample' + style + (options['name'] ? '-' + options['name'] : '' );
        var type = style == 'activity' ? 'activity' : style;
        promises.push( processDefinition(target, type, name, style, force));
    });

    examples.forEach( function( example ) {
        var name = example + ( options['name'] ? ('-' + options['name'] ) : '');
        promises.push(processExample(target, example, name, force));
    });

    q.all(promises).then( function() {
        var root = __dirname;
        return jive.util.fsTemplateCopy( root + '/base/package.json', target + '/package.json', { 'TILE_NAME': 'jive-examples-all' } )
            .then( function() { return finish(target); });
    });
}

function doHelp() {
    console.log('Usage: jive-sdk [cmd] [item] [--options ...]\n');
    console.log('where cmd include:');
    console.log('   help');
    console.log('   create');
    console.log('   list\n');

    console.log('where item for create include:');
    examples.concat(styles).forEach( function(item) {
        console.log('   ' + item );
    });

    console.log('');
    console.log('where item for list include:');
    _.each(groups, function(group) {
        console.log('   ' + group);
    });


    console.log();
    console.log('where options include:');
    console.log('   --force=<one of [true,false]>           Defaults to false, overrwrites existing if true');
    console.log('   --name=<string>                         Defaults to [item]');
}

function execute(options) {
    var cmd = options['cmd'];
    options.target = options.target || process.cwd();

    if ( cmd === 'help' ) {
        doHelp();
    }

    if ( cmd == 'create') {
        var subject = options['subject'];

        if ( subject == 'all' ) {
            doAll( options );
            return;
        }

        if ( styles.indexOf( subject ) > -1 ) {
            doStyle( options );
            return;
        }

        if ( examples.indexOf( subject ) > -1 ) {
            doExample( options );
            return;
        }
    }

    if ( cmd === 'list' ) {
        if( !options.subject ) {
            options.subject = 'all';
        }
        var printGroup = function( group ) {
            console.log(group + ":");
            _.each(groupedExamples[group], function( example ) {
                console.log("    " + example);
            });
        };

        if( options.subject === 'all' ) {
            _.each(groupedExamples, function( exampleArray, group ) {
                printGroup(group);
                console.log("");
            });

        } else {
            printGroup(options.subject);
        }
    }

    if ( cmd === 'createExtension' ) {
        doCreateExtension( options );
    }
}

function doCreateExtension( options ) {
    jive.service.init({use: function() {}})
        .then(function() {
            return jive.service.autowire();
        } )
        .then(function() {
            var extension = require("../lib/extension/extension.js");

            extension.prepare(options.target + "/tiles", options.target + "/apps", options.target + "/cartridges", options.target + "/storages").then(function(){
                var persistence = jive.service.persistence();

                persistence.close().then(function() {
                    process.nextTick(function() {
                        process.exit(0);
                    });
                })
            });
        });
}

function prepare() {
    var root = __dirname;

    return jive.util.fsreaddir( root + '/styles').then(function(items) {
        styles = styles.concat( items );
        _.each(styles, function( item ) {
            groupedExamples['tiles'].push(item);
        });
    }).then( function() {
            return jive.util.fsreaddir( root + '/examples').then(function(items) {
                var deferreds = [];
                examples = examples.concat( items );
                _.each(examples, function( item ) {
                    _.each(groups, function( group ) {
                        var deferred = q.defer();
                        deferreds.push(deferred);
                        jive.util.fsexists( root + '/examples/' + item + "/" + group).then(function(exists) {
                            if(exists) {
                                groupedExamples[group].push(item);
                            }
                            deferred.resolve();
                        });
                    });
                });
                return q.allResolved(deferreds);
            } );
        });
}

exports.init = function(target) {
    // init lists
    prepare().then( function() {

        // default command to help
        var cmd = argv._.length > 0 ? argv._[0] : 'help';
        var subject = argv._[1];

        var name = argv['name'];
        var force = argv['force'] || false;

        if (name) {
            name = name.replace(/[^\S]+/, '');
            name = name.replace(/[^a-zA-Z0-9]/, '-');
        }

        var options = {
            'name'      : name,
            'cmd'       : cmd,
            'subject'   : subject,
            'force'     : force,
            'target'    : target
        };

        var err = validate(options);
        if ( err.length > 0 ) {
            console.log('Could not execute command, errors were found:');
            err.forEach( function(err) {
                console.log('   ', err);
            });

            console.log();

            doHelp();

            process.exit(-1);
        }

        execute(options);
    });
};
