export class SeoCrawlerController {
  /**
   * Live SEO URL Crawler & Diagnostic Endpoint: POST /api/seo/crawl
   */
  static async crawlUrl(req, res, next) {
    try {
      const { url, device = 'desktop' } = req.body;
      if (!url || typeof url !== 'string' || !url.trim()) {
        return res.status(400).json({ success: false, error: 'A valid website URL is required.' });
      }

      let targetUrl = url.trim();
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
      }

      const userAgent =
        device === 'smartphone'
          ? 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36 (ZunmeBot/2.0)'
          : 'Mozilla/5.0 (compatible; ZunmeBot/2.0; +https://zunme.ai/crawler)';

      const startTime = performance.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6500);

      let response;
      try {
        response = await fetch(targetUrl, {
          headers: {
            'User-Agent': userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          },
          signal: controller.signal
        });
      } catch (fetchErr) {
        clearTimeout(timeout);
        return res.json({
          success: true,
          url: targetUrl,
          device,
          httpStatus: 0,
          renderTime: `${Math.round(performance.now() - startTime)}ms`,
          statusText: `Connection failed: ${fetchErr.message}`,
          title: 'Unable to reach host',
          description: 'No response from the target server or domain does not resolve.',
          meta: { ssl: targetUrl.startsWith('https://'), robots: 'N/A' },
          headers: {}
        });
      } finally {
        clearTimeout(timeout);
      }

      const renderTime = `${Math.round(performance.now() - startTime)}ms`;
      const html = await response.text().catch(() => '');

      // Parse metadata from raw HTML
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : 'No <title> tag found';

      const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
        || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
      const description = descMatch ? descMatch[1].trim() : 'No meta description configured.';

      const robotsMatch = html.match(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']*)["']/i);
      const robots = robotsMatch ? robotsMatch[1].trim() : 'index, follow (default)';

      const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i);
      const canonical = canonicalMatch ? canonicalMatch[1].trim() : targetUrl;

      const headersObj = {};
      response.headers.forEach((val, key) => {
        headersObj[key] = val;
      });

      return res.json({
        success: true,
        url: targetUrl,
        device,
        httpStatus: response.status,
        renderTime,
        statusText: response.statusText,
        title,
        description,
        canonical,
        meta: {
          ssl: targetUrl.startsWith('https://'),
          robots,
          contentLength: html.length,
          contentType: response.headers.get('content-type') || 'text/html'
        },
        headers: headersObj
      });
    } catch (err) {
      console.error('[SeoCrawlerController] Error crawling URL:', err);
      return res.status(500).json({ success: false, error: err.message || 'Crawl failed.' });
    }
  }
}

