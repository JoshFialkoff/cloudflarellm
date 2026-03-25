export default async function handler(req, res) {
  const { path } = req.query;
  
  if (!path) {
    return res.status(400).json({ error: 'Path parameter is required' });
  }

  // Try different possible paths for the image
  const filename = path.split('/').pop();
  const possiblePaths = [
    `https://lp.aiassistliving.com/wp-content/uploads/${path}`,
    `https://lp.aiassistliving.com/wp-content/uploads/2026/02/${filename}`,
    `https://lp.aiassistliving.com/wp-content/uploads/2026/02/${filename.replace('.jpg', '-scaled.jpg')}`,
    `https://lp.aiassistliving.com/wp-content/uploads/2026/02/${filename.replace('-683x1024.jpg', '-scaled-683x1024.jpg')}`,
    `https://lp.aiassistliving.com/wp-content/uploads/2026/01/${filename}`,
    `https://lp.aiassistliving.com/wp-content/uploads/2026/01/${filename.replace('.jpg', '-scaled.jpg')}`,
    `https://lp.aiassistliving.com/wp-content/uploads/2026/01/${filename.replace('-683x1024.jpg', '-scaled-683x1024.jpg')}`
  ];

  // Try each path until we find one that works
  for (const url of possiblePaths) {
    try {
      const response = await fetch(url);
      
      if (response.ok) {
        // If we found a working URL, stream the image
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Set appropriate headers
        res.setHeader('Content-Type', response.headers.get('content-type'));
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        
        // Send the image
        return res.send(buffer);
      }
    } catch (error) {
      // Continue to next URL if this one fails
      continue;
    }
  }

  // If no path works, return 404
  res.status(404).json({ error: 'Image not found' });
}
