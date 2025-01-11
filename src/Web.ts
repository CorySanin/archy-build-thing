import * as http from "http";
import crypto from 'crypto';
import type { Express } from "express";
import express, { application } from 'express';

interface WebConfig {
    port?: number;
}

/**
 * I still hate typescript.
 */
function notStupidParseInt(v: string | undefined): number {
    return v === undefined ? NaN : parseInt(v);
}

class Web {
    private _webserver: http.Server | null = null;

    constructor(options: WebConfig = {}) {
        const app: Express = express();
        const port: number = notStupidParseInt(process.env.PORT) || options['port'] as number || 8080;

        app.set('trust proxy', 1);
        app.set('view engine', 'ejs');
        app.set('view options', { outputFunctionName: 'echo' });
        app.use('/assets', express.static('assets', { maxAge: '30 days' }));
        app.use((_req, res, next) => {
            crypto.randomBytes(32, (err, randomBytes) => {
                if (err) {
                    console.error(err);
                    next(err);
                } else {
                    res.locals.cspNonce = randomBytes.toString("hex");
                    next();
                }
            });
        });

        app.get('/', (_, res) => {
            res.render('index', {
                page: {
                    title: 'Archery',
                    titlesuffix: 'Dashboard',
                    description: 'PKGBUILD central'
                }
            });
        });

        app.get('/build/?', (_, res) => {
            res.render('build', {
                page: {
                    title: 'Archery',
                    titlesuffix: 'New Build',
                    description: 'Kick off a build'
                }
            });
        });

        app.get('/healthcheck', (_, res) => {
            res.send('Healthy');
        });

        this._webserver = app.listen(port, () => console.log(`archery is running on port ${port}`));
    }

    close = () => {
        if (this._webserver) {
            this._webserver.close();
        }
    }
}

export default Web;