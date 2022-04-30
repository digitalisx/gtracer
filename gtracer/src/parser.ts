import fs from "fs"
import _ from "lodash"
import readline from "readline"
import {
	CloudEntryToken,
	CommonToken,
	DirectoryStructure,
	EventToken, FSActionToken,
	FSChangeLogStructure, FSChangeLogToken, FSEventToken, FSFileToken, FSFolderToken,
	HandlerToken, LogStructure, LogToken, ProcessToken, TimezoneToken, TimstampToken
} from "./model"

export class LogParser {

	async createLogStream(path: string): Promise<AsyncIterableIterator<string>> {
		if (!fs.existsSync(path)) throw Error("Not Found Log File on Path")
		const fileStream = fs.createReadStream(path)
		const readLineStream = readline.createInterface({
			input: fileStream,
			crlfDelay: Infinity
		})
		return await this.getLogStream(readLineStream)
	}

	async processLog(logIterator: AsyncIterableIterator<string>)
		: Promise<FSChangeLogStructure[][]> {
		const resultArray: FSChangeLogStructure[][] = []
		while (true) {
			const data = await logIterator.next()
			const EOF = data.done
			if (EOF) { break }
			const logLine = data.value as string
			const parseResult = await this.parseLog(logLine)
			if (!parseResult) { continue }
			const parsedLog = parseResult as FSChangeLogStructure[]
			resultArray.push(parsedLog)
		}
		return resultArray
	}

	private async getLogStream(readStream: readline.Interface):
		Promise<AsyncIterableIterator<string>> {
		if (!readStream) throw Error("Failed to get Log Iterator")
		return readStream[Symbol.asyncIterator]()
	}

	private async parseLog(logLine: string): Promise<FSChangeLogStructure[] | boolean> {
		if (!await this.checkParentsLog(logLine)) { return false }
		const compressedLog = await this.compressLog(logLine)
		const logToken = await this.createLogToken(compressedLog)
		if (!await this.checkHandler(logToken.handler)) { return false }
		if (!await this.checkFSChangeLog(logToken.detail)) { return false }
		const data = await this.createFSChangeToken(
			logToken.timestamp.toString(),
			logToken.level,
			logToken.detail)
		return data
	}

	private async checkParentsLog(logLine: string): Promise<boolean> {
		const logHeader = logLine.split(LogToken.DELEMITER)[LogToken.TIMESTAMP]
		const timestamp = new Date(logHeader)
		return timestamp instanceof Date && !isNaN(timestamp.getTime()) &&
			(logHeader.length === TimstampToken.LENGTH)
	}

	private async compressLog(logLine: string): Promise<string> {
		return logLine.replace(/\s+/g, LogToken.DELEMITER)
	}

	private async createLogToken(logLine: string): Promise<LogStructure> {
		const tokens = logLine.split(LogToken.DELEMITER)
		const level = tokens[LogToken.STATE]
		if (level === "ERROR") { tokens.splice(LogToken.BUFFER_INDEX, 1) }
		const eventTime = tokens.slice(LogToken.TIMESTAMP, LogToken.TIMEZONE)
			.join(LogToken.DELEMITER)
		const tokenObject = {
			timestamp: await this.setTimezone(eventTime),
			level,
			pid: await this.parsePIDToken(tokens[LogToken.PID]),
			eventType: await this.parseEventToken(tokens[LogToken.EVENT_TYPE]),
			handler: await this.parseHandlerToken(tokens[LogToken.HANDLER]),
			detail: tokens.slice(LogToken.DETAIL).join(LogToken.DELEMITER)
		}
		return tokenObject
	}

	private async checkHandler(handlerName: string): Promise<boolean> {
		return handlerName === FSChangeLogToken.GENERATE_HANDLER ? true : false
	}

	private async createFSChangeToken(timestamp: string, level: string, changeLog: string)
		: Promise<FSChangeLogStructure[]> {
		const parsedLogs: FSChangeLogStructure[] = []
		const tokens = changeLog.split(FSChangeLogToken.DELEMITER)
		const directory = await this.parseDirectory(changeLog)
		for (const token of directory) {
			const log = {
				timestamp,
				level,
				eventResult: tokens[FSChangeLogToken.EVENT_RESULT_MAIN],
				eventType: await this.parseFSEventToken(tokens[FSChangeLogToken.EVENT_TYPE]),
				action: await this.parseFSActionToken(tokens[FSChangeLogToken.ACTION_TYPE]),
				folder: await this.replaceDoubleEscape(token.folder),
				file: token.file
			}
			parsedLogs.push(log)
		}
		return parsedLogs
	}

	private async parseFSToken(logLine: string): Promise<DirectoryStructure[]> {
		try {
			const data = logLine.split(FSEventToken.DELEMITER)
			data.shift()
			const finalData = data.map((fsLog) => {
				const file = fsLog.split(FSFileToken.DELEMITER)[FSFileToken.EVENT]
					.split(FSFileToken.SUB_DELEMITER)[FSFileToken.SUB_EVENT]
				const path = fsLog.split(FSFolderToken.DELEMITER)[FSFolderToken.EVENT]
					.split(FSFolderToken.SUB_DELEMITER)[FSFolderToken.SUB_EVENT]
				if (!fsLog.includes(FSFileToken.ISFOLDER)) {
					return { folder: path, file }
				} else {
					return {
						folder: path.concat(CommonToken.DOUBLE_ESCAPE, file),
						file: CommonToken.SPACE
					}
				}
			})
			return finalData as unknown as DirectoryStructure[]
		} catch (error) {
			return await this.parseExceptFSToken(logLine)
		}
	}

	private async parseExceptFSToken(logLine: string): Promise<DirectoryStructure[]> {
		const file = logLine.split(FSFileToken.DELEMITER)[FSFileToken.EVENT]
			.split(FSFileToken.SUB_DELEMITER)[FSFileToken.SUB_EVENT]
		const path = await this.parseCloudEntryMappedPath(logLine)
		if (await this.checkExceptMode(logLine)) {
			const exceptFile = _.last(path.split(CommonToken.DOUBLE_ESCAPE)) as string
			return [{
				folder: path.replace(exceptFile, CommonToken.SPACE),
				file: exceptFile
			}]
		}
		return [{ folder: path, file }]
	}

	private async parseCloudEntryToken(logLine: string): Promise<DirectoryStructure[]> {
		try {
			const tokens = logLine.split(CloudEntryToken.SIGNATURE)
			tokens.shift()
			let folderPath = await this.parseCloudEntryMappedPath(_.last(tokens) as string)
			let filePath = ""
			tokens.map((token) => {
				const fileName = token.split(CloudEntryToken.FILE_DELEMITER)[CloudEntryToken.EVENT]
					.split(CloudEntryToken.DELEMITER)[CloudEntryToken.SUB_EVENT]
				const fileType = token.split(CloudEntryToken.ISFOLDER_DELEMITER)[CloudEntryToken.EVENT]
				if (fileType.includes(CloudEntryToken.DOCTYPE) &&
					!logLine.includes(CloudEntryToken.IMMUTABLE_SIGNATURE)) {
					folderPath = folderPath.concat(CommonToken.DOUBLE_ESCAPE, fileName)
				} else {
					filePath = fileName
				}
			})
			return [{ folder: folderPath, file: filePath }]
		} catch (error) {
			throw Error("Failed to parse CloudEntry Token")
		}
	}

	private async parseDirectory(logLine: string): Promise<DirectoryStructure[]> {
		if (!await this.checkCloudEntryLog(logLine)) {
			return await this.parseFSToken(logLine)
		}
		return await this.parseCloudEntryToken(logLine)

	}

	private async checkFSChangeLog(logLine: string): Promise<boolean> {
		return logLine.includes(FSChangeLogToken.SIGNATURE)
	}

	private async checkCloudEntryLog(logLine: string): Promise<boolean> {
		return logLine.includes(CloudEntryToken.SIGNATURE)
	}

	private async checkExceptMode(logLine: string): Promise<boolean> {
		return logLine.includes(FSActionToken.EXCEPT)
	}

	private async setTimezone(originTime: string): Promise<Date> {
		const parsedTime = new Date(
			originTime.replace(TimezoneToken.OLD_DELEMITER, TimezoneToken.NEW_DELEMITER))
		return new Date(
			parsedTime.setHours(parsedTime.getHours() + TimezoneToken.SYNCTIME))
	}

	private async replaceDoubleEscape(path: string): Promise<string> {
		return path.replace(/(\\)+/g, "\\").replace("\\?\\", "")
	}

	private async parsePIDToken(pidToken: string): Promise<string> {
		return pidToken.split(ProcessToken.DELEMITER)[ProcessToken.PID]
	}

	private async parseEventToken(eventToken: string): Promise<string> {
		return eventToken.split(EventToken.DELEMITER)[EventToken.EVENT]
	}

	private async parseHandlerToken(handlerToken: string): Promise<string> {
		return handlerToken.split(HandlerToken.DELEMITER)[HandlerToken.HANDLER]
	}

	private async parseFSEventToken(eventToken: string): Promise<string> {
		return eventToken.split(FSEventToken.DELEMITER)[FSEventToken.EVENT]
			.replace(FSEventToken.SUB_DELEMITER, FSEventToken.REMOVE_TOKEN)
	}

	private async parseFSActionToken(actionToken: string): Promise<string> {
		return actionToken.split(FSActionToken.DELEMITER)[FSActionToken.EVENT]
	}

	private async parseCloudEntryMappedPath(logLine: string): Promise<string> {
		return logLine.split(CloudEntryToken.MAPPATH_DELEMITER)[CloudEntryToken.EVENT]
			.split(CloudEntryToken.DELEMITER)[CloudEntryToken.SUB_EVENT]
	}
}
