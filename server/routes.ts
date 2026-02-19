import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

const BOT_UA = /Twitterbot|facebookexternalhit|Discordbot|Slackbot|WhatsApp|TelegramBot|LinkedInBot|Googlebot|bingbot|iMessagebot/i;

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/eth-price", async (_req, res) => {
    try {
      const response = await fetch(
        "https://api.coinbase.com/v2/prices/ETH-USD/spot"
      );
      const data = await response.json();
      const usd = parseFloat(data?.data?.amount);
      if (usd && usd > 0) {
        res.json({ ethereum: { usd } });
      } else {
        throw new Error("invalid price");
      }
    } catch {
      try {
        const fallback = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
        );
        const fbData = await fallback.json();
        res.json(fbData);
      } catch {
        res.json({ ethereum: { usd: 0 } });
      }
    }
  });

  function serveBotOgHtml(req: any, res: any, next: any) {
    const ua = req.headers['user-agent'] || '';
    if (!BOT_UA.test(ua)) return next();

    const path = req.path;
    const origin = 'https://thejuiceapp.io';
    const ogImage = `${origin}/og-image.png`;

    let title = 'The Juice - P2P Betting on Base';
    let description = 'Peer-to-peer betting and escrow on Base network. Create challenges, set odds, and bet directly against friends with smart contract security.';

    if (path === '/lookup') {
      const id = req.query.id as string || '';
      const q = req.query.q as string || '';
      const question = q ? decodeURIComponent(q) : '';
      if (question) {
        title = `${question} - The Juice`;
        description = `Join this bet: "${question}" on The Juice. Peer-to-peer prediction market on Base.`;
      } else if (id) {
        title = `Bet #${id} - The Juice`;
        description = `View and join Bet #${id} on The Juice. Peer-to-peer prediction market on Base.`;
      }
    } else if (path === '/challenge') {
      title = 'Create Challenge - The Juice';
      description = 'Create a head-to-head challenge with equal stakes on The Juice. Peer-to-peer betting on Base network.';
    } else if (path === '/trending') {
      title = 'Trending Markets - The Juice';
      description = 'Browse the hottest open bets on The Juice. Peer-to-peer prediction markets on Base network.';
    } else if (path === '/my-bets') {
      title = 'My Bets - The Juice';
      description = 'Track your betting history, wins, and active bets on The Juice.';
    }

    const url = `${origin}${req.originalUrl}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:url" content="${escapeHtml(url)}" />
<meta property="og:image" content="${ogImage}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="675" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="The Juice" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${ogImage}" />
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(description)}</p>
<a href="${escapeHtml(url)}">Open in The Juice</a>
</body>
</html>`;

    res.set('Content-Type', 'text/html');
    res.send(html);
  }

  app.get("/", serveBotOgHtml);
  app.get("/lookup", serveBotOgHtml);
  app.get("/challenge", serveBotOgHtml);
  app.get("/trending", serveBotOgHtml);
  app.get("/my-bets", serveBotOgHtml);

  return httpServer;
}
