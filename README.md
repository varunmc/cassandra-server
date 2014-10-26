# Cassandra-Server #
_A thin Javascript wrapper around [Apache Cassandra][apache-cassandra] to provide out of the box server support_

* [Introduction](#introduction)
* [Requirements](#requirements)
* [Installation](#installation)
* [Usage](#usage)
  * [Starting the server](#starting-the-server)
  * [Stopping the server](#stopping-the-server)
  * [Other functions](#other-functions)
* [Logging](#logging)
* [Changelog](#changelog)

## Introduction ##
Control a local Cassandra server with Javascript. Typical server lifecycle methods are included (start, stop, restart) along with other convenience methods.

This module comes bundled with Cassandra v2.1.0 which works with Cassandra Query Language v3.1 ([CQL3][cql3]) and Cassandra's native protocol.

## Requirements ##
Cassandra v2.x requires that [Java7][java7] or higher be installed and available on the PATH.

## Installation ##
```sh
$ npm install cassandra-server
```
[![NPM version][npm-image]][npm-url]

## Usage ##
The Cassandra server uses [Q][q] promises to defer execution and communicate it's status to the client.

### Starting the server ###
Simply do the following to start a new Cassandra server with default options. This will create a new cluster called "Test Cluster" listening on the loopback:

```javascript
var cassandra = require('cassandra-server');
cassandra.start()
    .then(function(client) {
        // do something with the client
    })
    .catch(function(err) {
        console.error(err);
    });
```

The ```client``` returned is a _promisified_ instance of the [Datastax Cassandra driver][datastax-cassandra-driver] connected to the running server. It is also available at ```cassandra.client``` after successful startup which is otherwise **undefined**.

The start function optionally accepts an ```options``` object that overrides the defaults. The following example starts a new cluster called "My Cluster" listening on w.x.y.z leaving the remaining defaults unchanged:

```javascript
cassandra.start({
        cluster_name: "My Cluster",
        listen_address: "w.x.y.z"
    });
```

[cassandra.json][cassandra-json] serves as the default configuration for any server. This file is simply a JSON port of the standard YAML configuration that comes bundled with a typical installation.

### Stopping the server ###
Stopping the server is just as easy:

```javascript
cassandra.stop()
    .then(function() {
        // continue
    });
```

### Other functions ##

#### Nuke ####
Destroys all data in the database. This action is non-recoverable.

```javascript
cassandra.nuke()
    .then(function() {
        // continue
    });
```

#### Restart ####
Stops the server, waits three seconds and then starts it again.

```javascript
cassandra.restart()
    .then(function(client) {
        // do something with the client
    });
```

# Logging #


# Changelog #
Visit the [Releases][releases] page for more details.

* 1.1.1 - Bug fixes and updated documentation
* 1.1.0 - More functions, logging and documentation
* 1.0.2 - Improved logging through winston
* 1.0.1 - Bug fixes
* 1.0.0 - Initial release

[apache-cassandra]: http://cassandra.apache.org
[cql3]: http://www.datastax.com/documentation/cql/3.1/cql/cql_intro_c.html
[java7]: http://www.oracle.com/technetwork/java/javase/downloads/jdk7-downloads-1880260.html
[npm-image]: http://img.shields.io/npm/v/cassandra-server.svg?style=flat
[npm-url]: https://npmjs.org/package/cassandra-server
[q]: https://github.com/kriskowal/q
[datastax-cassandra-driver]: https://github.com/datastax/nodejs-driver
[cassandra-json]: https://cdn.rawgit.com/varunmc/cassandra-server/master/cassandra.json
[releases]: https://github.com/varunmc/cassandra-server/releases
