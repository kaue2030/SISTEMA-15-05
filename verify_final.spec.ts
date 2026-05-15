import { test, expect } from '@playwright/test';

test('Verify Yeti ERP functionality', async ({ page }) => {
    await page.goto('http://localhost:8080/index.html');

    // Login
    await page.fill('#username', 'KAUE');
    await page.fill('#password', '1234');
    await page.click('#btnLogin');

    // Check navigation to 3D Calc
    await page.click('text=ventas');
    await page.click('text=Calculadora 3D');
    await expect(page.locator('h1')).toContainText('Calculadora 3D');

    // Verify 3D Calc Calculation
    await page.fill('#c3d-grams', '200');
    const costText = await page.locator('#c3d-res-cost').innerText();
    expect(costText).not.toBe('0');

    // Check navigation to Manual
    await page.click('text=Ayuda');
    await page.click('text=Documentación');
    await expect(page.locator('h1')).toContainText('Manual de Uso');

    await page.screenshot({ path: 'final_verification.png', fullPage: true });
});
