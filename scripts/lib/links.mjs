// note・Stripeまわりの外部リンクをここに集約する。
// build-html.mjs（記事ページ下部の導線）と build-free-index.mjs（購入ボタン）の両方から参照する。
// URLを変更するときはここだけ直せばよい。

// Stripe Payment Link（本番、300円）。支払い後は /unlock?key=... 経由で
// itp-lovecome1.puniee-work.com にリダイレクトされるよう設定済み。
export const STRIPE_PURCHASE_URL = 'https://buy.stripe.com/5kQ9AM7eobaF9pf0UL33W02';

// note側の「全108話まとめ（有料）」記事URL。空ならボタン自体を出さない仕組みになっている。
export const NOTE_PAID_SUMMARY_URL = 'https://note.com/cute_camel1259/n/n6cf51a4b5465';

export const PRICE_LABEL = '¥300（税込）';

// SEO用（canonical・OGP・sitemap生成）の絶対URLベース。末尾にスラッシュは付けない。
export const FREE_BASE_URL = 'https://itp-lovecome1-free.puniee-work.com';
export const PAID_BASE_URL = 'https://itp-lovecome1.puniee-work.com';
export const SITE_NAME = 'ITパスポート過去問 ラブコメ♥解説';

// Google Search Console 所有権確認用タグ（無料サイト itp-lovecome1-free.puniee-work.com 用）。
// 未設定の間は空文字にしておく（build側で空なら何も埋め込まない）。
export const GOOGLE_SITE_VERIFICATION_FREE = '0-v6CVaNU3h9D5Yw373vGnZ5f5Cju0XpfsWTc2XBGVM';

// お問い合わせ先。全ページ下部の「お問い合わせ」リンクから使う。
export const CONTACT_EMAIL = 'puniee.work@gmail.com';
export const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('ITパスポート過去問 ラブコメ解説について')}`;

// Cloudflare Web Analytics（手動セットアップのスニペット）。サイトごとにトークンが異なるため、
// web_free（無料サイト）と web（有料サイト）で別々に持つ。未設定の間は空文字にしておく
// （build側で空なら何も埋め込まない）。
export const WEB_ANALYTICS_SNIPPET_FREE =
  `<script type='module' src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "1e557915580844ab85372ac0e8263b4d"}'></script>`;
export const WEB_ANALYTICS_SNIPPET_PAID =
  `<script type='module' src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "efba3452f09d4ac9ae9ee9b2b37cb0c0"}'></script>`;
