import * as http from "http";
import crypto from 'crypto';
import type { Express } from "express";
import express, { application } from 'express';
import bodyParser from "body-parser";
import type { DB } from "./DB.ts";
import type { BuildController } from "./BuildController.ts";

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
    private db: DB;
    private buildController: BuildController;
    private app: Express;
    private port: number;

    constructor(options: WebConfig = {}) {
        const app: Express = this.app = express();
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
                const builds = await this.db.getBuildsBy(req.query);
                res.render('index', {
                    page: {
                        title: 'Archery',
                        titlesuffix: 'Dashboard',
                        description: 'PKGBUILD central'
                    },
                    builds
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
            const buildId = await this.db.createBuild(req.body.repo, req.body.commit || null, req.body.patch || null, req.body.distro);
            res.redirect(`/build/${buildId}`);
            this.buildController.triggerBuild();
        });

        app.get('/build/:num/?', async (req, res) => {
            const build = await this.db.getBuild(parseInt(req.params.num));
            if (!build) {
                res.sendStatus(404);
                return;
            }
            const log = (await this.db.getLog(build.id)).map(logChunk => logChunk.chunk.split('\n')).flat();

            res.render('build', {
                page: {
                    title: 'Archery',
                    titlesuffix: `Build #${req.params.num}`,
                    description: `Building ${build.repo} on ${build.distro}`
                },
                build,
                log
            });
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

        app.get('/healthcheck', (_, res) => {
            res.send('Healthy');
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
