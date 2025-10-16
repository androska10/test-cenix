import puppeteer from 'puppeteer-core';
import fs from 'fs/promises';

const URL = process.argv[2];
const REGION = process.argv[3];

if (!URL || !REGION) {
  console.error('Usage: node web-script.js <URL> "<регион>"');
  process.exit(1);
}

const regionMap = {
  'Москва и область': '1',
  'Санкт-Петербург и область': '2',
  'Владимирская обл.': '8',
  'Калужская обл.': '12',
  'Рязанская обл.': '26',
  'Тверская обл.': '33',
  'Тульская обл.': '34',
};

const cityId = regionMap[REGION];
if (!cityId) {
  console.error(`Регион "${REGION}" не поддерживается.`);
  process.exit(1);
}

(async () => {
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/google-chrome',
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');
    await page.evaluateOnNewDocument(() => {
        delete navigator.__proto__.webdriver;
    });

    await page.setCookie({
        name: 'region',
        value: cityId,
        domain: '.vprok.ru',
        path: '/',
    });

    await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });

    await new Promise(resolve => setTimeout(resolve, 3000));
    await page.keyboard.press('Escape');
    await new Promise(resolve => setTimeout(resolve, 1000));

    await page.screenshot({ path: 'screenshot.jpg', fullPage: true });

    let price = null, priceOld = null;
    try {
        await page.waitForSelector('[class*="Price_role_discount"]', { timeout: 10000 });
        const current = await page.$eval('[class*="Price_role_discount"]', el => el.textContent);
        const curMatch = current.match(/[\d,]+/);
        if (curMatch) price = parseFloat(curMatch[0].replace(',', '.'));
    } catch (e) {
        console.log('Текущая цена не найдена');
    }

    try {
        const old = await page.$eval('[class*="Price_role_old"]', el => el.textContent);
        const oldMatch = old.match(/[\d,]+/);
        if (oldMatch) priceOld = parseFloat(oldMatch[0].replace(',', '.'));
    } catch (e) {
        console.log('Старая цена не найдена');
    }

 
    let rating = null;
    try {
    const ratingText = await page.$eval('.ActionsRow_stars__EKt42', el => el.textContent.trim());
    const match = ratingText.match(/[\d,]+/);
    if (match) {
        rating = parseFloat(match[0].replace(',', '.'));
    }
    } catch (e) {
    console.log('Рейтинг не найден:', e.message);
    }

    let reviewCount = null;
    try {
    const reviewText = await page.$eval('.ActionsRow_reviews__AfSj_', el => el.textContent.trim());
    const match = reviewText.match(/\d+/);
    if (match) {
        reviewCount = parseInt(match[0], 10);
    }
    } catch (e) {
    console.log('Количество отзывов не найдено:', e.message);
    }

    let output = '';
    if (price !== null) output += `price=${price}\n`;
    if (priceOld !== null) output += `priceOld=${priceOld}\n`;
    if (rating !== null) output += `rating=${rating}\n`;
    if (reviewCount !== null) output += `reviewCount=${reviewCount}\n`;

    await fs.writeFile('product.txt', output.trim());

    console.log('Готово!');
    console.log('Скриншот: screenshot.jpg');
    console.log('Данные: product.txt');

    await browser.close();
})();