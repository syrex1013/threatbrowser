class Logger {
  info(message: string) {
    if (window && window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.send('log-info', message)
    } else {
      console.info(message)
    }
  }

  debug(message: string) {
    if (window && window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.send('log-debug', message)
    } else {
      console.debug(message)
    }
  }

  error(message: string) {
    if (window && window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.send('log-error', message)
    } else {
      console.error(message)
    }
  }
}

const logger = new Logger()

export default logger
