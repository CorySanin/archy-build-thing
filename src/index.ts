import fs from 'fs';
import path from 'path';
import { Web } from './Web.ts';
import { DB } from './DB.ts';
import type { WebConfig } from './Web.ts';
import type { DBConfig } from './DB.ts';

interface compositeConfig {
    web?: WebConfig,
    db?: DBConfig
}

const config: compositeConfig = JSON.parse(await fs.promises.readFile(process.env.config || path.join('config', 'config.json'), 'utf-8'));

const web = new Web(config.web);
await new Promise((resolve) => setTimeout(resolve, 1500));
const db = new DB(config.db);
web.setDB(db);

process.on('SIGTERM', () => {
    web.close();
    db.close();
});
