import {test,expect} from '@playwright/test';
test('configuration menus use styled options and update native form values',async({page},testInfo)=>{
  await page.goto('/');
  const mode=page.getByRole('combobox',{name:'SDK mode',exact:true});
  await mode.click();await expect(page.getByRole('listbox',{name:'SDK mode options'})).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('dropdown-desktop.png')});
  await page.getByRole('option',{name:'Analytics only',exact:true}).click();
  await expect(page.locator('select[name=mode]')).toHaveValue('analytics');await expect(mode).toContainText('Analytics only');
  await expect(page.locator('#mode-note')).toContainText('Analytics SDK only');await expect(mode).toBeFocused();
  await expect(page.getByRole('listbox')).toHaveCount(0);
  const zone=page.getByRole('combobox',{name:'Data region',exact:true});await zone.focus();await zone.press('u');await zone.press('s');await zone.press('Enter');await expect(page.locator('select[name=zone]')).toHaveValue('US');
});
test('keyboard navigation supports cancel, commit, dismissal and form submission',async({page})=>{
  await page.goto('/');const mode=page.getByRole('combobox',{name:'SDK mode',exact:true});
  await mode.focus();await mode.press('ArrowDown');await mode.press('Escape');await expect(page.locator('select[name=mode]')).toHaveValue('none');await expect(mode).toBeFocused();
  await mode.press('End');await mode.press('Enter');await expect(page.locator('select[name=mode]')).toHaveValue('paired');
  await mode.press('Home');await mode.press('Enter');await expect(page.locator('select[name=mode]')).toHaveValue('none');
  await mode.click();await page.getByRole('heading',{name:'Choose your workload'}).click();await expect(page.getByRole('listbox')).toHaveCount(0);
  await mode.click();await mode.press('Tab');await expect(page.getByRole('listbox')).toHaveCount(0);
  await page.locator('[name=seconds]').fill('1');const [popup]=await Promise.all([page.waitForEvent('popup'),page.getByRole('button',{name:'Open measured page'}).click()]);await popup.waitForFunction(()=>window.bench?.ready);expect(await popup.evaluate(()=>window.bench.config.mode)).toBe('none');
});
test('disabled dynamic selectors and mobile option menus fit the viewport',async({page},testInfo)=>{
  await page.goto('/');await page.locator('[data-tab=visualization]').click();await expect(page.getByRole('combobox',{name:'Available result',exact:true})).toBeDisabled();
  await page.locator('[data-tab=workloads]').click();await page.setViewportSize({width:390,height:844});
  const mode=page.getByRole('combobox',{name:'SDK mode',exact:true});await mode.click();await expect(page.getByRole('listbox')).toBeVisible();
  const rect=await page.getByRole('listbox').boundingBox();expect(rect.x).toBeGreaterThanOrEqual(0);expect(rect.x+rect.width).toBeLessThanOrEqual(390);expect(rect.y).toBeGreaterThanOrEqual(0);expect(rect.y+rect.height).toBeLessThanOrEqual(844);
  await page.screenshot({path:testInfo.outputPath('dropdown-mobile.png')});
  await page.getByRole('option',{name:'Session Replay · standalone',exact:true}).click();await expect(mode).toContainText('Session Replay · standalone');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
