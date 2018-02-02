import cli from 'cli-ux'
import * as fs from 'fs-extra'
import * as loadJSON from 'load-json-file'
import * as _ from 'lodash'

const pjson = require('../package.json')
const lockfile = require('proper-lockfile')

export interface Body {
  [k: string]: any
}

export default class ManifestFile {
  protected debug: any
  protected writeOptions: fs.WriteOptions = {}
  protected skipIfLocked = false
  private lockCount = 0
  private lockRelease: any

  constructor(public type: string, public file: string) {
    this.debug = require('debug')(this.type)
  }

  async reset() {
    if (!await this.addLock()) return
    try {
      this.debug('reset', this.file)
      await fs.remove(this.file)
    } finally {
      this.removeLock()
    }
  }

  async get<T>(key: string): Promise<T | undefined>
  async get<T, U>(key: string, secondKey: string): Promise<[T | undefined, U | undefined]>
  async get(key: string, secondKey?: string): Promise<any> {
    this.debug('get', _.compact([key, secondKey]))
    const body = (await this.read()) || {}
    return secondKey ? [body[key], body[secondKey]] : body[key]
  }

  async set(key: string, value: any): Promise<boolean>
  async set(...pairs: [string, any][]): Promise<boolean>
  async set(...pairs: any[]): Promise<boolean> {
    const [k, v] = pairs
    if (typeof k === 'string') {
      pairs = [[k, v]]
    }
    let body = await this.read()
    if (body) {
      if (!await this.addLock()) return false
    }
    try {
      body = body || {}
      for (let [k, v] of pairs) {
        this.debug('set', k)
        body[k] = v
      }
      await this.write(body)
      return true
    } finally {
      this.removeLock()
    }
  }

  async addLock(): Promise<boolean> {
    this.debug('addLock lockCount:', this.lockCount)
    if (!this.lockRelease) {
      try {
        this.lockRelease = await lockfile(this.file, {
          retries: this.skipIfLocked ? 0 : 5
        })
      } catch (err) {
        if (this.skipIfLocked && err.code === 'ELOCKED') return false
        cli.warn(err)
      }
    }
    this.lockCount++
    return true
  }

  removeLock() {
    this.debug('removeLock lockCount:', this.lockCount)
    this.lockCount--
    if (this.lockCount < 0) this.lockCount = 0
    if (this.lockCount === 0 && this.lockRelease) {
      this.lockRelease()
      delete this.lockRelease
    }
  }

  protected init(): Body {
    return {version: pjson.version}
  }

  protected async read(): Promise<Body | undefined> {
    try {
      return await loadJSON(this.file)
    } catch (err) {
      if (err.code === 'ENOENT') {
        this.debug('manifest not found', this.file)
      } else {
        await fs.remove(this.file)
        cli.warn(err)
      }
    }
  }

  protected async write(body: Body): Promise<void> {
    this.debug('write', this.file)
    await fs.outputJSON(this.file, body, this.writeOptions)
  }
}
