var expect = require('expect.js'),
    Docker = require('dockerode'),
    through2 = require('through2'),
    JSONStream = require('JSONStream'),
    Sequelize = require('sequelize'),
    net = require('net'),
    spawn = require('..');

describe('docker-spawn', function() {
  it('should be able to spin up a mysql server', function(done) {
    this.timeout(0);

    var docker = new Docker({host: 'http://localdocker', port: 4243});

    function pull(img, cb) {
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

    /*
    var opts = {
      image: 'orchardup/postgresql',
      ports: [5432]
    };
    */
    var opts = {
      image: 'orchardup/mysql',
      ports: [3306]
    };

    pull(opts.image, function (err) {
      if (err) throw err;
      docker.createContainer({Image: opts.image}, function(err, container) {
        if (err) throw err;
        var ports = opts.ports.reduce(function (acc, port) {
          acc[port + '/tcp'] = [ { HostPort: '0' } ];
          return acc;
        }, {});;
        container.start({PortBindings: ports}, function(err, data) {
          if (err) throw err;
          console.log('started', container.id);
          container.inspect(function (err, data) {
            if (err) throw err;
            var exposed = opts.ports.map(function (port) {
              return parseInt(data.NetworkSettings.Ports[port + '/tcp'][0].HostPort, 10);
            });
            console.log(exposed);

            (function connect() {
              var client = net.connect({ host: 'localdocker', port: exposed[0]},
                function () {
                  console.log('connected');
                  setImmediate(work);
                })
                .on('error', function () {
                  setTimeout(connect, 100);
                });
            })();

            function work() {
              sequelize = new Sequelize('mysql', 'root', '', {
                dialect: 'mysql',
                   host: '172.18.42.1',
                   port: exposed[0],
                   pool: {
                     handleDisconnects: true
                   }
              });
              sequelize
                .authenticate()
                .done(function(err) {
                  if (!!err) {
                    console.log('Unable to connect to the database:', err)
                    stop();
                  } else {
                    console.log('Connection has been established successfully.')
                    sequelize.query('select * from user').done(function (err, data) {
                      if (err) throw err;
                      console.log(data.length);
                      console.log(data);
                      stop();
                    });
                  }
                });
            }

            function stop() {
              container.stop(function (err, data) {
                if (err) throw err;
                container.remove(function () {
                  done();
                });
              });
            }
          });
        });
      });
    });
  });
});
