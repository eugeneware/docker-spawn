
var Sequelize = require('sequelize'),
sequelize = new Sequelize('mysql', 'root', '', {
  dialect: 'mysql',
     host: '172.18.42.1',
     port: 49191
});
sequelize
  .authenticate()
  .complete(function(err) {
    console.log(sequelize.connectorManager);
    if (!!err) {
      console.log('Unable to connect to the database:', err)
    } else {
      console.log('Connection has been established successfully.')
      sequelize.query('select * from user').done(function (err, data) {
        if (err) throw err;
        console.log(data.length);
        sequelize.connectorManager.disconnect();
      });;
    }
  });

