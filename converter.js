const fs = require('fs');
const path = require('path');

// --- ファイルパスの定義 ---
const projectRoot = __dirname;
const csvFilePath = path.join(projectRoot, 'オロチポートフォリオ文字データ', 'オロチポートフォリオ表.csv');
const jsonFilePath = path.join(projectRoot, 'オロチポートフォリオ文字データ', 'works.json');

// --- メイン処理 ---
try {
  const csvData = fs.readFileSync(csvFilePath, 'utf8');
  // WindowsとMacの改行コードの違いに対応
  const lines = csvData.trim().replace(/\r/g, "").split('\n');
  const header = lines.shift(); // ヘッダー行を読み飛ばす

  const works = lines.map((line, index) => {
    // データが不完全な行は早期に除外
    if (!line.trim()) {
      return null;
    }

    const columns = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"' && (i === 0 || line[i - 1] === ',')) {
            inQuotes = true;
            continue;
        }

        if (char === '"' && (i === line.length - 1 || line[i + 1] === ',')) {
            inQuotes = false;
            continue;
        }

        if (char === ',' && !inQuotes) {
            columns.push(currentField);
            currentField = '';
        } else {
            currentField += char;
        }
    }
    columns.push(currentField);
    
    // データ構造の検証
    if (columns.length < 4 || !/^\d{8}$/.test(columns[0])) {
      console.warn(`[警告] ${index + 2}行目のデータ形式が不正です。スキップします: ${line}`);
      return null;
    }
    
    const dateStr = columns[0];
    return {
      id: index + 1,
      date: dateStr,
      month: parseInt(dateStr.substring(4, 6), 10),
      title: columns[1] || '',
      category: columns[2] || '',
      description: columns[3] || '',
      image_filename: `img_${dateStr}.png`
    };
  }).filter(work => work !== null); // null（無効なデータ）を除外する

  fs.writeFileSync(jsonFilePath, JSON.stringify(works, null, 2), 'utf8');
  console.log(`✅ Success: ${jsonFilePath} が正常に更新されました。`);

} catch (error) {
  console.error(`❌ Error: 処理に失敗しました。`, error);
}