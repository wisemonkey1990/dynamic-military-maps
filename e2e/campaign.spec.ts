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

test('取消勾选阵营后该阵营的部队隐藏', async ({ page, errors }) => {
  void errors
  await openCampaign(page, '1935-02-25T12:00')
  await page.getByRole('checkbox', { name: '黔军' }).uncheck()
  await expect(page.locator('[data-unit="gz-du-zhaohua"]')).toBeHidden()
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
