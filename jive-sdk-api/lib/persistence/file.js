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

var fs = require('fs');
var q = require('q');
var jive = require('../../api');

module.exports = function(serviceConfig) {

    jive.logger.warn("******************************");
    jive.logger.warn("File persistence is configured.");
    jive.logger.warn("Please note that this should");
    jive.logger.warn("not be used for production!");
    jive.logger.warn("******************************");

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Private

    var loading = {};
    var cache = {};
    var oldestCacheEntry = null;
    var newestCacheEntry = null;
    var cacheSize = 0;
    var dirtyCount = 0;
    var dirtyCollectionIDs = {};
    var intervalId;
    var path = serviceConfig && serviceConfig['dataDirPath'] ? serviceConfig['dataDirPath'] : "db";

    jive.logger.debug("File persistence dir at '" + path + "'");

    //todo: make the target directory configurable
    fs.stat(path, function(err, stat){
        if(err){
            fs.mkdir(path, function(err){
                if(err) throw err;
                intervalId = setInterval(flushDirty, 15000);
            });
        } else if(stat.isDirectory()){
            intervalId = setInterval(flushDirty, 15000);
        } else {
            throw "Persistence startup failed: " + path + " is not a directory!";
        }
    });
    // flush anything dirty to disk every 15 seconds

    function getFilename(collectionID) {
        return path + '/' + encodeURIComponent(collectionID) + '.json';
    }

    function writeToFS(entry, callback) {
        var json = JSON.stringify(entry.collection, null, 2);
        entry.setDirty(false);
        fs.writeFile(getFilename(entry.collectionID), json, 'UTF-8', callback);
    }

    function readFromFS(collectionID, callback) {
        fs.readFile(getFilename(collectionID), 'UTF-8', function(err, data) {
            var object;
            if (err) {
                object = {};
            }
            else {
                try {
                    object = JSON.parse(data);
                } catch (e) {
                    jive.logger.warn('Error reading collection "' + collectionID + '" from file system. Initializing to empty.');
                    object = {};
                }
            }
            callback(object);
        });
    }

    function flushDirty() {
        var deferreds = [];
        var dirty = Object.keys(dirtyCollectionIDs);
        for (var i = 0; i < dirty.length; i++) {
            var collectionID = dirty[i];
            var entry = cache[collectionID];
            var deferred = q.defer();
            deferreds.push(deferred.promise);
            writeToFS(entry, function() {
                deferred.resolve();
            });
            delete dirtyCollectionIDs[collectionID];
        }
        var shrink = [];
        while (cacheSize > 50) {
            if (cacheSize > 50) {
                shrink.push(oldestCacheEntry.collectionID);
                oldestCacheEntry.discard();
            }
        }
        if (dirty.length) {
            jive.logger.info('Updated ' + dirty.length + ' data file(s): [' + (dirty.join(', ')) + ']' )
        }
        if (shrink.length) {
            jive.logger.info('Discarded ' + shrink.length + ' data file(s): [' + (shrink.join(', ')) + ']' )
        }
        return q.allResolved(deferreds);
    }

    function getCacheEntry(collectionID, callback) {
        var entry = cache[collectionID];
        if (entry) {
            callback(entry.collection, entry);
        } else if (loading[collectionID]) {
            loading[collectionID].push(callback);
        } else {
            var queue = [ callback ];
            loading[collectionID] = queue;
            readFromFS(collectionID, function(data) {
                delete loading[collectionID];
                var entry = new CacheEntry(collectionID, data);
                entry.add();
                for (var i = 0; i < queue.length; i++) {
                    queue[i](entry.collection, entry);
                }
            });
        }
    }

    function CacheEntry(collectionID, collection) {
        this.collectionID = collectionID;
        this.collection = collection;
        this.when = null; // set only when it is in the linked list
        this.prev = null;
        this.next = null;
        this.dirty = false;
        return this;
    }

    CacheEntry.prototype.setDirty = function(d) {
        if (d) {
            dirtyCollectionIDs[this.collectionID] = true;
        } else {
            delete dirtyCollectionIDs[this.collectionID];
        }
        if (this.dirty != d) {
            dirtyCount += d ? 1 : -1;
        }
        this.dirty = !!d;
    };

    CacheEntry.prototype.add = function() {
        if (this.when) {
            if (newestCacheEntry == this) {
                // already the newest, just bump the date
                this.when = new Date();
                return;
            } else {
                this.discard();
            }
        }
        if (newestCacheEntry) {
            newestCacheEntry.prev = this;
            this.next = newestCacheEntry;
            newestCacheEntry = this;
        } else {
            newestCacheEntry = this;
            oldestCacheEntry = this;
        }
        this.when = new Date();
        cache[this.collectionID] = this;
        cacheSize++;
    };

    CacheEntry.prototype.discard = function() {
        if (this.when) {
            if (oldestCacheEntry == this) {
                oldestCacheEntry = this.prev;
            }
            if (newestCacheEntry == this) {
                newestCacheEntry = this.next;
            }
            if (this.prev) {
                this.prev.next = this.next;
            }
            if (this.next) {
                this.next.prev = this.prev;
            }
            this.prev = null;
            this.next = null;
            this.when = null;
            delete cache[this.collectionID];
            cacheSize--;
        }
    };

    return {
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // Public

        save : function( collectionID, key, data) {
            var deferred = q.defer();

            getCacheEntry(collectionID, function(collection, entry) {
                collection[key] = data;
                entry.setDirty(true);
                entry.add(); // set as most recently used
                deferred.resolve( data );
            });

            return deferred.promise;
        },

        remove : function( collectionID, key ) {
            var deferred = q.defer();

            getCacheEntry(collectionID, function(collection, entry) {
                var removed = collection[key];
                delete collection[key];
                entry.setDirty(true);
                entry.add(); // set as most recently used
                deferred.resolve(removed);
            });

            return deferred.promise;
        },

        findByID: function( collectionID, key ) {
            var deferred = q.defer();

            getCacheEntry(collectionID, function(collection) {
                var data = collection[key];
                deferred.resolve( data );
            });

            return deferred.promise;
        },

        find : function( collectionID, keyValues ) {

            var deferred = q.defer();

            getCacheEntry(collectionID, function(collection) {
                var collectionItems = [];
                var findKeys = keyValues ? Object.keys( keyValues ) : undefined;

                for (var colKey in collection) {
                    if (collection.hasOwnProperty(colKey)) {

                        var entryToInspect = collection[colKey];
                        var match = true;
                        if ( findKeys ) {
                            for ( var i in findKeys ) {
                                var findKey = findKeys[i];
                                var keyParts = findKey.split('.');
                                var entryObj = entryToInspect;
                                for ( var k = 0; k < keyParts.length; k++ ) {
                                    var keyPart = keyParts[k];
                                    entryObj = entryObj[keyPart];
                                }

                                if ( entryObj !== keyValues[ findKey ] ) {
                                    match = false;
                                    break;
                                }
                            }
                        }

                        if ( match ) {
                            collectionItems.push( collection[colKey] );
                        }
                    }
                }

                deferred.resolve( collectionItems );
            });

            return deferred.promise;
        },

        close : function() {
            if(intervalId) {
                clearInterval(intervalId);
            }
            return flushDirty();
        }

    };
};

