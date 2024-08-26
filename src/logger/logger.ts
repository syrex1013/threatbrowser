import { createLogger, format, transports } from 'winston'
import { app } from 'electron'
import path from 'path'

const logDir = app.getPath('userData')
const logFile = path.join(logDir, 'app.log')

const logger = createLogger({
  level: 'info',
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
