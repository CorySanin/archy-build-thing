import * as http from "http";
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
        app.use('/assets', express.static('assets'));

        app.get('/healthcheck', (_, res) => {
            res.send('Healthy');
        });

        this._webserver = app.listen(port, () => console.log(`archy-build-thing is running on port ${port}`));
    }

    close = () => {
        if (this._webserver) {
            this._webserver.close();
        }
    }
}

export default Web;