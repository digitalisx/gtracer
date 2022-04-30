import _ from "lodash"
import XLSX from "xlsx"
import { FSChangeLogStructure } from "./model"

export class ExportHandler {

	sheetName = "evidence"
	fileName = `${this.sheetName}.xlsx`

	async createXLSX() {
		const xlsx = XLSX.utils.book_new()
		xlsx.SheetNames.push(this.sheetName)
		return xlsx
	}

	async pushDataToXLSX(xlsx: XLSX.WorkBook, data: FSChangeLogStructure[][]) {
		const flattenData = _.flattenDepth(data, 2)
		const sheetData = XLSX.utils.json_to_sheet(flattenData)
		xlsx.Sheets[this.sheetName] = sheetData
		XLSX.writeFile(xlsx, this.fileName)
	}
}
