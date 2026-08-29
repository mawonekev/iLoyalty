import net from 'node:net'
import { PGlite } from '@electric-sql/pglite'
import { fromNodeSocket } from 'pg-gateway/node'
import path from 'node:path'
import fs from 'node:fs'

const dbDir = path.join(process.cwd(), '.pgdata')
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

const pg = new PGlite(dbDir)

const server = net.createServer(async (socket) => {
  await fromNodeSocket(socket, {
    serverVersion: '16.3',
    auth: {
      method: 'trust',
    },
    async handleQuery(query, params) {
      return pg.query(query, params)
    },
    async handleDescribe(statement, name) {
      // return metadata
      return { fields: [] }
    },
  })
})

const PORT = 5432
server.listen(PORT, '127.0.0.1', () => {
  console.log(`PostgreSQL server listening on 127.0.0.1:${PORT}`)
})
