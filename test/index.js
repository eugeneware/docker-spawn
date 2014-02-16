var expect = require('expect.js'),
    Sequelize = require('sequelize'),
    spawn = require('..');

describe('docker-spawn', function() {
  var dockerhost = 'docker';
  it('should be able to spin up a mysql server', function(done) {
    this.timeout(0);

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

    spawn(dockerhost, opts, work);
    function work(err, exposed, stop) {
      sequelize = new Sequelize('mysql', 'root', '', {
        dialect: 'mysql',
           host: dockerhost,
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
            stop(done);
          } else {
            console.log('Connection has been established successfully.')
            sequelize.query('select * from user').done(function (err, data) {
              if (err) throw err;
              console.log(data.length);
              console.log(data);
              stop(done);
            });
          }
        });
    }
  });
});
