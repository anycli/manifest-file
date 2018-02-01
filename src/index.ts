import * as fs from 'fs-extra'
import * as loadJSON from 'load-json-file'
import * as _ from 'lodash'
import RWLockfile from 'rwlockfile'

const pjson = require('../package.json')

interface Body {
  [k: string]: any
}

export default abstract class ManifestFile {
  protected lock: RWLockfile
  protected debug: any
  protected writeOptions: fs.WriteOptions = {}
  protected skipIfLocked = false

  constructor(public type: string, public file: string) {
    this.debug = require('debug')(this.type)
    this.lock = new RWLockfile(this.file)
  }

  async reset() {
    if (!await this.addLock('write', 'reset')) return
    try {
      this.debug('reset', this.file)
      await fs.remove(this.file)
    } finally {
      await this.lock.remove('write')
    }
  }

  protected async get<T>(key: string): Promise<T | undefined>
  protected async get<T, U>(key: string, secondKey: string): Promise<[T | undefined, U | undefined]>
  protected async get(key: string, secondKey?: string): Promise<any> {
    if (!await this.addLock('read', `get ${key}`)) return
    try {
      this.debug('get', _.compact([key, secondKey]))
      const body = await this.read()
      return secondKey ? [body[key], body[secondKey]] : body[key]
    } finally {
      await this.lock.remove('read')
    }
  }

  protected async set(key: string, value: any): Promise<void>
  protected async set(...pairs: [string, any][]): Promise<void>
  protected async set(...pairs: any[]): Promise<void> {
    const [k, v] = pairs
    if (typeof k === 'string') {
      pairs = [[k, v]]
    }
    if (!await this.addLock('read', `write ${pairs.map(([k]) => k).join(', ')}`)) return
    try {
      const body = await this.read()
      for (let [k, v] of pairs) {
        this.debug('set', k)
        body[k] = v
      }
      await this.write(body)
    } finally {
      await this.lock.remove('write')
    }
  }

  protected async addLock(type: 'write' | 'read', reason: string): Promise<boolean> {
    if (this.skipIfLocked) {
      try {
        await this.lock.tryLock(type, `@anycli/manifest-file: ${reason}\n${this.file}`)
        return true
      } catch (err) {
        if (err.code !== 'ELOCK') throw err
        this.debug(err)
        return false
      }
    } else {
      await this.lock.add(type, {reason: `@anycli/manifest-file: ${reason}\n${this.file}`})
      return true
    }
  }

  private async read(): Promise<Body> {
    const read = async () => {
      try {
        return await loadJSON(this.file)
      } catch (err) {
        if (err.code === 'ENOENT') {
          this.debug('manifest not found', this.file)
        } else {
          await fs.remove(this.file)
          throw err
        }
      }
    }
    const body = (await read()) || {version: pjson.version}
    if (!body.version) return {version: pjson.version}
    return body
  }

  private async write(body: Body): Promise<void> {
    this.debug('write', this.file)
    await fs.outputJSON(this.file, body, this.writeOptions)
  }
}
