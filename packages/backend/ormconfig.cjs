const { DataSource } = require("typeorm");

// Use dynamic import for ES modules
async function createDataSource() {
  const { default: config } = await import("./built/config/index.js");
  const { entities } = await import("./built/db/postgre.js");
  
  return new DataSource({
    type: "postgres",
    host: config.db.host,
    port: config.db.port,
    username: config.db.user,
    password: config.db.pass,
    database: config.db.db,
    extra: config.db.extra,
    entities: entities,
    migrations: ["migration/*.js"],
    logging: true
  });
}

// Export the promise directly for TypeORM CLI
module.exports = createDataSource();
