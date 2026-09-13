import { createLogger, format, transports } from 'winston'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

const logDir = process.env.THREATBROWSER_DATA_DIR || app.getPath('userData')
fs.mkdirSync(logDir, { recursive: true })
const logFile = path.join(logDir, 'app.log')

const logger = createLogger({
  level: 'debug',
  format: format.combine(
    format.colorize(), // Add colorization to the console output
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf(({ timestamp, level, message }) => `${timestamp} [${level}]: ${message}`)
  ),
  transports: [
    new transports.Console(), // Console transport with colors
    new transports.File({ filename: logFile }) // File transport without colors
  ]
})

export default logger
