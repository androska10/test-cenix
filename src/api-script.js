import puppeteer from "puppeteer-core";
import fs from 'fs/promises';

const URL = process.argv[2];
if (!URL) {
    console.error('Укажите URL категории, например:');
    console.error('node api-script.js https://www.my-site.ru');
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
        value: '1',
        domain: '.vprok.ru',
        path: '/',
    });

    try {
        await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (e) {
        console.error('Ошибка загрузки страницы:', e.message);
        await browser.close();
        process.exit(1);
    }
    //Для обхода блокировки ботов
    await page.evaluate(() => window.scrollBy(0, 500));
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    //У сайта нет json с данными вместо этого данные о товарах часто встраиваются в HTML-страницу через #__NEXT_DATA__.
    const hasNextData = await page.$('#__NEXT_DATA__');
        if (!hasNextData) {
            console.error('Тег #__NEXT_DATA__ не найден на странице.');
            return;
        };

        // Извлекаем ВЕСЬ JSON как есть
        const nextData = await page.evaluate(() => {
            const el = document.getElementById('__NEXT_DATA__');
            if (!el) return null;
            try {
                return JSON.parse(el.textContent);
            } catch (e) {
                console.error('Ошибка парсинга JSON:', e.message);
                return null;
            }
        });

        if (!nextData) {
            console.error('Не удалось распарсить данные.');
            return;
        }

        console.log('Данные успешно извлечены!');
        
        const products = nextData?.props?.pageProps?.initialStore?.catalogPage?.products || [];
        
        let output = '';
        for (const p of products) {
            const currentPrice = p.price;
            const oldPrice = p.oldPrice;
            const discount = p.discountPercent;

            output += `Название товара: ${p.name}\n`;
            output += `Ссылка на страницу товара: https://www.vprok.ru${p.url || ''}\n`;
            output += `Рейтинг: ${p.rating ?? '—'}\n`;
            output += `Количество отзывов: ${p.reviews ?? 0}\n`;
            output += `Цена: ${currentPrice ?? '—'}\n`;
            output += `Акционная цена: ${oldPrice ? currentPrice : '—'}\n`;
            output += `Цена до акции: ${oldPrice ?? '—'}\n`;
            output += `Размер скидки: ${discount ? `${discount}%` : '—'}\n`;
            output += '---\n';
        }

        await fs.writeFile('products-api.txt', output, 'utf8');
        console.log(`Очищенные товары сохранены в: products-api.txt`);
       
        browser.close();
})();
