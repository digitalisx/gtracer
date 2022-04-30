export interface LogStructure {
	timestamp: Date,
	level: string,
	pid: string,
	eventType: string,
	handler: string,
	detail: string
}

export interface DirectoryStructure {
	folder: string,
	file: string
}

export const enum CommonToken {
	DOUBLE_ESCAPE = "\\",
	SPACE = ""
}

export const enum LogToken {
	TIMESTAMP,
	TIMEZONE = 2,
	STATE,
	PID,
	EVENT_TYPE,
	HANDLER,
	DETAIL,
	ERROR_DETAIL,
	DELEMITER = " ",
	BUFFER_INDEX = 7
}

export const enum TimstampToken {
	LENGTH = 10
}

export const enum TimezoneToken {
	OLD_DELEMITER = ",",
	NEW_DELEMITER = ".",
	SYNCTIME = 16
}

export const enum ProcessToken {
	DELEMITER = "pid=",
	PID = 1
}

export const enum EventToken {
	DELEMITER = ":",
	EVENT = 1
}

export const enum HandlerToken {
	HANDLER,
	DELEMITER = ":"
}

export interface FSChangeLogStructure {
	timestamp: string,
	level: string,
	eventType: string,
	eventResult: string,
	action: string,
	folder: string,
	file: string
}

export const enum FSChangeLogToken {
	EVENT_RESULT_MAIN = 1,
	EVENT_RESULT_SUB,
	EVENT_TYPE,
	ACTION_TYPE,
	SIGNATURE = "FSChange",
	DELEMITER = " ",
	GENERATE_HANDLER = "workers.py"
}

export const enum FSEventToken {
	DELEMITER = "FSChange(",
	SUB_DELEMITER = ",",
	EVENT = 1,
	REMOVE_TOKEN = ""
}

export const enum FSActionToken {
	EVENT,
	DELEMITER = ",",
	EXCEPT = "Action.MODIFY"
}

export const enum FSFileToken {
	SUB_EVENT,
	EVENT,
	DELEMITER = "name=u'",
	SUB_DELEMITER = "\',",
	ISFOLDER = "is_folder=True"
}

export const enum FSFolderToken {
	SUB_EVENT,
	EVENT,
	DELEMITER = "path=u'",
	SUB_DELEMITER = "\'"
}

export const enum CloudEntryToken {
	SUB_EVENT,
	EVENT,
	DELEMITER = ",",
	SUB_DELEMITER = "",
	SIGNATURE = "CloudEntry(",
	IMMUTABLE_SIGNATURE = "ImmutableCloudEntry",
	MAPPATH_DELEMITER = "mapped_path=MappedCloudPath(mapped=",
	FILE_DELEMITER = "filename=",
	ISFOLDER_DELEMITER = "doc_type=",
	DOCTYPE = "DocType.FOLDER"
}

export interface QueryStructure {
	data_value: string
}
