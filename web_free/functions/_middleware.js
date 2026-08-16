// 有料サイト（itp-lovecome1.puniee-work.com）の access=granted Cookie は
// Domain=.puniee-work.com で発行されているため、こちら（無料サイト）にも同じCookieが届く。
// 届いていれば「購入済み」とみなし、購入ボタンを
//   「全108話見る（Stripeで購入）／全108話を購入する（980円）」
// から
//   「全108話見る」（Stripeを経由せず、有料サイトへ直接遷移）
// に、HTMLを返す直前にHTMLRewriterで書き換える。Cookie自体はHttpOnlyのままなので、
// JS側からは読めず、合言葉キーもクライアントには一切渡さない。

const PAID_SITE_URL = 'https://itp-lovecome1.puniee-work.com/';

class PurchasedButtonRewriter {
  element(el) {
    el.setAttribute('href', PAID_SITE_URL);
    el.setInnerContent('全108話見る');
  }
}

class RemoveElement {
  element(el) {
    el.remove();
  }
}

export async function onRequest(context) {
  const { request, next } = context;
  const response = await next();

  const cookie = request.headers.get('Cookie') || '';
  const hasAccess = /(?:^|;\s*)access=granted(?:;|$)/.test(cookie);
  if (!hasAccess) return response;

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  return new HTMLRewriter()
    .on('a.purchase-btn', new PurchasedButtonRewriter())
    .on('a.post-nav-btn-primary', new PurchasedButtonRewriter())
    .on('p.purchase-price', new RemoveElement())
    .transform(response);
}
