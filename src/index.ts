import fs from 'fs';
import path from 'path';
import Web from './Web.ts';

const config = JSON.parse(await fs.promises.readFile(process.env.config || path.join('config', 'config.json'), 'utf-8'));

const web = new Web(config);
