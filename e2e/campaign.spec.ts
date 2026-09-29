import { expect, test as base, type Page } from '@playwright/test'

/** 每个用例结束时断言：页面没有未捕获异常，也没有 console.error */
const test = base.extend<{ errors: string[] }>({
  errors: async ({ page }, use) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(`pageerror: ${e}`))
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`console.error: ${m.text()}`)
    })
    await use(errors)
    expect(errors).toEqual([])
  },
})

const CAMPAIGN = '/#/c/sidu-chishui-1935'
const readout = (page: Page) => page.locator('.scrub-readout strong')

async function openCampaign(page: Page, t: string) {
  await page.goto(`${CAMPAIGN}?t=${t}`)
  await expect(page.locator('.unit-marker:visible').first()).toBeVisible()
}

test('首页列出战役，点击进入地图页', async ({ page, errors }) => {
  void errors
  await page.goto('/')
  await page.getByRole('link', { name: /四渡赤水/ }).click()
  await expect(page).toHaveURL(/#\/c\/sidu-chishui-1935/)
  await expect(page.locator('.map canvas')).toBeVisible()
})

test('地图容器有实际尺寸；敌军只在有记载的日子出现', async ({ page, errors }) => {
  void errors
  await openCampaign(page, '1935-02-25T12:00')
  const box = await page.locator('.map canvas').boundingBox()
  expect(box!.height).toBeGreaterThan(300)
  expect(box!.width).toBeGreaterThan(300)
  await expect(page.locator('[data-unit="gz-du-zhaohua"]')).toBeVisible() // 2/25 娄山关
  await expect(page.locator('[data-unit="cn-wu-qiwei"]')).toBeHidden() // 2/28 才出现
})

test('事件圆点与同一地点的部队标记彼此靠近（防止定位样式被覆盖）', async ({ page, errors }) => {
  void errors
  await openCampaign(page, '1935-02-25T12:00')
  const unit = await page.locator('[data-unit="gz-du-zhaohua"]').boundingBox()
  const event = await page.locator('.event-marker[aria-label="娄山关战斗"]').boundingBox()
  expect(unit && event).toBeTruthy()
  const dist = Math.hypot(unit!.x - event!.x, unit!.y - event!.y)
  expect(dist).toBeLessThan(80)
})

test('章节跳转、播放推进、暂停', async ({ page, errors }) => {
  void errors
  await openCampaign(page, '1935-01-20T00:00')
  await page.getByRole('button', { name: /娄山关与遵义大捷/ }).click()
  await expect(readout(page)).toHaveText('1935年2月24日')

  const before = await readout(page).innerText()
  await page.getByRole('button', { name: '播放' }).click()
  await expect(readout(page)).not.toHaveText(before)
  await page.getByRole('button', { name: '暂停' }).click()
  const paused = await readout(page).innerText()
  await page.waitForTimeout(500)
  await expect(readout(page)).toHaveText(paused)
})

test('带 t 的链接落在对应时刻，暂停后地址栏同步', async ({ page, errors }) => {
  void errors
  await openCampaign(page, '1935-03-16T12:00')
  await expect(readout(page)).toHaveText('1935年3月16日')
  await page.getByRole('button', { name: '前进一天' }).click()
  await expect(readout(page)).toHaveText('1935年3月17日')
  await expect(page).toHaveURL(/t=1935-03-17T12:00/)
})

test('点击部队显示详情，坐标来源默认折叠；可关闭', async ({ page, errors }) => {
  void errors
  await openCampaign(page, '1935-02-25T12:00')
  await page.locator('[data-unit="gz-du-zhaohua"]').click()
  const detail = page.getByRole('complementary', { name: '详情' })
  await expect(detail).toContainText('黔军杜肇华第1旅')
  await expect(detail.locator('details.geo-sources')).not.toHaveAttribute('open', '')
  await detail.getByRole('button', { name: '关闭详情' }).click()
  await expect(detail).toBeHidden()
})

test('选中部队时高亮其完整路线，取消选中后消失', async ({ page, errors }) => {
  void errors
  await openCampaign(page, '1935-02-25T12:00')
  const map = page.locator('.map')
  await expect(map).toHaveAttribute('data-selected-route-segments', '0')
  await page.locator('.unit-marker[data-unit="red-3rd-corps"]').click({ force: true })
  await expect
    .poll(async () => Number(await map.getAttribute('data-selected-route-segments')))
    .toBeGreaterThan(3)
  await page.getByRole('button', { name: '关闭详情' }).click()
  await page.locator('.map canvas').click({ position: { x: 60, y: 60 } })
  await expect(map).toHaveAttribute('data-selected-route-segments', '0')
})

test('取消勾选阵营后该阵营的部队隐藏', async ({ page, errors }) => {
  void errors
  await openCampaign(page, '1935-02-25T12:00')
  await page.getByRole('checkbox', { name: '黔军' }).uncheck()
  await expect(page.locator('[data-unit="gz-du-zhaohua"]')).toBeHidden()
})

test('事件列表：点击跳到事件时刻并打开详情，当前事件高亮', async ({ page, errors }) => {
  void errors
  await openCampaign(page, '1935-01-20T00:00')
  await page.getByText(/^事件（/).click()
  await page.locator('.event-list button', { hasText: '娄山关战斗' }).click()
  await expect(readout(page)).toHaveText('1935年2月25日')
  await expect(page.getByRole('complementary', { name: '详情' })).toContainText('娄山关战斗')
  await expect(page.locator('.event-list button[aria-current="true"]')).toContainText('娄山关战斗')
})

test('分享链接：视野与选中项从 URL 还原，平移后地址栏同步', async ({ page, errors }) => {
  void errors
  await page.goto(`${CAMPAIGN}?t=1935-02-25T12:00&c=106.85,28.03&z=10&s=unit:gz-du-zhaohua`)
  await expect(page.getByRole('complementary', { name: '详情' })).toContainText('黔军杜肇华第1旅')
  await expect(page).toHaveURL(/c=106\.85,28\.03&z=10&s=unit:gz-du-zhaohua/)

  const before = page.url()
  const box = (await page.locator('.map canvas').boundingBox())!
  await page.mouse.move(box.x + 120, box.y + 120)
  await page.mouse.down()
  await page.mouse.move(box.x + 300, box.y + 260, { steps: 8 })
  await page.mouse.up()
  await expect.poll(() => page.url()).not.toBe(before)
  expect(page.url()).toContain('s=unit:gz-du-zhaohua') // 平移不影响选中项
})

test('无效的分享参数被忽略，页面照常打开', async ({ page, errors }) => {
  void errors
  await page.goto(`${CAMPAIGN}?t=1935-02-25T12:00&c=999,999&z=abc&s=unit:不存在的部队`)
  await expect(page.locator('.unit-marker:visible').first()).toBeVisible()
  await expect(page.getByRole('complementary', { name: '详情' })).toBeHidden()
})

test.describe('复制链接', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

  test('复制的链接包含时刻、视野和选中项', async ({ page, errors }) => {
    void errors
    await openCampaign(page, '1935-03-16T12:00')
    await page.locator('.unit-marker:visible').first().click()
    await page.getByRole('button', { name: '复制当前视图的链接' }).click()
    await expect(page.getByRole('status')).toContainText('已复制链接')
    const link = await page.evaluate(() => navigator.clipboard.readText())
    expect(link).toMatch(
      /#\/c\/sidu-chishui-1935\?t=1935-03-16T12:00&c=[\d.]+,[\d.]+&z=[\d.]+&s=unit:[a-z0-9-]+$/,
    )
  })
})

test.describe('手机窄屏', () => {
  test.use({ viewport: { width: 390, height: 800 } })

  test('地图有尺寸、无横向溢出，菜单可打开并跳转章节', async ({ page, errors }) => {
    void errors
    await page.goto(`${CAMPAIGN}?t=1935-03-16T12:00`)
    await expect(page.locator('.map canvas')).toBeVisible()
    const box = await page.locator('.map canvas').boundingBox()
    expect(box!.height).toBeGreaterThan(300)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)

    await page.getByRole('button', { name: '章节与图层' }).click()
    await page.getByRole('button', { name: /南渡乌江/ }).click()
    await expect(readout(page)).toHaveText('1935年3月25日')
  })

  test('抽屉菜单可以关闭：× 按钮、点遮罩、Esc 键', async ({ page, errors }) => {
    void errors
    await page.goto(`${CAMPAIGN}?t=1935-03-16T12:00`)
    const nav = page.getByRole('navigation', { name: '战役导航' })
    await expect(nav).toBeHidden() // 默认收起，且不在 Tab 顺序里

    const open = () => page.getByRole('button', { name: '章节与图层' }).click()
    await open()
    await expect(nav).toBeVisible()
    await nav.getByRole('button', { name: '关闭菜单' }).click()
    await expect(nav).toBeHidden()

    await open()
    await expect(nav).toBeVisible()
    await page.locator('.backdrop').click({ position: { x: 375, y: 400 } })
    await expect(nav).toBeHidden()

    await open()
    await expect(nav).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(nav).toBeHidden()
  })
})
