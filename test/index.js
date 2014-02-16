var expect = require('expect.js'),
    Sequelize = require('sequelize'),
    spawn = require('..');

describe('docker-spawn', function() {
  var dockerport = 4243;
  var dockerhost = process.env.DOCKER_HOST || 'docker';

  it('should be able to spin up a mysql server', function(done) {
    this.timeout(0);

    spawn(dockerhost, dockerport, {
       image: 'orchardup/mysql',
       ports: [3306],
      remove: true
    }, work);

    function work(err, exposed, stop) {
      if (err) return done(err);
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
            stop(function () {
              return done(err);
            });
          } else {
            sequelize.query('select * from user').done(function (err, data) {
              if (err) throw err;
              expect(data.length).to.equal(8);
              stop(done);
            });
          }
        });
    }
  });

  it('should be able to spin up a postgresql server', function(done) {
    this.timeout(0);

    spawn(dockerhost, dockerport, {
       image: 'orchardup/postgresql',
       ports: [5432],
      remove: true
    }, work);

    function work(err, exposed, stop) {
      if (err) return done(err);
      sequelize = new Sequelize('docker', 'docker', 'docker', {
        dialect: 'postgres',
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
            stop(function () {
              return done(err);
            });
          } else {
            sequelize.query('select * from pg_catalog.pg_user').done(function (err, data) {
              if (err) throw err;
              expect(data).to.eql(
                [ { usename: 'postgres',
                    usesysid: 10,
                    usecreatedb: true,
                    usesuper: true,
                    usecatupd: true,
                    userepl: true,
                    passwd: '********',
                    valuntil: null,
                    useconfig: null },
                  { usename: 'docker',
                    usesysid: 11920,
                    usecreatedb: false,
                    usesuper: true,
                    usecatupd: true,
                    userepl: true,
                    passwd: '********',
                    valuntil: null,
                    useconfig: null } ]);
              stop(done);
            });
          }
        });
    }
  });
});
