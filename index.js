import RNFS from "react-native-fs";
import SourceMap from "source-map";
import StackTrace from "stacktrace-js";

let sourceMapper = undefined;
let options = undefined;

/**
 * Init Source mapper with options
 * Required:
 * @param {String} [opts.sourceMapBundle] - source map bundle, for example "main.jsbundle.map"
 * Optional:
 * @param {String} [opts.projectPath] - project path to remove from files path
 * @param {Boolean} [opts.collapseInLine] — Will collapse all stack trace in one line, otherwise return lines array
 */
export const initSourceMaps = async opts => {
	if (!opts || !opts.sourceMapBundle) {
		throw new Error('Please specify sourceMapBundle option parameter');
	}
	options = opts;
};

export const getStackTrace = async error => {
	if (!options) {
		throw new Error('Please firstly call initSourceMaps with options');
	}
	if (!sourceMapper) {
		sourceMapper = await createSourceMapper();
	}
	try {
		const minStackTrace = await StackTrace.fromError(error);
		const stackTrace = minStackTrace.map(row => {
			const mapped = sourceMapper(row);
			const source = mapped.source || "";
			const fileName = options.projectPath ? source.split(options.projectPath).pop() : source;
			const functionName = mapped.name || "unknown";
			return {
				fileName,
				functionName,
				lineNumber: mapped.line,
				columnNumber: mapped.column,
				position: `${functionName}@${fileName}:${mapped.line}:${mapped.column}`
			};
		});
		return options.collapseInLine ? stackTrace.map(i => i.position).join('\n') : stackTrace;
	}
	catch (error) {
		throw error;
	}
};

const createSourceMapper = async () => {
	const path = `${RNFS.MainBundlePath}/${options.sourceMapBundle}`;
	try {
		const fileExists = await RNFS.exists(path);
		if (!fileExists) {
			throw new Error(__DEV__ ?
				'Unable to read source maps in DEV mode' :
				`Unable to read source maps, possibly invalid sourceMapBundle file, please check that it exists here: ${RNFS.MainBundlePath}/${options.sourceMapBundle}`
			);
		}

		const mapContents = await RNFS.readFile(path, 'utf8');
		const sourceMaps = JSON.parse(mapContents);
		const mapConsumer = new SourceMap.SourceMapConsumer(sourceMaps);

		return sourceMapper = row => {
			return mapConsumer.originalPositionFor({
				line: row.lineNumber,
				column: row.columnNumber,
			});
		};
	}
	catch (error) {
		throw error;
	}
};