const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔄 البدء في إعادة تهيئة قاعدة البيانات المحلية...');
console.log('⚠️ تأكد من إيقاف خادم التطبيق (Wrangler/Vite) أولاً لتجنب قفل الملفات.');

const d1Dir = path.join(__dirname, '..', '.wrangler', 'state', 'v3', 'd1');

// 1. Delete wrangler local D1 database safely
if (fs.existsSync(d1Dir)) {
  try {
    fs.rmSync(d1Dir, { recursive: true, force: true });
    console.log('✅ تم مسح قاعدة البيانات القديمة بنجاح.');
  } catch (err) {
    console.warn('⚠️ تنبيه: لم يتم مسح مجلد قاعدة البيانات بالكامل (قد يكون الملف مفتوحاً في خادم آخر)، سنحاول تطبيق التحديثات مباشرة.');
  }
}

// 2. Run migrations
try {
  console.log('⏳ جاري تطبيق ملفات الـ Migrations (0001, 0002, 0003)...');
  // Removed --batch because it is not a valid wrangler argument
  // Spawning node process automatically disables interactive TTY prompt for wrangler in most environments
  execSync('npx wrangler d1 migrations apply saas-platform-db --local', { stdio: 'inherit' });
  console.log('✅ تم تطبيق جميع ملفات الـ Migrations بنجاح.');
} catch (err) {
  console.error('❌ فشل تطبيق الـ Migrations:', err.message);
  process.exit(1);
}

// 3. Run seed data
try {
  console.log('⏳ جاري إدخال بيانات التجربة (Seed Data)...');
  execSync('npx wrangler d1 execute saas-platform-db --local --file=./seed.sql', { stdio: 'inherit' });
  console.log('✅ تم إدخال بيانات التجربة بنجاح.');
} catch (err) {
  console.error('❌ فشل إدخال بيانات التجربة:', err.message);
  process.exit(1);
}

console.log('🎉 تم إعادة تهيئة قاعدة البيانات بالكامل وتجهيزها بنجاح!');
