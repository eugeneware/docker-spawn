# docker-spawn

Makes spawning docker servers as easy as `require()` in node.js.

This uses the docker REST API to spawn docker server images, to make servers
easily available for node.js.

This removes the need to have a complex server installed, and you need only
have a docker server, and then any server can be installed and quickly spawned
using this module.

Typical use cases include repeatable unit testing with database servers, or
removing the need to have a server (eg. mysql) installed in your development
environment.

## Example Usage

### Spawn a mysql server

``` js
var spawn = require('docker-spawn');

// default boot2docker IP
var dockerhost = '172.18.42.1'
var dockerport = 4243;

// spawn a mysql server, and remove it when done
spawn(dockerhost, dockerport, {
   image: 'orchardup/mysql',
   ports: [3306],
  remove: true
}, work);

// now have an active mysql server, listening on exposed[0]
// the stop function is called to stop and remove the container image
function work(err, exposed, stop) {
  if (err) throw err;
  sequelize = new Sequelize('mysql', 'root', '', {
    dialect: 'mysql',
      host: dockerhost,
      port: exposed[0],
      pool: {
        handleDisconnects: true
      },
      logging: false
  });
  sequelize
    .authenticate()
    .done(function(err) {
      if (err) {
        // shut down the server and remove it (because 'remove' was true)
        stop(function () {
          throw err;
        });
      } else {
        sequelize.query('select * from user').done(function (err, data) {
          if (err) throw err;
          expect(data.length).to.equal(8);

          // shut down the server and remove it (because 'remove' was true)
          stop();
        });
      }
    });
}
```

## API

### spawn(dockerhost, [dockerport,] options, cb)

Spawns (and pulls the image if it doesn't exist) a new docker image and
makes it available to node.

* `dockerhost` - the TCP hostname of your docker server. See the installation
  notes below about the easiest way to install a local docker server.
* `dockerport` - the TCP port of your docker server. If not provided, will
  assume port 4243.
* `options` - includes the following keys:
    * `image` - the name of a docker image (eg. `orchardup/mysql`) to run
    * `ports` - an Array of ports to expose. These will be mapped to dynamic
    ports like `49153` but returned to the node function through the
    `exposedPorts` argument in the callback.
    * `remove` - if set to `true`, then the server image will be removed when
    closed (Useful for temporary image creation - eg. unit tests, CI, etc)
* `cb(err, exposedPorts, stop)` - This callback get called after the spawn
  completes. The arguments are:
    * `err` - any error that was experienced.
    * `exposedPorts` - an array of the dynamically mapped ports. These are the
    actual ports that can be used to connect to the server. For example if
    the array `[3306]` was passed for a mysql server, then the `exposedPorts`
    array would contain something like `[49173]`, and the mysql server would
    be listening on this port. NB: The `spawn` function also polls these ports
    by trying to connect to them, so you get called back once the socket is
    listening. Depending on the server, this may be enough for you to use the
    ports, or you may need to wait some more (eg. a wordpress HTTP server
    where nginx is working, but the database server is not ready yet).
    * `stop` - this is a function, that when called will stop the underlying
    docker container. If `remove` was set in the `options` object, then the
    container will removed onces it is stopped.

NB: If the docker image specified in `options` is not present in the docker
server, then it will be pulled. This can take a long time based on the size
of the image, and the speed of your connection, and is also more susceptible
to failure (ie. is less deterministic). I recommend either doing a `spawn.pull`
(see below), or simply a `docker pull [image]` from the command line to make
sure the images are present before running `spawn` for the most reliable
experience.

### spawn.pull(dockerhost, [dockerport], image, cb)

Pulls a docker image.

This is a helper function to do the equivalent of `docker pull [image]`.

It is useful if you want to make sure that all your docker images are present
in your docker server before spawning them. For example, you might put this
in your `before()` function in your unit tests to make sure that all your
images are present before doing the unit tests.

Note, that pulling images can take a *long* time (minutes or more). So, tests
may timeout. You might want to add `this.timeout(0)` if you're using mocha
or the equivalent for your unit testing framework.

Pulling images is also more susceptible to failure, so you might just want to
do a `docker pull [image]` from the command line to make sure that youre images
are present for the most reliable and deterministic behaviour.

## Installation

This module is installed via npm:

``` bash
$ npm install docker-spawn
```

## Installation of a Docker Server

This module requires a docker server listening on TCP port.

### Recommended option: Use boot2docker

The easiest way to do this is to install
[boot2docker](https://github.com/steeve/boot2docker) which will install a
docker server in virtualbox on your local development machine.

boot2docker is a light-weight linux distribution optimized for fast startup,
minimal memory footprint, and perfect for local development, and is
officially endorsed by the docker team for local non-linux development.

For installation instructions, see the official page at:
[boot2docker](https://github.com/steeve/boot2docker)

### Official docker.io vagrant image

You can also use the official
[docker vagrant image](http://docs.docker.io/en/latest/installation/vagrant/).

But you'll need to configure the docker daemon to listen on port 4243, rather
than just the internal unix socket which is on by default.

To do this, you'll need to change `/etc/default/docker` to have the following
`DOCKER_OPTS` line:

``` bash
DOCKER_OPTS="-H unix:///var/run/docker.sock -H tcp://0.0.0.0:4243 -api-enable-cors"
```

Then restart docker with:

``` bash
$ sudo service docker restart
```

### Official coreos vagrant image

You can also use the
[coreos vagrant image](https://coreos.com/blog/coreos-vagrant-images/)
but you'll need to configure the docker daemon to listen on port 4243, rather
than just on the internal unix socket.

Because it uses [systemd](https://wiki.archlinux.org/index.php/systemd), this
requires a litle bit more work.

You'll need to create a new service file
called `/media/state/units/docker-local.service` with the following contents:

```
[Service]
Type=simple
ExecStartPre=/usr/bin/systemctl kill docker.service
ExecStartPre=/bin/mount --make-rprivate /
ExecStart=/usr/bin/docker -d -H tcp://0.0.0.0:4243 -api-enable-cors -r=false

KillSignal=SIGKILL

[Install]
WantedBy=local.target
```

This will kill the default service and launch a new one that listens on port
4243.

You'll then need to reboot your coreos server to get the new docker service
to run:

``` bash
$ sudo reboot
```
