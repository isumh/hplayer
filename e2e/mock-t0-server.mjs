// 仅本地 E2E mock 使用，禁止用于生产环境
import { createServer } from 'http'

const categoriesXml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="5.1">
  <class>
    <ty id="1">电影</ty>
    <ty id="2">电视剧</ty>
  </class>
</rss>`

function listXml(page) {
  return `<?xml version="1.0" encoding="utf-8"?>
<rss version="5.1">
  <list page="${page}" pagecount="1" recordcount="2">
    <video>
      <id>101</id>
      <name>测试电影</name>
      <pic>https://via.placeholder.com/200x300</pic>
      <type>电影</type>
      <year>2026</year>
      <actor>测试演员</actor>
      <des>这是一个用于 E2E 测试的影片。</des>
      <note>HD</note>
    </video>
    <video>
      <id>102</id>
      <name>测试电视剧</name>
      <pic>https://via.placeholder.com/200x300</pic>
      <type>电视剧</type>
      <year>2026</year>
      <actor>测试演员</actor>
      <des>这是一个用于 E2E 测试的剧集。</des>
      <note>更新至2集</note>
    </video>
  </list>
</rss>`
}

function detailXml(id) {
  return `<?xml version="1.0" encoding="utf-8"?>
<rss version="5.1">
  <list page="1" pagecount="1" recordcount="1">
    <video>
      <id>${id}</id>
      <name>测试影片 ${id}</name>
      <pic>https://via.placeholder.com/200x300</pic>
      <type>电影</type>
      <year>2026</year>
      <actor>测试演员</actor>
      <des>这是一个用于 E2E 测试的影片。</des>
      <note>HD</note>
      <dl>
        <dd flag="测试线路">第1集$https://www.w3schools.com/html/mov_bbb.mp4</dd>
      </dl>
    </video>
  </list>
</rss>`
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost:8787')
  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', '*')

  const ac = url.searchParams.get('ac')
  if (ac === 'list') {
    res.end(categoriesXml)
    return
  }
  if (ac === 'videolist') {
    const ids = url.searchParams.get('ids')
    if (ids) {
      res.end(detailXml(ids))
      return
    }
    const page = url.searchParams.get('pg') ?? '1'
    res.end(listXml(page))
    return
  }
  res.statusCode = 404
  res.end('<?xml version="1.0"?><rss></rss>')
})

const port = process.env.PORT ? Number(process.env.PORT) : 8787
server.listen(port, () => {
  console.log(`Mock T0_XML server listening on http://localhost:${port}`)
})
