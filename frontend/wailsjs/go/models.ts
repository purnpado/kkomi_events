export namespace backup {
	
	export class BackupFile {
	    fileName: string;
	    filePath: string;
	    fileSize: number;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new BackupFile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.fileName = source["fileName"];
	        this.filePath = source["filePath"];
	        this.fileSize = source["fileSize"];
	        this.createdAt = source["createdAt"];
	    }
	}

}

export namespace customfield {
	
	export class CustomField {
	    id: number;
	    targetMenu: string;
	    fieldName: string;
	    fieldType: string;
	    sortOrder: number;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new CustomField(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.targetMenu = source["targetMenu"];
	        this.fieldName = source["fieldName"];
	        this.fieldType = source["fieldType"];
	        this.sortOrder = source["sortOrder"];
	        this.createdAt = source["createdAt"];
	    }
	}

}

export namespace dashboard {
	
	export class CategoryStat {
	    name: string;
	    icon: string;
	    amount: number;
	    count: number;
	
	    static createFrom(source: any = {}) {
	        return new CategoryStat(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.icon = source["icon"];
	        this.amount = source["amount"];
	        this.count = source["count"];
	    }
	}
	export class MonthlyStat {
	    month: string;
	    receivedAmount: number;
	    sentAmount: number;
	
	    static createFrom(source: any = {}) {
	        return new MonthlyStat(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.month = source["month"];
	        this.receivedAmount = source["receivedAmount"];
	        this.sentAmount = source["sentAmount"];
	    }
	}
	export class SummaryData {
	    totalReceivedAmount: number;
	    totalReceivedCount: number;
	    totalSentAmount: number;
	    totalSentCount: number;
	    netBalance: number;
	    needPayCount: number;
	    needPayTotal: number;
	    upcomingCount: number;
	    monthly: MonthlyStat[];
	    categories: CategoryStat[];
	
	    static createFrom(source: any = {}) {
	        return new SummaryData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.totalReceivedAmount = source["totalReceivedAmount"];
	        this.totalReceivedCount = source["totalReceivedCount"];
	        this.totalSentAmount = source["totalSentAmount"];
	        this.totalSentCount = source["totalSentCount"];
	        this.netBalance = source["netBalance"];
	        this.needPayCount = source["needPayCount"];
	        this.needPayTotal = source["needPayTotal"];
	        this.upcomingCount = source["upcomingCount"];
	        this.monthly = this.convertValues(source["monthly"], MonthlyStat);
	        this.categories = this.convertValues(source["categories"], CategoryStat);
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

export namespace eventtype {
	
	export class EventType {
	    id: number;
	    name: string;
	    icon: string;
	    color: string;
	    sortOrder: number;
	    isHidden: boolean;
	    createdAt: string;
	    updatedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new EventType(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.icon = source["icon"];
	        this.color = source["color"];
	        this.sortOrder = source["sortOrder"];
	        this.isHidden = source["isHidden"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	    }
	}

}

export namespace excelio {
	
	export class ImportResult {
	    totalRows: number;
	    successRows: number;
	    skippedRows: number;
	    errors: string[];
	
	    static createFrom(source: any = {}) {
	        return new ImportResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.totalRows = source["totalRows"];
	        this.successRows = source["successRows"];
	        this.skippedRows = source["skippedRows"];
	        this.errors = source["errors"];
	    }
	}

}

export namespace matching {
	
	export class HistoryItem {
	    type: string;
	    id: number;
	    eventTitle: string;
	    eventDate: string;
	    amount: number;
	    paymentMethod: string;
	    notes: string;
	
	    static createFrom(source: any = {}) {
	        return new HistoryItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.id = source["id"];
	        this.eventTitle = source["eventTitle"];
	        this.eventDate = source["eventDate"];
	        this.amount = source["amount"];
	        this.paymentMethod = source["paymentMethod"];
	        this.notes = source["notes"];
	    }
	}
	export class PersonSummary {
	    name: string;
	    phone: string;
	    phoneClean: string;
	    relationship: string;
	    receivedCount: number;
	    receivedTotal: number;
	    sentCount: number;
	    sentTotal: number;
	    balance: number;
	    status: string;
	    statusText: string;
	
	    static createFrom(source: any = {}) {
	        return new PersonSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.phone = source["phone"];
	        this.phoneClean = source["phoneClean"];
	        this.relationship = source["relationship"];
	        this.receivedCount = source["receivedCount"];
	        this.receivedTotal = source["receivedTotal"];
	        this.sentCount = source["sentCount"];
	        this.sentTotal = source["sentTotal"];
	        this.balance = source["balance"];
	        this.status = source["status"];
	        this.statusText = source["statusText"];
	    }
	}
	export class PersonDetail {
	    summary: PersonSummary;
	    history: HistoryItem[];
	
	    static createFrom(source: any = {}) {
	        return new PersonDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.summary = this.convertValues(source["summary"], PersonSummary);
	        this.history = this.convertValues(source["history"], HistoryItem);
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

export namespace myevent {
	
	export class MyEvent {
	    id: number;
	    eventTypeId: number;
	    eventTypeName?: string;
	    eventTypeIcon?: string;
	    title: string;
	    eventDate: string;
	    location: string;
	    targetName: string;
	    memberSide: string;
	    notes: string;
	    totalCount?: number;
	    totalAmount?: number;
	    createdAt: string;
	    updatedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new MyEvent(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.eventTypeId = source["eventTypeId"];
	        this.eventTypeName = source["eventTypeName"];
	        this.eventTypeIcon = source["eventTypeIcon"];
	        this.title = source["title"];
	        this.eventDate = source["eventDate"];
	        this.location = source["location"];
	        this.targetName = source["targetName"];
	        this.memberSide = source["memberSide"];
	        this.notes = source["notes"];
	        this.totalCount = source["totalCount"];
	        this.totalAmount = source["totalAmount"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	    }
	}
	export class ReceivedItem {
	    id: number;
	    myEventId: number;
	    myEventTitle?: string;
	    name: string;
	    phone: string;
	    phoneClean: string;
	    relationship: string;
	    amount: number;
	    paymentMethod: string;
	    isThanked: boolean;
	    memberSide: string;
	    notes: string;
	    createdAt: string;
	    updatedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new ReceivedItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.myEventId = source["myEventId"];
	        this.myEventTitle = source["myEventTitle"];
	        this.name = source["name"];
	        this.phone = source["phone"];
	        this.phoneClean = source["phoneClean"];
	        this.relationship = source["relationship"];
	        this.amount = source["amount"];
	        this.paymentMethod = source["paymentMethod"];
	        this.isThanked = source["isThanked"];
	        this.memberSide = source["memberSide"];
	        this.notes = source["notes"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
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

export namespace sent {
	
	export class SentItem {
	    id: number;
	    name: string;
	    phone: string;
	    phoneClean: string;
	    relationship: string;
	    eventTypeId: number;
	    eventTypeName?: string;
	    eventTypeIcon?: string;
	    eventDate: string;
	    amount: number;
	    paymentMethod: string;
	    attended: boolean;
	    memberSide: string;
	    notes: string;
	    createdAt: string;
	    updatedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new SentItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.phone = source["phone"];
	        this.phoneClean = source["phoneClean"];
	        this.relationship = source["relationship"];
	        this.eventTypeId = source["eventTypeId"];
	        this.eventTypeName = source["eventTypeName"];
	        this.eventTypeIcon = source["eventTypeIcon"];
	        this.eventDate = source["eventDate"];
	        this.amount = source["amount"];
	        this.paymentMethod = source["paymentMethod"];
	        this.attended = source["attended"];
	        this.memberSide = source["memberSide"];
	        this.notes = source["notes"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
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

