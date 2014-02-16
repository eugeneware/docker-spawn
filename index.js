var Docker = require('dockerode'),
    through2 = require('through2'),
    JSONStream = require('JSONStream'),
    net = require('net');

module.exports = spawn;
function spawn(dockerhost, dockerport, opts, cb) {
  if (typeof cb === 'undefined') {
    opts = dockerport;
    cb = opts;
    dockerport = 4243;
  }

  var docker;

  pull(dockerhost, dockerport, opts.image, create);

  function create(err, _docker) {
    if (err) return cb(err);
    docker = _docker;
    docker.createContainer({Image: opts.image}, start);
  }

  function start(err, container) {
    if (err) return cb(err);;
    var ports = opts.ports.reduce(function (acc, port) {
      acc[port + '/tcp'] = [ { HostPort: '0' } ];
      return acc;
    }, {});;
    container.start({PortBindings: ports}, inspect.bind(null, container));
  }

  function inspect(container, err, data) {
    if (err) return cb(err);
    container.inspect(doWork.bind(null, container));
  }

  function doWork(container, err, data) {
    if (err) return cb(err);
    var exposed = opts.ports.map(function (port) {
      return parseInt(data.NetworkSettings.Ports[port + '/tcp'][0].HostPort, 10);
    });

    // poll until there is something listening on the exposed ports
    (function connect() {
      var client = net.connect({ host: dockerhost, port: exposed[0]},
        function () {
          setImmediate(work);
        })
        .on('error', function () {
          // check every 100 ms
          setTimeout(connect, 100);
        });
    })();

    function work() {
      cb(null, exposed, stop);
    }

    function stop(cb) {
      container.stop(function (err, data) {
        if (err) return cb(err);
        if (opts.remove) {
          container.remove(cb);
        } else {
          cb();
        }
      });
    }
  }
}

module.exports.pull = pull;
function pull(dockerhost, dockerport, img, cb) {
  if (typeof cb === 'undefined') {
    img = dockerport;
    cb = img;
    dockerport = 4243;
  }

  var docker = new Docker({host: 'http://' + dockerhost, port: dockerport});

  docker.listImages(function (err, images) {
    if (err) return cb(err);
    var image = images.filter(function (image) {
      return image.RepoTags.some(function (tag) {
        return tag === img + ':latest';
      });
    });

    if (image.length === 0) {
      docker.pull(img, function(err, stream) {
        if (err) return cb(err);
        process.stdout.write('\n');
        stream.pipe(JSONStream.parse())
        .pipe(through2.obj(function (obj, enc, next) {
          this.push(obj.status + (obj.progress ? (': ' + obj.progress) : '' ) + '\r');
          next();
        })).pipe(process.stdout);
        stream.once('error', cb);
        stream.once('end', finish);
      });
    } else {
      finish();
    }
  });

  function finish() {
    cb(null, docker);
  }
}
