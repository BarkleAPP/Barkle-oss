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
  logging: false  // Disable logging to reduce output
});

async function runMigrations() {
  let timeout;
  
  try {
    await dataSource.initialize();
    console.log("Data Source has been initialized!");
    
    // Set a timeout to force exit if migrations hang
    timeout = setTimeout(() => {
      console.log("Migration timeout reached, forcing exit...");
      process.exit(0);
    }, 30000); // 30 second timeout
    
    const migrations = await dataSource.runMigrations();
    console.log(`${migrations.length} migrations executed successfully.`);
    
    clearTimeout(timeout);
    await dataSource.destroy();
    console.log("Data Source connection closed.");
    
    // Force exit to ensure process terminates
    setImmediate(() => process.exit(0));
    
  } catch (error) {
    console.error("Error during migration:", error);
    if (timeout) clearTimeout(timeout);
    try {
      await dataSource.destroy();
    } catch (destroyError) {
      console.error("Error closing connection:", destroyError);
    }
    process.exit(1);
  }
}

runMigrations();
