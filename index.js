var Docker = require('dockerode'),
    through2 = require('through2'),
    JSONStream = require('JSONStream'),
    net = require('net');

module.exports = spawn;
function spawn(dockerhost, opts, cb) {
  var docker = new Docker({host: 'http://' + dockerhost, port: 4243});

  pull(docker, opts.image, function (err) {
    if (err) throw err;
    docker.createContainer({Image: opts.image}, function(err, container) {
      if (err) throw err;
      var ports = opts.ports.reduce(function (acc, port) {
        acc[port + '/tcp'] = [ { HostPort: '0' } ];
        return acc;
      }, {});;

      container.start({PortBindings: ports}, function(err, data) {
        if (err) throw err;

        container.inspect(function (err, data) {
          if (err) throw err;
          var exposed = opts.ports.map(function (port) {
            return parseInt(data.NetworkSettings.Ports[port + '/tcp'][0].HostPort, 10);
          });

          (function connect() {
            var client = net.connect({ host: dockerhost, port: exposed[0]},
              function () {
                setImmediate(work);
              })
              .on('error', function () {
                setTimeout(connect, 100);
              });
          })();

          function work() {
            cb(null, exposed, stop);
          }

          function stop(cb) {
            container.stop(function (err, data) {
              if (err) return cb(err);
              container.remove(function () {
                cb();
              });
            });
          }
        });
      });
    });
  });
}

function pull(docker, img, cb) {
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
        stream.once('end', cb);
      });
    } else {
      cb();
    }
  });
}
