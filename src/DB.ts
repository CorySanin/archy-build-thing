import { Sequelize, DataTypes, Op, } from 'sequelize';
import type { ModelStatic, Filterable } from 'sequelize';

interface DBConfig {
    db?: string;
    user?: string;
    password?: string;
    host?: string;
    port?: number;
}

const MONTH = 1000 * 60 * 60 * 24 * 24;
const FRESH = {
    [Op.or]: [
        { startTime: { [Op.gt]: new Date(Date.now() - MONTH) } },
        { startTime: { [Op.is]: null } }
    ]
}
const SELECT = ['id', 'repo', 'commit', 'distro', 'startTime', 'endTime', 'status'];

class DB {
    private build: ModelStatic<any>;
    private sequelize: Sequelize;

    constructor(config: DBConfig = {}) {
        this.sequelize = new Sequelize(config.db || 'archery', config.user || 'archery', config.password || '', {
            host: config.host || 'localhost',
            port: config.port || 5432,
            dialect: 'postgres'
        });
        this.build = this.sequelize.define('builds', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            repo: {
                type: DataTypes.STRING,
                allowNull: false
            },
            commit: {
                type: DataTypes.STRING,
                allowNull: true
            },
            patch: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            distro: {
                type: DataTypes.STRING,
                allowNull: false
            },
            startTime: {
                type: DataTypes.DATE,
                allowNull: true
            },
            endTime: {
                type: DataTypes.DATE,
                allowNull: true
            },
            status: {
                type: DataTypes.ENUM('queued', 'running', 'cancelled', 'success', 'error'),
                allowNull: false,
                defaultValue: 'queued'
            },
            pid: {
                type: DataTypes.INTEGER,
                allowNull: true
            },
            log: {
                type: DataTypes.TEXT,
                allowNull: true
            }
        });

        this.build.sync();
    }

    public async createBuild(repo: string, commit: string, patch: string, distro: string): Promise<number> {
        const buildRec = await this.build.create({
            repo,
            commit: commit || null,
            patch: patch || null,
            distro
        });
        return buildRec.id;
    }

    public async startBuild(id: number, pid: number): Promise<void> {
        await this.build.update({
            startTime: new Date(),
            status: 'running',
            pid,
            log: ''
        }, {
            where: {
                id
            }
        });
    }

    public async finishBuild(id: number, status: string): Promise<void> {
        await this.build.update({
            endTime: new Date(),
            status
        }, {
            where: {
                id
            }
        });
    }

    public async appendLog(id: number, log: string): Promise<void> {
        await this.build.update({
            log: Sequelize.literal(`log || '${log}'`)
        }, {
            where: {
                id
            }
        });
    }

    public async getBuild(id: number): Promise<any> {
        return await this.build.findByPk(id);
    }

    public async getBuilds(): Promise<any> {
        return await this.build.findAll({
            attributes: SELECT,
            order: [['id', 'DESC']],
            where: FRESH,
        });
    }

    public async getBuildsByStatus(status: string): Promise<any> {
        return await this.build.findAll({
            attributes: SELECT,
            order: [['id', 'DESC']],
            where: {
                ...FRESH,
                status
            }
        });
    }

    public async getBuildsByDistro(distro: string): Promise<any> {
        return await this.build.findAll({
            attributes: SELECT,
            order: [['id', 'DESC']],
            where: {
                ...FRESH,
                distro
            }
        });
    }

    public async getBuildsBy(filterable: Filterable): Promise<any> {
        return await this.build.findAll({
            attributes: SELECT,
            order: [['id', 'DESC']],
            where: {
                ...FRESH,
                ...filterable
            }
        });
    }

    public async searchBuilds(query: string): Promise<any> {
        return await this.build.findAll({
            attributes: SELECT,
            order: [['id', 'DESC']],
            where: {
                [Op.or]: [
                    { repo: { [Op.iLike]: `%${query}%` } }
                ]
            },
            limit: 100
        });
    }

    public async cleanup(): Promise<void> {
        await this.build.destroy({
            where: {
                startTime: { [Op.lt]: new Date(Date.now() - MONTH * 6) }
            }
        });
    }

    public async close(): Promise<void> {
        await this.sequelize.close();
    }
}

export default DB;
export { DB };
export type { DBConfig };
