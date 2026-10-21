import { expect, type Page, test } from '@playwright/test'

async function signInAs(page: Page, label: RegExp) {
  await page.goto('./')
  await page.getByRole('button', { name: label }).click()
  await expect(page.getByRole('heading', { name: /Good to see you/ })).toBeVisible()
}

const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name, exact: true })

async function switchTo(page: Page, role: string) {
  await page.getByRole('button', { name: role, exact: true }).click()
  await expect(page.getByRole('heading', { name: /Good to see you/ })).toBeVisible()
}

/** Drags across the room calendar from h1 to h2 (24h) on the given weekday column of next week. */
async function dragSlot(page: Page, weekday: number, h1: number, h2: number) {
  await page.getByRole('button', { name: 'Next week' }).click()
  const row = (h: number) => page.locator(`td.fc-timegrid-slot-lane[data-time="${String(h).padStart(2, '0')}:00:00"]`)
  await row(h2).scrollIntoViewIfNeeded()
  const colBox = (await page.locator('.fc-timegrid-col[data-date]').nth(weekday).boundingBox())!
  const y1 = (await row(h1).boundingBox())!.y + 2
  const y2 = (await row(h2).boundingBox())!.y - 4
  const x = colBox.x + colBox.width / 2
  await page.mouse.move(x, y1)
  await page.mouse.down()
  await page.mouse.move(x, y2, { steps: 8 })
  await page.mouse.up()
}

test.beforeEach(async ({ page }) => {
  await page.goto('./')
  await page.evaluate(() => localStorage.clear())
})

test('a resident books a room by dragging on the calendar, then cancels', async ({ page }) => {
  await signInAs(page, /Ana Souza/)
  await nav(page, 'Book a room').click()
  await page.getByRole('tab', { name: /Media room/ }).click()
  await dragSlot(page, 3, 18, 20) // Wednesday next week, 6–8 pm

  const dialog = page.getByRole('dialog', { name: 'Book the Media room' })
  await expect(dialog).toContainText('6:00 PM – 8:00 PM')
  await dialog.getByLabel(/What’s it for/).fill('Game night')
  await dialog.getByRole('button', { name: 'Confirm booking' }).click()
  await expect(dialog).toBeHidden()

  const mine = page.locator('section', { hasText: 'My upcoming bookings' })
  await expect(mine).toContainText('Media room')
  await expect(mine).toContainText('Game night')
  await expect(page.locator('.fc-event', { hasText: 'Yours · Game night' })).toBeVisible()

  await mine.locator('li', { hasText: 'Game night' }).getByRole('button', { name: 'Cancel booking' }).click()
  await expect(mine).not.toContainText('Game night')
})

test('the manager sends an alert that every resident sees; the board cannot', async ({ page }) => {
  await signInAs(page, /Tom Okafor/)
  await page.getByRole('button', { name: '+ Post a notice' }).click()
  await expect(page.getByLabel('Type').locator('option')).not.toContainText(['Alert'])
  await page.getByRole('button', { name: 'Close' }).click()

  await switchTo(page, 'Building manager')
  await page.getByRole('button', { name: '+ Post a notice' }).click()
  await page.getByLabel('Type').selectOption('alert')
  await page.getByLabel('Title').fill('Elevator B is stuck, use the stairs')
  await page.getByLabel('Message').fill('The technician is on the way.')
  await page.getByRole('button', { name: 'Post', exact: true }).click()

  await switchTo(page, 'Resident, 4C')
  await expect(page.getByRole('alert').filter({ hasText: 'Elevator B is stuck' })).toBeVisible()
})

test('a moderator hides a post and residents no longer see it', async ({ page }) => {
  await signInAs(page, /Mei Lin/)
  await nav(page, 'Board').click()
  await page.getByRole('link', { name: 'Free couch, you haul' }).click()
  await page.getByRole('button', { name: 'Hide post' }).click()
  await page.getByLabel('Reason').fill('Duplicate of a listing in the lobby')
  await page.getByRole('dialog').getByRole('button', { name: 'Hide post' }).click()
  await expect(page.getByText(/Hidden from residents: Duplicate/)).toBeVisible()

  await switchTo(page, 'Resident, 4C')
  await nav(page, 'Board').click()
  await expect(page.getByRole('link', { name: 'Light out on garage level P2' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Free couch, you haul' })).toHaveCount(0)
})

test('liking a post is a toggle, and replies show up in the thread', async ({ page }) => {
  await signInAs(page, /Ana Souza/)
  await nav(page, 'Board').click()
  await page.getByRole('link', { name: 'Found: kid’s blue bike helmet' }).click()
  const like = page.getByRole('button', { name: /♥/ })
  await expect(like).toHaveText('♥ 0')
  await like.click()
  await expect(like).toHaveText('♥ 1')
  await like.click()
  await expect(like).toHaveText('♥ 0')
  await page.getByLabel('Reply').fill('Thanks Chloe, I’ll let 2C know.')
  await page.getByRole('button', { name: 'Reply', exact: true }).click()
  await expect(page.getByText('I’ll let 2C know.')).toBeVisible()
  await expect(page.getByRole('heading', { name: '2 replies' })).toBeVisible()
})
