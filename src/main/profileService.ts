import fs from 'fs'
import path from 'path'
import { Profile } from './types'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
puppeteer.use(StealthPlugin())

export async function loadProfiles() {
  console.log('Loading profiles...')
  const profilesDir = path.join(__dirname, 'profiles')
  const profiles: Profile[] = []

  if (fs.existsSync(profilesDir)) {
    const profileDirs = fs.readdirSync(profilesDir)

    profileDirs.forEach((dir) => {
      const profilePath = path.join(profilesDir, dir, 'profile.json')
      if (fs.existsSync(profilePath)) {
        const profile: Profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'))
        profiles.push(profile)
      }
    })
  }
  console.log('Profiles loaded:', profiles)

  return profiles
}

export async function launchProfile(name: string) {
  console.log('Launching profile:', name)
  const profilesDir = path.join(__dirname, 'profiles')
  const profilePath = path.join(profilesDir, name, 'profile.json')

  if (fs.existsSync(profilePath)) {
    const profile: Profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'))
    console.dir('Profile data:', profile)
    console.log('Proxy used:', profile.proxy)

    const browserArgs: string[] = []
    let proxyUsername: string = ''
    let proxyPassword: string = ''

    if (profile.proxy) {
      const proxyUrl = new URL(profile.proxy)
      browserArgs.push(`--proxy-server=${proxyUrl.protocol}//${proxyUrl.hostname}:${proxyUrl.port}`)

      if (proxyUrl.username && proxyUrl.password) {
        proxyUsername = proxyUrl.username
        proxyPassword = proxyUrl.password
      }
    }

    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: browserArgs,
      userDataDir: path.join(profilesDir, name)
    })
    console.log('Arguments:', browserArgs)

    const page = await browser.newPage()

    if (proxyUsername && proxyPassword) {
      await page.authenticate({ username: proxyUsername, password: proxyPassword })
    }

    if (profile.useragent) {
      await page.setUserAgent(profile.useragent)
    }
    await page.goto('https://www.google.com')
    // Handle browser close event
    browser.on('disconnected', () => {
      console.log('Browser closed')
    })
  } else {
    console.error('Profile not found')
  }
}

export async function CreateProfile(profile) {
  console.log('Creating profile')
  const profilesDir = path.join(__dirname, 'profiles')
  console.log('Profile data: ', profile)
  if (!fs.existsSync(profilesDir)) {
    fs.mkdirSync(profilesDir)
  }
  const profileDir = path.join(profilesDir, profile.name)
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir)
  }

  const profilePath = path.join(profileDir, 'profile.json')
  const jsonProfile: Profile = {
    name: profile.name,
    useragent: profile.useragent,
    notes: profile.notes,
    proxy: profile.proxy,
    proxyId: profile.proxyId
  }
  console.log('Profile path:', profilePath)
  fs.writeFileSync(profilePath, JSON.stringify(jsonProfile, null, 2))
}

export async function UpdateProfile(profileData, oldProfileName) {
  console.log('Updating profile:', oldProfileName)
  const profilesDir = path.join(__dirname, 'profiles')
  const oldProfileDir = path.join(profilesDir, oldProfileName)
  const newProfileDir = path.join(profilesDir, profileData.name)
  const profilePath = path.join(newProfileDir, 'profile.json')

  if (oldProfileName !== profileData.name && fs.existsSync(oldProfileDir)) {
    fs.renameSync(oldProfileDir, newProfileDir)
  }

  const jsonProfile: Profile = {
    name: profileData.name,
    useragent: profileData.useragent,
    notes: profileData.notes,
    proxy: profileData.proxy,
    proxyId: profileData.proxyId
  }
  console.log('New profile data:', jsonProfile)
  fs.writeFileSync(profilePath, JSON.stringify(jsonProfile, null, 2))
}

export async function UpdateNote(data) {
  console.log('Updating note:', data)
  const profilesDir = path.join(__dirname, 'profiles')
  const profileDir = path.join(profilesDir, data.name)
  const profilePath = path.join(profileDir, 'profile.json')

  const profile: Profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'))
  profile.notes = data.note

  fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2))
}

export async function DeleteProfile(profileName: string) {
  const profileDir = path.join(__dirname, 'profiles', profileName)

  if (fs.existsSync(profileDir)) {
    fs.rmSync(profileDir, { recursive: true, force: true })
    console.log('Profile deleted:', profileName)
  } else {
    console.error('Profile not found:', profileName)
  }
}
