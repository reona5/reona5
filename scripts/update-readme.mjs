// README の登壇と記事の欄を、最新 5 件で書き換える。GitHub Actions(.github/workflows/update-readme.yml)から毎日動く
//   node scripts/update-readme.mjs
// 登壇: https://reona5.github.io/talks.json(reona5/talks のビルドが出す)のうち、登壇日を過ぎたもの
// 記事: DevelopersIO の著者ページの RSS
// 取得に失敗した欄は書き換えずに残す
import { readFileSync, writeFileSync } from "node:fs";

const LIMIT = 5;
const TALKS_URL = "https://reona5.github.io/talks.json";
const FEED_URL = "https://dev.classmethod.jp/author/shimada-reona/feed/";

// 日付は日本時間で比べる。登壇日の当日から載せる
const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());
const jstDate = (d) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date(d));
const esc = (s) => s.replace(/([[\]])/g, "\\$1");

async function talks() {
  const res = await fetch(TALKS_URL);
  if (!res.ok) throw new Error(`${TALKS_URL}: ${res.status}`);
  const list = await res.json();
  return list
    .filter((t) => t.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, LIMIT)
    .map((t) => `- ${t.date} [${esc(t.title)}](${t.url})${t.event ? `(${t.event})` : ""}`);
}

async function articles() {
  const res = await fetch(FEED_URL);
  if (!res.ok) throw new Error(`${FEED_URL}: ${res.status}`);
  const xml = await res.text();
  const text = (item, tag) => {
    const m = item.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`));
    return m ? m[1].trim() : "";
  };
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
    .map((m) => ({ title: text(m[1], "title"), link: text(m[1], "link"), date: text(m[1], "pubDate") }))
    .filter((a) => a.title && a.link)
    .slice(0, LIMIT)
    .map((a) => `- ${jstDate(a.date)} [${esc(a.title)}](${a.link})`);
}

function replace(readme, name, lines) {
  const re = new RegExp(`(<!-- ${name}:START -->\\n)[\\s\\S]*?(<!-- ${name}:END -->)`);
  if (!re.test(readme)) throw new Error(`README に ${name} の目印がない`);
  return readme.replace(re, `$1${lines.join("\n")}\n$2`);
}

let readme = readFileSync("README.md", "utf8");
for (const [name, load] of [["TALKS", talks], ["ARTICLES", articles]]) {
  try {
    const lines = await load();
    if (lines.length) readme = replace(readme, name, lines);
    console.log(`${name}: ${lines.length} 件`);
  } catch (e) {
    console.warn(`${name}: 取得に失敗したので残す (${e.message})`);
  }
}
writeFileSync("README.md", readme);
