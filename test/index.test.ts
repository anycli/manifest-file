import {describe, expect, it} from '@dxcli/dev-test'
import * as fs from 'fs-extra'
import * as path from 'path'

import File from '../src'

class ManifestFile extends File {
  async getAFoo() {
    return this.get('foo')
  }

  async setAFoo(n: number) {
    return this.set(['foo', n])
  }
}

const file = path.join(__dirname, '../tmp/manifest.json')
beforeEach(async () => {
  await fs.remove(file)
})

describe('manifest', () => {
  it('reads and saves', async () => {
    let a = new ManifestFile('manifestfile', file)
    await a.setAFoo(101)
    let b = new ManifestFile('manifestfile', file)
    await expect(b.getAFoo()).to.eventually.equal(101)
  })
})
