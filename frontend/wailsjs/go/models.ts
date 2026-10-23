export namespace db {
	
	export class AppliedMigration {
	    module: string;
	    version: number;
	    name: string;
	    appliedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new AppliedMigration(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.module = source["module"];
	        this.version = source["version"];
	        this.name = source["name"];
	        this.appliedAt = source["appliedAt"];
	    }
	}

}

export namespace paths {
	
	export class Paths {
	    appDir: string;
	    dataDir: string;
	    dbFile: string;
	    backupDir: string;
	    logDir: string;
	    assetsDir: string;
	
	    static createFrom(source: any = {}) {
	        return new Paths(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.appDir = source["appDir"];
	        this.dataDir = source["dataDir"];
	        this.dbFile = source["dbFile"];
	        this.backupDir = source["backupDir"];
	        this.logDir = source["logDir"];
	        this.assetsDir = source["assetsDir"];
	    }
	}

}

export namespace system {
	
	export class Info {
	    appName: string;
	    version: string;
	    paths?: paths.Paths;
	    dbReady: boolean;
	    dbSize: number;
	    modules: string[];
	    migrations: db.AppliedMigration[];
	    startedAt: string;
	    initError: string;
	
	    static createFrom(source: any = {}) {
	        return new Info(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.appName = source["appName"];
	        this.version = source["version"];
	        this.paths = this.convertValues(source["paths"], paths.Paths);
	        this.dbReady = source["dbReady"];
	        this.dbSize = source["dbSize"];
	        this.modules = source["modules"];
	        this.migrations = this.convertValues(source["migrations"], db.AppliedMigration);
	        this.startedAt = source["startedAt"];
	        this.initError = source["initError"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

