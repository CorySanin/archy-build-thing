import * as http from "http";
import crypto from 'crypto';
import type { Express } from "express";
import express from 'express';
import expressWs from "express-ws";
import bodyParser from "body-parser";
import type { DB, LogChunk } from "./DB.ts";
import type { BuildController, BuildEvent } from "./BuildController.ts";

interface WebConfig {
    port?: number;
}

/**
 * I still hate typescript.
 */
function notStupidParseInt(v: string | undefined): number {
    return v === undefined ? NaN : parseInt(v);
}

function timeElapsed(date1: Date, date2: Date) {
    if (!date2 || !date1) {
        return '-';
    }
    const ms = Math.abs(date2.getTime() - date1.getTime());
    const seconds = Math.floor(ms / 1000) % 60;
    const minutes = Math.floor(ms / (1000 * 60)) % 60;
    const hours = Math.floor(ms / (1000 * 60 * 60));
    return `${hours}:${minutes}:${seconds}`;
}

function splitLines(lines: LogChunk[]) {
    return lines.map(logChunk => logChunk.chunk.split('\n')).flat().map(line => line.substring(line.lastIndexOf('\r') + 1));
}

class Web {
    private _webserver: http.Server | null = null;
    private db: DB;
    private buildController: BuildController;
    private app: expressWs.Application;
    private port: number;

    constructor(options: WebConfig = {}) {
        const app: Express = express();
        const wsApp = this.app = expressWs(app).app;
        this.port = notStupidParseInt(process.env.PORT) || options['port'] as number || 8080;

        app.set('trust proxy', 1);
        app.set('view engine', 'ejs');
        app.set('view options', { outputFunctionName: 'echo' });
        app.use('/assets', express.static('assets', { maxAge: '30 days' }));
        app.use(bodyParser.json());
        app.use(bodyParser.urlencoded({ extended: true }));
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

        app.get('/', async (req, res) => {
            try {
                const builds = 'q' in req.query ? await this.db.searchBuilds(req.query.q as string) : await this.db.getBuildsBy(req.query);
                res.render('index', {
                    page: {
                        title: 'Archery',
                        titlesuffix: 'Dashboard',
                        description: 'PKGBUILD central'
                    },
                    builds,
                    timeElapsed
                });
            }
            catch (err) {
                console.error(err);
                res.sendStatus(400);
            }
        });

        app.get('/build/?', (_, res) => {
            res.render('build-new', {
                page: {
                    title: 'Archery',
                    titlesuffix: 'New Build',
                    description: 'Kick off a build'
                }
            });
        });

        app.post('/build/?', async (req, res) => {
            const buildId = await this.db.createBuild(
                req.body.repo,
                req.body.commit || null,
                req.body.patch || null,
                req.body.distro || 'arch',
                req.body.dependencies || 'stable'
            );
            res.redirect(`/build/${buildId}`);
            this.buildController.triggerBuild();
        });

        app.get('/build/:num/?', async (req, res) => {
            const build = await this.db.getBuild(parseInt(req.params.num));
            if (!build) {
                res.sendStatus(404);
                return;
            }
            const log = splitLines(await this.db.getLog(build.id));

            res.render('build', {
                page: {
                    title: 'Archery',
                    titlesuffix: `Build #${req.params.num}`,
                    description: `Building ${build.repo} on ${build.distro}`
                },
                build,
                log,
                ended: build.status !== 'queued' && build.status !== 'running'
            });
        });

        app.get('/build/:num/cancel', async (req, res) => {
            const build = await this.db.getBuild(parseInt(req.params.num));
            if (!build) {
                res.sendStatus(404);
                return;
            }
            try {
                await this.buildController.cancelBuild(build.id);
            }
            catch (ex) {
                console.error(ex);
            }
            res.redirect(`/build/${build.id}`);
        });

        app.get('/build/:num/logs/?', async (req, res) => {
            const build = await this.db.getBuild(parseInt(req.params.num));
            if (!build) {
                res.sendStatus(404);
                return;
            }
            const log = (await this.db.getLog(build.id)).map(logChunk => logChunk.chunk).join('\n');
            res.set('Content-Type', 'text/plain').send(log);
        });

        app.get('/build/:num/patch/?', async (req, res) => {
            const build = await this.db.getBuild(parseInt(req.params.num));
            if (!build || !build.patch) {
                res.sendStatus(404);
                return;
            }
            res.set('Content-Type', 'text/plain').send(build.patch);
        });

        app.get('/healthcheck', (_, res) => {
            res.send('Healthy');
        });

        wsApp.ws('/build/:num/ws', (ws, req) => {
            console.log('WS Opened');
            const eventListener = (be: BuildEvent) => {
                if (be.id === notStupidParseInt(req.params.num)) {
                    ws.send(JSON.stringify(be));
                }
            };
            this.buildController.on('log', eventListener);

            ws.on('close', () => {
                console.log('WS Closed');
                this.buildController.removeListener('log', eventListener);
            });
        });

    }

    close = () => {
        if (this._webserver) {
            this._webserver.close();
        }
    }

    setDB = (db: DB) => {
        this.db = db;
        if (!this._webserver) {
            this._webserver = this.app.listen(this.port, () => console.log(`archery is running on port ${this.port}`));
        }
    }

    setBuildController = (buildController: BuildController) => {
        this.buildController = buildController;
    }
}

export default Web;
export { Web };
export type { WebConfig };
