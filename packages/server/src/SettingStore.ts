import * as fs from "fs";
import log4js from "log4js";
import EventEmitter from "events";

const logger = log4js.getLogger();

export type SSHConfig = {
  remoteHost: string;
  remotePort?: number;
  dbHost?: string;
  dbPort?: number;
  user?: string;
  passphrase?: string;
  identityFile?: string;
};
export type Connection = {
  name: string | null;
  adapter:
    | "json"
    | "mysql"
    | "postgresql"
    | "postgres"
    | "sqlite3"
    | "bigquery"
    | null;
  host: string | null;
  port: number | null;
  user: string | null;
  database: string | null;
  password: string | null;
  filename: string | null; // for sqlite3
  keyFile: string | null; // for BigQuery
  projectId: string | null; // for BigQuery
  projectPaths: string[];
  ssh: SSHConfig | null;
  jupyterLabMode: boolean;
};

type PersonalConfig = {
  connections: Connection[];
};

function fileExists(path: string) {
  try {
    return fs.statSync(path).isFile();
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err && err.code === "ENOENT") {
      return false;
    }
    throw err;
  }
}

function readFile(filePath: string) {
  return fs.readFileSync(filePath, "utf8").replace(/^\ufeff/u, "");
}

export default class SettingStore extends EventEmitter.EventEmitter {
  private personalConfig: PersonalConfig = { connections: [] };
  private state: Connection = {
    name: null,
    adapter: null,
    host: null,
    port: null,
    user: null,
    database: null,
    password: null,
    ssh: null,
    filename: null,
    keyFile: null,
    projectId: null,
    projectPaths: [],
    jupyterLabMode: false,
  };
  private static instance: SettingStore;

  private constructor() {
    super();
  }

  static getInstance() {
    if (SettingStore.instance) {
      return SettingStore.instance;
    }
    SettingStore.instance = new SettingStore();
    return SettingStore.instance;
  }

  getSetting() {
    return Object.assign({}, this.state);
  }

  getPersonalConfig() {
    return this.personalConfig;
  }

  async changeConnection(connectionName: string) {
    const config = this.personalConfig.connections.find(
      (v) => v.name === connectionName
    );
    if (!config) {
      const errorMessage = `not find connection name: ${connectionName}`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }
    this.setSetting(config);
  }

  async setSettingFromFile(
    personalConfigPath: string,
    projectConfigPath: string,
    projectPath: string
  ): Promise<Connection | null> {
    let personalConfig = { connections: [] } as PersonalConfig,
      projectConfig = {} as Connection;
    if (fileExists(personalConfigPath)) {
      personalConfig = JSON.parse(readFile(personalConfigPath));
      this.personalConfig = personalConfig;
    } else {
      logger.debug(`There isn't personal config file. ${personalConfigPath}`);
    }
    if (fileExists(projectConfigPath)) {
      projectConfig = JSON.parse(readFile(projectConfigPath));
    } else {
      logger.debug(`There isn't project config file., ${projectConfigPath}`);
    }
    const extractedPersonalConfig = projectConfig.name
      ? personalConfig.connections.find(
          (v: Connection) => v.name === projectConfig.name
        )
      : this.extractPersonalConfigMatchedProjectPath(projectPath);

    const sshConfig = {
      ...(extractedPersonalConfig?.ssh || {}),
      ...(projectConfig?.ssh || {}),
    } as SSHConfig;
    const config = { ...extractedPersonalConfig, ...projectConfig };
    config.ssh = sshConfig;
    this.setSetting(config);
    return this.getSetting();
  }

  async setSettingFromWorkspaceConfig(
    connections: Connection[],
    projectPath = ""
  ) {
    this.personalConfig = { connections };
    let extractedPersonalConfig =
      this.extractPersonalConfigMatchedProjectPath(projectPath);
    // Default to first connection if none are matched
    if (extractedPersonalConfig == undefined) {
      if (connections?.length > 0) {
        extractedPersonalConfig = connections[0];
      }
    }
    this.setSetting(extractedPersonalConfig || {});
    return this.getSetting();
  }

  setSetting(setting: Partial<Connection>) {
    logger.debug(`Set config: ${JSON.stringify(setting)}`);
    // TODO: remove any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const replaceEnv = (v: { [key: string]: any }) => {
      for (const k in v) {
        if (v[k] && typeof v[k] === "object") {
          replaceEnv(v[k]);
        } else if (typeof v[k] === "string") {
          const matched = (v[k] as string).match(/\${env:(.*?)}/);
          if (matched) {
            v[k] = (v[k] as string).replace(
              `\${env:${matched[1]}}`,
              process.env[matched[1]] || ""
            );
          }
        }
      }
    };
    const newSetting = Object.assign({}, setting);
    newSetting.ssh = newSetting.ssh ? Object.assign({}, newSetting.ssh) : null;
    replaceEnv(newSetting);
    this.state = Object.assign({}, this.state, newSetting);
    logger.debug('setting store, emit "change"');
    this.emit("change", this.state);
  }

  private extractPersonalConfigMatchedProjectPath(projectPath: string) {
    const con = this.personalConfig.connections.find((v: Connection) =>
      v.projectPaths?.includes(projectPath)
    );
    if (!con) {
      logger.debug(
        `Not to extract personal config, { path: ${projectPath}, projectName: ${projectPath} }`
      );
    }
    return con;
  }
}
