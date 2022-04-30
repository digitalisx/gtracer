import { ExportHandler } from "./src/export"
import { LogParser } from "./src/parser"

async function run() {
	const logParser = new LogParser()
	const stream = await logParser.createLogStream("./res/sync_log.log")
	const logs = await logParser.processLog(stream)

	const exportHandler = new ExportHandler()
	const xlsx = await exportHandler.createXLSX()
	await exportHandler.pushDataToXLSX(xlsx, logs)
}

run()
