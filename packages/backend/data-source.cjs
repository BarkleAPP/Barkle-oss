const { DataSource } = require('typeorm');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Load config from YAML
const configPath = path.join(__dirname, '../../.config/default.yml');
const config = yaml.load(fs.readFileSync(configPath, 'utf8'));

// Create DataSource instance
const AppDataSource = new DataSource({
    type: 'postgres',
    host: config.db.host,
    port: config.db.port,
    username: config.db.user,
    password: config.db.pass,
    database: config.db.db,
    extra: config.db.extra,
    entities: ['built/models/entities/*.js'],
    migrations: ['migration/*.js'],
    synchronize: false,
    logging: true
});

// Export the DataSource instance directly
module.exports = AppDataSource; 