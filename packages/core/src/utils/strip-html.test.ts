import { describe, expect, it } from 'vitest'
import { stripHtml } from './strip-html'

describe('stripHtml', () => {
  it('剥除简单标签', () => {
    expect(stripHtml('<p>hello</p>')).toBe('hello')
  })

  it('<br> 转换为换行', () => {
    expect(stripHtml('a<br>b<br/>c')).toBe('a\nb\nc')
  })

  it('段落分隔保留为换行', () => {
    // 段落之间保留为换行（\n 形式，与原 detail 页行为一致）
    expect(stripHtml('<p>段1</p><p>段2</p>')).toBe('段1\n段2')
  })

  it('段落间多余空行压缩为单换行', () => {
    // </p>\s*<p 一次性吃掉中间所有空白 → 单 \n
    expect(stripHtml('<p>a</p>\n\n\n\n<p>b</p>')).toBe('a\nb')
  })

  it('解码常见 HTML 实体', () => {
    // &nbsp; 替换为普通空格，与相邻空格合并为单空格
    expect(stripHtml('a&amp;b &lt;c&gt;d &quot;e&quot; &#39;f&#39; &nbsp;g')).toBe(
      'a&b <c>d "e" \'f\' g',
    )
  })

  it('压缩多余空格', () => {
    expect(stripHtml('a   b   c')).toBe('a b c')
  })

  it('trim 首尾空白', () => {
    expect(stripHtml('  <p>hello</p>  ')).toBe('hello')
  })

  it('混合嵌套标签', () => {
    expect(stripHtml('<div class="x"><span>a</span><b>b</b></div>')).toBe('ab')
  })

  it('空字符串返回空字符串', () => {
    expect(stripHtml('')).toBe('')
  })

  it('无标签文本原样返回（仅 trim）', () => {
    expect(stripHtml('  plain text  ')).toBe('plain text')
  })
})
