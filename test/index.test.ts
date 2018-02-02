import {expect, fancy} from 'fancy-test'
import * as fs from 'fs-extra'
import * as path from 'path'

import File from '../src'

class ManifestFile extends File {
  async getAFoo() {
    return this.get('foo')
  }

  async setAFoo(n: number) {
    return this.set('foo', n)
  }

  async setAFooAWithoutArray(n: number) {
    return this.set('foo', n)
  }
}

let count = 0
const getFile = () => path.join(__dirname, `../tmp/manifest-${count++}.json`)
let file: string
beforeEach(async () => {
  file = getFile()
  await fs.remove(file)
})

describe('manifest', () => {
  it('reads and saves', async () => {
    let a = new ManifestFile('manifestfile', file)
    await a.setAFoo(101)
    let b = new ManifestFile('manifestfile', file)
    expect(await b.getAFoo()).to.equal(101)
  })

  it('can save multiple keys', async () => {
    let a = new File('manifestfile', file)
    let b = new File('manifestfile', file)
    await a.set(['foo', 1], ['bar', 2])
    expect(await b.get('foo')).to.equal(1)
    expect(await b.get('bar')).to.equal(2)
  })

  it('reads and saves without array', async () => {
    let a = new ManifestFile('manifestfile', file)
    await a.setAFooAWithoutArray(101)
    let b = new ManifestFile('manifestfile', file)
    expect(await b.getAFoo()).to.equal(101)
  })

  it('can reset', async () => {
    let a = new ManifestFile('manifestfile', file)
    await a.setAFooAWithoutArray(101)
    let b = new ManifestFile('manifestfile', file)
    expect(await b.getAFoo()).to.equal(101)
    await a.reset()
    expect(await b.getAFoo()).to.equal(undefined)
  })

  fancy
  .stderr()
  .do(async ctx => {
    await fs.outputFile(file, '{')
    let a = new ManifestFile('manifestfile', file)
    await a.set('foo', 101)
    expect(await a.get('foo')).to.equal(101)
    expect(ctx.stderr).to.contain("Warning: Unexpected end of JSON input while parsing near '{' in")
  })
  .it('warns when json is invalid, but deletes old manifest so it can still be used')

  describe('skipIfLocked', () => {
    class SkipFile extends ManifestFile {
      skipIfLocked = true
    }

    it('skips if something else has locked it', async () => {
      let a = new SkipFile('manifestfile', file)
      let b = new SkipFile('manifestfile', file)
      await a.setAFooAWithoutArray(101)
      await a.addLock()
      try {
        await b.setAFooAWithoutArray(102)
        expect(await a.getAFoo()).to.equal(101)
      } finally {
        await a.removeLock()
      }
    })
  })
})
