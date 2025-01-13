import spawn from 'child_process';
import EventEmitter from 'events';
import type { Build, DB } from "./DB.ts";

const docker_images = {
    arch: 'corysanin/archy-build-thing:arch',
    artix: 'corysanin/archy-build-thing:artix',
}

type LogType = 'std' | 'err' | 'finish';

interface BuildEvent {
    id: number;
    type: LogType;
    message: any;
}

class BuildController extends EventEmitter {
    private db: DB;
    private process: spawn.ChildProcess | null = null;
    private running: boolean = false;

    constructor(config = {}) {
        super();
        setInterval(this.triggerBuild, 60000);
    }

    triggerBuild = () => {
        if (!this.running) {
            this.running = true;
            this.kickOffBuild();
            return true;
        }
        return false;
    }

    private kickOffBuild = async () => {
        this.running = true;
        const build = await this.db.dequeue();
        if (build === null) {
            this.running = false;
            return;
        }
        try {
            await this.pullImage(build.distro);
            await this.build(build);
        }
        catch (e) {
            console.error(e);
            this.db.finishBuild(build.id, 'error');
        }
        this.kickOffBuild();
    }

    private pullImage = (distro: string) => {
        return new Promise<void>((resolve, reject) => {
            if (!(distro in docker_images)) {
                return reject();
            }
            const docker = spawn.spawn('docker', ['pull', docker_images[distro]]);
            docker.stdout.on('data', (data) => {
                console.log(`${data}`);
            });
            docker.stderr.on('data', (data) => {
                console.error(`${data}`);
            });
            docker.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(code);
                }
            });
            docker.on('error', (err) => {
                reject(err);
            });
        });
    }

    private build = async (build: Build) => {
        return new Promise<void>((resolve, reject) => {
            const docker = this.process = spawn.spawn('docker', this.createBuildParams(build));
            docker.on('spawn', () => {
                const remainder = {
                    std: '',
                    err: ''
                }
                this.db.startBuild(build.id, docker.pid);

                let createLogFunction = (type: LogType) => {
                    return (data: Buffer | string) => {
                        const str = data.toString();
                        const readyToLog = remainder[type] + str.substring(0, str.lastIndexOf('\n'));
                        remainder[type] = str.substring(str.lastIndexOf('\n'));
                        this.db.appendLog(build.id, readyToLog);
                        this.emitLog({
                            id: build.id,
                            type: type,
                            message: readyToLog
                        });
                    };
                };

                docker.stdout.on('data', createLogFunction('std'));
                docker.stderr.on('data', createLogFunction('err'));
            });
            docker.on('close', (code) => {
                this.process = null;
                this.emitLog({
                    id: build.id,
                    type: 'finish',
                    message: code
                });

                if (code === 0) {
                    this.db.finishBuild(build.id, 'success');
                    resolve();
                }
                else {
                    this.db.finishBuild(build.id, 'error');
                    reject(code);
                }
            });
        });
    }

    private emitLog = (msg: BuildEvent) => {
        this.emit('log', msg);
    }

    private createBuildParams = (build: Build) => {
        // TODO: implement patch
        const params = ['run', '--rm', '-e', `REPO=${build.repo}`];
        if (build.commit) {
            // TODO: implement COMMIT
            params.push('-e', `COMMIT=${build.commit}`);
        }
        params.push(docker_images[build.distro]);
        return params;
    }

    cancelBuild = async (pid: number) => {
        const p = this.process
        if (p && p.pid === pid) {
            return p.kill();
        }
    }

    setDB = (db: DB) => {
        this.db = db;
    }
}

export default BuildController;
export { BuildController };
export type { };