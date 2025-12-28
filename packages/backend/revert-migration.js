#!/usr/bin/env node

import { DataSource } from "typeorm";
import config from "./built/config/index.js";
import { entities } from "./built/db/postgre.js";

const dataSource = new DataSource({
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

async function revertMigration() {
  try {
    await dataSource.initialize();
    console.log("Data Source has been initialized!");
    
    await dataSource.undoLastMigration();
    console.log("Last migration reverted successfully.");
    
    await dataSource.destroy();
    console.log("Data Source connection closed.");
    process.exit(0);
  } catch (error) {
    console.error("Error during migration revert:", error);
    try {
      await dataSource.destroy();
    } catch (destroyError) {
      console.error("Error closing connection:", destroyError);
    }
    process.exit(1);
  }
}

revertMigration();
